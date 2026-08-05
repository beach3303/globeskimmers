// Airport arrival stamps — authentic immigration-stamp templates rendered in-app
// from data (city · IATA · country · date). No AI art, no uploads: every international
// airport gets a stamp for free. Each COUNTRY is permanently assigned ONE template
// and ONE dark ink ("vary by country"), so a well-traveled passport looks authentically
// varied — like the real thing. See <AirportStamp/> for the renderer.

// The six approved authentic templates (founder-picked heroes: schengen + seal).
export const AIRPORT_TEMPLATES = ["schengen", "seal", "oval", "panel", "ring", "hexagon"];

// Realistic dark inks like genuine entry stamps: black, navy, oxblood, forest, indigo, sepia.
const INKS = ["#232323", "#274268", "#7E1C28", "#2E5A3A", "#24316B", "#5A3A1E"];

// Curated authentic inks for common travel countries (ISO-3166 alpha-2 → dark ink).
// Everything else falls back to a deterministic pick from INKS.
const INK_BY_COUNTRY = {
  JP: "#8E1F2B", FR: "#274268", CU: "#232323", DE: "#33302B", TH: "#24316B", PE: "#7E1C28",
  US: "#1F3A63", GB: "#2A2A2A", IT: "#2E5A3A", ES: "#7E1C28", NL: "#1F3A63", AU: "#1F3A63",
  BR: "#2E5A3A", MX: "#2E5A3A", CA: "#7E1C28", CN: "#7E1C28", KR: "#1F3A63", IN: "#2A2A2A",
  AE: "#2E5A3A", TR: "#7E1C28", GR: "#274268", PT: "#2E5A3A", CH: "#7E1C28", SE: "#24316B",
  IE: "#2E5A3A", AT: "#7E1C28", EG: "#5A3A1E", ZA: "#2E5A3A", PH: "#1F3A63", ID: "#7E1C28",
  VN: "#7E1C28", SG: "#7E1C28", MY: "#24316B", NZ: "#1F3A63", AR: "#274268", CL: "#7E1C28",
  MA: "#7E1C28", KE: "#232323", QA: "#5A3A1E", NO: "#274268", DK: "#7E1C28", FI: "#274268",
  RU: "#274268", KZ: "#24316B", GE: "#7E1C28", UA: "#274268", IL: "#274268",
};

// Stable string hash so a country always maps to the same template/ink.
function hash(s) {
  let h = 0;
  const str = String(s || "").toUpperCase();
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// Template by country — authentic to how each region really stamps: Schengen bloc →
// rectangular airplane entry; Latin America/Caribbean → office seal; East/SE Asia →
// oval; anglophone/Oceania → ring; MENA/South Asia → panel; Eastern Europe/Central
// Asia → hexagon. Uncovered countries fall back to a stable hash so they still vary.
const TEMPLATE_BUCKETS = {
  schengen: ["AT","BE","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IT","LV","LI","LT","LU","MT","NL","NO","PL","PT","SK","SI","ES","SE","CH"],
  seal: ["CU","MX","PE","AR","CL","CO","EC","BO","BR","CR","GT","PA","DO","UY","PY","VE","MU"],
  oval: ["JP","KR","CN","TH","VN","ID","PH","MY","SG","TW","HK","KH","LA","MM"],
  ring: ["US","CA","GB","IE","AU","NZ","ZA"],
  panel: ["AE","QA","SA","EG","MA","TR","JO","IN","LK","NP","PK","KE","TZ","IL","OM","KW","BH","TN"],
  hexagon: ["RU","UA","GE","AM","AZ","KZ","UZ","KG","TJ","TM","BY","RS","BG","RO","HR"],
};
const TEMPLATE_BY_COUNTRY = {};
for (const [tpl, codes] of Object.entries(TEMPLATE_BUCKETS)) for (const c of codes) TEMPLATE_BY_COUNTRY[c] = tpl;

// Given an ISO-3166 alpha-2 country code, return the permanent {template, ink}.
export function airportStampConfig(countryCode) {
  const cc = String(countryCode || "XX").toUpperCase();
  const h = hash(cc);
  return {
    template: TEMPLATE_BY_COUNTRY[cc] || AIRPORT_TEMPLATES[h % AIRPORT_TEMPLATES.length],
    ink: INK_BY_COUNTRY[cc] || INKS[h % INKS.length],
  };
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// "2026-08-03" | Date → "03 AUG 2026" (empty string if unparseable).
export function fmtStampDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "";
  return `${String(dt.getUTCDate()).padStart(2, "0")} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}
