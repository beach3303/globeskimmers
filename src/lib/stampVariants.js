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
];

const asVariant = (v) => ({ key: v.key, name: v.name, slug: v.slug, entity_id: v.slug });

// Given a stamp candidate, return the resolved variant or null (not a
// multi-viewpoint landmark, or too far from any known viewpoint).
export function resolveStampVariant({ name, lat, lng, country }) {
  if (!name) return null;
  const L = LANDMARKS.find((l) => l.match.test(name));
  if (!L) return null;

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
