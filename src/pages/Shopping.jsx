import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation, CITY_DISCLAIMER } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import RadiusRow from "@/components/location/RadiusRow";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapAppSelector from "@/components/MapAppSelector";
import { ChevronLeft, MapPin, ShoppingBag } from "lucide-react";
import { CAT, TEAL_DEEP, IVORY } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

// iPad editorial design tokens (design handoff — shared across all finders).
const ED_SERIF = '"Instrument Serif", Georgia, serif';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)";
const fs=(n)=>`calc(${n}px*var(--fs))`;

const T={teal:"#00BCD4",tealD:"#00838F",dark:"#1A2332",dark2:"#243447",gray:"#64748B",grayL:"#F1F5F9",green:"#4CAF50",blue:"#1565C0",blueL:"#E3F2FD",coral:"#FF6B6B",gold:"#FFB74D",
  accent:"#7C3AED",accentD:"#6D28D9",accentL:"#EDE9FE"};

// ── Food Shopping (priority) then General Shopping ──────────────────────────
const CATEGORIES=[
  {id:"all",                  label:"All",        icon:"🛍️",color:T.accent,   family:"all"},
  // Food Shopping family
  {id:"food_shopping",        label:"Food",       icon:"🛒",color:"#2E7D32",  family:"food"},
  {id:"supermarkets",         label:"Groceries",  icon:"🥬",color:"#2E7D32",  family:"food"},
  {id:"warehouse_clubs",      label:"Warehouse",  icon:"📦",color:"#1565C0",  family:"food"},
  {id:"farmers_markets",      label:"Farmers",    icon:"🥕",color:"#689F38",  family:"food"},
  {id:"wet_markets",          label:"Fresh Mkt",  icon:"🍎",color:"#D97706",  family:"food"},
  {id:"bodegas_corner_stores",label:"Bodega",     icon:"🏪",color:"#059669",  family:"food"},
  {id:"butcher_shops",        label:"Butcher",    icon:"🥩",color:"#B45309",  family:"food"},
  // General Shopping family
  {id:"general_shopping",     label:"Shopping",   icon:"🛍️",color:"#7C3AED",  family:"general"},
  {id:"souvenir_shopping",    label:"Souvenir",   icon:"🎁",color:"#7C3AED",  family:"general"},
  {id:"markets_bazaars",      label:"Bazaar",     icon:"🏺",color:"#B45309",  family:"general"},
  {id:"night_markets",        label:"Night Mkt",  icon:"🌙",color:"#1565C0",  family:"general"},
  {id:"local_crafts",         label:"Crafts",     icon:"🧶",color:"#D97706",  family:"general"},
  {id:"luxury_shopping",      label:"Luxury",     icon:"💎",color:"#BE185D",  family:"general"},
  {id:"malls",                label:"Malls",      icon:"🏬",color:"#7C3AED",  family:"general"},
  {id:"outlets",              label:"Outlets",    icon:"🏷️",color:"#DC2626",  family:"general"},
  {id:"duty_free",            label:"Duty Free",  icon:"✈️",color:"#0891B2",  family:"general"},
];

const PROP_TAGS=[
  // Food tags
  {key:"isFoodShopping",  icon:"🛒",label:"Food Shopping",   color:"#2E7D32",bg:"#D1FAE5"},
  {key:"hasFreshProduce", icon:"🥬",label:"Fresh Produce",    color:"#689F38",bg:"#ECFCCB"},
  {key:"isBudgetFriendly",icon:"💰",label:"Budget Friendly",  color:"#059669",bg:"#D1FAE5"},
  {key:"isOpenLate",      icon:"🌙",label:"Open Late",        color:"#1565C0",bg:"#E3F2FD"},
  // General tags
  {key:"isLuxury",        icon:"💎",label:"Luxury Brands",    color:"#BE185D",bg:"#FCE7F3"},
  {key:"isBudget",        icon:"💰",label:"Budget Friendly",  color:"#059669",bg:"#D1FAE5"},
  {key:"hasFoodCourt",    icon:"🍽️",label:"Food & Dining",   color:"#D97706",bg:"#FEF3C7"},
  {key:"hasFreeParking",  icon:"🅿️",label:"Free Parking",    color:"#1565C0",bg:"#E3F2FD"},
  {key:"isOutdoor",       icon:"🌤️",label:"Open Air",        color:"#059669",bg:"#D1FAE5"},
  {key:"hasLocalCrafts",  icon:"🧶",label:"Local Crafts",     color:"#B45309",bg:"#FEF3C7"},
  {key:"isDutyFree",      icon:"✈️",label:"Duty Free",        color:"#0891B2",bg:"#E0F2FE"},
  {key:"isBargain",       icon:"🤝",label:"Bargain/Haggle",   color:"#D97706",bg:"#FEF3C7"},
  {key:"isTouristFav",    icon:"📸",label:"Tourist Favorite", color:"#7C3AED",bg:"#EDE9FE"},
];

function openStatus(p){
  const h=p.currentOpeningHours?.weekdayDescriptions||p.hours||[];
  if(!h.length) return {isOpen:p.isOpen??null,label:p.isOpen===true?"Open Now":p.isOpen===false?"Closed":"Hours Unknown",is24H:false,today:""};
  const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const tod=days[new Date().getDay()];
  const ent=h.find((x)=>x?.toLowerCase().startsWith(tod.toLowerCase()));
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

// Directions handled by the shared <MapAppSelector> (address-aware destination +
// "from my location / other address" origin picker) — see src/components/MapAppSelector.jsx

function PhotoStrip({photos,fallback="🛍️",bg,height}){
  const [err,setErr]=useState({}); const [ld,setLd]=useState({0:true,1:true});
  const valid=(photos||[]).filter((_,i)=>_&&!err[i]);
  const fbBg=bg||`linear-gradient(135deg,${T.accentL},#C4B5FD)`;
  // Optional fixed-height override (used by the iPad editorial card). When set,
  // every layout collapses to a single full-width photo at that height so the
  // tall editorial hero reads cleanly; the phone layout passes no height and is
  // byte-identical to before.
  if(height!=null){
    const H=typeof height==="number"?`${height}px`:height;
    if(!valid.length) return <div style={{height:H,background:fbBg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"calc(72px*var(--fs))",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.15))"}}>{fallback}</span></div>;
    return(<div style={{position:"relative",height:H,overflow:"hidden"}}>{ld[0]&&<div style={{position:"absolute",inset:0,background:fbBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"calc(56px*var(--fs))"}}>{fallback}</div>}<img src={valid[0]} alt="" onError={()=>setErr((p)=>({...p,0:true}))} onLoad={()=>setLd((p)=>({...p,0:false}))} style={{width:"100%",height:H,objectFit:"cover",opacity:ld[0]?0:1,transition:"opacity 0.4s"}}/></div>);
  }
  if(!valid.length) return <div style={{height:"130px",background:fbBg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"calc(52px*var(--fs))",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.15))"}}>{fallback}</span></div>;
  if(valid.length===1) return(<div style={{position:"relative",height:"170px",overflow:"hidden"}}>{ld[0]&&<div style={{position:"absolute",inset:0,background:fbBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"calc(40px*var(--fs))"}}>{fallback}</div>}<img src={valid[0]} alt="" onError={()=>setErr((p)=>({...p,0:true}))} onLoad={()=>setLd((p)=>({...p,0:false}))} style={{width:"100%",height:"170px",objectFit:"cover",opacity:ld[0]?0:1,transition:"opacity 0.4s"}}/></div>);
  return(<div style={{display:"grid",gridTemplateColumns:"60% 40%",height:"150px",overflow:"hidden"}}>{valid.slice(0,2).map((url,i)=>(<div key={i} style={{position:"relative",overflow:"hidden",borderRight:i===0?"2px solid #fff":"none"}}>{ld[i]&&<div style={{position:"absolute",inset:0,background:T.accentL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"calc(30px*var(--fs))"}}>{fallback}</div>}<img src={url} alt="" onError={()=>setErr((p)=>({...p,[i]:true}))} onLoad={()=>setLd((p)=>({...p,[i]:false}))} style={{width:"100%",height:"150px",objectFit:"cover",opacity:ld[i]?0:1,transition:"opacity 0.4s"}}/></div>))}</div>);
}

// ─── SHOP CARD — EDITORIAL (responsive: phone + iPad) ────────────────────────
// One editorial card for BOTH platforms — gated by the isTablet prop via the
// local v(tablet,phone) helper. Tablet keeps the original handoff sizes; phone
// gets compact, glasses-scalable equivalents. Editorial structure cloned from
// RestaurantCardTablet (PlacesToEat); only the domain content differs. Domain:
// shop category kicker (venueLabel), mall-vs-market hours, rating. No best-time /
// seating / parking / customer-favorites panels — this finder doesn't have them.
function ShopCardTablet({p,index,onMap,isHighlighted,cardRef,forceExpanded,userLat,userLng,formatDistance,isTablet}){
  const [dirs,setDirs]=useState(false); const [exp,setExp]=useState(false);
  const [hoursExpanded,setHoursExpanded]=useState(false);
  const [enriched,setEnriched]=useState(null);
  useEffect(()=>{if(forceExpanded)setExp(true);},[forceExpanded]);
  // On first expand of an OWNED shop, fetch real Google photos + hours (resolves
  // owned→Google once, cached). Keeps the list free; only opened shops cost.
  useEffect(()=>{
    if(!exp||enriched||p.source!=='owned')return;
    callWorker('places/enrich-owned',{id:p.id||p.placeId,name:p.displayName?.text||p.name,lat:p.lat,lng:p.lng,maxPhotos:3})
      .then(({data})=>{ if(data&&data.matched)setEnriched(data); }).catch(()=>{});
  },[exp]); // eslint-disable-line react-hooks/exhaustive-deps
  const name=p.displayName?.text||p.name||"Shop";
  // Layer enrich (owned) photos + hours over the owned fields before deriving status.
  const photos=enriched?.photos?.length?enriched.photos:p.photos;
  const dailyHours=enriched?.hours?.weekdayDescriptions?.length?enriched.hours.weekdayDescriptions:(p.hours||[]);
  const pStatus=enriched?.hours?{...p,currentOpeningHours:{weekdayDescriptions:enriched.hours.weekdayDescriptions},isOpen:enriched.hours.openNow??p.isOpen}:p;
  const st=openStatus(pStatus);
  const openText=st.label;
  const activeTags=PROP_TAGS.filter(t=>p.props?.[t.key]);
  const vColor=p.venueColor||T.accent;
  const phone=p.nationalPhoneNumber||p.internationalPhoneNumber||"";

  // Responsive token picker: tablet value | phone value. Every text size stays
  // wrapped in fs() so the 4-step glasses control scales card text gracefully.
  const v=(t,ph)=>isTablet?t:ph;

  const Tag=({bg,color,children})=>(
    <span style={{background:bg,color,borderRadius:"999px",padding:v(`${fs(9)} ${fs(16)}`,`${fs(6)} ${fs(12)}`),fontSize:v(fs(15.5),fs(12.5)),fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
  );

  return(
    <motion.div ref={cardRef} initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{delay:Math.min(index,8)*0.03}}
      style={{background:"#fff",borderRadius:v("28px","20px"),overflow:"hidden",minHeight:v(fs(560),fs(360)),boxShadow:isHighlighted?`0 0 0 3px ${T.accent},0 24px 50px -30px rgba(22,17,13,.4)`:v("0 24px 50px -30px rgba(22,17,13,.4)","0 12px 30px -20px rgba(22,17,13,.35)"),border:isHighlighted?`2px solid ${T.accent}`:`1px solid ${ED_RULE}`,transition:"box-shadow 0.3s,border 0.3s"}}>

      {/* Photo — editorial hero with rank badge + venue category tag */}
      <div style={{position:"relative"}}>
        <PhotoStrip photos={photos} fallback={p.venueIcon||"🛍️"} bg={`linear-gradient(135deg,${vColor}dd,${vColor}99)`} height={v(360,200)}/>
        <div style={{position:"absolute",top:fs(14),left:fs(14),width:v(fs(38),fs(32)),height:v(fs(38),fs(32)),borderRadius:"50%",background:index===0?"linear-gradient(135deg,#FFD700,#FFA000)":index===1?"linear-gradient(135deg,#B0BEC5,#78909C)":index===2?"linear-gradient(135deg,#FFAB40,#F57C00)":T.accent,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800",fontSize:v(fs(16),fs(13)),boxShadow:"0 2px 8px rgba(0,0,0,0.25)",border:"2px solid #fff"}}>{index+1}</div>
        {p.venueLabel&&<div style={{position:"absolute",top:fs(14),right:fs(14),background:"rgba(255,255,255,0.95)",backdropFilter:"blur(8px)",padding:v(`${fs(5)} ${fs(12)}`,`${fs(4)} ${fs(10)}`),borderRadius:"999px",fontSize:v(fs(14),fs(11)),fontWeight:"800",color:vColor,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>{p.venueIcon} {p.venueLabel}</div>}
      </div>

      <div style={{padding:v(`${fs(28)} ${fs(32)} ${fs(32)}`,`${fs(16)} ${fs(16)} ${fs(18)}`)}}>
        {/* Coral kicker — shop category */}
        {p.venueLabel&&<div style={{color:CAT.shopping.ink,fontWeight:600,fontSize:v(fs(17),fs(13)),letterSpacing:"0.2px"}}>{p.venueLabel}</div>}
        <h3 style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:v(fs(38),fs(26)),lineHeight:1.04,color:ED_INK,margin:`${fs(4)} 0 0`,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{name}</h3>

        {/* Say it / Translate / rating / distance */}
        <div style={{display:"flex",gap:v(fs(16),fs(10)),alignItems:"center",flexWrap:"wrap",marginTop:fs(12),fontSize:v(fs(17),fs(13.5)),color:ED_INK3}}>
          <NameLanguageHelp placeId={p.placeId||p.id} name={name}/>
          {p.rating>0&&<span><span style={{color:"#E0922F"}}>★</span> <span style={{fontWeight:700,color:ED_INK2}}>{p.rating.toFixed?p.rating.toFixed(1):p.rating}</span>{p.userRatingCount>0&&<> ({p.userRatingCount.toLocaleString()})</>}</span>}
          {p.distanceMiles!=null&&<span>· {formatDistance(p.distanceMiles)}</span>}
        </div>

        {/* Street address — subtle on-card line (phone + tablet) */}
        {(p.formattedAddress||p.shortFormattedAddress||p.vicinity)&&(
          <div style={{marginTop:fs(8),fontSize:v(fs(13.5),fs(12)),color:ED_INK3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>📍 {p.formattedAddress||p.shortFormattedAddress||p.vicinity}</div>
        )}

        {/* Pill tags — editorial highlights + property tags */}
        {(p.highlights?.length>0||activeTags.length>0)&&(
          <div style={{display:"flex",gap:v(fs(10),fs(6)),flexWrap:"wrap",marginTop:fs(16)}}>
            {p.highlights?.map((h,i)=><Tag key={`h${i}`} bg={T.accentL} color={T.accentD}>{h}</Tag>)}
            {activeTags.map((t,i)=><Tag key={`t${i}`} bg={t.bg} color={t.color}>{t.icon} {t.label}</Tag>)}
          </div>
        )}

        {/* Open bar */}
        {(st.today||st.isOpen!==null)&&(
          <div style={{marginTop:v(fs(18),fs(14)),background:st.isOpen===true?"#E7F3EA":st.isOpen===false?"#FBE0DC":"#FAF7F0",borderRadius:"16px",padding:v(`${fs(16)} ${fs(20)}`,`${fs(12)} ${fs(14)}`),fontSize:v(fs(18),fs(13.5)),fontWeight:600,color:st.isOpen===true?"#2E7D46":st.isOpen===false?"#C2392F":ED_INK2,display:"flex",alignItems:"center",gap:fs(11)}}>
            <span style={{width:fs(10),height:fs(10),borderRadius:"50%",background:st.isOpen===true?"#2E7D46":st.isOpen===false?"#C2392F":ED_INK3,flexShrink:0}}/>
            <span>{openText}</span>
            {st.today&&<span style={{color:ED_INK3,fontWeight:500}}>· {st.today}</span>}
          </div>
        )}

        {/* Phone bar */}
        {phone&&(
          <a href={`tel:${phone}`} style={{marginTop:fs(14),background:"#EFF4FB",borderRadius:"16px",padding:v(`${fs(18)} ${fs(20)}`,`${fs(13)} ${fs(14)}`),display:"flex",alignItems:"center",gap:fs(14),textDecoration:"none"}}>
            <span style={{fontSize:v(fs(24),fs(18))}}>📞</span>
            <span><span style={{display:"block",fontSize:v(fs(20),fs(13.5)),fontWeight:600,color:"#2E6FE0"}}>{phone}</span><span style={{fontSize:v(fs(15),fs(11.5)),color:ED_INK3}}>Tap to call</span></span>
          </a>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:v(fs(12),fs(8)),marginTop:v(fs(20),fs(16))}}>
          <button onClick={()=>setDirs(true)} style={{flex:1,borderRadius:"16px",padding:v(fs(15),fs(12)),fontSize:v(fs(18),fs(14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:CAT.shopping.ink,color:"#fff"}}>Directions</button>
          <button onClick={()=>onMap?.(index)} style={{flex:1,borderRadius:"16px",padding:v(fs(15),fs(12)),fontSize:v(fs(18),fs(14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:ED_IVORY2,color:ED_INK2}}>📍 Map</button>
          <button onClick={()=>setExp(e=>!e)} style={{flex:1,borderRadius:"16px",padding:v(fs(15),fs(12)),fontSize:v(fs(18),fs(14)),fontWeight:600,border:"none",cursor:"pointer",fontFamily:"inherit",background:exp?ED_INK:ED_IVORY2,color:exp?"#fff":ED_INK2}}>{exp?"Less ▴":"More ▾"}</button>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {exp&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{marginTop:v(fs(20),fs(16)),display:"flex",flexDirection:"column",gap:v(fs(14),fs(10))}}>

                {p.formattedAddress&&(
                  <div style={{display:"flex",alignItems:"flex-start",gap:fs(11),padding:v(fs(16),fs(13)),background:"#FAF7F0",borderRadius:"16px",border:`1px solid ${ED_RULE}`}}>
                    <span style={{fontSize:v(fs(20),fs(16)),flexShrink:0}}>📍</span>
                    <span style={{fontSize:v(fs(16),fs(13)),lineHeight:1.5,color:ED_INK2}}>{p.formattedAddress}</span>
                  </div>
                )}

                {dailyHours.length>0&&(
                  <div style={{padding:v(fs(16),fs(13)),background:"#FAF7F0",borderRadius:"16px"}}>
                    <button onClick={()=>setHoursExpanded(h=>!h)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"transparent",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit"}}>
                      <span style={{fontSize:fs(13),fontWeight:700,color:ED_INK3,letterSpacing:"0.5px"}}>🕐 WEEKLY HOURS</span>
                      <span style={{fontSize:fs(13),color:ED_INK3}}>{hoursExpanded?'▲':'▼'}</span>
                    </button>
                    {hoursExpanded&&(
                      <div style={{marginTop:fs(8)}}>
                        {dailyHours.map((day,i)=>{
                          const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                          const isToday=DAY.findIndex(d=>day.toLowerCase().startsWith(d.toLowerCase()))===new Date().getDay();
                          const hrs=day.split(':').slice(1).join(':').trim();
                          return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:`${fs(4)} 0`,fontSize:v(fs(15),fs(13)),fontWeight:isToday?700:400,color:isToday?T.accentD:ED_INK2,borderBottom:i<dailyHours.length-1?`1px solid ${ED_RULE}`:"none"}}>
                            <span>{day.split(':')[0]}</span><span style={{color:hrs.toLowerCase()==="closed"?"#C2392F":isToday?T.accentD:ED_INK3}}>{hrs}</span>
                          </div>;
                        })}
                      </div>
                    )}
                  </div>
                )}

                {p.websiteUri&&(
                  <a href={p.websiteUri} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:fs(12),padding:v(fs(16),fs(13)),background:"#F3E8FF",borderRadius:"16px",textDecoration:"none",color:"#7C3AED"}}>
                    <span style={{fontSize:v(fs(22),fs(18))}}>🌐</span>
                    <span><span style={{display:"block",fontWeight:600,fontSize:v(fs(16),fs(13.5))}}>Visit Website</span><span style={{fontSize:v(fs(14),fs(11.5)),color:ED_INK3}}>Store info &amp; hours</span></span>
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <MapAppSelector isOpen={dirs} onClose={()=>setDirs(false)} destination={{name,address:p.formattedAddress||p.shortFormattedAddress||p.vicinity||p.address||"",latitude:p.lat,longitude:p.lng}} userLat={userLat} userLng={userLng}/>
    </motion.div>
  );
}

export default function ShoppingFinder() {
  const [places,setPlaces]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [viewMode,setViewMode]=useState("list");
  const [category,setCategory]=useState("all");
  const [radius,setRadius]=useState(10);
  const [openOnly,setOpenOnly]=useState(false);
  const [luxOnly,setLuxOnly]=useState(false);
  const [foodOnly,setFoodOnly]=useState(false);
  const [locPicker,setLocPicker]=useState(false);
  const [dirsP,setDirsP]=useState(null);
  const [highlight,setHighlight]=useState(null);
  const [expandedIdx,setExpandedIdx]=useState(null);
  const [activePin,setActivePin]=useState(null);
  const cardRefs=useRef({});
  const mapRef=useRef(null); const mapInst=useRef(null); const markers=useRef([]);
  const {activeLocation}=useLocation();
  const lat=activeLocation?.coordinates?.latitude; const lng=activeLocation?.coordinates?.longitude;
  const locLabel=getLocationLabel(activeLocation);
  const isCity=isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);
  // iPad: wider centered column + editorial shop cards (design handoff).
  // Phone layout is unchanged — every tablet branch is gated on this.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";

  useEffect(()=>{ setRadius(activeLocation?.suggestedRadius ?? 10); }, [activeLocation?.placeId]);

  useEffect(()=>{
    if(!lat||!lng) return; setLoading(true); setError(null);
    (async()=>{
      try{
        // List source: owned planet DB (free, global). Real Google photos + hours
        // come on-tap via enrich-owned. `category` is passed through (harmless).
        const {data, error: workerError}=await callWorker(ROUTE.getShoppingOwned,{latitude:lat,longitude:lng,radius:radius*1609,maxResults:30,category});
        if (workerError) throw new Error(workerError);
        const raw=data?.places||[];
        // Compute distanceMiles client-side so the unit formatter has a raw number.
        const enriched = raw.map(p => {
          if (p.distanceMiles!=null || !p.lat || !p.lng) return p;
          const R=3959, dLat=(p.lat-lat)*Math.PI/180, dLon=(p.lng-lng)*Math.PI/180;
          const a=Math.sin(dLat/2)**2+Math.cos(lat*Math.PI/180)*Math.cos(p.lat*Math.PI/180)*Math.sin(dLon/2)**2;
          return { ...p, distanceMiles: R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)) };
        });
        if(enriched.length) setPlaces(enriched); else setError(data?.error||"No shopping found nearby.");
      }catch(e){setError(`Failed: ${e.message}`);}
      finally{setLoading(false);}
    })();
  },[lat,lng,radius,category]);

  const filtered=useMemo(()=>{
    let r=[...places];
    if(openOnly)  r=r.filter(p=>p.isOpen===true);
    if(luxOnly)   r=r.filter(p=>p.props?.isLuxury);
    if(foodOnly)  r=r.filter(p=>p.shoppingFamily==="food_shopping");
    return r;
  },[places,openOnly,luxOnly,foodOnly]);

  const handleMap=(i)=>{setViewMode("map");setActivePin(i);setTimeout(()=>{const p=filtered[i];if(mapInst.current&&p?.lat&&p?.lng){mapInst.current.setView([p.lat,p.lng],17);markers.current[i]?.openPopup();}},350);};

  useEffect(()=>{
    if(viewMode!=="map"||!mapRef.current||!lat||!lng) return;
    const init=()=>{
      if(mapInst.current) mapInst.current.remove(); markers.current=[];
      const map=window.L.map(mapRef.current).setView([lat,lng],14);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
      mapInst.current=map; window._gsSHMapInst=map;
      window._gsSHView=(i)=>{map.closePopup();setViewMode("list");setExpandedIdx(i);setHighlight(i);setTimeout(()=>cardRefs.current[i]?.scrollIntoView({behavior:"smooth",block:"center"}),150);setTimeout(()=>setHighlight(null),2800);};
      window._gsSHDirs=(i)=>setDirsP(filtered[i]);
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:`<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,iconSize:[16,16],className:""})}).addTo(map).bindTooltip(`<div style="font-family:-apple-system,sans-serif;padding:5px 9px;"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">📍 You are here</span></div>`,{permanent:true,direction:"bottom",opacity:1,offset:[0,12],className:"gs-user-tooltip",interactive:false});
      filtered.forEach((p,i)=>{
        if(!p.lat||!p.lng) return;
        const active=activePin===i; const color=active?"#FF6B35":p.venueColor||T.accent; const sz=active?36:30;
        const mk=window.L.marker([p.lat,p.lng],{icon:window.L.divIcon({html:`<div style="width:${sz}px;height:${sz}px;background:${color};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${active?14:12}px;box-shadow:0 3px 12px ${color}70;border:${active?3:2}px solid #fff;">${p.venueIcon||"🛍️"}</div>`,iconSize:[sz,sz],className:""})}).addTo(map);
        const st=openStatus(p);
        mk.bindPopup(`<div style="font-family:-apple-system,sans-serif;width:260px;position:relative;"><button onclick="window._gsSHMapInst?.closePopup()" style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#64748B;font-size:13px;z-index:10;">✕</button><div style="padding:12px 14px;"><div onclick="window._gsSHView&&window._gsSHView(${i})" style="font-weight:700;font-size:calc(15px*var(--fs));color:#1A2332;margin-bottom:5px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding-right:26px;line-height:1.3;">${p.displayName?.text||p.name}</div><div style="font-size:12px;color:#64748B;margin-bottom:7px;">📍 ${p.formattedAddress||''}</div><div style="font-size:calc(12px*var(--fs));padding:6px 9px;border-radius:7px;background:${st.isOpen===true?"#F0FDF4":st.isOpen===false?"#FEF2F2":"#F5F5F5"};margin-bottom:10px;"><span style="font-weight:700;color:${st.isOpen===true?"#15803D":st.isOpen===false?"#DC2626":"#9E9E9E"};">${st.label}</span></div><div style="display:flex;gap:8px;"><button onclick="window._gsSHDirs&&window._gsSHDirs(${i})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#3B82F6;color:#fff;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit;">🧭 Directions</button><button onclick="window._gsSHView&&window._gsSHView(${i})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit;">📋 Details</button></div></div></div>`,{maxWidth:280,className:"gs-popup",autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true});
        mk.on("popupopen",()=>setActivePin(i)); markers.current[i]=mk;
      });
      if(activePin!==null) setTimeout(()=>markers.current[activePin]?.openPopup(),200);
    };
    if(!window.L){const lk=document.createElement("link");lk.rel="stylesheet";lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(lk);const sc=document.createElement("script");sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";sc.onload=init;document.head.appendChild(sc);}else init();
    return()=>{delete window._gsSHMapInst;delete window._gsSHView;delete window._gsSHDirs;if(mapInst.current){mapInst.current.remove();mapInst.current=null;}};
  },[viewMode,filtered,lat,lng,activePin]);

  return(
    <div className="font-sans" style={{background:IVORY,minHeight:"100vh"}}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={()=>window.history.back()} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]" style={{background:'#FFFFFF',border:'1px solid #F0E9DC'}} aria-label="Back">
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]" style={{background:CAT.shopping.bg,color:CAT.shopping.ink}}>
            <ShoppingBag size={13} color={CAT.shopping.ink} strokeWidth={2} />
            Shopping
          </div>
          <div className="w-10 h-10" />
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
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{background:CAT.shopping.bg,color:CAT.shopping.ink}}>
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
        <RadiusRow options={[5,10,15,25]} value={radius} onChange={setRadius} ink={CAT.shopping.ink} unit={unit} setUnit={setUnit} />
        <div style={{overflowX:"auto",scrollbarWidth:"none"}}><div style={{display:"flex",gap:"7px",paddingBottom:"10px"}}>{CATEGORIES.map(c=><motion.button key={c.id} whileTap={{scale:0.94}} onClick={()=>setCategory(c.id)} className="font-sans" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",padding:"8px 12px",borderRadius:"14px",flexShrink:0,border:category===c.id?`2px solid ${c.color}`:"1px solid #F0E9DC",background:category===c.id?`${c.color}18`:"#fff",color:category===c.id?c.color:'#475569',fontWeight:category===c.id?"700":"500",fontSize:"calc(11px*var(--fs))",cursor:"pointer",minWidth:"64px"}}><span style={{fontSize:"calc(18px*var(--fs))"}}>{c.icon}</span><span>{c.label}</span></motion.button>)}</div></div>
      </div>
      <div style={{background:"#fff",padding:"10px 14px",borderBottom:"1px solid #E8EDF2",display:"flex",alignItems:"center",gap:"8px",overflowX:"auto",scrollbarWidth:"none"}}>
        {[{label:"🟢 Open Now",state:openOnly,set:setOpenOnly,color:T.green},{label:"🛒 Food Only",state:foodOnly,set:setFoodOnly,color:"#2E7D32"},{label:"💎 Luxury",state:luxOnly,set:setLuxOnly,color:"#BE185D"}].map(f=><button key={f.label} onClick={()=>f.set((x)=>!x)} style={{display:"flex",alignItems:"center",gap:"5px",padding:"7px 13px",borderRadius:"20px",flexShrink:0,border:f.state?`2px solid ${f.color}`:"1.5px solid #E2E8F0",background:f.state?f.color+"18":"#fff",color:f.state?f.color:T.gray,fontWeight:f.state?"700":"500",fontSize:"calc(12px*var(--fs))",cursor:"pointer",fontFamily:"inherit"}}>{f.label}</button>)}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
          <span style={{background:T.accent,color:"#fff",padding:"2px 9px",borderRadius:"10px",fontWeight:"800",fontSize:"calc(12px*var(--fs))"}}>{filtered.length}</span>
          <div style={{display:"flex",gap:"3px"}}>{["list","map"].map(v=><button key={v} onClick={()=>setViewMode(v)} style={{padding:"6px 11px",borderRadius:"8px",border:"none",background:viewMode===v?T.accent:"#E2E8F0",color:viewMode===v?"#fff":T.gray,fontWeight:"700",fontSize:"calc(12px*var(--fs))",cursor:"pointer",fontFamily:"inherit"}}>{v==="list"?"List View":"Map View"}</button>)}</div>
        </div>
      </div>
      {loading?(<div style={{textAlign:"center",padding:"70px 24px"}}><motion.div animate={{scale:[1,1.1,1],rotate:[0,5,-5,0]}} transition={{repeat:Infinity,duration:1.8}} style={{fontSize:"calc(52px*var(--fs))",marginBottom:"16px",display:"inline-block"}}>🛍️</motion.div><div style={{color:T.dark,fontWeight:"700",fontSize:"calc(16px*var(--fs))",marginBottom:"6px"}}>Finding shopping nearby…</div><div style={{color:T.gray,fontSize:"calc(13px*var(--fs))"}}>Malls · Markets · Boutiques · Souks · Night Markets</div><div style={{display:"flex",justifyContent:"center",gap:"6px",marginTop:"18px"}}>{[0,1,2].map(i=><motion.div key={i} animate={{opacity:[0.3,1,0.3]}} transition={{repeat:Infinity,duration:1.2,delay:i*0.2}} style={{width:"8px",height:"8px",borderRadius:"50%",background:T.accent}}/>)}</div></div>)
      :error?(<div style={{textAlign:"center",padding:"70px 24px"}}><div style={{fontSize:"calc(48px*var(--fs))",marginBottom:"14px"}}>😕</div><div style={{color:T.coral,fontWeight:"700",fontSize:"calc(16px*var(--fs))"}}>{error}</div><button onClick={()=>setRadius(r=>Math.min(r+5,25))} style={{marginTop:"14px",padding:"12px 24px",borderRadius:"12px",border:"none",background:`linear-gradient(135deg,${T.accentD},${T.accent})`,color:"#fff",fontWeight:"700",fontSize:"calc(14px*var(--fs))",cursor:"pointer",fontFamily:"inherit"}}>Expand Radius</button></div>)
      :viewMode==="list"?(<div style={isTablet
        ? {maxWidth:1024,margin:"0 auto",padding:"0 24px 170px",display:"flex",flexDirection:"column",gap:"30px"}
        : {width:"100%",padding:"14px 12px 100px",display:"flex",flexDirection:"column",gap:"16px"}}>{filtered.length===0?<div style={{textAlign:"center",padding:"50px 24px",background:"#fff",borderRadius:"20px"}}><div style={{fontSize:"calc(52px*var(--fs))",marginBottom:"14px"}}>🔍</div><div style={{fontWeight:"800",fontSize:"calc(18px*var(--fs))",color:T.dark}}>No matches</div></div>:filtered.map((p,i)=>{const Card=ShopCardTablet;return <Card key={p.id||i} p={p} index={i} onMap={handleMap} isHighlighted={highlight===i} cardRef={(el)=>cardRefs.current[i]=el} forceExpanded={expandedIdx===i} userLat={lat} userLng={lng} formatDistance={formatDistance} isTablet={isTablet}/>;})}</div>)
      :(<div style={{position:"relative"}}><div ref={mapRef} style={{height:"calc(100vh - 230px)",width:"100%"}}/><button onClick={()=>setViewMode("list")} style={{position:"fixed",top:"calc(50px + env(safe-area-inset-top) + 10px)",right:"14px",zIndex:1200,background:"#fff",borderRadius:"50%",width:"42px",height:"42px",border:"none",boxShadow:"0 3px 12px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"calc(20px*var(--fs))",color:T.dark}}>✕</button></div>)}
      <style>{`::-webkit-scrollbar{display:none}.gs-popup .leaflet-popup-content-wrapper{border-radius:16px;padding:0;overflow:hidden;}.gs-popup .leaflet-popup-content{margin:0;}.gs-popup .leaflet-popup-tip-container{display:none;}`}</style>
      <MapAppSelector isOpen={!!dirsP} onClose={()=>setDirsP(null)} destination={dirsP?{name:dirsP.displayName?.text||dirsP.name,address:dirsP.formattedAddress||dirsP.shortFormattedAddress||dirsP.vicinity||dirsP.address||"",latitude:dirsP.lat,longitude:dirsP.lng}:null} userLat={lat} userLng={lng}/>
      <LocationModePicker isOpen={locPicker} onClose={()=>setLocPicker(false)}/>
    </div>
  );
}