import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X } from 'lucide-react';
import { useLocation } from './LocationContext';

// A gentle, non-blocking nudge shown ONLY when the user is on a manually-picked
// place but GPS says they've physically travelled to a different city (fired by
// LocationContext's maybeDetectMismatch as a `location:mismatch` event, at most
// once per session). We never auto-override a manual pick — we offer the switch.
//
//   "You seem to be in <current city> now — explore here, or keep <pick>?"
//        [ Explore here ]   [ Keep <pick> ]
//
// Distinct from the cold-open "Where to?" chooser: this only appears on a real
// GPS-vs-pick mismatch (e.g. reopening after a flight), so it never nags.
const cityOf = (loc) =>
  loc?.placeName || loc?.address?.city || loc?.address?.formatted || 'here';

export default function LocationMismatchSheet() {
  const { switchToCurrentLocation } = useLocation();
  const [data, setData] = useState(null); // { current, picked } | null
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onMismatch = (e) => { if (e?.detail?.current) setData(e.detail); };
    window.addEventListener('location:mismatch', onMismatch);
    return () => window.removeEventListener('location:mismatch', onMismatch);
  }, []);

  const dismiss = useCallback(() => setData(null), []);

  const exploreHere = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try { await switchToCurrentLocation(); } catch { /* keep pick on failure */ }
    setBusy(false);
    setData(null);
  }, [busy, switchToCurrentLocation]);

  const currentCity = cityOf(data?.current);
  const pickedCity = cityOf(data?.picked);

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          className="fixed left-0 right-0 z-[9997] flex justify-center px-3"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
          role="dialog"
          aria-live="polite"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3A6EA5] to-[#4A7EBA] flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900 leading-snug">
                  You seem to be in {currentCity} now
                </p>
                <p className="text-[12.5px] text-gray-500 mt-0.5 leading-snug">
                  Explore here, or keep viewing {pickedCity}?
                </p>
              </div>
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={exploreHere}
                disabled={busy}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#3A6EA5] to-[#4A7EBA] text-white font-semibold text-[14px] disabled:opacity-60"
              >
                {busy ? 'Switching…' : `Explore ${currentCity}`}
              </button>
              <button
                onClick={dismiss}
                className="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold text-[14px] hover:bg-gray-50"
              >
                Keep {pickedCity}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
