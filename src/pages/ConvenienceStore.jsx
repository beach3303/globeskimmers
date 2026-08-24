/**
 * ============================================================================
 * CONVENIENCE STORE FINDER v8.0
 * ============================================================================
 * 
 * Fixes in v8:
 * - Field mapping fixed (snake_case from backend → camelCase display)
 * - Beautiful card design like PlacesToEat
 * - Address & phone visible on every card
 * - Clickable phone number for direct calling
 * - Swipeable photo gallery with fullscreen option
 * - Improved filter design
 * - Sticky X on advanced filters
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '@/components/location/LocationContext';
import LocationModePicker from '@/components/location/LocationModePicker';
import { getLocationLabel, isCityLocation, CITY_DISCLAIMER } from '@/components/location/locationLabel';
import { useDistanceUnit } from '@/components/location/distanceUnit';
import DistanceUnitToggle from '@/components/location/DistanceUnitToggle';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import RefreshButton from '@/components/RefreshButton';
import NameLanguageHelp from '@/components/NameLanguageHelp';
import MapAppSelector from '@/components/MapAppSelector';
import { ChevronLeft, MapPin, Store } from 'lucide-react';
import { CAT, TEAL_DEEP, IVORY } from '@/components/redesign/constants';
import { useIsTablet } from '@/lib/useIsTablet';

// iPad editorial design tokens (design handoff: "Places to Eat · iPad").
// Shared verbatim across finders so every tablet card matches.
const ED_SERIF = '"Instrument Serif", Georgia, serif';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)";
// Convenience-finder accent (green) — domain analog to ED_EAT on PlacesToEat.
const ED_CONV = CAT.convenience.ink;

// ============================================================================
// THEME - Matching PlacesToEat warm brown aesthetic
// ============================================================================

const COLORS = {
  primary: '#1E3A5F',
  secondary: '#4A6FA5',
  accent: '#FFB347',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E3A5F',
  textLight: '#64748B',
  textMuted: '#94A3B8',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  dark: '#0F172A',
  border: '#E2E8F0',
  cardShadow: '0 4px 16px rgba(0,0,0,0.08)'
};

// ============================================================================
// CHAIN INFO
// ============================================================================

const CHAIN_INFO = {
  '7-eleven': { chain: '7-Eleven', icon: '🏪', color: '#FF6B00', features: ['Slurpee', 'Hot food', 'ATM'] },
  'cvs': { chain: 'CVS', icon: '💊', color: '#CC0000', features: ['Pharmacy', 'Photo', 'ATM'] },
  'walgreens': { chain: 'Walgreens', icon: '💊', color: '#E31837', features: ['Pharmacy', 'Photo', 'ATM'] },
  'circle k': { chain: 'Circle K', icon: '⛽', color: '#E31837', features: ['Gas', 'Food', 'Drinks'] },
  'wawa': { chain: 'Wawa', icon: '🥪', color: '#B22222', features: ['Fresh food', 'Coffee', 'Gas'] },
  'sheetz': { chain: 'Sheetz', icon: '🍔', color: '#E31837', features: ['Made-to-order', 'Gas', '24hr'] },
  'speedway': { chain: 'Speedway', icon: '⛽', color: '#004B87', features: ['Gas', 'Snacks', 'Drinks'] },
  'chevron': { chain: 'Chevron', icon: '⛽', color: '#0066B2', features: ['Gas', 'ExtraMile'] },
  'shell': { chain: 'Shell', icon: '⛽', color: '#FBCE07', features: ['Gas', 'Select'] },
  'ampm': { chain: 'ampm', icon: '🌙', color: '#00A651', features: ['ARCO', 'Snacks'] },
  'quiktrip': { chain: 'QuikTrip', icon: '⛽', color: '#E31837', features: ['Gas', 'Kitchen'] },
  'racetrac': { chain: 'RaceTrac', icon: '⛽', color: '#00529B', features: ['Gas', 'Food'] },
  'family dollar': { chain: 'Family Dollar', icon: '💵', color: '#F26522', features: ['Budget'] },
  'dollar general': { chain: 'Dollar General', icon: '💵', color: '#FFCC00', features: ['Budget'] },
  'target': { chain: 'Target', icon: '🎯', color: '#CC0000', features: ['One-stop'] },
  'walmart': { chain: 'Walmart', icon: '🛒', color: '#0071CE', features: ['Everything'] }
};

// ============================================================================
// FILTERS CONFIG
// ============================================================================

const QUICK_FILTERS = [
  { id: 'open', label: 'Open Now', icon: '✅', key: 'openOnly' },
  { id: '24hr', label: '24 Hours', icon: '🌙', key: 'open24Hours' },
  { id: 'atm', label: 'ATM', icon: '🏧', key: 'hasATM' },
  { id: 'food', label: 'Hot Food', icon: '🍔', key: 'hasHotFood' }
];


// ============================================================================
// WORKER CONFIG
// ============================================================================

const API_BASE_URL = 'https://globeskimmers-api.maizasimeon.workers.dev';

// ============================================================================
// HELPER: Get Photo URL
// ============================================================================

function getPhotoUrl(photo, maxWidth = 400) {
  if (!photo) return null;
  // Handle both string URLs and photo objects with name
  if (typeof photo === 'string') return photo;
  if (photo.url) return photo.url;
  if (photo.name) {
    return `${API_BASE_URL}/places/photo?name=${encodeURIComponent(photo.name)}&maxWidth=${maxWidth}`;
  }
  return null;
}

// ============================================================================
// HELPER: Detect Chain
// ============================================================================

function detectChain(storeName) {
  const name = (storeName || '').toLowerCase();
  for (const [key, info] of Object.entries(CHAIN_INFO)) {
    if (name.includes(key)) {
      return info;
    }
  }
  return { chain: null, icon: '🏪', color: '#64748B', features: [] };
}

// ============================================================================
// HELPER: Format Distance (legacy miles-only fallback)
// ============================================================================

function formatDistanceMi(miles) {
  if (!miles && miles !== 0) return '';
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

// ============================================================================
// HELPER: Today's Hours (parses an entry like "Monday: 7:00 AM – 11:00 PM")
// ============================================================================

function getTodayHours(hoursArr, is24Hours) {
  if (is24Hours) return 'Open 24 hours';
  if (!Array.isArray(hoursArr) || hoursArr.length === 0) return null;
  const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAY[new Date().getDay()];
  const entry = hoursArr.find(h => typeof h === 'string' && h.toLowerCase().startsWith(today.toLowerCase()));
  if (!entry) return null;
  const txt = entry.substring(entry.indexOf(':') + 1).trim();
  if (!txt) return null;
  if (txt.toLowerCase() === 'closed') return 'Closed today';
  return txt;
}

// ============================================================================
// HELPER: Normalize Store Data (snake_case → camelCase)
// ============================================================================

function normalizeStore(store) {
  return {
    id: store.id || store.place_id,
    placeId: store.place_id || store.id,
    name: store.name || 'Unknown Store',
    address: store.address || store.formattedAddress || '',
    shortAddress: store.address?.split(',')[0] || store.shortAddress || '',
    latitude: store.latitude || store.lat || store.location?.latitude,
    longitude: store.longitude || store.lng || store.location?.longitude,
    lat: store.lat || store.latitude || store.location?.latitude,
    lng: store.lng || store.longitude || store.location?.longitude,
    distance: store.distance_miles ?? store.distance ?? store.distanceMiles ?? null,
    rating: store.rating,
    reviewCount: store.review_count || store.userRatingCount || 0,
    isOpen: store.is_open ?? store.isOpen ?? null,
    is24Hours: store.is_24_hours || store.is24Hours || false,
    hours: store.hours || [],
    hasATM: store.has_atm || store.hasATM || false,
    hasPharmacy: store.has_pharmacy || store.hasPharmacy || false,
    hasHotFood: store.has_hot_food || store.hasHotFood || false,
    hasCoffee: store.has_coffee || store.hasCoffee || false,
    hasRestroom: store.has_restroom || store.hasRestroom || false,
    hasFuel: store.has_fuel || store.hasFuel || false,
    acceptsCards: store.accepts_cards ?? store.acceptsCards ?? true,
    acceptsMobilePay: store.accepts_mobile_pay || store.acceptsMobilePay || false,
    cashOnly: store.cash_only || store.cashOnly || false,
    phone: store.phone || store.nationalPhoneNumber || null,
    website: store.website || store.websiteUri || null,
    googleMapsUrl: store.google_maps_url || store.googleMapsUrl || store.googleMapsUri || null,
    photos: store.photos || [],
    category: store.category || 'convenience',
    categoryIcon: store.category_icon || '🏪',
    isKnownChain: store.is_known_chain || store.isKnownChain || false,
    matchedChain: store.matched_chain || store.matchedChain || null,
    travelerScore: store.traveler_score || store.travelerScore || 50,
    paymentTip: store.payment_country_tip || store.paymentTip || null
  };
}

// ============================================================================
// COMPONENT: Photo Gallery with Swipe
// ============================================================================

function PhotoGallery({ photos, storeName, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);

  const goToPrevious = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };
  const goToNext = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < photos.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  if (!photos || photos.length === 0) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.95)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          fontSize: "calc(24px*var(--fs))",
          cursor: 'pointer',
          zIndex: 10
        }}
      >
        ✕
      </button>
      
      {/* Photo + side arrows (arrows only visible when >1 photo) */}
      <div
        style={{
          width: '100%',
          height: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          position: 'relative'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {photos.length > 1 && (
          <button
            onClick={goToPrevious}
            aria-label="Previous photo"
            style={{
              position: 'absolute',
              left: '16px',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: "calc(22px*var(--fs))",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5
            }}
          >
            ‹
          </button>
        )}
        <img
          src={getPhotoUrl(photos[currentIndex], 800)}
          alt={`${storeName} ${currentIndex + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '12px'
          }}
        />
        {photos.length > 1 && (
          <button
            onClick={goToNext}
            aria-label="Next photo"
            style={{
              position: 'absolute',
              right: '16px',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: "calc(22px*var(--fs))",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5
            }}
          >
            ›
          </button>
        )}
      </div>
      
      {/* Dots Indicator */}
      {photos.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '16px'
        }}>
          {photos.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              style={{
                width: idx === currentIndex ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                border: 'none',
                background: idx === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
      )}
      
      {/* Counter */}
      <p style={{
        color: 'rgba(255,255,255,0.7)',
        marginTop: '12px',
        fontSize: "calc(14px*var(--fs))"
      }}>
        {currentIndex + 1} / {photos.length}
      </p>
    </div>
  );
}

// ============================================================================
// COMPONENT: Store Card — editorial layout (design handoff)
// ============================================================================
// Full-width editorial card mirroring RestaurantCardTablet exactly: big photo
// (rank badge + chain tag), green domain kicker (store type / chain), serif
// name, Say-it/Translate (NameLanguageHelp) + ★rating(count) + · distance row,
// tinted pill tags (24hr/ATM/Hot Food/Coffee/Gas/Pharmacy/chain features), a
// green Open bar, a blue phone bar, Directions/Map/More action buttons, and a
// "More ▾" expand panel (payment row, payment tip, daily hours, website).
// Same props/handlers as the old StoreCard; reuses normalizeStore / detectChain
// / getTodayHours / getPhotoUrl / PhotoGallery / MapAppSelector / NameLanguageHelp.
// RESPONSIVE: `isTablet` gates every size — tablet keeps the big editorial
// proportions, phone (the primary platform) gets the compact phone-tuned set
// (~200px photo, 20px radius, serif fs26, etc.). All text uses fs() so the
// 4-step glasses control scales it; the serif name is 2-line clamped and the
// card uses min-height (never fixed) so growing text makes the card grow, not
// clip. This single card now renders at BOTH widths (the old phone StoreCard
// was removed).
function StoreCardTablet({ store: rawStore, isExpanded, userLat, userLng, onShowOnMap, index, formatDistance = formatDistanceMi, isTablet = false }) {
  const [expanded, setExpanded] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showDirs, setShowDirs] = useState(false);
  const [enriched, setEnriched] = useState(null);
  const touchStartX = useRef(0);
  const fs = (n) => `calc(${n}px*var(--fs))`;

  // Fetch real Google photos + hours for OWNED stores (owned records carry none) —
  // on MOUNT so the list card shows a real photo, not only on expand (mirrors Eat/
  // Coffee). Resolves owned→Google once; cached 90d so repeat views are free.
  useEffect(() => {
    // Enrich when the record has no photo yet (owned records carry none). Source-
    // agnostic: convenience owned rows tag `_source`, not `source`, so a source
    // check silently skipped them and no photo ever loaded.
    if (enriched || (rawStore.photos && rawStore.photos.length)) return;
    callWorker('places/enrich-owned', {
      id: rawStore.id || rawStore.placeId,
      name: rawStore.name || rawStore.displayName?.text,
      lat: rawStore.lat ?? rawStore.latitude,
      lng: rawStore.lng ?? rawStore.longitude,
      maxPhotos: 3,
    }).then(({ data }) => { if (data && data.matched) setEnriched(data); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phone-tuned vs tablet sizing. Tablet values are unchanged from the
  // original editorial card; phone values are the compact set from the spec.
  const t = isTablet;
  const SZ = {
    radius: t ? "28px" : "20px",
    photoH: t ? 360 : 200,
    pad: t ? `${fs(28)} ${fs(32)} ${fs(32)}` : `${fs(16)} ${fs(16)} ${fs(18)}`,
    kicker: t ? 17 : 13,
    name: t ? 38 : 26,
    metaRow: t ? 17 : 14,
    address: t ? 16 : 13.5,
    tag: t ? 15.5 : 12.5,
    openBar: t ? 18 : 13.5,
    phoneBar: t ? 20 : 13.5,
    actions: t ? 18 : 14,
    badgeIcon: t ? 64 : 44,
    medalMin: t ? 40 : 32,
    medalBig: t ? 20 : 16,
    medalSmall: t ? 15 : 12.5,
    minH: t ? 520 : 360,
  };

  // Normalize the store data (same as StoreCard)
  const store0 = normalizeStore(rawStore);
  // Layer enrich (owned) photos + hours over the owned fields for display only.
  const store = enriched ? {
    ...store0,
    photos: enriched.photos?.length ? enriched.photos : store0.photos,
    hours: enriched.hours?.weekdayDescriptions?.length ? enriched.hours.weekdayDescriptions : store0.hours,
    isOpen: enriched.hours?.openNow ?? store0.isOpen,
  } : store0;
  const chainInfo = detectChain(store.name);
  const photos = store.photos || [];
  const mainPhotoUrl = photos.length > 0 && !photoError ? getPhotoUrl(photos[0], 800) : null;
  const todayHrs = getTodayHours(store.hours, store.is24Hours);

  // Kicker = store type / chain
  const kicker = chainInfo.chain || (store.category
    ? store.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    : 'Convenience Store');
  const openText = store.is24Hours ? 'Open 24/7' : (store.isOpen ? 'Open' : 'Closed');

  // Swipe handlers for the inline photo carousel
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (photos.length <= 1) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentPhotoIndex < photos.length - 1) setCurrentPhotoIndex(currentPhotoIndex + 1);
      else if (diff < 0 && currentPhotoIndex > 0) setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  const rank = (index ?? 0) + 1;
  const rankLabel = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`;
  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  const Tag = ({ bg, color, children }) => (
    <span style={{ background: bg, color, borderRadius: "999px", padding: t ? `${fs(9)} ${fs(16)}` : `${fs(6)} ${fs(12)}`, fontSize: fs(SZ.tag), fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>
  );

  // Extra chain features not already covered by the boolean pills above.
  const extraFeatures = chainInfo.features.filter(
    (feat) => !['ATM', 'Pharmacy', 'Hot Food', 'Coffee', 'Gas'].some(f => feat.toLowerCase().includes(f.toLowerCase()))
  );

  return (
    <>
      {/* Fullscreen Gallery */}
      {showGallery && (
        <PhotoGallery
          photos={photos}
          storeName={store.name}
          onClose={() => setShowGallery(false)}
        />
      )}
      <MapAppSelector
        isOpen={showDirs}
        onClose={() => setShowDirs(false)}
        destination={{
          name: store.name,
          address: store.address || store.shortAddress || '',
          latitude: store.lat,
          longitude: store.lng,
        }}
        userLat={userLat}
        userLng={userLng}
      />

      <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(rank, 8) * 0.03 }}
        style={{ background: "#fff", borderRadius: SZ.radius, overflow: "hidden", boxShadow: "0 24px 50px -30px rgba(22,17,13,.4)", border: isExpanded ? `1px solid ${ED_CONV}` : `1px solid ${ED_RULE}`, minHeight: fs(SZ.minH) }}>

        {/* Photo — editorial height (tablet ~360 / phone ~200), rank badge + chain tag */}
        <div
          style={{ position: "relative", height: fs(SZ.photoH), overflow: "hidden", cursor: mainPhotoUrl ? "pointer" : "default", background: "#F1F5F9" }}
          onClick={() => photos.length > 0 && setShowGallery(true)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {mainPhotoUrl ? (
            <img
              src={getPhotoUrl(photos[currentPhotoIndex], 800)}
              alt={store.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.3s" }}
              onError={() => setPhotoError(true)}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(SZ.badgeIcon) }}>
              {chainInfo.icon}
            </div>
          )}

          {/* Rank badge */}
          <div style={{ position: "absolute", top: "14px", left: "14px", minWidth: fs(SZ.medalMin), height: fs(SZ.medalMin), padding: `0 ${fs(8)}`, borderRadius: "999px", background: rank <= 3 ? medalColors[rank - 1] : ED_CONV, color: "#fff", fontWeight: 800, fontSize: rank <= 3 ? fs(SZ.medalBig) : fs(SZ.medalSmall), display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", border: "2px solid #fff" }}>{rankLabel}</div>

          {/* Chain tag (the "Dish Specialist"-style tag analog) */}
          {chainInfo.chain && (
            <div style={{ position: "absolute", top: "14px", right: "14px", background: "rgba(255,255,255,0.95)", padding: `${fs(6)} ${fs(13)}`, borderRadius: "999px", fontSize: fs(t ? 14 : 12.5), fontWeight: 700, display: "flex", alignItems: "center", gap: fs(6), boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
              <span>{chainInfo.icon}</span>
              <span style={{ color: chainInfo.color }}>{chainInfo.chain}</span>
            </div>
          )}

          {/* Photo counter + dots */}
          {photos.length > 1 && mainPhotoUrl && (
            <div style={{ position: "absolute", bottom: "14px", right: "14px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: `${fs(4)} ${fs(10)}`, borderRadius: "999px", fontSize: fs(13), fontWeight: 600 }}>📷 {currentPhotoIndex + 1}/{photos.length}</div>
          )}
          {photos.length > 1 && mainPhotoUrl && (
            <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px" }}>
              {photos.slice(0, 5).map((_, idx) => (
                <div key={idx} style={{ width: idx === currentPhotoIndex ? "16px" : "6px", height: "6px", borderRadius: "3px", background: idx === currentPhotoIndex ? "#fff" : "rgba(255,255,255,0.5)", transition: "all 0.2s" }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: SZ.pad }}>
          {/* Kicker (store type / chain) */}
          <div style={{ color: ED_CONV, fontWeight: 600, fontSize: fs(SZ.kicker), letterSpacing: "0.2px" }}>{kicker}</div>
          {/* Serif name — 2-line clamp so enlarged text grows the card, not overflows */}
          <h3 style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: fs(SZ.name), lineHeight: 1.04, color: ED_INK, margin: `${fs(4)} 0 0`, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{store.name}</h3>

          {/* Say it / Translate / rating / distance */}
          <div style={{ display: "flex", gap: fs(t ? 16 : 10), alignItems: "center", flexWrap: "wrap", marginTop: fs(t ? 12 : 9), fontSize: fs(SZ.metaRow), color: ED_INK3 }}>
            <NameLanguageHelp placeId={store.placeId || store.id} name={store.name} />
            {store.rating > 0 && <span><span style={{ color: "#E0922F" }}>★</span> <span style={{ fontWeight: 700, color: ED_INK2 }}>{store.rating.toFixed(1)}</span>{store.reviewCount > 0 ? ` (${store.reviewCount.toLocaleString()})` : ''}</span>}
            {store.distance != null && <span>· {formatDistance(store.distance)}</span>}
          </div>

          {/* Address */}
          {(store.shortAddress || store.address) && (
            <div style={{ marginTop: fs(8), fontSize: fs(SZ.address), color: ED_INK3 }}>📍 {store.shortAddress || store.address?.split(',').slice(0, 2).join(',')}</div>
          )}

          {/* Pill tags */}
          <div style={{ display: "flex", gap: fs(t ? 10 : 8), flexWrap: "wrap", marginTop: fs(t ? 16 : 12) }}>
            {store.is24Hours && <Tag bg="#E3F2FD" color="#1565C0">🌙 24 Hours</Tag>}
            {store.hasATM && <Tag bg="#EAF0FB" color="#2E6FE0">🏧 ATM</Tag>}
            {store.hasHotFood && <Tag bg="#FDEBD7" color="#C57A1F">🍔 Hot Food</Tag>}
            {store.hasPharmacy && <Tag bg="#FBE0DC" color="#C2392F">💊 Pharmacy</Tag>}
            {store.hasCoffee && <Tag bg="#F2DDC4" color="#A85A2E">☕ Coffee</Tag>}
            {store.hasFuel && <Tag bg="#FEF9EE" color="#92400E">⛽ Gas</Tag>}
            {extraFeatures.slice(0, 3).map((feat, idx) => (
              <Tag key={idx} bg={ED_IVORY2} color={ED_INK2}>{feat}</Tag>
            ))}
          </div>

          {/* Open bar */}
          {store.isOpen !== null && (
            <div style={{ marginTop: fs(t ? 18 : 14), background: store.isOpen ? "#E7F3EA" : "#FBE0DC", borderRadius: t ? "16px" : "12px", padding: t ? `${fs(16)} ${fs(20)}` : `${fs(11)} ${fs(14)}`, fontSize: fs(SZ.openBar), fontWeight: 600, color: store.isOpen ? "#2E7D46" : "#C2392F", display: "flex", alignItems: "center", gap: fs(t ? 11 : 9) }}>
              <span style={{ width: fs(10), height: fs(10), borderRadius: "50%", background: store.is24Hours ? "#00BCD4" : (store.isOpen ? "#2E7D46" : "#C2392F"), flexShrink: 0 }} />
              <span>{openText}</span>
              {todayHrs && !store.is24Hours && <span style={{ color: ED_INK3, fontWeight: 500 }}>· {todayHrs}</span>}
            </div>
          )}

          {/* Phone bar */}
          {store.phone && (
            <a href={`tel:${store.phone}`} style={{ marginTop: fs(t ? 14 : 10), background: "#EFF4FB", borderRadius: t ? "16px" : "12px", padding: t ? `${fs(18)} ${fs(20)}` : `${fs(11)} ${fs(14)}`, display: "flex", alignItems: "center", gap: fs(t ? 14 : 11), textDecoration: "none" }}>
              <span style={{ fontSize: fs(t ? 24 : 18) }}>📞</span>
              <span><span style={{ display: "block", fontSize: fs(SZ.phoneBar), fontWeight: 600, color: "#2E6FE0" }}>{store.phone}</span><span style={{ fontSize: fs(t ? 15 : 12), color: ED_INK3 }}>Tap to call</span></span>
            </a>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: fs(t ? 12 : 8), marginTop: fs(t ? 20 : 14) }}>
            <button onClick={() => setShowDirs(true)} style={{ flex: 1, borderRadius: t ? "16px" : "12px", padding: fs(t ? 15 : 11), fontSize: fs(SZ.actions), fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: ED_CONV, color: "#fff" }}>Directions</button>
            {store.lat && store.lng && <button onClick={() => onShowOnMap?.(index)} style={{ flex: 1, borderRadius: t ? "16px" : "12px", padding: fs(t ? 15 : 11), fontSize: fs(SZ.actions), fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: ED_IVORY2, color: ED_INK2 }}>📍 Map</button>}
            <button onClick={() => setExpanded(e => !e)} style={{ flex: 1, borderRadius: t ? "16px" : "12px", padding: fs(t ? 15 : 11), fontSize: fs(SZ.actions), fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: expanded ? ED_INK : ED_IVORY2, color: expanded ? "#fff" : ED_INK2 }}>{expanded ? "Less ▴" : "More ▾"}</button>
          </div>

          {/* Expanded details */}
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                <div style={{ marginTop: fs(20), display: "flex", flexDirection: "column", gap: fs(14) }}>

                  {/* Payment row */}
                  <div style={{ padding: fs(16), background: "#FAF7F0", borderRadius: "16px", border: `1px solid ${ED_RULE}` }}>
                    <div style={{ fontSize: fs(13), fontWeight: 700, color: ED_INK3, letterSpacing: "0.5px", marginBottom: fs(9) }}>💳 PAYMENT</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: fs(8) }}>
                      {store.acceptsCards && <span style={{ background: "#E7F3EA", color: "#166534", padding: `${fs(5)} ${fs(13)}`, borderRadius: "999px", fontSize: fs(15), fontWeight: 600 }}>💳 Cards</span>}
                      {store.acceptsMobilePay && <span style={{ background: "#EAF0FB", color: "#1E40AF", padding: `${fs(5)} ${fs(13)}`, borderRadius: "999px", fontSize: fs(15), fontWeight: 600 }}>📱 Apple Pay</span>}
                      {!store.cashOnly && <span style={{ background: "#E7F3EA", color: "#166534", padding: `${fs(5)} ${fs(13)}`, borderRadius: "999px", fontSize: fs(15), fontWeight: 600 }}>💵 Cash</span>}
                      {store.cashOnly && <span style={{ background: "#FEF9EE", color: "#92400E", padding: `${fs(5)} ${fs(13)}`, borderRadius: "999px", fontSize: fs(15), fontWeight: 600 }}>⚠️ Cash Only</span>}
                    </div>
                  </div>

                  {/* Payment tip */}
                  {store.paymentTip && (
                    <div style={{ padding: fs(16), background: "#FEF9EE", borderRadius: "16px", border: "1px solid #FDE68A", fontSize: fs(16), color: "#92400E", display: "flex", alignItems: "flex-start", gap: fs(8) }}>
                      <span>💡</span>
                      <span>{store.paymentTip}</span>
                    </div>
                  )}

                  {/* Daily hours */}
                  {store.hours?.length > 0 && (
                    <div style={{ padding: fs(16), background: "#FAF7F0", borderRadius: "16px" }}>
                      <button onClick={() => setHoursExpanded(h => !h)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontSize: fs(13), fontWeight: 700, color: ED_INK3, letterSpacing: "0.5px" }}>🕐 DAILY HOURS</span>
                        <span style={{ fontSize: fs(13), color: ED_INK3 }}>{hoursExpanded ? '▲' : '▼'}</span>
                      </button>
                      {hoursExpanded && (
                        <div style={{ marginTop: fs(8) }}>
                          {store.hours.map((h, i) => {
                            const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const isToday = DAY.findIndex(d => h.toLowerCase().startsWith(d.toLowerCase())) === new Date().getDay();
                            const dn = h.split(':')[0];
                            const hrs = h.split(':').slice(1).join(':').trim();
                            return <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: `${fs(4)} 0`, fontSize: fs(15), fontWeight: isToday ? 700 : 400, color: isToday ? TEAL_DEEP : ED_INK2, borderBottom: i < store.hours.length - 1 ? `1px solid ${ED_RULE}` : "none" }}>
                              <span>{dn}</span><span style={{ color: hrs.toLowerCase() === 'closed' ? "#C2392F" : (isToday ? TEAL_DEEP : ED_INK2) }}>{hrs}</span>
                            </div>;
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Website */}
                  {store.website && (
                    <a href={store.website} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: fs(12), padding: fs(16), background: "#F3E8FF", borderRadius: "16px", textDecoration: "none", color: "#7C3AED" }}>
                      <span style={{ fontSize: fs(22) }}>🌐</span>
                      <span><span style={{ display: "block", fontWeight: 600, fontSize: fs(16) }}>Visit Website</span><span style={{ fontSize: fs(14), color: ED_INK3 }}>Hours &amp; more</span></span>
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

// ============================================================================
// COMPONENT: Filter Chip
// ============================================================================

function FilterChip({ filter, isActive, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: isActive ? COLORS.primary : '#fff',
        color: isActive ? '#fff' : COLORS.text,
        border: isActive ? 'none' : `1px solid ${COLORS.border}`,
        padding: '10px 16px',
        borderRadius: '24px',
        fontSize: "calc(14px*var(--fs))",
        fontWeight: '500',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s',
        boxShadow: isActive ? '0 2px 8px rgba(30,58,95,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      <span>{filter.icon}</span>
      <span>{filter.label}</span>
    </button>
  );
}

// ============================================================================
// MAP POPUP HTML
// ============================================================================

function buildStoreMapPopup(store, index, fmt = formatDistanceMi) {
  const name    = store.name || 'Store';
  const address = store.address || store.shortAddress || '';
  const phone   = store.phone || null;
  const todayHrs = getTodayHours(store.hours, store.is24Hours);
  const isOpen   = store.isOpen;
  const is24     = store.is24Hours;
  const dist     = (store.distance !== null && store.distance !== undefined) ? fmt(store.distance) : '';
  const statusBg    = is24 ? '#E3F2FD' : isOpen === true ? '#E8F5E9' : isOpen === false ? '#FFEBEE' : '#F5F5F5';
  const statusColor = is24 ? '#1565C0' : isOpen === true ? '#2E7D32' : isOpen === false ? '#D32F2F' : '#9E9E9E';
  const statusLabel = is24 ? '🌙 Open 24/7' : isOpen === true ? '● Open' : isOpen === false ? '● Closed' : '● Hours N/A';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:260px;position:relative;">
      <div style="padding:12px;padding-top:14px;">
        <div onclick="window.viewStoreDetails&&window.viewStoreDetails(${index})" style="font-weight:700;font-size:calc(15px*var(--fs));color:#1A2332;margin-bottom:6px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding-right:26px;">${name}</div>
        <div style="font-size:12px;color:#64748B;margin-bottom:6px;padding:6px 8px;background:#F8FAFC;border-radius:6px;">📍 ${address}${dist ? ` · ${dist}` : ''}</div>
        <div style="font-size:calc(12px*var(--fs));margin-bottom:6px;padding:6px 10px;border-radius:6px;background:${statusBg};">
          <span style="font-weight:700;color:${statusColor};">${statusLabel}</span>
          ${todayHrs && !is24 ? `<span style="color:#64748B;"> · ${todayHrs}</span>` : ''}
        </div>
        ${phone ? `<a href="tel:${phone}" style="display:flex;align-items:center;gap:8px;margin:8px 0;padding:7px 10px;background:#E3F2FD;border-radius:6px;text-decoration:none;color:#1565C0;font-size:calc(12px*var(--fs));"><span>📞</span><span style="font-weight:600;">${phone}</span></a>` : ''}
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button onclick="window.openDirectionsFromStoreMap&&window.openDirectionsFromStoreMap(${index})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#1E3A5F;color:#fff;font-weight:600;font-size:12px;cursor:pointer;">🧭 Directions</button>
          <button onclick="window.viewStoreDetails&&window.viewStoreDetails(${index})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#F1F5F9;color:#1A2332;font-weight:600;font-size:12px;cursor:pointer;">📋 Details</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ConvenienceStorePage() {
  const navigate = useNavigate();
  // iPad: wider centered column + editorial store cards (design handoff).
  // Phone layout is unchanged — every tablet branch is gated on this.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  const { activeLocation } = useLocation();

  // Coordinates pulled from the shared LocationContext (set via the Home location bar
  // or the Change-location flow). Lets users explicitly pick a city/landmark, matching
  // the pattern of CoffeeFinder, ATMFinder, etc.
  //
  // Memoized on the primitive lat/lng — without memoization, a new object reference
  // is created every render, which makes fetchStores re-create every render, which
  // makes the fetch useEffect re-fire infinitely → endless loading spinner with no
  // results ever rendered.
  const location = useMemo(
    () => activeLocation?.coordinates
      ? { latitude: activeLocation.coordinates.latitude, longitude: activeLocation.coordinates.longitude }
      : null,
    [activeLocation?.coordinates?.latitude, activeLocation?.coordinates?.longitude]
  );
  const locLabel = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);

  // State
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const forceNextRef = useRef(false);
  const handleRefresh = () => { forceNextRef.current = true; fetchStores(); };
  const [selectedStore, setSelectedStore] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const [directionsStore, setDirectionsStore] = useState(null);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [userPinExpanded, setUserPinExpanded] = useState(true);
  useEffect(() => {
    /** @type {any} */ (window)._gsCSUserPin = () => setUserPinExpanded(e => !e);
    return () => { delete /** @type {any} */ (window)._gsCSUserPin; };
  }, []);

  // Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const cardRefs = useRef({});

  // Filters
  const [activeFilters, setActiveFilters] = useState({});
  const [searchRadius, setSearchRadius] = useState(25); // wide net; no radius UI — nearest-first

  // Radius filter removed app-wide — fixed wide net, results shown nearest-first.
  useEffect(() => { setSearchRadius(25); }, [activeLocation?.placeId]);
  
  // ============================================================================
  // FETCH STORES
  // ============================================================================
  
  const fetchStores = useCallback(async () => {
    if (!location) return;
    
    setLoading(true);
    setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;

    try {
      // List source: Google (handleConvenienceStores) — it reads every feature
      // filter (open-24h / has-ATM / hot-food / …) + sortBy and returns hours,
      // so the filters actually work (the owned handler dropped them and owned
      // rows had no feature data). NOTE: this handler expects `radius` in MILES,
      // not meters — send searchRadius directly (it's already miles).
      const { data: result, error: workerError } = await callWorker(ROUTE.getConvenienceStores, {
        latitude: location.latitude,
        longitude: location.longitude,
        radius: searchRadius,
        maxResults: 50,
        limit: 50,
        sortBy: 'traveler_best',
        ...activeFilters,
        forceRefresh: force,
      });
      if (workerError) throw new Error(workerError);

      let storeList = result?.stores || result?.places || result?.all_stores || [];

      setStores(storeList);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  }, [location, searchRadius, activeFilters]);
  
  useEffect(() => {
    fetchStores();
  }, [fetchStores]);
  
  // ============================================================================
  // FILTER HANDLERS
  // ============================================================================
  
  const toggleFilter = (key) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  const clearFilters = () => {
    setActiveFilters({});
  };
  
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  // Pre-normalize for the map (so popup/markers match what cards display).
  // Default order is whatever the backend returned — typically by distance.
  const normalizedStores = stores.map(normalizeStore);

  const handleShowOnMap = (idx) => {
    setSelectedMapIndex(idx);
    setViewMode('map');
    setTimeout(() => {
      const s = normalizedStores[idx];
      if (mapInstanceRef.current && s?.lat && s?.lng) mapInstanceRef.current.setView([s.lat, s.lng], 16);
    }, 300);
  };

  // ============================================================================
  // LEAFLET MAP
  // ============================================================================

  useEffect(() => {
    if (viewMode !== 'map' || !mapRef.current || !location?.latitude || !location?.longitude) return;
    const lat = location.latitude;
    const lng = location.longitude;
    const init = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
      const map = window.L.map(mapRef.current).setView([lat, lng], 14);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
      mapInstanceRef.current = map;

      window.viewStoreDetails = (i) => {
        setViewMode('list');
        setTimeout(() => cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      };
      window.openDirectionsFromStoreMap = (i) => setDirectionsStore(normalizedStores[i]);

      // User pin with collapsible "📍 You are here" tooltip below
      // (anti-overlap with store popups above). Same pattern as
      // ThingsToDo / MoneyExchange / PlacesToEat / Coffee / ATM maps.
      const userMode = activeLocation?.mode === 'navigate' ? 'Selected location' : 'Current location';
      const userLabel = locLabel || '';
      const userTooltipHtml = userPinExpanded
        ? `<div style="font-family:-apple-system,sans-serif;padding:6px 8px;min-width:160px;position:relative;"><button onclick="window._gsCSUserPin&&window._gsCSUserPin()" aria-label="Collapse" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;cursor:pointer;color:#1A2332;font-size:calc(10px*var(--fs));font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;">⌃</button><div style="font-weight:800;color:#1A2332;font-size:calc(12px*var(--fs));margin-bottom:2px;padding-right:24px;">📍 You are here</div><div style="font-weight:700;color:#4285F4;font-size:calc(11px*var(--fs));margin-bottom:2px;">${userMode}</div><div style="color:#64748B;font-size:calc(10px*var(--fs));line-height:1.3;">${userLabel}</div></div>`
        : `<div style="font-family:-apple-system,sans-serif;padding:5px 9px;display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="window._gsCSUserPin&&window._gsCSUserPin()"><span style="font-weight:700;color:#1A2332;font-size:calc(11px*var(--fs));">📍 You are here</span><span style="color:#64748B;font-size:calc(10px*var(--fs));font-weight:700;">⌄</span></div>`;
      window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          html: '<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
          iconSize: [16, 16],
          className: ''
        })
      }).addTo(map).bindTooltip(userTooltipHtml, {permanent: true, direction: 'bottom', opacity: 1, offset: [0, 12], className: 'gs-user-tooltip', interactive: true});

      normalizedStores.forEach((s, i) => {
        if (!s.lat || !s.lng) return;
        const isSelected = i === selectedMapIndex;
        const pinBg = isSelected ? '#FF6B35' : COLORS.primary;
        const pinSize = isSelected ? 36 : 28;
        const pinBorder = isSelected ? '3px solid #fff' : '2px solid #fff';
        const pinShadow = isSelected
          ? '0 0 0 3px rgba(255,107,53,0.4), 0 3px 10px rgba(255,107,53,0.5)'
          : '0 2px 8px rgba(30,58,95,0.4)';
        const marker = window.L.marker([s.lat, s.lng], {
          icon: window.L.divIcon({
            html: `<div style="width:${pinSize}px;height:${pinSize}px;background:${pinBg};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${isSelected ? 14 : 12}px;box-shadow:${pinShadow};border:${pinBorder};">${i + 1}</div>`,
            iconSize: [pinSize, pinSize],
            className: ''
          })
        })
          .addTo(map)
          .bindPopup(buildStoreMapPopup(s, i, formatDistance), {
            maxWidth: 270,
            autoPan: true,
            autoPanPaddingTopLeft: [0, 160],
            autoPanPaddingBottomRight: [20, 20],
            keepInView: true,
            className: 'gs-popup'
          });
        if (isSelected) setTimeout(() => marker.openPopup(), 300);
      });
    };

    if (!window.L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = init;
      document.head.appendChild(script);
    } else {
      init();
    }

    return () => {
      delete window.viewStoreDetails;
      delete window.openDirectionsFromStoreMap;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode, stores, location, selectedMapIndex, unit, userPinExpanded, locLabel, activeLocation?.mode]);

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="font-sans" style={{ minHeight: '100vh', background: IVORY, paddingBottom: '100px' }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]" style={{ background:'#FFFFFF', border:'1px solid #F0E9DC' }} aria-label="Back">
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]" style={{ background: CAT.convenience.bg, color: CAT.convenience.ink }}>
            <Store size={13} color={CAT.convenience.ink} strokeWidth={2} />
            Convenience Stores
          </div>
          <RefreshButton onClick={handleRefresh} isRefreshing={loading} tone="light" title="Refresh stores" />
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
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: CAT.convenience.bg, color: CAT.convenience.ink }}>
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

      {/* RADIUS */}
      <div className={`px-4 ${colWrap} mx-auto pb-2`}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"14px"}}><DistanceUnitToggle unit={unit} setUnit={setUnit} variant="light" /></div>
      </div>

      {/* Quick Filters */}
      <div style={{
        background: '#fff',
        padding: '14px 16px',
        borderBottom: `1px solid ${COLORS.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '4px',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          ...(isTablet ? { maxWidth: 1024, margin: '0 auto' } : null)
        }}>
          {QUICK_FILTERS.map(filter => (
            <FilterChip
              key={filter.id}
              filter={filter}
              isActive={activeFilters[filter.key]}
              onToggle={() => toggleFilter(filter.key)}
            />
          ))}
        </div>
      </div>
      
      {/* Results */}
      <div style={isTablet
        ? { maxWidth: 1024, margin: '0 auto', padding: '16px 24px 170px' }
        : { padding: '16px' }}>
        {/* No location set yet */}
        {!location && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: "calc(48px*var(--fs))", marginBottom: '16px' }}>📍</div>
            <p style={{ color: COLORS.textLight, marginBottom: '16px' }}>
              Pick a location to find nearby convenience stores.
            </p>
            <button
              onClick={() => setShowLocPicker(true)}
              style={{
                background: COLORS.primary,
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                fontSize: "calc(14px*var(--fs))",
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Set Location
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && location && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: COLORS.textLight
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 16px',
              border: `4px solid ${COLORS.border}`,
              borderTopColor: COLORS.primary,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } } .gs-popup .leaflet-popup-content-wrapper{border-radius:12px;padding:0;overflow:hidden}.gs-popup .leaflet-popup-content{margin:0}`}</style>
            <p style={{ fontSize: "calc(15px*var(--fs))" }}>Finding stores nearby...</p>
          </div>
        )}
        
        {/* Error */}
        {error && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px'
          }}>
            <div style={{ fontSize: "calc(48px*var(--fs))", marginBottom: '16px' }}>😕</div>
            <p style={{ color: COLORS.error, marginBottom: '16px' }}>{error}</p>
            <button
              onClick={fetchStores}
              style={{
                background: COLORS.primary,
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                fontSize: "calc(14px*var(--fs))",
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
        )}
        
        {/* Results Count + View Toggle */}
        {!loading && !error && stores.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <p style={{
              fontSize: "calc(14px*var(--fs))",
              color: COLORS.textLight,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                background: COLORS.primary,
                color: '#fff',
                padding: '2px 10px',
                borderRadius: '10px',
                fontWeight: '600'
              }}>
                {stores.length}
              </span>
              stores within {searchRadius} mi
            </p>
            {/* List/Map view toggle removed — list is primary; per-card map still works */}
          </div>
        )}

        {/* Store Cards — editorial card at BOTH widths (phone-tuned via isTablet).
            Tablet: ~30px gap; phone: single-column full width, ~16px gap. */}
        {!loading && !error && viewMode === 'list' && normalizedStores.map((store, idx) => {
          const Card = StoreCardTablet;
          return (
          <div key={store.id || store.placeId || idx} ref={el => cardRefs.current[idx] = el} style={{ marginBottom: isTablet ? '30px' : '16px' }}>
            <Card
              store={store}
              index={idx}
              isTablet={isTablet}
              onSelect={(s) => setSelectedStore(selectedStore?.id === s.id ? null : s)}
              isExpanded={selectedStore?.id === (store.id || store.place_id)}
              userLat={location?.latitude}
              userLng={location?.longitude}
              onShowOnMap={handleShowOnMap}
              formatDistance={formatDistance}
            />
          </div>
        );})}

        {/* Map View */}
        {!loading && !error && viewMode === 'map' && stores.length > 0 && (
          <div style={{ position: 'relative', margin: '0 -16px' }}>
            <div ref={mapRef} style={{ height: 'calc(100vh - 280px)', width: '100%' }} />
            <button
              onClick={() => setViewMode('list')}
              style={{
                position: 'fixed',
                top: 'calc(50px + env(safe-area-inset-top) + 10px)',
                right: '14px',
                zIndex: 1200,
                background: '#fff',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: "calc(20px*var(--fs))",
                color: COLORS.dark
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Directions modal triggered from map popup */}
        {directionsStore && (
          <MapAppSelector
            isOpen={true}
            onClose={() => setDirectionsStore(null)}
            destination={{
              name: directionsStore.name,
              address: directionsStore.address || directionsStore.shortAddress || '',
              latitude: directionsStore.lat,
              longitude: directionsStore.lng,
            }}
            userLat={location?.latitude}
            userLng={location?.longitude}
          />
        )}
        
        {/* No Results */}
        {!loading && !error && stores.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px'
          }}>
            <div style={{ fontSize: "calc(48px*var(--fs))", marginBottom: '16px' }}>🔍</div>
            <p style={{ color: COLORS.textLight, marginBottom: '16px' }}>
              No stores found matching your filters
            </p>
            <button
              onClick={clearFilters}
              style={{
                background: COLORS.secondary,
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                fontSize: "calc(14px*var(--fs))",
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <LocationModePicker isOpen={showLocPicker} onClose={() => setShowLocPicker(false)} />
    </div>
  );
}
