import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';

// Home "place" model. We capture home as a CITY (with coordinates), not just a
// country name, so the timezone is derived from the coordinates and is therefore
// EXACT worldwide. This fixes the long-standing bug where a home country like the
// United States always resolved to Eastern time (a Los-Angeles local saw the
// wrong clock). The country is still kept alongside it — it drives the flag.

// Fallback timezone per country, used ONLY for legacy users who set a home
// COUNTRY before we captured coordinates (so we can't derive the exact zone).
// Accurate for single-timezone countries; a best-guess for multi-zone ones —
// which is exactly why new/updated users pick a home CITY instead.
export const HOME_COUNTRY_TIMEZONES = {
  'United States': 'America/New_York', 'Philippines': 'Asia/Manila', 'Japan': 'Asia/Tokyo',
  'United Kingdom': 'Europe/London', 'Australia': 'Australia/Sydney', 'Canada': 'America/Toronto',
  'Germany': 'Europe/Berlin', 'France': 'Europe/Paris', 'Italy': 'Europe/Rome',
  'Spain': 'Europe/Madrid', 'Brazil': 'America/Sao_Paulo', 'Mexico': 'America/Mexico_City',
  'South Korea': 'Asia/Seoul', 'Thailand': 'Asia/Bangkok', 'Vietnam': 'Asia/Ho_Chi_Minh',
  'Singapore': 'Asia/Singapore', 'Malaysia': 'Asia/Kuala_Lumpur', 'Indonesia': 'Asia/Jakarta',
  'India': 'Asia/Kolkata', 'China': 'Asia/Shanghai',
};

// null (never a guessed 'UTC') for countries outside the map: Home then hides
// the home clock instead of showing a wrong time labelled with the country.
export function homeTimezoneForCountry(name) {
  return HOME_COUNTRY_TIMEZONES[name] || null;
}

// Countries, by name and by the short names people type (2026-10-30: the founder's Android test
// typed "US", "USA" and "United States of America" into "Where's home?" and got "No cities
// match"). The home picker offers the country itself as an answer; the home clock then uses the
// country's default zone until a city is added in Settings.
const C = (name, iso, ...aliases) => ({ name, iso, aliases });
export const COUNTRIES = [
  C('United States', 'US', 'us', 'usa', 'america', 'united states of america', 'the states', 'estados unidos'),
  C('United Kingdom', 'GB', 'uk', 'britain', 'great britain', 'england', 'scotland', 'wales'),
  C('Philippines', 'PH', 'ph', 'pinas', 'pilipinas', 'philipines', 'phillipines', 'phillippines'),
  C('Canada', 'CA'), C('Mexico', 'MX', 'méxico'), C('Australia', 'AU', 'aus', 'oz'), C('New Zealand', 'NZ', 'nz', 'aotearoa'),
  C('Japan', 'JP', 'nippon', 'nihon'), C('South Korea', 'KR', 'korea', 'republic of korea'), C('China', 'CN', 'prc'),
  C('Taiwan', 'TW'), C('Hong Kong', 'HK', 'hk'), C('Singapore', 'SG', 'sg'), C('Malaysia', 'MY'), C('Thailand', 'TH'),
  C('Vietnam', 'VN', 'viet nam'), C('Indonesia', 'ID'), C('India', 'IN', 'bharat'), C('Pakistan', 'PK'), C('Bangladesh', 'BD'),
  C('Sri Lanka', 'LK'), C('Nepal', 'NP'), C('United Arab Emirates', 'AE', 'uae', 'emirates'), C('Saudi Arabia', 'SA', 'ksa'),
  C('Qatar', 'QA'), C('Kuwait', 'KW'), C('Israel', 'IL'), C('Turkey', 'TR', 'türkiye', 'turkiye'), C('Egypt', 'EG'),
  C('South Africa', 'ZA', 'rsa'), C('Nigeria', 'NG'), C('Kenya', 'KE'), C('Ghana', 'GH'), C('Morocco', 'MA'), C('Ethiopia', 'ET'),
  C('Germany', 'DE', 'deutschland'), C('France', 'FR'), C('Italy', 'IT', 'italia'), C('Spain', 'ES', 'españa', 'espana'),
  C('Portugal', 'PT'), C('Netherlands', 'NL', 'holland', 'the netherlands'), C('Belgium', 'BE'), C('Switzerland', 'CH'),
  C('Austria', 'AT'), C('Ireland', 'IE'), C('Sweden', 'SE'), C('Norway', 'NO'), C('Denmark', 'DK'), C('Finland', 'FI'),
  C('Iceland', 'IS'), C('Poland', 'PL', 'polska'), C('Czech Republic', 'CZ', 'czechia'), C('Hungary', 'HU'), C('Greece', 'GR'),
  C('Romania', 'RO'), C('Croatia', 'HR'), C('Ukraine', 'UA'), C('Russia', 'RU'),
  C('Brazil', 'BR', 'brasil'), C('Argentina', 'AR'), C('Chile', 'CL'), C('Colombia', 'CO'), C('Peru', 'PE', 'perú'),
  C('Venezuela', 'VE'), C('Ecuador', 'EC'), C('Bolivia', 'BO'), C('Uruguay', 'UY'), C('Dominican Republic', 'DO'),
  C('Puerto Rico', 'PR'), C('Cuba', 'CU'), C('Jamaica', 'JM'), C('Costa Rica', 'CR'), C('Panama', 'PA', 'panamá'),
  C('Guatemala', 'GT'), C('Honduras', 'HN'), C('El Salvador', 'SV'), C('Nicaragua', 'NI'), C('Guam', 'GU'), C('Fiji', 'FJ'),
];
const flagOf = (iso) => String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0)));
const fold = (s) => String(s || '').toLowerCase().replace(/[.’'`]/g, '').replace(/\s+/g, ' ').replace(/^the /, '').trim();

// The countries a query names: an exact name or short name first ("us", "usa", "philippines");
// otherwise, from four letters, the names that begin with it ("unit" → United States, United
// Kingdom, United Arab Emirates). At most three, each with its flag.
export function matchCountry(query) {
  const q = fold(query);
  if (q.length < 2) return [];
  const exact = COUNTRIES.filter((c) => fold(c.name) === q || c.aliases.some((a) => fold(a) === q));
  const list = exact.length ? exact
    : q.length >= 4 ? COUNTRIES.filter((c) => fold(c.name).startsWith(q) || c.aliases.some((a) => a.length >= 4 && fold(a).startsWith(q))) : [];
  return list.slice(0, 3).map((c) => ({ name: c.name, iso: c.iso, flag: flagOf(c.iso) }));
}

// A country picked as home, with no city: the flag's country and the country's default zone.
export function countryHomePlace(c) {
  return { city: '', state: '', country: c.name, latitude: null, longitude: null, timezone: homeTimezoneForCountry(c.name), label: c.name, countryOnly: true };
}

// Search cities/places for the home picker. Reuses the Worker's search-location
// route, which already rejects too-broad country/state queries (so users are
// nudged to a specific city). Returns [] on error or short queries.
export async function searchHomeCities(query) {
  const q = (query || '').trim();
  if (q.length < 3) return [];
  try {
    const { data } = await callWorker(ROUTE.searchLocation, { query: q });
    return Array.isArray(data?.results) ? data.results : [];
  } catch {
    return [];
  }
}

// Turn a picked search result into a stored home place. Resolves the EXACT IANA
// timezone from the coordinates (weather-forecast route) — the whole point — and
// falls back to the country's default zone only if that lookup fails.
export async function resolveHomePlace(result) {
  const latitude = result?.coordinates?.latitude ?? result?.latitude ?? null;
  const longitude = result?.coordinates?.longitude ?? result?.longitude ?? null;
  const country = result?.address?.country || result?.state_or_country || '';
  const city = result?.address?.city || result?.placeName || result?.city || '';

  let timezone = null;
  if (latitude != null && longitude != null) {
    try {
      const { data } = await callWorker(ROUTE.getWeatherForecast, { latitude, longitude });
      timezone = data?.timezone || null;
    } catch { /* fall through to the country default */ }
  }
  if (!timezone) timezone = homeTimezoneForCountry(country);

  return {
    city: city || country,
    // The state or region, so two same-named cities read differently
    // ("Pasadena, TX" vs "Pasadena, California") where a pick is named
    // (2026-10-12). Callers store only the fields they name.
    state: result?.address?.state || result?.address?.region || '',
    country,
    latitude,
    longitude,
    timezone,
    label: result?.placeName || city || country,
  };
}
