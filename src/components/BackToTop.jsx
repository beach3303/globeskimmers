import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { NEUTRAL, rgba } from '@/components/redesign/constants';

// Subtle floating "back to top" button. Appears once the page is scrolled past
// THRESHOLD and smooth-scrolls the window to the top on tap. Pages scroll the
// WINDOW (Layout has no inner scroll container), so we listen to window scroll.
// While hidden it is out of the tab order and the accessibility tree.
//
// It sits on Layout's bottom reserve, 12px above the floating nav pill and never
// over it. color is its fill: Layout passes the page's ink at 82% (the world ink
// on a finder, airmail blue on Mailbox, the cloth on Circle); the default is the
// neutral ink at 82%. bottom still accepts a number (px) or any CSS length.
const THRESHOLD = 500;
const BOTTOM_RESERVE = 'calc(96px + env(safe-area-inset-bottom))';
const DEFAULT_COLOR = rgba(NEUTRAL.ink, 0.82); // rgba(22,17,13,0.82)

export default function BackToTop({ bottom = BOTTOM_RESERVE, color = DEFAULT_COLOR }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setVisible(y > THRESHOLD);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed right-4 z-[9998] flex items-center justify-center rounded-full"
      style={{
        bottom,
        width: 44,
        height: 44,
        background: color,
        color: NEUTRAL.white,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 6px 20px -6px rgba(0,0,0,0.45)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.9)',
        // visibility flips after the fade-out (and at once on the way in), so the
        // hidden button can't take keyboard focus or be read out.
        visibility: visible ? 'visible' : 'hidden',
        transition: 'opacity .2s ease, transform .2s ease, visibility .2s',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <ArrowUp size={20} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}
