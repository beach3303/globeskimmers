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
import { ruleParse, shoppingCategoryFor, finderQuery } from "@/lib/searchPlan";
// The pure planning code lives in searchPlan.js (shared with the test suite);
// re-exported so existing imports keep working.
export { ruleParse, ratingIntent, priceIntent, tidyQuery, lateNightIntent, barsIntent, finderQuery, HAS_IN_CLAUSE, KEYWORD_MAP, shoppingCategoryFor, planSearch, GENERIC_QUERY } from "@/lib/searchPlan";

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
  const { category, scope, place, query, parsedBy, sort, nearFirst, maxPrice, lateNight, bars, venue } = parsed || {};
  const cat = category ? SEARCH_CATEGORIES[category] : null;

  // 1. Resolve place / re-center.
  let recentered = false;
  let needsStay = false;
  let placeCountry = null; // "in Tijuana" means Mexico — not San Diego across the border
  if (scope === "named_place" && place) {
    try {
      // Big cities: look up "<city> city" and center on its landmark cluster.
      const { data } = await callWorker(ROUTE.searchLocation, { query: parsed.lookup || place, touristCenter: !nearFirst });
      const loc = data?.results?.[0];
      if (loc) { await location.switchToNavigateMode(loc); recentered = true; placeCountry = loc.address?.country || null; }
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
    if (category === "restroom" && venue) {
      opts = { state: { presetVenueType: venue } }; // Public / Transit / Parks filter
    } else if (category === "shopping") {
      // Shopping takes a category chip, not free text — map the query to one.
      const shopCat = shoppingCategoryFor(query);
      if (shopCat) opts = { state: { presetCategory: shopCat } };
    } else if (cat.acceptsQuery && (query || sort || nearFirst || maxPrice || lateNight || bars)) {
      // A generic word ("restaurants", "food", "cafes", "things to do") isn't a
      // keyword to send to Google — it means BROWSE the place (founder,
      // 2026-10-07: bare "restaurant" in Munich returned nothing from Google).
      const q = finderQuery(parsed); // shared with the test suite (searchPlan.js)
      // presetSort 'rating' = "best / top rated" was typed — the finder orders
      // by review-weighted rating instead of distance.
      opts = { state: { ...(q ? { presetQuery: q } : {}), ...(sort ? { presetSort: sort } : {}), ...(nearFirst ? { presetNearFirst: true } : {}), ...(placeCountry ? { presetCountry: placeCountry } : {}), ...(maxPrice ? { presetMaxPrice: maxPrice } : {}), ...(lateNight ? { presetLateNight: true } : {}), ...(bars && category === "eat" ? { presetBars: true } : {}) } };
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
