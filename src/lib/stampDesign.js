// Typographic stamp designs — the type-only stamp used wherever a place has no
// bespoke art on R2 yet. Eight BORDERLESS layouts, assigned deterministically so
// the same place always produces the same stamp (a passport that reshuffles on
// reload is not a keepsake) and a filled page looks stamped by many hands. This
// is the same trick airportStampConfig() plays per country, applied per place.
//
// Renderer: <TypographicStamp/>. Art, when it exists, still wins — see
// stampArt.js; this is what renders instead of the 🛂 emoji when it 404s.
import { countryCode } from "@/lib/countries";

// Each design declares what it can HOLD. A long name dropped into a layout built
// for one short word either overflows or shrinks to unreadable, so selection
// picks only from the designs a name actually fits and hashes within that pool.
// maxLine is the longest single WORD the layout can set without shrinking badly.
export const STAMP_DESIGNS = [
  { id: "col", maxWords: 4, maxLine: 12 },  // Column     — stacked caps between rules
  { id: "rng", maxWords: 2, maxLine: 10 },  // Ring       — text traces the circle
  { id: "ban", maxWords: 3, maxLine: 10 },  // Banner     — ruled top and bottom
  { id: "jst", maxWords: 3, maxLine: 8  },  // Justified  — lines tracked to one measure
  { id: "ldg", maxWords: 3, maxLine: 10 },  // Ledger     — left-aligned entry + boxed date
  { id: "spl", maxWords: 2, maxLine: 11 },  // Split rule — rules break around a mark
  { id: "ovl", maxWords: 3, maxLine: 11 },  // Oval       — flatter cousin of the ring
  { id: "mrq", maxWords: 2, maxLine: 8  },  // Marquee    — name at maximum size
];

// Ink by region — the palette already documented in docs/PASSPORT_ICON_LIST.md,
// so a typographic stamp sits beside a commissioned one without clashing.
const INK_BY_REGION = {
  europe: "#2B4A7E", mea: "#A9741F", asia: "#B0472F",
  oceania: "#1F6E6A", namerica: "#2E6B4E", samerica: "#6D3A6E",
};

// Turkey, Israel, Jordan and the Gulf sit under MEA (amber) to match the
// commissioned set, where Hagia Sophia and Cappadocia are amber, not crimson.
const REGION_CODES = {
  europe: "AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK",
  mea: "AE AO BF BH BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW IL IQ IR JO KE KM KW LB LR LS LY MA MG ML MR MU MW MZ NA NE NG OM QA RW SA SC SD SL SN SO SS ST SY SZ TD TG TN TR TZ UG YE ZA ZM ZW",
  asia: "AF AM AZ BD BN BT CN GE HK ID IN JP KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TM TW UZ VN",
  oceania: "AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PW SB TK TO TV VU WF WS",
  namerica: "AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI",
  samerica: "AR BO BR CL CO EC FK GF GY PE PY SR UY VE",
};
const REGION_BY_CC = {};
for (const [region, codes] of Object.entries(REGION_CODES)) {
  for (const cc of codes.split(" ")) REGION_BY_CC[cc] = region;
}

// Countries we can't resolve still get a stable ink rather than a default one,
// so an unmapped territory never looks like a bug.
const FALLBACK_INKS = ["#2B4A7E", "#B0472F", "#2E6B4E", "#6D3A6E", "#1F6E6A", "#A9741F"];

// Stable string hash — same shape as airportStamp.js so behaviour matches.
const hash = (s) => {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};

// Which of the eight a name can be set in. Column accepts four words and twelve
// characters a line, so it is the guaranteed fallback — nothing fails to render.
export function stampDesign(entityId, name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return STAMP_DESIGNS[0].id;
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0);
  const fits = STAMP_DESIGNS.filter((d) => words.length <= d.maxWords && longest <= d.maxLine);
  const pool = fits.length ? fits : [STAMP_DESIGNS[0]];
  return pool[hash(entityId || name) % pool.length].id;
}

// Territories the seed data names that COUNTRIES has no row for. Without these,
// "Taiwan" fell through to the raw-name shortcut ("TA"), missed REGION_BY_CC and
// hashed into MEA amber beside crimson China/Japan stamps.
const CC_ALIASES = { taiwan: "TW", "hong kong": "HK", macau: "MO", macao: "MO" };

// Region ink for a country name OR an ISO-3166 alpha-2 code (stamps carry both).
export function stampInk(country) {
  const raw = String(country || "").trim();
  const cc = String(countryCode(raw) || CC_ALIASES[raw.toLowerCase()] || raw).toUpperCase().slice(0, 2);
  const region = REGION_BY_CC[cc];
  return region ? INK_BY_REGION[region] : FALLBACK_INKS[hash(cc || raw) % FALLBACK_INKS.length];
}

// The single call a renderer needs. Mirrors airportStampConfig()'s shape.
export function typographicStampConfig({ entityId, name, country } = {}) {
  return { design: stampDesign(entityId, name), ink: stampInk(country) };
}
