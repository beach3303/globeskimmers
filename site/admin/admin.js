// Globeskimmers · Admin (globeskimmers.io/admin): the founder's read-only
// analytics page.
//
// The page holds no data. It signs in with Supabase Auth (the same accounts as
// the app: Google, or email + password) and reads the API worker's admin
// routes with that session's access token, exactly as the app's Admin page
// (src/pages/AdminAnalytics.jsx) does. The worker checks the token and its
// admin list on every call and answers 401/403 to anyone else, so this file
// carries no admin list and no secrets.
//
// Rules this file keeps:
//  - Every string from a server goes into the page with textContent (no
//    innerHTML anywhere: the CSP's Trusted Types rule would refuse it).
//  - A number shows only when it was read. A failed read shows the error,
//    never a 0; a route that isn't deployed yet says so.
//  - Server day/month buckets are UTC (labelled); single timestamps are shown
//    in the viewer's own time zone (labelled).
//  - Nothing writes: no moderation, no "mark handled". Opening Newest members
//    does let the worker number any new member, as the app's page does.

const CFG = Object.freeze({
  supabaseUrl: 'https://bkaxadiyehddzkiuheea.supabase.co',
  // The public client key, the same one shipped inside the app. Row Level
  // Security and the worker's admin check guard the data, not this key.
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYXhhZGl5ZWhkZHpraXVoZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODkwODUsImV4cCI6MjA3NDY2NTA4NX0.yT0mYLUh28aLXfpJvTsVAVvFjM4zIsImCYfbCEUtayo',
  worker: 'https://globeskimmers-api.maizasimeon.workers.dev',
  apex: 'globeskimmers.io',
  timeoutMs: 25000,
});

const KEY_SESSION = 'gs-admin.session';   // its own key: never the app's 'globeskimmers.auth'
const KEY_PKCE = 'gs-admin.pkce';

// ─── DOM helpers (text only) ────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
function setProps(node, props) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'text') node.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
}
function add(node, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === '') continue;
    node.append(k instanceof Node ? k : String(k));   // a string becomes a text node
  }
  return node;
}
function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  setProps(node, props);
  return add(node, kids);
}
function sv(tag, props, ...kids) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  setProps(node, props);
  return add(node, kids);
}
const ICONS = {
  alert: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 8v4' }], ['path', { d: 'M12 16h.01' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 6v6l4 2' }]],
};
function icon(name) {
  return sv('svg', { class: 'ic', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, ICONS[name].map(([t, a]) => sv(t, a)));
}

// ─── formatting ─────────────────────────────────────────────────────────────
const NF = new Intl.NumberFormat();
const CF = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const fmt = (n) => NF.format(n);
const pctOf = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
const plural = (n, one, many) => (n === 1 ? one : many);

class Shape extends Error {
  constructor(what) { super(`The server’s answer is missing ${what}.`); this.name = 'Shape'; }
}
class AuthEnded extends Error {
  constructor(message) { super(message); this.name = 'AuthEnded'; }
}
// A finite number from the server, or the answer is malformed.
function num(v, what) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Shape(what);
  return n;
}
// A SQL SUM over zero rows is null: that one really is 0. A missing field is not.
function sum(v, what) { return v === null ? 0 : num(v, what); }
function rowsOf(d, what) {
  if (!d || !Array.isArray(d.results)) throw new Shape(what);
  return d.results;
}
function listOf(v, what) {
  if (!Array.isArray(v)) throw new Shape(what);
  return v;
}

function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return Number.isNaN(+d) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function monthLabel(ym) {
  const d = new Date(ym + '-01T00:00:00Z');
  return Number.isNaN(+d) ? ym : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function localStamp(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(+d)) return '—';
  const year = d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' };
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', ...year, hour: 'numeric', minute: '2-digit' });
}
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMonths(ym, n) {
  const d = new Date(ym + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
function zoneLabel() {
  let iana = '', long = '';
  try { iana = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* older browser */ }
  try { long = new Intl.DateTimeFormat(undefined, { timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || ''; } catch { /* older browser */ }
  if (long && iana && long !== iana) return `${long} (${iana})`;
  return long || iana || 'this device’s time zone';
}
function utcNote() {
  if (new Date().getTimezoneOffset() === 0) return 'Day charts use UTC days, which match your local days right now.';
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const at = midnight.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); // minutes always: a 24-hour locale would print a bare "01"
  return `Day charts use UTC days, which start at ${at} your time.`;
}
// When a UTC day ("2026-10-14") or UTC month ("2026-10") began, in the viewer's
// own time: "Tue 5:00 PM", or "Sep 30, 5:00 PM" for a month (always with the
// minutes: a 24-hour locale would print a bare "Tue, 17"). Null where UTC days
// are the viewer's own days right now (as utcNote says), so "today" is exact.
function utcSince(key) {
  if (new Date().getTimezoneOffset() === 0) return null;
  const month = key.length === 7;
  const d = new Date(key + (month ? '-01' : '') + 'T00:00:00Z');
  return d.toLocaleString(undefined, month ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
let REGION = null, LANG = null;
try { REGION = new Intl.DisplayNames(undefined, { type: 'region' }); } catch { /* names fall back to codes */ }
try { LANG = new Intl.DisplayNames(undefined, { type: 'language' }); } catch { /* names fall back to codes */ }
function named(v, kind) {
  const s = String(v ?? '').trim();
  if (!s) return '(blank)';
  const dn = kind === 'region' ? REGION : LANG;
  const ok = kind === 'region' ? /^[A-Za-z]{2}$/.test(s) : /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(s);
  if (dn && ok) {
    try {
      const code = kind === 'region' ? s.toUpperCase() : s;
      const name = dn.of(code);
      if (name && name.toLowerCase() !== s.toLowerCase()) return [name, el('span', { class: 'code', text: code })];
    } catch { /* not a code Intl knows */ }
  }
  return s;
}
// A label map read with a key from the server: own keys only, so "constructor" stays text.
const own = (map, k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : undefined);
const PROVIDERS = { apple: 'Apple', google: 'Google', email: 'Email', facebook: 'Facebook' };
function providerName(p) {
  const k = String(p || '').trim();
  return own(PROVIDERS, k.toLowerCase()) || (k ? k[0].toUpperCase() + k.slice(1) : '—');
}
const GEAR = { laptop: 'Laptop', tumbler: 'XL coffee tumbler', 'straw-bottle': 'XXL straw bottle', 'lid-bottle': 'Water bottle' };
const gearName = (k) => own(GEAR, k) || String(k || '(unknown)');

// ─── storage (each read and write may throw in a locked-down browser) ───────
function store(kind) {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
}
function readJSON(st, key) {
  try { const raw = st && st.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeJSON(st, key, value) {
  try { if (!st) return false; st.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function drop(st, key) {
  try { if (st) st.removeItem(key); } catch { /* nothing to drop */ }
}

// ─── session ────────────────────────────────────────────────────────────────
// { access_token, refresh_token, expires_at (s), email, remember }. "Keep me
// signed in" stores it in localStorage. Otherwise it lives in this page's
// memory only: never sessionStorage, which a reopened tab ("Reopen closed tab",
// "continue where you left off") restores, admin tokens included. Reloading or
// closing the tab then signs this page out. Supabase's provider tokens are
// never kept.
const session = {
  cur: null,
  valid(s) { return !!(s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' && Number.isFinite(s.expires_at)); },
  load() {
    const s = readJSON(store('local'), KEY_SESSION);
    this.cur = this.valid(s) ? { ...s, remember: true } : null;
    return this.cur;
  },
  // What another tab may have stored since (only a remembered session is shared).
  peek() {
    if (!this.cur?.remember) return null;
    const s = readJSON(store('local'), KEY_SESSION);
    return this.valid(s) ? s : null;
  },
  // The stored session may belong to another tab, so only an explicit act
  // removes it: a fresh sign-in without "Keep me signed in" (fresh), or Sign
  // out (clear(true)). A tab that isn't remembered never removes it on a token
  // refresh or when its own sign-in ends, which would sign the other tab out.
  save(t, remember, fresh) {
    if (!t || typeof t.access_token !== 'string' || typeof t.refresh_token !== 'string') throw new Error('Supabase didn’t send a session.');
    const now = Math.floor(Date.now() / 1000);
    const expires_at = Number.isFinite(Number(t.expires_at)) && Number(t.expires_at) > now ? Number(t.expires_at) : now + (Number(t.expires_in) || 3600);
    const email = String(t.user?.email || this.cur?.email || '');
    this.cur = { access_token: t.access_token, refresh_token: t.refresh_token, expires_at, email, remember: !!remember };
    if (remember) writeJSON(store('local'), KEY_SESSION, { access_token: t.access_token, refresh_token: t.refresh_token, expires_at, email });
    else if (fresh) drop(store('local'), KEY_SESSION);
  },
  clear(all) {
    const mine = !!this.cur?.remember;
    this.cur = null;
    if (all || mine) drop(store('local'), KEY_SESSION);
    drop(store('session'), KEY_SESSION);
  },
};

async function fetchWithTimeout(url, init, ms = CFG.timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } finally {
    clearTimeout(timer);
  }
}

// Supabase Auth over plain REST: the password, refresh_token and pkce grants,
// and logout. Only the public apikey header goes with them (plus the user's
// own token for logout).
async function authPost(path, body, token) {
  const headers = { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetchWithTimeout(CFG.supabaseUrl + '/auth/v1/' + path, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    return { ok: false, status: 0, message: e?.name === 'AbortError' ? 'Supabase took too long to answer. Try again.' : 'Couldn’t reach Supabase. Check your connection and try again.' };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, message: authMessage(res.status, data) };
  return { ok: true, status: res.status, data };
}
function authMessage(status, data) {
  const code = String(data?.error_code || data?.error || '');
  const raw = String(data?.msg || data?.error_description || data?.message || data?.error || '').slice(0, 240);
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(raw)) return 'That email and password don’t match. If you sign in to the app with Google, use Continue with Google instead: those accounts have no password.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(raw)) return 'This email address isn’t confirmed yet.';
  if (status === 429 || code === 'over_request_rate_limit') return 'Too many tries. Wait a minute, then try again.';
  return raw ? `Sign-in failed: ${raw}` : `Sign-in failed (HTTP ${status}).`;
}

let refreshing = null;
function refreshSession() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const cur = session.cur;
    if (!cur) throw new AuthEnded('You’re signed out.');
    // Another tab may already have used this refresh token: take its result.
    const stored = session.peek();
    if (stored && stored.refresh_token !== cur.refresh_token && stored.expires_at > cur.expires_at) {
      session.cur = { ...stored, remember: cur.remember };
      return session.cur;
    }
    const r = await authPost('token?grant_type=refresh_token', { refresh_token: cur.refresh_token });
    if (!r.ok) {
      if (r.status >= 400 && r.status < 500) { session.clear(); throw new AuthEnded('Your sign-in has ended. Please sign in again.'); }
      throw new Error(r.message);   // offline or a Supabase hiccup: keep the session
    }
    session.save(r.data, cur.remember);
    return session.cur;
  })();
  refreshing.then(() => { refreshing = null; }, () => { refreshing = null; });
  return refreshing;
}
async function accessToken() {
  if (!session.cur) throw new AuthEnded('You’re signed out.');
  if (session.cur.expires_at - Date.now() / 1000 < 60) await refreshSession();
  return session.cur.access_token;
}

// ─── the API worker ─────────────────────────────────────────────────────────
// POST JSON with the Supabase token, as the app's callWorker does. Returns
// { ok: true, data } or { ok: false, kind, status, message } where message is
// only ever the server's own error text. A 401 refreshes the session once.
function fail(kind, status, message) {
  return { ok: false, kind, status, message: message ? String(message).slice(0, 300) : '' };
}
async function worker(path, body, retried) {
  let token;
  try { token = await accessToken(); } catch (e) {
    if (e instanceof AuthEnded) throw e;
    return fail('network', 0, '');
  }
  let res;
  try {
    res = await fetchWithTimeout(CFG.worker + '/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}),
      cache: 'no-store',
    });
  } catch (e) {
    return fail(e?.name === 'AbortError' ? 'timeout' : 'network', 0, '');
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && !retried) {
    try { await refreshSession(); } catch (e) { if (e instanceof AuthEnded) throw e; }
    return worker(path, body, true);
  }
  const err = data && typeof data === 'object' && typeof data.error === 'string' ? data.error : '';
  if (!res.ok || err || !data || typeof data !== 'object') {
    // Only a 403 means "not an admin". A 401 that survives the refresh means the
    // worker couldn't check the token with Supabase (an outage, a rate limit),
    // which says nothing about this account.
    const kind = res.status === 403 ? 'denied' : res.status === 401 ? 'unverified' : res.status === 404 ? 'missing' : !data && res.ok ? 'shape' : 'http';
    return fail(kind, res.status, err || (res.ok ? '' : `HTTP ${res.status}`));
  }
  return { ok: true, status: res.status, data };
}

// One request per route per load, shared by every panel that reads it.
const cache = new Map();
const Q = (type) => ({ key: 'q:' + type, path: 'analytics-query?type=' + encodeURIComponent(type), body: {} });
const R = (path, body) => ({ key: 'r:' + path, path, body: body || {} });
function get(dep) {
  if (!cache.has(dep.key)) cache.set(dep.key, worker(dep.path, dep.body, false));
  return cache.get(dep.key);
}
const D = {
  active: Q('active_users'),
  activeDays: Q('active_users_by_day_30d'),
  cohort: Q('retention_cohorts_90d'),
  totals: Q('totals_7d'),
  eventDays: Q('events_by_day_14d'),
  searches: Q('top_searches_7d'),
  zero: Q('top_zero_results'),
  pages: Q('page_views_7d'),
  eventTypes: Q('event_type_breakdown_7d'),
  stats: R('admin-user-stats'),
  members: R('admin/members'),
  gear: R('admin/gear-report'),
  contact: R('admin/contact'),
  monthly: R('admin/passport-monthly'),
  overview: R('admin/activity-overview'),
};

// Routes that answer differently until the next worker deploy. /admin/members
// is not on the live worker yet (404). /admin-user-stats is live but can't read
// profiles (it asks PostgREST's default schema; the one-line fix ships with
// the next update).
const SOON = 'Available after the next server update.';
const soonMembers = (r) => (r.status === 404 ? 'The live server doesn’t have the members list yet.' : null);
const soonStats = (r) => (r.status === 502 && /profiles read failed \(404\)/.test(r.message) ? 'The live server can’t read account profiles yet; a fix is ready to ship.' : null);

// ─── panels: one slot of the page fed by one or more routes ─────────────────
// gen moves on at every sign-out/wipe, so a reply that lands afterwards is
// dropped instead of drawn into the (hidden) page.
let gen = 0;
const panels = [];
function panel(slot, deps, render, opts) {
  const p = { slot, deps, render, opts: opts || {} };
  panels.push(p);
  return p;
}
const hostOf = (p) => p.opts.host || p.slot.closest('.card, .kpi') || p.slot;
async function runPanel(p) {
  const mine = gen;
  const host = hostOf(p);
  if (!p.slot.firstChild) p.slot.replaceChildren(...loadingState(p.opts.compact));
  host.classList.add('busy');
  host.setAttribute('aria-busy', 'true');
  let results;
  try {
    results = await Promise.all(p.deps.map(get));
  } catch (e) {
    if (e instanceof AuthEnded) { authEnded(e.message); return; }
    results = [fail('bug', 0, e?.message || String(e))];
  }
  if (mine !== gen) return;
  host.classList.remove('busy');
  host.removeAttribute('aria-busy');
  // A redraw removes whatever had focus inside it (a Try again, a Show all):
  // the panel's heading takes focus instead of <body>, so nobody loses their place.
  const hadFocus = p.slot.contains(document.activeElement);
  p.slot.replaceChildren(...drawPanel(p, results));
  if (hadFocus && !p.slot.contains(document.activeElement)) host.querySelector('h3')?.focus({ preventScroll: true });
}
// Each load explains a failed route once: the first panel that reads it (in
// page order) shows the whole error and the one Try again; later panels point
// back to it. A "not deployed yet" note gets its full text in the first card.
const explained = new Map();   // dep key → the panel that explained it
function drawPanel(p, results) {
  const retry = () => retryDeps(p.deps);
  const bad = results.find((r) => !r.ok);
  if (bad) {
    if (p.opts.onFail) p.opts.onFail(bad);
    const key = p.deps[results.indexOf(bad)]?.key || '';
    const soon = p.opts.soon ? p.opts.soon(bad) : null;
    if (soon) {
      const full = !p.opts.compact && !explained.has('soon:' + key);
      if (full) explained.set('soon:' + key, p);
      return [soonState(soon, bad, !full)];
    }
    const first = explained.get(key);
    if (first && first !== p) return [sameProblem(first)];
    explained.set(key, p);
    return [errorState(bad, retry, p.opts.compact)];
  }
  try {
    const out = p.render(...results.map((r) => r.data));
    return [out].flat(Infinity).filter(Boolean);
  } catch (e) {
    if (p.opts.onFail) p.opts.onFail(null);
    return [errorState(fail(e instanceof Shape ? 'shape' : 'bug', 0, e?.message || String(e)), retry, p.opts.compact)];
  }
}
function sameProblem(first) {
  const name = (hostOf(first).querySelector('h3')?.textContent || '').trim();
  return el('p', { class: 'kpi-err' }, el('b', { text: 'Couldn’t load.' }), name ? ` Same server problem as “${name}” above.` : ' Same server problem as above.');
}
function retryDeps(deps) {
  const keys = new Set(deps.map((d) => d.key));
  keys.forEach((k) => { cache.delete(k); explained.delete(k); explained.delete('soon:' + k); });
  return Promise.all(panels.filter((p) => p.deps.some((d) => keys.has(d.key))).map(runPanel)).then(() => { if (!running) stampLoaded(); });
}

function loadingState(compact) {
  if (compact) return [el('p', { class: 'kpi-value na', text: '…' }), el('p', { class: 'kpi-sub', text: 'Loading' })];
  return [el('div', { class: 'state state-loading', text: 'Loading…' })];
}
const WHY = {
  network: 'Couldn’t reach the server. It may be down, or the connection dropped.',
  timeout: 'The server didn’t answer within 25 seconds.',
  denied: 'The server refused this request for this account.',
  unverified: 'The server couldn’t confirm your sign-in.',
  missing: 'The server doesn’t have this route.',
  shape: 'The server’s answer wasn’t in the expected shape.',
  bug: 'Something went wrong in this page.',
};
function errorState(r, retry, compact) {
  const why = WHY[r.kind] || (r.status >= 500 ? 'The server hit an error.' : r.status >= 400 ? `The server said no (HTTP ${r.status}).` : 'The server reported an error.');
  const detail = r.message && r.message !== `HTTP ${r.status}` ? `Server said: ${r.message}` : r.status ? `HTTP ${r.status}` : '';
  if (compact) {
    return el('p', { class: 'kpi-err' }, el('b', { text: 'Couldn’t load. ' }), why,
      detail && el('span', { class: 'detail', text: detail }),
      retry && el('button', { class: 'btn-link', type: 'button', text: 'Try again', onclick: retry }));
  }
  return el('div', { class: 'state state-error' }, icon('alert'),
    el('div', null, el('b', { text: 'Couldn’t load. ' }), why,
      detail && el('span', { class: 'detail', text: detail }),
      retry && el('button', { class: 'btn-link', type: 'button', text: 'Try again', onclick: retry })));
}
function soonState(text, r, compact) {
  if (compact) return el('p', { class: 'kpi-soon' }, el('b', { text: SOON }));
  return el('div', { class: 'state state-soon' }, icon('clock'),
    el('div', null, el('b', { text: SOON }), ' ', text,
      r?.message && el('span', { class: 'detail', text: `Server said: ${r.message}` })));
}
const emptyState = (text) => el('div', { class: 'state state-empty', text });
const warn = (text) => el('p', { class: 'warn' }, icon('alert'), el('span', { text }));

// ─── building blocks ────────────────────────────────────────────────────────
let uid = 0;
// A subtitle that setMeta fills with counts goes back to its starting text when
// its load fails (resetMeta) and at sign-out (wipe() reads data-initial): old
// counts never sit over an error, or stay in the page for the next account.
function card(parent, { title, meta, def, wide, chart }) {
  const id = 'card-' + (++uid);
  const metaEl = meta ? el('p', { class: 'meta', 'data-initial': meta, text: meta }) : null;
  const body = el('div', { class: 'body' });
  const node = el('article', { class: 'card' + (wide ? ' span-all' : '') + (chart ? ' card-chart' : ''), 'aria-labelledby': id },
    el('div', { class: 'card-head' }, el('div', null, el('h3', { id, tabindex: '-1', text: title }), metaEl)),
    def && el('p', { class: 'def', text: def }),
    body);
  parent.append(node);
  const setMeta = (t) => { if (metaEl) metaEl.textContent = t; };
  return { node, body, setMeta, resetMeta: () => setMeta(meta) };
}

// A KPI tile. Its definition opens on hover (mouse) or tap/click/keyboard.
function tile(parent, { label, def }) {
  const id = 'kpi-' + (++uid);
  const body = el('div', { class: 'kpi-body' });
  const pop = el('p', { class: 'pop', id: id + '-def', role: 'tooltip', hidden: true, text: def });
  const btn = el('button', { class: 'info', type: 'button', 'aria-expanded': 'false', 'aria-controls': id + '-def', 'aria-describedby': id + '-def', 'aria-label': `What “${label}” counts` },
    el('span', { 'aria-hidden': 'true', text: 'i' }));
  const node = el('article', { class: 'kpi', 'aria-labelledby': id }, el('div', { class: 'kpi-head' }, el('h3', { class: 'kpi-label', id, tabindex: '-1', text: label }), btn), body, pop);
  let pinned = false;
  const open = (pin) => { closeTips(node); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); pinned = pin; };
  const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); pinned = false; };
  node.closeTip = close;
  btn.addEventListener('click', () => { if (pop.hidden || !pinned) open(true); else close(); });
  btn.addEventListener('mouseenter', () => { if (HOVER.matches && pop.hidden) open(false); });
  node.addEventListener('mouseleave', () => { if (!pinned) close(); });
  // Tabbing on closes it, so it never covers the next tile's controls. (Focus
  // dropping to nothing, like a click on the open definition, keeps it open.)
  node.addEventListener('focusout', (e) => { if (e.relatedTarget instanceof Node && !node.contains(e.relatedTarget)) close(); });
  parent.append(node);
  return body;
}
const HOVER = window.matchMedia('(hover: hover) and (pointer: fine)');
function closeTips(except) {
  for (const t of document.querySelectorAll('.kpi')) if (t !== except && t.closeTip) t.closeTip();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTips(null); });
document.addEventListener('click', (e) => closeTips(e.target instanceof Element ? e.target.closest('.kpi') : null));

function kpi(value, sub, na) {
  return [el('p', { class: 'kpi-value' + (na ? ' na' : ''), text: value }), el('p', { class: 'kpi-sub', text: sub })];
}

// A ranked table: label, optional extra columns, the count, and a thin bar.
function rankTable({ caption, head, rows, label, value, extra, limit, empty }) {
  if (!rows.length) return emptyState(empty);
  const cols = extra || [];
  const lim = limit || 12;
  const vals = rows.map((r) => num(value(r), 'a count'));
  const max = Math.max(...vals, 1);
  const trs = rows.map((r, i) => {
    const fill = el('i');
    fill.style.width = `${Math.max(0, Math.min(100, (vals[i] / max) * 100))}%`;   // CSSOM, allowed by the CSP
    return el('tr', { hidden: i >= lim },
      el('td', { class: 'lab' }, el('span', { class: 't' }, label(r)), el('span', { class: 'track', 'aria-hidden': 'true' }, fill)),
      cols.map((c) => el('td', { class: c.num ? 'n' : 'muted', text: c.cell(r) })),
      el('td', { class: 'n', text: fmt(vals[i]) }));
  });
  const table = el('table', { class: 'tbl' },
    caption && el('caption', { class: 'sr', text: caption }),
    el('thead', null, el('tr', null,
      el('th', { scope: 'col', text: head[0] }),
      cols.map((c) => el('th', { scope: 'col', class: c.num ? 'n' : null, text: c.head })),
      el('th', { scope: 'col', class: 'n', text: head[1] }))),
    el('tbody', null, trs));
  const out = [el('div', { class: 'scroll-x' }, table)];
  if (rows.length > lim) {
    const btn = el('button', { class: 'btn-link', type: 'button', 'aria-expanded': 'false', text: `Show all ${rows.length}` });
    btn.addEventListener('click', () => {
      const show = btn.getAttribute('aria-expanded') !== 'true';
      trs.forEach((tr, i) => { if (i >= lim) tr.hidden = !show; });
      btn.setAttribute('aria-expanded', String(show));
      btn.textContent = show ? `Show the top ${lim}` : `Show all ${rows.length}`;
    });
    out.push(btn);
  }
  return out;
}

// ─── bar chart (inline SVG, one series) ─────────────────────────────────────
// points: [{ key, label, value, partial, note }]. Hover, tap or arrow keys
// read a bar; "Show the numbers" is the same data as a table.
function barChart({ name, unit, points, colHead }) {
  const id = 'chart-' + (++uid);
  const n = points.length;
  const live = el('span', { class: 'sr', 'aria-live': 'polite' });
  const tipValue = el('b'), tipLabel = el('span');
  const tip = el('div', { class: 'tip', hidden: true }, tipValue, tipLabel);
  const box = el('div', { class: 'chart', tabindex: '0', role: 'group', 'aria-label': `${name}. Use the left and right arrow keys to read each ${colHead.toLowerCase()}.` }, tip, live);
  let svg = null, geo = null, active = -1, lastW = 0;
  const unitFor = (v) => (v === 1 ? unit[0] : unit[1]);

  function draw(width) {
    const W = Math.max(240, Math.round(width));
    const H = 196, top = 22, bottom = 26, left = 40, right = 6;
    const plotW = W - left - right, plotH = H - top - bottom, baseY = top + plotH;
    const slot = plotW / Math.max(1, n);
    const barW = Math.max(2, Math.min(24, slot - 2));
    const maxV = Math.max(0, ...points.map((p) => p.value));
    const rough = Math.max(1, maxV) / 4;
    const mag = 10 ** Math.floor(Math.log10(rough));
    const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough));
    const topV = Math.max(step, Math.ceil(maxV / step) * step);
    const y = (v) => baseY - (v / topV) * plotH;
    const g = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
    const hatch = id + '-hatch';
    g.append(sv('defs', null, sv('pattern', { id: hatch, patternUnits: 'userSpaceOnUse', width: 5, height: 5, patternTransform: 'rotate(45)' },
      sv('line', { x1: 1, y1: 0, x2: 1, y2: 5, class: 'hatch-line' }))));
    for (let v = 0; v <= topV + 1e-9; v += step) {
      const yy = Math.round(y(v)) + 0.5;
      if (v > 0) g.append(sv('line', { x1: left, x2: W - right, y1: yy, y2: yy, class: 'gridline' }));
      g.append(sv('text', { x: left - 8, y: yy, dy: '0.32em', 'text-anchor': 'end', class: 'tick', text: CF.format(v) }));
    }
    const cursor = sv('rect', { x: 0, y: top - 4, width: slot, height: plotH + 4, class: 'cursor', visibility: 'hidden' });
    g.append(cursor);
    const bars = points.map((p, i) => {
      if (!(p.value > 0)) return null;
      const h = Math.max(2, (p.value / topV) * plotH);
      const x0 = left + i * slot + (slot - barW) / 2, y0 = baseY - h, r = Math.min(4, barW / 2, h);
      const d = `M${x0},${baseY}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${baseY}Z`;
      const bar = sv('path', { d, class: 'bar' + (p.partial ? ' part' : ''), fill: p.partial ? `url(#${hatch})` : null });
      g.append(bar);
      return bar;
    });
    g.append(sv('line', { x1: left, x2: W - right, y1: baseY + 0.5, y2: baseY + 0.5, class: 'baseline' }));
    // Numbers printed on the chart: every bar's where there's room; otherwise
    // the peak (the latest one when tied) and the last bar (the UTC day or
    // month so far). The tooltip and "Show the numbers" carry the rest.
    const xOf = (i) => Math.min(W - right - 12, Math.max(left + 12, left + (i + 0.5) * slot));
    // Mono digits are 0.6em wide: 6.6px for the 11px peak, 6.3px for the 10.5px others.
    const textW = (i, px = 11) => fmt(points[i].value).length * px * 0.6 + 2;
    const valueAt = (i, cls) => sv('text', { x: xOf(i), y: y(points[i].value) - 7, 'text-anchor': 'middle', class: cls, text: fmt(points[i].value) });
    const peakAt = maxV > 0 ? points.map((p) => p.value).lastIndexOf(maxV) : -1;
    if (slot >= Math.max(34, ...points.map((p, i) => textW(i) + 6))) points.forEach((p, i) => g.append(valueAt(i, i === peakAt ? 'peak' : 'val')));
    else {
      if (peakAt >= 0) g.append(valueAt(peakAt, 'peak'));
      const last = n - 1;
      if (last >= 0 && last !== peakAt) {
        // Right-aligned to the chart's end and lifted above every bar it spans,
        // so a narrow last bar's number never prints over a taller neighbour.
        const x1 = left + n * slot, x0 = x1 - textW(last, 10.5);
        let tallest = points[last].value;
        for (let i = 0; i < n; i++) {
          const b0 = left + i * slot + (slot - barW) / 2;
          if (b0 < x1 && b0 + barW > x0) tallest = Math.max(tallest, points[i].value);
        }
        const ly = y(tallest) - 7;
        // Left off only where it would print over the peak's number (the
        // summary line above the chart says it too).
        const px = xOf(peakAt), pw = peakAt >= 0 ? textW(peakAt) : 0;
        const clash = peakAt >= 0 && x0 < px + pw / 2 && x1 > px - pw / 2 && Math.abs(ly - (y(maxV) - 7)) < 13;
        if (!clash) g.append(sv('text', { x: x1, y: ly, 'text-anchor': 'end', class: 'val', text: fmt(points[last].value) }));
      }
    }
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))));
    const leftmost = (n - 1) % every;
    for (let i = n - 1; i >= 0; i -= every) {
      const cx = Math.min(W - right - 22, Math.max(left + 22, left + (i + 0.5) * slot));
      // The leftmost tick carries the year ("Dec 2025"), so a short "Dec" is never ambiguous.
      g.append(sv('text', { x: cx, y: H - 6, 'text-anchor': 'middle', class: 'tick', text: i === leftmost ? points[i].label : (points[i].axis || points[i].label) }));
    }
    g.addEventListener('pointermove', (e) => pointAt(e));
    g.addEventListener('pointerdown', (e) => pointAt(e));
    // Only a mouse leaving clears the reading: on touch, pointerleave comes
    // with every lift, before the tap has even focused the chart.
    g.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && document.activeElement !== box) clear(); });
    if (svg) svg.replaceWith(g); else box.prepend(g);
    svg = g;
    geo = { W, left, slot, y, baseY, cursor, bars };
    if (active >= 0) show(active, false);
  }
  function pointAt(e) {
    if (!geo) return;
    const rect = svg.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - geo.left) / geo.slot);
    if (i >= 0 && i < n) show(i, false); else clear();
  }
  function show(i, announce) {
    if (active >= 0 && geo.bars[active]) geo.bars[active].classList.remove('on');
    active = i;
    const p = points[i];
    geo.cursor.setAttribute('x', String(geo.left + i * geo.slot));
    geo.cursor.setAttribute('visibility', 'visible');
    if (geo.bars[i]) geo.bars[i].classList.add('on');
    tipValue.textContent = `${fmt(p.value)} ${unitFor(p.value)}`;
    tipLabel.textContent = p.note ? `${p.label} · ${p.note}` : p.label;
    tip.hidden = false;
    const cx = geo.left + (i + 0.5) * geo.slot;
    tip.style.left = `${Math.min(geo.W - 74, Math.max(74, cx))}px`;
    tip.style.top = `${Math.max(16, geo.y(p.value))}px`;
    if (announce) live.textContent = `${p.label}${p.note ? ', ' + p.note : ''}: ${fmt(p.value)} ${unitFor(p.value)}`;
  }
  function clear() {
    if (!geo) return;
    if (active >= 0 && geo.bars[active]) geo.bars[active].classList.remove('on');
    active = -1;
    geo.cursor.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  }
  box.addEventListener('keydown', (e) => {
    if (!geo || !n) return;
    let i = active;
    if (e.key === 'ArrowRight') i = i < 0 ? n - 1 : Math.min(n - 1, i + 1);
    else if (e.key === 'ArrowLeft') i = i < 0 ? n - 1 : Math.max(0, i - 1);
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else if (e.key === 'Escape') { clear(); return; }
    else return;
    e.preventDefault();
    show(i, true);
  });
  box.addEventListener('blur', clear);
  // Drawn at the box's real width, and again whenever that width changes.
  const ro = new ResizeObserver((entries) => {
    if (!box.isConnected) { ro.disconnect(); return; }   // replaced by a refresh
    const w = Math.round(entries[0].contentRect.width);
    if (w > 0 && w !== lastW) { lastW = w; draw(w); }
  });
  ro.observe(box);
  return box;
}
function chartTable(points, colHead, valueHead) {
  return el('details', { class: 'data' }, el('summary', { text: 'Show the numbers' }),
    el('div', { class: 'scroll-x' }, el('table', { class: 'tbl' },
      el('thead', null, el('tr', null, el('th', { scope: 'col', text: colHead }), el('th', { scope: 'col', class: 'n', text: valueHead }))),
      el('tbody', null, points.slice().reverse().map((p) => el('tr', null,
        el('td', null, p.label, p.note && el('span', { class: 'code', text: p.note })),
        el('td', { class: 'n', text: fmt(p.value) })))))));
}
function partialLegend(what) {
  return el('p', { class: 'legend' },
    el('span', { class: 'key' }, sv('svg', { viewBox: '0 0 14 10', 'aria-hidden': 'true' }, sv('rect', { width: 14, height: 10, rx: 2, class: 'sw-full' })), `Whole ${what}`),
    el('span', { class: 'key' }, sv('svg', { viewBox: '0 0 14 10', 'aria-hidden': 'true' },
      sv('path', { d: 'M0 7 3 10M0 2 8 10M4 0 14 10M9 0 14 5', class: 'sw-line' })), `Partial ${what}`));
}
// Fill a rolling N-day window with every UTC day in it: a day the server
// didn't return had none (the read itself succeeded). The first day is only
// partly inside the window, and the last is the UTC day still running. That
// isn't the viewer's "today" (in California it began at 5 PM the day before),
// so it's labelled "UTC day so far" and todayText names when it began.
function dailyPoints(rows, days, dayKey, valueKey) {
  const now = Date.now();
  const first = utcDay(now - days * 86400000), today = utcDay(now);
  const byDay = new Map();
  for (const r of rows) {
    const k = String(r?.[dayKey] ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) throw new Shape('a day');
    byDay.set(k, (byDay.get(k) || 0) + num(r[valueKey], 'a count'));
  }
  let from = first, to = today;
  for (const k of byDay.keys()) { if (k < from) from = k; if (k > to) to = k; }
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const partial = d === first || d === today;
    out.push({ key: d, label: dayLabel(d), value: byDay.get(d) || 0, partial, today: d === today, note: d === today ? 'UTC day so far' : partial ? 'partial day' : '' });
    if (out.length > 400) break;
  }
  return out;
}
function chartBlock({ name, unit, points, colHead, valueHead, partialWord }) {
  return [
    barChart({ name, unit, points, colHead }),
    points.some((p) => p.partial) && partialLegend(partialWord || 'day'),
    chartTable(points, colHead, valueHead),
  ];
}
function summary(big, small) {
  return el('p', { class: 'summary' }, el('span', { class: 'big', text: big }), small && el('span', { class: 'small', text: small }));
}
function peakText(points, unit) {
  const max = Math.max(0, ...points.map((p) => p.value));
  if (!max) return `No ${unit[1]} in this window.`;
  const p = points[points.map((q) => q.value).lastIndexOf(max)];
  return `Busiest: ${p.label} (${fmt(max)})`;
}
// " · since Tue 5:00 PM your time (this UTC day): N", from the UTC day still
// running; " · today so far: N" where that is the viewer's own day. Nothing
// when the window doesn't reach it, or when the whole window is empty and
// already says so.
function todayText(points) {
  const p = points.find((q) => q.today);
  if (!p || !points.some((q) => q.value > 0)) return '';
  const since = utcSince(p.key);
  return since ? ` · since ${since} your time (this UTC day): ${fmt(p.value)}` : ` · today so far: ${fmt(p.value)}`;
}

// /admin-user-stats reads profiles (and age-gate records) in one unordered
// select each, and PostgREST returns at most 1,000 rows: past that, everything
// drawn from them comes from an arbitrary subset.
const CAP = 1000;
const usersCapped = (s) => num(s.totalUsers, 'the user count') >= CAP;
const CAP_WARN = 'The server read only 1,000 accounts, in no set order, so these counts come from a subset and read low.';
const CAP_AGE_WARN = 'The server reads at most 1,000 age-gate records, in no set order, so once there are more, these counts come from a subset and read low.';

// Event keys as the founder would say them; the raw key stays beside each.
const EVENT = {
  page_view: 'Screen opened', session_start: 'App visit started', session_end: 'App visit ended',
  search: 'Search', search_zero_results: 'Search, no results',
  home_rows_view: 'Home rows shown', home_row_card_tap: 'Home card tapped', feature_used: 'Home shortcut used',
  directions_tap: 'Directions tapped', ai_details_opened: 'AI details opened',
  passport_stamp: 'Stamp collected', passport_share: 'Passport shared',
  share_landing_view: 'Shared page viewed', share_landing_store: 'Store tap on a shared page',
  guestbook_sign: 'Guestbook signed', dish_post: 'Food photo posted', owner_note: 'Owner message sent', postcard_send: 'Postcard sent',
  wishlist_add: 'Added to wishlist', gear_select: 'Virtual item changed', buddy_add: 'Buddy added',
};
// "PlacesToEat" → "Places To Eat", "ATMFinder" → "ATM Finder".
const words = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
function cuisineName(c) {
  const s = String(c).replace(/[_-]+/g, ' ').trim();
  if (s === 'all') return 'Any cuisine';
  return s ? s[0].toUpperCase() + s.slice(1) : '—';
}

// ─── the dashboard ──────────────────────────────────────────────────────────
const DEF_ACTIVE = (win) => `Distinct people with any app event in the last ${win}, counting back from when this page loaded (not a calendar day). A signed-in person counts once; a signed-out visit counts once per session. The server’s own id also counts once when it logged events (stamps, guestbook posts), so this can read 1 or 2 high.`;
const DEF_COHORT = 'Per device (the app’s install id), so one person on two phones counts twice.';

let built = false;
function build() {
  if (built) return;
  built = true;

  // Overview
  const k = $('overview-kpis');
  const statsTile = (label, def, render) => panel(tile(k, { label, def }), [D.stats], render, { compact: true, soon: soonStats });
  statsTile('Total users', 'Accounts with a profile in the app, counted when this page loaded. Deleted accounts aren’t included. The server reads at most 1,000 profiles, so from there this shows 1,000+.', (s) => {
    const n = num(s.totalUsers, 'the user count');
    return n >= 1000 ? kpi('1,000+', 'the server counts up to 1,000') : kpi(fmt(n), plural(n, 'account', 'accounts'));
  });
  statsTile('Onboarded', 'Accounts that finished the app’s onboarding questions.', (s) => {
    const n = num(s.onboardingCompleted, 'the onboarded count'), t = num(s.totalUsers, 'the user count');
    const p = pctOf(n, t);
    if (p == null) return kpi(fmt(n), 'no accounts yet');
    return t >= 1000 ? kpi(`${fmt(n)}+`, `${p}% of the 1,000 accounts read (in no set order)`) : kpi(fmt(n), `${p}% of accounts`);
  });
  const activeTile = (label, def, render) => panel(tile(k, { label, def }), [D.active], (d) => render(rowsOf(d, 'the active-user counts')[0] || {}), { compact: true });
  // Plain names on the tiles; the app's own terms (DAU, Stickiness, Day 1…)
  // stay in the sub-line or the definition so the two pages can be matched.
  activeTile('Active · 24 hours', DEF_ACTIVE('24 hours'), (r) => kpi(fmt(num(r.dau, 'DAU')), 'DAU · last 24 hours'));
  activeTile('Active · 7 days', DEF_ACTIVE('7 days'), (r) => kpi(fmt(num(r.wau, 'WAU')), 'WAU · last 7 days'));
  activeTile('Active · 30 days', DEF_ACTIVE('30 days'), (r) => kpi(fmt(num(r.mau, 'MAU')), 'MAU · last 30 days'));
  activeTile('Daily habit', 'Of the people active in the last 30 days, the share also active in the last 24 hours (DAU ÷ MAU, the app’s “Stickiness”). Both are rolling windows.', (r) => {
    const dau = num(r.dau, 'DAU'), mau = num(r.mau, 'MAU');
    const p = pctOf(dau, mau);
    return p == null ? kpi('—', 'nobody active in 30 days', true) : kpi(`${p}%`, `${fmt(dau)} of ${fmt(mau)} monthly ${plural(mau, 'user', 'users')}`);
  });
  const cohortTile = (label, def, field) => panel(tile(k, { label, def: `${def} ${DEF_COHORT}` }), [D.cohort], (d) => {
    const r = rowsOf(d, 'the retention cohort')[0] || {};
    const total = num(r.new_users, 'the cohort size');
    if (!total) return kpi('—', 'no new devices in 90 days', true);
    const n = sum(r[field], 'a retention count');
    return kpi(`${pctOf(n, total)}%`, `${fmt(n)} of ${fmt(total)} ${plural(total, 'device', 'devices')}`);
  }, { compact: true });
  // "Came back (ever)" is the app's own label for this field. It is not the
  // app's "Return rate (7d)" tile, which reads 0% whatever happens.
  cohortTile('Came back (ever)', 'Of the devices first seen in the last 90 days, the share that opened the app again more than 24 hours after their first visit (the app’s “Came back (ever)”). Devices first seen in the last 24 hours can’t have come back yet but still count, so this reads a little low. This is not the app’s “Return rate (7d)”: that server query is broken and always shows 0%.', 'ever_returned');
  cohortTile('Back next day', 'Of the devices first seen in the last 90 days, the share that came back 24 to 48 hours after their first visit (the app’s “Day 1”). Devices first seen in the last 2 days may not have had the chance yet but still count, so this reads a little low.', 'd1');
  cohortTile('Back on day 7', 'Of the devices first seen in the last 90 days, the share that came back on day 7 exactly, 7 to 8 days after their first visit (the app’s “Week 1 (D7)”). Devices first seen in the last 8 days still count, so this reads low.', 'd7');
  cohortTile('Back after 30+ days', 'Of the devices first seen in the last 90 days, the share that came back 30 or more days after their first visit (the app’s “Day 30+”). Devices first seen in the last 30 days still count, so this reads low.', 'd30_plus');
  const totalsTile = (label, def, field, what, sub) => panel(tile(k, { label, def }), [D.totals], (d) => {
    const r = rowsOf(d, 'the 7-day totals')[0] || {};
    return kpi(fmt(num(r[field], what)), sub);
  }, { compact: true });
  totalsTile('App visits · 7 days', 'Distinct app sessions with any event in the last 7 days, rolling (the app’s “Sessions (7d)”). Signed-out sessions count, and so does the server’s own id.', 'unique_sessions', 'the session count', 'sessions, last 7 days');
  totalsTile('Actions logged · 7 days', 'Every event the app and the server logged in the last 7 days, rolling (the app’s “Events (7d)”): screens opened, taps, searches, stamps.', 'total_events', 'the event count', 'events, last 7 days');

  // Trends
  const t = $('trends-grid');
  const signups = card(t, { title: 'Sign-ups per day', meta: 'Last 30 days · UTC days', def: 'New accounts, by the UTC day they were created. Deleted accounts drop out.', chart: true });
  panel(signups.body, [D.stats], (s) => {
    const capped = usersCapped(s);
    const points = dailyPoints(listOf(s.signupsByDay, 'sign-ups per day'), 30, 'day', 'count');
    const total = points.reduce((a, p) => a + p.value, 0);
    const rest = `${peakText(points, ['sign-up', 'sign-ups'])}${todayText(points)}`;
    return [capped
      ? summary(`${fmt(total)}+`, `${plural(total, 'sign-up', 'sign-ups')} at least, from 1,000 of the accounts · ${rest}`)
      : summary(fmt(total), `${plural(total, 'sign-up', 'sign-ups')} · ${rest}`),
    chartBlock({ name: 'Sign-ups per day, last 30 days', unit: ['sign-up', 'sign-ups'], points, colHead: 'Day (UTC)', valueHead: 'Sign-ups' }),
    capped && warn(CAP_WARN)];
  }, { soon: soonStats });
  const actives = card(t, { title: 'Active users per day', meta: 'Last 30 days · UTC days', def: 'Distinct people with any app event on each UTC day: signed-in people once, signed-out visits once per session, plus the server’s own id on days it logged events.', chart: true });
  panel(actives.body, [D.activeDays], (d) => {
    const points = dailyPoints(rowsOf(d, 'active users per day'), 30, 'day', 'active');
    const whole = points.filter((p) => !p.partial);
    const avg = whole.length ? Math.round(whole.reduce((a, p) => a + p.value, 0) / whole.length) : 0;
    return [summary(fmt(avg), `a day on average (whole days) · ${peakText(points, ['active user', 'active users'])}${todayText(points)}`),
      chartBlock({ name: 'Active users per day, last 30 days', unit: ['active user', 'active users'], points, colHead: 'Day (UTC)', valueHead: 'Active users' })];
  });
  const events = card(t, { title: 'Events per day', meta: 'Last 14 days · UTC days', def: 'Every event the app and the server logged, by UTC day.', chart: true });
  panel(events.body, [D.eventDays], (d) => {
    const points = dailyPoints(rowsOf(d, 'events per day'), 14, 'day', 'count');
    const total = points.reduce((a, p) => a + p.value, 0);
    return [summary(fmt(total), `${plural(total, 'event', 'events')} · ${peakText(points, ['event', 'events'])}${todayText(points)}`),
      chartBlock({ name: 'Events per day, last 14 days', unit: ['event', 'events'], points, colHead: 'Day (UTC)', valueHead: 'Events' })];
  });

  // Members
  const m = card($('members-grid'), { title: 'The 50 newest', meta: 'Joined times in your time zone' });
  panel(m.body, [D.members], (d) => {
    const list = listOf(d.members, 'the member list');
    if (!list.length) return emptyState('No members yet.');
    const lim = 15;
    const trs = list.map((x, i) => el('tr', { hidden: i >= lim },
      el('td', { class: 'num', 'data-label': 'Member', text: x.n != null ? `#${x.n}` : '—' }),
      el('td', { class: !x.name || x.name === 'No name yet' ? 'muted' : 'name', 'data-label': 'Name', text: x.name || 'No name yet' }),
      el('td', { 'data-label': 'Handle', text: x.handle ? '@' + String(x.handle).replace(/^@/, '') : '—' }),
      el('td', { 'data-label': 'Sign-in', text: providerName(x.provider) }),
      el('td', { 'data-label': 'Country' }, x.country ? named(x.country, 'region') : '—'),
      el('td', { class: 'num', 'data-label': 'Joined', text: localStamp(x.joined) })));
    const out = [];
    if (d.numbered === false) out.push(warn('Member numbers aren’t available right now. Refresh to try again.'));
    out.push(el('div', { class: 'scroll-x' }, el('table', { class: 'tbl members' },
      el('caption', { class: 'sr', text: 'Newest members, newest first' }),
      el('thead', null, el('tr', null, ['Member', 'Name', 'Handle', 'Sign-in', 'Country', 'Joined'].map((h) => el('th', { scope: 'col', text: h })))),
      el('tbody', null, trs))));
    if (list.length > lim) {
      const btn = el('button', { class: 'btn-link', type: 'button', 'aria-expanded': 'false', text: `Show all ${list.length}` });
      btn.addEventListener('click', () => {
        const showAll = btn.getAttribute('aria-expanded') !== 'true';
        trs.forEach((tr, i) => { if (i >= lim) tr.hidden = !showAll; });
        btn.setAttribute('aria-expanded', String(showAll));
        btn.textContent = showAll ? `Show the newest ${lim}` : `Show all ${list.length}`;
      });
      out.push(btn);
    }
    return out;
  }, { soon: soonMembers });

  // Users
  const u = $('users-grid');
  const countries = card(u, { title: 'Home countries', meta: 'Top 15 · people', def: 'The home country people entered in the app. It can be skipped.' });
  panel(countries.body, [D.stats], (s) => [
    rankTable({ caption: 'Home countries', head: ['Country', 'People'], rows: listOf(s.byCountry, 'home countries'), label: (r) => named(r.label, 'region'), value: (r) => r.count, limit: 15, empty: 'Nobody has set a home country yet.' }),
    usersCapped(s) && warn(CAP_WARN)], { soon: soonStats });
  const langs = card(u, { title: 'Languages', meta: 'Top 15 · people', def: 'The app language on each profile. Onboarding doesn’t ask: it copies the phone’s language, or English when the app doesn’t support it. People can change it in Settings.' });
  panel(langs.body, [D.stats], (s) => [
    rankTable({ caption: 'Languages', head: ['Language', 'People'], rows: listOf(s.byLanguage, 'languages'), label: (r) => named(r.label, 'language'), value: (r) => r.count, limit: 15, empty: 'No profile has a language yet.' }),
    usersCapped(s) && warn(CAP_WARN)], { soon: soonStats });
  const ages = card(u, { title: 'Age mix', meta: 'From the age gate', def: 'From the birth year entered at the age gate, including people it blocked (under 13, or under 16 in Australia). Age here is this year minus the birth year, so some people show a year older than they are. If the server can’t read birth years it sends an empty list without saying so.' });
  panel(ages.body, [D.stats], (s) => {
    const known = num(s.ageKnown, 'the age-gate count');
    const mix = listOf(s.ageMix, 'the age mix');
    // The server counts every valid birth year but has no bar below 13: that
    // gap is the people the gate blocked for being under 13.
    const inBars = mix.reduce((a, r) => a + num(r.count, 'a count'), 0);
    const rows = known > inBars ? [{ label: 'Under 13 (blocked)', count: known - inBars }, ...mix] : mix;
    ages.setMeta(known >= CAP ? '1,000+ gave a birth year' : known ? `${fmt(known)} gave a birth year` : 'No birth years came back');
    return [rankTable({ caption: 'Age mix', head: ['Age', 'People'], rows, label: (r) => String(r.label), value: (r) => r.count, empty: 'No birth years yet, or the server couldn’t read them (it doesn’t say which).' }),
      (known >= CAP || usersCapped(s)) && warn(CAP_AGE_WARN)];
  }, { soon: soonStats, onFail: () => ages.resetMeta() });

  // Searches
  const s = $('searches-grid');
  const top = card(s, { title: 'Top searches', meta: 'Last 7 days · top 20', def: 'Searches run in the last 7 days, by search text, with the average results each returned. A search logs again whenever its results reload (for example after a filter change), so this counts searches run, not people.' });
  panel(top.body, [D.searches], (d) => rankTable({ caption: 'Top searches, last 7 days', head: ['Search', 'Searches'], rows: rowsOf(d, 'top searches'),
    label: (r) => String(r.query ?? '(no text)'), value: (r) => r.hits,
    extra: [{ head: 'Results (avg)', num: true, cell: (r) => (r.avg_results == null ? '—' : fmt(Math.round(num(r.avg_results, 'an average')))) }],
    empty: 'No text searches in the last 7 days.' }));
  const zero = card(s, { title: 'Searches with no results', meta: 'Last 30 days · top 20', def: 'Searches that came back empty. On Places to eat this also counts searches whose load failed (a timeout or server error) and filter-only browses with no text, so not every row is a coverage gap.' });
  panel(zero.body, [D.zero], (d) => rankTable({ caption: 'Searches with no results, last 30 days', head: ['Search', 'Searches'], rows: rowsOf(d, 'zero-result searches'),
    label: (r) => String(r.query ?? '(no text)'), value: (r) => r.hits,
    extra: [{ head: 'Filter', cell: (r) => (r.cuisine ? cuisineName(r.cuisine) : '—') }],
    empty: 'No searches came back empty in the last 30 days.' }));

  // Screens & events
  const sc = $('screens-grid');
  // These three log a page view of their own on top of the app frame's.
  const TWICE = new Set(['PlacesToEat', 'CoffeeFinder', 'ThingsToDo']);
  const pages = card(sc, { title: 'Screens opened', meta: 'Last 7 days · page views', def: 'Page-view events per screen. Places to eat, Coffee finder and Things to do log two per open (the app frame and the screen each log one), so they read about double. They’re marked ×2.' });
  panel(pages.body, [D.pages], (d) => rankTable({ caption: 'Screens opened, last 7 days', head: ['Screen', 'Views'], rows: rowsOf(d, 'page views'),
    label: (r) => (!r.page ? '(unknown)' : TWICE.has(r.page) ? [words(r.page), el('span', { class: 'code', text: '×2 per open' })] : words(r.page)),
    value: (r) => r.views, empty: 'No screens opened in the last 7 days.' }));
  const types = card(sc, { title: 'Event types', meta: 'Last 7 days · events', def: 'Every kind of event the app and the server logged, with its name in the event log beside it.' });
  panel(types.body, [D.eventTypes], (d) => rankTable({ caption: 'Event types, last 7 days', head: ['Event', 'Count'], rows: rowsOf(d, 'event types'),
    label: (r) => (own(EVENT, r.event_type) ? [own(EVENT, r.event_type), el('span', { class: 'code', text: String(r.event_type) })] : String(r.event_type || '(unknown)')),
    value: (r) => r.count, empty: 'No events in the last 7 days.' }));

  // Passport
  const pk = $('passport-kpis');
  // Exact table counts, but not "every row ever": stamps leave with a deleted
  // account, a new dish photo replaces the old row, and the guestbook keeps
  // deleted and hidden notes. Each definition says which.
  const allTime = (label, def, field) => panel(tile(pk, { label, def: `${def} Counted exactly when this page loaded.` }), [D.overview], (o) => {
    const v = o?.allTime?.[field];
    if (v === null) return kpi('—', 'the server couldn’t count these', true);
    return kpi(fmt(num(v, 'an all-time count')), 'all time');
  }, { compact: true });
  allTime('Stamps', 'Passport stamps that exist now. Deleting an account removes its stamps, and so does an under-age freeze at the age gate once its waiting period ends, so this can go down.', 'stamps');
  allTime('Guestbook', 'Every guestbook note and doodle written, including ones later deleted, hidden by reports, or held or kept private by review. Notes from deleted accounts stay, anonymized.', 'guestbook');
  allTime('Food photos', 'Dish, café and store-find photo posts on places now: one per traveler per dish per place (a new photo replaces the old one). Deleted posts are gone.', 'dish_photos');
  allTime('Owner messages', 'Private messages travelers sent to a place’s owner. They’re never published. Messages held for review are included.', 'owner_messages');
  const pg = $('passport-grid');
  const perMonth = card(pg, { title: 'Stamps per month', meta: 'Last 12 months · UTC months', def: 'Stamps that exist now, by the UTC month each was collected in.', chart: true });
  panel(perMonth.body, [D.monthly], (pm) => {
    const months = listOf(pm.months, 'stamps per month');
    const since = String(pm.since || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(since)) throw new Shape('the window start');
    const by = new Map(months.map((x) => [String(x.month), num(x.stamps, 'a monthly count')]));
    const now = new Date().toISOString().slice(0, 7);
    const points = [];
    for (let mo = since; mo <= now && points.length < 24; mo = addMonths(mo, 1)) {
      // The axis says "Oct", or "Jan 2027" where a year begins; the tooltip and table say "Oct 2026".
      points.push({ key: mo, label: monthLabel(mo), axis: mo.endsWith('-01') ? monthLabel(mo) : monthLabel(mo).replace(/\s*\d{4}\s*$/, ''), value: by.get(mo) || 0, partial: mo === now, note: mo === now ? 'UTC month so far' : '' });
    }
    const total = num(pm.total, 'the 12-month total');
    // In California the UTC month began at 5 PM on the last day of the month before.
    const began = utcSince(now);
    const soFar = began ? `since ${began} your time (this UTC month)` : 'this month so far';
    return [summary(fmt(total) + (total >= 50000 ? '+' : ''), `${plural(total, 'stamp', 'stamps')} in 12 months · ${soFar}: ${fmt(points.length ? points[points.length - 1].value : 0)}`),
      chartBlock({ name: 'Stamps per month, last 12 months', unit: ['stamp', 'stamps'], points, colHead: 'Month (UTC)', valueHead: 'Stamps', partialWord: 'month' }),
      total >= 50000 && warn('The server stops counting at 50,000 stamps, so these months are a floor.')];
  });
  const kinds = card(pg, { title: 'Stamps by kind', meta: 'Last 12 months', def: 'The same stamps, split by what was stamped.' });
  panel(kinds.body, [D.monthly], (pm) => {
    const tally = new Map();
    for (const x of listOf(pm.months, 'stamps per month')) {
      for (const [kind, n] of Object.entries(x.by_kind || {})) tally.set(kind, (tally.get(kind) || 0) + num(n, 'a count by kind'));
    }
    const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([kind, n]) => ({ kind, n }));
    const KIND = { attraction: 'Attractions', city: 'Cities', airport: 'Airports', country: 'Countries', icon: 'Icons', wonder: 'Wonders' };
    return rankTable({ caption: 'Stamps by kind, last 12 months', head: ['Kind', 'Stamps'], rows, label: (r) => own(KIND, r.kind) || String(r.kind), value: (r) => r.n, empty: 'No stamps in the last 12 months.' });
  });
  const places = card(pg, { title: 'Most-stamped places', meta: 'Last 12 months · top 10', def: 'Cities and places exclude airport and country stamps; countries count every stamp.', wide: true });
  panel(places.body, [D.overview], (o) => {
    const col = (title, head, list, labelOf) => el('div', null,
      rankTable({ caption: `Most-stamped ${title.toLowerCase()}, last 12 months`, head: [head, 'Stamps'], rows: listOf(list, 'a top list').slice(0, 10), label: labelOf, value: (r) => r.n, limit: 10, empty: `No ${title.toLowerCase()} stamped yet.` }));
    const out = [el('div', { class: 'cols cols-3' },
      col('Cities', 'City', o.topCities, (r) => String(r.name)),
      col('Places', 'Place', o.topPlaces, (r) => String(r.name)),
      col('Countries', 'Country', o.topCountries, (r) => named(r.name, 'region')))];
    if (o.truncated) out.push(warn('The server stopped at 40,000 rows per table, so these lists are a floor.'));
    if (o.failed) out.push(warn('The server couldn’t read every page of stamps, so these lists are incomplete.'));
    // This route doesn't report a failed page read. Stamps per month reads the
    // same 12 months and does report one, so compare the two counts.
    const read = Array.isArray(o.month) ? o.month.reduce((a, row) => a + Object.entries(row || {}).reduce((b, [key, v]) => b + (key.startsWith('stamps_') ? Number(v) || 0 : 0), 0), 0) : null;
    const mine = gen;
    get(D.monthly).then((r) => {
      const want = Number(r?.data?.total);
      if (mine !== gen || !r?.ok || o.truncated || read == null || !Number.isFinite(want)) return;
      if (read + 2 < want * 0.98) places.body.append(warn(`These lists may be missing stamps: the server read ${fmt(read)} stamps for them but ${fmt(want)} for Stamps per month.`));
    }).catch(() => { /* Stamps per month shows its own error */ });
    return out;
  });

  // Virtual items
  const ik = $('items-kpis');
  // The server stops reading saved items at the first failed page and still
  // answers with zeros. No saved items while the event log holds picks means
  // that read failed, so the tiles show no number rather than a false 0.
  const gearUnread = (g) => num(g.current?.travelers, 'the traveler count') === 0
    && [g.events?.itemsByDay, g.events?.buddiesByDay].some((a) => Array.isArray(a) && a.length);
  const itemTile = (label, def, render) => panel(tile(ik, { label, def }), [D.gear], (g) => {
    if (gearUnread(g)) return kpi('—', 'not confirmed: picks are logged but no saved items came back', true);
    return render(g.current || {});
  }, { compact: true });
  itemTile('Saved a setup', 'Travelers with a saved virtual-items record: anyone who saved an item, a buddy or just the shelf order. Someone who later removed every buddy still counts.', (c) => {
    const n = num(c.travelers, 'the traveler count');
    return kpi(fmt(n), `${plural(n, 'traveler', 'travelers')} in all`);
  });
  itemTile('Laptops', 'Travelers who customized their laptop (color or stickers). Everyone else’s profile shows the default blue laptop, which isn’t counted.', (c) => kpi(fmt(num(c.laptop?.n, 'the laptop count')), 'customized'));
  itemTile('Drink containers', 'Travelers who customized their drink (which one, its color or stickers). Everyone else’s profile shows the default blue tumbler, which isn’t counted.', (c) => kpi(fmt(num(c.drink?.n, 'the drink count')), 'customized'));
  itemTile('Travel buddies', 'Pets and buddies on profiles right now, and how many travelers have one.', (c) => {
    const n = num(c.buddies?.n, 'the buddy count'), who = num(c.buddies?.travelers, 'the buddy traveler count');
    return kpi(fmt(n), `with ${fmt(who)} ${plural(who, 'traveler', 'travelers')}`);
  });
  const ig = $('items-grid');
  const chosen = card(ig, { title: 'What they chose', meta: 'On profiles now', def: 'Saved items on profiles right now, by type, color and species. Default laptops and tumblers nobody customized aren’t counted.' });
  panel(chosen.body, [D.gear], (g) => {
    // Empty lists here would be the same false zero as the tiles.
    if (gearUnread(g)) return warn('No travelers with items, yet the app has logged item picks: the server may have failed to read saved items (it doesn’t report that).');
    const c = g.current || {};
    const list = (title, obj, labelOf) => el('div', null,
      rankTable({ caption: title, head: [title, 'Count'], rows: Object.entries(obj || {}).map(([key, n]) => ({ key, n: num(n, 'a count') })).sort((a, b) => b.n - a.n), label: (r) => labelOf(r.key), value: (r) => r.n, limit: 6, empty: `${title}: none yet.` }));
    return el('div', { class: 'cols cols-2' },
      list('Drinks', c.drink?.variants, gearName),
      list('Laptop colors', c.laptop?.colors, String),
      list('Drink colors', c.drink?.colors, String),
      list('Buddy species', c.buddies?.species, String));
  });
  const picks = card(ig, { title: 'Picks per month', meta: 'Last 5 months · UTC months', def: 'Every saved change to a laptop or drink (choosing it, its color, its stickers) and every buddy added, from the event log (kept about 180 days). One traveler can log many. Virtual items launched Oct 5, 2026, so earlier months are empty.' });
  panel(picks.body, [D.gear], (g) => {
    if (g.events == null) return emptyState('Pick history isn’t available: the server has no event log connected.');
    const items = listOf(g.events.itemsByMonth, 'item picks per month');
    const buds = listOf(g.events.buddiesByMonth, 'buddies per month');
    if (!items.length && !buds.length) return emptyState('No picks logged yet.');
    const now = new Date().toISOString().slice(0, 7);
    // Five months stay inside the log's 180 days even at a month's end.
    const months = Array.from({ length: 5 }, (_, i) => addMonths(now, i - 4));
    const grid = new Map();
    const put = (row, mo, n) => { if (!grid.has(row)) grid.set(row, new Map()); grid.get(row).set(mo, (grid.get(row).get(mo) || 0) + num(n, 'a pick count')); };
    for (const r of items) put(gearName(r.item), String(r.k), r.n);
    for (const r of buds) put('Buddies added', String(r.k), r.n);
    const rows = [...grid.keys()].sort((a, b) => (a === 'Buddies added') - (b === 'Buddies added') || a.localeCompare(b));
    // The starred month is the UTC month still running (see Stamps per month).
    const began = utcSince(now);
    return el('div', { class: 'scroll-x' }, el('table', { class: 'tbl tbl-matrix' },
      el('caption', { class: 'sr', text: 'Picks per month, last 5 UTC months' }),
      el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Item' }), months.map((mo) => el('th', { scope: 'col', class: 'n', text: monthLabel(mo).replace(/ \d{4}$/, '') + (mo === now ? '*' : '') })))),
      el('tbody', null, rows.map((row) => el('tr', null, el('th', { scope: 'row', text: row }), months.map((mo) => el('td', { class: 'n', text: fmt(grid.get(row).get(mo) || 0) }))))),
    ), el('p', { class: 'legend', text: began ? `* UTC month so far (since ${began} your time)` : '* this month so far' }));
  });

  // Messages
  const msg = card($('messages-grid'), { title: 'Open messages', meta: 'Times in your time zone' });
  panel(msg.body, [D.contact], (d) => {
    const list = listOf(d.messages, 'the message list');
    const open = num(d.open, 'the open count'), total = num(d.total, 'the message total');
    msg.setMeta(`${fmt(open)} open · ${fmt(total)} in all · times in your time zone`);
    setMessageCount(open);
    if (!list.length) return emptyState(total ? 'No open messages. Every message has been handled.' : 'No messages yet. The website’s contact form and the app’s Contact us both land here.');
    // The app's Settings → Contact us posts to the same inbox as the website.
    const from = (page) => (page === 'app:contact-us' ? 'the app (Settings → Contact us)' : String(page).startsWith('/') ? CFG.apex + page : String(page));
    return [el('ul', { class: 'msgs' }, list.map((x) => el('li', { class: 'msg' },
      el('div', { class: 'msg-head' },
        el('span', { class: 'name', text: x.name || '(no name)' }),
        x.who && el('span', { class: 'tag', text: x.who }),
        mailLink(x.email),
        x.company && el('span', { class: 'co', text: x.company }),
        el('span', { class: 'when', text: localStamp(x.created_at) })),
      el('p', { class: 'msg-body', text: x.message || '' }),
      x.page && el('p', { class: 'msg-page', text: `Sent from ${from(x.page)}` })))),
    // The server sends the newest 50 by default; the count covers them all.
    open > list.length && warn(`Showing the newest ${fmt(list.length)} of ${fmt(open)} open messages.`)];
  }, { onFail: () => { setMessageCount(null); msg.resetMeta(); } });
}
function mailLink(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (!/^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]{2,}$/.test(s)) return el('span', { text: s });
  return el('a', { href: 'mailto:' + encodeURIComponent(s).replace(/%40/g, '@'), text: s });
}
function setMessageCount(n) {
  const a = $('jump-messages');
  a.querySelector('.count')?.remove();
  a.removeAttribute('aria-label');
  if (n > 0) {
    a.append(el('span', { class: 'count', 'aria-hidden': 'true', text: fmt(n) }));
    a.setAttribute('aria-label', `Messages, ${fmt(n)} open`);
  }
}

// ─── views ──────────────────────────────────────────────────────────────────
function view(name) {
  for (const id of ['boot', 'signin', 'denied', 'app']) $(id).hidden = id !== name;
  // The skip link leads into the dashboard, so it's a Tab stop only there.
  $('skip').hidden = name !== 'app';
  closeTips(null);
  // Focus left behind in a view that just closed moves to the new view's heading.
  const at = document.activeElement;
  if (name !== 'boot' && (!at || at === document.body || at.closest('[hidden]'))) $(name).querySelector('h1')?.focus({ preventScroll: true });
}
function bootText(t) { $('boot-text').textContent = t; view('boot'); }
function signInView(message, ok) {
  const box = $('signin-msg');
  box.textContent = message || '';
  box.hidden = !message;
  box.classList.toggle('ok', !!ok);
  view('signin');
  wipe();
}
function authEnded(message) {
  session.clear();
  signInView(message || 'Your sign-in has ended. Please sign in again.');
}
// Nothing an admin saw stays in the page once they've signed out.
function wipe() {
  gen += 1;
  for (const p of panels) {
    p.slot.replaceChildren();
    const host = hostOf(p);
    host.classList.remove('busy');
    host.removeAttribute('aria-busy');
  }
  for (const m of document.querySelectorAll('.card .meta[data-initial]')) m.textContent = m.dataset.initial;
  cache.clear();
  explained.clear();
  loadedAt = null;
  if (built) setMessageCount(null);
  $('who-email').textContent = '';
}

let running = false;
let loadedAt = null;   // when the numbers on the page were requested (ISO); null until a full load finishes
// "Loaded <time>", and how many panels show an error right now. Written only
// once every panel has drawn, so it never vouches for numbers still on the way.
function stampLoaded() {
  if (!loadedAt || $('app').hidden) return;
  const failed = panels.filter((p) => p.slot.querySelector('.state-error, .kpi-err')).length;
  $('loaded').textContent = `Loaded ${localStamp(loadedAt)}` + (failed ? ` · ${failed} ${plural(failed, 'panel', 'panels')} couldn’t load` : '');
}
async function refreshAll() {
  if (running || !session.cur) return;
  running = true;
  const btn = $('refresh');
  const first = !loadedAt;
  // aria-disabled, not disabled: disabling the focused button drops focus to
  // <body>. `running` already ignores a second press.
  btn.setAttribute('aria-disabled', 'true');
  $('refresh-ic').classList.add('spin');
  $('refresh-label').textContent = first ? 'Loading' : 'Refreshing';
  $('loaded').textContent = first ? 'Loading…' : `Refreshing… (numbers below are from ${localStamp(loadedAt)})`;
  try {
    cache.clear();
    explained.clear();
    // The gate: one call first, so a non-admin never sees the dashboard.
    const mine = gen;
    const at = new Date().toISOString();
    const gate = await get(D.active);
    if (mine !== gen || !session.cur) return;   // signed out while waiting
    if (!gate.ok && gate.kind === 'denied') { deniedView(gate); return; }
    if (!gate.ok && gate.kind === 'unverified') {
      signInView(`The server couldn’t confirm your sign-in${gate.message ? ` (it said: “${gate.message}”)` : ''}. Reload the page to try again, or sign in again.`);
      return;
    }
    if ($('app').hidden) { build(); view('app'); }
    $('who-email').textContent = session.cur.email || 'Signed in';
    $('tz').textContent = zoneLabel();
    $('utc-note').textContent = utcNote();
    await Promise.all(panels.map(runPanel));
    if (mine !== gen) return;
    loadedAt = at;
    stampLoaded();
  } catch (e) {
    if (e instanceof AuthEnded) authEnded(e.message);
    else { $('loaded').textContent = 'Couldn’t load.'; console.error(e); }
  } finally {
    running = false;
    btn.removeAttribute('aria-disabled');
    $('refresh-ic').classList.remove('spin');
    $('refresh-label').textContent = 'Refresh';
  }
}
function deniedView(r) {
  $('denied-email').textContent = session.cur?.email || 'this account';
  const detail = $('denied-detail');
  detail.textContent = r?.message ? `The server answered: “${r.message}”.` : '';
  detail.hidden = !r?.message;
  wipe();
  view('denied');
}

async function signOut() {
  const cur = session.cur;
  session.clear(true);   // Sign out leaves no stored session on this computer, whichever tab kept it
  signInView('You’re signed out.', true);
  if (!cur) return;
  // End this browser's session on the server too (scope=local: the app on
  // your phone stays signed in).
  let token = cur.access_token;
  if (cur.expires_at - Date.now() / 1000 < 30) {
    const r = await authPost('token?grant_type=refresh_token', { refresh_token: cur.refresh_token });
    if (r.ok && r.data?.access_token) token = r.data.access_token;
  }
  await authPost('logout?scope=local', null, token);
}

// ─── Google (OAuth with PKCE) ───────────────────────────────────────────────
function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function startGoogle() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  if (!writeJSON(store('local'), KEY_PKCE, { verifier, remember: $('remember').checked, at: Date.now() })) {
    signInView('This browser is blocking site storage, which Google sign-in needs. Use your email and password, or allow storage for this site.');
    return;
  }
  const u = new URL(CFG.supabaseUrl + '/auth/v1/authorize');
  u.searchParams.set('provider', 'google');
  u.searchParams.set('redirect_to', location.origin + '/admin/');
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 's256');
  u.searchParams.set('prompt', 'select_account');
  location.assign(u.toString());
}
// Back from Google: ?code=… (or ?error=…). The code is single-use; it leaves
// the address bar at once.
async function finishRedirect(params) {
  history.replaceState(null, '', location.pathname);
  const pending = readJSON(store('local'), KEY_PKCE);
  drop(store('local'), KEY_PKCE);
  // Never show text from the address bar: anyone can put a sentence there (a
  // fake "account locked" notice) and this card is where the admin trusts what
  // it says. A known error code gets our own words; anything else a generic line.
  const error = params.get('error');
  if (error) {
    const KNOWN = { access_denied: 'Google sign-in was cancelled.', server_error: 'Google sign-in failed. Please try again.', temporarily_unavailable: 'Google sign-in is busy. Try again in a minute.' };
    signInView(own(KNOWN, error) || 'Google sign-in didn’t finish. Please try again.');
    return false;
  }
  if (!pending?.verifier || Date.now() - Number(pending.at || 0) > 15 * 60 * 1000) {
    signInView('That sign-in took too long or started in another browser. Please try again.');
    return false;
  }
  bootText('Finishing sign-in…');
  const r = await authPost('token?grant_type=pkce', { auth_code: params.get('code'), code_verifier: pending.verifier });
  if (!r.ok) { signInView(r.message); return false; }
  try { session.save(r.data, !!pending.remember, true); } catch (e) { signInView(e.message); return false; }
  return true;
}

// ─── start ──────────────────────────────────────────────────────────────────
async function start() {
  $('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim(), password = $('password').value;
    if (!email || !password) { signInView('Enter your email and password.'); return; }
    const submit = $('signin-submit');
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    const r = await authPost('token?grant_type=password', { email, password });
    submit.disabled = false;
    submit.textContent = 'Sign in';
    if (!r.ok) { signInView(r.message); $('password').focus(); return; }
    $('password').value = '';
    try { session.save(r.data, $('remember').checked, true); } catch (err) { signInView(err.message); return; }
    bootText('Checking your access…');
    refreshAll();
  });
  $('google').addEventListener('click', () => { startGoogle().catch((e) => signInView(`Couldn’t start Google sign-in: ${e?.message || e}`)); });
  $('refresh').addEventListener('click', () => refreshAll());
  $('signout').addEventListener('click', () => { signOut(); });
  $('denied-signout').addEventListener('click', () => { signOut(); });
  // Another tab signed out, signed in without "Keep me signed in" (which
  // removes the stored session), or refreshed the session: follow it.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY_SESSION || !session.cur?.remember) return;
    if (!e.newValue) { if (session.cur) authEnded('Another tab ended this sign-in. Please sign in again.'); return; }
    const s = readJSON(store('local'), KEY_SESSION);
    if (session.valid(s)) session.cur = { ...s, remember: true };
  });

  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.has('code') || params.has('error') || hash.has('error')) {
    const done = await finishRedirect(params.has('code') || params.has('error') ? params : hash);
    if (!done) return;
  } else if (!session.load()) {
    signInView('');
    return;
  }
  bootText('Checking your access…');
  refreshAll();
}

// Last, once everything above is defined. One origin for the stored session
// and for Google's redirect back: www → apex.
if (location.hostname === 'www.' + CFG.apex) {
  location.replace('https://' + CFG.apex + location.pathname + location.search + location.hash);
} else {
  start();
}
