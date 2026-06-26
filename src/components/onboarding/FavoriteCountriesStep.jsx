import React, { useState } from "react";
import { Globe, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingStepLayout from "./OnboardingStepLayout";

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
  "England",
  "Scotland",
  "Wales",
  "Northern Ireland",
  "United States",
  "Vietnam",
].sort((a, b) => a.localeCompare(b));

// Search aliases so common shorthands resolve to the canonical label.
const ALIASES = {
  "United States": ["usa", "us", "u.s.", "u.s.a", "u.s.a.", "america", "united states"],
  "United Kingdom": ["uk", "u.k.", "britain", "great britain", "gb"],
};

export default function FavoriteCountriesStep({ onNext, onSkip, onBack, value }) {
  const [selected, setSelected] = useState(Array.isArray(value) ? value : []);
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();

  // Dropdown shows matches that AREN'T already chosen (chosen ones become chips).
  const filteredCountries = COUNTRIES.filter((country) => {
    if (selected.includes(country)) return false;
    if (!q) return true;
    return (
      country.toLowerCase().includes(q) ||
      (ALIASES[country] || []).some((a) => a.includes(q) || q.includes(a))
    );
  });

  // Tap a result → add it AND clear the box so the user can type the next one.
  const addCountry = (country) => {
    setSelected((prev) => (prev.includes(country) ? prev : [...prev, country]));
    setSearchQuery("");
  };
  const removeCountry = (country) =>
    setSelected((prev) => prev.filter((c) => c !== country));

  const canContinue = selected.length > 0;
  const handleContinue = () => {
    if (canContinue) onNext({ frequent_countries: selected });
  };

  return (
    <OnboardingStepLayout
      icon={<Globe className="w-8 h-8 text-white" />}
      title="Any go-to countries?"
      subtitle="Places you visit often — optional."
      onBack={onBack}
      footer={
        <>
          {/* Selected countries as removable chips. Lives in the pinned footer
              so the search dropdown (in the scrollable area above) never covers
              it — tap the ✕ to drop a country you change your mind about. */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 max-h-[88px] overflow-y-auto">
              {selected.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-[#088395]/10 text-[#0A4D68] text-sm font-semibold"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCountry(c)}
                    aria-label={`Remove ${c}`}
                    className="w-4 h-4 rounded-full bg-[#088395]/25 flex items-center justify-center hover:bg-[#088395]/40"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

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
            className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm"
          >
            Maybe later
          </button>
        </>
      }
    >
      <input
        type="text"
        placeholder="Search a country…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 focus:border-[#088395] focus:outline-none text-[15px]"
      />

      {q && (
        <div className="mt-3 border-2 border-gray-200 rounded-xl overflow-hidden">
          {filteredCountries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              No countries match "{searchQuery.trim()}" 🔍
            </p>
          ) : (
            filteredCountries.map((country) => (
              <button
                key={country}
                onClick={() => addCountry(country)}
                className="w-full px-4 py-3 text-left border-b border-gray-200 last:border-b-0 text-gray-800 hover:bg-blue-50 transition-colors font-medium"
              >
                {country}
              </button>
            ))
          )}
        </div>
      )}

      {!q && (
        <p className="mt-4 text-center text-sm text-gray-500">
          {selected.length > 0
            ? "✈️ Type to add another country"
            : "Type a country you visit often, then tap it"}
        </p>
      )}
    </OnboardingStepLayout>
  );
}
