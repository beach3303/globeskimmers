import React, { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const REFERRAL_SOURCES = [
  { 
    value: "word_of_mouth", 
    label: "Word of Mouth", 
    icon: "👥",
    gradient: "from-[#667eea] to-[#764ba2]"
  },
  { 
    value: "browsing", 
    label: "Just Browsing", 
    icon: "🌐",
    gradient: "from-[#43e97b] to-[#38f9d7]"
  },
  { 
    value: "google_search", 
    label: "Google Search", 
    icon: "🔍",
    gradient: "from-[#4285f4] to-[#34a853]"
  },
  { 
    value: "google_ads", 
    label: "Google Ads", 
    icon: "📢",
    gradient: "from-[#fbbc04] to-[#ea4335]"
  },
  { 
    value: "instagram", 
    label: "Instagram", 
    icon: "📸",
    gradient: "from-[#f09433] to-[#e6683c]"
  },
  { 
    value: "youtube", 
    label: "YouTube", 
    icon: "📺",
    gradient: "from-[#ff0000] to-[#cc0000]"
  },
  { 
    value: "facebook", 
    label: "Facebook", 
    icon: "👍",
    gradient: "from-[#1877f2] to-[#0c5db8]"
  },
  { 
    value: "tiktok", 
    label: "TikTok", 
    icon: "🎵",
    gradient: "from-[#00f2ea] to-[#ff0050]"
  },
  { 
    value: "other", 
    label: "Other", 
    icon: "✨",
    gradient: "from-[#667eea] to-[#764ba2]"
  }
];

export default function ReferralSourceStep({ onNext }) {
  const [selectedSource, setSelectedSource] = useState("");

  const handleSubmit = () => {
    if (!selectedSource) return;
    onNext({ referral_source: selectedSource });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
          className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center"
        >
          <Share2 className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          How did you hear about us?
        </h2>
        
        <p className="text-gray-600 mb-8 text-center">
          Help us improve by letting us know where you discovered Globeskimmers
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {REFERRAL_SOURCES.map((source, index) => (
            <motion.button
              key={source.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedSource(source.value)}
              className={`relative overflow-hidden rounded-xl p-4 transition-all duration-300 ${
                selectedSource === source.value
                  ? `bg-gradient-to-br ${source.gradient} text-white shadow-lg scale-105`
                  : 'bg-white border-2 border-gray-200 hover:border-[#088395]'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">{source.icon}</span>
                <p className={`font-semibold text-sm text-center leading-tight ${
                  selectedSource === source.value ? 'text-white' : 'text-[#0A4D68]'
                }`}>
                  {source.label}
                </p>
              </div>
              
              {selectedSource === source.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center"
                >
                  <span className="text-[#088395] text-xs font-bold">✓</span>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!selectedSource}
          className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </Button>

        <p className="text-xs text-gray-500 text-center mt-4">
          Your feedback helps us reach more travelers like you
        </p>
      </div>
    </motion.div>
  );
}