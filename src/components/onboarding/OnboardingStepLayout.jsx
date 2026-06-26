import React from "react";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

// Shared shell for every onboarding step. Fills EXACTLY the area below the fixed
// BrandBanner (one viewport, no page scroll), so:
//   - the Back row + icon + title sit just under the banner (never clipped)
//   - the Continue/Skip footer is always pinned at the bottom, always visible
//   - long content (pickers/lists) scrolls INSIDE the middle area instead of
//     pushing the whole page down (which used to hide the icon under the banner)
//
// Onboarding renders inside Layout, whose content area is offset by the banner
// height; this element's height = viewport − banner, so header+footer always fit.
export default function OnboardingStepLayout({ icon, title, subtitle, onBack, children, footer }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center px-6 pt-3"
      style={{
        height: "calc(100svh - 50px - env(safe-area-inset-top))",
        paddingBottom: "max(14px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-md flex flex-col flex-1 min-h-0">
        {/* Back row — fixed height so the header doesn't shift when absent */}
        <div className="h-7 flex items-center shrink-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-0.5 -ml-1 text-[#088395] text-sm font-semibold"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          )}
        </div>

        {/* Header */}
        <div className="text-center shrink-0">
          {icon && (
            <div className="w-14 h-14 mx-auto mb-2.5 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
              {icon}
            </div>
          )}
          <h2 className="text-2xl font-bold text-[#0A4D68] mb-1 text-center leading-tight">{title}</h2>
          {subtitle && <p className="text-gray-600 text-[14px] text-center">{subtitle}</p>}
        </div>

        {/* Content — scrolls internally if it can't fit */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3">{children}</div>

        {/* Footer — pinned to the bottom of the viewport */}
        <div className="shrink-0 pt-1">{footer}</div>
      </div>
    </motion.div>
  );
}
