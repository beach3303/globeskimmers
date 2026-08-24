import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation, CITY_DISCLAIMER } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import DistanceUnitToggle from "@/components/location/DistanceUnitToggle";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { trackAffiliateClick } from "@/lib/affiliate";
import { viatorSearchLink, viatorProductLink } from "@/lib/viator";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import MapAppSelector from "@/components/MapAppSelector";
import AttractionAIDetails from "@/components/AttractionAIDetails";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import RefreshButton from "@/components/RefreshButton";
import { logEvent } from "@/lib/analytics";
import { logSearch, logZeroResults } from "@/lib/logSearch";
import { matchesQuery } from "@/lib/searchText";
import { ChevronLeft, MapPin, Star } from "lucide-react";
import { CAT, TEAL_DEEP, IVORY } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import WishlistButton from "@/components/WishlistButton";
import PersonaChooser from "@/components/PersonaChooser";
import { usePersona, personaRank } from "@/lib/persona";

// iPad editorial design tokens (design handoff: matches "Places to Eat · iPad").
const ED_SERIF = '"Instrument Serif", Georgia, serif';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)";
// Things-To-Do category accent — this finder's own color world. Replaces the
// Places-to-Eat coral (#D8443C) on the iPad editorial cards so the kicker /
// Directions button / tier accents read as part of THIS finder, not Eat.
// Sourced from CAT.todo.ink (#C5197A) — kept as a local const so the editorial
// tokens cluster reads in one place.
const ED_TODO = CAT.todo.ink; // #C5197A

const T={teal:"#00BCD4",tealD:"#00838F",dark:"#1A2332",dark2:"#243447",gray:"#64748B",grayL:"#F1F5F9",green:"#4CAF50",blue:"#1565C0",blueL:"#E3F2FD",coral:"#FF6B6B",gold:"#FFB74D",
  accent:"#F59E0B",accentD:"#D97706",accentL:"#FFFBEB"};

const CATEGORIES=[
  {id:"all",         label:"All",        icon:"⭐",color:T.accent},
  {id:"culture",     label:"Culture",    icon:"🏛️",color:"#7C3AED"},
  {id:"outdoor",     label:"Outdoors",   icon:"🌳",color:"#059669"},
  {id:"entertainment",label:"Fun",       icon:"🎢",color:"#DC2626"},
  {id:"nightlife",   label:"Nightlife",  icon:"🍻",color:"#1D4ED8"},
  {id:"family",      label:"Family",     icon:"👨‍👩‍👧",color:"#D97706"},
  {id:"wellness",    label:"Wellness",   icon:"♨️",color:"#DB2777"},
  {id:"tours",       label:"Tours",      icon:"🗺️",color:"#0891B2"},
];

const PROP_TAGS=[
  {key:"isFree",           icon:"🆓",label:"Free Entry",      color:"#059669",bg:"#D1FAE5"},
  {key:"isFamilyFriendly", icon:"👨‍👩‍👧",label:"Family Friendly",color:"#D97706",bg:"#FEF3C7"},
  {key:"isOutdoor",        icon:"🌤️",label:"Outdoor",         color:"#059669",bg:"#D1FAE5"},
  {key:"isIndoor",         icon:"🏛️",label:"Indoor",          color:"#7C3AED",bg:"#EDE9FE"},
  {key:"hasGuidedTour",    icon:"🎤",label:"Guided Tour",     color:"#0891B2",bg:"#E0F2FE"},
  {key:"isBucketList",     icon:"🏆",label:"Bucket List",     color:"#D97706",bg:"#FEF3C7"},
  {key:"isHiddenGem",      icon:"💎",label:"Hidden Gem",      color:"#7C3AED",bg:"#EDE9FE"},
  {key:"isPhotoWorthy",    icon:"📸",label:"Photo Worthy",    color:"#DB2777",bg:"#FCE7F3"},
  {key:"isAdventure",      icon:"⚡",label:"Adventure",       color:"#DC2626",bg:"#FEE2E2"},
  {key:"isCultural",       icon:"🎭",label:"Authentic Culture",color:"#92400E",bg:"#FEF3C7"},
  {key:"isAccessible",     icon:"♿",label:"Accessible",      color:"#1565C0",bg:"#E3F2FD"},
  {key:"isBudgetFriendly", icon:"💰",label:"Budget Friendly", color:"#059669",bg:"#D1FAE5"},
  {key:"isGoodForCouples", icon:"💑",label:"Great for Couples",color:"#DB2777",bg:"#FCE7F3"},
  {key:"isSeniorFriendly", icon:"🧓",label:"Senior Friendly", color:"#0891B2",bg:"#E0F2FE"},
  {key:"isPetFriendly",    icon:"🐾",label:"Pet Friendly",    color:"#059669",bg:"#D1FAE5"},
  // Audience tags introduced for the Phase 4 query restructure:
  // - groups: bachelor/bachelorette/large-party venues
  // - singles: hostel-style + solo-traveler-friendly venues
  // - teens: theme parks, arcades, escape rooms, zip lines, etc.
  //   ("teen-leaning" — distinct from family friendly which signals
  //   strollers / small kids)
  {key:"isGoodForGroups",  icon:"👥",label:"Great for Groups", color:"#2563EB",bg:"#DBEAFE"},
  {key:"isGoodForSingles", icon:"🧍",label:"Solo Friendly",    color:"#0E7490",bg:"#CFFAFE"},
  {key:"isGoodForTeens",   icon:"🛹",label:"Great for Teens",  color:"#9333EA",bg:"#F3E8FF"},
];

// Tour-mode display map. Keys match the `tourMode` value the backend
// stamps on results that came from a mode-bearing tour query
// ("walking tour" -> walking, etc.). Used to render a small chip on
// the activity card so a user can see "🚶 Walking tour" at a glance
// without expanding the card.
const TOUR_MODE_LABELS = {
  walking: { icon: "🚶", label: "Walking tour" },
  biking:  { icon: "🚴", label: "Bike tour" },
  boating: { icon: "⛵", label: "Boat tour" },
};

// Synonym map for fuzzy/conceptual activity searches — concrete terms (zipline,
// kayaking, ATV) already match Google well, but vague ones return junk. We expand
// ONLY the query sent to Google; the typed text stays as-is for display + the
// owned-data match, so results still read as what the user asked for.
const ACTIVITY_SYNONYMS = {
  "views": "scenic viewpoint lookout",
  "view": "scenic viewpoint lookout",
  "scenic views": "scenic viewpoint lookout",
  "great views": "scenic viewpoint lookout",
  "amazing views": "scenic viewpoint lookout",
  "spectacular views": "scenic viewpoint lookout",
  "lookout": "scenic viewpoint lookout",
  "sand boarding": "sandboarding dune",
  "sandboarding": "sandboarding dune",
  "mountain coaster": "mountain coaster alpine slide",
  "tubing": "river tubing",
  "cable car": "cable car aerial tramway",
  "hot spring": "hot springs thermal bath",
  "hot springs": "hot springs thermal bath",
  "banana boat": "banana boat ride watersports",
  "whale watching": "whale watching tour",
};
function expandActivityQuery(q) {
  const key = (q || "").trim().toLowerCase();
  return ACTIVITY_SYNONYMS[key] || q;
}

// ── localStorage cache for instant ThingsToDo page open ──────────────
// User sees their LAST results within 50ms of tapping the tile, while
// a fresh fetch happens in the background. The fresh data quietly
// replaces the cached data when it arrives (the "Fetching new spots"
// chip at the top already exists for this).
//
// Cache key includes lat/lng rounded to 2 decimals (~1km grid),
// category, and radius — so moving to a different neighborhood OR
// switching the category invalidates correctly. Walking 200m doesn't
// invalidate. TTL is 15 minutes — long enough that round-trip-from-
// finder-back-to-list always hits cache, short enough that ratings /
// open-now status stays reasonably fresh.
const TTD_CACHE_TTL_MS = 15 * 60 * 1000;
// Cache key prefix bumped to gs_ttd2 so any stale emoji-placeholder payloads
// cached before the live-tiers worker fix are discarded on first open.
const ttdCacheKey = (lat, lng, category, radius) =>
  `gs_ttd2_${lat.toFixed(2)}_${lng.toFixed(2)}_${category}_${radius}`;

function readTtdCache(lat, lng, category, radius) {
  if (!lat || !lng) return null;
  try {
    const raw = localStorage.getItem(ttdCacheKey(lat, lng, category, radius));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.t || Date.now() - parsed.t > TTD_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch { return null; }
}

function writeTtdCache(lat, lng, category, radius, data) {
  if (!lat || !lng) return;
  try {
    localStorage.setItem(
      ttdCacheKey(lat, lng, category, radius),
      JSON.stringify({ t: Date.now(), data }),
    );
  } catch {
    // localStorage full or disabled — non-fatal, the page still works
    // off the live fetch like before. No need to surface anything.
  }
}

// ── Skeleton placeholder cards ───────────────────────────────────────
// Replaces the previous centered-spinner state with a grey-card
// preview of the layout the user is about to see. Eye anchors land
// in the right places immediately, so when real data arrives, the
// page doesn't feel like it just appeared — it feels like it filled
// in. Combined with the localStorage cache (instant cached render on
// repeat opens), the page reads as "fast" even when the backend is
// still chewing on 36+ queries behind the scenes.
//
// `shimmer` is the moving-highlight animation. Subtle on purpose —
// strong shimmers feel busier than they help. The CSS gradient slides
// at 1.4s loop, matching the polish on Instagram / Linear's skeletons.
function SkeletonCard({ tall = false }) {
  return (
    <div
      aria-hidden
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 12,
        boxShadow: "0 1px 0 rgba(15,20,25,.04), 0 6px 14px -10px rgba(15,20,25,.06)",
        overflow: "hidden",
      }}
    >
      <div className="gs-shimmer" style={{ height: tall ? 140 : 110, borderRadius: 12, marginBottom: 10 }} />
      <div className="gs-shimmer" style={{ height: 14, borderRadius: 6, marginBottom: 8, width: "72%" }} />
      <div className="gs-shimmer" style={{ height: 11, borderRadius: 6, marginBottom: 6, width: "92%" }} />
      <div className="gs-shimmer" style={{ height: 11, borderRadius: 6, width: "55%" }} />
    </div>
  );
}

function SkeletonStrip({ count = 4 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${count}, minmax(160px, 1fr))`,
      gap: 10,
      overflowX: "auto",
      paddingBottom: 4,
    }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

function TtdSkeleton() {
  return (
    <div style={{ padding: "10px 12px 100px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 4px 10px" }}>
        <div className="gs-shimmer" style={{ width: 22, height: 22, borderRadius: "50%" }} />
        <div className="gs-shimmer" style={{ width: 200, height: 16, borderRadius: 6 }} />
      </div>
      <div style={{ marginBottom: 16 }}><SkeletonStrip count={3} /></div>

      <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 4px 10px" }}>
        <div className="gs-shimmer" style={{ width: 22, height: 22, borderRadius: "50%" }} />
        <div className="gs-shimmer" style={{ width: 180, height: 16, borderRadius: 6 }} />
      </div>
      <div style={{ marginBottom: 16 }}><SkeletonStrip count={3} /></div>

      <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 4px 10px" }}>
        <div className="gs-shimmer" style={{ width: 22, height: 22, borderRadius: "50%" }} />
        <div className="gs-shimmer" style={{ width: 100, height: 16, borderRadius: 6 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SkeletonCard tall /><SkeletonCard tall /><SkeletonCard tall /><SkeletonCard tall />
      </div>

      {/* Shimmer keyframes — scoped to elements with .gs-shimmer so we
          don't accidentally animate anything else. Linear-gradient
          moves left to right at 1.4s loop; the background size of 200%
          keeps the moving highlight always inside the visible area. */}
      <style>{`
        .gs-shimmer {
          background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
          background-size: 200% 100%;
          animation: gs-shimmer 1.4s linear infinite;
        }
        @keyframes gs-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function openStatus(p){
  const h=p.currentOpeningHours?.weekdayDescriptions||p.hours||[];
  if(!h.length) return {isOpen:p.isOpen??null,label:p.isOpen===true?"Open Now":p.isOpen===false?"Closed":"Hours Unknown",is24H:false,today:""};
  const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const ent=h.find((x)=>x?.toLowerCase().startsWith(days[new Date().getDay()].toLowerCase()));
  if(!ent) return {isOpen:null,label:"Hours Unknown",is24H:false,today:""};
  const txt=ent.split(":").slice(1).join(":").trim();
  if(txt.toLowerCase()==="closed") return {isOpen:false,label:"Closed Today",is24H:false,today:"Closed"};
  const cur=new Date().getHours()*60+new Date().getMinutes();
  const open=txt.split(",").some((seg)=>{
    const m=seg.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[–\-]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if(!m) return false;
    const tm=(s)=>{const n=s.trim().toUpperCase(),r=n.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);if(!r)return 0;let h=+r[1];const mm=r[2]?+r[2]:0;if(r[3]==="PM"&&h!==12)h+=12;if(r[3]==="AM"&&h===12)h=0;return h*60+mm;};
    let o=tm(m[1]),c=tm(m[2]);if(c<=o)c+=1440;return cur>=o&&cur<c;
  });
  return {isOpen:open,label:open?"Open Now":"Closed Now",is24H:false,today:txt};
}

// TierMapOverlay — fullscreen modal map for the National Icons / Regional
// Must-See "Map" button. Renders ON TOP of the TierCard's expanded modal
// (which stays mounted underneath), so the X here closes the overlay and
// returns the user to the same expanded card they were viewing.
// Shows two pins:
//   1. User location pin labeled "Current location" or "Selected location"
//      with the city/state from getLocationLabel(activeLocation).
//   2. Destination pin with activity icon + popup card containing name,
//      address, rating, open status, and travel-distance label.
// The popup card has its OWN X (top-right corner of the popup) which is
// the single close affordance — no separate overlay X. Closing the popup
// (via the in-popup X) also closes the overlay → returns to the expanded
// modal underneath. Wired via window._gsTDCloseTierMap which the popup
// HTML calls on click.
function TierMapOverlay({activity:a,userLat,userLng,onClose}){
  const mapRef=useRef(null);
  const mapInst=useRef(null);
  const destMkRef=useRef(null);
  const {activeLocation}=useLocation();
  const navigate=useNavigate();
  const userLocLabel=getLocationLabel(activeLocation);
  const userLocMode=activeLocation?.mode==='navigate'?'Selected location':'Current location';
  // "You are here" tooltip can be collapsed to a small pill ("📍 You are
  // here ⌄") to give the map more breathing room. Tap the pill to expand
  // back to the full card. Wired via window._gsTDToggleUserPin.
  const [userExpanded,setUserExpanded]=useState(true);
  // P1 — Directions modal opened from the destination popup. The modal
  // shows Google Maps / Apple Maps / Waze buttons that deep-link out to
  // the user's preferred maps app.
  const [showDirs,setShowDirs]=useState(false);
  useEffect(()=>{
    // Expose onClose + user-pin collapse toggle + directions opener +
    // transportation-info navigation to popup inline-HTML buttons.
    // Cleared on unmount so they don't leak between activity changes.
    /** @type {any} */ (window)._gsTDCloseTierMap=onClose;
    /** @type {any} */ (window)._gsTDToggleUserPin=()=>setUserExpanded(e=>!e);
    /** @type {any} */ (window)._gsTDOpenDirs=()=>setShowDirs(true);
    /** @type {any} */ (window)._gsTDOpenTransport=()=>{
      // P2 — navigate to Transportation Info page with the destination
      // pre-filled via URL params + a fromMap flag so the Back button
      // can navigate(-1) back to the previous page instead of going home.
      const params=new URLSearchParams({
        fromMap:'true',
        to_lat:String(a.lat),
        to_lng:String(a.lng),
        to_name:a.displayName?.text||a.name||'',
        to_address:a.formattedAddress||'',
      });
      onClose();
      navigate(`/Transportation?${params.toString()}`);
    };
    return()=>{
      delete /** @type {any} */ (window)._gsTDCloseTierMap;
      delete /** @type {any} */ (window)._gsTDToggleUserPin;
      delete /** @type {any} */ (window)._gsTDOpenDirs;
      delete /** @type {any} */ (window)._gsTDOpenTransport;
    };
  },[onClose,a,navigate]);
  // "Reset view" handler — re-fits bounds to both pins AND re-opens the
  // destination popup. Used when the user pans/zooms away or closes the
  // popup. The user-pin tooltip is permanent so always visible regardless.
  // Padding is intentionally generous (~200px each side) so both popup
  // CARDS — not just the pins — stay fully on-screen. The destination
  // popup is ~270px wide × ~200px tall above its pin; the user tooltip
  // is ~180px wide × ~80px tall below its pin. Without generous padding,
  // cards near map edges get clipped. maxZoom:11 keeps the view zoomed
  // out enough that the cards have breathing room.
  const FIT_PADDING={padding:[200,180],maxZoom:11};
  const resetView=()=>{
    if(!mapInst.current||!destMkRef.current) return;
    mapInst.current.fitBounds([[userLat,userLng],[a.lat,a.lng]],FIT_PADDING);
    setTimeout(()=>destMkRef.current.openPopup(),300);
  };
  useEffect(()=>{
    if(!mapRef.current||!a?.lat||!a?.lng||userLat==null||userLng==null) return;
    const init=()=>{
      if(mapInst.current) mapInst.current.remove();
      const map=window.L.map(mapRef.current);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
      mapInst.current=map;
      // ── USER LOCATION PIN ────────────────────────────────────────────────
      // Uses a Leaflet TOOLTIP (not popup) with permanent:true + direction:
      // 'bottom'. This solves the popup-overlap bug: popups all default to
      // anchor above their marker, so when the two pins are close on screen
      // (e.g. Disneyland + Haneda) the popups stacked on top of each other.
      // The tooltip is anchored BELOW the user pin, so it can never collide
      // with the destination popup above its pin. Tooltip is compact and
      // always visible — no collapse needed at this size.
      // Internationally aware via getLocationLabel: shows "Pensacola, FL"
      // for US, "Kyoto, Japan" for Japan, "Manila, Philippines" etc.
      // **REUSE pattern**: when we wire overlay-style maps for PlacesToEat /
      // CoffeeFinder / ATMFinder / Money / Restroom, the user pin should
      // ALSO be a permanent tooltip with direction:'bottom' for the same
      // anti-collision reason.
      const userMk=window.L.marker([userLat,userLng],{icon:window.L.divIcon({html:`<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,iconSize:[16,16],className:""})}).addTo(map);
      // Collapsible tooltip: expanded = full card with title/mode/label and
      // a ⌃ collapse button top-right; collapsed = compact "📍 You are
      // here ⌄" pill that taps to expand. interactive:true so the inline
      // toggle button receives clicks instead of passing through to the map.
      const userTooltipHtml=userExpanded
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsTDToggleUserPin&&window._gsTDToggleUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:calc(10px*var(--fs));font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:calc(12px*var(--fs));margin-bottom:2px;padding-right:24px;">📍 You are here</div><div style="font-weight:700;color:#4285F4;font-size:calc(11px*var(--fs));margin-bottom:2px;">${userLocMode}</div><div style="color:#64748B;font-size:calc(10px*var(--fs));line-height:1.3;">${userLocLabel||''}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsTDToggleUserPin&&window._gsTDToggleUserPin()"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">📍 You are here</span><span style="color:#64748B;font-size:calc(10px*var(--fs));font-weight:700;">⌄</span></div>`;
      userMk.bindTooltip(userTooltipHtml,{permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:true});
      // ── DESTINATION PIN ──────────────────────────────────────────────────
      const color=a.activityColor||T.accent;
      const sz=40;
      const destMk=window.L.marker([a.lat,a.lng],{icon:window.L.divIcon({html:`<div style="width:${sz}px;height:${sz}px;background:${color};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 16px ${color}90;border:3px solid #fff;">${a.activityIcon||"⭐"}</div>`,iconSize:[sz,sz],className:""})}).addTo(map);
      destMkRef.current=destMk;
      const distMi=a.distanceMiles||0;
      const travelTxt=a.travelType||(distMi>100?'✈️ Flights Required':distMi>50?'🚗 Drive':distMi>15?'🚗 Short Drive':'📍 Nearby');
      const distStr=`${distMi.toFixed(1)} mi`;
      const st=openStatus(a);
      const stColor=st.isOpen===true?"#15803D":st.isOpen===false?"#DC2626":"#9E9E9E";
      const stBg=st.isOpen===true?"#F0FDF4":st.isOpen===false?"#FEF2F2":"#F5F5F5";
      // Destination popup card with its own close X in the top-right corner.
      // Default Leaflet anchor is ABOVE the marker. With the user-pin tooltip
      // below its marker, the two never collide regardless of how close the
      // pins are on screen.
      // closeButton:false disables Leaflet's default X (we use a custom-
      // styled one). autoClose:false + closeOnClick:false prevent the
      // popup from being accidentally dismissed by panning or clicking the
      // map. The custom X calls window._gsTDCloseTierMap → closes the
      // WHOLE overlay (returns to expanded card modal).
      // Status row now includes today's open/close hours when available
      // (st.today is the parsed "9:00 AM – 10:00 PM" string from openStatus).
      // Format: "Closed Now · 9:00 AM – 10:00 PM" so user sees BOTH whether
      // it's open right now AND the actual hours for today.
      const statusHtml=st.today
        ? `<span style="font-weight:700;color:${stColor};font-size:calc(12px*var(--fs));">${st.label}</span><span style="color:#64748B;margin-left:6px;font-size:calc(12px*var(--fs));">· ${st.today}</span>`
        : `<span style="font-weight:700;color:${stColor};font-size:calc(12px*var(--fs));">${st.label}</span>`;
      // P1 — Directions button (always shown). P2 — Transportation Info
      // button (only when distance < 100 mi, since flights are needed
      // for longer distances and public transit lookups don't make
      // sense). Buttons stack horizontally below the travel-distance
      // strip. Directions opens the Google/Apple/Waze app-picker modal
      // ON TOP of this overlay; Transportation navigates to the
      // Transportation Info page with destination pre-filled.
      const ctaButtonsHtml=`<div style="display:flex;gap:6px;margin-top:8px;">
        <button onclick="window._gsTDOpenDirs&&window._gsTDOpenDirs()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;border:none;border-radius:8px;background:linear-gradient(135deg,#D97706,#F59E0B);color:#fff;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">🧭 Directions</button>
        ${distMi<100?`<button onclick="window._gsTDOpenTransport&&window._gsTDOpenTransport()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px;border:none;border-radius:8px;background:#EDE9FE;color:#7C3AED;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">🚌 Transit</button>`:''}
      </div>`;
      destMk.bindPopup(`<div style="font-family:-apple-system,sans-serif;width:250px;padding:12px 14px;position:relative;"><button onclick="window._gsTDCloseTierMap&&window._gsTDCloseTierMap()" aria-label="Close" style="position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:14px;font-weight:800;z-index:10;display:flex;align-items:center;justify-content:center;font-family:inherit;">✕</button><div style="font-weight:700;font-size:calc(15px*var(--fs));color:#1A2332;margin-bottom:5px;line-height:1.3;padding-right:30px;">${a.displayName?.text||a.name}</div><div style="font-size:12px;color:#64748B;margin-bottom:7px;">📍 ${a.formattedAddress||''}</div>${a.rating?`<div style="font-size:12px;color:#F59E0B;margin-bottom:7px;">★ <strong style="color:#1A2332;">${a.rating}</strong>${a.userRatingCount>0?` <span style="color:#64748B;">(${a.userRatingCount})</span>`:""}</div>`:""}<div style="font-size:calc(12px*var(--fs));padding:6px 9px;border-radius:7px;background:${stBg};margin-bottom:8px;">${statusHtml}</div><div style="font-size:12px;padding:7px 10px;border-radius:7px;background:#FEF3C7;color:#92400E;font-weight:700;">${travelTxt} · ${distStr}</div>${ctaButtonsHtml}</div>`,{maxWidth:270,closeButton:false,autoClose:false,closeOnClick:false});
      // Fit both pins into view + auto-open destination popup. Uses the
      // shared FIT_PADDING (200px top/bottom, 180px left/right) so BOTH
      // popup cards stay fully on-screen even when one pin is near the
      // viewport edge. The user tooltip is permanent so it's always visible.
      map.fitBounds([[userLat,userLng],[a.lat,a.lng]],FIT_PADDING);
      setTimeout(()=>destMk.openPopup(),300);
    };
    if(!window.L){
      const lk=document.createElement("link"); lk.rel="stylesheet"; lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(lk);
      const sc=document.createElement("script"); sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; sc.onload=init; document.head.appendChild(sc);
    } else init();
    return()=>{ if(mapInst.current){mapInst.current.remove();mapInst.current=null;} };
  },[a,userLat,userLng,userLocLabel,userLocMode,userExpanded]);
  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,background:"#000",zIndex:10001,display:"flex",flexDirection:"column"}}>
      <div ref={mapRef} style={{flex:1,width:"100%"}}/>
      {/* Close X — this overlay is a fullscreen fixed inset:0 modal that
          COVERS the brand banner, and the only dismiss control was the ✕
          inside the destination Leaflet popup (which disappears if the popup
          is closed). Add a standalone always-visible close button wired to
          the same onClose handler. zIndex 10006 sits above the reset button
          (10003) and the directions modal wrapper (10005). */}
      <button onClick={onClose} aria-label="Close map" style={{position:"absolute",top:"calc(env(safe-area-inset-top) + 14px)",right:"14px",zIndex:10006,background:"#fff",borderRadius:"50%",width:"42px",height:"42px",border:"none",boxShadow:"0 3px 12px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"calc(20px*var(--fs))",color:T.dark}}>✕</button>
      {/* Reset view — restores the default "both pins centered + destination
          card open" state. Useful after user pans/zooms away or closes the
          destination popup. User pin tooltip is permanent so always visible. */}
      <button onClick={resetView} aria-label="Show both pins" style={{position:"absolute",bottom:"24px",left:"16px",zIndex:10003,padding:"10px 14px",borderRadius:"22px",border:"none",background:"rgba(255,255,255,0.96)",color:T.dark,fontSize:"calc(13px*var(--fs))",fontWeight:"700",cursor:"pointer",boxShadow:"0 2px 12px rgba(0,0,0,0.3)",display:"flex",alignItems:"center",gap:"6px",fontFamily:"inherit"}}>
        <span style={{fontSize:"calc(15px*var(--fs))"}}>↺</span> Show both pins
      </button>
      {/* Directions modal (P1). Rendered inside the overlay so its
          z-index (9999 from the Directions component) stacks correctly
          relative to this overlay (10001) — wait, that's lower. Use
          a wrapper that bumps the modal above the overlay backdrop. */}
      <div style={{position:"fixed",inset:0,zIndex:10005,pointerEvents:showDirs?'auto':'none'}}>
        <MapAppSelector
          isOpen={showDirs}
          onClose={()=>setShowDirs(false)}
          destination={{
            name:a.displayName?.text||a.name,
            address:a.formattedAddress||a.shortFormattedAddress||a.vicinity||a.address||"",
            latitude:a.lat,
            longitude:a.lng,
          }}
          userLat={userLat}
          userLng={userLng}
        />
      </div>
    </motion.div>
  );
}

// ─── ACTIVITY CARD — editorial layout (responsive: phone + iPad) ─────────────
// Full-width editorial card: big photo (tablet ~360 / phone ~200) + rank badge +
// category tag, magenta attraction-category kicker, serif name, Say-it/Translate/
// rating/distance row, tinted pill tags, green Open bar, blue phone bar, three
// action buttons, and a "More ▾" expand panel (badges / property tags /
// what-people-love / heads-up / best-time / address / daily hours /
// AttractionAIDetails / website).
// Reuses PhotoGalleryModal / NameLanguageHelp / AttractionAIDetails /
// MapAppSelector / openStatus / PROP_TAGS / TOUR_MODE_LABELS.
// RESPONSIVE: renders the editorial layout at BOTH widths. `isTablet` gates every
// size — tablet keeps the original generous sizes; phone uses compact phone-tuned
// sizes (smaller photo, tighter radius/type/padding) while keeping the exact same
// fields, handlers, and sub-components. fs() stays on every text size so the
// 4-step glasses control scales card text gracefully (serif name has a 2-line
// clamp + the card uses min-height so it GROWS instead of clipping).
// Only surface "Book a tour here" (Viator) where a bookable experience actually
// exists — real attractions / landmarks / museums / ticketed sights — NOT on
// generic parks, beaches, plazas, or spots with no comparable tour. Keeps the
// affiliate honest (no dead "book a tour" that returns nothing relevant).
const TOURABLE_RE = /tourist_attraction|attraction|museum|gallery|monument|memorial|landmark|historic|heritage|castle|palace|\bfort\b|ruin|temple|cathedral|basilica|shrine|mosque|tower|observation|viewpoint|zoo|aquarium|theme_park|amusement|water_?park|national_park|waterfall|cave|volcano|cruise|\bboat\b|harbou?r|botanical|winery|distillery|culture|cultural/i;
function isTourable(a) {
  const hay = `${a?.category || ''} ${(a?.types || []).join(' ')} ${a?.activityLabel || ''} ${a?.activityCategory || ''}`.toLowerCase();
  return TOURABLE_RE.test(hay);
}

function ActivityCardTablet({a,index,onMap,isHighlighted,cardRef,forceExpanded,userLat,userLng,formatDistance,isTablet}){
  const [dirs,setDirs]=useState(false); const [exp,setExp]=useState(false); const [hoursExp,setHoursExp]=useState(false); const [gallery,setGallery]=useState({open:false,idx:0});
  const [viatorMatch,setViatorMatch]=useState(null); // null=checking · true=Viator has products · false=no · 'na'=can't verify (no key/rate-limited)
  const fs=(n)=>`calc(${n}px*var(--fs))`;
  // t(tabletValue, phoneValue) — pick the size for the active platform. Used for
  // BOTH fs()-wrapped type sizes and raw px (photo height, radius, paddings).
  const t=(tab,ph)=>isTablet?tab:ph;
  useEffect(()=>{if(forceExpanded)setExp(true);},[forceExpanded]);
  const name=a.displayName?.text||a.name||"Activity"; const st=openStatus(a);
  // Book a tour — Viator affiliate deep-link (search for this attraction). High
  // intent; earns via pid. Logged through /aff/click (SubID→D1).
  const openViatorTour=async()=>{
    const url=await trackAffiliateClick({partner:"viator",targetUrl:viatorSearchLink(name),category:"tour",productName:name,destCity:a.city,destCountry:a.country});
    window.open(url,"_blank");
  };
  // Only show "Book a tour" when Viator actually has products for THIS attraction.
  // Pre-filter with isTourable (cheap, no API) to skip non-attractions; the API
  // confirms a real match. 'na' (no key / rate-limited) → fall back to heuristic.
  useEffect(()=>{
    if(!isTourable(a)){setViatorMatch(false);return;}
    let cancelled=false;
    callWorker('viator/match',{name})
      .then(({data})=>{if(!cancelled)setViatorMatch(data?.match===true?true:data?.match===false?false:'na');})
      .catch(()=>{if(!cancelled)setViatorMatch('na');});
    return()=>{cancelled=true;};
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeTags=PROP_TAGS.filter(t=>a.props?.[t.key]);
  const aColor=a.activityColor||T.accent;
  const photos=(a.photos||[]).filter(Boolean);
  const medalGrad=index===0?"linear-gradient(135deg,#FFD700,#FFA000)":index===1?"linear-gradient(135deg,#B0BEC5,#78909C)":index===2?"linear-gradient(135deg,#FFAB40,#F57C00)":aColor;
  const openText=st.label;
  const photoH=t(360,200);   // tablet 360px, phone ~200px
  const radius=t("28px","20px");

  const Tag=({bg,color,children})=>(
    <span style={{background:bg,color,borderRadius:"999px",padding:`${fs(t(9,6))} ${fs(t(16,12))}`,fontSize:fs(t(15.5,12.5)),fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
  );

  return(
    <motion.div ref={cardRef} initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{delay:Math.min(index,8)*0.03}}
      style={{background:"#fff",borderRadius:radius,overflow:"hidden",boxShadow:isHighlighted?`0 0 0 3px ${T.accent},0 24px 50px -30px rgba(22,17,13,.4)`:"0 24px 50px -30px rgba(22,17,13,.4)",border:isHighlighted?`2px solid ${T.accent}`:`1px solid ${ED_RULE}`,transition:"box-shadow 0.3s,border 0.3s",
      /* min-height (not fixed height) — the card grows with enlarged text
         instead of clipping; the photo height stays fixed, the body flows. */
      minHeight:fs(t(520,360))}}>

      {/* Photo — editorial block (tablet 360 / phone ~200); reuse photos + gallery, rank + category tag overlays */}
      <div style={{position:"relative",height:fs(photoH),background:`linear-gradient(135deg,${aColor}ee,${aColor}99)`}}>
        {photos.length>0?(
          // Swipeable inline carousel (scroll-snap) — swipe photos left/right without
          // expanding; tap opens the fullscreen gallery. Mirrors Eat/Coffee.
          <div style={{display:"flex",height:"100%",overflowX:"auto",scrollSnapType:"x mandatory",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
            {photos.map((p,i)=>(
              <img key={i} src={p} alt="" onClick={()=>setGallery({open:true,idx:i})} style={{minWidth:"100%",height:"100%",objectFit:"cover",scrollSnapAlign:"start",flexShrink:0,cursor:"zoom-in"}}/>
            ))}
          </div>
        ):(
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:fs(t(96,56))}}>{a.activityIcon||"⭐"}</div>
        )}
        {/* Rank badge */}
        <div style={{position:"absolute",top:fs(t(14,12)),left:fs(t(14,12)),background:medalGrad,color:"#fff",width:fs(t(40,30)),height:fs(t(40,30)),borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:fs(t(16,13)),boxShadow:"0 2px 8px rgba(0,0,0,0.25)",border:"2px solid #fff"}}>{index+1}</div>
        {/* Category tag */}
        {a.activityLabel&&<div style={{position:"absolute",top:fs(t(14,12)),right:fs(t(14,12)),background:"rgba(255,255,255,0.95)",backdropFilter:"blur(8px)",padding:`${fs(t(5,4))} ${fs(t(13,10))}`,borderRadius:"999px",fontSize:fs(t(14,11)),fontWeight:700,color:aColor,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>{a.activityIcon} {a.activityLabel}</div>}
        {photos.length>1&&<div style={{position:"absolute",bottom:fs(t(12,10)),right:fs(t(12,10)),background:"rgba(0,0,0,0.6)",color:"#fff",padding:`${fs(t(4,3))} ${fs(t(11,9))}`,borderRadius:"999px",fontSize:fs(t(13,11)),fontWeight:600,cursor:"pointer"}} onClick={()=>setGallery({open:true,idx:0})}>📷 {photos.length} photos</div>}
      </div>

      <div style={{padding:t(`${fs(28)} ${fs(32)} ${fs(32)}`,`${fs(16)} ${fs(16)} ${fs(18)}`)}}>
        {/* Attraction-category kicker — Things-To-Do magenta accent (not Eat coral) */}
        {a.activityLabel&&<div style={{color:ED_TODO,fontWeight:600,fontSize:fs(t(17,13)),letterSpacing:"0.2px"}}>{a.activityIcon} {a.activityLabel}</div>}
        {/* Serif name — 2-line clamp + min-height so enlarged text grows the card */}
        <h3 style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:fs(t(38,26)),lineHeight:1.04,color:ED_INK,margin:`${fs(4)} 0 0`,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{name}</h3>

        {/* Tour mode chip */}
        {a.tourMode && TOUR_MODE_LABELS[a.tourMode] && (
          <div style={{display:"inline-flex",alignItems:"center",gap:fs(5),padding:`${fs(4)} ${fs(t(12,10))}`,marginTop:fs(10),background:"#F1F5F9",color:"#334155",borderRadius:"999px",fontSize:fs(t(15,12.5)),fontWeight:600}}>
            <span>{TOUR_MODE_LABELS[a.tourMode].icon}</span>{TOUR_MODE_LABELS[a.tourMode].label}
          </div>
        )}

        {/* Say it / Translate / rating / distance */}
        <div style={{display:"flex",gap:fs(t(16,12)),alignItems:"center",flexWrap:"wrap",marginTop:fs(t(12,10)),fontSize:fs(t(17,13.5)),color:ED_INK3}}>
          <NameLanguageHelp placeId={a.placeId||a.id} name={name}/>
          {a.rating&&<span><span style={{color:"#E0922F"}}>★</span> <span style={{fontWeight:700,color:ED_INK2}}>{a.rating}</span>{a.userRatingCount>0&&<span> ({a.userRatingCount.toLocaleString()})</span>}</span>}
          {a.distanceMiles!=null&&<span>· {formatDistance(a.distanceMiles)}</span>}
        </div>

        {/* Street address — muted single-line, on-card at both widths */}
        {a.formattedAddress&&<div style={{marginTop:fs(t(8,6)),fontSize:fs(t(13.5,12)),color:ED_INK3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>📍 {a.formattedAddress}</div>}

        {/* Pill tags — traveler badges + property tags */}
        {(a.badges?.length>0||activeTags.length>0||a.outdoorContext)&&(
          <div style={{display:"flex",gap:fs(t(10,8)),flexWrap:"wrap",marginTop:fs(t(16,12))}}>
            {a.badges?.map((b,i)=><Tag key={`b${i}`} bg={T.accentL} color={T.accentD}>{b}</Tag>)}
            {a.outdoorContext&&<Tag bg="#FEF3C7" color="#92400E">🏛️ {a.outdoorContext}</Tag>}
            {activeTags.map((t,i)=><Tag key={`t${i}`} bg={t.bg} color={t.color}>{t.icon} {t.label}</Tag>)}
          </div>
        )}

        {/* Open bar */}
        {(st.today||st.isOpen!==null)&&(
          <div style={{marginTop:fs(t(18,12)),background:st.isOpen===true?"#E7F3EA":st.isOpen===false?"#FBE0DC":ED_IVORY2,borderRadius:t("16px","14px"),padding:t(`${fs(16)} ${fs(20)}`,`${fs(11)} ${fs(14)}`),fontSize:fs(t(18,13.5)),fontWeight:600,color:st.isOpen===true?"#2E7D46":st.isOpen===false?"#C2392F":ED_INK2,display:"flex",alignItems:"center",gap:fs(t(11,9))}}>
            <span style={{width:fs(t(10,8)),height:fs(t(10,8)),borderRadius:"50%",background:st.isOpen===true?"#2E7D46":st.isOpen===false?"#C2392F":ED_INK3,flexShrink:0}}/>
            <span>{openText}</span>
            {st.today&&<span style={{color:ED_INK3,fontWeight:500}}>· {st.today}</span>}
          </div>
        )}

        {/* Phone bar */}
        {a.nationalPhoneNumber&&(
          <a href={`tel:${a.nationalPhoneNumber}`} style={{marginTop:fs(t(14,12)),background:"#EFF4FB",borderRadius:t("16px","14px"),padding:t(`${fs(18)} ${fs(20)}`,`${fs(12)} ${fs(14)}`),display:"flex",alignItems:"center",gap:fs(t(14,12)),textDecoration:"none"}}>
            <span style={{fontSize:fs(t(24,20))}}>📞</span>
            <span><span style={{display:"block",fontSize:fs(t(20,13.5)),fontWeight:600,color:"#2E6FE0"}}>{a.nationalPhoneNumber}</span><span style={{fontSize:fs(t(15,12)),color:ED_INK3}}>Tap to call / book</span></span>
          </a>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:fs(t(12,8)),marginTop:fs(t(20,14))}}>
          <button onClick={()=>setDirs(true)} style={{flex:1,borderRadius:t("16px","14px"),padding:fs(t(15,12)),fontSize:fs(t(18,14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:ED_TODO,color:"#fff"}}>Directions</button>
          <button onClick={()=>onMap?.(index)} style={{flex:1,borderRadius:t("16px","14px"),padding:fs(t(15,12)),fontSize:fs(t(18,14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:ED_IVORY2,color:ED_INK2}}>📍 Map</button>
          <button onClick={()=>setExp(e=>!e)} style={{flex:1,borderRadius:t("16px","14px"),padding:fs(t(15,12)),fontSize:fs(t(18,14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:exp?ED_INK:ED_IVORY2,color:exp?"#fff":ED_INK2}}>{exp?"Less ▴":"More ▾"}</button>
        </div>

        {/* Book a tour — Viator affiliate. Shows ONLY when Viator actually has
            products for this attraction (verified via /viator/match). 'na' = can't
            verify (no API key / rate-limited) → falls back to the isTourable gate. */}
        {(viatorMatch === true || viatorMatch === 'na') && (
          <button onClick={openViatorTour} style={{width:"100%",marginTop:fs(t(12,8)),borderRadius:t("16px","14px"),padding:fs(t(15,12)),fontSize:fs(t(17,13.5)),fontWeight:700,border:"none",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:fs(7),background:"#127a5e",color:"#fff"}}>
            🎟️ Book a tour here <span style={{fontSize:fs(t(13,11)),opacity:0.85,fontWeight:600}}>· Viator ↗</span>
          </button>
        )}

        {/* Expanded details */}
        <AnimatePresence>
          {exp&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{marginTop:fs(t(20,14)),display:"flex",flexDirection:"column",gap:fs(t(14,12))}}>

                {a.highlights?.length>0&&(
                  <div style={{padding:fs(t(16,14)),background:"#F0FDF4",borderRadius:t("16px","14px"),border:"1px solid #BBF7D0"}}>
                    <div style={{fontSize:fs(t(13,11.5)),fontWeight:700,color:"#059669",letterSpacing:"0.5px",marginBottom:fs(9),textTransform:"uppercase"}}>💚 What People Love</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:fs(8)}}>
                      {a.highlights.map((h,i)=><span key={i} style={{background:"#D1FAE5",color:"#065F46",padding:`${fs(5)} ${fs(t(13,11))}`,borderRadius:"999px",fontSize:fs(t(15,12.5)),fontWeight:600,textTransform:"capitalize"}}>{h}</span>)}
                    </div>
                  </div>
                )}

                {a.warnings?.length>0&&(
                  <div style={{padding:fs(t(16,14)),background:"#FFF7ED",borderRadius:t("16px","14px"),border:"1px solid #FED7AA"}}>
                    <div style={{fontSize:fs(t(13,11.5)),fontWeight:700,color:"#D97706",letterSpacing:"0.5px",marginBottom:fs(9),textTransform:"uppercase"}}>⚠️ Heads Up</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:fs(8)}}>
                      {a.warnings.map((w,i)=><span key={i} style={{background:"#FEF3C7",color:"#92400E",padding:`${fs(5)} ${fs(t(13,11))}`,borderRadius:"999px",fontSize:fs(t(15,12.5)),fontWeight:600,textTransform:"capitalize"}}>{w}</span>)}
                    </div>
                  </div>
                )}

                {a.bestTime&&(
                  <div style={{padding:fs(t(16,14)),background:"#EFF6FF",borderRadius:t("16px","14px"),border:"1px solid #BFDBFE",fontSize:fs(t(16,13)),color:"#1E40AF"}}>
                    <span style={{fontWeight:700}}>🕐 Best time · </span>{a.bestTime}
                  </div>
                )}

                {a.formattedAddress&&(
                  <div style={{display:"flex",alignItems:"flex-start",gap:fs(10),padding:fs(t(16,14)),background:"#FAF7F0",borderRadius:t("16px","14px"),border:`1px solid ${ED_RULE}`}}>
                    <span style={{fontSize:fs(t(20,16)),flexShrink:0}}>📍</span>
                    <span style={{fontSize:fs(t(16,13)),color:ED_INK2,lineHeight:1.5,fontWeight:500}}>{a.formattedAddress}</span>
                  </div>
                )}

                {a.hours?.length>0&&(
                  <div style={{padding:fs(t(16,14)),background:"#FAF7F0",borderRadius:t("16px","14px")}}>
                    <button onClick={()=>setHoursExp(h=>!h)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"transparent",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit"}}>
                      <span style={{fontSize:fs(t(13,11.5)),fontWeight:700,color:ED_INK3,letterSpacing:"0.5px"}}>🕐 DAILY HOURS</span>
                      <span style={{fontSize:fs(t(13,11.5)),color:ED_INK3}}>{hoursExp?"▲":"▼"}</span>
                    </button>
                    {hoursExp&&(
                      <div style={{marginTop:fs(8)}}>
                        {a.hours.map((d,i)=>{const today=new Date().getDay();const dn=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];const di=dn.findIndex(n=>d.toLowerCase().startsWith(n.toLowerCase()));const isT=di===today;const pts=d.split(":");const dn2=pts[0];const hrs=pts.slice(1).join(":").trim();return(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:`${fs(4)} 0`,fontSize:fs(t(15,12.5)),fontWeight:isT?700:400,color:isT?T.accentD:ED_INK2,borderBottom:i<a.hours.length-1?`1px solid ${ED_RULE}`:"none"}}><span>{dn2}</span><span style={{color:hrs.toLowerCase()==="closed"?"#C2392F":isT?T.accentD:ED_INK3}}>{hrs}</span></div>);})}
                      </div>
                    )}
                  </div>
                )}

                <AttractionAIDetails placeId={a.placeId||a.id} placeName={name} page="ThingsToDo"/>

                {a.websiteUri&&(
                  <a href={a.websiteUri} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:fs(12),padding:fs(t(16,14)),background:T.accentL,borderRadius:t("16px","14px"),textDecoration:"none",color:T.accentD,border:`1px solid ${T.accent}40`}}>
                    <span style={{fontSize:fs(t(22,18))}}>🌐</span>
                    <span><span style={{display:"block",fontWeight:600,fontSize:fs(t(16,13.5))}}>Visit Website / Book</span><span style={{fontSize:fs(t(14,12)),color:ED_INK3}}>Tickets &amp; details</span></span>
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <MapAppSelector isOpen={dirs} onClose={()=>setDirs(false)} destination={{name,address:a.formattedAddress||a.shortFormattedAddress||a.vicinity||a.address||"",latitude:a.lat,longitude:a.lng}} userLat={userLat} userLng={userLng}/>
      <PhotoGalleryModal photos={a.photos||[]} initialIndex={gallery.idx} isOpen={gallery.open} onClose={()=>setGallery({open:false,idx:0})}/>
    </motion.div>
  );
}

const TRAVEL_COLORS={'✈️ Flight / Ferry Required':{bg:'#FEE2E2',color:'#DC2626'},'🚗 Long Drive':{bg:'#FED7AA',color:'#C2410C'},'🚗 Drive':{bg:'#FEF3C7',color:'#D97706'},'🚗 Short Drive':{bg:'#D1FAE5',color:'#059669'},'🚗 Day Trip':{bg:'#FEF3C7',color:'#D97706'},'📍 Nearby':{bg:'#D1FAE5',color:'#059669'}};

function TierCard({a,userLat,userLng,isTablet,fullWidth=false,forceOpen=false,cardRef=null}){
  const [dirs,setDirs]=useState(false);
  const [gallery,setGallery]=useState({open:false,idx:0});
  // fs()-style scaler for the editorial body (used at both widths now).
  const fs=(n)=>`calc(${n}px*var(--fs))`;
  // t(tabletValue, phoneValue) — pick the platform size, same pattern as the
  // editorial activity card. The tier card now uses the editorial body at BOTH
  // widths; tablet keeps its 340px width / generous sizes, phone is a compact
  // ~240px card so the horizontal strips match the main editorial cards.
  const t=(tab,ph)=>isTablet?tab:ph;
  // Tapping the compact card body opens a fullscreen modal rendering the
  // full ActivityCardTablet (the same editorial component used under "Near
  // You", responsive to isTablet). Inner buttons (Directions / Website /
  // photo) stopPropagation so they don't also open the modal.
  const [expanded,setExpanded]=useState(false);
  // The Map button inside the expanded modal opens a fullscreen TierMapOverlay
  // ON TOP of the modal — the modal stays mounted so when the overlay's X is
  // tapped, the modal is visible again. This avoids the previous broken UX
  // where Map closed the modal AND swapped the page to viewMode='map', and
  // double-X buttons appeared (one inside the popup, one outside).
  const [mapOpen,setMapOpen]=useState(false);
  const [enriched,setEnriched]=useState(null);
  // Owned "Nearby Attractions" carry no photos (National Icons/Regional come from
  // Google w/ photos) — enrich on mount so this tier is just as beautiful. Skips
  // items that already have a photo; resolves owned→Google once, cached 90d.
  useEffect(()=>{
    if(enriched||(a.photos&&a.photos.length))return;
    callWorker('places/enrich-owned',{id:a.id||a.placeId,name:a.displayName?.text||a.name,lat:a.lat??a.location?.latitude,lng:a.lng??a.location?.longitude,maxPhotos:3})
      .then(({data})=>{if(data&&data.matched)setEnriched(data);}).catch(()=>{});
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  // Open the fullscreen modal when the parent forces it (tapped from the map, or
  // the Near-You list which uses this card full-width so all cards behave alike).
  useEffect(()=>{if(forceOpen)setExpanded(true);},[forceOpen]);
  const name=a.displayName?.text||a.name||"Activity";
  const tc=TRAVEL_COLORS[a.travelType]||{bg:'#F1F5F9',color:'#64748B'};
  // Prefer enriched Google photos; normalize objects→URL strings.
  const _photos=(enriched?.photos?.length?enriched.photos:(a.photos||[]))
    .map(p=>typeof p==="string"?p:(p?.url||p?.full||p?.thumbnail||null)).filter(Boolean);
  const photo1=_photos[0]||null;
  const photo2=_photos[1]||null;
  const photo3=_photos[2]||null;
  // Inline distance formatter for the expanded modal — TierSection isn't
  // wired to the parent's useDistanceUnit hook, so use a simple miles
  // formatter (matches the compact card's "X.X mi" rendering).
  const fmtDist=(d)=>`${d.toFixed(1)} mi`;
  // ── Editorial tier card (responsive) ────────────────────────────────────
  // Same DATA + handlers as before (open-modal onClick, photo-gallery taps,
  // Directions, Website) — restyled with the editorial tokens (serif name,
  // ED_* inks, fs()-scaled type, magenta ED_TODO accent) so the tier strips
  // match the main editorial cards. Renders at BOTH widths: tablet keeps the
  // 340px width / generous sizes; phone is a compact ~240px card. Fixed-width
  // flex child so the tier row scrolls horizontally.
  const photoH=t(220,150);   // tablet 220px, phone ~150px photo block
  // Tier-card activities carry location only in formattedAddress (no city/country
  // fields), so derive them — otherwise the wishlist demand signal + affiliate
  // attribution lose geo. Last comma-part ~= country, second-to-last ~= city.
  const _wlAddr=(a.formattedAddress||"").split(",").map(s=>s.trim()).filter(Boolean);
  const wlCity=a.city||(_wlAddr.length>=2?_wlAddr[_wlAddr.length-2]:"");
  const wlCountry=a.country||(_wlAddr.length>=1?_wlAddr[_wlAddr.length-1]:"");
  const editorialBody=(
    <div ref={cardRef} onClick={()=>setExpanded(true)} style={{flexShrink:0,width:fullWidth?"100%":t("340px","240px"),background:"#fff",borderRadius:t("24px","20px"),boxShadow:t("0 18px 40px -26px rgba(22,17,13,.4)","0 10px 26px -18px rgba(22,17,13,.4)"),overflow:"hidden",border:`1px solid ${ED_RULE}`,cursor:"pointer"}}>
      <div style={{position:"relative",height:fs(photoH),background:`linear-gradient(135deg,${a.activityColor||T.accent}40,${a.activityColor||T.accent}20)`}}>
        <div style={{position:"absolute",top:8,right:8,zIndex:15}} onClick={(e)=>e.stopPropagation()}>
          <WishlistButton item={{kind:"attraction",id:a.placeId||a.id,title:name,city:wlCity,country:wlCountry,image:photo1}} size={17}/>
        </div>
        {photo1&&photo2&&photo3?(
          <div style={{display:"grid",gridTemplateColumns:"50% 50%",gridTemplateRows:`${fs(photoH/2)} ${fs(photoH/2)}`,height:fs(photoH),gap:"2px",background:"#fff"}}>
            <img src={photo1} alt="" onClick={(e)=>{e.stopPropagation();setGallery({open:true,idx:0});}} style={{width:"100%",height:"100%",objectFit:"cover",cursor:"pointer",gridRow:"span 2",minWidth:0}}/>
            <img src={photo2} alt="" onClick={(e)=>{e.stopPropagation();setGallery({open:true,idx:1});}} style={{width:"100%",height:"100%",objectFit:"cover",cursor:"pointer",minWidth:0}}/>
            <img src={photo3} alt="" onClick={(e)=>{e.stopPropagation();setGallery({open:true,idx:2});}} style={{width:"100%",height:"100%",objectFit:"cover",cursor:"pointer",minWidth:0}}/>
          </div>
        ):photo1&&photo2?(
          <div style={{display:"flex",height:fs(photoH)}}>
            <img src={photo1} alt="" onClick={(e)=>{e.stopPropagation();setGallery({open:true,idx:0});}} style={{flex:1,height:fs(photoH),objectFit:"cover",cursor:"pointer",minWidth:0}}/>
            <img src={photo2} alt="" onClick={(e)=>{e.stopPropagation();setGallery({open:true,idx:1});}} style={{flex:1,height:fs(photoH),objectFit:"cover",cursor:"pointer",borderLeft:"2px solid #fff",minWidth:0}}/>
          </div>
        ):photo1?(
          <img src={photo1} alt="" onClick={(e)=>{e.stopPropagation();setGallery({open:true,idx:0});}} style={{width:"100%",height:fs(photoH),objectFit:"cover",cursor:"pointer"}}/>
        ):(
          <div style={{height:fs(photoH),display:"flex",alignItems:"center",justifyContent:"center",fontSize:fs(t(72,48))}}>{a.activityIcon||"⭐"}</div>
        )}
      </div>
      <div style={{padding:t(`${fs(20)} ${fs(22)} ${fs(22)}`,`${fs(14)} ${fs(14)} ${fs(14)}`)}}>
        {a.activityLabel&&<div style={{fontSize:fs(t(14,11.5)),fontWeight:600,color:ED_TODO,letterSpacing:"0.2px",marginBottom:fs(4)}}>{a.activityIcon} {a.activityLabel}</div>}
        <div style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:fs(t(26,21)),lineHeight:1.08,color:ED_INK,marginBottom:fs(10),display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{name}</div>
        {a.travelType&&<div style={{marginBottom:fs(8)}}><span style={{background:tc.bg,color:tc.color,padding:`${fs(5)} ${fs(t(12,10))}`,borderRadius:"999px",fontSize:fs(t(13,11)),fontWeight:700,display:"inline-block"}}>{a.travelType} · {a.distance}</span></div>}
        {a.rating&&<div style={{display:"flex",alignItems:"center",gap:fs(6),marginBottom:fs(8)}}><span style={{color:"#E0922F",fontSize:fs(t(16,13))}}>★</span><span style={{fontWeight:700,color:ED_INK2,fontSize:fs(t(16,13))}}>{a.rating}</span><span style={{color:ED_INK3,fontSize:fs(t(14,11.5))}}>({(a.userRatingCount||0).toLocaleString()})</span></div>}
        {a.formattedAddress&&<div style={{fontSize:fs(t(14,11.5)),color:ED_INK3,marginBottom:fs(12),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>📍 {a.formattedAddress.split(',').slice(-3,-1).join(',').trim()}</div>}
        <div style={{display:"flex",gap:fs(t(10,8))}}>
          <button onClick={(e)=>{e.stopPropagation();setDirs(true);}} style={{flex:1,padding:fs(t(13,10)),borderRadius:t("14px","12px"),border:"none",background:ED_TODO,color:"#fff",fontWeight:600,fontSize:fs(t(16,12.5)),cursor:"pointer",fontFamily:"inherit"}}>🧭 Directions</button>
          {a.websiteUri&&<button onClick={(e)=>{e.stopPropagation();window.open(a.websiteUri,'_blank');}} style={{flex:1,padding:fs(t(13,10)),borderRadius:t("14px","12px"),border:"none",background:ED_IVORY2,color:ED_INK2,fontWeight:600,fontSize:fs(t(16,12.5)),cursor:"pointer",fontFamily:"inherit"}}>🌐 Website</button>}
        </div>
      </div>
    </div>
  );
  return(
    <>
      {editorialBody}
      <MapAppSelector isOpen={dirs} onClose={()=>setDirs(false)} destination={{name,address:a.formattedAddress||a.shortFormattedAddress||a.vicinity||a.address||"",latitude:a.lat,longitude:a.lng}} userLat={userLat} userLng={userLng}/>
      <PhotoGalleryModal photos={_photos} initialIndex={gallery.idx} isOpen={gallery.open} onClose={()=>setGallery({open:false,idx:0})}/>
      <AnimatePresence>
        {expanded&&(
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setExpanded(false)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px",overflowY:"auto"}}
          >
            <div onClick={(e)=>e.stopPropagation()} style={{width:"100%",maxWidth:isTablet?"min(840px, 94vw)":"480px",position:"relative",marginTop:"20px",marginBottom:"40px"}}>
              <button
                onClick={()=>setExpanded(false)}
                aria-label="Close"
                style={{position:"absolute",top:"12px",right:"12px",zIndex:10000,width:"36px",height:"36px",borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.95)",color:T.dark,fontSize:"calc(18px*var(--fs))",fontWeight:"800",cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}
              >✕</button>
              <ActivityCardTablet a={_photos.length?{...a,photos:_photos}:a} index={0} onMap={()=>setMapOpen(true)} isHighlighted={false} cardRef={null} forceExpanded={true} userLat={userLat} userLng={userLng} formatDistance={fmtDist} isTablet={isTablet}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mapOpen&&(<TierMapOverlay activity={a} userLat={userLat} userLng={userLng} onClose={()=>setMapOpen(false)}/>)}
      </AnimatePresence>
    </>
  );
}

function TierSection({title,icon,items,userLat,userLng,isTablet,defaultCollapsed=false}){
  const persona=usePersona();
  const [collapsed,setCollapsed]=useState(defaultCollapsed);
  if(!items?.length) return null;
  // The tier strip is part of the editorial system at BOTH widths: serif header
  // in the Things-To-Do magenta accent and a horizontally SCROLLABLE row of
  // editorial TierCards (swipe left/right). Tablet gets the bigger header type +
  // 340px cards; phone gets a compact header + ~240px editorial cards in the same
  // scroll strip. Tier data + the full-screen detail-on-tap are unchanged.
  const itemsLayout = isTablet
    ? {display:"flex",gap:"20px",overflowX:"auto",paddingBottom:"10px",scrollbarWidth:"none"}
    : {display:"flex",gap:"12px",overflowX:"auto",paddingBottom:"6px",scrollbarWidth:"none"};
  return(
    <div style={{marginBottom:isTablet?"30px":"16px"}}>
      <div onClick={()=>setCollapsed(c=>!c)} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:collapsed?"0":(isTablet?"16px":"10px"),padding:"0 4px",cursor:"pointer"}}>
        {isTablet?(
          <>
            <span style={{fontSize:"calc(24px*var(--fs))"}}>{icon}</span>
            <span style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:"calc(28px*var(--fs))",color:ED_INK,lineHeight:1.1}}>{title}</span>
            <span style={{fontSize:"calc(15px*var(--fs))",color:ED_TODO,fontWeight:700}}>({items.length})</span>
            <span style={{marginLeft:"auto",fontSize:"calc(15px*var(--fs))",color:ED_INK3,fontWeight:"700"}}>{collapsed?"▶":"▼"}</span>
          </>
        ):(
          <>
            <span style={{fontSize:"calc(18px*var(--fs))"}}>{icon}</span><span style={{fontWeight:"800",fontSize:"calc(15px*var(--fs))",color:T.dark}}>{title}</span><span style={{fontSize:"calc(12px*var(--fs))",color:T.gray}}>({items.length})</span>
            <span style={{marginLeft:"auto",fontSize:"calc(12px*var(--fs))",color:T.gray,fontWeight:"700"}}>{collapsed?"▶":"▼"}</span>
          </>
        )}
      </div>
      <AnimatePresence>{!collapsed&&(
        <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
          <div style={itemsLayout}>{personaRank(items,persona).map((a,i)=><TierCard key={a.id||i} a={a} userLat={userLat} userLng={userLng} isTablet={isTablet}/>)}</div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

export default function ThingsToDoFinder() {
  // Analytics: log a page_view once on mount.
  useEffect(() => { logEvent('page_view', {}, 'ThingsToDo'); }, []);
  // iPad: wider centered column + editorial activity cards (design handoff,
  // modeled on PlacesToEat). Phone layout is unchanged — every tablet branch
  // is gated on this.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  const [activities,setActivities]=useState([]);
  const [nationalIcons,setNationalIcons]=useState([]);
  const [regionalGems,setRegionalGems]=useState([]);
  const [nearbyAttractions,setNearbyAttractions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [refreshTick,setRefreshTick]=useState(0);
  const forceNextRef=useRef(false);
  const handleRefresh=()=>{forceNextRef.current=true;setRefreshTick(t=>t+1);};
  const [error,setError]=useState(null);
  const [viewMode,setViewMode]=useState("list");
  const [category,setCategory]=useState("all");
  const [radius,setRadius]=useState(25); // wide net; no radius UI — nearest-first
  const [openOnly,setOpenOnly]=useState(false);
  const [outdoorOnly,setOutdoorOnly]=useState(false);
  const [popularOnly,setPopularOnly]=useState(false);
  const [showAdvanced,setShowAdvanced]=useState(false);
  const [locPicker,setLocPicker]=useState(false);
  const [dirsA,setDirsA]=useState(null);
  const [highlight,setHighlight]=useState(null);
  const [expandedIdx,setExpandedIdx]=useState(null);
  const [activePin,setActivePin]=useState(null);
  // Activity search — surfaces bookable EXPERIENCES (Viator) the owned attractions
  // DB can't cover (zip lining, whale watching, ATV…) + filters nearby places.
  // NOTE: declared here (with the other state) rather than lower, because the
  // `filtered` useMemo below reads `submitted` — declaring it after `filtered`
  // hit the temporal dead zone and crashed the whole page on render.
  const [q,setQ]=useState("");
  const [submitted,setSubmitted]=useState("");
  const [tours,setTours]=useState(null); // null=not searched · []=none · [...]=results
  const [tourBusy,setTourBusy]=useState(false);
  const [searchPlaces,setSearchPlaces]=useState([]); // live Google Places keyword results
  const cardRefs=useRef({});
  const mapRef=useRef(null); const mapInst=useRef(null); const markers=useRef([]);
  const {activeLocation}=useLocation();
  const lat=activeLocation?.coordinates?.latitude; const lng=activeLocation?.coordinates?.longitude;
  const locLabel=getLocationLabel(activeLocation);
  const isCity=isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);

  useEffect(()=>{ setRadius(25); }, [activeLocation?.placeId]); // fixed wide net (radius filter removed app-wide)

  const fallbackParts=(activeLocation?.label||activeLocation?.address?.formatted||'').split(',').map(s=>s.trim()).filter(Boolean);
  const country=activeLocation?.address?.country||fallbackParts[fallbackParts.length-1]||'the area';
  const region=activeLocation?.address?.state||activeLocation?.address?.city||fallbackParts[fallbackParts.length-2]||country;
  const city=activeLocation?.address?.city||activeLocation?.address?.municipality||fallbackParts[0]||'';

  useEffect(()=>{
    if(!lat||!lng){ setLoading(false); return; } // no location yet — don't spin forever
    let cancelled=false;
    const force=forceNextRef.current; forceNextRef.current=false;

    // Instant render from localStorage cache when we have a fresh
    // entry — flips the perceived load from "open + spinner for 3s"
    // to "open + content + (silent bg refresh)". The background
    // refresh STILL runs below so the user always ends up on fresh
    // data; cache is just a head-start.
    //
    // forceRefresh from the refresh button bypasses cache and goes
    // straight to the live fetch so the user gets the result they
    // explicitly asked for.
    const cached = force ? null : readTtdCache(lat, lng, category, radius);
    if (cached) {
      setNationalIcons(cached.nationalIcons || []);
      setRegionalGems(cached.regionalGems || []);
      setNearbyAttractions(cached.nearbyAttractions || []);
      setActivities(cached.activities || []);
      setError(null);
      setLoading(true); // background refresh in flight — keep top chip visible
    } else {
      setLoading(true); setError(null);
    }

    (async()=>{
      try{
        const fetchRadius=Math.max(radius,25)*1609; // always fetch at least 25mi
        const {data}=await callWorker(ROUTE.getActivities,{latitude:lat,longitude:lng,radius:fetchRadius,maxResults:60,category,smartRadius:radius>25,countryName:country,regionName:region,cityName:city,forceRefresh:force});
        if(cancelled) return; // a newer fetch (radius/category/location change) superseded this one
        const raw=data?.activities||[];
        const ni=data?.nationalIcons||[];
        const rg=data?.regionalGems||[];
        setNationalIcons(ni);
        setRegionalGems(rg);
        setNearbyAttractions(data?.nearbyAttractions||[]);
        if(raw.length||ni.length||rg.length){
          setActivities(raw);
          // Persist fresh data to localStorage so the next page open
          // hits the instant path above. Only store on success — never
          // cache an error / empty response.
          writeTtdCache(lat,lng,category,radius,{activities:raw,nationalIcons:ni,regionalGems:rg,nearbyAttractions:data?.nearbyAttractions||[]});
        }else if(!cached){
          // No cache to fall back on AND the fresh fetch is empty —
          // show the error state. If we DID have cache, leave it
          // visible (better stale results than nothing).
          setError(data?.error||"No activities found nearby.");
        }
      }catch(e){
        if(cancelled) return;
        if(!cached) setError(`Failed: ${e.message}`);
        // If we had cache, leave it on-screen on network error.
      }
      finally{ if(!cancelled) setLoading(false);}
    })();
    return ()=>{ cancelled=true; };
  },[lat,lng,radius,country,region,category,refreshTick]);

  // All owned/cached places from the getActivities call, deduped — the FREE,
  // instant first layer of search (main list + national icons + regional +
  // nearby). Searching hits this whole set, not just the cards on screen.
  const ownedPool=useMemo(()=>{
    const seen=new Set(),out=[];
    for(const a of [...activities,...nationalIcons,...regionalGems,...nearbyAttractions]){
      const k=a.placeId||a.id; if(k&&!seen.has(k)){seen.add(k);out.push(a);}
    }
    return out;
  },[activities,nationalIcons,regionalGems,nearbyAttractions]);

  // Search results = owned/cached keyword matches (free, instant, trusted)
  // MERGED with live Google Places results, deduped by id, sorted by distance.
  // No radius filter here — the within/beyond split happens below.
  const searchMerged=useMemo(()=>{
    if(!submitted) return [];
    // Accent/Unicode-insensitive owned match (see @/lib/searchText).
    const owned=ownedPool.filter(a=>matchesQuery(`${a.displayName?.text||a.name||""} ${(a.types||[]).join(" ")} ${a.category||""} ${a.activityLabel||""} ${a.editorialSummary?.text||a.editorialSummary||""}`, submitted));
    const seen=new Set(),out=[];
    const push=(a)=>{const k=a.placeId||a.id||`${a.lat},${a.lng}`;if(k&&!seen.has(k)){seen.add(k);out.push(a);}};
    owned.forEach(push);          // owned first — free + trusted
    (searchPlaces||[]).forEach(push); // then live Google businesses
    out.sort((a,b)=>(a.distanceMiles??1e9)-(b.distanceMiles??1e9));
    return out;
  },[submitted,ownedPool,searchPlaces]);

  // Browsing (no search) with any advanced filter on → filter across the WHOLE
  // owned pool (main list + all three tiers) and show one flat list. Otherwise
  // the toggles only touch the small main list and the big tier strips ignore
  // them, so filters look like they do nothing.
  const browseFilterActive=!submitted&&(openOnly||outdoorOnly||popularOnly||category!=='all');
  const filtered=useMemo(()=>{
    let r=submitted?[...searchMerged]:(browseFilterActive?[...ownedPool]:[...activities]);
    // no radius cap — show all fetched, nearest-first (radius filter removed app-wide)
    if(openOnly)    r=r.filter(a=>a.isOpen===true);
    if(outdoorOnly) r=r.filter(a=>a.props?.isOutdoor);
    if(popularOnly) r=r.filter(a=>{
      const isIconic=(a.types||[]).some(t=>['tourist_attraction','national_park','amusement_park','historical_landmark'].includes(t));
      const isHighlyRated=(a.userRatingCount||0)>=200&&(a.rating||0)>=4.0;
      return isIconic||isHighlyRated||a.props?.isBucketList;
    });
    if(!submitted&&category!=='all') r=r.filter(a=>a.activityCategory===category); // category chip (client-side, across the pool)
    // Nearest-first for the main "Near You" list (T1.7). The curated Icons /
    // Regional tiers render in their own strips, so fame is still surfaced there;
    // this list follows the app's closest-first standard. Search is already
    // distance-sorted upstream, so re-sorting is a no-op for it.
    r.sort((a,b)=>(a.distanceMiles??999)-(b.distanceMiles??999));
    return r;
  },[activities,ownedPool,searchMerged,submitted,browseFilterActive,radius,openOnly,outdoorOnly,popularOnly,category]);

  // "A bit farther — worth the trip": search matches just beyond the radius,
  // closest few. So an empty in-radius result still surfaces nearby options
  // (activities are destination-y — people drive to a zipline).
  const searchBeyond=useMemo(()=>{
    if(!submitted) return [];
    return []; // "worth the trip" split retired — all results now show nearest-first in one list
  },[submitted,searchMerged,radius]);

  // Cards rendered in the main list + plotted on the map + counted in stats.
  const cardsList=useMemo(()=>submitted?[...filtered,...searchBeyond]:filtered,[submitted,filtered,searchBeyond]);

  const handleMap=(i)=>{setViewMode("map");setActivePin(i);setTimeout(()=>{const a=cardsList[i];if(mapInst.current&&a?.lat&&a?.lng){mapInst.current.setView([a.lat,a.lng],17);markers.current[i]?.openPopup();}},350);};

  useEffect(()=>{
    if(viewMode!=="map"||!mapRef.current||!lat||!lng) return;
    const init=()=>{
      if(mapInst.current) mapInst.current.remove(); markers.current=[];
      const map=window.L.map(mapRef.current).setView([lat,lng],13);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
      mapInst.current=map; window._gsTDMapInst=map;
      window._gsTDView=(i)=>{map.closePopup();setViewMode("list");setExpandedIdx(i);setHighlight(i);setTimeout(()=>cardRefs.current[i]?.scrollIntoView({behavior:"smooth",block:"center"}),150);setTimeout(()=>setHighlight(null),2800);};
      window._gsTDDirs=(i)=>setDirsA(cardsList[i]);
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:'<div style="width:14px;height:14px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',iconSize:[14,14],className:""})}).addTo(map).bindTooltip('<div style="font-family:-apple-system,sans-serif;padding:5px 9px;"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">📍 You are here</span></div>',{permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:false});
      cardsList.forEach((a,i)=>{
        if(!a.lat||!a.lng) return;
        const active=activePin===i; const color=active?"#FF6B35":a.activityColor||T.accent; const sz=active?36:30;
        const mk=window.L.marker([a.lat,a.lng],{icon:window.L.divIcon({html:`<div style="width:${sz}px;height:${sz}px;background:${color};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${active?14:12}px;box-shadow:0 3px 12px ${color}70;border:${active?3:2}px solid #fff;">${a.activityIcon||"⭐"}</div>`,iconSize:[sz,sz],className:""})}).addTo(map);
        const st=openStatus(a);
        mk.bindPopup(`<div style="font-family:-apple-system,sans-serif;width:260px;position:relative;"><button onclick="window._gsTDMapInst?.closePopup()" style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#64748B;font-size:13px;z-index:10;">✕</button><div style="padding:12px 14px;"><div onclick="window._gsTDView&&window._gsTDView(${i})" style="font-weight:700;font-size:calc(15px*var(--fs));color:#1A2332;margin-bottom:5px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding-right:26px;line-height:1.3;">${a.displayName?.text||a.name}</div><div style="font-size:12px;color:#64748B;margin-bottom:7px;">📍 ${a.formattedAddress||''}</div>${a.rating?`<div style="font-size:12px;color:#F59E0B;margin-bottom:7px;">★ <strong style="color:#1A2332;">${a.rating}</strong>${a.userRatingCount>0?` <span style="color:#64748B;">(${a.userRatingCount})</span>`:""}</div>`:""}<div style="font-size:calc(12px*var(--fs));padding:6px 9px;border-radius:7px;background:${st.isOpen===true?"#F0FDF4":st.isOpen===false?"#FEF2F2":"#F5F5F5"};margin-bottom:10px;"><span style="font-weight:700;color:${st.isOpen===true?"#15803D":st.isOpen===false?"#DC2626":"#9E9E9E"};font-size:calc(12px*var(--fs));">${st.label}</span></div><div style="display:flex;gap:8px;"><button onclick="window._gsTDDirs&&window._gsTDDirs(${i})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#3B82F6;color:#fff;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit;">🧭 Directions</button><button onclick="window._gsTDView&&window._gsTDView(${i})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit;">📋 Details</button></div></div></div>`,{maxWidth:280,className:"gs-popup",autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true});
        mk.on("popupopen",()=>setActivePin(i)); markers.current[i]=mk;
      });
      if(activePin!==null) setTimeout(()=>markers.current[activePin]?.openPopup(),200);
    };
    if(!window.L){const lk=document.createElement("link");lk.rel="stylesheet";lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(lk);const sc=document.createElement("script");sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";sc.onload=init;document.head.appendChild(sc);}else init();
    return()=>{delete window._gsTDMapInst;delete window._gsTDView;delete window._gsTDDirs;if(mapInst.current){mapInst.current.remove();mapInst.current=null;}};
  },[viewMode,cardsList,lat,lng,activePin]);

  const stats={total:cardsList.length};
  const advFilterCount=[openOnly,outdoorOnly,popularOnly,category!=='all'].filter(Boolean).length;
  const clearFilters=()=>{setOpenOnly(false);setOutdoorOnly(false);setPopularOnly(false);setCategory('all');};

  // Activity search handlers — state (q/submitted/tours/tourBusy) is declared
  // higher up with the rest of the component state (see note there).
  const runActivitySearch=async()=>{
    const query=q.trim(); if(!query) return;
    setSubmitted(query); setTourBusy(true); setTours(null); setSearchPlaces([]);
    try{
      const {data}=await callWorker(ROUTE.searchActivities,{query:expandActivityQuery(query),city,country,latitude:lat,longitude:lng,radiusMiles:radius});
      const places=Array.isArray(data?.places)?data.places:[];
      const products=Array.isArray(data?.products)?data.products:[];
      setSearchPlaces(places);
      setTours(products);
      // Geo-tagged demand signal — what activities/experiences people want, where.
      const total=places.length+products.length;
      if(total) logSearch('things_to_do',query,{radius,resultCount:total});
      else logZeroResults('things_to_do',query,{radius});
    }catch{ setTours([]); setSearchPlaces([]); }
    setTourBusy(false);
  };
  const clearSearch=()=>{setQ("");setSubmitted("");setTours(null);setSearchPlaces([]);};
  const openTour=async(p)=>{
    const url=await trackAffiliateClick({partner:"viator",targetUrl:viatorProductLink(p.url)||viatorSearchLink(p.title),category:"tour",productName:p.title,destCity:city,destCountry:country});
    if(url) window.open(url,"_blank");
  };
  const openViatorFallback=async()=>{
    const url=await trackAffiliateClick({partner:"viator",targetUrl:viatorSearchLink(`${submitted} ${city}`.trim()),category:"tour",productName:submitted,destCity:city,destCountry:country});
    if(url) window.open(url,"_blank");
  };

  return(
    <div className="font-sans" style={{background:IVORY,minHeight:"100vh"}}>
      {/* HEADER — redesign pattern */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={()=>window.history.back()} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]" style={{background:'#FFFFFF',border:'1px solid #F0E9DC'}} aria-label="Back">
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]" style={{background:CAT.todo.bg,color:CAT.todo.ink}}>
            <Star size={13} color={CAT.todo.ink} strokeWidth={2} />
            Things To Do
          </div>
          <RefreshButton onClick={handleRefresh} isRefreshing={loading} tone="light" title="Refresh activities" />
        </div>
      </div>

      {/* LOCATION CARD */}
      <div className={`px-4 ${colWrap} mx-auto pb-3`}>
        <button onClick={()=>setLocPicker(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] text-left transition-transform active:scale-[0.99]" style={{background:'#FFFFFF',border:'1px solid #F0E9DC',boxShadow:'0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)'}}>
          <MapPin size={18} color={TEAL_DEEP} strokeWidth={2} className="flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{color:'#94A3B8'}}>
              {isCity ? '🏙️ City' : '📍 Location'}
            </div>
            <div className="font-bold text-[calc(14.5px*var(--fs))] text-[#0F1419] mt-0.5 truncate">{locLabel}</div>
          </div>
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{background:CAT.todo.bg,color:CAT.todo.ink}}>
            Change
          </span>
        </button>
        {isCity && (
          <div className="mt-2 px-3.5 py-2.5 rounded-[12px] text-[calc(12px*var(--fs))] leading-snug flex items-start gap-2" style={{background:CAT.weather.bg,color:CAT.weather.ink}}>
            <span>💡</span>
            <span>Showing places across {activeLocation?.address?.city || activeLocation?.placeName} — {CITY_DISCLAIMER}</span>
          </div>
        )}
      </div>

      {/* Filters band */}
      <div className={`px-4 ${colWrap} mx-auto pb-2`}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"14px"}}><DistanceUnitToggle unit={unit} setUnit={setUnit} variant="light" /></div>
      </div>

      {/* Activity search — bookable experiences (Viator) + nearby matches */}
      <div className={`px-4 ${colWrap} mx-auto pb-2`}>
        <form onSubmit={(e)=>{e.preventDefault();runActivitySearch();}} style={{display:"flex",gap:"8px"}}>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search anything to do — zip lining, snorkeling…" autoCapitalize="none" style={{flex:1,minWidth:0,padding:"11px 14px",borderRadius:"12px",border:"1.5px solid #E2E8F0",fontSize:"calc(14px*var(--fs))",fontFamily:"inherit",color:T.dark,background:"#fff"}}/>
          <button type="submit" disabled={!q.trim()||tourBusy} style={{padding:"11px 16px",borderRadius:"12px",border:"none",background:`linear-gradient(135deg,${T.accentD},${T.accent})`,color:"#fff",fontWeight:"700",fontSize:"calc(13px*var(--fs))",fontFamily:"inherit",cursor:"pointer",opacity:(!q.trim()||tourBusy)?0.6:1}}>{tourBusy?"…":"Search"}</button>
          {submitted&&<button type="button" onClick={clearSearch} style={{padding:"11px 12px",borderRadius:"12px",border:"1.5px solid #E2E8F0",background:"#fff",color:T.gray,fontWeight:"700",fontSize:"calc(13px*var(--fs))",fontFamily:"inherit",cursor:"pointer"}}>✕</button>}
        </form>
      </div>

      <div style={{background:"#fff",padding:"10px 14px",borderBottom:"1px solid #E8EDF2"}}>
       <div className={`${colWrap} mx-auto`}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:showAdvanced?"10px":0}}>
          <button onClick={()=>setShowAdvanced(!showAdvanced)} style={{display:"flex",alignItems:"center",gap:"8px",flex:1,padding:"9px 14px",borderRadius:"10px",border:`1.5px solid ${showAdvanced||advFilterCount>0?T.accent:"#E2E8F0"}`,background:showAdvanced||advFilterCount>0?T.accentL:"#fff",color:showAdvanced||advFilterCount>0?T.accentD:T.gray,fontWeight:"600",fontSize:"calc(13px*var(--fs))",cursor:"pointer",fontFamily:"inherit"}}>
            <span>🔧 Advanced Filters</span>
            {advFilterCount>0&&<span style={{background:T.accent,color:"#fff",borderRadius:"10px",padding:"1px 7px",fontSize:"calc(11px*var(--fs))",fontWeight:"700"}}>{advFilterCount}</span>}
            <span style={{marginLeft:"auto"}}>{showAdvanced?"▲":"▼"}</span>
          </button>
          <span style={{background:T.accent,color:"#fff",padding:"2px 9px",borderRadius:"10px",fontWeight:"800",fontSize:"calc(12px*var(--fs))"}}>{stats.total}</span>
          <div style={{display:"flex",gap:"3px"}}>{["list","map"].map(v=><button key={v} onClick={()=>setViewMode(v)} style={{padding:"6px 11px",borderRadius:"8px",border:"none",background:viewMode===v?T.accent:"#E2E8F0",color:viewMode===v?"#fff":T.gray,fontWeight:"700",fontSize:"calc(12px*var(--fs))",cursor:"pointer",fontFamily:"inherit"}}>{v==="list"?"List View":"Map View"}</button>)}</div>
        </div>
        <AnimatePresence>
          {showAdvanced&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{background:"#F8FAFC",borderRadius:"12px",border:"1px solid #E8EDF2",padding:"12px"}}>
                <div style={{fontSize:"calc(10px*var(--fs))",fontWeight:"700",color:T.gray,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>Filters</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                  {[
                    {label:"Open Now",icon:"🟢",active:openOnly,onClick:()=>setOpenOnly(x=>!x),color:T.green},
                    {label:"Popular",icon:"🏛️",active:popularOnly,onClick:()=>setPopularOnly(x=>!x),color:T.accent},
                    {label:"Outdoors",icon:"🌳",active:outdoorOnly,onClick:()=>setOutdoorOnly(x=>!x),color:"#059669"},
                    {label:"Arts & Culture",icon:"🎭",active:category==='culture',onClick:()=>setCategory(category==='culture'?'all':'culture'),color:"#7C3AED"},
                    {label:"Fun",icon:"🎢",active:category==='entertainment',onClick:()=>setCategory(category==='entertainment'?'all':'entertainment'),color:"#DC2626"},
                    {label:"Adventure",icon:"⚡",active:category==='adventure',onClick:()=>setCategory(category==='adventure'?'all':'adventure'),color:"#DC2626"},
                    {label:"Wellness",icon:"🧘",active:category==='wellness',onClick:()=>setCategory(category==='wellness'?'all':'wellness'),color:"#DB2777"},
                    {label:"Family",icon:"👨‍👩‍👧",active:category==='family',onClick:()=>setCategory(category==='family'?'all':'family'),color:"#D97706"},
                  ].map(f=>(
                    <button key={f.label} onClick={f.onClick} style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"6px 12px",borderRadius:"20px",border:f.active?`2px solid ${f.color}`:"1.5px solid #E2E8F0",background:f.active?f.color+"12":"#fff",color:f.active?f.color:T.dark,fontWeight:f.active?"700":"500",fontSize:"calc(12px*var(--fs))",cursor:"pointer",fontFamily:"inherit"}}>
                      <span style={{fontSize:"calc(14px*var(--fs))"}}>{f.icon}</span>{f.label}
                    </button>
                  ))}
                </div>
                {advFilterCount>0&&<button onClick={clearFilters} style={{padding:"7px",borderRadius:"8px",border:`1.5px solid ${T.coral}`,background:"#FFF5F5",color:T.coral,fontWeight:"700",fontSize:"calc(12px*var(--fs))",cursor:"pointer",fontFamily:"inherit",marginTop:"10px",width:"100%"}}>✕ Clear All ({advFilterCount})</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
       </div>
      </div>

      {/* Cold-load state: no cached results AND nothing fetched yet
          → show skeleton grid instead of a centered spinner. Lets
          the eye land on the right places before the data arrives
          (~30% perceived speedup per Facebook's research). When
          either the cache OR the fresh fetch returns ANY data, the
          render falls through to the list view below, with the
          existing "Fetching new spots" chip at the top covering
          ongoing background refresh state. */}
      {loading&&activities.length===0&&nationalIcons.length===0?(<TtdSkeleton/>)
      :error?(<div style={{textAlign:"center",padding:"70px 24px"}}><div style={{fontSize:"calc(48px*var(--fs))",marginBottom:"14px"}}>😕</div><div style={{color:T.coral,fontWeight:"700",fontSize:"calc(16px*var(--fs))"}}>{error}</div><button onClick={()=>setRadius(r=>Math.min(r+5,25))} style={{marginTop:"14px",padding:"12px 24px",borderRadius:"12px",border:"none",background:`linear-gradient(135deg,${T.accentD},${T.accent})`,color:"#fff",fontWeight:"700",fontSize:"calc(14px*var(--fs))",cursor:"pointer",fontFamily:"inherit"}}>Expand Radius</button></div>)
      :viewMode==="list"?(<div style={isTablet
        ? {maxWidth:1024,margin:"0 auto",padding:"14px 24px 170px",display:"flex",flexDirection:"column",gap:"4px"}
        : {padding:"14px 12px 100px",display:"flex",flexDirection:"column",gap:"4px"}}>
        {submitted&&(
          <div style={{marginBottom:"2px"}}>
            {filtered.length>0&&<div style={{display:"flex",alignItems:"center",gap:"8px",margin:"4px 4px 8px"}}><span style={{fontSize:"calc(18px*var(--fs))"}}>📍</span><span style={{fontWeight:"800",fontSize:"calc(15px*var(--fs))",color:T.dark}}>Places matching &ldquo;{submitted}&rdquo;</span><span style={{fontSize:"calc(12px*var(--fs))",color:T.gray}}>({filtered.length})</span></div>}
            {tourBusy&&filtered.length===0&&<div style={{color:T.gray,fontSize:"calc(13px*var(--fs))",padding:"6px 4px"}}>Searching nearby…</div>}
          </div>
        )}
        {browseFilterActive&&<div style={{display:"flex",alignItems:"center",gap:"8px",margin:"4px 4px 8px"}}><span style={{fontSize:"calc(18px*var(--fs))"}}>🔧</span><span style={{fontWeight:"800",fontSize:"calc(15px*var(--fs))",color:T.dark}}>Filtered results</span><span style={{fontSize:"calc(12px*var(--fs))",color:T.gray}}>({filtered.length})</span></div>}
        {!submitted&&!browseFilterActive&&(nationalIcons.length>0||regionalGems.length>0||nearbyAttractions.length>0)&&<PersonaChooser/>}
        {!submitted&&!browseFilterActive&&<TierSection title={`National Icons · ${country}`} icon="🌟" items={nationalIcons} userLat={lat} userLng={lng} isTablet={isTablet} defaultCollapsed/>}
        {!submitted&&!browseFilterActive&&<TierSection title={`Regional Must-See · ${region||city}`} icon="💎" items={regionalGems} userLat={lat} userLng={lng} isTablet={isTablet} defaultCollapsed/>}
        {!submitted&&!browseFilterActive&&<TierSection title="Nearby Attractions" icon="📍" items={nearbyAttractions} userLat={lat} userLng={lng} isTablet={isTablet}/>}
        {!submitted&&!browseFilterActive&&(nationalIcons.length>0||regionalGems.length>0)&&filtered.length>0&&<div style={{display:"flex",alignItems:"center",gap:"8px",margin:"4px 4px 8px",padding:"0"}}><span style={{fontSize:"calc(18px*var(--fs))"}}>📍</span><span style={{fontWeight:"800",fontSize:"calc(15px*var(--fs))",color:T.dark}}>Near You</span><span style={{fontSize:"calc(12px*var(--fs))",color:T.gray}}>({filtered.length})</span></div>}
        {/* Empty state */}
        {submitted
          ? (!tourBusy&&cardsList.length===0&&(!tours||tours.length===0)
              ? <div style={{textAlign:"center",padding:"40px 24px",background:"#fff",borderRadius:"20px"}}><div style={{fontSize:"calc(48px*var(--fs))",marginBottom:"12px"}}>🔍</div><div style={{fontWeight:"800",fontSize:"calc(17px*var(--fs))",color:T.dark}}>Nothing for &ldquo;{submitted}&rdquo; nearby</div><div style={{color:T.gray,fontSize:"calc(13px*var(--fs))",marginTop:"6px"}}>Try a broader term or a wider radius.</div></div>
              : null)
          : (filtered.length===0&&(browseFilterActive||(nationalIcons.length===0&&regionalGems.length===0))
              ? <div style={{textAlign:"center",padding:"50px 24px",background:"#fff",borderRadius:"20px"}}><div style={{fontSize:"calc(52px*var(--fs))",marginBottom:"14px"}}>🔍</div><div style={{fontWeight:"800",fontSize:"calc(18px*var(--fs))",color:T.dark}}>No matches</div><div style={{color:T.gray,fontSize:"calc(13px*var(--fs))",marginTop:"6px"}}>{browseFilterActive?"No spots match these filters — try clearing one or widening your radius":"Try a different category or expand your radius"}</div></div>
              : null)}

        {/* Main cards — within-radius (both modes). When searching, the
            "a bit farther" divider is injected before the first beyond card. */}
        <div style={{display:"flex",flexDirection:"column",gap:isTablet?"30px":"16px"}}>{cardsList.map((a,i)=>{
          const showBeyondHeader=submitted&&searchBeyond.length>0&&i===filtered.length;
          return (<React.Fragment key={a.id||i}>
            {showBeyondHeader&&<div style={{display:"flex",alignItems:"center",gap:"8px",margin:isTablet?"14px 4px 4px":"6px 4px 2px"}}><span style={{fontSize:"calc(18px*var(--fs))"}}>🧭</span><span style={{fontWeight:"800",fontSize:"calc(15px*var(--fs))",color:T.dark}}>A bit farther — worth the trip</span><span style={{fontSize:"calc(12px*var(--fs))",color:T.gray}}>({searchBeyond.length})</span></div>}
            <TierCard a={a} userLat={lat} userLng={lng} isTablet={isTablet} fullWidth forceOpen={expandedIdx===i} cardRef={(el)=>cardRefs.current[i]=el}/>
          </React.Fragment>);
        })}</div>

        {/* Bookable experiences (Viator) — AFTER the in-app results; monetized,
            direct product deep-links. Demoted from the old top-of-page slot. */}
        {submitted&&(tourBusy||(tours&&tours.length>0))&&(
          <div style={{marginTop:"18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",margin:"4px 4px 10px"}}><span style={{fontSize:"calc(18px*var(--fs))"}}>🎟️</span><span style={{fontWeight:"800",fontSize:"calc(15px*var(--fs))",color:T.dark}}>Book &ldquo;{submitted}&rdquo; experiences</span></div>
            {tourBusy?(<div style={{color:T.gray,fontSize:"calc(13px*var(--fs))",padding:"6px 4px"}}>Searching tours…</div>):(<>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{tours.map((tp)=>(
                <button key={tp.code||tp.url} onClick={()=>openTour(tp)} style={{display:"flex",gap:"12px",alignItems:"center",textAlign:"left",background:"#fff",border:"1px solid #E8EDF2",borderRadius:"16px",padding:"10px",cursor:"pointer",fontFamily:"inherit"}}>
                  {tp.thumbnail&&<img src={tp.thumbnail} alt="" style={{width:88,height:66,objectFit:"cover",borderRadius:"10px",flexShrink:0}}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:"700",fontSize:"calc(13.5px*var(--fs))",color:T.dark,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{tp.title}</div>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"3px",flexWrap:"wrap"}}>
                      {tp.rating!=null&&<span style={{fontSize:"calc(11.5px*var(--fs))",color:T.gray}}>⭐ {Number(tp.rating).toFixed(1)}{tp.reviews?` (${tp.reviews})`:""}</span>}
                      {tp.fromPrice!=null&&<span style={{fontSize:"calc(12px*var(--fs))",fontWeight:"700",color:T.accentD}}>from {tp.currency==="USD"?"$":""}{Math.round(tp.fromPrice)}{tp.currency&&tp.currency!=="USD"?` ${tp.currency}`:""}</span>}
                    </div>
                  </div>
                  <span style={{background:T.accent,color:"#fff",padding:"7px 12px",borderRadius:"10px",fontWeight:"700",fontSize:"calc(12px*var(--fs))",flexShrink:0}}>Book</span>
                </button>
              ))}</div>
              <div style={{fontSize:"calc(10.5px*var(--fs))",color:T.gray,margin:"6px 4px 0"}}>Tours by Viator · we may earn a commission</div>
            </>)}
          </div>
        )}

        {/* Exit-to-Viator — LAST RESORT only: nothing in-app AND no products. */}
        {submitted&&!tourBusy&&cardsList.length===0&&(!tours||tours.length===0)&&(
          <button onClick={openViatorFallback} style={{width:"100%",marginTop:"14px",padding:"12px",borderRadius:"12px",border:`1.5px dashed ${T.accent}`,background:T.accentL,color:T.accentD,fontWeight:"700",fontSize:"calc(13px*var(--fs))",fontFamily:"inherit",cursor:"pointer"}}>Search &ldquo;{submitted}&rdquo; on Viator →</button>
        )}
      </div>)
      :(<div style={{position:"relative"}}><div ref={mapRef} style={{height:"calc(100vh - 230px)",width:"100%"}}/><button onClick={()=>setViewMode("list")} style={{position:"fixed",top:"calc(50px + env(safe-area-inset-top) + 10px)",right:"14px",zIndex:1200,background:"#fff",borderRadius:"50%",width:"42px",height:"42px",border:"none",boxShadow:"0 3px 12px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"calc(20px*var(--fs))",color:T.dark}}>✕</button></div>)}

      {showAdvanced&&<button onClick={()=>setShowAdvanced(false)} style={{position:"fixed",bottom:"90px",right:"16px",zIndex:9999,width:"40px",height:"40px",borderRadius:"50%",border:"none",background:T.dark,color:"#fff",fontWeight:"700",fontSize:"calc(18px*var(--fs))",cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
      <style>{`::-webkit-scrollbar{display:none}.gs-popup .leaflet-popup-content-wrapper{border-radius:16px;padding:0;overflow:hidden;}.gs-popup .leaflet-popup-content{margin:0;}.gs-popup .leaflet-popup-tip-container{display:none;}`}</style>
      <MapAppSelector isOpen={!!dirsA} onClose={()=>setDirsA(null)} destination={dirsA?{name:dirsA.displayName?.text||dirsA.name,address:dirsA.formattedAddress||dirsA.shortFormattedAddress||dirsA.vicinity||dirsA.address||"",latitude:dirsA.lat,longitude:dirsA.lng}:null} userLat={lat} userLng={lng}/>
      <AnimatePresence>{loading&&(activities.length>0||nationalIcons.length>0)&&(<motion.div initial={{opacity:0,y:-20,x:'-50%'}} animate={{opacity:1,y:0,x:'-50%'}} exit={{opacity:0,y:-20,x:'-50%'}} style={{position:"fixed",top:"24px",left:"50%",zIndex:9999,background:T.dark,color:"#fff",padding:"8px 16px",borderRadius:"24px",fontSize:"calc(13px*var(--fs))",fontWeight:"700",display:"flex",alignItems:"center",gap:"8px",boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}><motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1,ease:"linear"}} style={{display:"inline-block"}}>⏳</motion.div>Fetching new spots...</motion.div>)}</AnimatePresence>
      <LocationModePicker isOpen={locPicker} onClose={()=>setLocPicker(false)}/>
    </div>
  );
}