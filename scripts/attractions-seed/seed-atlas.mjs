#!/usr/bin/env node
// seed-atlas.mjs — resolve the founder-blessed Global Stamp Atlas to Wikidata
// identities + coordinates and emit D1 INSERT SQL (source='icons').
//   node seed-atlas.mjs atlas.json OUT_DIR
// founder_scope = the atlas scope (the founder's blessing, outranks the bar);
// scope = the fame bar's own verdict from measured sitelinks (kept honest).
// Rows that cannot be confidently resolved get NO insert — they land in
// unresolved.json for a manual pass. Backoff + resumable caches throughout.
import fs from "node:fs";
const [IN, OUT] = process.argv.slice(2);
const UA = "GlobeSkimmersAtlasSeed/1.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(url) {
  for (let a = 0; a < 7; a++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } }).catch(() => null);
    if (r && r.ok) return r.json();
    if (r && r.status !== 429 && r.status < 500) throw new Error(String(r.status));
    await sleep(Math.max((r ? parseInt(r.headers.get("retry-after") || "0", 10) : 0) * 1000, 2000 * 2 ** a));
  }
  throw new Error("gave up");
}
const rows = JSON.parse(fs.readFileSync(IN, "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const CK = OUT + "/atlas-cache.jsonl"; const cache = new Map();
if (fs.existsSync(CK)) for (const l of fs.readFileSync(CK, "utf8").split("\n")) { if (!l) continue; try { const j = JSON.parse(l); cache.set(j.k, j.v); } catch { } }
const cOut = fs.createWriteStream(CK, { flags: "a" });
console.error(`${rows.length} atlas rows · ${cache.size} cached`);
// 1. name+country → enwiki top article → QID (contextual, kills cross-country collisions)
let done = 0;
for (const r of rows) {
  const key = `${r.name}|${r.country}`;
  if (cache.has(key)) continue;
  let v = null, transient = false;
  try {
    const q = await api(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(`${r.name} ${r.country}`)}`);
    const title = q.query?.search?.[0]?.title;
    if (title) {
      const pp = await api(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=${encodeURIComponent(title)}`);
      const page = Object.values(pp.query?.pages || {})[0];
      v = page?.pageprops?.wikibase_item ? { qid: page.pageprops.wikibase_item, title } : null;
    }
  } catch (e) { transient = /gave up|429|^5/.test(String(e.message)); }
  if (!transient) { cache.set(key, v); cOut.write(JSON.stringify({ k: key, v }) + "\n"); }
  if (++done % 100 === 0) console.error(`  qid ${done}`);
  await sleep(250);
}
// 2. batched entity signals
const qids = [...new Set(rows.map((r) => cache.get(`${r.name}|${r.country}`)?.qid).filter(Boolean))];
const sig = new Map();
const SK = OUT + "/atlas-sig.jsonl";
if (fs.existsSync(SK)) for (const l of fs.readFileSync(SK, "utf8").split("\n")) { if (!l) continue; try { const j = JSON.parse(l); sig.set(j.k, j.v); } catch { } }
const sOut = fs.createWriteStream(SK, { flags: "a" });
const need = qids.filter((q) => !sig.has(q));
console.error(`signals: ${sig.size} cached, ${need.length} to fetch`);
for (let i = 0; i < need.length; i += 50) {
  const batch = need.slice(i, i + 50);
  try {
    const j = await api(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks|claims&format=json&ids=${batch.join("|")}`);
    for (const [id, e] of Object.entries(j.entities || {})) {
      const p = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      const v = { links: Object.keys(e.sitelinks || {}).filter((k) => k.endsWith("wiki") && k !== "commonswiki").length, lat: p?.latitude ?? null, lng: p?.longitude ?? null };
      sig.set(id, v); sOut.write(JSON.stringify({ k: id, v }) + "\n");
    }
  } catch (e) { console.error(`  batch ${i}: ${e.message}`); }
  await sleep(400);
}
// 3. emit
const CATMAP = { icon: "landmark", "natural-wonder": "landmark", "national-park": "national_park", "theme-park": "theme_park", landmark: "landmark", museum: "museum", beach: "beach", religious: "religious", "event-venue": "experience", "entry-point": "landmark", historic: "historic" };
const slug = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const q_ = (s) => s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;
const today = new Date().toISOString().slice(0, 10);
const out = [], unresolved = [];
const fame = (links) => links >= 70 ? "world" : links >= 32 ? "national" : links >= 7 ? "regional" : "local";
const seenIds = new Set();
for (const r of rows) {
  const hit = cache.get(`${r.name}|${r.country}`);
  const s = hit?.qid ? sig.get(hit.qid) : null;
  if (!hit?.qid || !s || s.lat == null) { unresolved.push(r); continue; }
  const id = `icon:${hit.qid}`;
  if (seenIds.has(id)) continue; seenIds.add(id);
  const marquee = r.scope === "world" || r.scope === "national" ? 1 : 0;
  out.push(`INSERT OR REPLACE INTO attractions (id,name,category,lat,lng,city,country,typical_minutes,is_marquee,free_to_visit,source,last_reviewed,tier,scope,founder_scope,qid,sitelinks) VALUES (${q_(id)},${q_(r.name)},${q_(CATMAP[r.category] || "landmark")},${s.lat},${s.lng},${q_(r.city || null)},${q_(r.country)},60,${marquee},0,'icons',${q_(today)},'page',${q_(fame(s.links))},${q_(r.scope)},${q_(hit.qid)},${s.links});`);
}
fs.writeFileSync(OUT + "/atlas-seed.sql", out.join("\n") + "\n");
fs.writeFileSync(OUT + "/atlas-unresolved.json", JSON.stringify(unresolved, null, 1));
console.error(`DONE — ${out.length} inserts · ${unresolved.length} unresolved (manual pass)`);
