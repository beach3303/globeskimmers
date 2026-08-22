import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Navigation, LocateFixed, Pencil } from 'lucide-react';
import { useDismissable } from '@/lib/dismissStack';
import { logDiscover } from '@/lib/logDiscover';

// Shared "Get Directions" sheet used by every finder. Two key behaviors:
//   1. Destination is sent as the place's NAME + ADDRESS (human-readable) so the
//      maps app opens on the actual business — not a bare lat/long pin. Coords
//      are only a fallback when there's no address.
//   2. The user picks the STARTING point: their current location (default) or a
//      custom address they type. Waze can only start from current location, so
//      a custom origin is honored for Google/Apple and noted for Waze.
//
// destination: { name, address, latitude|lat, longitude|lng }
export default function MapAppSelector({ isOpen, onClose, destination, userLat, userLng }) {
  const haveCurrent = !!(userLat && userLng);
  const [originMode, setOriginMode] = useState('current'); // 'current' | 'custom'
  const [customOrigin, setCustomOrigin] = useState('');

  // When the sheet opens, default to current location — or to "other address"
  // if we don't have the device location.
  useEffect(() => {
    if (isOpen) { setOriginMode(haveCurrent ? 'current' : 'custom'); setCustomOrigin(''); }
  }, [isOpen, haveCurrent]);

  useDismissable(isOpen, onClose);

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

  const originBtn = (mode, Icon, label, disabled = false) => (
    <button
      onClick={() => setOriginMode(mode)}
      disabled={disabled}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-[13px] font-semibold transition disabled:opacity-40 ${
        originMode === mode ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  const appBtn = (key, emoji, title, sub, hoverBorder) => (
    <button
      onClick={() => launch(key)}
      disabled={blocked}
      className={`w-full flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl transition-all active:scale-[0.98] ${hoverBorder} ${blocked ? 'opacity-40' : ''}`}
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
        <span className="text-2xl">{emoji}</span>
      </div>
      <div className="flex-1 text-left">
        <p className="font-bold text-[16px] text-gray-900">{title}</p>
        <p className="text-[13px] text-gray-500">{sub}</p>
      </div>
      <Navigation className="w-5 h-5 text-gray-400" />
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
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-[18px] font-bold text-gray-900">Get Directions</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Destination */}
            <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[14px] text-gray-900">{name || 'Destination'}</p>
                  {address && <p className="text-[12px] text-gray-600 mt-0.5">{address}</p>}
                </div>
              </div>
            </div>

            {/* Starting point */}
            <div className="px-5 pt-4">
              <p className="text-[12px] font-semibold text-gray-500 mb-2">Starting point</p>
              <div className="flex gap-2">
                {originBtn('current', LocateFixed, 'My location', !haveCurrent)}
                {originBtn('custom', Pencil, 'Other address')}
              </div>
              {originMode === 'custom' && (
                <input
                  value={customOrigin}
                  onChange={(e) => setCustomOrigin(e.target.value)}
                  placeholder="Enter a starting address or place"
                  className="w-full h-11 px-4 mt-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-[14px]"
                />
              )}
              {!haveCurrent && (
                <p className="text-[11px] text-gray-400 mt-2">We couldn't get your current location — enter a starting point above.</p>
              )}
            </div>

            {/* Map apps */}
            <div className="p-5 space-y-3">
              {blocked && (
                <p className="text-[12px] text-amber-600 font-medium -mb-1">Enter a starting address to continue.</p>
              )}
              {appBtn('google', '🗺️', 'Google Maps', 'Navigate with Google Maps', 'hover:border-blue-500 hover:bg-blue-50')}
              {appBtn('waze', '🚗', 'Waze', originMode === 'custom' ? 'Starts from your current location' : 'Navigate with Waze', 'hover:border-cyan-500 hover:bg-cyan-50')}
              {appBtn('apple', '🍎', 'Apple Maps', 'Navigate with Apple Maps', 'hover:border-gray-400 hover:bg-gray-50')}
            </div>

            <div className="px-5 pb-5">
              <button onClick={onClose} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors">
                Cancel
              </button>
            </div>
            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
