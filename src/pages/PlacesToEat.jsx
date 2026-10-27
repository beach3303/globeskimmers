// ============================================================================
// GLOBESKIMMERS — Places to Eat (the new look: WORLD.eat, "Bistro Menu")
// ============================================================================
// The Bordeaux plate (count, title, location, unit) with the search, the quick
// chips (Open now, Late night, Filters) and the cuisines; one note at a time;
// then a numbered list of restaurant cards (Eat.dc.html L91-132): photo or
// strip with the serif numeral, the worker's intent tier as a pill, the name
// on its menu line, one facts line, at most three tags, the quiet rows, the
// rubber stamp when you're here and one action row. Owned-first fetch, cache
// keys, filters, presets and analytics are unchanged.
// ============================================================================

import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { sortByRating as rankByRating, keepCountry, nearFirst as nearFirstSplit, pinInstitutions } from "@/lib/searchRank";
import { createPageUrl } from "@/utils";
import { useLocation } from "@/components/location/LocationContext";
import { planFinderSearch, moveToPlace, finderRecents, saveFinderRecent } from "@/lib/finderSearch";
import { placePhrase } from "@/lib/placeContext";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { logEvent } from "@/lib/analytics";
import { logSearch, logZeroResults } from "@/lib/logSearch";
import AIDetailsSection from "@/components/AIDetailsSection";
import TravelerDishes from "@/components/finder/TravelerDishes";
import { HereStamp } from "@/components/attraction/AttractionExtras";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapAppSelector from "@/components/MapAppSelector";
import { MapPin, Clock, Moon, SlidersHorizontal, SearchX, AlertCircle, Coffee, Target, Check, Link2, Utensils, ExternalLink, X } from "lucide-react";
import { WORLD, fs } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import FinderHeader from "@/components/finder/FinderHeader";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import FilterSheet, { FilterGroupLabel } from "@/components/finder/FilterSheet";
import FallbackDisclaimer, { fallbackNoteKind } from "@/components/finder/FallbackDisclaimer";
import { WorldSearch, WorldChip, ChipRow, ResultLine, WorldNote } from "@/components/finder/FinderControls";
import { WorldCard, worldGrid, NumberMark, FactsLine, RatingFact, WorldTag, TagRow, CardKicker, CardName, QuietRows, ActionRow, WorldSkeleton } from "@/components/finder/FinderCard";
import { WorldStrip } from "@/components/finder/PhotoOrIcon";

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

// The Eat world (Bordeaux plate, saffron accents): every colour on the page comes from it.
const EAT = WORLD.eat;

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

// ─── PHOTO CAROUSEL (Eat.dc.html) ───────────────────────────────────────────
// A 16:10 photo that swipes sideways, opens full screen on a tap, and carries the
// card's serif numeral and a mono "2/5". No photos: the Bordeaux strip with the
// numeral in its middle. While an owned place's photos are still being looked up:
// a quiet 16:10 wash, so the card doesn't jump when they land.
function PhotoCarousel({ photos=[], rank, name, pending=false }) {
  const [cur,setCur]=useState(0); const [errs,setErrs]=useState({}); const ref=useRef(null);
  const [lightbox,setLightbox]=useState(false);   // tap-to-enlarge full-screen viewer
  const [lbCur,setLbCur]=useState(0);
  const lbRef=useRef(null);
  const valid=photos.filter((_,i)=>!errs[i]);
  // On open, jump the lightbox to the photo the user was viewing in the card.
  useEffect(()=>{
    if(lightbox && lbRef.current){
      lbRef.current.scrollLeft = cur * lbRef.current.offsetWidth;
      setLbCur(cur);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[lightbox]);
  if (!valid.length) {
    if (pending) return <div aria-hidden="true" style={{aspectRatio:"16 / 10",background:EAT.wash}}/>;
    return <WorldStrip world="eat"><NumberMark n={rank} world="eat" place="middle"/></WorldStrip>;
  }
  return (
    <div style={{position:"relative",aspectRatio:"16 / 10",background:EAT.wash}}>
      <div ref={ref} onScroll={()=>ref.current&&setCur(Math.round(ref.current.scrollLeft/ref.current.offsetWidth))} style={{display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",scrollbarWidth:"none",height:"100%"}}>
        {valid.map((p,i)=>(
          <button key={i} type="button" onClick={()=>setLightbox(true)} aria-label={valid.length>1?`View photos of ${name}, ${i+1} of ${valid.length}`:`View the photo of ${name}`}
            style={{minWidth:"100%",height:"100%",padding:0,border:0,background:"transparent",scrollSnapAlign:"start",flexShrink:0,cursor:"zoom-in"}}>
            <img src={p} loading={i===0?"eager":"lazy"} onError={()=>setErrs(e=>({...e,[photos.indexOf(p)]:true}))} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </button>
        ))}
      </div>
      <NumberMark n={rank} world="eat"/>
      {valid.length>1&&(
        <span aria-hidden="true" className="font-mono" style={{position:"absolute",bottom:8,right:10,padding:"2px 7px",borderRadius:999,background:"rgba(22,17,13,.62)",color:"#fff",fontSize:fs(10.5),letterSpacing:".08em",lineHeight:1.4}}>{cur+1}/{valid.length}</span>
      )}

      {/* FULL-SCREEN VIEWER — swipe between photos, contain-fit so the whole
          photo is visible. Tap the dark area or Close to leave. */}
      {lightbox && createPortal(
        <div
          onClick={()=>setLightbox(false)}
          role="dialog" aria-modal="true" aria-label={`Photos of ${name}`}
          style={{position:"fixed",inset:0,zIndex:100000,background:"rgba(0,0,0,0.94)",display:"flex",flexDirection:"column"}}
        >
          <button
            type="button"
            onClick={(e)=>{e.stopPropagation();setLightbox(false);}}
            aria-label="Close"
            style={{position:"absolute",top:"calc(env(safe-area-inset-top) + 10px)",right:"12px",zIndex:2,width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.18)",backdropFilter:"blur(8px)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
          ><X size={20} strokeWidth={2} aria-hidden="true"/></button>
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
            <div className="font-mono" style={{position:"absolute",bottom:"calc(env(safe-area-inset-bottom) + 18px)",left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.6)",color:"#fff",padding:"4px 12px",borderRadius:"20px",fontSize:"13px"}}>{lbCur+1} / {valid.length}</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── TIER PILL ───────────────────────────────────────────────────────────────
// The worker's intent tier as a lightness ladder (WORLD.eat.tiers), with the exact
// TIER_LABELS words. Only tiers 1-4 print; a GENERAL search sends none.
const TIER_WORDS = { 1:'Dish Specialist', 2:'Authentic Match', 3:'Related', 4:'Serves It' };
const TIER_ICON  = { 1:Target, 2:Check, 3:Link2, 4:Utensils };
function TierPill({ tier }) {
  const t = EAT.tiers?.[tier];
  const Icon = TIER_ICON[tier];
  if (!t || !TIER_WORDS[tier]) return null;
  return (
    <span className="font-mono uppercase inline-flex items-center flex-none"
      style={{gap:5,minHeight:20,boxSizing:"border-box",padding:"0 7px",borderRadius:6,background:t.bg,color:t.ink,border:t.border?`1px solid ${t.border}`:0,fontSize:fs(10),fontWeight:500,letterSpacing:".12em",lineHeight:1,whiteSpace:"nowrap"}}>
      <Icon size={11} strokeWidth={2.4} aria-hidden="true"/>{TIER_WORDS[tier]}
    </span>
  );
}

// Closes at or after 11 PM (or is open all day), from today's real hours in the
// place's own zone — the same rule as the Late night chip.
function closesLate(todayHours, is24) {
  if (is24) return true;
  if (!todayHours || /closed/i.test(todayHours)) return false;
  const parts = todayHours.split(/[-–]| to /i);
  const closeStr = (parts.length > 1 ? parts[parts.length - 1] : todayHours).trim().toLowerCase();
  if (closeStr.includes('midnight')) return true;
  const m = closeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)/);
  if (!m) return false;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || 0, 10);
  if (m[3] === 'pm' && h !== 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  const v = h + min / 60;
  return v >= 23 || v <= 5;
}

// One hairline row in the card's More panel: a mono label, then plain words.
function MoreRow({ label, children }) {
  return (
    <div style={{padding:"12px 0",borderTop:`1px solid ${EAT.line}`}}>
      <div className="font-mono uppercase" style={{fontSize:fs(10.5),letterSpacing:".12em",color:EAT.iconInk,marginBottom:4}}>{label}</div>
      <div style={{fontSize:fs(13.5),lineHeight:1.5,color:"#3A3128"}}>{children}</div>
    </div>
  );
}

// ─── RESTAURANT CARD (Eat.dc.html L91-132) ──────────────────────────────────
// One card at both widths: the photo (or the strip), the tier pill and the cuisine
// kicker, the name on its menu line with the distance, Say it · Translate, one facts
// line, the address, at most three tags, the quiet rows (AI details, add a photo),
// the rubber stamp when you're here, and the action row with More.
function RestaurantCard({ restaurant, rank, onDirections, onShowOnMap, formatDistance, isLocal, batchEnrich, cardRef }) {
  const [expanded,setExpanded]=useState(false);
  const [enriched,setEnriched]=useState(null);
  const moreId = useId();
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

  const name    = restaurant.displayName?.text || restaurant.name || "Restaurant";
  const placeId = restaurant.placeId || restaurant.id;
  const phone   = restaurant.nationalPhoneNumber || restaurant.internationalPhoneNumber || enriched?.nationalPhoneNumber || enriched?.phone || "";
  const parking = restaurant.parking;
  const types   = restaurant.types || [];
  const cuisineLabel = restaurant.primaryType
    ? restaurant.primaryType.replace(/_/g,' ')
    : restaurant.types?.[0]?.replace(/_/g,' ') || null;
  const weekdays = (enriched?.hours?.weekdayDescriptions?.length ? enriched.hours.weekdayDescriptions
    : (restaurant.currentOpeningHours?.weekdayDescriptions || restaurant.regularOpeningHours?.weekdayDescriptions || restaurant.hours || []));
  const photosToShow = (enriched?.photos?.length ? enriched.photos : (restaurant.photos || (restaurant.photoUrl ? [restaurant.photoUrl] : [])));
  const photosPending = restaurant.source==='owned' && !enriched && batchEnrich===undefined && !photosToShow.length;
  // Open words: the place's own zone (offset from the enriched payload when the
  // worker sends it, else the row's own). A cached boolean is never trusted here.
  const offset = enriched?.utcOffsetMinutes ?? restaurant.utcOffsetMinutes;
  const openPlace = { ...restaurant, currentOpeningHours: weekdays.length ? { weekdayDescriptions: weekdays } : restaurant.currentOpeningHours, utcOffsetMinutes: offset };
  const openInfo = computeOpenStatus({ currentOpeningHours:{ weekdayDescriptions: weekdays }, utcOffsetMinutes: offset, isOpen: enriched?.hours?.openNow ?? restaurant.isOpen ?? null }, { isLocal });
  const today   = placeDay(offset, isLocal); // null = unknown day over there → no "today"
  const rating  = enriched?.rating ?? restaurant.rating;
  const ratingCount = enriched?.userRatingCount ?? restaurant.userRatingCount;
  const address = restaurant.shortFormattedAddress || restaurant.formattedAddress || restaurant.vicinity || "";
  const dist = restaurant.distanceMiles != null ? String(formatDistance(restaurant.distanceMiles) || "").toUpperCase() : null;

  // At most three tags, most useful first. Cash only and the dietary ones are
  // facts a traveler must know; Late night only from real hours.
  const tags = [];
  if (restaurant.isCashOnly) tags.push(restaurant.cashSource==='reviews' ? 'Cash only (reported)' : 'Cash only');
  if (restaurant.servesVegetarianFood === true || types.includes('vegetarian_restaurant')) tags.push('Vegetarian');
  if (types.includes('halal_restaurant')) tags.push('Halal');
  if (closesLate(openInfo.todayHours, openInfo.is24Hours)) tags.push('Late night');
  if (restaurant.isChain) tags.push('Chain option');
  if (restaurant.hasDriveThru) tags.push('Drive-thru');
  if (restaurant.dineIn) tags.push('Dine-in');
  if (restaurant.takeout) tags.push('Takeout');
  if (restaurant.delivery) tags.push('Delivery');
  if (restaurant.reservable) tags.push('Reservable');

  const seatingWords = [restaurant.hasIndoorSeating&&'Indoor', restaurant.hasOutdoorSeating&&'Outdoor', restaurant.seating?.hasLoungeSeating&&'Lounge'].filter(Boolean);
  const parkingWords = parking && !parking.noParking ? (parking.details?.length ? parking.details.map(d=>d.label) : ['Parking available']) : [];
  const trust = (confirmed) => confirmed ? 'confirmed by Google' : 'mentioned in reviews';
  const hasMore = !!(restaurant.bestTimeNote || seatingWords.length || parking || restaurant.editorialSummary || restaurant.generativeSummary?.overview?.text || weekdays.length || restaurant.websiteUri);

  return (
    <WorldCard world="eat" as="li" ref={cardRef}>
      <PhotoCarousel photos={photosToShow} rank={rank} name={name} pending={photosPending}/>
      <div style={{padding:"12px 16px 16px"}}>
        {(restaurant.tier || cuisineLabel) && (
          <div className="flex items-center flex-wrap" style={{columnGap:10,rowGap:4,minHeight:20}}>
            <TierPill tier={restaurant.tier}/>
            {cuisineLabel && <CardKicker world="eat">{cuisineLabel}</CardKicker>}
          </div>
        )}
        <CardName world="eat" leader trailing={dist}>{name}</CardName>
        <div style={{marginTop:2}}><NameLanguageHelp placeId={placeId} name={name} world="eat"/></div>
        <FactsLine world="eat" place={openPlace} isLocal={isLocal}
          items={[<RatingFact key="r" world="eat" rating={rating} count={ratingCount} source="google"/>, restaurant.priceStr]}
          style={{marginTop:4}}/>
        {address && <p style={{margin:0,fontSize:fs(13),lineHeight:1.4,color:"#736657"}}>{address}</p>}
        {tags.length>0 && (
          <TagRow max={3} style={{marginTop:12}}>
            {tags.map(t=><WorldTag key={t} world="eat">{t}</WorldTag>)}
          </TagRow>
        )}
        <QuietRows world="eat" style={{marginTop:12}}>
          <AIDetailsSection world="eat" placeId={placeId} placeName={name} lat={restaurant.lat} lng={restaurant.lng} page="PlacesToEat" kind="restaurant"/>
          <TravelerDishes world="eat" variant="row" place={{id:placeId,name,lat:restaurant.lat,lng:restaurant.lng}} kind="restaurant"/>
        </QuietRows>
        <HereStamp place={{id:placeId,name,lat:restaurant.lat,lng:restaurant.lng,types:restaurant.types,formattedAddress:restaurant.formattedAddress||restaurant.address}} formatDistance={formatDistance}/>
        <ActionRow world="eat" name={name} onDirections={onDirections} onMap={onShowOnMap} phone={phone}
          onMore={hasMore?()=>setExpanded(e=>!e):undefined} moreExpanded={hasMore?expanded:undefined} moreControls={hasMore?moreId:undefined}
          style={{marginTop:4}}/>
        {hasMore && expanded && (
          <div id={moreId} style={{marginTop:12}}>
            {restaurant.bestTimeNote && <MoreRow label="Best time to visit">{restaurant.bestTimeNote}</MoreRow>}
            {seatingWords.length>0 && <MoreRow label="Seating">{seatingWords.join(' · ')} <span style={{color:"#736657"}}>({trust(restaurant.seatingSource==='api')})</span></MoreRow>}
            {parking && (
              <MoreRow label="Parking">
                {parking.noParking ? parking.noParkingNote : <>{parkingWords.join(' · ')} <span style={{color:"#736657"}}>({trust(parking.source==='api')})</span></>}
              </MoreRow>
            )}
            {restaurant.editorialSummary && <MoreRow label="About">{restaurant.editorialSummary}</MoreRow>}
            {restaurant.generativeSummary?.overview?.text && (
              <MoreRow label={`AI venue summary · ${restaurant.generativeSummary.disclosureText?.text || 'Summarized with Gemini'}`}>{restaurant.generativeSummary.overview.text}</MoreRow>
            )}
            {weekdays.length>0 && (
              <MoreRow label="Hours">
                {weekdays.map((day,i)=>{
                  const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                  const isToday=DAY.findIndex(d=>day.startsWith(d))===today; // the place's day, not the device's
                  return (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"2px 0",fontWeight:isToday?700:400,color:isToday?EAT.ink:"#3A3128"}}>
                      <span>{day.split(':')[0]}</span><span style={{textAlign:"right"}}>{day.split(':').slice(1).join(':').trim()}</span>
                    </div>
                  );
                })}
              </MoreRow>
            )}
            {restaurant.websiteUri && (
              <MoreRow label="Website">
                <a href={restaurant.websiteUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center"
                  style={{gap:6,minHeight:44,margin:"-12px 0",color:EAT.ink,fontWeight:600,textDecoration:"underline",textUnderlineOffset:2}}>
                  Menu and reservations<ExternalLink size={14} strokeWidth={2} aria-hidden="true"/>
                </a>
              </MoreRow>
            )}
          </div>
        )}
      </div>
    </WorldCard>
  );
}

// ─── MAP POPUP ────────────────────────────────────────────────────────────────
function buildPopup(r, idx) {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const name    = esc(r.displayName?.text||r.name||'Restaurant');
  const address = esc(r.formattedAddress||r.shortFormattedAddress||'');
  const phone   = r.nationalPhoneNumber||r.internationalPhoneNumber||'';
  const { isOpen, todayHours, is24Hours } = r;
  // Words only: the open word in green or stamp red, never a coloured dot alone.
  const openWord = is24Hours ? 'Open 24 hours' : isOpen===true ? 'Open' : isOpen===false ? 'Closed' : 'Hours not listed';
  const openInk  = is24Hours||isOpen===true ? '#2E6B4E' : isOpen===false ? '#B0472F' : '#736657';
  return `
    <div style="font-family:'Inter Tight',-apple-system,sans-serif;width:260px;position:relative;color:#16110D;">
      <div style="padding:12px;padding-top:14px;">
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:calc(18px*var(--fs));line-height:1.15;margin-bottom:4px;cursor:pointer;text-decoration:underline;text-decoration-color:${EAT.line};text-underline-offset:3px;" onclick="window.viewRestDetails&&window.viewRestDetails(${idx})">${name}</div>
        <div style="font-size:calc(11.5px*var(--fs));color:#736657;margin-bottom:6px;">${address}</div>
        <div style="font-size:calc(12px*var(--fs));margin-bottom:6px;">
          <span style="font-weight:600;color:${openInk};">${openWord}</span>${todayHours&&!is24Hours?`<span style="color:#736657;"> · ${esc(todayHours)}</span>`:''}
        </div>
        ${r.rating?`<div style="font-size:calc(12px*var(--fs));margin-bottom:8px;"><span style="color:${EAT.star};">★</span> <strong>${r.rating.toFixed(1)}</strong> <span style="color:#736657;">(${(r.userRatingCount||0).toLocaleString()}) Google</span></div>`:''}
        ${phone?`<a href="tel:${esc(phone)}" style="display:inline-flex;align-items:center;min-height:32px;margin-bottom:8px;color:${EAT.ink};font-size:calc(12px*var(--fs));font-weight:600;text-decoration:underline;text-underline-offset:2px;">Call ${esc(phone)}</a>`:''}
        <div style="display:flex;gap:8px;">
          <button onclick="window.openDirFromMap&&window.openDirFromMap(${idx})" style="flex:1;min-height:40px;border:none;border-radius:10px;background:${EAT.cta};color:#fff;font-weight:600;font-size:calc(12px*var(--fs));cursor:pointer;">Directions</button>
          <button onclick="window.viewRestDetails&&window.viewRestDetails(${idx})" style="flex:1;min-height:40px;border:1px solid ${EAT.line};border-radius:10px;background:#fff;color:#3A3128;font-weight:600;font-size:calc(12px*var(--fs));cursor:pointer;">Details</button>
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
  // "best / top rated" from Search (founder, 2026-10-07): order by a
  // review-weighted rating instead of distance; a chip shows it and clears it.
  const [sortByRating, setSortByRating] = useState(false);
  useEffect(() => {
    if (routerLocation.state?.presetSort === "rating") setSortByRating(true);
  }, [routerLocation.state?.presetSort]);
  // A NAMED smaller place (Redondo Beach, not "LA") from Search: places within
  // 5 miles of it lead, the wider 25-mile net follows (founder, 2026-10-07 —
  // "best crabs in Redondo Beach area" ranked central-LA spots above the pier).
  // In-box searches set these too (2026-10-25): "pasta in Positano" typed right here.
  const [nearFirst, setNearFirst] = useState(routerLocation.state?.presetNearFirst === true);
  useEffect(() => { setNearFirst(routerLocation.state?.presetNearFirst === true); }, [routerLocation.state?.presetNearFirst]);
  // "best tacos in Tijuana" means MEXICO (founder, 2026-10-07): the 25-mile net
  // crossed the border and San Diego/Chula Vista spots outranked Tijuana. A
  // named place keeps results in its own country; addresses end with it.
  const [presetCountry, setPresetCountry] = useState(routerLocation.state?.presetCountry || null);
  useEffect(() => { setPresetCountry(routerLocation.state?.presetCountry || null); }, [routerLocation.state?.presetCountry]);
  // "open late" from Search → the strict Late-night chip (real hours, past 10 PM).
  useEffect(() => {
    if (routerLocation.state?.presetLateNight === true) setSelectedCuisines(new Set(["latenight"]));
  }, [routerLocation.state?.presetLateNight]);
  // Bars / speakeasies / pubs from Search → the Bars switch (bars are hidden otherwise).
  useEffect(() => {
    if (routerLocation.state?.presetBars === true) setFilterBars(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state?.presetBars]);
  // "affordable / cheap" from Search → the finder's own price filter.
  useEffect(() => {
    const mp = routerLocation.state?.presetMaxPrice;
    if (mp === 1 || mp === 2) setFilterMaxPrice(mp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state?.presetMaxPrice]);
  const [radius, setRadius]             = useState(25); // wide net; no radius UI — results show nearest-first
  const [displayCount, setDisplayCount] = useState(20);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false); // advanced filters live in the shared FilterSheet
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const [showLocPicker, setShowLocPicker] = useState(false);
  // Collapsible "You are here" tooltip on the map view. Expanded shows the
  // full 3-line card (heading + Current/Selected + city/state); collapsed
  // shrinks to a "You are here ⌄" pill that taps to expand.
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

  const locationCtx = useLocation();
  const { activeLocation, locationMode } = locationCtx;
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
          // Exploring a named place: its famous local institutions lead.
          namedPlace: !isLocal,
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
  // Batch enrich results (declared before `filtered`, which drops places the
  // lookup reports closed for good).
  const [ownedEnrich, setOwnedEnrich] = useState({});
  const ownedEnrichAsked = useRef(new Set());
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
        return timeValue >= 23 || (timeValue >= 0 && timeValue <= 5); // past 11 PM today (Round 1, 2026-10-07)
      });
    }

    r = keepCountry(r, presetCountry);
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
    if (sortByRating) {
      // Shared with the test suite: src/lib/searchRank.js
      r = rankByRating(r, { named: !!presetCountry });
    } else if (filterVibes['sportsBar']) {
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
    if (nearFirst) r = nearFirstSplit(r);
    r = pinInstitutions(r, nearFirst ? 5 : Infinity);
    // Google says it closed for good, or has no listing here at all (2026-10-26: those were former
    // tenants — Shunji's, Ruam Mitr — each a card with no photo): the card leaves the list.
    r = r.filter(x => { const e = ownedEnrich[x.id || x.placeId]; return !e?.closed && !e?.unverified; });
    return r;
  }, [ownedEnrich, restaurants, filterBars, filterOpenNow, filterParking, filterOutdoor, filterIndoor, filterDriveThru, filterBakery, filterMinRating, filterMaxPrice, cuisineTypeFilter, filterVibes, filterDietary, searchText, sortByRating, nearFirst, presetCountry]);

  // ── T1.15: BATCH ENRICH THE VISIBLE PAGE OF OWNED CARDS ──────────────────
  // Was: every owned card fired its own /places/enrich-owned on mount (up to 20
  // calls per page). Now the page's owned cards go up in ONE batched call (the
  // worker caps a batch at 20 = exactly one page). ownedEnrich[key] semantics:
  // undefined = batch pending, payload = result, null = batch missed/errored →
  // that card's own single-call fallback runs (same KV cache server-side).
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
  // The box understands what Home's search does (2026-10-25): "best pasta in Positano" moves the
  // page to Positano, sorts by rating and searches "pasta"; "cheap", "open late" and "bars" set
  // their filters; "ATM" offers ATMs. The dish engine still runs the search.
  const [planning, setPlanning] = useState(false);
  const [otherFinder, setOtherFinder] = useState(null);   // { page, label, query } when the words belong elsewhere
  const [recents, setRecents] = useState(() => finderRecents("eat"));
  const runTypedSearch = async (raw) => {
    const text = String(raw || "").trim();
    setOtherFinder(null);
    if (!text) { setSearchText(""); return; }
    setPlanning(true);
    try {
      const plan = await planFinderSearch(text, { world: "eat", activePhrase: placePhrase(activeLocation) || "" });
      saveFinderRecent("eat", text);
      setRecents(finderRecents("eat"));
      if (plan.sort === "rating") setSortByRating(true);
      if (plan.maxPrice === 1 || plan.maxPrice === 2) setFilterMaxPrice(plan.maxPrice);
      if (plan.lateNight) setSelectedCuisines(new Set(["latenight"]));
      if (plan.bars) setFilterBars(true);
      if (plan.place) {
        const { moved, country } = await moveToPlace(plan, locationCtx);
        if (moved) { setNearFirst(plan.nearFirst); setPresetCountry(country); }
      }
      if (plan.other) setOtherFinder({ ...plan.other, query: plan.query });
      setSearchText(plan.query);
    } catch { setSearchText(text); }
    setPlanning(false);
  };

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
      // User-location pin with collapsible "You are here" tooltip below
      // (anti-overlap with restaurant popups above). Same pattern as
      // ThingsToDo TierMapOverlay + MoneyExchange map.
      const userMode = activeLocation?.mode === 'navigate' ? 'Selected location' : 'Current location';
      const userLabel = locationText || '';
      const userTooltipHtml = userPinExpanded
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsPTEUserPin&&window._gsPTEUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:calc(10px*var(--fs));font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:calc(12px*var(--fs));margin-bottom:2px;padding-right:24px;">You are here</div><div style="font-weight:700;color:#4285F4;font-size:calc(11px*var(--fs));margin-bottom:2px;">${userMode}</div><div style="color:#64748B;font-size:calc(10px*var(--fs));line-height:1.3;">${userLabel}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsPTEUserPin&&window._gsPTEUserPin()"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">You are here</span><span style="color:#64748B;font-size:calc(10px*var(--fs));font-weight:700;">⌄</span></div>`;
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:'<div style="width:14px;height:14px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',iconSize:[14,14],className:""})}).addTo(map).bindTooltip(userTooltipHtml,{permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:true});
      filtered.slice(0,displayCount).forEach((r,i)=>{
        if(!r.lat||!r.lng)return;
        const isSelected = i === selectedMapIndex;
        const pinBg    = EAT.ink;
        const pinShadow= isSelected ? `0 0 0 4px ${EAT.star}, 0 3px 10px rgba(122,29,51,0.45)` : "0 2px 8px rgba(122,29,51,0.35)";
        const pinSize  = isSelected ? 38 : 30;
        const pinFont  = isSelected ? "14px" : "12px";
        const pinBorder= isSelected ? "3px solid #fff" : "2px solid #fff";
        const marker = window.L.marker([r.lat,r.lng],{icon:window.L.divIcon({html:`<div style="width:${pinSize}px;height:${pinSize}px;background:${pinBg};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Instrument Serif',Georgia,serif;font-size:${pinFont};box-shadow:${pinShadow};border:${pinBorder};">${i+1}</div>`,iconSize:[pinSize,pinSize],className:""})}).addTo(map).bindPopup(buildPopup(r,i),{maxWidth:270,autoPan:true,autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true,className:"gs-rest-popup"});
        if(isSelected) { marker.openPopup(); }
      });
    };
    if (!window.L) {
      const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(link);
      const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.onload=init;document.head.appendChild(script);
    } else { init(); }
    return()=>{delete window.mapInstance;delete window.viewRestDetails;delete window.openDirFromMap;if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null;}};
  },[viewMode,filtered,lat,lng,displayCount,selectedMapIndex,userPinExpanded,locationText,activeLocation?.mode]);

  const W = WORLD.eat;
  const showCount = !(!lat||!lng||loading||error);   /* stale-count rule: never show the previous fetch's number mid-load */
  // "Where to eat *ramen*" only when the worker read the search as a dish or a cuisine.
  const dishIntent = !!searchText.trim() && (fallbackInfo?.intentKind === "DISH" || fallbackInfo?.intentKind === "UMBRELLA");
  // Coffee words: point to the Coffee finder (re-evaluated on every search).
  const coffeeHint = /\b(coffee|espresso|latte|cappuccino|mocha)\b/i.test(searchText || "");
  const stats = {
    total: filtered.length,
    open:  filtered.filter(r=>r.isOpen===true).length,
    withParking: filtered.filter(r=>r.parking&&!r.parking.noParking).length,
  };

  return (
    <div className="font-sans" style={{background:W.paper,minHeight:"100vh",paddingTop:12}}>

      {/* ── THE PLATE + CONTROLS (Eat.dc.html L26-87): the Bordeaux plate with the
          count, the title, the location and the unit; under it the search, the two
          chip rows and the result line. One note at a time: the no-exact-match
          note, else the city line, else the coffee hint. ── */}
      <FinderHeader
        world="eat"
        count={showCount ? stats.total : null}
        title={dishIntent ? { pre: "Where to eat ", italic: searchText.trim(), post: "" } : undefined}
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh places"
        location={{ label: locationText, onChange: () => setShowLocPicker(true) }}
        unit={{ value: unit, onChange: setUnit }}
        isCity={isCity}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
        note={fallbackNoteKind(fallbackInfo, fallbackBanner) ? (
          <FallbackDisclaimer world="eat" fallbackInfo={fallbackInfo} banner={fallbackBanner} onSearchElsewhere={() => setShowLocPicker(true)} formatDistance={formatDistance} />
        ) : null}
        hint={otherFinder ? (
          <WorldNote world="eat" title={`Looking for ${otherFinder.label}?`} action={{ label: `Open ${otherFinder.label}`, onClick: () => navigate(createPageUrl(otherFinder.page), { state: ["CoffeeFinder", "ThingsToDo"].includes(otherFinder.page) && otherFinder.query ? { presetQuery: otherFinder.query } : { from: "PlacesToEat" } }) }} />
        ) : coffeeHint ? (
          <WorldNote world="eat" icon={Coffee} title="Looking for coffee?" action={{ label: "See more cafés in Coffee", onClick: () => navigate(createPageUrl("CoffeeFinder"), { state: { from: "PlacesToEat" } }) }} />
        ) : null}
      >
        <WorldSearch
          world="eat"
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={runTypedSearch}
          onClear={() => { setSearchInput(""); setSearchText(""); setOtherFinder(null); }}
          placeholder="Search a dish, a restaurant, or “pasta in Positano”…"
          busy={planning || (loading && !!searchText)}
          recents={recents}
          onPickRecent={(t) => { setSearchInput(t); runTypedSearch(t); }}
        />
        <ChipRow label="Quick filters" style={{ marginTop: 10 }}>
          <WorldChip world="eat" icon={Clock} label="Open now" active={filterOpenNow} onClick={() => setFilterOpenNow(!filterOpenNow)} />
          <WorldChip world="eat" icon={Moon} label="Late night" active={selectedCuisines.has("latenight")} onClick={() => toggleCuisine("latenight")} />
          <WorldChip world="eat" icon={SlidersHorizontal} label="Filters" count={sheetFilterCount} opensSheet onClick={() => setFilterSheetOpen(true)} />
        </ChipRow>
        {/* Cuisines: no emoji and no "All" (nothing picked means all). Dietary
            types live in the filter sheet; Late night sits in the row above. */}
        <ChipRow label="Cuisines" bleed style={{ marginTop: 2 }}>
          {CUISINES.filter((c) => !["all", "latenight", "vegetarian", "vegan", "halal", "kosher"].includes(c.id)).map((c) => (
            <WorldChip key={c.id} world="eat" label={c.label} active={selectedCuisines.has(c.id)} onClick={() => toggleCuisine(c.id)} />
          ))}
        </ChipRow>
        <ResultLine live items={showCount ? [{ count: stats.open, label: "open now" }] : []} />
        {sortByRating && showCount && (
          <ResultLine>
            <span>★ Highest rated first · reviews weighed</span>
            {" "}
            <button type="button" onClick={() => setSortByRating(false)} aria-label="Sort by distance instead"
              style={{ minHeight: 44, margin: "-14px 0", padding: 0, background: "none", border: 0, font: "inherit", letterSpacing: "inherit", textTransform: "inherit", color: W.ink, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>
              Nearest first
            </button>
          </ResultLine>
        )}
      </FinderHeader>

      {/* ── CONTENT ── */}
      {(!lat||!lng)?(
        /* No location yet (first run, GPS denied, cleared storage). Sits AHEAD of
           the loading branch so a no-location cold start can never show a spinner —
           `loading` starts true and the fetch effect bails before clearing it. */
        <div className={`px-4 ${colWrap} mx-auto`} style={{paddingTop:"40px"}}>
          <FinderEmptyState world="eat" icon={MapPin} title="Choose a location to search" reason="Use your current location or pick a city to find restaurants nearby" actionLabel="Choose location" onAction={()=>setShowLocPicker(true)}/>
        </div>
      ):loading?(
        <div style={isTablet?{maxWidth:1024,margin:"0 auto",padding:"16px 24px 0"}:{padding:"16px 16px 0"}}>
          <WorldSkeleton world="eat" variant="card" count={isTablet?4:2} label={Object.values(filterDietary).some(Boolean)
            ? `Searching for ${Object.entries(filterDietary).filter(([_,v])=>v).map(([k])=>k.charAt(0).toUpperCase()+k.slice(1)).join(' & ')} restaurants…`
            : 'Finding restaurants…'}/>
        </div>
      ):error?(
        /* Was a dead "Expand Radius" button (every search already runs the full
           25-mile net). Honest actions instead: retry a failed load; move the
           search or clear filters/search on an empty result. */
        /^Failed/.test(error)
          ? <div className={`px-4 ${colWrap} mx-auto`} style={{paddingTop:"40px"}}><FinderEmptyState world="eat" icon={AlertCircle} title="Couldn't load restaurants" reason={error} actionLabel="Try again" onAction={handleRefresh} secondaryLabel="Search somewhere else" onSecondary={()=>setShowLocPicker(true)}/></div>
          : <div className={`px-4 ${colWrap} mx-auto`} style={{paddingTop:"40px"}}><FinderEmptyState world="eat" icon={SearchX} title="No restaurants found" reason={error} actionLabel="Search somewhere else" onAction={()=>setShowLocPicker(true)} secondaryLabel={(activeFilterCount>0||searchText)?"Clear filters":"Try again"} onSecondary={(activeFilterCount>0||searchText)?()=>{clearFilters();setSearchInput("");setSearchText("");}:handleRefresh}/></div>
      ):viewMode==="list"?(
        <div style={isTablet
          ? {maxWidth:1024,margin:"0 auto",padding:"16px 24px 0",display:"flex",flexDirection:"column",gap:"30px"}
          : {width:"100%",padding:"16px 16px 0",display:"flex",flexDirection:"column",gap:"16px"}}>
          {filtered.length===0?(
            <FinderEmptyState world="eat" icon={SearchX} title="No matches" reason="Nothing here passes the current filters." actionLabel="Search somewhere else" onAction={()=>setShowLocPicker(true)} secondaryLabel={(activeFilterCount>0||searchText)?"Clear filters":undefined} onSecondary={(activeFilterCount>0||searchText)?()=>{clearFilters();setSearchInput("");setSearchText("");}:undefined}/>
          ):(<>
            <ol aria-label="Places to eat" style={worldGrid(isTablet)}>
              {filtered.slice(0,displayCount).map((r,i)=>(
                <RestaurantCard
                  key={r.id||i}
                  cardRef={el=>{cardRefs.current[i]=el;}}
                  restaurant={r} rank={i+1}
                  batchEnrich={ownedEnrich[r.id||r.placeId]}
                  onDirections={()=>setDirModal({open:true,lat:r.lat,lng:r.lng,name:r.name,address:r.formattedAddress||r.shortFormattedAddress||r.vicinity||r.address||''})}
                  onShowOnMap={()=>handleShowOnMap(i)}
                  formatDistance={formatDistance}
                  isLocal={isLocal}
                />
              ))}
            </ol>
            {displayCount<filtered.length&&(
              <button type="button" onClick={handleLoadMore}
                style={{alignSelf:"center",minHeight:44,padding:"0 18px",borderRadius:14,border:`1px solid ${EAT.line}`,background:"#fff",color:"#3A3128",fontWeight:600,fontSize:fs(14),cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
                Load more · {filtered.length-displayCount} more
              </button>
            )}
          </>)}
        </div>
      ):(
        <div style={{position:"relative"}}>
          <div ref={mapRef} style={{height:"calc(100vh - 200px)",width:"100%"}}/>
          <button type="button" onClick={()=>setViewMode("list")} aria-label="Close the map" style={{position:"fixed",top:"calc(50px + env(safe-area-inset-top) + 10px)",right:"12px",zIndex:1200,background:"#fff",borderRadius:"50%",width:44,height:44,border:`1px solid ${EAT.line}`,boxShadow:"0 2px 8px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:EAT.ink}}><X size={20} strokeWidth={2} aria-hidden="true"/></button>
        </div>
      )}

      <style>{`::-webkit-scrollbar{display:none}.gs-rest-popup .leaflet-popup-content-wrapper{border-radius:10px;padding:0;overflow:hidden}.gs-rest-popup .leaflet-popup-content{margin:0}`}</style>

      {/* FILTER SHEET — Bakery/Bars, Vibe, Dietary, Min Rating, Max Price + the
          trust legend, moved off the inline band (replaces the old accordion +
          its floating close FAB). */}
      <FilterSheet world="eat" open={filterSheetOpen} onClose={()=>setFilterSheetOpen(false)} title="Food filters" onClear={sheetFilterCount>0?clearSheetFilters:undefined}>
        <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
          <div>
            <FilterGroupLabel>More food types</FilterGroupLabel>
            <ChipRow wrap>
              <WorldChip world="eat" label="Bakery and pastry" active={filterBakery} onClick={()=>setFilterBakery(!filterBakery)}/>
              <WorldChip world="eat" label="Bars and pubs" active={filterBars} onClick={()=>setFilterBars(!filterBars)}/>
            </ChipRow>
          </div>
          <div>
            <FilterGroupLabel>Vibe</FilterGroupLabel>
            <ChipRow wrap>
              {VIBE_OPTIONS.map(v=><WorldChip key={v.id} world="eat" label={v.label} active={!!filterVibes[v.id]} onClick={()=>setFilterVibes(p=>({...p,[v.id]:!p[v.id]}))}/>)}
            </ChipRow>
          </div>
          <div>
            <FilterGroupLabel>Dietary</FilterGroupLabel>
            <ChipRow wrap>
              {DIETARY_OPTIONS.map(d=><WorldChip key={d.id} world="eat" label={d.label} active={!!filterDietary[d.id]} onClick={()=>setFilterDietary(p=>({...p,[d.id]:!p[d.id]}))}/>)}
            </ChipRow>
          </div>
          <div>
            <FilterGroupLabel>Minimum rating</FilterGroupLabel>
            <ChipRow wrap>
              {[{v:0,l:"Any"},{v:3.5,l:"3.5+"},{v:4.0,l:"4.0+"},{v:4.5,l:"4.5+"}].map(({v,l})=><WorldChip key={v} world="eat" label={l} active={filterMinRating===v} clearable={false} onClick={()=>setFilterMinRating(v)}/>)}
            </ChipRow>
          </div>
          <div>
            <FilterGroupLabel>Maximum price</FilterGroupLabel>
            <ChipRow wrap>
              {[{v:0,l:"Any"},{v:1,l:"$"},{v:2,l:"$$"},{v:3,l:"$$$"},{v:4,l:"$$$$"}].map(({v,l})=><WorldChip key={v} world="eat" label={l} active={filterMaxPrice===v} clearable={false} onClick={()=>setFilterMaxPrice(v)}/>)}
            </ChipRow>
          </div>
          {/* The trust words the cards' More panel uses, glossed in plain words. */}
          <div style={{padding:"12px 14px",background:EAT.wash,borderRadius:12}}>
            <div className="font-mono uppercase" style={{fontSize:fs(10.5),letterSpacing:".12em",color:EAT.washInk,marginBottom:4}}>How sure we are</div>
            <div style={{fontSize:fs(13),lineHeight:1.5,color:EAT.washInk}}>
              <div><strong>Confirmed by Google</strong>: from the place&rsquo;s Google listing.</div>
              <div><strong>Mentioned in reviews</strong>: what customers report, which may have changed.</div>
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