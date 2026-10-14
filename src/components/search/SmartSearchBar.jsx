// SmartSearchBar — the "spine": a single search entry at the top of Home, under the
// lobby (Home-Boxes L48-51). It's just the trigger; tapping it opens the full-screen
// SmartSearchOverlay. One search that understands food / coffee / things-to-do / a
// whole city, and routes you into the right world scoped to the right place.
import React from "react";
import { Search } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";

export default function SmartSearchBar({ onOpen, wide = false }) {
  return (
    <div className={wide ? "" : "px-4"} style={{ paddingTop: 8 }}>
      <div className={wide ? "" : "max-w-md mx-auto md:max-w-[720px]"}>
        <button
          type="button"
          onClick={onOpen}
          aria-label="Search food, sights, a whole city"
          className="w-full flex items-center text-left"
          style={{ minHeight: 52, boxSizing: "border-box", gap: 12, padding: "0 16px", borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.lobbyLine}`, cursor: "pointer" }}
        >
          <Search size={18} color={NEUTRAL.brandTeal} strokeWidth={2} aria-hidden="true" className="flex-none" />
          <span className="truncate" style={{ fontSize: fs(15), lineHeight: "20px", color: NEUTRAL.ink3 }}>
            Search food, sights, a whole city&hellip;
          </span>
        </button>
      </div>
    </div>
  );
}
