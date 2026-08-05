// Airport lookup for arrival stamps. The dataset (~7.9k IATA airports as compact
// [iata, city, ISO-2, lat, lng] rows) is lazy-loaded on first use so it never
// bloats app startup. Rebuild it with scripts/passport/build-airports.mjs.
let _cache = null;
async function load() {
  if (_cache) return _cache;
  const m = await import("./airports.json");
  _cache = m.default || m;
  return _cache;
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Nearest airport to a coordinate, or null if none within maxKm.
// Returns { iata, city, countryCode, lat, lng, km }.
export async function nearestAirport(lat, lng, maxKm = 6) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const list = await load();
  let best = null, bestD = Infinity;
  for (const a of list) {
    const d = haversineKm(lat, lng, a[3], a[4]);
    if (d < bestD) { bestD = d; best = a; }
  }
  if (!best || bestD > maxKm) return null;
  return { iata: best[0], city: best[1], countryCode: best[2], lat: best[3], lng: best[4], km: bestD };
}
