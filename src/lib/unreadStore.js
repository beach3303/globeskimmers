// unreadStore — one read of /social/unread, shared by the banner's envelope (mail: unread
// postcards + sealed telegrams) and the bottom bar's Profile dot (news: unread lines that
// aren't mail; requests: people waiting for an answer). Navigation redesign, 2026-10-31:
// "Requests and news light the Profile dot instead, never the envelope."
//
//   const { mail, news, requests } = useUnread();   // 0s until the first read lands
//   refreshUnread()        read again if the last read is older than a minute (on navigation)
//   refreshUnread(true)    read again now
//   resetUnread()          a different account signed in: back to 0s, read again
//   wireUnread()           once: gs:unread (something was marked seen → news clears at once, a
//                          fresh read follows), gs:mail (a telegram's seal broke), and the app
//                          coming back to the foreground.
//
// Mail is never cleared by guessing: a postcard leaves the count when the worker has shown it
// (read_at), a telegram when its seal breaks (received_at), so the store only reads again.
import { useSyncExternalStore } from 'react';
import { socialUnread } from '@/lib/passport';

const EMPTY = { mail: 0, news: 0, requests: 0, total: 0, at: 0 };
const STALE_MS = 60 * 1000;

let state = EMPTY;
let lastCheck = 0;
let inflight = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function getUnread() { return state; }
export function subscribeUnread(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function refreshUnread(force = false) {
  if (!force && Date.now() - lastCheck < STALE_MS) return state;
  if (inflight) return inflight;
  lastCheck = Date.now();
  inflight = (async () => {
    try {
      const r = await socialUnread();
      if (!r.error) { state = { mail: r.mail, news: r.news, requests: r.requests, total: r.total, at: Date.now() }; emit(); }
    } catch { /* keep the last reading */ }
    inflight = null;
    return state;
  })();
  return inflight;
}

export function resetUnread() {
  state = EMPTY;
  lastCheck = 0;
  emit();
}

export function useUnread() {
  return useSyncExternalStore(subscribeUnread, getUnread, getUnread);
}

let wired = false;
export function wireUnread() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('gs:unread', () => {
    // Marked seen (Friends' news opened): the news dot goes at once; the worker confirms shortly.
    state = { ...state, news: 0, total: 0 };
    emit();
    setTimeout(() => refreshUnread(true), 1200);
  });
  window.addEventListener('gs:mail', () => { setTimeout(() => refreshUnread(true), 800); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshUnread(); });
}
