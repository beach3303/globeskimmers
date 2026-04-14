#!/usr/bin/env node
/**
 * Raw Google Places API (New) audit — bypasses the entire Globeskimmers stack.
 *
 * Purpose: verify Google returns correctly filtered data for each "reliable"
 * filter we advertise in the Places to Eat UI. If a test fails here, Google
 * is misbehaving (unlikely). If tests pass here but the app looks wrong, the
 * bug is in our worker / backend / frontend (likely).
 *
 * Usage:
 *   GOOGLE_API_KEY=AIza... node scripts/audit-places-api.mjs
 *
 * Optional env:
 *   LAT=34.0522 LNG=-118.2437  (defaults: Los Angeles downtown)
 *   VERBOSE=1                  (print first result per test)
 */

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("❌ Set GOOGLE_API_KEY env var.");
  process.exit(1);
}

const LAT = parseFloat(process.env.LAT || "34.0522");
const LNG = parseFloat(process.env.LNG || "-118.2437");
const VERBOSE = !!process.env.VERBOSE;

const FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.primaryType",
  "places.types",
  "places.rating",
  "places.priceLevel",
  "places.location",
  "places.regularOpeningHours",
  "places.servesVegetarianFood",
  "places.servesVeganFood",
].join(",");

async function searchText(payload) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

function km(la1, lo1, la2, lo2) {
  const R = 6371;
  const dL = ((la2 - la1) * Math.PI) / 180;
  const dN = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dL / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) *
      Math.cos((la2 * Math.PI) / 180) *
      Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let pass = 0;
let fail = 0;
function report(name, ok, detail = "") {
  if (ok) {
    console.log(`✅ ${name}`);
    pass++;
  } else {
    console.log(`❌ ${name}  ${detail}`);
    fail++;
  }
}

async function test1_specificDish() {
  const data = await searchText({
    textQuery: "carbonara",
    includedType: "restaurant",
    maxResultCount: 10,
    locationBias: { circle: { center: { latitude: LAT, longitude: LNG }, radius: 10000 } },
  });
  const places = data.places || [];
  if (VERBOSE) console.log("   first:", places[0]?.displayName?.text, places[0]?.types);
  const hasItalian = places.some((p) =>
    (p.types || []).some((t) => /italian_restaurant|pizza_restaurant|mediterranean_restaurant/.test(t))
  );
  report(
    "1. Specific dish (carbonara) returns Italian-related types",
    places.length > 0 && hasItalian,
    `got ${places.length} results`
  );
}

async function test2_specificRestaurant() {
  // Use a well-known chain to avoid location bias noise.
  const data = await searchText({
    textQuery: "Starbucks Reserve Roastery",
    maxResultCount: 5,
    locationBias: { circle: { center: { latitude: LAT, longitude: LNG }, radius: 50000 } },
  });
  const places = data.places || [];
  if (VERBOSE) console.log("   first:", places[0]?.displayName?.text);
  const matched = places.some((p) => /starbucks/i.test(p.displayName?.text || ""));
  report("2. Specific restaurant name match (Starbucks Reserve)", matched, `${places.length} results`);
}

async function test3_bestOfCuisine() {
  const data = await searchText({
    textQuery: "best italian",
    includedType: "italian_restaurant",
    minRating: 4.5,
    maxResultCount: 10,
    locationBias: { circle: { center: { latitude: LAT, longitude: LNG }, radius: 15000 } },
  });
  const places = data.places || [];
  if (VERBOSE)
    console.log(
      "   first:",
      places[0]?.displayName?.text,
      "rating=" + places[0]?.rating
    );
  const allHighRated = places.length > 0 && places.every((p) => (p.rating || 0) >= 4.5);
  report(
    "3. Best-of-cuisine + minRating 4.5 → every result ≥ 4.5",
    allHighRated,
    `${places.length} results`
  );
}

async function test4_priceFilter() {
  const data = await searchText({
    textQuery: "restaurant",
    priceLevels: ["PRICE_LEVEL_MODERATE"],
    maxResultCount: 10,
    locationBias: { circle: { center: { latitude: LAT, longitude: LNG }, radius: 10000 } },
  });
  const places = data.places || [];
  const allModerate =
    places.length > 0 &&
    places.every((p) => !p.priceLevel || p.priceLevel === "PRICE_LEVEL_MODERATE");
  if (VERBOSE) console.log("   levels:", places.map((p) => p.priceLevel));
  report(
    "4. priceLevels=MODERATE → every priced result is MODERATE",
    allModerate,
    `${places.length} results`
  );
}

async function test5_openNow() {
  const data = await searchText({
    textQuery: "restaurant",
    openNow: true,
    maxResultCount: 10,
    locationBias: { circle: { center: { latitude: LAT, longitude: LNG }, radius: 10000 } },
  });
  const places = data.places || [];
  // openNow filter means Google returns only places currently open. We can't
  // easily re-verify "open right now" from the response alone, but every
  // result should at least have opening-hours populated.
  const allHaveHours =
    places.length > 0 &&
    places.every((p) => p.regularOpeningHours || p.currentOpeningHours);
  report(
    "5. openNow=true → every result has hours populated",
    allHaveHours,
    `${places.length} results`
  );
}

async function test6_radius() {
  const radiusMeters = 5000;
  const data = await searchText({
    textQuery: "coffee",
    maxResultCount: 10,
    locationRestriction: {
      circle: { center: { latitude: LAT, longitude: LNG }, radius: radiusMeters },
    },
  });
  const places = data.places || [];
  const allInRadius =
    places.length > 0 &&
    places.every((p) => {
      const plat = p.location?.latitude;
      const plng = p.location?.longitude;
      if (plat == null || plng == null) return false;
      return km(LAT, LNG, plat, plng) * 1000 <= radiusMeters + 200; // 200m slack
    });
  report(
    "6. locationRestriction radius 5km → all results within 5km",
    allInRadius,
    `${places.length} results`
  );
}

async function main() {
  console.log(`🔍 Auditing Google Places API at (${LAT}, ${LNG})\n`);
  try {
    await test1_specificDish();
    await test2_specificRestaurant();
    await test3_bestOfCuisine();
    await test4_priceFilter();
    await test5_openNow();
    await test6_radius();
  } catch (e) {
    console.error(`\n💥 Audit aborted: ${e.message}`);
    process.exit(2);
  }
  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
