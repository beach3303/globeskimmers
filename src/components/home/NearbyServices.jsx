// NearbyServices: Home's services zone on the kraft stock (Home-Boxes L120-147).
//
// Phone: the four lead finders as crest chips (eat, coffee, things to do, restrooms),
// then the quiet "All services" chip that opens the sheet with all eleven. One row
// that scrolls sideways under the zone's right-edge fade; the trailing 16px lets the
// last chip clear the fade. iPad: all eleven finders as an inline ServiceTile grid in
// FINDER_ORDER, so nothing hides behind a sheet on the big screen.
//
// compact (2026-10-25): the Nearby page on a phone — every finder, three small tiles to a row,
// since the page has the room the old one-row strip didn't.
//
// Navigation and analytics stay with Home: onAction(label) is Home's
// handleQuickAction (it logs feature_used and routes), onAllServices opens the sheet
// (Home logs all_services_sheet).
import React from "react";
import { LayoutGrid } from "lucide-react";
import { HomeZone } from "@/components/redesign/Zone";
import { CrestChip, ServiceTile } from "@/components/redesign/Crest";
import { FINDER_ORDER, WORLD } from "@/components/redesign/constants";

const LEAD = ["eat", "coffee", "todo", "restroom"];

export default function NearbyServices({ onAction, onAllServices, wide = false, compact = false }) {
  if (wide || compact) {
    return (
      <HomeZone zone="services" label="Nearby services" wide>
        <div className="grid" style={{ gridTemplateColumns: compact ? "repeat(3, minmax(0, 1fr))" : "repeat(auto-fill, minmax(min(100%, 112px), 1fr))", gap: compact ? 8 : 10, paddingRight: 16 }}>
          {FINDER_ORDER.map((k) => (
            <ServiceTile key={k} world={k} onClick={() => onAction(WORLD[k].action)} style={compact ? { minHeight: 78, gap: 5, padding: "8px 4px" } : undefined} />
          ))}
        </div>
      </HomeZone>
    );
  }
  return (
    <HomeZone zone="services" label="Nearby services">
      <div className="flex overflow-x-auto" style={{ gap: 8, paddingRight: 16, scrollbarWidth: "none" }}>
        {LEAD.map((k) => (
          <CrestChip key={k} world={k} onClick={() => onAction(WORLD[k].action)} />
        ))}
        <CrestChip quiet icon={LayoutGrid} label="All services" aria-haspopup="dialog" onClick={onAllServices} />
      </div>
    </HomeZone>
  );
}
