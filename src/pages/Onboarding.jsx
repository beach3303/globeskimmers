import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { extractFirstName } from "@/lib/extractFirstName";
import { inferProfileDefaults } from "@/lib/inferProfileDefaults";

// ONE screen (founder, 2026-11-08: "as simple as possible: email, birthday, handle, and they're in"):
// first name, birthday, @username. Home country, "where did you hear about us", the passport intro and
// the location ask are gone from here — home lives in Settings, location is asked by Nearby when it is
// first needed, the Passport tab is a tap away. The step components stay in the repo for Settings.
import WelcomeStep from "../components/onboarding/WelcomeStep";
import { logEvent } from "@/lib/analytics";

// Account-tied onboarding. The user is ALWAYS authenticated here (App.jsx's
// forced gate guarantees a Supabase session). On the final step we write the
// answers to public.profiles and flip onboarding_completed = true (the
// once-ever flag the Layout gate reads).
//
// FRICTION CUT (2026-07-23): reduced from ~14 screens to the essentials —
//   1. first name (skipped if we already know it from the provider),
//   2. location (also grants the OS location permission early),
//   3. home city (gives country + exact timezone for the home clock).
// The @username and the birthday moved OUT of onboarding on 2026-10-19 (founder: "yes"):
// FinishPassport asks for them the first time something must be saved or shared — after a
// new member has seen their trips become stamps (src/lib/passportGate.js).
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

  const steps = useMemo(() => ["welcome"], []);

  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState({});
  const [saving, setSaving] = useState(false);

  const finish = async (collected) => {
    if (saving) return;
    setSaving(true);

    const fn = collected.first_name || initialFirstName;
    const update = { onboarding_completed: true };
    if (fn) update.first_name = fn;
    if (collected.home_country) update.home_country = collected.home_country;
    if (collected.heard_from) update.heard_from = collected.heard_from;
    // The sign-up event with its source (growth plan, 2026-10-19): the answer, or 'unknown' — never a guess.
    // `passport`: whether the one stamp ask was taken ('now') or skipped ('later'), for the funnel.
    logEvent("signed_up", { source: collected.heard_from || "unknown", passport: collected.passport_skipped ? "later" : "now" }, "Onboarding");
    // Home city + coordinates + exact timezone (from HomeCityField) so the home
    // clock is accurate worldwide, not just the country default.
    if (collected.home_city) update.home_city = collected.home_city;
    if (collected.home_city_country) update.home_city_country = collected.home_city_country;
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
    const inferred = inferProfileDefaults(collected.home_country || profile?.home_country);
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

    // Page one (the home-city origin stamp) is offered by the Passport later, at home — after the
    // required birthday (2026-10-19), never from here.

    try { sessionStorage.setItem("gsk_review_toured", "1"); } catch { /* fine */ } // review account: one tour per launch
    await refreshProfile(); // so Layout's gate sees onboarding_completed = true
    // The passport ask is made once, on its own step (founder, 2026-10-30). Taken → the Passport
    // (Upload photos / Stamp where I am). Skipped → the City Boards, to look around (navigation
    // redesign, 2026-10-31); nothing asks again.
    navigate(createPageUrl(collected.passport_skipped ? "Boards" : "Passport"));
  };

  // Merge any answer, then advance — or finish on the last step.
  const advance = (partial) => {
    const merged = partial ? { ...data, ...partial } : data;
    if (partial) setData(merged);
    if (stepIndex >= steps.length - 1) finish(merged);
    else setStepIndex((i) => i + 1);
    try { window.scrollTo(0, 0); } catch { /* fine */ }   // a step opens at its top, keyboard or not
  };

  const key = steps[stepIndex];
  let content = null;
  switch (key) {
    case "welcome":
      content = <WelcomeStep firstName={initialFirstName} onDone={(d) => advance(d)} />;
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
