import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import LocationModePicker from "@/components/location/LocationModePicker";
import { base44 } from "@/api/base44Client";

// ─── COLORS ────────────────────────────────────────────────────────────────
const BROWN      = "#6F4E37";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT= "#F5F0EB";
const CREAM      = "#FFF8F0";
const GOLD       = "#D4A574";
const CORAL      = "#FF6B6B";
const GRAY       = "#64748B";
const DARK       = "#1A2332";
const TEAL       = "#00BCD4";
const GREEN      = "#4CAF50";

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
function computeOpenStatus(place) {
  const hours = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || place.hours || [];
  if (!hours.length) return { isOpen:null, todayHours:null, is24Hours:false };
  const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const entry = hours.find(h => h?.startsWith(DAY[new Date().getDay()]));
  if (!entry) return { isOpen:null, todayHours:null, is24Hours:false };
  const hoursText = entry.substring(entry.indexOf(':')+1).trim();
  if (hoursText.toLowerCase()==='closed') return { isOpen:false, todayHours:'Closed today', is24Hours:false };
  if (hoursText.toLowerCase().includes('24 hours')) return { isOpen:true, todayHours:'Open 24 hours', is24Hours:true };
  const cur = new Date().getHours()*60 + new Date().getMinutes();
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
function processShop(shop, userLat, userLng) {
  const lat = shop.location?.latitude || shop.latitude || shop.lat || 0;
  const lng = shop.location?.longitude || shop.longitude || shop.lng || 0;
  const name = shop.displayName?.text || shop.name || '';
  const openStatus = computeOpenStatus(shop);

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

  let workScore=0;
  if(amenities.wifi?.available)    workScore+=3;
  if(amenities.outlets?.available) workScore+=2;
  if(amenities.quiet?.available)   workScore+=2;
  if(hasOutdoorSeating)            workScore+=1;

  const chainFlag = isChainShop(name);
  const specialtyFlag = isSpecialtyByName(name) || (!chainFlag && (shop.rating||0) >= 4.5 && (shop.userRatingCount||0) >= 50);
  let tier = specialtyFlag ? 1 : chainFlag ? 3 : 2;

  const badges=[];
  if(specialtyFlag)   badges.push({icon:'✨',label:'Specialty',    color:'#E65100',bg:'#FFF3E0'});
  if(!chainFlag)      badges.push({icon:'🏘️',label:'Independent',  color:'#5E35B1',bg:'#EDE7F6'});
  if(chainFlag)       badges.push({icon:'🏪',label:'Chain',        color:'#78909C',bg:'#ECEFF1'});
  if(detectedDrinks.matcha)   badges.push({icon:'🍵',label:'Matcha',   color:'#2E7D32',bg:'#E8F5E9'});
  if(detectedDrinks.coldBrew) badges.push({icon:'🥤',label:'Cold Brew',color:'#1565C0',bg:'#E3F2FD'});
  if(workScore>=4)    badges.push({icon:'💼',label:'Work-Friendly',color:'#1565C0',bg:'#E3F2FD'});

  const photos = shop.photos||(shop.photoUrl?[shop.photoUrl]:[]);
  return { ...shop, lat, lng, name, distanceMiles, distance:distanceMiles?`${distanceMiles.toFixed(1)} mi`:null, isOpen:openStatus.isOpen, todayHours:openStatus.todayHours, is24Hours:openStatus.is24Hours, detectedDrinks, amenities, parking, seating, hasIndoorSeating, hasOutdoorSeating, seatingSource, workScore, isChain:chainFlag, isSpecialty:specialtyFlag, tier, badges:badges.slice(0,5), photos, photoUrl:photos[0]||null };
}

// ─── DIRECTIONS PICKER ─────────────────────────────────────────────────────
function DirectionsPicker({ isOpen, onClose, lat, lng, name }) {
  if (!isOpen) return null;
  const go = app => { const urls={google:`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,apple:`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,waze:`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}; window.open(urls[app],'_blank'); onClose(); };
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"20px",padding:"20px",width:"100%",maxWidth:"320px"}}>
        <div style={{textAlign:"center",marginBottom:"16px"}}><div style={{fontSize:"13px",color:GRAY}}>Get directions to</div><div style={{fontSize:"16px",fontWeight:"700",color:DARK}}>{name}</div></div>
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {[{key:'google',icon:'🗺️',name:'Google Maps'},{key:'apple',icon:'🍎',name:'Apple Maps'},{key:'waze',icon:'📍',name:'Waze'}].map(app=>(
            <button key={app.key} onClick={()=>go(app.key)} style={{display:"flex",alignItems:"center",gap:"12px",padding:"14px 16px",borderRadius:"12px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
              <span style={{fontSize:"24px"}}>{app.icon}</span><span style={{fontWeight:"600",color:DARK}}>{app.name}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{marginTop:"16px",width:"100%",padding:"12px",borderRadius:"10px",border:"none",background:"#F1F5F9",color:GRAY,fontWeight:"600",cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </motion.div>
    </div>
  );
}

// ─── PHOTO CAROUSEL ────────────────────────────────────────────────────────
function PhotoCarousel({ photos=[], height="180px" }) {
  const [cur,setCur]=useState(0); const [errs,setErrs]=useState({}); const ref=useRef(null);
  const valid=photos.filter((_,i)=>!errs[i]);
  if(!valid.length)return <div style={{height:"120px",background:`linear-gradient(135deg,${CREAM},${BROWN_LIGHT},${GOLD}40)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"48px"}}>☕</div>;
  return (
    <div style={{position:"relative",overflow:"hidden"}}>
      <div ref={ref} onScroll={()=>ref.current&&setCur(Math.round(ref.current.scrollLeft/ref.current.offsetWidth))} style={{display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",scrollbarWidth:"none",height}}>
        {valid.map((p,i)=><img key={i} src={p} onError={()=>setErrs(e=>({...e,[photos.indexOf(p)]:true}))} style={{minWidth:"100%",height,objectFit:"cover",scrollSnapAlign:"start",flexShrink:0}} alt=""/>)}
      </div>
      {valid.length>1&&<div style={{position:"absolute",bottom:"10px",right:"10px",background:"rgba(0,0,0,0.6)",color:"#fff",padding:"4px 10px",borderRadius:"20px",fontSize:"12px",fontWeight:"600"}}>{cur+1}/{valid.length}</div>}
    </div>
  );
}

// ─── COFFEE CARD ───────────────────────────────────────────────────────────
function CoffeeCard({ shop, index, onShowOnMap }) {
  const [expanded,setExpanded]=useState(false);
  const [showDir,setShowDir]=useState(false);
  const name    = shop.displayName?.text || shop.name || "Coffee Shop";
  const address = shop.shortFormattedAddress || shop.formattedAddress || "";
  const photos  = shop.photos||(shop.photoUrl?[shop.photoUrl]:[]);
  const parking = shop.parking;
  const parkingConfirmed = parking?.source==='api';
  const hasAnySeating = shop.hasIndoorSeating||shop.hasOutdoorSeating||shop.seating?.hasLoungeSeating||shop.seating?.hasBarSeating;
  const seatingConfirmed = shop.seatingSource==='api';

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:index*0.04}} style={{background:"#fff",borderRadius:"16px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",overflow:"hidden",border:"1px solid #E8EDF2"}}>
      <div style={{position:"relative"}}>
        <PhotoCarousel photos={photos} height="180px"/>
        <div style={{position:"absolute",top:"10px",left:"10px",background:BROWN,color:"#fff",width:"28px",height:"28px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800",fontSize:"13px"}}>{index+1}</div>
        {shop.tier===1&&<div style={{position:"absolute",top:"10px",right:"10px",background:"rgba(255,255,255,0.95)",padding:"3px 8px",borderRadius:"6px",fontSize:"11px",fontWeight:"700",color:"#E65100"}}>✨ Specialty</div>}
      </div>

      <div style={{padding:"14px 16px"}}>
        <div style={{fontWeight:"700",fontSize:"16px",color:DARK,marginBottom:"2px"}}>{name}</div>
        <div style={{fontSize:"13px",color:GRAY,marginBottom:"6px"}}>{address}</div>

        {/* Meta */}
        <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"8px",fontSize:"13px",color:GRAY,marginBottom:"8px"}}>
          {shop.rating>0&&<span><span style={{color:GOLD}}>★</span> <span style={{fontWeight:"700",color:DARK}}>{shop.rating}</span>{shop.userRatingCount>0&&<span> ({shop.userRatingCount.toLocaleString()})</span>}</span>}
          {shop.distance&&<><span style={{color:"#CBD5E1"}}>·</span><span style={{fontWeight:"600"}}>📍 {shop.distance}</span></>}
          {shop.priceLevel&&<><span style={{color:"#CBD5E1"}}>·</span><span>{'$'.repeat(shop.priceLevel)}</span></>}
        </div>

        {/* Drink tags */}
        {Object.keys(shop.detectedDrinks||{}).length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"8px"}}>
            {Object.entries(shop.detectedDrinks).slice(0,4).map(([type])=>{const p=DRINK_PATTERNS[type];return p?<span key={type} style={{background:p.bg,color:p.color,padding:"2px 8px",borderRadius:"20px",fontSize:"11px",fontWeight:"600",border:`1px solid ${p.color}30`}}>{p.icon} {p.label}</span>:null;})}
          </div>
        )}

        {/* Badges */}
        {shop.badges?.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"8px"}}>
            {shop.badges.filter(b=>b.label!=='Specialty').map((b,i)=><span key={i} style={{background:b.bg,color:b.color,padding:"3px 8px",borderRadius:"6px",fontSize:"11px",fontWeight:"600"}}>{b.icon} {b.label}</span>)}
          </div>
        )}

        {/* Open status */}
        {shop.isOpen!==null&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px",padding:"8px 10px",background:shop.isOpen?"#E8F5E9":"#FFEBEE",borderRadius:"8px",fontSize:"13px"}}>
            <span style={{width:"8px",height:"8px",borderRadius:"50%",background:shop.is24Hours?TEAL:(shop.isOpen?GREEN:CORAL),flexShrink:0}}/>
            <span style={{fontWeight:"700",color:shop.is24Hours?"#00838F":(shop.isOpen?"#2E7D32":"#D32F2F")}}>{shop.is24Hours?'🔄 Open 24/7':(shop.isOpen?'Open':'Closed')}</span>
            {shop.todayHours&&!shop.is24Hours&&<span style={{color:GRAY}}>· {shop.todayHours}</span>}
          </div>
        )}

        {/* ── SEATING (API-confirmed = ✅, review = ⚠️) ── */}
        {hasAnySeating&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"10px",padding:"10px 12px",background:"#F8FAFC",borderRadius:"10px",border:"1px solid #E8EDF2"}}>
            <span style={{fontSize:"16px",marginTop:"1px"}}>🪑</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px"}}>
                <span style={{fontSize:"13px",fontWeight:"700",color:DARK}}>Seating</span>
                <span style={{fontSize:"10px",fontWeight:"700",color:seatingConfirmed?"#2E7D32":"#E65100",background:seatingConfirmed?"#E8F5E9":"#FFF3E0",padding:"1px 6px",borderRadius:"4px"}}>
                  {seatingConfirmed?"✅ Google confirmed":"⚠️ Not confirmed"}
                </span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                {shop.hasIndoorSeating&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🏠 Indoor</span>}
                {shop.hasOutdoorSeating&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🌿 Outdoor</span>}
                {shop.seating?.hasLoungeSeating&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🛋️ Lounge</span>}
                {shop.seating?.hasBarSeating&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🪑 Bar seats</span>}
                {shop.seating?.capacityNote&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>📐 {shop.seating.capacityNote}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── PARKING (API-confirmed = ✅, review = ⚠️) ── */}
        {parking&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"10px",padding:"10px 12px",background:"#F8FAFC",borderRadius:"10px",border:"1px solid #E8EDF2"}}>
            <span style={{fontSize:"16px",marginTop:"1px"}}>🅿️</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px"}}>
                <span style={{fontSize:"13px",fontWeight:"700",color:DARK}}>Parking</span>
                <span style={{fontSize:"10px",fontWeight:"700",color:parkingConfirmed?"#2E7D32":"#E65100",background:parkingConfirmed?"#E8F5E9":"#FFF3E0",padding:"1px 6px",borderRadius:"4px"}}>
                  {parkingConfirmed?"✅ Google confirmed":"⚠️ Mentioned in reviews"}
                </span>
              </div>
              {parking.noParking?(
                <div style={{fontSize:"12px",color:CORAL}}>{parking.noParkingNote}</div>
              ):(
                <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                  {parking.details?.length>0?parking.details.map((d,i)=>(
                    <span key={i} style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>
                      {d.icon} {d.label}{d.free===true?' · Free':d.free===false&&!d.cost?' · Paid':''}
                    </span>
                  )):<span style={{fontSize:"12px",color:GRAY}}>Parking available nearby</span>}
                  {parking.valetCost&&<span style={{fontSize:"12px",color:GRAY,background:"#fff",border:"1px solid #E2E8F0",padding:"2px 8px",borderRadius:"6px"}}>🎩 Valet {parking.valetCost}</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Review-detected amenities (always ⚠️ reported) */}
        {Object.values(shop.amenities||{}).some(a=>a.available)&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"10px"}}>
            {Object.entries(shop.amenities).filter(([_,a])=>a.available).map(([k,a])=>(
              <span key={k} title="Mentioned in customer reviews — call ahead to confirm" style={{display:"flex",alignItems:"center",gap:"4px",background:"#FFFBF0",border:"1px solid #FED7AA",padding:"3px 9px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",color:"#92400E",cursor:"default"}}>
                {a.icon} {a.label} <span style={{color:"#D97706",fontSize:"10px"}}>·reported</span>
              </span>
            ))}
          </div>
        )}

        {/* Work score */}
        {shop.workScore>=4&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px",padding:"8px 10px",background:"#EFF6FF",borderRadius:"8px",fontSize:"12px"}}>
            <span>💼</span><span style={{fontWeight:"600",color:"#1D4ED8"}}>Work-Friendly</span>
            <span style={{color:GRAY}}>· Score {shop.workScore}/8 (reviews)</span>
          </div>
        )}

        {/* Phone */}
        {(shop.nationalPhoneNumber||shop.internationalPhoneNumber)&&(
          <a href={`tel:${shop.nationalPhoneNumber||shop.internationalPhoneNumber}`} style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px",padding:"10px 12px",background:"#E3F2FD",borderRadius:"10px",textDecoration:"none",color:"#1565C0"}}>
            <span style={{width:"32px",height:"32px",background:"#1565C0",color:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>📞</span>
            <div><div style={{fontWeight:"600",fontSize:"14px"}}>{shop.nationalPhoneNumber||shop.internationalPhoneNumber}</div><div style={{fontSize:"11px",color:"#64748B"}}>Tap to call</div></div>
          </a>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <button onClick={()=>setShowDir(true)} style={{display:"flex",alignItems:"center",gap:"5px",padding:"8px 14px",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:"600",cursor:"pointer",background:BROWN,color:"#fff",fontFamily:"inherit"}}>🧭 Directions</button>
          <button onClick={()=>onShowOnMap?.(index)} style={{display:"flex",alignItems:"center",gap:"5px",padding:"8px 14px",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:"600",cursor:"pointer",background:"#EDE7F6",color:"#5E35B1",fontFamily:"inherit"}}>📍 Map</button>
          <button onClick={()=>setExpanded(!expanded)} style={{display:"flex",alignItems:"center",gap:"5px",padding:"8px 14px",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:"600",cursor:"pointer",background:expanded?DARK:"#F1F5F9",color:expanded?"#fff":DARK,fontFamily:"inherit"}}>{expanded?"▲ Less":"▼ Details"}</button>
        </div>

        {/* Expanded hours + website */}
        <AnimatePresence>
          {expanded&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{marginTop:"12px",padding:"12px",background:"#F8FAFC",borderRadius:"10px"}}>
                {shop.currentOpeningHours?.weekdayDescriptions?.length>0&&(
                  <>
                    <div style={{fontSize:"12px",color:GRAY,fontWeight:"600",marginBottom:"8px"}}>🕐 Hours</div>
                    {shop.currentOpeningHours.weekdayDescriptions.map((day,i)=>{
                      const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                      const isToday=DAY.findIndex(d=>day.startsWith(d))===new Date().getDay();
                      return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"13px",color:isToday?BROWN_DARK:DARK,fontWeight:isToday?"700":"400"}}>
                        <span>{day.split(':')[0]}</span><span>{day.split(':').slice(1).join(':').trim()}</span>
                      </div>;
                    })}
                  </>
                )}
                {(shop.websiteUri||shop.website)&&(
                  <a href={shop.websiteUri||shop.website} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"10px",padding:"8px",background:"#fff",borderRadius:"8px",textDecoration:"none",color:BROWN,fontSize:"13px",fontWeight:"600"}}>🌐 Visit Website</a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <DirectionsPicker isOpen={showDir} onClose={()=>setShowDir(false)} lat={shop.lat} lng={shop.lng} name={name}/>
    </motion.div>
  );
}

// ─── FILTER PILL ───────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick, emoji }) {
  return <button onClick={onClick} style={{padding:"7px 14px",borderRadius:"20px",border:active?`2px solid ${BROWN}`:"1.5px solid #E2E8F0",background:active?`${BROWN}15`:"#fff",color:active?BROWN:GRAY,fontWeight:active?"700":"500",fontSize:"13px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0}}>{emoji&&<span style={{marginRight:"4px"}}>{emoji}</span>}{label}</button>;
}
function ToggleChip({ label, active, onClick, icon }) {
  return <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",borderRadius:"8px",border:active?`1.5px solid ${BROWN}`:"1.5px solid #E2E8F0",background:active?`${BROWN}12`:"#fff",color:active?BROWN_DARK:GRAY,fontWeight:active?"700":"500",fontSize:"12px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{icon&&<span>{icon}</span>}{label}</button>;
}

// ─── MAP POPUP ─────────────────────────────────────────────────────────────
function buildMapPopup(shop, index) {
  const name    = shop.displayName?.text || shop.name || "Coffee Shop";
  const address = shop.formattedAddress  || shop.shortFormattedAddress || "";
  const phone   = shop.nationalPhoneNumber || shop.internationalPhoneNumber || null;
  const photo   = shop.photoUrl || shop.photos?.[0] || null;
  const { isOpen, todayHours, is24Hours } = shop;
  const parkingLine = shop.parking&&!shop.parking.noParking ? `<div style="font-size:11px;color:#64748B;margin-top:4px;">🅿️ ${shop.parking.details?.[0]?.label||'Parking available'} <span style="color:${shop.parking.source==='api'?'#2E7D32':'#E65100'};font-weight:700;">${shop.parking.source==='api'?'✅':'⚠️'}</span></div>` : '';
  const seatingLine = (shop.hasIndoorSeating||shop.hasOutdoorSeating) ? `<div style="font-size:11px;color:#64748B;margin-top:2px;">🪑 ${[shop.hasIndoorSeating&&'Indoor',shop.hasOutdoorSeating&&'Outdoor'].filter(Boolean).join(' & ')} seating <span style="color:${shop.seatingSource==='api'?'#2E7D32':'#E65100'};font-weight:700;">${shop.seatingSource==='api'?'✅':'⚠️'}</span></div>` : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:260px;position:relative;">
      <div style="padding:12px;padding-top:14px;">
        <div onclick="window.viewPlaceDetails&&window.viewPlaceDetails(${index})" style="font-weight:700;font-size:15px;color:#1A2332;margin-bottom:6px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding-right:26px;">${name}</div>
        <div style="font-size:12px;color:#64748B;margin-bottom:6px;padding:6px 8px;background:#F8FAFC;border-radius:6px;">📍 ${address}</div>
        <div style="font-size:12px;margin-bottom:6px;padding:6px 10px;border-radius:6px;background:${is24Hours?'#E3F2FD':isOpen===true?'#E8F5E9':isOpen===false?'#FFEBEE':'#F5F5F5'};">
          <span style="font-weight:700;color:${is24Hours?'#1565C0':isOpen===true?'#2E7D32':isOpen===false?'#D32F2F':'#9E9E9E'};">${is24Hours?'🔄 Open 24/7':isOpen===true?'● Open':isOpen===false?'● Closed':'● Hours N/A'}</span>
          ${todayHours&&!is24Hours?`<span style="color:#64748B;"> · ${todayHours}</span>`:''}
        </div>
        ${parkingLine}${seatingLine}
        ${phone?`<a href="tel:${phone}" style="display:flex;align-items:center;gap:8px;margin:8px 0;padding:7px 10px;background:#E3F2FD;border-radius:6px;text-decoration:none;color:#1565C0;font-size:12px;"><span>📞</span><span style="font-weight:600;">${phone}</span></a>`:''}
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
  const [shops,setShops]         = useState([]);
  const [loading,setLoading]     = useState(true);
  const [error,setError]         = useState(null);
  const [viewMode,setViewMode]   = useState("list");
  const [radius,setRadius]       = useState(10);
  const [showLocPicker,setShowLocPicker] = useState(false);
  const [directionsShop,setDirectionsShop] = useState(null);
  const [showAdvanced,setShowAdvanced] = useState(false);
  const [quickFilter,setQuickFilter]   = useState("all");
  const [sortBy,setSortBy]             = useState("nearby");
  const [filterOpenNow,setFilterOpenNow]       = useState(false);
  const [filterShopType,setFilterShopType]     = useState("all");
  const [filterWorkFriendly,setFilterWorkFriendly] = useState(false);
  const [filterOutdoor,setFilterOutdoor]       = useState(false);
  const [filterParking,setFilterParking]       = useState(false);
  const [filterIndoorSeating,setFilterIndoorSeating] = useState(false);
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const cardRefs = useRef({}); const mapRef = useRef(null); const mapInstanceRef = useRef(null);

  const { activeLocation } = useLocation();
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locationText = activeLocation?.label || activeLocation?.address?.formatted || "Set location";

  const activeFilterCount = [filterOpenNow,filterShopType!=="all",filterWorkFriendly,filterOutdoor,filterParking,filterIndoorSeating].filter(Boolean).length;

  useEffect(()=>{
    if(!lat||!lng)return;
    setLoading(true);setError(null);
    (async()=>{
      try {
        const {data} = await base44.functions.invoke('getCoffeeShops',{latitude:lat,longitude:lng,radius:radius*1609,maxResults:30});
        const places = data?.places||data?.shops||[];
        if(places.length>0){
          const processed=places.map(p=>processShop(p,lat,lng));
          processed.sort((a,b)=>(a.distanceMiles||999)-(b.distanceMiles||999));
          setShops(processed);
        } else { setError(data?.error||"No coffee shops found. Try expanding your search."); }
      } catch(e){setError(`Failed to load: ${e.message}`);}
      finally{setLoading(false);}
    })();
  },[lat,lng,radius]);

  const filtered = useMemo(()=>{
    let r=[...shops];
    if(quickFilter==="open")         r=r.filter(s=>s.isOpen===true);
    if(quickFilter==="specialty")    r=r.filter(s=>s.isSpecialty);
    if(quickFilter==="matcha")       r=r.filter(s=>s.detectedDrinks?.matcha);
    if(quickFilter==="coldBrew")     r=r.filter(s=>s.detectedDrinks?.coldBrew);
    if(quickFilter==="workFriendly") r=r.filter(s=>s.workScore>=4);
    if(quickFilter==="parking")      r=r.filter(s=>s.parking&&!s.parking.noParking);
    if(quickFilter==="independent")  r=r.filter(s=>!s.isChain);
    if(filterOpenNow)       r=r.filter(s=>s.isOpen===true);
    if(filterWorkFriendly)  r=r.filter(s=>s.workScore>=4);
    if(filterOutdoor)       r=r.filter(s=>s.hasOutdoorSeating===true);
    if(filterParking)       r=r.filter(s=>s.parking&&!s.parking.noParking);
    if(filterIndoorSeating) r=r.filter(s=>s.hasIndoorSeating===true);
    if(filterShopType==="independent")r=r.filter(s=>!s.isChain);
    if(filterShopType==="chain")      r=r.filter(s=>s.isChain);
    if(filterShopType==="specialty")  r=r.filter(s=>s.isSpecialty);
    if(sortBy==="nearby")  r.sort((a,b)=>(a.distanceMiles||999)-(b.distanceMiles||999));
    else if(sortBy==="rating") r.sort((a,b)=>(b.rating||0)-(a.rating||0));
    else if(sortBy==="work")   r.sort((a,b)=>(b.workScore||0)-(a.workScore||0));
    return r;
  },[shops,quickFilter,sortBy,filterOpenNow,filterShopType,filterWorkFriendly,filterOutdoor,filterParking,filterIndoorSeating]);

  const clearFilters=()=>{setFilterOpenNow(false);setFilterShopType("all");setFilterWorkFriendly(false);setFilterOutdoor(false);setFilterParking(false);setFilterIndoorSeating(false);};

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
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:'<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',iconSize:[16,16],className:""})}).addTo(map);
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
  },[viewMode,filtered,lat,lng,selectedMapIndex]);

  const stats={total:filtered.length,open:filtered.filter(s=>s.isOpen===true).length,specialty:filtered.filter(s=>s.tier===1).length,withParking:filtered.filter(s=>s.parking&&!s.parking.noParking).length};

  return (
    <div style={{fontFamily:"'DM Sans',-apple-system,sans-serif",background:CREAM,minHeight:"100vh"}}>
      <div style={{padding:"16px 16px 0"}}>
        <button onClick={()=>window.history.back()} style={{display:"flex",alignItems:"center",gap:"6px",background:"none",border:"none",padding:"0",color:BROWN,fontSize:"14px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit",marginBottom:"12px"}}>← Back to Home</button>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
          <span style={{fontSize:"28px"}}>☕</span>
          <div><div style={{fontWeight:"800",fontSize:"20px",color:DARK}}>Coffee Finder</div><div style={{fontSize:"13px",color:GRAY}}>Drink types · Parking · Seating · Work-friendly</div></div>
        </div>

        <div onClick={()=>setShowLocPicker(true)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",background:"#fff",borderRadius:"10px",border:"1px solid #E2E8F0",fontSize:"13px",marginBottom:"10px",cursor:"pointer"}}>
          <span style={{color:GRAY}}>📍 {locationText}</span>
          <span style={{background:BROWN_LIGHT,color:BROWN_DARK,padding:"4px 10px",borderRadius:"6px",fontWeight:"600",fontSize:"12px"}}>Change</span>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
          <span style={{fontSize:"12px",color:GRAY,fontWeight:"600",flexShrink:0}}>📏 Radius:</span>
          <div style={{display:"flex",gap:"4px"}}>
            {[5,10,15,25].map(r=><button key={r} onClick={()=>setRadius(r)} style={{padding:"5px 10px",borderRadius:"8px",border:radius===r?`2px solid ${BROWN}`:"1px solid #E2E8F0",background:radius===r?`${BROWN}15`:"#fff",color:radius===r?BROWN:GRAY,fontWeight:radius===r?"700":"500",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{r} mi</button>)}
          </div>
          <span style={{fontSize:"11px",color:GRAY,marginLeft:"auto"}}>{loading?"Loading...":`${shops.length} found`}</span>
        </div>

        {/* Sort + quick filters */}
        <div style={{display:"flex",gap:"8px",overflowX:"auto",padding:"4px 0 8px",scrollbarWidth:"none",alignItems:"center"}}>
          <div style={{display:"flex",background:"#F1F5F9",borderRadius:"10px",padding:"2px",flexShrink:0}}>
            {[{v:"nearby",l:"📍 Nearby"},{v:"rating",l:"⭐ Best"},{v:"work",l:"💼 Work"}].map(({v,l})=>(
              <button key={v} onClick={()=>setSortBy(v)} style={{padding:"6px 10px",borderRadius:"8px",border:"none",background:sortBy===v?BROWN:"transparent",color:sortBy===v?"#fff":GRAY,fontWeight:"600",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          <div style={{width:"1px",height:"20px",background:"#E2E8F0",flexShrink:0}}/>
          {[{value:"all",label:"All",emoji:"☕"},{value:"open",label:"Open Now",emoji:"🟢"},{value:"specialty",label:"Specialty",emoji:"✨"},{value:"matcha",label:"Matcha",emoji:"🍵"},{value:"coldBrew",label:"Cold Brew",emoji:"🥤"},{value:"workFriendly",label:"Work-Friendly",emoji:"💼"},{value:"parking",label:"Has Parking",emoji:"🅿️"},{value:"independent",label:"Local Only",emoji:"🏘️"}].map(f=><FilterPill key={f.value} {...f} active={quickFilter===f.value} onClick={()=>setQuickFilter(f.value)}/>)}
        </div>

        {/* Advanced filters toggle */}
        <button onClick={()=>setShowAdvanced(!showAdvanced)} style={{display:"flex",alignItems:"center",gap:"8px",width:"100%",padding:"10px 14px",borderRadius:"10px",border:`1.5px solid ${showAdvanced||activeFilterCount>0?BROWN:"#E2E8F0"}`,background:showAdvanced||activeFilterCount>0?`${BROWN}10`:"#fff",color:showAdvanced||activeFilterCount>0?BROWN_DARK:GRAY,fontWeight:"600",fontSize:"13px",cursor:"pointer",fontFamily:"inherit",marginBottom:"6px"}}>
          <span>🔧 Advanced Filters</span>
          {activeFilterCount>0&&<span style={{background:BROWN,color:"#fff",borderRadius:"10px",padding:"1px 7px",fontSize:"11px",fontWeight:"700"}}>{activeFilterCount}</span>}
          <span style={{marginLeft:"auto"}}>{showAdvanced?"▲":"▼"}</span>
        </button>

        <AnimatePresence>
          {showAdvanced&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF2",padding:"14px",marginBottom:"10px",display:"flex",flexDirection:"column",gap:"14px"}}>

                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>⏰ Status</div>
                  <ToggleChip label="Open Now" active={filterOpenNow} onClick={()=>setFilterOpenNow(!filterOpenNow)} icon="🟢"/>
                </div>

                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>🏪 Shop Type</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                    {[{v:"all",l:"All",i:"☕"},{v:"specialty",l:"Specialty Only",i:"✨"},{v:"independent",l:"Independent/Local",i:"🏘️"},{v:"chain",l:"Chains Only",i:"🏪"}].map(({v,l,i})=><ToggleChip key={v} label={l} icon={i} active={filterShopType===v} onClick={()=>setFilterShopType(v)}/>)}
                  </div>
                </div>

                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"4px"}}>🪑 Seating & 🅿️ Parking</div>
                  <div style={{fontSize:"11px",color:"#2E7D32",marginBottom:"8px",fontWeight:"600"}}>✅ Uses Google-confirmed data only</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                    <ToggleChip label="Indoor Seating"  icon="🏠" active={filterIndoorSeating} onClick={()=>setFilterIndoorSeating(!filterIndoorSeating)}/>
                    <ToggleChip label="Outdoor Seating" icon="🌿" active={filterOutdoor}        onClick={()=>setFilterOutdoor(!filterOutdoor)}/>
                    <ToggleChip label="Has Parking"     icon="🅿️" active={filterParking}        onClick={()=>setFilterParking(!filterParking)}/>
                  </div>
                </div>

                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"4px"}}>💼 Amenities</div>
                  <div style={{fontSize:"11px",color:"#E65100",marginBottom:"8px",fontWeight:"600"}}>⚠️ Based on customer reviews — call ahead to confirm</div>
                  <ToggleChip label="Work-Friendly" icon="💼" active={filterWorkFriendly} onClick={()=>setFilterWorkFriendly(!filterWorkFriendly)}/>
                </div>


                {/* Trust legend */}
                <div style={{padding:"10px 12px",background:"#F8FAFC",borderRadius:"8px",border:"1px solid #E8EDF2"}}>
                  <div style={{fontSize:"11px",fontWeight:"700",color:GRAY,marginBottom:"6px"}}>DATA TRUST GUIDE</div>
                  <div style={{fontSize:"11px",color:DARK,lineHeight:"1.7"}}>
                    <div>✅ <strong>Google confirmed</strong> — from Google Places API (reliable)</div>
                    <div>⚠️ <strong>Mentioned in reviews</strong> — customer-reported, may have changed</div>
                    <div style={{marginTop:"4px",color:GRAY}}>For critical needs (accessibility, event-day parking), always call ahead.</div>
                  </div>
                </div>

                {activeFilterCount>0&&<button onClick={clearFilters} style={{padding:"9px",borderRadius:"8px",border:`1.5px solid ${CORAL}`,background:"#FFF5F5",color:CORAL,fontWeight:"700",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>✕ Clear All Filters ({activeFilterCount})</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats + view toggle */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",fontSize:"13px"}}>
          <div style={{color:GRAY,fontWeight:"600",display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
            <span style={{background:BROWN,color:"#fff",padding:"2px 8px",borderRadius:"10px",fontWeight:"700",fontSize:"12px"}}>{stats.total}</span>
            <span>coffee shops</span>
            {stats.specialty>0&&<span style={{color:"#E65100"}}>· {stats.specialty} specialty</span>}
            {stats.open>0&&<span style={{color:GREEN}}>· {stats.open} open</span>}
            {stats.withParking>0&&<span style={{color:GRAY}}>· {stats.withParking} 🅿️</span>}
          </div>
          <div style={{display:"flex",gap:"4px"}}>
            {["list","map"].map(v=><button key={v} onClick={()=>setViewMode(v)} style={{padding:"6px 12px",borderRadius:"8px",border:"none",background:viewMode===v?BROWN:"#E2E8F0",color:viewMode===v?"#fff":GRAY,fontWeight:"700",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{v==="list"?"📋 List":"🗺️ Map"}</button>)}
          </div>
        </div>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:"40px",marginBottom:"12px",animation:"pulse 1.5s infinite"}}>☕</div><div style={{color:GRAY,fontWeight:"600"}}>Finding coffee shops...</div></div>
      ):error?(
        <div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:"40px",marginBottom:"12px"}}>😕</div><div style={{color:CORAL,fontWeight:"600"}}>{error}</div></div>
      ):viewMode==="list"?(
        <div style={{padding:"0 12px 100px",display:"flex",flexDirection:"column",gap:"12px"}}>
          {filtered.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",background:"#fff",borderRadius:"12px"}}>
              <div style={{fontSize:"32px",marginBottom:"10px"}}>🔍</div>
              <div style={{fontWeight:"600",color:DARK,marginBottom:"8px"}}>No matches found</div>
              <div style={{fontSize:"13px",color:GRAY,marginBottom:"14px"}}>Try adjusting filters or expanding the radius</div>
              {activeFilterCount>0&&<button onClick={clearFilters} style={{padding:"9px 18px",borderRadius:"8px",border:"none",background:BROWN,color:"#fff",fontWeight:"600",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>Clear Filters</button>}
            </div>
          ):filtered.map((shop,i)=>(
            <div key={shop.id||i} ref={el=>cardRefs.current[i]=el}><CoffeeCard shop={shop} index={i} onShowOnMap={handleShowOnMap}/></div>
          ))}
        </div>
      ):(
        <div style={{position:"relative"}}>
          <div ref={mapRef} style={{height:"calc(100vh - 260px)",width:"100%"}}/>
          <button onClick={()=>setViewMode("list")} style={{position:"absolute",top:"16px",right:"16px",zIndex:1000,background:"#fff",borderRadius:"50%",width:"40px",height:"40px",border:"none",boxShadow:"0 2px 8px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"20px",color:DARK}}>✕</button>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}::-webkit-scrollbar{display:none}.gs-popup .leaflet-popup-content-wrapper{border-radius:12px;padding:0;overflow:hidden}.gs-popup .leaflet-popup-content{margin:0}`}</style>
      <LocationModePicker isOpen={showLocPicker} onClose={()=>setShowLocPicker(false)}/>
      {directionsShop&&<DirectionsPicker isOpen={true} onClose={()=>setDirectionsShop(null)} lat={directionsShop.lat} lng={directionsShop.lng} name={directionsShop.displayName?.text||directionsShop.name||"Coffee Shop"}/>}
    </div>
  );
}