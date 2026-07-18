import { useRef } from "react";

// Horizontal photo-paging swipe. Spread the returned handlers onto the element
// wrapping the enlarged photo:
//
//   const swipe = useHorizontalSwipe({ onLeft: next, onRight: prev });
//   <div {...swipe}> <img .../> </div>
//
// Swipe LEFT (finger right→left) → onLeft (advance to next photo).
// Swipe RIGHT (finger left→right) → onRight (previous photo).
// Mostly-vertical drags are ignored so this never fights page scroll or
// swipe-down-to-dismiss.
export default function useHorizontalSwipe({ onLeft, onRight, threshold = 45 } = {}) {
  const start = useRef(null);

  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = (e.changedTouches && e.changedTouches[0]) || null;
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Require a clear, mostly-horizontal movement.
    if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) { if (onLeft) onLeft(); }
    else { if (onRight) onRight(); }
  };

  return { onTouchStart, onTouchEnd };
}
