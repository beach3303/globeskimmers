#!/usr/bin/env node
// resolve-places.mjs — stage 4: match cleaned attractions onto the OWNED places DB.
//
//   node resolve-places.mjs CLEANED_DIR OUT_DIR
//
// The app already owns every place on earth (~75.6M Overture rows in Supabase
// PostGIS). This stage links each cleaned attraction to its owned row, so the
// seed carries a stable place id (photos/enrich/guestbook all key off it) and an
// Overture category — which is exactly what stampRadiusFor() reads to size the
// GPS-verify circle (Disneyland resolves to `amusement_park` → 900m footprint).
//
// Matching: one batched PostGIS round trip per ~40 attractions (KNN nearest 8
// named places within 400m), then name matching in JS — pg_trgm is not installed
// on the project, and normalized token overlap is transparent to debug anyway.
// A no-match is a kept outcome, not an error: monuments are sometimes missing
// from Overture, and the Wikivoyage coordinates still stand on their own.
//
// Smoke-validated before writing: "Disneyland" (33.8121,-117.9190) → owned row
// "Disneyland Park", category amusement_park, at 2 metres.

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

const [CLEANED, OUT] = process.argv.slice(2);
if (!CLEANED || !OUT) { console.error("usage: node resolve-places.mjs CLEANED_DIR OUT_DIR"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// ---- one linked query, JSON rows back ---------------------------------------
function dbQuery(sql) {
  return new Promise((resolve, reject) => {
    execFile("npx", ["supabase", "db", "query", "--linked", sql],
      { cwd: path.dirname(new URL(import.meta.url).pathname), maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => {
        // stdout is `{boundary, rows, warning}` possibly preceded by status lines.
        const start = stdout.indexOf("{");
        if (start < 0) return reject(err || new Error("no JSON in db query output"));
        try { resolve(JSON.parse(stdout.slice(start)).rows || []); }
        catch (e) { reject(err || e); }
      });
  });
}

// ---- name normalization + scoring -------------------------------------------
const STOP = new Set(["the", "le", "la", "les", "l", "de", "du", "des", "el", "al", "of", "d"]);
const norm = (s) => String(s || "")
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  .split(" ").filter((w) => w && !STOP.has(w));

// Token containment both ways — "Disneyland" vs "Disneyland Park" scores high,
// "Disneyland" vs "Disneyland Galaxy Edge gift shop" less so.
function nameScore(a, b) {
  const A = norm(a), B = norm(b);
  if (!A.length || !B.length) return 0;
  const setB = new Set(B), setA = new Set(A);
  const inter = A.filter((w) => setB.has(w)).length;
  return (inter / A.length + A.filter((w) => setB.has(w)).length / B.length +
          B.filter((w) => setA.has(w)).length / B.length) / 3;
}

// ---- load cleaned cities ----------------------------------------------------
const cities = fs.readFileSync(path.join(CLEANED, "cleaned.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((l) => JSON.parse(l));

// ---- coordinate rescue: Wikidata P625 for rows that have a QID but no coords.
// Wikivoyage editors skip lat/long on listings often (13 of Osaka's 48) and
// those rows can't even reach the matcher; the entity usually knows where it is.
const noCoord = cities.flatMap((c) => c.top).filter((r) => (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) && r.qid);
const rescueQids = [...new Set(noCoord.map((r) => r.qid))];
if (rescueQids.length) {
  console.error(`coordinate rescue via Wikidata P625 for ${rescueQids.length} entities...`);
  const coordByQid = new Map();
  for (let i = 0; i < rescueQids.length; i += 50) {
    const batch = rescueQids.slice(i, i + 50);
    const r = await fetch("https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=" + batch.join("|"),
      { headers: { "User-Agent": "GlobeSkimmersAttractionsSeed/1.0 (entity resolution)" } });
    if (!r.ok) continue;
    const j = await r.json();
    for (const [id, e] of Object.entries(j.entities || {})) {
      const v = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (v) coordByQid.set(id, { lat: v.latitude, lng: v.longitude });
    }
    await new Promise((res) => setTimeout(res, 150));
  }
  let rescued = 0;
  for (const r of noCoord) {
    const c2 = coordByQid.get(r.qid);
    if (c2) { r.lat = c2.lat; r.lng = c2.lng; r.coord_source = "wikidata"; rescued++; }
  }
  console.error(`  coords recovered for ${rescued}/${noCoord.length} rows`);
}

const out = fs.createWriteStream(path.join(OUT, "resolved.jsonl"));
const totals = { strong: 0, near: 0, none: 0, nocoords: 0 };

for (const c of cities) {
  const withCoords = c.top.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  totals.nocoords += c.top.length - withCoords.length;

  // Batched KNN: nearest 8 named owned places within 400m of each attraction.
  const candidates = new Map();   // row idx-in-city -> [{id,name,category,d}]
  for (let i = 0; i < withCoords.length; i += 40) {
    const batch = withCoords.slice(i, i + 40);
    const values = batch.map((r, k) => `(${i + k},${r.lat},${r.lng})`).join(",");
    const sql = `with cand(i,lat,lng) as (values ${values})
      select c.i, p.id, p.name, p.category, p.city as place_city, p.country as place_country,
        round(st_distance(p.geom::geography, st_setsrid(st_makepoint(c.lng,c.lat),4326)::geography)::numeric) as d
      from cand c cross join lateral (
        select id, name, category, city, country, geom from places
        where name is not null
          and st_dwithin(geom::geography, st_setsrid(st_makepoint(c.lng,c.lat),4326)::geography, 400)
        order by geom <-> st_setsrid(st_makepoint(c.lng,c.lat),4326) limit 8) p`;
    const rows = await dbQuery(sql);
    for (const r of rows) {
      if (!candidates.has(r.i)) candidates.set(r.i, []);
      candidates.get(r.i).push(r);
    }
  }

  // Pick the best candidate per attraction.
  const resolved = c.top.map((r) => {
    const ci = withCoords.indexOf(r);
    if (ci < 0) return { ...r, match: "none" };
    let best = null;
    for (const cand of candidates.get(ci) || []) {
      const s = nameScore(r.name, cand.name);
      // Strong: the names agree and it's within the search radius.
      // Near: weak name but it is literally the same spot (<40m) — Overture and
      // Wikivoyage often disagree on naming ("Qoricancha" vs "Temple of the Sun").
      const grade = s >= 0.55 ? "strong" : Number(cand.d) <= 40 && s >= 0.2 ? "near" : null;
      if (!grade) continue;
      const rank = (grade === "strong" ? 1000 : 0) + s * 100 - Number(cand.d) / 40;
      if (!best || rank > best.rank) best = { ...cand, grade, rank, score: s };
    }
    if (!best) return { ...r, match: "none" };
    return {
      ...r, match: best.grade,
      place_id: best.id, place_name: best.name,
      place_category: best.category, place_dist_m: Number(best.d),
      place_city: best.place_city || undefined, place_country: best.place_country || undefined,
    };
  });

  for (const r of resolved) totals[r.match === "strong" ? "strong" : r.match === "near" ? "near" : "none"]++;
  const s = resolved.filter((r) => r.match === "strong").length;
  const n = resolved.filter((r) => r.match === "near").length;
  console.error(`${c.city}: ${s} strong + ${n} near of ${c.top.length}  (${Math.round(((s + n) / c.top.length) * 100)}%)`);
  out.write(JSON.stringify({ city: c.city, count: resolved.length, top: resolved }) + "\n");
}
out.end();
console.error(`\nDONE — resolved.jsonl · strong ${totals.strong} · near ${totals.near} · unmatched ${totals.none} (of which ${totals.nocoords} had no coordinates)`);
