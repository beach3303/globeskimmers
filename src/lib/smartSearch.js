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
  hotel:      { page: "FindAHotel",       log: "hotel",        acceptsQuery: true },
  shopping:   { page: "Shopping",         log: "shopping",     acceptsQuery: false },
  atm:        { page: "ATMFinder",        log: "atm",          acceptsQuery: false },
  money:      { page: "MoneyExchange",    log: "transport",    acceptsQuery: false },
  ride:       { page: "GetARide",         log: "ride",         acceptsQuery: false },
  convenience:{ page: "ConvenienceStore", log: "shopping",     acceptsQuery: false },
  restroom:   { page: "RestroomFinder",   log: "transport",    acceptsQuery: false },
  weather:    { page: "Weather",          log: "transport",    acceptsQuery: false },
};

// Most-specific categories first; `eat` is the food catch-all and stays last.
const KEYWORD_MAP = [
  { cat: "coffee",      words: ["coffee", "café", "cafe", "espresso", "latte", "cappuccino", "cold brew", "macchiato", "matcha", "boba", "bubble tea"] },
  { cat: "hotel",       words: ["hotel", "where to stay", "place to stay", "accommodation", "lodging", "airbnb", "hostel", "motel", "resort", "book a room"] },
  { cat: "things",      words: ["things to do", "things to see", "attraction", "museum", "sightsee", "landmark", "hike", "hiking", "viewpoint", "day trip", "tourist", "what to do"] },
  { cat: "shopping",    words: ["shopping", "souvenir", "mall ", "boutique", "outlet", "shop for", "where to shop"] },
  { cat: "atm",         words: ["atm", "cash machine", "cash point", "withdraw cash"] },
  { cat: "money",       words: ["money exchange", "currency exchange", "exchange money", "bureau de change", "change money", "forex"] },
  { cat: "ride",        words: ["taxi", "uber", "lyft", "rent a car", "rental car", "airport transfer", "get a ride", "car rental"] },
  { cat: "convenience", words: ["convenience store", "7-eleven", "corner store", "mini mart", "24 hour store"] },
  { cat: "restroom",    words: ["restroom", "bathroom", "toilet", "washroom"] },
  { cat: "weather",     words: ["weather", "forecast", "temperature"] },
  { cat: "eat",         words: ["restaurant", "food", "dinner", "lunch", "breakfast", "brunch", "eat", "ramen", "sushi", "pizza", "burger", "taco", "bakery", "dessert", "noodle", "bbq", "halal", "kosher", "vegan", "seafood", "steak", "dim sum", "pho", "curry", "kebab", "cheesecake", "croissant", "donut", "ice cream", "street food"] },
];

const NEAR_ME = /\b(near\s*me|nearby|around\s*me|close\s*by)\b/i;
const AT_STAY = /\b(near|at|by|around|from)\s+(my|our|the)\s+(hotel|stay|airbnb|place|room|accommodation|lodging)\b/i;
// "... in Positano" / "... in New York" — a Capitalized place at the end.
const IN_PLACE = /\bin\s+([A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*){0,3})\s*$/;

// Free client rule-pass. Returns {category, scope, place, query, parsedBy,
// confidence}. confidence >= 0.8 → skip the AI call.
export function ruleParse(raw, scopeChip) {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();

  let category = null;
  for (const { cat, words } of KEYWORD_MAP) {
    if (words.some((w) => lower.includes(w))) { category = cat; break; }
  }

  let scope = scopeChip || null;
  let place = null;
  if (!scope) {
    if (AT_STAY.test(text)) scope = "at_stay";
    else if (NEAR_ME.test(text)) scope = "near_me";
    else {
      const m = text.match(IN_PLACE);
      if (m) { scope = "named_place"; place = m[1].trim(); }
    }
  }

  // Strip scope phrases so the finder searches the THING, not "ramen near me".
  let query = text.replace(NEAR_ME, "").replace(AT_STAY, "");
  if (place) query = query.replace(/\bin\s+.*$/i, "");
  query = query.replace(/\s+/g, " ").trim();

  const confident = !!(category || place || (scope && scope !== "named_place"));
  return { category, scope, place, query, parsedBy: "rule", confidence: confident ? 0.85 : 0.2 };
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

// Dispatch parsed intent: re-center + navigate + log. `location` is the
// LocationContext value (needs switchToNavigateMode). `navigate` is
// react-router's. Returns {routed, recentered, needsStay?, destinationMode?}.
export async function runSmartSearch(parsed, { navigate, location }) {
  const { category, scope, place, query, parsedBy } = parsed || {};
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
    const opts = cat.acceptsQuery && query ? { state: { presetQuery: query } } : undefined;
    navigate(createPageUrl(cat.page), opts);
    return { routed: cat.page, recentered, needsStay };
  }
  // Bare place → destination mode: land on the now-re-centered Home with the
  // place in router state so Home shows the "Exploring <place>" strip; its
  // Discover feed IS the "everything <place>" overview.
  navigate(createPageUrl("Home"), { state: { destinationSearch: place || null } });
  return { routed: "Home", recentered, needsStay, destinationMode: true };
}
