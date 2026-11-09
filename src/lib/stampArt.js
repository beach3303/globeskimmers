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
  // US national parks whose row name and art file name differ (audit of all 63, 2026-11-08):
  // the art was uploaded under the short name, the stampable row carries the long one, or the reverse.
  "black-canyon-of-the-gunnison-national-park": "black-canyon-of-the-gunnison",
  "gates-of-the-arctic-national-park-and-preserve": "gates-of-the-arctic",
  "great-basin": "great-basin-national-park",
  "lake-clark": "lake-clark-national-park",
  "new-river-gorge-bridge": "new-river-gorge-national-park",
  "wrangell-st-elias-national-park-and-preserve": "wrangell-st-elias",
};
// Rows the generated ART_ONLY guard doesn't know but that ARE the place (2026-11-08): the index was
// built expecting icon rows that were never inserted, and the dedup had banned the curated rows it
// would have listed; the revive (scripts/stamp-art/d1-revive-icons.sql) brings those rows back.
const ONLY_ALSO = {
  "arc-de-triomphe": ["curated:france-paris-arc-de-triomphe"],
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
  if (only && isRowId(id) && !only.includes(id) && !(ONLY_ALSO[art] || []).includes(id)) return null;
  const ccs = ART_CC[art], cc = ccOf(country);
  if (ccs && cc && !ccs.includes(cc)) return null;
  return art;
}

// Art is cached on phones for 30 days, so a redrawn file gets a new URL.
// 2026-10-05: the founder's redraws (wrong landmark, misspelling, cut-off frame,
// Montserrat's damaged file).
const REDRAWN = { "2026-10-05": [
  "anne-frank-house", "blyde-river-canyon", "cancun", "cape-of-good-hope", "ciudad-perdida",
  "corinth-canal", "gergeti-trinity-church", "golden-roof", "ise-grand-shrine", "jebel-jais",
  "kalandula-falls", "kuwait-towers", "lake-titicaca", "lauterbrunnen-valley",
  "le-morne-brabant", "loango-national-park", "malbork-castle", "monte-alban", "montserrat",
  "mount-elbrus", "mount-koya", "museum-of-the-future", "notre-dame-cathedral",
  "perito-moreno-glacier", "rhine-falls", "rijksmuseum", "selaron-steps", "shah-i-zinda",
  "somapura-mahavihara", "the-wave", "uxmal", "verona-arena", "zuma-rock",
] };
const REVISION = Object.fromEntries(Object.entries(REDRAWN).flatMap(([rev, list]) => list.map((s) => [s, rev])));

// Returns a stamp-art URL (a candidate — the caller falls back on <img>
// onError). Only for place-like stamps (icons/attractions/wonders/cities) —
// country stamps use the flag, not bespoke art.
export function stampArtUrl(name, opts) {
  const art = stampArtSlug(name, opts);
  if (!art) return null;
  return `${WORKER}/stamp-art/${art}.png${REVISION[art] ? `?r=${REVISION[art]}` : ""}`;
}
