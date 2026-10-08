// searchPlan.js — the PURE half of Smart Search: turns typed text into a
// search plan {category, scope, place, region, query, sort, maxPrice,
// lateNight, nearFirst} (+ an optional dream destination). No app imports, so
// the app AND the worldwide test suite (scripts/search-eval) run the exact
// same code — before 2026-10-07 the overlay held this logic and every test
// harness had to copy it. The AI parser is injected (parseAI), so tests call
// the live /parse-search and the app calls it through callWorker.
import { countryCode } from "./countries.js";
import { stateInfo } from "./stateNicknames.js";

// Most-specific categories first; `eat` is the food catch-all and stays last.
export const KEYWORD_MAP = [
  { cat: "coffee",      words: ["coffee", "café", "cafe", "espresso", "latte", "cappuccino", "cold brew", "macchiato", "matcha", "boba", "bubble tea"] },
  { cat: "things",      words: ["things to do", "things to see", "attraction", "museum", "sightsee", "landmark", "hike", "hiking", "viewpoint", "day trip", "tourist", "what to do", "food market", "farmers market", "farmer's market", "mercado", "market hall", "club", "nightclub", "night club", "dance club", "dancing"] },
  { cat: "shopping",    words: ["shopping", "souvenir", "mall", "boutique", "outlet", "shop for", "where to shop", "night market", "flea market", "bazaar", "supermarket", "grocery", "groceries"] },
  { cat: "atm",         words: ["atm", "cash machine", "cash point", "withdraw cash"] },
  { cat: "money",       words: ["money exchange", "currency exchange", "exchange money", "bureau de change", "change money", "forex"] },
  { cat: "convenience", words: ["convenience store", "7-eleven", "corner store", "mini mart", "24 hour store"] },
  { cat: "restroom",    words: ["restroom", "bathroom", "toilet", "washroom"] },
  { cat: "weather",     words: ["weather", "forecast", "temperature"] },
  { cat: "eat",         words: ["restaurant", "food", "dinner", "lunch", "breakfast", "brunch", "eat", "ramen", "sushi", "pizza", "burger", "taco", "bakery", "dessert", "noodle", "bbq", "halal", "kosher", "vegan", "seafood", "steak", "dim sum", "pho", "curry", "kebab", "cheesecake", "croissant", "donut", "ice cream", "street food", "beer", "brewery", "pub", "wine bar", "cocktail", "bar"] },
];

const NEAR_ME = /\b(near\s*me|nearby|around\s*me|close\s*by|(?:from|around|near)\s+here)\b/i;
// "near my hotel", and also "near my Hilton hotel" / "by our beach airbnb".
const AT_STAY = /\b(near|at|by|around|from)\s+(my|our|the)\s+(?:[\w'’-]+\s+){0,2}(hotel|stay|airbnb|place|room|accommodation|lodging|resort|hostel|condo)\b/i;
// "... in Positano" / "... in New York" — a Capitalized place at the end.
const IN_PLACE = /\bin\s+([A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*){0,3})\s*$/;
// "street food near DLSU Taft" / "shaved ice near Arcadia" — a NAMED place
// after near / around / close to / next to (never "near me", "near my hotel").
const NEAR_PLACE = /\b(?:near|around|close\s+to|next\s+to|inside|at)\s+(?!me\b|my\b|our\b|here\b|the\s+(?:hotel|area)\b)([A-Z][\w'’.&-]*(?:\s+[A-Za-z][\w'’.&-]*){0,3})\s*$/;
// Any place clause the capitalized rules can't settle ("in atlanta", "near
// arcadia", "in Atlanta with great reviews") — the AI parser decides those.
export const HAS_IN_CLAUSE = /\b(?:in|near|around|close\s+to|next\s+to)\s+(?!me\b|my\b|our\b|here\b|the\s+(?:hotel|area)\b)[\p{L}]/iu;

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

// Trailing filler nouns blur the keyword sent to Google (founder, 2026-10-07:
// "brunch spot" in NYC returned 9 places; "brunch" returns the real list).
// Question scaffolding and taste words aren't keywords (founder, 2026-10-07:
// "where can i find affordable but delicious food in tokyo" was sent to Google
// verbatim and returned 4 random places).
const SCAFFOLD = /^(?:where\s+(?:can|could|should|do)\s+(?:i|we)\s+(?:find|get|eat|buy|have|try|go\s+for|go\s+to|drink)|where\s+to\s+(?:find|get|eat|buy|go)|(?:can|could)\s+you\s+(?:find|show)\s+me|find\s+me|show\s+me|i\s+(?:want|need|am\s+looking\s+for)|looking\s+for|are\s+there(?:\s+any)?|is\s+there(?:\s+an?)?|what\s+are(?:\s+the)?|which)\s+/i;
// Price words become the finder's price filter: 1 = inexpensive, 2 = moderate.
export function priceIntent(text) {
  const t = String(text || "");
  const afford = /\b(?:affordable|inexpensive|budget[\s-]friendly|reasonabl[ey](?:\s+priced)?|not\s+(?:too\s+)?expensive|good[\s-]value)\b/i.test(t);
  const cheap = !afford && /\b(?:cheap|budget|low[\s-]cost|dirt[\s-]cheap)\b/i.test(t);
  const maxPrice = cheap ? 1 : afford ? 2 : 0;
  const cleaned = maxPrice ? t.replace(/\b(?:budget[\s-]friendly|cheap|budget|low[\s-]cost|dirt[\s-]cheap|affordable|inexpensive|reasonabl[ey](?:\s+priced)?|not\s+(?:too\s+)?expensive|good[\s-]value)\b/gi, " ") : t;
  return { maxPrice, cleaned };
}
// "open late", "late night", "24 hours" → the finder's strict Late-night
// filter (real hours: still open past 10 PM today), not a keyword.
const LATE_NIGHT = /\b(?:open\s+late|opens?\s+late|late[\s-]night|after\s+(?:10|11|midnight)(?:\s*pm)?|24[\s/-]?(?:hours?|hrs?|7)|all[\s-]night|still\s+open)\b/i;
export const lateNightIntent = (text) => LATE_NIGHT.test(String(text || ""));
export const tidyQuery = (q) => {
  const t = String(q || "").replace(/\s+/g, " ").trim().replace(SCAFFOLD, "")
    .replace(new RegExp(LATE_NIGHT.source, "gi"), " ")
    .replace(/\b(?:that|which|who)\s+(?:are|is)\b/gi, " ").replace(/\s+(?:are|is)\s*$/i, "")
    .replace(/\b(?:delicious|tasty|yummy|amazing|good|great|impressive|nice)\b/gi, " ")
    .replace(/^(?:\s*(?:but|and|some|any)\b)+/i, " ").replace(/\s+(?:but|and)\s*$/i, "")
    .replace(/\s+/g, " ").trim();
  const stripped = t.replace(/\s+(?:spots?|places?|joints?|options?|ideas?)$/i, "").trim();
  return stripped || t;
};

// Free client rule-pass. Returns {category, scope, place, query, sort,
// parsedBy, confidence}. confidence >= 0.8 → skip the AI call.
export function ruleParse(raw, scopeChip) {
  // Trailing "?", "!" or "." would hide the place from the end-anchored rules.
  const text = String(raw || "").trim().replace(/[?!.。！？]+$/u, "").trim();

  let category = null;
  for (const { cat, res } of KEYWORD_RES) {
    if (res.some((re) => re.test(text))) { category = cat; break; }
  }

  // A place TYPED in the query wins over the chip (founder, 2026-10-07: "In
  // Atlanta" beats the default Near me — the chip is on by default, so the old
  // `if (!scope)` guard meant a typed city was never honored).
  let scope = scopeChip || null;
  let place = null;
  const m = text.match(IN_PLACE) || text.match(NEAR_PLACE);
  if (m) { scope = "named_place"; place = m[1].trim(); }
  else if (!scope) {
    if (AT_STAY.test(text)) scope = "at_stay";
    else if (NEAR_ME.test(text)) scope = "near_me";
  }

  // Strip scope phrases so the finder searches the THING, not "ramen near me".
  let query = text.replace(new RegExp(NEAR_ME.source, "gi"), "").replace(AT_STAY, ""); // every near-me phrase ("nearby … from here")
  if (place) query = query.replace(/\b(?:in|near|around|close\s+to|next\s+to|inside|at)\s+[A-Z][\s\S]*$/, "");
  // Taste words ("delicious", "tasty") mean the traveler wants the GOOD ones.
  const tasty = /\b(?:delicious|tasty|yummy|amazing)\b/i.test(text);
  const price = priceIntent(query);
  const { sort, cleaned } = ratingIntent(price.cleaned);
  query = tidyQuery(cleaned);
  const maxPrice = price.maxPrice;

  const confident = !!(category || place || (scope && scope !== "named_place"));
  return { category, scope, place, query, sort: sort || (tasty ? "rating" : null), maxPrice, lateNight: lateNightIntent(text), parsedBy: "rule", confidence: confident ? 0.85 : 0.2 };
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


// A generic word ("restaurants", "food", "cafes", "things to do") isn't a
// keyword to send to Google — it means BROWSE the place (founder, 2026-10-07:
// bare "restaurant" in Munich returned nothing from Google).
// Nightlife words turn on the food finder's Bars switch — bars are hidden
// otherwise (founder, 2026-10-07: "speakeasies in Tokyo" gave 10 places
// without it, 55 with it).
const NIGHTLIFE = /\b(?:bars?|pubs?|speakeas(?:y|ies)|cocktails?|lounges?|brewer(?:y|ies)|beers?|wine\s+bars?|happy\s+hour|izakayas?|taverns?)\b/i;
// Clubs and dancing go to Things to Do (a text search), not the food finder.
// "public / free restroom", "restroom in the station", "…in the park" → the
// restroom finder's own venue filter (Round 1: "public restroom near me"
// returned restaurants and bars).
export function restroomVenue(text) {
  const t = String(text || "");
  if (/\b(?:station|metro|subway|train|bus\s+terminal|airport)\b/i.test(t)) return "transit";
  if (/\b(?:park|beach|trail)\b/i.test(t)) return "outdoor";
  if (/\b(?:public|free|city|municipal)\b/i.test(t)) return "public";
  return null;
}
export const barsIntent = (text) => NIGHTLIFE.test(String(text || ""));

export const GENERIC_QUERY = /^(?:the\s+)?(?:restaurants?|food|foods|places?\s+to\s+eat|eats?|dining|somewhere\s+to\s+eat|coffee|coffee\s+shops?|caf[eé]s?|things\s+to\s+do|attractions?|activities)$/i;

// What the finder should actually send: a generic word browses the place —
// EXCEPT "best …", which needs Google's RATED results: our own browse data
// carries no ratings (Madrid's included a metro station). Measured 2026-10-07
// in Tokyo / Madrid / Paris: "best restaurants" returned 18-20 rated places
// everywhere; bare "restaurants" only 9 in Tokyo.
export function finderQuery(parsed) {
  const q = String(parsed?.query || "").trim();
  if (!GENERIC_QUERY.test(q)) return q;
  if (parsed?.sort === "rating" && parsed?.category === "eat") return "best restaurants";
  return "";
}

const WATER = /\b(bay|lake|sea|ocean|gulf|river|harbou?r|lagoon|strait)\b/i;
const NOT_PLACE_ACRONYMS = /\b(ATM|ATV|BBQ|KFC|USA|DIY|VIP|BYOB|IHOP)\b/g;

// The whole plan, in the order the search screen used to run it inline.
// opts: { scope = "near_me", scopeTouched = false, explicitPlace = null,
//         activePhrase = "", parseAI: async (body) => data|null }
// Returns { parsed, destination }.
export async function planSearch(raw, opts = {}) {
  const { scope = "near_me", scopeTouched = false, explicitPlace = null, activePhrase = "", parseAI = null } = opts;
  let parsed = ruleParse(raw, scope);
  if (explicitPlace) { parsed.scope = "named_place"; parsed.place = String(explicitPlace).trim(); }
  const sort = parsed.sort || null; // "best / top rated" — kept whichever parser wins
  let isBigCity = null;
  const bigCities = async () => {
    if (!isBigCity) { try { isBigCity = (await import("./bigCities.js")).isBigCity; } catch { isBigCity = () => false; } }
    return isBigCity;
  };
  // A big city typed with no "in" ("vegan restaurants tokyo"): the last 1-3
  // words are checked against the big-city list (lazy, submit-time only).
  if (!parsed.place && !explicitPlace) {
    const big = await bigCities();
    const words = parsed.query.split(/\s+/);
    for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
      const tail = words.slice(-n).join(" ");
      if (big(tail)) {
        parsed.place = tail; parsed.scope = "named_place";
        // drop a dangling "in" / "near" left before the city ("…seating in munich")
        parsed.query = words.slice(0, -n).join(" ").replace(/\s+(?:in|near|around|at)$/i, "").trim();
        break;
      }
    }
  }
  let destination = null;
  // AI when the rules found nothing, OR a place clause they couldn't settle,
  // OR a country/state (→ best city), a body of water (→ shore district), or
  // an acronym / typo'd place ("dear DLSU taft").
  const unresolvedPlace = !parsed.place && HAS_IN_CLAUSE.test(raw);
  const areaPlace = !!parsed.place && !!(countryCode(parsed.place) || stateInfo(parsed.place));
  const waterPlace = !!parsed.place && WATER.test(parsed.place);
  const acronym = !parsed.place && /\b[A-Z]{2,6}\b/.test(String(raw).replace(NOT_PLACE_ACRONYMS, ""));
  if (raw && !explicitPlace && parseAI && (!parsed.category || unresolvedPlace || areaPlace || waterPlace || acronym)) {
    try {
      const data = await parseAI({ query: raw, scope: scopeTouched ? scope : "", activePhrase: activePhrase || "" });
      if (data && typeof data === "object" && !data.error) {
        destination = (data.destination && typeof data.destination === "object" && data.destination.name) ? data.destination : null;
        const aiQuery = ratingIntent(String(data.query || "").trim());
        parsed = {
          // The free rules' category stands when the AI only came in for the place.
          category: data.category || parsed.category || null,
          scope: data.scope && data.scope !== "unknown" ? data.scope : (scope || null),
          place: (data.place || "").trim() || null,
          region: (data.region || "").trim() || null,
          query: tidyQuery(priceIntent(aiQuery.cleaned).cleaned) || parsed.query,
          sort: sort || aiQuery.sort,
          maxPrice: parsed.maxPrice || priceIntent(String(data.query || "")).maxPrice || 0,
          lateNight: parsed.lateNight || false,
          parsedBy: "ai",
          confidence: typeof data.confidence === "number" ? data.confidence : 0.9,
        };
      }
    } catch { /* keep the rule result */ }
  }
  // The AI recognized a country/state but didn't narrow it ("Maine" came back
  // as Maine) — fall back to a sensible city for the area.
  if (parsed.place && (countryCode(parsed.place) || stateInfo(parsed.place))) {
    try {
      const { cityForArea } = await import("./areaCities.js");
      const city = cityForArea(parsed.place);
      if (city) { parsed.region = parsed.region || parsed.place; parsed.place = city; }
    } catch { /* stays as typed */ }
  }
  parsed.bars = barsIntent(raw);
  if (parsed.category === "restroom") parsed.venue = restroomVenue(raw);
  // A NAMED smaller place (Redondo Beach) → nearby results lead; a big city
  // (LA, Tokyo, Atlanta) is searched whole.
  if (parsed.place && (parsed.scope === "named_place" || !parsed.scope)) {
    const big = await bigCities();
    parsed.nearFirst = !big(parsed.place) && !parsed.region;
  }
  return { parsed, destination };
}
