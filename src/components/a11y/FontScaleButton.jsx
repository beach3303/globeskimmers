import React from "react";
import { useFontScale } from "./FontScaleContext";
import { NEUTRAL } from "@/components/redesign/constants";

// The text-size control: a pair of line-drawn glasses on a white disc (the
// artboard glyph, docs/design/new-look/Home-Boxes.dc.html L22-23). The
// eyeglasses emoji it replaces was chosen because it reads wider and clearer
// than lucide's outline glasses; this glyph is just as wide (28 x 16) and keeps
// the surface emoji-free. Starts as ONE button (larger text); once enlarged, a
// smaller twin (smaller text) appears beside it. Both have 44px hit areas, and
// the control is a FIXED size (it is not scaled by --fs).
//
// It only sets the shared step in FontScaleContext, which drives the global
// `--fs` multiplier — so pressing it from ANY page changes text size everywhere
// and the size persists across launches.
function Glasses({ width, height }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 28 16"
      fill="none"
      stroke={NEUTRAL.ink}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      <circle cx="7" cy="9" r="6" />
      <circle cx="21" cy="9" r="6" />
      <path d="M13 8.4c.7-1.5 1.3-1.5 2 0" />
    </svg>
  );
}

// A 44px transparent hit area with the visible white disc centred in it.
const hit = {
  width: 44,
  height: 44,
  flex: "none",
  padding: 0,
  border: "none",
  borderRadius: 999,
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};
/** @param {number} size @returns {import('react').CSSProperties} */
const disc = (size) => ({
  width: size,
  height: size,
  boxSizing: "border-box",
  borderRadius: 999,
  background: NEUTRAL.white,
  border: `1px solid ${NEUTRAL.rule}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

export default function FontScaleButton({ className = "", style }) {
  const { step, inc, dec, MAX_STEP } = useFontScale();
  const atMax = step >= MAX_STEP;

  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", ...style }}>
      {step > 0 && (
        <button
          type="button"
          onClick={dec}
          aria-label="Smaller text"
          style={{ ...hit, cursor: "pointer" }}
        >
          <span aria-hidden="true" style={disc(32)}>
            <Glasses width={20} height={12} />
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={inc}
        disabled={atMax}
        aria-label="Larger text"
        style={{ ...hit, cursor: atMax ? "default" : "pointer", opacity: atMax ? 0.4 : 1 }}
      >
        <span aria-hidden="true" style={disc(40)}>
          <Glasses width={28} height={16} />
        </span>
      </button>
    </div>
  );
}
