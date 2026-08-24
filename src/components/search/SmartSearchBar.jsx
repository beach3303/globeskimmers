// SmartSearchBar — the "spine": a single search entry pinned at the top of Home.
// It's just the trigger; tapping it opens the full-screen SmartSearchOverlay.
// One search that understands food / hotels / things-to-do / a whole city, and
// routes you into the right world scoped to the right place.
import React from "react";
import { Search } from "lucide-react";

export default function SmartSearchBar({ onOpen, wide = false }) {
  return (
    <div className={wide ? "pb-2.5" : "px-4 pb-2.5"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <button
          onClick={onOpen}
          aria-label="Search"
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-black/[0.015]"
          style={{ background: "#FFFFFF", border: "1px solid #E6DFD0", boxShadow: "0 8px 22px -16px rgba(22,17,13,.45)" }}
        >
          <Search className="w-[18px] h-[18px] flex-none" style={{ color: "#17A38F" }} strokeWidth={2.4} />
          <span className="text-[calc(14.5px*var(--fs))] truncate" style={{ color: "#8A93A6" }}>
            Search food, hotels, a whole city&hellip;
          </span>
        </button>
      </div>
    </div>
  );
}
