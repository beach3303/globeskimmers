// ============================================================================
// Location-aware stamp VARIANTS.
//
// Some landmarks are experienced from distinct, far-apart viewpoints — the
// Grand Canyon's four rims, Niagara Falls' two sides. A traveler who saw the
// canyon from the West Rim (the Las Vegas side / Skywalk) earns a different
// stamp than one at the North Rim. At stamp time we resolve the coordinates
// (a live GPS fix when the user is there, otherwise the selected place's
// coordinates) — plus country for border cases — to the right variant.
//
// Resort-level UMBRELLA names ("Walt Disney World Resort") are the exception:
// they never resolve to one park unless a live GPS fix says which (see UMBRELLA).
//
// The `slug` fields MUST match the PNG filenames uploaded to R2 (stamp-art/).
// If a variant's art isn't uploaded yet, the stamp simply falls back to the
// category emoji until it is (no release needed).
// ============================================================================

function havKm(aLat, aLng, bLat, bLng) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Each landmark: a name matcher, a resolution mode, a distance gate (maxKm to
// reject far-away same-named places), and its variants with anchor coordinates.
const LANDMARKS = [
  {
    id: "grand-canyon",
    match: /grand\s*canyon/i,
    mode: "nearest",         // rims are all in the USA → disambiguate purely by coords
    maxKm: 120,
    variants: [
      { key: "west",  name: "Grand Canyon West Rim",  slug: "grand-canyon-west-rim",  lat: 36.0158, lng: -113.8102 }, // Skywalk / Eagle Point
      { key: "south", name: "Grand Canyon South Rim", slug: "grand-canyon-south-rim", lat: 36.0602, lng: -112.1073 }, // Mather Point
      { key: "east",  name: "Grand Canyon East Rim",  slug: "grand-canyon-east-rim",  lat: 36.0441, lng: -111.8264 }, // Desert View Watchtower
      { key: "north", name: "Grand Canyon North Rim", slug: "grand-canyon-north-rim", lat: 36.1978, lng: -112.0574 }, // Bright Angel Point
    ],
  },
  {
    id: "niagara-falls",
    match: /niagara\s*falls/i,
    mode: "country-then-nearest", // the two sides straddle a border ~1km apart → country wins first
    maxKm: 45,
    variants: [
      { key: "ca", name: "Niagara Falls, Canada",   slug: "niagara-falls-canada",   cc: ["ca", "canada"],                         lat: 43.0793, lng: -79.0785 }, // Table Rock / Horseshoe Falls
      { key: "us", name: "Niagara Falls, New York", slug: "niagara-falls-new-york", cc: ["us", "usa", "united states", "america"], lat: 43.0847, lng: -79.0714 }, // Prospect Point / American Falls
    ],
  },
  {
    // Same brand, different continents — and different "kingdoms" inside one
    // resort. Coordinates resolve BOTH: which resort you are at, and which park
    // within it, exactly like the Grand Canyon rims. maxKm keeps a Tokyo tap
    // from ever resolving against Anaheim.
    id: "disney-parks",
    match: /disneyland|disney\s*california\s*adventure|walt\s*disney\s*world|magic\s*kingdom|epcot|disney'?s?\s*(hollywood\s*studios|animal\s*kingdom)|disneysea/i,
    exclude: /hotel|concert|store|shop|downtown|springs|cruise|office/i,
    mode: "nearest",
    maxKm: 60,
    variants: [
      { key: "anaheim",   name: "Disneyland Park",             slug: "disneyland-anaheim",           lat: 33.8121, lng: -117.9190 },
      { key: "anaheim-ca",name: "Disney California Adventure", slug: "disney-california-adventure",  lat: 33.8061, lng: -117.9215 },
      { key: "wdw-mk",    name: "Magic Kingdom",               slug: "magic-kingdom",                lat: 28.4177, lng: -81.5812 },
      { key: "wdw-epcot", name: "EPCOT",                       slug: "epcot",                        lat: 28.3747, lng: -81.5494 },
      { key: "wdw-hs",    name: "Disney's Hollywood Studios",   slug: "disneys-hollywood-studios",    lat: 28.3575, lng: -81.5583 },
      { key: "wdw-ak",    name: "Disney's Animal Kingdom",      slug: "disneys-animal-kingdom",       lat: 28.3553, lng: -81.5901 },
      { key: "paris",     name: "Disneyland Paris",            slug: "disneyland-paris",             lat: 48.8722, lng: 2.7758 },
      { key: "tokyo",     name: "Tokyo Disneyland",            slug: "tokyo-disneyland",             lat: 35.6329, lng: 139.8804 },
      { key: "tokyo-sea", name: "Tokyo DisneySea",             slug: "tokyo-disneysea",              lat: 35.6267, lng: 139.8850 },
      { key: "hongkong",  name: "Hong Kong Disneyland",        slug: "hong-kong-disneyland",         lat: 22.3130, lng: 114.0414 },
      { key: "shanghai",  name: "Shanghai Disneyland",         slug: "shanghai-disneyland",          lat: 31.1434, lng: 121.6573 },
    ],
  },
  {
    id: "universal-parks",
    match: /universal\s*studios|islands\s*of\s*adventure|epic\s*universe|universal\s*orlando/i,
    exclude: /citywalk|hotel|store/i,
    mode: "nearest",
    maxKm: 60,
    variants: [
      { key: "hollywood", name: "Universal Studios Hollywood", slug: "universal-studios-hollywood",  lat: 34.1381, lng: -118.3534 },
      { key: "usf",       name: "Universal Studios Florida",   slug: "universal-studios-florida",    lat: 28.4749, lng: -81.4664 },
      { key: "ioa",       name: "Islands of Adventure",        slug: "universal-islands-of-adventure", lat: 28.4711, lng: -81.4728 },
      { key: "epic",      name: "Universal Epic Universe",     slug: "universal-epic-universe",      lat: 28.4370, lng: -81.4520 },
      { key: "japan",     name: "Universal Studios Japan",     slug: "universal-studios-japan",      lat: 34.6654, lng: 135.4323 },
      { key: "singapore", name: "Universal Studios Singapore", slug: "universal-studios-singapore",  lat: 1.2540,  lng: 103.8238 },
      { key: "beijing",   name: "Universal Studios Beijing",   slug: "universal-studios-beijing",    lat: 39.8570, lng: 116.6764 },
    ],
  },
];

const asVariant = (v) => ({ key: v.key, name: v.name, slug: v.slug, entity_id: v.slug });

// Resort-level umbrella names. "Walt Disney World Resort", "Disneyland Resort"
// and "Universal Orlando Resort" name the whole property, not any one park in
// it. On a self-declared tap the only coordinates we hold are the listing's own
// pin, and the nearest-anchor rule would then hand out a stamp for whichever
// gate happens to sit closest to that pin (WDW's pin → EPCOT) — a park the
// traveler never claimed, whose entity_id a later genuine visit then upserts
// into. So an umbrella name resolves to a park ONLY when a live GPS fix says
// which one (verified === "gps"); otherwise the caller keeps the umbrella stamp.
const UMBRELLA = /\bresort\b|walt\s*disney\s*world|universal\s*orlando/i;

// Given a stamp candidate, return the resolved variant or null (not a
// multi-viewpoint landmark, too far from any known viewpoint, or an umbrella
// name with no GPS corroboration). `verified` is the caller's stamp
// verification ("gps" when a live fix put the user inside the place); anything
// else — including omitting it — is treated as NOT GPS-verified.
export function resolveStampVariant({ name, lat, lng, country, verified }) {
  if (!name) return null;
  const L = LANDMARKS.find((l) => l.match.test(name));
  if (!L) return null;
  // Same-brand near-misses: hotels, stores, the concert hall. A match on the
  // family regex is not enough — the exclude list vetoes lookalikes.
  if (L.exclude && L.exclude.test(name)) return null;

  // Umbrella name without GPS: never pick a park by proximity to the resort's
  // pin (see UMBRELLA). The rule only bites when the pin is actually ambiguous
  // — several parks of this family within the gate. A one-park resort ("Hong
  // Kong Disneyland Resort", "Disneyland Resort Paris") IS its park and still
  // resolves, so those stamps keep their art.
  if (verified !== "gps" && UMBRELLA.test(name) && Number.isFinite(lat) && Number.isFinite(lng)) {
    const inGate = L.variants.filter((v) => havKm(lat, lng, v.lat, v.lng) <= L.maxKm).length;
    if (inGate > 1) return null;
  }

  // 1) Country-first for border landmarks (Niagara: which side of the river).
  if (L.mode === "country-then-nearest" && country) {
    const cc = String(country).trim().toLowerCase();
    const byCountry = L.variants.find((v) => v.cc?.includes(cc));
    if (byCountry) return asVariant(byCountry);
  }

  // 2) Nearest anchor by coordinates, within the landmark's distance gate.
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    let best = null, bestKm = Infinity;
    for (const v of L.variants) {
      const km = havKm(lat, lng, v.lat, v.lng);
      if (km < bestKm) { bestKm = km; best = v; }
    }
    if (best && bestKm <= L.maxKm) return asVariant(best);
  }

  return null;
}

// Exposed for tooling / the art-upload checklist (the exact filenames to ship).
export const STAMP_VARIANT_SLUGS = LANDMARKS.flatMap((l) => l.variants.map((v) => v.slug));
