// The distance unit, one source of truth for every finder (and Home, which reads the same
// profile column through src/lib/units.js).
//
//   useDistanceUnit(activeLocation) -> { unit: 'mi' | 'km', setUnit, formatDistance }
//     unit resolves, in order:
//       1. profile.distance_unit, the Settings choice (the profiles row AuthContext loads);
//       2. the legacy per-device choice in localStorage gs_distance_unit;
//       3. the country default for the active location (miles in the US, UK, Liberia and
//          Myanmar, as units.js decides it), and miles while that is still unknown.
//     setUnit(u) answers at once: it stores u on this device (localStorage), tells every
//     mounted copy of the hook, and, when signed in, writes profiles.distance_unit (the
//     column Settings' Distance unit row writes) and then refreshProfile(), so Home and
//     Settings follow. The profile write is best-effort: if it fails the device keeps the
//     choice for this session and the next profile read decides after that.
//     formatDistance(miles) formats in the resolved unit.
//   formatDistance(miles, unit) and defaultUnitForCountry(countryName) are unchanged.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { countryCode } from '@/lib/countries';
import { MILE_COUNTRIES } from '@/lib/units';

const STORAGE_KEY = 'gs_distance_unit';
const CHANGE_EVENT = 'gs:distance-unit';
const MILES_COUNTRIES = ['United States', 'United Kingdom', 'Liberia', 'Myanmar'];

export function defaultUnitForCountry(country) {
  return MILES_COUNTRIES.includes(country) ? 'mi' : 'km';
}

export function formatDistance(miles, unit) {
  if (miles == null || isNaN(miles)) return '';
  if (unit === 'km') {
    const km = miles * 1.60934;
    if (km < 0.1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

/** @param {unknown} u @returns {'mi'|'km'|null} */
const valid = (u) => (u === 'mi' || u === 'km' ? u : null);

function readSaved() {
  try {
    return valid(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage blocked (private mode) or no window
  }
}

function writeSaved(u) {
  try {
    window.localStorage.setItem(STORAGE_KEY, u);
  } catch {
    /* storage blocked: the choice still holds for this session */
  }
}

// The country default, decided as Home's units.js decides it (by ISO code), with the
// legacy name list as a fallback for a name countryCode doesn't know.
function countryDefault(country) {
  if (!country) return null;
  const cc = countryCode(country);
  if (cc) return MILE_COUNTRIES.has(String(cc).toUpperCase()) ? 'mi' : 'km';
  return defaultUnitForCountry(country);
}

// useAuth throws outside an AuthProvider. The app always has one; a page rendered on its
// own (a test page) reads no profile instead of crashing. useContext runs either way, so
// the hook order never changes.
/** @returns {any} */
function useAuthOrNull() {
  try {
    return useAuth();
  } catch {
    return null;
  }
}

/**
 * @param {any} [activeLocation]
 * @returns {{ unit: 'mi'|'km', setUnit: (u: string) => void, formatDistance: (miles: number) => string }}
 */
export function useDistanceUnit(activeLocation) {
  const auth = useAuthOrNull();
  const profile = auth ? auth.profile : null;
  const userId = auth && auth.user ? auth.user.id : null;
  const refreshProfile = auth ? auth.refreshProfile : null;

  // The choice made on this device this session, until the profile reads it back.
  const [picked, setPicked] = useState(/** @type {'mi'|'km'|null} */ (null));
  const [saved, setSaved] = useState(() => (typeof window === 'undefined' ? null : readSaved()));

  // Every mounted copy follows a choice made anywhere (this tab, or another one).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPick = (e) => {
      const u = valid(e && e.detail);
      if (u) {
        setPicked(u);
        setSaved(u);
      }
    };
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setSaved(valid(e.newValue));
    };
    window.addEventListener(CHANGE_EVENT, onPick);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onPick);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const pref = valid(profile && profile.distance_unit);
  // Once the profile holds the choice, the profile is the source again.
  useEffect(() => {
    if (picked && pref === picked) setPicked(null);
  }, [picked, pref]);

  const unit = picked || pref || saved || countryDefault(activeLocation?.address?.country) || 'mi';

  const setUnit = useCallback(
    (u) => {
      const v = valid(u);
      if (!v) return;
      setPicked(v);
      setSaved(v);
      writeSaved(v);
      try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: v }));
      } catch {
        /* no window */
      }
      if (!userId) return;
      // Best-effort, the same column Settings' Distance unit row writes.
      Promise.resolve(supabase.from('profiles').update({ distance_unit: v }).eq('id', userId))
        .then((res) => {
          if (res && !res.error && typeof refreshProfile === 'function') return refreshProfile();
          return null;
        })
        .catch(() => {});
    },
    [userId, refreshProfile],
  );

  const fmt = useCallback((miles) => formatDistance(miles, unit), [unit]);
  return { unit, setUnit, formatDistance: fmt };
}
