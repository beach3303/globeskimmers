import { queryClientInstance } from '@/lib/query-client';

// Clears CACHED RESULTS so the user gets fresh data, WITHOUT touching auth,
// preferences, saved locations, or free-tier counters.
//
// Strategy = allowlist-to-DELETE: we only remove localStorage keys whose prefix
// is a known result-cache. Everything else (the Supabase session
// `globeskimmers.auth*`, prefs like `gs_font_scale_step` / `gs_distance_unit`,
// SAVED data `saved_activities`, scan counters, one-time UI flags, base44_*) is
// preserved by default — so we can never accidentally log the user out or wipe
// their saved places.
const CACHE_PREFIXES = [
  'gs_ttd2_',                          // Things To Do results
  'culture_cache_',                    // Culture info
  'phrases_v14_',                      // Basic phrases translations
  'tts_audio_',                        // Basic phrases cached audio
  'globeskimmers_exchange_rates',      // FX caches (price scanner _v2 + transportation)
];

export function clearAppCache() {
  // 1) React Query — all finder / server-state results (PlacesToEat, Coffee,
  //    ATM, Money Exchange, Shopping, Restroom, Convenience, Home, Weather…).
  try { queryClientInstance.clear(); } catch { /* ignore */ }

  // 2) localStorage result caches only.
  try {
    for (const key of Object.keys(localStorage)) {
      if (CACHE_PREFIXES.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* ignore */ }
}
