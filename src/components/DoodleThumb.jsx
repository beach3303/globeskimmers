// DoodleThumb — every doodle in the app opens and closes the same way (founder, 2026-10-16:
// "users can open all the doodles to expand and collapse throughout the app"): small in the
// margin, tap → full width in place, tap again → back. DoodlesAllToggle opens or closes every
// doodle in a list at once, shown when a list holds more than one.
//
//   <DoodleThumb src alt open onToggle small line paper />
//   <DoodlesAllToggle count allOpen onToggle color />
import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";

/**
 * @param {{ src: string, alt?: string, open?: boolean, onToggle: () => void, small?: number, line?: string, paper?: string }} props
 */
export default function DoodleThumb({ src, alt = "A doodle", open = false, onToggle, small = 112, line = NEUTRAL.creamRule, paper = NEUTRAL.cream }) {
  const Icon = open ? Minimize2 : Maximize2;
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? "Shrink the doodle" : "Enlarge the doodle"}
      style={{ display: "block", flex: open ? "1 1 100%" : "none", minHeight: 44, padding: 0, width: open ? "100%" : small, maxWidth: "100%", borderRadius: 12, border: `1px solid ${line}`, background: paper, overflow: "hidden", cursor: "pointer", transition: "width .2s" }}>
      <img src={src} alt={alt} loading="lazy" draggable={false}
        style={{ display: "block", width: "100%", objectFit: "contain", maxHeight: open ? 380 : 84 }} />
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "2px 0 3px", fontSize: fs(10.5), lineHeight: 1.3, color: NEUTRAL.ink3 }}>
        <Icon size={11} strokeWidth={2} aria-hidden="true" focusable="false" />
        {open ? "tap to shrink" : "tap to enlarge"}
      </span>
    </button>
  );
}

/**
 * @param {{ count: number, allOpen: boolean, onToggle: () => void, color?: string }} props
 */
export function DoodlesAllToggle({ count, allOpen, onToggle, color = NEUTRAL.airmailBlue }) {
  if (!count || count < 2) return null;
  const Icon = allOpen ? Minimize2 : Maximize2;
  return (
    <button type="button" onClick={onToggle} aria-pressed={allOpen}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 999, background: "transparent", border: `1px solid ${color}`, fontFamily: "inherit", fontSize: fs(12), fontWeight: 600, color, cursor: "pointer" }}>
      <Icon size={13} strokeWidth={2} aria-hidden="true" focusable="false" />
      {allOpen ? "Shrink all doodles" : `Enlarge all ${count} doodles`}
    </button>
  );
}
