// Passport client — thin wrappers over the Worker's /passport/* endpoints.
// The Worker resolves the real user from the Supabase JWT (callWorker attaches
// it), so nothing here trusts a client-supplied user id. See the meaning model:
// docs/PASSPORT_MEANING_MODEL.md.
import { callWorker } from '@/lib/callWorker';

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
export async function addStamp(opts) {
  const { data, error } = await callWorker('passport/stamp', opts || {});
  return { data, error };
}

// The user's whole passport: { stamps:[{...,photos:[]}], stats:{...} }.
export async function listPassport() {
  const { data, error } = await callWorker('passport/list', {});
  return { stamps: data?.stamps || [], stats: data?.stats || {}, error };
}

// Attach a photo to a stamp (base64 data URL or bare base64). A photo on a
// self-declared stamp upgrades it to ✓ (photo-proof); visited_on optional.
// exif: { lat, lng, taken_at } read from the ORIGINAL file (src/lib/photoExif.js)
// — the worker's photo-location proof; never stored. Resolves data.proof =
// 'photo_loc' | 'photo_ai' | null and data.verified = the stamp's new status.
export async function uploadStampPhoto({ stamp_id, image, caption, visited_on, content_type, exif }) {
  const { data, error } = await callWorker('passport/photo', { stamp_id, image, caption, visited_on, content_type, exif: exif || undefined });
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
// Scene stamps with photos print photo-first; this pins the stamp above
// ('top') or below ('bottom') the open photo, or hands it back to the app's
// own pick ('auto').
export async function setStampPos(stamp_id, stamp_pos) {
  const { data, error } = await callWorker('passport/stamp/layout', { stamp_id, stamp_pos });
  return { data, error: error || (data && data.ok === false ? data.error || 'Could not move the stamp' : null) };
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

// Buddy tagging via a SHARE LINK (consent-gated). Creates a pending tag + an
// unguessable token link the user shares through the native share sheet
// (WhatsApp / iMessage / etc.). Returns { token, url }.
export async function createTagInvite({ stamp_id, from_name }) {
  const { data, error } = await callWorker('passport/tag', { stamp_id, from_name });
  return { data, error };
}
// Preview a tag by its share token (for the claim card). No auth needed.
export async function getTagByToken(token) {
  const { data, error } = await callWorker('passport/tag/by-token', { token });
  return { tag: data?.tag || null, error };
}
// Claim a shared tag (recipient signed in): accept → stamp on my passport.
export async function claimTag(token, action) {
  const { data, error } = await callWorker('passport/tag/claim', { token, action });
  return { data, error };
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
