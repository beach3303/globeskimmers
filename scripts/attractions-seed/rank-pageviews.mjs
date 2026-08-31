#!/usr/bin/env node
// rank-pageviews.mjs — rank parsed Wikivoyage listings by Wikipedia reading interest.
//
//   node rank-pageviews.mjs PARSED_DIR OUT_DIR [--cities "Anaheim,Cebu City"]
//
// Stage 2 of the attractions pipeline. Reads listings.jsonl from the parser,
// rolls districts up to their parent city, resolves each listing's enwiki title
// (redirects included — skipping that undercounts by ~28% on titles like
// "Magellan's Cross"), fetches 12 months of per-article pageviews from the free
// Wikimedia REST API, and writes a ranked top list per city.
//
// HONESTY NOTE (from the source evaluation): pageviews measure READING INTEREST,
// not footfall. They order ticketed/encyclopedic draws well and under-rank free
// pass-through places (squares, beaches, markets). Rank order here is a
// defensible baseline, not turnstile truth — the demand-driven Google top-up is
// what corrects the unticketed tail.
//
// Politeness: sequential fetches with a delay, a descriptive User-Agent, and a
// resumable on-disk cache (pv-cache.jsonl) so the full ~22.8k-city run can stop
// and restart without refetching. $0 at any scale.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const [PARSED, OUT] = process.argv.slice(2);
if (!PARSED || !OUT) { console.error("usage: node rank-pageviews.mjs PARSED_DIR OUT_DIR [--cities a,b,c]"); process.exit(1); }
const cityArg = process.argv.indexOf("--cities");
const ONLY = cityArg > 0 ? new Set(process.argv[cityArg + 1].split(",").map((s) => s.trim())) : null;
fs.mkdirSync(OUT, { recursive: true });

const UA = "GlobeSkimmersAttractionsSeed/1.0 (attractions ranking pipeline)";
const MONTHS = { from: "20250801", to: "20260801" };   // 12 complete months
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- resumable pageview cache ----------------------------------------------
const CACHE_FILE = path.join(OUT, "pv-cache.jsonl");
const cache = new Map();
if (fs.existsSync(CACHE_FILE)) {
  for (const line of fs.readFileSync(CACHE_FILE, "utf8").split("\n")) {
    if (!line) continue;
    const j = JSON.parse(line);
    cache.set(j.title, j.median);
  }
  console.error(`cache: ${cache.size} titles already fetched`);
}
const cacheOut = fs.createWriteStream(CACHE_FILE, { flags: "a" });

// ---- load listings, roll districts up to the parent city --------------------
const byCity = new Map();
await new Promise((resolve) => {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(PARSED, "listings.jsonl")) });
  rl.on("line", (l) => {
    const j = JSON.parse(l);
    if (!["see", "do"].includes(j.type)) return;
    const city = j.page.split("/")[0];
    if (ONLY && !ONLY.has(city)) return;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(j);
  });
  rl.on("close", resolve);
});
console.error(`${byCity.size} cities, ${[...byCity.values()].reduce((a, c) => a + c.length, 0)} see/do listings`);

// The enwiki title for a listing: the explicit wikipedia= param when present
// (skip other-language "xx:Title" values), else fall back to the listing name —
// right for famous places, a 404 (→ unranked) for the rest, which is honest.
const titleFor = (l) => {
  const wp = (l.wikipedia || "").trim();
  if (wp && !/^[a-z-]{2,10}:/.test(wp)) return wp;
  if (wp) return null;                       // non-English article only
  return l.name;
};

// ---- canonicalize titles through redirects (batched, 50 per request) --------
const wanted = new Map();                     // raw title -> canonical (filled below)
for (const ls of byCity.values()) for (const l of ls) {
  const t = titleFor(l);
  if (t) wanted.set(t, t);
}
const raws = [...wanted.keys()];
console.error(`resolving ${raws.length} titles through redirects...`);
for (let i = 0; i < raws.length; i += 50) {
  const batch = raws.slice(i, i + 50);
  const url = "https://en.wikipedia.org/w/api.php?action=query&redirects=1&format=json&titles=" +
    encodeURIComponent(batch.join("|"));
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    const j = await r.json();
    const q = j.query || {};
    const map = new Map();
    for (const rd of q.redirects || []) map.set(rd.from, rd.to);
    for (const nm of q.normalized || []) {
      // normalization ("Foo_bar" -> "Foo bar") chains before redirects
      if (map.has(nm.to)) map.set(nm.from, map.get(nm.to));
      else map.set(nm.from, nm.to);
    }
    const missing = new Set(Object.values(q.pages || {}).filter((p) => p.missing !== undefined).map((p) => p.title));
    for (const raw of batch) {
      const canon = map.get(raw) || raw;
      wanted.set(raw, missing.has(canon) ? null : canon);   // null = no article
    }
  } catch { /* leave batch as-is; pageview fetch will 404 them individually */ }
  await sleep(120);
}

// ---- fetch pageviews per canonical title ------------------------------------
// The pageviews API throttles anonymous clients HARD — measured: ~27 requests
// through, then a wall of 429s that silently nulled 263 of 291 titles on the
// first six-city run. So: honor Retry-After, back off exponentially, and keep a
// polite base pace. For the FULL ~22.8k-city run use the monthly pageview dumps
// instead (dumps.wikimedia.org/other/pageview_complete/, ~6GB/month, no rate
// limit) — the API path is for validation-scale runs.
let failed = 0;
async function medianViews(title) {
  if (cache.has(title)) return cache.get(title);
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${t}/monthly/${MONTHS.from}/${MONTHS.to}`;
  let median = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status === 429) {
        const ra = parseInt(r.headers.get("retry-after") || "0", 10);
        await sleep(Math.max(ra * 1000, 1500 * 2 ** attempt));   // their ask, else 1.5s→48s
        continue;
      }
      if (r.ok) {
        const j = await r.json();
        const v = (j.items || []).map((x) => x.views).sort((a, b) => a - b);
        if (v.length) median = v[Math.floor(v.length / 2)];
      }
      break;                                    // 200 or a real 404 — done either way
    } catch { await sleep(1500 * 2 ** attempt); }
  }
  if (median !== null) { cache.set(title, median); cacheOut.write(JSON.stringify({ title, median }) + "\n"); }
  else failed++;
  await sleep(250);
  return median;
}

const canonSet = new Set([...wanted.values()].filter(Boolean));
console.error(`fetching pageviews for ${canonSet.size} articles (${cache.size} cached)...`);
let done = 0;
for (const t of canonSet) {
  await medianViews(t);
  if (++done % 100 === 0) console.error(`  ...${done}/${canonSet.size}`);
}

// ---- rank per city ----------------------------------------------------------
const out = fs.createWriteStream(path.join(OUT, "ranked.jsonl"));
for (const [city, ls] of byCity) {
  const rows = ls.map((l) => {
    const raw = titleFor(l);
    const canon = raw ? wanted.get(raw) : null;
    return {
      name: l.name, lat: l.lat, lng: l.lng, type: l.type,
      wikidata: l.wikidata, page: l.page, section: l.section, idx: l.idx,
      article: canon || undefined,
      pv: canon ? cache.get(canon) ?? null : null,
    };
  });
  // Pageview median first (nulls last), then the traveler's page order as the
  // tiebreak — Wikivoyage editors put the marquee sights first often enough for
  // it to be a real prior.
  rows.sort((a, b) => (b.pv ?? -1) - (a.pv ?? -1) || a.idx - b.idx);
  rows.forEach((r, i) => { r.rank = i + 1; });
  out.write(JSON.stringify({ city, count: rows.length, top: rows }) + "\n");
}
out.end(); cacheOut.end();
const ok = cache.size;
console.error(`DONE — ranked.jsonl written · ${ok} articles ranked · ${failed} failed`);
if (failed > ok / 4) console.error(
  "!! WARNING: high failure rate — likely rate-limited or the machine slept. " +
  "Re-run (the cache resumes) or, at full scale, switch to the pageview dumps.");
