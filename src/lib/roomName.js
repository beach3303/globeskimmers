// prettyRoom — display-only taming of supplier ALL-CAPS room names
// ('1 QUEEN BED - STANDARD,BEDROOM ONLY-NO KITCHEN' → '1 Queen Bed - Standard ·
// Bedroom Only-No Kitchen'). Raw names stay in data and grouping. Mirrors the
// worker's nuiteePrettyRoom so checkout, confirmation, room cards and the
// booking sheet all read the same way.
export const prettyRoom = (s) => String(s || "").replace(/\s*,\s*/g, " · ").replace(/\s+/g, " ").trim()
  .toLowerCase().replace(/(^|[\s·(\/-])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\bWifi\b/g, "WiFi");
