import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLocation } from "@/components/location/LocationContext";
import LocationModePicker from "@/components/location/LocationModePicker";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { logEvent } from "@/lib/analytics";
import { logSearch, logZeroResults } from "@/lib/logSearch";
import { matchesQuery } from "@/lib/searchText";
import AIDetailsSection from "@/components/AIDetailsSection";
import TravelerDishes from "@/components/finder/TravelerDishes";
import { HereStamp } from "@/components/attraction/AttractionExtras";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import { Coffee as CoffeeIcon, SlidersHorizontal, Sparkles, Clock, Laptop, MapPin, ExternalLink, X } from "lucide-react";
import { WORLD, fs } from "@/components/redesign/constants";
import MapAppSelector from "@/components/MapAppSelector";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import CafeWorkProfileSection from "@/components/CafeWorkProfileSection";
import { useIsTablet } from "@/lib/useIsTablet";
import FinderHeader from "@/components/finder/FinderHeader";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import FilterSheet, { FilterGroupLabel } from "@/components/finder/FilterSheet";
import { WorldSearch, WorldChip, ChipRow, ResultLine, WorldNote } from "@/components/finder/FinderControls";
import { WorldCard, worldGrid, NumberMark, FactsLine, RatingFact, CardKicker, CardName, QuietRows, ActionRow, WorldSkeleton } from "@/components/finder/FinderCard";
import PhotoOrIcon from "@/components/finder/PhotoOrIcon";
import { pinInstitutions, keepCountry, nearFirst as nearFirstList } from "@/lib/searchRank";
import { planFinderSearch, moveToPlace, finderRecents, saveFinderRecent } from "@/lib/finderSearch";
import { placePhrase } from "@/lib/placeContext";

// The Coffee world (espresso plate, ember accents, copper icons): every colour on the
// page comes from it.
const COF = WORLD.coffee;
// T1.8: Open now waits until at least one café in view has known hours (owned rows
// ship none; cards lift Google hours in as they load).
const OPEN_NOW_HINT = "Open now works once café hours load";

// ─── DRINK PATTERNS ────────────────────────────────────────────────────────
// word: what the cup sleeve prints. Brewed never claims a method ("POUR-OVER").
const DRINK_PATTERNS = {
  espresso:  { namePatterns:['espresso','espresso bar','coffee bar','café','caffe'],  reviewKeywords:['espresso','latte','cappuccino','macchiato','cortado','flat white','americano','ristretto','doppio','crema'], word:'ESPRESSO' },
  brewed:    { namePatterns:['coffee house','coffee shop','roaster','roastery'],      reviewKeywords:['drip coffee','brewed coffee','pour over','pour-over','chemex','v60','aeropress','french press','filter coffee','single origin'], word:'BREWED' },
  iced:      { namePatterns:['iced','cold'],                                          reviewKeywords:['iced coffee','iced latte','cold coffee','iced americano','iced mocha','frappe','frappuccino','shaken espresso'], word:'ICED' },
  coldBrew:  { namePatterns:['cold brew'],                                            reviewKeywords:['cold brew','nitro','nitro cold brew','nitrogen','nitro coffee','cold brewed'], word:'COLD BREW' },
  matcha:    { namePatterns:['matcha','tea house','tea room'],                        reviewKeywords:['matcha','matcha latte','ceremonial matcha','matcha green tea','whisked matcha'], word:'MATCHA' },
  tea:       { namePatterns:['tea house','tea room','tea bar','boba','bubble tea'],   reviewKeywords:['loose leaf','chai','earl grey','boba','bubble tea','milk tea','thai tea','oolong'], word:'TEA' },
};

// A search that names a drink: which sleeve word to underline, and the word for the
// title ("Your next *latte*"). First match wins.
const DRINK_QUERY = [
  { re:/\b(cold\s*brew|nitro)\b/i, key:'coldBrew' },
  { re:/\bmatcha\b/i, key:'matcha' },
  { re:/\b(iced\s*\w+|frapp\w*)\b/i, key:'iced' },
  { re:/\b(latte|cappuccino|espresso|macchiato|cortado|flat\s*white|americano|mocha|ristretto|doppio)\b/i, key:'espresso' },
  { re:/\b(pour[\s-]?over|drip|filter\s*coffee|chemex|v60|aeropress|french\s*press)\b/i, key:'brewed' },
  { re:/\b(chai|boba|bubble\s*tea|milk\s*tea|oolong|earl\s*grey|tea)\b/i, key:'tea' },
];
function drinkOfQuery(query) {
  const q = String(query || '');
  for (const d of DRINK_QUERY) { const m = q.match(d.re); if (m) return { key: d.key, word: m[0].toLowerCase() }; }
  return null;
}

// ─── AMENITY PATTERNS (review-detected only) ───────────────────────────────
// word: how the "Good for working" row names it. 'food' isn't a work thing.
const AMENITY_PATTERNS = {
  wifi:    { keywords:['wifi','wi-fi','internet','free wifi','wireless'],           word:'Wi-Fi'   },
  outlets: { keywords:['outlets','power outlets','plugs','charging','power strip'], word:'outlets' },
  quiet:   { keywords:['quiet','peaceful','calm','serene'],                         word:'quiet'   },
  food:    { keywords:['pastry','sandwich','breakfast','croissant','bagel','avocado toast'], word:'food' },
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
  // Nothing detected: assume a café serves espresso and brewed coffee, but only so a
  // search can match it. Assumed drinks never print on the sleeve.
  if(!detectedDrinks.espresso&&!detectedDrinks.brewed){detectedDrinks.espresso={confidence:'medium',assumed:true};detectedDrinks.brewed={confidence:'medium',assumed:true};}

  // Amenities (review-detected)
  const amenities = {};
  for (const [k,cfg] of Object.entries(AMENITY_PATTERNS)) {
    if(cfg.keywords.some(kw=>allText.includes(kw)))amenities[k]={...cfg,available:true,source:'reviews'};
  }

  // Parking — passed from Worker (source = 'api' or 'reviews')
  const parking = shop.parking || null;

  // Seating — passed from Worker (source = 'api' or 'reviews')
  const seating = shop.seating || null;
  const hasIndoorSeating  = seating?.hasIndoorSeating  ?? shop.hasIndoorSeating  ?? (shop.dineIn===true)         ?? null;
  const hasOutdoorSeating = seating?.hasOutdoorSeating ?? shop.hasOutdoorSeating ?? (shop.outdoorSeating===true) ?? null;
  const seatingSource     = seating?.source || (hasIndoorSeating!==null||hasOutdoorSeating!==null?'api':null);

  const chainFlag = isChainShop(name);
  // A chain is assumed to have Wi-Fi for the Has Wi-Fi filter only: inferred, never
  // "reported", so the card never cites it.
  if(chainFlag && !amenities.wifi) amenities.wifi={word:'Wi-Fi',available:true,inferred:true};
  const hasWifi = !!amenities.wifi?.available;

  const specialtyFlag = isSpecialtyByName(name) || (!chainFlag && (shop.rating||0) >= 4.5 && (shop.userRatingCount||0) >= 50);
  let tier = specialtyFlag ? 1 : chainFlag ? 3 : 2;

  // No badges: the card's kicker says SPECIALTY COFFEE or COFFEE CHAIN, and the
  // specialty pill sits on the photo. hasWifi feeds the "Has Wi-Fi" filter only.

  // Normalize photo entries to URL strings. Google search (normalizePlace) returns
  // photo OBJECTS {url,thumbnail,full}; owned/enrich returns strings. The <img> needs
  // a string src, so objects silently failed → blank ☕ placeholder on real results.
  const photos = (shop.photos||(shop.photoUrl?[shop.photoUrl]:[]))
    .map(p=>typeof p==="string"?p:(p?.url||p?.full||p?.thumbnail||null)).filter(Boolean);
  return { ...shop, lat, lng, name, distanceMiles, distance:distanceMiles?`${distanceMiles.toFixed(1)} mi`:null, isOpen:openStatus.isOpen, todayHours:openStatus.todayHours, is24Hours:openStatus.is24Hours, detectedDrinks, amenities, parking, seating, hasIndoorSeating, hasOutdoorSeating, seatingSource, hasWifi, isChain:chainFlag, isSpecialty:specialtyFlag, tier, photos, photoUrl:photos[0]||null };
}

// Directions handled by the shared <MapAppSelector> (address-aware destination +
// "from my location / other address" origin picker) — see src/components/MapAppSelector.jsx

// ─── THE CUP SLEEVE (Coffee.dc.html L86-90) ─────────────────────────────────
// A 34px wash band with the drinks reviews or the name really mention, in mono,
// split by ember dots. Assumed drinks never print; with none the sleeve is absent.
// The drink you searched for is inverted with an ember underline.
function DrinkSleeve({ drinks, searchedKey }) {
  const keys = Object.entries(drinks || {}).filter(([k, v]) => v && !v.assumed && DRINK_PATTERNS[k]).map(([k]) => k);
  if (!keys.length) return null;
  return (
    <p className="font-mono flex items-center justify-center flex-wrap"
      style={{margin:0,minHeight:34,padding:"6px 12px",boxSizing:"border-box",background:COF.wash,columnGap:10,rowGap:4,fontSize:fs(10.5),lineHeight:1.2,fontWeight:500,letterSpacing:".14em",color:COF.washInk}}>
      <span className="sr-only">Drinks: </span>
      {keys.map((k, i) => (
        <React.Fragment key={k}>
          {i > 0 && <span aria-hidden="true" style={{width:4,height:4,borderRadius:999,background:COF.star,flex:"none"}}/>}
          {k === searchedKey
            ? <span style={{padding:"2px 6px",background:COF.ink,color:COF.plateTitle,borderBottom:`2px solid ${COF.star}`}}>{DRINK_PATTERNS[k].word}</span>
            : <span>{DRINK_PATTERNS[k].word}</span>}
        </React.Fragment>
      ))}
    </p>
  );
}

// One hairline row in the card's More panel: a mono label, then plain words.
function MoreRow({ label, children }) {
  return (
    <div style={{padding:"12px 0",borderTop:`1px solid ${COF.line}`}}>
      <div className="font-mono uppercase" style={{fontSize:fs(10.5),letterSpacing:".12em",color:COF.iconInk,marginBottom:4}}>{label}</div>
      <div style={{fontSize:fs(13.5),lineHeight:1.5,color:"#3A3128"}}>{children}</div>
    </div>
  );
}

// ─── COFFEE CARD (Coffee.dc.html L76-114) ───────────────────────────────────
// The photo (or the espresso strip with the cup ring and the café's initial) with
// the ring numeral and the SPECIALTY pill, the cup sleeve, the copper kicker, the
// name, one facts line, the address, "Good for working", the quiet rows, the rubber
// stamp when you're here and one action row with the ember Directions.
function CoffeeCard({ shop, index, onShowOnMap, userLat, userLng, formatDistance, isLocal, onHours, batchEnrich, searchedKey, cardRef }) {
  const [expanded,setExpanded]=useState(false);
  const [showDir,setShowDir]=useState(false);
  const [galleryOpen,setGalleryOpen]=useState(false);
  const [galleryStart,setGalleryStart]=useState(0);
  const [enriched,setEnriched]=useState(null);
  const moreId=useId();
  // 3 real Google photos + hours for OWNED shops (owned records carry none).
  // T1.15: the parent batch-enriches all visible owned cafés in ONE worker call and
  // hands this card its slice via `batchEnrich` (undefined = batch in flight — wait,
  // don't double-call). A card the batch missed (null) falls back to its own single
  // call; same per-item KV cache.
  useEffect(()=>{
    if(enriched||shop.source!=='owned')return;
    const key=shop.id||shop.placeId;
    if(key&&batchEnrich===undefined)return; // parent batch pending — its result arrives via prop
    if(batchEnrich){
      if(batchEnrich.matched){
        setEnriched(batchEnrich);
        // T1.8: lift the Google hours to the list so Open now / "N open" can see them.
        if(batchEnrich.hours?.weekdayDescriptions?.length) onHours?.(key, batchEnrich);
      }
      return;
    }
    callWorker('places/enrich-owned',{id:key,name:shop.displayName?.text||shop.name,lat:shop.lat,lng:shop.lng,maxPhotos:3})
      .then(({data})=>{
        if(!data||!data.matched) return;
        setEnriched(data);
        if(data.hours?.weekdayDescriptions?.length) onHours?.(key, data);
      }).catch(()=>{});
  },[batchEnrich]); // eslint-disable-line react-hooks/exhaustive-deps

  const name    = shop.displayName?.text || shop.name || "Coffee Shop";
  const placeId = shop.placeId || shop.id;
  const address = shop.shortFormattedAddress || shop.formattedAddress || "";
  const photos  = (enriched?.photos?.length ? enriched.photos : (shop.photos||(shop.photoUrl?[shop.photoUrl]:[])))
    .map(p=>typeof p==="string"?p:(p?.url||p?.full||p?.thumbnail||null)).filter(Boolean);
  const weekdays = enriched?.hours?.weekdayDescriptions?.length ? enriched.hours.weekdayDescriptions : (shop.currentOpeningHours?.weekdayDescriptions||[]);
  // T1.5: open words come from the hours in the place's own zone, never from a
  // cached openNow; a navigated city with no zone gets "Hours not listed".
  const tzOff = shop.utcOffsetMinutes ?? enriched?.utcOffsetMinutes ?? null;
  const openPlace = weekdays.length ? { ...shop, currentOpeningHours:{ weekdayDescriptions:weekdays }, utcOffsetMinutes:tzOff } : { ...shop, utcOffsetMinutes:tzOff };
  const todayIdx = placeDayIndex(tzOff, isLocal); // "today" in the weekly hours, in the place's zone
  const phone   = shop.nationalPhoneNumber || shop.internationalPhoneNumber || enriched?.nationalPhoneNumber || "";
  const parking = shop.parking;
  const rating  = enriched?.rating ?? shop.rating;
  const ratingCount = enriched?.userRatingCount ?? shop.userRatingCount;
  const kicker = shop.isSpecialty ? 'Specialty coffee'
    : shop.isChain ? 'Coffee chain'
    : (shop.primaryType ? shop.primaryType.replace(/_/g,' ') : 'Café');
  // "Good for working" only from what reviews say (never a chain's assumed Wi-Fi).
  const reported = ['wifi','outlets','quiet'].filter(k=>shop.amenities?.[k]?.available && shop.amenities[k].source==='reviews').map(k=>AMENITY_PATTERNS[k].word);
  const seatingWords = [shop.hasIndoorSeating&&'Indoor', shop.hasOutdoorSeating&&'Outdoor', shop.seating?.hasLoungeSeating&&'Lounge', shop.seating?.hasBarSeating&&'Bar seats', shop.seating?.capacityNote].filter(Boolean);
  const trust = (confirmed) => confirmed ? 'confirmed by Google' : 'mentioned in reviews';
  const otherMentions = Object.entries(shop.amenities||{}).filter(([k,a])=>a.available&&a.source==='reviews'&&k!=='wifi').map(([k])=>AMENITY_PATTERNS[k]?.word).filter(Boolean);
  const website = shop.websiteUri||shop.website;
  const hasMore = !!(seatingWords.length || parking || otherMentions.length || weekdays.length || website);
  const dist = shop.distanceMiles!=null ? formatDistance(shop.distanceMiles) : null;

  return (
    <WorldCard world="coffee" as="li" ref={cardRef}>
      <PhotoOrIcon world="coffee" photos={photos} alt={name} name={name}
        onClick={photos.length?(i)=>{setGalleryStart(typeof i==="number"?i:0);setGalleryOpen(true);}:undefined}>
        <NumberMark n={index+1} world="coffee"/>
        {shop.isSpecialty && (
          <span className="font-mono uppercase inline-flex items-center"
            style={{position:"absolute",right:12,top:12,gap:5,minHeight:24,boxSizing:"border-box",padding:"0 9px",borderRadius:999,background:COF.ink,border:"1px solid rgba(243,223,193,.4)",fontSize:fs(10),fontWeight:500,letterSpacing:".14em",lineHeight:1,color:COF.plateTitle}}>
            <Sparkles size={11} strokeWidth={2} aria-hidden="true"/>Specialty
          </span>
        )}
      </PhotoOrIcon>
      <DrinkSleeve drinks={shop.detectedDrinks} searchedKey={searchedKey}/>
      <div style={{padding:"12px 16px 16px"}}>
        <CardKicker world="coffee">{kicker}</CardKicker>
        <CardName world="coffee">{name}</CardName>
        <div style={{marginTop:2}}><NameLanguageHelp placeId={placeId} name={name} world="coffee"/></div>
        <FactsLine world="coffee" place={openPlace} isLocal={isLocal}
          items={[dist, <RatingFact key="r" world="coffee" rating={rating} count={ratingCount} source="google"/>, shop.priceLevel?'$'.repeat(shop.priceLevel):null]}
          style={{marginTop:4}}/>
        {address && <p style={{margin:0,fontSize:fs(13),lineHeight:1.4,color:"#736657"}}>{address}</p>}
        <div style={{marginTop:6}}>
          <CafeWorkProfileSection placeId={placeId} placeName={name} lat={shop.lat} lng={shop.lng} world="coffee" reported={reported}/>
        </div>
        <QuietRows world="coffee" style={{marginTop:4}}>
          <AIDetailsSection world="coffee" placeId={placeId} placeName={name} lat={shop.lat} lng={shop.lng} page="CoffeeFinder" kind="coffee"/>
          <TravelerDishes world="coffee" variant="row" place={{id:placeId,name,lat:shop.lat,lng:shop.lng}} kind="coffee"/>
        </QuietRows>
        <HereStamp place={{ id: placeId, name, lat: shop.lat, lng: shop.lng, types: shop.types, formattedAddress: shop.formattedAddress || shop.address }} formatDistance={formatDistance}/>
        <ActionRow world="coffee" name={name} onDirections={()=>setShowDir(true)} onMap={()=>onShowOnMap?.(index)} phone={phone}
          onMore={hasMore?()=>setExpanded(e=>!e):undefined} moreExpanded={hasMore?expanded:undefined} moreControls={hasMore?moreId:undefined}
          style={{marginTop:4}}/>
        {hasMore && expanded && (
          <div id={moreId} style={{marginTop:12}}>
            {seatingWords.length>0 && <MoreRow label="Seating">{seatingWords.join(' · ')} <span style={{color:"#736657"}}>({trust(shop.seatingSource==='api')})</span></MoreRow>}
            {parking && (
              <MoreRow label="Parking">
                {parking.noParking ? parking.noParkingNote : <>{(parking.details?.length ? parking.details.map(d=>`${d.label}${d.free===true?' (free)':d.free===false&&!d.cost?' (paid)':''}`) : ['Parking available nearby']).join(' · ')}{parking.valetCost?` · Valet ${parking.valetCost}`:''} <span style={{color:"#736657"}}>({trust(parking.source==='api')})</span></>}
              </MoreRow>
            )}
            {otherMentions.length>0 && <MoreRow label="Reviews mention">{otherMentions.join(', ')} <span style={{color:"#736657"}}>(call ahead to confirm)</span></MoreRow>}
            {weekdays.length>0 && (
              <MoreRow label="Hours">
                {weekdays.map((day,i)=>{
                  const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                  const isToday=todayIdx>=0&&DAY.findIndex(d=>day.startsWith(d))===todayIdx;
                  return (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"2px 0",fontWeight:isToday?700:400,color:isToday?COF.accentText:"#3A3128"}}>
                      <span>{day.split(':')[0]}</span><span style={{textAlign:"right"}}>{day.split(':').slice(1).join(':').trim()}</span>
                    </div>
                  );
                })}
              </MoreRow>
            )}
            {website && (
              <MoreRow label="Website">
                <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center"
                  style={{gap:6,minHeight:44,margin:"-12px 0",color:COF.accentText,fontWeight:600,textDecoration:"underline",textUnderlineOffset:2}}>
                  Menu and info<ExternalLink size={14} strokeWidth={2} aria-hidden="true"/>
                </a>
              </MoreRow>
            )}
          </div>
        )}
      </div>
      <MapAppSelector isOpen={showDir} onClose={()=>setShowDir(false)} destination={{name, address, latitude:shop.lat, longitude:shop.lng}} userLat={userLat} userLng={userLng}/>
      {galleryOpen&&<PhotoGalleryModal photos={photos} initialIndex={galleryStart} isOpen onClose={()=>setGalleryOpen(false)}/>}
    </WorldCard>
  );
}

// ─── MAP POPUP ─────────────────────────────────────────────────────────────
// Words only (no emoji), the café's text escaped; the window.* bridges stay.
function buildMapPopup(shop, index) {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const name    = esc(shop.displayName?.text || shop.name || "Coffee Shop");
  const address = esc(shop.formattedAddress  || shop.shortFormattedAddress || "");
  const phone   = shop.nationalPhoneNumber || shop.internationalPhoneNumber || null;
  const { isOpen, todayHours, is24Hours } = shop;
  const openWord = is24Hours ? 'Open 24 hours' : isOpen===true ? 'Open' : isOpen===false ? 'Closed' : 'Hours not listed';
  const openInk  = is24Hours||isOpen===true ? '#2E6B4E' : isOpen===false ? '#B0472F' : '#736657';
  return `
    <div style="font-family:'Inter Tight',-apple-system,sans-serif;width:260px;position:relative;color:#16110D;">
      <div style="padding:12px;padding-top:14px;">
        <div onclick="window.viewPlaceDetails&&window.viewPlaceDetails(${index})" style="font-family:'Instrument Serif',Georgia,serif;font-size:calc(18px*var(--fs));line-height:1.15;margin-bottom:4px;cursor:pointer;text-decoration:underline;text-decoration-color:${COF.line};text-underline-offset:3px;padding-right:26px;">${name}</div>
        <div style="font-size:calc(11.5px*var(--fs));color:#736657;margin-bottom:6px;">${address}</div>
        <div style="font-size:calc(12px*var(--fs));margin-bottom:6px;">
          <span style="font-weight:600;color:${openInk};">${openWord}</span>${todayHours&&!is24Hours?`<span style="color:#736657;"> · ${esc(todayHours)}</span>`:''}
        </div>
        ${phone?`<a href="tel:${esc(phone)}" style="display:inline-flex;align-items:center;min-height:32px;margin-bottom:8px;color:${COF.accentText};font-size:calc(12px*var(--fs));font-weight:600;text-decoration:underline;text-underline-offset:2px;">Call ${esc(phone)}</a>`:''}
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button onclick="window.openDirectionsFromMap&&window.openDirectionsFromMap(${index})" style="flex:1;min-height:40px;border:none;border-radius:10px;background:${COF.cta};color:${COF.ctaInk};font-weight:700;font-size:calc(12px*var(--fs));cursor:pointer;">Directions</button>
          <button onclick="window.viewPlaceDetails&&window.viewPlaceDetails(${index})" style="flex:1;min-height:40px;border:1px solid ${COF.line};border-radius:10px;background:#fff;color:#3A3128;font-weight:600;font-size:calc(12px*var(--fs));cursor:pointer;">Details</button>
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
  const [filterSpecialty,setFilterSpecialty]   = useState(false);
  const [sortBy,setSortBy]             = useState("nearby");
  const [filterOpenNow,setFilterOpenNow]       = useState(false);
  const [filterShopType,setFilterShopType]     = useState("all");
  const [filterWifi,setFilterWifi]               = useState(false);
  // Café / drink search — name (e.g. "Blue Bottle") or a drink (latte, cold
  // brew, caramel macchiato). Owned-first (client filter over `shops`) merged
  // with a live Google café search (searchShops).
  const [q,setQ]                                 = useState("");
  const [planning,setPlanning]                   = useState(false);
  const [otherFinder,setOtherFinder]             = useState(null);   // { page, label, query }
  const [recents,setRecents]                     = useState(()=>finderRecents("coffee"));
  const [nearFirstC,setNearFirstC]               = useState(false);  // a named smaller place: nearby leads
  const [countryLock,setCountryLock]             = useState(null);   // a named place keeps its country
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

  const locationCtx = useLocation();
  const { activeLocation, locationMode } = locationCtx;
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

  const activeFilterCount = [filterOpenNow,filterSpecialty,filterShopType!=="all",filterWifi,filterWork,filterOutlets,filterQuiet,filterAC].filter(Boolean).length;   // inline chips count too — a chip-only empty list deserves the Clear-filters action
  // The Filters chip counts only what lives in the sheet.
  const sheetFilterCount = [filterShopType!=="all",filterWifi,filterOutlets,filterQuiet,filterAC].filter(Boolean).length;
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
  useEffect(()=>{ if(!hoursKnown && filterOpenNow) setFilterOpenNow(false); },[hoursKnown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Batch enrich results (declared before `filtered`, which drops cafés the
  // lookup reports closed for good).
  const [ownedEnrich,setOwnedEnrich]=useState({});
  const ownedEnrichAsked=useRef(new Set());
  const filtered = useMemo(()=>{
    // Searching: within-radius merged results, or the closest few beyond if
    // nothing is within radius (better than an empty screen). Else: browse.
    let base;
    if(submitted){
      const within=searchMerged; // no radius cap — show all, nearest-first
      base=within.length?within:searchMerged.slice(0,8);
    } else base=shopsWithHours;
    let r=[...base];
    // Open now and Specialty combine (AND).
    if(filterOpenNow&&hoursKnown) r=r.filter(s=>s.isOpen===true);
    if(filterSpecialty)  r=r.filter(s=>s.isSpecialty);
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
    // A named place (2026-10-25, from Home or this box): its own country only ("in Tijuana" is
    // Mexico), and for a smaller place the cafés within 5 miles lead.
    r=keepCountry(r,countryLock);
    if(nearFirstC) r=nearFirstList(r);
    if(submitted) r=pinInstitutions(r);
    r=r.filter(s=>!ownedEnrich[s.id||s.placeId]?.closed); // Google says it closed for good
    return r;
  },[ownedEnrich,shopsWithHours,searchMerged,submitted,radius,filterSpecialty,sortBy,filterOpenNow,hoursKnown,filterWifi,filterShopType,filterWork,filterOutlets,filterQuiet,filterAC,workProfiles,countryLock,nearFirstC]);

  // ── T1.15: BATCH ENRICH VISIBLE OWNED CAFÉS ──────────────────────────────
  // Was: every owned card fired its own /places/enrich-owned on mount (one call
  // per rendered card). Now all visible owned cafés go up in batched calls of 20
  // (the worker's batch cap). ownedEnrich[key]: undefined = batch pending,
  // payload = result, null = batch missed/errored → that card's own single-call
  // fallback runs (same KV cache server-side).
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

  const clearFilters=()=>{setFilterOpenNow(false);setFilterSpecialty(false);setFilterShopType("all");setFilterWifi(false);setFilterWork(false);setFilterOutlets(false);setFilterQuiet(false);setFilterAC(false);};

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
  const clearSearch=()=>{setQ("");setSubmitted("");setSearchShops([]);setOtherFinder(null);};
  // The box understands what Home's search does (2026-10-25): "best coffee in DTLA" moves the page
  // to Downtown LA and sorts by rating; "matcha near Shibuya" searches matcha there; "ATM" offers
  // ATMs. A search after a move waits for the page's new coordinates.
  const runSearchRef=useRef(null);
  runSearchRef.current=runSearch;
  const pendingRef=useRef(null);
  useEffect(()=>{
    const p=pendingRef.current;
    if(p==null||!Number.isFinite(lat)||!Number.isFinite(lng)) return;
    pendingRef.current=null;
    if(p) runSearchRef.current(p); else {setSubmitted("");setSearchShops([]);}
  },[lat,lng]);
  const runTypedSearch=async(raw)=>{
    const text=String(raw||"").trim();
    setOtherFinder(null);
    if(!text){clearSearch();return;}
    setPlanning(true);
    try{
      const plan=await planFinderSearch(text,{world:"coffee",activePhrase:placePhrase(activeLocation)||""});
      saveFinderRecent("coffee",text); setRecents(finderRecents("coffee"));
      if(plan.sort==="rating") setSortBy("rating");
      if(plan.other) setOtherFinder({...plan.other,query:plan.query});
      if(plan.place){
        pendingRef.current=plan.query;
        const {moved,country}=await moveToPlace(plan,locationCtx);
        if(moved){
          setNearFirstC(plan.nearFirst); setCountryLock(country);
          // The same spot again moves nothing: run it anyway once the page has settled.
          setTimeout(()=>{const p=pendingRef.current;if(p!=null){pendingRef.current=null;if(p) runSearchRef.current(p);}},1500);
          setPlanning(false); return;
        }
        pendingRef.current=null;
      }
      if(plan.query) await runSearch(plan.query); else {setSubmitted("");setSearchShops([]);}
    }catch{ await runSearch(text); }
    setPlanning(false);
  };

  // Smart-Search spine / cross-finder handoff: a query passed via router state
  // (navigate("CoffeeFinder",{state:{presetQuery}})) prefills the box and
  // auto-runs the café search once coords are ready. Mirrors PlacesToEat.
  const presetRanRef=useRef(false);
  useEffect(()=>{
    const pq=routerLocation.state?.presetQuery;
    if(presetRanRef.current||!pq||!String(pq).trim()) return;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
    presetRanRef.current=true;
    const st=routerLocation.state||{};
    if(st.presetSort==="rating") setSortBy("rating");
    if(st.presetNearFirst===true) setNearFirstC(true);
    if(st.presetCountry) setCountryLock(st.presetCountry);
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
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsCFUserPin&&window._gsCFUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:calc(10px*var(--fs));font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:calc(12px*var(--fs));margin-bottom:2px;padding-right:24px;">You are here</div><div style="font-weight:700;color:#4285F4;font-size:calc(11px*var(--fs));margin-bottom:2px;">${userMode}</div><div style="color:#64748B;font-size:calc(10px*var(--fs));line-height:1.3;">${userLabel}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsCFUserPin&&window._gsCFUserPin()"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">You are here</span><span style="color:#64748B;font-size:calc(10px*var(--fs));font-weight:700;">⌄</span></div>`;
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:'<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',iconSize:[16,16],className:""})}).addTo(map).bindTooltip(userTooltipHtml,{permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:true});
      filtered.forEach((s,i)=>{
        if(!s.lat||!s.lng)return;
        const isSelected = i === selectedMapIndex;
        const pinBg = COF.ink;
        const pinSize = isSelected ? 36 : 28;
        const pinBorder = isSelected ? "3px solid #fff" : "2px solid #fff";
        const pinShadow = isSelected ? `0 0 0 4px ${COF.star}, 0 3px 10px rgba(43,27,18,0.45)` : "0 2px 8px rgba(43,27,18,0.35)";
        const marker = window.L.marker([s.lat,s.lng],{icon:window.L.divIcon({html:`<div style="width:${pinSize}px;height:${pinSize}px;background:${pinBg};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Instrument Serif',Georgia,serif;font-size:${isSelected?16:14}px;box-shadow:${pinShadow};border:${pinBorder};">${i+1}</div>`,iconSize:[pinSize,pinSize],className:""})}).addTo(map).bindPopup(buildMapPopup(s,i),{maxWidth:270,autoPan:true,autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true,className:"gs-popup"});
        if(isSelected) setTimeout(()=>marker.openPopup(),300);
      });
    };
    if(!window.L){const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(link);const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.onload=init;document.head.appendChild(script);}else{init();}
    return()=>{delete window.mapInstance;delete window.viewPlaceDetails;delete window.openDirectionsFromMap;if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null;}};
  },[viewMode,filtered,lat,lng,selectedMapIndex,userPinExpanded,locationText,activeLocation?.mode]);

  // ── THE TITLE: the part of the day where the café is ────────────────────
  // 'Your morning|afternoon|evening cup' (5-11, 11-17, 17-5). The hour is the device
  // clock only in current-location mode; otherwise the place's own (the first
  // loaded row with Google's utcOffsetMinutes). No offset: 'Your next cup'. A search
  // that names a drink: 'Your next latte'. Re-read when the app comes back.
  const [clockTick,setClockTick]=useState(0);
  useEffect(()=>{
    const onVis=()=>{ if(document.visibilityState==='visible') setClockTick(t=>t+1); };
    document.addEventListener('visibilitychange',onVis);
    return()=>document.removeEventListener('visibilitychange',onVis);
  },[]);
  const searchedDrink = submitted ? drinkOfQuery(submitted) : null;
  const plateTitle = useMemo(()=>{
    if(searchedDrink) return { pre:'Your next ', italic:searchedDrink.word, post:'' };
    let hour=null;
    if(isLocal) hour=new Date().getHours();
    else {
      const off=[...searchShops,...shopsWithHours].map(x=>x?.utcOffsetMinutes).find(v=>Number.isFinite(v));
      if(Number.isFinite(off)) hour=new Date(Date.now()+off*60000).getUTCHours();
    }
    if(hour==null) return { pre:'Your next ', italic:'cup', post:'' };
    const part = hour>=5&&hour<11 ? 'morning' : hour>=11&&hour<17 ? 'afternoon' : 'evening';
    return { pre:'Your ', italic:part, post:' cup' };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[searchedDrink?.word,isLocal,searchShops,shopsWithHours,clockTick]);

  const stats={total:filtered.length,open:filtered.filter(s=>s.isOpen===true).length,specialty:filtered.filter(s=>s.tier===1).length,withParking:filtered.filter(s=>s.parking&&!s.parking.noParking).length};

  const showCount = !(!lat||!lng||loading||error);   /* stale-count rule: never show the previous location's number mid-refetch */
  const wide25 = formatDistance(25);
  return (
    <div className="font-sans" style={{background:COF.paper,minHeight:"100vh",paddingTop:12}}>
      {/* THE PLATE + CONTROLS (Coffee.dc.html L20-71): the espresso plate with the
          count and a title that follows the café's time of day; under it the café or
          drink search, one chip row and the result line. */}
      <FinderHeader
        world="coffee"
        count={showCount?stats.total:null}
        title={plateTitle}
        onBack={()=>fromPlacesToEat ? navigate(-1) : navigate(createPageUrl("Home"))}
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh coffee shops"
        location={{ label: locationText, onChange: ()=>setShowLocPicker(true) }}
        unit={{ value: unit, onChange: setUnit }}
        isCity={isCity}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
        hint={otherFinder ? (
          <WorldNote world="coffee" title={`Looking for ${otherFinder.label}?`} action={{ label: `Open ${otherFinder.label}`, onClick: () => navigate(createPageUrl(otherFinder.page), { state: ["PlacesToEat", "ThingsToDo"].includes(otherFinder.page) && otherFinder.query ? { presetQuery: otherFinder.query } : {} }) }} />
        ) : null}
      >
        <WorldSearch
          world="coffee"
          value={q}
          onChange={setQ}
          onSubmit={runTypedSearch}
          onClear={clearSearch}
          placeholder="Search a café or a drink…"
          label="Search a café or a drink, like latte, matcha or cold brew, here or in any city"
          busy={planning||searchBusy}
          recents={recents}
          onPickRecent={(t)=>{setQ(t);runTypedSearch(t);}}
          inputProps={{ autoCapitalize: "none" }}
        />
        <ChipRow label="Quick filters" style={{marginTop:10}}>
          <WorldChip world="coffee" icon={Clock} label="Open now" active={filterOpenNow} onClick={()=>setFilterOpenNow(v=>!v)} disabled={!hoursKnown} hint={!hoursKnown?OPEN_NOW_HINT:undefined}/>
          <WorldChip world="coffee" icon={Sparkles} label="Specialty" active={filterSpecialty} onClick={()=>setFilterSpecialty(v=>!v)}/>
          <WorldChip world="coffee" icon={Laptop} label="Good for work" active={filterWork} onClick={()=>setFilterWork(v=>!v)}/>
          <WorldChip world="coffee" icon={SlidersHorizontal} label="Filters" count={sheetFilterCount} opensSheet onClick={()=>setFilterSheetOpen(true)}/>
        </ChipRow>
        <ResultLine live items={showCount?[{count:stats.specialty,label:"specialty"},{count:stats.open,label:"open"}]:[]}/>
        {!hoursKnown&&listBase.length>0&&!loading&&<ResultLine>{OPEN_NOW_HINT}</ResultLine>}
      </FinderHeader>

      {(!lat||!lng)?(
        /* T1.4: no location yet (first run, nothing restored) — a clear ask plus
           the same picker the plate's "Change" opens, never a spinner. */
        <div className={`px-4 ${colWrap} mx-auto`} style={{paddingTop:16}}>
          <FinderEmptyState world="coffee" icon={MapPin} title="Choose a location to search" reason="Use where you are now, or pick a city to plan ahead." actionLabel="Choose location" onAction={()=>setShowLocPicker(true)}/>
        </div>
      ):loading?(
        <div style={isTablet?{maxWidth:1024,margin:"0 auto",padding:"16px 24px 0"}:{padding:"16px 16px 0"}}>
          <WorldSkeleton world="coffee" variant="card" count={isTablet?4:2} label="Finding coffee shops…"/>
        </div>
      ):error?(
        <div className={`px-4 ${colWrap} mx-auto`} style={{paddingTop:16}}>
          <FinderEmptyState world="coffee" icon={CoffeeIcon} title="Couldn't load coffee shops" reason={error} actionLabel="Try again" onAction={handleRefresh} secondaryLabel="Search somewhere else" onSecondary={()=>setShowLocPicker(true)}/>
        </div>
      ):viewMode==="list"?(
        <div style={isTablet
          ? {maxWidth:1024,margin:"0 auto",padding:"16px 24px 0",display:"flex",flexDirection:"column",gap:"16px"}
          : {width:"100%",padding:"16px 16px 0",display:"flex",flexDirection:"column",gap:"12px"}}>
          {submitted&&(
            <ResultLine>{`Cafés matching “${submitted}” · ${filtered.length}`}</ResultLine>
          )}
          {filtered.length===0?(
            (searchBusy||workBusy)?(
              <ResultLine live>{workBusy?"Checking cafés for work-friendliness…":"Searching cafés…"}</ResultLine>
            ):(
            <FinderEmptyState
              world="coffee"
              icon={CoffeeIcon}
              title={submitted?`No cafés for “${submitted}”`:"No cafés match"}
              reason={submitted?"Try a different drink or café name, or search another spot.":activeFilterCount>0?`Nothing within ${wide25} matches these filters.`:`Nothing found within ${wide25} of this location.`}
              actionLabel="Search somewhere else"
              onAction={()=>setShowLocPicker(true)}
              secondaryLabel={activeFilterCount>0?"Clear filters":submitted?"Clear search":undefined}
              onSecondary={activeFilterCount>0?clearFilters:submitted?clearSearch:undefined}
            />
            )
          ):(
            <ol aria-label="Coffee shops" style={worldGrid(isTablet)}>
              {filtered.map((shop,i)=>(
                <CoffeeCard key={shop.id||i} cardRef={el=>{cardRefs.current[i]=el;}} shop={shop} index={i} onShowOnMap={handleShowOnMap} userLat={lat} userLng={lng}
                  formatDistance={formatDistance} isLocal={isLocal} onHours={handleCardHours} batchEnrich={ownedEnrich[shop.id||shop.placeId]} searchedKey={searchedDrink?.key||null}/>
              ))}
            </ol>
          )}
        </div>
      ):(
        <div style={{position:"relative"}}>
          <div ref={mapRef} style={{height:"calc(100vh - 260px)",width:"100%"}}/>
          <button type="button" onClick={()=>setViewMode("list")} aria-label="Close the map" style={{position:"fixed",top:"calc(50px + env(safe-area-inset-top) + 10px)",right:"12px",zIndex:1200,background:"#fff",borderRadius:"50%",width:44,height:44,border:`1px solid ${COF.line}`,boxShadow:"0 2px 8px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:COF.ink}}><X size={20} strokeWidth={2} aria-hidden="true"/></button>
        </div>
      )}

      {/* FILTER SHEET — shop type, Wi-Fi and the work details. Open now, Specialty
          and Good for work live in the chip row. */}
      <FilterSheet world="coffee" open={filterSheetOpen} onClose={()=>setFilterSheetOpen(false)} title="Coffee filters" onClear={sheetFilterCount>0?()=>{setFilterShopType("all");setFilterWifi(false);setFilterOutlets(false);setFilterQuiet(false);setFilterAC(false);}:undefined}>
        <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
          <div>
            <FilterGroupLabel>Shop type</FilterGroupLabel>
            <ChipRow wrap>
              {[{v:"all",l:"All"},{v:"specialty",l:"Specialty only"},{v:"chain",l:"Chains only"}].map(({v,l})=><WorldChip key={v} world="coffee" label={l} active={filterShopType===v} clearable={false} onClick={()=>setFilterShopType(v)}/>)}
            </ChipRow>
          </div>
          <div>
            <FilterGroupLabel>Wi-Fi</FilterGroupLabel>
            <ChipRow wrap>
              <WorldChip world="coffee" label="Has Wi-Fi" active={filterWifi} onClick={()=>setFilterWifi(!filterWifi)}/>
            </ChipRow>
          </div>
          <div>
            <FilterGroupLabel>Working</FilterGroupLabel>
            <ChipRow wrap>
              <WorldChip world="coffee" label="Outlets" active={filterOutlets} onClick={()=>setFilterOutlets(!filterOutlets)}/>
              <WorldChip world="coffee" label="Quiet" active={filterQuiet} onClick={()=>setFilterQuiet(!filterQuiet)}/>
              <WorldChip world="coffee" label="Air conditioning" active={filterAC} onClick={()=>setFilterAC(!filterAC)}/>
            </ChipRow>
            <div style={{fontSize:fs(12),color:"#736657",marginTop:6,lineHeight:1.4}}>Estimated from customer reviews{workBusy?" · checking cafés…":""}. Call ahead to confirm.</div>
          </div>
          {/* The trust words the cards' More panel uses, glossed in plain words. */}
          <div style={{padding:"12px 14px",background:COF.wash,borderRadius:12}}>
            <div className="font-mono uppercase" style={{fontSize:fs(10.5),letterSpacing:".12em",color:COF.washInk,marginBottom:4}}>How sure we are</div>
            <div style={{fontSize:fs(13),lineHeight:1.5,color:COF.washInk}}>
              <div><strong>Confirmed by Google</strong>: from the café&rsquo;s Google listing.</div>
              <div><strong>Mentioned in reviews</strong>: what customers report, which may have changed.</div>
              <div style={{marginTop:4}}>For anything critical, like accessibility or event-day parking, call ahead.</div>
            </div>
          </div>
        </div>
      </FilterSheet>
      <style>{`::-webkit-scrollbar{display:none}.gs-popup .leaflet-popup-content-wrapper{border-radius:12px;padding:0;overflow:hidden}.gs-popup .leaflet-popup-content{margin:0}`}</style>
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