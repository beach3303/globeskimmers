import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// App-wide text-size scaling for accessibility. A single multiplier (`scale`)
// is applied per page via CSS `zoom` (see how Home/PlacesToEat consume it) —
// `zoom` scales px text uniformly, which is what this px-based codebase needs
// (rem-based root scaling wouldn't touch the many `text-[14px]` / inline px
// sizes). The chosen step persists to localStorage so the size the user picks
// survives closing and reopening the app.
//
// Tunable: STEP_SCALE is how much each "glasses up" press enlarges (≈ +2 type
// sizes on a 14–16px base); MAX_STEP caps how many presses (bumps) are allowed.
const KEY = "gs_font_scale_step";
const STEP_SCALE = 0.15; // +15% per press (≈ +2 type sizes on a 14–16px base)
const MAX_STEP = 3;      // up to 3 bumps

const FontScaleContext = createContext({
  step: 0,
  scale: 1,
  inc: () => {},
  dec: () => {},
  MAX_STEP,
});

function readStep() {
  try {
    const n = parseInt(localStorage.getItem(KEY), 10);
    if (Number.isFinite(n)) return Math.max(0, Math.min(MAX_STEP, n));
  } catch { /* ignore */ }
  return 0;
}

export function FontScaleProvider({ children }) {
  const [step, setStep] = useState(readStep);

  // Persist so the size is remembered next launch.
  useEffect(() => {
    try { localStorage.setItem(KEY, String(step)); } catch { /* ignore */ }
  }, [step]);

  const inc = useCallback(() => setStep((s) => Math.min(MAX_STEP, s + 1)), []);
  const dec = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const scale = 1 + step * STEP_SCALE;

  // Drive the global font multiplier. Text sizes on scaled pages are written as
  // calc(<px> * var(--fs)) so ONLY font-size grows — boxes keep their width and
  // just get taller as text wraps; nothing shrinks or overflows the screen.
  useEffect(() => {
    document.documentElement.style.setProperty("--fs", String(scale));
  }, [scale]);

  return (
    <FontScaleContext.Provider value={{ step, scale, inc, dec, MAX_STEP }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export function useFontScale() {
  return useContext(FontScaleContext);
}
