import React, { useState } from "react";
import { Thermometer, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const SCALES = [
  {
    value: "fahrenheit",
    name: "Fahrenheit",
    symbol: "°F",
    description: "Used in USA, some Caribbean countries",
    example: "72°F is room temperature"
  },
  {
    value: "celsius",
    name: "Celsius",
    symbol: "°C",
    description: "Used in most countries worldwide",
    example: "22°C is room temperature"
  }
];

export default function TemperatureStep({ onNext, onSkip }) {
  const [selectedScale, setSelectedScale] = useState("");

  const handleContinue = () => {
    if (selectedScale) {
      onNext({ preferred_temperature_scale: selectedScale });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
          <Thermometer className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          Temperature Scale
        </h2>
        
        <p className="text-gray-600 mb-8 text-center">
          Choose how you want to see temperatures
        </p>

        <div className="space-y-4 mb-6">
          {SCALES.map((scale) => (
            <button
              key={scale.value}
              onClick={() => setSelectedScale(scale.value)}
              className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                selectedScale === scale.value
                  ? 'border-[#088395] bg-blue-50'
                  : 'border-gray-200 hover:border-[#088395] hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold ${
                    selectedScale === scale.value
                      ? 'bg-[#088395] text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {scale.symbol}
                  </div>
                  <div>
                    <div className="font-bold text-lg text-gray-900">
                      {scale.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {scale.description}
                    </div>
                  </div>
                </div>
                {selectedScale === scale.value && (
                  <div className="w-6 h-6 bg-[#088395] rounded-full flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 ml-15">
                {scale.example}
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={handleContinue}
          disabled={!selectedScale}
          className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>

        <button
          onClick={() => onSkip()}
          className="w-full mt-4 text-gray-500 hover:text-gray-700 text-sm"
        >
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}