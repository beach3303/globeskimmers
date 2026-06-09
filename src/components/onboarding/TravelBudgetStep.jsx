import React, { useState } from "react";
import { Wallet, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const BUDGETS = [
  { value: "budget", label: "Budget-friendly", emoji: "💰" },
  { value: "mid", label: "Mid-range", emoji: "💳" },
  { value: "premium", label: "Premium", emoji: "✨" },
  { value: "luxury", label: "Luxury", emoji: "👑" },
];

export default function TravelBudgetStep({ onNext, onSkip }) {
  const [selected, setSelected] = useState("");

  const canContinue = !!selected;

  const handleContinue = () => {
    if (!canContinue) return;
    onNext({ travel_budget: selected });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
          <Wallet className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          What's your travel style?
        </h2>

        <p className="text-gray-600 mb-8 text-center">
          Helps us match recommendations — optional.
        </p>

        <div className="space-y-3 mb-6">
          {BUDGETS.map((budget) => (
            <button
              key={budget.value}
              onClick={() => setSelected(budget.value)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                selected === budget.value
                  ? "border-[#088395] bg-blue-50"
                  : "border-gray-200 hover:border-[#088395] hover:bg-blue-50"
              }`}
            >
              <span className="text-2xl">{budget.emoji}</span>
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900">{budget.label}</span>
              </div>
            </button>
          ))}
        </div>

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
          className="w-full mt-4 text-gray-500 hover:text-gray-700 text-sm"
        >
          Maybe later
        </button>
      </div>
    </motion.div>
  );
}
