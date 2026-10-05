// The virtual items' vector art (founder, 2026-10-05): a generic laptop and
// three generic drink containers — deliberately NOT any brand's trade dress
// (no logos, plain tapers, lid handles; see docs/LAWYER_BRIEF.md §3). Each
// returns an SVG inner string for a 340×340 canvas, recolorable.
/* eslint-disable */
const laptop = (body, dark, lite) => `
  <rect x="48" y="52" width="244" height="178" rx="18" fill="${body}" stroke="${dark}" stroke-width="3"/>
  <rect x="58" y="62" width="224" height="158" rx="12" fill="none" stroke="${lite}" stroke-width="1.6" opacity=".5"/>
  <rect x="30" y="238" width="280" height="16" rx="8" fill="${dark}"/>
  <rect x="136" y="238" width="68" height="7" rx="3.5" fill="${body}"/>
  <circle cx="64" cy="258" r="4" fill="${dark}"/><circle cx="276" cy="258" r="4" fill="${dark}"/>`;
const tumbler = (body, dark, lite) => `
  <path d="M118,86 L222,86 L212,296 Q211,308 199,308 L141,308 Q129,308 128,296 Z" fill="${body}" stroke="${dark}" stroke-width="3"/>
  <path d="M126,96 L138,96 L130,296 L126,296 Z" fill="${lite}" opacity=".35"/>
  <rect x="112" y="64" width="116" height="26" rx="9" fill="${dark}"/>
  <rect x="112" y="56" width="116" height="14" rx="7" fill="${body}" stroke="${dark}" stroke-width="2.5"/>
  <path d="M146,56 Q146,30 170,30 Q194,30 194,56" fill="none" stroke="${dark}" stroke-width="10" stroke-linecap="round"/>
  <rect x="196" y="58" width="22" height="9" rx="4.5" fill="${lite}"/>`;
const strawBottle = (body, dark, lite) => `
  <path d="M110,110 Q110,92 128,90 L212,90 Q230,92 230,110 L230,284 Q230,308 206,308 L134,308 Q110,308 110,284 Z" fill="${body}" stroke="${dark}" stroke-width="3"/>
  <path d="M120,104 L132,104 L132,296 L120,296 Z" fill="${lite}" opacity=".3"/>
  <rect x="126" y="62" width="88" height="32" rx="10" fill="${dark}"/>
  <path d="M150,62 Q150,46 166,46 L176,46 Q190,46 190,60" fill="none" stroke="${dark}" stroke-width="9" stroke-linecap="round"/>
  <path d="M196,66 L214,24 L226,24 L206,66 Z" fill="${lite}" stroke="${dark}" stroke-width="2.5"/>`;
const lidBottle = (body, dark, lite) => `
  <path d="M122,122 Q104,132 104,160 L104,282 Q104,308 130,308 L210,308 Q236,308 236,282 L236,160 Q236,132 218,122 L206,112 L134,112 Z" fill="${body}" stroke="${dark}" stroke-width="3"/>
  <path d="M116,150 L128,142 L128,294 L116,294 Z" fill="${lite}" opacity=".3"/>
  <rect x="134" y="84" width="72" height="30" rx="8" fill="${dark}"/>
  <rect x="150" y="66" width="40" height="22" rx="8" fill="${body}" stroke="${dark}" stroke-width="2.5"/>
  <path d="M160,66 Q160,52 172,52 Q184,52 184,66" fill="none" stroke="${dark}" stroke-width="8" stroke-linecap="round"/>`;

export const GEAR_SHAPES = { laptop, tumbler, "straw-bottle": strawBottle, "lid-bottle": lidBottle };

// The founder's eight item colors (trendy, muted — never neon).
export const GEAR_COLORS = [
  { key: "pink", name: "Pink", body: "#DCA2B0", dark: "#B27787", lite: "#F4E2E7" },
  { key: "white", name: "White", body: "#EDEAE2", dark: "#C9C4B8", lite: "#FFFFFF" },
  { key: "black", name: "Black", body: "#33333A", dark: "#1D1D22", lite: "#6E6E78" },
  { key: "yellow", name: "Yellow", body: "#DCC05E", dark: "#AE9340", lite: "#F3E7BC" },
  { key: "blue", name: "Blue", body: "#5B7FA6", dark: "#3E5A79", lite: "#DCE6EF" },
  { key: "purple", name: "Purple", body: "#8E7BAE", dark: "#685A85", lite: "#E4DEEF" },
  { key: "green", name: "Green", body: "#6F9A7B", dark: "#4E7259", lite: "#DEEBE1" },
  { key: "orange", name: "Orange", body: "#D28E57", dark: "#A5693B", lite: "#F3DFC9" },
];
export const DRINK_VARIANTS = [
  { key: "tumbler", name: "XL coffee tumbler", sub: "Metal, lid with a handle" },
  { key: "straw-bottle", name: "XXL straw bottle", sub: "Cold drinks, flip straw" },
  { key: "lid-bottle", name: "Water bottle", sub: "Screw lid, carry loop" },
];
// Sticker-safe regions (normalized) so a sticker lands on the item, not the air.
export const GEAR_BOUNDS = {
  laptop: { xMin: 0.2, xMax: 0.8, yMin: 0.2, yMax: 0.64 },
  tumbler: { xMin: 0.37, xMax: 0.63, yMin: 0.32, yMax: 0.84 },
  "straw-bottle": { xMin: 0.35, xMax: 0.65, yMin: 0.32, yMax: 0.84 },
  "lid-bottle": { xMin: 0.34, xMax: 0.66, yMin: 0.42, yMax: 0.84 },
};
export const colorOf = (key) => GEAR_COLORS.find((c) => c.key === key) || GEAR_COLORS[4];
