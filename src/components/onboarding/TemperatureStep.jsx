import React from "react";
import { Thermometer, ChevronRight } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";

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

// Single-select → tapping a card advances immediately (no Continue).
export default function TemperatureStep({ onNext, onSkip, onBack }) {
  return (
    <OnboardingStepLayout
      icon={<Thermometer className="w-8 h-8 text-white" />}
      title="Temperature Scale"
      subtitle="Choose how you want to see temperatures"
      onBack={onBack}
      footer={
        <button
          onClick={() => onSkip()}
          className="w-full text-gray-500 hover:text-gray-700 text-sm"
        >
          Skip for now
        </button>
      }
    >
      <div className="space-y-3">
        {SCALES.map((scale) => (
          <button
            key={scale.value}
            onClick={() => onNext({ preferred_temperature_scale: scale.value })}
            className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-[#088395] hover:bg-blue-50 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl font-bold bg-gray-100 text-gray-600">
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
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </OnboardingStepLayout>
  );
}
