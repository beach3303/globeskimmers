/**
 * nameAnalyzer.js — pure client-side utilities for deciding whether a
 * business name needs the language-help buttons (Pronounce / Translate).
 *
 * Both functions are free (no API calls). Run on every card render.
 *
 *   hasNonLatinScript(name)
 *     → true if name contains CJK / Arabic / Cyrillic / Hebrew / Thai /
 *       Devanagari / Korean / etc.  False for plain ASCII / Latin-1 names.
 *
 *   looksEnglish(name)
 *     → heuristic for Latin-script names: true if the name is recognizably
 *       English (Joe's Pizza, Starbucks, Marriott Hotel). False if it's
 *       Latin-script but in another language (Trattoria della Nonna,
 *       Au Bon Pain). Imperfect but biased toward "show the Translate
 *       button when in doubt" — worst case is an extra button the user
 *       can ignore.
 *
 * Used by <NameLanguageHelp> to decide what to render:
 *   - hasNonLatin                  → both Pronounce + Translate buttons
 *   - !hasNonLatin && !looksEnglish → Translate only
 *   - !hasNonLatin && looksEnglish  → no buttons
 */

// Unicode ranges that are NOT plain Latin. If any character falls in
// these ranges, the name needs romanization help.
// Covers: CJK (Chinese/Japanese/Korean), Hiragana, Katakana, Arabic,
// Hebrew, Cyrillic, Greek, Devanagari, Thai, Lao, Khmer, Tamil, Bengali,
// Tibetan, Burmese, Georgian, Armenian, Ethiopic, and a few more.
const NON_LATIN_REGEX = /[Ͱ-ԯ԰-֏֐-׿؀-ۿ܀-ݏހ-޿ऀ-ॿঀ-৿਀-੿઀-૿଀-୿஀-௿ఀ-౿ಀ-೿ഀ-ൿ඀-෿฀-๿຀-໿ༀ-࿿က-႟Ⴀ-ჿᄀ-ᇿሀ-፿ᎀ-᎟Ꭰ-᏿぀-ゟ゠-ヿ㐀-䶿一-鿿ꥠ-꥿가-힯豈-﫿]|[\uD800-\uDBFF][\uDC00-\uDFFF]/;

export function hasNonLatinScript(text) {
  if (!text || typeof text !== 'string') return false;
  return NON_LATIN_REGEX.test(text);
}

// Common English business words. Presence of any one of these strongly
// suggests the name is English. List is intentionally common-only — exotic
// English words ("Patisserie") that overlap with French/Italian usage are
// excluded so they correctly trigger Translate.
const ENGLISH_BUSINESS_WORDS = new Set([
  'pizza', 'pizzeria', 'restaurant', 'cafe', 'coffee', 'tea',
  'bar', 'pub', 'tavern', 'inn', 'lounge', 'grill', 'kitchen',
  'bakery', 'diner', 'bistro', 'eatery', 'house', 'place',
  'shop', 'store', 'market', 'mart', 'deli', 'club', 'food',
  'foods', 'co', 'co.', 'company', 'ltd', 'ltd.', 'llc',
  'hotel', 'motel', 'resort', 'spa', 'gallery', 'museum',
  'park', 'garden', 'gardens', 'plaza', 'mall', 'center',
  'centre', 'station', 'studio', 'salon', 'clinic',
  'pharmacy', 'drug', 'drugs', 'dental', 'medical',
  'auto', 'gas', 'fuel', 'parking', 'rental', 'rentals',
  'bank', 'credit', 'union', 'atm', 'exchange',
  'fitness', 'gym', 'yoga', 'studio', 'school', 'academy',
  'church', 'temple', 'shrine',
  'sushi', 'ramen', 'taco', 'tacos', 'burger', 'burgers',
  'sandwich', 'sandwiches', 'wings', 'chicken', 'bbq',
  'seafood', 'steakhouse', 'steak', 'noodle', 'noodles',
  'donut', 'donuts', 'bagel', 'bagels', 'creamery',
  'ice', 'cream', 'yogurt', 'froyo', 'gelato',
  // Generic English glue words — strong English-language signal
  'the', 'and', 'of', 'at', 'on', 'in', 'for', 'with',
  'a', 'an', 'all', 'best', 'new', 'old', 'great',
  'super', 'mega', 'mini', 'big', 'small',
  // Common American/British place name elements
  'street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd',
  'corner', 'central', 'north', 'south', 'east', 'west',
  'downtown', 'uptown',
]);

// Possessive pattern — "Joe's Pizza", "Mary's Cafe", "Sam & Dave's"
const POSSESSIVE_PATTERN = /\b[A-Z][a-z]+'s\b/;

// Common English business chain brand names (subset — adds confidence).
const ENGLISH_BRANDS = new Set([
  'starbucks', 'mcdonalds', "mcdonald's", 'subway', 'kfc', 'burger king',
  'wendys', "wendy's", 'taco bell', 'pizza hut', 'dominos', "domino's",
  'dunkin', "dunkin'", 'chipotle', 'panera', 'chick-fil-a', 'chick fil a',
  'walmart', 'target', 'cvs', 'walgreens', 'kroger', 'whole foods',
  '7-eleven', '7 eleven', 'seven eleven', 'circle k',
  'marriott', 'hilton', 'hyatt', 'holiday inn', 'best western',
  'blue bottle', 'peet', "peet's", 'philz', 'verve', 'intelligentsia',
  'stumptown', 'la colombe', 'caribou', 'coffee bean',
  'yogurtland', 'pinkberry', 'menchies', "menchie's", 'tcby',
  'in-n-out', 'in n out', 'shake shack', 'five guys', 'whataburger',
  'denny', "denny's", 'ihop', 'dennys',
]);

export function looksEnglish(text) {
  if (!text || typeof text !== 'string') return true; // empty = no buttons
  if (hasNonLatinScript(text)) return false;

  const lower = text.toLowerCase().trim();
  if (!lower) return true;

  // Brand match — high-confidence English
  for (const brand of ENGLISH_BRANDS) {
    if (lower.includes(brand)) return true;
  }

  // Possessive pattern — "Joe's Pizza"
  if (POSSESSIVE_PATTERN.test(text)) return true;

  // Tokenize on whitespace + punctuation. Strip diacritics-free.
  const tokens = lower
    .replace(/[.,'`"!?()/\\&-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return true;

  // Count tokens that are recognized English. If ≥50% recognized, call it English.
  // Numbers (1, 2, 75) count as neutral — don't push either way.
  let recognized = 0;
  let countable = 0;
  for (const t of tokens) {
    if (/^\d+$/.test(t)) continue; // skip pure numbers
    countable++;
    if (ENGLISH_BUSINESS_WORDS.has(t)) recognized++;
  }

  if (countable === 0) return true; // all numbers / no real words
  return recognized / countable >= 0.5;
}
