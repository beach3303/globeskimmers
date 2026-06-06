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
      // No min-h-screen / justify-center — the parent OnboardingPage owns
      // the page background. Forcing center alignment on a content-heavy
      // step is what was making this overflow past the Continue button on
      // smaller Android viewports (Galaxy S10 has ~640pt usable height).
      // Top-aligned with tight padding lets everything fit on one screen.
      className="flex flex-col items-center px-5 pt-5 pb-4 min-h-screen"
    >
      <div className="w-full max-w-md flex flex-col">
        {/* Compact header — inline icon + tight title + smaller subtitle.
            The old 80×80 hero icon circle was eating ~96px of vertical
            space for purely decorative purposes; the inline 40×40 here
            keeps the visual cue without dominating the viewport. */}
        <div className="flex items-center justify-center gap-2.5 mb-2.5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
            className="w-10 h-10 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center flex-shrink-0"
          >
            <Share2 className="w-5 h-5 text-white" />
          </motion.div>
          <h2 className="text-[20px] font-bold text-[#0A4D68] leading-tight">
            How did you hear about us?
          </h2>
        </div>

        <p className="text-gray-600 text-[12.5px] mb-3 text-center leading-snug">
          Help us improve by letting us know where you discovered Globeskimmers
        </p>

        {/* Tighter grid: gap-2 + p-2 + smaller icon/label so 5 rows of
            cards fit in ~340px instead of ~528px. */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {REFERRAL_SOURCES.map((source, index) => (
            <motion.button
              key={source.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedSource(source.value)}
              className={`relative overflow-hidden rounded-xl py-2 px-2 transition-all duration-200 ${
                selectedSource === source.value
                  ? `bg-gradient-to-br ${source.gradient} text-white shadow-md`
                  : 'bg-white border-2 border-gray-200'
              }`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[22px] leading-none">{source.icon}</span>
                <p className={`font-semibold text-[12px] text-center leading-tight ${
                  selectedSource === source.value ? 'text-white' : 'text-[#0A4D68]'
                }`}>
                  {source.label}
                </p>
              </div>

              {selectedSource === source.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center"
                >
                  <span className="text-[#088395] text-[9px] font-bold">✓</span>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!selectedSource}
          className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-11 text-[15px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </Button>

        <p className="text-[10px] text-gray-500 text-center mt-1.5">
          Your feedback helps us reach more travelers like you
        </p>
      </div>
    </motion.div>
  );
}