// The OS age signal (Apple Declared Age Range) — JS side, wired BEFORE the
// native build so the plugin lights up the moment the founder's store build
// ships AgeRangePlugin.swift (docs/NATIVE_BUILD_CHECKLIST.md). Until then, or
// on Android/web, this resolves null and the self-declared year remains the
// path. Never throws.
import { Capacitor, registerPlugin } from "@capacitor/core";

let plugin = null;
function ageRange() {
  if (plugin) return plugin;
  try { plugin = registerPlugin("AgeRange"); } catch { plugin = null; }
  return plugin;
}

// → { lower, upper, parentControlled } | { declined: true } | null (unavailable)
export async function readOsAgeRange() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return null;
  try {
    const p = ageRange();
    if (!p || typeof p.request !== "function") return null;
    const r = await Promise.race([p.request(), new Promise((res) => setTimeout(() => res(null), 4000))]);
    if (!r || r.available === false) return null;
    if (r.declined) return { declined: true };
    return { lower: r.lower ?? null, upper: r.upper ?? null, parentControlled: !!r.parentControlled };
  } catch { return null; }
}

// The OS range as a birth-year stand-in for the gate: the OLDEST year the
// range allows (a 16–17 range gates as 17 → 'teen'; 18+ gates as adult).
// Conservative by construction — the gate can only be stricter, never looser,
// than what the OS asserts.
export function birthYearFromRange(range) {
  if (!range || range.declined || !Number.isFinite(range.lower)) return null;
  return new Date().getFullYear() - range.lower;
}
