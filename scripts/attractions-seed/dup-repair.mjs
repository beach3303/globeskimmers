#!/usr/bin/env node
// dup-repair.mjs — fix duplicate-id collisions in the planet seed.
//
//   node dup-repair.mjs SEED.sql OUT_DIR
//
// 3,292 wikidata ids appear in 2..87 city pages. INSERT OR REPLACE keeps the
// LAST occurrence, which for cross-listings is fine (same real place) but for
// mistagged listings poisons the id (measured: a Kolkata listing tagged Q243
// could own "Eiffel Tower"). Repair: fetch P625 for every duplicated qid and
// crown the occurrence nearest the true coordinates (within 5km) canonical —
// emit an UPDATE restoring its values; ids with NO occurrence within 5km are
// 100% mistags → DELETE the row. Report everything.
import fs from "node:fs";
import path from "node:path";
const [SEED, OUT] = process.argv.slice(2);
const UA = "GlobeSkimmersAttractionsSeed/1.0";
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
fs.mkdirSync(OUT, { recursive: true });
const unq = (s) => s.replace(/''/g, "'");
const q_ = (s) => s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;
// parse every wikidata: INSERT — capture the full VALUES tuple fields we may restore
const RE = /^INSERT OR REPLACE INTO attractions \(id, name, category, lat, lng, city, country, typical_minutes, is_marquee, free_to_visit, source, source_id, last_reviewed, popularity, place_id, footprint_radius_m, tier\) VALUES \('(wikidata:(Q\d+))', '((?:[^']|'')*)', '((?:[^']|'')*)', (-?[\d.]+|NULL), (-?[\d.]+|NULL), ('(?:[^']|'')*'|NULL), ('(?:[^']|'')*'|NULL), (\d+|NULL), ([01]), ([01]), '((?:[^']|'')*)', ('(?:[^']|'')*'|NULL), '((?:[^']|'')*)', (\d+|NULL), ('(?:[^']|'')*'|NULL), (\d+|NULL), ('(?:[^']|'')*'|NULL)\);/;
const byId = new Map();
for (const line of fs.readFileSync(SEED, "utf8").split("\n")) {
  const m = RE.exec(line);
  if (!m) continue;
  const rec = { id: m[1], qid: m[2], name: unq(m[3]), category: unq(m[4]), lat: m[5] === "NULL" ? null : parseFloat(m[5]), lng: m[6] === "NULL" ? null : parseFloat(m[6]), cityRaw: m[7], countryRaw: m[8], typical: m[9], marquee: m[10], free: m[11], source: m[12], sourceIdRaw: m[13], reviewed: m[14], popRaw: m[15], placeRaw: m[16], footRaw: m[17], tierRaw: m[18] };
  if (!byId.has(rec.id)) byId.set(rec.id, []);
  byId.get(rec.id).push(rec);
}
const dups = [...byId.entries()].filter(([, v]) => v.length > 1);
console.error(`parsed ${byId.size} wikidata ids · ${dups.length} duplicated`);
const km = (a, b, c, d) => { const R = 6371, r = (x) => x * Math.PI / 180; const s = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
// fetch P625 for duplicated qids (cache to disk, resumable)
const CK = path.join(OUT, "p625-cache.jsonl");
const p625 = new Map();
if (fs.existsSync(CK)) for (const l of fs.readFileSync(CK, "utf8").split("\n")) { if (!l) continue; try { const j = JSON.parse(l); p625.set(j.k, j.v); } catch {} }
const cOut = fs.createWriteStream(CK, { flags: "a" });
const need = dups.map(([, v]) => v[0].qid).filter((q) => !p625.has(q));
console.error(`P625: ${p625.size} cached, ${need.length} to fetch`);
for (let i = 0; i < need.length; i += 50) {
  const batch = need.slice(i, i + 50);
  try {
    const j = await api(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=${batch.join("|")}`);
    for (const id of batch) {
      const p = j.entities?.[id]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      const v = p ? { lat: p.latitude, lng: p.longitude } : null;
      p625.set(id, v); cOut.write(JSON.stringify({ k: id, v }) + "\n");
    }
  } catch (e) { console.error(`  batch ${i}: ${e.message}`); }
  await sleep(350);
}
const updates = [], deletes = [], noCoordKeep = [], report = [];
for (const [id, occs] of dups) {
  const truth = p625.get(occs[0].qid);
  if (!truth) { noCoordKeep.push(id); continue; }          // no P625 → leave last-writer (can't judge)
  let best = null, bestD = Infinity;
  for (const o of occs) { if (o.lat == null) continue; const d = km(o.lat, o.lng, truth.lat, truth.lng); if (d < bestD) { bestD = d; best = o; } }
  const last = occs[occs.length - 1];
  if (!best || bestD > 5) { deletes.push(`DELETE FROM attractions WHERE id=${q_(id)};`); report.push({ id, verdict: "mistag-all", occs: occs.length, bestKm: best ? +bestD.toFixed(1) : null }); continue; }
  const lastD = last.lat != null ? km(last.lat, last.lng, truth.lat, truth.lng) : Infinity;
  if (last === best || lastD <= 5) continue;               // last writer already fine
  updates.push(`UPDATE attractions SET name=${q_(best.name)}, category=${q_(best.category)}, lat=${best.lat}, lng=${best.lng}, city=${best.cityRaw}, country=${best.countryRaw}, popularity=${best.popRaw}, place_id=${best.placeRaw}, footprint_radius_m=${best.footRaw} WHERE id=${q_(id)};`);
  report.push({ id, verdict: "restored", occs: occs.length, canonical: best.name, canonicalKm: +bestD.toFixed(2), lastWriterKm: lastD === Infinity ? null : +lastD.toFixed(1) });
}
fs.writeFileSync(path.join(OUT, "dup-repair.sql"), updates.concat(deletes).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "dup-report.json"), JSON.stringify(report, null, 1));
console.error(`DONE — restores: ${updates.length} · deletes (all-mistag): ${deletes.length} · no-P625 left alone: ${noCoordKeep.length}`);
const q243 = report.find((r) => r.id === "wikidata:Q243");
console.error("Q243 verdict:", JSON.stringify(q243 || "last-writer already canonical"));
