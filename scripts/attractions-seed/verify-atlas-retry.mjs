#!/usr/bin/env node
// verify-atlas-retry.mjs — adversarial pass over seed-atlas-retry resolutions.
// "First top-5 candidate with coords" still accepts cities (EPCOT → Orlando),
// events (White House → Burning of Washington) and sub-venues. This fetches
// P31 for every resolved QID and flags:
//   city-class    — P31 direct in municipal classes (the CITY_DIRECT guard)
//   event-class   — P31 in occurrence/event classes
//   name-mismatch — no meaningful token overlap between atlas name and article
// Output: OUT/atlas-retry-flagged.json (bad) + OUT/atlas-retry-clean.json (good).
//   node verify-atlas-retry.mjs atlas-retry-report.json OUT_DIR
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
// direct-P31 guards (same spirit as score-fame's CITY_DIRECT + event add-ons)
const CITY = new Set(["Q515", "Q1549591", "Q5119", "Q3957", "Q532", "Q15284", "Q1637706", "Q200250", "Q486972", "Q7930989"]);
const EVENT = new Set(["Q1190554", "Q1656682", "Q198", "Q178561", "Q13418847", "Q3839081", "Q41397"]);
const LISTY = new Set(["Q13406463", "Q4167410"]); // list article, disambiguation
const STOP = new Set(["the", "of", "at", "de", "la", "le", "and", "national", "park", "old", "city", "tour"]);
const toks = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));
const rows = JSON.parse(fs.readFileSync(IN, "utf8"));
const qids = [...new Set(rows.map((r) => r.qid))];
const p31 = new Map();
for (let i = 0; i < qids.length; i += 50) {
  const batch = qids.slice(i, i + 50);
  const j = await api(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=${batch.join("|")}`);
  for (const [id, e] of Object.entries(j.entities || {}))
    p31.set(id, (e.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean));
  await sleep(400);
}
const flagged = [], clean = [];
for (const r of rows) {
  const classes = p31.get(r.qid) || [];
  const reasons = [];
  if (classes.some((c) => CITY.has(c))) reasons.push("city-class");
  if (classes.some((c) => EVENT.has(c))) reasons.push("event-class");
  if (classes.some((c) => LISTY.has(c))) reasons.push("list/disambig");
  const nt = toks(r.name), at = toks(r.article);
  const overlap = nt.filter((t) => at.some((a) => a.includes(t) || t.includes(a))).length;
  if (nt.length && overlap === 0) reasons.push("name-mismatch");
  (reasons.length ? flagged : clean).push({ ...r, p31: classes, reasons });
}
fs.writeFileSync(OUT + "/atlas-retry-flagged.json", JSON.stringify(flagged, null, 1));
fs.writeFileSync(OUT + "/atlas-retry-clean.json", JSON.stringify(clean, null, 1));
console.error(`verify: ${clean.length} clean · ${flagged.length} flagged`);
for (const f of flagged) console.error(`  ⚑ ${f.name} → ${f.article} (${f.qid}) [${f.reasons.join(",")}] p31=${f.p31.join("/")}`);
