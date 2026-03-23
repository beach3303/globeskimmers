import React, { useState } from "react";
import { Languages, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
  { code: "tl", name: "Tagalog", flag: "🇵🇭" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
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
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
          <Languages className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          Preferred Language
        </h2>
        
        <p className="text-gray-600 mb-8 text-center">
          Choose your preferred language for the app
        </p>

        <div className="max-h-96 overflow-y-auto mb-6 border-2 border-gray-200 rounded-xl">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => setSelectedLanguage(language.code)}
              className={`w-full px-4 py-3 text-left border-b border-gray-200 hover:bg-blue-50 transition-colors flex items-center gap-3 ${
                selectedLanguage === language.code
                  ? 'bg-[#088395] text-white hover:bg-[#088395]'
                  : 'text-gray-800'
              }`}
            >
              <span className="text-2xl">{language.flag}</span>
              <span className="font-semibold">{language.name}</span>
            </button>
          ))}
        </div>

        <Button
          onClick={handleContinue}
          disabled={!selectedLanguage}
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