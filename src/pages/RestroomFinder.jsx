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
import RestroomAIDetails from "@/components/RestroomAIDetails";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapAppSelector from "@/components/MapAppSelector";
import { ChevronLeft, MapPin, Crosshair, Loader2 } from "lucide-react";
import { CAT, TEAL_DEEP, IVORY } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

// iPad editorial design tokens (design handoff — matches "Places to Eat · iPad").
const ED_SERIF = '"Instrument Serif", Georgia, serif';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)";

// ─── THEME ─────────────────────────────────────────────────────────────────
const TEAL = "#00BCD4";
const TEAL_DARK = "#00838F";
const TEAL_LIGHT = "#E0F7FA";
const CORAL = "#FF6B6B";
const GOLD = "#FFB74D";
const DARK = "#1A2332";
const DARK2 = "#243447";
const GRAY = "#64748B";
const GRAY_LIGHT = "#F1F5F9";
const GREEN = "#059669";
const GREEN_LIGHT = "#D1FAE5";
const BLUE = "#1565C0";
const BLUE_LIGHT = "#E3F2FD";
const PURPLE = "#7C3AED";
const AMBER = "#D97706";
const AMBER_LIGHT = "#FEF3C7";
const ORANGE = "#EA580C";
const ORANGE_LIGHT = "#FED7AA";

// ─── RADIUS OPTIONS ────────────────────────────────────────────────────────
const RADIUS_OPTIONS = [5, 10, 15, 25];

// ─── VENUE CATEGORIES ──────────────────────────────────────────────────────
const VENUE_TYPES = [
  { id: "all", label: "All", icon: "🚻", color: TEAL },
  { id: "public", label: "Public", icon: "🏛️", color: BLUE },
  { id: "transit", label: "Transit", icon: "🚇", color: PURPLE },
  { id: "coffee_food", label: "Coffee/Food", icon: "☕", color: "#92400E" },
  { id: "shopping", label: "Shopping", icon: "🛒", color: ORANGE },
  { id: "medical", label: "Medical", icon: "🏥", color: "#DC2626" },
  { id: "fuel", label: "Gas/Convenience", icon: "⛽", color: "#EA580C" },
  { id: "outdoor", label: "Parks", icon: "🌳", color: GREEN },
];

// ─── ACCESS TYPE DISPLAY ───────────────────────────────────────────────────
const ACCESS_CONFIG = {
  free: { label: "Free restroom", bg: GREEN_LIGHT, color: GREEN, icon: "💚" },
  customers_only: { label: "Customers only", bg: AMBER_LIGHT, color: AMBER, icon: "🛒" },
  fee_required: { label: "Fee required", bg: ORANGE_LIGHT, color: ORANGE, icon: "💰" },
  ticketed_entry: { label: "Inside ticketed venue", bg: "#EDE9FE", color: PURPLE, icon: "🎟️" },
  unknown: { label: "Access unclear", bg: GRAY_LIGHT, color: GRAY, icon: "❓" },
};

// ─── CONFIDENCE DISPLAY ────────────────────────────────────────────────────
const CONFIDENCE_CONFIG = {
  high: { label: "Confirmed", color: GREEN },
  medium: { label: "Likely", color: AMBER },
  low: { label: "Possible", color: GRAY },
};

// ─── FEATURE CHIPS (only show what matters) ────────────────────────────────
function getFeatureChips(r) {
  const chips = [];
  const p = r.properties || {};

  if (p.isClean) chips.push({ key: "clean", label: "Clean", icon: "✨", bg: "#E0F2FE", color: "#0284C7" });
  if (p.hasPaper) chips.push({ key: "paper", label: "Toilet paper", icon: "🧻", bg: "#D1FAE5", color: GREEN });
  if (p.isAccessible) chips.push({ key: "accessible", label: "Accessible", icon: "♿", bg: "#EDE9FE", color: PURPLE });
  if (p.hasFamily) chips.push({ key: "family", label: "Family", icon: "👶", bg: "#FCE7F3", color: "#BE185D" });
  if (p.hasBidet) chips.push({ key: "bidet", label: "Bidet/Washlet", icon: "🚿", bg: TEAL_LIGHT, color: TEAL_DARK });
  if (p.is24Hours) chips.push({ key: "24h", label: "24/7", icon: "🕐", bg: BLUE_LIGHT, color: BLUE });
  // Squat only shown if backend says so (already filtered by country)
  if (p.hasSquat) chips.push({ key: "squat", label: "Squat-style", icon: "🦵", bg: AMBER_LIGHT, color: AMBER });
  // Reachability warning
  if (r.reachability === "moderate") chips.push({ key: "stairs", label: "May have stairs", icon: "🚶", bg: GRAY_LIGHT, color: GRAY });

  return chips;
}

// ─── OPEN STATUS ───────────────────────────────────────────────────────────
function computeOpenStatus(r) {
  const hours = r.weekdayDescriptions || [];
  if (!hours.length) {
    if (r.isOpen === true) return { isOpen: true, label: "Open now", is24H: false, todayHours: "" };
    if (r.isOpen === false) return { isOpen: false, label: "Closed", is24H: false, todayHours: "" };
    return { isOpen: null, label: "Hours unknown", is24H: false, todayHours: "" };
  }
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[new Date().getDay()];
  const entry = hours.find(h => h?.toLowerCase?.().startsWith(todayName.toLowerCase()));
  if (!entry) return { isOpen: null, label: "Hours unknown", is24H: false, todayHours: "" };
  const colon = entry.indexOf(":");
  const hoursText = colon >= 0 ? entry.substring(colon + 1).trim() : "";
  if (hoursText.toLowerCase() === "closed") return { isOpen: false, label: "Closed today", is24H: false, todayHours: "Closed" };
  if (hoursText.toLowerCase().includes("24 hour")) return { isOpen: true, label: "Open 24/7", is24H: true, todayHours: "24 hours" };
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const ranges = hoursText.split(",").map(s => s.trim()).reduce((acc, seg) => {
    const m = seg.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[–\-]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (m) { const o = toM(m[1]); let c = toM(m[2]); if (c <= o) c += 1440; acc.push({ o, c }); }
    return acc;
  }, []);
  const open = ranges.some(r => cur >= r.o && cur < r.c);
  return { isOpen: open, label: open ? "Open now" : "Closed now", is24H: false, todayHours: hoursText };
}
function toM(s) {
  const n = s.trim().toUpperCase(), m = n.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!m) return 0;
  let h = parseInt(m[1]); const mins = m[2] ? parseInt(m[2]) : 0;
  if (m[3] === "PM" && h !== 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + mins;
}

// ─── PHOTO STRIP ───────────────────────────────────────────────────────────
function PhotoStrip({ photos, fallbackIcon = "🚻", onPhotoClick, height = null }) {
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState({ 0: true, 1: true });
  const valid = (photos || []).filter((p, i) => p && !errors[i]);
  // Optional editorial height (iPad). When unset, keep the original per-branch
  // phone heights exactly (no-photo/2-up = 140px, single = 160px) so the phone
  // layout is byte-identical.
  const H = (n) => (height != null ? `${height}px` : `${n}px`);

  if (!valid.length) return (
    <div style={{ height: H(140), background: `linear-gradient(135deg, ${TEAL_LIGHT}, #B2EBF2)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: "calc(48px*var(--fs))" }}>{fallbackIcon}</span>
    </div>
  );
  if (valid.length === 1) return (
    <div onClick={() => onPhotoClick?.(0)} style={{ position: "relative", height: H(160), overflow: "hidden", cursor: onPhotoClick ? "pointer" : "default" }}>
      {loading[0] && <div style={{ position: "absolute", inset: 0, background: TEAL_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "calc(36px*var(--fs))" }}>{fallbackIcon}</div>}
      <img src={valid[0]} alt="" onError={() => setErrors(p => ({ ...p, 0: true }))} onLoad={() => setLoading(p => ({ ...p, 0: false }))}
        style={{ width: "100%", height: H(160), objectFit: "cover", opacity: loading[0] ? 0 : 1, transition: "opacity 0.4s" }} />
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "60% 40%", height: H(140), overflow: "hidden" }}>
      {valid.slice(0, 2).map((url, i) => (
        <div key={i} onClick={() => onPhotoClick?.(i)} style={{ position: "relative", overflow: "hidden", borderRight: i === 0 ? "2px solid #fff" : "none", cursor: onPhotoClick ? "pointer" : "default" }}>
          {loading[i] && <div style={{ position: "absolute", inset: 0, background: TEAL_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "calc(28px*var(--fs))" }}>{fallbackIcon}</div>}
          <img src={url} alt="" onError={() => setErrors(p => ({ ...p, [i]: true }))} onLoad={() => setLoading(p => ({ ...p, [i]: false }))}
            style={{ width: "100%", height: H(140), objectFit: "cover", opacity: loading[i] ? 0 : 1, transition: "opacity 0.4s" }} />
        </div>
      ))}
    </div>
  );
}

// ─── RESTROOM CARD · EDITORIAL (responsive) ────────────────────────────────
// The editorial card, now rendered at BOTH widths. Mirrors PlacesToEat's
// RestaurantCardTablet (soft shadow, ED_* tokens, serif name, accent kicker,
// tinted pills, green/blue bars, More ▾ panel). Takes an `isTablet` prop and
// gates every size: tablet keeps the original handoff sizes; phone uses a
// compact, phone-tuned scale (≈200px photo, 20px radius, fs(26) serif name,
// fs(13) kicker, fs(16) body padding). Reuses the SAME fields + handlers +
// shared sub-components (PhotoStrip, NameLanguageHelp, getFeatureChips,
// computeOpenStatus, RestroomAIDetails, PhotoGalleryModal, MapAppSelector).
// Domain content only: access (free/customers/fee), clean/accessible/family/
// bidet chips, place type kicker. No phone bar unless a phone exists; no open
// bar unless hours exist. Every text size stays on fs() so the 4-step glasses
// control scales it; the serif name clamps to 2 lines and the card uses a
// min-height so enlarged text grows the card instead of clipping.
function RestroomCardTablet({ r, index, onShowOnMap, isHighlighted, cardRef, forceExpanded, onExpandChange, userLat, userLng, formatDistance, isTablet }) {
  const [showDirs, setShowDirs] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [gallery, setGallery] = useState({ open: false, idx: 0 });
  const [enriched, setEnriched] = useState(null);
  const fs = (n) => `calc(${n}px*var(--fs))`;

  useEffect(() => { if (forceExpanded) setExpanded(true); }, [forceExpanded]);
  // On first expand of an OWNED restroom, fetch real Google photos + hours
  // (resolves owned→Google once, cached). Keeps the list free; only opened
  // cards cost. The RestroomAIDetails panel below still receives the raw `r`.
  useEffect(() => {
    if (!expanded || enriched || r.source !== 'owned') return;
    callWorker('places/enrich-owned', { id: r.id || r.placeId, name: r.name, lat: r.lat, lng: r.lng, maxPhotos: 3 })
      .then(({ data }) => { if (data && data.matched) setEnriched(data); }).catch(() => {});
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = r.name || "Restroom";
  const address = r.formattedAddress || "";
  const phone = r.nationalPhoneNumber || r.internationalPhoneNumber || "";
  // Layer enrich (owned) photos + hours over the owned fields for display only.
  const photos = enriched?.photos?.length ? enriched.photos : (r.photos || []);
  const rStatus = enriched?.hours ? { ...r, weekdayDescriptions: enriched.hours.weekdayDescriptions, isOpen: enriched.hours.openNow ?? r.isOpen } : r;
  const openSt = computeOpenStatus(rStatus);
  const chips = getFeatureChips(r);
  const weekdayDesc = enriched?.hours?.weekdayDescriptions?.length ? enriched.hours.weekdayDescriptions : (r.weekdayDescriptions || []);
  const accCfg = ACCESS_CONFIG[r.accessType] || ACCESS_CONFIG.unknown;
  const hasOpen = openSt.todayHours || openSt.isOpen !== null;

  // Phone-tuned vs tablet sizing. Tablet values are the original handoff sizes.
  const S = isTablet
    ? { photoH: 360, radius: 28, bodyPad: `${fs(28)} ${fs(32)} ${fs(32)}`, name: 38, kicker: 17,
        rankBox: 36, rankFs: 15, rankPos: 16, overlayPad: `${fs(5)} ${fs(12)}`, overlayFs: 13,
        meta: 17, metaGap: 16, metaTop: 12, tagPad: `${fs(9)} ${fs(16)}`, tagFs: 15.5, tagGap: 10, tagTop: 16,
        sectTop: 16, sectPad: 16, sectRadius: "16px", icon: 18, bodyText: 16, noteTop: 14,
        barPad: `${fs(16)} ${fs(20)}`, barFs: 18, barDot: 10, barGap: 11,
        phonePad: `${fs(18)} ${fs(20)}`, phoneIcon: 24, phoneNum: 20, phoneSub: 15, phoneGap: 14,
        actGap: 12, actTop: 20, actPad: 15, actFs: 18, expTop: 20, expGap: 14, websitePad: 16, websiteIcon: 22, websiteText: 16 }
    : { photoH: 200, radius: 20, bodyPad: `${fs(16)} ${fs(16)} ${fs(18)}`, name: 26, kicker: 13,
        rankBox: 28, rankFs: 12, rankPos: 12, overlayPad: `${fs(4)} ${fs(10)}`, overlayFs: 11.5,
        meta: 13.5, metaGap: 10, metaTop: 8, tagPad: `${fs(6)} ${fs(11)}`, tagFs: 12.5, tagGap: 7, tagTop: 12,
        sectTop: 12, sectPad: 12, sectRadius: "14px", icon: 16, bodyText: 13.5, noteTop: 10,
        barPad: `${fs(11)} ${fs(13)}`, barFs: 13.5, barDot: 8, barGap: 9,
        phonePad: `${fs(12)} ${fs(14)}`, phoneIcon: 18, phoneNum: 14.5, phoneSub: 12, phoneGap: 11,
        actGap: 8, actTop: 14, actPad: 12, actFs: 14, expTop: 14, expGap: 10, websitePad: 12, websiteIcon: 18, websiteText: 14 };

  const Tag = ({ bg, color, children }) => (
    <span style={{ background: bg, color, borderRadius: "999px", padding: S.tagPad, fontSize: fs(S.tagFs), fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>
  );

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03, type: "spring", stiffness: 280, damping: 22 }}
      style={{
        background: "#fff", borderRadius: `${S.radius}px`, overflow: "hidden", height: "auto",
        boxShadow: isHighlighted ? `0 0 0 3px ${TEAL}, 0 24px 50px -30px rgba(0,188,212,0.5)` : "0 24px 50px -30px rgba(22,17,13,.4)",
        border: isHighlighted ? `2px solid ${TEAL}` : `1px solid ${ED_RULE}`,
      }}
    >
      {/* Photo — editorial height, reuses the same PhotoStrip (rank + venue pill + open status overlays) */}
      <div style={{ position: "relative" }}>
        <PhotoStrip
          photos={photos}
          fallbackIcon={r.venueIcon || "🚻"}
          height={S.photoH}
          onPhotoClick={(i) => setGallery({ open: true, idx: i })}
        />

        {/* Rank — top-3 medal gradients; rest use the restroom accent #0F8A82 for a single coherent color world */}
        <div style={{
          position: "absolute", top: `${S.rankPos}px`, left: `${S.rankPos}px`,
          background: index === 0 ? "linear-gradient(135deg,#FFD700,#FFA000)" : index === 1 ? "linear-gradient(135deg,#B0BEC5,#78909C)" : index === 2 ? "linear-gradient(135deg,#FFAB40,#F57C00)" : CAT.restroom.ink,
          color: "#fff", width: `${S.rankBox}px`, height: `${S.rankBox}px`, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: "800", fontSize: fs(S.rankFs), boxShadow: "0 2px 8px rgba(0,0,0,0.25)", border: "2px solid #fff"
        }}>{index + 1}</div>

        {/* Access tag (the "Dish Specialist"-style trust tag for restrooms) */}
        <div style={{ position: "absolute", top: `${S.rankPos}px`, right: `${S.rankPos}px`, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(6px)", padding: S.overlayPad, borderRadius: "999px", fontSize: fs(S.overlayFs), fontWeight: 700, color: accCfg.color, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
          {accCfg.icon} {accCfg.label}
        </div>

        {/* Open status pill */}
        {hasOpen && (
          <div style={{
            position: "absolute", bottom: `${S.rankPos}px`, right: `${S.rankPos}px`,
            background: openSt.isOpen === true || openSt.is24H ? "rgba(5,150,105,0.95)" : openSt.isOpen === false ? "rgba(220,38,38,0.95)" : "rgba(100,116,139,0.9)",
            backdropFilter: "blur(6px)", color: "#fff", padding: S.overlayPad, borderRadius: "999px",
            fontSize: fs(S.overlayFs), fontWeight: 700, display: "flex", alignItems: "center", gap: "5px"
          }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: openSt.isOpen === true || openSt.is24H ? "#69F0AE" : "#fff" }} />
            {openSt.label}
          </div>
        )}
      </div>

      <div style={{ padding: S.bodyPad }}>
        {/* Category kicker — place type (restroom accent #0F8A82) */}
        {r.venueLabel && <div style={{ color: CAT.restroom.ink, fontWeight: 600, fontSize: fs(S.kicker), letterSpacing: "0.2px" }}>{r.venueIcon} {r.venueLabel}</div>}
        <h3 style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(S.name), lineHeight: 1.04, color: ED_INK, margin: `${fs(4)} 0 0`, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{name}</h3>

        {/* Say it / Translate / rating / distance */}
        <div style={{ display: "flex", gap: fs(S.metaGap), alignItems: "center", flexWrap: "wrap", marginTop: fs(S.metaTop), fontSize: fs(S.meta), color: ED_INK3 }}>
          <NameLanguageHelp placeId={r.placeId || r.id} name={name} />
          {/* Muted "Google" after the stars — restroom ratings are Google Places data, and review sources are always labeled */}
          {r.rating && <span><span style={{ color: "#E0922F" }}>★</span> <span style={{ fontWeight: 700, color: ED_INK2 }}>{r.rating}</span>{r.userRatingCount > 0 ? ` (${r.userRatingCount.toLocaleString()})` : ''}<span style={{ fontSize: "0.8em", color: ED_INK3 }}> Google</span></span>}
          {r.distanceMiles != null && <span>· {formatDistance(r.distanceMiles)}</span>}
        </div>

        {/* Pill tags — clean / accessible / family / bidet / 24-7 / squat / stairs */}
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: fs(S.tagGap), flexWrap: "wrap", marginTop: fs(S.tagTop) }}>
            {chips.map(chip => (
              <Tag key={chip.key} bg={chip.bg} color={chip.color}>{chip.icon} {chip.label}</Tag>
            ))}
          </div>
        )}

        {/* Address */}
        {address && (
          <div style={{ marginTop: fs(S.sectTop), display: "flex", alignItems: "flex-start", gap: fs(10), padding: fs(S.sectPad), background: "#FAF7F0", borderRadius: S.sectRadius, border: `1px solid ${ED_RULE}` }}>
            <span style={{ fontSize: fs(S.icon), flexShrink: 0 }}>📍</span>
            <span style={{ fontSize: fs(S.bodyText), color: ED_INK2, lineHeight: 1.5 }}>{address}</span>
          </div>
        )}

        {/* Smart note */}
        {r.smartNote && (
          <div style={{ marginTop: fs(S.noteTop), display: "flex", alignItems: "center", gap: fs(10), padding: fs(S.sectPad), background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: S.sectRadius, fontSize: fs(S.bodyText), color: "#92400E" }}>
            <span style={{ fontSize: fs(S.icon) }}>💡</span>
            <span>{r.smartNote}</span>
          </div>
        )}

        {/* Open bar */}
        {hasOpen && (
          <div style={{
            marginTop: fs(S.noteTop), borderRadius: S.sectRadius, padding: S.barPad, fontSize: fs(S.barFs), fontWeight: 600,
            background: openSt.is24H ? "#EAF0FB" : openSt.isOpen === true ? "#E7F3EA" : openSt.isOpen === false ? "#FBE0DC" : ED_IVORY2,
            color: openSt.is24H ? "#2E6FE0" : openSt.isOpen === true ? "#2E7D46" : openSt.isOpen === false ? "#C2392F" : ED_INK3,
            display: "flex", alignItems: "center", gap: fs(S.barGap)
          }}>
            <span style={{ width: fs(S.barDot), height: fs(S.barDot), borderRadius: "50%", background: openSt.isOpen === true || openSt.is24H ? "#2E7D46" : openSt.isOpen === false ? "#C2392F" : GRAY, flexShrink: 0 }} />
            <span>{openSt.label}</span>
            {openSt.todayHours && !openSt.is24H && <span style={{ color: ED_INK3, fontWeight: 500 }}>· {openSt.todayHours}</span>}
          </div>
        )}

        {/* Phone bar */}
        {phone && (
          <a href={`tel:${phone}`} style={{ marginTop: fs(S.noteTop), background: "#EFF4FB", borderRadius: S.sectRadius, padding: S.phonePad, display: "flex", alignItems: "center", gap: fs(S.phoneGap), textDecoration: "none" }}>
            <span style={{ fontSize: fs(S.phoneIcon) }}>📞</span>
            <span><span style={{ display: "block", fontSize: fs(S.phoneNum), fontWeight: 600, color: "#2E6FE0" }}>{phone}</span><span style={{ fontSize: fs(S.phoneSub), color: ED_INK3 }}>Tap to call</span></span>
          </a>
        )}

        {/* AI details — on the front card, above the actions */}
        <div style={{ marginTop: fs(S.actTop) }}>
          <RestroomAIDetails placeId={r.placeId || r.id} placeName={name} venueLabel={r.venueLabel} venueCategory={r.venueCategory} accessType={r.accessType} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: fs(S.actGap), marginTop: fs(S.actTop) }}>
          <button onClick={() => setShowDirs(true)} style={{ flex: 1, borderRadius: S.sectRadius, padding: fs(S.actPad), fontSize: fs(S.actFs), fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: CAT.restroom.ink, color: "#fff" }}>Directions</button>
          <button onClick={() => onShowOnMap?.(index)} style={{ flex: 1, borderRadius: S.sectRadius, padding: fs(S.actPad), fontSize: fs(S.actFs), fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: ED_IVORY2, color: ED_INK2 }}>📍 Map</button>
          <button onClick={() => { const n = !expanded; setExpanded(n); onExpandChange?.(n); }} style={{ flex: 1, borderRadius: S.sectRadius, padding: fs(S.actPad), fontSize: fs(S.actFs), fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: expanded ? ED_INK : ED_IVORY2, color: expanded ? "#fff" : ED_INK2 }}>{expanded ? "Less ▴" : "More ▾"}</button>
        </div>

        {/* Expanded details: daily hours + AI Details + website */}
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
              <div style={{ marginTop: fs(S.expTop), display: "flex", flexDirection: "column", gap: fs(S.expGap) }}>
                {weekdayDesc.length > 0 && (
                  <div style={{ padding: fs(S.sectPad), background: "#FAF7F0", borderRadius: S.sectRadius }}>
                    <button onClick={() => setHoursExpanded(h => !h)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ fontSize: fs(S.kicker), fontWeight: 700, color: ED_INK3, letterSpacing: "0.5px" }}>🕐 DAILY HOURS</span>
                      <span style={{ fontSize: fs(S.kicker), color: ED_INK3 }}>{hoursExpanded ? '▲' : '▼'}</span>
                    </button>
                    {hoursExpanded && (
                      <div style={{ marginTop: fs(8) }}>
                        {weekdayDesc.map((day, i) => {
                          const today = new Date().getDay();
                          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                          const isToday = dayNames.findIndex(d => day?.toLowerCase?.().startsWith(d.toLowerCase())) === today;
                          const parts = (day || "").split(":"); const dayName = parts[0]; const hrs = parts.slice(1).join(":").trim();
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: `${fs(4)} 0`, fontSize: fs(S.bodyText), fontWeight: isToday ? 700 : 400, color: isToday ? TEAL_DEEP : ED_INK2, borderBottom: i < weekdayDesc.length - 1 ? `1px solid ${ED_RULE}` : "none" }}>
                              <span>{dayName}</span><span style={{ color: hrs.toLowerCase() === "closed" ? "#C2392F" : isToday ? TEAL_DEEP : ED_INK3 }}>{hrs}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {(r.websiteUri || r.website) && (
                  <a href={r.websiteUri || r.website} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: fs(12), padding: fs(S.websitePad), background: "#F3E8FF", borderRadius: S.sectRadius, textDecoration: "none", color: "#7C3AED" }}>
                    <span style={{ fontSize: fs(S.websiteIcon) }}>🌐</span>
                    <span style={{ display: "block", fontWeight: 600, fontSize: fs(S.websiteText) }}>Visit Website</span>
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
        destination={{ name, address: r.formattedAddress || r.vicinity || r.address || "", latitude: r.lat, longitude: r.lng }}
        userLat={userLat}
        userLng={userLng}
      />
      <PhotoGalleryModal photos={photos} initialIndex={gallery.idx} isOpen={gallery.open} onClose={() => setGallery({ open: false, idx: 0 })} />
    </motion.div>
  );
}

// ─── MAP BOTTOM SHEET (ChatGPT #5) ─────────────────────────────────────────
function MapBottomSheet({ restroom, expanded, onExpand, onClose, onDirections, formatDistance }) {
  if (!restroom) return null;

  const r = restroom;
  const name = r.name || "Restroom";
  const openSt = computeOpenStatus(r);
  const chips = getFeatureChips(r).slice(0, 4); // Limit chips in sheet

  return (
    <motion.div
      initial={{ y: 300 }}
      animate={{ y: 0 }}
      exit={{ y: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, info) => {
        if (info.offset.y > 100) onClose();
        else if (info.offset.y < -50) onExpand(true);
        else if (info.offset.y > 50) onExpand(false);
      }}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "#fff", borderRadius: "24px 24px 0 0",
        boxShadow: "0 -4px 30px rgba(0,0,0,0.15)",
        zIndex: 1001,
        maxHeight: expanded ? "78vh" : "32vh",
        overflow: "hidden",
        transition: "max-height 0.3s ease"
      }}
    >
      {/* Drag handle */}
      <div style={{ padding: "12px 0 8px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "40px", height: "4px", background: "#E2E8F0", borderRadius: "2px" }} />
      </div>

      <div style={{ padding: "0 16px 20px", overflowY: expanded ? "auto" : "hidden", maxHeight: expanded ? "calc(78vh - 50px)" : "calc(32vh - 50px)" }}>

        {/* Row 1: Name + distance + open */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
          <div>
            <div style={{ fontWeight: "800", fontSize: "calc(20px*var(--fs))", color: DARK, lineHeight: "1.2" }}>{name}</div>
            <div style={{ fontSize: "calc(13px*var(--fs))", color: GRAY, marginTop: "2px" }}>
              📍 {formatDistance(r.distanceMiles)}
              {r.venueLabel && <span> · {r.venueIcon} {r.venueLabel}</span>}
            </div>
          </div>
          <div style={{
            background: openSt.isOpen === true || openSt.is24H ? GREEN_LIGHT : openSt.isOpen === false ? "#FEE2E2" : GRAY_LIGHT,
            color: openSt.isOpen === true || openSt.is24H ? GREEN : openSt.isOpen === false ? "#DC2626" : GRAY,
            padding: "6px 12px", borderRadius: "20px", fontSize: "calc(12px*var(--fs))", fontWeight: "700", flexShrink: 0
          }}>
            {openSt.label}
          </div>
        </div>

        {/* Feature chips */}
        {chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
            {chips.map(chip => (
              <span key={chip.key} style={{ display: "inline-flex", alignItems: "center", gap: "3px", background: chip.bg, color: chip.color, padding: "4px 10px", borderRadius: "20px", fontSize: "calc(11px*var(--fs))", fontWeight: "600" }}>
                {chip.icon} {chip.label}
              </span>
            ))}
          </div>
        )}

        {/* Expanded content */}
        {expanded && (
          <>
            {/* Rating */}
            {r.rating && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "10px", fontSize: "calc(13px*var(--fs))" }}>
                <span style={{ color: GOLD }}>★</span>
                <span style={{ fontWeight: "700", color: DARK }}>{r.rating}</span>
                {r.userRatingCount > 0 && <span style={{ color: GRAY }}>({r.userRatingCount})</span>}
                {/* Source label — Google Places rating */}
                <span style={{ fontSize: "0.8em", color: GRAY }}>Google</span>
              </div>
            )}

            {/* Address */}
            {r.formattedAddress && (
              <div style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: "12px", border: "1px solid #E8EDF2", marginBottom: "10px", fontSize: "calc(13px*var(--fs))", color: DARK }}>
                📍 {r.formattedAddress}
              </div>
            )}

            {/* Smart note */}
            {r.smartNote && (
              <div style={{ padding: "10px 12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "12px", marginBottom: "10px", fontSize: "calc(12px*var(--fs))", color: "#92400E" }}>
                💡 {r.smartNote}
              </div>
            )}

            {/* Phone */}
            {(r.nationalPhoneNumber || r.internationalPhoneNumber) && (
              <a href={`tel:${r.nationalPhoneNumber || r.internationalPhoneNumber}`}
                style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", padding: "10px 12px", background: BLUE_LIGHT, borderRadius: "12px", textDecoration: "none" }}>
                <span style={{ width: "32px", height: "32px", background: BLUE, color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "calc(14px*var(--fs))" }}>📞</span>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "calc(14px*var(--fs))", color: BLUE }}>{r.nationalPhoneNumber || r.internationalPhoneNumber}</div>
                  <div style={{ fontSize: "calc(11px*var(--fs))", color: GRAY }}>Tap to call</div>
                </div>
              </a>
            )}
          </>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onDirections}
            style={{ flex: 2, padding: "14px", borderRadius: "14px", border: "none", background: `linear-gradient(135deg,${TEAL_DARK},${TEAL})`, color: "#fff", fontWeight: "700", fontSize: "calc(14px*var(--fs))", cursor: "pointer", fontFamily: "inherit" }}>
            🧭 Directions
          </button>
          {(r.nationalPhoneNumber || r.internationalPhoneNumber) && (
            <a href={`tel:${r.nationalPhoneNumber || r.internationalPhoneNumber}`}
              style={{ flex: 1, padding: "14px", borderRadius: "14px", background: "#EDE7F6", color: PURPLE, fontWeight: "700", fontSize: "calc(14px*var(--fs))", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              📞 Call
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function RestroomFinderPage() {
  const [restrooms, setRestrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // phase-2 (full list) in flight after the quick 3
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [refreshTick, setRefreshTick] = useState(0);
  const forceNextRef = useRef(false);
  const autoExpandRef = useRef(false); // when set, a 0-result 5mi search auto-widens to 10mi (refresh-to-current)
  const handleRefresh = () => { forceNextRef.current = true; setRefreshTick(t => t + 1); };
  const [venueType, setVenueType] = useState("all");
  const [radius, setRadius] = useState(25); // wide net; no radius UI — nearest-first
  const [openOnly, setOpenOnly] = useState(false);
  const [accessOnly, setAccessOnly] = useState(false);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [userPinExpanded, setUserPinExpanded] = useState(true);
  useEffect(() => {
    /** @type {any} */ (window)._gsRFUserPin = () => setUserPinExpanded(e => !e);
    return () => { delete /** @type {any} */ (window)._gsRFUserPin; };
  }, []);
  const [directionsRR, setDirectionsRR] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [activeMapPin, setActiveMapPin] = useState(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const cardRefs = useRef({});
  const mapRef = useRef(null);
  const mapInstRef = useRef(null);
  const markersRef = useRef([]);

  const { activeLocation, switchToCurrentLocation } = useLocation();
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locLabel = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);

  // iPad: wider centered column + editorial restroom cards (design handoff).
  // Phone layout is untouched.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";

  // Snap to live GPS. Restroom Finder is urgent ("I need one NOW"), so we give a
  // one-tap way to jump from a stale/city location to the user's exact current
  // position — which re-runs the search via the lat/lng effect below.
  const handleUseCurrentLocation = async () => {
    if (gpsLoading) return;
    setGpsLoading(true);
    try {
      await switchToCurrentLocation();
      // Urgent intent: search the user's exact spot at 5 mi, and auto-widen to
      // 10 mi if nothing turns up (handled in the fetch effect). forceRefresh +
      // refreshTick guarantee a fresh "now" search even if the coords are unchanged.
      autoExpandRef.current = true;
      setRadius(5);
      forceNextRef.current = true;
      setRefreshTick(t => t + 1);
    } catch { /* GPS denied/unavailable — user can still tap "Change" to pick manually */ }
    finally { setGpsLoading(false); }
  };

  useEffect(() => {
    setRadius(25); // fixed wide net (radius filter removed app-wide)
  }, [activeLocation?.placeId]);

  // Fetch
  useEffect(() => {
    if (!lat || !lng) { setLoading(false); setLoadingMore(false); return; }
    setLoading(true); setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;
    const radiusMeters = radius * 1609.34;
    let ignore = false;
    let gotQuick = false;
    const enrich = (raw) => raw.map(r => ({
      ...r,
      lat: r.location?.latitude || r.lat || 0,
      lng: r.location?.longitude || r.lng || 0,
    }));

    (async () => {
      // Phase 1 — nearest few, FAST (one distance-ranked query) so the first
      // results paint immediately. Best-effort; failures fall through to phase 2.
      try {
        const q = await callWorker(ROUTE.getRestroomOwned, {
          latitude: lat, longitude: lng, radius: radiusMeters, maxResults: 3, venueType,
          forceRefresh: force, quick: true,
        });
        const quickRaw = q.data?.restrooms || q.data?.places || [];
        if (!ignore && quickRaw.length) {
          gotQuick = true;
          setRestrooms(enrich(quickRaw));
          setLoading(false);      // show the first results immediately
          setLoadingMore(true);   // …while the full list loads
        }
      } catch { /* full pass below is the source of truth */ }

      // Phase 2 — full comprehensive list; replaces the quick teaser.
      try {
        // List source: owned planet DB (free, global). NOTE: Overture has few
        // public-restroom POIs, so coverage may be thin in some areas — the
        // auto-widen + empty-state fallbacks below still apply. The separate
        // restroom-ai-details logic is untouched.
        const { data, error: workerError } = await callWorker(ROUTE.getRestroomOwned, {
          latitude: lat, longitude: lng, radius: radiusMeters, maxResults: 30, venueType,
          forceRefresh: force,
        });
        if (ignore) return;
        if (workerError) throw new Error(workerError);
        const raw = data?.restrooms || data?.places || [];
        if (raw.length > 0) {
          setRestrooms(enrich(raw));
          autoExpandRef.current = false;
        } else if (autoExpandRef.current && radius < 10) {
          // No hits at 5 mi right after a refresh — auto-widen to 10 mi once.
          autoExpandRef.current = false;
          setRadius(10);
        } else if (!gotQuick) {
          autoExpandRef.current = false;
          setRestrooms([]);
          setError(data?.error || "No restrooms found. Try expanding radius.");
        }
        // else: full came back empty but we already have the quick results — keep them.
      } catch (e) {
        if (!ignore && !gotQuick) setError(`Failed to load: ${e.message}`);
      } finally {
        if (!ignore) { setLoading(false); setLoadingMore(false); }
      }
    })();

    return () => { ignore = true; };
  }, [lat, lng, radius, venueType, refreshTick]);

  const filtered = useMemo(() => {
    let r = [...restrooms];
    if (openOnly) r = r.filter(x => x.isOpen === true || x.properties?.is24Hours);
    if (accessOnly) r = r.filter(x => x.properties?.isAccessible);
    return r;
  }, [restrooms, openOnly, accessOnly]);

  const handleShowOnMap = (index) => {
    setViewMode("map"); setActiveMapPin(index); setSheetExpanded(false);
    setTimeout(() => {
      const r = filtered[index];
      if (mapInstRef.current && r?.lat && r?.lng) {
        mapInstRef.current.setView([r.lat, r.lng], 17);
      }
    }, 300);
  };

  // Map
  useEffect(() => {
    if (viewMode !== "map" || !mapRef.current || !lat || !lng) return;
    const init = () => {
      if (mapInstRef.current) mapInstRef.current.remove();
      markersRef.current = [];
      const map = window.L.map(mapRef.current).setView([lat, lng], 15);
      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { attribution: "© OSM © CARTO" }).addTo(map);
      mapInstRef.current = map;
      window._gsRRDirs = (i) => { if (filtered[i]) setDirectionsRR(filtered[i]); };
      window._gsRRView = (i) => { setActiveMapPin(i); setSheetExpanded(true); };

      // User pin with collapsible "📍 You are here" tooltip below
      // (anti-overlap with restroom popups above). Same pattern as
      // ThingsToDo / MoneyExchange / PlacesToEat / Coffee / ATM / Convenience.
      const userMode = activeLocation?.mode === 'navigate' ? 'Selected location' : 'Current location';
      const userLabel = locLabel || '';
      const userTooltipHtml = userPinExpanded
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsRFUserPin&&window._gsRFUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:calc(10px*var(--fs));font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:calc(12px*var(--fs));margin-bottom:2px;padding-right:24px;">📍 You are here</div><div style="font-weight:700;color:#4285F4;font-size:calc(11px*var(--fs));margin-bottom:2px;">${userMode}</div><div style="color:#64748B;font-size:calc(10px*var(--fs));line-height:1.3;">${userLabel}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsRFUserPin&&window._gsRFUserPin()"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">📍 You are here</span><span style="color:#64748B;font-size:calc(10px*var(--fs));font-weight:700;">⌄</span></div>`;
      window.L.marker([lat, lng], { icon: window.L.divIcon({ html: `<div style="width:14px;height:14px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`, iconSize: [14, 14], className: "" }) }).addTo(map).bindTooltip(userTooltipHtml, {permanent: true, direction: 'bottom', opacity: 1, offset: [0, 12], className: 'gs-user-tooltip', interactive: true});

      // Restroom markers
      filtered.forEach((r, i) => {
        if (!r.lat || !r.lng) return;
        const isActive = activeMapPin === i;
        const accessColor = r.accessType === "free" ? GREEN : r.accessType === "customers_only" ? AMBER : r.accessType === "fee_required" ? ORANGE : TEAL_DARK;
        const color = isActive ? "#FF6B35" : accessColor;
        const size = isActive ? 38 : 32;
        const marker = window.L.marker([r.lat, r.lng], {
          icon: window.L.divIcon({
            html: `<div style="width:${size}px;height:${size}px;background:${color};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${isActive ? 16 : 14}px;box-shadow:0 3px 12px ${color}70;border:${isActive ? 3 : 2}px solid #fff;">${r.venueIcon || "🚻"}</div>`,
            iconSize: [size, size], className: ""
          })
        }).addTo(map);
        const openSt = computeOpenStatus(r);
        const accCfg = ACCESS_CONFIG[r.accessType] || ACCESS_CONFIG.unknown;
        const phone = r.nationalPhoneNumber || r.internationalPhoneNumber || '';
        const chips = getFeatureChips(r).slice(0,4).map(c=>`<span style="display:inline-flex;align-items:center;gap:2px;background:${c.bg};color:${c.color};padding:3px 8px;border-radius:12px;font-size:10px;font-weight:600;">${c.icon} ${c.label}</span>`).join('');
        const popupHtml = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:260px;">
            <div style="padding:12px 14px;">
              <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:${accCfg.bg};border-radius:6px;font-size:11px;font-weight:700;color:${accCfg.color};margin-bottom:6px;">${accCfg.icon} ${accCfg.label}</div>
              <div style="font-weight:700;font-size:calc(14px*var(--fs));color:#1A2332;margin-bottom:4px;">${r.name||'Restroom'}</div>
              <div style="font-size:11px;color:#64748B;margin-bottom:6px;">${r.formattedAddress||''}</div>
              <div style="font-size:calc(11px*var(--fs));padding:5px 8px;border-radius:6px;background:${openSt.is24H?'#E3F2FD':openSt.isOpen===true?'#F0FDF4':openSt.isOpen===false?'#FEF2F2':'#F5F5F5'};margin-bottom:6px;">
                <span style="font-weight:700;color:${openSt.is24H?'#1565C0':openSt.isOpen===true?'#15803D':openSt.isOpen===false?'#DC2626':'#9E9E9E'};">${openSt.label}</span>
              </div>
              ${r.rating?`<div style="font-size:12px;color:#F59E0B;margin-bottom:6px;">★ <strong style="color:#1A2332;">${r.rating}</strong> <span style="color:#64748B;">(${r.userRatingCount||0})</span><span style="color:#9E9E9E;font-size:10px;"> Google</span> · <span style="color:#0D9488;">📍 ${formatDistance(r.distanceMiles)||'?'}</span></div>`:''}
              ${chips?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${chips}</div>`:''}
              ${phone?`<a href="tel:${phone}" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:6px 10px;background:#EFF6FF;border-radius:6px;text-decoration:none;color:#3B82F6;font-size:calc(11px*var(--fs));font-weight:600;">📞 ${phone}</a>`:''}
              <div style="display:flex;gap:8px;">
                <button onclick="window._gsRRDirs&&window._gsRRDirs(${i})" style="flex:1;padding:8px;border:none;border-radius:7px;background:#0D9488;color:#fff;font-weight:600;font-size:11px;cursor:pointer;">🧭 Directions</button>
                <button onclick="window._gsRRView&&window._gsRRView(${i})" style="flex:1;padding:8px;border:none;border-radius:7px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:11px;cursor:pointer;">📋 Details</button>
              </div>
            </div>
          </div>`;
        marker.bindPopup(popupHtml, {maxWidth:270,autoPan:true,autoPanPaddingTopLeft:[0,160],autoPanPaddingBottomRight:[20,20],keepInView:true,className:"gs-popup"});
        marker.on("click", () => { setActiveMapPin(i); setSheetExpanded(false); });
        markersRef.current[i] = marker;
      });

      if (activeMapPin !== null && filtered[activeMapPin]) {
        const r = filtered[activeMapPin];
        map.setView([r.lat, r.lng], 17);
      }
    };
    if (!window.L) {
      const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(link);
      const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = init; document.head.appendChild(s);
    } else init();
    return () => {
      if (mapInstRef.current) { mapInstRef.current.remove(); mapInstRef.current = null; }
    };
  }, [viewMode, filtered, lat, lng, activeMapPin, unit, userPinExpanded, locLabel, activeLocation?.mode]);

  const stats = { total: filtered.length, free: filtered.filter(r => r.accessType === "free").length, open: filtered.filter(r => r.isOpen === true || r.properties?.is24Hours).length };
  const selectedRestroom = activeMapPin !== null ? filtered[activeMapPin] : null;

  return (
    <div className="font-sans" style={{ background: IVORY, minHeight: "100vh" }}>

      {/* HEADER — redesign pattern */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]"
            style={{ background: '#FFFFFF', border: '1px solid #F0E9DC' }}
            aria-label="Back"
          >
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]"
            style={{ background: CAT.restroom.bg, color: CAT.restroom.ink }}
          >
            🚻 Restroom Finder
          </div>
          <RefreshButton onClick={handleRefresh} isRefreshing={loading} tone="light" title="Refresh restrooms" />
        </div>
      </div>

      {/* LOCATION CARD */}
      <div className={`px-4 ${colWrap} mx-auto pb-3`}>
        <button
          onClick={() => setShowLocPicker(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] text-left transition-transform active:scale-[0.99]"
          style={{ background: '#FFFFFF', border: '1px solid #F0E9DC', boxShadow: '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)' }}
        >
          <MapPin size={18} color={TEAL_DEEP} strokeWidth={2} className="flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: '#94A3B8' }}>
              {isCity ? '🏙️ City' : '📍 Location'}
            </div>
            <div className="font-bold text-[calc(14.5px*var(--fs))] text-[#0F1419] mt-0.5 truncate">{locLabel}</div>
          </div>
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: CAT.restroom.bg, color: CAT.restroom.ink }}>
            Change
          </span>
        </button>
        {isCity && (
          <div className="mt-2 px-3.5 py-2.5 rounded-[12px] text-[calc(12px*var(--fs))] leading-snug flex items-start gap-2" style={{ background: CAT.weather.bg, color: CAT.weather.ink }}>
            <span>💡</span>
            <span>Showing places across {activeLocation?.address?.city || activeLocation?.placeName} — {CITY_DISCLAIMER}</span>
          </div>
        )}
        {/* Two refreshes, side by side: subtle text (re-search the SELECTED
            location shown above) on the left; the prominent GPS "near me"
            snap on the right. */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-[calc(12.5px*var(--fs))] font-medium underline underline-offset-2 text-left disabled:opacity-50 transition-colors"
            style={{ color: CAT.restroom.ink }}
          >
            {loading ? 'Refreshing…' : 'Refresh search in this location'}
          </button>
          <button
            onClick={handleUseCurrentLocation}
            disabled={gpsLoading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[12px] font-semibold text-[calc(13px*var(--fs))] flex-shrink-0 transition-transform active:scale-[0.99] disabled:opacity-60"
            style={{ background: CAT.restroom.ink, color: '#fff' }}
          >
            {gpsLoading ? <Loader2 size={15} className="animate-spin" /> : <Crosshair size={15} />}
            {gpsLoading ? 'Locating…' : 'Refresh search near me'}
          </button>
        </div>
      </div>

      {/* Filters band — keeps existing radius/venue tabs structure, restyled to fit warm-ivory */}
      <div className={`px-4 ${colWrap} mx-auto pb-2`}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"14px"}}><DistanceUnitToggle unit={unit} setUnit={setUnit} variant="light" /></div>

        {/* Venue tabs */}
        <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
          <div style={{ display: "flex", gap: "6px", paddingBottom: "10px" }}>
            {VENUE_TYPES.map(vt => (
              <button key={vt.id} onClick={() => setVenueType(vt.id)} className="font-sans" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "8px 12px", borderRadius: "12px", flexShrink: 0, border: venueType === vt.id ? `2px solid ${vt.color}` : "1px solid #F0E9DC", background: venueType === vt.id ? `${vt.color}22` : "#fff", color: venueType === vt.id ? vt.color : '#475569', fontWeight: venueType === vt.id ? "700" : "500", fontSize: "calc(10px*var(--fs))", cursor: "pointer", minWidth: "64px" }}>
                <span style={{ fontSize: "calc(18px*var(--fs))" }}>{vt.icon}</span>
                <span>{vt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls bar — white background stays full-bleed; inner row is centered in the tablet column (mirrors the header wrappers) */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8EDF2" }}>
        <div className={`${colWrap} mx-auto`} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px", overflowX: "auto", scrollbarWidth: "none" }}>
          <button onClick={() => setOpenOnly(o => !o)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "20px", flexShrink: 0, border: openOnly ? `2px solid ${GREEN}` : "1px solid #E2E8F0", background: openOnly ? GREEN_LIGHT : "#fff", color: openOnly ? GREEN : GRAY, fontWeight: openOnly ? "700" : "500", fontSize: "calc(12px*var(--fs))", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: openOnly ? GREEN : "#CBD5E1" }} /> Open Now
          </button>
          <button onClick={() => setAccessOnly(a => !a)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "20px", flexShrink: 0, border: accessOnly ? `2px solid ${BLUE}` : "1px solid #E2E8F0", background: accessOnly ? BLUE_LIGHT : "#fff", color: accessOnly ? BLUE : GRAY, fontWeight: accessOnly ? "700" : "500", fontSize: "calc(12px*var(--fs))", cursor: "pointer", fontFamily: "inherit" }}>
            ♿ Accessible
          </button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <span style={{ background: TEAL, color: "#fff", padding: "2px 8px", borderRadius: "10px", fontWeight: "800", fontSize: "calc(12px*var(--fs))" }}>{stats.total}</span>
            {/* List/Map view toggle removed — list is primary; per-card map still works */}
          </div>
        </div>
      </div>

      {/* Content */}
      {(!lat || !lng) ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "calc(48px*var(--fs))", marginBottom: "14px" }}>📍</div>
          <div style={{ color: DARK, fontWeight: "700", fontSize: "calc(16px*var(--fs))", marginBottom: "6px" }}>Set your location to find restrooms</div>
          <div style={{ color: GRAY, fontSize: "calc(13px*var(--fs))", marginBottom: "18px", maxWidth: "300px", marginLeft: "auto", marginRight: "auto" }}>Find the nearest restroom right now — use your current location, or tap “Change” above to pick a place.</div>
          <button onClick={handleUseCurrentLocation} disabled={gpsLoading} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg,${TEAL_DARK},${TEAL})`, color: "#fff", fontWeight: "700", fontSize: "calc(14px*var(--fs))", cursor: gpsLoading ? "default" : "pointer", fontFamily: "inherit", opacity: gpsLoading ? 0.6 : 1 }}>
            {gpsLoading ? "Locating…" : "📍 Refresh to current location"}
          </button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ fontSize: "calc(48px*var(--fs))", marginBottom: "16px", display: "inline-block" }}>🚻</motion.div>
          <div style={{ color: DARK, fontWeight: "700", fontSize: "calc(16px*var(--fs))", marginBottom: "6px" }}>Finding restrooms nearby…</div>
          <div style={{ color: GRAY, fontSize: "calc(13px*var(--fs))" }}>Coffee · Malls · Transit · Parks · More</div>
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "calc(44px*var(--fs))", marginBottom: "14px" }}>😕</div>
          <div style={{ color: CORAL, fontWeight: "700", fontSize: "calc(16px*var(--fs))", marginBottom: "6px" }}>{error}</div>
          <button onClick={() => setRadius(r => Math.min(r + 5, 25))} style={{ marginTop: "14px", padding: "12px 24px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg,${TEAL_DARK},${TEAL})`, color: "#fff", fontWeight: "700", fontSize: "calc(14px*var(--fs))", cursor: "pointer", fontFamily: "inherit" }}>Try Larger Radius</button>
        </div>
      ) : viewMode === "list" ? (
        <div style={isTablet
          ? { maxWidth: 1024, margin: "0 auto", padding: "0 24px 170px", display: "flex", flexDirection: "column", gap: "30px" }
          : { padding: "14px 12px 100px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {loadingMore && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "6px", color: GRAY, fontSize: "calc(13px*var(--fs))", fontWeight: 600 }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Finding more restrooms nearby…
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 24px", background: "#fff", borderRadius: "20px" }}>
              <div style={{ fontSize: "calc(48px*var(--fs))", marginBottom: "14px" }}>🔍</div>
              <div style={{ fontWeight: "800", fontSize: "calc(18px*var(--fs))", color: DARK, marginBottom: "6px" }}>No matches</div>
              <div style={{ color: GRAY, fontSize: "calc(13px*var(--fs))" }}>Try removing filters or switching category</div>
            </div>
          ) : filtered.map((r, i) => {
            const Card = RestroomCardTablet;
            return (
            <Card key={r.id || i} r={r} index={i}
              onShowOnMap={handleShowOnMap}
              isHighlighted={highlightIdx === i}
              cardRef={el => cardRefs.current[i] = el}
              forceExpanded={expandedIdx === i}
              onExpandChange={exp => { if (!exp && expandedIdx === i) setExpandedIdx(null); }}
              userLat={lat}
              userLng={lng}
              formatDistance={formatDistance}
              isTablet={isTablet}
            />
          );})}
        </div>
      ) : (
        <div style={{ position: "relative", height: "calc(100vh - 280px)" }}>
          <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

          {/* Close map button */}
          <button onClick={() => setViewMode("list")} style={{ position: "fixed", top: "calc(50px + env(safe-area-inset-top) + 10px)", right: "14px", zIndex: 1200, background: "#fff", borderRadius: "50%", width: "40px", height: "40px", border: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "calc(18px*var(--fs))", color: DARK }}>✕</button>

          {/* Legend */}
          <div style={{ position: "absolute", top: "14px", left: "14px", zIndex: 1000, background: "rgba(255,255,255,0.95)", borderRadius: "10px", padding: "8px 12px", fontSize: "calc(10px*var(--fs))", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
            <div style={{ fontWeight: "700", marginBottom: "4px", color: DARK }}>Legend</div>
            {[{ color: GREEN, label: "Free" }, { color: AMBER, label: "Customers only" }, { color: TEAL_DARK, label: "Other" }].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "2px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: item.color }} />
                <span style={{ color: GRAY }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Bottom sheet */}
          <AnimatePresence>
            {selectedRestroom && (
              <MapBottomSheet
                restroom={selectedRestroom}
                expanded={sheetExpanded}
                onExpand={setSheetExpanded}
                onClose={() => setActiveMapPin(null)}
                onDirections={() => setDirectionsRR(selectedRestroom)}
                formatDistance={formatDistance}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar{display:none}
      `}</style>

      <MapAppSelector
        isOpen={!!directionsRR}
        onClose={() => setDirectionsRR(null)}
        destination={{
          name: directionsRR?.name || "Restroom",
          address: directionsRR?.formattedAddress || directionsRR?.vicinity || directionsRR?.address || "",
          latitude: directionsRR?.lat,
          longitude: directionsRR?.lng,
        }}
        userLat={lat}
        userLng={lng}
      />
      <LocationModePicker isOpen={showLocPicker} onClose={() => setShowLocPicker(false)} />
    </div>
  );
}
