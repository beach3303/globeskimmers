// How close you must be for a stamp to earn its ✓.
//
// The passport used ONE global radius (GPS_VERIFY_RADIUS_M = 250m) measured from
// a single centroid. That silently fails for anything with a footprint: Disney
// California Adventure is roughly 500m across, so a visitor standing in Cars Land
// is outside 250m of the park's centre and loses the ✓ while literally inside the
// gate. Same for national parks, zoos, beaches and campuses.
//
// So the radius comes from what KIND of place it is. A per-row override wins when
// the data has one (owned attractions can carry footprint_radius_m); otherwise we
// infer from the category/type strings both our owned DB and Google Places return.
import { GPS_VERIFY_RADIUS_M } from "@/lib/passport";

// Ordered most- to least-specific: the first pattern that matches wins, so
// "national_park" is decided before the generic "park".
const FOOTPRINTS = [
  [/national_park|national_forest|nature_reserve|wildlife_refuge/, 6000],
  [/ski_resort|state_park|regional_park|botanical_garden|arboretum/, 2500],
  [/beach|lake|waterfall|mountain|natural_feature|island/, 1800],
  [/theme_park|amusement_park|water_park|resort_world/, 900],
  [/airport|international_airport/, 2500],
  [/university|college|campus|fairground|convention_center/, 800],
  [/zoo|aquarium|safari|golf_course|cemetery|historical_park|archaeolog/, 600],
  [/stadium|arena|race_track|marina|pier|market|bazaar|souk/, 400],
  [/shopping_mall|department_store|casino|monastery|temple_complex/, 350],
];

// Metres within which a GPS fix counts as "you were there".
// place: anything carrying a category/type — an owned attraction or a Google place.
export function stampRadiusFor(place) {
  if (!place) return GPS_VERIFY_RADIUS_M;

  // An explicit per-row footprint always wins — this is the escape hatch for the
  // handful of places the category heuristic gets wrong.
  const explicit = Number(place.footprint_radius_m ?? place.footprintRadiusM);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const hay = [
    place.category, place.activityCategory, place.primaryType, place.type,
    ...(Array.isArray(place.types) ? place.types : []),
    ...(Array.isArray(place.category_alt) ? place.category_alt : []),
  ].filter(Boolean).join(" ").toLowerCase();

  if (!hay) return GPS_VERIFY_RADIUS_M;
  for (const [pattern, metres] of FOOTPRINTS) if (pattern.test(hay)) return metres;
  return GPS_VERIFY_RADIUS_M;
}
