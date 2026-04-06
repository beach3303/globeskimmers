import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import LocationModePicker from "@/components/location/LocationModePicker";
import { base44 } from "@/api/base44Client";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";

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
];

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

function QualityMeter({score}){
  const pct=Math.max(0,Math.min(100,score||0));
  const color=pct>=70?T.green:pct>=45?T.gold:T.coral;
  const label=pct>=70?"Great":pct>=45?"Good":"Fair";
  return(
    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
      <span style={{fontSize:"12px",color:T.gray,fontWeight:"600",flexShrink:0}}>Score</span>
      <div style={{flex:1,height:"6px",background:"#E2E8F0",borderRadius:"3px",overflow:"hidden"}}>
        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:0.3,duration:0.6}} style={{height:"100%",background:color,borderRadius:"3px"}}/>
      </div>
      <span style={{fontSize:"12px",fontWeight:"700",color,flexShrink:0}}>{label}</span>
    </div>
  );
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

function PhotoStrip({photos,fallback="⭐",bg,onPhotoClick}){
  const [err,setErr]=useState({}); const [ld,setLd]=useState({0:true,1:true});
  const valid=(photos||[]).filter((_,i)=>_&&!err[i]);
  const fbBg=bg||`linear-gradient(135deg,${T.accentL},#FDE68A)`;
  if(!valid.length) return <div style={{height:"130px",background:fbBg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"52px",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.15))"}}>{fallback}</span></div>;
  if(valid.length===1) return(<div style={{position:"relative",height:"170px",overflow:"hidden",cursor:"pointer"}} onClick={()=>onPhotoClick?.(0)}>{ld[0]&&<div style={{position:"absolute",inset:0,background:fbBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"40px"}}>{fallback}</div>}<img src={valid[0]} alt="" onError={()=>setErr((p)=>({...p,0:true}))} onLoad={()=>setLd((p)=>({...p,0:false}))} style={{width:"100%",height:"170px",objectFit:"cover",opacity:ld[0]?0:1,transition:"opacity 0.4s"}}/></div>);
  return(<div style={{display:"grid",gridTemplateColumns:"60% 40%",height:"150px",overflow:"hidden"}}>{valid.slice(0,2).map((url,i)=>(<div key={i} style={{position:"relative",overflow:"hidden",borderRight:i===0?"2px solid #fff":"none",cursor:"pointer"}} onClick={()=>onPhotoClick?.(i)}>{ld[i]&&<div style={{position:"absolute",inset:0,background:T.accentL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"30px"}}>{fallback}</div>}<img src={url} alt="" onError={()=>setErr((p)=>({...p,[i]:true}))} onLoad={()=>setLd((p)=>({...p,[i]:false}))} style={{width:"100%",height:"150px",objectFit:"cover",opacity:ld[i]?0:1,transition:"opacity 0.4s"}}/></div>))}</div>);
}

function ActivityCard({a,index,onMap,isHighlighted,cardRef,forceExpanded,userLat,userLng}){
  const [dirs,setDirs]=useState(false); const [exp,setExp]=useState(false); const [gallery,setGallery]=useState({open:false,idx:0});
  useEffect(()=>{if(forceExpanded)setExp(true);},[forceExpanded]);
  const name=a.displayName?.text||a.name||"Activity"; const st=openStatus(a);
  const hBg=st.isOpen===true?"#E8F5E9":st.isOpen===false?"#FFEBEE":"#F5F5F5";
  const hColor=st.isOpen===true?"#2E7D32":st.isOpen===false?"#D32F2F":T.gray;
  const hDot=st.isOpen===true?T.green:st.isOpen===false?T.coral:T.gray;
  const activeTags=PROP_TAGS.filter(t=>a.props?.[t.key]);
  const aColor=a.activityColor||T.accent;
  const gradBg=`linear-gradient(135deg,${aColor}ee,${aColor}99)`;

  return(
    <motion.div ref={cardRef} initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:index*0.05,type:"spring",stiffness:260,damping:20}}
      style={{background:"#fff",borderRadius:"20px",boxShadow:isHighlighted?`0 0 0 3px ${T.accent},0 8px 32px rgba(245,158,11,0.22)`:"0 2px 16px rgba(0,0,0,0.07)",overflow:"hidden",border:isHighlighted?`2px solid ${T.accent}`:"1px solid #E8EDF2",transition:"box-shadow 0.3s,border 0.3s"}}>
      <div style={{position:"relative"}}>
        <PhotoStrip photos={a.photos} fallback={a.activityIcon||"⭐"} bg={gradBg} onPhotoClick={(i)=>setGallery({open:true,idx:i})}/>
        {/* Rank badge */}
        <div style={{position:"absolute",top:"12px",left:"12px",background:index===0?"linear-gradient(135deg,#FFD700,#FFA000)":index===1?"linear-gradient(135deg,#B0BEC5,#78909C)":index===2?"linear-gradient(135deg,#FFAB40,#F57C00)":aColor,color:"#fff",width:"30px",height:"30px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800",fontSize:"13px",boxShadow:"0 2px 8px rgba(0,0,0,0.25)"}}>{index+1}</div>
        {/* Category label */}
        <div style={{position:"absolute",top:"12px",right:"12px",background:"rgba(255,255,255,0.95)",backdropFilter:"blur(8px)",padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"800",color:aColor,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>{a.activityIcon} {a.activityLabel}</div>
        {/* Open status */}
        <div style={{position:"absolute",bottom:"12px",left:"12px",background:st.isOpen===true?"rgba(46,125,50,0.92)":st.isOpen===false?"rgba(211,47,47,0.92)":"rgba(100,116,139,0.85)",backdropFilter:"blur(6px)",color:"#fff",padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"700",display:"flex",alignItems:"center",gap:"5px"}}><span style={{width:"7px",height:"7px",borderRadius:"50%",background:st.isOpen===true?"#69F0AE":st.isOpen===false?"#FF5252":"#fff",display:"inline-block"}}/>{st.label}</div>
        {a.distance&&<div style={{position:"absolute",bottom:"12px",right:"12px",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",color:"#fff",padding:"4px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:"700"}}>📍 {a.distance}</div>}
      </div>

      <div style={{padding:"16px"}}>
        <div style={{fontWeight:"800",fontSize:"17px",color:T.dark,marginBottom:"8px"}}>{name}</div>

        {/* Rating */}
        {a.rating&&(<div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"10px"}}>{[1,2,3,4,5].map(n=><span key={n} style={{color:n<=Math.round(a.rating)?T.gold:"#E2E8F0",fontSize:"14px"}}>★</span>)}<span style={{fontWeight:"700",color:T.dark,fontSize:"13px"}}>{a.rating}</span>{a.userRatingCount>0&&<span style={{color:T.gray,fontSize:"12px"}}>({a.userRatingCount.toLocaleString()})</span>}</div>)}

        {/* Quality meter */}
        {a.qualityScore!==undefined&&<QualityMeter score={a.qualityScore}/>}

        {/* Traveler badges */}
        {a.badges?.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"12px"}}>
            {a.badges.map((b,i)=><span key={i} style={{background:T.accentL,color:T.accentD,padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"700"}}>{b}</span>)}
          </div>
        )}

        {/* Property tags */}
        {(activeTags.length>0||a.outdoorContext)&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"12px"}}>
            {a.outdoorContext&&<span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:"#FEF3C7",color:"#92400E",padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"700"}}>🏛️ {a.outdoorContext}</span>}
            {activeTags.map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:"4px",background:t.bg,color:t.color,padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"700"}}>{t.icon} {t.label}</span>)}
          </div>
        )}

        {/* About This Place */}
        {(a.wikiExtract||a.editorialSummary)&&(
          <div style={{marginBottom:"12px",padding:"12px 14px",background:"linear-gradient(135deg,#EDE9FE,#F5F3FF)",borderRadius:"12px",border:"1px solid #DDD6FE"}}>
            <div style={{fontSize:"11px",fontWeight:"800",color:"#7C3AED",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.5px"}}>📖 About This Place</div>
            {a.wikiSummary&&<div style={{fontSize:"11px",color:"#7C3AED",fontWeight:"600",marginBottom:"4px"}}>{a.wikiSummary}</div>}
            <div style={{fontSize:"13px",color:"#374151",lineHeight:"1.6"}}>{a.wikiExtract||a.editorialSummary}</div>
          </div>
        )}
        {/* What People Love */}
        {a.highlights?.length>0&&(
          <div style={{marginBottom:"10px",padding:"10px 12px",background:"#F0FDF4",borderRadius:"12px",border:"1px solid #BBF7D0"}}>
            <div style={{fontSize:"11px",fontWeight:"800",color:"#059669",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.5px"}}>💚 What People Love</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
              {a.highlights.map((h,i)=><span key={i} style={{background:"#D1FAE5",color:"#065F46",padding:"3px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:"600",textTransform:"capitalize"}}>{h}</span>)}
            </div>
          </div>
        )}
        {/* Heads Up */}
        {a.warnings?.length>0&&(
          <div style={{marginBottom:"10px",padding:"10px 12px",background:"#FFF7ED",borderRadius:"12px",border:"1px solid #FED7AA"}}>
            <div style={{fontSize:"11px",fontWeight:"800",color:"#D97706",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.5px"}}>⚠️ Heads Up</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
              {a.warnings.map((w,i)=><span key={i} style={{background:"#FEF3C7",color:"#92400E",padding:"3px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:"600",textTransform:"capitalize"}}>{w}</span>)}
            </div>
          </div>
        )}
        {/* Best Time to Visit */}
        {a.bestTime&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px",padding:"9px 12px",background:"#EFF6FF",borderRadius:"12px",border:"1px solid #BFDBFE"}}>
            <span style={{fontSize:"16px"}}>🕐</span>
            <div style={{fontSize:"13px",color:"#1E40AF"}}><span style={{fontWeight:"700"}}>Best time: </span>{a.bestTime}</div>
          </div>
        )}
        {a.formattedAddress&&(<div style={{display:"flex",alignItems:"flex-start",gap:"9px",marginBottom:"10px",padding:"10px 12px",background:"#F8FAFC",borderRadius:"12px",border:"1px solid #E8EDF2"}}><span style={{fontSize:"18px",marginTop:"1px",flexShrink:0}}>📍</span><span style={{fontSize:"13px",color:T.dark,lineHeight:"1.5",fontWeight:"500"}}>{a.formattedAddress}</span></div>)}

        {(st.today||st.isOpen!==null)&&(<div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px",padding:"10px 12px",background:hBg,borderRadius:"12px"}}><span style={{width:"10px",height:"10px",borderRadius:"50%",background:hDot,flexShrink:0,boxShadow:st.isOpen===true?"0 0 8px rgba(76,175,80,0.6)":"none"}}/><div style={{flex:1,fontSize:"13px"}}><span style={{fontWeight:"700",color:hColor}}>{st.label}</span>{st.today&&<span style={{color:T.gray,marginLeft:"8px"}}>· {st.today}</span>}</div></div>)}

        {a.nationalPhoneNumber?(
          <a href={`tel:${a.nationalPhoneNumber}`} style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px",padding:"11px 14px",background:T.blueL,borderRadius:"12px",textDecoration:"none",border:"1px solid #BBDEFB"}}>
            <div style={{width:"36px",height:"36px",background:T.blue,color:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>📞</div>
            <div><div style={{fontWeight:"700",fontSize:"14px",color:T.blue}}>{a.nationalPhoneNumber}</div><div style={{fontSize:"11px",color:T.gray}}>Tap to call / book</div></div>
            <span style={{marginLeft:"auto",color:T.blue,fontSize:"20px"}}>›</span>
          </a>
        ):(<div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px",padding:"10px 12px",background:"#F5F5F5",borderRadius:"12px",color:T.gray,fontSize:"13px"}}><span>📞</span><span>Phone not available</span></div>)}

        {a.websiteUri&&(<a href={a.websiteUri} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px",padding:"11px 14px",background:T.accentL,borderRadius:"12px",textDecoration:"none",border:`1px solid ${T.accent}40`}}><span style={{fontSize:"20px"}}>🌐</span><span style={{fontWeight:"700",fontSize:"13px",color:T.accentD,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Visit Website / Book</span><span style={{color:T.accentD,fontSize:"20px"}}>›</span></a>)}

        <div style={{display:"flex",gap:"8px"}}>
          <motion.button whileTap={{scale:0.96}} onClick={()=>setDirs(true)} style={{flex:2,display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",padding:"12px",borderRadius:"12px",border:"none",fontSize:"14px",fontWeight:"700",cursor:"pointer",background:`linear-gradient(135deg,${T.accentD},${T.accent})`,color:"#fff",fontFamily:"inherit",boxShadow:`0 4px 14px ${T.accent}40`}}>🧭 Directions</motion.button>
          <motion.button whileTap={{scale:0.96}} onClick={()=>onMap?.(index)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",padding:"12px",borderRadius:"12px",border:"none",fontSize:"13px",fontWeight:"700",cursor:"pointer",background:"#EDE9FE",color:"#7C3AED",fontFamily:"inherit"}}>🗺️ Map</motion.button>
          {a.hours?.length>0&&(<motion.button whileTap={{scale:0.96}} onClick={()=>setExp(e=>!e)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"12px",borderRadius:"12px",border:"none",fontSize:"13px",fontWeight:"700",cursor:"pointer",background:exp?T.dark:T.grayL,color:exp?"#fff":T.dark,fontFamily:"inherit"}}>{exp?"▲":"▼ Hrs"}</motion.button>)}
        </div>

        <AnimatePresence>{exp&&a.hours?.length>0&&(<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}><div style={{marginTop:"12px",padding:"14px",background:"#F8FAFC",borderRadius:"12px",border:"1px solid #E8EDF2"}}>
          <div style={{fontSize:"11px",color:T.gray,fontWeight:"700",marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.5px"}}>🕐 Weekly Hours</div>
          {a.hours.map((d,i)=>{const today=new Date().getDay();const dn=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];const di=dn.findIndex(n=>d.toLowerCase().startsWith(n.toLowerCase()));const isT=di===today;const pts=d.split(":");const dn2=pts[0];const hrs=pts.slice(1).join(":").trim();return(<div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:"13px",color:isT?T.accentD:T.dark,fontWeight:isT?"700":"400",padding:isT?"7px 10px":"5px 2px",background:isT?`${T.accent}12`:"transparent",margin:isT?"2px -2px":"0",borderRadius:isT?"8px":"0",borderLeft:isT?`3px solid ${T.accent}`:"3px solid transparent"}}><span>{dn2}{isT&&<span style={{fontSize:"10px",color:T.accent,marginLeft:"5px",fontWeight:"800"}}>TODAY</span>}</span><span style={{color:hrs.toLowerCase()==="closed"?T.coral:isT?T.accentD:T.gray}}>{hrs}</span></div>);})}
        </div></motion.div>)}</AnimatePresence>
      </div>
      <Directions isOpen={dirs} onClose={()=>setDirs(false)} lat={a.lat} lng={a.lng} name={name} userLat={userLat} userLng={userLng}/>
      <PhotoGalleryModal photos={a.photos||[]} initialIndex={gallery.idx} isOpen={gallery.open} onClose={()=>setGallery({open:false,idx:0})}/>
    </motion.div>
  );
}

export default function ThingsToDoFinder() {
  const [activities,setActivities]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [viewMode,setViewMode]=useState("list");
  const [category,setCategory]=useState("all");
  const [radius,setRadius]=useState(15);
  const [openOnly,setOpenOnly]=useState(false);
  const [freeOnly,setFreeOnly]=useState(false);
  const [bucketOnly,setBucketOnly]=useState(false);
  const [couplesOnly,setCouplesOnly]=useState(false);
  const [kidsOnly,setKidsOnly]=useState(false);
  const [seniorsOnly,setSeniorsOnly]=useState(false);
  const [petOnly,setPetOnly]=useState(false);
  const [outdoorOnly,setOutdoorOnly]=useState(false);
  const [showAdvanced,setShowAdvanced]=useState(false);
  const [locPicker,setLocPicker]=useState(false);
  const [dirsA,setDirsA]=useState(null);
  const [highlight,setHighlight]=useState(null);
  const [expandedIdx,setExpandedIdx]=useState(null);
  const [activePin,setActivePin]=useState(null);
  const cardRefs=useRef({});
  const mapRef=useRef(null); const mapInst=useRef(null); const markers=useRef([]);
  const {activeLocation}=useLocation();
  const lat=activeLocation?.coordinates?.latitude; const lng=activeLocation?.coordinates?.longitude;
  const locLabel=activeLocation?.label||activeLocation?.address?.formatted||"Set your location";

  useEffect(()=>{
    if(!lat||!lng) return; setLoading(true); setError(null);
    (async()=>{
      try{
        const {data}=await base44.functions.invoke("getActivities",{latitude:lat,longitude:lng,radius:radius*1609,maxResults:30,category,smartRadius:radius>25});
        const raw=data?.activities||[];
        if(raw.length) setActivities(raw); else setError(data?.error||"No activities found nearby.");
      }catch(e){setError(`Failed: ${e.message}`);}
      finally{setLoading(false);}
    })();
  },[lat,lng,radius,category]);

  const filtered=useMemo(()=>{
    let r=[...activities];
    if(openOnly)    r=r.filter(a=>a.isOpen===true);
    if(freeOnly)    r=r.filter(a=>a.props?.isFree);
    if(bucketOnly)  r=r.filter(a=>a.props?.isBucketList);
    if(couplesOnly) r=r.filter(a=>a.props?.isGoodForCouples);
    if(kidsOnly)    r=r.filter(a=>a.props?.isFamilyFriendly);
    if(seniorsOnly) r=r.filter(a=>a.props?.isSeniorFriendly);
    if(petOnly)     r=r.filter(a=>a.props?.isPetFriendly);
    if(outdoorOnly) r=r.filter(a=>a.props?.isOutdoor);
    return r;
  },[activities,openOnly,freeOnly,bucketOnly,couplesOnly,kidsOnly,seniorsOnly,petOnly,outdoorOnly]);

  const handleMap=(i)=>{setViewMode("map");setActivePin(i);setTimeout(()=>{const a=filtered[i];if(mapInst.current&&a?.lat&&a?.lng){mapInst.current.setView([a.lat,a.lng],17);markers.current[i]?.openPopup();}},350);};

  useEffect(()=>{
    if(viewMode!=="map"||!mapRef.current||!lat||!lng) return;
    const init=()=>{
      if(mapInst.current) mapInst.current.remove(); markers.current=[];
      const map=window.L.map(mapRef.current).setView([lat,lng],13);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
      mapInst.current=map; window._gsTDMapInst=map;
      window._gsTDView=(i)=>{map.closePopup();setViewMode("list");setExpandedIdx(i);setHighlight(i);setTimeout(()=>cardRefs.current[i]?.scrollIntoView({behavior:"smooth",block:"center"}),150);setTimeout(()=>setHighlight(null),2800);};
      window._gsTDDirs=(i)=>setDirsA(filtered[i]);
      window.L.marker([lat,lng],{icon:window.L.divIcon({html:`<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,iconSize:[16,16],className:""})}).addTo(map);
      filtered.forEach((a,i)=>{
        if(!a.lat||!a.lng) return;
        const active=activePin===i; const color=active?"#FF6B35":a.activityColor||T.accent; const sz=active?36:30;
        const mk=window.L.marker([a.lat,a.lng],{icon:window.L.divIcon({html:`<div style="width:${sz}px;height:${sz}px;background:${color};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${active?14:12}px;box-shadow:0 3px 12px ${color}70;border:${active?3:2}px solid #fff;">${a.activityIcon||"⭐"}</div>`,iconSize:[sz,sz],className:""})}).addTo(map);
        const st=openStatus(a);
        mk.bindPopup(`<div style="font-family:-apple-system,sans-serif;width:260px;position:relative;"><button onclick="window._gsTDMapInst?.closePopup()" style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#64748B;font-size:13px;z-index:10;">✕</button><div style="padding:12px 14px;"><div onclick="window._gsTDView&&window._gsTDView(${i})" style="font-weight:700;font-size:15px;color:#1A2332;margin-bottom:5px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding-right:26px;line-height:1.3;">${a.displayName?.text||a.name}</div><div style="font-size:12px;color:#64748B;margin-bottom:7px;">📍 ${a.formattedAddress||''}</div>${a.rating?`<div style="font-size:12px;color:#F59E0B;margin-bottom:7px;">★ <strong style="color:#1A2332;">${a.rating}</strong>${a.userRatingCount>0?` <span style="color:#64748B;">(${a.userRatingCount})</span>`:""}</div>`:""}<div style="font-size:12px;padding:6px 9px;border-radius:7px;background:${st.isOpen===true?"#F0FDF4":st.isOpen===false?"#FEF2F2":"#F5F5F5"};margin-bottom:10px;"><span style="font-weight:700;color:${st.isOpen===true?"#15803D":st.isOpen===false?"#DC2626":"#9E9E9E"};">${st.label}</span></div><div style="display:flex;gap:8px;"><button onclick="window._gsTDDirs&&window._gsTDDirs(${i})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#3B82F6;color:#fff;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit;">🧭 Directions</button><button onclick="window._gsTDView&&window._gsTDView(${i})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit;">📋 Details</button></div></div></div>`,{maxWidth:280,className:"gs-popup",autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true});
        mk.on("popupopen",()=>setActivePin(i)); markers.current[i]=mk;
      });
      if(activePin!==null) setTimeout(()=>markers.current[activePin]?.openPopup(),200);
    };
    if(!window.L){const lk=document.createElement("link");lk.rel="stylesheet";lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(lk);const sc=document.createElement("script");sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";sc.onload=init;document.head.appendChild(sc);}else init();
    return()=>{delete window._gsTDMapInst;delete window._gsTDView;delete window._gsTDDirs;if(mapInst.current){mapInst.current.remove();mapInst.current=null;}};
  },[viewMode,filtered,lat,lng,activePin]);

  const stats={total:filtered.length,free:filtered.filter((a)=>a.props?.isFree).length,bucket:filtered.filter((a)=>a.props?.isBucketList).length};
  const advFilterCount=[openOnly,freeOnly,bucketOnly,couplesOnly,kidsOnly,seniorsOnly,petOnly,outdoorOnly].filter(Boolean).length;
  const clearFilters=()=>{setOpenOnly(false);setFreeOnly(false);setBucketOnly(false);setCouplesOnly(false);setKidsOnly(false);setSeniorsOnly(false);setPetOnly(false);setOutdoorOnly(false);};

  return(
    <div style={{fontFamily:"'DM Sans',-apple-system,sans-serif",background:"#F0F4F8",minHeight:"100vh"}}>
      <div style={{background:`linear-gradient(160deg,${T.dark} 0%,${T.dark2} 40%,${T.accentD} 100%)`,padding:"16px 16px 16px"}}>
        <button onClick={()=>window.history.back()} style={{display:"flex",alignItems:"center",gap:"6px",background:"none",border:"none",padding:"0 0 12px",color:"rgba(255,255,255,0.75)",fontSize:"14px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
        <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"16px"}}>
          <div style={{width:"52px",height:"52px",background:"rgba(255,255,255,0.12)",borderRadius:"16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.15)"}}>⭐</div>
          <div><div style={{fontWeight:"800",fontSize:"22px",color:"#fff",letterSpacing:"-0.3px"}}>Things To Do</div><div style={{fontSize:"12px",color:"rgba(255,255,255,0.65)",marginTop:"2px"}}>Landmarks · Museums · Parks · Nightlife · Tours · Worldwide</div></div>
        </div>
        <motion.div whileTap={{scale:0.99}} onClick={()=>setLocPicker(true)} style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 14px",background:"rgba(255,255,255,0.1)",backdropFilter:"blur(10px)",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.15)",marginBottom:"14px",cursor:"pointer"}}>
          <span style={{fontSize:"18px"}}>📍</span><span style={{flex:1,color:"rgba(255,255,255,0.9)",fontSize:"13px",fontWeight:"600",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{locLabel}</span>
          <span style={{background:T.accent,color:"#fff",padding:"5px 12px",borderRadius:"8px",fontWeight:"700",fontSize:"12px",flexShrink:0}}>Change</span>
        </motion.div>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:radius>25?"6px":"14px"}}>
          <span style={{fontSize:"12px",color:"rgba(255,255,255,0.6)",fontWeight:"600",flexShrink:0}}>Radius:</span>
          <div style={{display:"flex",gap:"5px"}}>{[5,10,15,25,50].map(r=><button key={r} onClick={()=>setRadius(r)} style={{padding:"6px 12px",borderRadius:"20px",border:radius===r?`2px solid ${T.accent}`:"1px solid rgba(255,255,255,0.2)",background:radius===r?T.accent:"rgba(255,255,255,0.1)",color:radius===r?"#fff":"rgba(255,255,255,0.7)",fontWeight:radius===r?"700":"500",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{r} mi</button>)}</div>
          <span style={{fontSize:"11px",color:"rgba(255,255,255,0.5)",marginLeft:"auto"}}>{loading?"Searching…":`${activities.length} found`}</span>
        </div>
        {radius>25&&<div style={{fontSize:"11px",color:"rgba(255,255,255,0.55)",marginBottom:"14px",padding:"0 2px"}}>⭐ Beyond 25mi: showing iconic spots only (landmarks, theme parks, must-see attractions)</div>}
      </div>

      <div style={{background:"#fff",padding:"10px 14px",borderBottom:"1px solid #E8EDF2"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:showAdvanced?"10px":0}}>
          <button onClick={()=>setShowAdvanced(!showAdvanced)} style={{display:"flex",alignItems:"center",gap:"8px",flex:1,padding:"9px 14px",borderRadius:"10px",border:`1.5px solid ${showAdvanced||advFilterCount>0?T.accent:"#E2E8F0"}`,background:showAdvanced||advFilterCount>0?T.accentL:"#fff",color:showAdvanced||advFilterCount>0?T.accentD:T.gray,fontWeight:"600",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>
            <span>🔧 Advanced Filters</span>
            {advFilterCount>0&&<span style={{background:T.accent,color:"#fff",borderRadius:"10px",padding:"1px 7px",fontSize:"11px",fontWeight:"700"}}>{advFilterCount}</span>}
            <span style={{marginLeft:"auto"}}>{showAdvanced?"▲":"▼"}</span>
          </button>
          <span style={{background:T.accent,color:"#fff",padding:"2px 9px",borderRadius:"10px",fontWeight:"800",fontSize:"12px"}}>{stats.total}</span>
          {stats.bucket>0&&<span style={{color:T.accentD,fontSize:"12px",fontWeight:"600"}}>· {stats.bucket} 🏆</span>}
          {stats.free>0&&<span style={{color:"#059679",fontSize:"12px",fontWeight:"600"}}>· {stats.free} free</span>}
          <div style={{display:"flex",gap:"3px"}}>{["list","map"].map(v=><button key={v} onClick={()=>setViewMode(v)} style={{padding:"6px 11px",borderRadius:"8px",border:"none",background:viewMode===v?T.accent:"#E2E8F0",color:viewMode===v?"#fff":T.gray,fontWeight:"700",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>{v==="list"?"📋":"🗺️"}</button>)}</div>
        </div>
        <AnimatePresence>
          {showAdvanced&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{background:"#F8FAFC",borderRadius:"12px",border:"1px solid #E8EDF2",padding:"12px"}}>
                <div style={{fontSize:"10px",fontWeight:"700",color:T.gray,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>Filters</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                  {[
                    {label:"Open Now",icon:"🟢",state:openOnly,set:setOpenOnly,color:T.green},
                    {label:"Free Entry",icon:"🆓",state:freeOnly,set:setFreeOnly,color:"#059669"},
                    {label:"Bucket List",icon:"🏆",state:bucketOnly,set:setBucketOnly,color:T.accentD},
                    {label:"Couples",icon:"💑",state:couplesOnly,set:setCouplesOnly,color:"#DB2777"},
                    {label:"Kid Friendly",icon:"👧",state:kidsOnly,set:setKidsOnly,color:"#D97706"},
                    {label:"Senior Friendly",icon:"🧓",state:seniorsOnly,set:setSeniorsOnly,color:"#0891B2"},
                    {label:"Pet Friendly",icon:"🐾",state:petOnly,set:setPetOnly,color:"#059669"},
                    {label:"Outdoors",icon:"🌳",state:outdoorOnly,set:setOutdoorOnly,color:"#059669"},
                  ].map(f=>(
                    <button key={f.label} onClick={()=>f.set(x=>!x)} style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"6px 12px",borderRadius:"20px",border:f.state?`2px solid ${f.color}`:"1.5px solid #E2E8F0",background:f.state?f.color+"12":"#fff",color:f.state?f.color:T.dark,fontWeight:f.state?"700":"500",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>
                      <span style={{fontSize:"14px"}}>{f.icon}</span>{f.label}
                    </button>
                  ))}
                </div>
                {advFilterCount>0&&<button onClick={clearFilters} style={{padding:"7px",borderRadius:"8px",border:`1.5px solid ${T.coral}`,background:"#FFF5F5",color:T.coral,fontWeight:"700",fontSize:"12px",cursor:"pointer",fontFamily:"inherit",marginTop:"10px",width:"100%"}}>✕ Clear All ({advFilterCount})</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading?(<div style={{textAlign:"center",padding:"70px 24px"}}><motion.div animate={{scale:[1,1.1,1],rotate:[0,5,-5,0]}} transition={{repeat:Infinity,duration:1.8}} style={{fontSize:"52px",marginBottom:"16px",display:"inline-block"}}>⭐</motion.div><div style={{color:T.dark,fontWeight:"700",fontSize:"16px",marginBottom:"6px"}}>Discovering things to do…</div><div style={{color:T.gray,fontSize:"13px"}}>Museums · Parks · Landmarks · Nightlife · Tours</div><div style={{display:"flex",justifyContent:"center",gap:"6px",marginTop:"18px"}}>{[0,1,2].map(i=><motion.div key={i} animate={{opacity:[0.3,1,0.3]}} transition={{repeat:Infinity,duration:1.2,delay:i*0.2}} style={{width:"8px",height:"8px",borderRadius:"50%",background:T.accent}}/>)}</div></div>)
      :error?(<div style={{textAlign:"center",padding:"70px 24px"}}><div style={{fontSize:"48px",marginBottom:"14px"}}>😕</div><div style={{color:T.coral,fontWeight:"700",fontSize:"16px"}}>{error}</div><button onClick={()=>setRadius(r=>Math.min(r+5,25))} style={{marginTop:"14px",padding:"12px 24px",borderRadius:"12px",border:"none",background:`linear-gradient(135deg,${T.accentD},${T.accent})`,color:"#fff",fontWeight:"700",fontSize:"14px",cursor:"pointer",fontFamily:"inherit"}}>Expand Radius</button></div>)
      :viewMode==="list"?(<div style={{padding:"14px 12px 100px",display:"flex",flexDirection:"column",gap:"14px"}}>{filtered.length===0?<div style={{textAlign:"center",padding:"50px 24px",background:"#fff",borderRadius:"20px"}}><div style={{fontSize:"52px",marginBottom:"14px"}}>🔍</div><div style={{fontWeight:"800",fontSize:"18px",color:T.dark}}>No matches</div><div style={{color:T.gray,fontSize:"13px",marginTop:"6px"}}>Try a different category or expand your radius</div></div>:filtered.map((a,i)=><ActivityCard key={a.id||i} a={a} index={i} onMap={handleMap} isHighlighted={highlight===i} cardRef={(el)=>cardRefs.current[i]=el} forceExpanded={expandedIdx===i} userLat={lat} userLng={lng}/>)}</div>)
      :(<div style={{position:"relative"}}><div ref={mapRef} style={{height:"calc(100vh - 230px)",width:"100%"}}/><button onClick={()=>setViewMode("list")} style={{position:"absolute",top:"14px",right:"14px",zIndex:1000,background:"#fff",borderRadius:"50%",width:"42px",height:"42px",border:"none",boxShadow:"0 3px 12px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"20px",color:T.dark}}>✕</button></div>)}

      {showAdvanced&&<button onClick={()=>setShowAdvanced(false)} style={{position:"fixed",bottom:"90px",right:"16px",zIndex:9999,width:"40px",height:"40px",borderRadius:"50%",border:"none",background:T.dark,color:"#fff",fontWeight:"700",fontSize:"18px",cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
      <style>{`::-webkit-scrollbar{display:none}.gs-popup .leaflet-popup-content-wrapper{border-radius:16px;padding:0;overflow:hidden;}.gs-popup .leaflet-popup-content{margin:0;}.gs-popup .leaflet-popup-tip-container{display:none;}`}</style>
      <AnimatePresence>{dirsA&&<Directions isOpen={true} onClose={()=>setDirsA(null)} lat={dirsA.lat} lng={dirsA.lng} name={dirsA.displayName?.text||dirsA.name} userLat={lat} userLng={lng}/>}</AnimatePresence>
      <LocationModePicker isOpen={locPicker} onClose={()=>setLocPicker(false)}/>
    </div>
  );
}