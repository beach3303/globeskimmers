// DestinationStrip — the "everything <place>" affordance. When a bare place is
// searched from the Smart-Search spine (no category), Home re-centers on it AND
// shows this strip under the search bar: "Exploring <place>" + quick-jumps into
// each world for that destination, as the same crest chips Home's services use.
// Dismissible; reappears on the next place search.
import React from "react";
import { X } from "lucide-react";
import { CrestChip } from "@/components/redesign/Crest";
import { NEUTRAL, WORLD, fs } from "@/components/redesign/constants";

const JUMPS = ["eat", "coffee", "todo", "shopping"];

export default function DestinationStrip({ place, onAction, onDismiss, wide = false }) {
  if (!place) return null;
  return (
    <div className={wide ? "" : "px-4"} style={{ paddingTop: 8 }}>
      <div className={wide ? "" : "max-w-md mx-auto md:max-w-[720px]"}>
        <div style={{ background: NEUTRAL.white, border: `1px solid ${NEUTRAL.lobbyLine}`, borderRadius: 14, padding: "12px 4px 14px 16px" }}>
          <div className="flex items-start" style={{ gap: 4 }}>
            <div className="min-w-0 flex-1" style={{ paddingTop: 2 }}>
              <div className="font-mono uppercase" style={{ fontSize: fs(10), letterSpacing: ".16em", color: NEUTRAL.tealInk }}>Exploring</div>
              <div className="font-serif" style={{ fontSize: fs(22), lineHeight: 1.15, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{place}</div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={`Stop exploring ${place}`}
              className="flex-none flex items-center justify-center rounded-full"
              style={{ width: 44, height: 44, marginTop: -6, background: "transparent", border: 0, color: NEUTRAL.ink3, cursor: "pointer" }}
            >
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div className="flex overflow-x-auto" style={{ gap: 8, marginTop: 10, paddingRight: 12, scrollbarWidth: "none" }}>
            {JUMPS.map((k) => (
              <CrestChip key={k} world={k} onClick={() => onAction?.(WORLD[k].action)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
