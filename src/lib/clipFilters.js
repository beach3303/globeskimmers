// Clip looks (founder, 2026-11-03: "allow user to place filter on their clip/videos"). A look is a name
// stored with the clip and drawn by CSS wherever the clip or its poster shows — the board tile and
// viewer, My uploads, Friends' news. Nothing is re-encoded: the file keeps its quality, the AI check saw
// the original frames, and the choice reaches both platforms over the air. The worker keeps the same
// names (BC_CLIP_FILTERS) and drops any other. "none" is the original, never stored.
export const CLIP_FILTERS = [
  { id: "none", name: "Original", css: "none" },
  { id: "warm", name: "Warm", css: "sepia(.22) saturate(1.25) brightness(1.03)" },
  { id: "cool", name: "Cool", css: "saturate(1.1) hue-rotate(14deg) brightness(1.02) contrast(1.02)" },
  { id: "vivid", name: "Vivid", css: "saturate(1.45) contrast(1.08)" },
  { id: "faded", name: "Faded", css: "contrast(.86) brightness(1.08) saturate(.82)" },
  { id: "mono", name: "Mono", css: "grayscale(1) contrast(1.05)" },
  { id: "noir", name: "Noir", css: "grayscale(1) contrast(1.4) brightness(.92)" },
  { id: "vintage", name: "Vintage", css: "sepia(.5) contrast(.95) brightness(1.05) saturate(1.15)" },
];

// The CSS for a stored look, or undefined for the original / an unknown name (so a style's `filter`
// key simply does nothing for photos and old clips).
export function clipFilterCss(id) {
  if (!id || id === "none") return undefined;
  const f = CLIP_FILTERS.find((x) => x.id === id);
  return f ? f.css : undefined;
}
