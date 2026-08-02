import React from "react";
import { Globe } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";
import HomeCityField from "@/components/home/HomeCityField";

// Home is captured as a CITY (not just a country): the city's coordinates give us
// the EXACT timezone (so a Los-Angeles local sees Pacific, not the US-default
// Eastern) and its country gives the flag. One familiar question, accurate
// worldwide. Picking a city advances immediately (no Continue button).
export default function HomeCountryStep({ onNext, onSkip, onBack }) {
  return (
    <OnboardingStepLayout
      icon={<Globe className="w-8 h-8 text-white" />}
      title="Where's home?"
      subtitle="Your home city becomes page one of your passport — and sets your local time & flag. 🏠"
      onBack={onBack}
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
        onSelect={(place) => onNext({
          home_country: place.country,
          home_city: place.city,
          home_lat: place.latitude,
          home_lng: place.longitude,
          home_timezone: place.timezone,
        })}
      />
    </OnboardingStepLayout>
  );
}
