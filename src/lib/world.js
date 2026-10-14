// world.js: someone else's world for the visit page (/Traveler), and the report door for it.
//
//   getWorld({ handle, slug }) asks POST /social/world (backend item B3) and resolves one of:
//     { state: 'world', ... }   their page. person { user_id, handle, name, avatar, cloth,
//                               verified, seal, country }, relation { self, i_follow,
//                               follows_me, inner } and private always; when the passport is
//                               visible to you, also slug, stamps, stats, luggage, flags,
//                               gear and circle. fallback: true when it came from today's
//                               /passport/public: just the first name, stamps, stats and
//                               the slug (no relation, no folders the worker didn't send).
//     { state: 'private' }      today's worker answered {private:true}. That one reply means
//                               an unknown slug, a missing share, a teen-held owner, not one
//                               of their inner circle, or a server error, so it names nobody.
//     { state: 'gone' }         B3: no such person, blocked either way, or not available.
//     { state: 'held' }         the viewer's social doors are held (13-17).
//     { state: 'nothing' }      a handle on today's worker: it can't look one up.
//     { state: 'error', error } the network or a timeout: offer Try again.
//   Today's worker has no /social/world: its router answers 404 { path: '/social/world' },
//   and callWorker keeps that body, which is how the old worker is told apart.
//
//   reportTraveler(world)  { payload, subject } for ReportSheet: kind 'handle' with the
//                          @handle when there is one, else kind 'passport' with the slug.
import { callWorker } from '@/lib/callWorker';
import { getPublicPassport } from '@/lib/passport';

const ROUTE = 'social/world';

const lc = (v) => String(v ?? '').trim().replace(/^@+/, '').toLowerCase();
const text = (v) => String(v ?? '').trim();
const cleanSlug = (v) => String(v ?? '').trim().replace(/[^a-z0-9]/gi, '').slice(0, 24);
const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

function personOf(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    user_id: p.user_id != null && text(p.user_id) ? text(p.user_id) : null,
    handle: lc(p.handle) || null,
    name: text(p.name) || null,
    avatar: typeof p.avatar === 'string' && p.avatar.trim() ? p.avatar : null,
    cloth: typeof p.cloth === 'string' && p.cloth.trim() ? p.cloth.trim().toLowerCase() : null,
    verified: p.verified === true,
    seal: p.verified === true && p.seal ? String(p.seal) : null,
    country: text(p.country) || null,
  };
}

// i_follow: true or 'accepted' is following; 'pending' or 'requested' is waiting for them.
function relationOf(r) {
  const x = r && typeof r === 'object' ? r : {};
  const f = x.i_follow;
  const iFollow = f === true || f === 'accepted' ? 'accepted' : f === 'pending' || f === 'requested' ? 'pending' : null;
  return { self: x.self === true, i_follow: iFollow, follows_me: x.follows_me === true, inner: x.inner === true };
}

function circleOf(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    inner: count(c.inner),
    following: count(c.following),
    followers: count(c.followers),
    known: list(c.known),
    known_count: count(c.known_count) ?? 0,
  };
}

// Today's worker: the public passport by slug.
async function fromPublic(slug) {
  const { data, error } = await getPublicPassport(slug);
  if (data && !data.private && Array.isArray(data.stamps)) {
    const holder = text(data.holder);
    return {
      state: 'world',
      fallback: true,
      private: false,
      slug,
      // holder_cloth: the owner's cloth (B2), so the page is bound in it even by share link.
      person: { user_id: null, handle: null, name: holder && holder !== 'A traveler' ? holder : null, avatar: null, cloth: text(data.holder_cloth) || null, verified: false, seal: null, country: null },
      relation: null,
      stamps: data.stamps,
      stats: data.stats || null,
      luggage: null,
      flags: null,
      gear: null,
      circle: null,
    };
  }
  if (data && data.private) return { state: 'private' };
  return { state: 'error', error: error || 'Network error' };
}

/**
 * @param {{ handle?: string|null, slug?: string|null }} who
 */
export async function getWorld({ handle = null, slug = null } = {}) {
  const h = lc(handle);
  const s = cleanSlug(slug);
  if (!h && !s) return { state: 'gone' };
  const { data, error } = await callWorker(ROUTE, h ? { handle: h } : { slug: s });

  // The old worker: no such route.
  if (data && data.path === `/${ROUTE}`) return s ? fromPublic(s) : { state: 'nothing' };

  if (data && data.code === 'teen_hold') return { state: 'held' };
  if (data && (data.error === 'no_person' || data.unavailable === true)) return { state: 'gone' };
  if (!data || error) return { state: 'error', error: error || 'Network error' };

  const person = personOf(data.person);
  if (!person) return { state: 'gone' };
  const visible = !data.private && Array.isArray(data.stamps);
  const gear = data.gear && typeof data.gear === 'object' ? data.gear : null;
  return {
    state: 'world',
    fallback: false,
    private: data.private === true,
    slug: cleanSlug(data.slug) || s || null,
    person,
    relation: relationOf(data.relation),
    stamps: visible ? data.stamps : null,
    stats: visible ? data.stats || null : null,
    luggage: visible && data.luggage && typeof data.luggage === 'object' ? data.luggage : null,
    flags: visible && data.flags && typeof data.flags === 'object' ? data.flags : null,
    gear: visible && gear ? { gear: gear.gear || {}, buddies: list(gear.buddies), layout: gear.layout || {} } : null,
    circle: visible ? circleOf(data.circle) : null,
  };
}

/**
 * The report sheet's payload and subject for someone's page.
 * @param {any} world
 */
export function reportTraveler(world) {
  const p = world?.person || {};
  const h = lc(p.handle);
  const name = text(p.name);
  if (h) {
    return { payload: { kind: 'handle', ref: h, note: name ? `${name} (@${h})` : `@${h}` }, subject: name ? `${name}’s page` : `@${h}’s page` };
  }
  const slug = cleanSlug(world?.slug);
  if (slug) return { payload: { kind: 'passport', slug, note: name ? `${name}’s passport` : 'A shared passport' }, subject: name ? `${name}’s passport` : 'This passport' };
  return null;
}
