import { useEffect, useRef, useState, useCallback } from 'react';
import { CameraPreview } from '@capacitor-community/camera-preview';

// ── Native camera preview lifecycle (shared by the scanners) ────────────────
// Renders the live camera in a NATIVE layer BEHIND the WebView (toBack), which
// gives real iPhone-style behavior the WebView's getUserMedia can't:
//   • tap-to-focus  — the plugin attaches a native tap gesture on start()
//   • pinch-zoom    — native, via enableZoom
// For the preview to be visible, the page must be transparent while it's open:
// we toggle `gs-camera-open` on <html> (see index.css) and the camera screen's
// root must have a transparent background. CRUCIAL: the live preview AREA in the
// DOM must be pointer-events:none so taps/pinches fall THROUGH to the native
// preview (otherwise the front webview eats them and native focus/zoom never
// fire). Only the control chrome (buttons) should capture touches.
//
// `active` controls start/stop. Returns { ready, error, capture }.
//   capture(quality) → raw base64 JPEG (no data: prefix), or null.
export function useCameraPreview(active) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const startedRef = useRef(false);
  const startingRef = useRef(false);

  const stop = useCallback(async () => {
    document.documentElement.classList.remove('gs-camera-open');
    setReady(false);
    if (!startedRef.current) return;
    startedRef.current = false;
    try { await CameraPreview.stop(); } catch { /* already stopped */ }
  }, []);

  const start = useCallback(async () => {
    if (startedRef.current || startingRef.current) return;
    startingRef.current = true;
    setError(null);
    try {
      // Clear any stale session left running from a previous mount.
      try {
        const s = await CameraPreview.isCameraStarted();
        if (s && s.value) { try { await CameraPreview.stop(); } catch { /* ignore */ } }
      } catch { /* isCameraStarted unsupported — ignore */ }

      document.documentElement.classList.add('gs-camera-open');
      await CameraPreview.start({
        position: 'rear',
        toBack: true,              // render behind the (transparent) webview
        disableAudio: true,        // OCR only — skip the mic permission prompt
        enableZoom: true,          // native pinch-zoom
        x: 0,
        y: 0,
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
      });
      startedRef.current = true;
      setReady(true);
    } catch (e) {
      document.documentElement.classList.remove('gs-camera-open');
      setError(e || new Error('Camera failed to start'));
      console.warn('CameraPreview start failed:', e?.message || e);
    } finally {
      startingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (active) start(); else stop();
    return () => { stop(); };
  }, [active, start, stop]);

  // Capture a JPEG; returns raw base64 (no data: prefix), or null.
  const capture = useCallback(async (quality = 90) => {
    try {
      const res = await CameraPreview.capture({ quality });
      return res?.value || null;
    } catch (e) {
      console.warn('CameraPreview capture failed:', e?.message || e);
      return null;
    }
  }, []);

  return { ready, error, capture, start, stop };
}
