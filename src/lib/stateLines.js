// State lines on the phone (border grace, phase 2 — founder "go", 2026-11-06): the Census 1:5M state shapes,
// fetched once from /data/us-states.json (about half a megabyte, only when something asks), and the three
// questions the app puts to them — which state is this point in, how far is the line ahead along my
// heading, and which state lies across it. Plain geometry, no library: a local flat projection (km east
// and north of the point) is accurate to a few metres at these distances.
const KM_LAT = 111.2;
let states = null;

function ringsOf(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polys.map((poly) => ({ outer: poly[0], holes: poly.slice(1) }));
}
function bboxOf(polys) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of polys) for (const [x, y] of p.outer) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, s, e, n];
}
export async function loadStates() {
  if (states) return states;
  const r = await fetch("/data/us-states.json");
  if (!r.ok) throw new Error(`states ${r.status}`);
  const fc = await r.json();
  states = fc.features.map((f) => { const polys = ringsOf(f.geometry); return { abbr: f.properties.abbr, name: f.properties.name, polys, bbox: bboxOf(polys) }; });
  return states;
}
export const statesLoaded = () => states;

// Ray casting, lng/lat straight (fine for "which side of a line").
function inRing(ring, lng, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inBox = (b, lng, lat) => lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];
export function stateAt(S, lat, lng) {
  for (const s of S) {
    if (!inBox(s.bbox, lng, lat)) continue;
    for (const p of s.polys) if (inRing(p.outer, lng, lat) && !p.holes.some((h) => inRing(h, lng, lat))) return s.abbr;
  }
  return null;
}
export const stateName = (S, abbr) => S.find((s) => s.abbr === abbr)?.name || abbr;

// km east/north of (lat0, lng0)
const toKm = (lat0, lng0, lat, lng) => [(lng - lng0) * KM_LAT * Math.cos((lat0 * Math.PI) / 180), (lat - lat0) * KM_LAT];
const fromKm = (lat0, lng0, x, y) => [lat0 + y / KM_LAT, lng0 + x / (KM_LAT * Math.cos((lat0 * Math.PI) / 180))];
export function bearing(lat1, lng1, lat2, lng2) {
  const [x, y] = toKm(lat1, lng1, lat2, lng2);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}
export const kmBetween = (lat1, lng1, lat2, lng2) => { const [x, y] = toKm(lat1, lng1, lat2, lng2); return Math.hypot(x, y); };

// The first point where a ray from (lat, lng) along `headingDeg` meets the current state's own line,
// within maxKm: { km, lat, lng, from, into } — `into` the state across (null at the sea or the national
// border, which phase 2 leaves to the checkpoint sheet). Null when no line lies ahead.
export function lineAhead(S, lat, lng, headingDeg, maxKm = 120) {
  const from = stateAt(S, lat, lng);
  if (!from) return null;
  const cur = S.find((s) => s.abbr === from);
  const h = (headingDeg * Math.PI) / 180;
  const dx = Math.sin(h), dy = Math.cos(h);   // unit, km-space
  let best = null;
  for (const p of cur.polys) {
    for (const ring of [p.outer, ...p.holes]) {
      let [ax, ay] = toKm(lat, lng, ring[0][1], ring[0][0]);
      for (let i = 1; i < ring.length; i++) {
        const [bx, by] = toKm(lat, lng, ring[i][1], ring[i][0]);
        // ray P + t·d  vs  segment A + u·(B−A)
        const ex = bx - ax, ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) > 1e-9) {
          const t = (ax * ey - ay * ex) / den;
          const u = (ax * dy - ay * dx) / den;
          if (t > 0.05 && t <= maxKm && u >= 0 && u <= 1 && (!best || t < best.km)) best = { km: t, x: dx * t, y: dy * t };
        }
        ax = bx; ay = by;
      }
    }
  }
  if (!best) return null;
  const [clat, clng] = fromKm(lat, lng, best.x, best.y);
  const [blat, blng] = fromKm(lat, lng, best.x + dx * 0.4, best.y + dy * 0.4);   // 400 m past the line
  const into = stateAt(S, blat, blng);
  return { km: best.km, lat: clat, lng: clng, from, into: into && into !== from ? into : null };
}
