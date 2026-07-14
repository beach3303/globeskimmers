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

export function homeTimezoneForCountry(name) {
  return HOME_COUNTRY_TIMEZONES[name] || 'UTC';
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
    country,
    latitude,
    longitude,
    timezone,
    label: result?.placeName || city || country,
  };
}
