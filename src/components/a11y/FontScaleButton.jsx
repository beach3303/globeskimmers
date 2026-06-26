import React from "react";
import { useFontScale } from "./FontScaleContext";

// Subtle accessibility control to enlarge text app-wide. Uses the 👓 eyeglasses
// glyph (wider/clearer than the lucide outline). Starts as ONE glasses
// (enlarge); once enlarged, a smaller glasses (reduce) appears beside it. The
// control itself is a FIXED size (its glyph isn't scaled by --fs).
//
// It only sets the shared step in FontScaleContext, which drives the global
// `--fs` multiplier — so pressing it from ANY page changes text size everywhere
// and the size persists across launches.
export default function FontScaleButton({ className = "", style }) {
  const { step, inc, dec, MAX_STEP } = useFontScale();

  const base = {
    borderRadius: 999,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,20,25,0.10)",
    boxShadow: "0 2px 8px -4px rgba(15,20,25,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  };

  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}>
      {step > 0 && (
        <button
          type="button"
          onClick={dec}
          aria-label="Smaller text"
          style={{ ...base, width: 28, height: 28, opacity: 0.85 }}
        >
          <span style={{ fontSize: 12 }}>👓</span>
        </button>
      )}
      <button
        type="button"
        onClick={inc}
        disabled={step >= MAX_STEP}
        aria-label="Larger text"
        style={{ ...base, width: 34, height: 34, opacity: step >= MAX_STEP ? 0.4 : 1 }}
      >
        <span style={{ fontSize: 16 }}>👓</span>
      </button>
    </div>
  );
}
