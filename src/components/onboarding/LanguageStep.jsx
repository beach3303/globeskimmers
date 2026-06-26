import React, { useState } from "react";
import { Languages } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";

// Language list — no country flags. The "flag for English" question
// (American? British? Australian? Indian?) doesn't have a clean answer,
// and the same problem hits Spanish (21 countries), Arabic (22),
// Portuguese (Brazil vs Portugal), Chinese (mainland vs Taiwan), etc.
// Industry standard for language pickers (Google, Apple, Notion,
// Linear, Spotify): show the language name + its native script, no
// flags. Cleaner, more universal, and avoids cultural/political baggage.
//
// `native` shows the language's name in its own script next to the
// English label — gives a visual cue that helps native speakers find
// their language even if they don't read English well.
//
// Regional variants only kept where they actually DIFFER meaningfully
// for travelers:
//   - Chinese: Simplified (mainland) vs Traditional (Taiwan/HK/Macau)
//     have different writing systems
//   - Portuguese: Brazilian and European have notably different vocab
//     and grammar
// Spanish stays as ONE entry — the regional UI differences (Mexican vs
// Colombian vs Castilian) are minor enough that they don't justify
// fragmenting the picker until you have actual per-region translations.
const LANGUAGES = [
  // English first — overwhelmingly the most common starting point for
  // app onboarding and the lingua franca for travelers.
  { code: "en",    name: "English",                 native: null },

  // Then alphabetical by English name for predictable scanning.
  { code: "ar",    name: "Arabic",                  native: "العربية" },
  { code: "bn",    name: "Bengali",                 native: "বাংলা" },
  { code: "zh-CN", name: "Chinese — Simplified",    native: "简体中文" },
  { code: "zh-TW", name: "Chinese — Traditional",   native: "繁體中文" },
  { code: "cs",    name: "Czech",                   native: "Čeština" },
  { code: "da",    name: "Danish",                  native: "Dansk" },
  { code: "nl",    name: "Dutch",                   native: "Nederlands" },
  { code: "fi",    name: "Finnish",                 native: "Suomi" },
  { code: "fr",    name: "French",                  native: "Français" },
  { code: "de",    name: "German",                  native: "Deutsch" },
  { code: "el",    name: "Greek",                   native: "Ελληνικά" },
  { code: "he",    name: "Hebrew",                  native: "עברית" },
  { code: "hi",    name: "Hindi",                   native: "हिन्दी" },
  { code: "hu",    name: "Hungarian",               native: "Magyar" },
  { code: "id",    name: "Indonesian",              native: "Bahasa Indonesia" },
  { code: "it",    name: "Italian",                 native: "Italiano" },
  { code: "ja",    name: "Japanese",                native: "日本語" },
  { code: "ko",    name: "Korean",                  native: "한국어" },
  { code: "ms",    name: "Malay",                   native: "Bahasa Melayu" },
  { code: "no",    name: "Norwegian",               native: "Norsk" },
  { code: "fa",    name: "Persian (Farsi)",         native: "فارسی" },
  { code: "pl",    name: "Polish",                  native: "Polski" },
  { code: "pt-BR", name: "Portuguese — Brazilian",  native: "Português" },
  { code: "pt-PT", name: "Portuguese — European",   native: "Português" },
  { code: "ro",    name: "Romanian",                native: "Română" },
  { code: "ru",    name: "Russian",                 native: "Русский" },
  { code: "es",    name: "Spanish",                 native: "Español" },
  { code: "sv",    name: "Swedish",                 native: "Svenska" },
  { code: "tl",    name: "Tagalog (Filipino)",      native: "Tagalog" },
  { code: "ta",    name: "Tamil",                   native: "தமிழ்" },
  { code: "th",    name: "Thai",                    native: "ไทย" },
  { code: "tr",    name: "Turkish",                 native: "Türkçe" },
  { code: "uk",    name: "Ukrainian",               native: "Українська" },
  { code: "ur",    name: "Urdu",                    native: "اردو" },
  { code: "vi",    name: "Vietnamese",              native: "Tiếng Việt" },
];

// Single-select → tapping a language advances immediately (no Continue).
export default function LanguageStep({ onNext, onSkip, onBack }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLanguages = LANGUAGES.filter((language) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (language.name.toLowerCase().includes(q)) return true;
    if (language.native && language.native.toLowerCase().includes(q)) return true;
    return false;
  });

  return (
    <OnboardingStepLayout
      icon={<Languages className="w-8 h-8 text-white" />}
      title="Preferred Language"
      subtitle="Choose your preferred language for the app"
      onBack={onBack}
      footer={
        <button
          onClick={() => onSkip()}
          className="w-full text-gray-500 hover:text-gray-700 text-[12px]"
        >
          Skip for now
        </button>
      }
    >
      <input
        type="text"
        placeholder="Search for a language..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-3 mb-4 border-2 border-gray-300 rounded-xl focus:border-[#088395] focus:outline-none"
      />

      {/* Scrollable list. max-h sized to leave room for the search box +
          Skip footer on a Galaxy S10 (~640pt viewport). */}
      <div className="max-h-[52vh] overflow-y-auto border-2 border-gray-200 rounded-xl">
        {filteredLanguages.map((language) => (
          <button
            key={language.code}
            onClick={() => onNext({ preferred_language: language.code })}
            className="w-full px-4 py-2.5 text-left border-b border-gray-200 last:border-b-0 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 text-gray-800"
          >
            <span className="font-semibold text-[14px]">{language.name}</span>
            {language.native && (
              <span className="text-[13px] text-gray-500">{language.native}</span>
            )}
          </button>
        ))}
        {filteredLanguages.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500">
            No languages match &quot;{searchQuery}&quot; 🔍
          </div>
        )}
      </div>
    </OnboardingStepLayout>
  );
}
