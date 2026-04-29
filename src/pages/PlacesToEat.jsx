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

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import LocationModePicker from "@/components/location/LocationModePicker";
import { base44 } from "@/api/base44Client";

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
  bakery:        ['bakery', 'pastry_shop', 'dessert_shop', 'donut_shop', 'bagel_shop'],
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
// Cloudflare caches Google's openNow boolean for 12 hours. A place tagged
// "Open" at noon is still "Open" at 11 PM if the cache hasn't expired.
// This function parses the actual hours string (e.g. "11:00 AM – 9:30 PM")
// against the user's live local clock to give a mathematically correct answer.
function computeOpenStatus(place) {
  const hours = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || place.hours || [];
  if (!hours.length) return { isOpen: place.isOpen ?? null, todayHours: null, is24Hours: false };

  const now = new Date();
  const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const entry = hours.find(h => h?.startsWith(DAY[now.getDay()]));

  if (!entry) return { isOpen: place.isOpen ?? null, todayHours: null, is24Hours: false };

  const hoursText = entry.substring(entry.indexOf(':')+1).trim();
  if (hoursText.toLowerCase() === 'closed') return { isOpen: false, todayHours: 'Closed today', is24Hours: false };
  if (hoursText.toLowerCase().includes('24 hours')) return { isOpen: true, todayHours: 'Open 24 hours', is24Hours: true };

  let isLiveOpen = place.isOpen ?? null;
  try {
    const currentMins = now.getHours() * 60 + now.getMinutes();
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
  if (opts.freeParkingLot)     details.push({ icon:'🅿️', label:'Free parking lot',    free: true  });
  if (opts.paidParkingLot)     details.push({ icon:'🅿️', label:'Paid parking lot',    free: false });
  if (opts.freeStreetParking)  details.push({ icon:'🛣️', label:'Free street parking', free: true  });
  if (opts.paidStreetParking)  details.push({ icon:'🛣️', label:'Paid street parking', free: false });
  if (opts.valetParking)       details.push({ icon:'🎩', label:'Valet parking',        free: false });
  if (opts.freeGarage)         details.push({ icon:'🏢', label:'Free garage',          free: true  });
  if (opts.paidGarage)         details.push({ icon:'🏢', label:'Paid garage',          free: false });
  if (details.length === 0 && !opts.parkingAvailable) return null;
  if (details.length === 0 && opts.parkingAvailable)
    details.push({ icon:'🅿️', label:'Parking available', free: null });
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
function processRest(place, userLat, userLng) {
  const lat = place.location?.latitude || place.latitude || 0;
  const lng = place.location?.longitude || place.longitude || 0;
  const name  = place.displayName?.text || place.name || '';
  const open  = computeOpenStatus(place);
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
    ? place.photos.map(p => (typeof p === 'string' ? p : (p?.url || p?.full || p?.thumbnail)))
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
  // Intent tier badges — only show for Tier 3/4 (Tier 1/2 is the expected result, no label needed)
  if (place.tier === 1) badges.push({ icon:'✓', label:'Authentic',   color:'#15803D', bg:'#DCFCE7' });
  if (place.tier === 3) badges.push({ icon:'~', label:'Has It',       color:'#A16207', bg:'#FEF9C3' });
  if (place.tier === 4) badges.push({ icon:'?', label:'Not Specialist', color:'#6B7280', bg:'#F3F4F6' });
  if (place.hasDriveThru)             badges.push({ icon:'🚗', label:'Drive-Thru',  color:'#0277BD', bg:'#E1F5FE' });
  if (place.isTakeoutOnly)            badges.push({ icon:'📦', label:'Takeout Only',color:'#E65100', bg:'#FFF3E0' });
  if (open.is24Hours||vibes.lateNight)badges.push({ icon:'🌙', label:'Late Night',  color:'#1565C0', bg:'#E3F2FD' });
  if ((place.rating||0)>=4.7&&(place.userRatingCount||0)>500) badges.push({ icon:'⭐', label:'Top Rated', color:'#B45309', bg:'#FEF3C7' });

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
    reviews: (place.reviews || []).map((r) => ({
      rating: r.rating || 0,
      text:   r.text?.text || r.text || '',
      author: r.author || r.authorDisplayName || r.authorAttribution?.displayName || 'Anonymous',
      time:   r.time || r.relativePublishTimeDescription || '',
      profilePhoto: r.profilePhoto || r.authorAttribution?.photoUri || null,
    })),
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

// ─── DIRECTIONS PICKER ───────────────────────────────────────────────────────
function DirectionsPicker({ isOpen, onClose, lat, lng, name, userLat, userLng }) {
  if (!isOpen) return null;
  const origin = userLat && userLng;
  const go = app => {
    const urls = { google:`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin?`&origin=${userLat},${userLng}`:""}&travelmode=driving`, apple:`https://maps.apple.com/?daddr=${lat},${lng}${origin?`&saddr=${userLat},${userLng}`:""}&dirflg=d`, waze:`https://waze.com/ul?ll=${lat},${lng}&navigate=yes` };
    window.open(urls[app],'_blank'); onClose();
  };
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"20px",padding:"24px",width:"100%",maxWidth:"320px"}}>
        <div style={{textAlign:"center",marginBottom:"20px"}}><div style={{fontSize:"14px",color:GRAY}}>Get directions to</div><div style={{fontSize:"16px",fontWeight:"700",color:DARK}}>{name}</div></div>
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {[{key:'google',icon:'🗺️',name:'Google Maps'},{key:'apple',icon:'🍎',name:'Apple Maps'},{key:'waze',icon:'📍',name:'Waze'}].map(a=>(
            <button key={a.key} onClick={()=>go(a.key)} style={{display:"flex",alignItems:"center",gap:"14px",padding:"14px 18px",borderRadius:"12px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
              <span style={{fontSize:"28px"}}>{a.icon}</span><span style={{fontWeight:"600",color:DARK,fontSize:"15px"}}>{a.name}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{marginTop:"14px",width:"100%",padding:"12px",borderRadius:"12px",border:"none",background:"#F1F5F9",color:GRAY,fontWeight:"600",cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </motion.div>
    </div>
  );
}

// ─── PHOTO CAROUSEL ──────────────────────────────────────────────────────────
function PhotoCarousel({ photos=[], rank, badges=[] }) {
  const [cur,setCur]=useState(0); const [errs,setErrs]=useState({}); const ref=useRef(null);
  const valid=photos.filter((_,i)=>!errs[i]);
  const medalColors = ['#FFD700','#C0C0C0','#CD7F32'];
  const rankLabel   = rank<=3 ? ['🥇','🥈','🥉'][rank-1] : `#${rank}`;
  return (
    <div style={{position:"relative",background:"#F1F5F9"}}>
      {valid.length>0?(
        <div ref={ref} onScroll={()=>ref.current&&setCur(Math.round(ref.current.scrollLeft/ref.current.offsetWidth))} style={{display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",scrollbarWidth:"none",height:"180px"}}>
          {valid.map((p,i)=><img key={i} src={p} onError={()=>setErrs(e=>({...e,[photos.indexOf(p)]:true}))} style={{minWidth:"100%",height:"180px",objectFit:"cover",scrollSnapAlign:"start",flexShrink:0}} alt=""/>)}
        </div>
      ):(
        <div style={{height:"120px",background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"48px"}}>🍽️</div>
      )}
      {/* Rank badge */}
      <div style={{position:"absolute",top:"10px",left:"10px",width:"36px",height:"36px",borderRadius:"50%",background:rank<=3?medalColors[rank-1]:BLUE,color:rank<=3?"#fff":"#fff",fontWeight:"800",fontSize:rank<=3?"18px":"13px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.25)",border:"2px solid #fff"}}>{rankLabel}</div>
      {/* Smart badges */}
      {badges.length>0&&<div style={{position:"absolute",top:"10px",right:"10px",display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end"}}>{badges.slice(0,2).map((b,i)=><span key={i} style={{background:"rgba(255,255,255,0.95)",color:b.color,padding:"3px 8px",borderRadius:"6px",fontSize:"11px",fontWeight:"700",boxShadow:"0 1px 4px rgba(0,0,0,0.1)"}}>{b.icon} {b.label}</span>)}</div>}
      {valid.length>1&&<div style={{position:"absolute",bottom:"8px",right:"10px",background:"rgba(0,0,0,0.6)",color:"#fff",padding:"3px 8px",borderRadius:"20px",fontSize:"11px",fontWeight:"600"}}>📷 {cur+1}/{valid.length}</div>}
      {/* Dot indicators */}
      {valid.length>1&&<div style={{position:"absolute",bottom:"10px",left:"50%",transform:"translateX(-50%)",display:"flex",gap:"5px"}}>{valid.map((_,i)=><div key={i} style={{width:"5px",height:"5px",borderRadius:"50%",background:i===cur?"#fff":"rgba(255,255,255,0.5)"}}/>)}</div>}
    </div>
  );
}

// ─── TRUST TAG ────────────────────────────────────────────────────────────────
function TrustTag({ confirmed }) {
  return (
    <span style={{fontSize:"10px",fontWeight:"700",color:confirmed?"#2E7D32":"#E65100",background:confirmed?"#E8F5E9":"#FFF3E0",padding:"1px 6px",borderRadius:"4px",marginLeft:"4px"}}>
      {confirmed ? "✅ Confirmed" : "⚠️ Reviews"}
    </span>
  );
}

// ─── FALLBACK DISCLAIMER ─────────────────────────────────────────────────────
// Shown when search text has intent but no authentic (Tier 1/2) results found.
// e.g. "shabu shabu" typed but only generic restaurants in area.
function FallbackDisclaimer({ fallbackInfo, onExpandRadius }) {
  if (!fallbackInfo?.needed) return null;
  const label = fallbackInfo.intentLabel || 'that';
  return (
    <motion.div
      initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
      style={{ padding:"14px 16px", background:"#FFFBEB", borderRadius:"12px",
               border:"1px solid #FDE68A", marginBottom:"12px" }}
    >
      <div style={{ fontWeight:"800", color:"#92400E", fontSize:"14px", marginBottom:"6px" }}>
        🔍 No {label} restaurants found nearby
      </div>
      <div style={{ fontSize:"13px", color:"#B45309", marginBottom:"10px", lineHeight:"1.5" }}>
        These are the closest available options — they may serve {label} but aren't dedicated {label} restaurants.
      </div>
      <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
        <button onClick={onExpandRadius}
          style={{ padding:"8px 14px", borderRadius:"8px", border:"none",
                   background:"#F59E0B", color:"#fff", fontWeight:"700",
                   fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>
          📏 Expand Search Radius
        </button>
        {fallbackInfo.nearestAuthenticName && (
          <div style={{ padding:"8px 12px", borderRadius:"8px", background:"#FEF3C7",
                        fontSize:"12px", color:"#92400E", display:"flex", alignItems:"center", gap:"4px" }}>
            📍 Nearest {label}: <strong>{fallbackInfo.nearestAuthenticName}</strong>
            {fallbackInfo.nearestAuthenticDistanceMiles &&
              <span style={{ color:"#B45309" }}>({fallbackInfo.nearestAuthenticDistanceMiles} mi)</span>
            }
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── RESTAURANT CARD ─────────────────────────────────────────────────────────
function RestaurantCard({ restaurant, rank, onDirections, onShowOnMap }) {
  const [expanded,setExpanded]=useState(false);
  const name    = restaurant.displayName?.text || restaurant.name || "Restaurant";
  const address = restaurant.shortFormattedAddress || restaurant.formattedAddress || "";
  const phone   = restaurant.nationalPhoneNumber || restaurant.internationalPhoneNumber || "";
  const parking = restaurant.parking;
  const parkingConfirmed = parking?.source === 'api';
  const hasAnySeating = restaurant.hasIndoorSeating || restaurant.hasOutdoorSeating;
  const seatingConfirmed = restaurant.seatingSource === 'api';

  // Cuisine type from primary type
  const cuisineLabel = restaurant.primaryType
    ? restaurant.primaryType.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())
    : restaurant.types?.[0]?.replace(/_/g,' ')?.replace(/\b\w/g,l=>l.toUpperCase()) || null;

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:rank*0.03}} style={{background:"#fff",borderRadius:"16px",boxShadow:"0 2px 10px rgba(0,0,0,0.07)",overflow:"hidden",border:"1px solid #E2E8F0"}}>

      {/* Photo carousel */}
      <PhotoCarousel photos={restaurant.photos||(restaurant.photoUrl?[restaurant.photoUrl]:[])} rank={rank} badges={restaurant.badges||[]}/>

      <div style={{padding:"14px 16px"}}>
        {/* Name + cuisine */}
        <div style={{marginBottom:"4px"}}>
          {cuisineLabel&&<div style={{fontSize:"11px",fontWeight:"700",color:BLUE,letterSpacing:"0.5px",marginBottom:"2px"}}>{cuisineLabel}</div>}
          <div style={{fontWeight:"800",fontSize:"17px",color:DARK,lineHeight:"1.2"}}>{name}</div>
        </div>

        {/* Address */}
        <div style={{fontSize:"12px",color:GRAY,marginBottom:"7px"}}>{address}</div>

        {/* Rating / distance / price */}
        <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"8px",fontSize:"13px",marginBottom:"8px"}}>
          {restaurant.rating>0&&<span><span style={{color:GOLD}}>★</span> <span style={{fontWeight:"700",color:DARK}}>{restaurant.rating.toFixed(1)}</span><span style={{color:GRAY}}> ({(restaurant.userRatingCount||0).toLocaleString()})</span></span>}
          {restaurant.distance&&<><span style={{color:"#CBD5E1"}}>·</span><span style={{fontWeight:"600",color:BLUE}}>📍 {restaurant.distance}</span></>}
          {restaurant.priceStr&&<><span style={{color:"#CBD5E1"}}>·</span><span style={{fontWeight:"600",color:GRAY}}>{restaurant.priceStr}</span></>}
        </div>


        {/* Service tags */}
        <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"9px"}}>
          {restaurant.dineIn&&<span style={{background:"#EFF6FF",color:BLUE,padding:"3px 9px",borderRadius:"6px",fontSize:"11px",fontWeight:"600"}}>🍽️ Dine-in</span>}
          {restaurant.takeout&&<span style={{background:"#F0FDF4",color:"#15803D",padding:"3px 9px",borderRadius:"6px",fontSize:"11px",fontWeight:"600"}}>📦 Takeout</span>}
          {restaurant.delivery&&<span style={{background:"#FFF7ED",color:ORANGE,padding:"3px 9px",borderRadius:"6px",fontSize:"11px",fontWeight:"600"}}>🛵 Delivery</span>}
          {restaurant.hasDriveThru&&<span style={{background:"#E0F2FE",color:"#0277BD",padding:"3px 9px",borderRadius:"6px",fontSize:"11px",fontWeight:"600"}}>🚗 Drive-Thru</span>}
          {restaurant.reservable&&<span style={{background:"#F3E8FF",color:PURPLE,padding:"3px 9px",borderRadius:"6px",fontSize:"11px",fontWeight:"600"}}>📅 Reservable</span>}
          {restaurant.isCashOnly&&<span style={{background:"#FEF2F2",color:"#DC2626",padding:"3px 9px",borderRadius:"6px",fontSize:"11px",fontWeight:"600"}}>💵 Cash{restaurant.cashSource==='reviews'?' (reported)':''}</span>}
        </div>

        {/* Open status */}
        {restaurant.isOpen!==null&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",background:restaurant.isOpen?"#F0FDF4":"#FEF2F2",borderRadius:"8px",marginBottom:"10px",fontSize:"13px"}}>
            <span style={{width:"8px",height:"8px",borderRadius:"50%",background:restaurant.is24Hours?"#00BCD4":(restaurant.isOpen?GREEN:CORAL),flexShrink:0}}/>
            <span style={{fontWeight:"700",color:restaurant.is24Hours?"#006064":(restaurant.isOpen?"#15803D":"#DC2626")}}>{restaurant.is24Hours?'Open 24/7':(restaurant.isOpen?'Open':'Closed')}</span>
            {restaurant.todayHours&&!restaurant.is24Hours&&<span style={{color:GRAY}}>· {restaurant.todayHours}</span>}
          </div>
        )}

        {/* Best time note */}
        {restaurant.bestTimeNote&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:"8px",padding:"9px 12px",background:"#F0FDF4",borderRadius:"8px",marginBottom:"10px",fontSize:"12px"}}>
            <span style={{flexShrink:0}}>🕐</span>
            <div><span style={{fontWeight:"700",color:"#15803D",fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.4px"}}>Best Time to Visit  </span><span style={{color:"#166534"}}>{restaurant.bestTimeNote}</span></div>
          </div>
        )}

        {/* Customer favorites */}
        {restaurant.customerFavorites?.length>0&&(
          <div style={{padding:"10px 12px",background:"#FEF9EE",borderRadius:"10px",border:"1px solid #FDE68A",marginBottom:"10px"}}>
            <div style={{fontSize:"11px",fontWeight:"700",color:"#D97706",letterSpacing:"0.5px",marginBottom:"7px"}}>❤️ CUSTOMER FAVORITES</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
              {restaurant.customerFavorites.slice(0,5).map((f,i)=>{
                const label = f.dish || f.name || '';
                if (!label) return null;
                return (
                  <span key={i} style={{background:"#FDE68A",color:"#92400E",padding:"3px 10px",borderRadius:"20px",fontSize:"12px",fontWeight:"600"}}>
                    {label.charAt(0).toUpperCase()+label.slice(1)}{f.mentions>2?` ×${f.mentions}`:''}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SEATING ── */}
        {hasAnySeating&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:"8px",padding:"10px 12px",background:"#F8FAFC",borderRadius:"10px",border:"1px solid #E8EDF2",marginBottom:"10px"}}>
            <span style={{fontSize:"15px",marginTop:"1px"}}>🪑</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",marginBottom:"4px"}}>
                <span style={{fontSize:"13px",fontWeight:"700",color:DARK}}>Seating</span>
                <TrustTag confirmed={seatingConfirmed}/>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                {restaurant.hasIndoorSeating&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🏠 Indoor</span>}
                {restaurant.hasOutdoorSeating&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🌿 Outdoor/Patio</span>}
                {restaurant.seating?.hasLoungeSeating&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🛋️ Lounge</span>}
                {restaurant.seating?.capacityNote&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>📐 {restaurant.seating.capacityNote}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── PARKING ── */}
        {parking&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:"8px",padding:"10px 12px",background:"#F8FAFC",borderRadius:"10px",border:"1px solid #E8EDF2",marginBottom:"10px"}}>
            <span style={{fontSize:"15px",marginTop:"1px"}}>🅿️</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",marginBottom:"4px"}}>
                <span style={{fontSize:"13px",fontWeight:"700",color:DARK}}>Parking</span>
                <TrustTag confirmed={parkingConfirmed}/>
              </div>
              {parking.noParking?(
                <div style={{fontSize:"12px",color:CORAL}}>{parking.noParkingNote}</div>
              ):(
                <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                  {parking.details?.length>0?parking.details.map((d,i)=>(
                    <span key={i} style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>{d.icon} {d.label}{d.free===true?' · Free':d.free===false&&!d.cost?' · Paid':''}</span>
                  )):<span style={{fontSize:"12px",color:GRAY}}>Parking available</span>}
                  {parking.valetCost&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🎩 Valet {parking.valetCost}</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phone */}
        {phone&&(
          <a href={`tel:${phone}`} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",background:"#EFF6FF",borderRadius:"10px",marginBottom:"10px",textDecoration:"none",color:BLUE}}>
            <span style={{width:"34px",height:"34px",background:BLUE,color:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"15px",flexShrink:0}}>📞</span>
            <div><div style={{fontWeight:"600",fontSize:"14px"}}>{phone}</div><div style={{fontSize:"11px",color:GRAY}}>Tap to call</div></div>
          </a>
        )}

        {/* Action buttons */}
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <button onClick={onDirections} style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:BLUE,color:"#fff",fontWeight:"700",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>🧭 Directions</button>
          <button onClick={onShowOnMap} style={{padding:"10px 14px",borderRadius:"10px",border:"1px solid #E2E8F0",background:"#F8FAFC",color:DARK,fontWeight:"600",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>📍 Map</button>
          <button onClick={()=>setExpanded(!expanded)} style={{padding:"10px 14px",borderRadius:"10px",border:"none",background:expanded?DARK:"#F1F5F9",color:expanded?"#fff":DARK,fontWeight:"600",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>{expanded?"▲ Less":"▼ More"}</button>
        </div>

        {/* Expanded: hours, reviews, website */}
        <AnimatePresence>
          {expanded&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{marginTop:"12px",display:"flex",flexDirection:"column",gap:"10px"}}>

                {/* About This Place — editorial summary from Google */}
                {restaurant.editorialSummary&&(
                  <div style={{padding:"12px",background:"#F0F9FF",borderRadius:"10px",border:"1px solid #BAE6FD"}}>
                    <div style={{fontSize:"11px",fontWeight:"700",color:"#0369A1",letterSpacing:"0.5px",marginBottom:"6px"}}>📖 ABOUT THIS PLACE</div>
                    <p style={{fontSize:"13px",lineHeight:"1.6",color:"#0C4A6E",margin:0}}>{restaurant.editorialSummary}</p>
                  </div>
                )}

                {/* Full hours */}
                {restaurant.currentOpeningHours?.weekdayDescriptions?.length>0&&(
                  <div style={{padding:"12px",background:"#F8FAFC",borderRadius:"10px"}}>
                    <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,letterSpacing:"0.5px",marginBottom:"8px"}}>🕐 HOURS</div>
                    {restaurant.currentOpeningHours.weekdayDescriptions.map((day,i)=>{
                      const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                      const isToday=DAY.findIndex(d=>day.startsWith(d))===new Date().getDay();
                      return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"12px",fontWeight:isToday?"700":"400",color:isToday?BLUE:DARK,borderBottom:i<6?"1px solid #F1F5F9":"none"}}>
                        <span>{day.split(':')[0]}</span><span>{day.split(':').slice(1).join(':').trim()}</span>
                      </div>;
                    })}
                  </div>
                )}

                {/* Google reviews */}
                {restaurant.reviews?.length>0&&(
                  <div style={{padding:"12px",background:"#F8FAFC",borderRadius:"10px"}}>
                    <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,letterSpacing:"0.5px",marginBottom:"10px"}}>💬 REVIEWS ({restaurant.reviews.length})</div>
                    {restaurant.reviews.slice(0,5).map((r,i)=>(
                      <div key={i} style={{padding:"10px",background:"#fff",borderRadius:"9px",border:"1px solid #E2E8F0",marginBottom:i<restaurant.reviews.length-1?"8px":"0"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                            {r.profilePhoto?<img src={r.profilePhoto} alt="" style={{width:"24px",height:"24px",borderRadius:"50%",objectFit:"cover"}} onError={e=>e.target.style.display='none'}/>:<div style={{width:"24px",height:"24px",borderRadius:"50%",background:"#E2E8F0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:"700",color:GRAY}}>{r.author?.charAt(0)?.toUpperCase()||"?"}</div>}
                            <span style={{fontSize:"12px",fontWeight:"600",color:DARK}}>{r.author||"Anonymous"}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:"3px"}}>
                            {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:"10px",color:s<=r.rating?GOLD:"#CBD5E1"}}>★</span>)}
                            {r.time&&<span style={{fontSize:"10px",color:"#94A3B8",marginLeft:"4px"}}>· {r.time}</span>}
                          </div>
                        </div>
                        {r.text&&<p style={{fontSize:"12px",lineHeight:"1.5",color:"#475569",margin:0,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>"{r.text}"</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Website */}
                {restaurant.websiteUri&&(
                  <a href={restaurant.websiteUri} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px",background:"#F3E8FF",borderRadius:"10px",textDecoration:"none",color:PURPLE}}>
                    <div style={{width:"36px",height:"36px",background:PURPLE,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",flexShrink:0}}>🌐</div>
                    <div><div style={{fontWeight:"600",fontSize:"13px"}}>Visit Website</div><div style={{fontSize:"11px",color:GRAY}}>Menu & reservations</div></div>
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
  return <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:"4px",padding:"6px 12px",borderRadius:"20px",border:active?`2px solid ${color}`:"1.5px solid #E2E8F0",background:active?`${color}12`:"#fff",color:active?color:GRAY,fontWeight:active?"700":"500",fontSize:"12px",cursor:"pointer",fontFamily:"inherit",flexShrink:0,whiteSpace:"nowrap"}}>{icon&&<span>{icon}</span>}{label}</button>;
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
        <div style="font-weight:700;font-size:14px;color:#1A2332;margin-bottom:5px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;" onclick="window.viewRestDetails&&window.viewRestDetails(${idx})">${name}</div>
        <div style="font-size:11px;color:#64748B;margin-bottom:6px;">${address}</div>
        <div style="font-size:11px;padding:5px 8px;border-radius:6px;background:${is24Hours?'#E3F2FD':isOpen===true?'#F0FDF4':isOpen===false?'#FEF2F2':'#F5F5F5'};margin-bottom:6px;">
          <span style="font-weight:700;color:${is24Hours?'#1565C0':isOpen===true?'#15803D':isOpen===false?'#DC2626':'#9E9E9E'};">${is24Hours?'🔄 Open 24/7':isOpen===true?'● Open':isOpen===false?'● Closed':'● Hours N/A'}</span>
          ${todayHours&&!is24Hours?`<span style="color:#64748B;"> · ${todayHours}</span>`:''}
        </div>
        ${r.rating?`<div style="font-size:12px;color:#F59E0B;margin-bottom:8px;">★ <strong style="color:#1A2332;">${r.rating.toFixed(1)}</strong> <span style="color:#64748B;">(${(r.userRatingCount||0).toLocaleString()})</span>${r.distance?` · <span style="color:#3B82F6;">${r.distance}</span>`:''}</div>`:''}
        ${phone?`<a href="tel:${phone}" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:6px 10px;background:#EFF6FF;border-radius:6px;text-decoration:none;color:#3B82F6;font-size:11px;font-weight:600;">📞 ${phone}</a>`:''}
        <div style="display:flex;gap:8px;">
          <button onclick="window.openDirFromMap&&window.openDirFromMap(${idx})" style="flex:1;padding:8px;border:none;border-radius:7px;background:#3B82F6;color:#fff;font-weight:600;font-size:11px;cursor:pointer;">🧭 Directions</button>
          <button onclick="window.viewRestDetails&&window.viewRestDetails(${idx})" style="flex:1;padding:8px;border:none;border-radius:7px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:11px;cursor:pointer;">📋 Details</button>
        </div>
      </div>
    </div>`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function PlacesToEat() {
  const [restaurants, setRestaurants]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [viewMode, setViewMode]         = useState("list");
  const [selectedCuisines, setSelectedCuisines] = useState(new Set(["all"]));
  const [sortBy, setSortBy]             = useState("nearby");
  const [searchText, setSearchText]     = useState("");
  const [searchInput, setSearchInput]   = useState("");
  const [radius, setRadius]             = useState(10);
  const [displayCount, setDisplayCount] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [dirModal, setDirModal]         = useState({ open:false, lat:null, lng:null, name:'' });
  const [fallbackInfo, setFallbackInfo]  = useState(null);

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

  const { activeLocation } = useLocation();
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locationText = activeLocation?.label || activeLocation?.address?.formatted || "Set location";

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

  // ── FETCH ──────────────────────────────────────────────────────────────────
  // Fetches for: cuisine tab change, radius change, search text, location change.
  // Also fetches dedicated dietary results when dietary filters are active,
  // then MERGES them with the main results so filtering actually finds something.
  useEffect(() => {
    if (!lat || !lng) return;
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

        const { data } = await base44.functions.invoke('getRestaurants', {
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
        });

        const places = data?.places || data?.restaurants || [];
        if (data?.fallbackInfo) setFallbackInfo(data.fallbackInfo);

        if (places.length > 0) {
          setRestaurants(places.map(p => processRest(p, lat, lng)));
          setDisplayCount(20);
          setError(null); // Clear any old errors on success
        } else {
          setRestaurants([]); // Clear stale results so the UI doesn't show "67 results" from a prior fetch
          setError(data?.error || "No results found. Try expanding your radius.");
        }
      } catch(e) { setError(`Failed to load: ${e.message}`); }
      finally { setLoading(false); }
    })();
  // Every filter is now part of the backend's Semantic Text Compiler payload,
  // so every change must trigger a re-fetch. Using JSON.stringify for the
  // object states (filterVibes, filterDietary) so React sees deep changes.
  }, [lat, lng, radius, primaryCuisine, searchText, filterBakery, filterBars, filterOpenNow, filterMinRating, filterMaxPrice, filterParking, filterOutdoor, filterIndoor, filterDriveThru, JSON.stringify(filterVibes), JSON.stringify(filterDietary)]);

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
    } else if (sortBy==="nearby") {
      if (hasActiveSearch && r[0]?.backendRank) {
        // Backend v5.2+ pre-sorted by tier then quality. Use backendRank as the
        // authoritative order, but allow re-sorting within each tier by distance.
        r.sort((a,b) => {
          const ta = a.tier || 4, tb = b.tier || 4;
          if (ta !== tb) return ta - tb;
          return (a.distanceMiles||999) - (b.distanceMiles||999);
        });
      } else if (hasActiveSearch) {
        r.sort((a,b) => {
          const ta = a.tier || 4, tb = b.tier || 4;
          if (ta !== tb) return ta - tb;
          return (a.distanceMiles||999) - (b.distanceMiles||999);
        });
      } else {
        r.sort((a,b)=>(a.distanceMiles||999)-(b.distanceMiles||999));
      }
    } else if (sortBy==="best") {
      if (hasActiveSearch && r[0]?.backendRank) {
        // Backend already sorted by tier then quality — trust it directly.
        r.sort((a,b) => (a.backendRank||999) - (b.backendRank||999));
      } else if (hasActiveSearch) {
        r.sort((a,b) => {
          const ta = a.tier || 4, tb = b.tier || 4;
          if (ta !== tb) return ta - tb;
          const sa=(a.rating||0)*Math.log10(Math.max(a.userRatingCount||1,1));
          const sb=(b.rating||0)*Math.log10(Math.max(b.userRatingCount||1,1));
          return sb-sa;
        });
      } else {
        r.sort((a,b)=>{
          const sa=(a.rating||0)*Math.log10(Math.max(a.userRatingCount||1,1));
          const sb=(b.rating||0)*Math.log10(Math.max(b.userRatingCount||1,1));
          return sb-sa;
        });
      }
    }
    return r;
  }, [restaurants, filterBars, filterOpenNow, filterParking, filterOutdoor, filterIndoor, filterDriveThru, filterBakery, filterMinRating, filterMaxPrice, cuisineTypeFilter, filterVibes, filterDietary, sortBy, searchText]);

  const clearFilters = () => {
    setFilterOpenNow(false); setFilterVibes({}); setFilterDietary({});
    setFilterBakery(false); setFilterBars(false);
    setFilterMinRating(0); setFilterMaxPrice(0); setFilterParking(false);
    setFilterOutdoor(false); setFilterIndoor(false); setFilterDriveThru(false);
    setSelectedCuisines(new Set(['all']));
  };

  const handleSearch = () => setSearchText(searchInput.trim());

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
      window.openDirFromMap=(i)=>{const r=filtered[i];r&&setDirModal({open:true,lat:r.lat,lng:r.lng,name:r.name});};
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:'<div style="width:14px;height:14px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',iconSize:[14,14],className:""})}).addTo(map);
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
  },[viewMode,filtered,lat,lng,displayCount,selectedMapIndex]);

  const stats = {
    total: filtered.length,
    open:  filtered.filter(r=>r.isOpen===true).length,
    withParking: filtered.filter(r=>r.parking&&!r.parking.noParking).length,
  };

  return (
    <div style={{fontFamily:"'DM Sans',-apple-system,sans-serif",background:"#F8FAFC",minHeight:"100vh"}}>

      {/* ── HERO: blue gradient with title + labeled starting location ── */}
      <div style={{background:`linear-gradient(135deg,${BLUE} 0%,${BLUE_DARK} 100%)`,padding:"20px 16px 20px"}}>
        <button onClick={()=>window.history.back()} style={{display:"flex",alignItems:"center",gap:"5px",background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"8px",padding:"6px 10px",color:"#fff",fontSize:"13px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit",marginBottom:"14px"}}>← Back</button>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"18px"}}>
          <span style={{fontSize:"26px"}}>🍽️</span>
          <div style={{color:"#fff"}}>
            <div style={{fontWeight:"800",fontSize:"22px"}}>Places to Eat</div>
            <div style={{fontSize:"13px",opacity:0.85}}>Restaurants · Parking · Seating · Reviews</div>
          </div>
        </div>

        {/* Labeled starting location */}
        <div style={{fontSize:"10px",fontWeight:"800",letterSpacing:"1px",color:"rgba(255,255,255,0.75)",marginBottom:"6px"}}>📍 LOCATION</div>
        <div onClick={()=>setShowLocPicker(true)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",padding:"12px 14px",background:"#fff",borderRadius:"14px",cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.12)"}}>
          <span style={{color:DARK,fontSize:"14px",fontWeight:"600",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{locationText}</span>
          <span style={{background:BLUE_LT,color:BLUE,padding:"4px 10px",borderRadius:"8px",fontWeight:"700",fontSize:"12px",flexShrink:0}}>Change</span>
        </div>
      </div>

      {/* ── WHITE PANEL: search, radius, sort/view, filter trigger ── */}
      <div style={{padding:"16px"}}>
        {/* Hero search bar with gold submit */}
        <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
          <input value={searchInput} onChange={e=>setSearchInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} placeholder="🔎  Search dish or restaurant..." style={{flex:1,padding:"14px 16px",borderRadius:"14px",border:"2px solid #E2E8F0",fontSize:"15px",fontFamily:"inherit",outline:"none",color:DARK,background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}/>
          <button onClick={handleSearch} style={{padding:"14px 18px",borderRadius:"14px",border:"none",background:`linear-gradient(135deg,${GOLD},${ORANGE})`,color:"#fff",fontWeight:"800",fontSize:"16px",cursor:"pointer",fontFamily:"inherit",boxShadow:`0 3px 10px ${GOLD}55`}}>→</button>
          {searchText&&<button onClick={()=>{setSearchInput("");setSearchText("");}} style={{padding:"14px 14px",borderRadius:"14px",border:"2px solid #E2E8F0",background:"#fff",color:GRAY,fontWeight:"700",fontSize:"14px",cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
        </div>

        {/* Radius: labeled segmented control (equal widths) */}
        <div style={{marginBottom:"14px"}}>
          <div style={{fontSize:"10px",fontWeight:"800",letterSpacing:"1px",color:GRAY,marginBottom:"8px"}}>📏 RADIUS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px",background:"#F1F5F9",padding:"4px",borderRadius:"12px"}}>
            {RADIUS_OPTIONS.map(o=>(
              <button key={o.v} onClick={()=>setRadius(o.v)} style={{padding:"10px 0",borderRadius:"9px",border:"none",background:radius===o.v?BLUE:"transparent",color:radius===o.v?"#fff":GRAY,fontWeight:radius===o.v?"800":"600",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>
            ))}
          </div>
        </div>

        {/* Sort + view toggle — sibling pill groups */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:"14px"}}>
          <div style={{display:"flex",background:"#F1F5F9",borderRadius:"10px",padding:"3px"}}>
            {[{v:"nearby",l:"📍 Nearby"},{v:"best",l:"⭐ Best"}].map(({v,l})=>(
              <button key={v} onClick={()=>setSortBy(v)} style={{padding:"7px 14px",borderRadius:"8px",border:"none",background:sortBy===v?BLUE:"transparent",color:sortBy===v?"#fff":GRAY,fontWeight:"700",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",background:"#F1F5F9",borderRadius:"10px",padding:"3px"}}>
            {["list","map"].map(v=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{padding:"7px 14px",borderRadius:"8px",border:"none",background:viewMode===v?BLUE:"transparent",color:viewMode===v?"#fff":GRAY,fontWeight:"700",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{v==="list"?"List View":"Map View"}</button>
            ))}
          </div>
        </div>

        {/* Advanced Filters + result summary (single merged row) */}
        <button onClick={()=>setShowAdvanced(!showAdvanced)} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",padding:"12px 14px",borderRadius:"12px",border:`1.5px solid ${showAdvanced||activeFilterCount>0?BLUE:"#E2E8F0"}`,background:showAdvanced||activeFilterCount>0?BLUE_LT:"#fff",color:showAdvanced||activeFilterCount>0?BLUE:DARK,fontWeight:"700",fontSize:"13px",cursor:"pointer",fontFamily:"inherit",marginBottom:"10px"}}>
          <span>⚙️ Advanced Filters</span>
          {activeFilterCount>0&&<span style={{background:BLUE,color:"#fff",borderRadius:"10px",padding:"1px 7px",fontSize:"11px",fontWeight:"800"}}>{activeFilterCount}</span>}
          <span style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"10px",color:GRAY,fontSize:"12px",fontWeight:"600"}}>
            {loading?"Loading…":<><span>{stats.total} results</span>{stats.open>0&&<span style={{color:GREEN}}>· {stats.open} open</span>}</>}
            <span style={{color:GRAY}}>{showAdvanced?"▲":"▼"}</span>
          </span>
        </button>

        {/* Advanced panel */}
        <AnimatePresence>
          {showAdvanced&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{position:"relative",background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF2",padding:"14px",marginBottom:"10px",display:"flex",flexDirection:"column",gap:"14px"}}>

                {/* All Foods — cuisine multi-select (dietary types excluded; they live in Dietary section) */}
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                    <span style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px"}}>🍽️ All Foods</span>
                    {activeFilterCount>0&&<button onClick={clearFilters} style={{background:"none",border:"none",padding:"0",color:CORAL,fontSize:"11px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit",opacity:0.8}}>Clear Filters</button>}
                  </div>
                  <div ref={cuisineScrollRef} style={{display:"flex",gap:"6px",overflowX:"auto",paddingBottom:"6px",scrollbarWidth:"none",marginBottom:"8px"}}>
                    {CUISINES.filter(c=>!['vegetarian','vegan','halal','kosher'].includes(c.id)).map(c=>{
                      const active = selectedCuisines.has(c.id);
                      return (
                        <button key={c.id} onClick={()=>toggleCuisine(c.id)} style={{flexShrink:0,display:"flex",alignItems:"center",gap:"4px",padding:"6px 12px",borderRadius:"20px",border:active?`2px solid ${c.special?GOLD:BLUE}`:"1.5px solid #E2E8F0",background:active?(c.special?`${GOLD}15`:BLUE_LT):"#fff",color:active?(c.special?ORANGE:BLUE):GRAY,fontWeight:active?"700":"500",fontSize:"12px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                          <span>{c.icon}</span><span>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                    <Chip label="Bakery & Pastry" icon="🥐" active={filterBakery} onClick={()=>setFilterBakery(!filterBakery)} color={TEAL}/>
                    <Chip label="Bars & Pubs"     icon="🍺" active={filterBars}   onClick={()=>setFilterBars(!filterBars)}   color={ORANGE}/>
                  </div>
                </div>

                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>⏰ Status</div>
                  <Chip label="Open Now" active={filterOpenNow} onClick={()=>setFilterOpenNow(!filterOpenNow)} icon="🟢" color={GREEN}/>
                </div>

                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>✨ Vibe</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                    {VIBE_OPTIONS.map(v=><Chip key={v.id} label={v.label} icon={v.icon} active={!!filterVibes[v.id]} onClick={()=>setFilterVibes(p=>({...p,[v.id]:!p[v.id]}))} color={PURPLE}/>)}
                  </div>
                </div>

                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>🥦 Dietary</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                    {DIETARY_OPTIONS.map(d=><Chip key={d.id} label={d.label} icon={d.icon} active={!!filterDietary[d.id]} onClick={()=>setFilterDietary(p=>({...p,[d.id]:!p[d.id]}))} color={GREEN}/>)}
                  </div>
                </div>


                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>⭐ Min Rating</div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {[{v:0,l:"Any"},{v:3.5,l:"3.5+"},{v:4.0,l:"4.0+"},{v:4.5,l:"4.5+"}].map(({v,l})=><Chip key={v} label={l} active={filterMinRating===v} onClick={()=>setFilterMinRating(v)}/>)}
                  </div>
                </div>

                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>💰 Max Price</div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {[{v:0,l:"Any"},{v:1,l:"$"},{v:2,l:"$$"},{v:3,l:"$$$"},{v:4,l:"$$$$"}].map(({v,l})=><Chip key={v} label={l} active={filterMaxPrice===v} onClick={()=>setFilterMaxPrice(v)}/>)}
                  </div>
                </div>

                {/* Data trust legend */}
                <div style={{padding:"10px 12px",background:"#F8FAFC",borderRadius:"8px",border:"1px solid #E8EDF2"}}>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,marginBottom:"5px"}}>DATA TRUST GUIDE</div>
                  <div style={{fontSize:"11px",color:DARK,lineHeight:"1.7"}}>
                    <div>✅ <strong>Confirmed</strong> — Google Places API data (reliable)</div>
                    <div>⚠️ <strong>Reviews</strong> — Customer-reported, may have changed</div>
                  </div>
                </div>

                {activeFilterCount>0&&<button onClick={clearFilters} style={{padding:"9px",borderRadius:"8px",border:`1.5px solid ${CORAL}`,background:"#FFF5F5",color:CORAL,fontWeight:"700",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>✕ Clear All Filters ({activeFilterCount})</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── CONTENT ── */}
      {loading?(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:"40px",marginBottom:"12px",animation:"spin 2s linear infinite"}}>🍽️</div>
          <div style={{color:GRAY,fontWeight:"600"}}>
            {Object.values(filterDietary).some(Boolean)
              ? `Searching for ${Object.entries(filterDietary).filter(([_,v])=>v).map(([k])=>k.charAt(0).toUpperCase()+k.slice(1)).join(' & ')} restaurants...`
              : 'Finding restaurants...'}
          </div>
        </div>
      ):error?(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:"40px",marginBottom:"12px"}}>😕</div>
          <div style={{color:CORAL,fontWeight:"600",marginBottom:"12px"}}>{error}</div>
          <button onClick={()=>setRadius(r=>Math.min(r+5,25))} style={{padding:"10px 20px",borderRadius:"10px",border:`2px solid ${BLUE}`,background:BLUE_LT,color:BLUE,fontWeight:"700",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>Expand Radius</button>
        </div>
      ):viewMode==="list"?(
        <div style={{padding:"0 12px 100px",display:"flex",flexDirection:"column",gap:"12px"}}>
          {filtered.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",background:"#fff",borderRadius:"12px",border:"1px solid #E2E8F0"}}>
              <div style={{fontSize:"32px",marginBottom:"10px"}}>🔍</div>
              <div style={{fontWeight:"700",color:DARK,marginBottom:"6px"}}>No matches</div>
              <div style={{fontSize:"13px",color:GRAY,marginBottom:"14px"}}>Try adjusting filters or expanding the radius</div>
              {activeFilterCount>0&&<button onClick={clearFilters} style={{padding:"9px 18px",borderRadius:"8px",border:"none",background:BLUE,color:"#fff",fontWeight:"600",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>Clear Filters</button>}
            </div>
          ):(<>
            <FallbackDisclaimer
              fallbackInfo={fallbackInfo}
              onExpandRadius={() => setRadius(r => Math.min(r + 5, 25))}
            />
            {filtered.slice(0,displayCount).map((r,i)=>(
              <div key={r.id||i} ref={el=>cardRefs.current[i]=el}>
                <RestaurantCard
                  restaurant={r} rank={i+1}
                  onDirections={()=>setDirModal({open:true,lat:r.lat,lng:r.lng,name:r.name})}
                  onShowOnMap={()=>handleShowOnMap(i)}
                />
              </div>
            ))}
            {displayCount<filtered.length&&(
              <button onClick={()=>setDisplayCount(c=>c+20)} style={{padding:"14px",borderRadius:"12px",border:`2px solid ${BLUE}`,background:"#fff",color:BLUE,fontWeight:"700",fontSize:"14px",cursor:"pointer",fontFamily:"inherit",marginTop:"4px"}}>
                Load More · {filtered.length-displayCount} remaining
              </button>
            )}
          </>)}
        </div>
      ):(
        <div style={{position:"relative"}}>
          <div ref={mapRef} style={{height:"calc(100vh - 200px)",width:"100%"}}/>
          <button onClick={()=>setViewMode("list")} style={{position:"absolute",top:"12px",right:"12px",zIndex:1000,background:"#fff",borderRadius:"50%",width:"38px",height:"38px",border:"none",boxShadow:"0 2px 8px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"18px",color:DARK}}>✕</button>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}::-webkit-scrollbar{display:none}.gs-rest-popup .leaflet-popup-content-wrapper{border-radius:10px;padding:0;overflow:hidden}.gs-rest-popup .leaflet-popup-content{margin:0}`}</style>

      {/* Floating close button for advanced filter — follows page scroll */}
      {showAdvanced&&(
        <button onClick={()=>setShowAdvanced(false)} style={{position:"fixed",bottom:"90px",right:"16px",zIndex:9999,width:"40px",height:"40px",borderRadius:"50%",border:"none",background:BLUE,color:"#fff",fontWeight:"700",fontSize:"18px",cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      )}
      {/* Scroll-to-top — appears after scrolling down */}
      {displayCount>20&&<button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} style={{position:"fixed",bottom:"90px",right:"16px",zIndex:9998,display:"flex",alignItems:"center",gap:"4px",padding:"8px 14px",borderRadius:"24px",border:"none",background:DARK,color:"#fff",fontWeight:"700",fontSize:"12px",cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,0.3)",fontFamily:"inherit",opacity:0.9}}>↑ Top</button>}
      <LocationModePicker isOpen={showLocPicker} onClose={()=>setShowLocPicker(false)}/>
      <DirectionsPicker isOpen={dirModal.open} onClose={()=>setDirModal({open:false,lat:null,lng:null,name:''})} lat={dirModal.lat} lng={dirModal.lng} name={dirModal.name} userLat={lat} userLng={lng}/>
    </div>
  );
}