// Global swipe-down-to-dismiss gesture.
//
// Listens at the document level (passive — never preventDefault, so normal
// scrolling/panning is untouched). On a clear downward swipe that STARTED with
// the relevant scroll container already at the top, it:
//   1. closes the frontmost open overlay (runTopDismiss), or
//   2. if nothing is open, calls onPageDismiss() to exit the page.
//
// "Started at the top" is the iOS-sheet rule: you must already be scrolled to
// the top, then pull down — so this can never fire mid-scroll. The scroll check
// walks up from the touch target to the nearest scrollable ancestor, so it works
// for both the page (window scroll) AND a scrollable overlay sitting on top.
import { useEffect } from 'react';
import { runTopDismiss } from '@/lib/dismissStack';

const THRESHOLD = 90;      // px of downward travel to count as a dismiss
const OFF_AXIS = 0.6;      // |dx| must stay under 0.6*dy (mostly-vertical drag)

// scrollTop of the nearest vertically-scrollable ancestor of `el`. A `fixed`
// overlay short-circuits to 0: it doesn't scroll with the page, so the page
// scroll BEHIND it is irrelevant — a non-scrolling photo/sheet over a scrolled
// page must still count as "at the top" so swipe-down can dismiss it. Falls back
// to the document scroll position only for normal in-page content.
function scrollTopAt(el) {
  let node = el;
  while (node && node.nodeType === 1 && node !== document.body) {
    const cs = window.getComputedStyle(node);
    const oy = cs.overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
      return node.scrollTop;
    }
    if (cs.position === 'fixed') return 0;
    node = node.parentElement;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

// Don't hijack a drag that begins inside a text field (text selection, etc.).
function inEditable(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    const tag = node.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable) return true;
    node = node.parentElement;
  }
  return false;
}

export default function useSwipeDownDismiss(onPageDismiss) {
  useEffect(() => {
    let startX = 0, startY = 0, startTop = 0, tracking = false, skip = false;

    const onStart = (e) => {
      if (e.touches && e.touches.length !== 1) { tracking = false; return; }
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
      startTop = scrollTopAt(e.target);
      skip = inEditable(e.target);
      tracking = true;
    };

    const onEnd = (e) => {
      if (!tracking) return;
      tracking = false;
      if (skip) return;
      const t = (e.changedTouches && e.changedTouches[0]) || e;
      const dy = t.clientY - startY;
      const dx = Math.abs(t.clientX - startX);
      if (dy > THRESHOLD && dx < dy * OFF_AXIS && startTop <= 0) {
        if (!runTopDismiss()) onPageDismiss?.();
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [onPageDismiss]);
}
