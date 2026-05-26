/**
 * ============================================================================
 * GLOBESKIMMERS - getRestaurants v5.1
 * ============================================================================
 *
 * CHANGES vs v4.6:
 *   - FIX: sports_bar nearby now uses rankBy=POPULARITY instead of DISTANCE
 *     Root cause of missing Rocco's Tavern, Lucky Baldwin's, Barney's Beanery:
 *     DISTANCE filled 20 slots with the closest dive bars in Arcadia, leaving out
 *     Pasadena's famous sports bars 10-15mi away. POPULARITY surfaces high-traffic
 *     well-known bars regardless of exact distance within the 25mi radius.
 *   - FIX: sports_bar 2nd text query changed from 'sports pub' → 'bar'
 *     'bar' text search catches British/local pubs (Lucky Baldwin's, T. Boyle's
 *     Tavern, Yard House) that don't self-label as 'sports bar/pub'. sportsScore
 *     sorting ensures real sports bars float to top over generic bars.
 *   - KEEP: 2-query cap (cost control), Promise.allSettled, POPULARITY only for
 *     sports_bar cuisine (food browsing still uses DISTANCE as before)
 *
 * CHANGES vs v4.5:
 *   - UPGRADE: calcSportsScore() — global 5-condition framework (ChatGPT universal
 *     definition + Gemini ranking). Now detects sports bars worldwide: UK pubs,
 *     biergartens (DE), cervecerías (LATAM), izakayas with TVs (JP), etc.
 *   - EXPAND: SPORTS_REVIEW_KEYWORDS — added rugby, cricket, premier league,
 *     champions league, world cup, NRL/AFL, watch party, chanting, pitchers, pints
 *   - ADD: SPORTS_BAR_TYPES set, biergarten/taps/football pub name detection
 *
 * REQUIRES: Worker v7.7+ deployed to Cloudflare
 * ============================================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const API_BASE_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

// Types that are NOT restaurants — explicitly excluded to prevent grocery/retail appearing
const NON_FOOD_TYPES = new Set([
  'grocery_or_supermarket', 'supermarket', 'grocery_store', 'food_store',
  'convenience_store', 'department_store', 'clothing_store', 'hardware_store',
  'pharmacy', 'drug_store', 'gas_station', 'car_wash', 'laundry',
  'health', 'beauty_salon', 'hair_care', 'bank', 'atm',
  'school', 'church', 'hospital', 'doctor',
  'book_store', 'library', 'shopping_mall', 'furniture_store', 'home_goods_store',
  'electronics_store', 'pet_store', 'shoe_store', 'jewelry_store',
]);

// Strict non-food primaryTypes — places with these as their CANONICAL primary
// type are real-world non-restaurants regardless of what auxiliary types they
// carry. 7-Eleven (primaryType convenience_store) often has meal_takeaway in
// its types because it sells hot food, which would let it pass the food-signal
// check in isActuallyARestaurant. We veto via primaryType regardless. Real
// food venues with these tags as siblings (e.g. a bakery that's also tagged
// food_store) are unaffected — their primaryType is 'bakery', not 'food_store'.
const STRICT_NON_FOOD_PRIMARY = new Set([
  'convenience_store', 'gas_station', 'pharmacy', 'drug_store', 'car_wash',
  'laundry', 'beauty_salon', 'hair_care', 'bank', 'atm',
  'school', 'church', 'hospital', 'doctor',
  'book_store', 'library', 'shopping_mall', 'furniture_store', 'home_goods_store',
  'electronics_store', 'pet_store', 'shoe_store', 'jewelry_store',
  'clothing_store', 'hardware_store', 'department_store',
]);

// Types that indicate a place is actually a food/dining venue
const FOOD_TYPES = new Set([
  'restaurant', 'meal_delivery', 'meal_takeaway', 'cafe', 'bakery',
  'bar', 'night_club', 'fast_food_restaurant', 'american_restaurant',
  'chinese_restaurant', 'japanese_restaurant', 'mexican_restaurant',
  'italian_restaurant', 'thai_restaurant', 'korean_restaurant',
  'vietnamese_restaurant', 'indian_restaurant', 'mediterranean_restaurant',
  'seafood_restaurant', 'steak_house', 'pizza_restaurant', 'ramen_restaurant',
  'sushi_restaurant', 'breakfast_restaurant', 'brunch_restaurant',
  'sandwich_shop', 'hamburger_restaurant', 'ice_cream_shop', 'dessert_shop',
  'coffee_shop', 'donut_shop', 'bagel_shop', 'pastry_shop', 'diner', 'buffet_restaurant',
  'tapas_bar', 'wine_bar', 'juice_bar', 'boba_tea_shop', 'food_court',
  'halal_restaurant', 'kosher_restaurant', 'vegan_restaurant',
  'vegetarian_restaurant', 'middle_eastern_restaurant', 'greek_restaurant',
  'spanish_restaurant', 'french_restaurant', 'german_restaurant',
  'filipino_restaurant', 'indonesian_restaurant', 'latin_american_restaurant',
  'pub', 'sports_bar', 'lounge', 'brewery', 'winery',
]);

function isActuallyARestaurant(place: any): boolean {
  const types: string[] = place.types || [];
  const primaryType: string = place.primaryType || '';
  // Always reject permanently/temporarily closed places (ghost restaurants).
  const status = (place.businessStatus || '').toUpperCase();
  if (status === 'CLOSED_PERMANENTLY' || status === 'CLOSED_TEMPORARILY') return false;

  // Strict primaryType veto BEFORE the food-signal check. Real-world non-
  // restaurants (7-Eleven, gas stations, pharmacies) often have meal_takeaway
  // or other food signals in their type list because they sell hot food /
  // snacks — but their CANONICAL identity is the non-food primaryType. Reject
  // them up front so they don't slip through. Step 0.13's food-signal-wins
  // behavior is preserved for places where the non-food tag is a generic
  // SIBLING (e.g. a bakery that's also tagged food_store has primaryType=bakery
  // not primaryType=convenience_store, so this check doesn't fire).
  if (STRICT_NON_FOOD_PRIMARY.has(primaryType)) return false;

  // Positive food signal — wins over generic non-food/store SIBLING tags.
  // Google sometimes tags a clear food venue (ice_cream_shop / dessert_shop /
  // bakery / pastry_shop / donut_shop / bagel_shop / *_restaurant) alongside
  // a generic 'food_store' in its types array. The old logic rejected on ANY
  // non-food match, which silently stripped Yogurtland-style places that
  // Google tags as both dessert_shop AND food_store. Now: if the place has a
  // valid food/dining signal, it passes regardless of the generic non-food tag.
  const hasFoodSignal =
    FOOD_TYPES.has(primaryType) ||
    primaryType.includes('restaurant') ||
    primaryType.includes('cafe') ||
    primaryType.includes('bar') ||
    types.some(t =>
      FOOD_TYPES.has(t) ||
      t.includes('restaurant') ||
      t.includes('cafe') ||
      t.includes('bar') ||
      t.includes('bakery')
    );
  if (hasFoodSignal) return true;

  // No food signal → original rejection logic applies (non-food types removed).
  if (NON_FOOD_TYPES.has(primaryType)) return false;
  if (types.some(t => NON_FOOD_TYPES.has(t))) return false;
  return false;
}

// ─── SPORTS VIBE SCORE ────────────────────────────────────────────────────────
// Global 5-condition scoring (ChatGPT universal definition + Gemini ranking):
//   A place qualifies as a sports bar equivalent when live sports viewing is
//   intentionally supported through screens and attracts customers who stay to watch.
//   Works worldwide — does not require "sports bar" label; captures pubs (UK/IE/AU),
//   biergartens (DE), cervecerías (LATAM), izakayas with TVs (JP), etc.
//
// Score 0–100 combining 5 signals:
//   Signal 1 — Place type fit        (max 20 pts + 15 bonus for explicit sports_bar)
//   Signal 2 — Name keyword fit      (max 15 pts, global name equivalents)
//   Signal 3 — Review keyword density(max 35 pts) ← most important, uses reviews
//   Signal 4 — Food & drink signals  (max 10 pts)
//   Signal 5 — Google API flags      (max  5 pts)
//
// Tiers:
//   85–100 → "Best Sports Bar"      (dedicated venue, primary purpose = watching sports)
//   70–84  → "Sports-Friendly"      (regular sports viewing, strong review signals)
//   55–69  → "Casual Watch Spot"    (TVs present, moderate sports culture)
//   < 55   → unlabeled (still shown when bar type matches, just unsorted)
//
// Cost-saving: all scoring is client-side (zero API calls). Queries capped at 2
// for sports_bar cuisine to prevent Worker timeouts at 25mi radius.
//
// SPORTS_REVIEW_KEYWORDS: global coverage including UK (rugby, premier league),
// AU (afl, nrl), LATAM/global (world cup, champions league), universal (match, screen).
const SPORTS_REVIEW_KEYWORDS = [
  // Infrastructure signals
  'tv', 'tvs', 'screen', 'screens', 'big screen', 'flat screen', 'flatscreen',
  'multiple tvs', 'big tv', 'projector', 'hd screen',
  // Social viewing behavior
  'watch the game', 'watch the match', 'watch sports', 'watch party', 'game night',
  'watching', 'game day', 'gameday', 'came to watch', 'showing sports', 'showing the game',
  'live sports', 'showing live',
  // Atmosphere
  'cheer', 'cheering', 'loud', 'crowd', 'lively', 'energetic', 'rowdy', 'packed',
  'buzzing', 'electric', 'full house', 'chanting',
  // US leagues
  'nfl', 'nba', 'mlb', 'nhl', 'ufc', 'playoff', 'playoffs', 'touchdown', 'overtime',
  // Global leagues / sports
  'soccer', 'football', 'rugby', 'cricket', 'boxing', 'mma', 'wrestling',
  'premier league', 'champions league', 'world cup', 'copa america',
  'nrl', 'afl', 'super rugby', 'six nations',
  // Event words
  'match', 'game', 'jersey', 'halftime', 'penalty',
  // Sports identity
  'sports', 'sports bar',
  // Food & drink (social sports bar staples)
  'wing', 'wings', 'nachos', 'beer', 'draft', 'pitchers', 'pints', 'happy hour',
  'pub food', 'bar food', 'finger food',
];

// Global bar-type equivalents that indicate a sports-friendly venue
const SPORTS_BAR_TYPES = new Set([
  'bar', 'pub', 'tapas_bar', 'wine_bar', 'lounge', 'brewery', 'night_club',
]);

function calcSportsScore(place: any): number {
  const types = [...(place.types || []), place.primaryType || ''].map((t: string) => t.toLowerCase());
  const name  = (place.displayName?.text || place.name || '').toLowerCase();
  const reviews: any[] = place.reviews || [];
  const allReviewText = reviews.map((r: any) => (r.text?.text || r.text || '')).join(' ').toLowerCase();

  let score = 0;

  // Signal 1: Place type fit (max 20 + 15 bonus)
  // Explicit sports_bar → 35 pts total (biggest single signal)
  if (types.includes('sports_bar')) {
    score += 20 + 15; // type match + explicit bonus
  } else if (types.some(t => SPORTS_BAR_TYPES.has(t))) {
    score += 12; // any recognised bar/pub type globally
  } else if (types.some(t => t.includes('restaurant'))) {
    score += 5;  // restaurant can still qualify if reviews are strong
  }

  // Signal 2: Name keyword fit (max 15) — global equivalents
  if (/sports?\s*(bar|grill|pub|lounge|tavern)/i.test(name)) {
    score += 15; // explicit "sports bar/pub" in name
  } else if (/(football|soccer|match|game)\s*(pub|bar|lounge|café|cafe)/i.test(name)) {
    score += 12; // UK/global style: "The Football Pub", "Match Bar"
  } else if (['tavern','pub','alehouse','taproom','roadhouse','grille','clubhouse','stadium'].some(k => name.includes(k))) {
    score += 8;
  } else if (['biergarten','bier garten','beer hall','taphouse','tap house',' taps ','brewhouse','beerhouse'].some(k => name.includes(k)) || /\btaps\b/.test(name)) {
    score += 7;  // e.g. "Dog Haus Biergarten", "33 Taps"
  } else if (['brewery','brewpub','brew pub','sports lounge','bar deportivo','cerveceria'].some(k => name.includes(k))) {
    score += 5;  // LATAM / brewery equivalents
  }

  // Signal 3: Review keyword density (max 35) — most important signal
  // Word-boundary matching prevents false positives ("game" in "board game cafe")
  let reviewHits = 0;
  SPORTS_REVIEW_KEYWORDS.forEach(kw => {
    const regex = new RegExp('\\b' + kw.replace(/\s+/g, '\\s+') + '\\b', 'gi');
    const matches = allReviewText.match(regex);
    if (matches) reviewHits += matches.length;
  });
  score += Math.min(reviewHits * 2, 35);

  // Signal 4: Food & drink bar pattern (max 10)
  const foodKws = ['wings', 'nachos', 'burgers', 'burger', 'beer', 'draft', 'pitchers', 'pints', 'happy hour', 'pub food', 'bar food', 'finger food'];
  const foodHits = foodKws.filter(k => allReviewText.includes(k)).length;
  score += Math.min(foodHits * 2, 10);

  // Signal 5: Google API flags — servesBeer + servesCocktails (max 5)
  if (place.servesBeer === true)      score += 3;
  if (place.servesCocktails === true) score += 2;

  return Math.min(score, 100);
}

function sportsLabel(score: number): string | null {
  if (score >= 85) return 'Best Sports Bar';
  if (score >= 70) return 'Sports-Friendly';
  if (score >= 55) return 'Casual Watch Spot';
  return null;
}

// ── INTENT PARSER + TIERING SYSTEM ───────────────────────────────────────────
// Interprets what the user actually wants from free-text search.
// "Asian food"  → expects Chinese/Japanese/Korean/Thai/Vietnamese/Filipino
//                  (NOT Indian, NOT Middle Eastern — cultural expectation)
// "best pasta"  → Italian restaurants ranked first, others after
// "shabu shabu" → Japanese/Korean restaurants are Tier 1 matches
//
// Tier 1 — Authentic (dedicated sushi bar for "sushi", Thai for "pad thai")
// Tier 2 — Good Match (Japanese restaurant for "sushi")
// Tier 3 — Has It (dish mentioned in name or reviews)
// Tier 4 — Other (not matched — shown at bottom with honest label)
//
// fallbackInfo.needed = true when NO Tier 1 or Tier 2 results exist,
// so the frontend can show "No [X] restaurants found nearby" disclaimer.

const ASIAN_TYPES = new Set([
  'chinese_restaurant','japanese_restaurant','korean_restaurant',
  'thai_restaurant','vietnamese_restaurant','filipino_restaurant',
  'ramen_restaurant','sushi_restaurant',
]);

// Single-cuisine chip → UMBRELLA intent synthesis. When the user has a
// specific cuisine chip active but the search bar is empty, the request
// handler synthesizes an UMBRELLA intent from this map so the tier
// classifier has something to tier against. Without this, intent is
// GENERAL → getTierForPlace returns 1 unconditionally → every result
// gets the "Authentic" / "Namesake" badge regardless of how cuisine-true
// it is. With this, italian_restaurant tiers 1, a place whose reviews
// mention pasta tiers 2, anything else tiers 4.
//
// Skipped (handled elsewhere or ambiguous): 'all', dietary chips
// (halal/kosher/vegan/vegetarian/glutenFree → dietary handler), venue
// chips (bakery/sports_bar → venue handler), sort chips (latenight/fine/
// budget), and broad cultural umbrellas (asian/latin/mediterranean/
// european → covered by CULTURAL_INTENTS below + parseSearchIntentInner
// regex paths).
const CUISINE_CHIP_TO_UMBRELLA: Record<string, { label: string; types: Set<string>; keywords: string[] }> = {
  italian:       { label: 'Italian',       types: new Set(['italian_restaurant']),                                  keywords: ['pasta','pizza','risotto','lasagna','antipasto'] },
  mexican:       { label: 'Mexican',       types: new Set(['mexican_restaurant']),                                  keywords: ['taco','burrito','enchilada','quesadilla','tamale'] },
  chinese:       { label: 'Chinese',       types: new Set(['chinese_restaurant']),                                  keywords: ['dim sum','noodle','dumpling','chow mein','kung pao'] },
  japanese:      { label: 'Japanese',      types: new Set(['japanese_restaurant','ramen_restaurant']),              keywords: ['sushi','ramen','tempura','udon','teriyaki'] },
  sushi:         { label: 'Sushi',         types: new Set(['sushi_restaurant','japanese_restaurant']),              keywords: ['sushi','sashimi','maki','nigiri','omakase'] },
  korean:        { label: 'Korean',        types: new Set(['korean_restaurant']),                                   keywords: ['bibimbap','kimchi','bulgogi','korean bbq','tteokbokki'] },
  thai:          { label: 'Thai',          types: new Set(['thai_restaurant']),                                     keywords: ['pad thai','tom yum','green curry','massaman','satay'] },
  vietnamese:    { label: 'Vietnamese',    types: new Set(['vietnamese_restaurant']),                               keywords: ['pho','banh mi','spring roll','vermicelli','bun bo hue'] },
  indian:        { label: 'Indian',        types: new Set(['indian_restaurant']),                                   keywords: ['curry','biryani','naan','tikka masala','tandoori'] },
  filipino:      { label: 'Filipino',      types: new Set(['filipino_restaurant']),                                 keywords: ['adobo','sinigang','lumpia','sisig','halo halo'] },
  french:        { label: 'French',        types: new Set(['french_restaurant']),                                   keywords: ['croissant','baguette','crepe','quiche','bouillabaisse'] },
  pizza:         { label: 'Pizza',         types: new Set(['pizza_restaurant']),                                    keywords: ['pizza','slice','margherita','pepperoni','sicilian'] },
  seafood:       { label: 'Seafood',       types: new Set(['seafood_restaurant']),                                  keywords: ['fish','shrimp','lobster','crab','clam','oyster'] },
  mediterranean: { label: 'Mediterranean', types: new Set(['mediterranean_restaurant','greek_restaurant']),         keywords: ['gyro','hummus','falafel','shawarma','tzatziki'] },
  american:      { label: 'American',      types: new Set(['american_restaurant','hamburger_restaurant']),          keywords: ['burger','fries','sandwich','wing','bbq'] },
  breakfast:     { label: 'Breakfast',     types: new Set(['breakfast_restaurant','brunch_restaurant']),            keywords: ['pancake','waffle','egg','french toast','omelet'] },
};

const CULTURAL_INTENTS: Record<string, { label: string; types: Set<string>; keywords: string[] }> = {
  asian: {
    label: 'Asian',
    types: ASIAN_TYPES,
    keywords: ['chinese','japanese','korean','thai','vietnamese','filipino','asian',
               'dim sum','ramen','sushi','pho','pad thai','boba','banh mi','kimchi'],
  },
  latin: {
    label: 'Latin',
    types: new Set(['mexican_restaurant','latin_american_restaurant','spanish_restaurant']),
    keywords: ['mexican','latin','taco','burrito','tamale','empanada','torta','ceviche'],
  },
  mediterranean: {
    label: 'Mediterranean',
    types: new Set(['mediterranean_restaurant','greek_restaurant','middle_eastern_restaurant']),
    keywords: ['mediterranean','greek','middle eastern','lebanese','turkish','hummus','falafel','shawarma'],
  },
  european: {
    label: 'European',
    types: new Set(['italian_restaurant','french_restaurant','german_restaurant','spanish_restaurant']),
    keywords: ['italian','french','german','european','pasta','risotto','crepe','schnitzel'],
  },
};

// Known chains that reliably serve breakfast dishes (pancakes, waffles, eggs,
// french toast, etc.) even when Google's servesBreakfast field is null. Used
// by getTierForPlace() to promote them to Tier 4 "Serves It" for breakfast/brunch
// DISH searches. Lowercase substrings — matched via name.includes().
// Each pattern must be long enough to avoid false positives (e.g. 'cora' alone
// would match 'Aurora' — use 'cora's' instead). US-centric historically;
// 2026-05-22 added international expansion (Step 4.6).
const KNOWN_BREAKFAST_CHAINS: string[] = [
  // US
  "mcdonald", "ihop", "denny", "waffle house", "cracker barrel", "bob evans",
  "corner bakery", "panera", "first watch", "snooze", "black bear diner",
  "mimi's cafe", "coco's", "marie callender", "bob's big boy", "perkins",
  "village inn", "le pain quotidien", "einstein", "the original pancake",
  "stack'd", "another broken egg", "wildflower",
  "norms",               // SoCal 24hr family chain — pancakes, French toast, breakfast platters

  // International expansion (Step 4.6, 2026-05-22)
  "tim hortons",         // Canada / US / Mexico / global
  "cora's",              // Canada — pancake-specialty breakfast chain
  "sunset grill",        // Canada — breakfast specialty
  "eggsmart",            // Canada — breakfast chain
  "the breakfast club",  // UK — modern brunch / pancakes
  "granger",             // UK / Australia — Bill Granger's fluffy pancakes
  "pret a manger",       // UK / US — breakfast staples
  "komeda",              // Japan — morning-set breakfast chain
  "doutor",              // Japan — breakfast / coffee chain
  "café du monde",       // US / Japan — beignets / pastries
  "cafe du monde",       //   (no-accent fallback for Google name variants)
  "egg slut",            // US / global — egg-focused breakfast spot
  "eggslut",             //   (concatenated variant)
  "stack pancake",       // UK — pancake specialty
];

// Breakfast-plausible venue types. Used by getTierForPlace to gate the
// broad Tier 4 text-match paths (editorialSummary / reviewText / menuDishes /
// generativeSummary / contextualContents.reviews) when the user searches a
// breakfasty dish like pancakes/waffles. Without this gate, ANY place whose
// reviews mention "pancake" tiers 4 — including Starbucks (review references
// to pancake-flavored Frappuccinos), Burger King (historical breakfast menu),
// Taco Bell, Chick-fil-A, and Chinese restaurants serving scallion pancakes.
// Gating by plausible type filters those out while preserving legit Tier 4
// for places that ARE breakfast venues per Google's type tagging.
// NOTE: McDonald's primaryType=fast_food_restaurant is NOT in this set —
// it stays via the KNOWN_BREAKFAST_CHAINS chain-list path, which is unrelated
// to this gate (chain list is trustworthy on its own).
const BREAKFAST_PLAUSIBLE_TYPES = new Set([
  'breakfast_restaurant', 'brunch_restaurant',
  'diner',
  // 'american_restaurant' intentionally NOT included — Google tags
  // Chick-fil-A, KFC, Applebee's, and similar fast-food chains with this
  // type, so admitting it as a breakfast signal lets them tier 3/4 on
  // pancakes searches even though they don't actually serve breakfast.
  // McDonald's stays via KNOWN_BREAKFAST_CHAINS (chain list is trustworthy).
  'bakery', 'pastry_shop', 'donut_shop', 'bagel_shop',
]);

// Dish → expected primaryTypes (Tier 1 = specialist, Tier 2 = close match)
// 80+ dishes mapped globally — covers Italian, Mexican, Japanese, Chinese, Korean,
// Vietnamese, Thai, Indian, Filipino, Middle Eastern, European, South American,
// Southeast Asian, African, and American dishes.
const DISH_MAP: Array<{ pattern: RegExp; tier1: string[]; tier2: string[]; label: string; nameKeywords?: string[]; mealTime?: 'breakfast' | 'brunch' | 'lunch' | 'dinner' }> = [
  // ── Japanese ────────────────────────────────────────────────────────────────
  { pattern: /\bsushi\b/,                              tier1:['sushi_restaurant'],                                        tier2:['japanese_restaurant'],                            label:'sushi',           nameKeywords:['sushi','sashimi','maki','nigiri','omakase'] },
  { pattern: /\bramen\b/,                              tier1:['ramen_restaurant'],                                        tier2:['japanese_restaurant'],                            label:'ramen',           nameKeywords:['ramen','ramenya','jinya','daikokuya','tsujita','tatsu'] },
  { pattern: /\budon\b/,                               tier1:['japanese_restaurant'],                                     tier2:['noodle_restaurant'],                              label:'udon',            nameKeywords:['udon','udonya','marugame'] },
  { pattern: /\btempura\b/,                            tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'tempura',         nameKeywords:['tempura'] },
  { pattern: /\bokonomiyaki\b/,                        tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'okonomiyaki',     nameKeywords:['okonomiyaki'] },
  { pattern: /\btonkatsu\b/,                           tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'tonkatsu',        nameKeywords:['tonkatsu','katsu','wakana'] },
  { pattern: /\byakitori\b/,                           tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'yakitori',        nameKeywords:['yakitori','torisushi'] },
  { pattern: /\bshabu[\s-]*shabu\b|\bshabu\b/,         tier1:['japanese_restaurant'],                                     tier2:['korean_restaurant'],                              label:'shabu shabu',     nameKeywords:['shabu','shabu shabu','shabuya'] },
  { pattern: /\bhot\s*pot\b/,                          tier1:['chinese_restaurant','korean_restaurant'],                  tier2:['japanese_restaurant'],                            label:'hot pot',         nameKeywords:['hot pot','hotpot','haidilao','little sheep','boiling point'] },
  { pattern: /\bkatsu\b|\bchicken\s*katsu\b|\bpork\s*katsu\b/, tier1:['japanese_restaurant'],                                tier2:[],                                                 label:'katsu',           nameKeywords:['katsu','tonkatsu','curry house'] },
  { pattern: /\bgyoza\b/,                              tier1:['japanese_restaurant'],                                     tier2:['chinese_restaurant'],                             label:'gyoza',           nameKeywords:['gyoza','gyozaya'] },
  { pattern: /\btakoyaki\b/,                           tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'takoyaki',        nameKeywords:['takoyaki','octopus ball'] },
  { pattern: /\byakiniku\b/,                           tier1:['japanese_restaurant','korean_restaurant'],                 tier2:['barbecue_restaurant'],                            label:'yakiniku',        nameKeywords:['yakiniku','gyu-kaku','gyukaku'] },
  { pattern: /\byakisoba\b|\bsoba\b/,                  tier1:['japanese_restaurant'],                                     tier2:['noodle_house'],                                   label:'soba',            nameKeywords:['soba','yakisoba','sobaya'] },
  { pattern: /\bonigiri\b|\briceballs?\b/,             tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'onigiri',         nameKeywords:['onigiri','riceball','musubi'] },
  { pattern: /\bomurice\b|\bomu\s*rice\b/,             tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'omurice',         nameKeywords:['omurice','omu rice'] },
  { pattern: /\bbento\b/,                              tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'bento',           nameKeywords:['bento','bentoya','bento box'] },
  { pattern: /\bmochi\b|\bdaifuku\b/,                  tier1:['japanese_restaurant','dessert_shop'],                      tier2:['ice_cream_shop'],                                 label:'mochi',           nameKeywords:['mochi','mochiko','daifuku','mikawaya'] },
  // ── Chinese ─────────────────────────────────────────────────────────────────
  { pattern: /\bdim\s*sum\b|\bdimsum\b/,               tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'dim sum',         nameKeywords:['dim sum','dimsum','yum cha','sea harbour'] },
  { pattern: /\bxiaolong\s*bao\b|\bsoup\s*dump\w+/,   tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'xiaolongbao',     nameKeywords:['xiaolongbao','xlb','soup dumpling','din tai fung','joe shanghai'] },
  { pattern: /\bmapo\s*tofu\b/,                        tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'mapo tofu',       nameKeywords:['mapo','mapo tofu'] },
  { pattern: /\bpeking\s*duck\b|\bbeijing\s*duck\b/,  tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'Peking duck',     nameKeywords:['peking duck','beijing duck','duck house','quanjude'] },
  { pattern: /\bdumplings?\b|\bpotstickers?\b/,        tier1:['chinese_restaurant'],                                      tier2:['japanese_restaurant'],                            label:'dumplings',       nameKeywords:['dumpling','dumplings','potsticker','jiaozi'] },
  { pattern: /\bdan\s*dan\b/,                          tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'dan dan noodles', nameKeywords:['dan dan','dan dan noodle'] },
  { pattern: /\bcongee\b|\bjook\b/,                    tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'congee',          nameKeywords:['congee','jook'] },
  { pattern: /\bchar\s*siu\b|\bbbq\s*pork\b/,          tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'char siu',        nameKeywords:['char siu','bbq pork','siu mei'] },
  { pattern: /\bwonton\b/,                             tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'wonton',          nameKeywords:['wonton','wonton house'] },
  { pattern: /\bchow\s*mein\b|\blo\s*mein\b/,         tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'chow mein',       nameKeywords:['chow mein','lo mein','noodle house','noodle world'] },
  { pattern: /\bfried\s*rice\b/,                       tier1:['chinese_restaurant','thai_restaurant'],                    tier2:['asian_restaurant'],                               label:'fried rice',      nameKeywords:['fried rice'] },
  { pattern: /\bkung\s*pao\b/,                         tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'kung pao',        nameKeywords:['kung pao'] },
  { pattern: /\bgeneral\s*tso\b|\borange\s*chicken\b/, tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'Chinese-American',nameKeywords:['general tso','orange chicken','panda express','panda inn'] },
  { pattern: /\bbao(zi)?\b|\bsteamed\s*buns?\b/,       tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'bao',             nameKeywords:['bao','baozi','steamed bun','wow bao'] },
  { pattern: /\bsiu\s*mai\b|\bshumai\b|\bhar\s*gow\b/, tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'dim sum',         nameKeywords:['siu mai','shumai','har gow','dim sum'] },
  { pattern: /\bhong\s*kong\s*style\b|\bcantonese\b/,  tier1:['cantonese_restaurant','chinese_restaurant'],               tier2:[],                                                 label:'Cantonese',       nameKeywords:['cantonese','hong kong'] },
  // ── Korean ──────────────────────────────────────────────────────────────────
  { pattern: /\bbibimbap\b/,                           tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'bibimbap',        nameKeywords:['bibimbap','bibibop','dolsot'] },
  { pattern: /\bbulgogi\b/,                            tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'bulgogi',         nameKeywords:['bulgogi'] },
  { pattern: /\bkorean\s*bbq\b|\bkbbq\b/,             tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'Korean BBQ',      nameKeywords:['kbbq','korean bbq','gen korean','quarters bbq','sura korean','park\'s bbq','kang ho dong'] },
  { pattern: /\bjjigae\b|\bkimchi\s*stew\b/,           tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'jjigae',          nameKeywords:['jjigae','kimchi stew'] },
  { pattern: /\bbossam\b|\bsamgyeopsal\b/,             tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'Korean BBQ',      nameKeywords:['bossam','samgyeopsal','kbbq','korean bbq'] },
  { pattern: /\btteokbokki\b/,                         tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'tteokbokki',      nameKeywords:['tteokbokki','rice cake'] },
  { pattern: /\bkimchi\b/,                             tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'kimchi',          nameKeywords:['kimchi'] },
  { pattern: /\bjajangmyeon\b|\bjjajangmyeon\b/,       tier1:['korean_restaurant'],                                       tier2:['chinese_restaurant'],                             label:'jajangmyeon',     nameKeywords:['jajangmyeon','jjajangmyeon','black bean noodle'] },
  { pattern: /\bmandu\b/,                              tier1:['korean_restaurant'],                                       tier2:['chinese_restaurant'],                             label:'mandu',           nameKeywords:['mandu','korean dumpling'] },
  { pattern: /\bjapchae\b/,                            tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'japchae',         nameKeywords:['japchae'] },
  { pattern: /\bgimbap\b|\bkimbap\b/,                  tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'gimbap',          nameKeywords:['gimbap','kimbap','korean roll'] },
  { pattern: /\bsoondubu\b|\bsundubu\b/,               tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'soondubu',        nameKeywords:['soondubu','sundubu','tofu house','tofu soup','beverly soon tofu'] },
  { pattern: /\bkorean\s*fried\s*chicken\b|\bkfc\s*korean\b/, tier1:['korean_restaurant','chicken_restaurant'],            tier2:[],                                                 label:'Korean fried chicken', nameKeywords:['korean fried chicken','bonchon','kyochon','bb.q','pelicana'] },
  { pattern: /\bbingsu\b|\bbingsoo\b|\bpatbingsu\b/,   tier1:['korean_restaurant','dessert_shop'],                        tier2:['ice_cream_shop'],                                 label:'bingsu',          nameKeywords:['bingsu','bingsoo','patbingsu','snowflake','snow ice'] },
  // ── Vietnamese ──────────────────────────────────────────────────────────────
  { pattern: /\bpho\b/,                                tier1:['vietnamese_restaurant'],                                   tier2:[],                                                 label:'pho',             nameKeywords:['pho','pho saigon','pho 79','pho ha noi','pho hoa','pho 24'] },
  { pattern: /\bbanh\s*mi\b/,                          tier1:['vietnamese_restaurant'],                                   tier2:[],                                                 label:'banh mi',         nameKeywords:['banh mi','sandwich vietnam','lee\'s sandwiches'] },
  { pattern: /\bbun\s*cha\b/,                          tier1:['vietnamese_restaurant'],                                   tier2:[],                                                 label:'bun cha',         nameKeywords:['bun cha'] },
  { pattern: /\bcuon\b|\bspring\s*rolls?\b/,           tier1:['vietnamese_restaurant'],                                   tier2:['asian_restaurant'],                               label:'spring rolls',    nameKeywords:['spring roll','cuon','goi cuon'] },
  { pattern: /\bbun\s*bo\s*hue\b/,                     tier1:['vietnamese_restaurant'],                                   tier2:[],                                                 label:'bun bo hue',      nameKeywords:['bun bo hue'] },
  { pattern: /\bcom\s*tam\b|\bbroken\s*rice\b/,        tier1:['vietnamese_restaurant'],                                   tier2:[],                                                 label:'com tam',         nameKeywords:['com tam','broken rice'] },
  { pattern: /\bvietnamese\s*coffee\b|\bca\s*phe\s*sua\s*da\b/, tier1:['vietnamese_restaurant','coffee_shop'],              tier2:['cafe'],                                           label:'Vietnamese coffee',nameKeywords:['vietnamese coffee','ca phe sua da','phin filter'] },
  // ── Thai ────────────────────────────────────────────────────────────────────
  { pattern: /\bpad\s*thai\b/,                         tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'Pad Thai',        nameKeywords:['pad thai','thai house'] },
  { pattern: /\bpad\s*see\s*ew\b|\bpad\s*kra\s*pao\b/, tier1:['thai_restaurant'],                                        tier2:[],                                                 label:'Thai noodles',    nameKeywords:['pad see ew','pad kra pao','pad kee mao'] },
  { pattern: /\bsom\s*tam\b|\bpapaya\s*salad\b/,       tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'som tam',         nameKeywords:['som tam','papaya salad'] },
  { pattern: /\btom\s*yum\b/,                          tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'tom yum',         nameKeywords:['tom yum','tom yum goong'] },
  { pattern: /\bgreen\s*curry\b|\bred\s*curry\b|\bmassaman\b|\bkhao\s*soi\b/, tier1:['thai_restaurant'],                  tier2:[],                                                 label:'Thai curry',      nameKeywords:['green curry','red curry','massaman','khao soi','thai curry'] },
  { pattern: /\bthai\s*iced\s*tea\b|\bthai\s*tea\b/,  tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'Thai tea',        nameKeywords:['thai tea','thai iced tea','cha yen'] },
  { pattern: /\bmango\s*sticky\s*rice\b/,              tier1:['thai_restaurant'],                                         tier2:['dessert_shop'],                                   label:'mango sticky rice',nameKeywords:['mango sticky rice','khao niao mamuang'] },
  { pattern: /\blarb\b/,                               tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'larb',            nameKeywords:['larb','laap','laab'] },
  { pattern: /\btom\s*kha\b/,                          tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'tom kha',         nameKeywords:['tom kha','tom kha gai'] },
  { pattern: /\bdrunken\s*noodles\b|\bpad\s*kee\s*mao\b/, tier1:['thai_restaurant'],                                       tier2:[],                                                 label:'drunken noodles', nameKeywords:['drunken noodles','pad kee mao'] },
  // ── Indian ──────────────────────────────────────────────────────────────────
  { pattern: /\bcurry\b/,                              tier1:['indian_restaurant'],                                       tier2:['thai_restaurant'],                                label:'curry',           nameKeywords:['curry','curry house','curry leaves','curry up'] },
  { pattern: /\bbiryani\b/,                            tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'biryani',         nameKeywords:['biryani','biryani house','paradise biryani'] },
  { pattern: /\bdosa\b|\bmasala\s*dosa\b/,             tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'dosa',            nameKeywords:['dosa','dosa hut','dosa palace','masala dosa','udupi'] },
  { pattern: /\btandoori\b|\bbutter\s*chicken\b|\bmurgh\s*makhani\b/, tier1:['indian_restaurant'],                        tier2:[],                                                 label:'tandoori',        nameKeywords:['tandoori','tandoor','butter chicken','murgh makhani','clay oven'] },
  { pattern: /\btikka\s*masala\b/,                     tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'tikka masala',    nameKeywords:['tikka masala','tikka'] },
  { pattern: /\bpalak\s*paneer\b|\bsaag\b/,            tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'palak paneer',    nameKeywords:['palak paneer','saag paneer'] },
  { pattern: /\bsamosa\b/,                             tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'samosa',          nameKeywords:['samosa','samosa house'] },
  { pattern: /\bchana\s*masala\b/,                     tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'chana masala',    nameKeywords:['chana masala','chole'] },
  { pattern: /\bvindaloo\b|\bkorma\b|\brogan\s*josh\b/, tier1:['indian_restaurant'],                                      tier2:[],                                                 label:'Indian curry',    nameKeywords:['vindaloo','korma','rogan josh'] },
  { pattern: /\bnaan\b|\bgarlic\s*naan\b/,             tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'naan',            nameKeywords:['naan','naan stop','tandoor'] },
  { pattern: /\bchaat\b|\bpani\s*puri\b|\bgolgappa\b|\bbhel\s*puri\b/, tier1:['indian_restaurant'],                          tier2:[],                                                 label:'chaat',           nameKeywords:['chaat','chaat bhavan','chaat corner','pani puri','golgappa','bhel puri'] },
  { pattern: /\bvada\s*pav\b|\bpav\s*bhaji\b|\bvada\b|\bpakora\b/, tier1:['indian_restaurant'],                              tier2:[],                                                 label:'Indian street food',nameKeywords:['vada pav','pav bhaji','pakora','chaat'] },
  { pattern: /\bthali\b/,                              tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'thali',           nameKeywords:['thali','thali house','udupi'] },
  { pattern: /\bchai\b|\bmasala\s*chai\b|\bchai\s*latte\b/, tier1:['indian_restaurant','tea_house'],                       tier2:['cafe','coffee_shop'],                             label:'chai',            nameKeywords:['chai','masala chai','chai latte','chaiwala','dishoom'] },
  { pattern: /\blassi\b|\bmango\s*lassi\b/,            tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'lassi',           nameKeywords:['lassi','mango lassi'] },
  { pattern: /\bgulab\s*jamun\b|\bjalebi\b|\brasmalai\b|\bkulfi\b/, tier1:['indian_restaurant','dessert_shop'],            tier2:[],                                                 label:'Indian dessert',  nameKeywords:['gulab jamun','jalebi','rasmalai','kulfi','mithai','sweets'] },
  { pattern: /\baloo\s*gobi\b|\bsaag\b/,                tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'Indian vegetarian',nameKeywords:['aloo gobi','saag','udupi'] },
  // ── Filipino ────────────────────────────────────────────────────────────────
  { pattern: /\badobo\b/,                              tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'adobo',           nameKeywords:['adobo'] },
  { pattern: /\bsinigang\b/,                           tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'sinigang',        nameKeywords:['sinigang'] },
  { pattern: /\blechon\b/,                             tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'lechon',          nameKeywords:['lechon'] },
  { pattern: /\bsisig\b/,                              tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'sisig',           nameKeywords:['sisig'] },
  { pattern: /\bkare[\s-]*kare\b/,                     tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'kare kare',       nameKeywords:['kare kare','kare-kare'] },
  { pattern: /\blumpia\b/,                             tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'lumpia',          nameKeywords:['lumpia','lumpia shanghai'] },
  { pattern: /\bpancit\b/,                             tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'pancit',          nameKeywords:['pancit','pansit'] },
  { pattern: /\bhalo[\s-]*halo\b/,                     tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'halo halo',       nameKeywords:['halo halo','halo-halo','jollibee','chowking'] },
  { pattern: /\bbulalo\b/,                             tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'bulalo',          nameKeywords:['bulalo'] },
  { pattern: /\bbicol\s*express\b|\blaing\b/,          tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'Bicolano',        nameKeywords:['bicol express','laing'] },
  { pattern: /\btapsilog\b|\bsilog\b|\blongganisa\b/,  tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'Filipino breakfast',nameKeywords:['tapsilog','silog','tocilog','longsilog','longganisa'] },
  { pattern: /\bcaldereta\b|\bpinakbet\b|\bcrispy\s*pata\b|\blechon\s*kawali\b/, tier1:['filipino_restaurant'],            tier2:[],                                                 label:'Filipino classics',nameKeywords:['caldereta','pinakbet','crispy pata','lechon kawali'] },
  { pattern: /\bube\b|\bleche\s*flan\b|\bbibingka\b|\bensaymada\b|\bturon\b/, tier1:['filipino_restaurant','bakery','dessert_shop'], tier2:[],                                          label:'Filipino dessert',nameKeywords:['ube','leche flan','bibingka','ensaymada','turon','goldilocks','red ribbon','valerio\'s'] },
  // ── Southeast Asian ─────────────────────────────────────────────────────────
  { pattern: /\blaksa\b/,                              tier1:['malaysian_restaurant','singaporean_restaurant'],           tier2:[],                                                 label:'laksa',           nameKeywords:['laksa'] },
  { pattern: /\bsatay\b/,                              tier1:['malaysian_restaurant','indonesian_restaurant'],            tier2:['thai_restaurant'],                                label:'satay',           nameKeywords:['satay','sate'] },
  { pattern: /\brendang\b/,                            tier1:['indonesian_restaurant','malaysian_restaurant'],            tier2:[],                                                 label:'rendang',         nameKeywords:['rendang'] },
  { pattern: /\bnasi\s*goreng\b/,                      tier1:['indonesian_restaurant','malaysian_restaurant'],            tier2:[],                                                 label:'nasi goreng',     nameKeywords:['nasi goreng'] },
  // ── Middle Eastern ──────────────────────────────────────────────────────────
  { pattern: /\bshawarma\b/,                           tier1:['middle_eastern_restaurant','turkish_restaurant'],          tier2:[],                                                 label:'shawarma',        nameKeywords:['shawarma','halal guys','the halal guys'] },
  { pattern: /\bkebab\b|\bdoner\b/,                    tier1:['middle_eastern_restaurant','turkish_restaurant'],          tier2:[],                                                 label:'kebab',           nameKeywords:['kebab','doner','shish kebab','adana kebab','kabob'] },
  { pattern: /\bfalafel\b/,                            tier1:['middle_eastern_restaurant','greek_restaurant'],            tier2:['mediterranean_restaurant'],                       label:'falafel',         nameKeywords:['falafel','falafel king','maoz'] },
  { pattern: /\bhummus\b/,                             tier1:['middle_eastern_restaurant','mediterranean_restaurant'],    tier2:[],                                                 label:'hummus',          nameKeywords:['hummus','hummus bar','cava'] },
  { pattern: /\bshakshuka\b/,                          tier1:['middle_eastern_restaurant','israeli_restaurant'],          tier2:['mediterranean_restaurant','brunch_restaurant'],   label:'shakshuka',       nameKeywords:['shakshuka'] },
  { pattern: /\btabb?ouleh\b|\bbaba\s*ganoush\b|\bmezz?e\b/, tier1:['middle_eastern_restaurant'],                          tier2:['mediterranean_restaurant'],                       label:'mezze',           nameKeywords:['mezze','meze','tabbouleh','baba ganoush'] },
  { pattern: /\bbaklava\b/,                            tier1:['middle_eastern_restaurant','turkish_restaurant','dessert_shop'], tier2:['pastry_shop','bakery'],                       label:'baklava',         nameKeywords:['baklava'] },
  { pattern: /\bdolmas?\b|\bdolmadakia\b/,             tier1:['greek_restaurant','middle_eastern_restaurant','turkish_restaurant'], tier2:[],                                            label:'dolma',           nameKeywords:['dolma','dolmas','dolmadakia'] },
  { pattern: /\bpita\b/,                               tier1:['middle_eastern_restaurant','mediterranean_restaurant'],    tier2:['greek_restaurant'],                               label:'pita',            nameKeywords:['pita','pita pit','pita way','pita inn'] },
  { pattern: /\bmansaf\b|\bkabsa\b|\bmaqluba\b/,       tier1:['middle_eastern_restaurant'],                               tier2:[],                                                 label:'Levantine',       nameKeywords:['mansaf','kabsa','maqluba','levantine'] },
  // ── Turkish ─────────────────────────────────────────────────────────────────
  { pattern: /\bgozleme\b|\bgözleme\b/,                tier1:['turkish_restaurant'],                                      tier2:['middle_eastern_restaurant'],                      label:'gözleme',         nameKeywords:['gozleme','gözleme'] },
  { pattern: /\blahmacun\b|\bpide\b/,                  tier1:['turkish_restaurant'],                                      tier2:['middle_eastern_restaurant'],                      label:'Turkish flatbread',nameKeywords:['lahmacun','pide','turkish pizza'] },
  { pattern: /\bborek\b|\bbörek\b/,                    tier1:['turkish_restaurant','bakery'],                             tier2:[],                                                 label:'börek',           nameKeywords:['borek','börek'] },
  { pattern: /\bmeze\b|\bmezeler\b/,                   tier1:['turkish_restaurant','middle_eastern_restaurant'],          tier2:['mediterranean_restaurant'],                       label:'meze',            nameKeywords:['meze','mezeler'] },
  // ── European ────────────────────────────────────────────────────────────────
  { pattern: /\bpasta\b|\blasagna\b|\brigatoni\b|\bpenne\b|\bspaghetti\b|\bcarbonara\b|\bcacio\s*e\s*pepe\b/, tier1:['italian_restaurant'], tier2:['mediterranean_restaurant'],   label:'pasta',           nameKeywords:['pasta','spaghetti','lasagna','carbonara','olive garden','spaghetti factory','buca di beppo','maggiano','sbarro','noodles & company'] },
  { pattern: /\bneapolitan\s*pizza\b|\bnew\s*york\s*style\s*pizza\b|\bdeep\s*dish\b|\bpizza\b/, tier1:['pizza_restaurant'], tier2:['italian_restaurant'],                       label:'pizza',           nameKeywords:['pizza','pizzeria','blaze pizza','mod pizza','pizza hut','domino','papa john','little caesars','round table','sbarro','&pizza','marco\'s'] },
  { pattern: /\barancini\b|\bsupplì\b|\bsuppli\b/,     tier1:['italian_restaurant'],                                      tier2:[],                                                 label:'arancini',        nameKeywords:['arancini','suppli'] },
  { pattern: /\baperitivo\b/,                          tier1:['italian_restaurant','wine_bar','cafe'],                    tier2:['bar'],                                            label:'aperitivo',       nameKeywords:['aperitivo','aperol','spritz'] },
  { pattern: /\bcroissant\b|\bpain\s*au\s*chocolat\b|\bchocolatines?\b|\bpastries\b/, tier1:['french_restaurant','bakery','pastry_shop'], tier2:['cafe'],                          label:'pastries',        nameKeywords:['croissant','pain au chocolat','pastries','french bakery','la madeleine','paul'] },
  { pattern: /\bschnitzel\b/,                          tier1:['german_restaurant'],                                       tier2:[],                                                 label:'schnitzel',       nameKeywords:['schnitzel','wiener schnitzel'] },
  { pattern: /\bpaella\b/,                             tier1:['spanish_restaurant'],                                      tier2:[],                                                 label:'paella',          nameKeywords:['paella'] },
  { pattern: /\btapas\b/,                              tier1:['spanish_restaurant','tapas_bar'],                          tier2:[],                                                 label:'tapas',           nameKeywords:['tapas','tapas bar','jaleo'] },
  { pattern: /\bfish\s*and\s*chips\b/,                 tier1:['british_restaurant'],                                      tier2:['pub'],                                            label:'fish and chips',  nameKeywords:['fish and chips','chippy','long john silver'] },
  { pattern: /\bgyro(s)?\b/,                           tier1:['greek_restaurant','mediterranean_restaurant'],             tier2:[],                                                 label:'gyros',           nameKeywords:['gyro','gyros','daphne\'s','great greek'] },
  // ── Italian beyond pasta ──
  { pattern: /\brisotto\b/,                            tier1:['italian_restaurant'],                                      tier2:[],                                                 label:'risotto',         nameKeywords:['risotto'] },
  { pattern: /\bravioli\b|\btortellini\b|\bgnocchi\b/, tier1:['italian_restaurant'],                                      tier2:['mediterranean_restaurant'],                       label:'pasta',           nameKeywords:['ravioli','tortellini','gnocchi','pasta'] },
  { pattern: /\bbruschetta\b|\bantipasto\b|\bcaprese\b/, tier1:['italian_restaurant'],                                    tier2:[],                                                 label:'Italian appetizer',nameKeywords:['bruschetta','antipasto','caprese'] },
  { pattern: /\bpanini\b|\bfocaccia\b/,                tier1:['italian_restaurant','sandwich_shop'],                      tier2:['cafe','deli'],                                    label:'panini',          nameKeywords:['panini','focaccia','panera','potbelly'] },
  { pattern: /\bcalzone\b|\bstromboli\b/,              tier1:['pizza_restaurant','italian_restaurant'],                   tier2:[],                                                 label:'calzone',         nameKeywords:['calzone','stromboli'] },
  { pattern: /\bchicken\s*parm(igiana|esan)?\b|\beggplant\s*parm/, tier1:['italian_restaurant'],                          tier2:['american_restaurant'],                            label:'chicken parm',    nameKeywords:['chicken parm','chicken parmesan','eggplant parm','parmigiana'] },
  { pattern: /\bmeatballs?\b/,                         tier1:['italian_restaurant'],                                      tier2:['american_restaurant','sandwich_shop'],            label:'meatballs',       nameKeywords:['meatball','meatballs','the meatball shop'] },
  { pattern: /\bminestrone\b/,                         tier1:['italian_restaurant'],                                      tier2:[],                                                 label:'minestrone',      nameKeywords:['minestrone'] },
  { pattern: /\btiramisu\b|\bcannoli\b|\baffogato\b/,  tier1:['italian_restaurant','dessert_shop'],                       tier2:['cafe','pastry_shop'],                             label:'Italian dessert', nameKeywords:['tiramisu','cannoli','affogato','gelato','venchi'] },
  // ── French beyond crepes ──
  { pattern: /\bfrench\s*onion\s*soup\b/,              tier1:['french_restaurant'],                                       tier2:['european_restaurant'],                            label:'French onion soup',nameKeywords:['french onion soup'] },
  { pattern: /\bescargot\b|\bbouillabaisse\b|\bratatouille\b|\bcoq\s*au\s*vin\b/, tier1:['french_restaurant'],            tier2:[],                                                 label:'French classic',  nameKeywords:['escargot','bouillabaisse','ratatouille','coq au vin'] },
  { pattern: /\bboeuf\s*bourguignon\b|\bbeef\s*bourguignon\b/, tier1:['french_restaurant'],                                tier2:[],                                                 label:'boeuf bourguignon',nameKeywords:['boeuf bourguignon','beef bourguignon'] },
  { pattern: /\bcassoulet\b/,                          tier1:['french_restaurant'],                                       tier2:[],                                                 label:'cassoulet',       nameKeywords:['cassoulet'] },
  { pattern: /\bquiche\b/,                             tier1:['french_restaurant','brunch_restaurant'],                   tier2:['cafe','bakery'],                                  label:'quiche',          nameKeywords:['quiche','la madeleine'] },
  { pattern: /\bfoie\s*gras\b/,                        tier1:['french_restaurant'],                                       tier2:[],                                                 label:'foie gras',       nameKeywords:['foie gras'] },
  // ── Spanish beyond paella/tapas ──
  { pattern: /\bjamon\b|\bjamón\b|\bchorizo\b/,        tier1:['spanish_restaurant'],                                      tier2:[],                                                 label:'Spanish cured meat',nameKeywords:['jamon','jamón','chorizo','iberico','jamonería'] },
  { pattern: /\bgazpacho\b/,                           tier1:['spanish_restaurant'],                                      tier2:[],                                                 label:'gazpacho',        nameKeywords:['gazpacho'] },
  { pattern: /\bpatatas\s*bravas\b|\bpintxos?\b|\btortilla\s*espanola\b/, tier1:['spanish_restaurant','tapas_bar'],         tier2:[],                                                 label:'Spanish tapas',   nameKeywords:['patatas bravas','pintxos','tortilla espanola','tapas bar'] },
  { pattern: /\bvermut\b|\bvermouth\s*hour\b/,         tier1:['spanish_restaurant','wine_bar','bar'],                     tier2:['tapas_bar'],                                      label:'vermut',          nameKeywords:['vermut','vermouth'] },
  // ── German / Austrian / Swiss ──
  { pattern: /\bbratwurst\b|\bsausages?\b|\bwurst\b/,  tier1:['german_restaurant'],                                       tier2:['american_restaurant'],                            label:'sausage',         nameKeywords:['bratwurst','sausage','wurst','sausage haus'] },
  { pattern: /\bpretzels?\b|\bbrezel\b/,               tier1:['german_restaurant','bakery'],                              tier2:[],                                                 label:'pretzel',         nameKeywords:['pretzel','brezel','auntie anne','wetzel','philly pretzel'] },
  { pattern: /\bsauerkraut\b|\bspaetzle\b/,            tier1:['german_restaurant'],                                       tier2:[],                                                 label:'German classic',  nameKeywords:['sauerkraut','spaetzle'] },
  { pattern: /\bfondue\b|\braclette\b/,                tier1:['swiss_restaurant','french_restaurant'],                    tier2:['european_restaurant'],                            label:'fondue',          nameKeywords:['fondue','raclette','melting pot'] },
  // ── British / Irish ──
  { pattern: /\bshepherds?\s*pie\b/,                   tier1:['british_restaurant','irish_restaurant'],                   tier2:['pub'],                                            label:'shepherd\'s pie', nameKeywords:['shepherd\'s pie','shepherds pie'] },
  { pattern: /\bbangers?\s*and\s*mash\b/,              tier1:['british_restaurant','irish_restaurant'],                   tier2:['pub'],                                            label:'bangers and mash',nameKeywords:['bangers and mash'] },
  { pattern: /\bfull\s*english\b|\benglish\s*breakfast\b/, tier1:['british_restaurant'],                                    tier2:['breakfast_restaurant','brunch_restaurant'],       label:'English breakfast',nameKeywords:['full english','english breakfast'] },
  { pattern: /\bmeat\s*pie\b|\bmince\s*pie\b|\bsteak\s*and\s*kidney\s*pie\b/, tier1:['british_restaurant','australian_restaurant'], tier2:['pub','bakery'],                              label:'meat pie',        nameKeywords:['meat pie','mince pie','steak and kidney','pie hole','pie shop'] },
  { pattern: /\byorkshire\s*pudding\b/,                tier1:['british_restaurant'],                                      tier2:[],                                                 label:'Yorkshire pudding',nameKeywords:['yorkshire pudding'] },
  // ── Eastern European ──
  { pattern: /\bpierogi(es)?\b|\bperogi(es)?\b/,       tier1:['polish_restaurant','ukrainian_restaurant'],                tier2:['european_restaurant'],                            label:'pierogi',         nameKeywords:['pierogi','pierogies','perogi','perogies'] },
  { pattern: /\bborscht\b/,                            tier1:['russian_restaurant','ukrainian_restaurant','polish_restaurant'], tier2:['european_restaurant'],                      label:'borscht',         nameKeywords:['borscht'] },
  { pattern: /\bgoulash\b/,                            tier1:['hungarian_restaurant','german_restaurant'],                tier2:['european_restaurant'],                            label:'goulash',         nameKeywords:['goulash'] },
  { pattern: /\bstroganoff\b|\bbeef\s*stroganoff\b/,   tier1:['russian_restaurant'],                                      tier2:['european_restaurant'],                            label:'stroganoff',      nameKeywords:['stroganoff','beef stroganoff'] },
  { pattern: /\bblini\b|\bpelmeni\b/,                  tier1:['russian_restaurant'],                                      tier2:[],                                                 label:'Russian classic', nameKeywords:['blini','pelmeni'] },
  // ── South American ──────────────────────────────────────────────────────────
  { pattern: /\bceviche\b/,                            tier1:['peruvian_restaurant','latin_american_restaurant'],         tier2:['seafood_restaurant'],                             label:'ceviche',         nameKeywords:['ceviche','cebicheria','sebastian'] },
  { pattern: /\bempanadas?\b/,                         tier1:['latin_american_restaurant'],                               tier2:['mexican_restaurant'],                             label:'empanadas',       nameKeywords:['empanada','empanadas'] },
  { pattern: /\barepas?\b/,                            tier1:['venezuelan_restaurant','latin_american_restaurant'],       tier2:[],                                                 label:'arepas',          nameKeywords:['arepa','arepas'] },
  { pattern: /\bchurrasco\b|\bbrazilian\s*bbq\b|\bbrazilian\s*steak\b/, tier1:['brazilian_restaurant','steak_house'],     tier2:[],                                                 label:'churrasco',       nameKeywords:['churrasco','brazilian bbq','brazilian steak','fogo de chao','texas de brazil','rodizio'] },
  { pattern: /\bfeijoada\b|\bpicanha\b|\bmoqueca\b/,   tier1:['brazilian_restaurant'],                                    tier2:[],                                                 label:'Brazilian classic',nameKeywords:['feijoada','picanha','moqueca'] },
  { pattern: /\bpao\s*de\s*queijo\b|\bp[aã]o\s*de\s*queijo\b|\bcoxinha\b|\bpastel\b/, tier1:['brazilian_restaurant'],   tier2:['bakery'],                                         label:'Brazilian snack', nameKeywords:['pao de queijo','pão de queijo','coxinha','pastel'] },
  { pattern: /\bcaipirinha\b/,                         tier1:['brazilian_restaurant','bar'],                              tier2:[],                                                 label:'caipirinha',      nameKeywords:['caipirinha'] },
  // ── African ─────────────────────────────────────────────────────────────────
  { pattern: /\binjera\b|\bethiopian\b/,               tier1:['ethiopian_restaurant'],                                    tier2:['african_restaurant'],                             label:'Ethiopian',       nameKeywords:['injera','ethiopian','meskerem','messob','queen sheba'] },
  { pattern: /\bjollof\s*rice\b/,                      tier1:['nigerian_restaurant','west_african_restaurant'],           tier2:['african_restaurant'],                             label:'jollof rice',     nameKeywords:['jollof','jollof rice'] },
  { pattern: /\btagine\b|\bmoroccan\b/,                tier1:['moroccan_restaurant'],                                     tier2:['north_african_restaurant'],                       label:'tagine',          nameKeywords:['tagine','moroccan','tagine house'] },
  // ── American ────────────────────────────────────────────────────────────────
  { pattern: /\btaco(s)?\b|\bburrito(s)?\b|\bquesadilla\b/, tier1:['mexican_restaurant'],                                 tier2:['latin_american_restaurant'],                      label:'tacos',           nameKeywords:['taco','tacos','burrito','quesadilla','taqueria','rubio\'s','baja fresh','chipotle','qdoba','el pollo loco'] },
  { pattern: /\benchilada(s)?\b|\btamale(s)?\b|\bchilaquiles\b|\btostada(s)?\b|\bchimichanga\b/, tier1:['mexican_restaurant'], tier2:['latin_american_restaurant'],                       label:'Mexican',         nameKeywords:['enchilada','tamale','chilaquiles','tostada','chimichanga'] },
  { pattern: /\bmole\b|\bpozole\b|\bbirria\b/,         tier1:['mexican_restaurant'],                                      tier2:[],                                                 label:'Mexican classic', nameKeywords:['mole','pozole','birria','birrieria','birria-landia'] },
  { pattern: /\bcarnitas\b|\bal\s*pastor\b|\bbarbacoa\b/, tier1:['mexican_restaurant','taqueria'],                         tier2:[],                                                 label:'Mexican meat',    nameKeywords:['carnitas','al pastor','barbacoa','taqueria','leo\'s tacos','tacos el gordo','guisados'] },
  { pattern: /\bfajita(s)?\b/,                         tier1:['mexican_restaurant'],                                      tier2:['tex_mex_restaurant'],                             label:'fajitas',         nameKeywords:['fajita','fajitas','on the border'] },
  { pattern: /\belote(s)?\b|\besquite(s)?\b/,          tier1:['mexican_restaurant'],                                      tier2:[],                                                 label:'elote',           nameKeywords:['elote','elotes','esquite','esquites'] },
  { pattern: /\bhorchata\b|\baguas?\s*frescas?\b/,     tier1:['mexican_restaurant'],                                      tier2:[],                                                 label:'horchata',        nameKeywords:['horchata','aguas frescas','aguas'] },
  { pattern: /\bchurros?\b/,                           tier1:['mexican_restaurant','spanish_restaurant','dessert_shop'],  tier2:[],                                                 label:'churros',         nameKeywords:['churro','churros','churreria'] },
  { pattern: /\btres\s*leches\b|\bflan\b/,             tier1:['mexican_restaurant','latin_american_restaurant','dessert_shop'], tier2:[],                                            label:'Latin dessert',   nameKeywords:['tres leches','flan'] },
  { pattern: /\bburger(s)?\b|\bwhopper\b/,             tier1:['hamburger_restaurant'],                                    tier2:['american_restaurant','fast_food_restaurant'],     label:'burgers',         nameKeywords:['burger','burgers','whopper','in-n-out','five guys','shake shack','smashburger','habit','fatburger','wendy','jack in the box','carl\'s jr','hardee\'s','culver\'s','whataburger'] },
  { pattern: /\bsteak\b/,                              tier1:['steak_house'],                                             tier2:['american_restaurant','brazilian_restaurant'],     label:'steak',           nameKeywords:['steak','steakhouse','outback','ruth\'s chris','morton','fleming','black angus','sizzler','longhorn','texas roadhouse','lawry\'s'] },
  { pattern: /\bbbq\b|\bbarbeque\b|\bbarbecue\b/,      tier1:['barbecue_restaurant'],                                     tier2:['american_restaurant'],                            label:'BBQ',             nameKeywords:['bbq','barbecue','barbeque','smokehouse','dickey','sonny','famous dave','rudy\'s','phil\'s bbq','salt lick'] },
  { pattern: /\bribs?\b|\bbrisket\b|\bpulled\s*pork\b/, tier1:['barbecue_restaurant'],                                    tier2:['american_restaurant','southern_restaurant'],      label:'ribs',            nameKeywords:['rib','ribs','brisket','pulled pork','smokehouse','tony roma','baby back','lucille\'s'] },
  { pattern: /\bwings\b|\bchicken\s*wings\b|\bbuffalo\s*wings\b/, tier1:['chicken_restaurant'],                          tier2:['pizza_restaurant','sports_bar','bar'],                          label:'wings',           nameKeywords:['wing','wings','buffalo wing','hooters','wingstop','buffalo wild wings','wing zone'] },
  { pattern: /\bfried\s*chicken\b|\bchicken\b/,        tier1:['chicken_restaurant'],                                     tier2:['fast_food_restaurant','american_restaurant'],     label:'fried chicken',   nameKeywords:['fried chicken','chick-fil-a','chick fil a','kfc','kentucky fried','popeyes','raising cane','church\'s chicken','el pollo loco','dave\'s hot chicken','jollibee'] },
  { pattern: /\bseafood\b|\bshellfish\b|\boysters?\b|\bclams?\b|\blobster\s*roll\b|\bclam\s*chowder\b|\bfish\s*and\s*chips\b/, tier1:['seafood_restaurant'], tier2:['american_restaurant'], label:'seafood',         nameKeywords:['seafood','oysters','clam chowder','lobster roll','red lobster','joe\'s crab','bonefish','legal sea foods','crab shack'] },
  { pattern: /\bgumbo\b|\bpo[\s-]*boy\b/,              tier1:['cajun_restaurant','southern_restaurant'],                   tier2:['american_restaurant'],                            label:'Cajun',           nameKeywords:['gumbo','po boy','po-boy','popeyes','cajun'] },
  { pattern: /\bjambalaya\b|\bcrawfish\b|\bcrayfish\b/, tier1:['cajun_restaurant','southern_restaurant'],                  tier2:['seafood_restaurant'],                             label:'Cajun',           nameKeywords:['jambalaya','crawfish','crayfish','cajun'] },
  { pattern: /\bshrimp\s*and\s*grits\b|\bbiscuits?\s*and\s*gravy\b|\bchicken\s*and\s*waffles\b/, tier1:['southern_restaurant','soul_food_restaurant'], tier2:['american_restaurant','breakfast_restaurant'],  label:'Southern',        nameKeywords:['shrimp and grits','biscuits and gravy','chicken and waffles','cracker barrel','roscoe\'s','soul food'] },
  { pattern: /\bcheesesteak\b|\bphilly\s*cheesesteak\b/, tier1:['sandwich_shop','american_restaurant'],                    tier2:[],                                                 label:'cheesesteak',     nameKeywords:['cheesesteak','philly cheesesteak','philly','pat\'s','geno\'s','jim\'s steaks'] },
  { pattern: /\breuben\b|\bclub\s*sandwich\b|\bblt\b/, tier1:['sandwich_shop','deli'],                                    tier2:['american_restaurant'],                            label:'deli sandwich',   nameKeywords:['reuben','club sandwich','blt','deli','katz\'s','langer\'s','canter\'s'] },
  { pattern: /\bsandwich(es)?\b|\bsub(marine|s)?\b|\bhoagie\b|\bgrinder\b/, tier1:['sandwich_shop','deli'],                tier2:['cafe','american_restaurant'],                     label:'sandwich',        nameKeywords:['sandwich','sub','hoagie','grinder','subway','jimmy john','jersey mike','firehouse','potbelly','quiznos','which wich','blimpie'] },
  { pattern: /\bgrilled\s*cheese\b/,                   tier1:['sandwich_shop','american_restaurant'],                     tier2:['cafe','diner'],                                   label:'grilled cheese',  nameKeywords:['grilled cheese','melt','tom and chee'] },
  { pattern: /\bhot\s*dog\b|\bcorn\s*dog\b|\bfrankfurter\b/, tier1:['american_restaurant','fast_food_restaurant'],         tier2:[],                                                 label:'hot dog',         nameKeywords:['hot dog','corn dog','frankfurter','wienerschnitzel','pink\'s','nathan\'s','portillo','sonic','five guys'] },
  { pattern: /\bnachos\b/,                             tier1:['mexican_restaurant'],                                      tier2:['american_restaurant','sports_bar'],               label:'nachos',          nameKeywords:['nacho','nachos'] },
  { pattern: /\bchili\b/,                              tier1:['american_restaurant'],                                     tier2:['mexican_restaurant'],                             label:'chili',           nameKeywords:['chili','chili\'s','wendy\'s chili'] },
  { pattern: /\bmeatloaf\b/,                           tier1:['american_restaurant','diner'],                             tier2:['southern_restaurant'],                            label:'meatloaf',        nameKeywords:['meatloaf'] },
  { pattern: /\bchicken\s*tenders?\b|\bchicken\s*strips?\b|\bnuggets?\b|\bsliders?\b/, tier1:['chicken_restaurant','american_restaurant','fast_food_restaurant'], tier2:[],                                        label:'finger food',     nameKeywords:['chicken tender','chicken strip','nugget','slider','raising cane','tender shack','white castle','krystal'] },
  { pattern: /\bonion\s*rings\b|\bfries?\b|\bfrench\s*fries\b|\bpoutine\b/, tier1:['american_restaurant','fast_food_restaurant'], tier2:['canadian_restaurant'],                          label:'fries',           nameKeywords:['fries','french fries','poutine','onion ring'] },
  { pattern: /\bchicken\s*pot\s*pie\b/,                tier1:['american_restaurant','southern_restaurant'],               tier2:['diner'],                                          label:'chicken pot pie', nameKeywords:['chicken pot pie','pot pie','marie callender'] },
  { pattern: /\bbuffalo\s*chicken\b/,                  tier1:['chicken_restaurant','american_restaurant'],                tier2:['sports_bar'],                                     label:'buffalo',         nameKeywords:['buffalo chicken','buffalo wild wings'] },
  { pattern: /\bpancakes?\b|\bwaffles?\b/,             tier1:['breakfast_restaurant'],                                    tier2:['american_restaurant','diner'],                    label:'pancakes',        nameKeywords:['pancake','pancakes','waffle','flapjack','griddle','pancake house','ihop','waffle house','stack pancake'], mealTime:'breakfast' },
  { pattern: /\bbagels?\b/,                            tier1:['bagel_shop'],                                              tier2:['deli','bakery'],                                  label:'bagels',          nameKeywords:['bagel','bagels','einstein','noah','manhattan bagel','bruegger'] },
  { pattern: /\bdonuts?\b|\bdoughnuts?\b/,             tier1:['donut_shop'],                                              tier2:['bakery','dessert_shop','pastry_shop'],            label:'donuts',          nameKeywords:['donut','donuts','doughnut','dunkin','krispy kreme','tim hortons','randy\'s','sidecar','blue star','voodoo','winchell','yum yum'] },
  { pattern: /\bmac\s*and\s*cheese\b|\bmac\s*n\s*cheese\b/, tier1:['american_restaurant'],                                tier2:['soul_food_restaurant'],                           label:'mac and cheese',  nameKeywords:['mac and cheese','mac n cheese','noodles & company'] },
  { pattern: /\bpoke\b|\bpoke\s*bowl\b/,               tier1:['hawaiian_restaurant'],                                     tier2:['japanese_restaurant'],                            label:'poke',            nameKeywords:['poke','poke bowl','poki','sweetfin','pokeworks'] },
  // ── Brunch / Breakfast ─────────────────────────────────────────────────────
  { pattern: /\bbrunch\b/,                             tier1:['brunch_restaurant'],                                       tier2:['breakfast_restaurant','cafe'],                    label:'brunch',            nameKeywords:['brunch','brunch club'], mealTime:'brunch' },
  { pattern: /\bbreakfast\b/,                          tier1:['breakfast_restaurant'],                                    tier2:['diner','cafe'],                                   label:'breakfast',         nameKeywords:['breakfast','breakfast club','breakfast republic','first watch','snooze'], mealTime:'breakfast' },
  { pattern: /\beggs\s*benedict\b|\bbenedict\b/,       tier1:['brunch_restaurant','breakfast_restaurant'],                tier2:['cafe','diner'],                                   label:'eggs benedict',     nameKeywords:['eggs benedict','benedict','egg slut','eggslut'], mealTime:'brunch' },
  { pattern: /\bomelet(te)?\b|\bfrittata\b/,           tier1:['breakfast_restaurant','brunch_restaurant'],                tier2:['diner','cafe'],                                   label:'omelette',          nameKeywords:['omelet','omelette','frittata'], mealTime:'breakfast' },
  { pattern: /\bavocado\s*toast\b|\bacai\s*bowl\b|\baçaí\s*bowl\b/, tier1:['brunch_restaurant','cafe'],                    tier2:['juice_bar','vegan_restaurant'],                   label:'brunch bowl',       nameKeywords:['avocado toast','acai bowl','açaí bowl','vitality bowls'], mealTime:'brunch' },
  { pattern: /\bfrench\s*toast\b/,                     tier1:['breakfast_restaurant','brunch_restaurant'],                tier2:['cafe','diner'],                                   label:'French toast',      nameKeywords:['french toast'], mealTime:'breakfast' },
  { pattern: /\bbreakfast\s*burrito\b/,                tier1:['mexican_restaurant','breakfast_restaurant'],               tier2:[],                                                 label:'breakfast burrito', nameKeywords:['breakfast burrito'], mealTime:'breakfast' },
  // ── Australian ────────────────────────────────────────────────────────────
  { pattern: /\bpavlova\b|\blamington\b/,              tier1:['australian_restaurant','dessert_shop'],                    tier2:['bakery'],                                         label:'Australian dessert',nameKeywords:['pavlova','lamington'] },
  { pattern: /\bchicken\s*parm(igiana)?\b/,            tier1:['italian_restaurant','australian_restaurant'],              tier2:['pub','american_restaurant'],                      label:'chicken parmigiana',nameKeywords:['chicken parm','chicken parmigiana','parmi'] },
  // ── Drinks & Cafe ──────────────────────────────────────────────────────────
  { pattern: /\bmatcha\b/,                             tier1:['japanese_restaurant','tea_house','cafe'],                  tier2:['coffee_shop','dessert_shop'],                     label:'matcha',          nameKeywords:['matcha','matcha bar','matcha cafe'] },
  { pattern: /\btea\b|\bteahouse\b/,                   tier1:['tea_house','cafe'],                                        tier2:['bubble_tea_shop'],                                label:'tea',             nameKeywords:['tea','teahouse','tea house','teavana','adagio','david\'s tea'] },
  { pattern: /\bjuice\b|\bfresh\s*juice\b|\bjuice\s*bar\b|\bsmoothie(s)?\b/, tier1:['juice_bar'],                          tier2:['cafe','vegan_restaurant'],                        label:'juice',           nameKeywords:['juice','smoothie','jamba','jamba juice','tropical smoothie','smoothie king','juice it up','nekter'] },
  { pattern: /\bmilkshake(s)?\b|\bshakes?\b/,          tier1:['ice_cream_shop','diner','american_restaurant'],            tier2:['dessert_shop'],                                   label:'milkshake',       nameKeywords:['milkshake','shake','shake shack','steak n shake'] },
  { pattern: /\bcocktails?\b|\bmartini\b|\bmojito\b/,  tier1:['cocktail_bar','bar'],                                      tier2:['lounge','restaurant'],                            label:'cocktails',       nameKeywords:['cocktail','martini','mojito','cocktail bar','speakeasy'] },
  { pattern: /\bwine\b|\bwinery\b|\bwine\s*bar\b/,     tier1:['wine_bar','winery'],                                       tier2:['bar','restaurant'],                               label:'wine',            nameKeywords:['wine','winery','wine bar'] },
  { pattern: /\bbeer\b|\bbrewery\b|\bbrewpub\b|\bcraft\s*beer\b/, tier1:['brewery','brewpub'],                              tier2:['bar','pub'],                                      label:'beer',            nameKeywords:['beer','brewery','brewpub','craft beer','taproom','stone brewing'] },
  { pattern: /\bwhiskey\b|\bwhisky\b|\bscotch\b|\bbourbon\b/, tier1:['whiskey_bar','bar'],                                  tier2:['lounge'],                                         label:'whiskey',         nameKeywords:['whiskey','whisky','scotch','bourbon','whiskey bar'] },
  { pattern: /\bsake\b/,                               tier1:['japanese_restaurant','bar'],                               tier2:[],                                                 label:'sake',            nameKeywords:['sake','sake bar'] },
  // ── Generic categories ─────────────────────────────────────────────────────
  { pattern: /\bsalad(s)?\b/,                          tier1:['salad_bar','vegan_restaurant','vegetarian_restaurant'],    tier2:['cafe','restaurant'],                              label:'salad',           nameKeywords:['salad','salad bar','sweetgreen','chop\'t','tossed','tender greens'] },
  { pattern: /\bsoup(s)?\b/,                           tier1:['soup_restaurant'],                                         tier2:['cafe','asian_restaurant'],                        label:'soup',            nameKeywords:['soup','souplantation','soup plantation'] },
  { pattern: /\bnoodles?\b/,                           tier1:['noodle_house','ramen_restaurant'],                         tier2:['chinese_restaurant','japanese_restaurant','vietnamese_restaurant','thai_restaurant'], label:'noodles', nameKeywords:['noodle','noodles','noodle house','noodle bar','noodles & company'] },
  { pattern: /\brice\s*bowl(s)?\b|\bpoke\s*bowl(s)?\b|\bgrain\s*bowl(s)?\b/, tier1:['bowl_restaurant','asian_restaurant'], tier2:['vegan_restaurant','vegetarian_restaurant'],     label:'bowl',            nameKeywords:['bowl','rice bowl','grain bowl','poke bowl'] },
  { pattern: /\bdessert(s)?\b/,                        tier1:['dessert_shop','ice_cream_shop','bakery'],                  tier2:['pastry_shop','cafe'],                             label:'dessert',         nameKeywords:['dessert','desserts','sweets','sweet shop'] },
  { pattern: /\bvegan\b/,                              tier1:['vegan_restaurant'],                                        tier2:['vegetarian_restaurant'],                          label:'vegan',           nameKeywords:['vegan','plant based','vegan kitchen','plant power','veggie grill'] },
  { pattern: /\bvegetarian\b/,                         tier1:['vegetarian_restaurant'],                                   tier2:['vegan_restaurant','indian_restaurant'],           label:'vegetarian',      nameKeywords:['vegetarian','veggie','plant based'] },
  { pattern: /\bgluten[\s-]*free\b/,                   tier1:['gluten_free_restaurant'],                                  tier2:['vegan_restaurant'],                               label:'gluten free',     nameKeywords:['gluten free','gf bakery','gf kitchen'] },
  { pattern: /\bhalal\b/,                              tier1:['halal_restaurant'],                                        tier2:['middle_eastern_restaurant','indian_restaurant'],  label:'halal',           nameKeywords:['halal','halal guys','halal cart','the halal guys'] },
  { pattern: /\bkosher\b/,                             tier1:['kosher_restaurant'],                                       tier2:['israeli_restaurant'],                             label:'kosher',          nameKeywords:['kosher','kosher kitchen','kosher deli'] },
  { pattern: /\bbuffet\b|\ball\s*you\s*can\s*eat\b/,   tier1:['buffet_restaurant'],                                       tier2:['restaurant'],                                     label:'buffet',          nameKeywords:['buffet','all you can eat','golden corral','hometown buffet','sizzler'] },
  { pattern: /\bdiner\b/,                              tier1:['diner'],                                                   tier2:['american_restaurant','breakfast_restaurant'],     label:'diner',           nameKeywords:['diner'] },
  { pattern: /\bpub\b|\bgastropub\b/,                  tier1:['pub','gastropub'],                                         tier2:['british_restaurant','bar'],                       label:'pub',             nameKeywords:['pub','gastropub','tavern'] },
  { pattern: /\bfast\s*food\b/,                        tier1:['fast_food_restaurant'],                                    tier2:[],                                                 label:'fast food',       nameKeywords:['fast food'] },
  { pattern: /\bsnacks?\b|\bfinger\s*food\b/,          tier1:['snack_bar','convenience_store'],                           tier2:['fast_food_restaurant','cafe'],                    label:'snacks',          nameKeywords:['snacks','finger food'] },
  { pattern: /\bcomfort\s*food\b|\bhome\s*cooking\b/,  tier1:['diner','american_restaurant'],                             tier2:['southern_restaurant','soul_food_restaurant'],     label:'comfort food',    nameKeywords:['comfort food','home cooking','soul food'] },
  // ── Bakery & Desserts (dishes whose "specialty" is a shop type, not a cuisine) ─────────
  { pattern: /\bcakes?\b|\bcupcakes?\b/,               tier1:['cake_shop','bakery'],                                      tier2:['dessert_shop','pastry_shop','cafe'],              label:'cake',            nameKeywords:['cake','cakes','cupcake','sprinkles','crumbs','magnolia bakery'] },
  { pattern: /\bbread\b|\bsourdough\b|\bbaguette\b/,   tier1:['bakery'],                                                  tier2:['cafe','sandwich_shop'],                           label:'bread',           nameKeywords:['bread','sourdough','baguette','breadworks','le pain quotidien','la brea bakery'] },
  { pattern: /\bpastr(y|ies)\b|\bdanish\b|\beclair\b|\bmacarons?\b/, tier1:['pastry_shop','bakery'],                       tier2:['french_restaurant','cafe','dessert_shop'],        label:'pastries',        nameKeywords:['pastry','pastries','danish','eclair','macaron','laduree','pierre herme','dominique ansel'] },
  { pattern: /\bpies?\b|\bcobblers?\b/,                tier1:['bakery','dessert_shop'],                                   tier2:['american_restaurant','diner'],                    label:'pie',             nameKeywords:['pie','pies','cobbler','marie callender','house of pies','pie hole','pie shop'] },
  { pattern: /\bcookies?\b/,                           tier1:['bakery','dessert_shop'],                                   tier2:['cafe'],                                           label:'cookies',         nameKeywords:['cookie','cookies','crumbl','insomnia','mrs. fields','dirty dough','levain','tate\'s'] },
  { pattern: /\bice\s*cream\b|\bgelato\b|\bsorbet\b/,  tier1:['ice_cream_shop','gelato_shop'],                            tier2:['dessert_shop','cafe'],                            label:'ice cream',       nameKeywords:['ice cream','gelato','sorbet','baskin robbins','ben & jerry','cold stone','salt & straw','jeni\'s','häagen-dazs','dairy queen','mcconnell','rite aid','handel\'s'] },
  { pattern: /\bcrepes?\b/,                            tier1:['creperie','french_restaurant'],                            tier2:['dessert_shop','cafe'],                            label:'crepes',          nameKeywords:['crepe','crepes','creperie'] },
  { pattern: /\bboba\b|\bbubble\s*tea\b/,              tier1:['bubble_tea_shop','tea_house'],                             tier2:['cafe'],                                           label:'boba',            nameKeywords:['boba','bubble tea','tpumps','7 leaves','sharetea','kung fu tea','85c','happy lemon','tiger sugar','yi fang','coco fresh'] },
  { pattern: /\bcoffee\b|\bespresso\b|\blatte\b/,      tier1:['coffee_shop','cafe'],                                      tier2:['bakery'],                                         label:'coffee',          nameKeywords:['coffee','espresso','latte','starbucks','peet','blue bottle','dutch bros','dunkin','la colombe','intelligentsia','philz','stumptown','caribou','tim hortons','coffee bean','verve'] },
  { pattern: /\bcheesecake\b/,                         tier1:['dessert_shop','bakery','cake_shop'],                       tier2:['cafe','american_restaurant'],                     label:'cheesecake',      nameKeywords:['cheesecake','cheesecake factory','junior\'s'] },
  { pattern: /\bchocolate\b|\bcacao\b|\btruffles?\b/,  tier1:['chocolatier','dessert_shop','candy_store'],                tier2:['bakery'],                                         label:'chocolate',       nameKeywords:['chocolate','cacao','truffle','godiva','lindt','see\'s','ghirardelli','vosges','jacques torres'] },
  { pattern: /\bbrownies?\b/,                          tier1:['bakery','dessert_shop'],                                   tier2:['cafe'],                                           label:'brownies',        nameKeywords:['brownie','brownies','fairytale brownies'] },
  { pattern: /\bfrozen\s*yogurt\b|\bfro[\s-]?yo\b/,    tier1:['ice_cream_shop'],                                          tier2:['dessert_shop'],                                   label:'frozen yogurt',   nameKeywords:['frozen yogurt','froyo','yogurt','yogurtland','menchie','pinkberry','tcby','sweetfrog','red mango','16 handles','tutti frutti'] },
  { pattern: /\bshaved\s*ice\b|\bsno[\s-]*cone\b|\bhalo[\s-]*halo\b/, tier1:['ice_cream_shop','dessert_shop'],              tier2:[],                                                 label:'shaved ice',      nameKeywords:['shaved ice','sno cone','snow cone','snowflake','hawaiian shaved ice','class 302'] },
  { pattern: /\bcr[eè]me\s*br[uû]l[eé]e\b|\bsouffl[eé]\b/, tier1:['french_restaurant','dessert_shop'],                     tier2:['bakery'],                                         label:'French dessert',  nameKeywords:['creme brulee','crème brûlée','soufflé','souffle'] },
  { pattern: /\bcandy\b|\bsweets?\b|\bfudge\b/,        tier1:['candy_store','dessert_shop'],                              tier2:['bakery'],                                         label:'candy',           nameKeywords:['candy','sweets','fudge','see\'s','jelly belly','dylan\'s candy','sugarfina'] },
];

// ─── FUZZY NORMALIZATION ─────────────────────────────────────────────────────
// Forgiving misspellings in the search bar: "sushii" → "sushi", "itallian"
// → "italian", "glutten free" → "gluten free", "vegen" → "vegan". Runs only
// when the raw query produced no intent match, so brand names and queries
// that already worked are untouched.

function levenshtein(a: string, b: string, maxDist: number): number {
  if (a === b) return 0;
  const aLen = a.length, bLen = b.length;
  if (Math.abs(aLen - bLen) > maxDist) return maxDist + 1;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  let prev = new Array(bLen + 1);
  let curr = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) prev[j] = j;
  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[bLen];
}

// Single-token vocabulary: cuisines, venue types, dietary terms, common dishes.
// Both singular and plural forms are listed so we don't have to stem at lookup
// time. Any token that exact-matches this set passes through fuzz untouched.
const FUZZY_VOCAB_SINGLE: Set<string> = new Set([
  // Cuisines
  'italian','mexican','chinese','japanese','korean','thai','vietnamese',
  'filipino','indian','french','greek','spanish','german','british','irish',
  'mediterranean','european','asian','latin','latino','american','brazilian',
  'peruvian','ethiopian','moroccan','turkish','israeli','polish','russian',
  'hawaiian','cantonese','venezuelan','indonesian','malaysian','singaporean',
  'swiss','hungarian','ukrainian','nigerian','australian','canadian',
  // Venue types
  'trattoria','osteria','bistro','bistrot','brasserie','taberna','bodega',
  'izakaya','cantina','taqueria','creperie','gastropub','pub','diner','cafe',
  'bakery','grill','restaurant','buffet','deli',
  // Dietary
  'vegan','vegetarian','halal','kosher',
  // Dishes — Japanese
  'sushi','ramen','udon','tempura','okonomiyaki','tonkatsu','yakitori',
  'shabu','katsu','gyoza','takoyaki','yakiniku','yakisoba','soba','onigiri',
  'omurice','bento','mochi','daifuku',
  // Dishes — Chinese
  'dumplings','potstickers','congee','jook','wonton','dimsum','bao','baozi',
  'shumai',
  // Dishes — Korean
  'bibimbap','bulgogi','kbbq','jjigae','bossam','samgyeopsal','tteokbokki',
  'kimchi','jajangmyeon','jjajangmyeon','mandu','japchae','gimbap','kimbap',
  'soondubu','sundubu','bingsu','bingsoo','patbingsu',
  // Dishes — Vietnamese / Thai
  'pho','cuon','larb',
  // Dishes — Indian
  'curry','biryani','dosa','tandoori','samosa','vindaloo','korma','naan',
  'chaat','vada','pakora','thali','chai','lassi','jalebi','rasmalai','kulfi',
  'saag','paneer',
  // Dishes — Filipino
  'adobo','sinigang','lechon','sisig','lumpia','pancit','bulalo','laing',
  'tapsilog','silog','longganisa','caldereta','pinakbet','ube','bibingka',
  'ensaymada','turon',
  // Dishes — SE Asian
  'laksa','satay','rendang',
  // Dishes — Middle Eastern / Turkish
  'shawarma','kebab','doner','falafel','hummus','shakshuka','tabbouleh',
  'tabouleh','baba','mezze','meze','baklava','dolma','pita','mansaf','kabsa',
  'maqluba','gozleme','lahmacun','pide','borek',
  // Dishes — Italian
  'pasta','lasagna','rigatoni','penne','spaghetti','carbonara','pizza',
  'arancini','suppli','aperitivo','risotto','ravioli','tortellini','gnocchi',
  'bruschetta','antipasto','caprese','panini','focaccia','calzone','stromboli',
  'meatballs','minestrone','tiramisu','cannoli','affogato',
  // Dishes — French
  'croissant','baguette','escargot','bouillabaisse','ratatouille','cassoulet',
  'quiche',
  // Dishes — Spanish
  'paella','tapas','jamon','chorizo','gazpacho','pintxos','vermut','vermouth',
  // Dishes — German / Swiss
  'schnitzel','bratwurst','wurst','pretzel','pretzels','brezel','sauerkraut',
  'spaetzle','fondue','raclette',
  // Dishes — Eastern European
  'pierogi','pierogies','perogi','perogies','borscht','goulash','stroganoff',
  'blini','pelmeni',
  // Dishes — South American
  'ceviche','empanada','empanadas','arepa','arepas','churrasco','feijoada',
  'picanha','moqueca','coxinha','pastel','caipirinha',
  // Dishes — African
  'injera','jollof','tagine',
  // Dishes — Mexican
  'taco','tacos','burrito','burritos','quesadilla','enchilada','enchiladas',
  'tamale','tamales','chilaquiles','tostada','tostadas','chimichanga','mole',
  'pozole','birria','carnitas','barbacoa','fajita','fajitas','elote','elotes',
  'esquites','horchata','churros','flan',
  // Dishes — American
  'burger','burgers','whopper','steak','bbq','barbeque','barbecue','ribs',
  'brisket','wings','seafood','shellfish','oysters','clams','lobster','gumbo',
  'jambalaya','crawfish','crayfish','cheesesteak','reuben','blt','sandwich',
  'sandwiches','submarine','sub','subs','hoagie','grinder','nachos','chili',
  'meatloaf','sliders','poutine','poke',
  // Dishes — Brunch
  'brunch','breakfast','benedict','omelet','omelette','frittata','acai',
  // Australian
  'pavlova','lamington','parmigiana',
  // Drinks
  'matcha','tea','teahouse','juice','smoothie','smoothies','milkshake',
  'cocktails','martini','mojito','wine','winery','beer','brewery','brewpub',
  'whiskey','whisky','scotch','bourbon','sake','coffee','espresso','latte',
  // Generic
  'salad','salads','soup','soups','noodles','dessert','desserts','snacks',
  'snack',
  // Bakery / Sweets
  'cake','cakes','cupcakes','bread','sourdough','pastries','pastry','danish',
  'eclair','macaron','macarons','pie','pies','cobblers','cookies','gelato',
  'sorbet','crepe','crepes','boba','cheesecake','chocolate','cacao','truffles',
  'brownies','froyo','candy','sweets','fudge','bagel','bagels','donut','donuts',
  'doughnut','doughnuts',
]);

// Multi-word phrases. Both canonical and common variant spellings live here
// so a fuzzed token pair can find its target. Token-count buckets keep
// distance comparisons cheap.
const FUZZY_VOCAB_PHRASES: string[] = [
  'gluten free','gluten-free',
  'pad thai','pad see ew','pad kee mao','pad kra pao','tom yum','tom kha',
  'green curry','red curry','khao soi','massaman curry',
  'banh mi','bun cha','bun bo hue','com tam','spring rolls','spring roll',
  'dim sum','peking duck','dan dan','char siu','chow mein','lo mein',
  'fried rice','kung pao','steamed buns','siu mai','har gow','hong kong',
  'soup dumplings','soup dumpling','xiao long bao','xiaolong bao',
  'korean bbq','korean fried chicken','kimchi stew','kare kare','halo halo',
  'butter chicken','murgh makhani','tikka masala','palak paneer',
  'chana masala','rogan josh','garlic naan','pani puri','golgappa','bhel puri',
  'vada pav','pav bhaji','aloo gobi','mango lassi','masala chai','masala dosa',
  'gulab jamun','leche flan','bicol express','crispy pata','lechon kawali',
  'nasi goreng',
  'baba ganoush','sticky rice','thai tea','thai iced tea','mango sticky rice',
  'papaya salad','drunken noodles','som tam',
  'cacio e pepe','french onion','french onion soup','coq au vin',
  'beef bourguignon','boeuf bourguignon','foie gras','pao de queijo',
  'jollof rice','brazilian bbq','brazilian steak',
  'fish and chips','shepherds pie','bangers and mash','full english',
  'english breakfast','meat pie','mince pie','yorkshire pudding',
  'fried chicken','pulled pork','chicken wings','buffalo wings','clam chowder',
  'lobster roll','po boy','poor boy','poboy','shrimp and grits',
  'biscuits and gravy','chicken and waffles','philly cheesesteak',
  'club sandwich','grilled cheese','hot dog','corn dog','onion rings',
  'french fries','chicken tenders','chicken strips','chicken nuggets',
  'chicken parm','chicken parmesan','chicken parmigiana','chicken pot pie',
  'buffalo chicken','mac and cheese','mac n cheese','poke bowl','rice bowl',
  'grain bowl','eggs benedict','avocado toast','acai bowl','french toast',
  'breakfast burrito','frozen yogurt','shaved ice','sno cone','creme brulee',
  'fast food','finger food','comfort food','home cooking','all you can eat',
  'soul food','tres leches','agua fresca','aguas frescas','orange chicken',
  'general tso','tapas bar','food hall','food court','food market',
  'wine bar','sports bar','cocktail bar','sushi bar','juice bar','noodle bar',
];

let _phrasesByLen: Map<number, string[]> | null = null;
function phrasesByTokenCount(): Map<number, string[]> {
  if (_phrasesByLen) return _phrasesByLen;
  const m = new Map<number, string[]>();
  for (const p of FUZZY_VOCAB_PHRASES) {
    const n = p.split(/\s+/).length;
    if (!m.has(n)) m.set(n, []);
    m.get(n)!.push(p);
  }
  _phrasesByLen = m;
  return m;
}
const FUZZY_VOCAB_PHRASES_SET = new Set(FUZZY_VOCAB_PHRASES);

function fuzzyMatchSingle(token: string): string | null {
  if (FUZZY_VOCAB_SINGLE.has(token)) return token;
  // ≤3 chars: exact only. 4–5: distance 1. 6+: distance 2.
  let maxDist: number;
  if (token.length <= 3) return null;
  else if (token.length <= 5) maxDist = 1;
  else maxDist = 2;
  let best: { word: string; dist: number } | null = null;
  let tied = false;
  for (const vocab of FUZZY_VOCAB_SINGLE) {
    if (Math.abs(vocab.length - token.length) > maxDist) continue;
    const d = levenshtein(token, vocab, maxDist);
    if (d > maxDist) continue;
    if (!best || d < best.dist) { best = { word: vocab, dist: d }; tied = false; }
    else if (d === best.dist && vocab !== best.word) tied = true;
  }
  return best && !tied ? best.word : null;
}

function fuzzyMatchPhrase(phrase: string): string | null {
  if (FUZZY_VOCAB_PHRASES_SET.has(phrase)) return phrase;
  const tokenCount = phrase.split(/\s+/).length;
  const candidates = phrasesByTokenCount().get(tokenCount);
  if (!candidates) return null;
  const maxDist = 2;
  let best: { word: string; dist: number } | null = null;
  let tied = false;
  for (const vocab of candidates) {
    if (Math.abs(vocab.length - phrase.length) > maxDist) continue;
    const d = levenshtein(phrase, vocab, maxDist);
    if (d > maxDist) continue;
    if (!best || d < best.dist) { best = { word: vocab, dist: d }; tied = false; }
    else if (d === best.dist && vocab !== best.word) tied = true;
  }
  return best && !tied ? best.word : null;
}

function fuzzyNormalizeQuery(query: string): string {
  const trimmed = query?.trim();
  if (!trimmed) return query;
  const tokens = trimmed.toLowerCase().split(/\s+/);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // Try 2-word phrase first (greedy left-to-right).
    if (i + 1 < tokens.length) {
      const pair = `${tokens[i]} ${tokens[i + 1]}`;
      const phraseHit = fuzzyMatchPhrase(pair);
      if (phraseHit) { out.push(phraseHit); i += 2; continue; }
    }
    const tok = tokens[i];
    if (/^[a-z]+$/.test(tok)) {
      out.push(fuzzyMatchSingle(tok) ?? tok);
    } else {
      out.push(tok);
    }
    i += 1;
  }
  return out.join(' ');
}

// Detect a dietary modifier word inside the search query when it sits next to
// a dish intent ("halal taco", "vegan ramen", "gluten-free pizza"). Returns
// null when the dish label is itself a dietary term, to avoid double-filtering
// (e.g. a "vegan" search already routes to the vegan_restaurant tier1 type via
// DISH_MAP — applying the vegan hard-filter on top would empty the result set).
function detectDietaryModifier(query: string, dishLabel: string | null): string | null {
  const q = (query || '').toLowerCase();
  if (dishLabel) {
    const dl = dishLabel.toLowerCase();
    if (['halal','kosher','vegan','vegetarian','gluten free'].includes(dl)) return null;
  }
  if (/\bhalal\b/.test(q)) return 'halal';
  if (/\bkosher\b/.test(q)) return 'kosher';
  if (/\bvegan\b/.test(q)) return 'vegan';
  if (/\bvegetarian\b/.test(q)) return 'vegetarian';
  if (/\bgluten[\s-]?free\b/.test(q)) return 'glutenFree';
  return null;
}

type ParsedIntent =
  | { kind: 'UMBRELLA'; cultureKey: string; label: string; types: Set<string>; keywords: string[] }
  | { kind: 'DISH'; label: string; tier1Types: string[]; tier2Types: string[]; rawWords: string[]; nameKeywords: string[]; mealTime?: 'breakfast' | 'brunch' | 'lunch' | 'dinner' }
  | { kind: 'GENERAL' };

function parseSearchIntent(query: string): ParsedIntent {
  if (!query?.trim()) return { kind: 'GENERAL' };
  // Pass 1: try the raw query — preserves brand names and exact matches.
  const direct = parseSearchIntentInner(query.toLowerCase());
  if (direct.kind !== 'GENERAL') return direct;
  // Pass 2: fuzz-correct unknown tokens, retry. Only runs when pass 1 missed,
  // so brand names like "Yogurtland" never get rewritten.
  const fuzzed = fuzzyNormalizeQuery(query);
  if (fuzzed && fuzzed !== query.toLowerCase()) {
    return parseSearchIntentInner(fuzzed);
  }
  return { kind: 'GENERAL' };
}

function parseSearchIntentInner(q: string): ParsedIntent {
  // Cultural umbrella terms (user culturally expects East/SE Asian, NOT Indian)
  if (/\basian\b/.test(q))             return { kind:'UMBRELLA', cultureKey:'asian',         ...CULTURAL_INTENTS.asian };
  if (/\blatin\b|\blatino\b/.test(q))  return { kind:'UMBRELLA', cultureKey:'latin',         ...CULTURAL_INTENTS.latin };
  if (/\bmediterranean\b/.test(q))     return { kind:'UMBRELLA', cultureKey:'mediterranean', ...CULTURAL_INTENTS.mediterranean };
  if (/\beuropean\b/.test(q))          return { kind:'UMBRELLA', cultureKey:'european',      ...CULTURAL_INTENTS.european };
  // Regional casual-dining venue synonyms — route to that cuisine's type so
  // a traveler searching "trattoria" in Florence sees Italian neighborhood
  // places, not Olive Garden. Runs BEFORE bare-cuisine UMBRELLAs.
  if (/\btrattoria\b|\bosteria\b/.test(q))     return { kind:'UMBRELLA', cultureKey:'italian',    label:'Trattoria', types:new Set(['italian_restaurant']),                        keywords:['trattoria','osteria','pasta','pizza','antipasto'] };
  if (/\bbistro(t)?\b|\bbrasserie\b/.test(q))  return { kind:'UMBRELLA', cultureKey:'french',     label:'Bistro',    types:new Set(['french_restaurant']),                         keywords:['bistro','brasserie','croissant','crepe'] };
  if (/\btaberna\b|\btapas\s*bar\b|\bbodega\b/.test(q)) return { kind:'UMBRELLA', cultureKey:'spanish', label:'Taberna', types:new Set(['spanish_restaurant','tapas_bar']),         keywords:['tapas','pintxos','jamon','wine','vermut'] };
  if (/\bizakaya\b/.test(q))                   return { kind:'UMBRELLA', cultureKey:'japanese',   label:'Izakaya',   types:new Set(['japanese_restaurant','bar']),                 keywords:['sake','yakitori','small plates','japanese pub'] };
  if (/\bcantina\b|\btaqueria\b/.test(q))      return { kind:'UMBRELLA', cultureKey:'mexican',    label:'Cantina',   types:new Set(['mexican_restaurant']),                        keywords:['tacos','tequila','margarita','tortas'] };
  if (/\bfood\s*hall\b|\bfood\s*market\b|\bmercato\b|\bmercado\b|\bfood\s*court\b/.test(q)) return { kind:'UMBRELLA', cultureKey:'market', label:'Food Market', types:new Set(['food_court']), keywords:['market','hall','stall','street food'] };
  // Single-word cuisine names → narrow umbrella to just that cuisine's type.
  // Runs after the broad umbrellas so "Italian food" still hits italian_restaurant
  // (no overlap with /\beuropean\b/), and "Mexican" lands here instead of GENERAL.
  if (/\bitalian\b/.test(q))           return { kind:'UMBRELLA', cultureKey:'italian',       label:'Italian',       types:new Set(['italian_restaurant']),     keywords:['pasta','pizza','risotto','lasagna'] };
  if (/\bmexican\b/.test(q))           return { kind:'UMBRELLA', cultureKey:'mexican',       label:'Mexican',       types:new Set(['mexican_restaurant']),     keywords:['taco','burrito','enchilada','quesadilla'] };
  if (/\bchinese\b/.test(q))           return { kind:'UMBRELLA', cultureKey:'chinese',       label:'Chinese',       types:new Set(['chinese_restaurant']),     keywords:['dim sum','noodle','dumpling','chow mein'] };
  if (/\bjapanese\b/.test(q))          return { kind:'UMBRELLA', cultureKey:'japanese',      label:'Japanese',      types:new Set(['japanese_restaurant']),    keywords:['sushi','ramen','tempura','udon'] };
  if (/\bkorean\b/.test(q))            return { kind:'UMBRELLA', cultureKey:'korean',        label:'Korean',        types:new Set(['korean_restaurant']),      keywords:['bibimbap','kimchi','bulgogi','korean bbq'] };
  if (/\bthai\b/.test(q))              return { kind:'UMBRELLA', cultureKey:'thai',          label:'Thai',          types:new Set(['thai_restaurant']),        keywords:['pad thai','tom yum','green curry'] };
  if (/\bvietnamese\b/.test(q))        return { kind:'UMBRELLA', cultureKey:'vietnamese',    label:'Vietnamese',    types:new Set(['vietnamese_restaurant']),  keywords:['pho','banh mi','spring roll'] };
  if (/\bfilipino\b/.test(q))          return { kind:'UMBRELLA', cultureKey:'filipino',      label:'Filipino',      types:new Set(['filipino_restaurant']),    keywords:['adobo','sinigang','lumpia','sisig'] };
  if (/\bindian\b/.test(q))            return { kind:'UMBRELLA', cultureKey:'indian',        label:'Indian',        types:new Set(['indian_restaurant']),      keywords:['curry','biryani','naan','tikka masala'] };
  if (/\bfrench\b/.test(q))            return { kind:'UMBRELLA', cultureKey:'french',        label:'French',        types:new Set(['french_restaurant']),      keywords:['croissant','baguette','crepe'] };
  if (/\bgreek\b/.test(q))             return { kind:'UMBRELLA', cultureKey:'greek',         label:'Greek',         types:new Set(['greek_restaurant']),       keywords:['gyro','souvlaki','tzatziki'] };
  // Specific dishes
  for (const entry of DISH_MAP) {
    const m = q.match(entry.pattern);
    if (m) {
      // Capture the exact words the user typed that matched the pattern so the
      // tier classifier can name-match on the literal term (e.g. "spaghetti")
      // instead of just the canonical label ("pasta").
      const matched = (m[0] || '').toLowerCase();
      const rawWords = Array.from(new Set(matched.split(/\s+/).filter(w => w.length >= 3)));
      return { kind:'DISH', label:entry.label, tier1Types:entry.tier1, tier2Types:entry.tier2, rawWords, nameKeywords: entry.nameKeywords || [], mealTime:entry.mealTime };
    }
  }
  return { kind: 'GENERAL' };
}

function getTierForPlace(place: any, intent: ParsedIntent): number {
  if (intent.kind === 'GENERAL') return 1;
  const types = new Set([...(place.types || []), place.primaryType || ''].map((t: string) => t.toLowerCase()));
  const name = (place.displayName?.text || place.name || '').toLowerCase();
  const reviewText = (place.reviews || []).map((r: any) => r.text?.text || r.text || '').join(' ').toLowerCase();

  if (intent.kind === 'UMBRELLA') {
    if ([...types].some((t: string) => intent.types.has(t))) return 1;
    if (intent.keywords.some(kw => name.includes(kw) || reviewText.includes(kw))) return 2;
    return 4;
  }
  if (intent.kind === 'DISH') {
    // Words that count as a "namesake" match: the canonical label, what the
    // user actually typed, AND the curated nameKeywords for this dish. Lets
    // "Old Spaghetti Factory" rank Tier 1 on a "spaghetti" search (rawWords)
    // AND lets "Yogurtland" rank Tier 1 on a "froyo" search (nameKeywords).
    // Without nameKeywords, namesake matching only catches places that
    // happen to contain the literal user-typed word.
    const dishWords = Array.from(new Set([
      intent.label.toLowerCase(),
      ...(intent.rawWords || []),
      ...(intent.nameKeywords || [])
    ].filter(Boolean)));

    // ── Tier 2/3/4 gating for breakfasty queries ────────────────────────────
    // For breakfasty queries (mealTime=breakfast/brunch), every type-match
    // and text-match Tier path below is gated by hasBreakfastPlausibleType.
    // Without this gate, fast-food chains tagged `american_restaurant`
    // (Chick-fil-A, KFC) tier 3 via tier2Types, and chains whose reviews
    // mention "pancake" tier 4 (Starbucks, Burger King, Taco Bell). The
    // tag set deliberately excludes `american_restaurant` for this reason.
    // EXEMPT paths (Tier 1 namesake name match, bakery type, McDonald's
    // via KNOWN_BREAKFAST_CHAINS chain list) are unchanged — they're
    // trustworthy on their own.
    // For non-breakfasty DISH searches, hasBreakfastPlausibleType=true so
    // this gate is a no-op (sushi/pho/tacos/etc. unaffected).
    const isBreakfasty = intent.mealTime === 'breakfast' || intent.mealTime === 'brunch';
    const hasBreakfastPlausibleType = !isBreakfasty || (
      BREAKFAST_PLAUSIBLE_TYPES.has(place.primaryType || '') ||
      [...types].some((t: string) => BREAKFAST_PLAUSIBLE_TYPES.has(t))
    );

    if (dishWords.some(w => name.includes(w))) return 1;          // namesake / specialty (ungated — name match is trustworthy)

    // ── Step 4.9 belt-and-suspenders reject ────────────────────────────────
    // For breakfasty queries, hard-reject coffee chains and fast-food chains
    // UNLESS in KNOWN_BREAKFAST_CHAINS. Tighter than the BREAKFAST_PLAUSIBLE_
    // TYPES gate: Starbucks (cafe / coffee_shop), KFC / BK / Taco Bell / CFA
    // (fast_food_restaurant) carry no breakfast plausible type so they should
    // already tier 5 — but this is a backstop in case another code path or
    // a Google type retagging leaks them past the gate. McDonald's stays via
    // KNOWN_BREAKFAST_CHAINS (fast_food_restaurant + chain list match).
    // SCOPE: breakfasty mealTime only — sushi / pho / tacos / ramen / burgers
    // searches all unaffected.
    if (isBreakfasty) {
      const inChainList = KNOWN_BREAKFAST_CHAINS.some(c => name.includes(c));
      if (!inChainList) {
        const primary = place.primaryType || '';
        const isFastFood   = primary === 'fast_food_restaurant' || types.has('fast_food_restaurant');
        const isCoffeeShop = primary === 'coffee_shop'          || types.has('coffee_shop');
        if (isFastFood || isCoffeeShop) return 5;
      }
    }

    if (intent.tier1Types.some(t => types.has(t)) && hasBreakfastPlausibleType) return 2;  // cuisine specialist
    if (intent.tier2Types.some(t => types.has(t)) && hasBreakfastPlausibleType) return 3;  // secondary cuisine

    // 1. editorialSummary text mentions the dish (free, in search response)
    const editorial = ((place.editorialSummary?.text || place.editorialSummary || '') as string).toString().toLowerCase();
    if (hasBreakfastPlausibleType && editorial && dishWords.some(w => editorial.includes(w))) return 4;

    // 2. Meal-time signals: chains/bakeries that serve breakfast almost certainly
    // have pancakes/waffles/etc. on the menu. We INTENTIONALLY do NOT trust
    // Google's place.servesBreakfast / place.servesBrunch booleans — they are
    // stale for many chains (Taco Bell, KFC, Chick-fil-A, McDonald's, Burger
    // King, Starbucks all came back as Tier 4 for "pancakes" in Arcadia, all
    // via servesBreakfast=true from menus that haven't been updated since
    // ~2014-2020). Instead we layer two reliable signals: primaryType=bakery
    // (bakeries reliably stock breakfast pastries/pancakes/waffles) and a
    // curated KNOWN_BREAKFAST_CHAINS name match (IHOP, Denny's, Original
    // Pancake House, Black Bear Diner, Corner Bakery, Waffle House, etc.).
    // These two paths are UNGATED — they're trustworthy on their own and
    // are the reason McDonald's (fast_food_restaurant primaryType, not in
    // BREAKFAST_PLAUSIBLE_TYPES) still appears in pancake results.
    if (isBreakfasty) {
      if (types.has('bakery') || place.primaryType === 'bakery') return 4;
      if (KNOWN_BREAKFAST_CHAINS.some(c => name.includes(c))) return 4;
    }
    // Lunch/dinner: Google's serves* booleans are less stale for these meals
    // (every restaurant either does or doesn't serve lunch, no menu-rotation
    // confusion like with breakfast). Keep for now; revisit if regressions appear.
    if (intent.mealTime === 'lunch'  && place.servesLunch  === true) return 4;
    if (intent.mealTime === 'dinner' && place.servesDinner === true) return 4;

    // 3. Review-text mention (only fires if Details was hydrated for this place)
    if (hasBreakfastPlausibleType && dishWords.some(w => reviewText.includes(w))) return 4;

    // 4. Menu OCR dish list (populated by /label-photos worker endpoint, 180d cache)
    const menuDishes = (place.menuDishes || []) as string[];
    if (hasBreakfastPlausibleType && menuDishes.length && dishWords.some(w => menuDishes.some(md => md.includes(w)))) return 4;

    // 5. Native Google Places API (New) AI fields — additive signal layer,
    // returned on text-search when TEXT_SEARCH_AI_FIELDS is in the mask.
    // generativeSummary is a Gemini-generated overview of the place; if
    // it mentions the dish, the place serves it.
    const aiSummary = ((place.generativeSummary?.overview?.text) || '').toString().toLowerCase();
    if (hasBreakfastPlausibleType && aiSummary && dishWords.some(w => aiSummary.includes(w))) return 4;

    // 6. Native Google query-aware review snippets. Google pre-matches
    // review text to the user's query and returns just the relevant
    // excerpts here. Mention = strong "Serves It" signal.
    // r.text shape is { text: string, languageCode: string } per Google's
    // schema, but defensive-handle the plain-string shape too.
    const contextualReviewText = ((place.contextualContents?.reviews) || [])
      .map((r: any) => (r?.text?.text || r?.text || '').toString())
      .join(' ')
      .toLowerCase();
    if (hasBreakfastPlausibleType && contextualReviewText && dishWords.some(w => contextualReviewText.includes(w))) return 4;

    return 5;  // true noise — filtered out before returning to frontend
  }
  return 1;
}

const TIER_LABELS: Record<number, string> = {
  1:'Namesake',         // name match — place name contains the dish word
  2:'Specialist',       // place type matches the dish's primary cuisine type
  3:'Related Cuisine',  // place type matches secondary cultural cuisine
  4:'Serves It',        // editorialSummary / cached reviews / menu OCR mention the dish
  // 5 = noise (not in TIER_LABELS by design — filtered out before reaching the frontend)
};

const CUISINE_QUERIES: Record<string, string[]> = {
  // 'all': reduced from 8 to 3 queries (saves 5 API calls per page load)
  // nearby types already cover fast food, bakery, takeout — no need to duplicate via text
  all:           ['restaurant', 'best restaurant near me', 'popular restaurant'],
  american:      ['american restaurant', 'burger restaurant', 'diner'],
  mexican:       ['mexican restaurant', 'taqueria', 'tacos'],
  italian:       ['italian restaurant', 'pasta restaurant', 'trattoria'],
  chinese:       ['chinese restaurant', 'dim sum'],
  japanese:      ['japanese restaurant', 'ramen'],
  sushi:         ['sushi restaurant', 'sushi bar'],
  thai:          ['thai restaurant'],
  indian:        ['indian restaurant', 'curry restaurant'],
  korean:        ['korean restaurant', 'korean bbq'],
  vietnamese:    ['vietnamese restaurant', 'pho'],
  mediterranean: ['mediterranean restaurant', 'greek restaurant'],
  seafood:       ['seafood restaurant', 'fish restaurant'],
  steakhouse:    ['steakhouse', 'steak restaurant'],
  pizza:         ['pizza restaurant', 'pizzeria'],
  breakfast:     ['breakfast restaurant', 'brunch restaurant'],
  fast_food:     ['fast food', 'quick service restaurant'],
  vegetarian:    ['vegetarian restaurant', 'vegan restaurant', 'plant based restaurant'],
  vegan:         ['vegan restaurant', 'plant based restaurant'],
  halal:         ['halal restaurant', 'halal food', 'halal meat'],
  kosher:        ['kosher restaurant', 'kosher food', 'kosher deli'],
  dessert:       ['dessert shop', 'ice cream', 'bakery'],
  // reduced from 6 to 3 (nearby types cover pastry_shop/dessert_shop already)
  bakery:        ['bakery', 'pastry shop', 'donut shop'],
  // Sports bar: 2 text queries max (more causes network timeouts at 25mi).
  // Query 1 "sports bar" — finds explicitly self-labeled sports bars (Rocco's Tavern,
  //   Barney's Beanery, 33 Taps — anything with "sports bar" in Google name/description/reviews).
  // Query 2 "bar" — broad bar text-scan so British/local pubs like Lucky Baldwin's, T. Boyle's
  //   Tavern, and Yard House (tagged 'bar' not 'sports_bar') enter the candidate pool for scoring.
  //   sportsScore sorting ensures actual sports bars float to top over generic bars.
  sports_bar:    ['sports bar', 'bar'],
  filipino:      ['filipino restaurant', 'pinoy restaurant'],
  // Trending: broad queries — Worker uses rankPreference:RELEVANCE; frontend sorts by rating×reviews
  trending:      ['best restaurant', 'most popular restaurant'],
  local:         ['local favorite restaurant', 'neighborhood restaurant'],
  // Hidden Gems: specific language Google understands for underrated spots
  // Client-side badge threshold: rating ≥4.5, reviews 50–500 (under the radar but proven)
  hidden:        ['hidden gem restaurant', 'underrated local restaurant', 'best kept secret restaurant'],
  fine:          ['fine dining', 'upscale restaurant'],
  budget:        ['cheap eats', 'budget friendly restaurant'],
  latenight:     ['late night food', '24 hour restaurant', 'open late restaurant'],
};

Deno.serve(async (req) => {
  console.log("\n🍽️ === getRestaurants v5.0 START ===\n");

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', places: [] }, { status: 401 });

    const body = await req.json();
    const {
      latitude,
      longitude,
      radius = 16093,      // PlacesToEat sends radius * 1609 (meters)
      maxResults = 40,
      cuisine = 'all',
      searchQuery = '',
      forceRefresh = false,
      // v5.0: server-side filter params (passed from PlacesToEat filters)
      filterOpenNow  = false,
      filterMinRating = 0,
      filterMaxPrice  = 0,   // 0=any, 1=$, 2=$$, 3=$$$, 4=$$$$
      // v5.2: user's active dietary chip. Passed alongside searchQuery so we
      // can still filter+tag results even when the dietary shortcut is skipped
      // (which happens whenever searchQuery is non-empty).
      activeDietary = null,
      // v5.3: full UI filter state for the Semantic Text Compiler. All chip
      // state is translated into one natural-language query Google AI can
      // match on, instead of being stripped client-side after the fetch.
      filterDriveThru = false,
      filterOutdoor   = false,
      filterIndoor    = false,
      filterParking   = false,
      filterBakery    = false,
      filterBars      = false,
      filterVibes     = {},   // { family, liveMusic, groups, sportsBar, outdoor }
      filterDietary   = {},   // { vegetarian, vegan, halal, kosher, glutenFree }
    } = body;

    // Map filterMaxPrice → Google priceLevels array
    const PRICE_LEVEL_NAMES = [
      'PRICE_LEVEL_FREE',
      'PRICE_LEVEL_INEXPENSIVE',
      'PRICE_LEVEL_MODERATE',
      'PRICE_LEVEL_EXPENSIVE',
      'PRICE_LEVEL_VERY_EXPENSIVE',
    ];
    let priceLevels: string[] = filterMaxPrice > 0
      ? PRICE_LEVEL_NAMES.slice(0, filterMaxPrice + 1)
      : [];

    // Fine Dining / Budget cuisines map to explicit priceLevels (native Google
    // filter), not to a semantic query modifier. Overrides the user's Max
    // Price chip since these cuisines *are* price-bracketed.
    if (cuisine === 'fine') {
      priceLevels = ['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'];
    } else if (cuisine === 'budget') {
      priceLevels = ['PRICE_LEVEL_INEXPENSIVE'];
    }

    if (!latitude || !longitude) {
      return Response.json({ error: "Latitude and longitude required", places: [] }, { status: 400 });
    }

    // ── IMPORTANT: Worker POST / expects radiusMiles, not meters ──────────────
    // PlacesToEat.jsx sends `radius: radius * 1609` (meters), so convert back.
    const radiusMiles = Math.round(radius / 1609.34);  // Clean integer for Worker cache key

    console.log("📋 Request:", { latitude, longitude, radius, radiusMiles: radiusMiles.toFixed(1), cuisine, searchQuery, forceRefresh });

    // Parse search intent for tiering + honest fallbacks
    let intent = parseSearchIntent(searchQuery);

    // ── UMBRELLA synthesis from cuisine chip (Step 4.5 Fix 3) ────────────────
    // When the user has a specific cuisine chip active but the search bar is
    // empty, parseSearchIntent returns GENERAL → getTierForPlace returns 1
    // for every place → all results get an "Authentic" / "Namesake" badge.
    // Synthesize an UMBRELLA intent from the cuisine chip so type-true
    // restaurants tier 1, keyword-mentioning places tier 2, and the rest
    // tier 4 — making the badges meaningful.
    // Only synthesize when intent is GENERAL: a typed dish or cuisine word
    // (which already parses to DISH or UMBRELLA) should win over the chip.
    if (intent.kind === 'GENERAL' && cuisine && cuisine !== 'all') {
      const chipUmbrella = CUISINE_CHIP_TO_UMBRELLA[cuisine];
      if (chipUmbrella) {
        intent = {
          kind: 'UMBRELLA',
          cultureKey: cuisine,
          label: chipUmbrella.label,
          types: chipUmbrella.types,
          keywords: chipUmbrella.keywords,
        };
        console.log(`🧠 Intent synthesized from cuisine chip: ${cuisine} -> UMBRELLA(${chipUmbrella.label})`);
      }
    }

    console.log(`🧠 Intent: ${intent.kind}${intent.kind !== 'GENERAL' ? ` (${(intent as any).label})` : ''}`);

    // ── DIETARY SHORTCUT ──────────────────────────────────────────────────────
    // Fires when:
    //   - cuisine is itself a dietary key (legacy path, cuisine='kosher')
    //   - OR cuisine='all' + activeDietary chip set (the common path from the
    //     Advanced Filters drawer — frontend always sends cuisine='all' there)
    // Routes through the Worker's /places/dietary endpoint, which uses a
    // targeted text query ("kosher restaurant") and a dedicated 3-day cache.
    // Skipped entirely when the user typed a search — that path goes through
    // the semantic compiler so the dietary word + dish word combine cleanly.
    const DIETARY_TYPES = ['halal', 'kosher', 'vegan', 'vegetarian', 'glutenFree'];
    const dietaryShortcutKey = DIETARY_TYPES.includes(cuisine)
      ? cuisine
      : (activeDietary && DIETARY_TYPES.includes(activeDietary) ? activeDietary : null);
    if (!searchQuery?.trim() && dietaryShortcutKey) {
      console.log(`🥗 Dietary shortcut: calling /places/dietary?dietary=${dietaryShortcutKey}`);
      try {
        const params = new URLSearchParams({
          latitude:   String(latitude),
          longitude:  String(longitude),
          radius:     String(radius),
          maxResults: String(maxResults),
          dietary:    dietaryShortcutKey,
        });
        const res = await fetch(`${API_BASE_URL}/places/dietary?${params}`);
        if (res.ok) {
          const data = await res.json();
          const places = data.places || [];
          console.log(`✅ /places/dietary returned ${places.length} places`);
          if (places.length > 0) {
            // Tag each place with the dietary filter that matched so the
            // frontend trusts backend's assertion and doesn't re-filter
            // using its own (stricter) detection heuristics.
            const tagged = places.map((p: any) => ({ ...p, dietary: { ...(p.dietary || {}), [dietaryShortcutKey]: true } }));
            return Response.json({ places: tagged, count: tagged.length, version: 'v4.3', dietary: dietaryShortcutKey });
          }
          console.warn(`⚠️ /places/dietary returned 0 — falling back to text search`);
        }
      } catch (e: any) {
        console.error(`/places/dietary error: ${e.message} — falling back`);
      }
    }

    // ── SEMANTIC TEXT COMPILER ─────────────────────────────────────────────
    // Translate every UI chip + the user's typed text into a single natural-
    // language query Google Places Text Search (AI-powered) can match on.
    // Example: cuisine=mexican + Drive-Thru + Family + search="tacos"
    //   →  "mexican restaurant tacos with drive-thru and family friendly"
    // This avoids the old "0 results" trap where client-side filters stripped
    // legitimate Google results because per-place booleans weren't populated.
    const rawQuery = searchQuery?.trim() || '';
    const baseTypes: string[] = [];
    const features: string[] = [];

    // Cuisine noun — friendly-name map so "fast_food" doesn't become "fast_food restaurant"
    const cuisineReadable: Record<string, string> = {
      fast_food: 'fast food',
      fine: 'fine dining',
      latenight: 'late night',
      glutenFree: 'gluten-free',
      sports_bar: 'sports bar',
      dessert: 'desserts',
    };
    const skipCuisineInSemantic = cuisine === 'all' || cuisine === 'sports_bar' || cuisine === 'bakery';
    if (!skipCuisineInSemantic) {
      const friendly = cuisineReadable[cuisine] ?? cuisine.replace(/_/g, ' ');
      const needsVenue = !/(shop|dining|bar|restaurant|desserts?)/i.test(friendly);
      baseTypes.push(needsVenue ? `${friendly} restaurant` : friendly);
    }
    // Bakery text query: "bakeries and pastries" (vs the older "bakery pastry")
    // — natural-language phrasing Google text-search ranks better, AND a fresh
    // cache key so we don't hit any stale-empty entries from the prior phrasing.
    if (filterBakery) baseTypes.push('bakeries and pastries');
    if (filterBars)   baseTypes.push('bars pubs');
    // v5.4: Sports Bar vibe was previously handled by a dedicated frontend
    // fetch with cuisine='sports_bar'. After unifying to mainFetch the
    // compiler must weave the vibe into the query itself.
    if ((filterVibes as any).sportsBar) baseTypes.push('sports bar');

    // Dietary adjectives go at the FRONT (English grammar: "vegan mexican restaurant")
    const DIETARY_READABLE: Record<string, string> = {
      vegan: 'vegan', vegetarian: 'vegetarian',
      halal: 'halal', kosher: 'kosher', glutenFree: 'gluten-free',
    };
    const activeDietaryKeys = Object.keys(filterDietary || {}).filter(k => (filterDietary as any)[k]);
    activeDietaryKeys.forEach(k => {
      const adj = DIETARY_READABLE[k];
      if (adj) baseTypes.unshift(adj);
    });

    // Features — appended with "with X and Y"
    if (filterDriveThru) features.push('drive-thru');
    if (filterOutdoor)   features.push('outdoor seating');
    if (filterIndoor)    features.push('indoor seating');
    if (filterParking)   features.push('parking');
    const vibes = filterVibes || {};
    if ((vibes as any).family)    features.push('family friendly');
    if ((vibes as any).liveMusic) features.push('live music');
    if ((vibes as any).groups)    features.push('good for groups');

    // Travel experience modifiers — bias Google text search toward the right
    // kind of venue when the user uses these familiar travel phrases.
    const wantsRooftop  = /\brooftop\b/i.test(rawQuery);
    const wantsFarmToTable = /\bfarm[\s-]*to[\s-]*table\b/i.test(rawQuery);
    const wantsHiddenGem = /\bhidden\s*gem(s)?\b/i.test(rawQuery);
    if (wantsRooftop)     features.push('with view');
    if (wantsFarmToTable) features.push('locally sourced');

    // Assemble the semantic query
    let semanticQuery = rawQuery;

    // Optional bare-dish "Has-It" query — surfaces non-specialist restaurants
    // (Cheesecake Factory, BJ's, CPK) that serve the dish but aren't typed as
    // specialist. Set only on DISH intent for raw food nouns; null otherwise.
    let dishHasItQuery: string | null = null;

    // ── INTENT-AWARE SMART APPEND ──────────────────────────────────────
    // If the user typed a raw food noun without any UI chips (baseTypes
    // empty), Google gets confused ("Kare Kare" → 0 results). Use the
    // parsed intent to append the correct venue type from DISH_MAP so
    // Google knows what kind of place to search for.
    const isRawFoodNoun = !baseTypes.length && semanticQuery &&
      !/restaurant|food|near me|cafe|bar|bakery|shop|grill|diner|bistro|place/i.test(semanticQuery);

    if (isRawFoodNoun && intent.kind === 'DISH' && (intent as any).tier1Types?.length > 0) {
      const tier1Type = (intent as any).tier1Types[0];
      const expertType = tier1Type.replace(/_/g, ' ');
      semanticQuery = `${semanticQuery} ${expertType}`;

      // Skip dual query when the dish IS the cuisine (pizza/sushi/ramen/bakery
      // bare query would near-duplicate the specialist query).
      const SKIP_DUAL = new Set(['pizza_restaurant','sushi_restaurant','ramen_restaurant','bakery']);
      if (!SKIP_DUAL.has(tier1Type)) {
        dishHasItQuery = rawQuery.replace(/\bbest\b/i, '').trim();
      }
    }
    // GENERAL + raw query falls through unchanged. Google's text search is
    // brand-aware ("Yogurtland") and category-aware ("snacks", "outdoor seating")
    // — appending "shop or restaurant" only mangled the signal.

    // Weave in the Base Types (e.g., "bakery", "vegan")
    if (baseTypes.length) {
      semanticQuery = semanticQuery
        ? `${baseTypes.join(' ')} ${semanticQuery}`
        : baseTypes.join(' ');
    }
    if (!semanticQuery.trim()) semanticQuery = 'restaurant';

    // Weave in the Features (e.g., "with drive-thru")
    if (features.length) {
      semanticQuery = `${semanticQuery} with ${features.join(' and ')}`;
    }

    // Dedup repeated words (e.g. "bagel bagel shop" → "bagel shop").
    {
      const seen = new Set<string>();
      semanticQuery = semanticQuery.split(/\s+/).filter((w: string) => {
        const lw = w.toLowerCase();
        if (seen.has(lw)) return false;
        seen.add(lw);
        return true;
      }).join(' ');
    }

    // Mirror prefix/suffix/dedup on the bare-dish query so dietary requirements
    // and feature filters apply identically (otherwise non-specialists would
    // come back without dietary filtering and get hard-rejected later).
    if (dishHasItQuery !== null) {
      if (baseTypes.length) {
        dishHasItQuery = dishHasItQuery
          ? `${baseTypes.join(' ')} ${dishHasItQuery}`
          : baseTypes.join(' ');
      }
      if (!dishHasItQuery.trim()) dishHasItQuery = 'restaurant';
      if (features.length) {
        dishHasItQuery = `${dishHasItQuery} with ${features.join(' and ')}`;
      }
      const seen = new Set<string>();
      dishHasItQuery = dishHasItQuery.split(/\s+/).filter((w: string) => {
        const lw = w.toLowerCase();
        if (seen.has(lw)) return false;
        seen.add(lw);
        return true;
      }).join(' ');
      if (dishHasItQuery === semanticQuery) dishHasItQuery = null;
    }

    // When any filter or search text is active, route the single semantic
    // query to Google. Otherwise keep the multi-query CUISINE_QUERIES path
    // for general browsing breadth.
    const anyFilterActive = baseTypes.length > 0 || features.length > 0 || !!rawQuery;
    const queries: string[] = anyFilterActive
      ? (dishHasItQuery ? [semanticQuery, dishHasItQuery] : [semanticQuery])
      : (CUISINE_QUERIES[cuisine] || CUISINE_QUERIES.all);
    console.log(`🧩 Semantic query: "${semanticQuery}"${dishHasItQuery ? ` | + Has-It: "${dishHasItQuery}"` : ''} | anyFilterActive: ${anyFilterActive}`);

    const allPlaces: any[] = [];
    const seenPlaceIds = new Set<string>();
    const errors: string[] = [];

    // ── PARALLEL NEARBY SEARCHES BY TYPE ─────────────────────────────────────
    // Google Places returns max 20 per call. Running one search for 'restaurant'
    // only returns the 20 most popular — missing chains like Subway/KFC/IHOP and
    // small local spots. Running 6 type-specific searches by DISTANCE gives up to
    // 120 unique candidates covering all restaurant categories.
    //
    // Each result is cached in the Worker KV for 3 days — so parallel calls are
    // only expensive on first load for a new area; after that all are cache hits.

    // Reduced from 6 to 3 types (saves 3 API calls per page load)
    // 'bakery' covered by dedicated bakery fetch; 'bar'/'sports_bar' by sports bar fetch
    const NEARBY_TYPES_ALL = [
      'restaurant',           // general: local, ethnic, sit-down
      'fast_food_restaurant', // chains: Subway, Taco Bell, KFC, Panda Express, McDonald's, IHOP
      'meal_takeaway',        // takeout-only spots often missed by other types
    ];

    const NEARBY_TYPES_CUISINE: Record<string, string[]> = {
      chinese:       ['chinese_restaurant'],
      japanese:      ['japanese_restaurant', 'ramen_restaurant'],
      sushi:         ['sushi_restaurant'],
      korean:        ['korean_restaurant'],
      thai:          ['thai_restaurant'],
      vietnamese:    ['vietnamese_restaurant'],
      indian:        ['indian_restaurant'],
      mexican:       ['mexican_restaurant'],
      american:      ['american_restaurant', 'hamburger_restaurant'],
      // 'pizza_restaurant' INTENTIONALLY excluded from Italian nearby fan-out.
      // Pizza chains (Domino's, Papa Johns, Little Caesars, Pizza Hut, Sbarro)
      // were drowning the Italian chip's results in stuff that's pizza-only,
      // not authentically Italian. They still appear under the Pizza chip
      // (which has its own pizza_restaurant nearby fan-out below).
      italian:       ['italian_restaurant'],
      pizza:         ['pizza_restaurant'],
      seafood:       ['seafood_restaurant'],
      mediterranean: ['mediterranean_restaurant', 'greek_restaurant'],
      fast_food:     ['fast_food_restaurant', 'hamburger_restaurant', 'sandwich_shop'],
      breakfast:     ['breakfast_restaurant', 'brunch_restaurant'],
      dessert:       ['ice_cream_shop', 'dessert_shop', 'bakery', 'donut_shop'],
      filipino:      ['filipino_restaurant'],
      // Bakery: removed 'cafe' — it flooded results with Starbucks that stole the 40-item slots,
      // then got filtered out by the frontend bakery filter, leaving 0 results.
      bakery:        ['bakery', 'pastry_shop', 'dessert_shop'],
      sports_bar:    ['sports_bar', 'bar'],  // nearby fetch; text search queries above do the heavy lifting
    };

    // Master switch: detect ANY advanced UI filter. Generic Nearby Search
    // can't natively filter for Drive-Thru, Live Music, Halal, Outdoor, etc.
    // so even one active chip would let invalid restaurants pollute the
    // Semantic Text results. Check every state explicitly.
    const hasAdvancedFilters =
      filterBakery ||
      filterBars ||
      filterDriveThru ||
      filterOutdoor ||
      filterIndoor ||
      filterParking ||
      Object.values(filterVibes || {}).some((v: any) => v) ||
      Object.keys(filterDietary || {}).length > 0;

    // Disable generic Nearby fetch when advanced filters are active. For plain
    // text searches we ALSO suppress nearby... UNLESS it's a DISH intent: text
    // search alone misses chains/bakeries that serve the dish but aren't ranked
    // for it (McDonald's pancakes, Corner Bakery pancakes). For DISH we run a
    // small targeted broad-foodservice fan-out so "Has It" Tier 3 places enter
    // the candidate pool.
    const isDishSearch = intent.kind === 'DISH';
    const skipNearby = hasAdvancedFilters || (!!searchQuery?.trim() && !isDishSearch);

    // For DISH searches, broaden the pool with generic foodservice categories
    // PLUS the dish's own specialist types. Without specialist types, narrow
    // venues like ice_cream_shop / dessert_shop / juice_bar / boba_tea_shop /
    // donut_shop never enter the candidate pool (text-search alone misses them).
    // Worker's nearby KV cache is 3 days, so steady-state cost is unchanged.
    const DISH_BROAD_TYPES = ['restaurant', 'fast_food_restaurant', 'meal_takeaway', 'bakery'];
    // Include BOTH tier1 and tier2 types so DISH searches like 'froyo' (tier1
    // ice_cream_shop, tier2 dessert_shop) get nearby fan-out to both. Without
    // tier2 here, Yogurtland-style places that Google primarily tags as
    // dessert_shop (NOT ice_cream_shop) never enter the candidate pool from
    // the nearby branch.
    const dishSpecialistTypes: string[] = isDishSearch
      ? [...((intent as any).tier1Types || []), ...((intent as any).tier2Types || [])]
      : [];
    // Breakfasty DISH searches (pancakes / waffles / french toast / omelette /
    // brunch / breakfast burrito / etc.) also fan out to bakery types so chains
    // whose primaryType is `bakery` (Corner Bakery Cafe, Porto's, Panera, La
    // Brea, Einstein Bros) reach the candidate pool. Without this, the dish
    // nearby fan-out only covers [breakfast_restaurant, american_restaurant,
    // diner] and bakery-typed chains never get queried even when they're in
    // the radius. Once in the pool the existing tier logic handles them:
    // Corner Bakery + Panera tier 4 via KNOWN_BREAKFAST_CHAINS, generic
    // bakeries tier 4 via the primaryType=bakery ungated path at line ~1004.
    // dessert_shop deliberately omitted — pancakes ≠ frozen yogurt / ice
    // cream / candy shops.
    const isBreakfastyDish = isDishSearch && (
      (intent as any).mealTime === 'breakfast' ||
      (intent as any).mealTime === 'brunch'
    );
    const breakfastyBakeryTypes = isBreakfastyDish
      ? ['bakery', 'pastry_shop', 'donut_shop', 'bagel_shop']
      : [];
    const dishNearbyTypes = isDishSearch
      ? Array.from(new Set([...dishSpecialistTypes, ...DISH_BROAD_TYPES, ...breakfastyBakeryTypes]))
      : [];

    // ── HYBRID SEARCH STRATEGY for venue-type chips ──────────────────────────
    // When a venue-defining chip is active (Bakery & Pastry, Bars & Pubs,
    // Sports Bar VIBE), the search runs in two parallel branches:
    //
    //   1. PRIMARY  — semantic text-search (the "bakeries and pastries" /
    //      "bars pubs" / "sports bar" string assembled by the compiler
    //      above), one call to Google's :searchText endpoint.
    //   2. FALLBACK — type-based Nearby calls listed here, one call per
    //      type to Google's :searchNearby endpoint, Promise.allSettled so
    //      one failure (invalid type, timeout) doesn't kill the others.
    //
    // Results from both branches merge into allPlaces, deduped by placeId
    // via seenPlaceIds Set, and every place — text or nearby — goes through
    // isActuallyARestaurant before being added to the candidate pool.
    //
    // - Bakery: 5 types — 'bakery' is the canonical match; 'pastry_shop',
    //   'dessert_shop', 'donut_shop', 'bagel_shop' broaden coverage so we
    //   still surface results in areas where any single type is sparse.
    // - Bars & Pubs: 2 types — bar + pub.
    // - Sports Bar (VIBE): 2 types — sports_bar + bar, POPULARITY-ranked so
    //   famous spots like Rocco's, Barney's, Lucky Baldwin's (often 10-15mi
    //   away) surface instead of being crowded out by closer dive bars.
    // Typed-bakery detection: when the user types 'bakery' / 'bakeries' /
    // 'pastry' / 'pastries' / 'patisserie' / 'boulangerie' / 'donut(s)' /
    // 'doughnut(s)' / 'bagel(s)' in the search bar, trigger the same 5-type
    // nearby fan-out as the Bakery & Pastry chip. The chip path was already
    // covered; this extends symmetric coverage to typed queries.
    const TYPED_BAKERY_PATTERN = /\b(?:bakery|bakeries|pastr(?:y|ies)|patisserie|boulangerie|donuts?|doughnuts?|bagels?)\b/i;
    const typedBakeryActive = !!searchQuery?.trim() && TYPED_BAKERY_PATTERN.test(searchQuery);
    const bakeryNearbyTypes    = (filterBakery || typedBakeryActive) ? ['bakery', 'pastry_shop', 'dessert_shop', 'donut_shop', 'bagel_shop'] : [];
    const barsNearbyTypes      = filterBars   ? ['bar', 'pub'] : [];
    const sportsBarVibeActive  = !!(filterVibes as any)?.sportsBar;
    const sportsBarNearbyTypes = sportsBarVibeActive ? ['sports_bar', 'bar'] : [];
    const venueChipTypes = Array.from(new Set([
      ...bakeryNearbyTypes,
      ...barsNearbyTypes,
      ...sportsBarNearbyTypes,
    ]));

    const nearbyTypeList = skipNearby
      ? venueChipTypes
      : isDishSearch
        ? Array.from(new Set([...dishNearbyTypes, ...venueChipTypes]))
        : cuisine === 'all'
          ? Array.from(new Set([...NEARBY_TYPES_ALL, ...venueChipTypes]))
          : Array.from(new Set([...(NEARBY_TYPES_CUISINE[cuisine] || ['restaurant']), ...venueChipTypes]));

    // Per-type ranking strategy. Each type in the fan-out picks its own
    // rankBy so we don't bleed POPULARITY into unrelated cuisines (e.g.
    // when filterBakery + cuisine='italian' both active, italian_restaurant
    // calls stay DISTANCE).
    //
    // - Bakery types: radius-aware hybrid. ≤5mi → DISTANCE (convenience-
    //   first: the user wants the closest croissant). >5mi → POPULARITY
    //   (quality-first: they're willing to travel for a famous bakery).
    // - Sports bar types: always POPULARITY when the chip is active.
    //   Surfaces Rocco's Tavern, Lucky Baldwin's, Barney's Beanery from
    //   10-15mi away. DISTANCE would fill 20 slots with the closest dive
    //   bars and miss the famous game-day venues.
    // - Everything else: DISTANCE.
    const BAKERY_TYPES_SET = new Set(['bakery','pastry_shop','dessert_shop','donut_shop','bagel_shop']);
    const SPORTS_TYPES_SET = new Set(['sports_bar','bar']);
    const BAKERY_RANK_BY: 'POPULARITY' | 'DISTANCE' = radiusMiles > 5 ? 'POPULARITY' : 'DISTANCE';
    const SPORTS_BAR_ACTIVE = sportsBarVibeActive || cuisine === 'sports_bar';
    const rankByForType = (type: string): 'POPULARITY' | 'DISTANCE' => {
      if (filterBakery && BAKERY_TYPES_SET.has(type)) return BAKERY_RANK_BY;
      if (SPORTS_BAR_ACTIVE && SPORTS_TYPES_SET.has(type)) return 'POPULARITY';
      return 'DISTANCE';
    };

    const nearbyPromise = Promise.allSettled(
      nearbyTypeList.map(async (type) => {
        try {
          const params = new URLSearchParams({
            type,
            latitude:   String(latitude),
            longitude:  String(longitude),
            radius:     String(Math.min(radius, 50000)),
            maxResults: '20',
            rankBy:     rankByForType(type),
            // v5.0: pass server-side filters to nearby search too
            ...(filterOpenNow               ? { openNow: 'true' }                : {}),
            ...(filterMinRating > 0         ? { minRating: String(filterMinRating) } : {}),
            ...(priceLevels.length          ? { priceLevels: priceLevels.join(',') } : {}),
          });
          const res = await fetch(`${API_BASE_URL}/places/nearby?${params}`);
          if (!res.ok) return;
          const data = await res.json();
          const places: any[] = data.places || [];
          console.log(`🗺️ nearby type=${type}: ${places.length} places`);
          for (const place of places) {
            const pid = place.id || place.placeId;
            if (pid && !seenPlaceIds.has(pid) && isActuallyARestaurant(place)) {
              seenPlaceIds.add(pid);
              allPlaces.push(place);
            }
          }
        } catch (e: any) {
          console.warn(`nearby type=${type} error (non-fatal):`, e.message);
        }
      })
    );

    // Compute includedType for server-side narrowing at Google.
    // DANGER: includedType strictly filters out everything else!
    // Only use it when: no search text, no advanced filters, AND the cuisine
    // maps to exactly 1 Google type. Dessert (4 types) / Bakery (3 types)
    // would lock to just ice_cream_shop / bakery, filtering out all others.
    const cuisineTypeList = NEARBY_TYPES_CUISINE[cuisine];
    const serverIncludedType = (!rawQuery && !hasAdvancedFilters && cuisine !== 'all' && cuisineTypeList?.length === 1)
      ? cuisineTypeList[0]
      : '';

    // Inner helper so we can re-run the same query set at a wider radius if
    // first-pass results are sparse (auto-expand-on-sparse).
    const runQueryPass = async (passRadiusMiles: number) => {
      const passRadiusMeters = Math.round(passRadiusMiles * 1609.34);
      for (const query of queries) {
        try {
          console.log(`📡 POST /  query: "${query}" radiusMiles: ${passRadiusMiles.toFixed(1)}${serverIncludedType ? ` includedType: ${serverIncludedType}` : ''}`);

          const response = await fetch(`${API_BASE_URL}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude,
              longitude,
              query,
              radiusMiles: passRadiusMiles,
              dietary: {},
              // v5.0: server-side filters — Google filters at source, not client-side
              openNow:     filterOpenNow  || false,
              minRating:   filterMinRating > 0 ? filterMinRating : 0,
              priceLevels: priceLevels.length ? priceLevels : [],
              // v5.4: honor caller's forceRefresh flag. Was temporarily hardcoded
              // to true to purge the poisoned 0-result KV cache — now that the
              // cache is healthy, revert to normal caching behavior so we stop
              // paying for duplicate Google calls on repeat searches.
              forceRefresh,
              // v5.1: pass includedType so Google narrows by type (italian_restaurant etc.)
              ...(serverIncludedType ? { includedType: serverIncludedType } : {}),
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.error(`POST / HTTP ${response.status}: ${errText}`);
            errors.push(`"${query}": HTTP ${response.status}`);

            // Fallback to /places/text-search
            try {
              const params = new URLSearchParams({
                query,
                latitude:   String(latitude),
                longitude:  String(longitude),
                radius:     String(passRadiusMeters),
                maxResults: '20',
                cacheTtl:   String(60 * 60 * 2), // 2hr fallback TTL
                ...(forceRefresh ? { forceRefresh: 'true' } : {}),
              });
              const fbRes = await fetch(`${API_BASE_URL}/places/text-search?${params}`);
              if (fbRes.ok) {
                const fbData = await fbRes.json();
                for (const place of fbData.places || []) {
                  const pid = place.id || place.placeId;
                  if (pid && !seenPlaceIds.has(pid) && isActuallyARestaurant(place)) {
                    seenPlaceIds.add(pid);
                    allPlaces.push(place);
                  }
                }
                console.log(`   Fallback got ${fbData.places?.length || 0}`);
              }
            } catch (_e) {}
            continue;
          }

          const data = await response.json();
          console.log(`   _cache:${data._cache||'none'} total:${data.totalFound||0}`);

          if (data.error) errors.push(`"${query}": ${data.error}`);

          // Worker v7.3 returns "restaurants" key from POST /
          const places = data.restaurants || data.places || data.results || [];
          console.log(`   ✅ ${places.length} places`);

          for (const place of places) {
            const pid = place.id || place.placeId;
            if (pid && !seenPlaceIds.has(pid) && isActuallyARestaurant(place)) {
              seenPlaceIds.add(pid);
              allPlaces.push(place);
            }
          }

        } catch (err: any) {
          console.error(`Error for "${query}":`, err.message);
          errors.push(`"${query}": ${err.message}`);
        }
      }
    };

    await runQueryPass(radiusMiles);

    // Wait for all parallel nearby searches to finish
    await nearbyPromise;

    console.log(`📊 Total unique after all searches: ${allPlaces.length}`);
    if (errors.length) console.error("⚠️ Errors:", errors);

    // ── AUTO-EXPAND ON SPARSE RESULTS ─────────────────────────────────────
    // When a dish/cuisine search returns very few raw results, silently retry
    // with a wider radius so the user isn't dumped into an empty state.
    // Skips when there's no active intent (general browsing already has plenty
    // of nearby spots) or when the user's already at max radius.
    let autoExpandedFrom: number | null = null;
    let effectiveRadiusMiles = radiusMiles;
    const SPARSE_THRESHOLD = 15;       // raw places before filters
    const MAX_EXPAND_RADIUS = 25;
    const intentful = intent.kind !== 'GENERAL' || !!searchQuery?.trim() || cuisine !== 'all';
    if (intentful && allPlaces.length < SPARSE_THRESHOLD && radiusMiles < MAX_EXPAND_RADIUS) {
      const expandedRadius = Math.min(radiusMiles + 10, MAX_EXPAND_RADIUS);
      console.log(`🔭 Auto-expanding radius: ${radiusMiles} → ${expandedRadius} mi (only ${allPlaces.length} raw results)`);
      autoExpandedFrom = radiusMiles;
      effectiveRadiusMiles = expandedRadius;
      await runQueryPass(expandedRadius);
      console.log(`🔭 After auto-expand: ${allPlaces.length} total`);
    }

    if (allPlaces.length === 0) {
      return Response.json({
        places: [], count: 0,
        debug: {
          errors,
          hint: errors.length > 0
            ? "Check Worker deployment + Google API key"
            : "API succeeded but 0 results — Worker may have empty cache for this area",
        },
        error: "No restaurants found. Try expanding your search radius.",
      });
    }

    // ── FILTER OUT NON-RESTAURANTS (retail stores, etc.) ─────────────────────
    const foodPlaces = allPlaces.filter(isActuallyARestaurant);
    console.log(`🍔 After restaurant filter: ${foodPlaces.length} (removed ${allPlaces.length - foodPlaces.length} non-food)`);

    // ── NORMALIZE ALL places first (need distance to sort correctly) ──────────
    // NOTE: slice happens AFTER sort — so we return the 40 CLOSEST, not the
    // 40 first-fetched. Without this, far-away results from "chinese restaurant"
    // queries crowd out nearby places.
    const processedPlaces = foodPlaces.map(place => {
      const lat = place.location?.latitude || place.lat || 0;
      const lng = place.location?.longitude || place.lng || 0;
      const dist = calcDistance(latitude, longitude, lat, lng);

      const weekdayDescriptions =
        place.currentOpeningHours?.weekdayDescriptions ||
        place.regularOpeningHours?.weekdayDescriptions ||
        place.hours || [];

      const photos = (place.photos || []).map((p: any) => p.url || p).filter(Boolean);
      const customerFavorites = place.customerFavorites || place.customer_favorites || [];

      const reviews = (place.reviews || []).map((r: any) => ({
        rating: r.rating || 0,
        text:   r.text?.text || r.text || '',
        author: r.authorDisplayName || r.authorAttribution?.displayName || r.author || 'Anonymous',
        time:   r.relativePublishTimeDescription || r.relative_time_description || r.time || '',
        profilePhoto: r.authorAttribution?.photoUri || r.profilePhoto || null,
      }));

      const hasDriveThru  = place.hasDriveThru  || false;
      const isTakeoutOnly = place.isTakeoutOnly  || false;
      const isCashOnly    = place.isCashOnly     || false;
      const bestTimeNote  = place.bestTimeNote   || detectBestTime(reviews);

      // Sports Vibe Score — computed on raw place (reviews still have original structure)
      const sportsScore = calcSportsScore(place);
      const sportsBadge = sportsLabel(sportsScore);

      return {
        id: place.id || place.placeId,
        placeId: place.id || place.placeId,
        displayName: place.displayName || { text: place.name || '' },
        name: place.displayName?.text || place.name || '',
        location: { latitude: lat, longitude: lng },
        latitude: lat, longitude: lng,
        formattedAddress:      place.formattedAddress      || '',
        shortFormattedAddress: place.shortFormattedAddress || '',
        distanceKm: dist, distanceMiles: dist * 0.621371,
        rating: place.rating || null,
        userRatingCount: place.userRatingCount || 0,
        priceLevel: place.priceLevel,
        currentOpeningHours: { openNow: place.isOpen, weekdayDescriptions },
        regularOpeningHours: { weekdayDescriptions },
        hours: weekdayDescriptions,
        isOpen: place.isOpen ?? null,
        photos,
        photoUrl:  photos[0] || null,
        photoUrl2: photos[1] || null,
        types: place.types || [],
        primaryType: place.primaryType || null,
        nationalPhoneNumber:      place.nationalPhoneNumber || '',
        internationalPhoneNumber: place.internationalPhoneNumber || '',
        websiteUri:    place.websiteUri    || null,
        googleMapsUri: place.googleMapsUri || null,
        serviceOptions: place.serviceOptions || {},
        dineIn:         place.serviceOptions?.dineIn    ?? place.dineIn    ?? null,
        takeout:        place.serviceOptions?.takeout   ?? place.takeout   ?? null,
        delivery:       place.serviceOptions?.delivery  ?? place.delivery  ?? null,
        outdoorSeating: place.serviceOptions?.outdoorSeating ?? place.outdoorSeating ?? null,
        reservable: place.reservable ?? null,
        goodForChildren: place.goodForChildren ?? null,
        goodForGroups:   place.goodForGroups   ?? null,
        servesBeer:      place.servesBeer      ?? null,
        servesWine:      place.servesWine      ?? null,
        servesCocktails: place.servesCocktails ?? null,
        servesVegetarianFood: place.servesVegetarianFood ?? null,
        customerFavorites,
        reviews,
        hasDriveThru, isTakeoutOnly, isCashOnly, bestTimeNote,
        why:       place.why       || null,
        is_breakthrough: place.is_breakthrough || false,
        paymentOptions: place.paymentOptions || {},
        parkingOptions: place.parkingOptions || null,
        seatingSource: (place.dineIn != null || place.outdoorSeating != null) ? 'api' : null,
        sportsScore,   // 0–100 confidence score (ChatGPT + Gemini multi-signal algorithm)
        sportsBadge,   // "Best Sports Bar" | "Sports-Friendly" | "Casual Watch Spot" | null
        // Intent-aware tiering (1=Authentic, 2=Good Match, 3=Has It, 4=Other)
        // Overrides any Worker-pass-through tier with our richer client-side logic
        tier:      getTierForPlace(place, intent),
        tierLabel: TIER_LABELS[getTierForPlace(place, intent)] || 'Match',
      };
    }).filter(p => p.distanceMiles <= effectiveRadiusMiles + 1); // +1 mi buffer for GPS inaccuracy (auto-expand bumps this)

    // ── DIETARY HARD-FILTER (client-side safety net) ──────────────────────────
    function hasStrongDietaryMatch(place: any, cuisine: string): boolean {
      const types = [...(place.types || []), place.primaryType || '']
        .filter(Boolean).map((t: string) => t.toLowerCase());
      const text = [
        place.name || '',
        ...(place.reviews || []).map((r: any) => r.text || '')
      ].join(' ').toLowerCase();

      if (cuisine === 'halal')
        return types.includes('halal_restaurant') || /\bhalal\b/.test(text) || /\bzabiha\b/.test(text);
      if (cuisine === 'kosher')
        return types.includes('kosher_restaurant')
          || /\bkosher\b/.test(text)
          || /\bhechsher\b|\bmashgiach\b|\bglatt\b|\bparve\b|\bshomer\s*shabbat\b/.test(text)
          || /\b(?:ou|star-k|kof-k|crc|orb)[\s-]?(?:kosher|certified|approved)\b/.test(text);
      if (cuisine === 'vegan')
        return types.includes('vegan_restaurant')
          || /\bvegan\b/.test(text)
          || /\bplant[\s-]?based\b/.test(text);
      if (cuisine === 'vegetarian')
        return place.servesVegetarianFood === true || types.includes('vegetarian_restaurant') || /\bvegetarian\b/.test(text);
      if (cuisine === 'glutenFree')
        return /\bgluten[\s-]?free\b/.test(text)
          || /\bceliac\b|\bcoeliac\b/.test(text)
          || /\bgf\s*(?:menu|bakery|bread|pizza|pasta|options?|friendly)\b/.test(text)
          || /\bdedicated\s+gluten[\s-]?free\b/.test(text)
          || /\bwheat[\s-]?free\b/.test(text)
          || /\bgfco\b|\bgluten[\s-]?free\s+certified\b/.test(text);
      return true;
    }

    function dietaryScore(place: any, cuisine: string): number {
      const types = [...(place.types || []), place.primaryType || '']
        .filter(Boolean).map((t: string) => t.toLowerCase());
      const text = [
        place.name || '',
        ...(place.reviews || []).map((r: any) => r.text || '')
      ].join(' ').toLowerCase();
      let score = 0;
      if (cuisine === 'halal') {
        if (types.includes('halal_restaurant')) score += 100;
        if (/\bhalal\b/.test(text)) score += 20;
        if (/\bzabiha\b|\bhmc\b/.test(text)) score += 10;
      }
      if (cuisine === 'kosher') {
        if (types.includes('kosher_restaurant')) score += 100;
        if (/\bkosher\b/.test(text)) score += 20;
        if (/\bhechsher\b|\bmashgiach\b|\bglatt\b|\bparve\b|\bshomer\s*shabbat\b/.test(text)) score += 10;
        if (/\b(?:ou|star-k|kof-k|crc|orb)[\s-]?(?:kosher|certified|approved)\b/.test(text)) score += 10;
      }
      if (cuisine === 'vegan') {
        if (types.includes('vegan_restaurant')) score += 100;
        if (/\bvegan\b/.test(text)) score += 20;
        if (/\bplant[\s-]?based\b/.test(text)) score += 10;
      }
      score += (place.rating || 0) * 5;
      score += Math.min(place.userRatingCount || 0, 500) / 25;
      score -= (place.distanceKm || 0);
      return score;
    }

    const DIETARY_FILTER_TYPES = ['halal', 'kosher', 'vegan', 'vegetarian', 'glutenFree'];
    // Map DISH_MAP labels (and a few common synonyms) to dietary-filter keys
    // so typing "halal"/"vegan"/"kosher"/"gluten free" in the search bar
    // triggers the same strict filter as the dietary chip.
    const DIETARY_INTENT_LABEL_TO_KEY: Record<string, string> = {
      'halal': 'halal',
      'kosher': 'kosher',
      'vegan': 'vegan',
      'vegetarian': 'vegetarian',
      'gluten free': 'glutenFree',
    };
    const intentDietary = intent.kind === 'DISH'
      ? (DIETARY_INTENT_LABEL_TO_KEY[((intent as any).label || '').toLowerCase()] || null)
      : null;
    // Compound modifier: dish intent + dietary word elsewhere in the query
    // ("halal taco", "vegan ramen", "gluten-free pizza"). Detected here to
    // avoid a circular dep with the fuzzy matcher.
    const compoundDietary = detectDietaryModifier(
      searchQuery || '',
      intent.kind === 'DISH' ? (intent as any).label : null
    );

    // Resolve the "effective" dietary for this request. Priority:
    //   1. cuisine itself (filter-only path, cuisine='kosher', no search)
    //   2. explicit activeDietary param (user typed a search + has dietary chip active)
    //   3. compound dietary detected within the search text
    //   4. dietary intent label from search text
    const effectiveDietary = DIETARY_FILTER_TYPES.includes(cuisine)
      ? cuisine
      : (activeDietary && DIETARY_FILTER_TYPES.includes(activeDietary) ? activeDietary
        : (compoundDietary || intentDietary));

    let finalPlaces = processedPlaces;

    // ── LATE NIGHT HARD-FILTER (The "Bouncer") ──────────────────────────
    // Google's semantic search gathers 60 late-night candidates, but some
    // close at 8 PM. Use strict regex on the official Google hours strings
    // to kick out anything that closes before 10 PM.
    if (cuisine === 'latenight') {
      finalPlaces = finalPlaces.filter((p: any) => {
        if (!p.hours || p.hours.length === 0) return false;
        return p.hours.some((dayStr: string) => {
          const text = dayStr.toLowerCase();
          if (text.includes('24 hours')) return true;
          // Google formats: "Monday: 9:00 AM – 10:30 PM"
          // Split by dash/hyphen to isolate the closing-time half.
          const parts = text.split(/[-–to]/);
          const closingPart = parts.length > 1 ? parts[parts.length - 1] : text;
          // Match 10:xx PM, 11:xx PM, 12:xx AM, or 1–5:xx AM (genuinely late).
          return /(10|11):\d{2}\s*pm|(12|1|2|3|4|5):\d{2}\s*am/i.test(closingPart);
        });
      });
    }

    if (effectiveDietary) {
      // Strict: only return places that pass hasStrongDietaryMatch for the
      // requested dietary. Previously we fell back to the unfiltered pool
      // when matches < 3, which silently broke the user's filter intent
      // (clicking Kosher would surface 60 random non-kosher restaurants).
      // Now show only matches; the frontend's empty-state message handles
      // the zero-match case honestly.
      finalPlaces = processedPlaces.filter(p => hasStrongDietaryMatch(p, effectiveDietary));
      finalPlaces.sort((a, b) => dietaryScore(b, effectiveDietary) - dietaryScore(a, effectiveDietary));
      // Backend authoritatively matched these — tag so the frontend trusts
      // them instead of re-filtering with stricter client logic.
      finalPlaces.forEach((p: any) => {
        if (hasStrongDietaryMatch(p, effectiveDietary)) {
          p.dietary = { ...(p.dietary || {}), [effectiveDietary]: true };
        }
      });
    } else if (intent.kind !== 'GENERAL' && searchQuery?.trim()) {
      // "pasta"      → user is hungry, wants nearby → tier first, then DISTANCE
      // "best pasta" → user will drive for quality  → tier first, then QUALITY
      const wantsBest = /\bbest\b/i.test(searchQuery);
      finalPlaces.sort((a, b) => {
        if ((a.tier || 4) !== (b.tier || 4)) return (a.tier || 4) - (b.tier || 4);
        if (wantsBest || wantsHiddenGem) {
          // Quality: rating × log(reviewCount) — highest quality first.
          // For "hidden gem", penalize touristy/chain-volume places (>5000 reviews)
          // by halving their score, so well-loved locals beat well-known chains.
          const qa0 = (a.rating || 0) * Math.log10(Math.max(a.userRatingCount || 1, 1));
          const qb0 = (b.rating || 0) * Math.log10(Math.max(b.userRatingCount || 1, 1));
          const qa = wantsHiddenGem && (a.userRatingCount || 0) > 5000 ? qa0 * 0.5 : qa0;
          const qb = wantsHiddenGem && (b.userRatingCount || 0) > 5000 ? qb0 * 0.5 : qb0;
          return qb - qa;
        }
        // Distance: nearest first — they're hungry
        return (a.distanceKm || 999) - (b.distanceKm || 999);
      });
    } else if (cuisine === 'sports_bar' || sportsBarVibeActive) {
      // Sort by quality so amazing spots further away don't get sliced off
      // at the 40-item cutoff. Also fires on the Sports Bar VIBE chip so
      // famous Pasadena spots (Rocco's, Barney's, Lucky Baldwin's) survive.
      finalPlaces.sort((a, b) => {
        const qa = (a.rating || 0) * Math.log10(Math.max(a.userRatingCount || 1, 1));
        const qb = (b.rating || 0) * Math.log10(Math.max(b.userRatingCount || 1, 1));
        return qb - qa;
      });
    } else {
      // Default: sort by distance — nearest restaurants first
      finalPlaces.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    // ── DISH INTENT: drop Tier 4 noise ──────────────────────────────────────
    // The broad DISH nearby fan-out (restaurant / fast_food_restaurant /
    // meal_takeaway / bakery) intentionally pulls in generic foodservice
    // candidates so chains and bakeries that quietly serve the dish can land
    // as Tier 4 ("Serves It") via servesBreakfast / editorialSummary / menu OCR.
    // Anything left at Tier 5 carries no signal — drop it as true noise.

    // No slice — send ALL results to frontend so filters (bakery, sports bar, dietary)
    // have the full pool. Frontend already paginates with "Load More" (20 at a time).

    // Drop tier-5 "noise" only — keep tiers 1 ("Namesake"), 2 ("Specialist"),
    // 3 ("Related Cuisine"), and 4 ("Serves It") in results.
    if (intent.kind === 'DISH') {
      const before = finalPlaces.length;
      finalPlaces = finalPlaces.filter((p: any) => (p.tier || 5) <= 4);
      const dropped = before - finalPlaces.length;
      if (dropped > 0) console.log(`🚮 Dropped ${dropped} tier-5 noise places`);
    }

    // Stamp each result with its backend-computed rank so the frontend
    // can preserve the intent-aware order even if it re-sorts.
    const intentSorted = intent.kind !== 'GENERAL' && !!searchQuery?.trim();
    finalPlaces.forEach((p: any, i: number) => { p.backendRank = i + 1; });

    // ── DISH-FIRST PHOTO ORDERING + MENU OCR FOR TIER 4 ─────────────────────
    // For DISH queries, eager-label the first 20 visible cards' photos via the
    // /label-photos worker endpoint (Haiku 4.5 vision, 180-day KV cache). Then:
    //  - Reorder each place's photos so dish-matching shots come first.
    //  - Capture any menu-extracted dishes (`menuDishes`) on the place object
    //    so a re-classification could later promote a Tier 5 → Tier 4 hit.
    // Cards 21+ get labeled lazily by the frontend on Load More.
    if (intent.kind === 'DISH') {
      const dishLabelLower = (intent as any).label?.toString().toLowerCase() || '';
      const dishRawWords: string[] = (intent as any).rawWords || [];
      const matchers = [dishLabelLower, ...dishRawWords].filter(Boolean);
      const EAGER_PLACES = 20;
      const PHOTOS_PER_PLACE = 5;
      const eagerTargets = finalPlaces.slice(0, EAGER_PLACES);
      await Promise.all(eagerTargets.map(async (place: any) => {
        try {
          const allPhotos = place.photos || [];
          const photosToLabel = allPhotos.slice(0, PHOTOS_PER_PLACE)
            .filter((p: any) => (p?.name || typeof p === 'string'));
          if (photosToLabel.length === 0) return;
          const labelReq = await fetch(`${API_BASE_URL}/label-photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              placeId: place.id || place.placeId,
              photos: photosToLabel.map((p: any) => ({ name: p?.name || p }))
            }),
          });
          if (!labelReq.ok) return;
          const { labels, dishes } = await labelReq.json();
          // Store menu-extracted dishes on the place so Tier 4 reclassification
          // can use them. The frontend can also surface "menu mentions: ..." if needed.
          if (Array.isArray(dishes) && dishes.length) {
            place.menuDishes = dishes;
            // Upgrade Tier 5 → Tier 4 if any menu-extracted dish matches the search.
            if ((place.tier === 5 || place.tier == null) &&
                matchers.some(w => dishes.some((md: string) => md.includes(w)))) {
              place.tier = 4;
              place.tierLabel = TIER_LABELS[4];
            }
          }
          // Reorder ENTIRE photo array. Labeled photos matching the dish move
          // to front; unlabeled photos and non-matching labeled photos keep
          // their original relative order behind them.
          if (labels && Object.keys(labels).length) {
            const isMatch = (photoName: string) => {
              const tag = (labels[photoName] || '').toString().toLowerCase();
              return matchers.some(w => tag.includes(w));
            };
            const matchedFront: any[] = [];
            const rest: any[] = [];
            for (const ph of allPhotos) {
              const phName = ph?.name || ph;
              if (typeof phName === 'string' && isMatch(phName)) matchedFront.push(ph);
              else rest.push(ph);
            }
            if (matchedFront.length) place.photos = [...matchedFront, ...rest];
          }
          place.photosLabeled = true;
        } catch (_e) {
          // Best-effort — failure to label doesn't fail the whole search
        }
      }));
    }

    // ── HONEST FALLBACK INFO ────────────────────────────────────────────────
    // Count how many authentic (Tier 1/2) results we have.
    // If 0, the frontend shows a disclaimer: "No [X] restaurants found nearby"
    const tier1Count = finalPlaces.filter(p => p.tier === 1).length;
    const tier2Count = finalPlaces.filter(p => p.tier === 2).length;
    const allTier1 = processedPlaces
      .filter(p => p.tier === 1)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    const fallbackInfo = {
      needed: intent.kind !== 'GENERAL' && !!searchQuery?.trim() && (tier1Count + tier2Count) === 0,
      intentKind:  intent.kind,
      intentLabel: intent.kind === 'UMBRELLA' ? (intent as any).label
                 : intent.kind === 'DISH'     ? (intent as any).label
                 : null,
      tier1Count,
      tier2Count,
      nearestAuthenticName:          allTier1[0]?.name || null,
      nearestAuthenticDistanceMiles: allTier1[0] ? +(allTier1[0].distanceKm * 0.621371).toFixed(1) : null,
    };

    console.log(`✅ Returning ${finalPlaces.length} places | tier1:${tier1Count} tier2:${tier2Count} fallback:${fallbackInfo.needed}`);
    console.log("🍽️ === getRestaurants v5.1 END ===\n");

    return Response.json({
      places: finalPlaces,
      count:  finalPlaces.length,
      version: 'v5.2',
      intentSorted,
      fallbackInfo,
      // Auto-expand-on-sparse signal: lets the frontend display a small banner
      // ("Expanded to 20 mi — only 3 results within 10 mi") when results were
      // sparse and the backend widened the search.
      autoExpanded: autoExpandedFrom !== null,
      autoExpandedFrom,
      effectiveRadiusMiles,
    });

  } catch (error: any) {
    console.error("💥 ERROR:", error.message);
    return Response.json({ error: error.message, places: [] }, { status: 200 });
  }
});

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function detectBestTime(reviews: any[]): string | null {
  if (!reviews?.length) return null;
  const text = reviews.map(r => r.text || '').join(' ').toLowerCase();
  if (text.match(/\b(lunch|midday|noon)\b.*\b(quiet|empty|not crowded|easy|quick)\b/)) return 'Lunchtime or early';
  if (text.match(/\b(weekday|monday|tuesday|wednesday|thursday)\b.*\b(better|quiet|less crowded|easier)\b/)) return 'Weekday visit';
  if (text.match(/\b(weekend|saturday|sunday)\b.*\b(crowded|busy|wait|packed)\b/)) return 'Go on weekdays — busy weekends';
  if (text.match(/\b(evening|dinner|night)\b.*\b(best|great|romantic|recommend)\b/)) return 'Dinner time';
  if (text.match(/\b(early|open|first|11am|10am)\b.*\b(best|less|avoid|beat)\b/)) return 'Early — beats the rush';
  return null;
}