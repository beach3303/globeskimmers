// Ports of entry (border grace, phase 2 — 2026-11-06): every place an interstate crosses a state line, from
// the Census primary roads intersected with the state shapes (scratchpad/ports-tools/build-ports.mjs), each
// with the nearest named place on both sides, so a caught crossing's stamp can say "Ehrenberg · I-10"
// entering Arizona and "Blythe · I-10" entering California. Rows: { id, pair: "AZ-CA", road: "I-10",
// refs: ["I-10","US-60","US-95"], lat, lng, near: { AZ: "Ehrenberg", CA: "Blythe" } }. A crossing the table
// doesn't know keeps "first seen near <town>".
import PORTS from "@/data/ports-of-entry.json";

const KM_LAT = 111.2;
const km = (lat1, lng1, lat2, lng2) => Math.hypot((lng2 - lng1) * KM_LAT * Math.cos((lat1 * Math.PI) / 180), (lat2 - lat1) * KM_LAT);
export const pairKey = (a, b) => [String(a || ""), String(b || "")].sort().join("-");

// The nearest port between `a` and `b` within maxKm of a point.
export function portFor(a, b, lat, lng, maxKm = 25) {
  const key = pairKey(a, b);
  let best = null;
  for (const p of PORTS) {
    if (p.pair !== key) continue;
    const d = km(lat, lng, p.lat, p.lng);
    if (d <= maxKm && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}
// The port between `a` and `b` nearest to the straight line from p1 to p2 (two fixes either side of the
// line), within maxKm of that line.
export function portNearSegment(a, b, p1, p2, maxKm = 20) {
  const key = pairKey(a, b);
  const x0 = 0, y0 = 0;
  const [x1, y1] = [(p2.lng - p1.lng) * KM_LAT * Math.cos((p1.lat * Math.PI) / 180), (p2.lat - p1.lat) * KM_LAT];
  const len2 = x1 * x1 + y1 * y1;
  let best = null;
  for (const p of PORTS) {
    if (p.pair !== key) continue;
    const [px, py] = [(p.lng - p1.lng) * KM_LAT * Math.cos((p1.lat * Math.PI) / 180), (p.lat - p1.lat) * KM_LAT];
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * (x1 - x0) + (py - y0) * (y1 - y0)) / len2)) : 0;
    const d = Math.hypot(px - (x0 + t * (x1 - x0)), py - (y0 + t * (y1 - y0)));
    if (d <= maxKm && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}
// "Ehrenberg · I-10" — the place on the side being entered, then the road; the road alone when the table has
// no name for that side.
export function postLabel(port, entered) {
  if (!port) return null;
  const near = port.near || {};
  const other = String(port.pair).split("-").find((s) => s !== entered);
  const town = near[entered] || near[other] || null;
  return [town, port.road].filter(Boolean).join(" · ") || null;
}
