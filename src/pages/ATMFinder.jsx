import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation, CITY_DISCLAIMER } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import DistanceUnitToggle from "@/components/location/DistanceUnitToggle";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import RefreshButton from "@/components/RefreshButton";
import AtmAIDetails from "@/components/AtmAIDetails";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import MapAppSelector from "@/components/MapAppSelector";
import { ChevronLeft, MapPin, CreditCard } from "lucide-react";
import { CAT, TEAL_DEEP, IVORY } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

// iPad editorial design tokens (design handoff: "Places to Eat · iPad").
// Verbatim copy from PlacesToEat so every finder's tablet layout matches.
const ED_SERIF = '"Instrument Serif", Georgia, serif';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)", ED_EAT = "#D8443C";

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

// ─── BEST ATM NEARBY RANKING (Phase A5) ────────────────────────────────────
// Scores ATMs using ONLY signals already in the list response — no extra
// AI Details fetches. The spec's full ranking factors (lowest fee, highest
// limit) need per-ATM Haiku data which we don't pre-compute at list time;
// those badges will land if/when crowdsourced fee data exists (Phase A6).
// For now we surface the badges we CAN ground:
//   💎 Best Overall — highest composite score (must clear a confidence floor).
//   🛡️ Safest Option — best bank-branch ATM in the list.
// Existing per-ATM badges (24/7, Bank Network, venue type) are preserved.
function scoreATM(atm) {
  let s = 0;
  if (atm.rating) s += (atm.rating - 3) * 10;          // -10 to +20 around neutral
  if (atm.userRatingCount > 10) s += 5;
  if (atm.userRatingCount > 50) s += 5;
  if (atm.isOpen === true) s += 8;
  if (atm.is24Hours) s += 12;
  if (atm.network && atm.network !== "Independent") s += 12;
  if (atm.venueType === "bank") s += 25;                // strongest safety signal
  if (atm.venueType === "airport") s += 4;              // convenience win
  if (atm.venueType === "convenience") s += -2;         // independent operators carry more risk
  if (atm.distanceMiles != null) s += Math.max(0, 5 - atm.distanceMiles);
  return s;
}

function rankATMs(list) {
  if (!Array.isArray(list) || list.length === 0) return list;
  const scored = list.map((atm, idx) => ({ atm, idx, score: scoreATM(atm) }));
  const sortedByScore = [...scored].sort((a, b) => b.score - a.score);
  const bestOverall = sortedByScore[0];
  // Safest: best-rated bank-branch ATM (rating tiebreaker keeps it
  // separate from "Best Overall" when one is a non-bank highly-rated ATM).
  const banks = scored.filter(s => s.atm.venueType === "bank");
  const safest = banks.length > 0
    ? [...banks].sort((a, b) => (b.atm.rating || 0) - (a.atm.rating || 0))[0]
    : null;
  return list.map((atm, i) => {
    const extra = [];
    // Only stamp "Best Overall" if the lead is clear — score floor of 20
    // and at least a 5-point lead over runner-up — to avoid promoting a
    // mediocre ATM when the list is weak overall.
    const runnerUp = sortedByScore[1]?.score ?? -Infinity;
    if (bestOverall.idx === i && bestOverall.score >= 20 && (bestOverall.score - runnerUp) >= 3) {
      extra.push({ icon: "💎", label: "Best Overall", color: "#166534", bg: "#DCFCE7" });
    }
    if (safest && safest.idx === i && safest.idx !== bestOverall.idx) {
      extra.push({ icon: "🛡️", label: "Safest Option", color: "#1E40AF", bg: "#DBEAFE" });
    }
    if (extra.length === 0) return atm;
    return { ...atm, badges: [...extra, ...(atm.badges || [])].slice(0, 5) };
  });
}

// ─── PHOTO STRIP (up to 2 photos) ──────────────────────────────────────────
// `height` is optional — phone layout passes nothing (defaults preserved); the
// iPad editorial card passes ~360 so the photo reads at editorial scale.
function ATMPhotoStrip({ photos, fallbackIcon = "🏧", onPhotoClick, height }) {
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState({ 0: true, 1: true });

  const validPhotos = (photos || []).filter((p, i) => p && !errors[i]);
  const emptyH  = height ? `${height}px` : "120px";
  const singleH = height ? `${height}px` : "160px";
  const dualH   = height ? `${height}px` : "140px";

  if (validPhotos.length === 0) {
    return (
      <div style={{ height:emptyH, background:`linear-gradient(135deg, ${TEAL_LIGHT}, #B2EBF2, #80DEEA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"calc(52px*var(--fs))" }}>
        {fallbackIcon}
      </div>
    );
  }

  if (validPhotos.length === 1) {
    return (
      <div onClick={() => onPhotoClick?.(0)} style={{ position:"relative", height:singleH, overflow:"hidden", cursor: onPhotoClick ? "pointer" : "default" }}>
        {loading[0] && (
          <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, ${TEAL_LIGHT}, #B2EBF2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"calc(36px*var(--fs))" }}>🏧</div>
        )}
        <img src={validPhotos[0]} alt="" onError={() => setErrors(p => ({...p, 0:true}))} onLoad={() => setLoading(p => ({...p, 0:false}))}
          style={{ width:"100%", height:singleH, objectFit:"cover", opacity:loading[0]?0:1, transition:"opacity 0.3s" }} />
      </div>
    );
  }

  // Two photos side by side
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", height:dualH, overflow:"hidden", gap:"2px" }}>
      {validPhotos.slice(0,2).map((url, i) => (
        <div key={i} onClick={() => onPhotoClick?.(i)} style={{ position:"relative", overflow:"hidden", cursor: onPhotoClick ? "pointer" : "default" }}>
          {loading[i] && (
            <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, ${TEAL_LIGHT}, #B2EBF2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"calc(28px*var(--fs))" }}>🏧</div>
          )}
          <img src={url} alt="" onError={() => setErrors(p => ({...p, [i]:true}))} onLoad={() => setLoading(p => ({...p, [i]:false}))}
            style={{ width:"100%", height:dualH, objectFit:"cover", opacity:loading[i]?0:1, transition:"opacity 0.3s" }} />
        </div>
      ))}
    </div>
  );
}

const btn = (bg, color) => ({
  display:"flex", alignItems:"center", gap:"5px",
  padding:"8px 14px", borderRadius:"10px",
  border:"none", fontSize:"calc(13px*var(--fs))", fontWeight:"600",
  cursor:"pointer", background:bg, color, fontFamily:"inherit",
});

// ─── ATM CARD — editorial layout (design handoff) ───────────────────────────
// Full-width editorial card mirroring RestaurantCardTablet: big photo (or a
// tasteful placeholder) + index badge + network tag, bank/network kicker,
// serif name, rating/distance sub-row, tinted pill tags (24/7, fee-free,
// venue), green Open bar, blue phone bar (only when a phone exists), and three
// action buttons with a "More ▾" expand panel (badges / daily hours /
// AtmAIDetails / website). Same props/handlers as the old ATMCard; reuses
// ATMPhotoStrip / AtmAIDetails / MapAppSelector / PhotoGalleryModal.
//
// RESPONSIVE: this single editorial card now serves BOTH platforms. The parent
// passes `isTablet`; every size is gated through the `D` token map below so the
// iPad keeps its full editorial scale while the phone gets a compact,
// phone-tuned version (the primary platform). ATMs may have NO phone and NO
// photo — both are handled gracefully at either width.
function ATMCardTablet({ atm, index, onShowOnMap, isHighlighted, cardRef, forceExpanded, onExpandChange, userLat, userLng, formatDistance, isTablet }) {
  const [showDirs, setShowDirs] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [gallery, setGallery] = useState({ open: false, idx: 0 });
  const fs = (n) => `calc(${n}px*var(--fs))`;

  // Width-gated design tokens. Tablet values are VERBATIM from the original
  // tablet-only card; phone values are the phone-tuned spec (compact, beautiful,
  // consistent across finders). Text sizes stay wrapped in fs() so the 4-step
  // glasses control still scales them, and the card grows (min-height) rather
  // than clipping when text enlarges.
  const D = isTablet ? {
    photoH: 360, radius: 28, bodyPad: `${fs(28)} ${fs(32)} ${fs(32)}`,
    kicker: 17, name: 38, address: 16, sub: 17,
    tagsGap: 10, tagPadV: 9, tagPadH: 16, tagFs: 15.5,
    barRadius: 16, openMt: 18, openPadV: 16, openPadH: 20, openFs: 18, openGap: 11, openDot: 10,
    phoneMt: 14, phonePadV: 18, phonePadH: 20, phoneGap: 14, phoneIcon: 24, phoneNum: 20, phoneSub: 15,
    actMt: 20, actGap: 12, actPad: 15, actFs: 18,
    chromeOff: 14, idxSize: 36, idxFs: 16, netFs: 14, netPadV: 4, netPadH: 11, venueFs: 14,
    nameMb: 4, addressMt: 8, subMt: 12, subGap: 16, tagsMt: 16,
    expMt: 20, expGap: 14, panelPad: 16, panelRadius: 16, hoursHeadFs: 13, hoursRowFs: 15,
    siteGap: 12, sitePad: 16, siteIcon: 22, siteFs: 16,
  } : {
    photoH: 200, radius: 20, bodyPad: `${fs(16)} ${fs(16)} ${fs(18)}`,
    kicker: 13, name: 26, address: 14, sub: 14,
    tagsGap: 7, tagPadV: 6, tagPadH: 12, tagFs: 12.5,
    barRadius: 13, openMt: 12, openPadV: 11, openPadH: 14, openFs: 13.5, openGap: 9, openDot: 9,
    phoneMt: 10, phonePadV: 12, phonePadH: 14, phoneGap: 11, phoneIcon: 18, phoneNum: 14.5, phoneSub: 12,
    actMt: 14, actGap: 8, actPad: 11, actFs: 14,
    chromeOff: 10, idxSize: 28, idxFs: 13, netFs: 11.5, netPadV: 3, netPadH: 9, venueFs: 11.5,
    nameMb: 3, addressMt: 6, subMt: 9, subGap: 12, tagsMt: 11,
    expMt: 14, expGap: 10, panelPad: 12, panelRadius: 12, hoursHeadFs: 11, hoursRowFs: 13,
    siteGap: 10, sitePad: 12, siteIcon: 18, siteFs: 14,
  };

  useEffect(() => { if (forceExpanded) setExpanded(true); }, [forceExpanded]);

  const name    = atm.displayName?.text || atm.name || "ATM";
  const address = atm.formattedAddress || atm.shortFormattedAddress || "";
  const phone   = atm.nationalPhoneNumber || atm.internationalPhoneNumber || "";
  const network = atm.network && atm.network !== "Independent" ? atm.network : null;
  const venueLabels = { airport:"Airport", transit:"Transit/Metro", hospital:"Hospital", hotel:"Hotel", gas:"Gas Station", convenience:"Convenience", mall:"Shopping Mall", grocery:"Grocery", entertainment:"Entertainment", bank:"Bank Branch", education:"School/Campus", community:"Community", liquor:"Liquor/Corner Shop", theme_park:"Theme Park", casino:"Casino" };
  // Kicker = bank / network (falls back to a generic ATM label when independent).
  const kicker  = network ? `🏦 ${network}` : `${atm.venueIcon || "🏧"} ${venueLabels[atm.venueType] || "ATM"}`;
  const openText = atm.is24Hours ? "Open 24/7" : (atm.isOpen === true ? "Open" : atm.isOpen === false ? "Closed" : "Hours Unknown");

  const Tag = ({ bg, color, children }) => (
    <span style={{ background:bg, color, borderRadius:"999px", padding:`${fs(D.tagPadV)} ${fs(D.tagPadH)}`, fontSize:fs(D.tagFs), fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>
  );

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity:0, y:22 }}
      animate={{ opacity:1, y:0 }}
      transition={{ delay: Math.min(index, 8) * 0.03 }}
      style={{
        background:"#fff", borderRadius:`${D.radius}px`, overflow:"hidden",
        boxShadow: isHighlighted
          ? `0 0 0 3px ${TEAL}, 0 24px 50px -30px rgba(22,17,13,.4)`
          : "0 24px 50px -30px rgba(22,17,13,.4)",
        border: isHighlighted ? `2px solid ${TEAL}` : `1px solid ${ED_RULE}`,
        transition:"box-shadow 0.3s, border 0.3s",
      }}
    >
      {/* Photo (editorial height) — index badge + network tag chrome layered
          over the photo or, when no photo exists, over the placeholder. */}
      <div style={{ position:"relative" }}>
        <ATMPhotoStrip
          photos={atm.photos}
          fallbackIcon={atm.venueIcon || "🏧"}
          onPhotoClick={(i) => setGallery({ open: true, idx: i })}
          height={D.photoH}
        />
        <div style={{ position:"absolute", top:fs(D.chromeOff), left:fs(D.chromeOff), width:fs(D.idxSize), height:fs(D.idxSize), borderRadius:"50%", background:TEAL, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:fs(D.idxFs), boxShadow:"0 2px 8px rgba(0,0,0,0.25)", border:"2px solid #fff" }}>{index+1}</div>
        {network && (
          <div style={{ position:"absolute", top:fs(D.chromeOff), right:fs(D.chromeOff), background:"rgba(255,255,255,0.95)", padding:`${fs(D.netPadV)} ${fs(D.netPadH)}`, borderRadius:"10px", fontSize:fs(D.netFs), fontWeight:700, color:"#1565C0", boxShadow:"0 1px 4px rgba(0,0,0,0.12)" }}>🏦 {network}</div>
        )}
        {atm.venueType && atm.venueType !== "standalone" && atm.venueType !== "bank" && venueLabels[atm.venueType] && (
          <div style={{ position:"absolute", bottom:fs(D.chromeOff), left:fs(D.chromeOff), background:"rgba(0,0,0,0.65)", padding:`${fs(D.netPadV)} ${fs(D.netPadH)}`, borderRadius:"10px", fontSize:fs(D.venueFs), fontWeight:700, color:"#fff" }}>{atm.venueIcon} {venueLabels[atm.venueType]}</div>
        )}
      </div>

      <div style={{ padding:D.bodyPad }}>
        {/* Kicker (bank / network) — finder's own category accent (ATM = CAT.atm.ink #1F5BD6). */}
        <div style={{ color:CAT.atm.ink, fontWeight:600, fontSize:fs(D.kicker), letterSpacing:"0.2px" }}>{kicker}</div>
        {/* Serif name — 2-line clamp so it grows the card (not overlap) as glasses-scale text enlarges. */}
        <h3 style={{ fontFamily:ED_SERIF, fontWeight:400, fontSize:fs(D.name), lineHeight:1.04, color:ED_INK, margin:`${fs(D.nameMb)} 0 0`, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{name}</h3>

        {/* Address */}
        {address && <div style={{ marginTop:fs(D.addressMt), fontSize:fs(D.address), color:ED_INK3, lineHeight:1.4 }}>🗺️ {address}</div>}

        {/* Rating / distance sub-row */}
        <div style={{ display:"flex", gap:fs(D.subGap), alignItems:"center", flexWrap:"wrap", marginTop:fs(D.subMt), fontSize:fs(D.sub), color:ED_INK3 }}>
          {atm.rating && <span><span style={{ color:"#E0922F" }}>★</span> <span style={{ fontWeight:700, color:ED_INK2 }}>{atm.rating}</span>{atm.userRatingCount > 0 && <span> ({atm.userRatingCount})</span>}</span>}
          {atm.distanceMiles!=null && <span>{atm.rating ? "· " : ""}📍 {formatDistance(atm.distanceMiles)}</span>}
        </div>

        {/* Pill tags */}
        {atm.badges?.length > 0 && (
          <div style={{ display:"flex", gap:fs(D.tagsGap), flexWrap:"wrap", marginTop:fs(D.tagsMt) }}>
            {atm.badges.map((b, i) => <Tag key={i} bg={b.bg} color={b.color}>{b.icon} {b.label}</Tag>)}
          </div>
        )}

        {/* Open bar — always shown (matches phone ATMCard). When isOpen === null
            (no hours data, very common for ATMs) it falls through to the gray-dot
            "Hours Unknown" state; openText already supplies that label. */}
        <div style={{ marginTop:fs(D.openMt), background:atm.is24Hours ? "#EAF0FB" : atm.isOpen === true ? "#E7F3EA" : atm.isOpen === false ? "#FBE0DC" : "#F1F2F4", borderRadius:`${D.barRadius}px`, padding:`${fs(D.openPadV)} ${fs(D.openPadH)}`, fontSize:fs(D.openFs), fontWeight:600, color:atm.is24Hours ? "#1565C0" : atm.isOpen === true ? "#2E7D46" : atm.isOpen === false ? "#C2392F" : GRAY, display:"flex", alignItems:"center", gap:fs(D.openGap) }}>
          <span style={{ width:fs(D.openDot), height:fs(D.openDot), borderRadius:"50%", background:atm.is24Hours ? BLUE : atm.isOpen === true ? "#2E7D46" : atm.isOpen === false ? "#C2392F" : GRAY, flexShrink:0 }} />
          <span>{openText}</span>
          {atm.todayHours && !atm.is24Hours && <span style={{ color:ED_INK3, fontWeight:500 }}>· {atm.todayHours}</span>}
        </div>

        {/* Phone bar — skip entirely when no phone (ATMs often have none) */}
        {phone && (
          <a href={`tel:${phone}`} style={{ marginTop:fs(D.phoneMt), background:"#EFF4FB", borderRadius:`${D.barRadius}px`, padding:`${fs(D.phonePadV)} ${fs(D.phonePadH)}`, display:"flex", alignItems:"center", gap:fs(D.phoneGap), textDecoration:"none" }}>
            <span style={{ fontSize:fs(D.phoneIcon) }}>📞</span>
            <span><span style={{ display:"block", fontSize:fs(D.phoneNum), fontWeight:600, color:"#2E6FE0" }}>{phone}</span><span style={{ fontSize:fs(D.phoneSub), color:ED_INK3 }}>Tap to call</span></span>
          </a>
        )}

        {/* AI details — on the front card, above the actions */}
        <div style={{ marginTop:fs(D.actMt) }}>
          <AtmAIDetails placeId={atm.placeId || atm.id} placeName={name} page="ATMFinder" />
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:fs(D.actGap), marginTop:fs(D.actMt) }}>
          <button onClick={() => setShowDirs(true)} style={{ flex:1, borderRadius:`${D.barRadius}px`, padding:fs(D.actPad), fontSize:fs(D.actFs), fontWeight:600, border:"none", cursor:"pointer", fontFamily:"inherit", background:CAT.atm.ink, color:"#fff" }}>Directions</button>
          <button onClick={() => onShowOnMap?.(index)} style={{ flex:1, borderRadius:`${D.barRadius}px`, padding:fs(D.actPad), fontSize:fs(D.actFs), fontWeight:600, border:"none", cursor:"pointer", fontFamily:"inherit", background:ED_IVORY2, color:ED_INK2 }}>📍 Map</button>
          <button onClick={() => { const n=!expanded; setExpanded(n); onExpandChange?.(n); }} style={{ flex:1, borderRadius:`${D.barRadius}px`, padding:fs(D.actPad), fontSize:fs(D.actFs), fontWeight:600, border:"none", cursor:"pointer", fontFamily:"inherit", background:expanded ? ED_INK : ED_IVORY2, color:expanded ? "#fff" : ED_INK2 }}>{expanded ? "Less ▴" : "More ▾"}</button>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }} style={{ overflow:"hidden" }}>
              <div style={{ marginTop:fs(D.expMt), display:"flex", flexDirection:"column", gap:fs(D.expGap) }}>
                {atm.weekdayDescriptions?.length > 0 && (
                  <div style={{ padding:fs(D.panelPad), background:"#FAF7F0", borderRadius:`${D.panelRadius}px` }}>
                    <button onClick={() => setHoursExpanded(h => !h)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"transparent", border:"none", padding:0, cursor:"pointer", fontFamily:"inherit" }}>
                      <span style={{ fontSize:fs(D.hoursHeadFs), fontWeight:700, color:ED_INK3, letterSpacing:"0.5px" }}>🕐 DAILY HOURS</span>
                      <span style={{ fontSize:fs(D.hoursHeadFs), color:ED_INK3 }}>{hoursExpanded ? "▲" : "▼"}</span>
                    </button>
                    {hoursExpanded && (
                      <div style={{ marginTop:fs(8) }}>
                        {atm.weekdayDescriptions.map((day, i) => {
                          const today = new Date().getDay();
                          const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                          const dayIdx = dayNames.findIndex(d => day.toLowerCase().startsWith(d.toLowerCase()));
                          const isToday = dayIdx === today;
                          const parts = day.split(":");
                          const dayName = parts[0];
                          const hrs = parts.slice(1).join(":").trim();
                          return (
                            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:`${fs(4)} 0`, fontSize:fs(D.hoursRowFs), fontWeight:isToday ? 700 : 400, color:isToday ? TEAL_DEEP : ED_INK2, borderBottom:i<6 ? `1px solid ${ED_RULE}` : "none" }}>
                              <span>{dayName}{isToday && " (Today)"}</span>
                              <span>{hrs}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {(atm.websiteUri || atm.website) && (
                  <a href={atm.websiteUri || atm.website} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", gap:fs(D.siteGap), padding:fs(D.sitePad), background:"#F3E8FF", borderRadius:`${D.panelRadius}px`, textDecoration:"none", color:"#7C3AED" }}>
                    <span style={{ fontSize:fs(D.siteIcon) }}>🌐</span>
                    <span style={{ fontWeight:600, fontSize:fs(D.siteFs) }}>Visit Website</span>
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MapAppSelector
        isOpen={showDirs}
        onClose={() => setShowDirs(false)}
        destination={{ name, address: address || atm.vicinity || "", latitude: atm.lat, longitude: atm.lng }}
        userLat={userLat}
        userLng={userLng}
      />
      <PhotoGalleryModal photos={atm.photos || []} initialIndex={gallery.idx} isOpen={gallery.open} onClose={() => setGallery({ open: false, idx: 0 })} />
    </motion.div>
  );
}

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

  const hoursColor = is24H ? "#1565C0" : isOpen===true ? "#2E7D32" : isOpen===false ? "#D32F2F" : "#757575";
  const hoursBg    = is24H ? "#E3F2FD" : isOpen===true ? "#E8F5E9" : isOpen===false ? "#FFEBEE" : "#F5F5F5";
  const hoursDot   = is24H ? "#1976D2" : isOpen===true ? "#4CAF50" : isOpen===false ? "#FF6B6B" : "#9E9E9E";
  const hoursLabel = is24H ? "🔄 Open 24/7" : isOpen===true ? "Open Now" : isOpen===false ? "Closed" : "Hours N/A";

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:260px;position:relative;">
  <div style="padding:12px;padding-top:14px;">
    <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#E0F7FA;border-radius:6px;font-size:11px;font-weight:700;color:#00838F;margin-bottom:6px;">${venueIcon} ${network}</div>
    <div onclick="window._gsViewATM&&window._gsViewATM(${index})" style="font-weight:700;font-size:calc(14px*var(--fs));color:#1A2332;margin-bottom:5px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;">${name}</div>
    <div style="font-size:11px;color:#64748B;margin-bottom:6px;">${address}</div>
    <div style="font-size:calc(11px*var(--fs));padding:5px 8px;border-radius:6px;background:${hoursBg};margin-bottom:6px;">
      <span style="font-weight:700;color:${hoursColor};">${hoursLabel}</span>
      ${todayHours && !is24H ? `<span style="color:#64748B;"> · ${todayHours}</span>` : ""}
    </div>
    ${rating?`<div style="font-size:12px;color:#F59E0B;margin-bottom:6px;">★ <strong style="color:#1A2332;">${rating}</strong> <span style="color:#64748B;">(${ratingCount})</span>${distance?` · <span style="color:#00838F;">${distance}</span>`:''}</div>`:distance?`<div style="font-size:11px;color:#9E9E9E;margin-bottom:6px;">📍 ${distance}</div>`:''}
    ${phone?`<a href="tel:${phone}" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:6px 10px;background:#EFF6FF;border-radius:6px;text-decoration:none;color:#1565C0;font-size:calc(11px*var(--fs));font-weight:600;">📞 ${phone}</a>`:''}
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
      fontSize:"calc(13px*var(--fs))", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit",
      display:"flex", alignItems:"center", gap:"4px",
    }}>
      {emoji && <span>{emoji}</span>}{label}
    </button>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function ATMFinderPage() {
  // iPad: wider centered column + editorial ATM cards (design handoff).
  // Phone layout is unchanged — every tablet branch is gated on this.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  const [atms,           setATMs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [refreshTick,    setRefreshTick]    = useState(0);
  const forceNextRef                         = useRef(false);
  const handleRefresh                        = () => { forceNextRef.current = true; setRefreshTick(t=>t+1); };
  const [viewMode,       setViewMode]       = useState("list");
  const [bankFilter,     setBankFilter]     = useState("all");
  const [availableBanks, setAvailableBanks] = useState([]);
  const [openOnly,       setOpenOnly]       = useState(false);
  const [radius,         setRadius]         = useState(25); // wide net; no radius UI — nearest-first
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
    setRadius(25); // fixed wide net (radius filter removed app-wide)
  }, [activeLocation?.placeId]);

  // ── Fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lat || !lng) { setLoading(false); return; } // no location yet — don't spin forever
    let cancelled = false;
    setLoading(true);
    setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;

    (async () => {
      try {
        // List source: owned planet DB (free, global). Bank-network / fee / DCC /
        // skimmer AI details are unchanged — they resolve owned→Google on tap.
        const { data, error: workerError } = await callWorker(ROUTE.getATMOwned, {
          latitude:  lat,
          longitude: lng,
          radius:    radius * 1609,
          maxResults: 40,
          bankFilter,
          openOnly,
          forceRefresh: force,
        });
        if (cancelled) return; // a newer fetch (radius/filter/location change) superseded this one
        if (workerError) throw new Error(workerError);

        const rawList = data?.atms || data?.places || [];
        if (rawList.length > 0) {
          // Phase A5: rank pass appends 💎 Best Overall + 🛡️ Safest Option
          // badges. Uses only list-time signals — no extra Haiku calls.
          const processed = rankATMs(rawList.map(p => enrichATM(p, lat, lng)));
          setATMs(processed);
          if (data?.banks?.length > 0) setAvailableBanks(data.banks);
        } else {
          setError(data?.error || "No ATMs found. Try expanding your search radius.");
        }
      } catch (e) {
        if (cancelled) return;
        console.error("🏧 ATMFinder error:", e);
        setError(`Failed to load: ${e.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng, radius, bankFilter, openOnly, refreshTick]);

  // Distance-sorted backend already returns results in nearest order.
  const filtered = useMemo(() => atms, [atms]);

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
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsATMUserPin&&window._gsATMUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:calc(12px*var(--fs));margin-bottom:2px;padding-right:24px;">📍 You are here</div><div style="font-weight:700;color:#4285F4;font-size:calc(11px*var(--fs));margin-bottom:2px;">${userMode}</div><div style="color:#64748B;font-size:calc(10px*var(--fs));line-height:1.3;">${userLabel}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsATMUserPin&&window._gsATMUserPin()"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">📍 You are here</span><span style="color:#64748B;font-size:10px;font-weight:700;">⌄</span></div>`;
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
    <div className="font-sans" style={{ background: IVORY, minHeight:"100vh" }}>

      {/* HEADER — redesign pattern */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={() => window.history.back()} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]" style={{ background:'#FFFFFF', border:'1px solid #F0E9DC' }} aria-label="Back">
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]" style={{ background: CAT.atm.bg, color: CAT.atm.ink }}>
            <CreditCard size={13} color={CAT.atm.ink} strokeWidth={2} />
            ATM Finder
          </div>
          <RefreshButton onClick={handleRefresh} isRefreshing={loading} tone="light" title="Refresh ATMs" />
        </div>
      </div>

      {/* LOCATION CARD */}
      <div className={`px-4 ${colWrap} mx-auto pb-3`}>
        <button onClick={() => setShowLocPicker(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] text-left transition-transform active:scale-[0.99]" style={{ background:'#FFFFFF', border:'1px solid #F0E9DC', boxShadow:'0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)' }}>
          <MapPin size={18} color={TEAL_DEEP} strokeWidth={2} className="flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color:'#94A3B8' }}>
              {isCity ? '🏙️ City' : '📍 Location'}
            </div>
            <div className="font-bold text-[calc(14.5px*var(--fs))] text-[#0F1419] mt-0.5 truncate">{locLabel}</div>
          </div>
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: CAT.atm.bg, color: CAT.atm.ink }}>
            Change
          </span>
        </button>
        {isCity && (
          <div className="mt-2 px-3.5 py-2.5 rounded-[12px] text-[calc(12px*var(--fs))] leading-snug flex items-start gap-2" style={{ background: CAT.weather.bg, color: CAT.weather.ink }}>
            <span>💡</span>
            <span>Showing places across {activeLocation?.address?.city || activeLocation?.placeName} — {CITY_DISCLAIMER}</span>
          </div>
        )}
      </div>

      {/* Filter band */}
      <div className={`px-4 ${colWrap} mx-auto`}>

        {/* Radius buttons */}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"14px"}}><DistanceUnitToggle unit={unit} setUnit={setUnit} variant="light" /></div>

        {/* Quick filters row */}
        <div style={{ display:"flex", gap:"8px", alignItems:"center", overflowX:"auto", scrollbarWidth:"none", marginBottom:"8px" }}>
          {/* Open only pill */}
          <button onClick={() => setOpenOnly(o => !o)} style={{
            padding:"7px 13px", borderRadius:"20px", flexShrink:0,
            border: openOnly ? `2px solid ${GREEN}` : "1.5px solid #E2E8F0",
            background: openOnly ? "#E8F5E9" : "#fff",
            color: openOnly ? "#2E7D32" : GRAY,
            fontWeight: openOnly ? "700" : "500",
            fontSize:"calc(12px*var(--fs))", cursor:"pointer", fontFamily:"inherit",
          }}>🟢 Open Only</button>

          {/* Bank filter */}
          {availableBanks.length > 0 && (
            <select value={bankFilter} onChange={e => setBankFilter(e.target.value)} style={{
              padding:"7px 10px", borderRadius:"20px", flexShrink:0,
              border: bankFilter!=="all" ? `2px solid #1565C0` : "1.5px solid #E2E8F0",
              background: bankFilter!=="all" ? "#E3F2FD" : "#fff",
              color: bankFilter!=="all" ? "#1565C0" : GRAY,
              fontWeight: bankFilter!=="all" ? "700" : "500",
              fontSize:"calc(12px*var(--fs))", cursor:"pointer", fontFamily:"inherit",
              appearance:"none", paddingRight:"20px",
            }}>
              <option value="all">🏦 All Banks</option>
              {availableBanks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>

        {/* Stats (List/Map view toggle removed — list is primary; per-card map still works) */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"calc(13px*var(--fs))" }}>
          <span style={{ background:TEAL, color:"#fff", padding:"2px 9px", borderRadius:"10px", fontWeight:"700", fontSize:"calc(12px*var(--fs))" }}>{stats.total}</span>
          <span style={{ color:GRAY, fontWeight:"600" }}>ATMs</span>
          {stats.banks > 0 && <span style={{ color:"#1565C0", fontWeight:"600" }}>· {stats.banks} banks</span>}
          {stats.open  > 0 && <span style={{ color:"#2E7D32", fontWeight:"600" }}>· {stats.open} open</span>}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:"calc(48px*var(--fs))", marginBottom:"14px", animation:"pulse 1.5s infinite" }}>🏧</div>
          <div style={{ color:GRAY, fontWeight:"600", fontSize:"calc(15px*var(--fs))" }}>Finding ATMs worldwide…</div>
          <div style={{ color:GRAY, fontSize:"calc(12px*var(--fs))", marginTop:"6px" }}>Scanning airports, transit, stores, banks & more</div>
        </div>
      ) : error ? (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:"calc(40px*var(--fs))", marginBottom:"12px" }}>😕</div>
          <div style={{ color:CORAL, fontWeight:"600" }}>{error}</div>
          <button onClick={() => setRadius(r => Math.min(r+5,25))} style={{ marginTop:"14px", ...btn(TEAL,"#fff") }}>Try Larger Radius</button>
        </div>
      ) : viewMode === "list" ? (
        <div style={isTablet
          ? { maxWidth:1024, margin:"0 auto", padding:"0 24px 170px", display:"flex", flexDirection:"column", gap:"30px" }
          : { width:"100%", padding:"0 12px 100px", display:"flex", flexDirection:"column", gap:"16px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px", background:"#fff", borderRadius:"12px" }}>
              <div style={{ fontSize:"calc(32px*var(--fs))", marginBottom:"10px" }}>🔍</div>
              <div style={{ fontWeight:"600", color:DARK }}>No matches for this filter</div>
              <div style={{ color:GRAY, fontSize:"calc(13px*var(--fs))", marginTop:"4px" }}>Try expanding your radius or clearing filters</div>
            </div>
          ) : (
            filtered.map((atm, i) => {
              // Single editorial card serves both platforms — phone-tuned via isTablet.
              const Card = ATMCardTablet;
              return (
              <Card
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
                isTablet={isTablet}
              />
            );})
          )}
        </div>
      ) : (
        // Map view
        <div style={{ position:"relative" }}>
          <div ref={mapRef} style={{ height:"calc(100vh - 300px)", width:"100%" }} />
          {/* Legend — collapsible */}
          {showLegend ? (
            <div style={{ position:"absolute", bottom:"16px", left:"16px", zIndex:1000, background:"rgba(255,255,255,0.95)", borderRadius:"10px", padding:"8px 12px", fontSize:"calc(11px*var(--fs))", boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"4px" }}>
                <span style={{ fontWeight:"700", color:DARK }}>Pin Colors</span>
                <button onClick={()=>setShowLegend(false)} style={{ background:"none", border:"none", fontSize:"calc(14px*var(--fs))", color:GRAY, cursor:"pointer", padding:"0 0 0 8px", lineHeight:1 }}>✕</button>
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
            <button onClick={()=>setShowLegend(true)} style={{ position:"absolute", bottom:"16px", left:"16px", zIndex:1000, background:"rgba(255,255,255,0.95)", borderRadius:"8px", padding:"6px 10px", fontSize:"calc(11px*var(--fs))", fontWeight:"600", color:GRAY, border:"none", boxShadow:"0 2px 8px rgba(0,0,0,0.15)", cursor:"pointer" }}>🎨 Legend</button>
          )}
          {/* Close button */}
          <button onClick={() => setViewMode("list")} style={{ position:"fixed", top:"calc(50px + env(safe-area-inset-top) + 10px)", right:"14px", zIndex:1200, background:"#fff", borderRadius:"50%", width:"40px", height:"40px", border:"none", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:"calc(20px*var(--fs))", color:DARK }}>✕</button>
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
        <MapAppSelector
          isOpen={true}
          onClose={() => setDirectionsATM(null)}
          destination={{
            name: directionsATM.displayName?.text || directionsATM.name || "ATM",
            address: directionsATM.formattedAddress || directionsATM.shortFormattedAddress || directionsATM.vicinity || "",
            latitude: directionsATM.lat,
            longitude: directionsATM.lng,
          }}
          userLat={lat}
          userLng={lng}
        />
      )}
    </div>
  );
}