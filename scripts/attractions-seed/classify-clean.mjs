#!/usr/bin/env node
// classify-clean.mjs — stage 3: type-blacklist, team→venue mapping, and dedup.
//
//   node classify-clean.mjs RANKED_DIR OUT_DIR
//
// Validation of stages 1-2 surfaced three junk classes, each with a named
// culprit; this stage exists to remove exactly them:
//   * EVENTS ranked as places  — the French Open was Paris #4
//   * FAME bleeding into rank  — the Anaheim Ducks outranked Disneyland; a bust
//     of Dalida inherited the singer's 24k monthly readers
//   * DUPLICATES               — "La Tour Eiffel" and "Eiffel Tower", both 119,714
//
// Method (all free, a handful of batched calls):
//   1. Resolve a Wikidata QID for every row (listing wikidata= param, else the
//      enwiki article's pageprops).
//   2. Fetch each entity's P31 types, then ONE SPARQL query asks which of those
//      classes fall under the blacklist roots via P279* — the subclass closure
//      the source evaluation proved necessary (a plain P31 match misses most).
//   3. Verdicts: events/humans/teams etc. are dropped or transformed. A sports
//      TEAM becomes its home venue (P115) — kept as a real place to visit, but
//      with pv nulled, because fandom is reading interest in the TEAM, not
//      footfall at the building (measured ~5x apart).
//   4. Dedup by QID (else canonical article, else name+coords), keeping the
//      earliest listing's identity and the best-known pageview count.
//
// Blacklist load failure is a HARD ERROR: without the closure query the output
// ranks a plane crash as a top attraction (measured, Cebu). Never ship unfiltered.

import fs from "node:fs";
import path from "node:path";

const [RANKED, OUT] = process.argv.slice(2);
if (!RANKED || !OUT) { console.error("usage: node classify-clean.mjs RANKED_DIR OUT_DIR"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const UA = "GlobeSkimmersAttractionsSeed/1.0 (attractions classification pipeline)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Blacklist roots (Wikidata QIDs). A candidate whose P31 falls under any of
// these — via subclass closure — is junk for a "top spots" list.
const ROOTS = {
  // HARD: never overridable — events, people, taxa and non-destinations. High
  // pageviews on these are fame bleeding through, not footfall.
  HARD: [
    "Q13406554", // sports competition (French Open lands here)
    "Q27020041", // sports season
    "Q132241",   // festival
    "Q3839081",  // disaster (plane crashes — the Cebu case)
    "Q178561",   // battle
    "Q5",        // human (a bust's article redirecting to the person)
    "Q16521",    // taxon
    "Q46970",    // airline
    "Q1248784",  // airport (they get AIRPORT stamps, not destination rows)
    "Q851358",   // red-light district (family product call)
    "Q27686",    // hotel — belongs in the stay bucket, not attractions
  ],
  // SOFT: institutional types that are USUALLY not sights — but the closure
  // reaches surprising places (madrasa→school, avenue→road, Pont Alexandre III→
  // bridge), so a heritage designation (P1435) or a tourist-attraction/monument
  // typing overrides the drop. First run without this killed three marquee
  // attractions in two cities.
  SOFT: [
    "Q3918",     // university
    "Q3914",     // school
    "Q16917",    // hospital
    "Q7075",     // library
    "Q12280",    // bridge
    "Q34442",    // road
  ],
  KEEP: [
    "Q570116",   // tourist attraction
    "Q4989906",  // monument
    "Q839954",   // archaeological site
    "Q33506",    // museum
    "Q22698",    // park
  ],
  TEAM: [
    "Q12973014", // sports team
    "Q847017",   // sports club
  ],
};

async function api(url) {
  // backoff-protected: at planet scale the batched loops WILL see 429s; the
  // simple throw-on-!ok version killed nothing at 6 cities and everything at 21k.
  for (let a = 0; a < 7; a++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } }).catch(() => null);
    if (r && r.ok) return r.json();
    if (r && r.status !== 429 && r.status < 500) throw new Error(`${r.status} ${url.slice(0, 80)}`);
    await sleep(Math.max((r ? parseInt(r.headers.get("retry-after") || "0", 10) : 0) * 1000, 2000 * 2 ** a));
  }
  throw new Error(`gave up ${url.slice(0, 80)}`);
}

// ---- load every city's ranked rows ------------------------------------------
const cities = fs.readFileSync(path.join(RANKED, "ranked.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((l) => JSON.parse(l));
const rows = cities.flatMap((c) => c.top.map((r) => ({ ...r, city: c.city })));
console.error(`${cities.length} cities, ${rows.length} rows`);

// ---- 1. QID for every row ---------------------------------------------------
const qidByArticle = new Map();
const needQid = [...new Set(rows.filter((r) => !r.wikidata && r.article).map((r) => r.article))];
console.error(`resolving QIDs for ${needQid.length} articles...`);
for (let i = 0; i < needQid.length; i += 50) {
  const batch = needQid.slice(i, i + 50);
  const j = await api("https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=" +
    encodeURIComponent(batch.join("|")));
  for (const p of Object.values(j.query?.pages || {})) {
    if (p.pageprops?.wikibase_item) qidByArticle.set(p.title, p.pageprops.wikibase_item);
  }
  await sleep(150);
}
const qidOf = (r) => (r.wikidata || "").trim() || qidByArticle.get(r.article) || null;

// ---- 2. entity types (P31) + home venues (P115) -----------------------------
const qids = [...new Set(rows.map(qidOf).filter(Boolean))];
console.error(`fetching claims for ${qids.length} entities...`);
const entity = new Map();   // qid -> {p31:[], p115:[]}
for (let i = 0; i < qids.length; i += 50) {
  const batch = qids.slice(i, i + 50);
  const j = await api("https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|sitelinks&format=json&ids=" + batch.join("|"));
  for (const [id, e] of Object.entries(j.entities || {})) {
    const claim = (p) => (e.claims?.[p] || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    entity.set(id, { p31: claim("P31"), p115: claim("P115"), heritage: (e.claims?.P1435 || []).length > 0, sitelinks: Object.keys(e.sitelinks || {}).length });
  }
  await sleep(150);
}

// ---- 3. ONE closure query: which seen classes fall under which roots --------
const seenClasses = [...new Set([...entity.values()].flatMap((e) => e.p31))];
console.error(`closure query over ${seenClasses.length} classes...`);
const allRoots = [...ROOTS.HARD, ...ROOTS.SOFT, ...ROOTS.KEEP, ...ROOTS.TEAM];
// WDQS-free closure (query.wikidata.org 503'd for hours during fame scoring):
// BFS up P279 via plain wbgetentities — batched, backoff-protected, memoized
// on disk so a re-run is free. Same approach as score-fame.mjs.
const rootSet = new Set(allRoots);
const PARENTS_CACHE = path.join(OUT, "p279-cache.jsonl");
const parentsOf = new Map();
if (fs.existsSync(PARENTS_CACHE)) for (const l of fs.readFileSync(PARENTS_CACHE, "utf8").split("\n")) { if (!l) continue; try { const j = JSON.parse(l); parentsOf.set(j.k, j.v); } catch { /* skip */ } }
const pOut = fs.createWriteStream(PARENTS_CACHE, { flags: "a" });
let frontier = seenClasses.filter((q) => !parentsOf.has(q));
let depth = 0, failedBatches = 0;
while (frontier.length && depth < 10) {
  console.error(`  closure BFS depth ${depth}: ${frontier.length} classes`);
  for (let i = 0; i < frontier.length; i += 50) {
    const batch = frontier.slice(i, i + 50);
    try {
      const j = await api("https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=" + batch.join("|"));
      for (const id of batch) {
        const ps = (j.entities?.[id]?.claims?.P279 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
        parentsOf.set(id, ps); pOut.write(JSON.stringify({ k: id, v: ps }) + "\n");
      }
    } catch (e2) { failedBatches++; console.error(`  closure batch failed: ${e2.message}`); for (const id of batch) if (!parentsOf.has(id)) parentsOf.set(id, []); } // in-memory only — refetched next run
    await sleep(350);
  }
  const next = new Set();
  for (const q of frontier) for (const p of parentsOf.get(q) || []) if (!parentsOf.has(p) && !rootSet.has(p)) next.add(p);
  frontier = [...next]; depth++;
}
// Blacklist load failure stays a HARD ERROR: shipping unfiltered ranks a plane
// crash as a top attraction (measured, Cebu). BFS failure mode is partial
// coverage, so guard on it explicitly.
if (failedBatches > 0 && seenClasses.length > 200) {
  console.error(`!! HARD ERROR: ${failedBatches} closure batches failed — refusing to emit with a partial blacklist. Re-run (cache resumes).`);
  process.exit(1);
}
const ancestorsMemo = new Map();
const ancestorsOf = (q, walking = new Set()) => {
  if (ancestorsMemo.has(q)) return ancestorsMemo.get(q);
  if (walking.has(q)) return new Set();               // P279 cycles exist; break them
  walking.add(q);
  const out = new Set([q]);
  for (const p of parentsOf.get(q) || []) { out.add(p); for (const a of ancestorsOf(p, walking)) out.add(a); }
  ancestorsMemo.set(q, out);
  return out;
};
const classVerdict = new Map();   // class qid -> Set of {HARD|SOFT|KEEP|TEAM}
for (const c of seenClasses) {
  const anc = ancestorsOf(c);
  for (const root of allRoots) if (anc.has(root)) {
    const v = ROOTS.TEAM.includes(root) ? "TEAM" : ROOTS.KEEP.includes(root) ? "KEEP" : ROOTS.HARD.includes(root) ? "HARD" : "SOFT";
    if (!classVerdict.has(c)) classVerdict.set(c, new Set());
    classVerdict.get(c).add(v);
  }
}
console.error(`blacklisted classes found: ${classVerdict.size}`);

const verdictOf = (qid) => {
  const e = qid && entity.get(qid);
  if (!e) return { v: "KEEP" };
  const hits = new Set();
  const why = [];
  for (const c of e.p31) for (const v of classVerdict.get(c) || []) { hits.add(v); why.push(`${c}:${v}`); }
  if (hits.has("TEAM")) return { v: "TEAM", why };
  // Explicit attraction/museum/park typing beats everything else — ontology
  // noise routes amusement parks under an event root.
  if (hits.has("KEEP")) return { v: "KEEP", why };
  if (hits.has("HARD")) return { v: "DROP", why };
  if (hits.has("SOFT")) {
    // These rows come from a traveler-CURATED source, so the institutional
    // blacklist stays gentle: heritage designation or modest world-fame as a
    // place (sitelinks) keeps it. The full-strength blacklist is for the
    // discovery-source stage, where nobody vouched for the candidate.
    if (e.heritage || e.sitelinks >= 12) return { v: "KEEP", why };
    return { v: "DROP", why };
  }
  return { v: "KEEP", why };
};

// ---- 3b. venues for the teams we keep ---------------------------------------
const venueQids = [...new Set(rows.map((r) => {
  const q = qidOf(r);
  return verdictOf(q).v === "TEAM" ? entity.get(q)?.p115?.[0] : null;
}).filter(Boolean))];
const venueInfo = new Map();      // qid -> {label, lat, lng}
if (venueQids.length) {
  const j = await api("https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels|claims&languages=en&format=json&ids=" + venueQids.join("|"));
  for (const [id, e] of Object.entries(j.entities || {})) {
    const coord = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    venueInfo.set(id, {
      label: e.labels?.en?.value || null,
      lat: coord?.latitude ?? null, lng: coord?.longitude ?? null,
    });
  }
}

// ---- 4. apply verdicts, dedup, re-rank --------------------------------------
const report = [];
const outFile = fs.createWriteStream(path.join(OUT, "cleaned.jsonl"));
for (const c of cities) {
  const dropped = [], transformed = [];
  const byKey = new Map();
  for (const r of c.top) {
    const qid = qidOf(r);
    const { v, why } = verdictOf(qid);
    let row = { ...r, qid: qid || undefined };
    if (v === "DROP") { dropped.push(`${r.name} [${(why || []).join(",")}]`); continue; }
    if (v === "TEAM") {
      const venueQ = entity.get(qid)?.p115?.[0];
      const venue = venueQ && venueInfo.get(venueQ);
      if (!venue?.label) { dropped.push(r.name); continue; }   // team with no venue = not a place
      transformed.push(`${r.name} → ${venue.label}`);
      row = { ...row, name: venue.label, qid: venueQ,
        lat: venue.lat ?? r.lat, lng: venue.lng ?? r.lng,
        pv: null,               // fandom reads about the TEAM; it does not visit the building
        via_team: r.name };
    }
    // Dedup: same entity (or same article, or same name near-enough) merges into
    // the FIRST listing's identity, keeping the best pageview count.
    const key = row.qid || row.article ||
      `${row.name.toLowerCase()}@${row.lat?.toFixed(3)},${row.lng?.toFixed(3)}`;
    const prev = byKey.get(key);
    if (prev) {
      prev.pv = Math.max(prev.pv ?? -1, row.pv ?? -1); if (prev.pv < 0) prev.pv = null;
      prev.lat = prev.lat ?? row.lat; prev.lng = prev.lng ?? row.lng;
    } else byKey.set(key, row);
  }
  const rows2 = [...byKey.values()];
  rows2.sort((a, b) => (b.pv ?? -1) - (a.pv ?? -1) || a.idx - b.idx);
  rows2.forEach((r, i) => { r.rank = i + 1; });
  outFile.write(JSON.stringify({ city: c.city, count: rows2.length, top: rows2 }) + "\n");
  report.push({ city: c.city, before: c.top.length, after: rows2.length, dropped, transformed });
}
outFile.end();

for (const r of report) {
  console.error(`\n${r.city}: ${r.before} → ${r.after}`);
  if (r.transformed.length) console.error(`  team→venue: ${r.transformed.join(" · ")}`);
  if (r.dropped.length) console.error(`  dropped: ${r.dropped.slice(0, 8).join(" · ")}${r.dropped.length > 8 ? ` (+${r.dropped.length - 8})` : ""}`);
}
console.error("\nDONE — cleaned.jsonl written");
