// Passport client — thin wrappers over the Worker's /passport/* endpoints.
// The Worker resolves the real user from the Supabase JWT (callWorker attaches
// it), so nothing here trusts a client-supplied user id. See the meaning model:
// docs/PASSPORT_MEANING_MODEL.md.
import { callWorker } from '@/lib/callWorker';
import { appInfo } from '@/lib/appInfo';
import { announceAgeGate, BIRTHDAY_SAVED } from '@/lib/ageGate';

// Great-circle metres between two coords (for GPS-verify: am I really here?).
export function metersBetween(aLat, aLng, bLat, bLng) {
  if (![aLat, aLng, bLat, bLng].every((v) => Number.isFinite(+v))) return Infinity;
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
// Within this radius (m) of the place, with GPS on → a trusted ✓ verified visit.
export const GPS_VERIFY_RADIUS_M = 250;

// Create/update a stamp. opts: { kind, entity_type, entity_id, name, city, region,
// country, lat, lng, visited_on(YYYY-MM-DD), verified('gps'|'photo'|'self') }.
// The after-stamp prompt (City Boards, 2026-10-14): a verified stamp in a city announces
// itself as the window event 'gs:stamped' { city, country }, and BoardNudge offers that
// city's board. A stamp verified by GPS announces at once; one waiting for its photo proof,
// when a photo proves it (uploadStampPhoto). Prints added to a proven stamp never announce.
const VERIFIED = new Set(['gps', 'photo_loc', 'photo_ai']);
const awaitingProof = new Map(); // stamp id -> { city, country }
function announceStamp(place) {
  try { window.dispatchEvent(new CustomEvent('gs:stamped', { detail: place })); } catch { /* no window */ }
}

export async function addStamp(opts) {
  const { data, error } = await callWorker('passport/stamp', opts || {});
  const city = String(opts?.city || '').trim();
  const country = String(opts?.country || '').trim();
  if (!error && data?.id && city && country) {
    const region = String(opts?.region || '').trim() || null;
    if (VERIFIED.has(data.verified)) announceStamp({ city, country, region });
    else awaitingProof.set(data.id, { city, country, region });
  }
  return { data, error };
}

// "I'm here, but the app is saying I'm not" (founder, 2026-10-10): resend a
// refused attraction stamp with report:true. The worker ALWAYS grants it (as
// 'reported' — below GPS and photo, no ✓, the same stamp art) and files the
// admin report: the spot rounded to about a city block (none for minors),
// distance from our pin, GPS accuracy, phone platform and app version.
// Send the same request that was refused, with the same fix.
export async function reportStamp(opts) {
  const { platform, version } = await appInfo();
  return addStamp({ ...(opts || {}), report: true, platform, ...(version ? { app_version: version } : {}) });
}

// Codes on which the worker refuses an attraction stamp (409).
export const STAMP_REFUSALS = ['not_here', 'unlocatable', 'proof_needed'];

// The user's whole passport: { stamps:[{...,photos:[]}], stats:{...} }.
export async function listPassport() {
  const { data, error } = await callWorker('passport/list', {});
  return { stamps: data?.stamps || [], stats: data?.stats || {}, booklet: data?.booklet || null, error };
}

// The earliest day a stamp can carry (the 5-year date picker, 2026-10-16).
export const STAMP_EARLIEST = "2021-01-01";

// Up to three answers to "where was this photo taken?" (founder, 2026-10-14: "the app senses
// which city and state the photo was taken from … give three options"): the famous places
// within reach first, then the city, and the wider city around a ward ("Taito", in "Tokyo"):
// cities keep up to two of the three places, so Tokyo isn't crowded out by temples.
export function photoOptions(data) {
  const cities = (data?.cities || []).filter((c) => c?.city).map((c) => ({
    key: `c:${c.city}`, kind: "city", name: c.city, local: c.local || null,
    city: c.city, country: c.country || "", cc: c.cc || "", region: c.region || null,
    sub: [c.within, c.region, c.country].filter(Boolean).join(", "),
  }));
  const here = cities[0] || {};
  const places = (data?.places || []).filter((p) => p?.name).map((p) => ({
    key: `p:${p.id}`, kind: "place", name: p.name, local: null,
    city: p.city || here.city || "", country: p.country || here.country || "", cc: here.cc || "", region: here.region || null,
    sub: [p.city, p.country].filter(Boolean).join(", "), meters: p.meters,
  }));
  const nCities = Math.min(cities.length, places.length ? 2 : 3);
  return [...places.slice(0, 3 - nCities), ...cities.slice(0, nCities)];
}

// Where a trip photo was taken, from its location tag: { places, cities } — the famous
// places within reach and the city it's in (worker /photo-place) — or null.
export async function photoPlace(lat, lng) {
  const { data, error } = await callWorker('photo-place', { lat, lng });
  return error || !data || data.error ? null : data;
}

// Attach a photo to a stamp (base64 data URL or bare base64). A photo on a
// self-declared stamp upgrades it to ✓ (photo-proof); visited_on optional.
// exif: { lat, lng, taken_at } read from the ORIGINAL file (src/lib/photoExif.js)
// — the worker's photo-location proof; never stored. Resolves data.proof =
// 'photo_loc' | 'photo_ai' | null and data.verified = the stamp's new status.
export async function uploadStampPhoto({ stamp_id, image, caption, visited_on, content_type, exif }) {
  const { data, error } = await callWorker('passport/photo', { stamp_id, image, caption, visited_on, content_type, exif: exif || undefined });
  const waiting = awaitingProof.get(stamp_id);
  if (waiting && !error && data?.proof && VERIFIED.has(data.verified)) {
    awaitingProof.delete(stamp_id);
    announceStamp(waiting);
  }
  return { data, error };
}

// Place recognition on a stamp's existing memory photos → { verified, checked, match }.
export async function checkStampPhotos(stamp_id) {
  const { data, error } = await callWorker('passport/stamp/check-photos', { stamp_id });
  return { data, error: error || (data && data.ok === false ? data.error || 'Could not check the photos' : null) };
}
// The three proofs that earn the green ✓ (gps, photo location, photo recognised).
export const isVerified = (v) => v === 'gps' || v === 'photo_loc' || v === 'photo_ai';
export const proofToast = (proof) => proof === 'photo_loc' ? "✓ Verified — your photo's location puts you there"
  : proof === 'photo_ai' ? '✓ Verified — we recognised the place in your photo' : null;
export async function setStampDate(stamp_id, visited_on) {
  const { data, error } = await callWorker('passport/stamp/date', { stamp_id, visited_on });
  return { data, error };
}
// How the booklet lays the stamp out: 'solo' = a page of its own, 'auto' = packed
// with other stamps. Resolves { data:{ok,layout} } or { error } — a worker-side
// business refusal (column not migrated yet) arrives as data.ok === false.
export async function setStampLayout(stamp_id, layout) {
  const { data, error } = await callWorker('passport/stamp/layout', { stamp_id, layout });
  return { data, error: error || (data && data.ok === false ? data.error || 'Could not change the page layout' : null) };
}
// Move a stamp onto another stamp's booklet page (founder, 2026-10-05): the two
// share that page, one in each half.
export async function setStampPageWith(stamp_id, page_with) {
  const { data, error } = await callWorker('passport/stamp/layout', { stamp_id, page_with });
  return { data, error: error || (data && data.ok === false ? data.error || 'Could not move the stamp' : null) };
}
// Scene stamps with photos print photo-first; this pins the stamp above
// ('top') or below ('bottom') the open photo, or hands it back to the app's
// own pick ('auto').
export async function setStampPos(stamp_id, stamp_pos) {
  const { data, error } = await callWorker('passport/stamp/layout', { stamp_id, stamp_pos });
  return { data, error: error || (data && data.ok === false ? data.error || 'Could not move the stamp' : null) };
}
// Drop a scene stamp's movie note (founder, 2026-10-05): the stamp stays, the
// "scene from…" line and photo-first layout go.
export async function clearStampFilm(stamp_id) {
  const { data, error } = await callWorker('passport/stamp/layout', { stamp_id, film: 'remove' });
  return { data, error: error || (data && data.ok === false ? data.error || 'Could not update the stamp' : null) };
}
// Places of respect (src/lib/respectPlaces.js): 'art' keeps the illustration,
// 'plain' prints the stamp as text only (the typographic stamp).
export async function setStampArt(stamp_id, art) {
  const { data, error } = await callWorker('passport/stamp/layout', { stamp_id, art });
  return { data, error: error || (data && data.ok === false ? data.error || 'Could not change the stamp' : null) };
}
// A scene stamp (it carries a film) with at least one memory photo gets the
// photo-first page: one photo open, the second as a thumbnail, the stamp on
// the photo's calmer edge. Always a page of its own.
export const isPhotoFirst = (s) => !!(s && s.meta && s.meta.film && Array.isArray(s.photos) && s.photos.some((p) => p && p.photo_url));
export async function deleteStamp(stamp_id) {
  const { data, error } = await callWorker('passport/stamp/delete', { stamp_id });
  return { data, error };
}
export async function deleteStampPhoto(photo_id) {
  const { data, error } = await callWorker('passport/photo/delete', { photo_id });
  return { data, error };
}

// Buddy tagging (consent-gated). With to_handle (2026-10-10) the tag is
// addressed to that @username and lands in their Mailbox / passport inbox to
// Allow or Decline. Without it: the original SHARE-LINK flow — a pending tag
// + an unguessable token link for the native share sheet. Returns
// { token, url?, to_handle? }.
export async function createTagInvite({ stamp_id, from_name, to_handle }) {
  const { data, error } = await callWorker('passport/tag', { stamp_id, from_name, ...(to_handle ? { to_handle } : {}) });
  return { data, error };
}
// Preview a tag by its share token (for the claim card). No auth needed.
export async function getTagByToken(token) {
  const { data, error } = await callWorker('passport/tag/by-token', { token });
  return { tag: data?.tag || null, error };
}
// Claim a shared tag (recipient signed in): accept → stamp on my passport.
export async function claimTag(token, action, presence) {
  const { data, error } = await callWorker('passport/tag/claim', { token, action, presence });
  return { data, error };
}
// Block the tagger behind an invite (silent: their invites just "expire").
export async function blockTagger(token) {
  const { data, error } = await callWorker('social/block', { token });
  return { data, error };
}
// Block a traveler (go-live decision 6; offered only when op:'list' lists
// 'block_v2', see src/lib/blocks.js). target: one of { user_id }, { postcard_id },
// { slug } or { handle }. Silent to them; both follows end. Unblock deletes
// only my own block row, and the follows don't come back.
export async function blockTraveler(target) {
  const { data, error } = await callWorker('social/block', target || {});
  const err = error || data?.error || null;
  return { ok: !err && data?.ok === true, error: err || (data?.ok === true ? null : 'Couldn’t block right now') };
}
export async function unblockTraveler(user_id) {
  const { data, error } = await callWorker('social/follow', { op: 'unblock', user_id });
  const err = error || data?.error || null;
  return { ok: !err && data?.ok === true, error: err || (data?.ok === true ? null : 'Couldn’t unblock right now') };
}
// Username: read (no args) or claim/change. 3–20 [a-z0-9_], 5 changes/30 days.
export async function getHandle() {
  const { data, error } = await callWorker('social/handle', {});
  return { handle: data?.handle || null, verified: data?.verified === true, seal: data?.seal || null, error };
}
// Request a username (business/official) or the GlobeSkimmers Seal.
export async function socialRequest({ kind, handle, note }) {
  const { data, error } = await callWorker('social/request', { kind, handle, note });
  return { ok: !!data?.ok, error: error || data?.error || null };
}
// The Mailbox unread signal: { total, activity? }. mark:true (the Mailbox
// opening) returns the activity with unread flags, then marks it all seen and
// tells the nav to clear its dot.
export async function socialUnread({ mark = false } = {}) {
  const { data, error } = await callWorker('social/unread', mark ? { mark: true } : {});
  if (mark && !error) { try { window.dispatchEvent(new Event("gs:unread")); } catch { /* no window */ } }
  return { total: data?.total || 0, activity: data?.activity || [], error };
}
// A stamp's trip note ("what was this trip for?") — private unless shared.
export async function setStampNote(stamp_id, { note, isPublic } = {}) {
  const body = { stamp_id };
  if (note !== undefined) body.note = note;
  if (isPublic !== undefined) body.public = isPublic;
  const { data, error } = await callWorker('passport/stamp/note', body);
  return { note: data?.note ?? null, notePublic: data?.note_public === true, error: error || data?.error || null };
}
// Who sees a stamp — the four tiers (founder, 2026-10-15): 'me' | 'inner' | 'followers'
// | 'public'. A boolean still works as the old hidden flag.
export async function setStampVisibility(stamp_id, visibility) {
  const body = typeof visibility === 'boolean' ? { stamp_id, hidden: visibility } : { stamp_id, visibility };
  const { data, error } = await callWorker('passport/stamp/visibility', body);
  return { visibility: data?.visibility || null, hidden: data?.hidden === true, error: error || data?.error || null };
}
// One tap moves every stamp to one level.
export async function setAllStampsVisibility(visibility) {
  const { data, error } = await callWorker('passport/stamp/visibility', { all: true, visibility });
  return { ok: data?.ok === true, error: error || data?.error || null };
}
// Ask-first share links (founder, 2026-10-15): mint { level, hours? } → { url, token,
// expires_at }; list() → { links }; revoke(token).
export async function mintShareLink(level, hours) {
  const { data, error } = await callWorker('passport/share-link', { level, hours });
  return { data, error: error || data?.error || null };
}
export async function listShareLinks() {
  const { data, error } = await callWorker('passport/share-links', {});
  return { links: data?.links || [], error };
}
export async function revokeShareLink(token) {
  const { data, error } = await callWorker('passport/share-link', { op: 'revoke', token });
  return { ok: data?.ok === true, error };
}
// Save the booklet's order: { booklet_order } | { reshuffle: true } | { custom_order: ids }.
// Answers with the updated profile (the shuffle's new seed included).
export async function setBookletOrder(body) {
  const { data, error } = await callWorker('social/profile', body);
  return { profile: data?.profile || null, error: error || data?.error || null };
}
// The booklet's page order, applied wherever the booklet shows (owner and visitors alike):
// 'newest' (default) | 'chrono' (oldest trip first, like a real passport) | 'shuffle'
// (seeded, stable until re-dealt) | 'custom' (the hand's arrangement).
export function sortStamps(stamps, booklet) {
  const list = [...(stamps || [])];
  const t = (s) => Date.parse(s.visited_on || s.created_at) || 0;
  const order = booklet?.order || 'newest';
  if (order === 'chrono') return list.sort((a, b) => t(a) - t(b) || String(a.id).localeCompare(String(b.id)));
  if (order === 'shuffle' && Number.isFinite(booklet?.seed)) {
    const h = (str) => { let x = booklet.seed >>> 0; for (const c of String(str)) { x = Math.imul(x ^ c.charCodeAt(0), 2654435761); x ^= x >>> 15; } return x >>> 0; };
    return list.sort((a, b) => h(a.id) - h(b.id) || String(a.id).localeCompare(String(b.id)));
  }
  if (order === 'custom' && Array.isArray(booklet?.custom) && booklet.custom.length) {
    const at = new Map(booklet.custom.map((id, i) => [id, i]));
    return list.sort((a, b) => (at.has(a.id) ? at.get(a.id) : 1e9 - t(a) / 1e6) - (at.has(b.id) ? at.get(b.id) : 1e9 - t(b) / 1e6));
  }
  return list.sort((a, b) => t(b) - t(a));
}
// The owner's caption under one photo (moderated; '' clears it).
export async function setPhotoCaption(photo_id, caption) {
  const { data, error } = await callWorker('passport/photo/caption', { photo_id, caption });
  return { caption: data?.caption ?? null, error: error || data?.error || null };
}
// Is a username being held for THIS account (founder's family list)?
export async function heldForMe(token) {
  const { data, error } = await callWorker('social/held-for-me', token ? { token } : {});
  return { held: data?.held || null, current: data?.current || null, error };
}
// Age gate (Social P1): read state, or set the birth year once (it locks).
export async function getAgeGate() {
  const { data, error } = await callWorker('social/age', {});
  return { set: !!data?.set, tier: data?.tier || null, error };
}
// The gate takes the FULL birthday (founder, 2026-10-05): year + 'MM-DD'.
// Both lock after the first write — age-up happens on the real birthday.
// A saved birthday is announced so the app re-reads the tier at once.
export async function setAgeGate(birth_year, birth_md) {
  const { data, error } = await callWorker('social/age', { birth_year, birth_md });
  const err = error || data?.error || null;
  if (!err) announceAgeGate(BIRTHDAY_SAVED);
  return { set: !!data?.set, tier: data?.tier || null, error: err };
}
// 'YYYY-MM-DD' (a date input's value) → setAgeGate args, or null if not a date.
export const splitDob = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? { year: Number(m[1]), md: `${m[2]}-${m[3]}` } : null;
};
// City sets: "5 of 10 Atlanta icons" — derived server-side, no streaks.
export async function listCitySets() {
  const { data, error } = await callWorker('passport/sets', {});
  return { sets: data?.sets || [], error };
}
// Social profile v1 (worker-moderated door): read, or patch any of
// { display_name, bio, favorites, dreams } — favorites/dreams ≤3 {name,country}.
export async function getSocialProfile() {
  const { data, error } = await callWorker('social/profile', {});
  return { profile: data?.profile || null, error };
}
// The privacy truth (founder, 2026-10-18): { profile, privacy: { is_public, counts: { me,
// inner, followers, public } } } — what Settings and the one-time check-up show.
export async function getPrivacy() {
  const { data, error } = await callWorker('social/profile', { privacy: true });
  return { profile: data?.profile || null, privacy: data?.privacy || null, error };
}
// Find people (founder, 2026-10-18): a name, a @username or the sign-up email →
// { people: [{ user_id, name, handle, avatar, cloth, relation }], mode: 'name' | 'email' | 'off' }.
// The worker decides who can be found (adults only; name and email only when they allow it).
export async function findPeople(q) {
  const { data, error } = await callWorker('social/find', { q });
  return { people: Array.isArray(data?.people) ? data.people : [], mode: data?.mode || 'name', error: error || data?.error || null };
}
export async function setSocialProfile(patch) {
  const { data, error } = await callWorker('social/profile', patch || {});
  return { profile: data?.profile || null, error: error || data?.error || null };
}
// Follow graph (Social P2): op 'list' | 'follow' {handle} | 'unfollow' |
// 'accept'/'decline' {user_id} | 'unblock' {user_id}. The feed is reverse-chron
// stamps of accepted followees whose visibility allows it.
export async function socialFollow(op, args) {
  const { data, error } = await callWorker('social/follow', { op, ...(args || {}) });
  return { data, error: error || data?.error || null };
}
// held: 'teen' when the worker holds this reader's social doors (13-17); the
// rows are then empty by rule, not because nothing happened. rows is [] on an
// error too, so read error before treating an empty feed as a quiet week.
export async function socialFeed() {
  const { data, error } = await callWorker('social/feed', {});
  return { rows: data?.rows || [], held: data?.held || null, error };
}
// The postcard box (2026-10-14): every postcard sent to you, newest first, a page at a
// time from the worker's /postcards/box; before = the previous page's `next` (the last
// card's created_at, passed back as sent). A worker without the route answers 404
// { path }: the box then shows the cards addressed to you that the feed holds, partial.
export async function postcardBox(before = null) {
  const { data, error } = await callWorker('postcards/box', before ? { before } : {});
  if (data && data.path === '/postcards/box') {
    const f = await socialFeed();
    return { rows: (f.rows || []).filter((r) => r?.type === 'postcard' && r.to_me === true), next: null, held: f.held, error: f.error, partial: true };
  }
  return { rows: data?.rows || [], next: data?.next || null, held: data?.held || null, error: error || data?.error || null, partial: false };
}
// Keep a card someone sent to everyone in your postcard box (keep true), or let it go
// (false): worker /postcards/keep. { ok, kept, error }. The feed marks the cards it can
// keep with a boolean `kept`; without one the app offers no Keep.
export async function keepPostcard(postcard_id, keep = true) {
  const id = String(postcard_id ?? '').trim();
  if (!id) return { ok: false, kept: null, error: 'postcard_id required' };
  const { data, error } = await callWorker('postcards/keep', { postcard_id: id, keep: keep !== false });
  const err = error || data?.error || null;
  return { ok: !err && data?.ok === true, kept: typeof data?.kept === 'boolean' ? data.kept : null, error: err };
}
// Block a person by user id. Today's worker records the block, silences tags
// and postcards both ways and kills that person's pending invites to you;
// backend item B8 also ends the follow edges and filters feeds, and advertises
// it as features 'block_v2' on op:list (useCircle's canBlock).
export async function blockUser(user_id) {
  const id = String(user_id ?? '').trim();
  if (!id) return { ok: false, data: null, error: 'user_id required' };
  const { data, error } = await callWorker('social/block', { user_id: id });
  const err = error || data?.error || null;
  return { ok: !err && data?.ok === true, data, error: err };
}
// Lift a block you made (op 'unblock' deletes only your own block row). The
// worker has supported it since 2026-10-10, so the Blocked list works today.
export async function unblockUser(user_id) {
  const id = String(user_id ?? '').trim();
  if (!id) return { ok: false, data: null, error: 'user_id required' };
  const { data, error } = await socialFollow('unblock', { user_id: id });
  return { ok: !error && data?.ok === true, data, error };
}
// Birthday (MM-DD): read via getAgeGate's birth_md; set here ONCE — it is part
// of the age now, so it locks like the year (founder, 2026-10-05). Completing
// a legacy year-only account recomputes the tier exactly (it is how a 'confirm'
// account — a year that could be either side of a birthday that matters —
// gets its real tier, go-live decision 2). Resolves the recomputed tier;
// locked = the month and day were already saved. The Passport mints the
// birthday stamp on the day.
export async function setBirthday(birth_md) {
  const { data, error } = await callWorker('social/age', { birth_md });
  const err = error || data?.error || null;
  if (!err) announceAgeGate(BIRTHDAY_SAVED);
  return { birth_md: data?.birth_md ?? null, tier: data?.tier || null, locked: data?.locked === true, error: err };
}
// birth_year is the account's own stored year (a worker from before the
// go-live fixes doesn't send it: null).
export async function getAgeInfo() {
  const { data, error } = await callWorker('social/age', {});
  return { set: !!data?.set, tier: data?.tier || null, birth_year: data?.birth_year || null, birth_md: data?.birth_md || null, error };
}
// Send a postcard: image (data URL from resizePhoto), message, the place
// line, optional dish meta, and either to_handle, to_city ({ city, country }:
// that city's board, City Board) or nothing (= followers).
export async function sendPostcard({ image, message, place_name, city, country, region, meta, to_handle, to_city, anon }) {
  const { data, error } = await callWorker('postcards/send', { image, message, place_name, city, country, ...(region ? { region } : {}), meta, to_handle, to_city, ...(anon ? { anon: true } : {}) });
  return { data, error: error || data?.error || null };
}
// A city's board (City Board, 2026-10-14): postcards from travelers who were really
// there, newest first, a page at a time (before = the previous page's `next`).
// { rows, next, can_post, held, unavailable, error }: held for a held viewer, and
// unavailable before the worker or its column is there, so the app shows no board.
export async function cityBoard({ city, country, kind = 'city', region = null, before = null }) {
  const { data, error } = await callWorker('city/board', { city, country, kind, ...(region ? { region } : {}), ...(before ? { before } : {}) });
  if (data && data.path === '/city/board') return { rows: [], next: null, can_post: false, held: null, unavailable: true, error: null };
  const held = data?.code === 'teen_hold' ? data.held || 'teen' : null;
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    next: data?.next || null,
    board: data?.board || null,
    alternates: Array.isArray(data?.alternates) ? data.alternates : [],
    kit: data?.kit || null,
    counts: data?.counts || null,
    guestbook: data?.guestbook || null,
    // A minor reads boards and adds sticker likes; posting, notes and comments stay 18+ (2026-10-16).
    read_only: data?.read_only === true,
    can_post: data?.can_post === true,
    held,
    unavailable: data?.unavailable === true,
    error: held ? null : error || data?.error || null,
  };
}
// Every city board with postcards (City Boards, 2026-10-14), busiest first; q narrows by
// city or country. { boards: [{ city, country, count, recent, last_at, cover }], held,
// unavailable, error }: unavailable before the worker or its database function is there.
export async function cityBoards(q = "") {
  const query = String(q || "").trim();
  const { data, error } = await callWorker('city/boards', query ? { q: query } : {});
  if (data && data.path === '/city/boards') return { boards: [], held: null, unavailable: true, error: null };
  const held = data?.code === 'teen_hold' ? data.held || 'teen' : null;
  return {
    boards: Array.isArray(data?.boards) ? data.boards : [],
    rollups: Array.isArray(data?.rollups) ? data.rollups : [],
    held,
    unavailable: data?.unavailable === true,
    error: held ? null : error || data?.error || null,
  };
}
// Avatar: moderated at upload, fail-closed; resolves the serving URL.
export async function setAvatar(image) {
  const { data, error } = await callWorker('social/avatar', { image });
  return { url: data?.url || null, error: error || data?.error || null };
}
// Report a shared passport (Apple 1.2's report door).
export async function reportShared({ slug, kind, ref, reason, note }) {
  const { data, error } = await callWorker('social/report', { slug, kind, ref, reason, note });
  return { data, error };
}
export async function setHandle(handle, heldToken) {
  const { data, error } = await callWorker('social/handle', heldToken ? { handle, held_token: heldToken } : { handle });
  return { handle: data?.handle || null, suggestions: data?.suggestions || [], heldClaim: data?.held_claim === true, heldName: data?.held_name || null, code: data?.code || null, error: error || data?.error || null };
}
// My incoming pending tags (the passive "Tagged you" inbox — email path).
export async function listTags() {
  const { data, error } = await callWorker('passport/tags', {});
  return { tags: data?.tags || [], error };
}
// Accept/decline an inbox tag.
export async function respondTag(tag_id, action) {
  const { data, error } = await callWorker('passport/tag/respond', { tag_id, action });
  return { data, error };
}

// Shareable booklet. getShareLink() reads the current state; pass a boolean to
// toggle public/private. Returns { slug, is_public, url }.
export async function getShareLink(is_public) {
  const body = typeof is_public === "boolean" ? { is_public } : {};
  const { data, error } = await callWorker('passport/share', body);
  return { data, error };
}
// A public passport by slug (read-only friend view). Returns { holder, stamps, stats } or { private:true }.
export async function getPublicPassport(slug) {
  const { data, error } = await callWorker('passport/public', { slug });
  return { data, error };
}

// ── The Blotter (2026-09-30): reaction stamps + guestbook AROUND a page ─────
// One read per booklet: { targets: {'st:<id>': {marks:{wow:2,…}, mine:['wow']}},
// entries: [...], owner: bool }. Never errors — a private/unknown slug reads empty.
export async function blotterRead(slug) {
  const { data } = await callWorker('blotter/read', { slug });
  return data && !data.error ? data : { targets: {}, entries: [] };
}
// The likes and comments on one board page's postcards (City Boards, 2026-10-14): the same
// { targets, entries } shape, keyed 'pc:<id>'.
export async function blotterReadBoard(postcardIds, photoIds = []) {
  const ids = (postcardIds || []).filter(Boolean).slice(0, 60);
  const photos = (photoIds || []).filter(Boolean).slice(0, 60);
  if (!ids.length && !photos.length) return { targets: {}, entries: [] };
  const { data } = await callWorker('blotter/read', { postcards: ids, ...(photos.length ? { photos } : {}) });
  return data && !data.error ? data : { targets: {}, entries: [] };
}
// Press or peel one of the five reaction stamps (+ contextual 'yummy').
export async function blotterMark(slug, target, kind, op) {
  const { data, error } = await callWorker('blotter/mark', { slug, target, kind, op });
  return { data, error };
}
// Sign the guestbook ({slug,target,text?,doodle?}), edit ({op:'edit',entry_id,text})
// or peel your own entry ({op:'peel',entry_id}). doodle is a data-URL PNG.
export async function blotterSign(args) {
  const { data, error } = await callWorker('blotter/sign', args);
  return { data, error };
}
// Co-sign: put your name under someone's words ('sign') or lift your pen ('lift').
export async function blotterCosign(entry_id, op) {
  const { data, error } = await callWorker('blotter/cosign', { entry_id, op });
  return { data, error };
}
// Owner sweep: {op:'mark',target,kind} clears a stamp; {op:'entry',entry_id} removes an entry.
export async function blotterSweep(args) {
  const { data, error } = await callWorker('blotter/sweep', args);
  return { data, error };
}

// ── Virtual Luggage (2026-09-30): six trunks, five faces, placed stickers ───
export async function luggageGet() {
  const { data } = await callWorker('luggage/get', {});
  return data && !data.error ? data : { active: 'classic', placements: {} };
}
export async function luggageSet(patch) {
  const { data, error } = await callWorker('luggage/set', patch);
  return { data, error };
}

// Take one of your photos down from every city board (or put it back) without touching
// its album (City Billboards, 2026-10-16). { photo_id, hidden } → { ok, board_hidden }.
export async function setPhotoOnBoard(photo_id, hidden) {
  const { data, error } = await callWorker('passport/photo/board', { photo_id, hidden });
  return { data, error: error || data?.error || null };
}
