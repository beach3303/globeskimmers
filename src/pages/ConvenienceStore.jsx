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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '@/components/location/LocationContext';
import LocationModePicker from '@/components/location/LocationModePicker';
import { getLocationLabel, isCityLocation, CITY_DISCLAIMER } from '@/components/location/locationLabel';
import { base44 } from '@/api/base44Client';

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

const ADVANCED_FILTERS = [
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊', key: 'hasPharmacy' },
  { id: 'gas', label: 'Gas Station', icon: '⛽', key: 'hasGas' },
  { id: 'coffee', label: 'Coffee', icon: '☕', key: 'hasCoffee' },
  { id: 'restroom', label: 'Restrooms', icon: '🚻', key: 'hasRestroom' },
  { id: 'cards', label: 'Cards OK', icon: '💳', key: 'acceptsCards' }
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
// HELPER: Format Distance
// ============================================================================

function formatDistance(miles) {
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
    distance: store.distance_miles ?? store.distance ?? null,
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
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 10
        }}
      >
        ✕
      </button>
      
      {/* Photo */}
      <div
        style={{
          width: '100%',
          height: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
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
        fontSize: '14px'
      }}>
        {currentIndex + 1} / {photos.length}
      </p>
    </div>
  );
}

// ============================================================================
// COMPONENT: Directions Picker Modal
// ============================================================================

function DirectionsPicker({ isOpen, onClose, lat, lng, name, userLat, userLng }) {
  if (!isOpen) return null;
  const origin = userLat && userLng;
  const apps = [
    { icon: '🗺️', label: 'Google Maps', url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin?`&origin=${userLat},${userLng}`:""}` },
    { icon: '🍎', label: 'Apple Maps',  url: `https://maps.apple.com/?daddr=${lat},${lng}${origin?`&saddr=${userLat},${userLng}`:""}` },
    { icon: '📍', label: 'Waze',        url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
  ];
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,15,25,0.75)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'20px' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'24px 24px 16px 16px', padding:'24px', width:'100%', maxWidth:'400px' }}>
        <div style={{ width:'40px', height:'4px', background:'#E2E8F0', borderRadius:'2px', margin:'0 auto 20px' }}/>
        <div style={{ textAlign:'center', marginBottom:'18px' }}>
          <div style={{ fontSize:'22px', marginBottom:'4px' }}>🧭</div>
          <div style={{ fontWeight:'800', fontSize:'17px', color:COLORS.dark }}>Get Directions</div>
          <div style={{ fontSize:'13px', color:COLORS.textLight, marginTop:'3px' }}>{name}</div>
        </div>
        {apps.map(a => (
          <button key={a.label} onClick={() => { window.open(a.url, '_blank'); onClose(); }}
            style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', borderRadius:'14px', border:'1px solid #E2E8F0', background:'#FAFBFC', cursor:'pointer', fontFamily:'inherit', width:'100%', marginBottom:'10px', textAlign:'left' }}>
            <span style={{ fontSize:'26px' }}>{a.icon}</span>
            <span style={{ fontWeight:'700', color:COLORS.dark, fontSize:'15px' }}>{a.label}</span>
            <span style={{ marginLeft:'auto', color:COLORS.textLight, fontSize:'20px' }}>›</span>
          </button>
        ))}
        <button onClick={onClose} style={{ width:'100%', padding:'14px', borderRadius:'12px', border:'none', background:'#F1F5F9', color:COLORS.textLight, fontWeight:'700', cursor:'pointer', fontFamily:'inherit', fontSize:'14px' }}>Cancel</button>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT: Store Card (Beautiful Design)
// ============================================================================

function StoreCard({ store: rawStore, onSelect, isExpanded, userLat, userLng, onShowOnMap, index }) {
  const [showGallery, setShowGallery] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showDirs, setShowDirs] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const touchStartX = useRef(0);

  // Normalize the store data
  const store = normalizeStore(rawStore);
  const chainInfo = detectChain(store.name);
  const photos = store.photos || [];
  const mainPhotoUrl = photos.length > 0 && !photoError ? getPhotoUrl(photos[0], 600) : null;
  const todayHrs = getTodayHours(store.hours, store.is24Hours);
  
  // Swipe handlers for inline photo carousel
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = (e) => {
    if (photos.length <= 1) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentPhotoIndex < photos.length - 1) {
        setCurrentPhotoIndex(currentPhotoIndex + 1);
      } else if (diff < 0 && currentPhotoIndex > 0) {
        setCurrentPhotoIndex(currentPhotoIndex - 1);
      }
    }
  };
  
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
      <DirectionsPicker isOpen={showDirs} onClose={() => setShowDirs(false)} lat={store.lat} lng={store.lng} name={store.name} userLat={userLat} userLng={userLng} />
      
      <div
        style={{
          background: COLORS.card,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: COLORS.cardShadow,
          marginBottom: '16px',
          border: isExpanded ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
          transition: 'all 0.2s'
        }}
      >
        {/* Photo Section */}
        {mainPhotoUrl && (
          <div
            style={{
              position: 'relative',
              height: '160px',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
            onClick={() => photos.length > 0 && setShowGallery(true)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={getPhotoUrl(photos[currentPhotoIndex], 600)}
              alt={store.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'opacity 0.3s'
              }}
              onError={() => setPhotoError(true)}
            />
            
            {/* Gradient overlay */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '60px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.5))'
            }} />
            
            {/* Chain badge */}
            {chainInfo.chain && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: '#fff',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <span>{chainInfo.icon}</span>
                <span style={{ color: chainInfo.color }}>{chainInfo.chain}</span>
              </div>
            )}
            
            {/* Photo counter */}
            {photos.length > 1 && (
              <div style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                📷 {currentPhotoIndex + 1}/{photos.length}
              </div>
            )}
            
            {/* Photo dots */}
            {photos.length > 1 && (
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '6px'
              }}>
                {photos.slice(0, 5).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: idx === currentPhotoIndex ? '16px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      background: idx === currentPhotoIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                      transition: 'all 0.2s'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Card Content */}
        <div
          onClick={() => onSelect(store)}
          style={{ padding: '16px', cursor: 'pointer' }}
        >
          {/* Name Row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
            {/* Icon if no photo */}
            {(!mainPhotoUrl || photoError) && (
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: `${chainInfo.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0
              }}>
                {chainInfo.icon}
              </div>
            )}
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontSize: '17px',
                fontWeight: '600',
                color: COLORS.text,
                margin: 0,
                lineHeight: 1.3
              }}>
                {store.name}
              </h3>
              
              {/* Address - Always visible */}
              <p style={{
                fontSize: '13px',
                color: COLORS.textLight,
                margin: '4px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                📍 {store.shortAddress || store.address?.split(',').slice(0, 2).join(',')}
                {store.distance !== null && (
                  <span style={{ color: COLORS.textMuted }}>
                    · {formatDistance(store.distance)}
                  </span>
                )}
              </p>
            </div>
            
            {/* Status Badge */}
            <div style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600',
              background: store.isOpen ? '#DCFCE7' : store.isOpen === false ? '#FEE2E2' : '#F1F5F9',
              color: store.isOpen ? '#166534' : store.isOpen === false ? '#991B1B' : '#64748B',
              whiteSpace: 'nowrap'
            }}>
              {store.is24Hours ? '🌙 24hr' : store.isOpen ? '✓ Open' : store.isOpen === false ? 'Closed' : '—'}
            </div>
          </div>
          
          {/* Rating & Phone Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '10px',
            flexWrap: 'wrap'
          }}>
            {/* Rating */}
            {store.rating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#FBBF24', fontSize: '14px' }}>★</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: COLORS.text }}>
                  {store.rating.toFixed(1)}
                </span>
                {store.reviewCount > 0 && (
                  <span style={{ fontSize: '13px', color: COLORS.textLight }}>
                    ({store.reviewCount})
                  </span>
                )}
              </div>
            )}
            
            {/* Phone - Clickable */}
            {store.phone && (
              <a
                href={`tel:${store.phone}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '13px',
                  color: COLORS.secondary,
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
              >
                📞 {store.phone}
              </a>
            )}
          </div>

          {/* Today's Hours */}
          {todayHrs && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: store.is24Hours ? '#E3F2FD' : store.isOpen ? '#F0FDF4' : '#FEF2F2',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '10px'
            }}>
              <span style={{ fontWeight: '700', color: store.is24Hours ? '#1565C0' : store.isOpen ? '#15803D' : '#B91C1C' }}>🕐 Today</span>
              <span style={{ color: COLORS.text }}>{todayHrs}</span>
            </div>
          )}

          {/* Features Row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '10px'
          }}>
            {store.hasATM && (
              <span style={featureBadgeStyle}>🏧 ATM</span>
            )}
            {store.hasPharmacy && (
              <span style={featureBadgeStyle}>💊 Pharmacy</span>
            )}
            {store.hasHotFood && (
              <span style={featureBadgeStyle}>🍔 Hot Food</span>
            )}
            {store.hasCoffee && (
              <span style={featureBadgeStyle}>☕ Coffee</span>
            )}
            {store.hasFuel && (
              <span style={featureBadgeStyle}>⛽ Gas</span>
            )}
            {chainInfo.features.slice(0, 3).map((feat, idx) => (
              !['ATM', 'Pharmacy', 'Hot Food', 'Coffee', 'Gas'].some(f => feat.toLowerCase().includes(f.toLowerCase())) && (
                <span key={idx} style={featureBadgeStyle}>{feat}</span>
              )
            ))}
          </div>
          
          {/* Payment Row */}
          <div style={{
            display: 'flex',
            gap: '8px',
            paddingTop: '10px',
            borderTop: `1px solid ${COLORS.border}`
          }}>
            {store.acceptsCards && (
              <span style={paymentBadgeStyle('#DCFCE7', '#166534')}>💳 Cards</span>
            )}
            {store.acceptsMobilePay && (
              <span style={paymentBadgeStyle('#DBEAFE', '#1E40AF')}>📱 Apple Pay</span>
            )}
            {!store.cashOnly && (
              <span style={paymentBadgeStyle('#F0FDF4', '#166534')}>💵 Cash</span>
            )}
            {store.cashOnly && (
              <span style={paymentBadgeStyle('#FEF3C7', '#92400E')}>⚠️ Cash Only</span>
            )}
          </div>
        </div>

        {/* Action Buttons Row — always visible, outside clickable area */}
        <div style={{ display:'flex', gap:'8px', padding:'0 16px 12px' }} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setShowDirs(true)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius:'10px', border:'none', background:COLORS.primary, color:'#fff', fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>🧭 Directions</button>
          {store.lat&&store.lng&&<button onClick={()=>onShowOnMap?.(index)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', padding:'10px', borderRadius:'10px', border:'none', background:'#EDE9FE', color:'#7C3AED', fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>📍 Map</button>}
          <button onClick={()=>setShowHours(h=>!h)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'10px', borderRadius:'10px', border:'none', background:showHours?COLORS.dark:'#F1F5F9', color:showHours?'#fff':COLORS.dark, fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>{showHours?'▲ Less':'▼ Details'}</button>
        </div>

        {/* Inline Details (toggle): website + weekly hours */}
        {showHours&&(
          <div style={{ padding:'0 16px 12px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ background:'#F8FAFC', borderRadius:'10px', padding:'12px', border:`1px solid ${COLORS.border}` }}>
              {store.hours?.length>0&&(
                <>
                  <div style={{ fontSize:'11px', color:COLORS.textLight, fontWeight:'700', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>🕐 Weekly Hours</div>
                  {store.hours.map((h,i)=>{const today=new Date().getDay();const dn=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];const di=dn.findIndex(d=>h.toLowerCase().startsWith(d.toLowerCase()));const isT=di===today;const pts=h.split(':');const dn2=pts[0];const hrs=pts.slice(1).join(':').trim();return(<div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'13px',color:isT?COLORS.primary:COLORS.text,fontWeight:isT?'700':'400',padding:isT?'6px 8px':'4px 0',background:isT?`${COLORS.primary}10`:'transparent',borderRadius:isT?'6px':'0',borderLeft:isT?`3px solid ${COLORS.primary}`:'3px solid transparent'}}><span>{dn2}{isT&&<span style={{fontSize:'10px',color:COLORS.primary,marginLeft:'5px',fontWeight:'800'}}>TODAY</span>}</span><span style={{color:hrs.toLowerCase()==='closed'?COLORS.error:isT?COLORS.primary:COLORS.textLight}}>{hrs}</span></div>);})}
                </>
              )}
              {store.website&&(
                <a href={store.website} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:'8px', marginTop: store.hours?.length>0 ? '10px' : '0', padding:'8px 10px', background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:'8px', textDecoration:'none', color:COLORS.primary, fontSize:'13px', fontWeight:'600' }}>🌐 Visit Website</a>
              )}
            </div>
          </div>
        )}

        {/* Expanded Section */}
        {isExpanded && (
          <div style={{
            borderTop: `1px solid ${COLORS.border}`,
            padding: '16px',
            background: '#F8FAFC'
          }}>
            {/* Hours */}
            {store.hours && store.hours.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: COLORS.text,
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  🕐 Hours
                </h4>
                <div style={{ fontSize: '13px', color: COLORS.textLight, lineHeight: 1.6 }}>
                  {store.hours.slice(0, 4).map((h, i) => (
                    <div key={i}>{h}</div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Payment Tip */}
            {store.paymentTip && (
              <div style={{
                background: '#FEF3C7',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '13px',
                color: '#92400E',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <span>💡</span>
                <span>{store.paymentTip}</span>
              </div>
            )}
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={()=>setShowDirs(true)} style={{ flex:1, background:COLORS.primary, color:'#fff', padding:'12px', borderRadius:'10px', border:'none', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>🧭 Directions</button>
              {store.phone && (
                <a href={`tel:${store.phone}`} style={{ flex:1, background:COLORS.secondary, color:'#fff', padding:'12px', borderRadius:'10px', textAlign:'center', textDecoration:'none', fontSize:'14px', fontWeight:'600', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>📞 Call</a>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Badge styles
const featureBadgeStyle = {
  background: '#F1F5F9',
  color: '#475569',
  fontSize: '12px',
  padding: '4px 10px',
  borderRadius: '8px',
  fontWeight: '500'
};

const paymentBadgeStyle = (bg, color) => ({
  background: bg,
  color: color,
  fontSize: '12px',
  padding: '4px 10px',
  borderRadius: '8px',
  fontWeight: '500',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
});

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
        fontSize: '14px',
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

function buildStoreMapPopup(store, index) {
  const name    = store.name || 'Store';
  const address = store.address || store.shortAddress || '';
  const phone   = store.phone || null;
  const todayHrs = getTodayHours(store.hours, store.is24Hours);
  const isOpen   = store.isOpen;
  const is24     = store.is24Hours;
  const dist     = (store.distance !== null && store.distance !== undefined) ? formatDistance(store.distance) : '';
  const statusBg    = is24 ? '#E3F2FD' : isOpen === true ? '#E8F5E9' : isOpen === false ? '#FFEBEE' : '#F5F5F5';
  const statusColor = is24 ? '#1565C0' : isOpen === true ? '#2E7D32' : isOpen === false ? '#D32F2F' : '#9E9E9E';
  const statusLabel = is24 ? '🌙 Open 24/7' : isOpen === true ? '● Open' : isOpen === false ? '● Closed' : '● Hours N/A';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:260px;position:relative;">
      <div style="padding:12px;padding-top:14px;">
        <div onclick="window.viewStoreDetails&&window.viewStoreDetails(${index})" style="font-weight:700;font-size:15px;color:#1A2332;margin-bottom:6px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding-right:26px;">${name}</div>
        <div style="font-size:12px;color:#64748B;margin-bottom:6px;padding:6px 8px;background:#F8FAFC;border-radius:6px;">📍 ${address}${dist ? ` · ${dist}` : ''}</div>
        <div style="font-size:12px;margin-bottom:6px;padding:6px 10px;border-radius:6px;background:${statusBg};">
          <span style="font-weight:700;color:${statusColor};">${statusLabel}</span>
          ${todayHrs && !is24 ? `<span style="color:#64748B;"> · ${todayHrs}</span>` : ''}
        </div>
        ${phone ? `<a href="tel:${phone}" style="display:flex;align-items:center;gap:8px;margin:8px 0;padding:7px 10px;background:#E3F2FD;border-radius:6px;text-decoration:none;color:#1565C0;font-size:12px;"><span>📞</span><span style="font-weight:600;">${phone}</span></a>` : ''}
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
  const { activeLocation } = useLocation();

  // Coordinates pulled from the shared LocationContext (set via the Home location bar
  // or the Change-location flow). Lets users explicitly pick a city/landmark, matching
  // the pattern of CoffeeFinder, ATMFinder, etc.
  const location = activeLocation?.coordinates
    ? { latitude: activeLocation.coordinates.latitude, longitude: activeLocation.coordinates.longitude }
    : null;
  const locLabel = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);

  // State
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const [directionsStore, setDirectionsStore] = useState(null);
  const [showLocPicker, setShowLocPicker] = useState(false);

  // Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const cardRefs = useRef({});

  // Filters
  const [activeFilters, setActiveFilters] = useState({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchRadius, setSearchRadius] = useState(5);

  // Auto-size radius when user picks a city — wider default to cover the metro.
  useEffect(() => {
    if (activeLocation?.suggestedRadius) {
      setSearchRadius(activeLocation.suggestedRadius);
    }
  }, [activeLocation?.placeId]);
  
  // ============================================================================
  // FETCH STORES
  // ============================================================================
  
  const fetchStores = useCallback(async () => {
    if (!location) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: result } = await base44.functions.invoke('getConvenienceStores', {
        latitude: location.latitude,
        longitude: location.longitude,
        radius: searchRadius,
        limit: 50,
        sortBy: 'traveler_best',
        ...activeFilters
      });
      
      console.log('📦 Store result:', result);
      
      let storeList = result.stores || result.places || result.all_stores || [];
      console.log(`✅ Loaded ${storeList.length} stores`);
      
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
  // City-mode: re-sort by rating × log(review count) so well-known stores with
  // photos/reviews float over obscure spots at the centroid.
  const normalizedStores = (() => {
    const list = stores.map(normalizeStore);
    if (!isCity) return list;
    return [...list].sort((a, b) => {
      const sa = (a.rating || 0) * Math.log10(Math.max(a.reviewCount || 1, 1));
      const sb = (b.rating || 0) * Math.log10(Math.max(b.reviewCount || 1, 1));
      return sb - sa;
    });
  })();

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

      // User dot
      window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          html: '<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
          iconSize: [16, 16],
          className: ''
        })
      }).addTo(map);

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
          .bindPopup(buildStoreMapPopup(s, i), {
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
  }, [viewMode, stores, location, selectedMapIndex]);

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.background,
      paddingBottom: '100px'
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.primary} 0%, #2D5A8A 100%)`,
        padding: '20px',
        paddingTop: '52px',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '10px'
            }}
          >
            ← Back
          </button>
        </div>
        <div style={{ marginTop: '16px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🏪 Convenience Stores
          </h1>
          <p style={{
            fontSize: '14px',
            opacity: 0.85,
            margin: '6px 0 0'
          }}>
            Snacks, essentials & more nearby
          </p>

          {/* Location bar — same pattern as Coffee/ATM/Restroom finders */}
          <div
            onClick={() => setShowLocPicker(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 13px',
              background: '#fff',
              borderRadius: '12px',
              marginTop: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
            }}
          >
            <span style={{ color: COLORS.text, fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {isCity ? '🏙️' : '📍'} {locLabel}
            </span>
            <span style={{ background: COLORS.accent, color: '#fff', padding: '4px 10px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', flexShrink: 0, marginLeft: '10px' }}>
              Change
            </span>
          </div>

          {isCity && (
            <div style={{ fontSize: '11px', color: '#fff', padding: '8px 10px', background: 'rgba(252,211,77,0.20)', border: '1px solid rgba(252,211,77,0.55)', borderRadius: '10px', marginTop: '10px', lineHeight: 1.4 }}>
              💡 Showing places across {activeLocation?.address?.city || activeLocation?.placeName} — {CITY_DISCLAIMER}
            </div>
          )}
        </div>
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
          scrollbarWidth: 'none'
        }}>
          {QUICK_FILTERS.map(filter => (
            <FilterChip
              key={filter.id}
              filter={filter}
              isActive={activeFilters[filter.key]}
              onToggle={() => toggleFilter(filter.key)}
            />
          ))}
          
          {/* More Filters Button */}
          <button
            onClick={() => setShowAdvancedFilters(true)}
            style={{
              background: activeFilterCount > 0 ? COLORS.accent : '#fff',
              color: activeFilterCount > 0 ? '#fff' : COLORS.text,
              border: activeFilterCount > 0 ? 'none' : `1px solid ${COLORS.border}`,
              padding: '10px 16px',
              borderRadius: '24px',
              fontSize: '14px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚙️ More
            {activeFilterCount > 0 && (
              <span style={{
                background: 'rgba(255,255,255,0.3)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '12px'
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Advanced Filters Modal */}
      {showAdvancedFilters && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'flex-end'
        }}>
          <div style={{
            background: '#fff',
            width: '100%',
            maxHeight: '75vh',
            borderRadius: '24px 24px 0 0',
            overflow: 'auto',
            padding: '24px 20px'
          }}>
            {/* Sticky Close Button */}
            <button
              onClick={() => setShowAdvancedFilters(false)}
              style={{
                position: 'sticky',
                top: 0,
                float: 'right',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                background: COLORS.dark,
                color: '#fff',
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              ✕
            </button>
            
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              marginBottom: '20px',
              color: COLORS.text
            }}>
              Filters
            </h2>
            
            {/* Radius Slider */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '15px',
                fontWeight: '600',
                marginBottom: '12px',
                color: COLORS.text
              }}>
                <span>📍 Search Radius</span>
                <span style={{
                  background: COLORS.primary,
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '14px'
                }}>
                  {searchRadius} mi
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="25"
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  appearance: 'none',
                  background: `linear-gradient(to right, ${COLORS.primary} 0%, ${COLORS.primary} ${(searchRadius/25)*100}%, #E2E8F0 ${(searchRadius/25)*100}%, #E2E8F0 100%)`
                }}
              />
            </div>
            
            {/* All Filter Options */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {[...QUICK_FILTERS, ...ADVANCED_FILTERS].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => toggleFilter(filter.key)}
                  style={{
                    background: activeFilters[filter.key] ? COLORS.primary : '#F8FAFC',
                    color: activeFilters[filter.key] ? '#fff' : COLORS.text,
                    border: activeFilters[filter.key] ? 'none' : `1px solid ${COLORS.border}`,
                    padding: '14px 16px',
                    borderRadius: '14px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{filter.icon}</span>
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={clearFilters}
                style={{
                  flex: 1,
                  background: '#F1F5F9',
                  color: COLORS.text,
                  border: 'none',
                  padding: '16px',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
              <button
                onClick={() => {
                  setShowAdvancedFilters(false);
                  fetchStores();
                }}
                style={{
                  flex: 2,
                  background: COLORS.primary,
                  color: '#fff',
                  border: 'none',
                  padding: '16px',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(30,58,95,0.3)'
                }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Results */}
      <div style={{ padding: '16px' }}>
        {/* No location set yet */}
        {!location && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
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
                fontSize: '14px',
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
            <p style={{ fontSize: '15px' }}>Finding stores nearby...</p>
          </div>
        )}
        
        {/* Error */}
        {error && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
            <p style={{ color: COLORS.error, marginBottom: '16px' }}>{error}</p>
            <button
              onClick={fetchStores}
              style={{
                background: COLORS.primary,
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                fontSize: '14px',
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
              fontSize: '14px',
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
            <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', borderRadius: '10px', padding: '3px' }}>
              {['list', 'map'].map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: viewMode === v ? COLORS.primary : 'transparent',
                    color: viewMode === v ? '#fff' : COLORS.textLight,
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  {v === 'list' ? 'List View' : 'Map View'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Store Cards */}
        {!loading && !error && viewMode === 'list' && normalizedStores.map((store, idx) => (
          <div key={store.id || store.placeId || idx} ref={el => cardRefs.current[idx] = el}>
            <StoreCard
              store={store}
              index={idx}
              onSelect={(s) => setSelectedStore(selectedStore?.id === s.id ? null : s)}
              isExpanded={selectedStore?.id === (store.id || store.place_id)}
              userLat={location?.latitude}
              userLng={location?.longitude}
              onShowOnMap={handleShowOnMap}
            />
          </div>
        ))}

        {/* Map View */}
        {!loading && !error && viewMode === 'map' && stores.length > 0 && (
          <div style={{ position: 'relative', margin: '0 -16px' }}>
            <div ref={mapRef} style={{ height: 'calc(100vh - 280px)', width: '100%' }} />
            <button
              onClick={() => setViewMode('list')}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 1000,
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
                fontSize: '20px',
                color: COLORS.dark
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Directions modal triggered from map popup */}
        {directionsStore && (
          <DirectionsPicker
            isOpen={true}
            onClose={() => setDirectionsStore(null)}
            lat={directionsStore.lat}
            lng={directionsStore.lng}
            name={directionsStore.name}
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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
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
                fontSize: '14px',
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
