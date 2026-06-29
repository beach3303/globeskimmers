import React, { useState } from "react";
import { Wallet, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "./OnboardingStepLayout";

const BUDGETS = [
  { value: "budget", label: "Budget-friendly", emoji: "💰" },
  { value: "mid", label: "Mid-range", emoji: "💳" },
  { value: "premium", label: "Premium", emoji: "✨" },
  { value: "luxury", label: "Luxury", emoji: "👑" },
];

export default function TravelBudgetStep({ onNext, onSkip, onBack, value }) {
  const [selected, setSelected] = useState(Array.isArray(value) ? value : []);

  const canContinue = selected.length > 0;

  const toggle = (budgetValue) => {
    setSelected((prev) =>
      prev.includes(budgetValue)
        ? prev.filter((v) => v !== budgetValue)
        : [...prev, budgetValue]
    );
  };

  const handleContinue = () => {
    if (!canContinue) return;
    onNext({ travel_budget: selected });
  };

  return (
    <OnboardingStepLayout
      icon={<Wallet className="w-8 h-8 text-white" />}
      title="What's your travel style?"
      subtitle="Helps us match recommendations — optional."
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
      <div className="space-y-3">
        {BUDGETS.map((budget) => {
          const isSelected = selected.includes(budget.value);
          return (
            <button
              key={budget.value}
              onClick={() => toggle(budget.value)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                isSelected
                  ? "border-[#088395] bg-blue-50"
                  : "border-gray-200 hover:border-[#088395] hover:bg-blue-50"
              }`}
            >
              <span className="text-2xl">{budget.emoji}</span>
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900">{budget.label}</span>
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
