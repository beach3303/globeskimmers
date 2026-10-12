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
let _stampFixInFlight = null;   // a running getStampFix sample (see below)

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
    // When the phone took the reading — a network fallback can be minutes old.
    timestamp: pos.timestamp,
  };
}

// True only if location permission is ALREADY granted — checked WITHOUT ever
// showing a prompt. Lets callers do a silent background GPS fetch (e.g. to know
// the user's physical city while they browse another location) without nagging
// anyone who hasn't opted in. Returns false on any uncertainty.
export async function isLocationPermissionGranted() {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const p = await Geolocation.checkPermissions();
      return !!(p && (p.location === 'granted' || p.coarseLocation === 'granted'));
    }
    if (navigator.permissions?.query) {
      const s = await navigator.permissions.query({ name: 'geolocation' });
      return s.state === 'granted';
    }
  } catch { /* unsupported / blocked → treat as not granted */ }
  return false;
}

export async function getCurrentPositionSmart(options = {}) {
  // Share a single in-flight request, and reuse a recent fix, so repeated
  // calls (e.g. from a looping effect) can never hammer GPS.
  if (_posInFlight) return _posInFlight;
  if (_posCache && (Date.now() - _posCacheAt) < POS_TTL_MS) return _posCache;
  // A stamping sample is running: share its reading rather than reconfigure
  // the one native location manager under it (on iOS a coarse request would
  // drop the running watch to 3 km accuracy).
  if (_stampFixInFlight) {
    try {
      const f = await _stampFixInFlight;
      return { coords: { latitude: f.lat, longitude: f.lng, accuracy: Number.isFinite(f.acc) ? f.acc : null }, timestamp: Date.now() };
    } catch (e) {
      // The traveler just refused location: never ask again from here.
      if (e?.code === 1) throw e;
      // Back through the throttle, so every waiter shares one new reading.
      return getCurrentPositionSmart(options);
    }
  }

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

// Native permission: checked first; the system dialog shows only while the
// answer is undetermined. Throws code 1 (PERMISSION_DENIED) unless granted.
async function ensureNativePermission(Geolocation) {
  let perm = null;
  try {
    perm = await Geolocation.checkPermissions();
  } catch {
    perm = null;
  }
  const granted = (p) => p && (p.location === 'granted' || p.coarseLocation === 'granted');
  if (granted(perm)) return perm;
  let requested = null;
  try {
    requested = await Geolocation.requestPermissions();
  } catch {
    requested = null;
  }
  if (!granted(requested)) {
    const err = new Error('Location permission denied');
    err.code = 1; // PERMISSION_DENIED
    throw err;
  }
  return { ...requested, prompted: true };   // the system dialog was just shown
}

// ── A stamping fix (founder, 2026-10-10: "GPS takes 2–3 readings and keeps
// the best"). The worker judges a stamp against the place's own map, so the
// reading sent with it must be fresh and the best the phone can give in a few
// seconds — never the throttle cache above, which can hold a fix from a
// minute ago or a coarse network fallback. Watches the position for up to
// `budgetMs` and keeps the most accurate FRESH reading, stopping early at
// `samples` fresh readings, at two once one is within `goodAcc` metres, or
// ~2.5 s after a lone reading that good. iOS hands the watch its stored fix
// first (its plugin ignores maximumAge), so there a reading from before the
// tap only counts if nothing fresh arrives; ties go to the newer reading.
// A watch error that isn't a refusal ends the watch on iOS, so it is
// restarted once. With nothing in time, one ordinary (coarser) reading is
// tried. Resolves { lat, lng, acc?, samples } (acc rounded, absent when the
// phone gives none); throws code 1 (permission denied) or 3 (no reading).
export function getStampFix(options) {
  if (!_stampFixInFlight) _stampFixInFlight = _sampleStampFix(options || {}).finally(() => { _stampFixInFlight = null; });
  return _stampFixInFlight;
}

async function _sampleStampFix({ samples = 3, budgetMs = 9000, goodAcc = 20 }) {
  const native = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const Geolocation = native ? (await import('@capacitor/geolocation')).Geolocation : null;
  let highAccuracy = true;
  if (native) {
    let perm = await ensureNativePermission(Geolocation);
    // Android "Approximate": ask for precise BEFORE the clock starts — asked
    // inside the watch, its dialog ate the sampling time. Still approximate →
    // sample without high accuracy (no dialog; approximate fixes are all
    // Android will give anyway).
    // Not on the tap that just showed the first dialog: the traveler chose
    // Approximate a moment ago (asking twice can lock precise out for good).
    if (platform === 'android' && perm?.location !== 'granted' && !perm?.prompted) {
      try { perm = await Geolocation.requestPermissions({ permissions: ['location'] }); } catch { /* keep coarse */ }
    }
    if (platform === 'android') highAccuracy = perm?.location === 'granted';
  } else if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const err = new Error('Geolocation is not supported');
    err.code = 2; // POSITION_UNAVAILABLE
    throw err;
  }
  const startedAt = Date.now();
  const freshFrom = startedAt - (platform === 'ios' ? 3000 : 60000);
  const readings = [];   // arrival order: { lat, lng, acc, fresh }
  const take = (pos) => {
    const c = pos?.coords;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
    const t = Number(pos.timestamp);
    // iOS replays its stored fix: the phone's memory of somewhere else isn't a
    // reading here. (Android's satellite timestamps can run ahead of a phone
    // whose clock is off, so the cut-off would drop real readings there.)
    if (platform === 'ios' && Number.isFinite(t) && t > 0 && t < startedAt - 60000) return;
    readings.push({ lat: c.latitude, lng: c.longitude, acc: Number.isFinite(c.accuracy) && c.accuracy >= 0 ? c.accuracy : Infinity, fresh: !(Number.isFinite(t) && t > 0 && t < freshFrom) });
  };
  const freshOnes = () => readings.filter((r) => r.fresh);
  const enough = () => {
    const f = freshOnes();
    return f.length >= samples || (f.length >= 2 && f.some((r) => r.acc <= goodAcc));
  };
  const watchOpts = { enableHighAccuracy: highAccuracy, timeout: budgetMs, maximumAge: 0 };
  let denied = false;

  await new Promise((resolve) => {
    let done = false;
    let id = null;
    let gen = 0;
    let restarts = 0;
    let grace = null;
    let lastStart = 0;
    let restartTimer = null;
    const timer = setTimeout(() => finish(), budgetMs);
    const stop = (watchId) => {
      if (watchId == null) return;
      if (native) Geolocation.clearWatch({ id: watchId }).catch(() => {});
      else navigator.geolocation.clearWatch(watchId);
    };
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(grace);
      clearTimeout(restartTimer);
      stop(id);
      resolve();
    }
    const onReading = (pos) => {
      if (done) return;
      take(pos);
      if (enough()) { finish(); return; }
      // One sharp fresh reading and a still phone may be all there is.
      if (!grace && freshOnes().some((r) => r.acc <= goodAcc)) grace = setTimeout(finish, 2500);
    };
    const onError = (err) => {
      if (done) return;
      // Off for the app, or for the whole phone: nothing to wait for.
      if (err?.code === 1 || /denied|permission|restricted|not enabled|disabled/i.test(String(err?.message || err))) { denied = true; finish(); return; }
      if (!native) return; // the browser keeps watching after a transient error
      // The plugin ends the watch on any location error. On iOS that is
      // usually CoreLocation's "not yet" (kCLErrorLocationUnknown) while GPS
      // warms up, so keep restarting, at least 1 s apart, while there is time.
      // Android only errors on a setup failure: one retry, then stop.
      stop(id); id = null;
      const left = budgetMs - (Date.now() - startedAt);
      if (platform === 'ios' && left > 1500) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { if (!done) start(); }, Math.max(0, lastStart + 1000 - Date.now()));
      } else if (platform !== 'ios' && restarts < 1 && left > 2000 && !freshOnes().length) { restarts += 1; start(); }
      else finish();
    };
    function start() {
      const mine = ++gen;
      lastStart = Date.now();
      if (native) {
        Geolocation.watchPosition({ ...watchOpts, interval: 1000, minimumUpdateInterval: 500 }, (pos, err) => {
          if (mine !== gen) return;
          if (pos) onReading(pos);
          else if (err) onError(err);
        }).then((watchId) => {
          if (mine !== gen || done) { stop(watchId); return; }   // finished or restarted first
          id = watchId;
        }).catch(() => { if (mine === gen) finish(); });
      } else {
        id = navigator.geolocation.watchPosition(onReading, onError, watchOpts);
        if (done) stop(id);
      }
    }
    start();
  });

  if (!readings.length && !denied) {
    try {
      const coarse = { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 };
      take(await withTimeout(native
        ? Geolocation.getCurrentPosition(coarse)
        : new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, coarse)), 9000, 'Network location'));
    } catch (e) {
      // On the web the location prompt can still be open when the watch ends:
      // the answer then arrives here.
      if (e?.code === 1 || /denied|permission/i.test(String(e?.message || ''))) denied = true;
    }
  }
  if (!readings.length) {
    const err = new Error(denied ? 'Location permission denied' : 'No location reading');
    err.code = denied ? 1 : 3;
    throw err;
  }
  const pool = freshOnes().length ? freshOnes() : readings;
  const best = pool.reduce((x, y) => (y.acc <= x.acc ? y : x));
  // The freshest fix we have — every other caller may reuse it for the window.
  _posCache = { coords: { latitude: best.lat, longitude: best.lng, accuracy: Number.isFinite(best.acc) ? best.acc : null } };
  _posCacheAt = Date.now();
  return { lat: best.lat, lng: best.lng, ...(Number.isFinite(best.acc) ? { acc: Math.round(best.acc) } : {}), samples: readings.length };
}

async function _resolvePosition(options) {
  const highAccuracy = {
    enableHighAccuracy: options.enableHighAccuracy ?? true,
    timeout: options.timeout ?? 10000,
    maximumAge: options.maximumAge ?? 0,
  };

  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    await ensureNativePermission(Geolocation);

    // Precise GPS first, then network fallback — never hang.
    try {
      const pos = await withTimeout(
        Geolocation.getCurrentPosition(highAccuracy),
        (highAccuracy.timeout || 10000) + 2000,
        'High-accuracy GPS'
      );
      return normalize(pos);
    } catch (e1) {
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
