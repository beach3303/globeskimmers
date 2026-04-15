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
  // Exclude permanently or temporarily closed places (ghost restaurants)
  const status = (place.businessStatus || '').toUpperCase();
  if (status === 'CLOSED_PERMANENTLY' || status === 'CLOSED_TEMPORARILY') return false;
  // Exclude grocery stores, retail, pharmacies, etc.
  if (NON_FOOD_TYPES.has(primaryType)) return false;
  if (types.some(t => NON_FOOD_TYPES.has(t))) return false;
  // Must have at least one food/dining type
  return types.some(t => FOOD_TYPES.has(t) || t.includes('restaurant') || t.includes('cafe') || t.includes('bar') || t.includes('bakery')) ||
         FOOD_TYPES.has(primaryType) ||
         primaryType.includes('restaurant') ||
         primaryType.includes('cafe') ||
         primaryType.includes('bar');
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

// Dish → expected primaryTypes (Tier 1 = specialist, Tier 2 = close match)
// 80+ dishes mapped globally — covers Italian, Mexican, Japanese, Chinese, Korean,
// Vietnamese, Thai, Indian, Filipino, Middle Eastern, European, South American,
// Southeast Asian, African, and American dishes.
const DISH_MAP: Array<{ pattern: RegExp; tier1: string[]; tier2: string[]; label: string }> = [
  // ── Japanese ────────────────────────────────────────────────────────────────
  { pattern: /\bsushi\b/,                              tier1:['sushi_restaurant'],                                        tier2:['japanese_restaurant'],                            label:'sushi' },
  { pattern: /\bramen\b/,                              tier1:['ramen_restaurant'],                                        tier2:['japanese_restaurant'],                            label:'ramen' },
  { pattern: /\budon\b/,                               tier1:['japanese_restaurant'],                                     tier2:['noodle_restaurant'],                              label:'udon' },
  { pattern: /\btempura\b/,                            tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'tempura' },
  { pattern: /\bokonomiyaki\b/,                        tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'okonomiyaki' },
  { pattern: /\btonkatsu\b/,                           tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'tonkatsu' },
  { pattern: /\byakitori\b/,                           tier1:['japanese_restaurant'],                                     tier2:[],                                                 label:'yakitori' },
  { pattern: /\bshabu[\s-]*shabu\b|\bshabu\b/,         tier1:['japanese_restaurant'],                                     tier2:['korean_restaurant'],                              label:'shabu shabu' },
  { pattern: /\bhot\s*pot\b/,                          tier1:['chinese_restaurant','korean_restaurant'],                  tier2:['japanese_restaurant'],                            label:'hot pot' },
  // ── Chinese ─────────────────────────────────────────────────────────────────
  { pattern: /\bdim\s*sum\b|\bdimsum\b/,               tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'dim sum' },
  { pattern: /\bxiaolong\s*bao\b|\bsoup\s*dump\w+/,   tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'xiaolongbao' },
  { pattern: /\bmapo\s*tofu\b/,                        tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'mapo tofu' },
  { pattern: /\bpeking\s*duck\b|\bbeijing\s*duck\b/,  tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'Peking duck' },
  { pattern: /\bdumplings?\b|\bpotstickers?\b/,        tier1:['chinese_restaurant'],                                      tier2:['japanese_restaurant'],                            label:'dumplings' },
  { pattern: /\bdan\s*dan\b/,                          tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'dan dan noodles' },
  { pattern: /\bcongee\b|\bjook\b/,                    tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'congee' },
  { pattern: /\bchar\s*siu\b|\bbbq\s*pork\b/,          tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'char siu' },
  { pattern: /\bwonton\b/,                             tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'wonton' },
  { pattern: /\bchow\s*mein\b|\blo\s*mein\b/,         tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'chow mein' },
  { pattern: /\bfried\s*rice\b/,                       tier1:['chinese_restaurant','thai_restaurant'],                    tier2:['asian_restaurant'],                               label:'fried rice' },
  { pattern: /\bkung\s*pao\b/,                         tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'kung pao' },
  { pattern: /\bgeneral\s*tso\b|\borange\s*chicken\b/, tier1:['chinese_restaurant'],                                      tier2:[],                                                 label:'Chinese-American' },
  // ── Korean ──────────────────────────────────────────────────────────────────
  { pattern: /\bbibimbap\b/,                           tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'bibimbap' },
  { pattern: /\bbulgogi\b/,                            tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'bulgogi' },
  { pattern: /\bkorean\s*bbq\b|\bkbbq\b/,             tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'Korean BBQ' },
  { pattern: /\bjjigae\b|\bkimchi\s*stew\b/,           tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'jjigae' },
  { pattern: /\bbossam\b|\bsamgyeopsal\b/,             tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'Korean BBQ' },
  { pattern: /\btteokbokki\b/,                         tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'tteokbokki' },
  { pattern: /\bkimchi\b/,                             tier1:['korean_restaurant'],                                       tier2:[],                                                 label:'kimchi' },
  // ── Vietnamese ──────────────────────────────────────────────────────────────
  { pattern: /\bpho\b/,                                tier1:['vietnamese_restaurant'],                                   tier2:[],                                                 label:'pho' },
  { pattern: /\bbanh\s*mi\b/,                          tier1:['vietnamese_restaurant'],                                   tier2:[],                                                 label:'banh mi' },
  { pattern: /\bbun\s*cha\b/,                          tier1:['vietnamese_restaurant'],                                   tier2:[],                                                 label:'bun cha' },
  { pattern: /\bcuon\b|\bspring\s*rolls?\b/,           tier1:['vietnamese_restaurant'],                                   tier2:['asian_restaurant'],                               label:'spring rolls' },
  // ── Thai ────────────────────────────────────────────────────────────────────
  { pattern: /\bpad\s*thai\b/,                         tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'Pad Thai' },
  { pattern: /\bpad\s*see\s*ew\b|\bpad\s*kra\s*pao\b/, tier1:['thai_restaurant'],                                        tier2:[],                                                 label:'Thai noodles' },
  { pattern: /\bsom\s*tam\b|\bpapaya\s*salad\b/,       tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'som tam' },
  { pattern: /\btom\s*yum\b/,                          tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'tom yum' },
  { pattern: /\bgreen\s*curry\b|\bred\s*curry\b|\bmassaman\b|\bkhao\s*soi\b/, tier1:['thai_restaurant'],                  tier2:[],                                                 label:'Thai curry' },
  { pattern: /\bthai\s*iced\s*tea\b|\bthai\s*tea\b/,  tier1:['thai_restaurant'],                                         tier2:[],                                                 label:'Thai tea' },
  // ── Indian ──────────────────────────────────────────────────────────────────
  { pattern: /\bcurry\b/,                              tier1:['indian_restaurant'],                                       tier2:['thai_restaurant'],                                label:'curry' },
  { pattern: /\bbiryani\b/,                            tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'biryani' },
  { pattern: /\bdosa\b|\bmasala\s*dosa\b/,             tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'dosa' },
  { pattern: /\btandoori\b|\bbutter\s*chicken\b|\bmurgh\s*makhani\b/, tier1:['indian_restaurant'],                        tier2:[],                                                 label:'tandoori' },
  { pattern: /\btikka\s*masala\b/,                     tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'tikka masala' },
  { pattern: /\bpalak\s*paneer\b|\bsaag\b/,            tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'palak paneer' },
  { pattern: /\bsamosa\b/,                             tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'samosa' },
  { pattern: /\bchana\s*masala\b/,                     tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'chana masala' },
  { pattern: /\bvindaloo\b|\bkorma\b|\brogan\s*josh\b/, tier1:['indian_restaurant'],                                      tier2:[],                                                 label:'Indian curry' },
  { pattern: /\bnaan\b|\bgarlic\s*naan\b/,             tier1:['indian_restaurant'],                                       tier2:[],                                                 label:'naan' },
  // ── Filipino ────────────────────────────────────────────────────────────────
  { pattern: /\badobo\b/,                              tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'adobo' },
  { pattern: /\bsinigang\b/,                           tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'sinigang' },
  { pattern: /\blechon\b/,                             tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'lechon' },
  { pattern: /\bsisig\b/,                              tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'sisig' },
  { pattern: /\bkare[\s-]*kare\b/,                     tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'kare kare' },
  { pattern: /\blumpia\b/,                             tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'lumpia' },
  { pattern: /\bpancit\b/,                             tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'pancit' },
  { pattern: /\bhalo[\s-]*halo\b/,                     tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'halo halo' },
  { pattern: /\bbulalo\b/,                             tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'bulalo' },
  { pattern: /\bbicol\s*express\b|\blaing\b/,          tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'Bicolano' },
  { pattern: /\btapsilog\b|\bsilog\b|\blongganisa\b/,  tier1:['filipino_restaurant'],                                     tier2:[],                                                 label:'Filipino breakfast' },
  // ── Southeast Asian ─────────────────────────────────────────────────────────
  { pattern: /\blaksa\b/,                              tier1:['malaysian_restaurant','singaporean_restaurant'],           tier2:[],                                                 label:'laksa' },
  { pattern: /\bsatay\b/,                              tier1:['malaysian_restaurant','indonesian_restaurant'],            tier2:['thai_restaurant'],                                label:'satay' },
  { pattern: /\brendang\b/,                            tier1:['indonesian_restaurant','malaysian_restaurant'],            tier2:[],                                                 label:'rendang' },
  { pattern: /\bnasi\s*goreng\b/,                      tier1:['indonesian_restaurant','malaysian_restaurant'],            tier2:[],                                                 label:'nasi goreng' },
  // ── Middle Eastern ──────────────────────────────────────────────────────────
  { pattern: /\bshawarma\b/,                           tier1:['middle_eastern_restaurant','turkish_restaurant'],          tier2:[],                                                 label:'shawarma' },
  { pattern: /\bkebab\b|\bdoner\b/,                    tier1:['middle_eastern_restaurant','turkish_restaurant'],          tier2:[],                                                 label:'kebab' },
  { pattern: /\bfalafel\b/,                            tier1:['middle_eastern_restaurant','greek_restaurant'],            tier2:['mediterranean_restaurant'],                       label:'falafel' },
  { pattern: /\bhummus\b/,                             tier1:['middle_eastern_restaurant','mediterranean_restaurant'],    tier2:[],                                                 label:'hummus' },
  // ── European ────────────────────────────────────────────────────────────────
  { pattern: /\bpasta\b|\blasagna\b|\brigatoni\b|\bpenne\b|\bspaghetti\b|\bcarbonara\b|\bcacio\s*e\s*pepe\b/, tier1:['italian_restaurant'], tier2:['mediterranean_restaurant'],   label:'pasta' },
  { pattern: /\bpizza\b/,                              tier1:['pizza_restaurant'],                                        tier2:['italian_restaurant'],                             label:'pizza' },
  { pattern: /\bcroissant\b|\bpastries\b/,             tier1:['french_restaurant','bakery'],                              tier2:['cafe'],                                           label:'croissant' },
  { pattern: /\bschnitzel\b/,                          tier1:['german_restaurant'],                                       tier2:[],                                                 label:'schnitzel' },
  { pattern: /\bpaella\b/,                             tier1:['spanish_restaurant'],                                      tier2:[],                                                 label:'paella' },
  { pattern: /\btapas\b/,                              tier1:['spanish_restaurant','tapas_bar'],                          tier2:[],                                                 label:'tapas' },
  { pattern: /\bfish\s*and\s*chips\b/,                 tier1:['british_restaurant'],                                      tier2:['pub'],                                            label:'fish and chips' },
  { pattern: /\bgyro(s)?\b/,                           tier1:['greek_restaurant','mediterranean_restaurant'],             tier2:[],                                                 label:'gyros' },
  // ── South American ──────────────────────────────────────────────────────────
  { pattern: /\bceviche\b/,                            tier1:['peruvian_restaurant','latin_american_restaurant'],         tier2:['seafood_restaurant'],                             label:'ceviche' },
  { pattern: /\bempanadas?\b/,                         tier1:['latin_american_restaurant'],                               tier2:['mexican_restaurant'],                             label:'empanadas' },
  { pattern: /\barepas?\b/,                            tier1:['venezuelan_restaurant','latin_american_restaurant'],       tier2:[],                                                 label:'arepas' },
  { pattern: /\bchurrasco\b|\bbrazilian\s*bbq\b|\bbrazilian\s*steak\b/, tier1:['brazilian_restaurant','steak_house'],     tier2:[],                                                 label:'churrasco' },
  // ── African ─────────────────────────────────────────────────────────────────
  { pattern: /\binjera\b|\bethiopian\b/,               tier1:['ethiopian_restaurant'],                                    tier2:['african_restaurant'],                             label:'Ethiopian' },
  { pattern: /\bjollof\s*rice\b/,                      tier1:['nigerian_restaurant','west_african_restaurant'],           tier2:['african_restaurant'],                             label:'jollof rice' },
  { pattern: /\btagine\b|\bmoroccan\b/,                tier1:['moroccan_restaurant'],                                     tier2:['north_african_restaurant'],                       label:'tagine' },
  // ── American ────────────────────────────────────────────────────────────────
  { pattern: /\btaco(s)?\b|\bburrito(s)?\b|\bquesadilla\b/, tier1:['mexican_restaurant'],                                 tier2:['latin_american_restaurant'],                      label:'tacos' },
  { pattern: /\bburger(s)?\b|\bwhopper\b/,             tier1:['hamburger_restaurant'],                                    tier2:['american_restaurant','fast_food_restaurant'],     label:'burgers' },
  { pattern: /\bsteak\b/,                              tier1:['steak_house'],                                             tier2:['american_restaurant','brazilian_restaurant'],     label:'steak' },
  { pattern: /\bbbq\b|\bbarbeque\b|\bbarbecue\b/,      tier1:['barbecue_restaurant'],                                     tier2:['american_restaurant'],                            label:'BBQ' },
  { pattern: /\bwings\b|\bchicken\s*wings\b|\bbuffalo\s*wings\b/, tier1:['american_restaurant','sports_bar'],             tier2:['bar'],                                            label:'wings' },
  { pattern: /\bfried\s*chicken\b/,                    tier1:['american_restaurant','fast_food_restaurant'],              tier2:[],                                                 label:'fried chicken' },
  { pattern: /\blobster\s*roll\b|\bclam\s*chowder\b/,  tier1:['seafood_restaurant'],                                      tier2:['american_restaurant'],                            label:'seafood' },
  { pattern: /\bgumbo\b|\bpo[\s-]*boy\b/,              tier1:['cajun_restaurant','southern_restaurant'],                   tier2:['american_restaurant'],                            label:'Cajun' },
  { pattern: /\bpancakes?\b|\bwaffles?\b/,             tier1:['breakfast_restaurant'],                                    tier2:['american_restaurant','diner'],                    label:'pancakes' },
  { pattern: /\bbagels?\b/,                            tier1:['bagel_shop'],                                              tier2:['deli','bakery'],                                  label:'bagels' },
  { pattern: /\bmac\s*and\s*cheese\b|\bmac\s*n\s*cheese\b/, tier1:['american_restaurant'],                                tier2:['soul_food_restaurant'],                           label:'mac and cheese' },
  { pattern: /\bpoke\b|\bpoke\s*bowl\b/,               tier1:['hawaiian_restaurant'],                                     tier2:['japanese_restaurant'],                            label:'poke' },
];

type ParsedIntent =
  | { kind: 'UMBRELLA'; cultureKey: string; label: string; types: Set<string>; keywords: string[] }
  | { kind: 'DISH'; label: string; tier1Types: string[]; tier2Types: string[] }
  | { kind: 'GENERAL' };

function parseSearchIntent(query: string): ParsedIntent {
  if (!query?.trim()) return { kind: 'GENERAL' };
  const q = query.toLowerCase();
  // Cultural umbrella terms (user culturally expects East/SE Asian, NOT Indian)
  if (/\basian\b/.test(q))             return { kind:'UMBRELLA', cultureKey:'asian',         ...CULTURAL_INTENTS.asian };
  if (/\blatin\b|\blatino\b/.test(q))  return { kind:'UMBRELLA', cultureKey:'latin',         ...CULTURAL_INTENTS.latin };
  if (/\bmediterranean\b/.test(q))     return { kind:'UMBRELLA', cultureKey:'mediterranean', ...CULTURAL_INTENTS.mediterranean };
  if (/\beuropean\b/.test(q))          return { kind:'UMBRELLA', cultureKey:'european',      ...CULTURAL_INTENTS.european };
  // Specific dishes
  for (const entry of DISH_MAP) {
    if (entry.pattern.test(q)) return { kind:'DISH', label:entry.label, tier1Types:entry.tier1, tier2Types:entry.tier2 };
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
    if (intent.tier1Types.some(t => types.has(t))) return 1;
    if (intent.tier2Types.some(t => types.has(t))) return 2;
    const dish = intent.label.toLowerCase();
    if (name.includes(dish) || reviewText.includes(dish)) return 3;
    return 4;
  }
  return 1;
}

const TIER_LABELS: Record<number, string> = { 1:'Authentic', 2:'Good Match', 3:'Has It', 4:'Other' };

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
    } = body;

    // Map filterMaxPrice → Google priceLevels array
    const PRICE_LEVEL_NAMES = [
      'PRICE_LEVEL_FREE',
      'PRICE_LEVEL_INEXPENSIVE',
      'PRICE_LEVEL_MODERATE',
      'PRICE_LEVEL_EXPENSIVE',
      'PRICE_LEVEL_VERY_EXPENSIVE',
    ];
    const priceLevels: string[] = filterMaxPrice > 0
      ? PRICE_LEVEL_NAMES.slice(0, filterMaxPrice + 1)
      : [];

    if (!latitude || !longitude) {
      return Response.json({ error: "Latitude and longitude required", places: [] }, { status: 400 });
    }

    // ── IMPORTANT: Worker POST / expects radiusMiles, not meters ──────────────
    // PlacesToEat.jsx sends `radius: radius * 1609` (meters), so convert back.
    const radiusMiles = Math.round(radius / 1609.34);  // Clean integer for Worker cache key

    console.log("📋 Request:", { latitude, longitude, radius, radiusMiles: radiusMiles.toFixed(1), cuisine, searchQuery, forceRefresh });

    // Parse search intent for tiering + honest fallbacks
    const intent = parseSearchIntent(searchQuery);
    console.log(`🧠 Intent: ${intent.kind}${intent.kind !== 'GENERAL' ? ` (${(intent as any).label})` : ''}`);

    // ── DIETARY SHORTCUT ──────────────────────────────────────────────────────
    // Note: glutenFree included so the text-search shortcut fires for it too.
    const DIETARY_TYPES = ['halal', 'kosher', 'vegan', 'vegetarian', 'glutenFree'];
    if (!searchQuery?.trim() && DIETARY_TYPES.includes(cuisine)) {
      console.log(`🥗 Dietary shortcut: calling /places/dietary?dietary=${cuisine}`);
      try {
        const params = new URLSearchParams({
          latitude:   String(latitude),
          longitude:  String(longitude),
          radius:     String(radius),
          maxResults: String(maxResults),
          dietary:    cuisine,
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
            const tagged = places.map((p: any) => ({ ...p, dietary: { ...(p.dietary || {}), [cuisine]: true } }));
            return Response.json({ places: tagged, count: tagged.length, version: 'v4.3', dietary: cuisine });
          }
          console.warn(`⚠️ /places/dietary returned 0 — falling back to text search`);
        }
      } catch (e: any) {
        console.error(`/places/dietary error: ${e.message} — falling back`);
      }
    }

    // Append "restaurant" to ALL search queries so Google returns restaurants,
    // not grocery stores or recipe sites. Works for dishes ("pasta restaurant"),
    // dietary ("kosher restaurant", "halal restaurant"), and cuisines ("thai restaurant").
    // Skip appending if user already typed a venue word.
    const rawQuery = searchQuery?.trim() || '';
    const skipAppend = /restaurant|food|near me|cafe|bar|bakery|shop|grill|diner|bistro/i.test(rawQuery);
    const enhancedQuery = rawQuery && !skipAppend
      ? `${rawQuery} restaurant`
      : rawQuery;
    const queries: string[] = enhancedQuery
      ? [enhancedQuery]
      : (CUISINE_QUERIES[cuisine] || CUISINE_QUERIES.all);

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
      italian:       ['italian_restaurant', 'pizza_restaurant'],
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

    const nearbyTypeList = searchQuery?.trim()
      ? []  // skip nearby when user typed a search — text query IS the intent
      : cuisine === 'all'
        ? NEARBY_TYPES_ALL
        : (NEARBY_TYPES_CUISINE[cuisine] || ['restaurant']);

    // Sports bar nearby ranking strategy:
    // POPULARITY — surfaces well-known sports bars like Rocco's Tavern, Lucky Baldwin's,
    //   Barney's Beanery even when they're 10-15mi away (Pasadena, not Arcadia local).
    //   Without POPULARITY, DISTANCE fills all 20 slots with the closest dive bars first,
    //   leaving out the famous game-day spots in Pasadena that users actually want.
    // DISTANCE — correct for all food cuisines: nearest restaurants always most useful.
    // POPULARITY for sports_bar and bakery — DISTANCE fills 20 slots with closest,
    // missing famous/popular spots further away. POPULARITY surfaces the best ones
    // across the full radius. All other cuisines use DISTANCE (nearest first).
    // Bakery uses DISTANCE (nearest outward) like normal food — POPULARITY was starving close results
    const nearbyRankBy = cuisine === 'sports_bar' ? 'POPULARITY' : 'DISTANCE';

    const nearbyPromise = Promise.allSettled(
      nearbyTypeList.map(async (type) => {
        try {
          const params = new URLSearchParams({
            type,
            latitude:   String(latitude),
            longitude:  String(longitude),
            radius:     String(Math.min(radius, 50000)),
            maxResults: '20',
            rankBy:     nearbyRankBy,
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

    // Compute includedType for server-side narrowing at Google. Use it only when
    // user hasn't typed a search query (their text intent should win) and the
    // cuisine maps to exactly one Google Place type.
    const cuisineTypeList = NEARBY_TYPES_CUISINE[cuisine];
    const serverIncludedType = (!rawQuery && cuisine !== 'all' && cuisineTypeList?.length)
      ? cuisineTypeList[0]
      : '';

    for (const query of queries) {
      try {
        console.log(`📡 POST /  query: "${query}" radiusMiles: ${radiusMiles.toFixed(1)}${serverIncludedType ? ` includedType: ${serverIncludedType}` : ''}`);

        const response = await fetch(`${API_BASE_URL}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude,
            longitude,
            query,
            radiusMiles,
            dietary: {},
            // v5.0: server-side filters — Google filters at source, not client-side
            openNow:     filterOpenNow  || false,
            minRating:   filterMinRating > 0 ? filterMinRating : 0,
            priceLevels: priceLevels.length ? priceLevels : [],
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
              radius:     String(radius),
              maxResults: '20',
              cacheTtl:   String(60 * 60 * 2), // 2hr fallback TTL
              ...(forceRefresh ? { forceRefresh: 'true' } : {}),
            });
            const fbRes = await fetch(`${API_BASE_URL}/places/text-search?${params}`);
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              for (const place of fbData.places || []) {
                const pid = place.id || place.placeId;
                if (pid && !seenPlaceIds.has(pid)) { seenPlaceIds.add(pid); allPlaces.push(place); }
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
          if (pid && !seenPlaceIds.has(pid)) {
            seenPlaceIds.add(pid);
            allPlaces.push(place);
          }
        }

      } catch (err: any) {
        console.error(`Error for "${query}":`, err.message);
        errors.push(`"${query}": ${err.message}`);
      }
    }

    // Wait for all parallel nearby searches to finish
    await nearbyPromise;

    console.log(`📊 Total unique after all searches: ${allPlaces.length}`);
    if (errors.length) console.error("⚠️ Errors:", errors);

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
    }).filter(p => p.distanceMiles <= radiusMiles + 1); // +1 mi buffer for GPS inaccuracy

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
        return types.includes('kosher_restaurant') || /\bkosher\b/.test(text);
      if (cuisine === 'vegan')
        return types.includes('vegan_restaurant') || /\bvegan\b/.test(text);
      if (cuisine === 'vegetarian')
        return place.servesVegetarianFood === true || types.includes('vegetarian_restaurant') || /\bvegetarian\b/.test(text);
      if (cuisine === 'glutenFree')
        return /\bgluten[\s-]?free\b|\bceliac\b|\bgf\s+menu\b/.test(text);
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
        if (/\bhechsher\b|\bmashgiach\b/.test(text)) score += 10;
      }
      score += (place.rating || 0) * 5;
      score += Math.min(place.userRatingCount || 0, 500) / 25;
      score -= (place.distanceKm || 0);
      return score;
    }

    const DIETARY_FILTER_TYPES = ['halal', 'kosher', 'vegan', 'vegetarian', 'glutenFree'];
    let finalPlaces = processedPlaces;

    if (!searchQuery?.trim() && DIETARY_FILTER_TYPES.includes(cuisine)) {
      finalPlaces = processedPlaces.filter(p => hasStrongDietaryMatch(p, cuisine));
      finalPlaces.sort((a, b) => dietaryScore(b, cuisine) - dietaryScore(a, cuisine));
      // Backend authoritatively matched these to the dietary filter — tag so
      // the frontend trusts them instead of re-filtering with stricter client logic.
      finalPlaces.forEach((p: any) => { p.dietary = { ...(p.dietary || {}), [cuisine]: true }; });
    } else if (intent.kind !== 'GENERAL' && searchQuery?.trim()) {
      // "pasta"      → user is hungry, wants nearby → tier first, then DISTANCE
      // "best pasta" → user will drive for quality  → tier first, then QUALITY
      const wantsBest = /\bbest\b/i.test(searchQuery);
      finalPlaces.sort((a, b) => {
        if ((a.tier || 4) !== (b.tier || 4)) return (a.tier || 4) - (b.tier || 4);
        if (wantsBest) {
          // Quality: rating × log(reviewCount) — highest quality first
          const qa = (a.rating || 0) * Math.log10(Math.max(a.userRatingCount || 1, 1));
          const qb = (b.rating || 0) * Math.log10(Math.max(b.userRatingCount || 1, 1));
          return qb - qa;
        }
        // Distance: nearest first — they're hungry
        return (a.distanceKm || 999) - (b.distanceKm || 999);
      });
    } else if (cuisine === 'sports_bar') {
      // Sort by quality so amazing spots further away don't get sliced off at the 40-item cutoff
      finalPlaces.sort((a, b) => {
        const qa = (a.rating || 0) * Math.log10(Math.max(a.userRatingCount || 1, 1));
        const qb = (b.rating || 0) * Math.log10(Math.max(b.userRatingCount || 1, 1));
        return qb - qa;
      });
    } else {
      // Default: sort by distance — nearest restaurants first
      finalPlaces.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    // No slice — send ALL results to frontend so filters (bakery, sports bar, dietary)
    // have the full pool. Frontend already paginates with "Load More" (20 at a time).

    // Stamp each result with its backend-computed rank so the frontend
    // can preserve the intent-aware order even if it re-sorts.
    const intentSorted = intent.kind !== 'GENERAL' && !!searchQuery?.trim();
    finalPlaces.forEach((p: any, i: number) => { p.backendRank = i + 1; });

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