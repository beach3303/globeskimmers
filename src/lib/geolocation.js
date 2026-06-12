// Native-aware geolocation.
//
// Inside the Capacitor native app (iOS / Android) the WebView's
// `navigator.geolocation` is unreliable. On native we use the official
// @capacitor/geolocation plugin; on web we fall back to the browser API.
//
// HARD THROTTLE (module-level, survives re-mounts): a runaway render/effect
// loop was calling location detection many times/second. Every caller in the
// app funnels through getCurrentPositionSmart, so throttling HERE makes GPS
// spam impossible no matter which caller loops — at most one real GPS request
// per POS_TTL_MS; everything else gets the shared in-flight promise or the
// last fix. The throttled console.trace fires only when GPS actually runs, so
// it names the looping caller without flooding the console.
import { Capacitor } from '@capacitor/core';

let _posInFlight = null;
let _posCache = null;
let _posCacheAt = 0;
const POS_TTL_MS = 20000;

// Settle `promise` within `ms` so a hung native call can't stall forever.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label || 'Location'} timed out`);
      err.code = 3; // GeolocationPositionError.TIMEOUT
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalize(pos) {
  return {
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    },
  };
}

export async function getCurrentPositionSmart(options = {}) {
  // Share a single in-flight request, and reuse a recent fix, so repeated
  // calls (e.g. from a looping effect) can never hammer GPS.
  if (_posInFlight) return _posInFlight;
  if (_posCache && (Date.now() - _posCacheAt) < POS_TTL_MS) return _posCache;

  // TEMP DIAGNOSTIC: fires at most once per POS_TTL_MS (throttled), so the
  // stack names the REAL caller without flooding. Remove once the loop is gone.
  console.trace('🛰️ getCurrentPositionSmart firing real GPS');

  _posInFlight = _resolvePosition(options);
  try {
    const result = await _posInFlight;
    _posCache = result;
    _posCacheAt = Date.now();
    return result;
  } finally {
    _posInFlight = null;
  }
}

async function _resolvePosition(options) {
  const highAccuracy = {
    enableHighAccuracy: options.enableHighAccuracy ?? true,
    timeout: options.timeout ?? 10000,
    maximumAge: options.maximumAge ?? 0,
  };

  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');

    // Ensure permission; request the native dialog if undetermined.
    let perm = null;
    try {
      perm = await Geolocation.checkPermissions();
    } catch {
      perm = null;
    }
    const granted = (p) => p && (p.location === 'granted' || p.coarseLocation === 'granted');

    if (!granted(perm)) {
      let requested = null;
      try {
        requested = await Geolocation.requestPermissions();
      } catch {
        requested = null;
      }
      if (!granted(requested)) {
        const err = new Error('Location permission denied');
        err.code = 1; // PERMISSION_DENIED
        console.log('📍 Location permission not granted');
        throw err;
      }
    }

    // Precise GPS first, then network fallback — never hang.
    try {
      const pos = await withTimeout(
        Geolocation.getCurrentPosition(highAccuracy),
        (highAccuracy.timeout || 10000) + 2000,
        'High-accuracy GPS'
      );
      return normalize(pos);
    } catch (e1) {
      console.log('📍 High-accuracy GPS failed, trying network location:', e1?.message || e1);
      const pos = await withTimeout(
        Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }),
        17000,
        'Network location'
      );
      return normalize(pos);
    }
  }

  // Web / PWA fallback.
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const err = new Error('Geolocation is not supported');
      err.code = 2; // POSITION_UNAVAILABLE
      reject(err);
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, highAccuracy);
  });
}
