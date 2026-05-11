/**
 * ============================================================================
 * GLOBESKIMMERS - getRestroomLocations v4.0 (INTELLIGENCE UPGRADE)
 * ============================================================================
 *
 * CACHING STRATEGY (cost-saving, production-safe):
 * - Search results: 3 days (restrooms/addresses don't change often)
 * - Photos: 90 days (handled by Worker)
 * - Details: 15 days (handled by Worker)
 * - Cache key includes lat/lng rounded to ~100m, so nearby users share cache
 * - Worker KV binding: PLACES_CACHE
 *
 * NEW in v4.0 (ChatGPT + Maiza recommendations):
 * 1. accessType: free | customers_only | fee_required | ticketed_entry | unknown
 * 2. restroomLikelihood: confirmed | likely | possible | weak
 * 3. reachability: easy | moderate | difficult | unknown
 * 4. confidenceLabel: high | medium | low
 * 5. smartNote: one short traveler-focused note per card
 * 6. Better venue classification (Coffee Bean, Whole Foods fixed)
 * 7. Squat toilet ONLY shown where actually common (not US/CA/GB/AU/NZ)
 * 8. "Pay Toilet" renamed to "Fee Required" (only for true cash-pay countries)
 * 9. "Customers Only" for purchase-required businesses
 * 10. Country tip removed from individual cards (header only)
 * 11. Coffee shop/cafe discovery added
 * 12. Subway/metro/transit expanded
 * 13. Elderly accessibility: stairs/elevator detection
 * 14. Museum/theme park/school/bank/convenience store coverage
 * 15. Global restroom terminology expanded
 * 16. Better confidence scoring
 * 17. UI-ready payload shape
 *
 * ============================================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const API_BASE_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

// ─── COUNTRY DATA WITH ACCESS EXPECTATIONS ────────────────────────────────
const COUNTRY_DATA: Record<string, {
  terms: string[];
  tip: string;
  expectSquat?: boolean;
  expectBidet?: boolean;
  expectPaper?: boolean;
  hasPaidPublicToilets?: boolean;
  currency?: string;
  typicalFee?: string;
}> = {
  // North America — NO paid public toilets, NO squat
  US: { terms:['restroom','bathroom','washroom','toilet'], tip:'Hotel lobbies, Starbucks, Target, and libraries are reliable free options.', expectPaper:true, hasPaidPublicToilets:false },
  CA: { terms:['washroom','restroom','bathroom','toilet'], tip:'Tim Hortons, libraries, and shopping centers are reliable.', expectPaper:true, hasPaidPublicToilets:false },
  MX: { terms:['baño','sanitario','WC'], tip:'Tip 5–10 MXN to attendant. Carry tissue.', expectPaper:false, hasPaidPublicToilets:true, currency:'MXN', typicalFee:'5–10 MXN' },

  // Western Europe — Some have paid toilets
  GB: { terms:['toilet','loo','WC','lavatory'], tip:'Train stations may charge £0.30–0.50.', expectPaper:true, hasPaidPublicToilets:true, currency:'GBP', typicalFee:'£0.30–0.50' },
  FR: { terms:['toilettes','WC'], tip:'Cafés may require purchase. Stations charge €0.50–1.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50–1' },
  DE: { terms:['Toilette','WC','Klo'], tip:'Sanifair stations charge €0.50–1.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50–1' },
  IT: { terms:['bagno','toilette','WC'], tip:'Bars require purchase. Carry €0.50.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50–1' },
  ES: { terms:['baño','aseo','servicio','WC'], tip:'Bars free with purchase.', expectPaper:true, hasPaidPublicToilets:false },
  NL: { terms:['toilet','WC'], tip:'Often €0.50 fee.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50' },
  CH: { terms:['Toilette','WC'], tip:'Stations charge CHF 1–2.', expectPaper:true, hasPaidPublicToilets:true, currency:'CHF', typicalFee:'CHF 1–2' },
  AT: { terms:['Toilette','WC'], tip:'Cafés free with purchase.', expectPaper:true, hasPaidPublicToilets:false },
  BE: { terms:['toilet','WC'], tip:'Often €0.50.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50' },
  PT: { terms:['casa de banho','WC'], tip:'May charge €0.30–0.50.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.30–0.50' },
  SE: { terms:['toalett','WC'], tip:'Card payment common.', expectPaper:true, hasPaidPublicToilets:false },
  NO: { terms:['toalett','WC'], tip:'Card payment standard.', expectPaper:true, hasPaidPublicToilets:false },
  DK: { terms:['toilet','WC'], tip:'Some charge DKK 5.', expectPaper:true, hasPaidPublicToilets:true },
  FI: { terms:['WC','vessa'], tip:'Malls and libraries free.', expectPaper:true, hasPaidPublicToilets:false },

  // Eastern Europe — Many have paid toilets
  PL: { terms:['toaleta','WC'], tip:'Often PLN 1–2.', expectPaper:true, hasPaidPublicToilets:true, currency:'PLN', typicalFee:'PLN 1–2' },
  CZ: { terms:['toaleta','WC'], tip:'Usually CZK 10–20.', expectPaper:true, hasPaidPublicToilets:true, currency:'CZK', typicalFee:'CZK 10–20' },
  HU: { terms:['WC','mosdó'], tip:'HUF 100–200 typical.', expectPaper:true, hasPaidPublicToilets:true, currency:'HUF', typicalFee:'HUF 100–200' },
  RO: { terms:['toaletă','WC'], tip:'Often RON 1–2.', expectPaper:true, hasPaidPublicToilets:true, currency:'RON', typicalFee:'RON 1–2' },
  HR: { terms:['zahod','WC'], tip:'€0.30–0.50 in tourist areas.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.30–0.50' },
  GR: { terms:['τουαλέτα','WC'], tip:'Don\'t flush paper.', expectPaper:false, hasPaidPublicToilets:false },
  TR: { terms:['tuvalet','WC'], tip:'Mosques free. Charge TRY 2–5 elsewhere.', expectSquat:true, expectBidet:true, expectPaper:false, hasPaidPublicToilets:true, currency:'TRY', typicalFee:'TRY 2–5' },
  RU: { terms:['туалет','WC'], tip:'Metro RUB 30–50. Bring tissue.', expectPaper:false, hasPaidPublicToilets:true, currency:'RUB', typicalFee:'RUB 30–50' },

  // Middle East — Bidet common, squat possible
  AE: { terms:['toilet','restroom','مرحاض'], tip:'Malls excellent. Water hose standard.', expectBidet:true, expectPaper:false, hasPaidPublicToilets:false },
  SA: { terms:['دورة مياه','toilet'], tip:'Mosques have facilities.', expectBidet:true, expectSquat:true, expectPaper:false, hasPaidPublicToilets:false },
  IL: { terms:['שירותים','toilet'], tip:'Malls and hotels reliable.', expectPaper:true, hasPaidPublicToilets:false },

  // East Asia
  JP: { terms:['トイレ','お手洗い','toilet'], tip:'Extremely clean. Konbini always have toilets.', expectBidet:true, expectPaper:true, hasPaidPublicToilets:false },
  KR: { terms:['화장실','toilet'], tip:'Very clean. Subway stations free.', expectBidet:true, expectPaper:true, hasPaidPublicToilets:false },
  CN: { terms:['厕所','卫生间','toilet'], tip:'Carry tissue. Squat common in older areas.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:false },
  TW: { terms:['廁所','toilet'], tip:'7-Eleven has toilets. Don\'t flush paper.', expectPaper:false, hasPaidPublicToilets:false },
  HK: { terms:['廁所','toilet'], tip:'MTR stations have facilities.', expectPaper:true, hasPaidPublicToilets:false },

  // Southeast Asia — Squat common, fees common
  PH: { terms:['CR','comfort room','toilet'], tip:'Look for "CR" signs. Malls excellent.', expectPaper:false, hasPaidPublicToilets:true, currency:'PHP', typicalFee:'₱5–10' },
  TH: { terms:['ห้องน้ำ','toilet'], tip:'Squat common. THB 3–5 in some places.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:true, currency:'THB', typicalFee:'THB 3–5' },
  VN: { terms:['nhà vệ sinh','toilet'], tip:'Carry tissue. 2,000–5,000 VND.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:true, currency:'VND', typicalFee:'2,000–5,000 VND' },
  ID: { terms:['toilet','kamar mandi'], tip:'IDR 2,000–5,000. Water hose standard.', expectBidet:true, hasPaidPublicToilets:true, currency:'IDR', typicalFee:'IDR 2,000–5,000' },
  MY: { terms:['tandas','toilet'], tip:'Malls free. Carry tissue elsewhere.', expectPaper:false, hasPaidPublicToilets:false },
  SG: { terms:['toilet','restroom'], tip:'Extremely clean. Hawker centers have facilities.', expectPaper:true, hasPaidPublicToilets:false },

  // South Asia — Squat common, fees common
  IN: { terms:['toilet','शौचालय'], tip:'Sulabh toilets ₹5–10. Squat common.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:true, currency:'INR', typicalFee:'₹5–10' },
  PK: { terms:['toilet','bathroom'], tip:'Mosques have facilities.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:false },

  // Oceania — NO paid toilets, NO squat
  AU: { terms:['toilet','loo','bathroom'], tip:'Many free public toilets.', expectPaper:true, hasPaidPublicToilets:false },
  NZ: { terms:['toilet','loo'], tip:'Generally free and clean.', expectPaper:true, hasPaidPublicToilets:false },

  // Africa
  ZA: { terms:['toilet','bathroom'], tip:'Malls reliable. R2–5 in some places.', expectPaper:true, hasPaidPublicToilets:true, currency:'ZAR', typicalFee:'R2–5' },
  EG: { terms:['حمام','toilet'], tip:'Tourist sites LE 5–10. Mosques free.', expectPaper:false, hasPaidPublicToilets:true, currency:'EGP', typicalFee:'LE 5–10' },
  KE: { terms:['toilet','choo'], tip:'KES 10–30 in public.', expectPaper:false, hasPaidPublicToilets:true, currency:'KES', typicalFee:'KES 10–30' },

  // South America
  BR: { terms:['banheiro','toalete'], tip:'Shopping centers free.', expectPaper:true, hasPaidPublicToilets:false },
  AR: { terms:['baño','sanitario'], tip:'Malls reliable.', expectPaper:true, hasPaidPublicToilets:false },
  PE: { terms:['baño','servicios higiénicos'], tip:'S/.0.50–1 in some places.', hasPaidPublicToilets:true, currency:'PEN', typicalFee:'S/.0.50–1' },
};

// ─── EXPANDED VENUE QUERIES (ChatGPT #11) ──────────────────────────────────
const VENUE_QUERIES: Record<string, string[]> = {
  all: [
    'public restroom', 'public toilet', 'bathroom',
    'coffee shop', 'cafe', 'starbucks', 'coffee bean',
    'shopping mall', 'grocery store', 'supermarket',
    'gas station', 'convenience store',
    'hotel lobby', 'hospital', 'library',
    'subway station', 'train station', 'airport',
    'restaurant', 'fast food',
  ],
  public: [
    'public restroom', 'public toilet', 'comfort station',
    'park bathroom', 'beach restroom', 'rest stop',
  ],
  transit: [
    'subway station', 'metro station', 'train station',
    'bus terminal', 'airport terminal', 'ferry terminal',
    'rail station', 'transit center',
  ],
  coffee_food: [
    'coffee shop', 'cafe', 'starbucks', 'coffee bean', 'peets coffee',
    'dutch bros', 'tea house', 'bakery', 'restaurant', 'fast food',
    'food court', 'diner',
  ],
  shopping: [
    'shopping mall', 'department store', 'target', 'walmart', 'costco',
    'grocery store', 'supermarket', 'whole foods', 'trader joes',
    'marshalls', 'tj maxx', 'ross', 'nordstrom',
  ],
  medical: [
    'hospital', 'clinic', 'medical center', 'urgent care',
  ],
  hospitality: [
    'hotel lobby', 'resort', 'casino', 'conference center',
  ],
  attractions: [
    'museum', 'zoo', 'aquarium', 'theme park', 'tourist attraction',
    'stadium', 'arena', 'gallery',
  ],
  institutions: [
    'library', 'bank', 'university', 'school', 'government building',
    'post office', 'community center',
  ],
  fuel: [
    'gas station', 'petrol station', 'truck stop', 'service plaza',
    'convenience store', '7-eleven', 'ampm', 'circle k',
  ],
  outdoor: [
    'park restroom', 'trail', 'campground', 'beach', 'recreation area',
  ],
};

// ─── PROPERTY SIGNALS ──────────────────────────────────────────────────────
const PROPERTY_SIGNALS = {
  free: ['free','no charge','complimentary','free to use'],
  paid: ['paid','charge','fee','coin','token','costs'],
  clean: ['clean','spotless','well maintained','sanitary','hygienic','very clean'],
  dirty: ['dirty','filthy','disgusting','gross','unclean','smells'],
  squat: ['squat toilet','squat style','floor toilet','hole in floor'],
  bidet: ['bidet','washlet','water spray','shower toilet','hose','shattaf'],
  accessible: ['accessible','wheelchair','disabled','ada','handicap','ramp'],
  family: ['family','baby changing','changing table','infant'],
  paper: ['toilet paper','tissue','paper provided'],
  noPaper: ['no paper','bring tissue','no toilet paper'],
  purchaseRequired: ['customers only','purchase required','buy something','patrons only'],
  locked: ['locked','key required','code required','ask staff'],
  stairs: ['stairs','downstairs','upstairs','basement','second floor','lower level'],
  elevator: ['elevator','lift','escalator'],
  open24: ['24 hour','24/7','always open','open all night'],
};

// Countries where squat toilets should NOT be shown (even if detected)
const NO_SQUAT_COUNTRIES = ['US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI'];

// Countries with actual cash-pay public toilets
const FEE_REQUIRED_COUNTRIES = ['CH', 'DE', 'NL', 'PL', 'CZ', 'HU', 'PH', 'TH', 'VN', 'IN', 'ID', 'EG', 'KE', 'ZA', 'MX', 'PE', 'TR', 'RU', 'GB', 'FR', 'IT', 'BE', 'PT', 'HR', 'RO', 'DK'];

// ─── COORDINATE → COUNTRY CODE ─────────────────────────────────────────────
function detectCountry(lat: number, lng: number): string {
  if (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) return 'US';
  if (lat >= 42 && lat <= 83 && lng >= -141 && lng <= -52) return 'CA';
  if (lat >= 49 && lat <= 61 && lng >= -10 && lng <= 2)   return 'GB';
  if (lat >= 41 && lat <= 51 && lng >= -5 && lng <= 10)   return 'FR';
  if (lat >= 47 && lat <= 55 && lng >= 6 && lng <= 15)    return 'DE';
  if (lat >= 36 && lat <= 47 && lng >= 6 && lng <= 19)    return 'IT';
  if (lat >= 36 && lat <= 44 && lng >= -9 && lng <= 5)    return 'ES';
  if (lat >= 35 && lat <= 42 && lng >= 26 && lng <= 45)   return 'TR';
  if (lat >= 30 && lat <= 53 && lng >= 73 && lng <= 135)  return 'CN';
  if (lat >= 31 && lat <= 46 && lng >= 130 && lng <= 146) return 'JP';
  if (lat >= 34 && lat <= 43 && lng >= 124 && lng <= 130) return 'KR';
  if (lat >= 5 && lat <= 21 && lng >= 117 && lng <= 127)  return 'PH';
  if (lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106)   return 'TH';
  if (lat >= 1 && lat <= 28 && lng >= 68 && lng <= 98)    return 'IN';
  if (lat >= 1 && lat <= 7 && lng >= 100 && lng <= 104)   return 'SG';
  if (lat >= -44 && lat <= -10 && lng >= 113 && lng <= 154) return 'AU';
  if (lat >= -47 && lat <= -34 && lng >= 166 && lng <= 178) return 'NZ';
  if (lat >= 22 && lat <= 32 && lng >= 50 && lng <= 60)   return 'AE';
  if (lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33) return 'ZA';
  if (lat >= 15 && lat <= 37 && lng >= 25 && lng <= 37)   return 'EG';
  if (lat >= -33 && lat <= 5 && lng >= -73 && lng <= -34) return 'BR';
  if (lat >= 16 && lat <= 33 && lng >= -118 && lng <= -86)return 'MX';
  return 'US';
}

// ─── SAFE STRING EXTRACTOR ─────────────────────────────────────────────────
function safeText(r: any): string {
  if (!r) return '';
  if (r.text && typeof r.text === 'object' && r.text.text) return String(r.text.text);
  if (typeof r.text === 'string') return r.text;
  if (r.originalText?.text) return String(r.originalText.text);
  return '';
}

// ─── SCORE HELPER ──────────────────────────────────────────────────────────
function score(text: string, keywords: string[]): number {
  return keywords.filter(k => text.includes(k)).length;
}

// ─── DERIVE ACCESS TYPE (ChatGPT #9, #14) ──────────────────────────────────
function deriveAccessType(
  props: any,
  venueCategory: string,
  country: string,
  countryData: any
): 'free' | 'customers_only' | 'fee_required' | 'ticketed_entry' | 'unknown' {
  // Ticketed venues
  if (['museum', 'theme_park', 'attraction', 'stadium', 'zoo', 'aquarium'].includes(venueCategory)) {
    return 'ticketed_entry';
  }

  // True fee-required (cash pay at door) — only in countries that have this
  if (props.isPaid && FEE_REQUIRED_COUNTRIES.includes(country) && countryData?.hasPaidPublicToilets) {
    // Only for public/transit venues, not coffee shops
    if (['public', 'transit', 'park'].includes(venueCategory)) {
      return 'fee_required';
    }
  }

  // Purchase likely required (coffee shops, restaurants, etc.)
  if (props.purchaseRequired || ['coffee', 'restaurant', 'fastfood'].includes(venueCategory)) {
    return 'customers_only';
  }

  // Free access
  if (props.isFree) return 'free';

  // Default for retail/grocery/mall — usually free
  if (['grocery', 'shopping', 'mall', 'hotel', 'library', 'medical'].includes(venueCategory)) {
    return 'free';
  }

  return 'unknown';
}

// ─── DERIVE REACHABILITY (ChatGPT #7, #13) ─────────────────────────────────
function deriveReachability(reviewText: string): 'easy' | 'moderate' | 'difficult' | 'unknown' {
  const hasStairs = score(reviewText, PROPERTY_SIGNALS.stairs) > 0;
  const hasElevator = score(reviewText, PROPERTY_SIGNALS.elevator) > 0;
  const hasLocked = score(reviewText, PROPERTY_SIGNALS.locked) > 0;

  if (hasStairs && !hasElevator) return 'moderate';
  if (hasLocked) return 'moderate';
  if (hasStairs && hasElevator) return 'easy';
  return 'unknown'; // Can't determine
}

// ─── DERIVE CONFIDENCE (ChatGPT #8) ────────────────────────────────────────
function deriveConfidence(venueCategory: string, reviewText: string, types: string[]): 'high' | 'medium' | 'low' {
  const restroomMentioned = /restroom|bathroom|toilet|washroom|loo|wc|cr\b/i.test(reviewText);
  const isHighConfidenceVenue = ['public', 'mall', 'grocery', 'hotel', 'medical', 'transit', 'airport'].includes(venueCategory);

  if (restroomMentioned && isHighConfidenceVenue) return 'high';
  if (restroomMentioned || isHighConfidenceVenue) return 'medium';
  return 'low';
}

// ─── DERIVE SMART NOTE (ChatGPT #1, #2) ────────────────────────────────────
function deriveSmartNote(
  accessType: string,
  venueCategory: string,
  reachability: string,
  country: string,
  countryData: any
): string {
  // Only return ONE short note
  if (accessType === 'ticketed_entry') {
    return 'Inside ticketed venue';
  }
  if (accessType === 'fee_required' && countryData?.typicalFee) {
    return `Fee usually ${countryData.typicalFee}`;
  }
  if (accessType === 'customers_only') {
    if (['coffee', 'restaurant', 'fastfood'].includes(venueCategory)) {
      return 'Purchase may be required';
    }
    return 'Customers only';
  }
  if (reachability === 'moderate') {
    return 'May involve stairs or staff access';
  }
  if (venueCategory === 'transit') {
    return 'May be inside fare-paid area';
  }
  return '';
}

// ─── VENUE CLASSIFICATION (ChatGPT #16 — fixed priorities) ────────────────
function classifyVenue(name: string, types: string[]): { icon: string; label: string; category: string } {
  const allText = `${name.toLowerCase()} ${types.join(' ').toLowerCase()}`;

  // Priority 1: Specific retail chains (fix Whole Foods, Coffee Bean, ampm)
  if (/whole foods|trader joe|target|walmart|costco|ralphs|safeway|kroger|vons|albertsons|publix|heb|wegmans/.test(allText)) {
    return { icon: '🛒', label: 'Grocery Store', category: 'grocery' };
  }
  if (/coffee bean|starbucks|peets|dutch bros|dunkin|philz|blue bottle|intelligentsia/.test(allText)) {
    return { icon: '☕', label: 'Coffee Shop', category: 'coffee' };
  }
  if (/ampm|7-eleven|7eleven|circle k|wawa|sheetz|quicktrip|racetrac|loves|pilot|flying j/.test(allText)) {
    return { icon: '🏪', label: 'Convenience Store', category: 'convenience' };
  }
  if (/marshalls|tj maxx|ross|nordstrom|macys|jcpenney|kohls|burlington/.test(allText)) {
    return { icon: '🛍️', label: 'Department Store', category: 'shopping' };
  }

  // Priority 2: Venue types
  if (/airport|terminal|aeropuerto|flughafen/.test(allText)) {
    return { icon: '✈️', label: 'Airport', category: 'airport' };
  }
  if (/subway|metro|train station|rail station|transit|bus terminal|ferry/.test(allText)) {
    return { icon: '🚇', label: 'Transit Station', category: 'transit' };
  }
  if (/hospital|medical|clinic|health|urgent care/.test(allText)) {
    return { icon: '🏥', label: 'Hospital/Medical', category: 'medical' };
  }
  if (/hotel|inn|lodge|resort|motel|marriott|hilton|hyatt/.test(allText)) {
    return { icon: '🏨', label: 'Hotel', category: 'hotel' };
  }
  if (/mall|shopping center|plaza|shopping/.test(allText) || types.includes('shopping_mall')) {
    return { icon: '🛍️', label: 'Shopping Mall', category: 'mall' };
  }
  if (/supermarket|grocery/.test(allText) || types.includes('supermarket') || types.includes('grocery_or_supermarket')) {
    return { icon: '🛒', label: 'Grocery Store', category: 'grocery' };
  }
  if (/mcdonald|burger king|kfc|wendy|taco bell|chipotle|chick-fil-a|in-n-out|five guys|popeyes|jack in the box|carl|subway|pizza hut|domino/.test(allText)) {
    return { icon: '🍔', label: 'Fast Food', category: 'fastfood' };
  }
  if (/coffee|cafe|tea house|bakery|espresso/.test(allText) || types.includes('cafe')) {
    return { icon: '☕', label: 'Coffee Shop', category: 'coffee' };
  }
  if (/restaurant|diner|bistro|eatery|grill/.test(allText) || types.includes('restaurant')) {
    return { icon: '🍽️', label: 'Restaurant', category: 'restaurant' };
  }
  if (/gas station|petrol|fuel|shell|chevron|bp|exxon|mobil|arco|76|texaco|valero/.test(allText) || types.includes('gas_station')) {
    return { icon: '⛽', label: 'Gas Station', category: 'gas' };
  }
  if (/convenience|mini mart|bodega/.test(allText) || types.includes('convenience_store')) {
    return { icon: '🏪', label: 'Convenience Store', category: 'convenience' };
  }
  if (/library/.test(allText) || types.includes('library')) {
    return { icon: '📚', label: 'Library', category: 'library' };
  }
  if (/museum|gallery/.test(allText) || types.includes('museum')) {
    return { icon: '🏛️', label: 'Museum', category: 'museum' };
  }
  if (/zoo|aquarium/.test(allText) || types.includes('zoo') || types.includes('aquarium')) {
    return { icon: '🦁', label: 'Zoo/Aquarium', category: 'zoo' };
  }
  if (/theme park|amusement|disneyland|universal|six flags/.test(allText) || types.includes('amusement_park')) {
    return { icon: '🎢', label: 'Theme Park', category: 'theme_park' };
  }
  if (/stadium|arena|ballpark/.test(allText) || types.includes('stadium')) {
    return { icon: '🏟️', label: 'Stadium', category: 'stadium' };
  }
  if (/bank/.test(allText) || types.includes('bank')) {
    return { icon: '🏦', label: 'Bank', category: 'bank' };
  }
  if (/school|university|college|campus/.test(allText) || types.includes('school') || types.includes('university')) {
    return { icon: '🏫', label: 'School/University', category: 'school' };
  }
  if (/park|garden|recreation|beach|trail|campground/.test(allText) || types.includes('park')) {
    return { icon: '🌳', label: 'Park/Outdoors', category: 'park' };
  }

  return { icon: '🚻', label: 'Public Restroom', category: 'public' };
}

// ─── MAIN HANDLER ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  console.log("\n🚻 === getRestroomLocations v4.0 START ===\n");

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', restrooms: [] }, { status: 401 });

    const body = await req.json();
    const {
      latitude,
      longitude,
      radius = 8000,
      maxResults = 30,
      venueType = 'all',
      forceRefresh = false,
    } = body;

    if (!latitude || !longitude) {
      return Response.json({ error: "Latitude and longitude required", restrooms: [] }, { status: 400 });
    }

    const country = detectCountry(latitude, longitude);
    const countryData = COUNTRY_DATA[country] || COUNTRY_DATA['US'];

    console.log(`📍 Country: ${country}, venueType: ${venueType}, radius: ${radius}m`);

    // Build query list
    const venueQueries = VENUE_QUERIES[venueType] || VENUE_QUERIES['all'];
    const localTerms = countryData.terms.slice(0, 2);
    const allQueries = [...new Set([...localTerms, ...venueQueries])];

    const allPlaces: any[] = [];
    const seenIds = new Set<string>();

    // Parallel batched fetches
    const batchSize = 4;
    for (let i = 0; i < allQueries.length; i += batchSize) {
      const batch = allQueries.slice(i, i + batchSize);
      await Promise.all(batch.map(async (query) => {
        try {
          const params = new URLSearchParams({
            query,
            latitude: String(latitude),
            longitude: String(longitude),
            radius: String(radius),
            maxResults: '15',
            cacheTtl: String(60 * 60 * 24 * 3),  // 3 days — restrooms are stable data
            ...(forceRefresh ? { forceRefresh: 'true' } : {}),
          });
          const url = `${API_BASE_URL}/places/text-search?${params}`;
          const res = await fetch(url);
          if (!res.ok) return;
          const data = await res.json();
          for (const p of (data.places || [])) {
            const id = p.id || p.placeId;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              allPlaces.push(p);
            }
          }
        } catch (err) {
          console.error(`Error: "${query}"`, err);
        }
      }));
    }

    // ── STRICT TYPE FILTER ───────────────────────────────────────────────
    // When a specific category is selected (Parks, Transit, etc.), filter
    // results to ONLY include places whose Google types match that category.
    // Prevents 99 Ranch Market from appearing in Parks results.
    const STRICT_TYPE_MAP: Record<string, Set<string>> = {
      public:      new Set(['library','city_hall','community_center','local_government_office']),
      transit:     new Set(['transit_station','bus_station','train_station','subway_station','light_rail_station','airport']),
      coffee_food: new Set(['cafe','coffee_shop','fast_food_restaurant','restaurant','bakery','meal_takeaway']),
      shopping:    new Set(['shopping_mall','department_store','supermarket','grocery_store','grocery_or_supermarket']),
      medical:     new Set(['hospital','doctor','medical_clinic','health']),
      fuel:        new Set(['gas_station','convenience_store','rest_stop']),
      outdoor:     new Set(['park','national_park','campground','hiking_area','amusement_park','zoo']),
    };
    const strictTypes = STRICT_TYPE_MAP[venueType];
    let filteredPlaces = allPlaces;
    if (strictTypes && venueType !== 'all') {
      filteredPlaces = allPlaces.filter(p => {
        const types: string[] = p.types || [];
        return types.some(t => strictTypes.has(t));
      });
      console.log(`🔒 Strict filter "${venueType}": ${allPlaces.length} → ${filteredPlaces.length}`);
      // Fallback: if strict filter killed all results, use unfiltered
      if (filteredPlaces.length === 0) {
        console.log(`⚠️ Strict filter empty — falling back to all results`);
        filteredPlaces = allPlaces;
      }
    }

    console.log(`📊 Total unique places: ${filteredPlaces.length}`);
    if (filteredPlaces.length === 0) {
      return Response.json({
        restrooms: [],
        count: 0,
        country,
        countryTip: countryData.tip,
        error: "No restrooms found. Try expanding radius."
      });
    }

    // ── Process each place ──────────────────────────────────────────────
    const processed = filteredPlaces.slice(0, maxResults).map(place => {
      const lat = place.location?.latitude || 0;
      const lng = place.location?.longitude || 0;
      const distKm = calcDist(latitude, longitude, lat, lng);

      const weekdayDesc = place.currentOpeningHours?.weekdayDescriptions
        || place.regularOpeningHours?.weekdayDescriptions
        || place.hours || [];

      const photos = (place.photos || [])
        .map((p: any) => p.url || p).filter(Boolean).slice(0, 2);

      const name = place.displayName?.text || place.name || '';
      const types = place.types || [];

      // Venue classification (fixed)
      const venue = classifyVenue(name, types);

      // Extract review text safely
      const reviews: string[] = (place.reviews || []).map((r: any) => safeText(r).toLowerCase());
      const reviewText = reviews.join(' ');
      const combinedText = `${name.toLowerCase()} ${reviewText}`;

      // Properties
      const props = {
        isFree: score(combinedText, PROPERTY_SIGNALS.free) > score(combinedText, PROPERTY_SIGNALS.paid),
        isPaid: score(combinedText, PROPERTY_SIGNALS.paid) > 0,
        isClean: score(combinedText, PROPERTY_SIGNALS.clean) > 0,
        isDirty: score(combinedText, PROPERTY_SIGNALS.dirty) > 0,
        // Only show squat if NOT in western countries AND actually detected
        hasSquat: !NO_SQUAT_COUNTRIES.includes(country) && (score(combinedText, PROPERTY_SIGNALS.squat) > 0 || countryData.expectSquat),
        hasBidet: score(combinedText, PROPERTY_SIGNALS.bidet) > 0 || countryData.expectBidet,
        isAccessible: score(combinedText, PROPERTY_SIGNALS.accessible) > 0 || place.accessibilityOptions?.wheelchairAccessibleEntrance,
        hasFamily: score(combinedText, PROPERTY_SIGNALS.family) > 0,
        hasPaper: score(combinedText, PROPERTY_SIGNALS.paper) > 0 || (countryData.expectPaper && score(combinedText, PROPERTY_SIGNALS.noPaper) === 0),
        noPaper: score(combinedText, PROPERTY_SIGNALS.noPaper) > 0 || !countryData.expectPaper,
        purchaseRequired: score(combinedText, PROPERTY_SIGNALS.purchaseRequired) > 0,
        hasStairs: score(combinedText, PROPERTY_SIGNALS.stairs) > 0,
        hasElevator: score(combinedText, PROPERTY_SIGNALS.elevator) > 0,
        is24Hours: score(combinedText, PROPERTY_SIGNALS.open24) > 0,
      };

      // Derived fields (ChatGPT recommendations)
      const accessType = deriveAccessType(props, venue.category, country, countryData);
      const reachability = deriveReachability(combinedText);
      const confidence = deriveConfidence(venue.category, reviewText, types);
      const smartNote = deriveSmartNote(accessType, venue.category, reachability, country, countryData);

      // Quality score
      let quality = 50;
      if (props.isClean) quality += 20;
      if (props.isDirty) quality -= 30;
      if (accessType === 'free') quality += 15;
      if (accessType === 'customers_only') quality += 5;
      if (props.isAccessible) quality += 5;
      if (props.hasBidet) quality += 5;
      if (props.hasPaper) quality += 5;
      if (reachability === 'moderate' || reachability === 'difficult') quality -= 5;
      if (confidence === 'high') quality += 10;
      if (confidence === 'low') quality -= 10;
      quality = Math.max(0, Math.min(100, quality));

      return {
        id: place.id,
        placeId: place.id,
        name,
        displayName: place.displayName || { text: name },
        location: { latitude: lat, longitude: lng },
        lat, lng,
        formattedAddress: place.formattedAddress || '',
        distanceKm: distKm,
        distanceMiles: distKm * 0.621371,
        rating: place.rating || null,
        userRatingCount: place.userRatingCount || 0,
        isOpen: place.isOpen ?? null,
        weekdayDescriptions: weekdayDesc,
        photos,
        photoUrl: photos[0] || null,
        nationalPhoneNumber: place.nationalPhoneNumber || '',
        internationalPhoneNumber: place.internationalPhoneNumber || '',
        websiteUri: place.websiteUri || '',
        googleMapsUri: place.googleMapsUri || '',
        types,

        // Venue
        venueIcon: venue.icon,
        venueLabel: venue.label,
        venueCategory: venue.category,

        // Intelligence (NEW in v4.0)
        accessType,
        reachability,
        confidence,
        smartNote,

        // Properties (for feature chips)
        properties: props,
        qualityScore: quality,

        // Country (for header tip only — NOT repeated on cards)
        country,
      };
    });

    // Sort: quality desc, then distance asc
    processed.sort((a, b) => {
      const qDiff = b.qualityScore - a.qualityScore;
      if (Math.abs(qDiff) > 15) return qDiff;
      return (a.distanceKm || 0) - (b.distanceKm || 0);
    });

    console.log(`✅ Returning ${processed.length} restrooms | Country: ${country}`);

    return Response.json({
      restrooms: processed,
      count: processed.length,
      country,
      countryTip: countryData.tip, // Only for header banner
      version: 'v4.0',
    });

  } catch (err: any) {
    console.error("💥", err.message);
    return Response.json({ error: err.message, restrooms: [] }, { status: 200 });
  }
});

// ─── HELPERS ───────────────────────────────────────────────────────────────
function calcDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}