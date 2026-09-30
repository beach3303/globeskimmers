// AllServicesSheet — the "everything" drawer behind the finder chip row on
// phone Home (Phase-1a-lite). Lists EVERY destination the two retired Home tile
// grids offered, grouped under small mono headers, so nothing the grids reached
// is lost. Navigation stays centralized: each row calls onAction(label) — the
// exact handleQuickAction labels the old tiles used — then closes the sheet.
// Structure + accessibility mirror MapAppSelector's bottom sheet (backdrop tap
// and the global swipe-down via useDismissable both dismiss); z-indexes sit
// BELOW the location sheets (9997+) so a location prompt can still cover this.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, Utensils, Coffee, DollarSign, CreditCard, ScanLine, Compass, ShoppingBag, Globe, Store, Toilet, CloudSun, Languages, Landmark, Camera,
} from 'lucide-react';
import { useDismissable } from '@/lib/dismissStack';
import { IVORY, IVORY_2, TEAL_DEEP } from '@/components/redesign/constants';

// Every destination from the old 9-tile finder grid + 10-tile Explore grid,
// under the doctrine's five group headers. Subtitles carry over from the old
// tiles (tablet FEATURES/GRADS wording where the phone tile had none).
const GROUPS = [
  {
    header: 'Eat & drink',
    items: [
      { icon: Utensils, title: 'Nearby Restaurants', sub: 'Where locals eat', action: 'Places to Eat' },
      { icon: Coffee, title: 'Coffee Finder', sub: 'Cafés near you', action: 'Coffee' },
    ],
  },
  {
    header: 'Money',
    items: [
      { icon: DollarSign, title: 'Money Exchange', sub: 'Compare rates near you', action: 'Money Exchange' },
      { icon: CreditCard, title: 'ATM Finder', sub: 'Skip the fees', action: 'ATM' },
      { icon: ScanLine, title: 'Price scanner', sub: 'Convert any price', action: 'Smart Price Scanner' },
    ],
  },
  {
    header: 'Explore',
    items: [
      { icon: Compass, title: 'Things to do', sub: 'Sights · tours', action: 'Things to Do' },
      { icon: ShoppingBag, title: 'Shopping', sub: 'Markets · malls', action: 'Shopping' },
      { icon: Globe, title: 'Virtual Passport', sub: 'Stamps · memories', action: 'Passport' },
    ],
  },
  {
    header: 'Essentials',
    items: [
      { icon: Store, title: 'Convenience', sub: '24/7 essentials', action: 'Convenience Store' },
      { icon: Toilet, title: 'Restroom Finder', sub: 'Clean & rated', action: 'Restroom' },
      { icon: CloudSun, title: 'Weather', sub: 'Local forecast', action: 'Weather' },
      { icon: Languages, title: 'Phrases', sub: '50 essentials', action: 'Basic Phrases' },
      { icon: Landmark, title: 'Cultural Info', sub: 'Museums · sights', action: 'Culture Information' },
      { icon: Camera, title: 'Text scanner', sub: 'Menus · signs · labels', action: 'Smart Text Scanner' },
    ],
  },
];

export default function AllServicesSheet({ isOpen, onClose, onAction }) {
  useDismissable(isOpen, onClose);

  // Close first, then navigate — same order the old tiles' single-tap flow had
  // (the sheet must not linger over the destination page's mount).
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
            aria-label="All services"
            className="fixed bottom-0 left-0 right-0 z-[9996] rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto max-h-[85vh] overflow-y-auto"
            style={{ background: IVORY }}
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: IVORY, borderColor: '#E6DFD0' }}>
              <h3 className="font-serif text-[20px] tracking-tight" style={{ color: '#16110D' }}>All services</h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: IVORY_2 }}
              >
                <X className="w-5 h-5" style={{ color: '#736657' }} />
              </button>
            </div>

            {/* Grouped destinations */}
            <div className="px-5 pt-3 pb-4">
              {GROUPS.map((g) => (
                <div key={g.header} className="pt-2 pb-1">
                  <div className="font-mono uppercase tracking-[0.08em] text-[10.5px] font-semibold mb-1" style={{ color: '#736657' }}>
                    {g.header}
                  </div>
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.title}
                        onClick={() => go(it.action)}
                        className="w-full flex items-center gap-3 py-2.5 text-left border-b last:border-b-0"
                        style={{ borderColor: '#EFE9DC' }}
                      >
                        <div
                          className="flex items-center justify-center flex-none"
                          style={{ width: 34, height: 34, borderRadius: 10, background: IVORY_2 }}
                        >
                          <Icon size={17} color={TEAL_DEEP} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[calc(14px*var(--fs))] font-semibold truncate" style={{ color: '#16110D' }}>{it.title}</p>
                          <p className="text-[calc(11.5px*var(--fs))] truncate" style={{ color: '#71827D' }}>{it.sub}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 flex-none" style={{ color: '#B9AE9C' }} />
                      </button>
                    );
                  })}
                </div>
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
