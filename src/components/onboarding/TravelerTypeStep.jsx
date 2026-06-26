import React, { useState } from "react";
import { Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "./OnboardingStepLayout";

const OPTIONS = [
  { value: "solo", label: "Solo", emoji: "🧍" },
  { value: "partner", label: "With a partner", emoji: "💑" },
  { value: "family", label: "With family", emoji: "👨‍👩‍👧‍👦" },
  { value: "group", label: "With friends / a group", emoji: "👥" },
  { value: "varies", label: "It varies", emoji: "🔀" },
];

export default function TravelerTypeStep({ onNext, onSkip, onBack, value }) {
  const [selected, setSelected] = useState(Array.isArray(value) ? value : []);

  const canContinue = selected.length > 0;

  const toggleOption = (optionValue) => {
    setSelected((prev) =>
      prev.includes(optionValue)
        ? prev.filter((v) => v !== optionValue)
        : [...prev, optionValue]
    );
  };

  const handleContinue = () => {
    onNext({ traveler_type: selected });
  };

  return (
    <OnboardingStepLayout
      icon={<Users className="w-8 h-8 text-white" />}
      title="How do you like to travel?"
      subtitle="We'll keep suggestions relevant."
      onBack={onBack}
      footer={
        <>
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold disabled:opacity-50"
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
          <button
            onClick={() => onSkip()}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm"
          >
            Skip for now
          </button>
        </>
      }
    >
      <div className="space-y-3 mb-6">
        {OPTIONS.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => toggleOption(option.value)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                isSelected
                  ? "border-[#088395] bg-blue-50"
                  : "border-gray-200 hover:border-[#088395] hover:bg-blue-50"
              }`}
            >
              <span className="text-2xl">{option.emoji}</span>
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900">{option.label}</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-gray-500 mt-4 text-center">
        {selected.length > 0 ? `${selected.length} selected` : "Tap all that apply"}
      </p>
    </OnboardingStepLayout>
  );
}
