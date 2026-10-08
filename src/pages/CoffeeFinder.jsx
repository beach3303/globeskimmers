import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import LocationModePicker from "@/components/location/LocationModePicker";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import DistanceUnitToggle from "@/components/location/DistanceUnitToggle";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { logEvent } from "@/lib/analytics";
import { logSearch, logZeroResults } from "@/lib/logSearch";
import { matchesQuery } from "@/lib/searchText";
import AIDetailsSection from "@/components/AIDetailsSection";
import TravelerDishes from "@/components/finder/TravelerDishes";
import { HereStamp } from "@/components/attraction/AttractionExtras";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import { Coffee as CoffeeIcon, SlidersHorizontal, Sparkles } from "lucide-react";
import { CAT, TEAL_DEEP, IVORY } from "@/components/redesign/constants";
import MapAppSelector from "@/components/MapAppSelector";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import CafeWorkProfileSection from "@/components/CafeWorkProfileSection";
import { useIsTablet } from "@/lib/useIsTablet";
import FinderHeader from "@/components/finder/FinderHeader";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import FilterSheet from "@/components/finder/FilterSheet";
import PhotoOrIcon from "@/components/finder/PhotoOrIcon";
import { pinInstitutions } from "@/lib/searchRank";

// iPad editorial design tokens (design handoff — modeled on "Places to Eat · iPad").
const ED_SERIF = '"Instrument Serif", Georgia, serif';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)";

// ─── COLORS ────────────────────────────────────────────────────────────────
const BROWN      = "#6F4E37";
const BROWN_DARK = "#4A3728";
const GRAY       = "#64748B";
const DARK       = "#1A2332";
// T1.8: Open Now is disabled until at least one shop in view has a known open
// state (owned rows ship no hours; cards lift Google hours in as they load).
const OPEN_NOW_HINT = "needs café hours — none loaded yet";

// ─── DRINK PATTERNS ────────────────────────────────────────────────────────
const DRINK_PATTERNS = {
  espresso:  { namePatterns:['espresso','espresso bar','coffee bar','café','caffe'],  reviewKeywords:['espresso','latte','cappuccino','macchiato','cortado','flat white','americano','ristretto','doppio','crema'], icon:'☕', label:'Espresso',    color:'#4A3728', bg:'#F5F0EB' },
  brewed:    { namePatterns:['coffee house','coffee shop','roaster','roastery'],      reviewKeywords:['drip coffee','brewed coffee','pour over','pour-over','chemex','v60','aeropress','french press','filter coffee','single origin'], icon:'🫖', label:'Brewed/Drip',color:'#6F4E37', bg:'#FDF5EF' },
  iced:      { namePatterns:['iced','cold'],                                          reviewKeywords:['iced coffee','iced latte','cold coffee','iced americano','iced mocha','frappe','frappuccino','shaken espresso'], icon:'🧊', label:'Iced Coffee', color:'#0288D1', bg:'#E3F2FD' },
  coldBrew:  { namePatterns:['cold brew'],                                            reviewKeywords:['cold brew','nitro','nitro cold brew','nitrogen','nitro coffee','cold brewed'], icon:'🥤', label:'Cold Brew',  color:'#1565C0', bg:'#E3F2FD' },
  matcha:    { namePatterns:['matcha','tea house','tea room'],                        reviewKeywords:['matcha','matcha latte','ceremonial matcha','matcha green tea','whisked matcha'], icon:'🍵', label:'Matcha',      color:'#2E7D32', bg:'#E8F5E9' },
  tea:       { namePatterns:['tea house','tea room','tea bar','boba','bubble tea'],   reviewKeywords:['loose leaf','chai','earl grey','boba','bubble tea','milk tea','thai tea','oolong'], icon:'🫖', label:'Tea',         color:'#7B1FA2', bg:'#F3E5F5' },
};

// ─── AMENITY PATTERNS (review-detected only) ───────────────────────────────
const AMENITY_PATTERNS = {
  wifi:    { keywords:['wifi','wi-fi','internet','free wifi','wireless'],           icon:'📶', label:'WiFi reported'     },
  outlets: { keywords:['outlets','power outlets','plugs','charging','power strip'], icon:'🔌', label:'Outlets mentioned'  },
  quiet:   { keywords:['quiet','peaceful','calm','serene'],                         icon:'🔇', label:'Quiet atmosphere'   },
  food:    { keywords:['pastry','sandwich','breakfast','croissant','bagel','avocado toast'], icon:'🥐', label:'Food available' },
};

// ─── CHAIN DETECTION ───────────────────────────────────────────────────────
const COFFEE_CHAINS = ['starbucks','dunkin',"peet's",'peets','caribou','dutch bros','coffee bean','the coffee bean','philz','blue bottle','intelligentsia','la colombe','verve','portola','tierra mia','groundwork','tim hortons','costa coffee','caffe nero','gloria jean','mcdonalds','mcdonald','panera','7-eleven','wawa','krispy kreme','biggby','scooter\'s coffee',"scooter's",'black rock coffee','tully\'s','gregorys','gregorys coffee','it\'s a grind','joe & the juice','joe and the juice','paris baguette','tous les jours','caffè pascucci','doutor','tully\'s coffee','ediya','a twosome','hollys coffee','coffee island','wayne\'s coffee','robert\'s coffee','%arabica','arabica coffee','the human bean','human bean','dutch bros coffee','cinnabon','jamba'];
const isChainShop = name => COFFEE_CHAINS.some(c => name.toLowerCase().includes(c));

// ─── SPECIALTY DETECTION ──────────────────────────────────────────────────
const SPECIALTY_INDICATORS = ['roaster','roastery','roasting','artisan','specialty','single origin','pour over','pour-over','third wave','micro roast','small batch','craft coffee','brew bar','coffee lab','coffee works'];
const SPECIALTY_BRANDS = ['blue bottle','intelligentsia','stumptown','counter culture','verve','ritual coffee','sightglass','four barrel','equator','philz','la colombe','coava','onyx coffee','proud mary','madcap','portola','groundwork'];
const isSpecialtyByName = name => { const n = name.toLowerCase(); return SPECIALTY_INDICATORS.some(s => n.includes(s)) || SPECIALTY_BRANDS.some(b => n.includes(b)); };

// ─── OPEN STATUS ───────────────────────────────────────────────────────────
// Which weekday it is AT THE PLACE (0=Sun…6=Sat), or -1 when we can't know.
// With Google's utcOffsetMinutes we shift "now" into the place's zone; without
// it the device clock is only right when the user is browsing the city they are
// physically in (`isLocal` — locationMode "current").
function placeDayIndex(utcOffsetMinutes, isLocal) {
  if (Number.isFinite(utcOffsetMinutes)) return new Date(Date.now() + utcOffsetMinutes * 60000).getUTCDay();
  return isLocal ? new Date().getDay() : -1;
}
// `isLocal`: browsing the current-location city, i.e. device clock == place clock.
function computeOpenStatus(place, isLocal = false) {
  const hours = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || place.hours || [];
  const _off = place.utcOffsetMinutes;
  const _tz = Number.isFinite(_off);
  if (!hours.length) {
    // No hours text. Google's live `openNow` is trusted for the local city only —
    // for a navigated city it may be a place-details boolean cached up to 90 days.
    const live = place.currentOpeningHours?.openNow;
    return { isOpen:(isLocal && typeof live === 'boolean') ? live : null, todayHours:null, is24Hours:false };
  }
  // Hours exist but we can't place "now" in the shop's day (navigated city, no
  // utcOffsetMinutes): a wrong-clock Open/Closed is worse than no status.
  if (!_tz && !isLocal) return { isOpen:null, todayHours:null, is24Hours:false };
  const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  // Use the PLACE's timezone (Google utcOffsetMinutes) so open/closed is right when
  // browsing another city; device-time fallback (correct for your current location).
  const _now = _tz ? new Date(Date.now() + _off * 60000) : new Date();
  const _day = _tz ? _now.getUTCDay() : _now.getDay();
  const _mins = _tz ? (_now.getUTCHours() * 60 + _now.getUTCMinutes()) : (_now.getHours() * 60 + _now.getMinutes());
  const entry = hours.find(h => h?.startsWith(DAY[_day]));
  if (!entry) return { isOpen:null, todayHours:null, is24Hours:false };
  const hoursText = entry.substring(entry.indexOf(':')+1).trim();
  if (hoursText.toLowerCase()==='closed') return { isOpen:false, todayHours:'Closed today', is24Hours:false };
  if (hoursText.toLowerCase().includes('24 hours')) return { isOpen:true, todayHours:'Open 24 hours', is24Hours:true };
  const cur = _mins;
  for (const seg of hoursText.split(',')) {
    const m = seg.trim().match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[–-]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (m) { const o=parseTime(m[1]); let c=parseTime(m[2]); if(c<=o)c+=1440; if(cur>=o&&cur<c) return { isOpen:true, todayHours:hoursText, is24Hours:false }; }
  }
  return { isOpen:false, todayHours:hoursText, is24Hours:false };
}
function parseTime(s) {
  const m = s.trim().toUpperCase().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!m) return 0;
  let h=parseInt(m[1]), min=m[2]?parseInt(m[2]):0, p=m[3];
  if(p==='PM'&&h!==12)h+=12; if(p==='AM'&&h===12)h=0;
  return h*60+min;
}

// ─── PROCESS SHOP ──────────────────────────────────────────────────────────
function processShop(shop, userLat, userLng, isLocal) {
  const lat = shop.location?.latitude || shop.latitude || shop.lat || 0;
  const lng = shop.location?.longitude || shop.longitude || shop.lng || 0;
  const name = shop.displayName?.text || shop.name || '';
  const openStatus = computeOpenStatus(shop, isLocal);

  let distanceMiles = shop.distanceMiles || null;
  if (!distanceMiles && userLat && userLng && lat && lng) {
    const R=3959, dLat=(lat-userLat)*Math.PI/180, dLon=(lng-userLng)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(userLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
    distanceMiles = R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  const reviews = shop.reviews || [];
  const allText = (name+' '+reviews.map(r=>r.text?.text||r.text||'').join(' ')).toLowerCase();

  // Drinks
  const detectedDrinks = {};
  for (const [k,cfg] of Object.entries(DRINK_PATTERNS)) {
    let score=0;
    cfg.namePatterns.forEach(p=>{if(name.toLowerCase().includes(p))score+=3;});
    cfg.reviewKeywords.forEach(kw=>{if(allText.includes(kw))score+=1;});
    if(score>=1)detectedDrinks[k]={confidence:score>=4?'high':'medium'};
  }
  if(!detectedDrinks.espresso&&!detectedDrinks.brewed){detectedDrinks.espresso={confidence:'medium'};detectedDrinks.brewed={confidence:'medium'};}

  // Amenities (review-detected)
  const amenities = {};
  for (const [k,cfg] of Object.entries(AMENITY_PATTERNS)) {
    if(cfg.keywords.some(kw=>allText.includes(kw)))amenities[k]={...cfg,available:true};
  }

  // Parking — passed from Worker (source = 'api' or 'reviews')
  const parking = shop.parking || null;

  // Seating — passed from Worker (source = 'api' or 'reviews')
  const seating = shop.seating || null;
  const hasIndoorSeating  = seating?.hasIndoorSeating  ?? shop.hasIndoorSeating  ?? (shop.dineIn===true)         ?? null;
  const hasOutdoorSeating = seating?.hasOutdoorSeating ?? shop.hasOutdoorSeating ?? (shop.outdoorSeating===true) ?? null;
  const seatingSource     = seating?.source || (hasIndoorSeating!==null||hasOutdoorSeating!==null?'api':null);

  const chainFlag = isChainShop(name);
  // Infer wifi for chains (virtually all chains offer wifi); review detection covers independents
  if(chainFlag && !amenities.wifi) amenities.wifi={icon:'📶',label:'WiFi (chain)',available:true};
  const hasWifi = !!amenities.wifi?.available;

  const specialtyFlag = isSpecialtyByName(name) || (!chainFlag && (shop.rating||0) >= 4.5 && (shop.userRatingCount||0) >= 50);
  let tier = specialtyFlag ? 1 : chainFlag ? 3 : 2;

  const badges=[];
  if(shop.institution) badges.push({icon:'📖',label:'On Wikipedia',color:'#7C2D12',bg:'#FFEDD5'}); // famous local institution, source named
  if(specialtyFlag)   badges.push({icon:'✨',label:'Specialty',    color:'#E65100',bg:'#FFF3E0'});
  if(chainFlag)       badges.push({icon:'🏪',label:'Chain',        color:'#78909C',bg:'#ECEFF1'});
  // No WiFi badge — WiFi now lives only inside the "Good for working" panel.
  // hasWifi is still computed above for the "Has WiFi" quick filter.

  // Normalize photo entries to URL strings. Google search (normalizePlace) returns
  // photo OBJECTS {url,thumbnail,full}; owned/enrich returns strings. The <img> needs
  // a string src, so objects silently failed → blank ☕ placeholder on real results.
  const photos = (shop.photos||(shop.photoUrl?[shop.photoUrl]:[]))
    .map(p=>typeof p==="string"?p:(p?.url||p?.full||p?.thumbnail||null)).filter(Boolean);
  return { ...shop, lat, lng, name, distanceMiles, distance:distanceMiles?`${distanceMiles.toFixed(1)} mi`:null, isOpen:openStatus.isOpen, todayHours:openStatus.todayHours, is24Hours:openStatus.is24Hours, detectedDrinks, amenities, parking, seating, hasIndoorSeating, hasOutdoorSeating, seatingSource, hasWifi, isChain:chainFlag, isSpecialty:specialtyFlag, tier, badges:badges.slice(0,5), photos, photoUrl:photos[0]||null };
}

// Directions handled by the shared <MapAppSelector> (address-aware destination +
// "from my location / other address" origin picker) — see src/components/MapAppSelector.jsx

// ─── COFFEE CARD · EDITORIAL (responsive: phone + iPad) ──────────────────────
// Editorial card used at BOTH widths. Same props, same fields, same handlers
// (drinks / amenities / seating / parking / phone / directions via the internal
// MapAppSelector / CafeWorkProfileSection / AIDetailsSection / website). The
// `isTablet` prop gates sizing only: tablet keeps the large editorial scale,
// phone gets a compact, phone-tuned variant. Tokens/structure mirror
// RestaurantCardTablet; only the café domain content + phone tuning differ.
function CoffeeCardTablet({ shop, index, onShowOnMap, userLat, userLng, formatDistance, isTablet, isLocal, onHours, batchEnrich }) {
  const [expanded,setExpanded]=useState(false);
  const [showDir,setShowDir]=useState(false);
  const [galleryOpen,setGalleryOpen]=useState(false);
  const [galleryStart,setGalleryStart]=useState(0);
  const [enriched,setEnriched]=useState(null);
  // 3 real Google photos + hours for OWNED shops (owned records carry none) —
  // (Website og:image was tried as a free rung and pulled for quality, so Google's
  // real photos are the source.) T1.15: the parent batch-enriches all visible owned
  // cafés in ONE worker call and hands this card its slice via `batchEnrich`
  // (undefined = batch in flight — wait, don't double-call). A card the batch
  // missed (null) falls back to its own single call; same per-item KV cache.
  useEffect(()=>{
    if(enriched||shop.source!=='owned')return;
    const key=shop.id||shop.placeId;
    if(key&&batchEnrich===undefined)return; // parent batch pending — its result arrives via prop
    if(batchEnrich){
      if(batchEnrich.matched){
        setEnriched(batchEnrich);
        // T1.8: lift the Google hours to the list so Open Now / "· N open" can see them.
        if(batchEnrich.hours?.weekdayDescriptions?.length) onHours?.(key, batchEnrich);
      }
      return;
    }
    callWorker('places/enrich-owned',{id:key,name:shop.displayName?.text||shop.name,lat:shop.lat,lng:shop.lng,maxPhotos:3})
      .then(({data})=>{
        if(!data||!data.matched) return;
        setEnriched(data);
        // T1.8: lift the Google hours to the list so Open Now / "· N open" can see them.
        if(data.hours?.weekdayDescriptions?.length) onHours?.(key, data);
      }).catch(()=>{});
  },[batchEnrich]); // eslint-disable-line react-hooks/exhaustive-deps
  const fs=(n)=>`calc(${n}px*var(--fs))`;
  // Responsive size picker — `t` (tablet) keeps the current editorial sizes,
  // `p` (phone) is the compact phone-tuned value. Every size below routes
  // through z() so the card renders correctly at both widths while keeping fs()
  // on all text (graceful growth via the 4-step glasses control).
  const z=(t,p)=>isTablet?t:p;
  // Category accent — this finder's OWN color world (canonical CAT.coffee.ink),
  // NOT the Places-to-Eat coral. Used for the editorial kicker, the primary
  // Directions button, the rank badge, and the Specialty tag, so the card reads
  // as one coherent warm accent. The green "Open" bar and blue "phone" bar stay
  // as-is (semantic colors shared across finders).
  const ACCENT = CAT.coffee.ink; // #A85A2E

  const name    = shop.displayName?.text || shop.name || "Coffee Shop";
  const address = shop.shortFormattedAddress || shop.formattedAddress || "";
  const photos  = (enriched?.photos?.length ? enriched.photos : (shop.photos||(shop.photoUrl?[shop.photoUrl]:[])))
    .map(p=>typeof p==="string"?p:(p?.url||p?.full||p?.thumbnail||null)).filter(Boolean);
  const weekdays = enriched?.hours?.weekdayDescriptions?.length ? enriched.hours.weekdayDescriptions : (shop.currentOpeningHours?.weekdayDescriptions||[]);
  // T1.5: Open/Closed is re-derived at render time with the same zone-aware policy
  // as the list — never from `enriched.hours.openNow`, which for an owned shop is a
  // Google boolean cached up to 90 days and wrong for any city but the user's own.
  // The zone comes from the row (Google path) or, once the worker sends it, from
  // enrich-owned; a navigated city with no zone yields no status (honest blank).
  const tzOff = shop.utcOffsetMinutes ?? enriched?.utcOffsetMinutes ?? null;
  const st = computeOpenStatus(
    enriched?.hours?.weekdayDescriptions?.length
      ? { ...shop, currentOpeningHours:{ weekdayDescriptions:weekdays, openNow:enriched.hours.openNow }, utcOffsetMinutes:tzOff }
      : shop,
    isLocal);
  const openNow = st.isOpen, todayHrs = st.todayHours, is24 = st.is24Hours;
  const todayIdx = placeDayIndex(tzOff, isLocal); // "today" row in the weekly hours, in the place's zone
  const phone   = shop.nationalPhoneNumber || shop.internationalPhoneNumber || "";
  const parking = shop.parking;
  const parkingConfirmed = parking?.source==='api';
  const hasAnySeating = shop.hasIndoorSeating||shop.hasOutdoorSeating||shop.seating?.hasLoungeSeating||shop.seating?.hasBarSeating;
  const seatingConfirmed = shop.seatingSource==='api';
  // Café category kicker — coffee accent, same role as the cuisine kicker on Eat.
  const kicker = shop.isSpecialty ? 'Specialty Coffee'
    : shop.isChain ? 'Coffee Chain'
    : (shop.primaryType
        ? shop.primaryType.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())
        : 'Café');
  const openText = is24 ? 'Open 24/7' : (openNow===true ? 'Open' : openNow===false ? 'Closed' : '');

  const Tag=({bg,color,children})=>(
    <span style={{background:bg,color,borderRadius:"999px",padding:`${fs(z(9,6))} ${fs(z(16,11))}`,fontSize:fs(z(15.5,12.5)),fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
  );

  return (
    <motion.div initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{delay:Math.min(index,8)*0.03}}
      style={{background:"#fff",borderRadius:z("28px","20px"),overflow:"hidden",boxShadow:z("0 24px 50px -30px rgba(22,17,13,.4)","0 14px 30px -22px rgba(22,17,13,.34)"),border:`1px solid ${ED_RULE}`,minHeight:z("auto","320px")}}>

      {/* Photo — PhotoOrIcon (first working photo, icon-on-tint fallback), rank
          badge, Specialty tag + wishlist heart; tap opens the full gallery */}
      <div style={{position:"relative"}}>
        <PhotoOrIcon photos={photos} alt={name} fallbackIcon={CoffeeIcon} tint={CAT.coffee} height={z(360,200)} iconSize={z(56,44)}
          onClick={photos.length?(i)=>{setGalleryStart(typeof i==="number"?i:0);setGalleryOpen(true);}:undefined}/>
        <div style={{position:"absolute",top:fs(z(14,11)),left:fs(z(14,11)),background:ACCENT,color:"#fff",width:fs(z(38,30)),height:fs(z(38,30)),borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:fs(z(16,13)),boxShadow:"0 2px 8px rgba(0,0,0,0.25)",border:"2px solid #fff"}}>{index+1}</div>
        <div style={{position:"absolute",top:fs(z(14,11)),right:fs(z(14,11)),display:"flex",alignItems:"center",gap:fs(8)}}>
          {shop.tier===1&&<div style={{display:"inline-flex",alignItems:"center",gap:fs(4),background:"rgba(255,255,255,0.95)",padding:`${fs(z(4,3))} ${fs(z(11,9))}`,borderRadius:"8px",fontSize:fs(z(14,11.5)),fontWeight:700,color:ACCENT,boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}><Sparkles size={12} strokeWidth={2}/>Specialty</div>}
        </div>
      </div>

      <div style={{padding:z(`${fs(28)} ${fs(32)} ${fs(32)}`,`${fs(16)} ${fs(16)} ${fs(18)}`)}}>
        <div style={{color:ACCENT,fontWeight:600,fontSize:fs(z(17,13)),letterSpacing:"0.2px"}}>{kicker}</div>
        <h3 style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:fs(z(38,26)),lineHeight:1.04,color:ED_INK,margin:`${fs(z(4,3))} 0 0`,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{name}</h3>
        {address&&<div style={{fontSize:fs(z(15.5,12.5)),color:ED_INK3,marginTop:fs(z(6,5))}}>{address}</div>}

        {/* Say it / Translate / rating / distance / price */}
        <div style={{display:"flex",gap:fs(z(16,10)),alignItems:"center",flexWrap:"wrap",marginTop:fs(z(12,9)),fontSize:fs(z(17,13)),color:ED_INK3}}>
          <NameLanguageHelp placeId={shop.placeId||shop.id} name={name}/>
          {/* T2.2: the stars are Google's — say so, quietly (muted word, no logo) */}
          {shop.rating>0&&<span><span style={{color:"#E0922F"}}>★</span> <span style={{fontWeight:700,color:ED_INK2}}>{shop.rating}</span>{shop.userRatingCount>0&&<span> ({shop.userRatingCount.toLocaleString()})</span>}<span style={{fontSize:fs(z(11,10)),color:ED_INK3,marginLeft:fs(5),opacity:.8}}>Google</span></span>}
          {shop.distanceMiles!=null&&<span>· {formatDistance(shop.distanceMiles)}</span>}
          {shop.priceLevel&&<span>· {'$'.repeat(shop.priceLevel)}</span>}
        </div>

        {/* Drink + status pill tags */}
        {(Object.keys(shop.detectedDrinks||{}).length>0||shop.badges?.some(b=>b.label!=='Specialty'))&&(
          <div style={{display:"flex",gap:fs(z(10,7)),flexWrap:"wrap",marginTop:fs(z(16,12))}}>
            {Object.entries(shop.detectedDrinks||{}).slice(0,4).map(([type])=>{const p=DRINK_PATTERNS[type];return p?<Tag key={type} bg={p.bg} color={p.color}>{p.icon} {p.label}</Tag>:null;})}
            {shop.badges?.filter(b=>b.label!=='Specialty').map((b,i)=><Tag key={i} bg={b.bg} color={b.color}>{b.icon} {b.label}</Tag>)}
          </div>
        )}

        {/* Open bar — hidden until enrich resolves hours for owned shops */}
        {openNow!==null&&openNow!==undefined&&(
          <div style={{marginTop:fs(z(18,12)),background:openNow?"#E7F3EA":"#FBE0DC",borderRadius:z("16px","13px"),padding:`${fs(z(16,11))} ${fs(z(20,14))}`,fontSize:fs(z(18,13.5)),fontWeight:600,color:openNow?"#2E7D46":"#C2392F",display:"flex",alignItems:"center",gap:fs(z(11,9))}}>
            <span style={{width:fs(z(10,9)),height:fs(z(10,9)),borderRadius:"50%",background:is24?"#00BCD4":(openNow?"#2E7D46":"#C2392F"),flexShrink:0}}/>
            <span>{openText}</span>
            {todayHrs&&!is24&&<span style={{color:ED_INK3,fontWeight:500}}>· {todayHrs}</span>}
          </div>
        )}

        {/* Phone bar */}
        {phone&&(
          <a href={`tel:${phone}`} style={{marginTop:fs(z(14,10)),background:"#EFF4FB",borderRadius:z("16px","13px"),padding:`${fs(z(18,12))} ${fs(z(20,14))}`,display:"flex",alignItems:"center",gap:fs(z(14,11)),textDecoration:"none"}}>
            <span style={{fontSize:fs(z(24,19))}}>📞</span>
            <span><span style={{display:"block",fontSize:fs(z(20,13.5)),fontWeight:600,color:"#2E6FE0"}}>{phone}</span><span style={{fontSize:fs(z(15,12)),color:ED_INK3}}>Tap to call</span></span>
          </a>
        )}

        {/* Good for working + AI details — on the front card, above the actions */}
        <div style={{display:"flex",flexDirection:"column",gap:fs(z(12,10)),marginTop:fs(z(18,13))}}>
          <CafeWorkProfileSection placeId={shop.placeId || shop.id} placeName={name} lat={shop.lat} lng={shop.lng}/>
          <AIDetailsSection placeId={shop.placeId || shop.id} placeName={name} lat={shop.lat} lng={shop.lng} page="CoffeeFinder" kind="coffee"/>
          <HereStamp place={{ id: shop.placeId || shop.id, name, lat: shop.lat, lng: shop.lng, types: shop.types, formattedAddress: shop.formattedAddress || shop.address }}/>
          <TravelerDishes place={{ id: shop.placeId || shop.id, name, lat: shop.lat, lng: shop.lng }} kind="coffee"/>
        </div>

        {/* Actions */}
        <div style={{display:"flex",gap:fs(z(12,8)),marginTop:fs(z(20,14))}}>
          <button onClick={()=>setShowDir(true)} style={{flex:1,borderRadius:z("16px","13px"),padding:fs(z(15,11)),fontSize:fs(z(18,14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:ACCENT,color:"#fff"}}>Directions</button>
          <button onClick={()=>onShowOnMap?.(index)} style={{flex:1,borderRadius:z("16px","13px"),padding:fs(z(15,11)),fontSize:fs(z(18,14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:ED_IVORY2,color:ED_INK2}}>📍 Map</button>
          <button onClick={()=>setExpanded(e=>!e)} style={{flex:1,borderRadius:z("16px","13px"),padding:fs(z(15,11)),fontSize:fs(z(18,14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:expanded?ED_INK:ED_IVORY2,color:expanded?"#fff":ED_INK2}}>{expanded?"Less ▴":"More ▾"}</button>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{marginTop:fs(z(20,14)),display:"flex",flexDirection:"column",gap:fs(z(14,10))}}>

                {(hasAnySeating||parking)&&(
                  <div style={{display:"flex",gap:fs(z(14,10)),flexWrap:"wrap"}}>
                    {hasAnySeating&&(
                      <div style={{flex:"1 1 240px",padding:fs(z(16,13)),background:"#FAF7F0",borderRadius:z("16px","13px"),border:`1px solid ${ED_RULE}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:fs(8),marginBottom:fs(8)}}>
                          <span style={{fontSize:fs(17),fontWeight:700,color:ED_INK}}>🪑 Seating</span>
                          <span style={{fontSize:fs(12),fontWeight:700,color:seatingConfirmed?"#2E7D32":"#E65100",background:seatingConfirmed?"#E8F5E9":"#FFF3E0",padding:`${fs(1)} ${fs(7)}`,borderRadius:"6px"}}>{seatingConfirmed?"✅ Google confirmed":"⚠️ Not confirmed"}</span>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:fs(6)}}>
                          {shop.hasIndoorSeating&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>🏠 Indoor</span>}
                          {shop.hasOutdoorSeating&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>🌿 Outdoor</span>}
                          {shop.seating?.hasLoungeSeating&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>🛋️ Lounge</span>}
                          {shop.seating?.hasBarSeating&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>🪑 Bar seats</span>}
                          {shop.seating?.capacityNote&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>📐 {shop.seating.capacityNote}</span>}
                        </div>
                      </div>
                    )}
                    {parking&&(
                      <div style={{flex:"1 1 240px",padding:fs(z(16,13)),background:"#FAF7F0",borderRadius:z("16px","13px"),border:`1px solid ${ED_RULE}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:fs(8),marginBottom:fs(8)}}>
                          <span style={{fontSize:fs(17),fontWeight:700,color:ED_INK}}>🅿️ Parking</span>
                          <span style={{fontSize:fs(12),fontWeight:700,color:parkingConfirmed?"#2E7D32":"#E65100",background:parkingConfirmed?"#E8F5E9":"#FFF3E0",padding:`${fs(1)} ${fs(7)}`,borderRadius:"6px"}}>{parkingConfirmed?"✅ Google confirmed":"⚠️ Mentioned in reviews"}</span>
                        </div>
                        {parking.noParking?(
                          <div style={{fontSize:fs(15),color:"#C2392F"}}>{parking.noParkingNote}</div>
                        ):(
                          <div style={{display:"flex",flexWrap:"wrap",gap:fs(6)}}>
                            {parking.details?.length>0?parking.details.map((d,i)=>(
                              <span key={i} style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>{d.icon} {d.label}{d.free===true?' · Free':d.free===false&&!d.cost?' · Paid':''}</span>
                            )):<span style={{fontSize:fs(15),color:ED_INK3}}>Parking available nearby</span>}
                            {parking.valetCost&&<span style={{fontSize:fs(15),color:ED_INK3,background:"#fff",border:`1px solid ${ED_RULE}`,padding:`${fs(3)} ${fs(10)}`,borderRadius:"8px"}}>🎩 Valet {parking.valetCost}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Review-detected amenities (always ⚠️ reported); WiFi lives in the work panel only */}
                {Object.entries(shop.amenities||{}).some(([k,a])=>a.available&&k!=='wifi')&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:fs(8)}}>
                    {Object.entries(shop.amenities).filter(([k,a])=>a.available&&k!=='wifi').map(([k,a])=>(
                      <span key={k} title="Mentioned in customer reviews — call ahead to confirm" style={{display:"flex",alignItems:"center",gap:fs(5),background:"#FFFBF0",border:"1px solid #FED7AA",padding:`${fs(4)} ${fs(12)}`,borderRadius:"8px",fontSize:fs(15),fontWeight:600,color:"#92400E",cursor:"default"}}>
                        {a.icon} {a.label} <span style={{color:"#D97706",fontSize:fs(13)}}>·reported</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Daily hours — open with the card (More), collapse with Less */}
                {weekdays.length>0&&(
                  <div style={{padding:fs(z(16,13)),background:"#FAF7F0",borderRadius:z("16px","13px")}}>
                    <div style={{fontSize:fs(13),fontWeight:700,color:ED_INK3,letterSpacing:"0.5px",marginBottom:fs(8)}}>🕐 DAILY HOURS</div>
                    <div>
                      {weekdays.map((day,i)=>{
                        const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                        const isToday=todayIdx>=0&&DAY.findIndex(d=>day.startsWith(d))===todayIdx;
                        return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:`${fs(4)} 0`,fontSize:fs(15),fontWeight:isToday?700:400,color:isToday?TEAL_DEEP:ED_INK2,borderBottom:i<6?`1px solid ${ED_RULE}`:"none"}}>
                          <span>{day.split(':')[0]}</span><span>{day.split(':').slice(1).join(':').trim()}</span>
                        </div>;
                      })}
                    </div>
                  </div>
                )}

                {/* Website */}
                {(shop.websiteUri||shop.website)&&(
                  <a href={shop.websiteUri||shop.website} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:fs(12),padding:fs(z(16,13)),background:"#F3E8FF",borderRadius:z("16px","13px"),textDecoration:"none",color:"#7C3AED"}}>
                    <span style={{fontSize:fs(22)}}>🌐</span>
                    <span><span style={{display:"block",fontWeight:600,fontSize:fs(16)}}>Visit Website</span><span style={{fontSize:fs(14),color:ED_INK3}}>Menu &amp; info</span></span>
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <MapAppSelector isOpen={showDir} onClose={()=>setShowDir(false)} destination={{name, address, latitude:shop.lat, longitude:shop.lng}} userLat={userLat} userLng={userLng}/>
      {galleryOpen&&<PhotoGalleryModal photos={photos} initialIndex={galleryStart} isOpen onClose={()=>setGalleryOpen(false)}/>}
    </motion.div>
  );
}

// ─── FILTER PILL ───────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick, emoji, disabled, title }) {
  return <button onClick={onClick} disabled={disabled} title={title} style={{padding:"7px 14px",borderRadius:"20px",border:active?`2px solid ${BROWN}`:"1.5px solid #E2E8F0",background:active?`${BROWN}15`:"#fff",color:active?BROWN:GRAY,fontWeight:active?"700":"500",fontSize:"calc(13px*var(--fs))",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0}}>{emoji&&<span style={{marginRight:"4px"}}>{emoji}</span>}{label}</button>;
}
function ToggleChip({ label, active, onClick, icon, disabled, title }) {
  return <button onClick={onClick} disabled={disabled} title={title} style={{display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",borderRadius:"8px",border:active?`1.5px solid ${BROWN}`:"1.5px solid #E2E8F0",background:active?`${BROWN}12`:"#fff",color:active?BROWN_DARK:GRAY,fontWeight:active?"700":"500",fontSize:"calc(12px*var(--fs))",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,fontFamily:"inherit",whiteSpace:"nowrap"}}>{icon&&<span>{icon}</span>}{label}</button>;
}

// ─── MAP POPUP ─────────────────────────────────────────────────────────────
function buildMapPopup(shop, index) {
  const name    = shop.displayName?.text || shop.name || "Coffee Shop";
  const address = shop.formattedAddress  || shop.shortFormattedAddress || "";
  const phone   = shop.nationalPhoneNumber || shop.internationalPhoneNumber || null;
  const { isOpen, todayHours, is24Hours } = shop;
  const parkingLine = shop.parking&&!shop.parking.noParking ? `<div style="font-size:11px;color:#64748B;margin-top:4px;">🅿️ ${shop.parking.details?.[0]?.label||'Parking available'} <span style="color:${shop.parking.source==='api'?'#2E7D32':'#E65100'};font-weight:700;">${shop.parking.source==='api'?'✅':'⚠️'}</span></div>` : '';
  const seatingLine = (shop.hasIndoorSeating||shop.hasOutdoorSeating) ? `<div style="font-size:11px;color:#64748B;margin-top:2px;">🪑 ${[shop.hasIndoorSeating&&'Indoor',shop.hasOutdoorSeating&&'Outdoor'].filter(Boolean).join(' & ')} seating <span style="color:${shop.seatingSource==='api'?'#2E7D32':'#E65100'};font-weight:700;">${shop.seatingSource==='api'?'✅':'⚠️'}</span></div>` : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:260px;position:relative;">
      <div style="padding:12px;padding-top:14px;">
        <div onclick="window.viewPlaceDetails&&window.viewPlaceDetails(${index})" style="font-weight:700;font-size:calc(15px*var(--fs));color:#1A2332;margin-bottom:6px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding-right:26px;">${name}</div>
        <div style="font-size:12px;color:#64748B;margin-bottom:6px;padding:6px 8px;background:#F8FAFC;border-radius:6px;">📍 ${address}</div>
        <div style="font-size:calc(12px*var(--fs));margin-bottom:6px;padding:6px 10px;border-radius:6px;background:${is24Hours?'#E3F2FD':isOpen===true?'#E8F5E9':isOpen===false?'#FFEBEE':'#F5F5F5'};">
          <span style="font-weight:700;color:${is24Hours?'#1565C0':isOpen===true?'#2E7D32':isOpen===false?'#D32F2F':'#9E9E9E'};">${is24Hours?'🔄 Open 24/7':isOpen===true?'● Open':isOpen===false?'● Closed':'● Hours N/A'}</span>
          ${todayHours&&!is24Hours?`<span style="color:#64748B;"> · ${todayHours}</span>`:''}
        </div>
        ${parkingLine}${seatingLine}
        ${phone?`<a href="tel:${phone}" style="display:flex;align-items:center;gap:8px;margin:8px 0;padding:7px 10px;background:#E3F2FD;border-radius:6px;text-decoration:none;color:#1565C0;font-size:calc(12px*var(--fs));"><span>📞</span><span style="font-weight:600;">${phone}</span></a>`:''}
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button onclick="window.openDirectionsFromMap&&window.openDirectionsFromMap(${index})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#6F4E37;color:#fff;font-weight:600;font-size:12px;cursor:pointer;">🧭 Directions</button>
          <button onclick="window.viewPlaceDetails&&window.viewPlaceDetails(${index})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:12px;cursor:pointer;">📋 Details</button>
        </div>
      </div>
    </div>
  `;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
export default function CoffeeFinderPage() {
  const navigate = useNavigate();
  // iPad: wider centered column + editorial coffee cards (design handoff).
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  // If user arrived via the "Try the Coffee Finder feature in this app"
  // link from PlacesToEat, the router state carries { from: 'PlacesToEat' }.
  // When that's present we render an extra "← Back to Places to Eat"
  // button so the user can return to their restaurant search without
  // bouncing through Home.
  const routerLocation = useRouterLocation();
  const fromPlacesToEat = routerLocation?.state?.from === 'PlacesToEat';
  const [shops,setShops]         = useState([]);
  // T1.8/T1.5: Google hours the cards fetch for OWNED shops (enrich-on-mount),
  // keyed by shop id. Kept beside `shops` rather than patched into it so a
  // Refresh that returns the same rows keeps the hours and cards never re-fetch.
  const [hoursById,setHoursById] = useState({});
  const handleCardHours = (id,data)=>{ if(!id) return; setHoursById(m=>m[id]?m:({...m,[id]:{weekdayDescriptions:data.hours.weekdayDescriptions,openNow:data.hours.openNow??null,utcOffsetMinutes:data.utcOffsetMinutes??null}})); };
  const [loading,setLoading]     = useState(true);
  const [refreshTick,setRefreshTick] = useState(0);
  const forceNextRef             = useRef(false);
  const handleRefresh            = () => { forceNextRef.current = true; setRefreshTick(t=>t+1); };
  const [error,setError]         = useState(null);
  const [viewMode,setViewMode]   = useState("list");
  const [radius,setRadius]       = useState(25); // wide net; no radius UI — nearest-first
  const [showLocPicker,setShowLocPicker] = useState(false);
  const [userPinExpanded, setUserPinExpanded] = useState(true);
  useEffect(() => {
    /** @type {any} */ (window)._gsCFUserPin = () => setUserPinExpanded(e => !e);
    return () => { delete /** @type {any} */ (window)._gsCFUserPin; };
  }, []);
  // Analytics: log a page_view once on mount.
  useEffect(() => { logEvent('page_view', {}, 'CoffeeFinder'); }, []);
  const [directionsShop,setDirectionsShop] = useState(null);
  const [filterSheetOpen,setFilterSheetOpen] = useState(false);
  const [quickFilter,setQuickFilter]   = useState("all");
  const [sortBy,setSortBy]             = useState("nearby");
  const [filterOpenNow,setFilterOpenNow]       = useState(false);
  const [filterShopType,setFilterShopType]     = useState("all");
  const [filterWifi,setFilterWifi]               = useState(false);
  // Café / drink search — name (e.g. "Blue Bottle") or a drink (latte, cold
  // brew, caramel macchiato). Owned-first (client filter over `shops`) merged
  // with a live Google café search (searchShops).
  const [q,setQ]                                 = useState("");
  const [submitted,setSubmitted]                 = useState("");
  const [searchShops,setSearchShops]             = useState([]);
  const [searchBusy,setSearchBusy]               = useState(false);
  // Work-amenity filters (💻 good for working) — backed by the Haiku work-profile
  // (wifi/outlets/quiet/AC), honest & estimated. workProfiles is a {placeId: wp}
  // map filled lazily from /coffee/work-profiles when a work filter is active.
  const [filterWork,setFilterWork]               = useState(false);
  const [filterOutlets,setFilterOutlets]         = useState(false);
  const [filterQuiet,setFilterQuiet]             = useState(false);
  const [filterAC,setFilterAC]                   = useState(false);
  const [workProfiles,setWorkProfiles]           = useState({});
  const [workBusy,setWorkBusy]                   = useState(false);
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const cardRefs = useRef({}); const mapRef = useRef(null); const mapInstanceRef = useRef(null);

  const { activeLocation, locationMode } = useLocation();
  // "Local" = browsing the city the device is physically in, so the device clock
  // is the place clock. Gates every Open/Closed derivation on this page (T1.5).
  const isLocal = locationMode === 'current';
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locationText = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);

  // City-level locations get a wider default radius derived from Google's
  // viewport. Reset on every location change so non-city picks revert to 10mi.
  useEffect(() => {
    setRadius(25); // fixed wide net (radius filter removed app-wide)
  }, [activeLocation?.placeId]);

  const activeFilterCount = [quickFilter!=="all",filterOpenNow,filterShopType!=="all",filterWifi,filterWork,filterOutlets,filterQuiet,filterAC].filter(Boolean).length;   // quick pills count too — a pill-only empty list deserves the Clear-filters action
  const workFilterActive = filterWork||filterOutlets||filterQuiet||filterAC;

  // Lazily fetch work-profiles for the nearest cafes when a work filter is on.
  // Free cache reads for all + a bounded handful computed on demand (cached
  // forever). Only fires on explicit work-intent.
  useEffect(()=>{
    if(!workFilterActive||!shops.length) return;
    const pool=[...shops].sort((a,b)=>(a.distanceMiles||999)-(b.distanceMiles||999));
    const need=pool.filter(s=>{const k=s.id||s.placeId;return k&&!workProfiles[k];}).slice(0,15);
    if(!need.length) return;
    let cancelled=false; setWorkBusy(true);
    callWorker(ROUTE.coffeeWorkProfiles,{cafes:need.map(s=>({placeId:s.id||s.placeId,placeName:s.name,lat:s.lat,lng:s.lng})),maxCompute:8})
      .then(({data})=>{ if(!cancelled&&data?.profiles) setWorkProfiles(p=>({...p,...data.profiles})); })
      .catch(()=>{})
      .finally(()=>{ if(!cancelled) setWorkBusy(false); });
    return()=>{cancelled=true;};
  },[workFilterActive,shops]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!lat||!lng){ setLoading(false); return; } // no location yet — don't spin forever
    let cancelled=false;
    setLoading(true);setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;
    (async()=>{
      try {
        // Owned planet DB (free list, no per-search Google cost). Real photos +
        // hours come on-tap via enrich-owned. Same card, same downstream panels.
        const {data, error: workerError} = await callWorker(ROUTE.getCoffeeOwned,{latitude:lat,longitude:lng,radius:radius*1609,maxResults:30,forceRefresh:force});
        if(cancelled) return; // a newer fetch (radius/location change) superseded this one
        if (workerError) throw new Error(workerError);
        const places = data?.places||data?.shops||[];
        if(places.length>0){
          const processed=places.map(p=>processShop(p,lat,lng,isLocal));
          processed.sort((a,b)=>(a.distanceMiles||999)-(b.distanceMiles||999));
          setShops(processed);
        } else { setError(data?.error||"No coffee shops found near this location."); }
      } catch(e){ if(!cancelled) setError(`Failed to load: ${e.message}`);}
      finally{ if(!cancelled) setLoading(false);}
    })();
    return ()=>{ cancelled=true; };
  },[lat,lng,radius,refreshTick]);

  // Search results = owned café/drink matches (free, instant) merged with the
  // live Google café search, deduped, distance-sorted. No radius filter here.
  // Owned rows ship no hours; merge what the cards lifted and (re)evaluate Open/
  // Closed with the zone-aware policy — the only way the list-level Open Now
  // filter and the "· N open" count can ever see an owned shop's status.
  const shopsWithHours = useMemo(()=>shops.map(s=>{
    const h=hoursById[s.id||s.placeId]; if(!h) return s;
    const next={...s,currentOpeningHours:{weekdayDescriptions:h.weekdayDescriptions,openNow:h.openNow},utcOffsetMinutes:s.utcOffsetMinutes??h.utcOffsetMinutes??null};
    return {...next,...computeOpenStatus(next,isLocal)};
  }),[shops,hoursById,isLocal]);

  const searchMerged = useMemo(()=>{
    if(!submitted) return [];
    // Accent/Unicode-insensitive owned match (see @/lib/searchText).
    const owned=shopsWithHours.filter(s=>matchesQuery(`${s.name||''} ${Object.keys(s.detectedDrinks||{}).join(' ')} ${(s.types||[]).join(' ')}`, submitted));
    const seen=new Set(),out=[];
    const push=(s)=>{const k=s.id||s.placeId||`${s.lat},${s.lng}`;if(k&&!seen.has(k)){seen.add(k);out.push(s);}};
    owned.forEach(push);            // owned first — free + trusted
    (searchShops||[]).forEach(push); // then live Google cafés
    out.sort((a,b)=>(a.distanceMiles||999)-(b.distanceMiles||999));
    return out;
  },[submitted,shopsWithHours,searchShops]);

  // T1.8: Open Now is only meaningful once some shop in view has a known state.
  const listBase = submitted ? searchMerged : shopsWithHours;
  const hoursKnown = listBase.some(s=>typeof s.isOpen==='boolean');
  // A stale Open Now toggle would filter everything away while hours are unknown —
  // drop it (the pill is disabled meanwhile) rather than show an empty list.
  useEffect(()=>{ if(!hoursKnown){ if(quickFilter==='open') setQuickFilter('all'); if(filterOpenNow) setFilterOpenNow(false); } },[hoursKnown]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(()=>{
    // Searching: within-radius merged results, or the closest few beyond if
    // nothing is within radius (better than an empty screen). Else: browse.
    let base;
    if(submitted){
      const within=searchMerged; // no radius cap — show all, nearest-first
      base=within.length?within:searchMerged.slice(0,8);
    } else base=shopsWithHours;
    let r=[...base];
    if(quickFilter==="open"&&hoursKnown) r=r.filter(s=>s.isOpen===true);
    if(quickFilter==="specialty")    r=r.filter(s=>s.isSpecialty);
    if(filterOpenNow&&hoursKnown) r=r.filter(s=>s.isOpen===true);
    if(filterWifi)          r=r.filter(s=>s.hasWifi);
    if(filterShopType==="chain")      r=r.filter(s=>s.isChain);
    if(filterShopType==="specialty")  r=r.filter(s=>s.isSpecialty);
    // Work-amenity filters — match the Haiku work-profile (estimated, honest).
    // A cafe with no profile yet is excluded from the strict match (never faked).
    if(filterWork)    r=r.filter(s=>{const w=workProfiles[s.id||s.placeId];return w&&(w.laptopFriendly==='great'||w.laptopFriendly==='ok');});
    if(filterOutlets) r=r.filter(s=>{const w=workProfiles[s.id||s.placeId];return w&&(w.outlets?.status==='yes'||w.outlets?.status==='limited');});
    if(filterQuiet)   r=r.filter(s=>{const w=workProfiles[s.id||s.placeId];return w&&w.noise==='quiet';});
    if(filterAC)      r=r.filter(s=>{const w=workProfiles[s.id||s.placeId];return w&&w.ac?.status==='yes';});
    if(sortBy==="nearby")  r.sort((a,b)=>(a.distanceMiles||999)-(b.distanceMiles||999));
    else if(sortBy==="rating") r.sort((a,b)=>{
      // Weight rating by log(reviews) so a 5.0 with 1 review can't beat a 4.5
      // with thousands. Surfaces well-known shops with photos and full data.
      const sa=(a.rating||0)*Math.log10(Math.max(a.userRatingCount||1,1));
      const sb=(b.rating||0)*Math.log10(Math.max(b.userRatingCount||1,1));
      return sb-sa;
    });
    if(submitted) r=pinInstitutions(r);
    return r;
  },[shopsWithHours,searchMerged,submitted,radius,quickFilter,sortBy,filterOpenNow,hoursKnown,filterWifi,filterShopType,filterWork,filterOutlets,filterQuiet,filterAC,workProfiles]);

  // ── T1.15: BATCH ENRICH VISIBLE OWNED CAFÉS ──────────────────────────────
  // Was: every owned card fired its own /places/enrich-owned on mount (one call
  // per rendered card). Now all visible owned cafés go up in batched calls of 20
  // (the worker's batch cap). ownedEnrich[key]: undefined = batch pending,
  // payload = result, null = batch missed/errored → that card's own single-call
  // fallback runs (same KV cache server-side).
  const [ownedEnrich,setOwnedEnrich]=useState({});
  const ownedEnrichAsked=useRef(new Set());
  useEffect(()=>{
    const owned=filtered.filter(s=>s.source==='owned')
      .map(s=>({id:s.id||s.placeId,name:s.displayName?.text||s.name,lat:s.lat,lng:s.lng}))
      .filter(s=>s.id&&!ownedEnrichAsked.current.has(s.id));
    if(!owned.length)return;
    owned.forEach(s=>ownedEnrichAsked.current.add(s.id));
    (async()=>{
      for(let i=0;i<owned.length;i+=20){
        const chunk=owned.slice(i,i+20);
        const {data}=await callWorker('places/enrich-owned',{places:chunk,maxPhotos:3});
        const res=data?.results||{};
        setOwnedEnrich(prev=>{const nx={...prev};chunk.forEach(s=>{nx[s.id]=res[s.id]??null;});return nx;});
      }
    })();
  },[filtered]);

  const clearFilters=()=>{setFilterOpenNow(false);setFilterShopType("all");setFilterWifi(false);setFilterWork(false);setFilterOutlets(false);setFilterQuiet(false);setFilterAC(false);};

  const runSearch=async(explicitQuery)=>{
    const query=(typeof explicitQuery==='string'?explicitQuery:q).trim(); if(!query) return;
    setSubmitted(query); setSearchBusy(true); setSearchShops([]);
    try{
      const {data}=await callWorker(ROUTE.searchCoffee,{query,latitude:lat,longitude:lng,radiusMiles:radius,namedPlace:!isLocal});
      const raw=Array.isArray(data?.places)?data.places:[];
      setSearchShops(raw.map(p=>processShop(p,lat,lng,isLocal)));
      // Geo-tagged demand signal (which coffee/drink, in which city, now vs planning).
      if(raw.length) logSearch('coffee',query,{radius,resultCount:raw.length});
      else logZeroResults('coffee',query,{radius});
    }catch{ setSearchShops([]); }
    setSearchBusy(false);
  };
  const clearSearch=()=>{setQ("");setSubmitted("");setSearchShops([]);};

  // Smart-Search spine / cross-finder handoff: a query passed via router state
  // (navigate("CoffeeFinder",{state:{presetQuery}})) prefills the box and
  // auto-runs the café search once coords are ready. Mirrors PlacesToEat.
  const presetRanRef=useRef(false);
  useEffect(()=>{
    const pq=routerLocation.state?.presetQuery;
    if(presetRanRef.current||!pq||!String(pq).trim()) return;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
    presetRanRef.current=true;
    setQ(String(pq).trim());
    runSearch(String(pq).trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[routerLocation.state?.presetQuery,lat,lng]);

  const handleShowOnMap=(index)=>{setSelectedMapIndex(index);setViewMode("map");setTimeout(()=>{const s=filtered[index];if(mapInstanceRef.current&&s?.lat&&s?.lng)mapInstanceRef.current.setView([s.lat,s.lng],16);},300);};

  useEffect(()=>{
    if(viewMode!=="map"||!mapRef.current||!lat||!lng)return;
    const init=()=>{
      if(mapInstanceRef.current)mapInstanceRef.current.remove();
      const map=window.L.map(mapRef.current).setView([lat,lng],14);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
      mapInstanceRef.current=map;window.mapInstance=map;
      window.viewPlaceDetails=(i)=>{setViewMode("list");setTimeout(()=>cardRefs.current[i]?.scrollIntoView({behavior:"smooth",block:"center"}),150);};
      window.openDirectionsFromMap=(i)=>setDirectionsShop(filtered[i]);
      const userMode=activeLocation?.mode==='navigate'?'Selected location':'Current location';
      const userLabel=locationText||'';
      const userTooltipHtml=userPinExpanded
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsCFUserPin&&window._gsCFUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:calc(10px*var(--fs));font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:calc(12px*var(--fs));margin-bottom:2px;padding-right:24px;">📍 You are here</div><div style="font-weight:700;color:#4285F4;font-size:calc(11px*var(--fs));margin-bottom:2px;">${userMode}</div><div style="color:#64748B;font-size:calc(10px*var(--fs));line-height:1.3;">${userLabel}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsCFUserPin&&window._gsCFUserPin()"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">📍 You are here</span><span style="color:#64748B;font-size:calc(10px*var(--fs));font-weight:700;">⌄</span></div>`;
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:'<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',iconSize:[16,16],className:""})}).addTo(map).bindTooltip(userTooltipHtml,{permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:true});
      filtered.forEach((s,i)=>{
        if(!s.lat||!s.lng)return;
        const isSelected = i === selectedMapIndex;
        const pinBg = isSelected ? "#FF6B35" : BROWN;
        const pinSize = isSelected ? 36 : 28;
        const pinBorder = isSelected ? "3px solid #fff" : "2px solid #fff";
        const pinShadow = isSelected ? "0 0 0 3px rgba(255,107,53,0.4), 0 3px 10px rgba(255,107,53,0.5)" : "0 2px 8px rgba(111,78,55,0.4)";
        const marker = window.L.marker([s.lat,s.lng],{icon:window.L.divIcon({html:`<div style="width:${pinSize}px;height:${pinSize}px;background:${pinBg};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${isSelected?14:12}px;box-shadow:${pinShadow};border:${pinBorder};">${i+1}</div>`,iconSize:[pinSize,pinSize],className:""})}).addTo(map).bindPopup(buildMapPopup(s,i),{maxWidth:270,autoPan:true,autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true,className:"gs-popup"});
        if(isSelected) setTimeout(()=>marker.openPopup(),300);
      });
    };
    if(!window.L){const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(link);const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.onload=init;document.head.appendChild(script);}else{init();}
    return()=>{delete window.mapInstance;delete window.viewPlaceDetails;delete window.openDirectionsFromMap;if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null;}};
  },[viewMode,filtered,lat,lng,selectedMapIndex,userPinExpanded,locationText,activeLocation?.mode]);

  const stats={total:filtered.length,open:filtered.filter(s=>s.isOpen===true).length,specialty:filtered.filter(s=>s.tier===1).length,withParking:filtered.filter(s=>s.parking&&!s.parking.noParking).length};

  return (
    <div className="font-sans" style={{background:IVORY,minHeight:"100vh"}}>
      {/* HEADER — shared FinderHeader (back chevron · Coffee pill · mono count ·
          refresh), location card + city disclaimer inside; search/filter band
          rides along as children. The page keeps owning LocationModePicker. */}
      <FinderHeader
        catKey="coffee"
        icon={CoffeeIcon}
        title="Coffee Finder"
        count={(!lat||!lng||loading||error)?null:stats.total}   /* stale-count rule: never show the previous location's number mid-refetch */
        onBack={()=>fromPlacesToEat ? navigate(-1) : navigate(createPageUrl("Home"))}
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh coffee shops"
        onChangeLocation={()=>setShowLocPicker(true)}
        locationLabel={locationText}
        isCity={isCity}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
      >
        {/* Substats — the specialty/open/parking counts as one honest mono line */}
        {!loading&&!error&&(stats.specialty>0||stats.open>0||stats.withParking>0)&&(
          <div className="font-mono uppercase font-semibold" style={{fontSize:"calc(10.5px*var(--fs))",letterSpacing:"0.12em",color:"#736657",marginBottom:"8px"}}>
            {[
              stats.specialty>0&&`${stats.specialty} specialty`,
              stats.open>0&&`${stats.open} open`,
              stats.withParking>0&&`${stats.withParking} parking`,
            ].filter(Boolean).join(" · ")}
          </div>
        )}

        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"10px"}}><DistanceUnitToggle unit={unit} setUnit={setUnit} variant="light" /></div>

        {/* Café / drink search */}
        <form onSubmit={(e)=>{e.preventDefault();runSearch();}} style={{display:"flex",gap:"8px",margin:"8px 0 2px"}}>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search a café or a drink — latte, matcha, cold brew…" autoCapitalize="none" style={{flex:1,minWidth:0,padding:"11px 14px",borderRadius:"12px",border:"1.5px solid #E2E8F0",fontSize:"calc(14px*var(--fs))",fontFamily:"inherit",color:DARK,background:"#fff"}}/>
          <button type="submit" disabled={!q.trim()||searchBusy} style={{padding:"11px 16px",borderRadius:"12px",border:"none",background:BROWN,color:"#fff",fontWeight:"700",fontSize:"calc(13px*var(--fs))",fontFamily:"inherit",cursor:"pointer",opacity:(!q.trim()||searchBusy)?0.6:1}}>{searchBusy?"…":"Search"}</button>
          {submitted&&<button type="button" onClick={clearSearch} style={{padding:"11px 12px",borderRadius:"12px",border:"1.5px solid #E2E8F0",background:"#fff",color:GRAY,fontWeight:"700",fontSize:"calc(13px*var(--fs))",fontFamily:"inherit",cursor:"pointer"}}>✕</button>}
        </form>

        {/* Quick filters — two inline toggles; everything else lives in the sheet */}
        <div style={{display:"flex",gap:"8px",overflowX:"auto",padding:"4px 0 8px",scrollbarWidth:"none",alignItems:"center"}}>
          <FilterPill label="Open Now" active={quickFilter==="open"} onClick={()=>setQuickFilter(f=>f==="open"?"all":"open")} disabled={!hoursKnown} title={!hoursKnown?`Open Now ${OPEN_NOW_HINT}`:undefined}/>
          <FilterPill label="Specialty" active={quickFilter==="specialty"} onClick={()=>setQuickFilter(f=>f==="specialty"?"all":"specialty")}/>
          <button onClick={()=>setFilterSheetOpen(true)} style={{display:"flex",alignItems:"center",gap:"5px",padding:"7px 14px",borderRadius:"20px",border:activeFilterCount>0?`2px solid ${BROWN}`:"1.5px solid #E2E8F0",background:activeFilterCount>0?`${BROWN}15`:"#fff",color:activeFilterCount>0?BROWN:GRAY,fontWeight:activeFilterCount>0?"700":"500",fontSize:"calc(13px*var(--fs))",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0}}>
            <SlidersHorizontal size={13} strokeWidth={2}/>
            Filters
            {activeFilterCount>0&&<span style={{background:BROWN,color:"#fff",borderRadius:"10px",padding:"1px 7px",fontSize:"calc(11px*var(--fs))",fontWeight:"700"}}>{activeFilterCount}</span>}
          </button>
        </div>
        {!hoursKnown&&listBase.length>0&&!loading&&<div style={{fontSize:"calc(11px*var(--fs))",color:GRAY,margin:"-4px 0 8px"}}>Open Now {OPEN_NOW_HINT}</div>}
      </FinderHeader>

      {(!lat||!lng)?(
        /* T1.4: no location yet (first run, nothing restored) — a clear ask plus
           the same picker the header "Change" opens, instead of a spinner or a
           misleading "No matches found". */
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:"calc(40px*var(--fs))",marginBottom:"12px"}}>📍</div>
          <div style={{fontWeight:"600",color:DARK,marginBottom:"8px"}}>Choose a location to search</div>
          <div style={{fontSize:"calc(13px*var(--fs))",color:GRAY,marginBottom:"14px"}}>Use where you are now, or pick a city to plan ahead.</div>
          <button onClick={()=>setShowLocPicker(true)} style={{padding:"11px 20px",borderRadius:"12px",border:"none",background:BROWN,color:"#fff",fontWeight:"700",fontSize:"calc(13px*var(--fs))",cursor:"pointer",fontFamily:"inherit"}}>Choose location</button>
        </div>
      ):loading?(
        <div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:"calc(40px*var(--fs))",marginBottom:"12px",animation:"pulse 1.5s infinite"}}>☕</div><div style={{color:GRAY,fontWeight:"600"}}>Finding coffee shops...</div></div>
      ):error?(
        <div style={{padding:"24px 16px 100px"}}>
          <FinderEmptyState catKey="coffee" icon={CoffeeIcon} title="Couldn't load coffee shops" reason={error} actionLabel="Try again" onAction={handleRefresh}/>
        </div>
      ):viewMode==="list"?(
        <div style={isTablet
          ? {maxWidth:1024,margin:"0 auto",padding:"0 24px 170px",display:"flex",flexDirection:"column",gap:"30px"}
          : {width:"100%",padding:"0 12px 100px",display:"flex",flexDirection:"column",gap:"16px"}}>
          {submitted&&<div style={{display:"flex",alignItems:"center",gap:"8px",margin:"-4px 0 2px"}}><span style={{fontSize:"calc(16px*var(--fs))"}}>☕</span><span style={{fontWeight:"800",fontSize:"calc(14px*var(--fs))",color:DARK}}>Caf&eacute;s matching &ldquo;{submitted}&rdquo;</span><span style={{fontSize:"calc(12px*var(--fs))",color:GRAY}}>({filtered.length})</span></div>}
          {filtered.length===0?(
            (searchBusy||workBusy)?(
              <div style={{textAlign:"center",padding:"40px 20px",background:"#fff",borderRadius:"12px"}}><div style={{fontSize:"calc(32px*var(--fs))",marginBottom:"10px",animation:"pulse 1.5s infinite"}}>☕</div><div style={{fontWeight:"600",color:GRAY}}>{workBusy?"Checking cafés for work-friendliness…":"Searching cafés…"}</div></div>
            ):(
            <FinderEmptyState
              catKey="coffee"
              icon={CoffeeIcon}
              title={submitted?`No cafés for "${submitted}"`:"No cafés match"}
              reason={submitted?"Try a different drink or café name, or search another spot":activeFilterCount>0?"Nothing within 25 miles matches these filters":"Nothing found within 25 miles of this location"}
              actionLabel="Search somewhere else"
              onAction={()=>setShowLocPicker(true)}
              secondaryLabel={activeFilterCount>0?"Clear filters":submitted?"Clear search":undefined}
              onSecondary={activeFilterCount>0?clearFilters:submitted?clearSearch:undefined}
            />
            )
          ):filtered.map((shop,i)=>{
            const Card = CoffeeCardTablet;
            return (
            <div key={shop.id||i} ref={el=>cardRefs.current[i]=el}><Card shop={shop} index={i} onShowOnMap={handleShowOnMap} userLat={lat} userLng={lng} formatDistance={formatDistance} isTablet={isTablet} isLocal={isLocal} onHours={handleCardHours} batchEnrich={ownedEnrich[shop.id||shop.placeId]}/></div>
          );})}
        </div>
      ):(
        <div style={{position:"relative"}}>
          <div ref={mapRef} style={{height:"calc(100vh - 260px)",width:"100%"}}/>
          <button onClick={()=>setViewMode("list")} style={{position:"fixed",top:"calc(50px + env(safe-area-inset-top) + 10px)",right:"14px",zIndex:1200,background:"#fff",borderRadius:"50%",width:"40px",height:"40px",border:"none",boxShadow:"0 2px 8px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"calc(20px*var(--fs))",color:DARK}}>✕</button>
        </div>
      )}

      {/* FILTER SHEET — WiFi / shop type / good-for-working moved off the inline band */}
      <FilterSheet open={filterSheetOpen} onClose={()=>setFilterSheetOpen(false)} title="Coffee filters" onClear={activeFilterCount>0?clearFilters:undefined}>
        <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
          <div>
            <div style={{fontSize:"calc(11px*var(--fs))",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>Status</div>
            <ToggleChip label="Open Now" active={filterOpenNow} onClick={()=>setFilterOpenNow(!filterOpenNow)} disabled={!hoursKnown} title={!hoursKnown?`Open Now ${OPEN_NOW_HINT}`:undefined}/>
          </div>
          <div>
            <div style={{fontSize:"calc(11px*var(--fs))",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>Shop Type</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              {[{v:"all",l:"All"},{v:"specialty",l:"Specialty Only"},{v:"chain",l:"Chains Only"}].map(({v,l})=><ToggleChip key={v} label={l} active={filterShopType===v} onClick={()=>setFilterShopType(v)}/>)}
            </div>
          </div>
          <div>
            <div style={{fontSize:"calc(11px*var(--fs))",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>WiFi</div>
            <ToggleChip label="Has WiFi" active={filterWifi} onClick={()=>setFilterWifi(!filterWifi)}/>
          </div>
          <div>
            <div style={{fontSize:"calc(11px*var(--fs))",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>Good for working</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              <ToggleChip label="Good for work" active={filterWork} onClick={()=>setFilterWork(!filterWork)}/>
              <ToggleChip label="Outlets" active={filterOutlets} onClick={()=>setFilterOutlets(!filterOutlets)}/>
              <ToggleChip label="Quiet" active={filterQuiet} onClick={()=>setFilterQuiet(!filterQuiet)}/>
              <ToggleChip label="A/C" active={filterAC} onClick={()=>setFilterAC(!filterAC)}/>
            </div>
            <div style={{fontSize:"calc(10.5px*var(--fs))",color:GRAY,marginTop:"6px",lineHeight:1.4}}>Estimated from customer reviews{workBusy?" · checking cafés…":""} — call ahead to confirm.</div>
          </div>
          {/* Trust legend — glosses the ✅/⚠️ badges the cards themselves render */}
          <div style={{padding:"10px 12px",background:"#fff",borderRadius:"8px",border:"1px solid #E8EDF2"}}>
            <div style={{fontSize:"calc(11px*var(--fs))",fontWeight:"700",color:GRAY,marginBottom:"6px"}}>DATA TRUST GUIDE</div>
            <div style={{fontSize:"calc(11px*var(--fs))",color:DARK,lineHeight:"1.7"}}>
              <div>✅ <strong>Google confirmed</strong> — from Google Places API (reliable)</div>
              <div>⚠️ <strong>Mentioned in reviews</strong> — customer-reported, may have changed</div>
              <div style={{marginTop:"4px",color:GRAY}}>For critical needs (accessibility, event-day parking), always call ahead.</div>
            </div>
          </div>
        </div>
      </FilterSheet>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}::-webkit-scrollbar{display:none}.gs-popup .leaflet-popup-content-wrapper{border-radius:12px;padding:0;overflow:hidden}.gs-popup .leaflet-popup-content{margin:0}`}</style>
      <LocationModePicker isOpen={showLocPicker} onClose={()=>setShowLocPicker(false)}/>
      <MapAppSelector
        isOpen={!!directionsShop}
        onClose={()=>setDirectionsShop(null)}
        destination={{
          name: directionsShop?.displayName?.text||directionsShop?.name||"Coffee Shop",
          address: directionsShop?.formattedAddress||directionsShop?.shortFormattedAddress||directionsShop?.vicinity||directionsShop?.address||"",
          latitude: directionsShop?.lat,
          longitude: directionsShop?.lng,
        }}
        userLat={lat}
        userLng={lng}
      />
    </div>
  );
}