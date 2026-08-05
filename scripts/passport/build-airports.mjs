#!/usr/bin/env node
/**
 * Rebuild src/lib/airports.json — the compact airport dataset used for arrival
 * stamps. Downloads the open mwgg/Airports dataset (ISO-2 country codes) and
 * keeps every entry with a 3-letter IATA code + coordinates, as compact rows:
 *   [iata, city, ISO-2, lat, lng]
 *
 * Usage:  node scripts/passport/build-airports.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "lib", "airports.json");
const URL = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";

const res = await fetch(URL);
if (!res.ok) { console.error("download failed:", res.status); process.exit(1); }
const raw = await res.json();

const seen = new Set(), out = [];
for (const k in raw) {
  const x = raw[k];
  if (!x.iata || x.iata.length !== 3) continue;
  if (typeof x.lat !== "number" || typeof x.lon !== "number") continue;
  if (seen.has(x.iata)) continue;
  seen.add(x.iata);
  out.push([x.iata, (x.city || x.name || "").slice(0, 40), x.country || "", +x.lat.toFixed(4), +x.lon.toFixed(4)]);
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`✅ ${out.length} airports → ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
