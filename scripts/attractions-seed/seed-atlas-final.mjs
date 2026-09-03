#!/usr/bin/env node
// seed-atlas-final.mjs — founder-triage pass closing out the atlas misses.
// decisions.json: { accept: [qid...], titles: {atlasName: exact enwiki title} }.
// accept  → the retry pass got the right entity; its SQL line is kept verbatim.
// titles  → resolve THE NAMED ARTICLE (no search): title → QID → P625 + links,
//           P31 municipal guard still applies (a title that turns out to be a
//           city is refused, not trusted).
// leftovers → atlas-founder-manual.json for the human pass.
//   node seed-atlas-final.mjs UNRESOLVED.json RETRY_DIR
import fs from "node:fs";
const [UN, DIR] = process.argv.slice(2);
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
const rows = JSON.parse(fs.readFileSync(UN, "utf8"));            // original atlas rows (name, country, city, scope, category)
const dec = JSON.parse(fs.readFileSync(DIR + "/decisions.json", "utf8"));
const retrySql = fs.readFileSync(DIR + "/atlas-retry-seed.sql", "utf8").split("\n").filter(Boolean);
const CITY = new Set(["Q515", "Q1549591", "Q5119", "Q3957", "Q532", "Q15284", "Q1637706", "Q200250", "Q486972", "Q7930989"]);
const CATMAP = { icon: "landmark", "natural-wonder": "landmark", "national-park": "national_park", "theme-park": "theme_park", landmark: "landmark", museum: "museum", beach: "beach", religious: "religious", "event-venue": "experience", "entry-point": "landmark", historic: "historic" };
const q_ = (s) => s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;
const today = new Date().toISOString().slice(0, 10);
const fame = (links) => links >= 70 ? "world" : links >= 32 ? "national" : links >= 7 ? "regional" : "local";
const out = [], manual = [], receipts = [];
const acceptSet = new Set(dec.accept);
for (const line of retrySql) { const m = line.match(/'icon:(Q\d+)'/); if (m && acceptSet.has(m[1])) out.push(line); }
console.error(`accepted from retry pass: ${out.length}/${acceptSet.size}`);
const seen = new Set(out.map((l) => l.match(/'icon:(Q\d+)'/)[1]));
for (const r of rows) {
  const title = dec.titles[r.name];
  if (!title) { if (!retrySql.some((l) => l.includes(q_(r.name).slice(1, -1)) ) || true) { /* only manual if not accepted */ } }
}
for (const [name, title] of Object.entries(dec.titles)) {
  const r = rows.find((x) => x.name === name);
  if (!r) { console.error(`  ?? decisions has "${name}" but no atlas row — skipped`); continue; }
  let ok = null, why = "no article";
  try {
    const pp = await api(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=${encodeURIComponent(title)}`);
    const page = Object.values(pp.query?.pages || {})[0];
    const qid = page?.pageprops?.wikibase_item;
    if (qid) {
      const j = await api(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks|claims&format=json&ids=${qid}`);
      const e = j.entities?.[qid];
      const p = e?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      const classes = (e?.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
      const links = Object.keys(e?.sitelinks || {}).filter((k) => k.endsWith("wiki") && k !== "commonswiki").length;
      if (classes.some((c) => CITY.has(c)) && !classes.includes("Q40080")) why = `city-class (${classes.join("/")})`;
      else if (p?.latitude == null) why = "no coords";
      else ok = { qid, links, lat: p.latitude, lng: p.longitude };
    }
  } catch (e) { why = `api: ${e.message}`; }
  if (ok && !seen.has(ok.qid)) {
    seen.add(ok.qid);
    const marquee = r.scope === "world" || r.scope === "national" ? 1 : 0;
    out.push(`INSERT OR REPLACE INTO attractions (id,name,category,lat,lng,city,country,typical_minutes,is_marquee,free_to_visit,source,last_reviewed,tier,scope,founder_scope,qid,sitelinks) VALUES (${q_("icon:" + ok.qid)},${q_(r.name)},${q_(CATMAP[r.category] || "landmark")},${ok.lat},${ok.lng},${q_(r.city || null)},${q_(r.country)},60,${marquee},0,'icons',${q_(today)},'page',${q_(fame(ok.links))},${q_(r.scope)},${q_(ok.qid)},${ok.links});`);
    receipts.push({ name, title, qid: ok.qid, links: ok.links });
    console.error(`  ✓ ${name} → ${title} (${ok.qid})`);
  } else if (ok) { console.error(`  = ${name} → ${ok.qid} already seeded (shared article)`); }
  else { manual.push({ ...r, tried: title, why }); console.error(`  ✗ ${name} → "${title}": ${why}`); }
  await sleep(300);
}
for (const r of rows) {
  const resolvedNames = new Set([...Object.keys(dec.titles), ...retrySql.filter((l) => acceptSet.has((l.match(/'icon:(Q\d+)'/) || [])[1])).map((l) => (l.match(/VALUES \('icon:Q\d+','((?:[^']|'')+)'/) || [])[1]?.replace(/''/g, "'"))]);
  if (!resolvedNames.has(r.name) && !manual.some((m) => m.name === r.name)) manual.push({ ...r, tried: null, why: "triage: no article exists" });
}
fs.writeFileSync(DIR + "/atlas-final-seed.sql", out.join("\n") + (out.length ? "\n" : ""));
fs.writeFileSync(DIR + "/atlas-founder-manual.json", JSON.stringify(manual, null, 1));
fs.writeFileSync(DIR + "/atlas-final-receipts.json", JSON.stringify(receipts, null, 1));
console.error(`DONE — ${out.length} final inserts · ${manual.length} to founder manual list`);
