// The Base44-era user shape, rebuilt from the Supabase session + profile, for
// the few pages that still read those field names. Base44's auth.me() fails
// for every Supabase-signed-in user, so those pages silently lost their
// preferences (and Basic Phrases never detected the local language at all).
export function legacyUser(user, profile) {
  if (!user && !profile) return null;
  const du = profile?.distance_unit;
  return {
    id: user?.id || null,
    email: user?.email || null,
    full_name: profile?.first_name || user?.user_metadata?.full_name || null,
    home_country: profile?.home_country || "",
    preferred_currency: profile?.preferred_currency || null,
    preferred_currencies: profile?.preferred_currency ? [profile.preferred_currency] : [],
    primary_banking_currency: profile?.primary_banking_currency || null, // null = never chosen (the ATM asks once)
    preferred_distance_unit: du === "mi" ? "miles" : du === "km" ? "kilometers" : null,
    preferred_language: profile?.preferred_language || null,
  };
}
