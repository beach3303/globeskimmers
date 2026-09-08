/**
 * analytics.js — Phase 2 / P3 scaffold
 *
 * Lightweight frontend helper for sending events to the Cloudflare Worker's
 * /log-event endpoint, which persists them in D1 (when the D1 binding is
 * provisioned per the wrangler.toml comment block).
 *
 * Until D1 is live, the Worker returns { logged: false, reason: 'no_db_binding' }
 * for every call — the frontend doesn't error and we just lose the data for
 * those calls. That makes it safe to instrument the codebase now and turn
 * on persistence later without changing call sites.
 *
 * Design choices:
 *   - Fire-and-forget: returns immediately, doesn't await the network call.
 *     User-facing latency stays zero even if the analytics endpoint stalls.
 *   - Coalesce: events fired within 200ms get batched into one request
 *     (cheaper at scale + reduces Worker invocation count).
 *   - Session id: generated once per page-load, persisted in sessionStorage
 *     so refreshes carry through but new tabs get fresh sessions.
 *   - Anon id: durable per-device id in localStorage (survives sessions) — the
 *     stable key for D1/D7/D30 retention cohorts, even for signed-out users.
 *   - User id: the signed-in Supabase user id (null for anonymous). Was reading
 *     the dead Base44 SDK (always null since auth moved to Supabase); fixed.
 *   - UA summary: coarse classification only ('ios-safari' / 'android-chrome'
 *     / 'desktop' etc.), no full UA string (privacy).
 *
 * Usage:
 *   import { logEvent } from '@/lib/analytics';
 *   logEvent('search', { query: 'pancakes', resultCount: 12 }, 'PlacesToEat');
 *   logEvent('card_open', { placeId: 'ChIJxxx', rank: 3 }, 'PlacesToEat');
 *   logEvent('photo_view', { placeId: 'ChIJxxx', photoIndex: 2 }, 'PlacesToEat');
 */

import { supabase } from '@/lib/supabaseClient';

const WORKER_URL = 'https://globeskimmers-api.maizasimeon.workers.dev';
const ENDPOINT = `${WORKER_URL}/log-event`;
const BATCH_DELAY_MS = 200;
const STORAGE_KEY = 'gs_session_id';
const ANON_KEY = 'gs_anon_id';

// Dev guard — `npm run dev` talks to the PRODUCTION worker (WORKER_URL is
// hardcoded; there is no staging), so without this every local browse session
// pollutes the live D1 events table. In dev every send is a no-op (one
// console.debug notice on the first attempted event). Vite statically
// replaces import.meta.env.DEV, so production builds see `false` here —
// zero behavior change shipped.
const IS_DEV = !!import.meta.env?.DEV;
let devNoticeShown = false;

let pendingBatch = [];
let batchTimer = null;

// Real user identity from the Supabase session (replaces the dead Base44 read).
// Kept in a module var so logEvent stays synchronous/fire-and-forget: seeded once
// and updated on every auth change (sign-in/out, token refresh).
let currentUserId = null;
try {
  supabase.auth.getSession().then(({ data }) => { currentUserId = data?.session?.user?.id || null; }).catch(() => {});
  supabase.auth.onAuthStateChange((_e, session) => { currentUserId = session?.user?.id || null; });
} catch { /* analytics must never break the app */ }

// Durable per-device id — survives across sessions (unlike session_id), so we can
// measure D1/D7/D30 retention and returning users even for signed-out travelers.
function getAnonId() {
  try {
    let a = localStorage.getItem(ANON_KEY);
    if (!a) { a = `a_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`; localStorage.setItem(ANON_KEY, a); }
    return a;
  } catch { return null; }
}

function getSessionId() {
  try {
    let sid = sessionStorage.getItem(STORAGE_KEY);
    if (!sid) {
      sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return 'anon';
  }
}

function classifyUserAgent() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua)) return 'ios-safari';
  if (/Android/.test(ua) && /Chrome/.test(ua)) return 'android-chrome';
  if (/Macintosh.*Safari/.test(ua) && !/Chrome/.test(ua)) return 'mac-safari';
  if (/Chrome/.test(ua)) return 'chrome';
  if (/Firefox/.test(ua)) return 'firefox';
  if (/Safari/.test(ua)) return 'safari';
  return 'other';
}

async function flushBatch() {
  if (pendingBatch.length === 0) return;
  const batch = pendingBatch;
  pendingBatch = [];
  batchTimer = null;
  // Fire-and-forget per event. We could batch into a single multi-event
  // request later, but the current endpoint accepts one event per call.
  for (const evt of batch) {
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evt),
        keepalive: true,
      }).catch(() => {}); // swallow network errors
    } catch {}
  }
}

/**
 * Fire-and-forget analytics event. Safe to call before D1 is provisioned;
 * the Worker will no-op gracefully.
 *
 * @param {string} eventType — short identifier: 'page_view', 'search', 'card_open', 'photo_view', ...
 * @param {object} [payload] — event-specific fields (will be JSON-stringified into the events.payload column)
 * @param {string} [page] — which page fired the event: 'PlacesToEat', 'ThingsToDo', etc.
 */
export function logEvent(eventType, payload = {}, page = null) {
  if (!eventType) return;
  if (IS_DEV) {
    // Nothing is queued, so flushBatch/flushEvents stay no-ops too.
    if (!devNoticeShown) {
      devNoticeShown = true;
      try { console.debug('[analytics] dev — events not sent'); } catch { /* noop */ }
    }
    return;
  }
  try {
    pendingBatch.push({
      event_type: eventType,
      page,
      payload,
      session_id: getSessionId(),
      user_id: currentUserId,   // real Supabase user id (null if signed out)
      anon_id: getAnonId(),     // durable per-device id for retention cohorts
      ua_summary: classifyUserAgent(),
    });

    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
  } catch {
    // Never let analytics break the app.
  }
}

/**
 * Manually flush pending events. Call on page-hide / before-unload so events
 * fired in the last 200ms don't get dropped.
 */
export function flushEvents() {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  flushBatch();
}

// Auto-flush on page hide (covers tab switch, navigation, app background).
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushEvents);
  window.addEventListener('beforeunload', flushEvents);
}
