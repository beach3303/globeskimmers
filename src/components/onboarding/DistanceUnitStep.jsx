import React from "react";
import { Ruler, ChevronRight } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";

const UNITS = [
  {
    value: "mi",
    label: "Miles",
    emoji: "📏",
    description: "Used in the US & UK"
  },
  {
    value: "km",
    label: "Kilometers",
    emoji: "📐",
    description: "Used most other places"
  }
];

// Single-select → tapping a card advances immediately (no Continue).
export default function DistanceUnitStep({ onNext, onBack }) {
  return (
    <OnboardingStepLayout
      icon={<Ruler className="w-8 h-8 text-white" />}
      title="Miles or kilometers?"
      subtitle="How should we show distances to nearby places?"
      onBack={onBack}
    >
      <div className="space-y-3">
        {UNITS.map((unit) => (
          <button
            key={unit.value}
            onClick={() => onNext({ distance_unit: unit.value })}
            className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-[#088395] hover:bg-blue-50 transition-all text-left flex items-center gap-3"
          >
            <span className="text-2xl">{unit.emoji}</span>
            <div className="flex flex-col flex-1">
              <span className="font-semibold text-gray-900">{unit.label}</span>
              <span className="text-sm text-gray-500">{unit.description}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </OnboardingStepLayout>
  );
}
