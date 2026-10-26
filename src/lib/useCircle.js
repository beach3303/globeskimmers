// useCircle: the signed-in traveler's circle, read from social/follow op 'list' and shared
// by every surface that shows it (Home's circle zone, the profile's circle folder, the
// Circle screen and its Blocked list, Mailbox, the visit page). It never calls
// socialUnread, so reading the circle never clears the Mailbox dot.
//
//   const circle = useCircle();
//   status       'loading' until the first read lands, then 'ready'; 'error' when the read
//                failed and there is nothing to show (show 'Try again', never an empty
//                circle). A refresh that fails keeps the last good lists: status stays
//                'ready' and error says why.
//   error        the last read's error, or null.
//   retry()      read again now ('Try again'; also after following someone elsewhere).
//
//   The people, each list newest first (by their latest stamp once the list sends one,
//   backend item B7; else by when the follow began). Blocked people are in none of them.
//   acc            you follow them, accepted (your inner circle included)
//   fol            they follow you, accepted (your inner circle included)
//   mutual         you follow each other: your inner circle (acc and fol)
//   followingOnly  acc without the inner circle (the orbit's middle ring)
//   followersOnly  fol without the inner circle (the orbit's outer ring)
//   requests       people asking to follow you, waiting for your answer
//   pendingOut     people you asked to follow, waiting for theirs ('Requested')
//   blocked        people you blocked (the Blocked list); blockedIds (user ids) and
//                  blockedHandles (lower case, no '@') filter feed rows by by.handle
//   counts         { inner, youFollow, followYou, requests }, accepted follows only. Every
//                  value is null until a read has landed, never a guessed 0.
//   features       the worker's capability flags (op:list features)
//   canVisit       features include 'world' (B3): faces and rows may open /Traveler
//   canBlock       features include 'block_v2' (B8): offer Block. Unblock always works.
//   relationOf(x)  for a user id, a handle or a person row: 'blocked', 'inner',
//                  'following', 'requested', 'follower', 'requesting' or null
//
//   Actions return { ok, data, error } and re-read the lists for every surface before they
//   resolve, whether or not the worker said yes:
//   follow(handle | { handle, user_id })   unfollow(user_id | { user_id, handle })
//   accept(user_id)   decline(user_id)   block(user_id)   unblock(user_id)
//   (The worker follows by handle today; backend item B9 adds user_id.)
//
// One read serves every mounted surface, and a read younger than 30 seconds is reused.
// Outside React: refreshCircle() reads again now, invalidateCircle() makes the next
// mount read again. Each list keeps the worker's person fields as they are (user_id,
// handle, name, verified, seal, status, since; cloth and avatar with B2; latest with B7).
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { blockUser, socialFollow, unblockUser } from '@/lib/passport';

const TTL_MS = 30 * 1000;
const FAILED = 'Couldn’t load your friends and followers';

// ── The shared read (one signed-in user at a time) ─────────────────────

let state = { uid: null, status: 'loading', data: null, error: null };
let readAt = 0; // when state.data was read; 0 makes the next mount read again
let inflight = null; // { uid, promise }
let seq = 0; // the newest read; an older one that lands later is dropped
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn());
const setState = (patch) => {
  state = { ...state, ...patch };
  emit();
};
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => state;

function reset(uid) {
  seq += 1;
  inflight = null;
  readAt = 0;
  setState({ uid, status: 'loading', data: null, error: null });
}

function load(uid, force = false) {
  if (!uid) return Promise.resolve();
  if (state.uid !== uid) reset(uid);
  if (!force && state.data && Date.now() - readAt < TTL_MS) return Promise.resolve();
  if (!force && inflight && inflight.uid === uid) return inflight.promise;
  const mine = ++seq;
  if (!state.data && state.status !== 'loading') setState({ status: 'loading', error: null });
  const promise = Promise.resolve()
    .then(() => socialFollow('list'))
    .catch((e) => ({ data: null, error: e?.message || FAILED }))
    .then(({ data, error }) => {
      if (mine !== seq || state.uid !== uid) return;
      inflight = null;
      if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
        readAt = Date.now();
        setState({ status: 'ready', data, error: null });
      } else if (state.data) {
        setState({ error: error || FAILED });
      } else {
        setState({ status: 'error', error: error || FAILED });
      }
    });
  inflight = { uid, promise };
  return promise;
}

/** Read the circle again now, for every mounted surface. */
export function refreshCircle() {
  return state.uid ? load(state.uid, true) : Promise.resolve();
}

/** Make the next surface that mounts read the circle again. */
export function invalidateCircle() {
  readAt = 0;
}

// ── Deriving the rings ─────────────────────────────────────────────────

const lc = (h) => String(h ?? '').trim().replace(/^@+/, '').toLowerCase();
const idOf = (r) => String(r.user_id);

// Rows with a user id, once each.
function people(list) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || typeof r !== 'object' || r.user_id == null || r.user_id === '') continue;
    const id = idOf(r);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

// Newest first: a latest stamp (B7) before none, then by that stamp's date, else by when
// the follow began.
const stampAt = (r) => {
  const t = Date.parse(String(r?.latest?.date ?? r?.latest?.at ?? ''));
  return Number.isFinite(t) ? t : null;
};
const sinceAt = (r) => {
  const t = Date.parse(String(r?.since ?? ''));
  return Number.isFinite(t) ? t : 0;
};
function newestFirst(list) {
  return [...list].sort((a, b) => {
    const sa = stampAt(a);
    const sb = stampAt(b);
    if (sa !== null || sb !== null) {
      if (sa === null) return 1;
      if (sb === null) return -1;
      if (sb !== sa) return sb - sa;
    }
    return sinceAt(b) - sinceAt(a);
  });
}

/**
 * The rings and counts from an op:list reply (null while nothing has loaded).
 * @param {any} data
 */
export function deriveCircle(data) {
  const blocked = people(data?.blocked);
  const blockedIds = new Set(blocked.map(idOf));
  const blockedHandles = new Set(blocked.map((r) => lc(r.handle)).filter(Boolean));
  const keep = (r) => !blockedIds.has(idOf(r));
  const following = people(data?.following).filter(keep);
  const acc = newestFirst(following.filter((r) => r.status === 'accepted'));
  const pendingOut = newestFirst(following.filter((r) => r.status === 'pending'));
  const fol = newestFirst(people(data?.followers).filter((r) => keep(r) && (r.status == null || r.status === 'accepted')));
  const accIds = new Set(acc.map(idOf));
  const folIds = new Set(fol.map(idOf));
  const mutual = acc.filter((r) => folIds.has(idOf(r)));
  const followingOnly = acc.filter((r) => !folIds.has(idOf(r)));
  const followersOnly = fol.filter((r) => !accIds.has(idOf(r)));
  const requests = newestFirst(people(data?.requests).filter((r) => keep(r) && !folIds.has(idOf(r))));
  const features = Array.isArray(data?.features) ? data.features.filter((f) => typeof f === 'string') : [];
  const counts = data
    ? { inner: mutual.length, youFollow: acc.length, followYou: fol.length, requests: requests.length }
    : { inner: null, youFollow: null, followYou: null, requests: null };
  return {
    acc, fol, mutual, followingOnly, followersOnly, requests, pendingOut,
    blocked, blockedIds, blockedHandles, counts, features,
    canVisit: features.includes('world'),
    canBlock: features.includes('block_v2'),
  };
}

// Who a caller means: a person row, or a string that is a user id or a handle.
function whoKey(who) {
  if (who && typeof who === 'object') {
    return { id: who.user_id != null && who.user_id !== '' ? String(who.user_id) : null, handle: lc(who.handle) || null };
  }
  const s = String(who ?? '').trim();
  return s ? { id: s, handle: lc(s) } : { id: null, handle: null };
}
const matches = (r, k) => (k.id !== null && idOf(r) === k.id) || (k.handle !== null && lc(r.handle) === k.handle);
const userIdOf = (who) => (who && typeof who === 'object' ? who.user_id : who);

// ── The hook ───────────────────────────────────────────────────────────

export default function useCircle() {
  // A surface rendered without an AuthProvider (a test harness) reads nobody's circle.
  let uid = null;
  try {
    uid = useAuth()?.user?.id || null;
  } catch {
    uid = null;
  }
  const snap = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (uid) load(uid);
    else if (state.uid !== null) reset(null); // signed out: forget the last user's circle
  }, [uid]);

  const mine = uid && snap.uid === uid ? snap : null;
  const data = mine ? mine.data : null;
  const status = mine ? mine.status : 'loading';
  const error = mine ? mine.error : null;
  const view = useMemo(() => deriveCircle(data), [data]);

  const retry = useCallback(() => (uid ? load(uid, true) : Promise.resolve()), [uid]);

  const relationOf = useCallback((who) => {
    const k = whoKey(who);
    if (k.id === null && k.handle === null) return null;
    const has = (list) => list.some((r) => matches(r, k));
    if (has(view.blocked)) return 'blocked';
    if (has(view.mutual)) return 'inner';
    if (has(view.acc)) return 'following';
    if (has(view.pendingOut)) return 'requested';
    if (has(view.fol)) return 'follower';
    if (has(view.requests)) return 'requesting';
    return null;
  }, [view]);

  // Run an action, then re-read the circle for every surface, then resolve.
  const run = useCallback(async (call) => {
    let res;
    try {
      res = await call();
    } catch (e) {
      res = { ok: false, data: null, error: e?.message || 'Something went wrong' };
    }
    if (uid) await load(uid, true);
    return res;
  }, [uid]);

  const follow = useCallback((who) => run(async () => {
    const k = who && typeof who === 'object' ? who : { handle: who };
    const handle = lc(k.handle);
    const user_id = k.user_id != null ? String(k.user_id).trim() : '';
    if (!handle && !user_id) return { ok: false, data: null, error: 'Who?' };
    const { data: d, error: e } = await socialFollow('follow', { ...(handle ? { handle } : {}), ...(user_id ? { user_id } : {}) });
    return { ok: !e && d?.ok === true, data: d, error: e };
  }), [run]);

  const unfollow = useCallback((who) => run(async () => {
    const k = who && typeof who === 'object' ? who : { user_id: who };
    const user_id = k.user_id != null ? String(k.user_id).trim() : '';
    const handle = lc(k.handle);
    if (!user_id && !handle) return { ok: false, data: null, error: 'Who?' };
    const { data: d, error: e } = await socialFollow('unfollow', user_id ? { user_id } : { handle });
    return { ok: !e && d?.ok === true, data: d, error: e };
  }), [run]);

  const answer = useCallback((op, who) => run(async () => {
    const user_id = String(userIdOf(who) ?? '').trim();
    if (!user_id) return { ok: false, data: null, error: 'user_id required' };
    const { data: d, error: e } = await socialFollow(op, { user_id });
    return { ok: !e && d?.ok === true, data: d, error: e };
  }), [run]);
  const accept = useCallback((who) => answer('accept', who), [answer]);
  const decline = useCallback((who) => answer('decline', who), [answer]);
  const block = useCallback((who) => run(() => blockUser(userIdOf(who))), [run]);
  const unblock = useCallback((who) => run(() => unblockUser(userIdOf(who))), [run]);

  return useMemo(() => ({
    status, error, retry, ...view, relationOf,
    follow, unfollow, accept, decline, block, unblock,
  }), [status, error, retry, view, relationOf, follow, unfollow, accept, decline, block, unblock]);
}
