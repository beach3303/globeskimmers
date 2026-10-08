#!/usr/bin/env node
// Worldwide Smart Search test suite (founder, 2026-10-07: "I want us to be
// able to deliver answering these questions globally").
//
// Runs every case in cases.mjs END TO END against production, using the app's
// OWN code: src/lib/searchPlan.js (how the search screen reads the text) and
// src/lib/searchRank.js (how Places to Eat orders results). Then it calls the
// same finder endpoint the app would, and checks each case's expectations.
//
//   node scripts/search-eval/run.mjs            # all cases
//   node scripts/search-eval/run.mjs eat atl    # only cases whose id/tags match
//
// Costs real Google calls (~1-3 per case, most cached 12h-3d by the worker).
// Writes scripts/search-eval/last-run.json; prints a summary. Cases marked
// `gap` are known missing capabilities (reported, never counted as failures).
import { writeFileSync } from "node:fs";
import { planSearch, finderQuery, shoppingCategoryFor } from "../../src/lib/searchPlan.js";
import { sortByRating, keepCountry, nearFirst } from "../../src/lib/searchRank.js";
import { CASES } from "./cases.mjs";

const API = "https://globeskimmers-api.maizasimeon.workers.dev";
const HOME = { lat: 34.1397, lng: -118.0353, city: "Arcadia", country: "United States", phrase: "Arcadia, CA" };
const CONCURRENCY = 5;

const post = async (path, body, tries = 2) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${API}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return await r.json();
    } catch (e) { if (i === tries - 1) return { error: String(e) }; }
  }
};
const parseAI = async (body) => { const d = await post("parse-search", body); return d && !d.error ? d : null; };
const nameOf = (x) => x.displayName?.text || x.name || x.title || "";

async function runCase(c) {
  const out = { id: c.id, q: c.q, tags: c.tags || [], gap: c.gap || null, checks: [], top: [] };
  const fail = (msg) => out.checks.push({ ok: false, msg });
  const pass = (msg) => out.checks.push({ ok: true, msg });
  const e = c.expect || {};

  const { parsed: p, destination } = await planSearch(c.q, { scope: "near_me", activePhrase: HOME.phrase, parseAI });
  out.plan = { category: p.category || null, place: p.place || null, region: p.region || null, query: p.query || "", sort: p.sort || null, maxPrice: p.maxPrice || 0, lateNight: !!p.lateNight, bars: !!p.bars, venue: p.venue || null, nearFirst: !!p.nearFirst, dream: destination?.name || null };

  // ── route ──
  const cat = destination ? "dream" : (p.category || (p.place ? "home" : "none"));
  out.route = cat;
  if (e.cat) (Array.isArray(e.cat) ? e.cat : [e.cat]).includes(cat) ? pass(`route ${cat}`) : fail(`route ${cat}, expected ${[].concat(e.cat).join("|")}`);
  if (e.place) (p.place && e.place.test(p.place)) || (destination && e.place.test(destination.name)) ? pass(`place ${p.place || destination?.name}`) : fail(`place ${p.place || destination?.name || "none (near you)"}, expected ${e.place}`);
  if (e.near) !p.place ? pass("near you") : fail(`expected near-you, got place ${p.place}`);
  if (e.region) p.region ? pass(`region ${p.region}→${p.place}`) : fail("expected a country/state narrowed to a city");
  if (e.sort) p.sort === e.sort ? pass(`sort ${p.sort}`) : fail(`sort ${p.sort || "none"}, expected ${e.sort}`);
  if (e.maxPrice) p.maxPrice === e.maxPrice ? pass(`price≤${p.maxPrice}`) : fail(`price ${p.maxPrice || "none"}, expected ≤${e.maxPrice}`);
  if (e.lateNight) p.lateNight ? pass("late-night filter") : fail("expected the late-night filter");
  if (e.nearFirst !== undefined) !!p.nearFirst === e.nearFirst ? pass(`nearFirst ${!!p.nearFirst}`) : fail(`nearFirst ${!!p.nearFirst}, expected ${e.nearFirst}`);
  if (e.query) e.query.test(p.query || "") ? pass(`query "${p.query}"`) : fail(`query "${p.query}", expected ${e.query}`);
  if (cat === "dream" || cat === "home" || cat === "none" || e.routeOnly) return out;

  // ── where ──
  let at = HOME;
  if (p.place) {
    const g = (await post("search-location", { query: p.lookup || p.place, touristCenter: !p.nearFirst }))?.results?.[0];
    if (!g) { fail(`could not geocode "${p.place}"`); return out; }
    at = { lat: g.coordinates.latitude, lng: g.coordinates.longitude, city: g.address?.city || g.placeName, country: g.address?.country || "" };
    out.at = g.placeName + (g.touristCenter ? ` (landmark center: ${g.touristCenter.landmarks.slice(0, 3).join(", ")})` : "");
  }
  const q = finderQuery(p); // the same call the app makes

  // ── results, as the finder would fetch them ──
  let list = [];
  const geo = { latitude: at.lat, longitude: at.lng };
  if (cat === "eat") {
    const d = await post("restaurants-full", { ...geo, radius: 25 * 1609, maxResults: 40, ...(q ? { searchQuery: q } : {}),
      ...(p.maxPrice ? { filterMaxPrice: p.maxPrice } : {}), ...(p.lateNight ? { cuisine: "latenight" } : {}), ...(p.bars ? { filterBars: true } : {}) });
    list = d.places || d.restaurants || [];
    if (p.maxPrice) list = list.filter((x) => !x.priceLevel || parseInt(x.priceLevel, 10) <= p.maxPrice); // the app's own client price filter
    if (p.place) list = keepCountry(list, at.country);
    if (p.sort === "rating") list = sortByRating(list, { named: !!p.place });
    if (p.nearFirst) list = nearFirst(list);
  } else if (cat === "coffee") {
    list = (await post("coffee/search", { query: q || "coffee", ...geo, radiusMiles: 25 })).places || [];
  } else if (cat === "things") {
    list = (await post("activities/search", { query: q || "things to do", city: at.city, country: at.country, ...geo, radiusMiles: 25 })).places || [];
  } else if (cat === "shopping") {
    const d = await post("shopping", { ...geo, radius: 25 * 1609, maxResults: 30, category: shoppingCategoryFor(q) || "all" });
    list = d.places || d.results || [];
  } else {
    const path = { atm: "atm-locations", money: "money-exchange", convenience: "convenience-stores", restroom: "restroom-owned" }[cat];
    if (path) { const d = await post(path, { ...geo, radius: 25 * 1609, maxResults: 30, ...(cat === "restroom" ? { venueType: p.venue || "all" } : {}) }); list = d.places || d.stores || d.all_stores || d.results || d.atms || d.locations || d.restrooms || []; }
  }
  out.count = list.length;
  out.top = list.slice(0, 8).map((x) => ({ name: nameOf(x), rating: x.rating ?? null, reviews: x.userRatingCount ?? null, mi: x.distanceMiles != null ? +x.distanceMiles.toFixed(1) : (x.distanceKm != null ? +(x.distanceKm * 0.621371).toFixed(1) : (typeof x.distance === "number" ? +x.distance.toFixed(1) : null)), addr: x.formattedAddress || x.shortFormattedAddress || "" }));

  const min = e.min ?? 5;
  list.length >= min ? pass(`${list.length} results`) : fail(`${list.length} results, expected ≥${min}`);
  const top10 = list.slice(0, 10).map(nameOf);
  if (e.notNames) { const bad = top10.filter((n) => e.notNames.test(n)); bad.length ? fail(`unwanted in top 10: ${bad.join("; ")}`) : pass(`top 10 clean of ${e.notNames}`); }
  if (e.someNames) top10.some((n) => e.someNames.test(n)) ? pass(`top 10 has ${e.someNames}`) : fail(`top 10 lacks ${e.someNames}`);
  if (e.country && cat === "eat") {
    const tail = (x) => String(x.formattedAddress || "").split(",").pop().trim().toLowerCase();
    const want = e.country.toLowerCase();
    const inC = list.slice(0, 10).filter((x) => tail(x) === want).length;
    inC >= Math.min(8, list.slice(0, 10).length) ? pass(`${inC}/10 in ${e.country}`) : fail(`only ${inC}/10 of top results in ${e.country}`);
  }
  return out;
}

const filter = process.argv.slice(2).map((s) => s.toLowerCase());
const todo = CASES.filter((c) => !filter.length || filter.some((f) => c.id.includes(f) || (c.tags || []).includes(f)));
const results = [];
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < todo.length) {
    const c = todo[next++];
    try { results.push(await runCase(c)); } catch (err) { results.push({ id: c.id, q: c.q, gap: c.gap || null, checks: [{ ok: false, msg: `crashed: ${err.message}` }] }); }
  }
}));
results.sort((a, b) => todo.findIndex((c) => c.id === a.id) - todo.findIndex((c) => c.id === b.id));

const scored = results.filter((r) => !r.gap);
const passed = scored.filter((r) => r.checks.every((k) => k.ok));
for (const r of results) {
  const ok = r.checks.every((k) => k.ok);
  const mark = r.gap ? "◌ GAP " : ok ? "✅" : "❌";
  console.log(`${mark} ${r.id.padEnd(30)} ${r.q.slice(0, 60)}`);
  if (!ok || r.gap) for (const k of r.checks.filter((k) => !k.ok)) console.log(`      ✗ ${k.msg}`);
  if (r.gap) console.log(`      gap: ${r.gap}`);
}
console.log(`\nPASS ${passed.length}/${scored.length} (${Math.round((100 * passed.length) / Math.max(1, scored.length))}%) · known gaps: ${results.length - scored.length}`);
writeFileSync(new URL("./last-run.json", import.meta.url), JSON.stringify({ ranAt: new Date().toISOString(), passed: passed.length, scored: scored.length, results }, null, 1));
