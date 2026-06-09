import React, { useState } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function NextDestinationStep({ onNext, onSkip }) {
  const [value, setValue] = useState("");

  const canContinue = value.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    onNext({ next_destination: value.trim() });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
          <MapPin className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          Where to next?
        </h2>

        <p className="text-gray-600 mb-8 text-center">
          Got a trip coming up? (optional)
        </p>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canContinue) handleContinue();
          }}
          placeholder="e.g. Tokyo, Japan"
          className="w-full h-12 px-4 mb-6 rounded-xl border-2 border-gray-300 focus:border-[#088395] focus:outline-none text-[15px]"
        />

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
