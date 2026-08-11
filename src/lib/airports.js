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

// The N nearest airports to a coordinate (default 6), each within maxKm, sorted
// nearest-first. Powers the hotel finder's "Near the airport" picker. Returns
// [{ iata, city, countryCode, lat, lng, km }].
export async function nearestAirports(lat, lng, n = 6, maxKm = 130) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const list = await load();
  const scored = [];
  for (const a of list) {
    const d = haversineKm(lat, lng, a[3], a[4]);
    if (d <= maxKm) scored.push({ iata: a[0], city: a[1], countryCode: a[2], lat: a[3], lng: a[4], km: d });
  }
  scored.sort((x, y) => x.km - y.km);
  return scored.slice(0, n);
}

// True "inside the fence" check via the Worker's airport-boundary geofences
// (OSM aeroway=aerodrome polygons). Returns { iata, name, city, cc, lat, lng }
// only when the point is INSIDE an airport perimeter, else null — so drive-bys
// and people waiting outside don't get an arrival stamp.
const AIRPORT_WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";
export async function airportAt(lat, lng, acc) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const u = new URL(AIRPORT_WORKER + "/airport-at");
    u.searchParams.set("lat", lat);
    u.searchParams.set("lng", lng);
    if (Number.isFinite(acc)) u.searchParams.set("acc", acc);
    const r = await fetch(u.toString());
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.airport ? d.airport : null;
  } catch { return null; }
}
