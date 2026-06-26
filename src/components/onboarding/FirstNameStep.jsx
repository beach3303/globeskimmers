import React, { useState } from "react";
import { UserRound, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "./OnboardingStepLayout";

export default function FirstNameStep({ defaultValue, onNext, onBack }) {
  const [value, setValue] = useState(defaultValue || "");

  const canContinue = value.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    onNext({ first_name: value.trim() });
  };

  return (
    <OnboardingStepLayout
      icon={<UserRound className="w-8 h-8 text-white" />}
      title="What should we call you?"
      subtitle="We'll use your first name to make Globeskimmers feel like home. 👋"
      onBack={onBack}
      footer={
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      }
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleContinue();
        }}
        placeholder="First name"
        autoComplete="given-name"
        className="w-full h-12 px-4 mb-6 rounded-xl border-2 border-gray-300 focus:border-[#088395] focus:outline-none text-[15px]"
      />
    </OnboardingStepLayout>
  );
}
