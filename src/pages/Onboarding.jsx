import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { AdMob } from "@capacitor-community/admob";
import { createPageUrl } from "@/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { extractFirstName } from "@/lib/extractFirstName";

// Existing (reused) steps
import LocationStep from "../components/onboarding/LocationStep";
import HomeCountryStep from "../components/onboarding/HomeCountryStep";
import CurrencyStep from "../components/onboarding/CurrencyStep";
import LanguageStep from "../components/onboarding/LanguageStep";
import TemperatureStep from "../components/onboarding/TemperatureStep";
// New steps (Phase 5)
import FirstNameStep from "../components/onboarding/FirstNameStep";
import DistanceUnitStep from "../components/onboarding/DistanceUnitStep";
import TravelFrequencyStep from "../components/onboarding/TravelFrequencyStep";
import TravelPurposeStep from "../components/onboarding/TravelPurposeStep";
import TravelerTypeStep from "../components/onboarding/TravelerTypeStep";
import FavoriteCountriesStep from "../components/onboarding/FavoriteCountriesStep";
import NextDestinationStep from "../components/onboarding/NextDestinationStep";
import TravelBudgetStep from "../components/onboarding/TravelBudgetStep";
import AccommodationStyleStep from "../components/onboarding/AccommodationStyleStep";

// Account-tied onboarding. The user is ALWAYS authenticated here (App.jsx's
// forced gate guarantees a Supabase session). Steps collect answers; on the
// final step we write them all to public.profiles and flip
// onboarding_completed = true (the once-ever flag the Layout gate reads).
//
// Required: first name (only if we don't already have one), location, home
// country, currency, language, temperature, distance unit, travel frequency,
// travel purpose, traveler type. Optional: favorite countries, next
// destination, travel budget, accommodation style.
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
    list.push(
      "location", "home_country", "currency", "language", "temperature",
      "distance", "frequency", "purpose", "traveler",      // required
      "favorites", "next_destination", "budget", "accommodation" // optional
    );
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
    case "currency":
      content = <CurrencyStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.preferred_currency} />;
      break;
    case "language":
      content = <LanguageStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.preferred_language} />;
      break;
    case "temperature":
      content = <TemperatureStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.preferred_temperature_scale} />;
      break;
    case "distance":
      content = <DistanceUnitStep onNext={(d) => advance(d)} onBack={onBack} value={data.distance_unit} />;
      break;
    case "frequency":
      content = <TravelFrequencyStep onNext={(d) => advance(d)} onBack={onBack} value={data.travel_frequency} />;
      break;
    case "purpose":
      content = <TravelPurposeStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.travel_purpose} />;
      break;
    case "traveler":
      content = <TravelerTypeStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.traveler_type} />;
      break;
    case "favorites":
      content = <FavoriteCountriesStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.frequent_countries} />;
      break;
    case "next_destination":
      content = <NextDestinationStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.next_destination} />;
      break;
    case "budget":
      content = <TravelBudgetStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.travel_budget} />;
      break;
    case "accommodation":
      content = <AccommodationStyleStep onNext={(d) => advance(d)} onSkip={() => advance()} onBack={onBack} value={data.accommodation_style} />;
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
