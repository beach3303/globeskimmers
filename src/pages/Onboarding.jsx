import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { extractFirstName } from "@/lib/extractFirstName";
import ReferralSourceStep from "../components/onboarding/ReferralSourceStep";
import LocationStep from "../components/onboarding/LocationStep";
import HomeCountryStep from "../components/onboarding/HomeCountryStep";
import CurrencyStep from "../components/onboarding/CurrencyStep";
import LanguageStep from "../components/onboarding/LanguageStep";
import TemperatureStep from "../components/onboarding/TemperatureStep";

// Account-tied onboarding. The user is ALWAYS authenticated here (App.jsx's
// forced gate guarantees a Supabase session before any route renders), so there
// is no WelcomeStep / login branch anymore — that role moved to AuthGate.
//
// Phase 4 scope: run the existing steps for UX and, on completion, flip
// profiles.onboarding_completed = true (+ best-effort first_name). Persisting
// each typed answer into its profiles column — and the new question set (first
// name, distance unit, travel frequency/purpose/type, optional fields) — lands
// in Phase 5, which rebuilds this flow against the verified column mapping.
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    const firstName = extractFirstName(user);
    const update = { onboarding_completed: true, ...(firstName ? { first_name: firstName } : {}) };
    try {
      if (user?.id) {
        await supabase.from("profiles").update(update).eq("id", user.id);
      }
    } catch (e) {
      console.warn("Onboarding save failed:", e?.message || e);
    }
    await refreshProfile(); // so Layout's gate sees onboarding_completed = true
    navigate(createPageUrl("Home"));
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: "#FFFCF7" }}>
      {currentStep === 1 && (
        <ReferralSourceStep onNext={() => setCurrentStep(2)} />
      )}
      {currentStep === 2 && (
        <LocationStep
          onNext={() => setCurrentStep(3)}
          onLocationGranted={() => setCurrentStep(3)}
          onExit={finish}
        />
      )}
      {currentStep === 3 && (
        <HomeCountryStep onNext={() => setCurrentStep(4)} onSkip={finish} />
      )}
      {currentStep === 4 && (
        <CurrencyStep onNext={() => setCurrentStep(5)} onSkip={finish} />
      )}
      {currentStep === 5 && (
        <LanguageStep onNext={() => setCurrentStep(6)} onSkip={finish} />
      )}
      {currentStep === 6 && (
        <TemperatureStep onNext={finish} onSkip={finish} />
      )}
    </div>
  );
}
