import React, { useState } from "react";
import { Languages, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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

export default function LanguageStep({ onNext, onSkip }) {
  const [selectedLanguage, setSelectedLanguage] = useState("");

  const handleContinue = () => {
    if (selectedLanguage) {
      onNext({ preferred_language: selectedLanguage });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      // Compact top-aligned layout — same approach as the redesigned
      // ReferralSourceStep so 35 languages fit on a Galaxy S10 viewport
      // without the Continue button getting buried below the fold.
      className="flex flex-col items-center px-5 pt-5 pb-4 min-h-screen"
    >
      <div className="w-full max-w-md flex flex-col">
        {/* Compact header — inline icon + tight title */}
        <div className="flex items-center justify-center gap-2.5 mb-2.5">
          <div className="w-10 h-10 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center flex-shrink-0">
            <Languages className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-[20px] font-bold text-[#0A4D68] leading-tight">
            Preferred Language
          </h2>
        </div>

        <p className="text-gray-600 text-[12.5px] mb-3 text-center leading-snug">
          Choose your preferred language for the app
        </p>

        {/* Scrollable list. max-h sized to leave room for Continue +
            Skip footer on a Galaxy S10 (~640pt viewport). */}
        <div className="max-h-[58vh] overflow-y-auto mb-3 border-2 border-gray-200 rounded-xl">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => setSelectedLanguage(language.code)}
              className={`w-full px-4 py-2.5 text-left border-b border-gray-200 last:border-b-0 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 ${
                selectedLanguage === language.code
                  ? 'bg-[#088395] text-white hover:bg-[#088395]'
                  : 'text-gray-800'
              }`}
            >
              <span className="font-semibold text-[14px]">{language.name}</span>
              {language.native && (
                <span className={`text-[13px] ${
                  selectedLanguage === language.code ? 'text-white/85' : 'text-gray-500'
                }`}>
                  {language.native}
                </span>
              )}
            </button>
          ))}
        </div>

        <Button
          onClick={handleContinue}
          disabled={!selectedLanguage}
          className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-11 text-[15px] font-semibold disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-1.5" />
        </Button>

        <button
          onClick={() => onSkip()}
          className="w-full mt-2 text-gray-500 hover:text-gray-700 text-[12px]"
        >
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}
