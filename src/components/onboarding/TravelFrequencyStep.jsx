import React, { useState } from "react";
import { Plane, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const OPTIONS = [
  { value: "1_2", label: "1–2 trips a year", emoji: "✈️" },
  { value: "3_5", label: "3–5 trips a year", emoji: "🛫" },
  { value: "6_10", label: "6–10 trips a year", emoji: "🌍" },
  { value: "10_plus", label: "10+ trips a year", emoji: "🧳" },
  { value: "on_the_road", label: "I basically live on the road", emoji: "🗺️" }
];

export default function TravelFrequencyStep({ onNext }) {
  const [selected, setSelected] = useState("");

  const canContinue = !!selected;

  const handleContinue = () => {
    if (!canContinue) return;
    onNext({ travel_frequency: selected });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
          <Plane className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          How often do you travel?
        </h2>

        <p className="text-gray-600 mb-8 text-center">
          So we can tailor tips to your rhythm.
        </p>

        <div className="space-y-3 mb-6">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelected(option.value)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                selected === option.value
                  ? "border-[#088395] bg-blue-50"
                  : "border-gray-200 hover:border-[#088395] hover:bg-blue-50"
              }`}
            >
              <span className="text-2xl">{option.emoji}</span>
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900">{option.label}</span>
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
      </div>
    </motion.div>
  );
}
