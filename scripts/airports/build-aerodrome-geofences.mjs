// Build airport-boundary geofences from OpenStreetMap (aeroway=aerodrome).
//
// Queries Overpass per bbox tile, extracts each aerodrome's perimeter polygon(s),
// simplifies them, joins IATA→city/country from our airports.json, and buckets
// them by geohash-4 cell. Output is a `wrangler kv bulk put` file: one KV entry
// per cell → the airports whose polygon touches that cell.
//
// Usage:
//   node scripts/airports/build-aerodrome-geofences.mjs --bbox=S,W,N,E [--bbox=...] --out=aero-kv.json
//   node scripts/airports/build-aerodrome-geofences.mjs --world   (tiles the globe; slow)
//
// Then upload:
//   wrangler kv bulk put --namespace-id=68ae9c62099f4834a8c6f0ff3eb57e71 aero-kv.json --remote
//
// Data © OpenStreetMap contributors (ODbL). Refresh ~quarterly.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const AIRPORTS = JSON.parse(readFileSync(join(__dir, "../../src/lib/airports.json"), "utf8"));
const IATA_META = new Map(AIRPORTS.map(([iata, city, cc, lat, lng]) => [iata, { city, cc, lat, lng }]));

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const eq = a.indexOf("=");
  if (a.startsWith("--") && eq === -1) return [a.slice(2), true];
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a, true];
}));
const OUT = args.out || "aero-kv.json";
const GH_PRECISION = 4;
const SIMPLIFY_TOL = 0.00004; // ~4.5 m

// ---- geohash (base32) -------------------------------------------------------
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function geohash(lat, lng, precision = 4) {
  let idx = 0, bit = 0, even = true, hash = "";
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  while (hash.length < precision) {
    if (even) { const mid = (lngMin + lngMax) / 2; if (lng >= mid) { idx = idx * 2 + 1; lngMin = mid; } else { idx *= 2; lngMax = mid; } }
    else { const mid = (latMin + latMax) / 2; if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; } else { idx *= 2; latMax = mid; } }
    even = !even;
    if (++bit === 5) { hash += B32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

// ---- Douglas–Peucker simplify ----------------------------------------------
function simplify(pts, tol) {
  if (pts.length <= 3) return pts;
  const sqTol = tol * tol;
  const sqSegDist = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) { const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy); if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; } }
    dx = p[0] - x; dy = p[1] - y; return dx * dx + dy * dy;
  };
  const out = [];
  const dp = (first, last) => {
    let maxd = sqTol, idx = -1;
    for (let i = first + 1; i < last; i++) { const d = sqSegDist(pts[i], pts[first], pts[last]); if (d > maxd) { idx = i; maxd = d; } }
    if (idx > -1) { dp(first, idx); out.push(pts[idx]); dp(idx, last); }
  };
  out.push(pts[0]); dp(0, pts.length - 1); out.push(pts[pts.length - 1]);
  return out;
}

// ---- Overpass ---------------------------------------------------------------
async function overpass(bbox) {
  const [s, w, n, e] = bbox;
  const q = `[out:json][timeout:180];(way["aeroway"="aerodrome"](${s},${w},${n},${e});relation["aeroway"="aerodrome"](${s},${w},${n},${e}););out tags geom;`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json", "User-Agent": "globeskimmers-aerodrome-build/1.0 (travel app airport geofences)" },
        body: "data=" + encodeURIComponent(q),
      });
      if (r.status === 429 || r.status === 504) { await sleep(15000 * (attempt + 1)); continue; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return (await r.json()).elements || [];
    } catch (err) { if (attempt === 3) throw err; await sleep(8000 * (attempt + 1)); }
  }
  return [];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- extract rings from an element -----------------------------------------
function ringsOf(el) {
  if (el.type === "way" && el.geometry) return [el.geometry.map((p) => [p.lat, p.lon])];
  if (el.type === "relation" && el.members) return el.members.filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry.map((p) => [p.lat, p.lon]));
  return [];
}

function toRecord(el) {
  const t = el.tags || {};
  const iata = (t.iata || "").toUpperCase().trim();
  const name = t.name || t["name:en"] || iata || "Airport";
  let rings = ringsOf(el).map((r) => simplify(r, SIMPLIFY_TOL)).filter((r) => r.length >= 3);
  if (!rings.length) return null;
  const meta = iata && /^[A-Z]{3}$/.test(iata) ? IATA_META.get(iata) : null;
  let minLat = 90, minLng = 180, maxLat = -90, maxLng = -180;
  for (const r of rings) for (const [la, ln] of r) { if (la < minLat) minLat = la; if (la > maxLat) maxLat = la; if (ln < minLng) minLng = ln; if (ln > maxLng) maxLng = ln; }
  return {
    key: `${el.type[0]}${el.id}`,
    iata: /^[A-Z]{3}$/.test(iata) ? iata : null,
    name,
    city: meta?.city || null,
    cc: meta?.cc || (t["addr:country"] || null),
    bbox: [round(minLat), round(minLng), round(maxLat), round(maxLng)],
    rings: rings.map((r) => r.map(([la, ln]) => [round(la), round(ln)])),
  };
}
const round = (n) => Math.round(n * 1e5) / 1e5;

// Every geohash-4 cell the airport's bbox overlaps (sampled finer than a cell,
// ~0.176°×0.35°, so no interior cell is skipped) → a single-cell lookup at
// runtime always finds an airport the user is standing inside.
function cellsOf(rec) {
  const set = new Set();
  const [s, w, n, e] = rec.bbox;
  for (let la = s; la <= n + 1e-9; la += 0.08) for (let ln = w; ln <= e + 1e-9; ln += 0.15) set.add(geohash(la, ln, GH_PRECISION));
  set.add(geohash(n, e, GH_PRECISION)); set.add(geohash(s, e, GH_PRECISION)); set.add(geohash(n, w, GH_PRECISION));
  return set;
}

// ---- world tiling (10°×10° tiles) ------------------------------------------
function worldTiles() {
  const tiles = [];
  for (let s = -60; s < 80; s += 10) for (let w = -180; w < 180; w += 10) tiles.push([s, w, s + 10, w + 10]);
  return tiles; // skip deep polar (few aerodromes)
}

async function main() {
  const bboxes = args.world ? worldTiles()
    : [].concat(args.bbox || []).map((b) => (typeof b === "string" ? b.split(",").map(Number) : b));
  if (!bboxes.length) { console.error("Provide --bbox=S,W,N,E or --world"); process.exit(1); }

  const cells = new Map(); // cell -> [record]
  const seen = new Set();
  let airports = 0;
  for (let i = 0; i < bboxes.length; i++) {
    const bbox = bboxes[i];
    process.stderr.write(`[${i + 1}/${bboxes.length}] bbox ${bbox.join(",")} … `);
    let els = [];
    try { els = await overpass(bbox); } catch (e) { console.error("FAILED", e.message); continue; }
    let added = 0;
    for (const el of els) {
      const rec = toRecord(el);
      if (!rec || seen.has(rec.key)) continue;
      seen.add(rec.key); airports++; added++;
      const slim = { iata: rec.iata, name: rec.name, city: rec.city, cc: rec.cc, bbox: rec.bbox, rings: rec.rings };
      for (const c of cellsOf(rec)) { if (!cells.has(c)) cells.set(c, []); cells.get(c).push(slim); }
    }
    console.error(`${els.length} elements, +${added} airports`);
    if (args.world) await sleep(2000); // be polite to Overpass
  }

  const kv = [...cells.entries()].map(([cell, recs]) => ({ key: `aero:${cell}`, value: JSON.stringify(recs) }));
  writeFileSync(OUT, JSON.stringify(kv));
  const bytes = kv.reduce((a, e) => a + e.value.length, 0);
  console.error(`\n✅ ${airports} airports · ${cells.size} cells · ${(bytes / 1e6).toFixed(2)} MB → ${OUT}`);
}
main();
