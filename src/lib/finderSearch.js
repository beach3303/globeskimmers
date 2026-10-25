// finderSearch — what a finder's own search box understands (founder, 2026-10-25: "yes build", after
// the audit found the Places to Eat, Coffee and Things to Do boxes only searched the words, around
// wherever the page already was). The same rules as Home's Smart Search (searchPlan.js):
//   · a place in the text moves the page there ("ramen in Tokyo", "museums near Shibuya");
//   · "best / top rated" sorts by rating; "cheap / affordable" sets the price; "open late" the
//     late-night filter; "bars / pubs" the bars switch (the page decides which it has);
//   · words that point at another finder ("ATM" typed on Places to Eat) offer that finder;
//   · the phrasing is tidied ("where can I find good pho" → "pho").
// The page's own engine still runs the search: dish tiers on Places to Eat, drinks on Coffee,
// activity words on Things to Do. The AI parser is asked only when a place clause needs it ("in
// atlanta", "near arcadia"), so a plain word stays instant and free.
//
//   planFinderSearch(raw, { world, activePhrase }) → plan:
//     { query, sort, maxPrice, lateNight, bars, place, lookup, nearFirst, region, other }
//     query   what the page's engine should search ('' = browse the place)
//     other   { category, page, label } when the words belong to another finder, else null
//   moveToPlace(plan, location) → { moved, country }   re-centers the app on plan.place
//   finderRecents(world), saveFinderRecent(world, text) the box's recent searches (this phone only)
//   regionFallback(plan) → a plan at the area's main city when the narrowed spot found nothing
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { planSearch, finderQuery, tidyQuery, HAS_IN_CLAUSE } from "@/lib/searchPlan";

const OWN = { eat: "eat", coffee: "coffee", things: "things" };
// The finders a typed word can point to, by Smart Search category.
const FINDERS = {
  eat: { page: "PlacesToEat", label: "Places to Eat" },
  coffee: { page: "CoffeeFinder", label: "Coffee" },
  things: { page: "ThingsToDo", label: "Things to Do" },
  events: { page: "Events", label: "Events & festivals" },
  shopping: { page: "Shopping", label: "Shopping" },
  atm: { page: "ATMFinder", label: "ATMs" },
  money: { page: "MoneyExchange", label: "Money Exchange" },
  convenience: { page: "ConvenienceStore", label: "Convenience stores" },
  restroom: { page: "RestroomFinder", label: "Restrooms" },
  weather: { page: "Weather", label: "Weather" },
};

export async function planFinderSearch(raw, { world, activePhrase = "" } = {}) {
  const text = String(raw || "").trim();
  const own = OWN[world] || null;
  // The AI only settles a place clause the rules couldn't ("in atlanta", "near DLSU Taft").
  const needsPlace = HAS_IN_CLAUSE.test(text);
  const { parsed } = await planSearch(text, {
    scope: "near_me",
    scopeTouched: false,
    activePhrase,
    parseAI: needsPlace
      ? async (body) => {
        const { data, error } = await callWorker(ROUTE.parseSearch, body);
        return !error && data && typeof data === "object" && !data.error ? data : null;
      }
      : null,
  });
  // A finder box often holds a name: "Restaurant at Meadowood", "Café inside Union Station" never
  // move the page; only "in …" or "near …" a place does. Then the words stay whole.
  const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const viaAt = !!parsed.place && new RegExp(`\\b(?:at|inside)\\s+${esc(parsed.place)}\\s*$`, "i").test(text);
  if (viaAt) { parsed.place = null; parsed.scope = "near_me"; parsed.query = tidyQuery(text); }
  const named = parsed.scope === "named_place" && parsed.place ? parsed.place : null;
  const otherCat = parsed.category && parsed.category !== own && FINDERS[parsed.category] ? parsed.category : null;
  // "best coffee" browses nothing useful (our café list carries no ratings): ask Google's rated
  // cafés, the way finderQuery asks "best restaurants" for Places to Eat.
  let query = finderQuery({ ...parsed, category: own });
  if (!query && own === "coffee" && parsed.sort === "rating") query = "best coffee";
  return {
    query,
    sort: parsed.sort || null,
    maxPrice: parsed.maxPrice || 0,
    lateNight: !!parsed.lateNight,
    bars: !!parsed.bars,
    place: named,
    lookup: named ? (parsed.lookup || named) : null,
    nearFirst: named ? !!parsed.nearFirst : false,
    region: parsed.region || null,
    other: otherCat ? { category: otherCat, ...FINDERS[otherCat] } : null,
  };
}

// Re-center the app on the plan's place, the way Home's search does. The page's own location
// effect then searches there.
export async function moveToPlace(plan, location) {
  if (!plan?.place || !location?.switchToNavigateMode) return { moved: false, country: null };
  try {
    const { data } = await callWorker(ROUTE.searchLocation, { query: plan.lookup || plan.place, touristCenter: !plan.nearFirst });
    const loc = data?.results?.[0];
    if (!loc) return { moved: false, country: null };
    await location.switchToNavigateMode(loc);
    return { moved: true, country: loc.address?.country || null };
  } catch { return { moved: false, country: null }; }
}

const RECENTS = (world) => `gs_finder_recents_v1:${world}`;
export function finderRecents(world) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENTS(world)) || "[]");
    return Array.isArray(list) ? list.filter((t) => typeof t === "string" && t.trim()).slice(0, 5) : [];
  } catch { return []; }
}
export function saveFinderRecent(world, text) {
  const t = String(text || "").trim();
  if (!t) return;
  try {
    const next = [t, ...finderRecents(world).filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENTS(world), JSON.stringify(next));
  } catch { /* storage off */ }
}

// A search that came back empty after the AI narrowed a country or state to one spot ("French
// Polynesia" → Rangiroa, where "snorkel with whales" finds nothing) gets one more try at the
// area's main city (Papeete). Returns that plan, or null when there is nothing else to try.
export async function regionFallback(plan) {
  if (!plan?.region) return null;
  const { cityForArea } = await import("@/lib/areaCities");
  const city = cityForArea(plan.region);
  if (!city || city.toLowerCase() === String(plan.place || "").toLowerCase()) return null;
  return { ...plan, place: city, lookup: city.includes(",") ? city : `${city}, ${plan.region}`, nearFirst: false, region: null };
}
