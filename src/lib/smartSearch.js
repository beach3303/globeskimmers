// smartSearch.js — the "Smart-Search spine" brain.
//
// Turns a free-text query ("ramen near my hotel", "things to do in Tokyo",
// "Positano") into structured intent {category, scope, place, query}, then
// dispatches: re-centers the app on the right place and opens the right finder
// with the query prefilled. A bare place re-centers Home itself (its Discover
// feed becomes a destination overview). Every search is logged to the demand
// graph.
//
// Cost-first: a FREE client rule-pass handles the common cases; the Haiku parser
// (/parse-search — prompt-cached, KV 24h, ~$0.0009/miss) is only called for the
// ambiguous minority, and degrades to the rule result if it's unavailable.
// Reuses existing primitives — searchLocation, switchToNavigateMode,
// getPrimaryStay, logSearch.
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { createPageUrl } from "@/utils";
import { logSearch } from "@/lib/logSearch";
import { getPrimaryStay } from "@/lib/savedLocations";

// category → { page (createPageUrl target), log (logSearch category vocab),
// acceptsQuery (does the finder read state.presetQuery?) }.
export const SEARCH_CATEGORIES = {
  eat:        { page: "PlacesToEat",      log: "eat",          acceptsQuery: true },
  coffee:     { page: "CoffeeFinder",     log: "coffee",       acceptsQuery: true },
  things:     { page: "ThingsToDo",       log: "things_to_do", acceptsQuery: true },
  shopping:   { page: "Shopping",         log: "shopping",     acceptsQuery: false },
  atm:        { page: "ATMFinder",        log: "atm",          acceptsQuery: false },
  money:      { page: "MoneyExchange",    log: "transport",    acceptsQuery: false },
  convenience:{ page: "ConvenienceStore", log: "shopping",     acceptsQuery: false },
  restroom:   { page: "RestroomFinder",   log: "transport",    acceptsQuery: false },
  weather:    { page: "Weather",          log: "transport",    acceptsQuery: false },
};

// Most-specific categories first; `eat` is the food catch-all and stays last.
const KEYWORD_MAP = [
  { cat: "coffee",      words: ["coffee", "café", "cafe", "espresso", "latte", "cappuccino", "cold brew", "macchiato", "matcha", "boba", "bubble tea"] },
  { cat: "things",      words: ["things to do", "things to see", "attraction", "museum", "sightsee", "landmark", "hike", "hiking", "viewpoint", "day trip", "tourist", "what to do"] },
  { cat: "shopping",    words: ["shopping", "souvenir", "mall ", "boutique", "outlet", "shop for", "where to shop"] },
  { cat: "atm",         words: ["atm", "cash machine", "cash point", "withdraw cash"] },
  { cat: "money",       words: ["money exchange", "currency exchange", "exchange money", "bureau de change", "change money", "forex"] },
  { cat: "convenience", words: ["convenience store", "7-eleven", "corner store", "mini mart", "24 hour store"] },
  { cat: "restroom",    words: ["restroom", "bathroom", "toilet", "washroom"] },
  { cat: "weather",     words: ["weather", "forecast", "temperature"] },
  { cat: "eat",         words: ["restaurant", "food", "dinner", "lunch", "breakfast", "brunch", "eat", "ramen", "sushi", "pizza", "burger", "taco", "bakery", "dessert", "noodle", "bbq", "halal", "kosher", "vegan", "seafood", "steak", "dim sum", "pho", "curry", "kebab", "cheesecake", "croissant", "donut", "ice cream", "street food"] },
];

const NEAR_ME = /\b(near\s*me|nearby|around\s*me|close\s*by)\b/i;
const AT_STAY = /\b(near|at|by|around|from)\s+(my|our|the)\s+(hotel|stay|airbnb|place|room|accommodation|lodging)\b/i;
// "... in Positano" / "... in New York" — a Capitalized place at the end.
const IN_PLACE = /\bin\s+([A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*){0,3})\s*$/;
// Any other "in <something>" clause the capitalized rule can't settle ("in
// atlanta", "in Atlanta with great reviews") — the AI parser decides those.
export const HAS_IN_CLAUSE = /\bin\s+[\p{L}]/u;

// Whole-word keyword match (founder, 2026-10-07): substring matching sent
// "Seattle" and "great views" to restaurants (e-AT), "cozy atmosphere" to ATMs
// and "charge my phone" to restaurants (PHO-ne). A keyword matches only as a
// whole word, plurals allowed (tacos, museums, eats, bakeries).
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w) => {
  const stem = w.endsWith("y") ? `${esc(w.slice(0, -1))}(?:y|ies)` : `${esc(w)}(?:s|es)?`;
  return new RegExp(`(?<![\\p{L}\\p{N}])${stem}(?![\\p{L}\\p{N}])`, "iu");
};
const KEYWORD_RES = KEYWORD_MAP.map(({ cat, words }) => ({ cat, res: words.map((w) => wordRe(w.trim())) }));

// "best / top rated / highest rated" (founder, 2026-10-07): the traveler wants
// the list ordered by rating, not distance. The phrase is stripped from the
// query so the finder searches the THING; the finder sorts by a review-
// weighted rating so a 5.0 with three reviews can't win.
const RATING_PHRASE = /\b(?:with\s+(?:the\s+)?(?:highest|best|top)\s+ratings?|(?:the\s+)?(?:highest|best|top|highly)[\s-]rated|(?:5|five)[\s-]stars?|(?:the\s+)?best)\b/gi;
export function ratingIntent(text) {
  const t = String(text || "");
  RATING_PHRASE.lastIndex = 0;
  if (!RATING_PHRASE.test(t)) return { sort: null, cleaned: t };
  RATING_PHRASE.lastIndex = 0;
  const cleaned = t.replace(RATING_PHRASE, " ")
    .replace(/\bmost\s+(?=authentic|traditional|legit)/i, "")
    .replace(/\s+/g, " ").trim();
  return { sort: "rating", cleaned };
}

// Free client rule-pass. Returns {category, scope, place, query, sort,
// parsedBy, confidence}. confidence >= 0.8 → skip the AI call.
export function ruleParse(raw, scopeChip) {
  const text = String(raw || "").trim();

  let category = null;
  for (const { cat, res } of KEYWORD_RES) {
    if (res.some((re) => re.test(text))) { category = cat; break; }
  }

  // A place TYPED in the query wins over the chip (founder, 2026-10-07: "In
  // Atlanta" beats the default Near me — the chip is on by default, so the old
  // `if (!scope)` guard meant a typed city was never honored).
  let scope = scopeChip || null;
  let place = null;
  const m = text.match(IN_PLACE);
  if (m) { scope = "named_place"; place = m[1].trim(); }
  else if (!scope) {
    if (AT_STAY.test(text)) scope = "at_stay";
    else if (NEAR_ME.test(text)) scope = "near_me";
  }

  // Strip scope phrases so the finder searches the THING, not "ramen near me".
  let query = text.replace(NEAR_ME, "").replace(AT_STAY, "");
  if (place) query = query.replace(/\bin\s+[A-Z][\s\S]*$/, "");
  const { sort, cleaned } = ratingIntent(query);
  query = cleaned.replace(/\s+/g, " ").trim();

  const confident = !!(category || place || (scope && scope !== "named_place"));
  return { category, scope, place, query, sort, parsedBy: "rule", confidence: confident ? 0.85 : 0.2 };
}

// Haiku parse (only on rule-miss) via the cheap prompt-cached /parse-search
// worker endpoint (~$0.0009/miss, KV-cached 24h). Returns the parsed shape, or
// null on failure so the caller keeps the free rule result. Degrades gracefully
// if the endpoint isn't deployed yet (→ null → rule-only).
export async function aiParse(raw, scopeChip, activePhrase) {
  const { data, error } = await callWorker(ROUTE.parseSearch, {
    query: raw,
    scope: scopeChip || "",
    activePhrase: activePhrase || "",
  });
  if (error || !data || typeof data !== "object" || data.error) return null;
  return {
    category: data.category || null,
    scope: data.scope && data.scope !== "unknown" ? data.scope : (scopeChip || null),
    place: (data.place || "").trim() || null,
    query: String(data.query || "").trim(),
    parsedBy: "ai",
    confidence: typeof data.confidence === "number" ? data.confidence : 0.9,
  };
}

// Parse a query into intent. `explicitPlace` (from the "A place…" chip picker)
// short-circuits place extraction; `activePhrase` gives the AI current-city
// context. Rule-first; AI only when the rule pass is unsure.
export async function parseSmartSearch(raw, { scopeChip, explicitPlace, activePhrase } = {}) {
  const ruled = ruleParse(raw, scopeChip);
  if (explicitPlace) { ruled.scope = "named_place"; ruled.place = String(explicitPlace).trim(); }
  if (ruled.confidence >= 0.85 || explicitPlace) return ruled;
  try {
    const ai = await aiParse(raw, scopeChip, activePhrase);
    if (ai) return ai;
  } catch { /* fall back to the rule result */ }
  return ruled;
}

// Map a shopping query to one of Shopping's category chips (Shopping takes a
// category, not free text). Returns a chip id or null. Order matters — more
// specific phrases ("night market", "supermarket") win over "market".
const SHOP_CATEGORY_KEYWORDS = [
  { id: "souvenir_shopping", words: ["souvenir", "gift", "keepsake"] },
  { id: "supermarkets", words: ["grocery", "groceries", "supermarket"] },
  { id: "luxury_shopping", words: ["luxury", "designer", "high end", "high-end"] },
  { id: "duty_free", words: ["duty free", "duty-free"] },
  { id: "night_markets", words: ["night market"] },
  { id: "malls", words: ["mall", "shopping center", "shopping centre"] },
  { id: "outlets", words: ["outlet", "discount"] },
  { id: "markets_bazaars", words: ["bazaar", "flea market", "market"] },
  { id: "local_crafts", words: ["craft", "handmade", "artisan"] },
];
export function shoppingCategoryFor(query) {
  const q = String(query || "").toLowerCase();
  if (!q) return null;
  for (const { id, words } of SHOP_CATEGORY_KEYWORDS) {
    if (words.some((w) => q.includes(w))) return id;
  }
  return null;
}

// Dispatch parsed intent: re-center + navigate + log. `location` is the
// LocationContext value (needs switchToNavigateMode). `navigate` is
// react-router's. Returns {routed, recentered, needsStay?, destinationMode?}.
export async function runSmartSearch(parsed, { navigate, location }) {
  const { category, scope, place, query, parsedBy, sort } = parsed || {};
  const cat = category ? SEARCH_CATEGORIES[category] : null;

  // 1. Resolve place / re-center.
  let recentered = false;
  let needsStay = false;
  if (scope === "named_place" && place) {
    try {
      const { data } = await callWorker(ROUTE.searchLocation, { query: place });
      const loc = data?.results?.[0];
      if (loc) { await location.switchToNavigateMode(loc); recentered = true; }
    } catch { /* couldn't geocode — stay on the current location */ }
  } else if (scope === "at_stay") {
    const stay = getPrimaryStay();
    if (stay) { await location.switchToNavigateMode(stay); recentered = true; }
    else needsStay = true; // caller can offer StayAnchor; we fall through to near-me
  }
  // near_me (and at_stay with no stay set) → keep the active location.

  // 2. Log the demand signal (city/country/intent/persona auto-attached).
  try {
    logSearch(cat ? cat.log : "destination", query || place || "", {
      scope: scope || "near_me",
      place: place || null,
      parsed_by: parsedBy || "rule",
      source: "smart_search",
    });
  } catch { /* non-fatal */ }

  // 3. Route.
  if (cat) {
    let opts;
    if (category === "shopping") {
      // Shopping takes a category chip, not free text — map the query to one.
      const shopCat = shoppingCategoryFor(query);
      if (shopCat) opts = { state: { presetCategory: shopCat } };
    } else if (cat.acceptsQuery && (query || sort)) {
      // presetSort 'rating' = "best / top rated" was typed — the finder orders
      // by review-weighted rating instead of distance.
      opts = { state: { ...(query ? { presetQuery: query } : {}), ...(sort ? { presetSort: sort } : {}) } };
    }
    navigate(createPageUrl(cat.page), opts);
    return { routed: cat.page, recentered, needsStay };
  }
  // Bare place → destination mode: land on the now-re-centered Home with the
  // place in router state so Home shows the "Exploring <place>" strip; its
  // Discover feed IS the "everything <place>" overview.
  navigate(createPageUrl("Home"), { state: { destinationSearch: place || null } });
  return { routed: "Home", recentered, needsStay, destinationMode: true };
}
