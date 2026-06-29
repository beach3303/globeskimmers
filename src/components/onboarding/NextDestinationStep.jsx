import React, { useState } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "./OnboardingStepLayout";

export default function NextDestinationStep({ onNext, onSkip, onBack, value }) {
  const [inputValue, setInputValue] = useState(value || "");

  const canContinue = inputValue.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    onNext({ next_destination: inputValue.trim() });
  };

  return (
    <OnboardingStepLayout
      icon={<MapPin className="w-8 h-8 text-white" />}
      title="Where to next?"
      subtitle="Got a trip coming up? (optional)"
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
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canContinue) handleContinue();
        }}
        placeholder="e.g. Tokyo, Japan"
        className="w-full h-12 px-4 mb-2 rounded-xl border-2 border-gray-300 focus:border-[#088395] focus:outline-none text-[15px]"
      />
      {/* Subtle skip right under the field — no upcoming trip, just browsing.
          Tapping skips the step (same as the footer button below). */}
      <button
        type="button"
        onClick={() => onSkip()}
        className="w-full mb-6 text-left text-[13px] leading-snug text-gray-400 hover:text-gray-600"
      >
        None at this time — I’d like to search and browse features anyway.
      </button>
    </OnboardingStepLayout>
  );
}
