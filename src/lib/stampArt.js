// Bespoke landmark stamp art. Files live on R2 at stamp-art/<slug>.png and are
// served by the Worker at /stamp-art/<slug>.png. The card tries to load the art
// for a stamp's name and falls back to the category emoji if there's none yet
// (404) — so adding art = uploading a PNG, no app release. Naming convention +
// the curated set: docs/PASSPORT_ICON_LIST.md (name files by the clean slug,
// e.g. "Eiffel Tower" → eiffel-tower.png).
const WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";
// Strip diacritics + apostrophes so international names get clean ASCII slugs:
// "Sagrada Família" → sagrada-familia, "St. Mark's Basilica" → st-marks-basilica.
const slug = (s) => String(s || "")
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/['’]/g, "")
  .trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Name variants (incl. local-language) → the canonical file slug. Grow this as
// analytics show the real attraction names people stamp.
const ALIAS = {
  "tour-eiffel": "eiffel-tower",
  "big-ben-elizabeth-tower": "big-ben", "elizabeth-tower": "big-ben",
  "colosseo": "colosseum",
  "leaning-tower": "leaning-tower-of-pisa", "torre-di-pisa": "leaning-tower-of-pisa",
  "acropolis": "parthenon",
  "great-wall": "great-wall-of-china",
  "sensoji": "senso-ji-temple", "senso-ji": "senso-ji-temple",
  "kinkaku-ji": "kinkaku-ji-golden-pavilion", "golden-pavilion": "kinkaku-ji-golden-pavilion",
  "cristo-redentor": "christ-the-redeemer",
  "ayers-rock": "uluru",
  "giza-pyramids": "pyramids-of-giza", "the-pyramids-of-giza": "pyramids-of-giza",
  "statue-of-liberty-national-monument": "statue-of-liberty",
};

// Returns a stamp-art URL for a stamp name (always a candidate URL; the caller
// falls back on <img> onError). Only for place-like stamps (icons/attractions/
// wonders/cities) — country stamps use the flag, not bespoke art.
export function stampArtUrl(name) {
  const s = slug(name);
  if (!s) return null;
  return `${WORKER}/stamp-art/${ALIAS[s] || s}.png`;
}
