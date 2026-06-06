import React, { useState } from "react";
import { Globe, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria",
  "Bangladesh", "Belgium", "Brazil", "Bulgaria", "Canada", "Chile", "China",
  "Colombia", "Czech Republic", "Denmark", "Egypt", "Finland", "France",
  "Germany", "Greece", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia",
  "Ireland", "Israel", "Italy", "Japan", "Kenya", "South Korea", "Malaysia",
  "Mexico", "Morocco", "Netherlands", "New Zealand", "Nigeria", "Norway",
  "Pakistan", "Peru", "Philippines", "Poland", "Portugal", "Romania", "Russia",
  "Saudi Arabia", "Singapore", "South Africa", "Spain", "Sweden", "Switzerland",
  "Taiwan", "Thailand", "Turkey", "UAE", "United Kingdom", "United States",
  "Vietnam"
].sort();

export default function HomeCountryStep({ onNext, onSkip }) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCountries = COUNTRIES.filter(country =>
    country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContinue = () => {
    if (selectedCountry) {
      onNext({ home_country: selectedCountry });
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
          <Globe className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          Where are you from?
        </h2>
        
        <p className="text-gray-600 mb-8 text-center">
          Select your home country to personalize your experience
        </p>

        <input
          type="text"
          placeholder="Search for your country..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 mb-4 border-2 border-gray-300 rounded-xl focus:border-[#088395] focus:outline-none"
        />

        <div className="max-h-96 overflow-y-auto mb-6 border-2 border-gray-200 rounded-xl">
          {filteredCountries.map((country) => (
            <button
              key={country}
              onClick={() => {
                // Tapping a result both confirms the selection AND fills the
                // input box so the user sees their choice land in the textbox.
                // Mirrors how iOS / Android system pickers work; without the
                // searchQuery setter the input still shows "Unit" or whatever
                // partial text the user typed and the selection looks
                // invisible (the reported bug).
                setSelectedCountry(country);
                setSearchQuery(country);
              }}
              className={`w-full px-4 py-3 text-left border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                selectedCountry === country
                  ? 'bg-[#088395] text-white hover:bg-[#088395]'
                  : 'text-gray-800'
              }`}
            >
              {country}
            </button>
          ))}
        </div>

        <Button
          onClick={handleContinue}
          disabled={!selectedCountry}
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