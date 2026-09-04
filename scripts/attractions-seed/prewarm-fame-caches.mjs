#!/usr/bin/env node
// prewarm-fame-caches.mjs — make planet-scale fame scoring nearly API-free.
//
//   node prewarm-fame-caches.mjs ENTITY_CACHE.jsonl SEED.sql OUT_DIR
//
// score-fame.mjs resolves row→QID by API search and fetches per-QID signals —
// fine at 3k rows, days at 100k. But the classify stage ALREADY fetched
// sitelinks+P31+P1435 for 72k entities (entity-cache.jsonl), and the emitted
// row ids literally ENCODE the qid ('wikidata:Q243'). This writes score-fame's
// two resume caches so its own API loops only touch true stragglers:
//   qid-cache.jsonl: {k: rowId, v: qid|null} — wikidata: ids decode; wv: ids
//     get v:null (score-fame treats null as no-item, which is the honest truth
//     for coordinate-only Wikivoyage listings — no API search per row).
//   sig-cache.jsonl: {k: qid, v: {sitelinks, p31, heritage, enTitle: null}}
//     mapped from the classify entity cache (enTitle unknown there → null;
//     the pv backstop skips those rows, an accepted minor loss).
import fs from "node:fs";
import path from "node:path";
const [ECACHE, SEED, OUT] = process.argv.slice(2);
if (!ECACHE || !SEED || !OUT) { console.error("usage: prewarm-fame-caches.mjs ENTITY_CACHE SEED.sql OUT_DIR"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const qidOut = fs.createWriteStream(path.join(OUT, "qid-cache.jsonl"));
let wik = 0, wv = 0;
for (const line of fs.readFileSync(SEED, "utf8").split("\n")) {
  const m = line.match(/^INSERT OR REPLACE INTO attractions[^']*'((wikidata|wv):[^']+)'/);
  if (!m) continue;
  const id = m[1];
  if (id.startsWith("wikidata:")) { qidOut.write(JSON.stringify({ k: id, v: id.slice(9) }) + "\n"); wik++; }
  else { qidOut.write(JSON.stringify({ k: id, v: null }) + "\n"); wv++; }
}
qidOut.end();

const sigOut = fs.createWriteStream(path.join(OUT, "sig-cache.jsonl"));
let sigs = 0;
for (const line of fs.readFileSync(ECACHE, "utf8").split("\n")) {
  if (!line) continue;
  let j; try { j = JSON.parse(line); } catch { continue; }
  const v = j.v || {};
  sigOut.write(JSON.stringify({ k: j.k, v: { sitelinks: v.sitelinks ?? 0, p31: v.p31 || [], heritage: !!v.heritage, enTitle: null } }) + "\n");
  sigs++;
}
sigOut.end();
console.error(`prewarmed — qid-cache: ${wik} wikidata + ${wv} wv rows · sig-cache: ${sigs} entities`);
