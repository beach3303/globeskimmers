import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation } from 'lucide-react';
import { useLocation } from './LocationContext';
import { markAutoFollowAsked } from './LocationContext';

// A one-time, polite follow-up shown right after the user switches to their
// current location (via the "Where to?" chooser or the travel nudge) — offering
// to make future location updates automatic. Asked at most once; the permanent
// on/off also lives in Settings → Location. Formal, short, opt-in.
//
//   "Update your location automatically as you move?"   [Yes]  [Not now]
export default function LocationAutoFollowOffer() {
  const { setAutoFollow } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOffer = () => setOpen(true);
    window.addEventListener('location:offer-autofollow', onOffer);
    return () => window.removeEventListener('location:offer-autofollow', onOffer);
  }, []);

  const decide = useCallback((yes) => {
    if (yes) setAutoFollow(true);
    markAutoFollowAsked();
    setOpen(false);
  }, [setAutoFollow]);

  return (
    <AnimatePresence>
      {open && (
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
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900 leading-snug">
                  Update your location automatically as you move?
                </p>
                <p className="text-[12.5px] text-gray-500 mt-0.5 leading-snug">
                  You can change this anytime in Settings.
                </p>
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => decide(true)}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#3A6EA5] to-[#4A7EBA] text-white font-semibold text-[14px]"
              >
                Yes
              </button>
              <button
                onClick={() => decide(false)}
                className="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold text-[14px] hover:bg-gray-50"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
