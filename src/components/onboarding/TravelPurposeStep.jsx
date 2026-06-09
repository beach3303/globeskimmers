import React, { useState } from "react";
import { Compass, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const OPTIONS = [
  { value: "leisure", label: "Leisure", emoji: "🏖️" },
  { value: "business", label: "Business", emoji: "💼" },
  { value: "family_visit", label: "Family & friends", emoji: "👨‍👩‍👧" },
  { value: "adventure", label: "Adventure", emoji: "🥾" },
  { value: "culture", label: "Culture & history", emoji: "🏛️" },
  { value: "food", label: "Food & dining", emoji: "🍜" },
  { value: "events", label: "Events & nightlife", emoji: "🎫" },
  { value: "wellness", label: "Wellness", emoji: "🧘" },
  { value: "prefer_not_to_say", label: "Prefer not to say", emoji: "🤐" },
];

export default function TravelPurposeStep({ onNext }) {
  const [selected, setSelected] = useState([]);

  const toggle = (value) => {
    if (value === "prefer_not_to_say") {
      // Selecting the opt-out clears everything else (mutually exclusive).
      setSelected((prev) =>
        prev.includes("prefer_not_to_say") ? [] : ["prefer_not_to_say"]
      );
      return;
    }
    setSelected((prev) => {
      // Any real selection removes the opt-out.
      const without = prev.filter((v) => v !== "prefer_not_to_say");
      return without.includes(value)
        ? without.filter((v) => v !== value)
        : [...without, value];
    });
  };

  const canContinue = selected.length > 0;

  const handleContinue = () => {
    onNext({ travel_purpose: selected });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
          <Compass className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          What do you travel for?
        </h2>

        <p className="text-gray-600 mb-8 text-center">
          Pick all that apply.
        </p>

        <div className="grid grid-cols-2 gap-2.5 mb-6">
          {OPTIONS.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => toggle(option.value)}
                className={`relative p-4 rounded-xl transition-all text-left flex items-center gap-3 ${
                  isSelected
                    ? "bg-gradient-to-br from-[#088395] to-[#05BFDB] text-white border-transparent"
                    : "bg-white border-2 border-gray-200 hover:border-[#088395] hover:bg-blue-50"
                }`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span
                  className={`font-semibold ${
                    isSelected ? "text-white" : "text-gray-900"
                  }`}
                >
                  {option.label}
                </span>
                {isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/25 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-gray-500 mb-6 text-center">
          {selected.length > 0
            ? `${selected.length} selected`
            : "Tap to choose ✨"}
        </p>

        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}
