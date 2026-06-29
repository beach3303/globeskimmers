import React, { useState } from "react";
import { BedDouble, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "./OnboardingStepLayout";

const OPTIONS = [
  { value: "hotel", label: "Hotels", emoji: "🏨" },
  { value: "hostel", label: "Hostels", emoji: "🛏️" },
  { value: "airbnb", label: "Vacation rentals", emoji: "🏠" },
  { value: "resort", label: "Resorts", emoji: "🏝️" },
  { value: "boutique", label: "Boutique stays", emoji: "🏛️" },
  { value: "camping", label: "Camping", emoji: "⛺" },
  { value: "family_friends", label: "Family & friends", emoji: "👪" },
];

export default function AccommodationStyleStep({ onNext, onSkip, onBack, value }) {
  const [selected, setSelected] = useState(Array.isArray(value) ? value : []);

  const toggle = (value) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const canContinue = selected.length > 0;

  const handleContinue = () => {
    onNext({ accommodation_style: selected });
  };

  return (
    <OnboardingStepLayout
      icon={<BedDouble className="w-8 h-8 text-white" />}
      title="Where do you like to stay?"
      subtitle="Pick all that apply — optional."
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
            className="w-full mt-5 text-gray-500 hover:text-gray-700 text-sm"
          >
            Skip
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {OPTIONS.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => toggle(option.value)}
              className={`relative w-full p-4 rounded-xl transition-all text-left flex items-center gap-3 ${
                isSelected
                  ? "bg-gradient-to-br from-[#088395] to-[#05BFDB] text-white border-transparent"
                  : "bg-white border-2 border-gray-200 hover:border-[#088395] hover:bg-blue-50"
              }`}
            >
              <span className="text-2xl">{option.emoji}</span>
              <div className="flex flex-col">
                <span
                  className={`font-semibold ${
                    isSelected ? "text-white" : "text-gray-900"
                  }`}
                >
                  {option.label}
                </span>
              </div>
              {isSelected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/25 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {canContinue && (
        <p className="text-sm text-gray-500 mb-4 text-center">
          {selected.length} selected
        </p>
      )}
    </OnboardingStepLayout>
  );
}
