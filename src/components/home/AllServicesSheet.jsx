// AllServicesSheet — the "everything" drawer behind Home's "All services" chip.
// All eleven finders as one 3-column grid of crest tiles in FINDER_ORDER, each in
// its own world's colours (the colour you tap is the colour the page opens in). No
// groups, subtitles or Passport row: the passport has its own zone and tab.
// Navigation stays centralized: each tile calls onAction(label) — the exact
// handleQuickAction labels — after the sheet closes. Backdrop tap and the global
// swipe-down (useDismissable) both dismiss; z-indexes sit BELOW the location sheets
// (9997+) so a location prompt can still cover this.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useDismissable } from '@/lib/dismissStack';
import { ServiceTile } from '@/components/redesign/Crest';
import { FINDER_ORDER, IVORY, NEUTRAL, WORLD, fs } from '@/components/redesign/constants';

export default function AllServicesSheet({ isOpen, onClose, onAction }) {
  useDismissable(isOpen, onClose);

  // Close first, then navigate (the sheet must not linger over the destination
  // page's mount).
  const go = (action) => {
    onClose();
    onAction?.(action);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9995]"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-services-title"
            className="fixed bottom-0 left-0 right-0 z-[9996] rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto max-h-[85vh] overflow-y-auto"
            style={{ background: IVORY }}
          >
            <div className="sticky top-0 flex items-center justify-between" style={{ background: IVORY, borderBottom: `1px solid ${NEUTRAL.lobbyLine}`, padding: '8px 8px 8px 20px', zIndex: 1 }}>
              <h2 id="all-services-title" className="font-serif m-0" style={{ fontSize: fs(22), lineHeight: 1.15, color: NEUTRAL.ink }}>
                All <em style={{ color: NEUTRAL.brandTeal }}>services</em>
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close all services"
                className="flex-none flex items-center justify-center rounded-full"
                style={{ width: 44, height: 44, background: 'transparent', border: 0, color: NEUTRAL.ink3, cursor: 'pointer' }}
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, padding: '16px 16px 12px' }}>
              {FINDER_ORDER.map((k) => (
                <ServiceTile key={k} world={k} onClick={() => go(WORLD[k].action)} />
              ))}
            </div>

            {/* Home-indicator clearance */}
            <div aria-hidden style={{ height: 'calc(8px + env(safe-area-inset-bottom))' }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
