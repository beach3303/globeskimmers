import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { fetchCulture } from "@/lib/callWorker";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Loader2, Navigation, RefreshCw, ChevronLeft, ChevronDown, ChevronRight, Compass, AlertTriangle, ExternalLink } from "lucide-react";
import { CAT, IVORY, IVORY_2, TEAL_DEEP, SHADOW_CARD_SOFT } from "@/components/redesign/constants";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import { useIsTablet } from "@/lib/useIsTablet";
import { useDismissable } from "@/lib/dismissStack";

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

// ---- redesign design tokens (handoff: iPad redesign) -----------------------
// The font stack is loaded in index.html (Instrument Serif / Inter Tight /
// JetBrains Mono). Apply inline so fidelity never depends on tailwind config.
const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const SANS = '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.10)";
// Respect the app-wide text-scale variable, with a safe 1 fallback.
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// Per-layer color world: Country = culture brown, City = teal, Region = emerald.
const LAYER = {
  country: { ink: CAT.culture.ink, bg: CAT.culture.bg },
  city: { ink: TEAL_DEEP, bg: "#D2EFEC" },
  region: { ink: "#2E7D46", bg: "#E7F3EA" },
};

// Badge / chip palette — soft tint background + saturated text (handoff pills).
// Foregrounds darkened so small badge text clears WCAG 4.5:1 on its own tint.
const TONE = {
  teal: ["#D2EFEC", "#0B6A62"], amber: ["#FCEAC9", "#8A5410"],
  green: ["#E7F3EA", "#266A3B"], rose: ["#FBE0DC", "#A82C24"],
  violet: ["#EAE0FA", "#6D29D9"], slate: ["#EFE8D9", "#736657"],
  blue: ["#EAF0FB", "#205FCF"],
};
// Amber "note" surface for warnings / disclaimers (handoff .note). ink darkened
// to clear 4.5:1 on the tint — it carries safety / advisory copy.
const NOTE = { bg: "#FBEFD7", border: "#EBD9AE", ink: "#7E601F" };

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
    id: "country_leadership", layer: "country", ttlDays: 30, volatile: true,
    prompt: (p) => `List the current top national leaders of ${p} (3-5): for each give position (e.g. President, Prime Minister, Monarch), full name, and a short title. Use full names and proper titles.${HONESTY(p)}`,
    schema: objOf({ leaders: arrOf({ position: STR, name: STR, title: STR }) }),
    cards: [{ id: "leaders", title: "National Leadership", icon: "🏛️", blocks: [{ kind: "leaders", field: "leaders" }] }],
  },
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
  const [bg, color] = TONE[tone] || TONE.teal;
  return (
    <span style={{ background: bg, color, fontSize: fs(10.5), fontFamily: SANS }}
      className="px-2.5 py-0.5 rounded-full font-semibold leading-tight">{children}</span>
  );
}

function ChipRow({ items, tone }) {
  const [bg, color] = tone ? (TONE[tone] || TONE.slate) : [IVORY_2, INK2];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.filter(hasData).map((it, i) => (
        <span key={i} style={{ background: bg, color, fontSize: fs(11.5), fontFamily: SANS }}
          className="px-2.5 py-1 rounded-full font-medium">{it}</span>
      ))}
    </div>
  );
}

// Chip variant for plain-text items (products / exports / where-to-buy) that
// can carry a leading 60px tappable Wikipedia thumb. Each item renders as a
// wider rounded pill; when it has no Wikipedia image it degrades gracefully to
// a plain text pill (no empty box). Layout-safe on phone + tablet.
function ThumbChip({ label }) {
  const cached = _wikiThumbCache.get(label);
  const [entry, setEntry] = useState(cached && typeof cached === "object" ? cached : null);
  const openLightbox = React.useContext(LightboxContext);
  useEffect(() => {
    let alive = true;
    Promise.resolve(getWikiThumb(label)).then((e) => { if (alive) setEntry(e || null); });
    return () => { alive = false; };
  }, [label]);
  const url = thumbUrlOf(entry);
  if (!url) {
    return (
      <span style={{ background: IVORY_2, color: INK2, fontSize: fs(12.5), fontFamily: SANS }}
        className="px-3 py-2 rounded-full font-medium">{label}</span>
    );
  }
  const enlarge = () => openLightbox && openLightbox(biggerWikiSrc(entry), label);
  return (
    <span style={{ background: IVORY_2, color: INK2, fontSize: fs(12.5), fontFamily: SANS }}
      className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full font-medium">
      <img src={url} alt={label || ""} loading="lazy"
        role="button" tabIndex={0}
        onClick={enlarge}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enlarge(); } }}
        title="Tap to enlarge"
        className="cursor-pointer transition-transform active:scale-95"
        style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 999, border: `1px solid ${RULE}`, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function ThumbChips({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.filter(hasData).map((it, i) => <ThumbChip key={i} label={it} />)}
    </div>
  );
}

// Small inline meta line used throughout ItemCard (📍 where, 💡 tip, ⚠️ safety…).
function Meta({ show, color, icon, italic, children }) {
  if (!show) return null;
  return (
    <p className={`mt-1 ${italic ? "italic" : ""}`} style={{ color, fontSize: fs(12), lineHeight: 1.45 }}>
      {icon ? `${icon} ` : ""}{children}
    </p>
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

// ---- Wikipedia thumbnail (food + wildlife items) --------------------------
// Session-scoped cache keyed by English name → entry | null | Promise.
// An `entry` is { thumb, original } (both URL strings, either may be null).
// Each name is fetched at most once per session; failures resolve to null.
// NOTE: presentation-only. Storing both the thumb AND originalimage URLs lets
// the tap-to-enlarge lightbox load a crisper source without re-fetching.
const _wikiThumbCache = new Map();

// Pull the small-thumb URL out of whatever the cache holds (entry | string | null).
const thumbUrlOf = (entry) =>
  entry && typeof entry === "object" ? entry.thumb || null : (typeof entry === "string" ? entry : null);

// Derive a crisper source for the lightbox from a cached Wikimedia thumb URL.
// Wikimedia thumbs look like .../thumb/.../<digits>px-Name.jpg — rewriting the
// "<digits>px-" segment to "640px-" yields a larger render of the SAME image.
// If the URL doesn't match that pattern, fall back to the originalimage / thumb.
function biggerWikiSrc(entry) {
  const original = entry && typeof entry === "object" ? entry.original || null : null;
  const thumb = thumbUrlOf(entry);
  // Prefer the full-res originalimage — it is always valid AND clear. (Rewriting
  // the thumb URL to a larger "640px-" width is unreliable: Wikimedia returns
  // HTTP 400 for widths it won't generate, which left the enlarged popup blank.)
  // Fall back to the small thumb only when there is no originalimage.
  return original || thumb || null;
}

function getWikiThumb(name) {
  const key = String(name || "").trim();
  if (!key) return Promise.resolve(null);
  if (_wikiThumbCache.has(key)) return Promise.resolve(_wikiThumbCache.get(key));
  const p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const thumb = json?.thumbnail?.source || null;
      const entry = thumb ? { thumb, original: json?.originalimage?.source || null } : null;
      _wikiThumbCache.set(key, entry);
      return entry;
    })
    .catch(() => {
      _wikiThumbCache.set(key, null);
      return null;
    });
  _wikiThumbCache.set(key, p); // de-dupe in-flight fetches
  return p;
}

// ---- tap-to-enlarge lightbox ----------------------------------------------
// One lightbox open at a time, page-wide. The currently-open photo lives in a
// React context provided at the page root; WikiThumb/ThumbChip open it, the
// portal-rendered <Lightbox> shows it. Backdrop = blurred page + light ivory
// tint (NOT a solid black overlay); tapping anywhere (backdrop or photo) or
// pressing Escape closes it. The popup photo is a MODEST centered square.
const LightboxContext = React.createContext(null);

function LightboxProvider({ children }) {
  const [photo, setPhoto] = useState(null); // { src, caption } | null
  const open = useCallback((src, caption) => { if (src) setPhoto({ src, caption }); }, []);
  const close = useCallback(() => setPhoto(null), []);

  // Swipe-down dismiss: while a photo is open, register its close on the global
  // dismiss stack so the frontmost overlay closes on swipe-down (same path as
  // backdrop tap / Escape).
  useDismissable(!!photo, close);

  useEffect(() => {
    if (!photo) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, close]);

  return (
    <LightboxContext.Provider value={open}>
      {children}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {photo && (
            <motion.div
              key="culture-lightbox"
              role="dialog" aria-modal="true" aria-label={photo.caption || "Photo"}
              onClick={close}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6"
              style={{
                background: "rgba(247,244,236,0.5)",
                backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              }}>
              <motion.img
                src={photo.src} alt={photo.caption || ""}
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
                style={{
                  width: "min(360px, 84vw)", height: "min(360px, 84vw)", objectFit: "cover",
                  borderRadius: 18, boxShadow: "0 18px 50px rgba(22,17,13,.28)",
                  border: "3px solid #FFFFFF",
                }} />
              {photo.caption && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="mt-3 text-center font-semibold"
                  style={{ color: INK, fontFamily: SERIF, fontSize: fs(18), maxWidth: "min(360px, 84vw)" }}>
                  {photo.caption}
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </LightboxContext.Provider>
  );
}

// Small rounded thumbnail. Renders NOTHING while loading or when no image
// exists (no empty box / placeholder). Lazy by nature — only mounts when its
// collapsible section is expanded. Tapping it opens the page lightbox (a modest
// centered photo); keyboard-focusable (Enter / Space).
function WikiThumb({ name, size = 60 }) {
  const cached = _wikiThumbCache.get(name);
  const [entry, setEntry] = useState(cached && typeof cached === "object" ? cached : null);
  const openLightbox = React.useContext(LightboxContext);
  useEffect(() => {
    let alive = true;
    Promise.resolve(getWikiThumb(name)).then((e) => { if (alive) setEntry(e || null); });
    return () => { alive = false; };
  }, [name]);
  const url = thumbUrlOf(entry);
  if (!url) return null;
  const enlarge = () => openLightbox && openLightbox(biggerWikiSrc(entry), name);
  return (
    <img src={url} alt={name || ""} loading="lazy"
      role="button" tabIndex={0}
      onClick={enlarge}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enlarge(); } }}
      title="Tap to enlarge"
      className="cursor-pointer transition-transform active:scale-95"
      style={{ width: size, height: size, objectFit: "cover", borderRadius: 12, border: `1px solid ${RULE}`, flexShrink: 0 }} />
  );
}

// National-leadership headshot — uses the leader's Wikidata image (P18) of the
// EXACT person entity, so it is never the wrong same-named person (name-based
// Wikipedia lookup hits disambiguation pages for "Mike Johnson" etc.). Tap to
// enlarge via the shared lightbox (tap again / swipe-down closes). Renders
// nothing if the entity has no free image, so the row degrades to text-only.
function LeaderPhoto({ src, name, size = 56 }) {
  const openLightbox = React.useContext(LightboxContext);
  if (!src) return null;
  const sep = src.includes("?") ? "&" : "?";
  const thumb = `${src}${sep}width=${size * 3}`; // crisp on retina
  const full = `${src}${sep}width=1000`;
  const enlarge = () => openLightbox && openLightbox(full, name);
  return (
    <img src={thumb} alt={name || ""} loading="lazy"
      role="button" tabIndex={0}
      onClick={enlarge}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enlarge(); } }}
      title="Tap to enlarge"
      className="cursor-pointer transition-transform active:scale-95"
      style={{ width: size, height: size, objectFit: "cover", borderRadius: 12, border: `1px solid ${RULE}`, flexShrink: 0 }} />
  );
}

// ---- live national leaders (Wikidata) -------------------------------------
// The National Leadership card's AI `leaders` data goes stale fast (the Haiku
// snapshot once showed Biden/Harris in 2026). Wikidata is free, CORS-enabled
// and frontend-only, so we fetch the CURRENT head of state + head of government
// live and only fall back to the AI data if Wikidata returns nothing / errors.
// Session-scoped cache keyed by country name → array | null | in-flight Promise.
// `wdt:` = the current/best-rank value (so we get today's office holders);
// Q3624078 = "sovereign state", to disambiguate the plain country label.
const _wikidataLeaderCache = new Map();

// Curated cabinet / parliament office Q-ids per country → their CURRENT holder.
// Wikidata has NO generic country→minister link, and P1308 ("officeholder") is
// maintained only for a few offices (president/VP) — so accurate extra roles
// require VERIFIED office Q-ids, queried via the robust P39 pattern in
// getWikidataLeaders (real human + most-recent start + no end date). Head of
// state (P35 → president/monarch) and head of government (P6 → PM) come from the
// generic query and cover EVERY country; these add the deputy + key cabinet /
// parliament seats. Rendered in listed order, right after head of state/gov.
// A country absent here still shows its head of state + head of government.
const CABINET_OFFICES = {
  // US — power-ranked (presidential line of succession). With the President from
  // the generic head-of-state/gov query, this yields the top 6 most powerful.
  "United States": [
    { qid: "Q11699",   title: "Vice President" },
    { qid: "Q912994",  title: "Speaker of the House" },
    { qid: "Q14213",   title: "Secretary of State" },
    { qid: "Q4215834", title: "Secretary of the Treasury" },
    { qid: "Q735015",  title: "Secretary of Defense" },
  ],
};

// Verified top-of-line royals for sovereign monarchies (heir + next in line),
// keyed by the Wikidata English country label. The reigning monarch comes LIVE
// from the head-of-state query (P35); these complete the top 3 in succession.
// `img` = the person's P18 image URL. Populated from a live-Wikidata pass.
const ROYAL_LINE = {
  "United Kingdom": [
    { title: "Prince of Wales", name: "William, Prince of Wales", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20of%20Wales%20in%20Normandy%202024.jpg" },
    { title: "Second in Line", name: "Prince George of Wales", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Trooping%20the%20Colour%202023%20%28GovPM%2041%29%20crop%202.jpg" },
  ],
  "Spain": [
    { title: "Princess of Asturias", name: "Leonor, Princess of Asturias", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Leonor%20de%20Borb%C3%B3n%20en%202023%20%28cropped%29.jpg" },
    { title: "Second in Line", name: "Infanta Sofía of Spain", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Infanta%20Sof%C3%ADa%202025%20%28cropped%29.jpg" },
  ],
  "Netherlands": [
    { title: "Princess of Orange", name: "Catharina-Amalia, Princess of Orange", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Luxembourg%2C%20trounwiessel%202025%20chd.lu%20%28111%29%20-%20Catharina-Amalia.jpg" },
    { title: "Second in Line", name: "Princess Alexia of the Netherlands", img: "https://commons.wikimedia.org/wiki/Special:FilePath/2019%20Annual%20winter%20photocall%20with%20the%20Dutch%20Royal%20Family%20in%20Lech%2C%20Austria%20-%2004.jpg" },
  ],
  "Belgium": [
    { title: "Duchess of Brabant", name: "Princess Elisabeth, Duchess of Brabant", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Princess%20Elisabeth%202025%20%28crop%29.jpg" },
    { title: "Second in Line", name: "Prince Gabriel of Belgium", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20Gabriel%20of%20Belgium%20in%202018.jpg" },
  ],
  "Sweden": [
    { title: "Crown Princess", name: "Victoria, Crown Princess of Sweden", img: "https://commons.wikimedia.org/wiki/Special:FilePath/2025-11-18%20Event%2C%20Besuch%20der%20Kronprinzessin%20Victoria%20von%20Schweden%20beim%20deutschen%20Bundespr%C3%A4sidenten%20Frank-Walter%20Steinmeier%20im%20November%202025%20STP%209817.jpg" },
    { title: "Second in Line", name: "Princess Estelle, Duchess of Östergötland", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Princess%20Estelle%2C%20Duchess%20of%20%C3%96sterg%C3%B6tland%202023.jpg" },
  ],
  "Norway": [
    { title: "Crown Prince", name: "Haakon, Crown Prince of Norway", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Pr%C3%ADncipe%20Heredero%20Haakon%20Magnus%202025.jpg" },
    { title: "Second in Line", name: "Princess Ingrid Alexandra of Norway", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prinsesse%20Ingrid%20Alexandra%20Kadettangen%2003.jpg" },
  ],
  "Denmark": [
    { title: "Crown Prince", name: "Christian, Crown Prince of Denmark", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prins%20Christian%20til%20Danmark%202021.JPG" },
    { title: "Second in Line", name: "Princess Isabella of Denmark", img: "https://commons.wikimedia.org/wiki/Special:FilePath/The%20Danish%20Royal%20Family%20at%20Amalienborg%20-%20Princess%20Isabella.jpg" },
  ],
  "Japan": [
    { title: "Crown Prince", name: "Fumihito, Crown Prince of Japan", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Fumihito%2C%20Crown%20Prince%20Akishino%20%2854751644693%2C%20cropped%29.jpg" },
    { title: "Second in Line", name: "Prince Hisahito of Akishino", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20Hisahito%2C%202021%20%28cropped%2C%202%29.jpg" },
  ],
  "Thailand": [
    { title: "Heir Apparent", name: "Prince Dipangkorn Rasmijoti", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Dipangkorn%20Rasmijoti%202019.jpg" },
  ],
  "Saudi Arabia": [
    { title: "Crown Prince", name: "Mohammed bin Salman Al Saud", img: "https://commons.wikimedia.org/wiki/Special:FilePath/%D8%A7%D9%84%D8%B5%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%B1%D8%B3%D9%85%D9%8A%D8%A9%20%D9%84%D9%84%D8%A3%D9%85%D9%8A%D8%B1%20%D9%85%D8%AD%D9%85%D8%AF%20%D8%A8%D9%86%20%D8%B3%D9%84%D9%85%D8%A7%D9%86%20%D8%A8%D9%86%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D8%B9%D8%B2%D9%8A%D8%B2%20%D8%A2%D9%84%20%D8%B3%D8%B9%D9%88%D8%AF%20%28%D9%85%D9%82%D8%B5%D9%88%D8%B5%D8%A9%29.jpg" },
  ],
  "Jordan": [
    { title: "Crown Prince", name: "Hussein bin Abdullah", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Crown%20Prince%20Hussein%20of%20Jordan%20cropped.jpeg" },
    { title: "Second in Line", name: "Prince Hashem bin Abdullah", img: "" },
  ],
  "Morocco": [
    { title: "Crown Prince", name: "Moulay Hassan, Crown Prince of Morocco", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Moulay%20Hassan%20in%202018.jpg" },
    { title: "Second in Line", name: "Prince Moulay Rachid of Morocco", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20Moulay%20Rachid%20of%20Morocco%20%28cropped%29.jpg" },
  ],
  "Monaco": [
    { title: "Hereditary Prince of Monaco", name: "Jacques, Hereditary Prince of Monaco", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Jacques%2C%20Hereditary%20Prince%20of%20Monaco.jpg" },
    { title: "Second in Line", name: "Princess Gabriella, Countess of Carladès", img: "" },
  ],
  "Luxembourg": [
    { title: "Hereditary Grand Duke", name: "Prince Charles of Luxembourg", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20Charles%20of%20Luxembourg%202025.jpg" },
    { title: "Second in Line", name: "Prince François of Luxembourg", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20Fran%C3%A7ois%20of%20Luxembourg%202025.jpg" },
  ],
  "Oman": [
    { title: "Crown Prince", name: "Theyazin bin Haitham Al Said", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Theyazin%20bin%20Haitham%202%20%28cropped%29%20%28cropped%29.jpg" },
    { title: "Second in Line", name: "Bilarab bin Haitham Al Said", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Bilarab%20bin%20Haitham%20Al%20Said%202023.jpg" },
  ],
  "Bhutan": [
    { title: "Crown Prince", name: "Jigme Namgyel Wangchuck", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Jigme%20Namgyel%20Wangchuck%20%2853612269394%29%20%28cropped%29.jpg" },
    { title: "Second in Line", name: "Jigme Ugyen Wangchuck", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Jigme%20Ugyen%20Wangchuck%20%2853612269394%29%20%28cropped%29.jpg" },
  ],
  "Qatar": [
    { title: "Heir Apparent", name: "Abdullah bin Hamad bin Khalifa Al Thani", img: "https://upload.wikimedia.org/wikipedia/commons/0/05/Sheikh_abdualla_althani.jpg" },
  ],
  "United Arab Emirates": [
    { title: "Crown Prince", name: "Khaled bin Mohamed bin Zayed Al Nahyan", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Khaled%20bin%20Mohamed%20Al%20Nahyan.jpg" },
  ],
  "Malaysia": [
    { title: "Deputy King", name: "Sultan Nazrin Muizzuddin Shah of Perak", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Sultan%20Nazrin%20Muizzuddin%20Shah%20%28cropped%29.jpg" },
  ],
  "Kuwait": [
    { title: "Crown Prince", name: "Sabah Al-Khalid Al-Sabah", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Sabah%20Al-Khalid%20Al-Sabah%202014%20%28portrait%20crop%29.jpg" },
  ],
  "Bahrain": [
    { title: "Crown Prince", name: "Salman bin Hamad Al Khalifa", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Kingdom%20of%20Bahrain%20Crown%20Prince%20and%20Prime%20Minister%2C%20His%20Royal%20Highness%20Salman%20bin%20Hamad%20Al%20Khalifa%20%28Salman%20bin%20Hamad%20bin%20Isa%20Al%20Khalifa%29%20participates%20in%20a%20bilateral%20exchange%20at%20the%20Pentagon%20on%20September%2014%2C%202023%20%28cropped%29.jpg" },
    { title: "Second in Line", name: "Isa bin Salman Al Khalifa", img: "" },
  ],
  "Brunei": [
    { title: "Crown Prince", name: "Al-Muhtadee Billah", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Al-Muhtadee%20Billah%20%282023%29.jpg" },
    { title: "Second in Line", name: "Prince Abdul Muntaqim", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20Abdul%20Muntaqim%20-%2053588524144.jpg" },
  ],
  "Liechtenstein": [
    { title: "Hereditary Prince", name: "Alois, Hereditary Prince of Liechtenstein", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Alois%20of%20Liechtenstein%20and%20Karin%20Kneissl%20November%202018%20%2845170115774%29%20%28cropped%29.jpg" },
    { title: "Second in Line", name: "Prince Joseph Wenzel of Liechtenstein", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20Joseph%20Wenzel%20of%20Liechtenstein%20%28cropped%29.jpg" },
  ],
};

function getWikidataLeaders(country) {
  const key = String(country || "").trim();
  if (!key) return Promise.resolve(null);
  if (_wikidataLeaderCache.has(key)) return Promise.resolve(_wikidataLeaderCache.get(key));

  const esc = key.replace(/"/g, '\\"');
  // Current head of state (P35) + head of government (P6), each with its OFFICE
  // TITLE (P1906 / P1313) so the card reads "President" / "Monarch" / "Emperor" /
  // "Prime Minister" / "Federal Chancellor" rather than a generic label. P18 =
  // the person's image (tied to the entity, so it's never the wrong same-named
  // person). `wdt:` = current best-rank value; "en,mul" resolves modern names
  // stored under the `mul` (multilingual) label code (else a raw Q-id leaks).
  const mainQ = `SELECT ?role ?officeLabel ?personLabel ?img WHERE {
  ?country rdfs:label "${esc}"@en ; wdt:P31 wd:Q3624078 .
  { ?country wdt:P35 ?person . OPTIONAL { ?country wdt:P1906 ?office . } BIND("hos" AS ?role) }
  UNION { ?country wdt:P6 ?person . OPTIONAL { ?country wdt:P1313 ?office . } BIND("hog" AS ?role) }
  OPTIONAL { ?person wdt:P18 ?img . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" . }
}`;
  // Cabinet / parliament: current holder of each curated office. Robust "current
  // holder" pattern — position held (P39) by a REAL human (P31=Q5) with a start
  // date (P580) and NO end date (P582), taking the most-recent such start. The
  // human + most-recent filters reject fictional TV characters (e.g. West Wing's
  // "Arnold Vinick") and historical holders with missing end-dates that a naive
  // "no end date" query otherwise surfaces.
  const cab = CABINET_OFFICES[key];
  const cabQ = cab && cab.length ? `SELECT ?office ?personLabel ?img WHERE {
  VALUES ?office { ${cab.map((o) => "wd:" + o.qid).join(" ")} }
  ?person p:P39 ?st . ?st ps:P39 ?office ; pq:P580 ?start .
  ?person wdt:P31 wd:Q5 .
  FILTER NOT EXISTS { ?st pq:P582 ?e }
  FILTER NOT EXISTS { ?p2 p:P39 ?st2 . ?st2 ps:P39 ?office ; pq:P580 ?s2 . ?p2 wdt:P31 wd:Q5 . FILTER NOT EXISTS { ?st2 pq:P582 ?e2 } FILTER(?s2 > ?start) }
  OPTIONAL { ?person wdt:P18 ?img . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" . }
}` : null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  const sparql = (qq) => fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(qq)}`, {
    headers: { Accept: "application/sparql-results+json" }, signal: ctrl.signal,
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // "President of the United States" -> "President" (the page is already scoped to
  // the country); also capitalise Wikidata's lowercase labels ("monarch" -> "Monarch").
  const cleanOffice = (s) => {
    if (!s) return null;
    const short = s.replace(/\s+of\s+.*$/i, "").trim();
    return short ? short.charAt(0).toUpperCase() + short.slice(1) : null;
  };
  // P18 image URLs come back as http://commons… — force https for the WKWebView.
  const httpsImg = (u) => (u ? String(u).replace(/^http:/, "https:") : null);

  const p = Promise.all([sparql(mainQ), cabQ ? sparql(cabQ) : Promise.resolve(null)])
    .then(([main, cabRes]) => {
      clearTimeout(timer);
      const byRole = {};
      for (const b of (main?.results?.bindings || [])) {
        const role = b?.role?.value;
        const name = b?.personLabel?.value;
        if (!role || !name || /^Q\d+$/.test(name)) continue; // skip unresolved raw ids
        if (!byRole[role]) byRole[role] = { name, office: b?.officeLabel?.value, img: httpsImg(b?.img?.value) };
      }
      const out = [];
      const seen = new Set();
      for (const role of ["hos", "hog"]) {
        const e = byRole[role];
        if (!e || seen.has(e.name)) continue; // dedupe when one person holds both
        seen.add(e.name);
        out.push({ position: cleanOffice(e.office) || (role === "hos" ? "Head of State" : "Head of Government"), name: e.name, img: e.img || null });
      }
      // Cabinet / parliament holders, in the curated order, deduped vs head of state/gov.
      if (cab && cabRes) {
        const byQid = {};
        for (const b of (cabRes?.results?.bindings || [])) {
          const qid = (b?.office?.value || "").split("/").pop();
          const name = b?.personLabel?.value;
          if (!qid || !name || /^Q\d+$/.test(name)) continue;
          if (!byQid[qid]) byQid[qid] = { name, img: httpsImg(b?.img?.value) };
        }
        for (const o of cab) {
          const e = byQid[o.qid];
          if (!e || seen.has(e.name)) continue;
          seen.add(e.name);
          out.push({ position: o.title, name: e.name, img: e.img || null });
        }
      }
      const result = out.length ? out : null;
      _wikidataLeaderCache.set(key, result);
      return result;
    })
    .catch(() => {
      clearTimeout(timer);
      _wikidataLeaderCache.set(key, null);
      return null;
    });
  _wikidataLeaderCache.set(key, p); // de-dupe in-flight fetches
  return p;
}

// Renders national leaders for the country_leadership card. While Wikidata is
// loading (or if it never resolves with data) it shows the AI `fallback`
// leaders — so there is no flicker/blank — using the same mono-kicker + serif/
// ink treatment as the standard `leaders` Block. When Wikidata resolves with
// data, those CURRENT names render instead, stamped "Source: Wikidata · current".
function WikidataLeaders({ country, fallback }) {
  const cached = _wikidataLeaderCache.get(country);
  const [live, setLive] = useState(Array.isArray(cached) ? cached : null);
  useEffect(() => {
    let alive = true;
    setLive(Array.isArray(_wikidataLeaderCache.get(country)) ? _wikidataLeaderCache.get(country) : null);
    Promise.resolve(getWikidataLeaders(country)).then((res) => { if (alive) setLive(res || null); });
    return () => { alive = false; };
  }, [country]);

  const fromWikidata = Array.isArray(live) && live.length > 0;
  const all = fromWikidata ? live : (fallback || []).filter((l) => hasData(l?.name));
  if (!all.length) return null;

  // Monarchy split: when the head of state is a monarch AND we have verified
  // royals for this country, lift the monarch into its OWN "Monarchy" group of
  // up to 3 (reigning monarch + line of succession), and keep the government's
  // top 6 (PM + cabinet + speaker) separate. Otherwise it's one top-6 list.
  const isMonarchy = /\b(king|queen|monarch|emperor|empress|sultan|emir|grand duke|grand duchess)\b/i.test(all[0]?.position || "");
  const heirs = ROYAL_LINE[country] || [];
  const royals = isMonarchy && heirs.length ? [all[0], ...heirs].slice(0, 3) : null;
  const gov = (royals ? all.slice(1) : all).slice(0, 6);

  const label = (text) => (
    <p className="mb-2 uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em" }}>{text}</p>
  );
  const row = (l, key) => (
    <div key={key} className="flex items-center gap-3">
      <LeaderPhoto src={l.img} name={l.name} />
      <div className="min-w-0">
        <p className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".06em" }}>{l.position || l.title}</p>
        <p className="font-semibold" style={{ color: INK, fontFamily: SERIF, fontSize: fs(18) }}>{l.name}{!fromWikidata && hasData(l.title) && l.position ? ` · ${l.title}` : ""}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {royals && (
        <div>
          {label("👑 Monarchy · line of succession")}
          <div className="space-y-3">{royals.map((l, i) => row(l, `r${i}`))}</div>
        </div>
      )}
      <div>
        {royals && label("Government")}
        <div className="space-y-3">{gov.map((l, i) => row(l, `g${i}`))}</div>
      </div>
      {fromWikidata && (
        <p className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".06em" }}>Source: Wikidata · current</p>
      )}
    </div>
  );
}

// Generic rich item card — renders whichever optional fields are present.
function ItemCard({ it, showThumb = false }) {
  const title = it.name || it.term || "";
  const desc = it.short_description || it.description || it.why_visit || it.why_it_matters || it.why_worth_buying_here || it.why_this_city_is_known_for_it;
  const chips = [it.flavor_tags, it.texture_tags, it.main_ingredients, it.activities].filter(Array.isArray).flat().filter(hasData);
  const scalarChips = [
    it.spice_level && `🌶 ${it.spice_level}`, it.sweetness_level && `🍬 ${it.sweetness_level}`,
    it.price_level && `💰 ${it.price_level}`, it.difficulty_level && `⛰ ${it.difficulty_level}`,
    it.crowd_level && `👥 ${it.crowd_level}`, it.common_meal_time, it.best_time_to_visit || it.best_time_or_season,
    (it.month || it.date) && `📅 ${it.month || it.date}`,
    it.recommended_duration, it.distance_from_city && `📍 ${it.distance_from_city}`, it.type, it.category, it.animal_type,
    it.likelihood && it.likelihood !== "common" && `${it.likelihood} to see`,
  ].filter(hasData);
  const where = it.where_to_try || it.where_to_find || it.where_to_buy || it.best_places_to_buy || it.neighborhood_or_area || it.where_seen;
  const tip = it.traveler_tip || it.local_tip;
  const safety = it.safety_note || it.food_safety_tip || it.how_to_avoid;
  const photo = it.photo_tip || it.creator_photo_tip;
  const badges = itemBadges(it);
  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        {hasData(it.rank) && <span className="font-bold" style={{ color: INK3, fontFamily: MONO, fontSize: fs(11) }}>#{it.rank}</span>}
        <p className="font-semibold" style={{ color: INK, fontFamily: SANS, fontSize: fs(15) }}>{title}</p>
        {hasData(it.local_name) && it.local_name !== title && <span className="italic" style={{ color: INK3, fontFamily: SERIF, fontSize: fs(15.5) }}>{it.local_name}</span>}
      </div>
      {hasData(desc) && <p className="mt-1" style={{ color: INK2, fontSize: fs(13.5), lineHeight: 1.45 }}>{desc}</p>}
      {badges.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{badges.map(([t, tone], i) => <Badge key={i} tone={tone}>{t}</Badge>)}</div>}
      {scalarChips.length > 0 && <p className="mt-2" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".02em" }}>{scalarChips.join("  ·  ")}</p>}
      {chips.length > 0 && <div className="mt-2"><ChipRow items={chips} /></div>}
      {Array.isArray(it.accomplishments) && it.accomplishments.filter(hasData).length > 0 && (
        <ul className="mt-2 space-y-1">{it.accomplishments.filter(hasData).map((a, i) => (
          <li key={i} className="flex gap-1.5" style={{ color: INK2, fontSize: fs(12.5) }}><span className="font-bold" style={{ color: TEAL_DEEP }}>•</span><span>{a}</span></li>
        ))}</ul>
      )}
      <Meta show={hasData(it.significance)} color={TEAL_DEEP}>{it.significance}</Meta>
      <Meta show={hasData(it.fun_fact)} color={NOTE.ink} icon="💡" italic>{it.fun_fact}</Meta>
      <Meta show={hasData(where)} color={INK3} icon="📍">{where}</Meta>
      <Meta show={hasData(it.ticket_or_reservation_note)} color={INK3} icon="🎟">{it.ticket_or_reservation_note}</Meta>
      <Meta show={hasData(it.hours_note)} color={INK3} icon="🕘">{it.hours_note}</Meta>
      <Meta show={hasData(it.conservation_note)} color="#2E7D46" icon="🌱">{it.conservation_note}</Meta>
      <Meta show={hasData(safety)} color="#C2392F" icon="⚠️">{safety}</Meta>
      <Meta show={hasData(photo)} color="#7C3AED" icon="📸">{photo}</Meta>
      <Meta show={hasData(tip)} color={INK2} icon="💡" italic>{tip}</Meta>
    </div>
  );
  return (
    <div className="pb-3.5 last:pb-0" style={{ borderBottom: `1px solid ${RULE}` }}>
      {showThumb ? (
        // Food / wildlife items: optional Wikipedia thumb on the LEFT. WikiThumb
        // renders null while loading / when no image exists, so the row simply
        // falls back to text-only — identical to the no-thumb layout.
        <div className="flex items-start gap-3">
          <WikiThumb name={it.name} />
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}

// A mono uppercase eyebrow used to label blocks (handoff kicker treatment).
const Kicker = ({ children }) => (
  <p className="mb-2 uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em" }}>{children}</p>
);

// Fields whose 'cards' items show a tappable Wikipedia thumbnail. Covers food /
// desserts / street food / snacks / wildlife PLUS national heroes, nature icons
// (national + nearby), and the "Made Here" product items (city brags / crafts /
// souvenirs). Everything else (attractions, day trips, hidden gems, festivals,
// history, late-night food, food districts/markets, scams, etc.) renders
// text-only as before. Items with no Wikipedia image show no icon (graceful).
const THUMB_FIELDS = new Set([
  // food / desserts / street food / snacks
  "national_dishes", "national_desserts", "national_street_foods",
  "top_10_city_foods", "local_specialty_dishes", "top_city_desserts",
  "local_pastries", "traditional_sweets", "top_10_city_street_foods",
  "top_10_local_snacks",
  // wildlife
  "wildlife", "common_city_animals", "nearby_wildlife", "dangerous_animals",
  // national heroes
  "national_heroes",
  // nature icons (national + nearby)
  "nature_icons", "nearby_nature_icons",
  // "Made Here": brags / crafts / souvenirs
  "city_brags", "local_crafts", "best_souvenirs",
]);

// Plain-text chip fields that get a leading 60px tappable thumb where one fits
// cleanly — national products/exports + the "where to buy" / brags chips. These
// render via ThumbChips (a wider pill that degrades to a normal chip with no
// image). Other chip blocks stay as compact pills (ChipRow).
const THUMB_CHIP_FIELDS = new Set([
  "major_products_exports", "local_brands", "products_cheaper_locally", "where_to_buy",
]);

// Renders one block within a card. Returns null when the block has no data.
// `wikidataCountry` is set ONLY for the national-leadership card — when present,
// a `leaders` block fetches the CURRENT office holders live from Wikidata and
// falls back to the AI `leaders` data. No other card passes it, so every other
// card (including city leadership) renders exactly as before.
function Block({ block, data, wikidataCountry }) {
  const { kind, field, label } = block;
  if (kind === "kv") {
    const rows = (block.fields || []).filter((f) => hasData(data[f.field]));
    if (!rows.length) return null;
    return (
      <div className="space-y-2.5">
        {rows.map((f, i) => (
          <div key={i}>
            <span className="uppercase block" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".06em" }}>{f.label}</span>
            <span className="font-medium" style={{ color: INK, fontSize: fs(13.5) }}>{data[f.field]}</span>
          </div>
        ))}
      </div>
    );
  }
  const val = data[field];
  if (!hasData(val)) return null;
  const Label = label ? <Kicker>{label}</Kicker> : null;
  switch (kind) {
    case "text":
      return <div>{Label}<p style={{ color: INK2, fontSize: fs(13.5), lineHeight: 1.5 }}>{val}</p></div>;
    case "motto":
      return <div><p className="italic" style={{ color: INK, fontFamily: SERIF, fontSize: fs(19) }}>“{val}”</p>{hasData(data.motto_english) && <p className="mt-0.5" style={{ color: INK3, fontSize: fs(12) }}>{data.motto_english}</p>}</div>;
    case "stat":
      return (
        <div className="inline-flex items-baseline gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: IVORY_2 }}>
          <span className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".06em" }}>{label}</span>
          <span className="font-bold" style={{ color: INK, fontFamily: SERIF, fontSize: fs(20) }}>{val}</span>
        </div>
      );
    case "warn":
      return (
        <div className="flex items-start gap-2 rounded-2xl p-3" style={{ background: NOTE.bg, border: `1px solid ${NOTE.border}` }}>
          <AlertTriangle size={14} style={{ color: NOTE.ink, marginTop: 2 }} className="shrink-0" />
          <p style={{ color: NOTE.ink, fontSize: fs(12), lineHeight: 1.45 }}>{label ? <b>{label}: </b> : null}{val}</p>
        </div>
      );
    case "chips":
      return <div>{Label}{THUMB_CHIP_FIELDS.has(field) ? <ThumbChips items={val} /> : <ChipRow items={val} />}</div>;
    case "bullets":
      return <div>{Label}<ul className="space-y-1.5">{val.filter(hasData).map((b, i) => (
        <li key={i} className="flex items-start gap-2" style={{ color: INK2, fontSize: fs(13.5), lineHeight: 1.45 }}><span className="font-bold mt-0.5" style={{ color: TEAL_DEEP }}>•</span><span>{b}</span></li>
      ))}</ul></div>;
    case "pairs":
      return <div>{Label}<div className="space-y-2">{val.filter(hasData).map((p, i) => (
        <div key={i} className="flex justify-between items-center" style={{ fontSize: fs(13.5) }}><span style={{ color: INK2 }}>{p.name || p.term || p.label}</span><span className="font-bold" style={{ color: INK, fontFamily: MONO, fontSize: fs(12.5) }}>{p.percentage || p.value}</span></div>
      ))}</div></div>;
    case "phrases":
      return <div>{Label}<div className="space-y-2">{val.filter((p) => hasData(p.phrase)).map((p, i) => (
        <div key={i}><span className="font-semibold" style={{ color: INK, fontFamily: SERIF, fontSize: fs(17) }}>{p.phrase}</span>{hasData(p.meaning) && <span style={{ color: INK3, fontSize: fs(13.5) }}> — {p.meaning}</span>}</div>
      ))}</div></div>;
    case "dodont":
      return (
        <div className="space-y-3">
          {hasData(val.do) && <div className="rounded-2xl p-3.5" style={{ background: TONE.green[0] }}>
            <p className="font-bold mb-2 uppercase" style={{ color: TONE.green[1], fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".06em" }}>✅ Do</p>
            <ul className="space-y-1.5">{val.do.filter(hasData).map((r, i) => (
              <li key={i} className="flex items-start gap-2" style={{ fontSize: fs(13) }}><span className="font-bold mt-0.5" style={{ color: TONE.green[1] }}>•</span><span style={{ color: INK2 }}>{r}</span></li>
            ))}</ul></div>}
          {hasData(val.dont) && <div className="rounded-2xl p-3.5" style={{ background: TONE.rose[0] }}>
            <p className="font-bold mb-2 uppercase" style={{ color: TONE.rose[1], fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".06em" }}>🚫 Don't</p>
            <ul className="space-y-1.5">{val.dont.filter(hasData).map((r, i) => (
              <li key={i} className="flex items-start gap-2" style={{ fontSize: fs(13) }}><span className="font-bold mt-0.5" style={{ color: TONE.rose[1] }}>•</span><span style={{ color: INK2 }}>{r}</span></li>
            ))}</ul></div>}
        </div>
      );
    case "leaders":
      // National-leadership card only: fetch CURRENT leaders live from Wikidata,
      // falling back to the AI list. Every other leaders block (city gov) keeps
      // the original AI-only rendering below.
      if (wikidataCountry) {
        return <div>{Label}<WikidataLeaders country={wikidataCountry} fallback={val} /></div>;
      }
      return <div>{Label}<div className="space-y-2.5">{val.filter((l) => hasData(l.name)).map((l, i) => (
        <div key={i}><p className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".06em" }}>{l.position || l.title}</p><p className="font-semibold" style={{ color: INK, fontSize: fs(14.5) }}>{l.name}{hasData(l.title) && l.position ? ` · ${l.title}` : ""}</p></div>
      ))}</div></div>;
    case "cards": {
      const showThumb = THUMB_FIELDS.has(field);
      return <div>{Label}<div className="space-y-3.5">{val.filter((x) => hasData(x?.name)).map((it, i) => <ItemCard key={i} it={it} showThumb={showThumb} />)}</div></div>;
    }
    default:
      return null;
  }
}

function FreshnessLine({ meta, volatile }) {
  if (!meta) return null;
  const updated = fmtDate(meta.last_verified_at);
  if (meta.stale && volatile) {
    return <p className="mt-1 font-semibold" style={{ color: NOTE.ink, fontFamily: MONO, fontSize: fs(10) }}>⚠ May have changed — tap refresh</p>;
  }
  if (updated) return <p className="mt-1 uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".06em" }}>Updated {updated}</p>;
  return null;
}

function SectionCard({ card, bundle, state, layer, onRefresh, wikidataCountry }) {
  const [open, setOpen] = useState(true); // default = expanded
  const data = state?.data || {};
  // Card renders only if at least one block has data (advisory always renders).
  const blocksWithData = (card.blocks || []).filter((b) =>
    b.kind === "kv" ? (b.fields || []).some((f) => hasData(data[f.field])) : hasData(data[b.field])
  );
  if (card.kind !== "advisory" && blocksWithData.length === 0 && state?.status !== "loading") return null;

  const world = LAYER[layer] || LAYER.country;
  const bodyId = `culture-card-${layer}-${bundle.id}-${card.id}`;
  const Chevron = open ? ChevronDown : ChevronRight;
  // Only volatile / time-sensitive bundles get a per-card refresh button
  // (advisory, national + city leadership, country + city safety). Evergreen
  // cards rely on the global "Refresh all" header button instead.
  const showRefresh = bundle.volatile === true && typeof onRefresh === "function";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[22px] overflow-hidden"
      style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
      <div className="p-5">
        {/* Header row toggles the body open/closed. Freshness / cadence stay
            visible here even when collapsed. The refresh button (volatile
            bundles only) sits just LEFT of the collapse chevron. */}
        <div className="w-full flex items-start gap-3 text-left">
          <button type="button" onClick={() => setOpen((o) => !o)}
            aria-expanded={open} aria-controls={bodyId}
            className="flex-1 min-w-0 flex items-start gap-3 text-left">
            <div className="shrink-0 rounded-2xl flex items-center justify-center"
              style={{ width: 44, height: 44, background: world.bg, fontSize: 22, lineHeight: 1 }}>{card.icon}</div>
            <div className="min-w-0 flex-1">
              <h3 className="leading-tight" style={{ color: INK, fontFamily: SERIF, fontSize: fs(23) }}>{card.title}</h3>
              {card.summaryField && hasData(bundle.summary) && <p className="mt-0.5" style={{ color: INK3, fontSize: fs(13) }}>{bundle.summary}</p>}
              {card.noteField && hasData(bundle.note) && <p className="mt-0.5 italic" style={{ color: INK3, fontSize: fs(12) }}>{bundle.note}</p>}
              {hasData(bundle.cadenceNote) && <p className="mt-1" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10) }}>🔄 {bundle.cadenceNote}</p>}
              <FreshnessLine meta={state?.meta} volatile={bundle.volatile} />
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {showRefresh && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                disabled={state?.status === "loading"} title="Refresh this section" aria-label="Refresh this section"
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-black/5"
                style={{ border: `1px solid ${RULE}` }}>
                <RefreshCw className={`w-3.5 h-3.5 ${state?.status === "loading" ? "animate-spin" : ""}`} style={{ color: INK3 }} strokeWidth={2} />
              </button>
            )}
            <button type="button" onClick={() => setOpen((o) => !o)}
              aria-expanded={open} aria-controls={bodyId} aria-label={open ? "Collapse section" : "Expand section"}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-black/5"
              style={{ border: `1px solid ${RULE}` }}>
              <Chevron className="w-4 h-4" style={{ color: INK3 }} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div id={bodyId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="pt-3.5">
                {card.kind === "advisory" ? (
                  <AdvisoryBody data={data} state={state} />
                ) : state?.status === "loading" && blocksWithData.length === 0 ? (
                  <div className="flex items-center gap-2 py-2" style={{ color: INK3, fontSize: fs(13) }}><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                ) : (
                  <div className="space-y-4">{blocksWithData.map((b, i) => <Block key={i} block={b} data={data} wikidataCountry={wikidataCountry} />)}</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AdvisoryBody({ data, state }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-2xl p-3" style={{ background: NOTE.bg, border: `1px solid ${NOTE.border}` }}>
        <AlertTriangle size={16} style={{ color: NOTE.ink, marginTop: 2 }} className="shrink-0" />
        <p style={{ color: NOTE.ink, fontSize: fs(12), lineHeight: 1.5 }}>
          <b>Advisories can change daily.</b> This summary refreshes only about once a day and may be behind today's situation. Before and during your trip, always check official travel guidance online — your government's travel advisory, linked below — for day-to-day accuracy.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ADVISORY_SOURCES.map((s) => (
          <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors"
            style={{ background: IVORY_2, color: INK2, border: `1px solid ${RULE}`, fontSize: fs(12) }}>
            <span>{s.flag}</span>{s.label}<ExternalLink size={10} style={{ color: INK3 }} />
          </a>
        ))}
      </div>
      {state?.status === "loading" && !hasData(data.summary) ? (
        <div className="flex items-center gap-2 py-1" style={{ color: INK3, fontSize: fs(13) }}><Loader2 className="w-4 h-4 animate-spin" /> Loading summary…</div>
      ) : (
        <>
          {hasData(data.overall_level) && <p className="font-bold" style={{ color: INK, fontFamily: SERIF, fontSize: fs(19) }}>{data.overall_level}</p>}
          {hasData(data.summary) && <p style={{ color: INK2, fontSize: fs(13.5), lineHeight: 1.5 }}>{data.summary}</p>}
          {hasData(data.key_risks) && <Block block={{ kind: "bullets", field: "key_risks", label: "Key risks" }} data={data} />}
          {hasData(data.areas_to_avoid) && <Block block={{ kind: "chips", field: "areas_to_avoid", label: "Areas to avoid" }} data={data} />}
          {hasData(data.entry_exit_notes) && <Block block={{ kind: "text", field: "entry_exit_notes", label: "Entry / exit" }} data={data} />}
        </>
      )}
    </div>
  );
}

function Divider({ icon, label, sublabel, layer = "country" }) {
  const world = LAYER[layer] || LAYER.country;
  return (
    <div className="pt-5 pb-1">
      <div className="flex items-center gap-2.5">
        <span className="rounded-xl flex items-center justify-center" style={{ width: 34, height: 34, background: world.bg, fontSize: 18, lineHeight: 1 }}>{icon}</span>
        <h2 className="leading-none" style={{ color: INK, fontFamily: SERIF, fontSize: fs(25) }}>{label}</h2>
      </div>
      {sublabel && <p className="mt-2 uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em" }}>{sublabel}</p>}
    </div>
  );
}

// On tablet, lay a layer's SectionCards into TWO independent column stacks
// (masonry) so a short card beside a tall one never leaves a blank hole in the
// middle — each column packs to its own content. Cards keep their left/right
// reading order (even index → left, odd → right), and the assignment is fixed,
// so collapsing/expanding one card never makes the others jump columns. On
// phone, render bare so they stay direct children of the parent `space-y-4`
// stack (phone layout byte-identical).
function CardGrid({ isTablet, children }) {
  if (!isTablet) return <>{children}</>;
  const items = React.Children.toArray(children);
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);
  return (
    <div className="grid grid-cols-2 gap-5 items-start">
      <div className="flex flex-col gap-5">{left}</div>
      <div className="flex flex-col gap-5">{right}</div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================
export default function CultureInformationPage() {
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
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

  // Per-card refresh for volatile/time-sensitive bundles only. Re-fetches just
  // this bundle with force and stores it the same way loadAll does (results, or
  // regionResults when scope === "region").
  const refreshSection = useCallback(async (bundle, scope) => {
    const setter = scope === "region" ? setRegionResults : setResults;
    setter((prev) => ({ ...prev, [bundle.id]: { ...(prev[bundle.id] || {}), status: "loading" } }));
    const res = await fetchOne(bundle, scope, true);
    setter((prev) => ({ ...prev, [bundle.id]: res.error ? { status: "error", error: res.error } : { status: "ok", data: res.data, meta: res.meta } }));
  }, [fetchOne]);

  if (!initialized || (loading && Object.keys(results).length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY, fontFamily: SANS }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: TEAL_DEEP }} />
          <p className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".1em" }}>Loading culture guide…</p>
        </div>
      </div>
    );
  }

  const cityName = geo.city || geo.country;
  const regionFallbacksToShow = CITY_BUNDLES.filter((b) => b.fallback && regionResults[b.id]?.status === "ok");

  return (
    <LightboxProvider>
    <div className="min-h-screen" style={{ background: IVORY, fontFamily: SANS }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={() => navigate(createPageUrl("Home"))} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/5" style={{ background: "#FFFFFF", border: `1px solid ${RULE}` }} aria-label="Back">
            <ChevronLeft size={18} color={INK} strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full uppercase" style={{ background: CAT.culture.bg, color: CAT.culture.ink, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".08em", fontWeight: 500 }}>
            <Compass size={13} color={CAT.culture.ink} strokeWidth={2} /> Cultural Info
          </div>
          <button onClick={() => loadAll(true)} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/5" style={{ background: "#FFFFFF", border: `1px solid ${RULE}` }} title="Refresh all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} color={INK} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* COUNTRY TITLE */}
      <div className={`px-4 ${colWrap} mx-auto pb-2 text-center`}>
        <h1 className="italic leading-none" style={{ fontFamily: SERIF, fontSize: fs(38), color: CAT.culture.ink }}>{geo.country || "Your destination"}</h1>
        <p className="uppercase mt-2 font-semibold" style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: "0.16em", color: INK3 }}>Traveler's Culture Guide</p>
      </div>

      <div className={`${colWrap} mx-auto`}>
        {/* Location display */}
        <div className="px-4 mb-3">
          <div className="bg-white rounded-[22px] p-4" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="shrink-0 rounded-2xl flex items-center justify-center" style={{ width: 42, height: 42, background: LAYER.city.bg, fontSize: 20, lineHeight: 1 }}>{locationMode === "current" ? "📍" : "🧭"}</div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, lineHeight: 1.1 }}>{cityName}</p>
                  {hasData(geo.country) && <p className="truncate uppercase mt-0.5" style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".06em", color: INK3 }}>{geo.country}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {locationMode === "navigate" && (
                  <button onClick={() => switchToCurrentLocation()} className="p-2 rounded-xl transition-colors hover:brightness-95" style={{ background: LAYER.city.bg }} title="Use Current Location">
                    <Navigation className="w-4 h-4" style={{ color: TEAL_DEEP }} />
                  </button>
                )}
                <button onClick={() => setShowLocationPicker(true)} className="font-bold underline underline-offset-2 shrink-0" style={{ color: TEAL_DEEP, fontSize: fs(13) }}>Change</button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4 pb-24">
          {/* 🌎 COUNTRY ESSENTIALS */}
          <Divider icon="🌎" label="Country Essentials" layer="country" sublabel={`The big picture of ${geo.country || "the country"}.`} />
          <CardGrid isTablet={isTablet}>
            {COUNTRY_BUNDLES.flatMap((bundle) =>
              bundle.cards.map((card) => (
                <SectionCard key={`${bundle.id}_${card.id}`} card={card} bundle={bundle} layer="country"
                  state={results[bundle.id]} onRefresh={() => refreshSection(bundle, "country")}
                  wikidataCountry={bundle.id === "country_leadership" ? geo.country : undefined} />
              ))
            )}
          </CardGrid>

          {/* 📍 CITY LOCAL GUIDE */}
          <Divider icon="📍" label="City Local Guide" layer="city" sublabel={`Specific to ${cityName}.`} />
          <CardGrid isTablet={isTablet}>
            {CITY_BUNDLES.flatMap((bundle) =>
              bundle.cards.map((card) => (
                <SectionCard key={`${bundle.id}_${card.id}`} card={card} bundle={bundle} layer="city"
                  state={results[bundle.id]} onRefresh={() => refreshSection(bundle, "city")} />
              ))
            )}
          </CardGrid>

          {/* 🧭 NEARBY REGION (fallback) */}
          {regionFallbacksToShow.length > 0 && (
            <>
              <Divider icon="🧭" label="Nearby Region" layer="region" sublabel={`Not specific to ${cityName} — shown for the surrounding region.`} />
              <CardGrid isTablet={isTablet}>
                {regionFallbacksToShow.flatMap((bundle) =>
                  bundle.cards.map((card) => (
                    <SectionCard key={`region_${bundle.id}_${card.id}`} card={card} bundle={bundle} layer="region"
                      state={regionResults[bundle.id]} onRefresh={() => refreshSection(bundle, "region")} />
                  ))
                )}
              </CardGrid>
            </>
          )}
        </div>
      </div>

      <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
    </div>
    </LightboxProvider>
  );
}
