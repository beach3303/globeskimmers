// searchRank.js — the pure result-ordering rules Search adds to Places to Eat
// (founder, 2026-10-07). Shared by the app and the worldwide test suite
// (scripts/search-eval) so a test ranks results exactly like the phone does.
import { countryCode } from "./countries.js";

// Review-weighted (Bayesian) rating: (R·v + 4.0·50) / (v + 50). A 5.0 with 3
// reviews scores ~4.06; a 4.6 with 4,600 scores ~4.59. When a city was NAMED,
// a place beyond 8 miles loses 0.03/mile ("best brunch in NYC" had ranked a
// New Jersey spot 22 miles out first).
export function weightedRating(x, { named = false } = {}) {
  if (!x.rating) return -1; // unrated places sink below every rated one
  const v = x.userRatingCount || 0;
  const base = ((x.rating || 0) * v + 4.0 * 50) / (v + 50);
  return base - (named ? 0.03 * Math.max(0, (x.distanceMiles || 0) - 8) : 0);
}

// Dish/authenticity tier still leads, so "best authentic X" stays authentic.
export function sortByRating(list, { named = false } = {}) {
  return [...list].sort((a, b) =>
    ((a.tier || 1) - (b.tier || 1)) ||
    (weightedRating(b, { named }) - weightedRating(a, { named })) ||
    ((a.distanceMiles || 999) - (b.distanceMiles || 999)));
}

// "in Tijuana" means Mexico — Google addresses end with the country.
// Only a CLEARLY different country is dropped: our own places data often has
// addresses with no country at all ("Calle de Carretas, 3"), and treating
// those as foreign emptied Madrid to one result.
export function keepCountry(list, country) {
  if (!country) return list;
  const want = countryCode(country);
  if (!want) return list;
  const kept = list.filter((x) => {
    const last = String(x.formattedAddress || "").split(",").pop().trim();
    const cc = last ? countryCode(last) : null;
    return !cc || cc === want;
  });
  return kept.length ? kept : list; // never empty a list on an address-format surprise
}

// A named smaller place (Redondo Beach): within 5 miles leads, if at least 3.
export function nearFirst(list, miles = 5, min = 3) {
  const near = list.filter((x) => (x.distanceMiles ?? 999) <= miles);
  return near.length >= min ? [...near, ...list.filter((x) => (x.distanceMiles ?? 999) > miles)] : list;
}
