// src/lib/blocks.js
//
// Block, the pure part (go-live decision 6, 2026-10-13; Apple guideline 1.2).
// The worker says it has a block that really blocks by listing 'block_v2' in
// features on social/follow op:'list': both follows end, the Mailbox and
// feeds drop the pair both ways, no postcard passes between them, and the
// blocked person sees the blocker's passport as private. Until it says so,
// the app shows no Block anywhere (an older worker's block only stopped tags).
//
// Who is behind a row: a block_v2 worker takes POST social/block with any of
// { user_id | postcard_id | entry_id | guestbook_entry_id | slug | handle }
// (and a tag's token). The follow lists and Mailbox activity lines carry
// user_id; a Mailbox postcard carries its id; a passport signature its entry
// id (signing needs no @handle, so it is the only name some signers have); a
// place guestbook note its id; a shared passport its link (slug); feed stamps
// their author's @handle. A handle is first
// matched against the lists for a user_id, and the steadiest id a row has is
// the one sent. Someone with none of these can still be reported.

export const hasFeature = (list, f) => Array.isArray(list?.features) && list.features.includes(f);
export const blockReady = (list) => hasFeature(list, 'block_v2');
export const normHandle = (h) => String(h || '').trim().replace(/^@+/, '').toLowerCase();

const LISTS = ['following', 'followers', 'requests', 'blocked'];
const rows = (list, key) => (Array.isArray(list?.[key]) ? list[key] : []);

// '@handle' → that person's row in my lists (the first list that has them).
export function travelerIndex(list) {
  const idx = new Map();
  for (const key of LISTS) {
    for (const p of rows(list, key)) {
      const h = normHandle(p?.handle);
      if (h && p?.user_id && !idx.has(h)) idx.set(h, p);
    }
  }
  return idx;
}

// The person as the sheets use them: { user_id, handle, name, verified, seal,
// slug, postcard_id, entry_id, guestbook_entry_id }. Fills a missing user_id
// from the lists by handle; never guesses from a display name (names aren't
// unique).
export function resolveTraveler(person, list) {
  const p = person || {};
  const handle = normHandle(p.handle) || null;
  const known = handle ? travelerIndex(list).get(handle) || null : null;
  return {
    user_id: p.user_id || known?.user_id || null,
    handle,
    name: p.name || known?.name || null,
    verified: p.verified === true || known?.verified === true,
    seal: p.seal || known?.seal || null,
    slug: p.slug || null,
    postcard_id: p.postcard_id || null,
    entry_id: p.entry_id || null,
    guestbook_entry_id: p.guestbook_entry_id || null,
  };
}

// How I'm connected to them, from the lists.
export function relationTo(person, list) {
  const id = person?.user_id || null;
  const h = normHandle(person?.handle);
  const has = (key, status) => rows(list, key).some((p) => (!status || p.status === status) && ((id && p.user_id === id) || (h && normHandle(p.handle) === h)));
  return {
    following: has('following'),
    pending: has('following', 'pending'),
    follower: has('followers'),
    requested: has('requests'),
    blocked: has('blocked'),
  };
}

// What social/block is sent for this person, or null when Block can't be
// offered here (no block_v2, or nothing to name them by). The steadiest id
// wins: a user_id, then the postcard or signature the row is, then the
// passport link, then the @handle (a handle can change hands, rarely).
export function blockTarget(person, list) {
  if (!person || !blockReady(list)) return null;
  if (person.user_id) return { user_id: String(person.user_id) };
  if (person.postcard_id) return { postcard_id: String(person.postcard_id) };
  if (person.entry_id) return { entry_id: String(person.entry_id) };
  if (person.guestbook_entry_id) return { guestbook_entry_id: String(person.guestbook_entry_id) };
  if (person.slug) return { slug: String(person.slug) };
  const h = normHandle(person.handle);
  return h ? { handle: h } : null;
}

// What a person is called on screen.
export const travelerLabel = (p) => p?.name || (p?.handle ? `@${normHandle(p.handle)}` : 'A traveler');
