// Bespoke landmark stamp art. Files live on R2 at stamp-art/<slug>.png and are
// served by the Worker at /stamp-art/<slug>.png. The card tries to load the art
// for a stamp and falls back to the typographic stamp if there's none yet
// (404) — so adding art = uploading a PNG, no app release. Naming convention +
// the curated set: docs/PASSPORT_ICON_LIST.md (name files by the clean slug,
// e.g. "Eiffel Tower" → eiffel-tower.png).
//
// Which art a stamp gets (2026-10-04, founder: "ensure the correct art matches
// their names"): the attractions DB names one place many ways and gives many
// places one name, so the name alone isn't enough. stampArtIndex.js (generated
// from a reviewed match of all 1,000 list places against the DB) supplies the
// row ids, extra names and countries; see scripts/stamp-art/README.md.
import { ART_ALIAS, ART_BY_ID, ART_ONLY, ART_CC } from "@/lib/stampArtIndex";
import { countryCode } from "@/lib/countries";

const WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";
// Strip diacritics + apostrophes so international names get clean ASCII slugs:
// "Sagrada Família" → sagrada-familia, "St. Mark's Basilica" → st-marks-basilica.
const slug = (s) => String(s || "")
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/\([^)]*\)/g, " ")            // drop parentheticals: "Parthenon (Acropolis)" → parthenon
  .toLowerCase().replace(/['’]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae")
  .trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Hand-kept name variants (incl. local-language) → the canonical file slug.
// The generated ART_ALIAS covers every name the attractions DB uses.
const ALIAS = {
  "tour-eiffel": "eiffel-tower",
  "big-ben-elizabeth-tower": "big-ben", "elizabeth-tower": "big-ben",
  "colosseo": "colosseum",
  "leaning-tower": "leaning-tower-of-pisa", "torre-di-pisa": "leaning-tower-of-pisa",
  "acropolis": "parthenon",
  "great-wall": "great-wall-of-china",
  "sensoji": "senso-ji-temple", "senso-ji": "senso-ji-temple",
  "kinkaku-ji-golden-pavilion": "kinkaku-ji", "golden-pavilion": "kinkaku-ji",
  "cristo-redentor": "christ-the-redeemer",
  "ayers-rock": "uluru",
  "giza-pyramids": "pyramids-of-giza", "the-pyramids-of-giza": "pyramids-of-giza",
  "statue-of-liberty-national-monument": "statue-of-liberty",
};

const ccOf = (c) => {
  const v = String(c || "").trim();
  if (!v) return null;
  return /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : countryCode(v);
};
// Ids of rows in the attractions DB (icon:Q…, wikidata:Q…, curated:…, wv:…);
// "I was here" stamps carry places:/owned: ids instead.
const isRowId = (id) => /^[a-z]+:/.test(id) && !/^(places|owned):/.test(id);

// The art slug for a stamp, or null. opts.entityId is the stamp's entity_id
// (the DB row for an iconic stamp), opts.country its country (name or code).
export function stampArtSlug(name, { entityId, country } = {}) {
  const id = entityId == null ? "" : String(entityId);
  if (id && ART_BY_ID[id]) return ART_BY_ID[id];
  const s = slug(name);
  if (!s) return null;
  const art = ALIAS[s] || ART_ALIAS[s] || s;
  // A row that merely shares the name (Notre-Dame in Lausanne, the Parthenon in
  // Nashville) never borrows the art.
  const only = ART_ONLY[art];
  if (only && isRowId(id) && !only.includes(id)) return null;
  const ccs = ART_CC[art], cc = ccOf(country);
  if (ccs && cc && !ccs.includes(cc)) return null;
  return art;
}

// Returns a stamp-art URL (a candidate — the caller falls back on <img>
// onError). Only for place-like stamps (icons/attractions/wonders/cities) —
// country stamps use the flag, not bespoke art.
export function stampArtUrl(name, opts) {
  const art = stampArtSlug(name, opts);
  return art ? `${WORKER}/stamp-art/${art}.png` : null;
}
