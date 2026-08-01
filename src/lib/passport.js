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
export async function uploadStampPhoto({ stamp_id, image, caption, visited_on, content_type }) {
  const { data, error } = await callWorker('passport/photo', { stamp_id, image, caption, visited_on, content_type });
  return { data, error };
}

export async function setStampDate(stamp_id, visited_on) {
  const { data, error } = await callWorker('passport/stamp/date', { stamp_id, visited_on });
  return { data, error };
}
export async function deleteStamp(stamp_id) {
  const { data, error } = await callWorker('passport/stamp/delete', { stamp_id });
  return { data, error };
}
export async function deleteStampPhoto(photo_id) {
  const { data, error } = await callWorker('passport/photo/delete', { photo_id });
  return { data, error };
}

// Buddy tagging (consent-gated). Tag by email → a pending stamp the recipient
// Allows/Declines. Response never reveals whether the email is a user.
export async function tagFriend({ stamp_id, email, from_name }) {
  const { data, error } = await callWorker('passport/tag', { stamp_id, email, from_name });
  return { data, error };
}
// My incoming pending tags (the "Tagged you" inbox).
export async function listTags() {
  const { data, error } = await callWorker('passport/tags', {});
  return { tags: data?.tags || [], error };
}
// Accept (mint the stamp on my passport) or decline a tag.
export async function respondTag(tag_id, action) {
  const { data, error } = await callWorker('passport/tag/respond', { tag_id, action });
  return { data, error };
}
