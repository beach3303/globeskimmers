import React, { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";
import HomeCityField from "@/components/home/HomeCityField";

// Home is captured as a CITY (not just a country): the city's coordinates give us
// the EXACT timezone (so a Los-Angeles local sees Pacific, not the US-default
// Eastern) and its country gives the flag. One familiar question, accurate
// worldwide. Picking a city advances immediately (no Continue button).
// A country on its own is an answer too (2026-10-30): the flag and the country's default
// zone; the city can follow in Settings.
//
// While the keyboard is up (the visual viewport well under the screen's height, or the
// field just took focus on a phone) the step folds its icon and subtitle away so the
// choices under the field stay in view — the founder's Android test (2026-10-30) saw them
// hidden under the keyboard.
export default function HomeCountryStep({ onNext, onSkip, onBack }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    const check = () => {
      const h = vv?.height || window.innerHeight;
      const full = window.screen?.height || window.innerHeight;
      if (h < full * 0.7) setCompact(true);
    };
    vv?.addEventListener("resize", check);
    window.addEventListener("resize", check);
    return () => { vv?.removeEventListener("resize", check); window.removeEventListener("resize", check); };
  }, []);
  const onFocusChange = (focused) => {
    // A phone's keyboard follows focus; the resize listener confirms it, this makes it immediate.
    if (focused && window.matchMedia?.("(max-width: 640px)").matches) setCompact(true);
  };

  return (
    <OnboardingStepLayout
      icon={<Globe className="w-8 h-8 text-white" />}
      title="Where's home?"
      subtitle="Sets your accurate local time and your home flag. 🏠"
      onBack={onBack}
      compact={compact}
      footer={
        <button
          onClick={() => onSkip()}
          className="w-full text-gray-500 hover:text-gray-700 text-sm"
        >
          Skip for now
        </button>
      }
    >
      <HomeCityField
        autoFocus
        onFocusChange={onFocusChange}
        onSelect={(place) => onNext(place.countryOnly
          ? { home_country: place.country, ...(place.timezone ? { home_timezone: place.timezone } : {}) }
          : {
            home_country: place.country,
            home_city_country: place.country,
            home_city: place.city,
            home_lat: place.latitude,
            home_lng: place.longitude,
            home_timezone: place.timezone,
          })}
      />
    </OnboardingStepLayout>
  );
}
