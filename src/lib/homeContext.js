// homeContext.js — the "smart homepage" brain.
//
// Pure logic (no React, no network): given the traveler's CONTEXT — what travel
// MODE they're in, the local hour, season, and weather — it decides what the
// homepage should surface and in what order. It serves four very different
// audiences, and the homepage's whole PURPOSE flips between them:
//
//   • home         — in your own city, just browsing → INSPIRATION ("where to
//                     next?") + gentle local discovery.
//   • domestic     — a different city, same country → new-city utility, but NO
//                     currency/phrases (you don't need money exchange in-country).
//   • international — a different country → full arrival: money · ATM · phrases.
//   • planning      — browsing a place you're NOT physically at → wanderlust for
//                     that place (what you'd do there right now).
//
// Everything here is free to compute — no API calls. Weights are plain tables so
// they're easy to tune.

import { countryCode } from '@/lib/countries';

// ── Category catalog (single source of truth) ────────────────────────────
// `action` is the exact label handleQuickAction() routes on. emoji/title/catKey
// mirror the existing Home tiles so any UI built on this matches the design.
export const CATEGORIES = [
  { key: 'eat',         action: 'Places to Eat',       emoji: '🍽️', title: 'Nearby Restaurants', catKey: 'food' },
  { key: 'coffee',      action: 'Coffee',              emoji: '☕',  title: 'Coffee Finder',      catKey: 'coffee' },
  { key: 'shopping',    action: 'Shopping',            emoji: '🛍️', title: 'Shopping',           catKey: 'shopping' },
  { key: 'attractions', action: 'Things to Do',        emoji: '🎟️', title: 'Things to Do',       catKey: 'todo' },
  { key: 'money',       action: 'Money Exchange',      emoji: '💱', title: 'Money Exchange',     catKey: 'money' },
  { key: 'atm',         action: 'ATM',                 emoji: '🏧', title: 'ATM Finder',         catKey: 'atm' },
  { key: 'culture',     action: 'Culture Information',  emoji: '🏛️', title: 'Cultural Info',      catKey: 'culture' },
  { key: 'transit',     action: 'Transportation',      emoji: '🚌', title: 'Transit Info',       catKey: 'transit' },
  { key: 'convenience', action: 'Convenience Store',    emoji: '🏪', title: 'Convenience',        catKey: 'convenience' },
  { key: 'restroom',    action: 'Restroom',            emoji: '🚻', title: 'Restroom Finder',    catKey: 'restroom' },
  { key: 'weather',     action: 'Weather',             emoji: '☀️', title: 'Weather',            catKey: 'weather' },
  { key: 'phrases',     action: 'Basic Phrases',       emoji: '💬', title: 'Basic Phrases',      catKey: 'phrases' },
];

export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

// Base weights — the front-runners the app leads with (eat / shopping / coffee /
// attractions). Context boosts stack on top of these.
const BASE_WEIGHT = {
  eat: 10, shopping: 9, coffee: 8, attractions: 8,
  money: 5, atm: 5, culture: 4, transit: 4,
  convenience: 3, restroom: 3, weather: 2, phrases: 2,
};

// ── Travel mode ──────────────────────────────────────────────────────────
export const MODES = ['home', 'domestic', 'international', 'planning', 'discovery'];

const norm = (s) => String(s || '').trim().toLowerCase();

// Same country? Compare ISO codes when both names resolve (GPS says "Czechia",
// the Settings picker says "Czech Republic"); otherwise compare the names.
const sameCountryAs = (a, b) => {
  const ca = countryCode(a), cb = countryCode(b);
  return ca && cb ? ca === cb : norm(a) === norm(b);
};

// Great-circle distance in km (used to tell "same city as home" from "another
// city in the same country" when we have coordinates for both).
export function haversineKm(aLat, aLng, bLat, bLng) {
  if ([aLat, aLng, bLat, bLng].some((v) => !Number.isFinite(v))) return null;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Classify the traveler's situation from the ACTIVE place vs their HOME.
//   present — is the active place where they physically are? (GPS/"current"
//             mode = true; a manually-picked place = false → they're planning).
// Same-city detection prefers coordinate distance (~60km) and falls back to
// city-name match. Unknown home → 'discovery' (treated like home, but we never
// assume arrival essentials we can't justify).
export function getTravelMode({
  present = true,
  activeCountry, activeCity, activeLat, activeLng,
  homeCountry, homeCity, homeLat, homeLng,
  sameCityKm = 60,
} = {}) {
  if (!present) return 'planning';
  if (!homeCountry && !homeCity && !Number.isFinite(homeLat)) return 'discovery';

  // Home coordinates win: within ~60km of the home city is 'home' whatever the
  // country names say. home_country is chosen separately in Settings (it drives
  // the flag), so it need not be the home city's country.
  const dist = haversineKm(activeLat, activeLng, homeLat, homeLng);
  if (dist != null && dist <= sameCityKm) return 'home';

  const sameCountry = homeCountry && activeCountry ? sameCountryAs(activeCountry, homeCountry) : null;
  if (sameCountry === false) return 'international';

  // Same (or unknown) country → decide home vs domestic.
  if (dist != null) return 'domestic';
  if (homeCity && activeCity) return norm(activeCity) === norm(homeCity) ? 'home' : 'domestic';
  // Same country but can't resolve the city → assume home (don't fake new-city
  // essentials). If country was also unknown, this is our best neutral guess.
  return sameCountry ? 'home' : 'discovery';
}

// ── Signal derivation ────────────────────────────────────────────────────
export const DAY_PARTS = ['earlyMorning', 'morning', 'midday', 'afternoon', 'evening', 'lateNight'];

export function getDayPart(hour) {
  if (hour == null || Number.isNaN(hour)) return 'midday';
  if (hour >= 5 && hour < 8) return 'earlyMorning';
  if (hour >= 8 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'lateNight'; // 22:00–04:59
}

// Hemisphere-aware meteorological season (near the equator → 'tropical').
export function getSeason(date, latitude) {
  const m = date.getMonth();
  if (latitude != null && Math.abs(latitude) < 10) return 'tropical';
  const north = latitude == null || latitude >= 0;
  const northSeason = m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'fall';
  if (north) return northSeason;
  return { winter: 'summer', summer: 'winter', spring: 'fall', fall: 'spring' }[northSeason];
}

export function getWeatherBucket(weather) {
  if (!weather) return 'unknown';
  const cond = norm(weather.condition);
  if (/rain|drizzle|shower|thunder|storm/.test(cond)) return 'rain';
  if (/snow|sleet|blizzard|ice/.test(cond)) return 'cold';
  const c = Number(weather.celsius);
  if (Number.isFinite(c)) return c < 12 ? 'cold' : c > 28 ? 'hot' : 'mild';
  return 'unknown';
}

export function localHourInTimezone(date, timezone) {
  try {
    if (!timezone) return date.getHours();
    const h = parseInt(date.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }), 10);
    return Number.isFinite(h) ? (h === 24 ? 0 : h) : date.getHours();
  } catch {
    return date.getHours();
  }
}

// Assemble the context. `mode` comes from getTravelMode(); `targetIsIntl` marks a
// planning session for a place in a different country than home (→ suggest phrases).
export function buildHomeContext({ now, timezone, latitude, weather, mode = 'discovery', targetIsIntl = false, hasSaves = false }) {
  const when = now || new Date();
  const localHour = localHourInTimezone(when, timezone);
  return {
    localHour,
    dayPart: getDayPart(localHour),
    season: getSeason(when, latitude),
    weatherBucket: getWeatherBucket(weather),
    mode,
    targetIsIntl: !!targetIsIntl,
    hasSaves: !!hasSaves,
  };
}

// ── Boost tables (tune freely) ───────────────────────────────────────────
// Mode boost = the "why are you here" layer. This is where home vs domestic vs
// international vs planning diverge.
const MODE_BOOST = {
  international: { money: 12, atm: 11, eat: 8, phrases: 6, transit: 4 }, // just landed abroad
  domestic:     { transit: 8, eat: 7, attractions: 6, atm: 4, shopping: 3 }, // new city — NO currency/phrases
  home:         { eat: 4, coffee: 4, attractions: 4, shopping: 3, culture: 2 }, // gentle local discovery
  discovery:    { eat: 4, coffee: 4, attractions: 4, shopping: 3 }, // unknown → treat like home
  planning:     { attractions: 10, eat: 6, culture: 5, shopping: 3 }, // dreaming about a place
};

const DAYPART_BOOST = {
  earlyMorning: { coffee: 9, eat: 5, attractions: 2, transit: 2 },
  morning:      { coffee: 8, eat: 5, attractions: 4, transit: 2 },
  midday:       { eat: 7, shopping: 5, attractions: 4 },
  afternoon:    { shopping: 6, attractions: 5, coffee: 3 },
  evening:      { eat: 8, attractions: 5, shopping: 2 },
  lateNight:    { convenience: 8, atm: 5, transit: 5, eat: 3 },
};

const WEATHER_BOOST = {
  cold:    { shopping: 6, coffee: 6, culture: 5, attractions: -3 },
  rain:    { shopping: 6, culture: 5, coffee: 4, restroom: 3, attractions: -4 },
  hot:     { attractions: 5, shopping: 3, coffee: -2 },
  mild:    { attractions: 3 },
  unknown: {},
};

const SEASON_BOOST = {
  summer:   { attractions: 3, shopping: 2 },
  winter:   { coffee: 3, culture: 3, shopping: 2 },
  spring:   { attractions: 2 },
  fall:     { culture: 2, coffee: 2 },
  tropical: { attractions: 2 },
};

const REASON = {
  international: 'Just landed', domestic: 'New city', home: 'Around home',
  discovery: 'Explore', planning: 'Trip planning', targetIntl: 'Going abroad',
  earlyMorning: 'Early start', morning: 'Morning', midday: 'Midday',
  afternoon: 'Afternoon', evening: 'Evening', lateNight: 'Late night',
  cold: 'Cold out', rain: 'Rainy', hot: 'Hot out', mild: 'Nice out',
  summer: 'Summer', winter: 'Winter', spring: 'Spring', fall: 'Fall', tropical: 'Tropical',
};

// Weather/season only matter for where you ARE. When planning a remote place we
// still apply them (they describe that place). At home browsing, they apply too.
export function scoreCategories(context, { limit } = {}) {
  const scores = {}, reasons = {};
  const bump = (key, pts, label) => {
    if (pts == null) return;
    scores[key] = (scores[key] || 0) + pts;
    if (pts > 0 && label && !(reasons[key] || []).includes(label)) (reasons[key] = reasons[key] || []).push(label);
  };

  for (const c of CATEGORIES) bump(c.key, BASE_WEIGHT[c.key] ?? 0, null);
  for (const [k, p] of Object.entries(MODE_BOOST[context.mode] || {})) bump(k, p, REASON[context.mode]);
  if (context.mode === 'planning' && context.targetIsIntl) bump('phrases', 7, REASON.targetIntl);
  for (const [k, p] of Object.entries(DAYPART_BOOST[context.dayPart] || {})) bump(k, p, REASON[context.dayPart]);
  for (const [k, p] of Object.entries(WEATHER_BOOST[context.weatherBucket] || {})) bump(k, p, REASON[context.weatherBucket]);
  for (const [k, p] of Object.entries(SEASON_BOOST[context.season] || {})) bump(k, p, REASON[context.season]);

  const ordered = CATEGORIES
    .map((c) => ({ ...c, score: scores[c.key] ?? 0, reasons: reasons[c.key] || [] }))
    .sort((a, b) => b.score - a.score);
  return typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
}

// ── Row plan ─────────────────────────────────────────────────────────────
// The homepage isn't just a reordered grid — the ROWS themselves differ by mode.
// Returns an ordered list of row types the homepage renderer maps to components.
// 'nearYouNow' / category rows are filled by scoreCategories(); the inspiration
// rows ('whereToNext', 'seasonalEscapes', 'placeRightNow') are the wanderlust
// engine that keeps home-browsers engaged between trips.
export function getRowPlan(mode) {
  switch (mode) {
    case 'international': return ['arrivalEssentials', 'attractions', 'nearYouNow', 'seasonalEscapes'];
    case 'domestic':     return ['newCityEssentials', 'attractions', 'nearYouNow', 'seasonalEscapes'];
    case 'planning':     return ['placeRightNow', 'thingsToDoThere', 'foodThere', 'seasonalEscapes'];
    case 'home':
    case 'discovery':
    default:             return ['whereToNext', 'nearYouNow', 'seasonalEscapes'];
  }
}
