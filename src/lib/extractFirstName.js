// src/lib/extractFirstName.js
//
// Reads a supabase-js v2 user (from supabase.auth.getUser() or session.user) and
// returns the best first name from user_metadata, or null. Provider-agnostic.
//
// Per-provider reality (verified vs official Supabase docs):
//   Google   → user_metadata: given_name, family_name, full_name, name
//   Facebook → user_metadata: full_name, name   (NO given_name)
//   Apple    → token carries NO name; user_metadata only has given_name/
//              full_name IF our native Apple flow saved it via updateUser()
//              on the first authorization (see signInWithAppleNative).
//   Email    → first_name IF we passed options.data.first_name at signUp.
//
// null → the caller shows the onboarding first-name field as the fallback, and
// the homepage greeting falls back to "Hello, traveler" (never renders null).

export function extractFirstName(user) {
  const m = user?.user_metadata;
  if (!m) return null;
  return (
    clean(m.given_name) ||
    clean(m.first_name) ||
    firstToken(m.full_name) ||
    firstToken(m.name) ||
    null
  );
}

function clean(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

function firstToken(v) {
  const t = clean(v);
  if (!t) return null;
  const token = t.split(/\s+/)[0];
  return token.length ? token : null;
}
