#!/usr/bin/env node
// seed-atlas-retry.mjs — second pass over atlas-unresolved.json. The first pass
// took enwiki's top-1 for "name country" and refused anything without P625
// coords; famous names with messy qualifiers lost to disambigs/films/lists.
// This pass tries query variants and scans the TOP 5 candidates, accepting the
// first whose Wikidata entity actually has coordinates.
//   node seed-atlas-retry.mjs atlas-unresolved.json OUT_DIR
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
const cleanCountry = (c) => String(c || "").replace(/\s*\(.*$/, "").trim();     // "Faroe Islands (Denmark, territory)" → "Faroe Islands"
const variants = (r) => {
  const name = r.name, base = name.replace(/\s*\(.*?\)/g, "").trim();
  const first = base.split(/\s*[—–&]\s*/)[0].trim();                            // "Big Ben & Houses..." → "Big Ben"
  const co = cleanCountry(r.country);
  const v = [];
  if (r.city) v.push(`${base} ${r.city}`);
  v.push(`${base} ${co}`);
  if (first && first !== base) v.push(`${first} ${co}`);
  v.push(base);
  return [...new Set(v)];
};
const results = [], still = [];
for (const r of rows) {
  let hit = null, tried = [];
  for (const q of variants(r)) {
    tried.push(q);
    let titles = [];
    try {
      const s = await api(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=5&format=json&srsearch=${encodeURIComponent(q)}`);
      titles = (s.query?.search || []).map((x) => x.title);
    } catch { continue; }
    if (!titles.length) continue;
    let pages = {};
    try {
      const pp = await api(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=${encodeURIComponent(titles.join("|"))}`);
      pages = pp.query?.pages || {};
    } catch { continue; }
    const byTitle = new Map();
    for (const p of Object.values(pages)) if (p.pageprops?.wikibase_item) byTitle.set(p.title, p.pageprops.wikibase_item);
    // redirects: map original order through redirect targets loosely — fall back to page order
    const qids = titles.map((t) => byTitle.get(t)).filter(Boolean);
    for (const p of Object.values(pages)) { const q2 = p.pageprops?.wikibase_item; if (q2 && !qids.includes(q2)) qids.push(q2); }
    if (!qids.length) continue;
    let ents = {};
    try {
      const j = await api(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks|claims&format=json&ids=${qids.slice(0, 10).join("|")}`);
      ents = j.entities || {};
    } catch { continue; }
    for (const qid of qids) {
      const e = ents[qid]; if (!e) continue;
      const p = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (p?.latitude == null) continue;
      const links = Object.keys(e.sitelinks || {}).filter((k) => k.endsWith("wiki") && k !== "commonswiki").length;
      const title = Object.values(e.sitelinks || {}).find((s) => s.site === "enwiki")?.title || qid;
      hit = { qid, title, links, lat: p.latitude, lng: p.longitude, via: q };
      break;
    }
    await sleep(250);
    if (hit) break;
  }
  if (hit) { results.push({ r, hit }); console.error(`  ✓ ${r.name} → ${hit.title} (${hit.qid}, ${hit.links} links) via "${hit.via}"`); }
  else { still.push(r); console.error(`  ✗ ${r.name} (tried: ${tried.join(" · ")})`); }
  await sleep(250);
}
const CATMAP = { icon: "landmark", "natural-wonder": "landmark", "national-park": "national_park", "theme-park": "theme_park", landmark: "landmark", museum: "museum", beach: "beach", religious: "religious", "event-venue": "experience", "entry-point": "landmark", historic: "historic" };
const q_ = (s) => s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;
const today = new Date().toISOString().slice(0, 10);
const fame = (links) => links >= 70 ? "world" : links >= 32 ? "national" : links >= 7 ? "regional" : "local";
const seen = new Set(); const out = [];
for (const { r, hit } of results) {
  const id = `icon:${hit.qid}`;
  if (seen.has(id)) continue; seen.add(id);
  const marquee = r.scope === "world" || r.scope === "national" ? 1 : 0;
  out.push(`INSERT OR REPLACE INTO attractions (id,name,category,lat,lng,city,country,typical_minutes,is_marquee,free_to_visit,source,last_reviewed,tier,scope,founder_scope,qid,sitelinks) VALUES (${q_(id)},${q_(r.name)},${q_(CATMAP[r.category] || "landmark")},${hit.lat},${hit.lng},${q_(r.city || null)},${q_(r.country)},60,${marquee},0,'icons',${q_(today)},'page',${q_(fame(hit.links))},${q_(r.scope)},${q_(hit.qid)},${hit.links});`);
}
fs.writeFileSync(OUT + "/atlas-retry-seed.sql", out.join("\n") + (out.length ? "\n" : ""));
fs.writeFileSync(OUT + "/atlas-still-unresolved.json", JSON.stringify(still, null, 1));
fs.writeFileSync(OUT + "/atlas-retry-report.json", JSON.stringify(results.map(({ r, hit }) => ({ name: r.name, country: r.country, article: hit.title, qid: hit.qid, links: hit.links, via: hit.via })), null, 1));
console.error(`DONE — ${out.length} recovered · ${still.length} still unresolved`);
