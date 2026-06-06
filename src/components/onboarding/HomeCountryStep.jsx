import React, { useState } from "react";
import { Globe, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

// Each entry has a canonical `name` (what gets stored as the user's
// home_country) and optional `aliases` that the search box ALSO matches.
// Lets a user typing "USA" find "United States", "UK" find "United
// Kingdom", "UAE" find "United Arab Emirates", etc. Without aliases the
// filter only matched substring of the canonical name, so common short
// forms came up empty (the reported bug).
const COUNTRIES = [
  { name: "Afghanistan" },
  { name: "Albania" },
  { name: "Algeria" },
  { name: "Argentina" },
  { name: "Australia" },
  { name: "Austria" },
  { name: "Bangladesh" },
  { name: "Belgium" },
  { name: "Brazil" },
  { name: "Bulgaria" },
  { name: "Canada" },
  { name: "Chile" },
  { name: "China" },
  { name: "Colombia" },
  { name: "Czech Republic", aliases: ["Czechia"] },
  { name: "Denmark" },
  { name: "Egypt" },
  { name: "Finland" },
  { name: "France" },
  { name: "Germany" },
  { name: "Greece" },
  { name: "Hong Kong", aliases: ["HK"] },
  { name: "Hungary" },
  { name: "Iceland" },
  { name: "India" },
  { name: "Indonesia" },
  { name: "Ireland" },
  { name: "Israel" },
  { name: "Italy" },
  { name: "Japan" },
  { name: "Kenya" },
  { name: "Malaysia" },
  { name: "Mexico" },
  { name: "Morocco" },
  { name: "Netherlands", aliases: ["Holland"] },
  { name: "New Zealand", aliases: ["NZ"] },
  { name: "Nigeria" },
  { name: "Norway" },
  { name: "Pakistan" },
  { name: "Peru" },
  { name: "Philippines", aliases: ["PH"] },
  { name: "Poland" },
  { name: "Portugal" },
  { name: "Romania" },
  { name: "Russia", aliases: ["Russian Federation"] },
  { name: "Saudi Arabia", aliases: ["KSA"] },
  { name: "Singapore" },
  { name: "South Africa" },
  { name: "South Korea", aliases: ["Korea", "ROK"] },
  { name: "Spain" },
  { name: "Sweden" },
  { name: "Switzerland" },
  { name: "Taiwan" },
  { name: "Thailand" },
  { name: "Turkey", aliases: ["Türkiye"] },
  { name: "United Arab Emirates", aliases: ["UAE"] },
  { name: "United Kingdom", aliases: ["UK", "Britain", "Great Britain", "England"] },
  { name: "United States", aliases: ["USA", "US", "America"] },
  { name: "Vietnam", aliases: ["Viet Nam"] },
].sort((a, b) => a.name.localeCompare(b.name));

export default function HomeCountryStep({ onNext, onSkip }) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Match against canonical name OR any alias. Substring match (not
  // startsWith) so "states" still finds "United States", "ited king"
  // still finds "United Kingdom", etc. Empty query → all countries.
  const filteredCountries = COUNTRIES.filter(country => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (country.name.toLowerCase().includes(q)) return true;
    if (country.aliases?.some(a => a.toLowerCase().includes(q))) return true;
    return false;
  });

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
              key={country.name}
              onClick={() => {
                // Tapping a result both confirms the selection AND fills the
                // input box so the user sees their choice land in the textbox.
                // Mirrors how iOS / Android system pickers work; without the
                // searchQuery setter the input still shows "USA" or whatever
                // partial text the user typed and the selection looks
                // invisible (the reported bug).
                //
                // We deliberately store the CANONICAL name (United States)
                // even when the user typed an alias (USA) — that's what gets
                // saved as home_country and that's what other surfaces show.
                setSelectedCountry(country.name);
                setSearchQuery(country.name);
              }}
              className={`w-full px-4 py-3 text-left border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                selectedCountry === country.name
                  ? 'bg-[#088395] text-white hover:bg-[#088395]'
                  : 'text-gray-800'
              }`}
            >
              {country.name}
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