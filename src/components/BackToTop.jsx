import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

// Subtle floating "back to top" button. Appears once the page is scrolled past
// THRESHOLD and smooth-scrolls the window to the top on tap. Pages scroll the
// WINDOW (Layout has no inner scroll container), so we listen to window scroll.
// Sits above the floating nav / ad banner (bottom offset).
const THRESHOLD = 500;

export default function BackToTop({ bottom = 92 }) {
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
        background: 'rgba(22,17,13,0.82)',
        color: '#fff',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 6px 20px -6px rgba(0,0,0,0.45)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.9)',
        transition: 'opacity .2s ease, transform .2s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <ArrowUp size={20} strokeWidth={2.4} />
    </button>
  );
}
