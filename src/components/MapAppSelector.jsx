import React, { useState, useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Navigation, LocateFixed, Pencil } from 'lucide-react';
import { useDismissable } from '@/lib/dismissStack';
import { logDiscover } from '@/lib/logDiscover';
import { NEUTRAL, fs, worldOf } from '@/components/redesign/constants';

// Shared "Get directions" sheet used by every finder. Two key behaviors:
//   1. Destination is sent as the place's NAME + ADDRESS (human-readable) so the
//      maps app opens on the actual business — not a bare lat/long pin. Coords
//      are only a fallback when there's no address.
//   2. The user picks the STARTING point: their current location (default) or a
//      custom address they type. Waze can only start from current location, so
//      a custom origin is honored for Google/Apple and noted for Waze.
//
// Look (the new look): no emoji. The maps apps are plain rows, each the app's name with
// one lucide Navigation glyph, at least 44px tall; the starting point is a pair of
// aria-pressed buttons; every control is 44px. It opens as a dialog with focus inside and
// hands focus back when it closes. world (optional, a WORLD row or key) colours the
// selected starting point and the icons; without it the sheet is in the shared neutrals.
//
// destination: { name, address, latitude|lat, longitude|lng }
/**
 * @param {{ isOpen?: boolean, onClose?: () => void, destination?: any, userLat?: number|null, userLng?: number|null, world?: any }} props
 */
export default function MapAppSelector({ isOpen = false, onClose = undefined, destination = undefined, userLat = null, userLng = null, world = undefined }) {
  const haveCurrent = !!(userLat && userLng);
  const [originMode, setOriginMode] = useState('current'); // 'current' | 'custom'
  const [customOrigin, setCustomOrigin] = useState('');
  const titleId = useId();
  const inputId = useId();
  const sheetRef = useRef(null);
  const w = world && typeof world === 'object' ? world : worldOf(world);
  const accent = w ? w.ink : NEUTRAL.tealInk;
  const accentInk = w ? w.chipOnInk : NEUTRAL.white;
  const iconInk = w ? w.iconInk : NEUTRAL.tealInk;
  const line = w ? w.line : NEUTRAL.lobbyLine;
  const wash = w ? w.wash : NEUTRAL.ivory2;

  // When the sheet opens, default to current location — or to "other address"
  // if we don't have the device location.
  useEffect(() => {
    if (isOpen) { setOriginMode(haveCurrent ? 'current' : 'custom'); setCustomOrigin(''); }
  }, [isOpen, haveCurrent]);

  useDismissable(isOpen, onClose);

  // Focus moves into the sheet when it opens and back to the opener when it closes.
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const opener = document.activeElement;
    const raf = requestAnimationFrame(() => {
      if (sheetRef.current) sheetRef.current.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (opener && opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen || !destination) return null;

  const name = destination.name || '';
  const address = destination.address || '';
  const dLat = destination.latitude ?? destination.lat ?? null;
  const dLng = destination.longitude ?? destination.lng ?? null;

  // Human-readable destination (name + address); coords only as a last resort.
  const destQuery = address
    ? (name ? `${name}, ${address}` : address)
    : (dLat != null && dLng != null ? `${dLat},${dLng}` : name);

  const customReady = customOrigin.trim().length > 0;
  const originStr = originMode === 'current'
    ? (haveCurrent ? `${userLat},${userLng}` : null)
    : (customReady ? customOrigin.trim() : null);
  const blocked = originMode === 'custom' && !customReady;

  const enc = encodeURIComponent;
  const D = enc(destQuery);
  const O = originStr ? enc(originStr) : null;

  const launch = (app) => {
    if (blocked) return;
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${D}${O ? `&origin=${O}` : ''}&travelmode=driving`,
      apple:  `http://maps.apple.com/?daddr=${D}${O ? `&saddr=${O}` : ''}&dirflg=d`,
      // Waze always routes from the device's current location (URL can't set origin).
      waze:   `https://waze.com/ul?q=${D}&navigate=yes`,
    };
    // Highest-intent behavior signal — "I'm actually going here." One log here
    // covers EVERY finder (eat/coffee/ATM/restroom/shopping/things-to-do).
    try { logDiscover('directions_tap', { app, place_name: destination?.name || null }); } catch { /* never block navigation */ }
    window.open(urls[app], '_blank');
    onClose();
  };

  const originBtn = (mode, Icon, label, disabled = false) => {
    const on = originMode === mode;
    return (
      <button
        type="button"
        onClick={() => setOriginMode(mode)}
        disabled={disabled}
        aria-pressed={on}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 44,
          boxSizing: 'border-box',
          padding: '0 10px',
          borderRadius: 12,
          background: on ? accent : NEUTRAL.white,
          border: `1px solid ${on ? accent : line}`,
          color: on ? accentInk : NEUTRAL.ink2,
          fontFamily: 'inherit',
          fontSize: fs(13.5),
          lineHeight: 1.2,
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <Icon size={16} color={on ? accentInk : iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        {label}
      </button>
    );
  };

  const appRow = (key, title, note) => (
    <button
      key={key}
      type="button"
      onClick={() => launch(key)}
      aria-disabled={blocked || undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 44,
        boxSizing: 'border-box',
        padding: '10px 4px',
        background: 'transparent',
        border: 0,
        borderBottom: `1px solid ${line}`,
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: blocked ? 'default' : 'pointer',
        opacity: blocked ? 0.45 : 1,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: fs(15.5), lineHeight: 1.25, fontWeight: 600, color: NEUTRAL.ink }}>{title}</span>
        {note ? <span style={{ display: 'block', marginTop: 2, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink3 }}>{note}</span> : null}
      </span>
      <Navigation size={18} color={iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
    </button>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
          />
          <motion.div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto max-h-[90vh] overflow-y-auto"
            style={{ background: NEUTRAL.white, outline: 'none' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 60, boxSizing: 'border-box', padding: '8px 12px 8px 20px', borderBottom: `1px solid ${line}` }}>
              <h3 id={titleId} className="font-serif" style={{ margin: 0, fontSize: fs(20), lineHeight: 1.2, fontWeight: 400, color: NEUTRAL.ink }}>Get directions</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, padding: 0, borderRadius: 999, background: 'transparent', border: 0, cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 999, background: wash }}>
                  <X size={18} color={NEUTRAL.ink2} strokeWidth={2} aria-hidden="true" focusable="false" />
                </span>
              </button>
            </div>

            {/* Destination */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 20px', background: wash, borderBottom: `1px solid ${line}` }}>
              <MapPin size={16} color={iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, overflowWrap: 'break-word' }}>
                <p style={{ margin: 0, fontSize: fs(15), lineHeight: 1.3, fontWeight: 600, color: NEUTRAL.ink }}>{name || 'Destination'}</p>
                {address && <p style={{ margin: '2px 0 0', fontSize: fs(12.5), lineHeight: 1.4, color: NEUTRAL.ink2 }}>{address}</p>}
              </div>
            </div>

            {/* Starting point */}
            <div style={{ padding: '16px 20px 0' }}>
              <p style={{ margin: '0 0 8px', fontSize: fs(12.5), fontWeight: 600, color: NEUTRAL.ink3 }}>Starting point</p>
              <div role="group" aria-label="Starting point" style={{ display: 'flex', gap: 8 }}>
                {originBtn('current', LocateFixed, 'My location', !haveCurrent)}
                {originBtn('custom', Pencil, 'Other address')}
              </div>
              {originMode === 'custom' && (
                <>
                  <label htmlFor={inputId} className="sr-only">Starting address or place</label>
                  <input
                    id={inputId}
                    value={customOrigin}
                    onChange={(e) => setCustomOrigin(e.target.value)}
                    placeholder="Enter a starting address or place"
                    style={{
                      display: 'block',
                      width: '100%',
                      minHeight: 44,
                      marginTop: 12,
                      boxSizing: 'border-box',
                      padding: '0 14px',
                      borderRadius: 12,
                      border: `1px solid ${line}`,
                      background: NEUTRAL.white,
                      fontFamily: 'inherit',
                      fontSize: fs(15),
                      color: NEUTRAL.ink,
                    }}
                  />
                </>
              )}
              {!haveCurrent && (
                <p style={{ margin: '8px 0 0', fontSize: fs(12), lineHeight: 1.4, color: NEUTRAL.ink3 }}>We couldn't get your current location — enter a starting point above.</p>
              )}
            </div>

            {/* Map apps */}
            <div style={{ padding: '12px 16px 4px' }}>
              {blocked && (
                <p role="status" style={{ margin: '0 4px 4px', fontSize: fs(12.5), lineHeight: 1.4, fontWeight: 600, color: NEUTRAL.stamp }}>Enter a starting address to continue.</p>
              )}
              {appRow('google', 'Google Maps')}
              {appRow('waze', 'Waze', originMode === 'custom' ? 'Starts from your current location' : null)}
              {appRow('apple', 'Apple Maps')}
            </div>

            <div style={{ padding: '12px 20px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ width: '100%', minHeight: 44, borderRadius: 12, background: NEUTRAL.white, border: `1px solid ${line}`, color: NEUTRAL.ink2, fontFamily: 'inherit', fontSize: fs(14), fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
