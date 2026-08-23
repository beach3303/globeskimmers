// logSearch — ONE canonical search event for every finder in the app.
//
// Routes through logDiscover so each query is automatically stamped with WHERE
// it was made: {city, country, intent (present|planning), persona}. That turns
// raw searches into the demand-intent graph — which dish / hotel / shop, in
// which city, and whether the user is there now (present) or planning about it
// (planning). NO personal data; aggregate behavior only.
// See the project_search_intent_graph memory for the full plan.
//
//   logSearch('eat',   'ramen',  { resultCount: 12, cuisine: 'japanese' })
//   logSearch('hotel', 'Paris',  { goal: 'sights', resultCount: 30 })
//   logSearch('shopping', 'Souvenir', { category: 'souvenir_shopping' })
//
// A search that returned NOTHING is the highest-value signal (a coverage gap =
// where to expand), so it gets its own event_type via logZeroResults — which
// keeps the existing `top_zero_results` admin query working, now geo-tagged too.
import { logDiscover } from "@/lib/logDiscover";

// category = the vertical: 'eat' | 'coffee' | 'things_to_do' | 'shopping' |
// 'hotel' | 'ride' | 'atm' | 'transport' | ...
export function logSearch(category, query, extra = {}) {
  const q = typeof query === "string" ? query.trim() : query;
  logDiscover("search", { category, query: q || null, ...extra });
}

// A search that came back empty. Same shape as logSearch so both slice the same
// way; kept as a distinct event_type so coverage-gap queries stay clean.
export function logZeroResults(category, query, extra = {}) {
  const q = typeof query === "string" ? query.trim() : query;
  logDiscover("search_zero_results", { category, query: q || null, ...extra });
}
