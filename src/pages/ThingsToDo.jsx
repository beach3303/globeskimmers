import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation as useRouterLocation } from "react-router-dom";
import { useLocation, isLiveFix } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { openPartner } from "@/lib/openPartner";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import MapAppSelector from "@/components/MapAppSelector";
import AttractionAIDetails from "@/components/AttractionAIDetails";
import AttractionExtras from "@/components/attraction/AttractionExtras";
import { stampRadiusFor } from "@/lib/stampRadius";
import { metersBetween, listPassport } from "@/lib/passport";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import { logEvent } from "@/lib/analytics";
import { logSearch, logZeroResults } from "@/lib/logSearch";
import { matchesQuery } from "@/lib/searchText";
import {
  SlidersHorizontal, Stamp, ChevronRight, ChevronDown, Compass, Palette, Telescope, Church, Trees, Waves, Fish,
  FerrisWheel, Mountain, Castle, Landmark, Drama, TramFront, Route, Martini, Flower2, Binoculars, Music, Ship, Tent, Library,
  X, Heart, TriangleAlert, Sunrise, Clock, MapPin, WifiOff, SearchX, RotateCcw,
} from "lucide-react";
import { WORLD, NEUTRAL, fs as fsx, rgba } from "@/components/redesign/constants";
import FinderHeader, { finderColumnStyle } from "@/components/finder/FinderHeader";
import PhotoOrIcon from "@/components/finder/PhotoOrIcon";
import { WorldCard, worldGrid, NumberMark, FactsLine, WorldTag, TagRow, CardKicker, CardName, ActionRow, WorldSkeleton, ratingText } from "@/components/finder/FinderCard";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import { openStateFor } from "@/lib/openState";
import { useOverlayClose } from "@/components/home/SuggestPlaceSection";
import { Contours } from "@/components/finder/motifs";
import { WorldSearch, WorldChip, ChipRow, WorldSegmented, ResultLine, WorldNote } from "@/components/finder/FinderControls";
import FilterSheet, { FilterToggleRow } from "@/components/finder/FilterSheet";
import { useIsTablet } from "@/lib/useIsTablet";
import PersonaChooser from "@/components/PersonaChooser";
import { usePersona, personaRank } from "@/lib/persona";
import { expandActivityQuery, fameFirstThings } from "@/lib/searchPlan";
import { sortByRating as rankByRating } from "@/lib/searchRank";

// The page's world (the new look's lapis, ThingsToDo.dc.html).
const W = WORLD.todo;

// The category chips, the second chip row (ThingsToDo.dc.html L71-79): one at a time,
// tap again for all. ids are the worker's activityCategory values; the worker tags what
// it fetched for a chip with that chip's id, and its own guess says 'tour' for 'tours'.
const CATEGORIES=[
  {id:"culture",       label:"Culture"},
  {id:"outdoor",       label:"Outdoors"},
  {id:"entertainment", label:"Fun"},
  {id:"nightlife",     label:"Nightlife"},
  {id:"family",        label:"Family"},
  {id:"wellness",      label:"Wellness"},
  {id:"tours",         label:"Tours"},
  {id:"adventure",     label:"Adventure"},
];
const inCategory=(a,c)=>a.activityCategory===c||(c==="tours"&&a.activityCategory==="tour");
const ROW_FADE="linear-gradient(90deg,#000 calc(100% - 20px),transparent)";

// Synonym map for fuzzy/conceptual activity searches — concrete terms (zipline,
// kayaking, ATV) already match Google well, but vague ones return junk. We expand
// ONLY the query sent to Google; the typed text stays as-is for display + the
// owned-data match, so results still read as what the user asked for.

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

// ── Loading: the strips' and cards' shapes, shimmering on the lapis wash ──
function TtdLoading({isTablet}){
  const bleed=isTablet?-24:-16;
  return(
    <div style={{...finderColumnStyle(isTablet),paddingTop:14,paddingBottom:100}}>
      <WorldSkeleton world="todo" variant="strip" count={isTablet?4:2} label="Loading things to do" style={{marginRight:bleed}}/>
      <WorldSkeleton world="todo" variant="strip" count={isTablet?4:2} style={{marginTop:22,marginRight:bleed}}/>
      <WorldSkeleton world="todo" variant="card" count={2} style={{marginTop:22}}/>
    </div>
  );
}

// ── Maps: lapis pins, word-only popups ───────────────────────────────────
// Text for Leaflet's HTML strings: names and addresses come from Google and from owners,
// so every one is escaped.
const esc=(t)=>String(t??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mapFs=(px)=>`calc(${px}px * var(--fs, 1))`;
// A lapis pin with a terracotta-light ring around its content (the card's number, or a
// cream dot); the place picked is larger.
function pinHtml(inner,active){
  const sz=active?34:28;
  return `<div style="width:${sz}px;height:${sz}px;box-sizing:border-box;border-radius:50%;background:${W.plate};border:${active?3:2}px solid ${W.plateAccent};box-shadow:0 3px 10px ${rgba(W.plate,0.45)};display:flex;align-items:center;justify-content:center;color:${W.plateTitle};font:500 ${active?13:11}px/1 ${MONO};">${inner}</div>`;
}
const PIN_DOT=`<span style="display:block;width:10px;height:10px;border-radius:50%;background:${W.plateTitle};"></span>`;
// Where you are: the blue dot every map uses.
const YOU_HTML='<div style="width:14px;height:14px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>';
const X_SVG=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${NEUTRAL.ink3}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
// A place's popup, in words: the kind and distance, the name (the place's card, when
// viewCall is given), the open words in the place's zone with a Google rating, the
// address; then Directions (solid) and Details. The buttons call the page's window
// bridges.
function popupHtml(a,{isLocal,fmt,closeCall,viewCall=null,dirsCall}){
  const name=a.displayName?.text||a.name||"Attraction";
  const os=openStateFor(a,{isLocal});
  const tone={open:NEUTRAL.open,closed:NEUTRAL.stamp,muted:NEUTRAL.ink3}[os.tone]||NEUTRAL.ink2;
  const r=ratingOf(a);
  const rt=r?ratingText({rating:r.rating,source:r.source}):null;
  const dist=Number.isFinite(a.distanceMiles)?fmt(a.distanceMiles):null;
  const addr=a.formattedAddress||a.shortFormattedAddress||"";
  const btn=(call,label,solid)=>`<button onclick="${call}" style="flex:1;min-height:44px;border:${solid?"0":`1px solid ${W.line}`};border-radius:12px;background:${solid?W.cta:"#fff"};color:${solid?W.ctaInk:NEUTRAL.ink2};font-weight:600;font-size:${mapFs(13)};cursor:pointer;font-family:inherit;">${label}</button>`;
  const nameStyle=`font-family:${SERIF};font-size:${mapFs(20)};line-height:1.15;color:${NEUTRAL.ink};`;
  return `<div style="width:256px;position:relative;font-family:inherit;">`
    +`<button onclick="${closeCall}" aria-label="Close" style="position:absolute;top:4px;right:4px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;cursor:pointer;">${X_SVG}</button>`
    +`<div style="padding:14px 16px 16px;">`
    +`<div style="padding-right:36px;font-family:${MONO};font-size:${mapFs(10)};line-height:1.4;letter-spacing:.12em;text-transform:uppercase;color:${W.ink};">${esc(kindOf(a))}${dist?` · ${esc(dist)}`:""}</div>`
    +(viewCall
      ?`<button onclick="${viewCall}" style="display:block;margin:4px 0 0;padding:0 30px 0 0;border:0;background:transparent;text-align:left;cursor:pointer;${nameStyle}">${esc(name)}</button>`
      :`<div style="margin-top:4px;padding-right:30px;${nameStyle}">${esc(name)}</div>`)
    +`<div style="margin-top:6px;font-size:${mapFs(13)};line-height:1.4;color:${NEUTRAL.ink2};"><span style="font-weight:600;color:${tone};">${esc(os.word)}</span>${rt?` · ${esc(rt)}`:""}</div>`
    +(addr?`<div style="margin-top:4px;font-size:${mapFs(12.5)};line-height:1.4;color:${NEUTRAL.ink3};">${esc(addr)}</div>`:"")
    +`<div style="display:flex;gap:8px;margin-top:12px;">${btn(dirsCall,"Directions",true)}${viewCall?btn(viewCall,"Details",false):""}</div>`
    +`</div></div>`;
}

// TierMapOverlay: a full-screen map of one place, opened from its sheet, which stays
// mounted underneath (closing the map comes back to the same sheet). Two pins: where
// you are (the blue dot, with your location mode and place in a tooltip below it, so it
// never meets the popup above the other pin) and the place (lapis, terracotta-light
// ring) with its word-only popup open. Close (44px) top right; "Show both pins" refits
// the view and reopens the popup.
function TierMapOverlay({activity:a,userLat,userLng,onClose,isLocal=false,fmt}){
  const mapRef=useRef(null);
  const mapInst=useRef(null);
  const destMkRef=useRef(null);
  const {activeLocation}=useLocation();
  const userLocLabel=getLocationLabel(activeLocation);
  const userLocMode=activeLocation?.mode==='navigate'?'Selected location':'Current location';
  // The maps chooser, opened from the popup's Directions.
  const [showDirs,setShowDirs]=useState(false);
  useEffect(()=>{
    // The popup's buttons are HTML: they reach React through these bridges.
    /** @type {any} */ (window)._gsTDCloseTierMap=onClose;
    /** @type {any} */ (window)._gsTDOpenDirs=()=>setShowDirs(true);
    return()=>{
      delete /** @type {any} */ (window)._gsTDCloseTierMap;
      delete /** @type {any} */ (window)._gsTDOpenDirs;
    };
  },[onClose]);
  // Generous padding keeps both cards (the popup above its pin, the tooltip below the
  // other) on screen; maxZoom 11 leaves them room.
  const FIT_PADDING={padding:[200,180],maxZoom:11};
  const resetView=()=>{
    if(!mapInst.current||!destMkRef.current) return;
    mapInst.current.fitBounds([[userLat,userLng],[a.lat,a.lng]],FIT_PADDING);
    setTimeout(()=>destMkRef.current.openPopup(),300);
  };
  useEffect(()=>{
    if(!mapRef.current||!a?.lat||!a?.lng||userLat==null||userLng==null) return;
    const fmtDist=fmt||((d)=>`${d.toFixed(1)} mi`);
    const init=()=>{
      if(mapInst.current) mapInst.current.remove();
      const map=window.L.map(mapRef.current);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
      mapInst.current=map;
      const userMk=window.L.marker([userLat,userLng],{icon:window.L.divIcon({html:YOU_HTML,iconSize:[14,14],className:""})}).addTo(map);
      userMk.bindTooltip(`<div style="padding:6px 9px;min-width:140px;font-family:inherit;"><div style="font-weight:600;color:${NEUTRAL.ink};font-size:${mapFs(12)};">You are here</div><div style="margin-top:1px;font-weight:600;color:${W.ink};font-size:${mapFs(11)};">${esc(userLocMode)}</div>${userLocLabel?`<div style="margin-top:1px;color:${NEUTRAL.ink3};font-size:${mapFs(10.5)};line-height:1.3;">${esc(userLocLabel)}</div>`:""}</div>`,
        {permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:false});
      const destMk=window.L.marker([a.lat,a.lng],{icon:window.L.divIcon({html:pinHtml(PIN_DOT,true),iconSize:[34,34],className:""})}).addTo(map);
      destMkRef.current=destMk;
      destMk.bindPopup(popupHtml(a,{isLocal,fmt:fmtDist,closeCall:"window._gsTDCloseTierMap&&window._gsTDCloseTierMap()",dirsCall:"window._gsTDOpenDirs&&window._gsTDOpenDirs()"}),
        {maxWidth:280,className:"gs-popup",closeButton:false,autoClose:false,closeOnClick:false});
      map.fitBounds([[userLat,userLng],[a.lat,a.lng]],FIT_PADDING);
      setTimeout(()=>destMk.openPopup(),300);
    };
    if(!window.L){
      const lk=document.createElement("link"); lk.rel="stylesheet"; lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(lk);
      const sc=document.createElement("script"); sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; sc.onload=init; document.head.appendChild(sc);
    } else init();
    return()=>{ if(mapInst.current){mapInst.current.remove();mapInst.current=null;} };
  },[a,userLat,userLng,userLocLabel,userLocMode,isLocal,fmt]);
  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} role="dialog" aria-modal="true" aria-label={`Map of ${a.displayName?.text||a.name||"the place"}`}
      style={{position:"fixed",inset:0,background:NEUTRAL.ink,zIndex:10001,display:"flex",flexDirection:"column"}}>
      <div ref={mapRef} style={{flex:1,width:"100%"}}/>
      <button type="button" onClick={onClose} aria-label="Close map"
        style={{position:"absolute",top:"calc(env(safe-area-inset-top) + 14px)",right:14,zIndex:10006,display:"flex",alignItems:"center",justifyContent:"center",width:44,height:44,padding:0,border:0,borderRadius:999,background:NEUTRAL.white,boxShadow:"0 3px 12px rgba(22,17,13,.25)",cursor:"pointer"}}>
        <X size={20} color={NEUTRAL.ink} strokeWidth={2} aria-hidden="true"/>
      </button>
      <button type="button" onClick={resetView}
        style={{position:"absolute",bottom:24,left:16,zIndex:10003,display:"flex",alignItems:"center",gap:6,minHeight:44,padding:"0 14px",border:0,borderRadius:999,background:"rgba(255,255,255,.96)",boxShadow:"0 2px 12px rgba(22,17,13,.3)",color:NEUTRAL.ink,fontFamily:"inherit",fontSize:fsx(13),fontWeight:600,cursor:"pointer"}}>
        <RotateCcw size={16} color={W.iconInk} strokeWidth={2} aria-hidden="true"/> Show both pins
      </button>
      {/* The maps chooser over the map (the overlay sits at 10001). */}
      <div style={{position:"fixed",inset:0,zIndex:10005,pointerEvents:showDirs?'auto':'none'}}>
        <MapAppSelector isOpen={showDirs} onClose={()=>setShowDirs(false)}
          destination={{name:a.displayName?.text||a.name,address:a.formattedAddress||a.shortFormattedAddress||a.vicinity||a.address||"",latitude:a.lat,longitude:a.lng}}
          userLat={userLat} userLng={userLng}/>
      </div>
    </motion.div>
  );
}

const MONO="'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF="'Instrument Serif', Georgia, serif";

// The place's own icon on a card without a photo (lucide, never an emoji), from the
// words in its kind: an observatory's telescope, a gallery's palette, a funicular's
// tram. The world's compass when nothing matches. First match wins.
const PLACE_ICONS=[
  [/observator|planetari/,Telescope],
  [/museum|galler|\bart\b|exhibit/,Palette],
  [/church|cathedral|basilica|chapel|temple|mosque|shrine|monaster|synagogue|religio/,Church],
  [/castle|fortress|\bfort\b|palace|citadel/,Castle],
  [/theme park|amusement|water park|funfair|carnival/,FerrisWheel],
  [/aquarium|\bzoo\b|wildlife|safari/,Fish],
  [/park|garden|forest|botanic|nature|trail|reserve/,Trees],
  [/beach|coast|\bbay\b|lake|river|waterfall|harbou?r|marina/,Waves],
  [/viewpoint|lookout|observation|tower|panoram/,Binoculars],
  [/mountain|peak|volcano|hik|climb|adventure|zip/,Mountain],
  [/theat|opera|perform|concert|\bshow\b/,Drama],
  [/music|jazz|\bclub\b/,Music],
  [/\bbar\b|\bpub\b|nightlife|lounge|brewer|winer/,Martini],
  [/\bspa\b|wellness|\bbath|hammam|onsen|yoga/,Flower2],
  [/tram|funicular|railway|train|cable car/,TramFront],
  [/boat|cruise|ferry|\bship\b|sail/,Ship],
  [/tour|walk/,Route],
  [/camp/,Tent],
  [/library|book/,Library],
  [/monument|memorial|landmark|historic|ruin|archaeolog|statue|square|plaza|bridge/,Landmark],
];
function placeIcon(a){
  const s=`${a.activityLabel||""} ${(a.types||[]).join(" ").replace(/_/g," ")} ${a.activityCategory||""}`.toLowerCase();
  for(const [re,Icon] of PLACE_ICONS) if(re.test(s)) return Icon;
  return Compass;
}

// What a card says it is: the worker's kind word ('Museum', 'Park'), else 'Attraction'.
const kindOf=(a)=>String(a.activityLabel||"").replace(/[^\p{L}\p{N}&'’ ,.-]/gu,"").trim()||"Attraction";

// The tags a card may carry, best first: the facts a traveler plans around. A strip
// shows one; a full card up to three. (Every curated row is "photo worthy", so that
// one says nothing and is left out.)
const TOUR_WORDS={walking:"Walking tour",biking:"Bike tour",boating:"Boat tour"};
const TAG_ORDER=[["isFree","Free entry"],["hasGuidedTour","Guided tours"],["isHiddenGem","Hidden gem"],["isBucketList","Bucket list"],["isFamilyFriendly","Family friendly"],["isAccessible","Accessible"],["isPetFriendly","Pet friendly"],["isGoodForCouples","For couples"],["isGoodForGroups","For groups"],["isAdventure","Adventure"]];
const tagsOf=(a)=>[TOUR_WORDS[a.tourMode],...TAG_ORDER.filter(([k])=>a.props?.[k]===true).map(([,w])=>w)].filter(Boolean);

// A rating shows only with its source: Google's, on the rows Google gave us. The
// curated D1 rows' ratings and the planet DB's name no source, so they never show.
const ratingOf=(a)=>(a._source==="d1"||a._source==="owned")?null:{rating:a.rating,source:"google"};

// 'Oct 4', or 'Oct 4, 2025' from another year. A bare date is read at noon, so no
// time zone moves it to the day before.
function shortDate(d){
  const t=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d))?`${d}T12:00:00`:d);
  if(!Number.isFinite(t.getTime())) return null;
  const sameYear=t.getFullYear()===new Date().getFullYear();
  return t.toLocaleDateString("en-US",sameYear?{month:"short",day:"numeric"}:{month:"short",day:"numeric",year:"numeric"});
}

// The passport mark on a strip card (ThingsToDo.dc.html L101, L127), from one passport
// read and the official stamps around (D1, free):
//   Collected · Oct 4  a stamp of this place is in your passport (by its id, or its name
//                      in the same city), with the day you were there;
//   You're here        your live GPS is inside its stamp area (the sheet's rubber stamp);
//   Stamp here         it has an official stamp (by id, or the same name within 2 km).
// Nothing otherwise: every place earns a typographic stamp in person, so the mark only
// speaks when it has something to say.
const normName=(s)=>String(s||"").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function makeMarks(stamps,stampable){
  const byId=new Map(),byName=[];
  for(const st of stamps||[]){
    const d=st.visited_on||st.created_at; if(!d) continue;
    if(st.entity_id) byId.set(String(st.entity_id),d);
    if(st.name&&st.city) byName.push({n:normName(st.name),c:normName(st.city),d});
  }
  const stampIds=new Set((stampable||[]).map((x)=>String(x.id)));
  const stampNames=(stampable||[]).filter((x)=>x.name&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lng)).map((x)=>({n:normName(x.name),lat:+x.lat,lng:+x.lng}));
  return (a,here)=>{
    const ids=[a.id,a.placeId].filter(Boolean).map(String);
    const n=normName(a.displayName?.text||a.name);
    let d=ids.map((i)=>byId.get(i)).find(Boolean)||null;
    if(!d&&n){const addr=normName(a.formattedAddress);const hit=byName.find((x)=>x.n===n&&x.c&&addr.includes(x.c));if(hit)d=hit.d;}
    const date=d?shortDate(d):null;
    if(date) return {kind:"collected",date};
    if(here) return {kind:"here"};
    if(ids.some((i)=>stampIds.has(i))) return {kind:"stamp"};
    if(n&&Number.isFinite(a.lat)&&Number.isFinite(a.lng)&&stampNames.some((x)=>x.n===n&&metersBetween(a.lat,a.lng,x.lat,x.lng)<=2000)) return {kind:"stamp"};
    return null;
  };
}

function PassportMark({mark,side="left"}){
  const solid=mark.kind!=="stamp";
  const text=mark.kind==="collected"?`Collected · ${mark.date}`:mark.kind==="here"?"You’re here":"Stamp here";
  return(
    <span style={{position:"absolute",top:10,[side]:10,display:"inline-flex",alignItems:"center",gap:5,minHeight:24,maxWidth:"calc(100% - 20px)",boxSizing:"border-box",padding:"0 9px 0 7px",borderRadius:999,background:NEUTRAL.cream,border:`1px ${solid?"solid":"dashed"} ${NEUTRAL.stamp}`,fontFamily:MONO,fontSize:fsx(9.5),lineHeight:1.2,fontWeight:500,letterSpacing:".12em",textTransform:"uppercase",color:NEUTRAL.stamp,whiteSpace:"nowrap",overflow:"hidden"}}>
      <Stamp size={12} color={NEUTRAL.stamp} strokeWidth={2} aria-hidden="true" style={{flexShrink:0}}/>{text}
    </span>
  );
}

// The poster band along a strip photo's foot (ThingsToDo.dc.html L102-106): a 24px fade
// into 56px of lapis, the mono kicker in terracotta light and the serif name. It grows
// upward with larger text instead of clipping.
function PosterBand({kicker,name}){
  return(
    <div style={{position:"absolute",left:0,right:0,bottom:0}}>
      <span aria-hidden="true" style={{position:"absolute",left:0,right:0,top:-24,height:24,background:`linear-gradient(180deg,${rgba(W.plate,0)} 0%,${W.plate} 100%)`}}/>
      <div style={{minHeight:56,boxSizing:"border-box",padding:"9px 12px 8px",background:W.plate}}>
        {kicker&&<div style={{fontFamily:MONO,fontSize:fsx(10),lineHeight:1.4,fontWeight:500,letterSpacing:".14em",textTransform:"uppercase",color:W.plateAccent,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{kicker}</div>}
        <div style={{marginTop:2,fontFamily:SERIF,fontSize:fsx(20),lineHeight:1.2,color:W.plateTitle,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>
      </div>
    </div>
  );
}

// One strip card (ThingsToDo.dc.html L97-121): 240px wide (280 on iPad); a 4:3 photo,
// or the lapis contours with the place's icon, under the poster band; then the facts
// line (the open words in the place's own zone and a Google rating) and one tag. The
// whole card is one button that opens the place's sheet.
function StripCard({a,photos,isTablet,mark,isLocal,fmt,onOpen,cardRef}){
  const name=a.displayName?.text||a.name||"Attraction";
  const dist=Number.isFinite(a.distanceMiles)?fmt(a.distanceMiles):null;
  const kicker=[kindOf(a),dist].filter(Boolean).join(" · ");
  const Icon=placeIcon(a);
  const width=isTablet?280:240;
  const tag=tagsOf(a)[0]||null;
  const rating=ratingOf(a);
  const drawing=(
    <>
      <Contours world={W} variant="card"/>
      <span aria-hidden="true" style={{position:"absolute",left:"50%",top:34,transform:"translateX(-50%)",display:"flex",alignItems:"center",justifyContent:"center",width:46,height:46,boxSizing:"border-box",borderRadius:999,background:W.plateTitle,border:`1px solid ${rgba(W.ink,0.22)}`}}>
        <Icon size={22} color={W.ink} strokeWidth={2}/>
      </span>
    </>
  );
  return(
    <button ref={cardRef} type="button" onClick={onOpen}
      style={{flexShrink:0,display:"flex",flexDirection:"column",justifyContent:"flex-start",width,padding:0,textAlign:"left",background:NEUTRAL.white,border:`1px solid ${W.line}`,borderRadius:16,overflow:"hidden",boxShadow:W.cardShadow,cursor:"pointer",fontFamily:"inherit",color:NEUTRAL.ink}}>
      <PhotoOrIcon world="todo" photos={photos} alt={name} aspect="4 / 3" icon={Icon} stripHeight={Math.round(width*3/4)} stripContent={drawing}>
        {mark&&<PassportMark mark={mark}/>}
        <PosterBand kicker={kicker} name={name}/>
      </PhotoOrIcon>
      <div style={{flex:1,padding:"10px 12px 12px"}}>
        <FactsLine world="todo" place={a} isLocal={isLocal} items={[rating]}/>
        {tag&&<TagRow max={1} style={{marginTop:8}}><WorldTag world="todo">{tag}</WorldTag></TagRow>}
      </div>
    </button>
  );
}

// ─── THE FULL CARD AND THE PLACE'S SHEET ─────────────────────────────────────

// A detail card in the sheet, cut like the attraction extras' own (AttractionExtras
// Card): white with the world line, radius 16, a serif title led by a lucide icon.
function SheetCard({icon:Icon,title,children}){
  return(
    <section style={{background:NEUTRAL.white,border:`1px solid ${W.line}`,borderRadius:16,padding:"14px 16px"}}>
      <h3 style={{display:"flex",alignItems:"center",gap:8,margin:"0 0 8px",fontFamily:SERIF,fontWeight:400,fontSize:fsx(21),lineHeight:1.15,color:NEUTRAL.ink}}>
        <Icon size={18} color={W.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{flexShrink:0}}/>
        <span>{title}</span>
      </h3>
      {children}
    </section>
  );
}

// The week's hours, Monday first. Today is marked by the place's own day (openState
// reads it from Google's utcOffsetMinutes, or the device's clock in current-location
// mode); with neither, no day is marked rather than the wrong one. Closed reads in
// stamp red.
function WeekHours({os}){
  const week=Array.isArray(os?.week)?os.week:[];
  return(
    <dl style={{margin:0}}>
      {week.map((d,i)=>(
        <div key={d.day} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,padding:"7px 0",borderTop:i?`1px solid ${W.line}`:"none",fontSize:fsx(13.5),lineHeight:1.35,color:d.today?W.ink:NEUTRAL.ink2,fontWeight:d.today?600:400}}>
          <dt>{d.day}{d.today&&<span style={{marginLeft:8,fontFamily:MONO,fontSize:fsx(10),fontWeight:500,letterSpacing:".12em",textTransform:"uppercase",color:W.accentText}}>Today</span>}</dt>
          <dd style={{margin:0,textAlign:"right",color:/^closed$/i.test(String(d.text||""))?NEUTRAL.stamp:undefined}}>{d.text||"Not listed"}</dd>
        </div>
      ))}
    </dl>
  );
}

// The sheet's photos at 16:10: swipe through them; a tap opens the gallery there. No
// photo: the contour strip with the place's icon.
function PhotoReel({photos,name,icon,onOpen}){
  if(!photos.length) return <PhotoOrIcon world="todo" photos={[]} alt={name} icon={icon}/>;
  return(
    <div style={{position:"relative",aspectRatio:"16 / 10",background:W.wash,overflow:"hidden"}}>
      <div className="gs-noscroll" style={{display:"flex",height:"100%",overflowX:"auto",scrollSnapType:"x mandatory",overscrollBehaviorX:"contain",WebkitOverflowScrolling:"touch"}}>
        {photos.map((p,i)=>(
          <button key={`${i}-${p}`} type="button" onClick={()=>onOpen(i)} aria-label={`View photo ${i+1} of ${photos.length} of ${name}`}
            style={{flex:"0 0 100%",height:"100%",padding:0,border:0,background:"transparent",scrollSnapAlign:"start",cursor:"zoom-in"}}>
            <img src={p} alt="" loading={i?"lazy":"eager"} style={{display:"block",width:"100%",height:"100%",objectFit:"cover"}}/>
          </button>
        ))}
      </div>
      {photos.length>1&&<span aria-hidden="true" style={{position:"absolute",right:12,bottom:12,display:"flex",alignItems:"center",minHeight:24,padding:"0 9px",boxSizing:"border-box",borderRadius:999,background:rgba(NEUTRAL.ink,0.66),fontFamily:MONO,fontSize:fsx(10),letterSpacing:".12em",textTransform:"uppercase",color:NEUTRAL.white}}>{photos.length} photos</span>}
    </div>
  );
}

const capFirst=(t)=>{const x=String(t||"").trim();return x?x.charAt(0).toUpperCase()+x.slice(1):x;};

// The place's sheet (plan S9 detail 7): the full card at sheet size. Photos; the kicker,
// the serif name and Say it / Translate; the facts (open words in the place's zone, the
// distance, a Google rating), the address and up to three tags; Directions, Map, Call
// and Website. Then, inside the attraction extras (why visit, the stamp, tickets and
// parking, before you go, the guestbook last): what people love, good to know, the
// best time, the week's hours and the AI details.
function PlaceSheet({a,photos,isTablet,isLocal,fmt,onMap,onDirections,onPhotos}){
  const name=a.displayName?.text||a.name||"Attraction";
  const os=openStateFor(a,{isLocal});
  const dist=Number.isFinite(a.distanceMiles)?fmt(a.distanceMiles):null;
  const tags=tagsOf(a).slice(0,3);
  const love=(a.highlights||[]).filter(Boolean), heads=(a.warnings||[]).filter(Boolean);
  return(
    <article aria-label={name} style={{background:NEUTRAL.white,borderRadius:20,overflow:"hidden",boxShadow:"0 24px 50px -30px rgba(22,17,13,.5)"}}>
      <PhotoReel photos={photos} name={name} icon={placeIcon(a)} onOpen={onPhotos}/>
      <div style={{padding:isTablet?"22px 26px 26px":"16px 16px 18px"}}>
        <CardKicker world="todo">{kindOf(a)}</CardKicker>
        <CardName world="todo" as="h2" style={{fontSize:fsx(isTablet?32:28)}}>{name}</CardName>
        <div style={{marginTop:4}}><NameLanguageHelp placeId={a.placeId||a.id} name={name} world="todo"/></div>
        <FactsLine world="todo" open={os} items={[dist,ratingOf(a)]} style={{marginTop:6}}/>
        {a.formattedAddress&&<p style={{margin:"4px 0 0",fontSize:fsx(13),lineHeight:1.4,color:NEUTRAL.ink3}}>{a.formattedAddress}</p>}
        {tags.length>0&&<TagRow max={3} style={{marginTop:10}}>{tags.map((t,i)=><WorldTag key={t} world="todo" tone={i?"outline":"wash"}>{t}</WorldTag>)}</TagRow>}
        <ActionRow world="todo" name={name} onDirections={onDirections} onMap={onMap}
          phone={a.nationalPhoneNumber||null} website={a.websiteUri||null} onWebsite={a.websiteUri?()=>openPartner(a.websiteUri):undefined} style={{marginTop:14}}/>
        <AttractionExtras a={a} formatDistance={fmt} isTablet={isTablet} world="todo">
          {love.length>0&&<SheetCard icon={Heart} title="What people love"><TagRow max={love.length}>{love.map((h)=><WorldTag key={h} world="todo">{capFirst(h)}</WorldTag>)}</TagRow></SheetCard>}
          {heads.length>0&&<SheetCard icon={TriangleAlert} title="Good to know"><TagRow max={heads.length}>{heads.map((h)=><WorldTag key={h} world="todo">{capFirst(h)}</WorldTag>)}</TagRow></SheetCard>}
          {a.bestTime&&<SheetCard icon={Sunrise} title="Best time to go"><p style={{margin:0,fontSize:fsx(13.5),lineHeight:1.45,color:NEUTRAL.ink2}}>{a.bestTime}</p></SheetCard>}
          {(os.week||[]).some((d)=>d.text)&&<SheetCard icon={Clock} title="Hours"><WeekHours os={os}/></SheetCard>}
          <AttractionAIDetails placeId={a.placeId||a.id} placeName={name} page="ThingsToDo"/>
        </AttractionExtras>
      </div>
    </article>
  );
}

// A full card (ThingsToDo.dc.html L192-205; bible todo.card): numbered, with a 16:10
// photo or the 72px contour strip; the kicker, the serif name, the facts line (open
// words, the distance, a Google rating), the address and up to three tags; then
// Directions, Map and More. The words open the place's sheet, as More does (one
// invisible button over them, "Open <name>"); the photo opens the gallery. A place
// picked on the map is ringed in lapis for a moment.
function FullCard({a,n,photos,mark,isLocal,fmt,onOpen,onMap,onDirections,onPhotos,highlighted,pinnedLabel,as,cardRef,children}){
  const name=a.displayName?.text||a.name||"Attraction";
  const dist=Number.isFinite(a.distanceMiles)?fmt(a.distanceMiles):null;
  const tags=tagsOf(a).slice(0,3);
  return(
    <WorldCard world="todo" as={as} ref={cardRef} style={highlighted?{boxShadow:`0 0 0 3px ${W.ink}, ${W.cardShadow}`}:undefined}>
      <PhotoOrIcon world="todo" photos={photos} alt={name} icon={placeIcon(a)} onClick={photos.length?onPhotos:undefined}>
        {n!=null&&<NumberMark n={n} world="todo"/>}
        {mark&&<PassportMark mark={mark} side="right"/>}
      </PhotoOrIcon>
      <div style={{padding:16}}>
        <div style={{position:"relative"}}>
          {pinnedLabel&&<div style={{marginBottom:6,fontFamily:MONO,fontSize:fsx(10),lineHeight:1.4,letterSpacing:".12em",textTransform:"uppercase",color:NEUTRAL.ink3}}>{pinnedLabel}</div>}
          <CardKicker world="todo">{kindOf(a)}</CardKicker>
          <CardName world="todo" as="h3">{name}</CardName>
          <FactsLine world="todo" place={a} isLocal={isLocal} items={[dist,ratingOf(a)]} style={{marginTop:6}}/>
          {a.formattedAddress&&<p style={{margin:"4px 0 0",fontSize:fsx(13),lineHeight:1.4,color:NEUTRAL.ink3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.formattedAddress}</p>}
          <button type="button" onClick={onOpen} aria-label={`Open ${name}`}
            style={{position:"absolute",top:-8,right:-8,bottom:-8,left:-8,padding:0,border:0,borderRadius:12,background:"transparent",cursor:"pointer",outlineOffset:-2}}/>
        </div>
        {tags.length>0&&<TagRow max={3} style={{marginTop:10}}>{tags.map((t,i)=><WorldTag key={t} world="todo" tone={i?"outline":"wash"}>{t}</WorldTag>)}</TagRow>}
        <ActionRow world="todo" name={name} onDirections={onDirections} onMap={onMap} onMore={onOpen} moreIcon style={{marginTop:14}}/>
      </div>
      {children}
    </WorldCard>
  );
}

// One place, as a strip card (a chapter) or a full card (Near you, a search, filters),
// with what opens from it: the place's sheet (and over it a map of the place), the
// photo gallery and the directions chooser.
function TierCard({a,userLat,userLng,isTablet,fullWidth=false,forceOpen=false,cardRef=null,pinnedLabel=null,gpsLat=null,gpsLng=null,fmt=null,markOf=null,isLocal=false,n=null,onMap=null,highlighted=false,inList=false}){
  const [dirs,setDirs]=useState(false);
  const [gallery,setGallery]=useState({open:false,idx:0});
  const [expanded,setExpanded]=useState(false); // the place's sheet
  // The sheet's Map opens a full-screen map ON TOP of the sheet, which stays mounted:
  // closing the map comes back to the same sheet.
  const [mapOpen,setMapOpen]=useState(false);
  const [enriched,setEnriched]=useState(null);
  const sheetRef=useRef(null);
  const closeRef=useRef(null);
  // Owned "Nearby attractions" carry no photos (the icons and regional rows come from
  // Google with photos), so enrich on mount; rows with a photo skip it. Owned→Google
  // resolves once and is cached 90 days.
  useEffect(()=>{
    if(enriched||(a.photos&&a.photos.length))return;
    callWorker('places/enrich-owned',{id:a.id||a.placeId,name:a.displayName?.text||a.name,lat:a.lat??a.location?.latitude,lng:a.lng??a.location?.longitude,maxPhotos:3})
      .then(({data})=>{if(data&&data.matched)setEnriched(data);}).catch(()=>{});
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  // The parent opens the sheet: a pin's "View" on the map, or a stamp tapped elsewhere.
  useEffect(()=>{if(forceOpen)setExpanded(true);},[forceOpen]);
  const closeSheet=()=>setExpanded(false);
  // Escape, Android's back key and a swipe down close the sheet; Tab stays inside it.
  // While the map is open over it, the map has those keys.
  useOverlayClose(expanded&&!mapOpen,closeSheet,sheetRef);
  // Focus moves to the sheet's close button, and back to what opened it.
  useEffect(()=>{
    if(!expanded) return undefined;
    const from=/** @type {HTMLElement|null} */(document.activeElement);
    const t=setTimeout(()=>closeRef.current?.focus({preventScroll:true}),60);
    return()=>{clearTimeout(t);from?.focus?.({preventScroll:true});};
  },[expanded]);
  const name=a.displayName?.text||a.name||"Attraction";
  // Enriched Google photos first; any photo object becomes its URL.
  const _photos=(enriched?.photos?.length?enriched.photos:(a.photos||[]))
    .map(p=>typeof p==="string"?p:(p?.url||p?.full||p?.thumbnail||null)).filter(Boolean);
  // The page's mi/km formatter when given; miles otherwise.
  const fmtDist=fmt||((d)=>`${d.toFixed(1)} mi`);
  // Standing at it? Only the device's own GPS fix counts (never a picked place).
  const here=Number.isFinite(gpsLat)&&Number.isFinite(gpsLng)&&Number.isFinite(a.lat)&&metersBetween(gpsLat,gpsLng,a.lat,a.lng)<=stampRadiusFor({types:a.types,category:a.activityCategory,footprint_radius_m:a.stamp?.footprint_radius_m});
  const mark=markOf?markOf(a,here):null;
  const openPhotos=(i)=>setGallery({open:true,idx:Number.isFinite(i)?i:0});
  const sheetPlace=_photos.length?{...a,photos:_photos}:a;

  const opened=(
    <>
      <MapAppSelector isOpen={dirs} onClose={()=>setDirs(false)} destination={{name,address:a.formattedAddress||a.shortFormattedAddress||a.vicinity||a.address||"",latitude:a.lat,longitude:a.lng}} userLat={userLat} userLng={userLng}/>
      <PhotoGalleryModal photos={_photos} initialIndex={gallery.idx} isOpen={gallery.open} onClose={()=>setGallery({open:false,idx:0})}/>
      <AnimatePresence>
        {expanded&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={closeSheet}
            style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",overscrollBehavior:"contain",padding:"calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 40px)",background:"rgba(22,17,13,.7)"}}>
            <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={name} onClick={(e)=>e.stopPropagation()}
              style={{position:"relative",width:"100%",maxWidth:isTablet?"min(840px, 94vw)":480}}>
              <button ref={closeRef} type="button" onClick={closeSheet} aria-label="Close"
                style={{position:"absolute",top:12,right:12,zIndex:2,display:"flex",alignItems:"center",justifyContent:"center",width:44,height:44,padding:0,border:0,borderRadius:999,background:"rgba(255,255,255,.95)",boxShadow:"0 2px 10px rgba(22,17,13,.25)",cursor:"pointer"}}>
                <X size={20} color={NEUTRAL.ink} strokeWidth={2} aria-hidden="true"/>
              </button>
              <PlaceSheet a={sheetPlace} photos={_photos} isTablet={isTablet} isLocal={isLocal} fmt={fmtDist}
                onMap={()=>setMapOpen(true)} onDirections={()=>setDirs(true)} onPhotos={openPhotos}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mapOpen&&(<TierMapOverlay activity={a} userLat={userLat} userLng={userLng} onClose={()=>setMapOpen(false)} isLocal={isLocal} fmt={fmtDist}/>)}
      </AnimatePresence>
    </>
  );

  if(fullWidth){
    return(
      <FullCard a={a} n={n} photos={_photos} mark={mark} isLocal={isLocal} fmt={fmtDist} onOpen={()=>setExpanded(true)}
        onMap={onMap||(()=>setMapOpen(true))} onDirections={()=>setDirs(true)} onPhotos={openPhotos}
        highlighted={highlighted} pinnedLabel={pinnedLabel} as={inList?"li":"article"} cardRef={cardRef}>
        {opened}
      </FullCard>
    );
  }
  return(
    <>
      <StripCard a={a} photos={_photos} isTablet={isTablet} mark={mark} isLocal={isLocal} fmt={fmtDist} onOpen={()=>setExpanded(true)} cardRef={cardRef}/>
      {opened}
    </>
  );
}

// A chapter's waypoint (ThingsToDo.dc.html L91-96): its number in a terracotta ring, the
// mono title in lapis, the count, a chevron and the 32px terracotta rule. It opens and
// closes its chapter; the numbers run across the chapters that show, with no gaps.
function Waypoint({n,title,count,open,onToggle,controls,style=undefined}){
  return(
    <button type="button" aria-expanded={open} aria-controls={controls} onClick={onToggle}
      style={{position:"relative",display:"flex",alignItems:"center",gap:10,width:"100%",minHeight:44,padding:"6px 0",background:"transparent",border:0,textAlign:"left",fontFamily:"inherit",cursor:"pointer",...style}}>
      <span aria-hidden="true" style={{display:"flex",alignItems:"center",justifyContent:"center",width:26,height:26,flexShrink:0,boxSizing:"border-box",borderRadius:999,border:`1.5px solid ${W.accentText}`,fontFamily:MONO,fontSize:11,fontWeight:500,color:W.accentText}}>{String(n).padStart(2,"0")}</span>
      <span style={{flex:1,minWidth:0,fontFamily:MONO,fontSize:fsx(11),lineHeight:1.35,fontWeight:500,letterSpacing:".14em",textTransform:"uppercase",color:W.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</span>
      <span style={{flexShrink:0,fontFamily:MONO,fontSize:fsx(11),color:NEUTRAL.ink3}}>({count})</span>
      {open?<ChevronDown size={16} color={NEUTRAL.ink3} strokeWidth={2} aria-hidden="true" style={{flexShrink:0}}/>:<ChevronRight size={16} color={NEUTRAL.ink3} strokeWidth={2} aria-hidden="true" style={{flexShrink:0}}/>}
      <span aria-hidden="true" style={{position:"absolute",left:36,bottom:3,width:32,height:2,background:W.accentText}}/>
    </button>
  );
}

// A chapter of strip cards (National icons, Regional must-see, Nearby attractions): its
// waypoint and, open, a row of strip cards that scrolls sideways to the screen's edge,
// re-ranked by "Who's traveling?". `after` spaces it from the chapter above: 4px under
// a closed one, 22px under an open one.
function Chapter({n,title,items,open,onToggle,after,userLat,userLng,isTablet,gpsLat=null,gpsLng=null,fmt=null,markOf=null,isLocal=false}){
  const persona=usePersona();
  const id=`ttd-chapter-${n}`;
  if(!items?.length) return null;
  return(
    <section aria-label={title} style={{marginTop:after}}>
      <Waypoint n={n} title={title} count={items.length} open={open} onToggle={onToggle} controls={id}/>
      {open&&(
        <div id={id} className="gs-noscroll" style={{display:"flex",gap:isTablet?16:12,marginTop:8,marginRight:isTablet?-24:-16,paddingRight:isTablet?24:16,paddingBottom:12,overflowX:"auto",overscrollBehaviorX:"contain"}}>
          {personaRank(items,persona).map((a,i)=><TierCard key={a.id||i} a={a} userLat={userLat} userLng={userLng} isTablet={isTablet} gpsLat={gpsLat} gpsLng={gpsLng} fmt={fmt} markOf={markOf} isLocal={isLocal}/>)}
        </div>
      )}
    </section>
  );
}

export default function ThingsToDoFinder() {
  // Analytics: log a page_view once on mount.
  useEffect(() => { logEvent('page_view', {}, 'ThingsToDo'); }, []);
  // iPad: wider centered column + editorial activity cards (design handoff,
  // modeled on PlacesToEat). Phone layout is unchanged — every tablet branch
  // is gated on this.
  const isTablet = useIsTablet();
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
  const [freeOnly,setFreeOnly]=useState(false);           // Free entry: props.isFree === true
  const [sheetOpen,setSheetOpen]=useState(false);         // the Filters sheet (Popular, Outdoor places)
  const [locPicker,setLocPicker]=useState(false);
  const [dirsA,setDirsA]=useState(null);
  const [highlight,setHighlight]=useState(null);
  const [expandedIdx,setExpandedIdx]=useState(null);
  const [activePin,setActivePin]=useState(null);
  // Activity search — live Google places for any activity (zip lining, whale
  // watching…) merged with nearby owned matches. No booking (founder, 2026-10-03).
  // NOTE: declared here (with the other state) rather than lower, because the
  // `filtered` useMemo below reads `submitted` — declaring it after `filtered`
  // hit the temporal dead zone and crashed the whole page on render.
  const [q,setQ]=useState("");
  const [submitted,setSubmitted]=useState("");
  const [tourBusy,setTourBusy]=useState(false);    // the activity search is running
  // A stamp tapped anywhere in the app opens HERE (founder, 2026-10-03): that
  // attraction's card, pinned on top and opened. ?focus=<id> or router state.
  const [focusCard,setFocusCard]=useState(null);
  const [focusOpen,setFocusOpen]=useState(false);       // one-shot: opens the pinned card once
  const [focusWaited,setFocusWaited]=useState(false);   // stop waiting for a location after a moment
  const [searchPlaces,setSearchPlaces]=useState([]); // live Google Places keyword results
  const [fameFirst,setFameFirst]=useState(false); // Search handed a big-city or "best" ask: popular first
  const [searchError,setSearchError]=useState(null); // callWorker envelope error for the last search — distinct from "no results"
  const cardRefs=useRef({});
  const mapRef=useRef(null); const mapInst=useRef(null); const markers=useRef([]);
  const {activeLocation,currentGpsLocation,locationMode}=useLocation();
  const routerLocation=useRouterLocation();
  // "You're here" needs a reading from this app run — never a restored old fix.
  const liveGps=isLiveFix(currentGpsLocation,60*60*1000)?currentGpsLocation:null;
  const gpsLat=liveGps?.coordinates?.latitude??null; const gpsLng=liveGps?.coordinates?.longitude??null;
  const lat=activeLocation?.coordinates?.latitude; const lng=activeLocation?.coordinates?.longitude;
  const locLabel=getLocationLabel(activeLocation);
  const isCity=isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);
  // Open words read the place's own clock; in current-location mode the device's is the place's.
  const isLocal=locationMode==="current";

  // Chapters open or closed (ThingsToDo.dc.html: National icons starts closed).
  const [openCh,setOpenCh]=useState({national:false,regional:true,nearby:true,near:true});
  const toggleCh=(k)=>setOpenCh((o)=>({...o,[k]:!o[k]}));
  // The strips' passport marks (makeMarks): one passport read, and the official stamps
  // around from D1 (free, no Google). Either read failing just leaves its marks off.
  const [myStamps,setMyStamps]=useState(null);
  const [stampable,setStampable]=useState(null);
  useEffect(()=>{
    let gone=false;
    listPassport().then(({stamps,error})=>{if(!gone&&!error)setMyStamps(stamps);}).catch(()=>{});
    return()=>{gone=true;};
  },[]);
  useEffect(()=>{
    if(!Number.isFinite(lat)||!Number.isFinite(lng)) return undefined;
    let gone=false;
    callWorker("attractions/nearby",{latitude:lat,longitude:lng,radiusKm:100,limit:100,stampsOnly:true}).then(({data,error})=>{
      if(!gone&&!error&&Array.isArray(data?.attractions)) setStampable(data.attractions.filter((x)=>x.tier!=="secret"));
    }).catch(()=>{});
    return()=>{gone=true;};
  },[lat,lng]);
  const markOf=useMemo(()=>makeMarks(myStamps,stampable),[myStamps,stampable]);

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
        const {data,error:fetchErr}=await callWorker(ROUTE.getActivities,{latitude:lat,longitude:lng,radius:fetchRadius,maxResults:60,category,smartRadius:radius>25,countryName:country,regionName:region,cityName:city,forceRefresh:force});
        if(cancelled) return; // a newer fetch (radius/category/location change) superseded this one
        // callWorker never throws — a timeout / HTTP 5xx resolves as { data:null, error }.
        // Bail out BEFORE touching the tiers so a failed background refresh can't
        // wipe the cached strips (TierSection hides itself for empty items), and so
        // the no-cache case reports a connectivity problem, not "no activities".
        // callWorker never throws ({data:null,error}); the worker ALSO answers its own
        // internal exceptions with 200 {error, activities:[]} — treat both as failure.
        const envelopeErr = data&&typeof data==="object"&&data.error&&!Object.keys(data).some(k=>Array.isArray(data[k])&&data[k].length);
        if(!data||typeof data!=="object"||envelopeErr){
          if(!cached) setError(fetchErr==="timeout"?"The server took too long to respond — try again.":"Couldn't reach the server — check your connection and try again.");
          return; // finally{} below still clears the loading chip
        }
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
  const browseFilterActive=!submitted&&(openOnly||freeOnly||outdoorOnly||popularOnly||category!=='all');
  const filtered=useMemo(()=>{
    let r=submitted?[...searchMerged]:(browseFilterActive?[...ownedPool]:[...activities]);
    // no radius cap — show all fetched, nearest-first (radius filter removed app-wide)
    if(openOnly)    r=r.filter(a=>a.isOpen===true);
    if(freeOnly)    r=r.filter(a=>a.props?.isFree===true);
    if(outdoorOnly) r=r.filter(a=>a.props?.isOutdoor);
    if(popularOnly) r=r.filter(a=>{
      const isIconic=(a.types||[]).some(t=>['tourist_attraction','national_park','amusement_park','historical_landmark'].includes(t));
      const isHighlyRated=(a.userRatingCount||0)>=200&&(a.rating||0)>=4.0;
      return isIconic||isHighlyRated||a.props?.isBucketList;
    });
    if(!submitted&&category!=='all') r=r.filter(a=>inCategory(a,category)); // category chip (client-side, across the pool)
    // Nearest-first for the main "Near You" list (T1.7). The curated Icons /
    // Regional tiers render in their own strips, so fame is still surfaced there;
    // this list follows the app's closest-first standard. Search is already
    // distance-sorted upstream, so re-sorting is a no-op for it.
    r.sort((a,b)=>(a.distanceMiles??999)-(b.distanceMiles??999));
    if(submitted&&fameFirst) r=rankByRating(r,{named:true}); // shared with the test suite (searchRank.js)
    return r;
  },[activities,ownedPool,searchMerged,submitted,browseFilterActive,radius,openOnly,freeOnly,outdoorOnly,popularOnly,category,fameFirst]);

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
  // Leaving the list drops the map's "open this card" request (set by _gsTDView
  // below), so coming back to the list doesn't re-open a modal the user closed.
  // One-shot: expandedIdx opens the tapped card's modal on the render where the
  // TierCard mounts (its mount effect reads forceOpen), then clears a tick later
  // so a later remount of the list — or a different item landing at that index —
  // never re-opens a modal uninvited.
  useEffect(()=>{if(expandedIdx==null)return;const t=setTimeout(()=>setExpandedIdx(null),0);return()=>clearTimeout(t);},[expandedIdx]);

  useEffect(()=>{
    if(viewMode!=="map"||!mapRef.current||!lat||!lng) return;
    const init=()=>{
      if(mapInst.current) mapInst.current.remove(); markers.current=[];
      const map=window.L.map(mapRef.current).setView([lat,lng],13);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
      mapInst.current=map; window._gsTDMapInst=map;
      window._gsTDView=(i)=>{map.closePopup();setViewMode("list");setExpandedIdx(i);setHighlight(i);setTimeout(()=>cardRefs.current[i]?.scrollIntoView({behavior:"smooth",block:"center"}),150);setTimeout(()=>setHighlight(null),2800);};
      window._gsTDDirs=(i)=>setDirsA(cardsList[i]);
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:YOU_HTML,iconSize:[14,14],className:""})}).addTo(map)
        .bindTooltip(`<div style="padding:5px 9px;font-family:inherit;font-weight:600;color:${NEUTRAL.ink};font-size:${mapFs(11)};">You are here</div>`,{permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:false});
      // Each card's pin carries its number from the list.
      cardsList.forEach((a,i)=>{
        if(!a.lat||!a.lng) return;
        const active=activePin===i; const sz=active?34:28;
        const mk=window.L.marker([a.lat,a.lng],{icon:window.L.divIcon({html:pinHtml(esc(i+1),active),iconSize:[sz,sz],className:""})}).addTo(map);
        mk.bindPopup(popupHtml(a,{isLocal,fmt:formatDistance,closeCall:"window._gsTDMapInst&&window._gsTDMapInst.closePopup()",viewCall:`window._gsTDView&&window._gsTDView(${i})`,dirsCall:`window._gsTDDirs&&window._gsTDDirs(${i})`}),
          {maxWidth:280,className:"gs-popup",closeButton:false,autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true});
        mk.on("popupopen",()=>setActivePin(i)); markers.current[i]=mk;
      });
      if(activePin!==null) setTimeout(()=>markers.current[activePin]?.openPopup(),200);
    };
    if(!window.L){const lk=document.createElement("link");lk.rel="stylesheet";lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(lk);const sc=document.createElement("script");sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";sc.onload=init;document.head.appendChild(sc);}else init();
    return()=>{delete window._gsTDMapInst;delete window._gsTDView;delete window._gsTDDirs;if(mapInst.current){mapInst.current.remove();mapInst.current=null;}};
  },[viewMode,cardsList,lat,lng,activePin,isLocal,unit]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats={total:cardsList.length};
  // The chapters that show (browsing, no filter), numbered in this order with no gaps.
  const showChapters=!submitted&&!browseFilterActive;
  const chapterList=showChapters?[
    {key:"national",title:`National icons · ${country}`,items:nationalIcons},
    {key:"regional",title:`Regional must-see · ${region||city}`,items:regionalGems},
    {key:"nearby",title:"Nearby attractions",items:nearbyAttractions},
  ].filter((c)=>c.items.length>0):[];
  const nearYouChapter=showChapters&&chapterList.length>0&&filtered.length>0;
  // The Filters chip counts what the sheet holds (Popular, Outdoor places): never the
  // category chips or Open now / Free entry, which show on their own chips.
  const sheetFilterCount=[outdoorOnly,popularOnly].filter(Boolean).length;
  const clearSheetFilters=()=>{setOutdoorOnly(false);setPopularOnly(false);};
  const clearAllFilters=()=>{setOpenOnly(false);setFreeOnly(false);setCategory("all");clearSheetFilters();};

  // Activity search handlers — state (q/submitted/tours/tourBusy) is declared
  // higher up with the rest of the component state (see note there).
  const runActivitySearch=async(explicitQuery)=>{
    const query=(typeof explicitQuery==='string'?explicitQuery:q).trim(); if(!query) return;
    setSubmitted(query); setTourBusy(true); setSearchPlaces([]); setSearchError(null);
    try{
      const {data,error:fetchErr}=await callWorker(ROUTE.searchActivities,{query:expandActivityQuery(query),city,country,latitude:lat,longitude:lng,radiusMiles:radius});
      // callWorker never throws — a timeout / HTTP error resolves as { data:null, error }.
      // Route it to the catch below so a failed call is never logged as zero demand
      // (logZeroResults) or rendered as "Nothing for X nearby".
      if(!data||typeof data!=="object"||(data.error&&!data.places?.length)) throw new Error(data?.error||fetchErr||"Network error");
      const places=Array.isArray(data?.places)?data.places:[];
      setSearchPlaces(places);
      // Geo-tagged demand signal — what activities people want, where.
      const total=places.length;
      if(total) logSearch('things_to_do',query,{radius,resultCount:total});
      else logZeroResults('things_to_do',query,{radius});
    }catch(e){ setSearchPlaces([]); setSearchError(e?.message||"Network error"); }
    setTourBusy(false);
  };
  const clearSearch=()=>{setQ("");setSubmitted("");setSearchPlaces([]);setSearchError(null);setFameFirst(false);};
  // Smart-Search spine / cross-finder handoff: a query passed via router state
  // prefills the box and auto-runs the activity search once coords are ready.
  const presetRanRef=useRef(false);
  useEffect(()=>{
    const pq=routerLocation.state?.presetQuery;
    if(presetRanRef.current||!pq||!String(pq).trim()) return;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
    presetRanRef.current=true;
    const st=routerLocation.state||{};
    setFameFirst(fameFirstThings({query:String(pq),sort:st.presetSort||null,named:!!st.presetCountry,nearFirst:!!st.presetNearFirst}));
    setQ(String(pq).trim());
    runActivitySearch(String(pq).trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[routerLocation.state?.presetQuery,lat,lng]);
  // The stamp hand-off: load that ONE attraction as a Things to Do card — once
  // the location is known (its distance is measured from it), or after 2.5 s.
  const focusRanRef=useRef(null);
  useEffect(()=>{const t=setTimeout(()=>setFocusWaited(true),2500);return()=>clearTimeout(t);},[]);
  useEffect(()=>{if(!focusOpen)return;const t=setTimeout(()=>setFocusOpen(false),0);return()=>clearTimeout(t);},[focusOpen]);
  useEffect(()=>{
    const fid=routerLocation.state?.focus?.id||new URLSearchParams(routerLocation.search||"").get("focus");
    if(!fid||focusRanRef.current===fid) return;
    if(!Number.isFinite(lat)&&!focusWaited) return;
    focusRanRef.current=fid;
    const hint=routerLocation.state?.focus||{};
    callWorker('activities/one',{id:String(fid),userLat:lat,userLng:lng}).then(({data})=>{
      if(data?.activity){ setFocusCard({...data.activity,stamp:data.stamp??null}); setFocusOpen(true); }
      else if(Number.isFinite(+hint.lat)){ setFocusCard({id:String(fid),placeId:String(fid),name:hint.name||"Attraction",displayName:{text:hint.name||"Attraction"},lat:+hint.lat,lng:+hint.lng,photos:hint.photo?[hint.photo]:[],activityIcon:"⭐",stamp:data?.stamp??null}); setFocusOpen(true); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[routerLocation.state?.focus?.id,routerLocation.search,lat,focusWaited]);

  return(
    <div className="font-sans" style={{background:W.paper,minHeight:"100vh",paddingTop:12}}>

      {/* ── THE PLATE + CONTROLS (ThingsToDo.dc.html L24-89): the lapis plate with the
          count, the title, the location and the unit; under it the search, the two chip
          rows (Open now, Free entry, Filters and List|Map; the categories) and "Who's
          traveling?" while the chapters show. ── */}
      <FinderHeader
        world="todo"
        count={stats.total>0?stats.total:null}
        title={submitted?{pre:"",italic:submitted,post:" nearby"}:undefined}
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh things to do"
        location={{label:locLabel,onChange:()=>setLocPicker(true)}}
        unit={{value:unit,onChange:setUnit}}
        isCity={isCity}
        cityName={activeLocation?.address?.city||activeLocation?.placeName}
      >
        <WorldSearch
          world="todo"
          value={q}
          onChange={setQ}
          onSubmit={(text)=>runActivitySearch(String(text||""))}
          onClear={clearSearch}
          placeholder="Search anything to do: zip lining, snorkeling…"
          label="Search things to do"
          busy={tourBusy}
        />
        {/* Row 1 scrolls on its own, so List|Map stays in reach at any text size; a
            chip that runs under it fades out rather than being cut. */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
          <ChipRow label="Quick filters" style={{flex:1,minWidth:0,paddingRight:20,WebkitMaskImage:ROW_FADE,maskImage:ROW_FADE}}>
            <WorldChip world="todo" label="Open now" active={openOnly} onClick={()=>setOpenOnly(x=>!x)}/>
            <WorldChip world="todo" label="Free entry" active={freeOnly} onClick={()=>setFreeOnly(x=>!x)}/>
            <WorldChip world="todo" icon={SlidersHorizontal} label="Filters" count={sheetFilterCount} opensSheet onClick={()=>setSheetOpen(true)}/>
          </ChipRow>
          <WorldSegmented world="todo" mode="pressed" label="View" value={viewMode} onChange={setViewMode}
            options={[{value:"list",label:"List"},{value:"map",label:"Map"}]}/>
        </div>
        <ChipRow label="Categories" bleed>
          {CATEGORIES.map(c=>(
            <WorldChip key={c.id} world="todo" label={c.label} active={category===c.id} onClick={()=>setCategory(category===c.id?"all":c.id)}/>
          ))}
        </ChipRow>
        {!submitted&&!browseFilterActive&&(nationalIcons.length>0||regionalGems.length>0||nearbyAttractions.length>0)&&<PersonaChooser world="todo" style={{marginTop:6,maxWidth:560}}/>}
        {submitted&&(tourBusy&&cardsList.length===0
          ? <ResultLine live>Searching&hellip;</ResultLine>
          : cardsList.length>0&&<ResultLine live items={[{count:cardsList.length,label:`for “${submitted}”`}]}/>)}
        {browseFilterActive&&filtered.length>0&&<ResultLine live items={[{count:filtered.length,label:filtered.length===1?"place matches":"places match"}]}/>}
      </FinderHeader>

      {/* Cold-load state: no cached results AND nothing fetched yet
          → show skeleton grid instead of a centered spinner. Lets
          the eye land on the right places before the data arrives
          (~30% perceived speedup per Facebook's research). When
          either the cache OR the fresh fetch returns ANY data, the
          render falls through to the list view below, with the
          existing "Fetching new spots" chip at the top covering
          ongoing background refresh state. */}
      {focusCard&&viewMode==="list"&&(
        <div style={{...finderColumnStyle(isTablet),paddingTop:14}}>
          <TierCard key={focusCard.id} a={focusCard} userLat={lat} userLng={lng} isTablet={isTablet} fullWidth forceOpen={focusOpen} pinnedLabel={routerLocation.state?.focus?.from||null} gpsLat={gpsLat} gpsLng={gpsLng} fmt={formatDistance} markOf={markOf} isLocal={isLocal}/>
        </div>
      )}
      {(!Number.isFinite(lat)||!Number.isFinite(lng))?(
        /* No location yet (first run, GPS denied): ask for one; never a spinner. */
        <div style={{...finderColumnStyle(isTablet),paddingTop:28}}>
          <FinderEmptyState world="todo" icon={MapPin} title="Choose a location to explore" reason="Use your current location or pick a city to see things to do nearby." actionLabel="Choose location" onAction={()=>setLocPicker(true)}/>
        </div>
      ):loading&&activities.length===0&&nationalIcons.length===0&&regionalGems.length===0&&nearbyAttractions.length===0?(
        <TtdLoading isTablet={isTablet}/>
      ):error?(
        /* A failed read is never "nothing here"; an empty answer says so plainly. The
           list always starts at the 25-mile ceiling, so there is no radius to widen. */
        <div style={{...finderColumnStyle(isTablet),paddingTop:28}}>
          {/reach the server|took too long|^Failed/i.test(error)
            ? <FinderEmptyState world="todo" icon={WifiOff} title="Couldn’t load things to do" reason={error} actionLabel="Try again" onAction={()=>setRefreshTick((t)=>t+1)} secondaryLabel="Search somewhere else" onSecondary={()=>setLocPicker(true)}/>
            : <FinderEmptyState world="todo" icon={SearchX} title="Nothing to do found here yet" reason="We couldn’t find attractions around this location." actionLabel="Search somewhere else" onAction={()=>setLocPicker(true)} secondaryLabel="Try again" onSecondary={()=>setRefreshTick((t)=>t+1)}/>}
        </div>
      ):viewMode==="list"?(
        <div style={{...finderColumnStyle(isTablet),paddingTop:14,paddingBottom:isTablet?170:100,display:"flex",flexDirection:"column"}}>
          {chapterList.map((c,i)=>(
            <Chapter key={c.key} n={i+1} title={c.title} items={c.items} open={openCh[c.key]} onToggle={()=>toggleCh(c.key)}
              after={i===0?0:(openCh[chapterList[i-1].key]?14:4)} userLat={lat} userLng={lng} isTablet={isTablet}
              gpsLat={gpsLat} gpsLng={gpsLng} fmt={formatDistance} markOf={markOf} isLocal={isLocal}/>
          ))}
          {nearYouChapter&&(
            <Waypoint n={chapterList.length+1} title="Near you" count={filtered.length} open={openCh.near} onToggle={()=>toggleCh("near")}
              controls="ttd-near-you" style={{marginTop:openCh[chapterList[chapterList.length-1].key]?14:4}}/>
          )}

          {/* A search: its shapes while it runs; then an honest empty or failed state. */}
          {submitted&&tourBusy&&cardsList.length===0&&<WorldSkeleton world="todo" variant="card" count={2} label={`Searching for ${submitted}`}/>}
          {submitted&&!tourBusy&&cardsList.length===0&&(searchError
            ? <FinderEmptyState world="todo" icon={WifiOff} title="Couldn’t reach the server" reason="Check your connection and try again." actionLabel="Try again" onAction={()=>runActivitySearch(submitted)} secondaryLabel="Clear search" onSecondary={clearSearch}/>
            : <FinderEmptyState world="todo" icon={SearchX} title={`Nothing for “${submitted}” nearby`} reason="Try a broader word, or search somewhere else." actionLabel="Search somewhere else" onAction={()=>setLocPicker(true)} secondaryLabel="Clear search" onSecondary={clearSearch}/>)}
          {/* Browsing: filters that leave nothing, or a place with nothing listed. */}
          {!submitted&&filtered.length===0&&(browseFilterActive||chapterList.length===0)&&(
            <FinderEmptyState world="todo" icon={SearchX} title="No matches" reason={browseFilterActive?"Nothing here passes these filters.":"Nothing to do found around here yet."}
              actionLabel="Search somewhere else" onAction={()=>setLocPicker(true)} secondaryLabel={browseFilterActive?"Clear filters":undefined} onSecondary={browseFilterActive?clearAllFilters:undefined}/>
          )}

          {(!nearYouChapter||openCh.near)&&cardsList.length>0&&(
            <ol id="ttd-near-you" aria-label={submitted?`Places for ${submitted}`:"Things to do near you"} style={{...worldGrid(isTablet),marginTop:nearYouChapter?8:0}}>
              {cardsList.map((a,i)=>(
                <TierCard key={a.id||a.placeId||i} a={a} userLat={lat} userLng={lng} isTablet={isTablet} fullWidth inList n={i+1}
                  onMap={()=>handleMap(i)} highlighted={highlight===i} forceOpen={expandedIdx===i} cardRef={(el)=>{cardRefs.current[i]=el;}}
                  gpsLat={gpsLat} gpsLng={gpsLng} fmt={formatDistance} markOf={markOf} isLocal={isLocal}/>
              ))}
            </ol>
          )}

          {/* Results showing, but the search call failed: said, with a retry. */}
          {submitted&&!tourBusy&&searchError&&cardsList.length>0&&(
            <WorldNote world="todo" icon={WifiOff} title="Couldn’t reach the server for more results" action={{label:"Try again",onClick:()=>runActivitySearch(submitted)}} style={{marginTop:14}}/>
          )}
        </div>
      ):(
        <div style={{...finderColumnStyle(isTablet),paddingTop:12,paddingBottom:100}}>
          <div ref={mapRef} role="region" aria-label="Map of things to do" style={{height:"calc(100vh - 260px)",minHeight:320,width:"100%",boxSizing:"border-box",borderRadius:16,overflow:"hidden",border:`1px solid ${W.line}`}}/>
        </div>
      )}

      <style>{`::-webkit-scrollbar{display:none}.gs-popup .leaflet-popup-content-wrapper{border-radius:16px;padding:0;overflow:hidden;}.gs-popup .leaflet-popup-content{margin:0;}.gs-popup .leaflet-popup-tip-container{display:none;}`}</style>
      <MapAppSelector isOpen={!!dirsA} onClose={()=>setDirsA(null)} destination={dirsA?{name:dirsA.displayName?.text||dirsA.name,address:dirsA.formattedAddress||dirsA.shortFormattedAddress||dirsA.vicinity||dirsA.address||"",latitude:dirsA.lat,longitude:dirsA.lng}:null} userLat={lat} userLng={lng}/>
      <FilterSheet world="todo" open={sheetOpen} onClose={()=>setSheetOpen(false)} title="Filters" onClear={sheetFilterCount>0?clearSheetFilters:undefined}>
        <FilterToggleRow world="todo" label="Popular" description="Famous landmarks and places with 200+ reviews at 4.0 or higher" checked={popularOnly} onChange={setPopularOnly}/>
        <FilterToggleRow world="todo" label="Outdoor places" description="Parks, beaches, viewpoints and other places outside" checked={outdoorOnly} onChange={setOutdoorOnly}/>
      </FilterSheet>
      <LocationModePicker isOpen={locPicker} onClose={()=>setLocPicker(false)}/>
    </div>
  );
}