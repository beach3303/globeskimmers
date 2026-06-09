import React, { useState } from "react";
import { Globe, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

// ~45 common country names, alphabetically sorted. Plain strings — the
// selected[] state stores these names verbatim and emits them back via
// onNext({ frequent_countries: [...] }).
const COUNTRIES = [
  "Argentina",
  "Australia",
  "Austria",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Czech Republic",
  "Denmark",
  "Egypt",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hong Kong",
  "India",
  "Indonesia",
  "Ireland",
  "Italy",
  "Japan",
  "Malaysia",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Norway",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Thailand",
  "Turkey",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
].sort((a, b) => a.localeCompare(b));

export default function FavoriteCountriesStep({ onNext, onSkip }) {
  const [selected, setSelected] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Case-insensitive substring filter. Empty query → show everything.
  const filteredCountries = COUNTRIES.filter((country) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return country.toLowerCase().includes(q);
  });

  const toggle = (country) => {
    setSelected((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country]
    );
  };

  const canContinue = selected.length > 0;

  const handleContinue = () => {
    if (canContinue) {
      onNext({ frequent_countries: selected });
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
          Any go-to countries?
        </h2>

        <p className="text-gray-600 mb-8 text-center">
          Places you visit often — optional.
        </p>

        <input
          type="text"
          placeholder="Search countries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 px-4 mb-4 rounded-xl border-2 border-gray-300 focus:border-[#088395] focus:outline-none text-[15px]"
        />

        <div className="max-h-72 overflow-y-auto mb-4 border-2 border-gray-200 rounded-xl">
          {filteredCountries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              No countries match "{searchQuery.trim()}" 🔍
            </p>
          ) : (
            filteredCountries.map((country) => {
              const isSelected = selected.includes(country);
              return (
                <button
                  key={country}
                  onClick={() => toggle(country)}
                  className={`w-full px-4 py-3 text-left border-b border-gray-200 last:border-b-0 transition-colors flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-[#088395] text-white"
                      : "text-gray-800 hover:bg-blue-50"
                  }`}
                >
                  <span className="font-medium">{country}</span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <p className="text-sm text-gray-500 mb-4 text-center">
          {selected.length > 0
            ? `✈️ ${selected.length} ${
                selected.length === 1 ? "country" : "countries"
              } selected`
            : "Tap the countries you travel to most"}
        </p>

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
