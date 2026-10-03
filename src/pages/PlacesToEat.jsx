                // ============================================================================
// GLOBESKIMMERS — PlacesToEat v6.4
// ============================================================================
// FEATURES:
//   ✅ Search bar (dish + restaurant text search)
//   ✅ Cuisine quick-scroll (All/American/.../Filipino)
//   ✅ Special categories: Trending, Local, Hidden Gems, Fine Dining, Budget, Late Night
//   ✅ Advanced collapsible filters:
//         Dietary (Vegetarian, Vegan, Halal, Kosher, Gluten-Free)
//         Vibe (Photo-Worthy, Date Night, Family, Work-Friendly, Outdoor, Live Music, Groups)
//         Seating & Parking (Google-confirmed ✅)
//         Amenities (Outdoor seating, Drive-thru, Takeout, Dine-in)
//         Open Now · Min Rating · Price Range · Radius
//   ✅ Sort: Nearby · Best
//   ✅ Trust labels: ✅ Google confirmed / ⚠️ Mentioned in reviews
//   ✅ Photo carousel (swipe, up to 5 photos)
//   ✅ Ranking badges: #1 gold / #2 silver / #3 bronze
//   ✅ Smart badges: Hidden Gem, Late Night, Popular, Trending, Drive-Thru, Takeout Only
//   ✅ Customer Favorites (top dishes from reviews)
//   ✅ 5 Google reviews
//   ✅ Best time to visit
//   ✅ Parking with trust labels
//   ✅ Seating with trust labels
//   ✅ Drive-thru / Cash Only indicators
//   ✅ Tap-to-call phone
//   ✅ Website link
//   ✅ Directions (Google / Apple / Waze)
//   ✅ Leaflet map with numbered markers
//   ✅ Load more (20 at a time)
// ============================================================================

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import DistanceUnitToggle from "@/components/location/DistanceUnitToggle";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { logEvent } from "@/lib/analytics";
import { logSearch, logZeroResults } from "@/lib/logSearch";
import AIDetailsSection from "@/components/AIDetailsSection";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapAppSelector from "@/components/MapAppSelector";
import { MapPin, Utensils, Clock, SlidersHorizontal, SearchX, AlertCircle } from "lucide-react";
import { CAT, TEAL_DEEP, IVORY } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import FinderHeader from "@/components/finder/FinderHeader";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import FilterSheet from "@/components/finder/FilterSheet";

// iPad editorial design tokens (design handoff: "Places to Eat · iPad").
const ED_SERIF = '"Instrument Serif", Georgia, serif';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)", ED_EAT = "#D8443C";

const WORKER_URL = 'https://globeskimmers-api.maizasimeon.workers.dev';

// Build a Google Places photo URL at a chosen width — mirrors ConvenienceStore's
// getPhotoUrl so result-card photos render from the SAME crisp landscape 800px
// source. We PREFER building from the photo `name` (overriding any pre-built
// .url/.thumbnail, which can be a smaller/square crop that reads as "zoomed in"
// inside the wide cover box). Strings pass through; falls back to any pre-built
// URL only when there's no `name`.
function photoSrc(photo, maxWidth = 800) {
  if (!photo) return null;
  if (typeof photo === 'string') return photo;
  if (photo.name) return `${WORKER_URL}/places/photo?name=${encodeURIComponent(photo.name)}&maxWidth=${maxWidth}`;
  return photo.full || photo.url || photo.thumbnail || null;
}

// ─── THEME ──────────────────────────────────────────────────────────────────
const BLUE      = "#3B82F6";
const BLUE_DARK = "#1E40AF";
const BLUE_LT   = "#EFF6FF";
const GOLD      = "#F59E0B";
const CORAL     = "#FF6B6B";
const GRAY      = "#64748B";
const DARK      = "#1A2332";
const GREEN     = "#4CAF50";
const TEAL      = "#14B8A6";
const PURPLE    = "#7C3AED";
const ORANGE    = "#EA580C";

// ─── CUISINE CATEGORIES ─────────────────────────────────────────────────────
const CUISINES = [
  { id:'all',           label:'All Food',    icon:'🍽️', special:false },
  { id:'latenight',     label:'Late Night',  icon:'🌙', special:true  },
  { id:'american',      label:'American',    icon:'🍔' },
  { id:'mexican',       label:'Mexican',     icon:'🌮' },
  { id:'italian',       label:'Italian',     icon:'🍝' },
  { id:'pizza',         label:'Pizza',       icon:'🍕' },
  { id:'chinese',       label:'Chinese',     icon:'🥡' },
  { id:'japanese',      label:'Japanese',    icon:'🍣' },
  { id:'sushi',         label:'Sushi',       icon:'🍱' },
  { id:'korean',        label:'Korean',      icon:'🫕' },
  { id:'thai',          label:'Thai',        icon:'🍜' },
  { id:'vietnamese',    label:'Vietnamese',  icon:'🥢' },
  { id:'indian',        label:'Indian',      icon:'🍛' },
  { id:'mediterranean', label:'Mediterranean',icon:'🥙' },
  { id:'filipino',      label:'Filipino',    icon:'🥘' },
  { id:'seafood',       label:'Seafood',     icon:'🦞' },
  { id:'steakhouse',    label:'Steakhouse',  icon:'🥩' },
  { id:'breakfast',     label:'Breakfast',   icon:'🥞' },
  { id:'fast_food',     label:'Fast Food',   icon:'🍟' },
  { id:'vegetarian',    label:'Vegetarian',  icon:'🥗' },
  { id:'vegan',         label:'Vegan',       icon:'🌱' },
  { id:'halal',         label:'Halal',       icon:'☪️'  },
  { id:'kosher',        label:'Kosher',      icon:'✡️'  },
  { id:'dessert',       label:'Dessert',     icon:'🍰' },
];

const RADIUS_OPTIONS = [
  { v:5,  l:'5 mi' },
  { v:10, l:'10 mi' },
  { v:15, l:'15 mi' },
  { v:25, l:'25 mi' },
];

const VIBE_OPTIONS = [
  { id:'family',      icon:'👨‍👩‍👧', label:'Family'         },
  { id:'outdoor',     icon:'🌿', label:'Outdoor'        },
  { id:'liveMusic',   icon:'🎵', label:'Live Music'     },
  { id:'groups',      icon:'🎉', label:'Good for Groups'},
  { id:'sportsBar',   icon:'📺', label:'Sports Bar'     },
];

const DIETARY_OPTIONS = [
  { id:'vegetarian', icon:'🥦', label:'Vegetarian'  },
  { id:'vegan',      icon:'🌱', label:'Vegan'       },
  { id:'halal',      icon:'☪️',  label:'Halal'       },
  { id:'kosher',     icon:'✡️',  label:'Kosher'      },
  { id:'glutenFree', icon:'🌾', label:'Gluten-Free' },
];

// ─── CUISINE → GOOGLE TYPES MAP (for client-side multi-select filtering) ─────
const CUISINE_TYPE_MAP = {
  american:      ['american_restaurant','hamburger_restaurant','diner'],
  mexican:       ['mexican_restaurant'],
  italian:       ['italian_restaurant','pizza_restaurant'],
  pizza:         ['pizza_restaurant'],
  chinese:       ['chinese_restaurant'],
  japanese:      ['japanese_restaurant','ramen_restaurant'],
  sushi:         ['sushi_restaurant'],
  korean:        ['korean_restaurant'],
  thai:          ['thai_restaurant'],
  vietnamese:    ['vietnamese_restaurant'],
  indian:        ['indian_restaurant'],
  mediterranean: ['mediterranean_restaurant','greek_restaurant'],
  filipino:      ['filipino_restaurant'],
  seafood:       ['seafood_restaurant'],
  steakhouse:    ['steak_house'],
  breakfast:     ['breakfast_restaurant','brunch_restaurant'],
  fast_food:     ['fast_food_restaurant','hamburger_restaurant','sandwich_shop'],
  vegetarian:    ['vegetarian_restaurant'],
  vegan:         ['vegan_restaurant'],
  halal:         ['halal_restaurant'],
  kosher:        ['kosher_restaurant'],
  dessert:       ['dessert_shop','ice_cream_shop','donut_shop'],
  // 'bakery_cafe' is a custom synthetic primaryType assigned by processRest
  // when a place tagged 'cafe' is actually a bakery (name contains "bakery",
  // "pastry", "patisserie", etc.). Without this, cuisineTypeFilter strips
  // every bakery-cafe off the screen when a non-'all' cuisine is selected.
  bakery:        ['bakery', 'pastry_shop', 'dessert_shop', 'donut_shop', 'bagel_shop', 'bakery_cafe'],
};

// ─── BAR-DOMINANT DETECTION ──────────────────────────────────────────────────
const BAR_PRIMARY_TYPES = new Set(['bar','pub','wine_bar','tapas_bar','lounge','night_club','brewery']);
function isBarDominant(place) {
  const types = place.types || [];
  const pt = place.primaryType || '';
  const hasBarType = BAR_PRIMARY_TYPES.has(pt) || types.some(t => BAR_PRIMARY_TYPES.has(t));
  const hasRestType = types.some(t => t.includes('restaurant') || t === 'meal_takeaway' || t === 'meal_delivery' || t === 'fast_food_restaurant');
  return hasBarType && !hasRestType;
}

// ─── OPEN STATUS (With Live Clock Override) ──────────────────────────────────
// Cloudflare caches Google's openNow boolean for 12 hours (90 days on the
// details/enrich path). A place tagged "Open" at noon is still "Open" at 11 PM
// if the cache hasn't expired. This function parses the actual hours string
// (e.g. "11:00 AM – 9:30 PM") against a clock we can trust instead.
//
// `isLocal` = the user is physically at the active location (current-GPS mode),
// so the device clock IS the place's clock. It decides what we may fall back on
// when Google didn't give us the place's UTC offset.
function computeOpenStatus(place, { isLocal = true } = {}) {
  const hours = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || place.hours || [];

  // Compute "now" in the PLACE's timezone when Google gave us its UTC offset — the
  // device clock makes open/closed + today's-hours WRONG when browsing a city in
  // another timezone (e.g. Tokyo from the US). Falls back to device time only when
  // the user is actually there; browsing a far city with no offset means neither
  // the device clock nor a cached openNow can be reconciled, so we say nothing —
  // a blank beats a confidently wrong Open/Closed.
  const _off = place.utcOffsetMinutes;
  const _tz = Number.isFinite(_off);
  const UNKNOWN = { isOpen: null, todayHours: null, is24Hours: false };
  if (!_tz && !isLocal) return UNKNOWN;
  // Google's cached boolean is a last resort, and only for the city you're standing in.
  const cachedOpen = isLocal ? (place.isOpen ?? null) : null;
  if (!hours.length) return { ...UNKNOWN, isOpen: cachedOpen };

  const now = _tz ? new Date(Date.now() + _off * 60000) : new Date();
  const _day = _tz ? now.getUTCDay() : now.getDay();
  const _mins = _tz ? (now.getUTCHours() * 60 + now.getUTCMinutes()) : (now.getHours() * 60 + now.getMinutes());
  const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const entry = hours.find(h => h?.startsWith(DAY[_day]));

  if (!entry) return { ...UNKNOWN, isOpen: cachedOpen };

  const hoursText = entry.substring(entry.indexOf(':')+1).trim();
  if (hoursText.toLowerCase() === 'closed') return { isOpen: false, todayHours: 'Closed today', is24Hours: false };
  if (hoursText.toLowerCase().includes('24 hours')) return { isOpen: true, todayHours: 'Open 24 hours', is24Hours: true };

  let isLiveOpen = cachedOpen;
  try {
    const currentMins = _mins;
    const shifts = hoursText.split(',');
    let foundMatch = false;

    for (const shift of shifts) {
      const parts = shift.split(/[-–]| to /i).map(s => s.trim());
      if (parts.length === 2) {
        const parseTime = (ts) => {
          const m = ts.match(/(\d+)(?::(\d+))?\s*(am|pm)/i);
          if (!m) return null;
          let h = parseInt(m[1], 10), min = parseInt(m[2] || 0, 10);
          if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12;
          if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
          return h * 60 + min;
        };

        const start = parseTime(parts[0]);
        let end = parseTime(parts[1]);

        if (start !== null && end !== null) {
          if (end < start) end += 1440; // overnight (e.g. 10 PM – 2 AM)
          let checkMins = currentMins;
          if (checkMins < start && end > 1440) checkMins += 1440;
          if (checkMins >= start && checkMins <= end) foundMatch = true;
        }
      }
    }
    isLiveOpen = foundMatch;
  } catch(e) {
    // Fall back to cached boolean if parsing fails
  }

  return { isOpen: isLiveOpen, todayHours: hoursText, is24Hours: false };
}

// Day-of-week (0 = Sunday) AT THE PLACE, not on the device: shifted by Google's
// UTC offset when we have it, the device day when the user is physically there,
// null when neither holds — we genuinely don't know what day it is over there,
// so callers show no "today" rather than the wrong one.
function placeDay(utcOffsetMinutes, isLocal) {
  if (Number.isFinite(utcOffsetMinutes)) return new Date(Date.now() + utcOffsetMinutes * 60000).getUTCDay();
  return isLocal ? new Date().getDay() : null;
}

// ─── PRICE DISPLAY ────────────────────────────────────────────────────────────
function priceDisplay(level) {
  if (!level) return null;
  if (level === 'PRICE_LEVEL_INEXPENSIVE' || level === 1) return '$';
  if (level === 'PRICE_LEVEL_MODERATE'    || level === 2) return '$$';
  if (level === 'PRICE_LEVEL_EXPENSIVE'   || level === 3) return '$$$';
  if (level === 'PRICE_LEVEL_VERY_EXPENSIVE'|| level === 4) return '$$$$';
  return null;
}

// ─── DETECT VIBES (client-side from reviews + API fields) ────────────────────
function detectVibes(place) {
  const reviews = place.reviews || [];
  const text = reviews.map(r => r.text || '').join(' ').toLowerCase();
  return {
    family:       place.goodForChildren || text.includes('family') || text.includes('kids'),
    outdoor:      place.hasOutdoorSeating === true || place.outdoorSeating === true,
    liveMusic:    place.liveMusic || text.includes('live music') || text.includes('live band'),
    groups:       place.goodForGroups || text.includes('group') || text.includes('party'),
    lateNight:    text.includes('late night') || text.includes('open late') || text.includes('midnight'),
    // sportsBar: use backend sportsScore if available (0–100 multi-signal score),
    // otherwise fall back to client-side keyword detection.
    // Threshold 55 = "Casual Watch Spot" minimum per ChatGPT + Gemini algorithm.
    sportsBar: (place.sportsScore != null)
      ? place.sportsScore >= 55
      : (() => {
          const name = (place.name||'').toLowerCase();
          const typeMatch = (place.types||[]).some(t => t === 'sports_bar') || (place.primaryType||'') === 'sports_bar';
          const nameMatch = /sports?\s*(bar|grill|pub|lounge|tavern)/.test(name);
          const watchingGame = text.includes('watch') && (text.includes('game') || text.includes('match') || text.includes('game day'));
          const tvSports = (text.includes('big screen') || text.includes('tv') || text.includes('screens')) &&
                           (text.includes('sports') || text.includes('football') || text.includes('nfl') || text.includes('nba') || text.includes('ufc'));
          const beerAndSports = (text.includes('beer') || text.includes('wings') || text.includes('nachos')) &&
                                (text.includes('sports') || text.includes('game') || text.includes('football'));
          return typeMatch || nameMatch || text.includes('sports bar') || watchingGame || tvSports || beerAndSports;
        })(),
  };
}

// ─── BUILD PARKING from Google's parkingOptions booleans ─────────────────────
function buildParking(opts) {
  if (!opts) return null;
  const details = [];

  // LOT PARKING — Free wins over Paid when Google returns both for the same
  // category (which happens often: lots with mixed free/paid sections, or
  // Google's data team flagged both at different times). Prioritize Free
  // since the user wants to know about a free option if one exists.
  if (opts.freeParkingLot) {
    details.push({ icon:'🅿️', label:'Free parking lot' });
  } else if (opts.paidParkingLot) {
    details.push({ icon:'🅿️', label:'Paid parking lot' });
  }

  // STREET PARKING
  if (opts.freeStreetParking) {
    details.push({ icon:'🛣️', label:'Free street parking' });
  } else if (opts.paidStreetParking) {
    details.push({ icon:'🛣️', label:'Paid street parking' });
  }

  // GARAGE PARKING
  if (opts.freeGarage) {
    details.push({ icon:'🏢', label:'Free garage' });
  } else if (opts.paidGarage) {
    details.push({ icon:'🏢', label:'Paid garage' });
  }

  // VALET — additive (always show if available, separate from lot/street/garage)
  if (opts.valetParking) {
    details.push({ icon:'🎩', label:'Valet parking' });
  }

  if (details.length === 0 && !opts.parkingAvailable) return null;
  if (details.length === 0 && opts.parkingAvailable)
    details.push({ icon:'🅿️', label:'Parking available' });

  return { source: 'api', noParking: false, details };
}

// ─── DETECT DIETARY (from types + reviews) ───────────────────────────────────
function detectDietary(place) {
  const types  = (place.types || []).join(' ').toLowerCase();
  const text   = (place.reviews || []).map(r => r.text || '').join(' ').toLowerCase();
  const name   = (place.name || '').toLowerCase();
  return {
    // Vegetarian: Google has a native boolean field + type check
    vegetarian: place.servesVegetarianFood === true
                || types.includes('vegetarian_restaurant')
                || name.includes('vegetarian') || name.includes('veg '),

    // Vegan: Google has servesVeganFood on some places + type/review check
    vegan:      place.servesVeganFood === true
                || types.includes('vegan_restaurant')
                || name.includes('vegan') || /\bvegan\b/.test(text),

    // Halal: Google's native type is 'halal_restaurant' — most reliable signal
    // Broadened: any mention of "halal" in reviews/name counts
    halal:      types.includes('halal_restaurant')
                || name.includes('halal')
                || /\bhalal\b/.test(text) || /\bzabiha\b/.test(text),

    // Kosher: Google's native type is 'kosher_restaurant'
    // Broadened: any mention of "kosher" in reviews/name counts
    kosher:     types.includes('kosher_restaurant')
                || name.includes('kosher')
                || /\bkosher\b/.test(text),

    glutenFree: text.includes('gluten free') || text.includes('gluten-free'),
  };
}

// ─── PROCESS RESTAURANT ──────────────────────────────────────────────────────
function processRest(place, userLat, userLng, isLocal = true) {
  const lat = place.location?.latitude || place.latitude || 0;
  const lng = place.location?.longitude || place.longitude || 0;
  const name  = place.displayName?.text || place.name || '';
  const open  = computeOpenStatus(place, { isLocal });
  const price = priceDisplay(place.priceLevel);

  let distMiles = place.distanceMiles || null;
  if (!distMiles && userLat && userLng && lat && lng) {
    const R=3959, dLat=(lat-userLat)*Math.PI/180, dLon=(lng-userLng)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(userLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
    distMiles = R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  const vibes   = detectVibes(place);
  // Backend may pre-tag a place when the user picked a dietary filter
  // (e.g. halal/kosher). Trust backend's assertion over our client-side
  // detection, which can't reliably see Google's 'halal_restaurant' type
  // without a typed search.
  const dietary = { ...detectDietary(place), ...(place.dietary || {}) };
  // Photos may arrive as URL strings (main restaurant path) OR as objects
  // {name, url, thumbnail, full} (dietary shortcut path, straight from worker).
  // Normalize to URL strings so the carousel renders instead of falling back
  // to the emoji placeholder.
  const photos  = ((place.photos && place.photos.length)
    ? place.photos.map(p => photoSrc(p, 800))
    : (place.photoUrl ? [place.photoUrl] : [])
  ).filter(Boolean);

  // If a café is actually a bakery/pastry shop, relabel it so it doesn't show as "Café"
  // (Café is reserved for the separate Coffee Finder feature)
  const nameLower = name.toLowerCase();
  const isBakeryCafe = (place.primaryType === 'cafe' || (place.types||[]).includes('cafe')) &&
    (nameLower.includes('bakery') || nameLower.includes('pastry') || nameLower.includes('patisserie') ||
     nameLower.includes('boulangerie') || nameLower.includes('donut') || nameLower.includes('bagel') ||
     nameLower.includes('bake') || (place.types||[]).includes('bakery') || (place.types||[]).includes('pastry_shop'));
  const displayPrimaryType = isBakeryCafe ? 'bakery_cafe' : (place.primaryType || null);

  // Smart badges
  const badges = [];
  // Sports badge first — most important when Sports Bar filter is active
  if (place.sportsBadge === 'Best Sports Bar')   badges.push({ icon:'🏆', label:'Best Sports Bar',   color:'#B45309', bg:'#FEF3C7' });
  if (place.sportsBadge === 'Sports-Friendly')   badges.push({ icon:'📺', label:'Sports-Friendly',    color:'#0277BD', bg:'#E1F5FE' });
  if (place.sportsBadge === 'Casual Watch Spot') badges.push({ icon:'🍺', label:'Casual Watch Spot',  color:'#64748B', bg:'#F1F5F9' });
  // Intent tier badges — match backend TIER_LABELS:
  //   1 = Dish Specialist (dish word in name, NOT a chain) — most expected
  //   2 = Authentic Match (place type matches the dish's primary cuisine type)
  //   3 = Related (secondary/cultural cuisine type)
  //   4 = Serves It (editorialSummary / reviews / menu OCR mention the dish)
  // Chains are demoted in ranking and flagged "Chain Option" so the trust signal
  // is explicit (e.g. Olive Garden = Authentic Match · Chain Option).
  if (place.tier === 1) badges.push({ icon:'✓', label:'Dish Specialist', color:'#15803D', bg:'#DCFCE7' });
  if (place.tier === 2) badges.push({ icon:'✓', label:'Authentic Match', color:'#0E7490', bg:'#CFFAFE' });
  if (place.tier === 3) badges.push({ icon:'~', label:'Related',         color:'#A16207', bg:'#FEF9C3' });
  if (place.tier === 4) badges.push({ icon:'·', label:'Serves It',       color:'#6B7280', bg:'#F3F4F6' });
  if (place.isChain)    badges.push({ icon:'🏬', label:'Chain Option',   color:'#6B7280', bg:'#F3F4F6' });
  if (place.hasDriveThru)             badges.push({ icon:'🚗', label:'Drive-Thru',  color:'#0277BD', bg:'#E1F5FE' });
  if (place.isTakeoutOnly)            badges.push({ icon:'📦', label:'Takeout Only',color:'#E65100', bg:'#FFF3E0' });
  if (open.is24Hours||vibes.lateNight)badges.push({ icon:'🌙', label:'Late Night',  color:'#1565C0', bg:'#E3F2FD' });
  if ((place.rating||0)>=4.7&&(place.userRatingCount||0)>500) badges.push({ icon:'⭐', label:'Top Rated', color:'#B45309', bg:'#FEF3C7' });

  // ── REVIEW MERGE + DEDUP (Text Content Fingerprint) ─────────────────────
  // Google's contextualContents.reviews are query-aware snippets (the
  // reviews Google's index pre-matched to the user's search). Bubble those
  // to the top of the displayed reviews stack; dedup any review that also
  // appears in the standard place.reviews array using trimmed-text as the
  // fingerprint key so we never render the same review twice.
  const rawGenericReviews = /** @type {any[]} */ (place.reviews || []);
  const rawContextualReviews = /** @type {any[]} */ (place.contextualContents?.reviews || []);
  const normalizeReview = (/** @type {any} */ r) => ({
    author: r.author || r.authorDisplayName || r.authorAttribution?.displayName || 'Anonymous',
    rating: r.rating || 0,
    text: r.text?.text || r.text || '',
    time: r.time || r.relativePublishTimeDescription || '',
    profilePhoto: r.profilePhoto || r.authorAttribution?.photoUri || null,
  });
  const genericReviews = rawGenericReviews.map(normalizeReview);
  const contextualReviews = rawContextualReviews.map(normalizeReview);
  /** @type {Set<string>} */
  const seenReviewTexts = new Set();
  /** @type {any[]} */
  const deduplicatedReviews = [];
  // 1. Push query-focused contextual reviews first
  contextualReviews.forEach((/** @type {any} */ r) => {
    const cleanText = r.text.trim();
    if (cleanText && !seenReviewTexts.has(cleanText)) {
      seenReviewTexts.add(cleanText);
      deduplicatedReviews.push(r);
    }
  });
  // 2. Append generic reviews only if their text footprint hasn't been seen yet
  genericReviews.forEach((/** @type {any} */ r) => {
    const cleanText = r.text.trim();
    if (cleanText && !seenReviewTexts.has(cleanText)) {
      seenReviewTexts.add(cleanText);
      deduplicatedReviews.push(r);
    }
  });

  return {
    ...place,
    lat, lng, name,
    primaryType: displayPrimaryType,
    distanceMiles: distMiles,
    distance: distMiles ? `${distMiles.toFixed(1)} mi` : null,
    isOpen: open.isOpen,
    todayHours: open.todayHours,
    is24Hours: open.is24Hours,
    priceStr: price,
    photos,
    photoUrl: photos[0] || null,
    vibes, dietary,
    badges,
    customerFavorites: (place.customerFavorites || place.customer_favorites || [])
      .map(f => ({ ...f, dish: f.dish || f.name || '', name: f.name || f.dish || '' }))
      .filter(f => f.dish),
    reviews: deduplicatedReviews,
    // Native Google Places API (New) AI fields — passthrough for the
    // expanded-card AI Summary panel. Already covered by ...place spread
    // but listed explicitly so it's discoverable when reading processRest.
    generativeSummary: place.generativeSummary || null,
    contextualContents: place.contextualContents || null,
    parking: buildParking(place.parkingOptions) || place.parking || null,
    seating: place.seating || null,
    hasIndoorSeating:  place.hasIndoorSeating  ?? (place.dineIn===true)         ?? null,
    hasOutdoorSeating: place.hasOutdoorSeating ?? (place.outdoorSeating===true) ?? null,
    seatingSource: place.seatingSource || ((place.dineIn != null || place.outdoorSeating != null) ? 'api' : null),
    hasDriveThru:  place.hasDriveThru  || false,
    isTakeoutOnly: place.isTakeoutOnly || false,
    isCashOnly:    place.isCashOnly    || false,
    cashSource:    place.cashSource    || null,
    bestTimeNote:  place.bestTimeNote  || null,
  };
}

// ─── PHOTO CAROUSEL ──────────────────────────────────────────────────────────
function PhotoCarousel({ photos=[], rank, badges=[], height=180 }) {
  const [cur,setCur]=useState(0); const [errs,setErrs]=useState({}); const ref=useRef(null);
  const H = typeof height==='number'?`calc(${height}px*var(--fs))`:height;
  const [lightbox,setLightbox]=useState(false);   // tap-to-enlarge full-screen viewer
  const [lbCur,setLbCur]=useState(0);
  const lbRef=useRef(null);
  const valid=photos.filter((_,i)=>!errs[i]);
  const medalColors = ['#FFD700','#C0C0C0','#CD7F32'];
  const rankLabel   = rank<=3 ? ['🥇','🥈','🥉'][rank-1] : `#${rank}`;
  // On open, jump the lightbox to the photo the user was viewing in the card.
  useEffect(()=>{
    if(lightbox && lbRef.current){
      lbRef.current.scrollLeft = cur * lbRef.current.offsetWidth;
      setLbCur(cur);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[lightbox]);
  return (
    <div style={{position:"relative",background:"#F1F5F9"}}>
      {valid.length>0?(
        <div ref={ref} onScroll={()=>ref.current&&setCur(Math.round(ref.current.scrollLeft/ref.current.offsetWidth))} style={{display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",scrollbarWidth:"none",height:H}}>
          {valid.map((p,i)=><img key={i} src={p} onError={()=>setErrs(e=>({...e,[photos.indexOf(p)]:true}))} onClick={()=>setLightbox(true)} style={{minWidth:"100%",height:H,objectFit:"cover",scrollSnapAlign:"start",flexShrink:0,cursor:"zoom-in"}} alt=""/>)}
        </div>
      ):(
        <div style={{height:"120px",background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"calc(48px*var(--fs))"}}>🍽️</div>
      )}
      {/* Rank badge */}
      <div style={{position:"absolute",top:"10px",left:"10px",width:"36px",height:"36px",borderRadius:"50%",background:rank<=3?medalColors[rank-1]:BLUE,color:rank<=3?"#fff":"#fff",fontWeight:"800",fontSize:rank<=3?"18px":"13px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.25)",border:"2px solid #fff"}}>{rankLabel}</div>
      {/* Smart badges — shifted left of the wishlist heart the card overlays top-right */}
      {badges.length>0&&<div style={{position:"absolute",top:"10px",right:"54px",display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end"}}>{badges.slice(0,2).map((b,i)=><span key={i} style={{background:"rgba(255,255,255,0.95)",color:b.color,padding:"3px 8px",borderRadius:"6px",fontSize:"calc(11px*var(--fs))",fontWeight:"700",boxShadow:"0 1px 4px rgba(0,0,0,0.1)"}}>{b.icon} {b.label}</span>)}</div>}
      {/* Tap-to-enlarge hint */}
      {valid.length>0&&<div style={{position:"absolute",bottom:"8px",left:"10px",background:"rgba(0,0,0,0.55)",color:"#fff",padding:"3px 8px",borderRadius:"20px",fontSize:"calc(10.5px*var(--fs))",fontWeight:"600",pointerEvents:"none"}}>🔍 Tap to enlarge</div>}
      {valid.length>1&&<div style={{position:"absolute",bottom:"8px",right:"10px",background:"rgba(0,0,0,0.6)",color:"#fff",padding:"3px 8px",borderRadius:"20px",fontSize:"calc(11px*var(--fs))",fontWeight:"600"}}>📷 {cur+1}/{valid.length}</div>}
      {/* Dot indicators */}
      {valid.length>1&&<div style={{position:"absolute",bottom:"10px",left:"50%",transform:"translateX(-50%)",display:"flex",gap:"5px"}}>{valid.map((_,i)=><div key={i} style={{width:"5px",height:"5px",borderRadius:"50%",background:i===cur?"#fff":"rgba(255,255,255,0.5)"}}/>)}</div>}

      {/* FULL-SCREEN LIGHTBOX — swipe between photos, contain-fit so the whole
          photo is visible enlarged. Tap the dark area or ✕ to close. */}
      {lightbox && createPortal(
        <div
          onClick={()=>setLightbox(false)}
          style={{position:"fixed",inset:0,zIndex:100000,background:"rgba(0,0,0,0.94)",display:"flex",flexDirection:"column"}}
        >
          <button
            onClick={(e)=>{e.stopPropagation();setLightbox(false);}}
            aria-label="Close"
            style={{position:"absolute",top:"calc(env(safe-area-inset-top) + 12px)",right:"14px",zIndex:2,width:"40px",height:"40px",borderRadius:"50%",background:"rgba(255,255,255,0.18)",backdropFilter:"blur(8px)",border:"none",color:"#fff",fontSize:"20px",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
          >✕</button>
          <div
            ref={lbRef}
            onClick={(e)=>e.stopPropagation()}
            onScroll={()=>lbRef.current&&setLbCur(Math.round(lbRef.current.scrollLeft/lbRef.current.offsetWidth))}
            style={{flex:1,display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",scrollbarWidth:"none"}}
          >
            {valid.map((p,i)=>(
              <div key={i} style={{minWidth:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",scrollSnapAlign:"center",flexShrink:0,padding:"0 8px",boxSizing:"border-box"}}>
                <img src={p} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>
              </div>
            ))}
          </div>
          {valid.length>1&&(
            <div style={{position:"absolute",bottom:"calc(env(safe-area-inset-bottom) + 18px)",left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.6)",color:"#fff",padding:"4px 12px",borderRadius:"20px",fontSize:"13px",fontWeight:"600"}}>{lbCur+1} / {valid.length}</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── TRUST TAG ────────────────────────────────────────────────────────────────
function TrustTag({ confirmed }) {
  return (
    <span style={{fontSize:"calc(10px*var(--fs))",fontWeight:"700",color:confirmed?"#2E7D32":"#E65100",background:confirmed?"#E8F5E9":"#FFF3E0",padding:"1px 6px",borderRadius:"4px",marginLeft:"4px"}}>
      {confirmed ? "✅ Confirmed" : "⚠️ Reviews"}
    </span>
  );
}

// ─── FALLBACK DISCLAIMER ─────────────────────────────────────────────────────
// Shown when search text has intent but no authentic (Tier 1/2) results found.
// e.g. "shabu shabu" typed but only generic restaurants in area.
function FallbackDisclaimer({ fallbackInfo, onExpandRadius }) {
  if (!fallbackInfo?.needed) return null;
  return (
    <motion.div
      initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
      style={{ padding:"14px 16px", background:"#FFFBEB", borderRadius:"12px",
               border:"1px solid #FDE68A", marginBottom:"12px" }}
    >
      {/* Search-focused, cuisine-neutral wording: never single out a cuisine/ethnicity
          in a negative "none found" headline (reads badly for "Asian"/"Chinese"/etc.). */}
      <div style={{ fontWeight:"800", color:"#92400E", fontSize:"calc(14px*var(--fs))", marginBottom:"6px" }}>
        🔍 No exact match nearby
      </div>
      <div style={{ fontSize:"calc(13px*var(--fs))", color:"#B45309", marginBottom:"10px", lineHeight:"1.5" }}>
        These are the closest options we found — they may be a good fit, but aren't an exact match for your search.
      </div>
      <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
        <button onClick={onExpandRadius}
          style={{ padding:"8px 14px", borderRadius:"8px", border:"none",
                   background:"#F59E0B", color:"#fff", fontWeight:"700",
                   fontSize:"calc(12px*var(--fs))", cursor:"pointer", fontFamily:"inherit" }}>
          Search a wider area
        </button>
        {fallbackInfo.nearestAuthenticName && (
          <div style={{ padding:"8px 12px", borderRadius:"8px", background:"#FEF3C7",
                        fontSize:"calc(12px*var(--fs))", color:"#92400E", display:"flex", alignItems:"center", gap:"4px" }}>
            📍 Closest match: <strong>{fallbackInfo.nearestAuthenticName}</strong>
            {fallbackInfo.nearestAuthenticDistanceMiles &&
              <span style={{ color:"#B45309" }}>({fallbackInfo.nearestAuthenticDistanceMiles} mi)</span>
            }
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── ALSO-SERVES BANNER ──────────────────────────────────────────────────────
// Shown when a strict dish search returned 0 exact matches but the backend
// found cuisine-umbrella restaurants in the existing pool (e.g. "Mang Inasal"
// in Santa Clarita -> no Mang Inasal branches but 8 Filipino restaurants
// nearby). Sets honest expectations before the user sees the alternative list.
function AlsoServesBanner({ banner, onSearchElsewhere }) {
  if (!banner?.cuisine) return null;
  return (
    <motion.div
      initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
      style={{ padding:"14px 16px", background:"#EFF6FF", borderRadius:"12px",
               border:"1px solid #BFDBFE", marginBottom:"12px" }}
    >
      <div style={{ fontWeight:"800", color:"#1E40AF", fontSize:"calc(14px*var(--fs))", marginBottom:"6px" }}>
        No exact {banner.queryLabel ? `"${banner.queryLabel}"` : 'match'} nearby
      </div>
      <div style={{ fontSize:"calc(13px*var(--fs))", color:"#1E3A8A", marginBottom:"10px", lineHeight:"1.5" }}>
        Showing nearby <strong>{banner.cuisine}</strong> restaurants you might like instead.
      </div>
      {/* Honest action: every finder already searches the full 25-mile net, so the
          only real way to widen is to move the search — open the location picker. */}
      <button onClick={onSearchElsewhere}
        style={{ padding:"8px 14px", borderRadius:"8px", border:"none",
                 background:"#2563EB", color:"#fff", fontWeight:"700",
                 fontSize:"calc(12px*var(--fs))", cursor:"pointer", fontFamily:"inherit" }}>
        Search somewhere else
      </button>
    </motion.div>
  );
}

// ─── RESTAURANT CARD — editorial layout (design handoff) ─────────────────────
// Full-width editorial card: big photo + rank + Dish-Specialist tag, serif name,
// Say-it/Translate/rating row, pill tags, green Open bar, blue phone bar, three
// action buttons. Reuses PhotoCarousel / NameLanguageHelp /
// AIDetailsSection / TrustTag.
// Responsive: renders at BOTH widths — keeps the full iPad sizing when
// `isTablet`, and switches to compact phone-tuned sizing when `!isTablet`.
// Every text size stays on fs() so the 4-step glasses control scales it; the
// serif name is 2-line clamped and the card uses a min-height (not fixed) so
// enlarged text grows the card instead of clipping.
function RestaurantCardTablet({ restaurant, rank, onDirections, onShowOnMap, formatDistance, isTablet, isLocal, batchEnrich }) {
  const [expanded,setExpanded]=useState(false);
  const [enriched,setEnriched]=useState(null);
  // 3 real Google photos + hours for OWNED restaurants (owned records carry none).
  // T1.15: the parent batch-enriches the whole visible page in ONE worker call and
  // hands this card its slice via `batchEnrich` (undefined = batch still in flight,
  // so wait — don't double-call). A card the batch missed (null) falls back to its
  // own single call; both paths share the worker's per-item KV cache.
  useEffect(()=>{
    if(enriched||restaurant.source!=='owned')return;
    const key=restaurant.id||restaurant.placeId;
    if(key&&batchEnrich===undefined)return; // parent batch pending — its result arrives via prop
    if(batchEnrich){ if(batchEnrich.matched)setEnriched(batchEnrich); return; }
    callWorker('places/enrich-owned',{id:key,name:restaurant.displayName?.text||restaurant.name,lat:restaurant.lat,lng:restaurant.lng,maxPhotos:3})
      .then(({data})=>{ if(data&&data.matched)setEnriched(data); }).catch(()=>{});
  },[batchEnrich]); // eslint-disable-line react-hooks/exhaustive-deps
  const fs=(n)=>`calc(${n}px*var(--fs))`;
  // Pick tablet vs phone-tuned value.
  const t=(tab,phone)=>isTablet?tab:phone;

  const name    = restaurant.displayName?.text || restaurant.name || "Restaurant";
  const phone   = restaurant.nationalPhoneNumber || restaurant.internationalPhoneNumber || "";
  const parking = restaurant.parking;
  const parkingConfirmed = parking?.source==='api';
  const hasAnySeating = restaurant.hasIndoorSeating || restaurant.hasOutdoorSeating;
  const seatingConfirmed = restaurant.seatingSource==='api';
  const cuisineLabel = restaurant.primaryType
    ? restaurant.primaryType.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())
    : restaurant.types?.[0]?.replace(/_/g,' ')?.replace(/\b\w/g,l=>l.toUpperCase()) || null;
  const weekdays = (enriched?.hours?.weekdayDescriptions?.length ? enriched.hours.weekdayDescriptions
    : (restaurant.currentOpeningHours?.weekdayDescriptions || restaurant.regularOpeningHours?.weekdayDescriptions || restaurant.hours || []));
  const photosToShow = (enriched?.photos?.length ? enriched.photos : (restaurant.photos || (restaurant.photoUrl ? [restaurant.photoUrl] : [])));
  // Open/Closed. Owned places get hours on-tap from enrich-owned, whose `openNow`
  // is a Place-Details boolean cached for 90 days — never a live answer. Re-run
  // the same zone-aware parser the list uses over the enriched hours (offset from
  // the enriched payload when the worker sends it, else the place's own); the
  // cached boolean only survives as a last resort when the user is standing here.
  const offset = enriched?.utcOffsetMinutes ?? restaurant.utcOffsetMinutes;
  const openInfo = enriched?.hours
    ? computeOpenStatus({ currentOpeningHours:{ weekdayDescriptions: weekdays }, utcOffsetMinutes: offset, isOpen: enriched.hours.openNow ?? null }, { isLocal })
    : { isOpen: restaurant.isOpen, todayHours: restaurant.todayHours, is24Hours: restaurant.is24Hours };
  const openNow = openInfo.isOpen;
  const is24    = openInfo.is24Hours;
  const today   = placeDay(offset, isLocal); // null = unknown day over there → no "today"
  // Google's weekdayDescriptions start on Monday; getDay() is Sunday-based.
  const todayHrs = openInfo.todayHours || (weekdays.length && today!=null ? ((weekdays[(today+6)%7]||'').split(': ').slice(1).join(': ')||null) : null);
  const openText = is24 ? 'Open 24/7' : (openNow===true ? 'Open' : openNow===false ? 'Closed' : '');

  const Tag=({bg,color,children})=>(
    <span style={{background:bg,color,borderRadius:"999px",padding:`${t(fs(9),fs(5))} ${t(fs(16),fs(11))}`,fontSize:t(fs(15.5),fs(12.5)),fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
  );

  return (
    <motion.div initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{delay:Math.min(rank,8)*0.03}}
      style={{background:"#fff",borderRadius:t("28px","20px"),overflow:"hidden",boxShadow:t("0 24px 50px -30px rgba(22,17,13,.4)","0 12px 28px -18px rgba(22,17,13,.4)"),border:`1px solid ${ED_RULE}`}}>

      {/* Photo — reuse the carousel (rank badge + smart badges incl. Dish Specialist) at editorial
          height, with the wishlist heart overlaid top-right (smart badges shift left of it) */}
      <div style={{position:"relative"}}>
        <PhotoCarousel photos={photosToShow} rank={rank} badges={restaurant.badges||[]} height={t(360,200)}/>
      </div>

      <div style={{padding:t(`${fs(28)} ${fs(32)} ${fs(32)}`,`${fs(16)} ${fs(16)} ${fs(18)}`)}}>
        {cuisineLabel&&<div style={{color:ED_EAT,fontWeight:600,fontSize:t(fs(17),fs(13)),letterSpacing:"0.2px"}}>{cuisineLabel}</div>}
        <h3 style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:t(fs(38),fs(26)),lineHeight:1.04,color:ED_INK,margin:`${fs(4)} 0 0`,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{name}</h3>

        {/* Say it / Translate / rating / distance */}
        <div style={{display:"flex",gap:t(fs(16),fs(10)),alignItems:"center",flexWrap:"wrap",marginTop:t(fs(12),fs(8)),fontSize:t(fs(17),fs(13.5)),color:ED_INK3}}>
          <NameLanguageHelp placeId={restaurant.placeId||restaurant.id} name={name}/>
          {/* Source word: every star here is Google's (owned rows carry no rating) — quiet, no logo */}
          {restaurant.rating>0&&<span><span style={{color:"#E0922F"}}>★</span> <span style={{fontWeight:700,color:ED_INK2}}>{restaurant.rating.toFixed(1)}</span><span style={{fontSize:"0.8em",color:ED_INK3,marginLeft:"0.35em"}}>Google</span></span>}
          {restaurant.distanceMiles!=null&&<span>· {formatDistance(restaurant.distanceMiles)}</span>}
          {restaurant.priceStr&&<span>· {restaurant.priceStr}</span>}
        </div>

        {/* Street address — muted, single line, renders on phone + tablet */}
        {(restaurant.shortFormattedAddress||restaurant.formattedAddress||restaurant.vicinity)&&(
          <div style={{marginTop:t(fs(8),fs(6)),fontSize:t(fs(13.5),fs(12)),color:ED_INK3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            📍 {restaurant.shortFormattedAddress||restaurant.formattedAddress||restaurant.vicinity}
          </div>
        )}

        {/* Pill tags */}
        <div style={{display:"flex",gap:t(fs(10),fs(7)),flexWrap:"wrap",marginTop:t(fs(16),fs(11))}}>
          {restaurant.dineIn&&<Tag bg="#EAF0FB" color="#2E6FE0">🍴 Dine-in</Tag>}
          {restaurant.takeout&&<Tag bg="#E7F3EA" color="#2E7D46">📦 Takeout</Tag>}
          {restaurant.delivery&&<Tag bg="#FDEBD7" color="#C57A1F">🛵 Delivery</Tag>}
          {restaurant.hasDriveThru&&<Tag bg="#E0F2FE" color="#0277BD">🚗 Drive-Thru</Tag>}
          {restaurant.reservable&&<Tag bg="#FBE0DC" color="#C2392F">📅 Reservable</Tag>}
          {restaurant.isCashOnly&&<Tag bg="#FEF2F2" color="#DC2626">💵 Cash{restaurant.cashSource==='reviews'?' (reported)':''}</Tag>}
        </div>

        {/* Open bar */}
        {(openNow!==null||is24)&&(
          <div style={{marginTop:t(fs(18),fs(12)),background:openNow===false?"#FBE0DC":"#E7F3EA",borderRadius:t("16px","12px"),padding:t(`${fs(16)} ${fs(20)}`,`${fs(10)} ${fs(13)}`),fontSize:t(fs(18),fs(13.5)),fontWeight:600,color:openNow===false?"#C2392F":"#2E7D46",display:"flex",alignItems:"center",gap:t(fs(11),fs(8))}}>
            <span style={{width:t(fs(10),fs(8)),height:t(fs(10),fs(8)),borderRadius:"50%",background:is24?"#00BCD4":(openNow===false?"#C2392F":"#2E7D46"),flexShrink:0}}/>
            <span>{openText}</span>
            {todayHrs&&!is24&&<span style={{color:ED_INK3,fontWeight:500}}>· {todayHrs}</span>}
          </div>
        )}

        {/* Phone bar */}
        {phone&&(
          <a href={`tel:${phone}`} style={{marginTop:t(fs(14),fs(10)),background:"#EFF4FB",borderRadius:t("16px","12px"),padding:t(`${fs(18)} ${fs(20)}`,`${fs(11)} ${fs(13)}`),display:"flex",alignItems:"center",gap:t(fs(14),fs(10)),textDecoration:"none"}}>
            <span style={{fontSize:t(fs(24),fs(18))}}>📞</span>
            <span><span style={{display:"block",fontSize:t(fs(20),fs(13.5)),fontWeight:600,color:"#2E6FE0"}}>{phone}</span><span style={{fontSize:t(fs(15),fs(11)),color:ED_INK3}}>Tap to call</span></span>
          </a>
        )}

        {/* AI details — on the front card, above the actions */}
        <div style={{marginTop:t(fs(18),fs(13))}}>
          <AIDetailsSection placeId={restaurant.placeId||restaurant.id} placeName={name} lat={restaurant.lat} lng={restaurant.lng} page="PlacesToEat" kind="restaurant"/>
        </div>

        {/* Actions */}
        <div style={{display:"flex",gap:t(fs(12),fs(8)),marginTop:t(fs(20),fs(14))}}>
          <button onClick={onDirections} style={{flex:1,borderRadius:t("16px","12px"),padding:t(fs(15),fs(11)),fontSize:t(fs(18),fs(14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:ED_EAT,color:"#fff"}}>Directions</button>
          <button onClick={onShowOnMap} style={{flex:1,borderRadius:t("16px","12px"),padding:t(fs(15),fs(11)),fontSize:t(fs(18),fs(14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:ED_IVORY2,color:ED_INK2}}>📍 Map</button>
          <button onClick={()=>setExpanded(e=>!e)} style={{flex:1,borderRadius:t("16px","12px"),padding:t(fs(15),fs(11)),fontSize:t(fs(18),fs(14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:expanded?ED_INK:ED_IVORY2,color:expanded?"#fff":ED_INK2}}>{expanded?"Less ▴":"More ▾"}</button>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{marginTop:fs(20),display:"flex",flexDirection:"column",gap:fs(14)}}>

                {restaurant.customerFavorites?.length>0&&(
                  <div style={{padding:fs(16),background:"#FEF9EE",borderRadius:"16px",border:"1px solid #FDE68A"}}>
                    <div style={{fontSize:fs(13),fontWeight:700,color:"#D97706",letterSpacing:"0.5px",marginBottom:fs(9)}}>❤️ CUSTOMER FAVORITES</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:fs(8)}}>
                      {restaurant.customerFavorites.slice(0,6).map((f,i)=>{const l=f.dish||f.name||'';return l?(
                        <span key={i} style={{background:"#FDE68A",color:"#92400E",padding:`${fs(5)} ${fs(13)}`,borderRadius:"999px",fontSize:fs(15),fontWeight:600}}>{l.charAt(0).toUpperCase()+l.slice(1)}{f.mentions>2?` ×${f.mentions}`:''}</span>
                      ):null;})}
                    </div>
                  </div>
                )}

                {restaurant.bestTimeNote&&(
                  <div style={{padding:fs(16),background:"#E7F3EA",borderRadius:"16px",fontSize:fs(16),color:"#166534"}}>
                    <span style={{fontWeight:700,color:"#2E7D46"}}>🕐 Best time to visit · </span>{restaurant.bestTimeNote}
                  </div>
                )}

                {(hasAnySeating||parking)&&(
                  <div style={{display:"flex",gap:fs(14),flexWrap:"wrap"}}>
                    {hasAnySeating&&(
                      <div style={{flex:"1 1 240px",padding:fs(16),background:"#FAF7F0",borderRadius:"16px",border:`1px solid ${ED_RULE}`}}>
                        <div style={{display:"flex",alignItems:"center",marginBottom:fs(8)}}><span style={{fontSize:fs(17),fontWeight:700,color:ED_INK}}>🪑 Seating</span><TrustTag confirmed={seatingConfirmed}/></div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:fs(6)}}>
                          {restaurant.hasIndoorSeating&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>🏠 Indoor</span>}
                          {restaurant.hasOutdoorSeating&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>🌿 Outdoor</span>}
                          {restaurant.seating?.hasLoungeSeating&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>🛋️ Lounge</span>}
                        </div>
                      </div>
                    )}
                    {parking&&(
                      <div style={{flex:"1 1 240px",padding:fs(16),background:"#FAF7F0",borderRadius:"16px",border:`1px solid ${ED_RULE}`}}>
                        <div style={{display:"flex",alignItems:"center",marginBottom:fs(8)}}><span style={{fontSize:fs(17),fontWeight:700,color:ED_INK}}>🅿️ Parking</span><TrustTag confirmed={parkingConfirmed}/></div>
                        {parking.noParking?(
                          <div style={{fontSize:fs(15),color:"#C2392F"}}>{parking.noParkingNote}</div>
                        ):(
                          <div style={{display:"flex",flexWrap:"wrap",gap:fs(6)}}>
                            {parking.details?.length>0?parking.details.map((d,i)=>(
                              <span key={i} style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>{d.icon} {d.label}</span>
                            )):<span style={{fontSize:fs(15),color:ED_INK3}}>Parking available</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {restaurant.editorialSummary&&(
                  <div style={{padding:fs(16),background:"#F0F9FF",borderRadius:"16px",border:"1px solid #BAE6FD"}}>
                    <div style={{fontSize:fs(13),fontWeight:700,color:"#0369A1",letterSpacing:"0.5px",marginBottom:fs(6)}}>📖 ABOUT THIS PLACE</div>
                    <p style={{fontSize:fs(16),lineHeight:1.6,color:"#0C4A6E",margin:0}}>{restaurant.editorialSummary}</p>
                  </div>
                )}

                {restaurant.generativeSummary?.overview?.text&&(
                  <div style={{padding:fs(16),background:"#EFF6FF",borderRadius:"16px",border:"1px solid #BFDBFE"}}>
                    <div style={{fontSize:fs(13),fontWeight:700,color:"#1E40AF",letterSpacing:"0.5px",marginBottom:fs(6)}}>✨ AI VENUE SUMMARY ({restaurant.generativeSummary.disclosureText?.text||"Summarized with Gemini"})</div>
                    <p style={{fontSize:fs(16),lineHeight:1.6,color:"#1E3A8A",margin:0}}>{restaurant.generativeSummary.overview.text}</p>
                  </div>
                )}

                {weekdays.length>0&&(
                  <div style={{padding:fs(16),background:"#FAF7F0",borderRadius:"16px"}}>
                    <div style={{fontSize:fs(13),fontWeight:700,color:ED_INK3,letterSpacing:"0.5px",marginBottom:fs(8)}}>🕐 DAILY HOURS</div>
                    <div>
                      {weekdays.map((day,i)=>{
                        const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                        const isToday=DAY.findIndex(d=>day.startsWith(d))===today; // place's day, not the device's
                        return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:`${fs(4)} 0`,fontSize:fs(15),fontWeight:isToday?700:400,color:isToday?TEAL_DEEP:ED_INK2,borderBottom:i<6?`1px solid ${ED_RULE}`:"none"}}>
                          <span>{day.split(':')[0]}</span><span>{day.split(':').slice(1).join(':').trim()}</span>
                        </div>;
                      })}
                    </div>
                  </div>
                )}

                {restaurant.websiteUri&&(
                  <a href={restaurant.websiteUri} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:fs(12),padding:fs(16),background:"#F3E8FF",borderRadius:"16px",textDecoration:"none",color:"#7C3AED"}}>
                    <span style={{fontSize:fs(22)}}>🌐</span>
                    <span><span style={{display:"block",fontWeight:600,fontSize:fs(16)}}>Visit Website</span><span style={{fontSize:fs(14),color:ED_INK3}}>Menu &amp; reservations</span></span>
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── FILTER CHIP ─────────────────────────────────────────────────────────────
function Chip({ label, active, onClick, icon, color="#3B82F6" }) {
  return <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:"4px",padding:"6px 12px",borderRadius:"20px",border:active?`2px solid ${color}`:"1.5px solid #E2E8F0",background:active?`${color}12`:"#fff",color:active?color:GRAY,fontWeight:active?"700":"500",fontSize:"calc(12px*var(--fs))",cursor:"pointer",fontFamily:"inherit",flexShrink:0,whiteSpace:"nowrap"}}>{icon&&<span>{icon}</span>}{label}</button>;
}

// ─── MAP POPUP ────────────────────────────────────────────────────────────────
function buildPopup(r, idx) {
  const name    = r.displayName?.text||r.name||'Restaurant';
  const address = r.formattedAddress||r.shortFormattedAddress||'';
  const phone   = r.nationalPhoneNumber||r.internationalPhoneNumber||'';
  const photo   = r.photoUrl||r.photos?.[0]||null;
  const { isOpen, todayHours, is24Hours } = r;
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:260px;position:relative;">
      <div style="padding:12px;padding-top:14px;">
        <div style="font-weight:700;font-size:calc(14px*var(--fs));color:#1A2332;margin-bottom:5px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;" onclick="window.viewRestDetails&&window.viewRestDetails(${idx})">${name}</div>
        <div style="font-size:11px;color:#64748B;margin-bottom:6px;">${address}</div>
        <div style="font-size:calc(11px*var(--fs));padding:5px 8px;border-radius:6px;background:${is24Hours?'#E3F2FD':isOpen===true?'#F0FDF4':isOpen===false?'#FEF2F2':'#F5F5F5'};margin-bottom:6px;">
          <span style="font-weight:700;color:${is24Hours?'#1565C0':isOpen===true?'#15803D':isOpen===false?'#DC2626':'#9E9E9E'};">${is24Hours?'🔄 Open 24/7':isOpen===true?'● Open':isOpen===false?'● Closed':'● Hours N/A'}</span>
          ${todayHours&&!is24Hours?`<span style="color:#64748B;"> · ${todayHours}</span>`:''}
        </div>
        ${r.rating?`<div style="font-size:12px;color:#F59E0B;margin-bottom:8px;">★ <strong style="color:#1A2332;">${r.rating.toFixed(1)}</strong> <span style="color:#64748B;">(${(r.userRatingCount||0).toLocaleString()})</span><span style="color:#9E9E9E;font-size:calc(10px*var(--fs));"> Google</span>${r.distance?` · <span style="color:#3B82F6;">${r.distance}</span>`:''}</div>`:''}
        ${phone?`<a href="tel:${phone}" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:6px 10px;background:#EFF6FF;border-radius:6px;text-decoration:none;color:#3B82F6;font-size:calc(11px*var(--fs));font-weight:600;">📞 ${phone}</a>`:''}
        <div style="display:flex;gap:8px;">
          <button onclick="window.openDirFromMap&&window.openDirFromMap(${idx})" style="flex:1;padding:8px;border:none;border-radius:7px;background:#3B82F6;color:#fff;font-weight:600;font-size:11px;cursor:pointer;">🧭 Directions</button>
          <button onclick="window.viewRestDetails&&window.viewRestDetails(${idx})" style="flex:1;padding:8px;border:none;border-radius:7px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:11px;cursor:pointer;">📋 Details</button>
        </div>
      </div>
    </div>`;
}

// ─── SESSION CACHE ────────────────────────────────────────────────────────────
// Module-level cache of the most recent successful fetch. Survives navigation
// away from PlacesToEat and back (component unmount/remount cycle), so we
// don't re-hit the Google Places API just because the user navigated to a
// different page and came back. Each unique (location + filters + search)
// combination is its own cache key; if the user changes any filter the key
// changes and we fetch fresh. The explicit refresh button (forceNextRef)
// always bypasses this cache and forces a fresh fetch.
// Lost on full page reload (intentional — page reload is the user's explicit
// signal to reset state). Sized to one entry; toggling between two views
// will still re-fetch on each toggle since only the most recent is cached.
/** @type {{ paramsKey: string, restaurants: any[], fallbackInfo: any | null, displayCount: number } | null} */
let placesToEatSessionCache = null;

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function PlacesToEat() {
  const navigate = useNavigate();
  // iPad: wider centered column + editorial restaurant cards (design handoff).
  // Phone layout is unchanged — every tablet branch is gated on this.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  const [restaurants, setRestaurants]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  // ── REFRESH BUTTON ──
  // refreshTick changes when the user taps the header refresh button. It's a
  // dep of the fetch effect, so a tap re-runs the existing fetch. forceNextRef
  // is consumed once per fetch: it carries `forceRefresh: true` to Base44
  // (which forwards to the Worker, which skips its KV cache for that request).
  const [refreshTick, setRefreshTick]   = useState(0);
  const forceNextRef                    = useRef(false);
  const handleRefresh                   = () => {
    forceNextRef.current = true;
    setRefreshTick(t => t + 1);
  };
  const [viewMode, setViewMode]         = useState("list");
  const [selectedCuisines, setSelectedCuisines] = useState(new Set(["all"]));
  const [searchText, setSearchText]     = useState("");
  const [searchInput, setSearchInput]   = useState("");
  // Prefill + auto-run a search handed in from another surface (e.g. tapping a
  // trending dish chip on the home Right-Now strip → "Chinese Bakery Pastries").
  // Setting searchText triggers the results fetch below, so the finder opens
  // straight onto that dish instead of the generic nearby list.
  const routerLocation = useRouterLocation();
  useEffect(() => {
    const q = routerLocation.state?.presetQuery;
    if (q && typeof q === "string" && q.trim()) { setSearchInput(q); setSearchText(q.trim()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state?.presetQuery]);
  const [radius, setRadius]             = useState(25); // wide net; no radius UI — results show nearest-first
  const [displayCount, setDisplayCount] = useState(20);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false); // advanced filters live in the shared FilterSheet
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const [showLocPicker, setShowLocPicker] = useState(false);
  // Collapsible "You are here" tooltip on the map view. Expanded shows the
  // full 3-line card (heading + Current/Selected + city/state); collapsed
  // shrinks to a "📍 You are here ⌄" pill that taps to expand.
  const [userPinExpanded, setUserPinExpanded] = useState(true);
  useEffect(() => {
    /** @type {any} */ (window)._gsPTEUserPin = () => setUserPinExpanded(e => !e);
    return () => { delete /** @type {any} */ (window)._gsPTEUserPin; };
  }, []);
  // Analytics: log a page_view once on mount.
  useEffect(() => { logEvent('page_view', {}, 'PlacesToEat'); }, []);
  const [dirModal, setDirModal]         = useState({ open:false, lat:null, lng:null, name:'', address:'' });
  const [fallbackInfo, setFallbackInfo]  = useState(null);
  // Phase 1.5 "Also serves X" banner state. Populated when the backend
  // returns fallbackPlaces for a strict 0-result search (e.g. "Mang Inasal"
  // -> "Filipino"). Shape: { cuisine: 'Filipino', queryLabel: 'chicken inasal' }.
  const [fallbackBanner, setFallbackBanner] = useState(null);

  // Advanced filters
  const [filterOpenNow,   setFilterOpenNow]   = useState(false);
  const [filterVibes,     setFilterVibes]     = useState({});
  const [filterDietary,   setFilterDietary]   = useState({});
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [filterMaxPrice,  setFilterMaxPrice]  = useState(0);
  const [filterParking,   setFilterParking]   = useState(false);
  const [filterOutdoor,   setFilterOutdoor]   = useState(false);
  const [filterIndoor,    setFilterIndoor]    = useState(false);
  const [filterDriveThru, setFilterDriveThru] = useState(false);
  const [filterBakery,    setFilterBakery]    = useState(false);
  const [filterBars,      setFilterBars]      = useState(false);

  const cardRefs       = useRef({});
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const cuisineScrollRef = useRef(null);

  const { activeLocation, locationMode } = useLocation();
  // Device clock == place clock only when the user is physically at the active
  // location. Drives which clock Open/Closed may trust (see computeOpenStatus).
  const isLocal = locationMode === 'current' || activeLocation?.placeType === 'current_location';
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locationText = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);

  useEffect(() => {
    setRadius(25); // fixed wide net (radius filter removed app-wide)
  }, [activeLocation?.placeId]);

  // Multi-select cuisine helpers
  const toggleCuisine = (id) => {
    setSelectedCuisines(prev => {
      const next = new Set(prev);
      if (id === 'all') return prev.has('all') ? new Set() : new Set(['all']);
      next.delete('all');
      if (next.has(id)) { next.delete(id); if (next.size === 0) return new Set(['all']); }
      else next.add(id);
      return next;
    });
  };

  // Primary cuisine for backend fetch: single value (for dietary shortcuts) or 'all'
  const primaryCuisine = useMemo(() => {
    if (selectedCuisines.size === 1) return [...selectedCuisines][0];
    return 'all';
  }, [selectedCuisines]);

  // Which cuisines need client-side type filtering (non-special, non-dietary, non-all)
  const SPECIAL_CUISINES = new Set(['all','fine','budget','latenight','halal','kosher','vegan','vegetarian','dessert']);
  const cuisineTypeFilter = useMemo(() => {
    const active = [...selectedCuisines].filter(c => !SPECIAL_CUISINES.has(c));
    if (active.length === 0) return null;
    return new Set(active.flatMap(c => CUISINE_TYPE_MAP[c] || []));
  }, [selectedCuisines]);

  const activeFilterCount = [
    filterOpenNow, Object.values(filterVibes).some(Boolean),
    Object.values(filterDietary).some(Boolean),
    filterMinRating>0, filterMaxPrice>0,
    filterParking, filterOutdoor, filterIndoor, filterDriveThru, filterBakery, filterBars,
    !selectedCuisines.has('all') && selectedCuisines.size > 0,
  ].filter(Boolean).length;

  // Count of filters that live INSIDE the FilterSheet (Open Now and the cuisine
  // scroller stay inline) — drives the "Filters · N" chip and the sheet's Clear.
  const sheetFilterCount = [
    filterBakery, filterBars,
    Object.values(filterVibes).some(Boolean),
    Object.values(filterDietary).some(Boolean),
    filterMinRating>0, filterMaxPrice>0,
  ].filter(Boolean).length;

  // ── FETCH ──────────────────────────────────────────────────────────────────
  // Fetches for: cuisine tab change, radius change, search text, location change.
  // Also fetches dedicated dietary results when dietary filters are active,
  // then MERGES them with the main results so filtering actually finds something.
  useEffect(() => {
    if (!lat || !lng) { setLoading(false); return; } // no location yet — don't spin forever
    // Race-condition cleanup flag. The useEffect re-fires on every filter /
    // radius / search change. If an older slow fetch resolves AFTER a newer
    // fast fetch, the older empty/wrong result could overwrite the newer
    // correct result and leave the UI stuck on stale data. Setting `ignore`
    // to true in the cleanup function makes any in-flight fetch from the
    // previous render no-op when it eventually resolves.
    let ignore = false;

    // Consume the force-refresh flag once. Subsequent fetches triggered by
    // unrelated dep changes (radius, filters) won't pay for a forced refresh.
    const force = forceNextRef.current;
    forceNextRef.current = false;

    // ── SESSION-CACHE HYDRATE ──────────────────────────────────────────────
    // Cost-saving: skip the fetch entirely on plain page re-entry when the
    // user's filter/location params exactly match the most recent successful
    // fetch from earlier in this session. Filter/radius/search changes
    // produce a different paramsKey → cache miss → fetch as before. Explicit
    // refresh button (force=true) bypasses cache.
    const paramsKey = JSON.stringify({
      lat, lng, radius, primaryCuisine, searchText,
      filterBakery, filterBars, filterOpenNow, filterMinRating, filterMaxPrice,
      filterParking, filterOutdoor, filterIndoor, filterDriveThru,
      filterVibes, filterDietary,
    });
    if (!force && placesToEatSessionCache && placesToEatSessionCache.paramsKey === paramsKey) {
      setRestaurants(/** @type {any} */ (placesToEatSessionCache.restaurants));
      setFallbackInfo(placesToEatSessionCache.fallbackInfo);
      setDisplayCount(placesToEatSessionCache.displayCount || 20);
      setLoading(false);
      setError(null);
      return () => { ignore = true; };
    }

    setLoading(true); setError(null); setFallbackInfo(null);

    (async () => {
      try {
        // ── UNIFIED FETCH (v5.4) ─────────────────────────────────────────────
        // Previously we had split fetches (bakeryFetch, sportsBarFetch,
        // dietaryFetches) that bypassed mainFetch entirely — which meant
        // radius, Open Now, Drive-Thru, and every other chip were silently
        // dropped whenever Bakery/Sports Bar/Dietary was the only active filter.
        //
        // Now every fetch flows through mainFetch. The backend's Semantic
        // Text Compiler assembles every chip into one natural-language query
        // ("bakery with drive-thru", "sports bar with family friendly",
        // "halal tacos restaurant") so any combination works.

        const activeDietaryKeys = Object.entries(filterDietary).filter(([_,v]) => v).map(([k]) => k);
        const firstDietary = activeDietaryKeys[0] || '';

        // Keep enhancedSearchQuery as-is — backend dedups repeated words so
        // prepending firstDietary is safe even when the user typed it.
        const enhancedSearchQuery = searchText
          ? [firstDietary, searchText, filterParking ? 'with parking' : ''].filter(Boolean).join(' ')
          : searchText;

        // Bump the candidate pool when client-side filters will trim results.
        const clientFilterActive = filterOutdoor || filterParking || filterDriveThru;

        const { data } = await callWorker(ROUTE.getRestaurants, {
          latitude: lat, longitude: lng,
          radius: radius * 1609,
          maxResults: clientFilterActive ? 60 : 40,
          cuisine: primaryCuisine,
          searchQuery: enhancedSearchQuery,
          // Server-side native Google filters
          filterOpenNow,
          filterMinRating,
          filterMaxPrice,
          // Pass the active dietary chip so backend can tag matches even when
          // searchQuery is set.
          activeDietary: firstDietary || null,
          // Full filter state — backend's Semantic Text Compiler turns these
          // into the query sent to Google.
          filterDriveThru, filterOutdoor, filterIndoor, filterParking,
          filterBakery, filterBars,
          filterVibes, filterDietary,
          forceRefresh: force,
        });
        if (ignore) return; // a newer fetch already resolved — drop this one

        const places = data?.places || data?.restaurants || [];
        if (data?.fallbackInfo) setFallbackInfo(data.fallbackInfo);

        // Phase 1.5 "Also serves X" — if strict dish search returned 0 exact
        // matches but the backend found cuisine-umbrella restaurants in the
        // candidate pool, use those as the displayed list + show a banner
        // explaining what happened. Better than a dead-end "no results".
        const fallbackPlaces = data?.fallbackPlaces || [];
        const useFallback = places.length === 0 && fallbackPlaces.length > 0;

        if (places.length > 0 || useFallback) {
          const sourcePlaces = useFallback ? fallbackPlaces : places;
          const processed = sourcePlaces.map((/** @type {any} */ p) => processRest(p, lat, lng, isLocal));
          setRestaurants(processed);
          setDisplayCount(20);
          setError(null); // Clear any old errors on success
          setFallbackBanner(useFallback
            ? { cuisine: data.fallbackCuisine, queryLabel: data.fallbackQueryLabel }
            : null);
          // Populate the session cache so a later re-entry with the same
          // params hydrates instantly without re-hitting the API.
          placesToEatSessionCache = {
            paramsKey,
            restaurants: processed,
            fallbackInfo: data?.fallbackInfo || null,
            displayCount: 20,
          };
          // Analytics: log a search event so we can measure tier accuracy,
          // result counts, and which queries return zero results. Tag fallback
          // events distinctly so we can monitor how often the cuisine-umbrella
          // recovery kicks in.
          logSearch('eat', searchText, {
            cuisine: primaryCuisine,
            radius,
            resultCount: processed.length,
            firstTier: processed[0]?.tier ?? null,
            fallback: useFallback || undefined,
            fallbackCuisine: useFallback ? data.fallbackCuisine : undefined,
          });

          // Note: eager top-5 hydratePlaceDetails was removed once the
          // AI Details panel went live. The expanded card now fetches
          // Place Details + Claude synthesis lazily on first expand via
          // getAIDetails (cached 30 days globally). This eliminates the
          // ~$0.10/search of wasted spend that was happening when the
          // hydrated reviews weren't rendered anywhere.
        } else {
          setRestaurants([]); // Clear stale results so the UI doesn't show "67 results" from a prior fetch
          setFallbackBanner(null);
          setError(data?.error || "No restaurants found near this location."); // honest copy: 25mi is already the widest net — no radius left to expand
          // Analytics: zero-result searches are the most valuable to track —
          // every empty result is a search-quality bug or a coverage gap.
          logZeroResults('eat', searchText, {
            cuisine: primaryCuisine,
            radius,
          });
        }
      } catch(e) {
        if (ignore) return; // ignore stale-fetch errors too
        setError(`Failed to load: ${e.message}`);
      }
      finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => { ignore = true; };
  // Every filter is now part of the backend's Semantic Text Compiler payload,
  // so every change must trigger a re-fetch. Using JSON.stringify for the
  // object states (filterVibes, filterDietary) so React sees deep changes.
  }, [lat, lng, isLocal, radius, primaryCuisine, searchText, filterBakery, filterBars, filterOpenNow, filterMinRating, filterMaxPrice, filterParking, filterOutdoor, filterIndoor, filterDriveThru, JSON.stringify(filterVibes), JSON.stringify(filterDietary), refreshTick]);

  // ── FILTER + SORT ──────────────────────────────────────────────────────────
  // v5.3: Backend Semantic Text Compiler now sends a single natural-language
  // query to Google (e.g. "mexican restaurant with drive-thru and family
  // friendly"). Google's AI pre-filters the results, so we DO NOT re-filter
  // client-side for Seating/Parking/Drive-Thru/Bakery/Bars/Vibes/Dietary —
  // doing so would strip valid matches whenever Google omits the corresponding
  // boolean tag in the JSON response (which is common).
  //
  // Kept here: filters that use Google's native query params (openNow,
  // minRating, maxPrice) — safe to reapply as a UI safety net — and the
  // multi-select cuisine type filter (a different mechanism).
  const filtered = useMemo(() => {
    let r = [...restaurants];

    // ── LATE NIGHT STRICT FRONTEND BOUNCER (MATH-BASED) ──
    // Backend's Bouncer uses regex on the hours[] array. This frontend Bouncer
    // converts todayHours into 24h math so literally zero restaurants closing
    // before 10 PM survive, regardless of how Google formats the string.
    if (selectedCuisines.has('latenight')) {
      r = r.filter(x => {
        if (x.is24Hours) return true;
        if (!x.todayHours || x.todayHours.toLowerCase().includes('closed')) return false;
        const parts = x.todayHours.split(/[-–]| to /i);
        let closeStr = (parts.length > 1 ? parts[parts.length - 1] : x.todayHours).trim().toLowerCase();
        if (closeStr.includes('midnight')) return true;
        const match = closeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)/);
        if (!match) return false;
        let hour = parseInt(match[1], 10);
        const min = parseInt(match[2] || 0, 10);
        const ampm = match[3];
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        const timeValue = hour + (min / 60);
        return timeValue >= 22 || (timeValue >= 0 && timeValue <= 5);
      });
    }

    if (filterOpenNow)    r = r.filter(x => x.isOpen === true);
    if (filterMinRating>0) r = r.filter(x => (x.rating||0) >= filterMinRating);
    if (filterMaxPrice>0)  r = r.filter(x => !x.priceLevel || (parseInt(x.priceLevel)||0) <= filterMaxPrice);
    // Client-side cuisine type filtering (multi-select) — unchanged
    if (cuisineTypeFilter && cuisineTypeFilter.size > 0) {
      r = r.filter(x => {
        const types = x.types || [];
        const pt = x.primaryType || '';
        return types.some(t => cuisineTypeFilter.has(t)) || cuisineTypeFilter.has(pt);
      });
    }
    // Sort — when Sports Bar vibe is active, rank by sportsScore descending (best match first)
    const hasActiveSearch = !!searchText?.trim();
    if (filterVibes['sportsBar']) {
      r.sort((a,b) => (b.sportsScore||0) - (a.sportsScore||0));
    } else if (hasActiveSearch && r.some(x => x.backendRank)) {
      // Single unified ranking (the Nearby/Best toggle was removed). For an
      // active dish search the worker already ordered results by
      // distance-band → dish tier (Dish Specialist / Authentic) → non-chain
      // before chain → quality, and stamped backendRank — trust it directly.
      r.sort((a,b) => (a.backendRank||999) - (b.backendRank||999));
    } else {
      // Browsing / no active dish search → nearest first.
      r.sort((a,b)=>(a.distanceMiles||999)-(b.distanceMiles||999));
    }
    return r;
  }, [restaurants, filterBars, filterOpenNow, filterParking, filterOutdoor, filterIndoor, filterDriveThru, filterBakery, filterMinRating, filterMaxPrice, cuisineTypeFilter, filterVibes, filterDietary, searchText]);

  // ── T1.15: BATCH ENRICH THE VISIBLE PAGE OF OWNED CARDS ──────────────────
  // Was: every owned card fired its own /places/enrich-owned on mount (up to 20
  // calls per page). Now the page's owned cards go up in ONE batched call (the
  // worker caps a batch at 20 = exactly one page). ownedEnrich[key] semantics:
  // undefined = batch pending, payload = result, null = batch missed/errored →
  // that card's own single-call fallback runs (same KV cache server-side).
  const [ownedEnrich, setOwnedEnrich] = useState({});
  const ownedEnrichAsked = useRef(new Set());
  useEffect(() => {
    const owned = filtered.slice(0, displayCount)
      .filter(r => r.source === 'owned')
      .map(r => ({ id: r.id || r.placeId, name: r.displayName?.text || r.name, lat: r.lat, lng: r.lng }))
      .filter(r => r.id && !ownedEnrichAsked.current.has(r.id));
    if (!owned.length) return;
    owned.forEach(r => ownedEnrichAsked.current.add(r.id));
    (async () => {
      for (let i = 0; i < owned.length; i += 20) {
        const chunk = owned.slice(i, i + 20);
        const { data } = await callWorker('places/enrich-owned', { places: chunk, maxPhotos: 3 });
        const res = data?.results || {};
        setOwnedEnrich(prev => { const nx = { ...prev }; chunk.forEach(r => { nx[r.id] = res[r.id] ?? null; }); return nx; });
      }
    })();
  }, [filtered, displayCount]);

  const clearFilters = () => {
    setFilterOpenNow(false); setFilterVibes({}); setFilterDietary({});
    setFilterBakery(false); setFilterBars(false);
    setFilterMinRating(0); setFilterMaxPrice(0); setFilterParking(false);
    setFilterOutdoor(false); setFilterIndoor(false); setFilterDriveThru(false);
    setSelectedCuisines(new Set(['all']));
  };

  // Sheet-scoped clear — resets only the groups the FilterSheet owns (keeps the
  // inline Open Now chip + cuisine scroller selection untouched).
  const clearSheetFilters = () => {
    setFilterBakery(false); setFilterBars(false);
    setFilterVibes({}); setFilterDietary({});
    setFilterMinRating(0); setFilterMaxPrice(0);
  };

  const handleSearch = () => setSearchText(searchInput.trim());

  // ── LAZY PHOTO LABELING ON LOAD MORE ────────────────────────────────────
  // Backend eager-labels the top 20 cards. When the user taps "Load More"
  // the first time (reveals cards 21-40), we fire /label-photos for those
  // 20 places so their first photo matches the search dish. Cards 41+ stay
  // in Google's original photo order to keep the cost ceiling firm.
  const handleLoadMore = async () => {
    const nextCount = Math.min(displayCount + 20, filtered.length);
    setDisplayCount(nextCount);  // Reveal immediately — labeling runs in background

    // Only lazy-label when crossing into the 21-40 range AND a search is active.
    const query = (searchText || '').toLowerCase().trim();
    if (!query) return;
    if (displayCount >= 40) return;  // 41+ batch — skip labeling

    const startIdx = displayCount;
    const endIdx = Math.min(40, nextCount);
    const targets = filtered.slice(startIdx, endIdx).filter(p => !p.photosLabeled);
    if (targets.length === 0) return;

    const queryWords = query.split(/\s+/).filter(w => w.length >= 3);
    if (queryWords.length === 0) return;

    await Promise.all(targets.map(async (place) => {
      try {
        const photos = (place.photos || []).slice(0, 5).filter(p => p?.name || typeof p === 'string');
        if (!photos.length) return;
        const res = await fetch(`${WORKER_URL}/label-photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placeId: place.id || place.placeId,
            photos: photos.map(p => ({ name: p?.name || p }))
          })
        });
        if (!res.ok) return;
        const { labels } = await res.json();
        if (!labels) return;

        const isMatch = (name) => {
          const tag = (labels[name] || '').toString().toLowerCase();
          return queryWords.some(w => tag.includes(w));
        };
        const allPhotos = place.photos || [];
        const matched = allPhotos.filter(ph => isMatch(ph?.name || ph));
        if (matched.length === 0) return;
        const rest = allPhotos.filter(ph => !matched.includes(ph));

        // Update the underlying restaurants array so derived `filtered` re-renders
        setRestaurants(prev => prev.map(p =>
          (p.id === place.id || p.placeId === place.placeId)
            ? { ...p, photos: [...matched, ...rest].map(ph => photoSrc(ph, 800)), photosLabeled: true }
            : p
        ));
      } catch (_e) {
        // Best-effort — label failure shouldn't block the user
      }
    }));
  };

  const handleShowOnMap = (idx) => {
    setSelectedMapIndex(idx);
    setViewMode("map");
    setTimeout(()=>{
      const r=filtered[idx];
      if(mapInstanceRef.current&&r?.lat&&r?.lng)mapInstanceRef.current.setView([r.lat,r.lng],16);
    },300);
  };

  // ── MAP ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode!=="map"||!mapRef.current||!lat||!lng) return;
    const init = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
      const map = window.L.map(mapRef.current).setView([lat,lng],14);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
      mapInstanceRef.current=map; window.mapInstance=map;
      window.viewRestDetails=(i)=>{setViewMode("list");setTimeout(()=>cardRefs.current[i]?.scrollIntoView({behavior:"smooth",block:"center"}),150);};
      window.openDirFromMap=(i)=>{const r=filtered[i];r&&setDirModal({open:true,lat:r.lat,lng:r.lng,name:r.name,address:r.formattedAddress||r.shortFormattedAddress||r.vicinity||r.address||''});};
      // User-location pin with collapsible "📍 You are here" tooltip below
      // (anti-overlap with restaurant popups above). Same pattern as
      // ThingsToDo TierMapOverlay + MoneyExchange map.
      const userMode = activeLocation?.mode === 'navigate' ? 'Selected location' : 'Current location';
      const userLabel = locationText || '';
      const userTooltipHtml = userPinExpanded
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsPTEUserPin&&window._gsPTEUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:calc(10px*var(--fs));font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:calc(12px*var(--fs));margin-bottom:2px;padding-right:24px;">📍 You are here</div><div style="font-weight:700;color:#4285F4;font-size:calc(11px*var(--fs));margin-bottom:2px;">${userMode}</div><div style="color:#64748B;font-size:calc(10px*var(--fs));line-height:1.3;">${userLabel}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsPTEUserPin&&window._gsPTEUserPin()"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">📍 You are here</span><span style="color:#64748B;font-size:calc(10px*var(--fs));font-weight:700;">⌄</span></div>`;
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:'<div style="width:14px;height:14px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',iconSize:[14,14],className:""})}).addTo(map).bindTooltip(userTooltipHtml,{permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:true});
      filtered.slice(0,displayCount).forEach((r,i)=>{
        if(!r.lat||!r.lng)return;
        const isSelected = i === selectedMapIndex;
        const pinBg    = isSelected ? "#EA580C" : BLUE;
        const pinShadow= isSelected ? "0 0 0 4px rgba(234,88,12,0.35), 0 3px 10px rgba(234,88,12,0.5)" : "0 2px 8px rgba(59,130,246,0.4)";
        const pinSize  = isSelected ? 38 : 30;
        const pinFont  = isSelected ? "14px" : "12px";
        const pinBorder= isSelected ? "3px solid #fff" : "2px solid #fff";
        const marker = window.L.marker([r.lat,r.lng],{icon:window.L.divIcon({html:`<div style="width:${pinSize}px;height:${pinSize}px;background:${pinBg};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${pinFont};box-shadow:${pinShadow};border:${pinBorder};">${i+1}</div>`,iconSize:[pinSize,pinSize],className:""})}).addTo(map).bindPopup(buildPopup(r,i),{maxWidth:270,autoPan:true,autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true,className:"gs-rest-popup"});
        if(isSelected) { marker.openPopup(); }
      });
    };
    if (!window.L) {
      const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(link);
      const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.onload=init;document.head.appendChild(script);
    } else { init(); }
    return()=>{delete window.mapInstance;delete window.viewRestDetails;delete window.openDirFromMap;if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null;}};
  },[viewMode,filtered,lat,lng,displayCount,selectedMapIndex,userPinExpanded,locationText,activeLocation?.mode]);

  const stats = {
    total: filtered.length,
    open:  filtered.filter(r=>r.isOpen===true).length,
    withParking: filtered.filter(r=>r.parking&&!r.parking.noParking).length,
  };

  return (
    <div className="font-sans" style={{background:IVORY,minHeight:"100vh"}}>

      {/* ── HEADER + LOCATION + SEARCH/FILTER BAND — shared FinderHeader (Passport
          Standard). The page keeps owning LocationModePicker; search bar, cuisine
          scroller and quick filters ride along as children. ── */}
      <FinderHeader
        catKey="food"
        icon={Utensils}
        title="Places to Eat"
        count={(!lat||!lng||loading||error)?null:stats.total}   /* stale-count rule: never show the previous fetch's number mid-load */
        countNoun="results"
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh places"
        onChangeLocation={()=>setShowLocPicker(true)}
        locationLabel={locationText}
        isCity={isCity}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
      >
        {/* Search bar — food-coral submit button */}
        <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
          <input
            value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleSearch()}
            placeholder="Search dish or restaurant..."
            className="font-sans"
            style={{flex:1,padding:"14px 16px",borderRadius:"14px",border:"1px solid #F0E9DC",fontSize:"calc(15px*var(--fs))",outline:"none",color:"#0F1419",background:"#fff",boxShadow:"0 1px 3px rgba(15,20,25,0.04)"}}
          />
          <button
            onClick={handleSearch}
            className="font-sans"
            style={{padding:"14px 18px",borderRadius:"14px",border:"none",background:CAT.food.ink,color:"#fff",fontWeight:"800",fontSize:"calc(16px*var(--fs))",cursor:"pointer",boxShadow:`0 6px 18px -6px ${CAT.food.ink}80`}}
          >→</button>
          {searchText && (
            <button
              onClick={()=>{setSearchInput("");setSearchText("");}}
              className="font-sans"
              style={{padding:"14px 14px",borderRadius:"14px",border:"1px solid #F0E9DC",background:"#fff",color:"#475569",fontWeight:"700",fontSize:"calc(14px*var(--fs))",cursor:"pointer"}}
            >✕</button>
          )}
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"14px"}}><DistanceUnitToggle unit={unit} setUnit={setUnit} variant="light" /></div>

        {/* List/Map view toggle removed — list is the primary view; a card's
            "📍 Map" button still opens that place on the map. */}

        {/* Cuisine quick-scroll — the door's signature, kept inline (multi-select;
            dietary types excluded — they live in the FilterSheet's Dietary group) */}
        <div ref={cuisineScrollRef} style={{display:"flex",gap:"6px",overflowX:"auto",paddingBottom:"6px",scrollbarWidth:"none",marginBottom:"8px"}}>
          {CUISINES.filter(c=>!['vegetarian','vegan','halal','kosher'].includes(c.id)).map(c=>{
            const active = selectedCuisines.has(c.id);
            return (
              <button key={c.id} onClick={()=>toggleCuisine(c.id)} style={{flexShrink:0,display:"flex",alignItems:"center",gap:"4px",padding:"6px 12px",borderRadius:"20px",border:active?`2px solid ${c.special?GOLD:BLUE}`:"1.5px solid #E2E8F0",background:active?(c.special?`${GOLD}15`:BLUE_LT):"#fff",color:active?(c.special?ORANGE:BLUE):GRAY,fontWeight:active?"700":"500",fontSize:"calc(12px*var(--fs))",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                <span>{c.icon}</span><span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick filters: Open Now stays inline; every other advanced group lives in the FilterSheet */}
        <div style={{display:"flex",alignItems:"center",gap:"8px",overflowX:"auto",scrollbarWidth:"none",paddingBottom:"6px"}}>
          <button onClick={()=>setFilterOpenNow(!filterOpenNow)} aria-pressed={filterOpenNow} className="font-sans" style={{display:"flex",alignItems:"center",gap:"5px",padding:"7px 13px",borderRadius:"20px",flexShrink:0,border:filterOpenNow?`2px solid ${GREEN}`:"1.5px solid #E2E8F0",background:filterOpenNow?`${GREEN}18`:"#fff",color:filterOpenNow?GREEN:GRAY,fontWeight:filterOpenNow?"700":"500",fontSize:"calc(12px*var(--fs))",cursor:"pointer"}}><Clock size={13} strokeWidth={2}/>Open Now</button>
          <button onClick={()=>setFilterSheetOpen(true)} className="font-sans" style={{display:"flex",alignItems:"center",gap:"5px",padding:"7px 13px",borderRadius:"20px",flexShrink:0,border:sheetFilterCount>0?`2px solid ${CAT.food.ink}`:"1.5px solid #E2E8F0",background:sheetFilterCount>0?`${CAT.food.ink}18`:"#fff",color:sheetFilterCount>0?CAT.food.ink:GRAY,fontWeight:sheetFilterCount>0?"700":"500",fontSize:"calc(12px*var(--fs))",cursor:"pointer"}}><SlidersHorizontal size={13} strokeWidth={2}/>Filters{sheetFilterCount>0?` · ${sheetFilterCount}`:""}</button>
        </div>
        {/* Substat — honest mono open count (the total lives beside the header pill) */}
        {!(!lat||!lng||loading||error)&&stats.open>0&&(
          <div className="font-mono uppercase font-semibold" style={{fontSize:"calc(10.5px*var(--fs))",letterSpacing:"0.12em",color:"#736657",margin:"0 0 6px"}}>{stats.open} open now</div>
        )}

      </FinderHeader>

      {/* ── CONTENT ── */}
      {(!lat||!lng)?(
        /* No location yet (first run, GPS denied, cleared storage). Sits AHEAD of
           the loading branch so a no-location cold start can never show a spinner —
           `loading` starts true and the fetch effect bails before clearing it. */
        <div className={`px-4 ${colWrap} mx-auto`} style={{paddingTop:"40px"}}>
          <FinderEmptyState catKey="food" icon={MapPin} title="Choose a location to search" reason="Use your current location or pick a city to find restaurants nearby" actionLabel="Choose location" onAction={()=>setShowLocPicker(true)}/>
        </div>
      ):loading?(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:"calc(40px*var(--fs))",marginBottom:"12px",animation:"spin 2s linear infinite"}}>🍽️</div>
          <div style={{color:GRAY,fontWeight:"600"}}>
            {Object.values(filterDietary).some(Boolean)
              ? `Searching for ${Object.entries(filterDietary).filter(([_,v])=>v).map(([k])=>k.charAt(0).toUpperCase()+k.slice(1)).join(' & ')} restaurants...`
              : 'Finding restaurants...'}
          </div>
        </div>
      ):error?(
        /* Was a dead "Expand Radius" button (every search already runs the full
           25-mile net). Honest actions instead: retry a failed load; move the
           search or clear filters/search on an empty result. */
        /^Failed/.test(error)
          ? <div className={`px-4 ${colWrap} mx-auto`} style={{paddingTop:"40px"}}><FinderEmptyState catKey="food" icon={AlertCircle} title="Couldn't load restaurants" reason={error} actionLabel="Try again" onAction={handleRefresh} secondaryLabel="Search somewhere else" onSecondary={()=>setShowLocPicker(true)}/></div>
          : <div className={`px-4 ${colWrap} mx-auto`} style={{paddingTop:"40px"}}><FinderEmptyState catKey="food" icon={SearchX} title="No restaurants found" reason={error} actionLabel="Search somewhere else" onAction={()=>setShowLocPicker(true)} secondaryLabel={(activeFilterCount>0||searchText)?"Clear filters":"Try again"} onSecondary={(activeFilterCount>0||searchText)?()=>{clearFilters();setSearchInput("");setSearchText("");}:handleRefresh}/></div>
      ):viewMode==="list"?(
        <div style={isTablet
          ? {maxWidth:1024,margin:"0 auto",padding:"0 24px 170px",display:"flex",flexDirection:"column",gap:"30px"}
          : {width:"100%",padding:"0 12px 100px",display:"flex",flexDirection:"column",gap:"16px"}}>
          {filtered.length===0?(
            <FinderEmptyState catKey="food" icon={SearchX} title="No matches" reason="Nothing here passes the current filters." actionLabel="Search somewhere else" onAction={()=>setShowLocPicker(true)} secondaryLabel={(activeFilterCount>0||searchText)?"Clear filters":undefined} onSecondary={(activeFilterCount>0||searchText)?()=>{clearFilters();setSearchInput("");setSearchText("");}:undefined}/>
          ):(<>
            {/* 25mi is already the ceiling, so a radius bump was a no-op — the honest
                "expand" is moving the search. (FallbackDisclaimer's internal button
                copy belongs to that component, not this call site.) */}
            <FallbackDisclaimer
              fallbackInfo={fallbackInfo}
              onExpandRadius={() => setShowLocPicker(true)}
            />
            <AlsoServesBanner
              banner={fallbackBanner}
              onSearchElsewhere={() => setShowLocPicker(true)}
            />
            {/* Subtle cross-promo: if the user typed a coffee query, point
                them to the dedicated CoffeeFinder feature for more options.
                Re-evaluates on every searchText change so a new (non-coffee)
                search automatically removes the hint. */}
            {/\b(coffee|espresso|latte|cappuccino|mocha)\b/i.test(searchText || '') && (
              <div style={{padding:"8px 12px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"8px",fontSize:"calc(12px*var(--fs))",color:"#92400E",display:"flex",alignItems:"center",gap:"6px"}}>
                <span>☕</span>
                <span>Looking for more coffee spots? <button onClick={() => navigate(createPageUrl("CoffeeFinder"), { state: { from: 'PlacesToEat' } })} style={{background:"transparent",border:"none",padding:0,color:"#92400E",fontWeight:"700",textDecoration:"underline",cursor:"pointer",fontFamily:"inherit",fontSize:"inherit"}}>Try the Coffee Finder feature in this app</button></span>
              </div>
            )}
            {filtered.slice(0,displayCount).map((r,i)=>{
              const Card = RestaurantCardTablet;
              return (
              <div key={r.id||i} ref={el=>cardRefs.current[i]=el}>
                <Card
                  restaurant={r} rank={i+1}
                  batchEnrich={ownedEnrich[r.id||r.placeId]}
                  isTablet={isTablet}
                  onDirections={()=>setDirModal({open:true,lat:r.lat,lng:r.lng,name:r.name,address:r.formattedAddress||r.shortFormattedAddress||r.vicinity||r.address||''})}
                  onShowOnMap={()=>handleShowOnMap(i)}
                  formatDistance={formatDistance}
                  isLocal={isLocal}
                />
              </div>
            );})}
            {displayCount<filtered.length&&(
              <button onClick={handleLoadMore} style={{padding:"14px",borderRadius:"12px",border:`2px solid ${BLUE}`,background:"#fff",color:BLUE,fontWeight:"700",fontSize:"calc(14px*var(--fs))",cursor:"pointer",fontFamily:"inherit",marginTop:"4px"}}>
                Load More · {filtered.length-displayCount} remaining
              </button>
            )}
          </>)}
        </div>
      ):(
        <div style={{position:"relative"}}>
          <div ref={mapRef} style={{height:"calc(100vh - 200px)",width:"100%"}}/>
          <button onClick={()=>setViewMode("list")} style={{position:"fixed",top:"calc(50px + env(safe-area-inset-top) + 10px)",right:"14px",zIndex:1200,background:"#fff",borderRadius:"50%",width:"38px",height:"38px",border:"none",boxShadow:"0 2px 8px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"calc(18px*var(--fs))",color:DARK}}>✕</button>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}::-webkit-scrollbar{display:none}.gs-rest-popup .leaflet-popup-content-wrapper{border-radius:10px;padding:0;overflow:hidden}.gs-rest-popup .leaflet-popup-content{margin:0}`}</style>

      {/* FILTER SHEET — Bakery/Bars, Vibe, Dietary, Min Rating, Max Price + the
          trust legend, moved off the inline band (replaces the old accordion +
          its floating close FAB). */}
      <FilterSheet open={filterSheetOpen} onClose={()=>setFilterSheetOpen(false)} title="Food filters" onClear={sheetFilterCount>0?clearSheetFilters:undefined}>
        <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
          <div>
            <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.12em] uppercase font-semibold mb-2" style={{color:'#94A3B8'}}>More food types</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              <Chip label="Bakery & Pastry" active={filterBakery} onClick={()=>setFilterBakery(!filterBakery)} color={TEAL}/>
              <Chip label="Bars & Pubs" active={filterBars} onClick={()=>setFilterBars(!filterBars)} color={ORANGE}/>
            </div>
          </div>
          <div>
            <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.12em] uppercase font-semibold mb-2" style={{color:'#94A3B8'}}>Vibe</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              {VIBE_OPTIONS.map(v=><Chip key={v.id} label={v.label} active={!!filterVibes[v.id]} onClick={()=>setFilterVibes(p=>({...p,[v.id]:!p[v.id]}))} color={PURPLE}/>)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.12em] uppercase font-semibold mb-2" style={{color:'#94A3B8'}}>Dietary</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              {DIETARY_OPTIONS.map(d=><Chip key={d.id} label={d.label} active={!!filterDietary[d.id]} onClick={()=>setFilterDietary(p=>({...p,[d.id]:!p[d.id]}))} color={GREEN}/>)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.12em] uppercase font-semibold mb-2" style={{color:'#94A3B8'}}>Min rating</div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {[{v:0,l:"Any"},{v:3.5,l:"3.5+"},{v:4.0,l:"4.0+"},{v:4.5,l:"4.5+"}].map(({v,l})=><Chip key={v} label={l} active={filterMinRating===v} onClick={()=>setFilterMinRating(v)}/>)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.12em] uppercase font-semibold mb-2" style={{color:'#94A3B8'}}>Max price</div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {[{v:0,l:"Any"},{v:1,l:"$"},{v:2,l:"$$"},{v:3,l:"$$$"},{v:4,l:"$$$$"}].map(({v,l})=><Chip key={v} label={l} active={filterMaxPrice===v} onClick={()=>setFilterMaxPrice(v)}/>)}
            </div>
          </div>
          {/* Trust legend — glosses the ✅/⚠️ marks the cards themselves render (TrustTag) */}
          <div style={{padding:"10px 12px",background:"#F8FAFC",borderRadius:"8px",border:"1px solid #E8EDF2"}}>
            <div style={{fontSize:"calc(11px*var(--fs))",fontWeight:"700",color:GRAY,marginBottom:"5px"}}>DATA TRUST GUIDE</div>
            <div style={{fontSize:"calc(11px*var(--fs))",color:DARK,lineHeight:"1.7"}}>
              <div>✅ <strong>Confirmed</strong> — Google Places API data (reliable)</div>
              <div>⚠️ <strong>Reviews</strong> — Customer-reported, may have changed</div>
            </div>
          </div>
        </div>
      </FilterSheet>
      {/* Scroll-to-top now provided globally by Layout's <BackToTop /> on finder pages. */}
      <LocationModePicker isOpen={showLocPicker} onClose={()=>setShowLocPicker(false)}/>
      <MapAppSelector
        isOpen={dirModal.open}
        onClose={()=>setDirModal({open:false,lat:null,lng:null,name:'',address:''})}
        destination={{ name:dirModal.name, address:dirModal.address, latitude:dirModal.lat, longitude:dirModal.lng }}
        userLat={lat}
        userLng={lng}
      />
    </div>
  );
}