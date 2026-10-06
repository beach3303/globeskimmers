// Distance display units (founder, 2026-10-06): the label follows the
// traveler's COUNTRY by default — miles in the four mile countries, km
// everywhere else — and the Settings choice (profile.distance_unit 'mi'|'km')
// always wins when set.
export const MILE_COUNTRIES = new Set(["US", "GB", "LR", "MM"]);
export const KM_PER_MI = 1.60934;

export function distanceUnit(profile, cc) {
  const pref = profile?.distance_unit;
  if (pref === "mi" || pref === "km") return pref;
  return MILE_COUNTRIES.has(String(cc || "").toUpperCase()) ? "mi" : "km";
}

export function distanceLabel(km, unit) {
  if (!Number.isFinite(km)) return null;
  const v = unit === "mi" ? km / KM_PER_MI : km;
  const n = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${n} ${unit === "mi" ? "MI" : "KM"}`;
}
