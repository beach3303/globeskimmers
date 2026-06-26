import React from "react";
import { Plane, ChevronRight } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";

const OPTIONS = [
  { value: "1_2", label: "1–2 trips a year", emoji: "✈️" },
  { value: "3_5", label: "3–5 trips a year", emoji: "🛫" },
  { value: "6_10", label: "6–10 trips a year", emoji: "🌍" },
  { value: "10_plus", label: "10+ trips a year", emoji: "🧳" },
  { value: "on_the_road", label: "I basically live on the road", emoji: "🗺️" },
  { value: "not_now", label: "Not traveling now — I'll use the features anyway", emoji: "🧭" }
];

// Single-select → tapping a card advances immediately (no Continue).
export default function TravelFrequencyStep({ onNext, onBack }) {
  return (
    <OnboardingStepLayout
      icon={<Plane className="w-8 h-8 text-white" />}
      title="How often do you travel?"
      subtitle="So we can tailor tips to your rhythm."
      onBack={onBack}
    >
      <div className="space-y-3 mb-6">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onNext({ travel_frequency: option.value })}
            className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-[#088395] hover:bg-blue-50 transition-all text-left flex items-center gap-3"
          >
            <span className="text-2xl flex-shrink-0">{option.emoji}</span>
            <span className="font-semibold text-gray-900 flex-1">{option.label}</span>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </OnboardingStepLayout>
  );
}
