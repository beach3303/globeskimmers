import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { AdMob } from "@capacitor-community/admob";
import { createPageUrl } from "@/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { extractFirstName } from "@/lib/extractFirstName";
import { inferProfileDefaults } from "@/lib/inferProfileDefaults";
import { addStamp } from "@/lib/passport";
import { countryCode } from "@/lib/countries";

// Essential steps only — the rest is inferred or deferred.
import LocationStep from "../components/onboarding/LocationStep";
import HomeCountryStep from "../components/onboarding/HomeCountryStep";
import PassportStep from "../components/onboarding/PassportStep";
import FirstNameStep from "../components/onboarding/FirstNameStep";

// Account-tied onboarding. The user is ALWAYS authenticated here (App.jsx's
// forced gate guarantees a Supabase session). On the final step we write the
// answers to public.profiles and flip onboarding_completed = true (the
// once-ever flag the Layout gate reads).
//
// FRICTION CUT (2026-07-23): reduced from ~14 screens to the essentials —
//   1. first name (skipped if we already know it from the provider),
//   2. location (also grants the OS location permission early),
//   3. home city (gives country + exact timezone for the home clock).
// Everything the old flow ASKED for is now INFERRED (currency / language /
// temperature / distance unit — from home country + device locale, see
// inferProfileDefaults) or DEFERRED (travel frequency / purpose / traveler
// type / favorite countries / next destination / budget / accommodation — the
// step components still exist for Settings + in-context prompts; they're just
// no longer a wall at signup). Users can change any inferred default in Settings.
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  // First name may already be known (provider metadata → profiles.first_name via
  // the signup trigger, or directly in user_metadata). If so, skip that step.
  const initialFirstName = useMemo(
    () => profile?.first_name || extractFirstName(user) || "",
    [profile, user]
  );

  const steps = useMemo(() => {
    const list = [];
    if (!initialFirstName) list.push("first_name");
    // v2 order (founder queue #1, 2026-09-29): the city first so page one can
    // render, then the passport explainer, then the location ask — by then the
    // traveler knows exactly why the app wants it (stamps are earned by being
    // there), which is the honest frame for the permission.
    list.push("home_country", "passport", "location");
    return list;
  }, [initialFirstName]);

  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState({});
  const [saving, setSaving] = useState(false);

  // No ads during onboarding. The native AdMob banner is a system overlay that
  // can linger from the brief Home mount that precedes the onboarding redirect,
  // so clear it on entry. Ads resume on Home once onboarding_completed is true.
  useEffect(() => {
    if (Capacitor.getPlatform() === "web") return;
    AdMob.hideBanner().catch(() => {});
    AdMob.removeBanner().catch(() => {});
  }, []);

  // Step back to revise an earlier answer. Answers persist in `data`, and each
  // step re-seeds its local state from its `value` prop, so the previous
  // selection is preserved when the user returns.
  const backward = () => setStepIndex((i) => Math.max(0, i - 1));

  const finish = async (collected) => {
    if (saving) return;
    setSaving(true);

    const fn = collected.first_name || initialFirstName;
    const update = { onboarding_completed: true };
    if (fn) update.first_name = fn;
    if (collected.home_country) update.home_country = collected.home_country;
    // Home city + coordinates + exact timezone (from HomeCityField) so the home
    // clock is accurate worldwide, not just the country default.
    if (collected.home_city) update.home_city = collected.home_city;
    if (collected.home_lat != null) update.home_lat = collected.home_lat;
    if (collected.home_lng != null) update.home_lng = collected.home_lng;
    if (collected.home_timezone) update.home_timezone = collected.home_timezone;
    if (collected.preferred_currency) update.preferred_currency = collected.preferred_currency;
    if (collected.preferred_language) update.preferred_language = collected.preferred_language;
    // TemperatureStep emits a scale ('fahrenheit'|'celsius'); column is ('C'|'F').
    if (collected.preferred_temperature_scale === "fahrenheit") update.temp_unit = "F";
    else if (collected.preferred_temperature_scale === "celsius") update.temp_unit = "C";
    if (collected.distance_unit) update.distance_unit = collected.distance_unit;
    if (collected.travel_frequency) update.travel_frequency = collected.travel_frequency;
    if (collected.travel_purpose?.length) update.travel_purpose = collected.travel_purpose;
    if (collected.traveler_type?.length) update.traveler_type = collected.traveler_type;
    if (collected.frequent_countries?.length) update.frequent_countries = collected.frequent_countries;
    if (collected.next_destination) update.next_destination = collected.next_destination;
    if (collected.travel_budget?.length) update.travel_budget = collected.travel_budget;
    if (collected.accommodation_style?.length) update.accommodation_style = collected.accommodation_style;

    // Infer the values we no longer ASK for (currency / language / temp /
    // distance) from home country + device locale. Only fill gaps — an explicit
    // answer (if a step is ever re-added) always wins. Soft defaults; editable
    // in Settings.
    const inferred = inferProfileDefaults(collected.home_country);
    if (!update.preferred_currency) update.preferred_currency = inferred.currency;
    if (!update.preferred_language) update.preferred_language = inferred.language;
    if (!update.temp_unit) update.temp_unit = inferred.tempUnit;
    if (!update.distance_unit) update.distance_unit = inferred.distanceUnit;

    try {
      if (user?.id) await supabase.from("profiles").update(update).eq("id", user.id);
    } catch (e) {
      // If some value tripped a constraint, still mark completion so the gate
      // passes and the user isn't trapped in onboarding.
      console.warn("Onboarding save partial:", e?.message || e);
      try {
        if (user?.id) {
          await supabase.from("profiles")
            .update({ onboarding_completed: true, ...(fn ? { first_name: fn } : {}) })
            .eq("id", user.id);
        }
      } catch { /* last-resort: ignore */ }
    }

    // Page one = the home-city origin stamp (meaning model: "make your
    // passport"). Best-effort: a failed mint never blocks the account — the
    // passport page can mint it later. verified stays 'self'; origin marks it
    // as the cover page, not an achievement.
    try {
      if (collected.home_city) {
        await addStamp({
          kind: "city", entity_type: "origin", entity_id: `origin:${collected.home_city}`,
          name: collected.home_city, city: collected.home_city,
          country: collected.home_country || undefined,
          cc: countryCode(collected.home_country || "") || undefined,
          lat: collected.home_lat ?? undefined, lng: collected.home_lng ?? undefined,
          visited_on: new Date().toISOString().slice(0, 10),
          verified: "self", origin: true,
        });
      }
    } catch { /* the passport can mint page one later */ }

    try { sessionStorage.setItem("gsk_review_toured", "1"); } catch { /* fine */ } // review account: one tour per launch
    await refreshProfile(); // so Layout's gate sees onboarding_completed = true
    navigate(createPageUrl("Home"));
  };

  // Merge any answer, then advance — or finish on the last step.
  const advance = (partial) => {
    const merged = partial ? { ...data, ...partial } : data;
    if (partial) setData(merged);
    if (stepIndex >= steps.length - 1) finish(merged);
    else setStepIndex((i) => i + 1);
  };

  const key = steps[stepIndex];
  // Back is available on every step except the very first.
  const onBack = stepIndex > 0 ? backward : undefined;
  let content = null;
  switch (key) {
    case "first_name":
      content = <FirstNameStep defaultValue={initialFirstName} onNext={(d) => advance(d)} onBack={onBack} />;
      break;
    case "location":
      content = (
        <LocationStep
          onNext={() => advance()}
          onLocationGranted={() => {}}
          onExit={() => advance()}
          onBack={onBack}
        />
      );
      break;
    case "home_country":
      content = <HomeCountryStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.home_country} />;
      break;
    case "passport":
      content = (
        <PassportStep
          homeCity={data.home_city}
          homeCountry={data.home_country}
          firstName={data.first_name || initialFirstName}
          onNext={() => advance()}
          onBack={onBack}
        />
      );
      break;
    default:
      content = null;
  }

  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <div className="min-h-screen font-sans relative" style={{ background: "#FFFCF7" }}>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div
          className="h-full bg-gradient-to-r from-[#088395] to-[#05BFDB] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {content}
    </div>
  );
}
