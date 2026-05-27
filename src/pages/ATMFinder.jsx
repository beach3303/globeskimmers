import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation, CITY_DISCLAIMER } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import DistanceUnitToggle from "@/components/location/DistanceUnitToggle";
import LocationModePicker from "@/components/location/LocationModePicker";
import { base44 } from "@/api/base44Client";
import RefreshButton from "@/components/RefreshButton";

// ─── THEME ─────────────────────────────────────────────────────────────────
const TEAL      = "#00BCD4";
const TEAL_DARK = "#00838F";
const TEAL_LIGHT= "#E0F7FA";
const CORAL     = "#FF6B6B";
const GOLD      = "#FFB74D";
const DARK      = "#1A2332";
const GRAY      = "#64748B";
const GREEN     = "#4CAF50";
const BLUE      = "#1976D2";
const PURPLE    = "#7C3AED";

// ─── SMART CATEGORY FILTERS ────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",            label: "All ATMs",        icon: "🏧", desc: "Everywhere" },
  { id: "safe_lobbies",   label: "Safe Lobbies",    icon: "🏦", desc: "Banks, Credit Unions, Hospitals" },
  { id: "airport_transit",label: "Airport/Transit", icon: "✈️", desc: "Airports, Train, Subway, Ferry" },
  { id: "gas_stations",   label: "Gas Stations",    icon: "⛽", desc: "Inside & outside forecourts" },
  { id: "retail",         label: "Retail",          icon: "🏪", desc: "Supermarkets, Pharmacies, Big Box" },
  { id: "small_retail",   label: "Corner Shops",    icon: "🍶", desc: "Liquor Stores, Bodegas, Delis" },
  { id: "shopping",       label: "Shopping",        icon: "🛒", desc: "Malls, Markets, Bazaars" },
  { id: "education",      label: "Schools",         icon: "🎓", desc: "Universities, Colleges, Campuses" },
  { id: "entertainment",  label: "Entertainment",   icon: "🎰", desc: "Casinos, Stadiums, Theme Parks" },
  { id: "hospitality",    label: "Hotels",          icon: "🏨", desc: "Hotels, Resorts, Cruise Terminals" },
  { id: "community",      label: "Community",       icon: "🏛️", desc: "Post Offices, Libraries, Gov't" },
];

// ─── OPEN STATUS ───────────────────────────────────────────────────────────
function computeOpenStatus(atm) {
  const hours =
    atm.currentOpeningHours?.weekdayDescriptions ||
    atm.regularOpeningHours?.weekdayDescriptions ||
    atm.hours || [];

  if (!hours || hours.length === 0) {
    if (atm.isOpen === true)  return { isOpen: true,  todayHours: "Open now",      is24Hours: false };
    if (atm.isOpen === false) return { isOpen: false, todayHours: "Closed",         is24Hours: false };
    return { isOpen: null, todayHours: null, is24Hours: false };
  }

  const now = new Date();
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const todayName = dayNames[now.getDay()];
  const todayEntry = hours.find(h => h && h.toLowerCase().startsWith(todayName.toLowerCase()));
  if (!todayEntry) return { isOpen: null, todayHours: null, is24Hours: false };

  const colonIdx = todayEntry.indexOf(":");
  if (colonIdx === -1) return { isOpen: null, todayHours: todayEntry, is24Hours: false };

  const hoursText = todayEntry.substring(colonIdx + 1).trim();
  if (hoursText.toLowerCase() === "closed") return { isOpen: false, todayHours: "Closed today", is24Hours: false };
  if (hoursText.toLowerCase().includes("24 hour") || hoursText.toLowerCase().includes("open 24")) {
    return { isOpen: true, todayHours: "Open 24 hours", is24Hours: true };
  }

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const ranges = parseHoursText(hoursText);
  for (const r of ranges) {
    if (currentMins >= r.open && currentMins < r.close)
      return { isOpen: true, todayHours: hoursText, is24Hours: false };
  }
  return { isOpen: false, todayHours: hoursText, is24Hours: false };
}

function parseHoursText(text) {
  const ranges = [];
  for (const seg of text.split(",").map(s => s.trim())) {
    const m = seg.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[–\-]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (m) {
      const open = toMins(m[1]);
      let close = toMins(m[2]);
      if (close <= open) close += 1440;
      ranges.push({ open, close });
    }
  }
  return ranges;
}

function toMins(str) {
  const n = str.trim().toUpperCase();
  const m = n.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === "PM" && h !== 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + mins;
}

// ─── ENRICH ATM ────────────────────────────────────────────────────────────
function enrichATM(atm, userLat, userLng) {
  const lat = atm.location?.latitude || atm.lat || 0;
  const lng = atm.location?.longitude || atm.lng || 0;

  let distanceMiles = atm.distanceMiles || null;
  let distance = atm.distanceMiles ? `${atm.distanceMiles.toFixed(1)} mi` : null;
  if (!distanceMiles && userLat && userLng && lat && lng) {
    const R = 3959;
    const dLat = (lat - userLat) * Math.PI / 180;
    const dLon = (lng - userLng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(userLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
    distanceMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    distance = `${distanceMiles.toFixed(1)} mi`;
  }

  const openStatus = computeOpenStatus(atm);

  const weekdayDescriptions =
    atm.currentOpeningHours?.weekdayDescriptions ||
    atm.regularOpeningHours?.weekdayDescriptions ||
    atm.hours || [];

  // Photos — up to 2
  let photos = [];
  if (atm.photos && Array.isArray(atm.photos)) {
    photos = atm.photos.map(p => (typeof p === "string" ? p : p.url)).filter(Boolean).slice(0, 2);
  }
  if (!photos[0] && atm.photoUrl)  photos[0] = atm.photoUrl;
  if (!photos[1] && atm.photoUrl2) photos[1] = atm.photoUrl2;

  // Badges
  const badges = [];
  const venueIcon = atm.venueIcon || "🏧";
  const venueType = atm.venueType || "standalone";
  const network   = atm.network || "Independent";

  if (network !== "Independent") {
    badges.push({ icon: "🏦", label: network, color: "#1565C0", bg: "#E3F2FD" });
  }
  if (atm.feeInfo?.includes("free") || atm.feeInfo?.includes("Free") || network === "Allpoint" || network === "MoneyPass" || network === "CO-OP") {
    badges.push({ icon: "🆓", label: "Fee-Free Net", color: "#2E7D32", bg: "#E8F5E9" });
  }
  if (openStatus.is24Hours) {
    badges.push({ icon: "🕐", label: "24/7", color: "#1565C0", bg: "#E3F2FD" });
  }
  const venueLabels = { airport:"Airport", transit:"Transit/Metro", hospital:"Hospital", hotel:"Hotel", gas:"Gas Station", convenience:"Convenience", mall:"Shopping Mall", grocery:"Grocery", entertainment:"Entertainment", bank:"Bank Branch", education:"School/Campus", community:"Community", liquor:"Liquor/Corner Shop", theme_park:"Theme Park", casino:"Casino" };
  if (venueLabels[venueType]) {
    badges.push({ icon: venueIcon, label: venueLabels[venueType], color: "#5E35B1", bg: "#EDE7F6" });
  }

  return {
    ...atm,
    lat, lng,
    distance, distanceMiles,
    photos,
    isOpen: openStatus.isOpen,
    todayHours: openStatus.todayHours,
    is24Hours: openStatus.is24Hours,
    weekdayDescriptions,
    badges: badges.slice(0, 4),
  };
}

// ─── DIRECTIONS PICKER ─────────────────────────────────────────────────────
function DirectionsPicker({ isOpen, onClose, lat, lng, name, userLat, userLng }) {
  if (!isOpen) return null;
  const origin = userLat && userLng;
  const apps = [
    { key: "google", icon: "🗺️", label: "Google Maps",  url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin?`&origin=${userLat},${userLng}`:""}&travelmode=driving` },
    { key: "apple",  icon: "🍎", label: "Apple Maps",   url: `https://maps.apple.com/?daddr=${lat},${lng}${origin?`&saddr=${userLat},${userLng}`:""}&dirflg=d` },
    { key: "waze",   icon: "📍", label: "Waze",         url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
  ];
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} onClick={e=>e.stopPropagation()}
        style={{ background:"#fff", borderRadius:"20px", padding:"22px", width:"100%", maxWidth:"320px" }}>
        <div style={{ textAlign:"center", marginBottom:"16px" }}>
          <div style={{ fontSize:"13px", color:GRAY }}>Get directions to</div>
          <div style={{ fontSize:"16px", fontWeight:"700", color:DARK }}>{name}</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {apps.map(app => (
            <button key={app.key} onClick={() => { window.open(app.url, "_blank"); onClose(); }}
              style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", borderRadius:"12px", border:"1px solid #E2E8F0", background:"#fff", cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
              <span style={{ fontSize:"24px" }}>{app.icon}</span>
              <span style={{ fontWeight:"600", color:DARK, fontSize:"15px" }}>{app.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop:"14px", width:"100%", padding:"12px", borderRadius:"10px", border:"none", background:"#F1F5F9", color:GRAY, fontWeight:"600", cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
      </motion.div>
    </div>
  );
}

// ─── PHOTO STRIP (up to 2 photos) ──────────────────────────────────────────
function ATMPhotoStrip({ photos, fallbackIcon = "🏧" }) {
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState({ 0: true, 1: true });

  const validPhotos = (photos || []).filter((p, i) => p && !errors[i]);

  if (validPhotos.length === 0) {
    return (
      <div style={{ height:"120px", background:`linear-gradient(135deg, ${TEAL_LIGHT}, #B2EBF2, #80DEEA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"52px" }}>
        {fallbackIcon}
      </div>
    );
  }

  if (validPhotos.length === 1) {
    return (
      <div style={{ position:"relative", height:"160px", overflow:"hidden" }}>
        {loading[0] && (
          <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, ${TEAL_LIGHT}, #B2EBF2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"36px" }}>🏧</div>
        )}
        <img src={validPhotos[0]} alt="" onError={() => setErrors(p => ({...p, 0:true}))} onLoad={() => setLoading(p => ({...p, 0:false}))}
          style={{ width:"100%", height:"160px", objectFit:"cover", opacity:loading[0]?0:1, transition:"opacity 0.3s" }} />
      </div>
    );
  }

  // Two photos side by side
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", height:"140px", overflow:"hidden", gap:"2px" }}>
      {validPhotos.slice(0,2).map((url, i) => (
        <div key={i} style={{ position:"relative", overflow:"hidden" }}>
          {loading[i] && (
            <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, ${TEAL_LIGHT}, #B2EBF2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"28px" }}>🏧</div>
          )}
          <img src={url} alt="" onError={() => setErrors(p => ({...p, [i]:true}))} onLoad={() => setLoading(p => ({...p, [i]:false}))}
            style={{ width:"100%", height:"140px", objectFit:"cover", opacity:loading[i]?0:1, transition:"opacity 0.3s" }} />
        </div>
      ))}
    </div>
  );
}

// ─── ATM CARD ──────────────────────────────────────────────────────────────
function ATMCard({ atm, index, onShowOnMap, isHighlighted, cardRef, forceExpanded, onExpandChange, userLat, userLng, formatDistance }) {
  const [showDirs, setShowDirs] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { if (forceExpanded) setExpanded(true); }, [forceExpanded]);

  const name    = atm.displayName?.text || atm.name || "ATM";
  const address = atm.formattedAddress || atm.shortFormattedAddress || "";
  const phone   = atm.nationalPhoneNumber || atm.internationalPhoneNumber || "";

  const feeColor  = (atm.network !== "Independent") ? "#1565C0" : "#E65100";
  const feeBg     = (atm.network !== "Independent") ? "#E3F2FD" : "#FFF3E0";
  const feeLabel  = atm.feeInfo || "Standard ATM fees may apply";
  const feeSurcharge = atm.surcharge || "$2.50–$4.00 typical";

  const hoursStatusBg = atm.is24Hours ? "#E3F2FD"
    : atm.isOpen === true ? "#E8F5E9"
    : atm.isOpen === false ? "#FFEBEE"
    : "#F5F5F5";
  const hoursStatusDot = atm.is24Hours ? BLUE
    : atm.isOpen === true ? GREEN
    : atm.isOpen === false ? CORAL
    : GRAY;
  const hoursStatusLabel = atm.is24Hours ? "🔄 Open 24/7"
    : atm.isOpen === true ? "Open Now"
    : atm.isOpen === false ? "Closed"
    : "Hours Unknown";
  const hoursStatusColor = atm.is24Hours ? "#1565C0"
    : atm.isOpen === true ? "#2E7D32"
    : atm.isOpen === false ? "#D32F2F"
    : GRAY;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity:0, y:20 }}
      animate={{ opacity:1, y:0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        background:"#fff", borderRadius:"16px",
        boxShadow: isHighlighted
          ? `0 0 0 3px ${TEAL}, 0 4px 20px rgba(0,188,212,0.25)`
          : "0 2px 12px rgba(0,0,0,0.06)",
        overflow:"hidden",
        border: isHighlighted ? `2px solid ${TEAL}` : "1px solid #E8EDF2",
        transition:"box-shadow 0.3s, border 0.3s",
      }}
    >
      {/* Photo strip — up to 2 */}
      <div style={{ position:"relative" }}>
        <ATMPhotoStrip photos={atm.photos} fallbackIcon={atm.venueIcon || "🏧"} />
        {/* Index badge */}
        <div style={{ position:"absolute", top:"10px", left:"10px", background:TEAL, color:"#fff", width:"28px", height:"28px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"800", fontSize:"13px" }}>{index+1}</div>
        {/* Network badge */}
        {atm.network && atm.network !== "Independent" && (
          <div style={{ position:"absolute", top:"10px", right:"10px", background:"rgba(255,255,255,0.95)", padding:"3px 9px", borderRadius:"6px", fontSize:"11px", fontWeight:"700", color:"#1565C0" }}>🏦 {atm.network}</div>
        )}
        {/* Venue badge */}
        {atm.venueType && atm.venueType !== "standalone" && atm.venueType !== "bank" && (
          <div style={{ position:"absolute", bottom:"10px", left:"10px", background:"rgba(0,0,0,0.65)", padding:"3px 9px", borderRadius:"6px", fontSize:"11px", fontWeight:"700", color:"#fff" }}>{atm.venueIcon} {atm.venueType === "airport" ? "Airport" : atm.venueType === "transit" ? "Transit/Metro" : atm.venueType === "gas" ? "Gas Station" : atm.venueType === "hospital" ? "Hospital" : atm.venueType === "hotel" ? "Hotel" : atm.venueType === "convenience" ? "Convenience" : atm.venueType === "mall" ? "Mall" : atm.venueType === "grocery" ? "Grocery" : atm.venueType === "entertainment" ? "Entertainment" : ""}</div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding:"14px 16px" }}>
        <div style={{ fontWeight:"700", fontSize:"16px", color:DARK, marginBottom:"6px" }}>{name}</div>

        {/* Address */}
        {address && (
          <div style={{ display:"flex", alignItems:"flex-start", gap:"8px", marginBottom:"10px", padding:"8px 10px", background:"#F8FAFC", borderRadius:"8px" }}>
            <span style={{ fontSize:"16px", marginTop:"1px" }}>🗺️</span>
            <span style={{ fontSize:"13px", color:DARK, lineHeight:"1.4" }}>{address}</span>
          </div>
        )}

        {/* Rating + Distance */}
        <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:"10px", fontSize:"13px", color:GRAY, marginBottom:"10px" }}>
          {atm.rating && (
            <span>
              <span style={{ color:GOLD }}>★</span>
              <span style={{ fontWeight:"700", color:DARK, marginLeft:"2px" }}>{atm.rating}</span>
              {atm.userRatingCount > 0 && <span style={{ opacity:0.7 }}> ({atm.userRatingCount})</span>}
            </span>
          )}
          {atm.distanceMiles!=null && <span style={{ fontWeight:"600", color:TEAL_DARK }}>📍 {formatDistance(atm.distanceMiles)}</span>}
        </div>

        {/* Badges */}
        {atm.badges?.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginBottom:"10px" }}>
            {atm.badges.map((b, i) => (
              <span key={i} style={{ background:b.bg, color:b.color, padding:"3px 9px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>{b.icon} {b.label}</span>
            ))}
          </div>
        )}

        {/* Hours */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px", padding:"10px 12px", background:hoursStatusBg, borderRadius:"10px" }}>
          <span style={{ width:"10px", height:"10px", borderRadius:"50%", background:hoursStatusDot, boxShadow: atm.isOpen===true ? "0 0 6px rgba(76,175,80,0.5)" : "none", flexShrink:0 }} />
          <div style={{ flex:1, fontSize:"13px" }}>
            <span style={{ fontWeight:"700", color:hoursStatusColor }}>{hoursStatusLabel}</span>
            {atm.todayHours && !atm.is24Hours && (
              <span style={{ color:GRAY, marginLeft:"8px" }}>· {atm.todayHours}</span>
            )}
          </div>
        </div>

        {/* Fee info */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px", padding:"10px 12px", background:feeBg, border:`1px solid ${feeColor}25`, borderRadius:"10px" }}>
          <span style={{ fontSize:"20px", flexShrink:0 }}>💵</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:"600", fontSize:"13px", color:feeColor }}>{feeLabel}</div>
            <div style={{ fontSize:"11px", color:GRAY }}>Non-customer fee: {feeSurcharge}</div>
          </div>
        </div>

        {/* Phone */}
        {phone ? (
          <a href={`tel:${phone}`} style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px", padding:"10px 12px", background:"#E3F2FD", borderRadius:"10px", textDecoration:"none", color:"#1565C0" }}>
            <span style={{ width:"32px", height:"32px", background:"#1565C0", color:"#fff", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", flexShrink:0 }}>📞</span>
            <div>
              <div style={{ fontWeight:"600", fontSize:"14px" }}>{phone}</div>
              <div style={{ fontSize:"11px", color:GRAY }}>Tap to call</div>
            </div>
          </a>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px", padding:"10px 12px", background:"#F5F5F5", borderRadius:"10px", color:GRAY, fontSize:"13px" }}>
            <span>📞</span><span>Phone not available</span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          <button onClick={() => setShowDirs(true)} style={btn(TEAL, "#fff")}>🧭 Directions</button>
          <button onClick={() => onShowOnMap?.(index)} style={btn("#EDE7F6", PURPLE)}>📍 Map</button>
          {(atm.weekdayDescriptions?.length > 0 || atm.websiteUri || atm.website) && (
            <button onClick={() => { const n=!expanded; setExpanded(n); onExpandChange?.(n); }} style={btn(expanded ? DARK : "#F1F5F9", expanded ? "#fff" : DARK)}>
              {expanded ? "▲ Less" : "▼ Details"}
            </button>
          )}
        </div>

        {/* Expanded full week hours + website */}
        <AnimatePresence>
          {expanded && (atm.weekdayDescriptions?.length > 0 || atm.websiteUri || atm.website) && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }} style={{ overflow:"hidden" }}>
              <div style={{ marginTop:"12px", padding:"12px", background:"#F8FAFC", borderRadius:"10px" }}>
                {atm.weekdayDescriptions?.length > 0 && (
                  <>
                    <div style={{ fontSize:"12px", color:GRAY, fontWeight:"600", marginBottom:"8px", textTransform:"uppercase" }}>🕐 Full Week Hours</div>
                    {atm.weekdayDescriptions.map((day, i) => {
                      const today = new Date().getDay();
                      const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                      const dayIdx = dayNames.findIndex(d => day.toLowerCase().startsWith(d.toLowerCase()));
                      const isToday = dayIdx === today;
                      const parts = day.split(":");
                      const dayName = parts[0];
                      const hrs = parts.slice(1).join(":").trim();
                      return (
                        <div key={i} style={{
                          display:"flex", justifyContent:"space-between",
                          fontSize:"13px", color: isToday ? TEAL_DARK : DARK,
                          fontWeight: isToday ? "700" : "400",
                          padding: isToday ? "6px 8px" : "5px 0",
                          background: isToday ? `${TEAL}15` : "transparent",
                          margin: isToday ? "0 -4px" : "0",
                          borderRadius: isToday ? "6px" : "0"
                        }}>
                          <span>{dayName}{isToday && " (Today)"}</span>
                          <span>{hrs}</span>
                        </div>
                      );
                    })}
                  </>
                )}
                {(atm.websiteUri || atm.website) && (
                  <a href={atm.websiteUri || atm.website} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", gap:"8px", marginTop: atm.weekdayDescriptions?.length > 0 ? "10px" : "0", padding:"8px 10px", background:"#fff", border:"1px solid #E2E8F0", borderRadius:"8px", textDecoration:"none", color:TEAL_DARK, fontSize:"13px", fontWeight:"600" }}>🌐 Visit Website</a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DirectionsPicker isOpen={showDirs} onClose={() => setShowDirs(false)} lat={atm.lat} lng={atm.lng} name={name} userLat={userLat} userLng={userLng} />
    </motion.div>
  );
}

const btn = (bg, color) => ({
  display:"flex", alignItems:"center", gap:"5px",
  padding:"8px 14px", borderRadius:"10px",
  border:"none", fontSize:"13px", fontWeight:"600",
  cursor:"pointer", background:bg, color, fontFamily:"inherit",
});

// ─── MAP POPUP HTML ─────────────────────────────────────────────────────────
// Requirements: clickable name, address, phone (call), type, rating, distance, hours, directions picker, X button, no photo
function buildMapPopup(atm, index, fmt) {
  const name    = atm.displayName?.text || atm.name || "ATM";
  const address = atm.formattedAddress || atm.shortFormattedAddress || "Address not available";
  const phone   = atm.nationalPhoneNumber || atm.internationalPhoneNumber || null;
  const rating  = atm.rating || null;
  const ratingCount = atm.userRatingCount || 0;
  const distance = (fmt && atm.distanceMiles!=null) ? fmt(atm.distanceMiles) : (atm.distance || "");
  const isOpen  = atm.isOpen;
  const todayHours = atm.todayHours || "";
  const is24H   = atm.is24Hours || false;
  const network = atm.network || "Independent ATM";
  const venueIcon = atm.venueIcon || "🏧";
  const feeInfo   = atm.feeInfo || "Standard fees may apply";

  const hoursColor = is24H ? "#1565C0" : isOpen===true ? "#2E7D32" : isOpen===false ? "#D32F2F" : "#757575";
  const hoursBg    = is24H ? "#E3F2FD" : isOpen===true ? "#E8F5E9" : isOpen===false ? "#FFEBEE" : "#F5F5F5";
  const hoursDot   = is24H ? "#1976D2" : isOpen===true ? "#4CAF50" : isOpen===false ? "#FF6B6B" : "#9E9E9E";
  const hoursLabel = is24H ? "🔄 Open 24/7" : isOpen===true ? "Open Now" : isOpen===false ? "Closed" : "Hours N/A";

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:260px;position:relative;">
  <div style="padding:12px;padding-top:14px;">
    <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#E0F7FA;border-radius:6px;font-size:11px;font-weight:700;color:#00838F;margin-bottom:6px;">${venueIcon} ${network}</div>
    <div onclick="window._gsViewATM&&window._gsViewATM(${index})" style="font-weight:700;font-size:14px;color:#1A2332;margin-bottom:5px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;">${name}</div>
    <div style="font-size:11px;color:#64748B;margin-bottom:6px;">${address}</div>
    <div style="font-size:11px;padding:5px 8px;border-radius:6px;background:${hoursBg};margin-bottom:6px;">
      <span style="font-weight:700;color:${hoursColor};">${hoursLabel}</span>
      ${todayHours && !is24H ? `<span style="color:#64748B;"> · ${todayHours}</span>` : ""}
    </div>
    ${rating?`<div style="font-size:12px;color:#F59E0B;margin-bottom:6px;">★ <strong style="color:#1A2332;">${rating}</strong> <span style="color:#64748B;">(${ratingCount})</span>${distance?` · <span style="color:#00838F;">${distance}</span>`:''} · <span style="color:#9E9E9E;">💵 ${feeInfo}</span></div>`:`<div style="font-size:11px;color:#9E9E9E;margin-bottom:6px;">${distance?`📍 ${distance} · `:''}💵 ${feeInfo}</div>`}
    ${phone?`<a href="tel:${phone}" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:6px 10px;background:#EFF6FF;border-radius:6px;text-decoration:none;color:#1565C0;font-size:11px;font-weight:600;">📞 ${phone}</a>`:''}
    <div style="display:flex;gap:8px;">
      <button onclick="window._gsATMDirs&&window._gsATMDirs(${index})" style="flex:1;padding:8px;border:none;border-radius:7px;background:#00BCD4;color:#fff;font-weight:600;font-size:11px;cursor:pointer;">🧭 Directions</button>
      <button onclick="window._gsViewATM&&window._gsViewATM(${index})" style="flex:1;padding:8px;border:none;border-radius:7px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:11px;cursor:pointer;">📋 Details</button>
    </div>
  </div>
</div>
  `;
}

// ─── FILTER PILL ───────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick, emoji }) {
  return (
    <button onClick={onClick} style={{
      padding:"7px 13px", borderRadius:"20px",
      border: active ? `2px solid ${TEAL}` : "1.5px solid #E2E8F0",
      background: active ? TEAL_LIGHT : "#fff",
      color: active ? TEAL_DARK : GRAY,
      fontWeight: active ? "700" : "500",
      fontSize:"13px", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit",
      display:"flex", alignItems:"center", gap:"4px",
    }}>
      {emoji && <span>{emoji}</span>}{label}
    </button>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function ATMFinderPage() {
  const [atms,           setATMs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [refreshTick,    setRefreshTick]    = useState(0);
  const forceNextRef                         = useRef(false);
  const handleRefresh                        = () => { forceNextRef.current = true; setRefreshTick(t=>t+1); };
  const [viewMode,       setViewMode]       = useState("list");
  const [category,       setCategory]       = useState("all");
  const [bankFilter,     setBankFilter]     = useState("all");
  const [availableBanks, setAvailableBanks] = useState([]);
  const [openOnly,       setOpenOnly]       = useState(false);
  const [sortBy,         setSortBy]         = useState("nearby");
  const [radius,         setRadius]         = useState(10);
  const [showLocPicker,  setShowLocPicker]  = useState(false);
  const [userPinExpanded, setUserPinExpanded] = useState(true);
  useEffect(() => {
    /** @type {any} */ (window)._gsATMUserPin = () => setUserPinExpanded(e => !e);
    return () => { delete /** @type {any} */ (window)._gsATMUserPin; };
  }, []);
  const [showLegend,     setShowLegend]     = useState(true);
  const [directionsATM,  setDirectionsATM]  = useState(null);
  const [highlightIdx,   setHighlightIdx]   = useState(null);
  const [expandedIdx,    setExpandedIdx]    = useState(null);
  const [activeMapPin,   setActiveMapPin]   = useState(null); // for pin color change

  const cardRefs    = useRef({});
  const mapRef      = useRef(null);
  const mapInstRef  = useRef(null);
  const markersRef  = useRef([]);

  const { activeLocation } = useLocation();
  const lat  = activeLocation?.coordinates?.latitude;
  const lng  = activeLocation?.coordinates?.longitude;
  const locLabel = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);

  useEffect(() => {
    setRadius(activeLocation?.suggestedRadius ?? 10);
  }, [activeLocation?.placeId]);

  // ── Fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lat || !lng) return;
    setLoading(true);
    setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;

    (async () => {
      try {
        console.log("🏧 ATMFinder v6.0: fetching", { lat, lng, radius, category });
        const { data } = await base44.functions.invoke("getATMLocations", {
          latitude:  lat,
          longitude: lng,
          radius:    radius * 1609,
          maxResults: 40,
          category,
          bankFilter,
          openOnly,
          forceRefresh: force,
        });

        const rawList = data?.atms || data?.places || [];
        if (rawList.length > 0) {
          const processed = rawList.map(p => enrichATM(p, lat, lng));
          setATMs(processed);
          if (data?.banks?.length > 0) setAvailableBanks(data.banks);
        } else {
          setError(data?.error || "No ATMs found. Try expanding your search radius.");
        }
      } catch (e) {
        console.error("🏧 ATMFinder error:", e);
        setError(`Failed to load: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [lat, lng, radius, category, bankFilter, openOnly, refreshTick]);

  // ── Client-side sort (distance is already sorted, but rating needs resort) ──
  const filtered = useMemo(() => {
    let result = [...atms];
    if (sortBy === "rating") {
      // Weight by log(reviews) so a 5.0 with 1 review can't beat a 4.5 with
      // thousands. Critical for city-mode where rating ties are common.
      result.sort((a, b) => {
        const sa = (a.rating || 0) * Math.log10(Math.max(a.userRatingCount || 1, 1));
        const sb = (b.rating || 0) * Math.log10(Math.max(b.userRatingCount || 1, 1));
        return sb - sa;
      });
    }
    return result;
  }, [atms, sortBy]);

  const handleShowOnMap = (index) => {
    setViewMode("map");
    setActiveMapPin(index);
    setTimeout(() => {
      const atm = filtered[index];
      if (mapInstRef.current && atm?.lat && atm?.lng) {
        mapInstRef.current.setView([atm.lat, atm.lng], 17);
        markersRef.current[index]?.openPopup();
      }
    }, 350);
  };

  // ── Map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "map" || !mapRef.current || !lat || !lng) return;

    const initMap = () => {
      if (mapInstRef.current) mapInstRef.current.remove();
      markersRef.current = [];

      const map = window.L.map(mapRef.current).setView([lat, lng], 14);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution:"© OSM" }).addTo(map);
      mapInstRef.current = map;
      window._gsMapInstance = map;

      // ── Global callbacks for popup buttons ──
      window._gsViewATM = (i) => {
        map.closePopup();
        setViewMode("list");
        setExpandedIdx(i);
        setHighlightIdx(i);
        setTimeout(() => {
          cardRefs.current[i]?.scrollIntoView({ behavior:"smooth", block:"center" });
        }, 150);
        setTimeout(() => setHighlightIdx(null), 2800);
      };

      window._gsATMDirs = (i) => setDirectionsATM(filtered[i]);

      // User location pin with collapsible "📍 You are here" tooltip below
      // (anti-overlap with ATM popups above). Same pattern as ThingsToDo
      // TierMapOverlay + MoneyExchange / PlacesToEat / CoffeeFinder maps.
      const userMode=activeLocation?.mode==='navigate'?'Selected location':'Current location';
      const userLabel=locLabel||'';
      const userTooltipHtml=userPinExpanded
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsATMUserPin&&window._gsATMUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:12px;margin-bottom:2px;padding-right:24px;">📍 You are here</div><div style="font-weight:700;color:#4285F4;font-size:11px;margin-bottom:2px;">${userMode}</div><div style="color:#64748B;font-size:10px;line-height:1.3;">${userLabel}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsATMUserPin&&window._gsATMUserPin()"><span style="font-weight:700;color:#1A2332;font-size:11px;">📍 You are here</span><span style="color:#64748B;font-size:10px;font-weight:700;">⌄</span></div>`;
      window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          html: `<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
          iconSize:[16,16], className:"",
        })
      }).addTo(map).bindTooltip(userTooltipHtml,{permanent:true,direction:'bottom',opacity:1,offset:[0,12],className:'gs-user-tooltip',interactive:true});

      // ATM markers
      filtered.forEach((atm, i) => {
        if (!atm.lat || !atm.lng) return;

        // Default = teal; active/selected = coral/orange
        const isActive = activeMapPin === i;
        const markerColor = isActive ? "#FF6B35" : (atm.network !== "Independent" ? "#1565C0" : TEAL);
        const markerSize  = isActive ? 34 : 28;

        const marker = window.L.marker([atm.lat, atm.lng], {
          icon: window.L.divIcon({
            html: `<div style="width:${markerSize}px;height:${markerSize}px;background:${markerColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${isActive?14:12}px;box-shadow:0 2px 10px ${markerColor}70;border:${isActive?3:2}px solid #fff;transition:all 0.2s;">${i+1}</div>`,
            iconSize:[markerSize, markerSize], className:"",
          })
        }).addTo(map);

        marker.bindPopup(buildMapPopup(atm, i, formatDistance), { maxWidth:270, autoPan:true, autoPanPaddingTopLeft:[0,160], autoPanPaddingBottomRight:[20,20], keepInView:true, className:"gs-popup" });

        // Update active pin color on popup open
        marker.on("popupopen", () => {
          setActiveMapPin(i);
        });
        marker.on("popupclose", () => {
          // Leave it highlighted until another is opened
        });

        markersRef.current[i] = marker;
      });

      // If we have an activeMapPin from list, open that popup
      if (activeMapPin !== null && markersRef.current[activeMapPin]) {
        setTimeout(() => {
          markersRef.current[activeMapPin]?.openPopup();
        }, 200);
      }
    };

    if (!window.L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      delete window._gsMapInstance;
      delete window._gsViewATM;
      delete window._gsATMDirs;
      if (mapInstRef.current) { mapInstRef.current.remove(); mapInstRef.current = null; }
    };
  }, [viewMode, filtered, lat, lng, activeMapPin, unit, userPinExpanded, locLabel, activeLocation?.mode]);

  const stats = {
    total: filtered.length,
    banks: filtered.filter(a => a.network !== "Independent").length,
    open:  filtered.filter(a => a.isOpen === true).length,
  };

  return (
    <div style={{ fontFamily:"'DM Sans', -apple-system, sans-serif", background:"#F8FAFB", minHeight:"100vh" }}>

      {/* ── Header ── */}
      <div style={{ padding:"16px 16px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
          <button onClick={() => window.history.back()} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", padding:"0", color:TEAL_DARK, fontSize:"14px", fontWeight:"600", cursor:"pointer", fontFamily:"inherit" }}>← Back to Home</button>
          <RefreshButton onClick={handleRefresh} isRefreshing={loading} tone="dark" title="Refresh ATMs" />
        </div>

        {/* Title bar */}
        <div style={{ background:`linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%)`, borderRadius:"16px", padding:"14px 16px", marginBottom:"12px", display:"flex", alignItems:"center", gap:"12px" }}>
          <span style={{ fontSize:"32px" }}>🏧</span>
          <div>
            <div style={{ fontWeight:"800", fontSize:"20px", color:"#fff" }}>ATM Finder</div>
            <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.8)" }}>Airports • Transit • Gas Stations • Malls • Hospitals • Banks • Worldwide</div>
          </div>
        </div>

        {/* Location bar */}
        <div onClick={() => setShowLocPicker(true)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 13px", background:"#fff", borderRadius:"10px", border:"1px solid #E2E8F0", fontSize:"13px", marginBottom:"10px", cursor:"pointer" }}>
          <span style={{ color:GRAY }}>{isCity ? '🏙️' : '📍'} {locLabel}</span>
          <span style={{ background:TEAL_LIGHT, color:TEAL_DARK, padding:"4px 10px", borderRadius:"6px", fontWeight:"600", fontSize:"12px" }}>Change</span>
        </div>

        {isCity && (
          <div style={{ fontSize:"11px", color:"#92400E", padding:"8px 10px", background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:"8px", marginBottom:"10px", lineHeight:1.4 }}>
            💡 Showing places across {activeLocation?.address?.city || activeLocation?.placeName} — {CITY_DISCLAIMER}
          </div>
        )}

        {/* Radius buttons */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px", flexWrap:"wrap" }}>
          <span style={{ fontSize:"12px", color:GRAY, fontWeight:"600", flexShrink:0 }}>Radius:</span>
          <div style={{ display:"flex", gap:"4px" }}>
            {[5,10,15,25].map(r => (
              <button key={r} onClick={() => setRadius(r)} style={{ padding:"5px 10px", borderRadius:"8px", border: radius===r ? `2px solid ${TEAL}` : "1px solid #E2E8F0", background: radius===r ? `${TEAL}15` : "#fff", color: radius===r ? TEAL_DARK : GRAY, fontWeight: radius===r ? "700" : "500", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>{r} mi</button>
            ))}
          </div>
          <DistanceUnitToggle unit={unit} setUnit={setUnit} variant="light" style={{ marginLeft:"auto" }} />
          <span style={{ fontSize:"11px", color:GRAY, flexShrink:0 }}>{loading ? "Loading…" : `${atms.length} found`}</span>
        </div>

        {/* Category filters (smart filters) */}
        <div style={{ overflowX:"auto", scrollbarWidth:"none", marginBottom:"8px" }}>
          <div style={{ display:"flex", gap:"6px", paddingBottom:"4px" }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
                display:"flex", alignItems:"center", gap:"5px",
                padding:"7px 13px", borderRadius:"20px", flexShrink:0,
                border: category===cat.id ? `2px solid ${TEAL}` : "1.5px solid #E2E8F0",
                background: category===cat.id ? TEAL_LIGHT : "#fff",
                color: category===cat.id ? TEAL_DARK : GRAY,
                fontWeight: category===cat.id ? "700" : "500",
                fontSize:"12px", cursor:"pointer", fontFamily:"inherit",
              }}>
                <span>{cat.icon}</span><span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick filters row */}
        <div style={{ display:"flex", gap:"8px", alignItems:"center", overflowX:"auto", scrollbarWidth:"none", marginBottom:"8px" }}>
          {/* Sort */}
          <div style={{ display:"flex", background:"#F1F5F9", borderRadius:"10px", padding:"2px", flexShrink:0 }}>
            <button onClick={() => setSortBy("nearby")} style={{ padding:"6px 10px", borderRadius:"8px", border:"none", background: sortBy==="nearby" ? TEAL : "transparent", color: sortBy==="nearby" ? "#fff" : GRAY, fontWeight:"600", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>📍 Nearest</button>
            <button onClick={() => setSortBy("rating")} style={{ padding:"6px 10px", borderRadius:"8px", border:"none", background: sortBy==="rating" ? TEAL : "transparent", color: sortBy==="rating" ? "#fff" : GRAY, fontWeight:"600", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>⭐ Top Rated</button>
          </div>

          <div style={{ width:"1px", height:"20px", background:"#E2E8F0", flexShrink:0 }} />

          {/* Open only pill */}
          <button onClick={() => setOpenOnly(o => !o)} style={{
            padding:"7px 13px", borderRadius:"20px", flexShrink:0,
            border: openOnly ? `2px solid ${GREEN}` : "1.5px solid #E2E8F0",
            background: openOnly ? "#E8F5E9" : "#fff",
            color: openOnly ? "#2E7D32" : GRAY,
            fontWeight: openOnly ? "700" : "500",
            fontSize:"12px", cursor:"pointer", fontFamily:"inherit",
          }}>🟢 Open Only</button>

          {/* Bank filter */}
          {availableBanks.length > 0 && (
            <select value={bankFilter} onChange={e => setBankFilter(e.target.value)} style={{
              padding:"7px 10px", borderRadius:"20px", flexShrink:0,
              border: bankFilter!=="all" ? `2px solid #1565C0` : "1.5px solid #E2E8F0",
              background: bankFilter!=="all" ? "#E3F2FD" : "#fff",
              color: bankFilter!=="all" ? "#1565C0" : GRAY,
              fontWeight: bankFilter!=="all" ? "700" : "500",
              fontSize:"12px", cursor:"pointer", fontFamily:"inherit",
              appearance:"none", paddingRight:"20px",
            }}>
              <option value="all">🏦 All Banks</option>
              {availableBanks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>

        {/* Stats + View toggle */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"13px" }}>
            <span style={{ background:TEAL, color:"#fff", padding:"2px 9px", borderRadius:"10px", fontWeight:"700", fontSize:"12px" }}>{stats.total}</span>
            <span style={{ color:GRAY, fontWeight:"600" }}>ATMs</span>
            {stats.banks > 0 && <span style={{ color:"#1565C0", fontWeight:"600" }}>· {stats.banks} banks</span>}
            {stats.open  > 0 && <span style={{ color:"#2E7D32", fontWeight:"600" }}>· {stats.open} open</span>}
          </div>
          <div style={{ display:"flex", gap:"4px" }}>
            {["list","map"].map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{ padding:"6px 12px", borderRadius:"8px", border:"none", background: viewMode===v ? TEAL : "#E2E8F0", color: viewMode===v ? "#fff" : GRAY, fontWeight:"700", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>
                {v==="list" ? "List View" : "Map View"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:"48px", marginBottom:"14px", animation:"pulse 1.5s infinite" }}>🏧</div>
          <div style={{ color:GRAY, fontWeight:"600", fontSize:"15px" }}>Finding ATMs worldwide…</div>
          <div style={{ color:GRAY, fontSize:"12px", marginTop:"6px" }}>Scanning airports, transit, stores, banks & more</div>
        </div>
      ) : error ? (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:"40px", marginBottom:"12px" }}>😕</div>
          <div style={{ color:CORAL, fontWeight:"600" }}>{error}</div>
          <button onClick={() => setRadius(r => Math.min(r+5,25))} style={{ marginTop:"14px", ...btn(TEAL,"#fff") }}>Try Larger Radius</button>
        </div>
      ) : viewMode === "list" ? (
        <div style={{ padding:"0 12px 100px", display:"flex", flexDirection:"column", gap:"12px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px", background:"#fff", borderRadius:"12px" }}>
              <div style={{ fontSize:"32px", marginBottom:"10px" }}>🔍</div>
              <div style={{ fontWeight:"600", color:DARK }}>No matches for this filter</div>
              <div style={{ color:GRAY, fontSize:"13px", marginTop:"4px" }}>Try switching category or clearing filters</div>
            </div>
          ) : (
            filtered.map((atm, i) => (
              <ATMCard
                key={atm.id || i}
                atm={atm}
                index={i}
                onShowOnMap={handleShowOnMap}
                isHighlighted={highlightIdx === i}
                cardRef={el => cardRefs.current[i] = el}
                forceExpanded={expandedIdx === i ? true : undefined}
                onExpandChange={(exp) => { if (!exp && expandedIdx === i) setExpandedIdx(null); }}
                userLat={lat}
                userLng={lng}
                formatDistance={formatDistance}
              />
            ))
          )}
        </div>
      ) : (
        // Map view
        <div style={{ position:"relative" }}>
          <div ref={mapRef} style={{ height:"calc(100vh - 300px)", width:"100%" }} />
          {/* Legend — collapsible */}
          {showLegend ? (
            <div style={{ position:"absolute", bottom:"16px", left:"16px", zIndex:1000, background:"rgba(255,255,255,0.95)", borderRadius:"10px", padding:"8px 12px", fontSize:"11px", boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"4px" }}>
                <span style={{ fontWeight:"700", color:DARK }}>Pin Colors</span>
                <button onClick={()=>setShowLegend(false)} style={{ background:"none", border:"none", fontSize:"14px", color:GRAY, cursor:"pointer", padding:"0 0 0 8px", lineHeight:1 }}>✕</button>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"2px" }}>
                <span style={{ width:"12px", height:"12px", borderRadius:"50%", background:"#FF6B35", display:"inline-block" }}></span>
                <span style={{ color:GRAY }}>Selected ATM</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"2px" }}>
                <span style={{ width:"12px", height:"12px", borderRadius:"50%", background:"#1565C0", display:"inline-block" }}></span>
                <span style={{ color:GRAY }}>Bank ATM</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <span style={{ width:"12px", height:"12px", borderRadius:"50%", background:TEAL, display:"inline-block" }}></span>
                <span style={{ color:GRAY }}>Other ATM</span>
              </div>
            </div>
          ) : (
            <button onClick={()=>setShowLegend(true)} style={{ position:"absolute", bottom:"16px", left:"16px", zIndex:1000, background:"rgba(255,255,255,0.95)", borderRadius:"8px", padding:"6px 10px", fontSize:"11px", fontWeight:"600", color:GRAY, border:"none", boxShadow:"0 2px 8px rgba(0,0,0,0.15)", cursor:"pointer" }}>🎨 Legend</button>
          )}
          {/* Close button */}
          <button onClick={() => setViewMode("list")} style={{ position:"absolute", top:"16px", right:"16px", zIndex:1000, background:"#fff", borderRadius:"50%", width:"40px", height:"40px", border:"none", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:"20px", color:DARK }}>✕</button>
        </div>
      )}

      {/* Global styles */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        ::-webkit-scrollbar { display:none }
        .gs-popup .leaflet-popup-content-wrapper { border-radius:14px; padding:0; overflow:visible; box-shadow:0 8px 32px rgba(0,0,0,0.18); z-index:9000 !important; }
        .gs-popup .leaflet-popup-content { margin:0; overflow:hidden; border-radius:14px; }
        .gs-popup .leaflet-popup-tip-container { display:none; }
        .leaflet-popup { z-index:9000 !important; }
      `}</style>

      <LocationModePicker isOpen={showLocPicker} onClose={() => setShowLocPicker(false)} />
      {directionsATM && (
        <DirectionsPicker
          isOpen={true}
          onClose={() => setDirectionsATM(null)}
          lat={directionsATM.lat}
          lng={directionsATM.lng}
          name={directionsATM.displayName?.text || directionsATM.name || "ATM"}
          userLat={lat}
          userLng={lng}
        />
      )}
    </div>
  );
}