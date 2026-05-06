import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation, CITY_DISCLAIMER } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import DistanceUnitToggle from "@/components/location/DistanceUnitToggle";
import LocationModePicker from "@/components/location/LocationModePicker";
import { base44 } from "@/api/base44Client";

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

function Directions({isOpen,onClose,lat,lng,name,userLat,userLng}){
  if(!isOpen) return null;
  const origin=userLat&&userLng;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(10,15,25,0.75)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px"}}>
      <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}} onClick={(e)=>e.stopPropagation()} style={{background:"#fff",borderRadius:"24px 24px 16px 16px",padding:"24px",width:"100%",maxWidth:"400px"}}>
        <div style={{width:"40px",height:"4px",background:"#E2E8F0",borderRadius:"2px",margin:"0 auto 20px"}}/>
        <div style={{textAlign:"center",marginBottom:"18px"}}><div style={{fontSize:"22px",marginBottom:"4px"}}>🧭</div><div style={{fontWeight:"800",fontSize:"17px",color:T.dark}}>Get Directions</div><div style={{fontSize:"13px",color:T.gray,marginTop:"3px"}}>{name}</div></div>
        {[{icon:"🗺️",label:"Google Maps",url:`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin?`&origin=${userLat},${userLng}`:""}`},{icon:"🍎",label:"Apple Maps",url:`https://maps.apple.com/?daddr=${lat},${lng}${origin?`&saddr=${userLat},${userLng}`:""}`},{icon:"📍",label:"Waze",url:`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}].map(a=>(
          <motion.button key={a.label} whileTap={{scale:0.97}} onClick={()=>{window.open(a.url,"_blank");onClose();}} style={{display:"flex",alignItems:"center",gap:"14px",padding:"14px 16px",borderRadius:"14px",border:"1px solid #E2E8F0",background:"#FAFBFC",cursor:"pointer",fontFamily:"inherit",width:"100%",marginBottom:"10px",textAlign:"left"}}>
            <span style={{fontSize:"26px"}}>{a.icon}</span><span style={{fontWeight:"700",color:T.dark,fontSize:"15px"}}>{a.label}</span><span style={{marginLeft:"auto",color:T.gray,fontSize:"20px"}}>›</span>
          </motion.button>
        ))}
        <button onClick={onClose} style={{width:"100%",padding:"14px",borderRadius:"12px",border:"none",background:T.grayL,color:T.gray,fontWeight:"700",cursor:"pointer",fontFamily:"inherit",fontSize:"14px"}}>Cancel</button>
      </motion.div>
    </div>
  );
}

function PhotoStrip({photos,fallback="🛍️",bg}){
  const [err,setErr]=useState({}); const [ld,setLd]=useState({0:true,1:true});
  const valid=(photos||[]).filter((_,i)=>_&&!err[i]);
  const fbBg=bg||`linear-gradient(135deg,${T.accentL},#C4B5FD)`;
  if(!valid.length) return <div style={{height:"130px",background:fbBg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"52px",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.15))"}}>{fallback}</span></div>;
  if(valid.length===1) return(<div style={{position:"relative",height:"170px",overflow:"hidden"}}>{ld[0]&&<div style={{position:"absolute",inset:0,background:fbBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"40px"}}>{fallback}</div>}<img src={valid[0]} alt="" onError={()=>setErr((p)=>({...p,0:true}))} onLoad={()=>setLd((p)=>({...p,0:false}))} style={{width:"100%",height:"170px",objectFit:"cover",opacity:ld[0]?0:1,transition:"opacity 0.4s"}}/></div>);
  return(<div style={{display:"grid",gridTemplateColumns:"60% 40%",height:"150px",overflow:"hidden"}}>{valid.slice(0,2).map((url,i)=>(<div key={i} style={{position:"relative",overflow:"hidden",borderRight:i===0?"2px solid #fff":"none"}}>{ld[i]&&<div style={{position:"absolute",inset:0,background:T.accentL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"30px"}}>{fallback}</div>}<img src={url} alt="" onError={()=>setErr((p)=>({...p,[i]:true}))} onLoad={()=>setLd((p)=>({...p,[i]:false}))} style={{width:"100%",height:"150px",objectFit:"cover",opacity:ld[i]?0:1,transition:"opacity 0.4s"}}/></div>))}</div>);
}

function ShopCard({p,index,onMap,isHighlighted,cardRef,forceExpanded,userLat,userLng,formatDistance}){
  const [dirs,setDirs]=useState(false); const [exp,setExp]=useState(false);
  useEffect(()=>{if(forceExpanded)setExp(true);},[forceExpanded]);
  const name=p.displayName?.text||p.name||"Shop"; const st=openStatus(p);
  const hBg=st.isOpen===true?"#E8F5E9":st.isOpen===false?"#FFEBEE":"#F5F5F5";
  const hColor=st.isOpen===true?"#2E7D32":st.isOpen===false?"#D32F2F":T.gray;
  const hDot=st.isOpen===true?T.green:st.isOpen===false?T.coral:T.gray;
  const activeTags=PROP_TAGS.filter(t=>p.props?.[t.key]);
  const vColor=p.venueColor||T.accent;

  return(
    <motion.div ref={cardRef} initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:index*0.05,type:"spring",stiffness:260,damping:20}}
      style={{background:"#fff",borderRadius:"20px",boxShadow:isHighlighted?`0 0 0 3px ${T.accent},0 8px 32px rgba(124,58,237,0.22)`:"0 2px 16px rgba(0,0,0,0.07)",overflow:"hidden",border:isHighlighted?`2px solid ${T.accent}`:"1px solid #E8EDF2",transition:"box-shadow 0.3s,border 0.3s"}}>
      <div style={{position:"relative"}}>
        <PhotoStrip photos={p.photos} fallback={p.venueIcon||"🛍️"} bg={`linear-gradient(135deg,${vColor}dd,${vColor}99)`}/>
        <div style={{position:"absolute",top:"12px",left:"12px",background:index===0?"linear-gradient(135deg,#FFD700,#FFA000)":index===1?"linear-gradient(135deg,#B0BEC5,#78909C)":index===2?"linear-gradient(135deg,#FFAB40,#F57C00)":T.accent,color:"#fff",width:"30px",height:"30px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800",fontSize:"13px",boxShadow:"0 2px 8px rgba(0,0,0,0.25)"}}>{index+1}</div>
        <div style={{position:"absolute",top:"12px",right:"12px",background:"rgba(255,255,255,0.95)",backdropFilter:"blur(8px)",padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"800",color:vColor,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>{p.venueIcon} {p.venueLabel}</div>
        <div style={{position:"absolute",bottom:"12px",left:"12px",background:st.isOpen===true?"rgba(46,125,50,0.92)":st.isOpen===false?"rgba(211,47,47,0.92)":"rgba(100,116,139,0.85)",backdropFilter:"blur(6px)",color:"#fff",padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"700",display:"flex",alignItems:"center",gap:"5px"}}>
          <span style={{width:"7px",height:"7px",borderRadius:"50%",background:st.isOpen===true?"#69F0AE":st.isOpen===false?"#FF5252":"#fff",display:"inline-block"}}/>
          {st.label}
        </div>
        {p.distanceMiles!=null&&<div style={{position:"absolute",bottom:"12px",right:"12px",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",color:"#fff",padding:"4px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:"700"}}>📍 {formatDistance(p.distanceMiles)}</div>}
      </div>

      <div style={{padding:"16px"}}>
        <div style={{fontWeight:"800",fontSize:"17px",color:T.dark,marginBottom:"8px"}}>{name}</div>
        {p.rating&&(<div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"10px"}}>{[1,2,3,4,5].map(n=><span key={n} style={{color:n<=Math.round(p.rating)?T.gold:"#E2E8F0",fontSize:"14px"}}>★</span>)}<span style={{fontWeight:"700",color:T.dark,fontSize:"13px"}}>{p.rating}</span>{p.userRatingCount>0&&<span style={{color:T.gray,fontSize:"12px"}}>({p.userRatingCount.toLocaleString()})</span>}</div>)}

        {/* Highlight badges */}
        {p.highlights?.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"12px"}}>
            {p.highlights.map((h,i)=>(
              <span key={i} style={{background:T.accentL,color:T.accentD,padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"700"}}>{h}</span>
            ))}
          </div>
        )}

        {activeTags.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"12px"}}>
            {activeTags.map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:"4px",background:t.bg,color:t.color,padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"700"}}>{t.icon} {t.label}</span>)}
          </div>
        )}

        {p.formattedAddress&&(<div style={{display:"flex",alignItems:"flex-start",gap:"9px",marginBottom:"10px",padding:"10px 12px",background:"#F8FAFC",borderRadius:"12px",border:"1px solid #E8EDF2"}}><span style={{fontSize:"18px",marginTop:"1px",flexShrink:0}}>📍</span><span style={{fontSize:"13px",color:T.dark,lineHeight:"1.5",fontWeight:"500"}}>{p.formattedAddress}</span></div>)}

        {(st.today||st.isOpen!==null)&&(<div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px",padding:"10px 12px",background:hBg,borderRadius:"12px"}}><span style={{width:"10px",height:"10px",borderRadius:"50%",background:hDot,flexShrink:0,boxShadow:st.isOpen===true?"0 0 8px rgba(76,175,80,0.6)":"none"}}/><div style={{flex:1,fontSize:"13px"}}><span style={{fontWeight:"700",color:hColor}}>{st.label}</span>{st.today&&<span style={{color:T.gray,marginLeft:"8px"}}>· {st.today}</span>}</div></div>)}

        {p.nationalPhoneNumber?(
          <a href={`tel:${p.nationalPhoneNumber}`} style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px",padding:"11px 14px",background:T.blueL,borderRadius:"12px",textDecoration:"none",border:"1px solid #BBDEFB"}}>
            <div style={{width:"36px",height:"36px",background:T.blue,color:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>📞</div>
            <div><div style={{fontWeight:"700",fontSize:"14px",color:T.blue}}>{p.nationalPhoneNumber}</div><div style={{fontSize:"11px",color:T.gray}}>Tap to call</div></div>
            <span style={{marginLeft:"auto",color:T.blue,fontSize:"20px"}}>›</span>
          </a>
        ):(<div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px",padding:"10px 12px",background:"#F5F5F5",borderRadius:"12px",color:T.gray,fontSize:"13px"}}><span>📞</span><span>Phone not available</span></div>)}

        {p.websiteUri&&(
          <a href={p.websiteUri} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px",padding:"11px 14px",background:T.accentL,borderRadius:"12px",textDecoration:"none",border:`1px solid ${T.accent}40`}}>
            <span style={{fontSize:"20px"}}>🌐</span><span style={{fontWeight:"700",fontSize:"13px",color:T.accentD,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Visit Website</span><span style={{color:T.accentD,fontSize:"20px"}}>›</span>
          </a>
        )}

        <div style={{display:"flex",gap:"8px"}}>
          <motion.button whileTap={{scale:0.96}} onClick={()=>setDirs(true)} style={{flex:2,display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",padding:"12px",borderRadius:"12px",border:"none",fontSize:"14px",fontWeight:"700",cursor:"pointer",background:`linear-gradient(135deg,${T.accentD},${T.accent})`,color:"#fff",fontFamily:"inherit",boxShadow:`0 4px 14px ${T.accent}40`}}>🧭 Directions</motion.button>
          <motion.button whileTap={{scale:0.96}} onClick={()=>onMap?.(index)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",padding:"12px",borderRadius:"12px",border:"none",fontSize:"13px",fontWeight:"700",cursor:"pointer",background:T.accentL,color:T.accentD,fontFamily:"inherit"}}>🗺️ Map</motion.button>
          {p.hours?.length>0&&(<motion.button whileTap={{scale:0.96}} onClick={()=>setExp(e=>!e)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"12px",borderRadius:"12px",border:"none",fontSize:"13px",fontWeight:"700",cursor:"pointer",background:exp?T.dark:T.grayL,color:exp?"#fff":T.dark,fontFamily:"inherit"}}>{exp?"▲":"▼ Hrs"}</motion.button>)}
        </div>

        <AnimatePresence>{exp&&p.hours?.length>0&&(<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}><div style={{marginTop:"12px",padding:"14px",background:"#F8FAFC",borderRadius:"12px",border:"1px solid #E8EDF2"}}>
          <div style={{fontSize:"11px",color:T.gray,fontWeight:"700",marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.5px"}}>🕐 Weekly Hours</div>
          {p.hours.map((d,i)=>{const today=new Date().getDay();const dn=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];const di=dn.findIndex(n=>d.toLowerCase().startsWith(n.toLowerCase()));const isT=di===today;const pts=d.split(":");const dn2=pts[0];const hrs=pts.slice(1).join(":").trim();return(<div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:"13px",color:isT?T.accentD:T.dark,fontWeight:isT?"700":"400",padding:isT?"7px 10px":"5px 2px",background:isT?`${T.accent}12`:"transparent",margin:isT?"2px -2px":"0",borderRadius:isT?"8px":"0",borderLeft:isT?`3px solid ${T.accent}`:"3px solid transparent"}}><span>{dn2}{isT&&<span style={{fontSize:"10px",color:T.accent,marginLeft:"5px",fontWeight:"800"}}>TODAY</span>}</span><span style={{color:hrs.toLowerCase()==="closed"?T.coral:isT?T.accentD:T.gray}}>{hrs}</span></div>);})}
        </div></motion.div>)}</AnimatePresence>
      </div>
      <Directions isOpen={dirs} onClose={()=>setDirs(false)} lat={p.lat} lng={p.lng} name={name} userLat={userLat} userLng={userLng}/>
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

  useEffect(()=>{ setRadius(activeLocation?.suggestedRadius ?? 10); }, [activeLocation?.placeId]);

  useEffect(()=>{
    if(!lat||!lng) return; setLoading(true); setError(null);
    (async()=>{
      try{
        const {data}=await base44.functions.invoke("getShoppingPlaces",{latitude:lat,longitude:lng,radius:radius*1609,maxResults:30,category});
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
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:`<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,iconSize:[16,16],className:""})}).addTo(map);
      filtered.forEach((p,i)=>{
        if(!p.lat||!p.lng) return;
        const active=activePin===i; const color=active?"#FF6B35":p.venueColor||T.accent; const sz=active?36:30;
        const mk=window.L.marker([p.lat,p.lng],{icon:window.L.divIcon({html:`<div style="width:${sz}px;height:${sz}px;background:${color};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${active?14:12}px;box-shadow:0 3px 12px ${color}70;border:${active?3:2}px solid #fff;">${p.venueIcon||"🛍️"}</div>`,iconSize:[sz,sz],className:""})}).addTo(map);
        const st=openStatus(p);
        mk.bindPopup(`<div style="font-family:-apple-system,sans-serif;width:260px;position:relative;"><button onclick="window._gsSHMapInst?.closePopup()" style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#64748B;font-size:13px;z-index:10;">✕</button><div style="padding:12px 14px;"><div onclick="window._gsSHView&&window._gsSHView(${i})" style="font-weight:700;font-size:15px;color:#1A2332;margin-bottom:5px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding-right:26px;line-height:1.3;">${p.displayName?.text||p.name}</div><div style="font-size:12px;color:#64748B;margin-bottom:7px;">📍 ${p.formattedAddress||''}</div><div style="font-size:12px;padding:6px 9px;border-radius:7px;background:${st.isOpen===true?"#F0FDF4":st.isOpen===false?"#FEF2F2":"#F5F5F5"};margin-bottom:10px;"><span style="font-weight:700;color:${st.isOpen===true?"#15803D":st.isOpen===false?"#DC2626":"#9E9E9E"};">${st.label}</span></div><div style="display:flex;gap:8px;"><button onclick="window._gsSHDirs&&window._gsSHDirs(${i})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#3B82F6;color:#fff;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit;">🧭 Directions</button><button onclick="window._gsSHView&&window._gsSHView(${i})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit;">📋 Details</button></div></div></div>`,{maxWidth:280,className:"gs-popup",autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true});
        mk.on("popupopen",()=>setActivePin(i)); markers.current[i]=mk;
      });
      if(activePin!==null) setTimeout(()=>markers.current[activePin]?.openPopup(),200);
    };
    if(!window.L){const lk=document.createElement("link");lk.rel="stylesheet";lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(lk);const sc=document.createElement("script");sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";sc.onload=init;document.head.appendChild(sc);}else init();
    return()=>{delete window._gsSHMapInst;delete window._gsSHView;delete window._gsSHDirs;if(mapInst.current){mapInst.current.remove();mapInst.current=null;}};
  },[viewMode,filtered,lat,lng,activePin]);

  return(
    <div style={{fontFamily:"'DM Sans',-apple-system,sans-serif",background:"#F0F4F8",minHeight:"100vh"}}>
      <div style={{background:`linear-gradient(160deg,${T.dark} 0%,${T.dark2} 40%,${T.accentD} 100%)`,padding:"16px 16px 0"}}>
        <button onClick={()=>window.history.back()} style={{display:"flex",alignItems:"center",gap:"6px",background:"none",border:"none",padding:"0 0 12px",color:"rgba(255,255,255,0.75)",fontSize:"14px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
        <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"16px"}}>
          <div style={{width:"52px",height:"52px",background:"rgba(255,255,255,0.12)",borderRadius:"16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.15)"}}>🛍️</div>
          <div><div style={{fontWeight:"800",fontSize:"22px",color:"#fff",letterSpacing:"-0.3px"}}>Shopping</div><div style={{fontSize:"12px",color:"rgba(255,255,255,0.65)",marginTop:"2px"}}>🛒 Groceries · Farmers Markets · Supermarkets · 🛍️ Malls · Souks · Worldwide</div></div>
        </div>
        <motion.div whileTap={{scale:0.99}} onClick={()=>setLocPicker(true)} style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 14px",background:"rgba(255,255,255,0.1)",backdropFilter:"blur(10px)",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.15)",marginBottom:"14px",cursor:"pointer"}}>
          <span style={{fontSize:"18px"}}>{isCity ? '🏙️' : '📍'}</span><span style={{flex:1,color:"rgba(255,255,255,0.9)",fontSize:"13px",fontWeight:"600",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{locLabel}</span>
          <span style={{background:T.accent,color:"#fff",padding:"5px 12px",borderRadius:"8px",fontWeight:"700",fontSize:"12px",flexShrink:0}}>Change</span>
        </motion.div>
        {isCity && (
          <div style={{fontSize:"11px",color:"#fff",padding:"8px 10px",background:"rgba(252,211,77,0.18)",border:"1px solid rgba(252,211,77,0.45)",borderRadius:"10px",marginBottom:"12px",lineHeight:1.4}}>
            💡 Showing places across {activeLocation?.address?.city || activeLocation?.placeName} — {CITY_DISCLAIMER}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px",flexWrap:"wrap"}}>
          <span style={{fontSize:"12px",color:"rgba(255,255,255,0.6)",fontWeight:"600",flexShrink:0}}>Radius:</span>
          <div style={{display:"flex",gap:"5px"}}>{[5,10,15,25].map(r=><button key={r} onClick={()=>setRadius(r)} style={{padding:"6px 12px",borderRadius:"20px",border:radius===r?`2px solid ${T.accent}`:"1px solid rgba(255,255,255,0.2)",background:radius===r?T.accent:"rgba(255,255,255,0.1)",color:radius===r?"#fff":"rgba(255,255,255,0.7)",fontWeight:radius===r?"700":"500",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{r} mi</button>)}</div>
          <DistanceUnitToggle unit={unit} setUnit={setUnit} variant="dark" style={{marginLeft:"auto"}}/>
          <span style={{fontSize:"11px",color:"rgba(255,255,255,0.5)"}}>{loading?"Searching…":`${places.length} found`}</span>
        </div>
        <div style={{overflowX:"auto",scrollbarWidth:"none",paddingBottom:"2px"}}><div style={{display:"flex",gap:"7px",paddingBottom:"14px"}}>{CATEGORIES.map(c=><motion.button key={c.id} whileTap={{scale:0.94}} onClick={()=>setCategory(c.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",padding:"8px 12px",borderRadius:"14px",flexShrink:0,border:category===c.id?`2px solid ${c.color}`:"1.5px solid rgba(255,255,255,0.2)",background:category===c.id?`${c.color}22`:"rgba(255,255,255,0.08)",color:category===c.id?c.color:"rgba(255,255,255,0.75)",fontWeight:category===c.id?"700":"500",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",minWidth:"64px",backdropFilter:"blur(6px)"}}><span style={{fontSize:"18px"}}>{c.icon}</span><span>{c.label}</span></motion.button>)}</div></div>
      </div>
      <div style={{background:"#fff",padding:"10px 14px",borderBottom:"1px solid #E8EDF2",display:"flex",alignItems:"center",gap:"8px",overflowX:"auto",scrollbarWidth:"none"}}>
        {[{label:"🟢 Open Now",state:openOnly,set:setOpenOnly,color:T.green},{label:"🛒 Food Only",state:foodOnly,set:setFoodOnly,color:"#2E7D32"},{label:"💎 Luxury",state:luxOnly,set:setLuxOnly,color:"#BE185D"}].map(f=><button key={f.label} onClick={()=>f.set((x)=>!x)} style={{display:"flex",alignItems:"center",gap:"5px",padding:"7px 13px",borderRadius:"20px",flexShrink:0,border:f.state?`2px solid ${f.color}`:"1.5px solid #E2E8F0",background:f.state?f.color+"18":"#fff",color:f.state?f.color:T.gray,fontWeight:f.state?"700":"500",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{f.label}</button>)}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
          <span style={{background:T.accent,color:"#fff",padding:"2px 9px",borderRadius:"10px",fontWeight:"800",fontSize:"12px"}}>{filtered.length}</span>
          <div style={{display:"flex",gap:"3px"}}>{["list","map"].map(v=><button key={v} onClick={()=>setViewMode(v)} style={{padding:"6px 11px",borderRadius:"8px",border:"none",background:viewMode===v?T.accent:"#E2E8F0",color:viewMode===v?"#fff":T.gray,fontWeight:"700",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{v==="list"?"List View":"Map View"}</button>)}</div>
        </div>
      </div>
      {loading?(<div style={{textAlign:"center",padding:"70px 24px"}}><motion.div animate={{scale:[1,1.1,1],rotate:[0,5,-5,0]}} transition={{repeat:Infinity,duration:1.8}} style={{fontSize:"52px",marginBottom:"16px",display:"inline-block"}}>🛍️</motion.div><div style={{color:T.dark,fontWeight:"700",fontSize:"16px",marginBottom:"6px"}}>Finding shopping nearby…</div><div style={{color:T.gray,fontSize:"13px"}}>Malls · Markets · Boutiques · Souks · Night Markets</div><div style={{display:"flex",justifyContent:"center",gap:"6px",marginTop:"18px"}}>{[0,1,2].map(i=><motion.div key={i} animate={{opacity:[0.3,1,0.3]}} transition={{repeat:Infinity,duration:1.2,delay:i*0.2}} style={{width:"8px",height:"8px",borderRadius:"50%",background:T.accent}}/>)}</div></div>)
      :error?(<div style={{textAlign:"center",padding:"70px 24px"}}><div style={{fontSize:"48px",marginBottom:"14px"}}>😕</div><div style={{color:T.coral,fontWeight:"700",fontSize:"16px"}}>{error}</div><button onClick={()=>setRadius(r=>Math.min(r+5,25))} style={{marginTop:"14px",padding:"12px 24px",borderRadius:"12px",border:"none",background:`linear-gradient(135deg,${T.accentD},${T.accent})`,color:"#fff",fontWeight:"700",fontSize:"14px",cursor:"pointer",fontFamily:"inherit"}}>Expand Radius</button></div>)
      :viewMode==="list"?(<div style={{padding:"14px 12px 100px",display:"flex",flexDirection:"column",gap:"14px"}}>{filtered.length===0?<div style={{textAlign:"center",padding:"50px 24px",background:"#fff",borderRadius:"20px"}}><div style={{fontSize:"52px",marginBottom:"14px"}}>🔍</div><div style={{fontWeight:"800",fontSize:"18px",color:T.dark}}>No matches</div></div>:filtered.map((p,i)=><ShopCard key={p.id||i} p={p} index={i} onMap={handleMap} isHighlighted={highlight===i} cardRef={(el)=>cardRefs.current[i]=el} forceExpanded={expandedIdx===i} userLat={lat} userLng={lng} formatDistance={formatDistance}/>)}</div>)
      :(<div style={{position:"relative"}}><div ref={mapRef} style={{height:"calc(100vh - 230px)",width:"100%"}}/><button onClick={()=>setViewMode("list")} style={{position:"absolute",top:"14px",right:"14px",zIndex:1000,background:"#fff",borderRadius:"50%",width:"42px",height:"42px",border:"none",boxShadow:"0 3px 12px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"20px",color:T.dark}}>✕</button></div>)}
      <style>{`::-webkit-scrollbar{display:none}.gs-popup .leaflet-popup-content-wrapper{border-radius:16px;padding:0;overflow:hidden;}.gs-popup .leaflet-popup-content{margin:0;}.gs-popup .leaflet-popup-tip-container{display:none;}`}</style>
      <AnimatePresence>{dirsP&&<Directions isOpen={true} onClose={()=>setDirsP(null)} lat={dirsP.lat} lng={dirsP.lng} name={dirsP.displayName?.text||dirsP.name} userLat={lat} userLng={lng}/>}</AnimatePresence>
      <LocationModePicker isOpen={locPicker} onClose={()=>setLocPicker(false)}/>
    </div>
  );
}