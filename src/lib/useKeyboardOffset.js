import { useState, useEffect } from 'react';

/**
 * Returns the height (in CSS px) currently covered by the on-screen keyboard,
 * or 0 when no keyboard is up / the API is unavailable.
 *
 * Uses the VisualViewport API, which shrinks when the software keyboard opens
 * on iOS WKWebView (iPhone + iPad) and Android WebView — even though
 * window.innerHeight stays constant there (no @capacitor/keyboard resize mode
 * is configured in this app). Callers use the offset to float a modal in the
 * visible area ABOVE the keyboard so the input + its result list stay in view.
 *
 * @param {boolean} active - only track while true (e.g. the modal is open).
 */
export function useKeyboardOffset(active) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!active) { setOffset(0); return; }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return offset;
}
