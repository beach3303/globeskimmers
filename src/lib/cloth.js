// The owner's cloth: the colour their world is bound in (bible.profile.personalisation).
// It lives in public.profiles.cloth (backend item B1), the owner's own prefs row, which
// they read through AuthContext's select('*') and write through the profiles_update_own
// policy. It is personal, not social, so a teen can choose one too.
//
//   const mine = useMyCloth();
//   mine.key, mine.name, mine.cloth, mine.paper, mine.line, mine.fieldLine
//                    the stored cloth's tokens (CLOTH in constants.js); Harbour while the
//                    profile is loading, when nothing is stored, or for an unknown key.
//   mine.supported   true when the profile row has a cloth column (even an empty one). Before
//                    B1 is applied it doesn't, and the cloth picker stays hidden.
//   mine.save(key)   saveMyCloth(key) with the context's refreshProfile.
//
//   saveMyCloth(key, { refreshProfile, userId }) writes the cloth, then refreshes the
//   profile, and resolves { ok, key, error }. ok is true only when the stored value reads
//   back as key. error: 'unknown_cloth', 'not_signed_in', 'unsupported' (no cloth column
//   yet), 'not_saved' (the write changed nothing) or the database's message.
//
// clothOf (and CLOTH, CLOTH_ORDER, DEFAULT_CLOTH) are re-exported from constants.js: any
// stored key, missing, empty or unknown, gives a cloth, Harbour by default.
import { useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { CLOTH, CLOTH_ORDER, DEFAULT_CLOTH, clothOf } from '@/components/redesign/constants';

export { CLOTH, CLOTH_ORDER, DEFAULT_CLOTH, clothOf };

/** True for one of the eight cloth keys. @param {any} key */
export const isClothKey = (key) => typeof key === 'string' && CLOTH_ORDER.includes(key);

// PostgREST answers PGRST204 when a column isn't in its schema cache; Postgres says 42703.
const missingColumn = (err) =>
  !!err && (
    err.code === 'PGRST204' ||
    err.code === '42703' ||
    (/column/i.test(String(err.message || '')) && /cloth/i.test(String(err.message || '')))
  );

/**
 * @param {any} key
 * @param {{ refreshProfile?: () => Promise<any>, userId?: string|null }} [opts]
 * @returns {Promise<{ ok: boolean, key: string, error: string|null }>}
 */
export async function saveMyCloth(key, opts) {
  const k = typeof key === 'string' ? key.trim().toLowerCase() : '';
  if (!isClothKey(k)) return { ok: false, key: k, error: 'unknown_cloth' };
  const refreshProfile = opts && typeof opts.refreshProfile === 'function' ? opts.refreshProfile : null;
  let uid = opts && opts.userId ? String(opts.userId) : null;
  if (!uid) {
    try {
      const { data } = await supabase.auth.getSession();
      uid = data?.session?.user?.id || null;
    } catch {
      uid = null;
    }
  }
  if (!uid) return { ok: false, key: k, error: 'not_signed_in' };

  let stored;
  try {
    const res = await supabase.from('profiles').update({ cloth: k }).eq('id', uid).select('cloth');
    if (res.error) return { ok: false, key: k, error: missingColumn(res.error) ? 'unsupported' : res.error.message || 'not_saved' };
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    stored = row ? row.cloth : undefined;
  } catch (e) {
    return { ok: false, key: k, error: e?.message || 'not_saved' };
  }
  // The context reads the whole row again, so the page repaints in the saved cloth; when
  // it reads back, its value is the one that counts.
  if (refreshProfile) {
    try {
      const fresh = await refreshProfile();
      if (fresh && typeof fresh === 'object' && 'cloth' in fresh) stored = fresh.cloth;
    } catch {
      /* the write above already answered */
    }
  }
  return stored === k ? { ok: true, key: k, error: null } : { ok: false, key: k, error: 'not_saved' };
}

/**
 * The signed-in owner's cloth (Harbour until the profile says otherwise).
 */
export function useMyCloth() {
  // Without an AuthProvider (a test harness) there is no profile: Harbour, unsupported.
  let auth = null;
  try {
    auth = useAuth();
  } catch {
    auth = null;
  }
  const profile = auth && auth.profile && typeof auth.profile === 'object' ? auth.profile : null;
  const refreshProfile = auth ? auth.refreshProfile : undefined;
  const userId = auth && auth.user ? auth.user.id : null;
  const stored = profile ? profile.cloth : undefined;
  const supported = !!profile && 'cloth' in profile;
  const save = useCallback((key) => saveMyCloth(key, { refreshProfile, userId }), [refreshProfile, userId]);
  return useMemo(() => ({ ...clothOf(stored), supported, save }), [stored, supported, save]);
}
