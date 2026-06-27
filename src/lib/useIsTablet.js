import { useState, useEffect } from 'react';

// True when the viewport is tablet-width (iPad). Drives the iPad-only layouts
// (HomeTablet, finder tablet layouts, etc.) while leaving the phone layout
// completely untouched. 768px matches Tailwind's `md` breakpoint, which covers
// iPad portrait (11" ≈ 834, 13" ≈ 1024) and landscape; phones stay below it.
export function useIsTablet() {
  const query = '(min-width: 768px)';
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsTablet(e.matches);
    // Sync once on mount (covers rotation/split-view changes after first paint).
    setIsTablet(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return isTablet;
}
