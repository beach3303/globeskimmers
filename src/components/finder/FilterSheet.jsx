// FilterSheet — the shared finder filter bottom sheet (Passport Standard).
//
// Mechanics mirror AllServicesSheet exactly: AnimatePresence spring slide-up,
// backdrop at z-[9995] + sheet at z-[9996] (BELOW the 9997+ location sheets so
// a location prompt can still cover this), rounded-t-[24px] ivory surface,
// sticky serif header with an X close, home-indicator safe-area clearance, and
// useDismissable so the global swipe-down closes whatever is frontmost.
//
// Pages put their filter groups inside as children; an optional Clear action
// sits in the sticky header when `onClear` is provided.
//
// Props:
//   open       — sheet visibility.
//   onClose    — close handler (backdrop tap, X, global swipe-down).
//   title      — sticky-header serif title ("Filters").
//   children   — the page's filter groups.
//   onClear    — optional; renders a quiet clear button in the header.
//   clearLabel — clear button label; default 'Clear all'.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useDismissable } from '@/lib/dismissStack';
import { IVORY, IVORY_2 } from '@/components/redesign/constants';

export default function FilterSheet({ open, onClose, title = 'Filters', children, onClear, clearLabel = 'Clear all' }) {
  useDismissable(open, onClose);

  return (
    <AnimatePresence>
      {open && (
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
            aria-label={title}
            className="fixed bottom-0 left-0 right-0 z-[9996] rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto max-h-[85vh] overflow-y-auto"
            style={{ background: IVORY }}
          >
            {/* Sticky header */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b z-[1]" style={{ background: IVORY, borderColor: '#E6DFD0' }}>
              <h3 className="font-serif text-[20px] tracking-tight" style={{ color: '#16110D' }}>{title}</h3>
              <div className="flex items-center gap-2">
                {onClear && (
                  <button
                    onClick={onClear}
                    className="font-mono uppercase tracking-[0.08em] font-semibold px-2 py-1"
                    style={{ background: 'transparent', border: 'none', fontSize: 'calc(10.5px*var(--fs))', color: '#736657', cursor: 'pointer' }}
                  >
                    {clearLabel}
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: IVORY_2 }}
                >
                  <X className="w-5 h-5" style={{ color: '#736657' }} />
                </button>
              </div>
            </div>

            {/* Page-owned filter groups */}
            <div className="px-5 pt-3 pb-4">{children}</div>

            {/* Home-indicator clearance */}
            <div aria-hidden style={{ height: 'calc(8px + env(safe-area-inset-bottom))' }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
