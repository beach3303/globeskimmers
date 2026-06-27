import React, { useState, useEffect, useCallback } from "react";
import { fetchCulture } from "@/lib/callWorker";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Loader2, Navigation, RefreshCw, ChevronLeft, Compass, AlertTriangle, ExternalLink } from "lucide-react";
import { CAT, IVORY, TEAL_GRADIENT } from "@/components/redesign/constants";
import { motion } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";

// ============================================================================
// Cultural Info — two-layer (Country / City / Nearby Region) traveler guide.
//
// Caching lives SERVER-SIDE in the Cloudflare Worker (`/culture`, shared KV,
// per-section TTL + stale-while-revalidate). This file owns the SECTION CATALOG
// — the prompts, JSON schemas, and per-section TTLs — so content can be tuned
// without redeploying the Worker. Each catalog bundle = one cached Haiku call.
//
// Honest sourcing: the Worker stamps REAL last_verified_at / expires_at and
// returns source_url=null (Haiku has no web grounding). Volatile bundles
// (city leadership 1d, travel advisory 1d, safety 30d, national leadership 30d)
// show "May have changed — tap to refresh" when stale instead of posing as
// current. The ONLY real links are the curated government advisory list below.
// ============================================================================

const CACHE_VERSION = "v2";

// ---- small utils -----------------------------------------------------------
const slug = (s) =>
  String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";

const hasData = (v) => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "object") return Object.values(v).some(hasData);
  return true;
};

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return null;
  }
};

// Concurrency-limited runner — avoids firing ~20 Haiku calls at the Worker at
// once (rate limits / burst). Resolves when all tasks finish.
async function runLimited(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        results[i] = { error: e?.message || "failed" };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return results;
}

// In-memory memo so re-opening the page within a session (remounts) doesn't
// refetch. The authoritative cache is the Worker KV; this only suppresses
// duplicate calls for ~15 min. forceRefresh bypasses it.
const _memo = new Map();
const MEMO_MS = 15 * 60 * 1000;

// Is a bundle's primary content empty? (→ trigger region fallback)
function isEmptyBundle(bundle, data) {
  if (!data) return true;
  const arrayFields = bundle.cards.flatMap((c) => c.blocks).filter((b) => b.kind === "cards").map((b) => b.field);
  return !arrayFields.some((f) => hasData(data[f]));
}

// One-time migration: the old single-blob localStorage cache (culture_cache_v1_*)
// is superseded by the server-side KV cache (CACHE_VERSION v2). Purge it once.
function purgeLegacyCache() {
  try {
    if (CACHE_VERSION !== "v2") return;
    Object.keys(localStorage).filter((k) => k.startsWith("culture_cache_")).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* localStorage unavailable — nothing to purge */
  }
}

// ---- curated travel-advisory sources (the ONLY real source_urls) ----------
const ADVISORY_SOURCES = [
  { flag: "🇺🇸", label: "US", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" },
  { flag: "🇬🇧", label: "UK", url: "https://www.gov.uk/foreign-travel-advice" },
  { flag: "🇨🇦", label: "Canada", url: "https://travel.gc.ca/travelling/advisories" },
  { flag: "🇦🇺", label: "Australia", url: "https://www.smartraveller.gov.au/" },
];

// ---- schema helpers --------------------------------------------------------
const STR = { type: "string" };
const STRARR = { type: "array", items: { type: "string" } };
const objOf = (properties) => ({ type: "object", properties });
const arrOf = (properties) => ({ type: "array", items: { type: "object", properties } });

const HONESTY = (place) =>
  ` Return ONLY facts you are reasonably confident about for ${place}. If you don't know a field, use an empty array or null — do NOT invent names, places, dishes, or sources. Do not include any URLs or website links.`;

// item field sets reused across food / dessert / street / product / etc.
const FOOD_ITEM = {
  name: STR, local_name: STR, short_description: STR, why_this_city_is_known_for_it: STR,
  main_ingredients: STRARR, flavor_tags: STRARR, spice_level: STR, sweetness_level: STR,
  common_meal_time: STR, where_to_try: STR, price_level: STR, beginner_friendly: { type: "boolean" },
  traveler_tip: STR,
};
const DESSERT_ITEM = {
  name: STR, local_name: STR, short_description: STR, main_ingredients: STRARR,
  texture_tags: STRARR, flavor_tags: STRARR, sweetness_level: STR, where_to_try: STR,
  best_time_or_season: STR, traveler_tip: STR,
};
const STREET_ITEM = {
  name: STR, local_name: STR, description: STR, where_to_find: STR, price_level: STR,
  flavor_tags: STRARR, spice_level: STR, beginner_friendly: { type: "boolean" },
  vegetarian_possible: { type: "boolean" }, food_safety_tip: STR, traveler_tip: STR,
};
const PRODUCT_ITEM = {
  name: STR, local_name: STR, category: STR, short_description: STR, why_worth_buying_here: STR,
  is_city_brag: { type: "boolean" }, is_quality_buy: { type: "boolean" },
  is_cheaper_locally: { type: "boolean" }, is_good_souvenir: { type: "boolean" },
  quality_level: STR, price_advantage: STR, best_places_to_buy: STR, customs_warning: STR, traveler_tip: STR,
};
const ATTRACTION_ITEM = {
  rank: { type: "number" }, name: STR, neighborhood_or_area: STR, type: STR, why_it_matters: STR,
  best_time_to_visit: STR, recommended_duration: STR, ticket_or_reservation_note: STR,
  crowd_level: STR, safety_note: STR, photo_tip: STR, family_friendly: { type: "boolean" }, traveler_tip: STR,
};
const NATURE_ITEM = {
  name: STR, distance_from_city: STR, type: STR, why_visit: STR, best_time_or_season: STR,
  recommended_duration: STR, difficulty_level: STR, family_friendly: { type: "boolean" },
  creator_photo_tip: STR, safety_note: STR, traveler_tip: STR,
};
const ANIMAL_ITEM = {
  name: STR, local_name: STR, animal_type: STR, short_description: STR, where_seen: STR,
  likelihood: STR, best_time_or_season: STR, safety_note: STR, conservation_note: STR,
};

// ============================================================================
// SECTION CATALOG. layer ∈ country | city. Each bundle is one cached Haiku call.
// `cards` describe presentation; a card/block renders only when it has data.
// `fallback: true` → if the city bundle comes back empty, refetch at region
// scope and show under "Nearby Region".
// ============================================================================
const COUNTRY_BUNDLES = [
  {
    id: "country_basics", layer: "country", ttlDays: 365,
    prompt: (p) => `Provide national cultural basics for ${p}: a short national_food_culture summary, a short national_pride summary, the national motto (original + english), religion breakdown (name + % share, highest first), the official language, common second languages, an english_level expectation for travelers, the writing system, and 4-6 basic greetings (phrase + meaning), plus the country's most famous products/exports.${HONESTY(p)}`,
    schema: objOf({
      national_food_culture: STR, national_pride: STR, motto: STR, motto_english: STR,
      religion: arrOf({ name: STR, percentage: STR }),
      official_language: STR, common_second_languages: STRARR, english_level: STR, writing_system: STR,
      basic_greetings: arrOf({ phrase: STR, meaning: STR }), major_products_exports: STRARR,
    }),
    cards: [
      { id: "about", title: "About the Country", icon: "🌎", blocks: [
        { kind: "text", field: "national_food_culture", label: "Food culture" },
        { kind: "text", field: "national_pride", label: "National pride" },
        { kind: "motto", field: "motto" },
      ] },
      { id: "religion", title: "Religion", icon: "🕌", blocks: [{ kind: "pairs", field: "religion" }] },
      { id: "lang", title: "Language", icon: "🗣️", blocks: [
        { kind: "kv", fields: [{ label: "Official", field: "official_language" }, { label: "English", field: "english_level" }, { label: "Writing", field: "writing_system" }] },
        { kind: "chips", field: "common_second_languages", label: "Also spoken" },
        { kind: "phrases", field: "basic_greetings", label: "Basic greetings" },
      ] },
      { id: "products", title: "Famous Products & Exports", icon: "🛍️", blocks: [{ kind: "chips", field: "major_products_exports" }] },
    ],
  },
  {
    id: "country_food", layer: "country", ttlDays: 365,
    prompt: (p) => `Provide national cuisine for ${p}: 5-7 national_dishes (name, description, key main_ingredients, a fun_fact), 4-6 national_desserts (name, description), and 4-6 national_street_foods (name, description).${HONESTY(p)}`,
    schema: objOf({
      national_dishes: arrOf({ name: STR, description: STR, main_ingredients: STRARR, fun_fact: STR }),
      national_desserts: arrOf({ name: STR, description: STR }),
      national_street_foods: arrOf({ name: STR, description: STR }),
    }),
    cards: [
      { id: "dishes", title: "National Dishes", icon: "🍽️", blocks: [{ kind: "cards", field: "national_dishes" }] },
      { id: "desserts", title: "National Desserts & Sweets", icon: "🍰", blocks: [{ kind: "cards", field: "national_desserts" }] },
      { id: "street", title: "National Street Food", icon: "🍢", blocks: [{ kind: "cards", field: "national_street_foods" }] },
    ],
  },
  {
    id: "country_lore", layer: "country", ttlDays: 365,
    prompt: (p) => `Provide national heritage for ${p}: 3-5 history_highlights (name, description, significance), 1-3 national_heroes (name, description, accomplishments list), and 4-6 major festivals (name, date, description).${HONESTY(p)}`,
    schema: objOf({
      history_highlights: arrOf({ name: STR, description: STR, significance: STR }),
      national_heroes: arrOf({ name: STR, description: STR, accomplishments: STRARR }),
      festivals: arrOf({ name: STR, date: STR, description: STR }),
    }),
    cards: [
      { id: "history", title: "History", icon: "📜", blocks: [{ kind: "cards", field: "history_highlights" }] },
      { id: "heroes", title: "National Heroes", icon: "🏅", blocks: [{ kind: "cards", field: "national_heroes" }] },
      { id: "festivals", title: "Festivals & Celebrations", icon: "🎉", blocks: [{ kind: "cards", field: "festivals" }] },
    ],
  },
  {
    id: "country_nature", layer: "country", ttlDays: 365,
    prompt: (p) => `Provide nature, climate and etiquette for ${p}: climate (type, best_time_to_visit, what_to_pack list), 3-5 nature_icons (name, description, activities list), 5-7 iconic wildlife species (name, description), and cultural etiquette as do / dont lists (4-6 each).${HONESTY(p)}`,
    schema: objOf({
      climate: objOf({ type: STR, best_time_to_visit: STR, what_to_pack: STRARR }),
      nature_icons: arrOf({ name: STR, description: STR, activities: STRARR }),
      wildlife: arrOf({ name: STR, description: STR }),
      etiquette: objOf({ do: STRARR, dont: STRARR }),
    }),
    cards: [
      { id: "climate", title: "Climate", icon: "☀️", blocks: [
        { kind: "kv", fields: [{ label: "Climate", field: "type" }, { label: "Best time", field: "best_time_to_visit" }] },
        { kind: "chips", field: "what_to_pack", label: "What to pack" },
      ] },
      { id: "nature", title: "Nature Icons", icon: "🌿", blocks: [{ kind: "cards", field: "nature_icons" }] },
      { id: "wildlife", title: "Wildlife", icon: "🦜", blocks: [{ kind: "cards", field: "wildlife" }] },
      { id: "etiquette", title: "Etiquette", icon: "🤝", blocks: [{ kind: "dodont", field: "etiquette" }] },
    ],
  },
  {
    id: "country_leadership", layer: "country", ttlDays: 30, volatile: true,
    prompt: (p) => `List the current top national leaders of ${p} (3-5): for each give position (e.g. President, Prime Minister, Monarch), full name, and a short title. Use full names and proper titles.${HONESTY(p)}`,
    schema: objOf({ leaders: arrOf({ position: STR, name: STR, title: STR }) }),
    cards: [{ id: "leaders", title: "National Leadership", icon: "🏛️", blocks: [{ kind: "leaders", field: "leaders" }] }],
  },
  {
    id: "country_safety", layer: "country", ttlDays: 30, volatile: true,
    prompt: (p) => `Provide a traveler safety overview for ${p}: a short overview, 3-6 common_scams travelers face, and 3-6 general safety_tips.${HONESTY(p)}`,
    schema: objOf({ overview: STR, common_scams: STRARR, safety_tips: STRARR }),
    cards: [{ id: "safety", title: "Safety", icon: "🛟", blocks: [
      { kind: "text", field: "overview" },
      { kind: "bullets", field: "common_scams", label: "Common scams" },
      { kind: "bullets", field: "safety_tips", label: "Safety tips" },
    ] }],
  },
  {
    id: "country_advisory", layer: "country", ttlDays: 1, volatile: true,
    prompt: (p) => `Summarize the general travel advisory picture for ${p} for international travelers: an overall_level (e.g. "Exercise normal precautions" / "Increased caution" / "Reconsider travel"), a 1-2 sentence summary, 3-6 key_risks, areas_to_avoid (if any), and brief entry_exit_notes. This is a general summary, not official guidance.${HONESTY(p)}`,
    schema: objOf({ overall_level: STR, summary: STR, key_risks: STRARR, areas_to_avoid: STRARR, entry_exit_notes: STR }),
    cards: [{ id: "advisory", title: "Travel Advisory", icon: "⚠️", kind: "advisory", blocks: [] }],
  },
];

const CITY_BUNDLES = [
  {
    id: "city_food", layer: "city", ttlDays: 365,
    summary: "What this city is known for eating.",
    prompt: (p) => `Provide the best local food in ${p}: up to 10 top_10_city_foods (each: name, local_name, short_description, why_this_city_is_known_for_it, main_ingredients, flavor_tags, spice_level, common_meal_time, where_to_try, price_level, beginner_friendly), 3-6 local_specialty_dishes (name, description), best_breakfast_foods, casual_meals, 2-4 food_districts (name, neighborhood_or_area, short_description), 2-4 food_markets (name, short_description, where_to_try), 3-6 local_drinks (name, short_description), and beginner_friendly_foods.${HONESTY(p)}`,
    schema: objOf({
      top_10_city_foods: arrOf(FOOD_ITEM),
      local_specialty_dishes: arrOf({ name: STR, description: STR }),
      best_breakfast_foods: STRARR, casual_meals: STRARR,
      food_districts: arrOf({ name: STR, neighborhood_or_area: STR, short_description: STR }),
      food_markets: arrOf({ name: STR, short_description: STR, where_to_try: STR }),
      local_drinks: arrOf({ name: STR, short_description: STR }), beginner_friendly_foods: STRARR,
    }),
    cards: [{ id: "food", title: "Best Food in This City", icon: "🍽️", summaryField: true, blocks: [
      { kind: "cards", field: "top_10_city_foods" },
      { kind: "cards", field: "local_specialty_dishes", label: "Local specialties" },
      { kind: "chips", field: "best_breakfast_foods", label: "Best breakfast" },
      { kind: "chips", field: "casual_meals", label: "Casual meals" },
      { kind: "cards", field: "food_districts", label: "Food districts" },
      { kind: "cards", field: "food_markets", label: "Food markets" },
      { kind: "cards", field: "local_drinks", label: "Local drinks" },
      { kind: "chips", field: "beginner_friendly_foods", label: "Beginner-friendly" },
    ] }],
  },
  {
    id: "city_desserts", layer: "city", ttlDays: 365,
    prompt: (p) => `Provide desserts, bakeries & pastries for ${p}: up to 8 top_city_desserts (name, local_name, short_description, main_ingredients, texture_tags, flavor_tags, sweetness_level, where_to_try, best_time_or_season, traveler_tip), 3-6 local_pastries (name, description), 3-6 traditional_sweets (name, description), a short bakery_cafe_notes, seasonal_desserts, festival_sweets, and grocery_store_sweets worth trying.${HONESTY(p)}`,
    schema: objOf({
      top_city_desserts: arrOf(DESSERT_ITEM),
      local_pastries: arrOf({ name: STR, description: STR }),
      traditional_sweets: arrOf({ name: STR, description: STR }),
      bakery_cafe_notes: STR, seasonal_desserts: STRARR, festival_sweets: STRARR, grocery_store_sweets: STRARR,
    }),
    cards: [{ id: "desserts", title: "Desserts, Bakeries & Pastries", icon: "🍰", blocks: [
      { kind: "cards", field: "top_city_desserts" },
      { kind: "cards", field: "local_pastries", label: "Local pastries" },
      { kind: "cards", field: "traditional_sweets", label: "Traditional sweets" },
      { kind: "text", field: "bakery_cafe_notes", label: "Bakeries & cafés" },
      { kind: "chips", field: "seasonal_desserts", label: "Seasonal" },
      { kind: "chips", field: "festival_sweets", label: "Festival sweets" },
      { kind: "chips", field: "grocery_store_sweets", label: "From the store" },
    ] }],
  },
  {
    id: "city_streetfood", layer: "city", ttlDays: 365,
    prompt: (p) => `Provide the street food & snack trail for ${p}: up to 10 top_10_city_street_foods (name, local_name, description, where_to_find, price_level, flavor_tags, spice_level, beginner_friendly, vegetarian_possible, food_safety_tip), top_10_local_snacks (name, description), street_drinks, night_market_foods, convenience_store_snacks, safe_first_street_food for beginners, and 2-4 food_safety_notes.${HONESTY(p)}`,
    schema: objOf({
      top_10_city_street_foods: arrOf(STREET_ITEM),
      top_10_local_snacks: arrOf({ name: STR, description: STR }),
      street_drinks: STRARR, night_market_foods: STRARR, convenience_store_snacks: STRARR,
      safe_first_street_food: STRARR, food_safety_notes: STRARR,
    }),
    cards: [{ id: "street", title: "Street Food & Snack Trail", icon: "🍢", blocks: [
      { kind: "cards", field: "top_10_city_street_foods" },
      { kind: "cards", field: "top_10_local_snacks", label: "Local snacks" },
      { kind: "chips", field: "street_drinks", label: "Street drinks" },
      { kind: "chips", field: "night_market_foods", label: "Night-market eats" },
      { kind: "chips", field: "convenience_store_snacks", label: "Convenience-store snacks" },
      { kind: "chips", field: "safe_first_street_food", label: "Safe first tries" },
      { kind: "bullets", field: "food_safety_notes", label: "Food safety" },
    ] }],
  },
  {
    id: "city_products", layer: "city", ttlDays: 180, fallback: true,
    summary: "What this city or region is great at making and selling.",
    prompt: (p) => `Provide what ${p} is great at making, selling, crafting or producing: city_brags (proud local specialties), local_crafts, and best_souvenirs — for each product give name, local_name, category, short_description, why_worth_buying_here, is_city_brag, is_quality_buy, is_cheaper_locally, is_good_souvenir, quality_level (everyday|premium|luxury|artisan|export_grade), price_advantage, best_places_to_buy, and customs_warning if relevant. Also list local_brands, products_cheaper_locally, where_to_buy spots, authenticity_tips, and a tourist_markup_warning.${HONESTY(p)}`,
    schema: objOf({
      city_brags: arrOf(PRODUCT_ITEM), local_crafts: arrOf(PRODUCT_ITEM), best_souvenirs: arrOf(PRODUCT_ITEM),
      local_brands: STRARR, products_cheaper_locally: STRARR, where_to_buy: STRARR,
      authenticity_tips: STRARR, tourist_markup_warning: STR,
    }),
    cards: [{ id: "products", title: "Made Here: Brags & Best Buys", icon: "🛍️", summaryField: true, blocks: [
      { kind: "cards", field: "city_brags", label: "City brags" },
      { kind: "cards", field: "local_crafts", label: "Local crafts" },
      { kind: "cards", field: "best_souvenirs", label: "Best souvenirs" },
      { kind: "chips", field: "local_brands", label: "Local brands" },
      { kind: "chips", field: "products_cheaper_locally", label: "Cheaper locally" },
      { kind: "chips", field: "where_to_buy", label: "Where to buy" },
      { kind: "bullets", field: "authenticity_tips", label: "Spotting the real thing" },
      { kind: "warn", field: "tourist_markup_warning", label: "Tourist markup" },
    ] }],
  },
  {
    id: "city_attractions", layer: "city", ttlDays: 180,
    summary: "The places worth your time here.",
    prompt: (p) => `Provide the top must-visit places in ${p}: up to 10 top_10_city_attractions (rank, name, neighborhood_or_area, type, why_it_matters, best_time_to_visit, recommended_duration, ticket_or_reservation_note, crowd_level, safety_note, photo_tip, family_friendly), 3-6 hidden_gems (name, why_it_matters, neighborhood_or_area), and a tourist_trap_warning.${HONESTY(p)}`,
    schema: objOf({
      top_10_city_attractions: arrOf(ATTRACTION_ITEM),
      hidden_gems: arrOf({ name: STR, why_it_matters: STR, neighborhood_or_area: STR }),
      tourist_trap_warning: STR,
    }),
    cards: [{ id: "attractions", title: "Must-Visit Places", icon: "📍", summaryField: true, blocks: [
      { kind: "cards", field: "top_10_city_attractions" },
      { kind: "cards", field: "hidden_gems", label: "Hidden gems" },
      { kind: "warn", field: "tourist_trap_warning", label: "Tourist-trap warning" },
    ] }],
  },
  {
    id: "city_nature", layer: "city", ttlDays: 180, fallback: true,
    prompt: (p) => `Provide nature near ${p}: nearby_nature_icons (name, distance_from_city, type, why_visit, best_time_or_season, recommended_duration, difficulty_level, family_friendly, creator_photo_tip, safety_note), plus day_trips (name, distance_from_city, why_visit), best_months, months_to_avoid, a shoe_recommendation, clothing_recommendation, a safety_warning, and whether a permit_required.${HONESTY(p)}`,
    schema: objOf({
      nearby_nature_icons: arrOf(NATURE_ITEM),
      day_trips: arrOf({ name: STR, distance_from_city: STR, why_visit: STR }),
      best_months: STRARR, months_to_avoid: STRARR, shoe_recommendation: STR,
      clothing_recommendation: STR, safety_warning: STR, permit_required: STR,
    }),
    cards: [{ id: "nature", title: "Nature Near This City", icon: "🌿", blocks: [
      { kind: "cards", field: "nearby_nature_icons" },
      { kind: "cards", field: "day_trips", label: "Best day trips" },
      { kind: "chips", field: "best_months", label: "Best months" },
      { kind: "chips", field: "months_to_avoid", label: "Months to avoid" },
      { kind: "kv", fields: [{ label: "Shoes", field: "shoe_recommendation" }, { label: "Clothing", field: "clothing_recommendation" }, { label: "Permit", field: "permit_required" }] },
      { kind: "warn", field: "safety_warning", label: "Safety" },
    ] }],
  },
  {
    id: "city_wildlife", layer: "city", ttlDays: 180, fallback: true,
    note: "Travelers may see these — sightings are never guaranteed.",
    prompt: (p) => `Provide wildlife travelers might realistically encounter in or near ${p}: common_city_animals and nearby_wildlife (each: name, local_name, animal_type, short_description, where_seen, likelihood [common|possible|rare], best_time_or_season, safety_note, conservation_note), marine_life_nearby, birds, insects_or_mosquito_notes, dangerous_animals (name, description, safety_note), best_wildlife_areas_nearby, best_season, and responsible_wildlife_rules. Never guarantee sightings.${HONESTY(p)}`,
    schema: objOf({
      common_city_animals: arrOf(ANIMAL_ITEM), nearby_wildlife: arrOf(ANIMAL_ITEM),
      marine_life_nearby: STRARR, birds: STRARR, insects_or_mosquito_notes: STR,
      dangerous_animals: arrOf({ name: STR, description: STR, safety_note: STR }),
      best_wildlife_areas_nearby: STRARR, best_season: STR, responsible_wildlife_rules: STRARR,
    }),
    cards: [{ id: "wildlife", title: "Wildlife You Might See Nearby", icon: "🐒", noteField: true, blocks: [
      { kind: "cards", field: "common_city_animals", label: "Around the city" },
      { kind: "cards", field: "nearby_wildlife", label: "On day trips nearby" },
      { kind: "chips", field: "marine_life_nearby", label: "Marine life" },
      { kind: "chips", field: "birds", label: "Birds" },
      { kind: "cards", field: "dangerous_animals", label: "Be careful around" },
      { kind: "text", field: "insects_or_mosquito_notes", label: "Insects & mosquitoes" },
      { kind: "chips", field: "best_wildlife_areas_nearby", label: "Best areas" },
      { kind: "bullets", field: "responsible_wildlife_rules", label: "Watch responsibly" },
    ] }],
  },
  {
    id: "city_local", layer: "city", ttlDays: 365,
    prompt: (p) => `Provide language and dialect notes for ${p}: the local_dialect, accent_notes, how it differs from the national language (difference_from_national), and useful_phrases, food_ordering_phrases, and politeness_phrases (each a phrase + meaning).${HONESTY(p)}`,
    schema: objOf({
      local_dialect: STR, accent_notes: STR, difference_from_national: STR,
      useful_phrases: arrOf({ phrase: STR, meaning: STR }),
      food_ordering_phrases: arrOf({ phrase: STR, meaning: STR }),
      politeness_phrases: arrOf({ phrase: STR, meaning: STR }),
    }),
    cards: [{ id: "local", title: "Language, Dialect & Local Phrases", icon: "🗣️", blocks: [
      { kind: "kv", fields: [{ label: "Local dialect", field: "local_dialect" }, { label: "Accent", field: "accent_notes" }] },
      { kind: "text", field: "difference_from_national", label: "Different from the national language" },
      { kind: "phrases", field: "useful_phrases", label: "Useful phrases" },
      { kind: "phrases", field: "food_ordering_phrases", label: "Ordering food" },
      { kind: "phrases", field: "politeness_phrases", label: "Being polite" },
    ] }],
  },
  {
    id: "city_facts", layer: "city", ttlDays: 180,
    prompt: (p) => `Provide getting-around info and local facts for ${p}: a transport_overview of how locals get around, transport_tips (etiquette/behavior travelers should know — fares, tipping, ride-hail norms, tap-on/off), getting_around modes available, and the approximate city_population.${HONESTY(p)}`,
    schema: objOf({ transport_overview: STR, transport_tips: STRARR, getting_around: STRARR, city_population: STR }),
    cards: [{ id: "facts", title: "Getting Around & Local Facts", icon: "🚉", blocks: [
      { kind: "text", field: "transport_overview" },
      { kind: "chips", field: "getting_around", label: "How to get around" },
      { kind: "bullets", field: "transport_tips", label: "Transport tips" },
      { kind: "stat", field: "city_population", label: "City population (approx.)" },
    ] }],
  },
  {
    id: "city_rhythm", layer: "city", ttlDays: 90,
    prompt: (p) => `Provide dining hours and late-night food info for ${p}: a dining_hours_overview, typical_meal_times, late_night_food (name, where_to_find, hours_note), late_night_areas, and a things_closing_early_warning if relevant.${HONESTY(p)}`,
    schema: objOf({
      dining_hours_overview: STR, typical_meal_times: STR,
      late_night_food: arrOf({ name: STR, where_to_find: STR, hours_note: STR }),
      late_night_areas: STRARR, things_closing_early_warning: STR,
    }),
    cards: [{ id: "rhythm", title: "Dining Hours & Late-Night Eats", icon: "🕘", blocks: [
      { kind: "text", field: "dining_hours_overview" },
      { kind: "kv", fields: [{ label: "Typical meal times", field: "typical_meal_times" }] },
      { kind: "cards", field: "late_night_food", label: "Late-night eats" },
      { kind: "chips", field: "late_night_areas", label: "Late-night areas" },
      { kind: "warn", field: "things_closing_early_warning", label: "Closes early" },
    ] }],
  },
  {
    id: "city_safety", layer: "city", ttlDays: 30, volatile: true,
    prompt: (p) => `Provide neighborhood safety and scams for ${p}: a short overview, common_scams (name, description, how_to_avoid), neighborhoods_to_be_careful, general_safety_tips, and the local emergency_number.${HONESTY(p)}`,
    schema: objOf({
      overview: STR, common_scams: arrOf({ name: STR, description: STR, how_to_avoid: STR }),
      neighborhoods_to_be_careful: STRARR, general_safety_tips: STRARR, emergency_number: STR,
    }),
    cards: [{ id: "safety", title: "Neighborhood Safety & Scams", icon: "🛟", blocks: [
      { kind: "text", field: "overview" },
      { kind: "cards", field: "common_scams", label: "Common scams" },
      { kind: "chips", field: "neighborhoods_to_be_careful", label: "Be extra alert in" },
      { kind: "bullets", field: "general_safety_tips", label: "Safety tips" },
      { kind: "stat", field: "emergency_number", label: "Emergency number" },
    ] }],
  },
  {
    id: "city_gov", layer: "city", ttlDays: 7, volatile: true,
    cadenceNote: "Leadership info is refreshed about weekly — tap refresh for the latest.",
    prompt: (p) => `List current local government leaders for ${p} (use full names + proper titles): the mayor, deputy/vice mayor, and the governor or regional leader if relevant, plus city_council_or_equivalent members. Provide them as a leaders list (title, name).${HONESTY(p)}`,
    schema: objOf({ leaders: arrOf({ title: STR, name: STR }), city_council_or_equivalent: STRARR }),
    cards: [{ id: "gov", title: "City Leadership & Government", icon: "🏛️", blocks: [
      { kind: "leaders", field: "leaders" },
      { kind: "chips", field: "city_council_or_equivalent", label: "Council / local body" },
    ] }],
  },
];

// ============================================================================
// Presentational components
// ============================================================================
function Badge({ children, tone = "teal" }) {
  const tones = {
    teal: "bg-teal-50 text-teal-700", amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700", rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700", slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[calc(10px*var(--fs))] font-semibold ${tones[tone] || tones.teal}`}>{children}</span>;
}

function ChipRow({ items, tone = "teal" }) {
  const tones = { teal: "bg-teal-50 text-teal-700", green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700" };
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.filter(hasData).map((it, i) => (
        <span key={i} className={`px-2.5 py-1 rounded-full text-[calc(11px*var(--fs))] ${tones[tone] || tones.teal}`}>{it}</span>
      ))}
    </div>
  );
}

// Badges derived from an item's boolean / category fields.
function itemBadges(it) {
  const out = [];
  if (it.is_city_brag) out.push(["City Brag", "amber"]);
  if (it.is_quality_buy) out.push(["Quality Buy", "violet"]);
  if (it.is_cheaper_locally || it.price_advantage === "cheaper_locally") out.push(["Cheaper Locally", "green"]);
  if (it.is_good_souvenir) out.push(["Great Gift", "teal"]);
  if (it.beginner_friendly) out.push(["Beginner-Friendly", "green"]);
  if (it.family_friendly) out.push(["Family Friendly", "teal"]);
  if (it.vegetarian_possible) out.push(["Veg Possible", "green"]);
  if (hasData(it.creator_photo_tip) || hasData(it.photo_tip)) out.push(["Creator Friendly", "violet"]);
  if (hasData(it.customs_warning)) out.push(["Check Customs", "rose"]);
  if (it.likelihood === "common") out.push(["Commonly Seen", "green"]);
  if (it.quality_level) out.push([it.quality_level.replace(/_/g, " "), "slate"]);
  return out;
}

// Generic rich item card — renders whichever optional fields are present.
function ItemCard({ it }) {
  const title = it.name || it.term || "";
  const desc = it.short_description || it.description || it.why_visit || it.why_it_matters || it.why_worth_buying_here || it.why_this_city_is_known_for_it;
  const chips = [it.flavor_tags, it.texture_tags, it.main_ingredients, it.activities].filter(Array.isArray).flat().filter(hasData);
  const scalarChips = [
    it.spice_level && `🌶 ${it.spice_level}`, it.sweetness_level && `🍬 ${it.sweetness_level}`,
    it.price_level && `💰 ${it.price_level}`, it.difficulty_level && `⛰ ${it.difficulty_level}`,
    it.crowd_level && `👥 ${it.crowd_level}`, it.common_meal_time, it.best_time_to_visit || it.best_time_or_season,
    it.recommended_duration, it.distance_from_city && `📍 ${it.distance_from_city}`, it.type, it.category, it.animal_type,
    it.likelihood && it.likelihood !== "common" && `${it.likelihood} to see`,
  ].filter(hasData);
  const where = it.where_to_try || it.where_to_find || it.where_to_buy || it.best_places_to_buy || it.neighborhood_or_area || it.where_seen;
  const tip = it.traveler_tip || it.local_tip;
  const safety = it.safety_note || it.food_safety_tip || it.how_to_avoid;
  const photo = it.photo_tip || it.creator_photo_tip;
  const badges = itemBadges(it);
  return (
    <div className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        {hasData(it.rank) && <span className="text-xs font-bold text-gray-400">#{it.rank}</span>}
        <p className="font-semibold text-gray-900">{title}</p>
        {hasData(it.local_name) && it.local_name !== title && <span className="text-sm italic text-gray-500">{it.local_name}</span>}
      </div>
      {hasData(desc) && <p className="text-sm text-gray-600 mt-0.5">{desc}</p>}
      {badges.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1.5">{badges.map(([t, tone], i) => <Badge key={i} tone={tone}>{t}</Badge>)}</div>}
      {scalarChips.length > 0 && <p className="text-[calc(11px*var(--fs))] text-gray-500 mt-1.5">{scalarChips.join(" · ")}</p>}
      {chips.length > 0 && <div className="mt-1.5"><ChipRow items={chips} /></div>}
      {Array.isArray(it.accomplishments) && it.accomplishments.filter(hasData).length > 0 && (
        <ul className="mt-1.5 space-y-1">{it.accomplishments.filter(hasData).map((a, i) => (
          <li key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-teal-600 font-bold">•</span><span>{a}</span></li>
        ))}</ul>
      )}
      {hasData(it.significance) && <p className="text-xs text-teal-600 mt-1">{it.significance}</p>}
      {hasData(it.fun_fact) && <p className="text-xs text-amber-600 mt-1 italic">💡 {it.fun_fact}</p>}
      {hasData(where) && <p className="text-xs text-gray-500 mt-1">📍 {where}</p>}
      {hasData(it.ticket_or_reservation_note) && <p className="text-xs text-gray-500 mt-0.5">🎟 {it.ticket_or_reservation_note}</p>}
      {hasData(it.hours_note) && <p className="text-xs text-gray-500 mt-0.5">🕘 {it.hours_note}</p>}
      {hasData(it.conservation_note) && <p className="text-xs text-green-700 mt-0.5">🌱 {it.conservation_note}</p>}
      {hasData(safety) && <p className="text-xs text-rose-600 mt-1">⚠️ {safety}</p>}
      {hasData(photo) && <p className="text-xs text-violet-600 mt-0.5">📸 {photo}</p>}
      {hasData(tip) && <p className="text-xs text-gray-600 mt-1 italic">💡 {tip}</p>}
    </div>
  );
}

// Renders one block within a card. Returns null when the block has no data.
function Block({ block, data }) {
  const { kind, field, label } = block;
  if (kind === "kv") {
    const rows = (block.fields || []).filter((f) => hasData(data[f.field]));
    if (!rows.length) return null;
    return (
      <div className="space-y-1.5">
        {rows.map((f, i) => (
          <div key={i} className="text-sm"><span className="text-gray-500">{f.label}: </span><span className="font-medium text-gray-900">{data[f.field]}</span></div>
        ))}
      </div>
    );
  }
  const val = data[field];
  if (!hasData(val)) return null;
  const Label = label ? <p className="text-[calc(10.5px*var(--fs))] uppercase tracking-wide font-semibold text-gray-400 mb-1.5">{label}</p> : null;
  switch (kind) {
    case "text":
      return <div>{Label}<p className="text-sm text-gray-700">{val}</p></div>;
    case "motto":
      return <div><p className="text-sm text-gray-700 italic">“{val}”</p>{hasData(data.motto_english) && <p className="text-xs text-gray-500 mt-0.5">{data.motto_english}</p>}</div>;
    case "stat":
      return <div className="text-sm"><span className="text-gray-500">{label}: </span><span className="font-semibold text-gray-900">{val}</span></div>;
    case "warn":
      return <div className="flex items-start gap-2 bg-rose-50 rounded-lg p-2.5"><AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" /><p className="text-xs text-rose-700">{label ? <b>{label}: </b> : null}{val}</p></div>;
    case "chips":
      return <div>{Label}<ChipRow items={val} /></div>;
    case "bullets":
      return <div>{Label}<ul className="space-y-1.5">{val.filter(hasData).map((b, i) => (
        <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-teal-500 font-bold text-xs mt-0.5">•</span><span>{b}</span></li>
      ))}</ul></div>;
    case "pairs":
      return <div>{Label}<div className="space-y-2">{val.filter(hasData).map((p, i) => (
        <div key={i} className="flex justify-between items-center text-sm"><span className="text-gray-700">{p.name || p.term || p.label}</span><span className="font-semibold text-gray-900">{p.percentage || p.value}</span></div>
      ))}</div></div>;
    case "phrases":
      return <div>{Label}<div className="space-y-1.5">{val.filter((p) => hasData(p.phrase)).map((p, i) => (
        <div key={i} className="text-sm"><span className="font-semibold text-gray-900">{p.phrase}</span>{hasData(p.meaning) && <span className="text-gray-500"> — {p.meaning}</span>}</div>
      ))}</div></div>;
    case "dodont":
      return (
        <div className="space-y-3">
          {hasData(val.do) && <div><p className="font-semibold text-green-600 mb-1.5 text-sm">✅ DO</p><ul className="space-y-1.5">{val.do.filter(hasData).map((r, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-green-500 font-bold text-xs mt-0.5">•</span><span>{r}</span></li>
          ))}</ul></div>}
          {hasData(val.dont) && <div className="pt-2 border-t border-gray-100"><p className="font-semibold text-rose-600 mb-1.5 text-sm">❌ DON'T</p><ul className="space-y-1.5">{val.dont.filter(hasData).map((r, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-rose-500 font-bold text-xs mt-0.5">•</span><span>{r}</span></li>
          ))}</ul></div>}
        </div>
      );
    case "leaders":
      return <div>{Label}<div className="space-y-2.5">{val.filter((l) => hasData(l.name)).map((l, i) => (
        <div key={i}><p className="text-xs text-gray-500">{l.position || l.title}</p><p className="font-semibold text-gray-900">{l.name}{hasData(l.title) && l.position ? ` · ${l.title}` : ""}</p></div>
      ))}</div></div>;
    case "cards":
      return <div>{Label}<div className="space-y-3">{val.filter((x) => hasData(x?.name)).map((it, i) => <ItemCard key={i} it={it} />)}</div></div>;
    default:
      return null;
  }
}

const ACCENT = { country: "from-amber-400 to-amber-500", city: "linear", region: "from-emerald-400 to-emerald-500" };

function FreshnessLine({ meta, volatile }) {
  if (!meta) return null;
  const updated = fmtDate(meta.last_verified_at);
  if (meta.stale && volatile) {
    return <p className="text-[calc(11px*var(--fs))] text-amber-600 font-medium mt-0.5">⚠️ May have changed — tap refresh</p>;
  }
  if (updated) return <p className="text-[calc(11px*var(--fs))] text-gray-400 mt-0.5">Updated {updated}</p>;
  return null;
}

function SectionCard({ card, bundle, state, onRefresh, layer }) {
  const data = state?.data || {};
  // Card renders only if at least one block has data (advisory always renders).
  const blocksWithData = (card.blocks || []).filter((b) =>
    b.kind === "kv" ? (b.fields || []).some((f) => hasData(data[f.field])) : hasData(data[b.field])
  );
  if (card.kind !== "advisory" && blocksWithData.length === 0 && state?.status !== "loading") return null;

  const isCity = layer === "city" || layer === "region";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {isCity ? <div className="h-1.5" style={{ background: TEAL_GRADIENT }} /> : <div className={`h-1.5 bg-gradient-to-r ${ACCENT[layer] || ACCENT.country}`} />}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><span className="text-xl">{card.icon}</span>{card.title}</h3>
            {card.summaryField && hasData(bundle.summary) && <p className="text-sm text-gray-500 mt-0.5">{bundle.summary}</p>}
            {card.noteField && hasData(bundle.note) && <p className="text-xs text-gray-500 italic mt-0.5">{bundle.note}</p>}
            {hasData(bundle.cadenceNote) && <p className="text-[calc(11px*var(--fs))] text-gray-500 mt-0.5">🔄 {bundle.cadenceNote}</p>}
            <FreshnessLine meta={state?.meta} volatile={bundle.volatile} />
          </div>
          <button onClick={onRefresh} disabled={state?.status === "loading"} title="Refresh this section"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${state?.status === "loading" ? "animate-spin" : ""}`} />
          </button>
        </div>

        {card.kind === "advisory" ? (
          <AdvisoryBody data={data} state={state} />
        ) : state?.status === "loading" && blocksWithData.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="space-y-4">{blocksWithData.map((b, i) => <Block key={i} block={b} data={data} />)}</div>
        )}
      </div>
    </motion.div>
  );
}

function AdvisoryBody({ data, state }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          <b>Advisories can change daily.</b> This summary refreshes only about once a day and may be behind today's situation. Before and during your trip, always check official travel guidance online — your government's travel advisory, linked below — for day-to-day accuracy.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ADVISORY_SOURCES.map((s) => (
          <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 border border-gray-200">
            <span>{s.flag}</span>{s.label}<ExternalLink size={10} className="text-gray-400" />
          </a>
        ))}
      </div>
      {state?.status === "loading" && !hasData(data.summary) ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-1"><Loader2 className="w-4 h-4 animate-spin" /> Loading summary…</div>
      ) : (
        <>
          {hasData(data.overall_level) && <p className="text-sm font-semibold text-gray-900">{data.overall_level}</p>}
          {hasData(data.summary) && <p className="text-sm text-gray-600">{data.summary}</p>}
          {hasData(data.key_risks) && <Block block={{ kind: "bullets", field: "key_risks", label: "Key risks" }} data={data} />}
          {hasData(data.areas_to_avoid) && <Block block={{ kind: "chips", field: "areas_to_avoid", label: "Areas to avoid" }} data={data} />}
          {hasData(data.entry_exit_notes) && <Block block={{ kind: "text", field: "entry_exit_notes", label: "Entry / exit" }} data={data} />}
        </>
      )}
    </div>
  );
}

function Divider({ icon, label, sublabel }) {
  return (
    <div className="pt-4 pb-1">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h2 className="text-[calc(16px*var(--fs))] font-extrabold tracking-tight text-[#0F1419]">{label}</h2>
      </div>
      {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================
export default function CultureInformationPage() {
  const navigate = useNavigate();
  const { activeLocation, locationMode, initialized, switchToCurrentLocation } = useLocation();
  const [loading, setLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [results, setResults] = useState({});       // bundleId -> { status, data, meta }
  const [regionResults, setRegionResults] = useState({}); // bundleId -> { status, data, meta }

  const geo = (() => {
    const a = activeLocation?.address || {};
    const country = a.country || "";
    const city = a.city || activeLocation?.placeName || "";
    const region = a.state || "";
    return { country, city, region };
  })();
  const countrySlug = slug(geo.country);
  const citySlug = slug(geo.city);
  const regionLabel = geo.region || (geo.city ? `${geo.city} area` : "");
  const regionSlug = slug(regionLabel);

  const placePhrase = useCallback((bundle, scope) => {
    if (scope === "region") return `the wider region/province around ${geo.city}, ${geo.country}`;
    if (bundle.layer === "country") return geo.country;
    return `${geo.city}, ${geo.country}`;
  }, [geo.city, geo.country]);

  const cacheKeyFor = useCallback((bundle, scope) => {
    if (scope === "region") return `region:${regionSlug}|${countrySlug}:${bundle.id}`;
    if (bundle.layer === "country") return `country:${countrySlug}:${bundle.id}`;
    return `city:${citySlug}|${countrySlug}:${bundle.id}`;
  }, [citySlug, countrySlug, regionSlug]);

  const fetchOne = useCallback(async (bundle, scope, force) => {
    const cacheKey = cacheKeyFor(bundle, scope);
    const memoKey = `${cacheKey}`;
    if (!force) {
      const m = _memo.get(memoKey);
      if (m && Date.now() - m.at < MEMO_MS) return { data: m.data, meta: m.meta, error: null };
    }
    const res = await fetchCulture({
      cacheKey, ttlDays: bundle.ttlDays, prompt: bundle.prompt(placePhrase(bundle, scope)),
      response_json_schema: bundle.schema, forceRefresh: !!force,
    });
    if (!res.error && res.data) _memo.set(memoKey, { data: res.data, meta: res.meta, at: Date.now() });
    return res;
  }, [cacheKeyFor, placePhrase]);

  const loadAll = useCallback(async (force = false) => {
    if (!geo.country) return;
    setLoading(true);
    const bundles = [...COUNTRY_BUNDLES, ...CITY_BUNDLES];
    setResults((prev) => {
      const next = { ...prev };
      bundles.forEach((b) => { next[b.id] = { ...(next[b.id] || {}), status: "loading" }; });
      return next;
    });

    await runLimited(bundles, 6, async (bundle) => {
      const res = await fetchOne(bundle, bundle.layer === "country" ? "country" : "city", force);
      setResults((prev) => ({ ...prev, [bundle.id]: res.error ? { status: "error", error: res.error } : { status: "ok", data: res.data, meta: res.meta } }));
      return res;
    });
    setLoading(false);

    // Region fallback for empty fallback-enabled city bundles.
    const fb = CITY_BUNDLES.filter((b) => b.fallback);
    await runLimited(fb, 4, async (bundle) => {
      const cur = await new Promise((r) => setResults((prev) => { r(prev[bundle.id]); return prev; }));
      if (cur && cur.status === "ok" && !isEmptyBundle(bundle, cur.data)) return;
      setRegionResults((prev) => ({ ...prev, [bundle.id]: { status: "loading" } }));
      const res = await fetchOne(bundle, "region", force);
      const empty = res.error || isEmptyBundle(bundle, res.data);
      setRegionResults((prev) => ({ ...prev, [bundle.id]: empty ? { status: "empty" } : { status: "ok", data: res.data, meta: res.meta } }));
    });
  }, [geo.country, fetchOne]);

  useEffect(() => { purgeLegacyCache(); }, []);

  useEffect(() => {
    if (initialized && geo.country) loadAll(false);
  }, [initialized, countrySlug, citySlug, loadAll]);

  const refreshSection = useCallback(async (bundle, scope) => {
    const setter = scope === "region" ? setRegionResults : setResults;
    setter((prev) => ({ ...prev, [bundle.id]: { ...(prev[bundle.id] || {}), status: "loading" } }));
    const res = await fetchOne(bundle, scope, true);
    setter((prev) => ({ ...prev, [bundle.id]: res.error ? { status: "error", error: res.error } : { status: "ok", data: res.data, meta: res.meta } }));
  }, [fetchOne]);

  if (!initialized || (loading && Object.keys(results).length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#088395] animate-spin mx-auto mb-4" />
          <p className="text-[#0A4D68] font-semibold">Loading culture information…</p>
        </div>
      </div>
    );
  }

  const cityName = geo.city || geo.country;
  const regionFallbacksToShow = CITY_BUNDLES.filter((b) => b.fallback && regionResults[b.id]?.status === "ok");

  return (
    <div className="min-h-screen font-sans" style={{ background: IVORY }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button onClick={() => navigate(createPageUrl("Home"))} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }} aria-label="Back">
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]" style={{ background: CAT.culture.bg, color: CAT.culture.ink }}>
            <Compass size={13} color={CAT.culture.ink} strokeWidth={2} /> Culture
          </div>
          <button onClick={() => loadAll(true)} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }} title="Refresh all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} color="#0F1419" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* COUNTRY TITLE */}
      <div className="px-4 max-w-md mx-auto pb-2 text-center">
        <h1 className="text-[calc(30px*var(--fs))] font-extrabold tracking-tight text-[#0F1419]">
          <span className="font-serif italic font-normal" style={{ color: CAT.culture.ink }}>{geo.country || "Your destination"}</span>
        </h1>
        <p className="font-mono text-[calc(10.5px*var(--fs))] tracking-[0.16em] uppercase font-semibold mt-1" style={{ color: "#6B7280" }}>Traveler's Culture Guide</p>
      </div>

      <div className="max-w-md mx-auto">
        {/* Location display */}
        <div className="px-6 mb-2">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-2xl flex-shrink-0">{locationMode === "current" ? "📍" : "🧭"}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 truncate">{cityName}</p>
                  {hasData(geo.country) && <p className="text-sm text-gray-600 truncate">{geo.country}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {locationMode === "navigate" && (
                  <button onClick={() => switchToCurrentLocation()} className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors" title="Use Current Location">
                    <Navigation className="w-4 h-4 text-blue-600" />
                  </button>
                )}
                <button onClick={() => setShowLocationPicker(true)} className="text-sm font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2 flex-shrink-0">Change</button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4 pb-24">
          {/* 🌎 COUNTRY ESSENTIALS */}
          <Divider icon="🌎" label="Country Essentials" sublabel={`The big picture of ${geo.country || "the country"}.`} />
          {COUNTRY_BUNDLES.flatMap((bundle) =>
            bundle.cards.map((card) => (
              <SectionCard key={`${bundle.id}_${card.id}`} card={card} bundle={bundle} layer="country"
                state={results[bundle.id]} onRefresh={() => refreshSection(bundle, "country")} />
            ))
          )}

          {/* 📍 CITY LOCAL GUIDE */}
          <Divider icon="📍" label="City Local Guide" sublabel={`Specific to ${cityName}.`} />
          {CITY_BUNDLES.flatMap((bundle) =>
            bundle.cards.map((card) => (
              <SectionCard key={`${bundle.id}_${card.id}`} card={card} bundle={bundle} layer="city"
                state={results[bundle.id]} onRefresh={() => refreshSection(bundle, "city")} />
            ))
          )}

          {/* 🧭 NEARBY REGION (fallback) */}
          {regionFallbacksToShow.length > 0 && (
            <>
              <Divider icon="🧭" label="Nearby Region" sublabel={`Not specific to ${cityName} — shown for the surrounding region.`} />
              {regionFallbacksToShow.flatMap((bundle) =>
                bundle.cards.map((card) => (
                  <SectionCard key={`region_${bundle.id}_${card.id}`} card={card} bundle={bundle} layer="region"
                    state={regionResults[bundle.id]} onRefresh={() => refreshSection(bundle, "region")} />
                ))
              )}
            </>
          )}
        </div>
      </div>

      <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
    </div>
  );
}
