// CircleOrbit: a circle drawn as orbits (bible.profile.circle, .circle_screen, .visiting).
// The owner sits at the centre, ringed 2px in their cloth; three hairline rings in the ring
// cloth carry faces, each ringed in that person's own cloth:
//   inner ring    the inner circle (you follow each other)
//   middle ring   people the owner follows who don't follow back
//   outer ring    people who follow the owner, not back; pending requests as dashed faces
// The rings are disjoint, the totals inclusive (the legend's figures): 12 inner, 18 you
// follow and 23 follow you print 4 inner faces and '+8', then the rest of 18-12 and 23-12.
//
//   <CircleOrbit size mode ringCloth owner groups totals onFace faceLabel ariaLabel labels
//                caps className style />
//   size       168 (the profile and visit folders, Profile.dc.html L86-105, Profile-Visit
//              L95-118) or 240 (the Circle screen, Circle.dc.html L54-131).
//   mode       'own' (default at 168), 'visit' (someone else's: only the faces you both know,
//              yours tagged 'YOU', no requests) or 'screen' (default at 240: the ring names
//              printed along the bottom of the rings).
//   ringCloth  the cloth the rings are drawn in: the owner's (Harbour by default).
//   owner      { name, handle, avatar, cloth }: the centre face.
//   groups     { inner, following, followers, requests }: the people on each ring, as the
//              lists send them ({ user_id, handle, name, avatar?, cloth?, since?, latest? };
//              is_me marks your own face on a visit). useCircle's mutual, followingOnly,
//              followersOnly and requests fit as they are; groupsFromKnown() sorts B3's
//              circle.known rows by their ring.
//   totals     { inner, following, followers } (or youFollow / followYou), inclusive, as the
//              legend prints them. The '+N' pills count what the faces don't show. Without
//              totals each ring holds just its group.
//   onFace     makes each face a 44px button (role=group with labelled faces); without it
//              the orbit is one role=img named by its summary. faceLabel(person) names a face
//              button (default: the person's name, else '@handle').
//   ariaLabel  replaces the summary ('Your circle drawn as orbits: 12 in your inner circle,
//              18 you follow, 23 follow you, and one request waiting').
//   labels     the three ring names for the 240 screen orbit (default 'INNER CIRCLE',
//              'YOU FOLLOW', 'FOLLOW YOU'); false prints none. Decorative, a fixed 9px.
//   caps       faces per ring, [inner, middle, outer]: 4/3/3 at 168, 6/8/10 at 240.
//
// Placement (orbitLayout, exported for tests): faces go clockwise from 12 o'clock, most recent
// stamp first when the list sends one (B7), else the most recent follow, then requests, and
// the ring's '+N' pill takes the last slot. The inner and outer rings are spaced evenly from
// 12 o'clock (never touching each other); the middle ring sits between them and is turned
// into their gaps. At 240 the faces keep clear of the ring names at the bottom. A ring that
// can't hold its cap without two faces touching shows fewer faces and a larger '+N'.
import React, { useId, useMemo } from 'react';
import { NEUTRAL, fs, rgba } from '@/components/redesign/constants';
import { Face } from './SocialMarks';
import { clothRow } from '@/components/profile/CoverBand';

/** @typedef {import('react').CSSProperties} CSS */
/** @typedef {{ key: 'inner'|'following'|'followers', R: number, half: number|null, cut: number|null, total: number, shown: number, requests: number, overflow: number, label: string }} OrbitRing */
/** @typedef {{ ring: number, kind: 'face'|'request'|'pill', angle: number, x: number, y: number, r: number, person?: any, me?: boolean, text?: string }} OrbitItem */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

const RING_KEYS = /** @type {const} */ (['inner', 'following', 'followers']);
const RING_OPACITY = [0.55, 0.35, 0.2];
const DEFAULT_LABELS = ['INNER CIRCLE', 'YOU FOLLOW', 'FOLLOW YOU'];

// The two orbits on the boards. pillFont is the largest the pill's text grows to with --fs,
// so the layout leaves room for it.
const GEOM = {
  168: { box: 168, radii: [36, 57, 78], face: 24, owner: 44, pillH: 14, pillFont: 11, caps: [4, 3, 3] },
  240: { box: 240, radii: [50, 80, 108], face: 31, owner: 60, pillH: 16, pillFont: 12, caps: [6, 8, 10] },
};
const GAP = 4; // the least space between two faces
const ROOM = 6; // more space than this doesn't make a slot better
const TAG = { drop: 2, h: 12, r: 13 }; // the 'YOU' tag hanging under a face (SocialMarks)

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
// Degrees in [0, 360), rounded so 359.9999 reads as 0.
const norm = (a) => {
  const v = Math.round((((a % 360) + 360) % 360) * 100) / 100;
  return v >= 360 ? 0 : v;
};
const within = (a, half) => half === null || Math.min(norm(a), 360 - norm(a)) <= half + 1e-6;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
const pillWidth = (text, font) => Math.ceil(String(text).length * font * 0.6 + 10);

// Mono 9px with 1.3px tracking: the ring name's length along its arc.
const labelWidth = (s) => {
  const n = Array.from(String(s ?? '')).length;
  return n ? n * 9 * 0.6 + (n - 1) * 1.3 : 0;
};

// Newest first: a latest stamp (B7) before none, then that stamp's date, else when the
// follow began (a row without a date counts as the oldest); equal rows keep their order.
const stampAt = (p) => {
  const t = Date.parse(String(p?.latest?.date ?? p?.latest?.at ?? ''));
  return Number.isFinite(t) ? t : null;
};
const sinceAt = (p) => {
  const t = Date.parse(String(p?.since ?? ''));
  return Number.isFinite(t) ? t : null;
};
function newestFirst(list) {
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const sa = stampAt(a.p);
      const sb = stampAt(b.p);
      if (sa !== null || sb !== null) {
        if (sa === null) return 1;
        if (sb === null) return -1;
        if (sb !== sa) return sb - sa;
      }
      const fa = sinceAt(a.p);
      const fb = sinceAt(b.p);
      if (fa !== fb) {
        if (fa === null) return 1;
        if (fb === null) return -1;
        return fb - fa;
      }
      return a.i - b.i;
    })
    .map((x) => x.p);
}

const isMe = (p) => !!p && (p.is_me === true || p.me === true);
const people = (list) => (Array.isArray(list) ? list.filter((p) => p && typeof p === 'object') : []);

const RING_OF = {
  inner: 0, mutual: 0, both: 0,
  following: 1, follows: 1, middle: 1,
  followers: 2, follower: 2, outer: 2,
};

/**
 * B3's circle.known rows ({ handle, name, avatar, cloth, ring, is_me }) sorted onto the
 * rings: { inner, following, followers }. Rows with an unknown ring are left out.
 * @param {any} known
 */
export function groupsFromKnown(known) {
  const out = { inner: [], following: [], followers: [] };
  for (const p of people(known)) {
    const i = RING_OF[String(p.ring ?? '').toLowerCase()];
    if (i !== undefined) out[RING_KEYS[i]].push(p);
  }
  return out;
}

// ── Placement ────────────────────────────────────────────────────────────

function at(g, R, a) {
  const c = g.box / 2;
  return { x: c + R * Math.sin(rad(a)), y: c - R * Math.cos(rad(a)) };
}

// The space between one circle and the nearest obstacle, less GAP.
function slackTo(p, r, others) {
  let m = Infinity;
  for (const o of others) m = Math.min(m, Math.hypot(p.x - o.x, p.y - o.y) - r - o.r - GAP);
  return m;
}

// n slots evenly from 12 o'clock: around the whole ring, or centred on 12 o'clock within
// +-half degrees.
function evenAngles(n, half) {
  if (n <= 0) return [];
  if (half === null) return Array.from({ length: n }, (_, k) => (k * 360) / n);
  const s = (2 * half) / n;
  return Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * s);
}

function scoreSlots(angles, g, R, radii, others, half) {
  let room = Infinity;
  for (let i = 0; i < angles.length; i++) {
    if (!within(angles[i], half)) return null;
    room = Math.min(room, Math.min(ROOM, slackTo(at(g, R, angles[i]), radii[i], others)));
  }
  let chord = Infinity;
  for (let i = 0; i < angles.length; i++) {
    for (let j = i + 1; j < angles.length; j++) {
      const a = at(g, R, angles[i]);
      const b = at(g, R, angles[j]);
      chord = Math.min(chord, Math.hypot(a.x - b.x, a.y - b.y) - radii[i] - radii[j] - GAP);
    }
  }
  return { room, chord, cost: 0, angles };
}

function better(a, b) {
  if (!b) return true;
  const wa = Math.min(a.room, a.chord);
  const wb = Math.min(b.room, b.chord);
  if (Math.abs(wa - wb) > 1e-6) return wa > wb;
  if (Math.abs(a.room - b.room) > 1e-6) return a.room > b.room;
  if (Math.abs(a.chord - b.chord) > 1e-6) return a.chord > b.chord;
  return a.cost < b.cost - 1e-9;
}

// Place n slots on ring R clear of `others`: evenly from 12 o'clock when that is clear;
// otherwise the even set is turned (or, on an arc, slid) a degree at a time, each slot free
// to lean up to 30% of a step toward open space, and the clearest set wins (then the one
// nearest 12 o'clock).
function fitRing(n, g, R, radii, others, half) {
  const base = evenAngles(n, half);
  const plain = scoreSlots(base, g, R, radii, others, half);
  if (plain && plain.room >= 0 && plain.chord >= 0) return base;
  const step = half === null ? 360 / n : (2 * half) / n;
  const lean = Math.min(0.3 * step, 24);
  const from = half === null ? 0 : -step / 2;
  const to = half === null ? step : step / 2;
  let best = plain && plain.room !== undefined ? { ...plain, cost: 0 } : null;
  for (let turn = from; turn < to; turn += 1) {
    const angles = base.map((a, i) => {
      const nominal = a + turn;
      let pick = nominal;
      let pickRoom = -Infinity;
      let pickLean = Infinity;
      for (let d = -lean; d <= lean + 1e-9; d += 1) {
        const cand = nominal + d;
        if (!within(cand, half)) continue;
        const room = Math.min(ROOM, slackTo(at(g, R, cand), radii[i], others));
        if (room > pickRoom + 1e-9 || (Math.abs(room - pickRoom) <= 1e-9 && Math.abs(d) < pickLean)) {
          pick = cand;
          pickRoom = room;
          pickLean = Math.abs(d);
        }
      }
      return pick;
    });
    const sc = scoreSlots(angles, g, R, radii, others, half);
    if (!sc) continue;
    sc.cost = Math.abs(turn) + angles.reduce((t, a, i) => t + Math.abs(a - (base[i] + turn)), 0) * 0.01;
    if (better(sc, best)) best = sc;
  }
  return best ? best.angles : base;
}

/**
 * Where everything on an orbit goes. Pure: the same input always gives the same layout.
 * @param {{ size?: number, mode?: string, groups?: any, totals?: any, labels?: any, caps?: number[] }} opts
 * @returns {{ box: number, face: number, owner: number, pillH: number, rings: OrbitRing[], items: OrbitItem[] }}
 */
export function orbitLayout({ size = 168, mode = undefined, groups = undefined, totals = undefined, labels = undefined, caps = undefined } = {}) {
  const g = GEOM[size === 240 ? 240 : 168];
  const m = mode === 'visit' || mode === 'screen' || mode === 'own' ? mode : g.box === 240 ? 'screen' : 'own';
  const names = g.box === 240 && labels !== false && (m === 'screen' || Array.isArray(labels))
    ? RING_KEYS.map((_, i) => String((Array.isArray(labels) ? labels[i] : null) ?? DEFAULT_LABELS[i] ?? ''))
    : null;
  const G = groups && typeof groups === 'object' ? groups : {};
  const T = totals && typeof totals === 'object' ? totals : {};
  const tInner = num(T.inner);
  const tFollowing = num(T.following ?? T.youFollow);
  const tFollowers = num(T.followers ?? T.followYou);
  const lists = [
    newestFirst(people(G.inner)),
    newestFirst(people(G.following)),
    newestFirst(people(G.followers)),
  ];
  const requests = m === 'visit' ? [] : newestFirst(people(G.requests));
  const ringTotals = [
    tInner,
    tFollowing !== null && tInner !== null ? Math.max(0, tFollowing - tInner) : null,
    tFollowers !== null && tInner !== null ? Math.max(0, tFollowers - tInner) : null,
  ];
  const userCaps = Array.isArray(caps) ? caps : [];

  /** @type {OrbitRing[]} */
  const rings = RING_KEYS.map((key, i) => {
    // Your own face is always shown on a visit.
    const list = [...lists[i].filter(isMe), ...lists[i].filter((p) => !isMe(p))];
    lists[i] = list;
    const R = g.radii[i];
    const total = Math.max(ringTotals[i] ?? list.length, list.length);
    const cap = Math.max(0, num(userCaps[i]) ?? g.caps[i]);
    const req = i === 2 ? requests.length : 0;
    const faces = Math.min(cap, list.length + req);
    const reqShown = req ? Math.min(req, Math.max(faces > 0 ? 1 : 0, faces - list.length)) : 0;
    const label = names ? names[i] : '';
    let cut = null;
    let half = null;
    if (names && label) {
      // The ring breaks under its name (Circle L63-65), and faces keep clear of the break.
      cut = deg(labelWidth(label) / 2 / (R + 3.2) + 6 / R);
      half = 180 - cut - deg((g.face / 2 + 2) / R);
    }
    return { key, R, half, cut, total, shown: Math.min(list.length, faces - reqShown), requests: reqShown, overflow: 0, label };
  });

  // Your face hangs its 'YOU' tag below it, so it takes the slot nearest 6 o'clock on the
  // inner and middle rings (the tag hangs outward) and nearest 3 o'clock on the outer one
  // (so it stays inside the orbit).
  const meRing = lists.findIndex((list, i) => rings[i].shown > 0 && isMe(list[0]));
  const order = meRing === 1 ? [0, 1, 2] : [0, 2, 1];

  let result = { items: /** @type {OrbitItem[]} */ ([]) };
  for (let pass = 0; pass < 40; pass += 1) {
    /** @type {OrbitItem[]} */
    const items = [];
    /** @type {Array<{ x: number, y: number, r: number }>} */
    const obstacles = [];
    for (const i of order) {
      const ring = rings[i];
      ring.overflow = Math.max(0, ring.total - ring.shown);
      const pillText = ring.overflow > 0 ? `+${ring.overflow}` : '';
      const n = ring.shown + ring.requests + (pillText ? 1 : 0);
      const radii = [];
      for (let k = 0; k < ring.shown + ring.requests; k++) radii.push(g.face / 2);
      if (pillText) radii.push(pillWidth(pillText, g.pillFont) / 2);
      const angles = fitRing(n, g, ring.R, radii, obstacles, ring.half).map(norm).sort((a, b) => a - b);
      // Slots clockwise from 12: people, then requests, then the pill in the last free slot.
      // Your face, when it is on this ring, first takes the slot nearest its target.
      const slots = angles.map((a) => ({ a, used: false }));
      const nearest = (target) => {
        let best = -1;
        let bestD = Infinity;
        slots.forEach((s, k) => {
          const d = Math.min(Math.abs(s.a - target), 360 - Math.abs(s.a - target));
          if (!s.used && d < bestD - 1e-6) { best = k; bestD = d; }
        });
        return best;
      };
      const firstFree = () => slots.findIndex((s) => !s.used);
      /** @type {OrbitItem[]} */
      const placed = [];
      const put = (k, item) => {
        if (k < 0) return;
        slots[k].used = true;
        placed.push({ ...item, angle: slots[k].a });
      };
      const list = lists[i];
      const meHere = meRing === i;
      if (meHere) put(nearest(i === 2 ? 90 : 180), { ring: i, kind: 'face', angle: 0, x: 0, y: 0, r: g.face / 2, person: list[0], me: true });
      for (let p = meHere ? 1 : 0; p < ring.shown; p++) put(firstFree(), { ring: i, kind: 'face', angle: 0, x: 0, y: 0, r: g.face / 2, person: list[p] });
      for (let q = 0; q < ring.requests; q++) put(firstFree(), { ring: i, kind: 'request', angle: 0, x: 0, y: 0, r: g.face / 2, person: requests[q] });
      if (pillText) put(firstFree(), { ring: i, kind: 'pill', angle: 0, x: 0, y: 0, r: pillWidth(pillText, g.pillFont) / 2, text: pillText });
      for (const item of placed) {
        const p = at(g, ring.R, item.angle);
        item.x = p.x;
        item.y = p.y;
        items.push(item);
        obstacles.push({ x: item.x, y: item.y, r: item.r });
        if (item.me) obstacles.push({ x: item.x, y: item.y + item.r + TAG.drop + TAG.h / 2, r: TAG.r });
      }
    }
    result = { items };

    // Does anything touch? Then the ring that touches shows one face fewer (one slot fewer).
    // Your 'YOU' tag counts as part of your face.
    const shapes = items.map((it, k) => ({ x: it.x, y: it.y, r: it.r, ring: it.ring, owner: k }));
    items.forEach((it, k) => {
      if (it.me) shapes.push({ x: it.x, y: it.y + it.r + TAG.drop + TAG.h / 2, r: TAG.r, ring: it.ring, owner: k });
    });
    let worst = 0;
    /** @type {number[]} */
    let culprits = [];
    shapes.forEach((it, a) => {
      for (let b = a + 1; b < shapes.length; b++) {
        const o = shapes[b];
        if (o.owner === it.owner) continue;
        const s = Math.hypot(it.x - o.x, it.y - o.y) - it.r - o.r - GAP;
        if (s < worst - 0.5) { worst = s; culprits = [it.ring, o.ring]; }
        else if (s < 0 && Math.abs(s - worst) <= 0.5) culprits.push(it.ring, o.ring);
      }
    });
    if (worst >= -0.5) break;
    const slotsOf = (r) => r.shown + r.requests + (r.overflow > 0 ? 1 : 0);
    const candidates = [...new Set(culprits)]
      .filter((i) => {
        const r = rings[i];
        return r.overflow > 0 ? r.shown > (meRing === i ? 1 : 0) : r.shown >= (meRing === i ? 3 : 2);
      })
      .sort((a, b) => slotsOf(rings[b]) - slotsOf(rings[a]) || (a === 1 ? -1 : b === 1 ? 1 : a - b));
    if (!candidates.length) break;
    const r = rings[candidates[0]];
    r.shown -= r.overflow > 0 ? 1 : 2;
  }
  rings.forEach((ring) => { ring.overflow = Math.max(0, ring.total - ring.shown); });
  return { box: g.box, face: g.face, owner: g.owner, pillH: g.pillH, rings, items: result.items };
}

// ── Words ────────────────────────────────────────────────────────────────

const joinAnd = (parts, oxford = true) => {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}${oxford ? ',' : ''} and ${parts[parts.length - 1]}`;
};
const firstOf = (p) => String(p?.name ?? '').trim().split(/\s+/)[0] || '';
const handleOf = (p) => String(p?.handle ?? '').trim().replace(/^@+/, '');

/** A person's name for a label: their name, else '@handle', else 'A traveler'. @param {any} p */
export function personName(p) {
  const n = String(p?.name ?? '').trim();
  if (n) return n;
  const h = handleOf(p);
  return h ? `@${h}` : 'A traveler';
}

/**
 * The orbit's summary for a screen reader.
 * @param {{ mode?: string, owner?: any, totals?: any, groups?: any, layout?: ReturnType<typeof orbitLayout> }} opts
 */
export function orbitSummary({ mode = 'own', owner = undefined, totals = undefined, groups = undefined, layout = undefined } = {}) {
  const G = groups && typeof groups === 'object' ? groups : {};
  // With totals, a null figure hasn't loaded (useCircle's counts); without them, each ring
  // is what its group holds (the rings are disjoint, the figures inclusive).
  const haveTotals = !!totals && typeof totals === 'object';
  const T = haveTotals ? totals : {};
  const len = (l) => (Array.isArray(l) ? l.length : 0);
  const inner = haveTotals ? num(T.inner) : len(G.inner);
  const following = haveTotals ? num(T.following ?? T.youFollow) : len(G.following) + len(G.inner);
  const followers = haveTotals ? num(T.followers ?? T.followYou) : len(G.followers) + len(G.inner);
  const loading = inner === null && following === null && followers === null;
  if (mode === 'visit') {
    const who = firstOf(owner) || (handleOf(owner) ? `@${handleOf(owner)}` : 'This traveler');
    if (loading) return `${who}’s circle, loading`;
    const shown = (ring) => (layout ? layout.items.filter((it) => it.kind === 'face' && it.ring === ring).map((it) => (it.me ? 'you' : firstOf(it.person) || personName(it.person))) : []);
    const including = (ring) => {
      const ns = shown(ring);
      return ns.length ? `, including ${joinAnd(ns, false)}` : '';
    };
    const parts = [];
    if (inner) parts.push(`${inner} in ${who}’s inner circle${including(0)}`);
    if (following) parts.push(`${who} follows ${following}${including(1)}`);
    if (followers) parts.push(`${followers} follow ${who}${including(2)}`);
    return parts.length ? `${who}’s circle drawn as orbits: ${parts.join('; ')}` : `${who}’s circle drawn as orbits: no one yet`;
  }
  if (loading) return 'Your circle, loading';
  const req = Array.isArray(G.requests) ? G.requests.length : 0;
  const parts = [];
  if (inner) parts.push(`${inner} in your inner circle`);
  if (following) parts.push(`${following} you follow`);
  if (followers) parts.push(`${followers} follow you`);
  if (req) parts.push(req === 1 ? 'one request waiting' : `${req} requests waiting`);
  return parts.length ? `Your circle drawn as orbits: ${joinAnd(parts)}` : 'Your circle drawn as orbits: no one yet';
}

// ── The orbit ────────────────────────────────────────────────────────────

// What the layout depends on, as a string: the people (and what their faces show), the
// totals, the names and the caps.
function personKey(p) {
  if (!p || typeof p !== 'object') return '';
  const cloth = typeof p.cloth === 'string' ? p.cloth : p.cloth && typeof p.cloth === 'object' ? String(p.cloth.key ?? '') : '';
  return [p.user_id ?? '', p.handle ?? '', p.name ?? '', p.avatar ?? '', cloth, isMe(p) ? 1 : 0, p.since ?? '', p.latest?.date ?? p.latest?.at ?? ''].join('|');
}
function layoutKey(big, mode, groups, totals, labels, caps) {
  const G = groups && typeof groups === 'object' ? groups : {};
  const T = totals && typeof totals === 'object' ? totals : null;
  return JSON.stringify([
    big, mode,
    ['inner', 'following', 'followers', 'requests'].map((k) => people(G[k]).map(personKey)),
    T ? [T.inner ?? null, T.following ?? T.youFollow ?? null, T.followers ?? T.followYou ?? null] : null,
    Array.isArray(labels) ? labels : labels === false ? false : null,
    Array.isArray(caps) ? caps : null,
  ]);
}

// An arc of the ring from 180+cut clockwise round to 180-cut: the ring with a break at the
// bottom for its name.
function ringPath(c, R, cut) {
  const p = (a) => ({ x: c + R * Math.sin(rad(a)), y: c - R * Math.cos(rad(a)) });
  const s = p(180 + cut);
  const e = p(180 - cut);
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${R} ${R} 0 1 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}
// The bottom arc the name follows, left to right (Circle L66-68).
function namePath(c, R) {
  const p = (a) => ({ x: c + R * Math.sin(rad(a)), y: c - R * Math.cos(rad(a)) });
  const s = p(240);
  const e = p(120);
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${R} ${R} 0 0 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/**
 * @param {{
 *   size?: 168|240, mode?: 'own'|'visit'|'screen', ringCloth?: any, owner?: any, groups?: any,
 *   totals?: any, onFace?: (person: any) => void, faceLabel?: (person: any) => string,
 *   ariaLabel?: string, labels?: string[]|false, caps?: number[], className?: string, style?: CSS,
 * }} props
 */
export default function CircleOrbit({
  size = 168,
  mode = undefined,
  ringCloth = undefined,
  owner = undefined,
  groups = undefined,
  totals = undefined,
  onFace = undefined,
  faceLabel = undefined,
  ariaLabel = undefined,
  labels = undefined,
  caps = undefined,
  className = undefined,
  style = undefined,
}) {
  const big = Number(size) === 240;
  const m = mode === 'visit' || mode === 'screen' || mode === 'own' ? mode : big ? 'screen' : 'own';
  const o = owner && typeof owner === 'object' ? owner : {};
  const ring = clothRow(ringCloth ?? o.cloth);
  const idBase = `orbit-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Laid out again only when what it shows changes, not on every render of the page.
  const key = layoutKey(big, m, groups, totals, labels, caps);
  const layout = useMemo(
    () => orbitLayout({ size: big ? 240 : 168, mode: m, groups, totals, labels, caps }),
    [key],
  );
  const summary = ariaLabel || orbitSummary({ mode: m, owner: o, totals, groups, layout });
  const interactive = typeof onFace === 'function';
  const c = layout.box / 2;
  const pillFont = big ? `min(${fs(9.5)}, 12px)` : `min(${fs(8.5)}, 11px)`;

  return (
    <div
      role={interactive ? 'group' : 'img'}
      aria-label={summary}
      className={className}
      style={{ position: 'relative', flex: 'none', width: layout.box, height: layout.box, ...style }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width={layout.box}
        height={layout.box}
        viewBox={`0 0 ${layout.box} ${layout.box}`}
        style={{ position: 'absolute', left: 0, top: 0, display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      >
        {!big ? <circle cx={c} cy={c} r={82} fill={NEUTRAL.white} fillOpacity=".55" /> : null}
        {layout.rings.map((r, i) => (
          r.cut !== null
            ? <path key={r.key} d={ringPath(c, r.R, r.cut)} fill="none" stroke={ring.cloth} strokeOpacity={RING_OPACITY[i]} strokeWidth="1" />
            : <circle key={r.key} cx={c} cy={c} r={r.R} fill="none" stroke={ring.cloth} strokeOpacity={RING_OPACITY[i]} strokeWidth="1" />
        ))}
        {layout.rings.some((r) => r.cut !== null) ? (
          <>
            <defs>
              {layout.rings.map((r) => (r.cut !== null ? <path key={r.key} id={`${idBase}-${r.key}`} d={namePath(c, r.R + 3.2)} fill="none" /> : null))}
            </defs>
            {layout.rings.map((r) => (r.cut !== null ? (
              <text key={r.key} fontFamily={MONO} fontSize="9" letterSpacing="1.3" fill={NEUTRAL.airmailBlue} textAnchor="middle">
                <textPath href={`#${idBase}-${r.key}`} startOffset="50%" textAnchor="middle">{r.label}</textPath>
              </text>
            ) : null))}
          </>
        ) : null}
      </svg>

      {layout.items.map((it, k) => {
        if (it.kind === 'pill') {
          return (
            <span
              key={`p${it.ring}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: it.x,
                top: it.y,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: big ? 26 : 24,
                minHeight: layout.pillH,
                boxSizing: 'border-box',
                padding: '0 4px',
                borderRadius: big ? 8 : 999,
                background: NEUTRAL.white,
                border: `1px solid ${big ? rgba(ring.cloth, 0.35) : NEUTRAL.airmailLine}`,
                fontFamily: MONO,
                fontSize: pillFont,
                fontWeight: big ? 400 : 500,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                color: big ? ring.cloth : NEUTRAL.airmailBlue,
                pointerEvents: 'none',
              }}
            >
              {it.text}
            </span>
          );
        }
        const p = it.person || {};
        const face = (
          <Face
            name={p.name}
            handle={p.handle}
            avatar={p.avatar}
            cloth={p.cloth}
            size={layout.face}
            pending={it.kind === 'request'}
            youTag={!!it.me}
          />
        );
        const key = `${it.ring}-${k}-${String(p.user_id ?? p.handle ?? '')}`;
        if (interactive && it.kind === 'face' && !it.me) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFace(p)}
              aria-label={(typeof faceLabel === 'function' && faceLabel(p)) || personName(p)}
              style={{
                position: 'absolute',
                left: it.x - 22,
                top: it.y - 22,
                width: 44,
                height: 44,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 0,
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {face}
            </button>
          );
        }
        return (
          <span key={key} aria-hidden="true" style={{ position: 'absolute', left: it.x - layout.face / 2, top: it.y - layout.face / 2, display: 'flex' }}>
            {face}
          </span>
        );
      })}

      <span aria-hidden="true" style={{ position: 'absolute', left: c - layout.owner / 2, top: c - layout.owner / 2, display: 'flex' }}>
        <Face name={o.name} handle={o.handle} avatar={o.avatar} cloth={o.cloth ?? ring} size={layout.owner} ring={2} />
      </span>
    </div>
  );
}

// ── The legend ───────────────────────────────────────────────────────────

const LEGEND_RING = { inner: 0, following: 1, followers: 2, youFollow: 1, followYou: 2 };

// The 18px ring glyph: its own ring drawn in the cloth, the others faint (Profile L108-120).
function RingGlyph({ index, color }) {
  const radii = [3.6, 6, index === 2 ? 8.2 : 8.3];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="1.4" fill={color} />
      {radii.map((r, i) => (
        <circle key={r} cx="9" cy="9" r={r} fill="none" stroke={color} strokeOpacity={i === index ? 1 : 0.25} strokeWidth={i === index ? 1.6 : 1} />
      ))}
    </svg>
  );
}

/**
 * The orbit's legend (Profile L106-123, Profile-Visit L119-127): one 52px row per ring, a
 * mono label over an Instrument Serif figure. A row whose value is 0 is left out; a value
 * that hasn't loaded (null) prints '—', never a guess. With `interactive`, a row that has an
 * onClick is a button with a chevron (the Circle screen on that tab); otherwise rows are
 * plain text, as on someone else's page. Labels come from the caller ('INNER CIRCLE',
 * 'YOU FOLLOW', 'FOLLOW YOU'; 'KENJI FOLLOWS', 'FOLLOW KENJI'). Renders nothing when no row
 * is left.
 * @param {{
 *   rows?: Array<{ key?: string, label: import('react').ReactNode, value?: number|null, onClick?: (e: any) => void }>,
 *   interactive?: boolean, cloth?: any, className?: string, style?: CSS,
 * }} props
 */
export function CircleLegend({ rows = [], interactive = false, cloth = undefined, className = undefined, style = undefined }) {
  const c = clothRow(cloth);
  const shown = (Array.isArray(rows) ? rows : []).filter((r) => r && r.value !== 0);
  if (!shown.length) return null;
  return (
    <ul className={className} style={{ display: 'flex', flexDirection: 'column', margin: 0, padding: 0, listStyle: 'none', minWidth: 0, ...style }}>
      {shown.map((r, i) => {
        const value = num(r.value);
        const index = LEGEND_RING[String(r.key ?? '')] ?? Math.min(i, 2);
        const live = interactive && typeof r.onClick === 'function';
        /** @type {CSS} */
        const rowStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          minHeight: 52,
          boxSizing: 'border-box',
          padding: '4px 0',
          margin: 0,
          background: 'transparent',
          border: 0,
          borderTop: i ? `1px solid ${NEUTRAL.airmailLine}` : 0,
          textAlign: 'left',
          color: 'inherit',
          font: 'inherit',
        };
        const body = (
          <>
            <RingGlyph index={index} color={c.cloth} />
            <span style={{ display: 'block', flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: MONO, fontSize: fs(10), lineHeight: 1.2, fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase', overflowWrap: 'anywhere', color: NEUTRAL.airmailBlue }}>
                {r.label}
              </span>
              <span style={{ display: 'block', marginTop: 2, fontFamily: "'Instrument Serif', Georgia, serif", fontSize: fs(22), lineHeight: 24 / 22, color: NEUTRAL.ink }}>
                {value === null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">not loaded yet</span>
                  </>
                ) : value}
              </span>
            </span>
            {live ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={NEUTRAL.airmailBlue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0 }}>
                <path d="m9 18 6-6-6-6" />
              </svg>
            ) : null}
          </>
        );
        return (
          <li key={String(r.key ?? i)} style={{ margin: 0, padding: 0 }}>
            {live ? (
              <button type="button" onClick={r.onClick} style={{ ...rowStyle, cursor: 'pointer' }}>{body}</button>
            ) : (
              <div style={rowStyle}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
