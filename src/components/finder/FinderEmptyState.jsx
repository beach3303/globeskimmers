// FinderEmptyState — the one designed empty/error card for finders
// (Passport Standard). Replaces the ad-hoc "No matches" boxes and the dead
// "Expand Radius" buttons (every finder already starts at the 25-mile cap, so
// widening is a no-op — the honest actions are "search somewhere else" and
// "clear filters").
//
// Serif title, mono reason line, ONE primary action in the page's CAT ink,
// optional quiet secondary.
//
// Props:
//   catKey         — key into CAT (redesign constants); inks the icon tile and
//                    the primary action. Unknown keys fall back to deep teal.
//   icon           — lucide icon component, rendered on a CAT tint circle.
//   title          — serif headline ("No cafés match", "Couldn't load ATMs").
//   reason         — mono explanation line under the title.
//   actionLabel    — primary button label; button renders only when both
//                    actionLabel and onAction are set.
//   onAction       — primary handler (typically: open LocationModePicker).
//   secondaryLabel — optional quiet secondary ("Clear filters").
//   onSecondary    — secondary handler.
import React from 'react';
import { CAT, TEAL_DEEP, SHADOW_CARD_SOFT } from '@/components/redesign/constants';

const ED_SERIF = '"Instrument Serif", Georgia, serif';

export default function FinderEmptyState({
  catKey,
  icon: Icon,
  title,
  reason,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}) {
  const cat = CAT[catKey] || { ink: TEAL_DEEP, bg: '#E4F1EF' };

  return (
    <div
      className="text-center px-6 py-10 rounded-[20px] mx-auto max-w-md"
      style={{ background: '#FFFFFF', border: '1px solid #F0E9DC', boxShadow: SHADOW_CARD_SOFT }}
    >
      {Icon && (
        <div
          className="mx-auto mb-4 flex items-center justify-center rounded-full"
          style={{ width: 56, height: 56, background: cat.bg }}
        >
          <Icon size={26} color={cat.ink} strokeWidth={1.8} />
        </div>
      )}
      <div
        style={{ fontFamily: ED_SERIF, fontWeight: 400, fontSize: 'calc(24px*var(--fs))', lineHeight: 1.1, color: '#0F1419' }}
      >
        {title}
      </div>
      {reason && (
        <div
          className="font-mono mt-2"
          style={{ fontSize: 'calc(11.5px*var(--fs))', letterSpacing: '0.02em', color: '#736657', lineHeight: 1.5 }}
        >
          {reason}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-5 py-3 rounded-[12px] font-bold transition-transform active:scale-[0.98]"
          style={{ background: cat.ink, color: '#FFFFFF', border: 'none', fontSize: 'calc(13.5px*var(--fs))', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          {actionLabel}
        </button>
      )}
      {secondaryLabel && onSecondary && (
        <div className="mt-3">
          <button
            onClick={onSecondary}
            className="font-semibold"
            style={{ background: 'transparent', border: 'none', color: '#736657', fontSize: 'calc(12.5px*var(--fs))', fontFamily: 'inherit', cursor: 'pointer', textUnderlineOffset: 3, textDecoration: 'underline' }}
          >
            {secondaryLabel}
          </button>
        </div>
      )}
    </div>
  );
}
