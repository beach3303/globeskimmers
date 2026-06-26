import React, { useState } from "react";
import { Globe } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";

// Each entry has a canonical `name` (what gets stored as the user's
// home_country) and optional `aliases` that the search box ALSO matches.
// Lets a user typing "USA" find "United States", "UK" find "United
// Kingdom", "UAE" find "United Arab Emirates", etc. Without aliases the
// filter only matched substring of the canonical name, so common short
// forms came up empty (the reported bug).
const ALL_COUNTRIES = [
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
  { name: "United Kingdom", aliases: ["UK", "Britain", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"] },
  { name: "United States", aliases: ["USA", "US", "America"] },
  { name: "Vietnam", aliases: ["Viet Nam"] },
].sort((a, b) => a.name.localeCompare(b.name));

// Pin the United States to the very top, then the rest alphabetically.
const COUNTRIES = [
  ...ALL_COUNTRIES.filter((c) => c.name === "United States"),
  ...ALL_COUNTRIES.filter((c) => c.name !== "United States"),
];

// Single-select → tapping a country advances immediately (no Continue).
export default function HomeCountryStep({ onNext, onSkip, onBack }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Match against canonical name OR any alias. Substring match (not
  // startsWith) so "states" still finds "United States", etc. The pinned
  // order (US first) is preserved because filter keeps array order.
  const filteredCountries = COUNTRIES.filter((country) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (country.name.toLowerCase().includes(q)) return true;
    if (country.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
    return false;
  });

  return (
    <OnboardingStepLayout
      icon={<Globe className="w-8 h-8 text-white" />}
      title="Where are you from?"
      subtitle="Select your home country to personalize your experience"
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
            onClick={() => onNext({ home_country: country.name })}
            className="w-full px-4 py-3 text-left border-b border-gray-200 hover:bg-blue-50 transition-colors text-gray-800"
          >
            {country.name}
          </button>
        ))}
        {filteredCountries.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500">
            No countries match &quot;{searchQuery}&quot; 🔍
          </div>
        )}
      </div>
    </OnboardingStepLayout>
  );
}
