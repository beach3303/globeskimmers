// Suggest a Place to Stamp (founder decisions 2026-10-10) — thin wrappers over
// the Worker's /places/suggest* routes, plus the small helpers every screen
// shares. Locals and people who've been suggest a real, public place; one
// person counts once per place; at 5 suggestions the founder reviews it, and
// an approved place becomes a "Local favorite" stamp (entity id lf:<id>).
// The worker resolves the user from the Supabase JWT (callWorker attaches it)
// and decides who may suggest — nothing here is trusted for that.
// A place is open | approved | declined | held (hidden by three reports until
// the founder decides) | removed (taken down); only open and approved places
// show on any list or page. A list's 'review' is an open place with 5+.
import { callWorker } from '@/lib/callWorker';

// Suggestions before the founder reviews a place. The count keeps going.
export const REVIEW_AT = 5;

// The reasons, in the form's order. Keys are the API, labels the form, short
// labels the chips in lists — identical to PS_REASONS in the worker.
export const REASONS = [
  { key: 'views', label: 'Breathtaking views or a great photo spot', short: 'Views & photos' },
  { key: 'walk', label: 'A fun walk, hike or place to explore', short: 'Walk or hike' },
  { key: 'history', label: 'Local history or culture', short: 'History & culture' },
  { key: 'family', label: 'Great for families and kids', short: 'Families' },
  { key: 'gem', label: 'A hidden gem locals love', short: 'Hidden gem' },
  { key: 'other', label: 'Other (write your own)', short: 'Other' },
];
const BY_KEY = Object.fromEntries(REASONS.map((r) => [r.key, r]));
export const reasonOf = (key) => BY_KEY[key] || null;

// "3 of 5" until a place reaches review, then "9 · in review".
export const progressLabel = (count) => (count >= REVIEW_AT ? `${count} · in review` : `${count} of ${REVIEW_AT}`);
// The same, read aloud: "3 of 5 suggestions", then "9 suggestions, in review".
export const progressSpoken = (count) => (count >= REVIEW_AT ? `${count} suggestions, in review` : `${count} of ${REVIEW_AT} suggestions`);
// The bar's width toward review, full from 5 on.
export const progressPct = (count) => `${Math.min(100, Math.round(((Number(count) || 0) / REVIEW_AT) * 100))}%`;
// A place's town for one-line lists ("Pasadena"), else its region or country.
export const placeWhere = (p) => (p && (p.city || p.region || p.country)) || '';

// Who may suggest at a point → { eligible, who: 'local'|'visitor'|null, homeCity }.
// city (the point's town) only matters when the profile has no home pin.
export async function checkSuggest({ lat, lng, city } = {}) {
  const { data, error } = await callWorker('places/suggest/check', { lat, lng, ...(city ? { city } : {}) });
  return { eligible: data?.eligible === true, who: data?.who || null, homeCity: data?.home_city || null, error: error || data?.error || null, code: data?.code || null };
}

// Suggest a place (or update my reason/photo for one I already suggested).
// The worker works out the town, region and country from the point itself
// (2026-10-12); the ones sent from here are ignored.
// image: a data URL from resizePhoto, optional. Resolves { added, place } —
// added is false when this person had suggested it before — or { error, code }:
// teen_hold / under_age (403), age_required (428), not_eligible (403),
// moderated / photo_blocked (400), busy (429, ten a day), held (409: reports
// hid this place until the founder decides — try again later), declined (409:
// the founder declined or removed this place; nothing is kept).
export async function suggestPlace({ name, lat, lng, city, region, country, reason, other_text, image }) {
  const body = {
    name, lat, lng, reason,
    ...(city ? { city } : {}), ...(region ? { region } : {}), ...(country ? { country } : {}),
    ...(reason === 'other' ? { other_text } : {}),
    ...(image ? { image } : {}),
  };
  // The text and the photo are both moderated before anything is kept: slower
  // than a plain write, so a longer timeout than the 25 s default.
  const { data, error } = await callWorker('places/suggest', body, { timeoutMs: 45000 });
  const failed = error || !data?.ok;
  return {
    added: data?.added === true,
    place: failed ? null : data.place || null,
    error: failed ? (error || data?.error || 'Could not send your suggestion') : null,
    code: data?.code || null,
  };
}

// Everyone's suggestions (open and approved only — never held, declined or
// removed). sort: 'near' (within 60 km of lat/lng, nearest first — empty
// without a point), 'liked', 'new', or 'mine' (the open places I suggested and
// the ones approved after my suggestion, latest decision first). limit ≤ 50.
export async function listSuggestions({ lat, lng, sort = 'near', limit = 20 } = {}) {
  const at = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {};
  const { data, error } = await callWorker('places/suggestions', { ...at, sort, limit });
  return { places: Array.isArray(data?.places) ? data.places : [], error: error || data?.error || null, code: data?.code || null };
}

// One place with its 5 newest "Other" texts and 6 newest photos. notFound:
// unknown, held, declined or removed, or no suggestions left.
export async function getSuggestion(id) {
  const { data, error } = await callWorker('places/suggestion', { id });
  const err = error || data?.error || null;
  return { place: err ? null : data?.place || null, error: err, code: data?.code || null, notFound: !!err && /not found/i.test(err) };
}

// What a person is told when a place left the lists after their screen
// loaded it (hidden by reports, declined or removed) — a like or a report.
export const PLACE_GONE = 'This place isn’t on the list anymore.';

// Like a place (reason '') or one of its reasons ("I agree"), as a toggle.
// Resolves the server's totals: { likes, reasonLikes: {key: n}, my }. A place
// that is no longer open or approved answers 404: notFound, and the error
// says so in words (2026-10-12) — never a bare "Not found".
export async function likePlace(id, { reason = '', on } = {}) {
  const { data, error } = await callWorker('places/like', { id, reason: reason || '', on: !!on });
  const err = error || (data && data.ok !== true ? data.error || 'Could not save that' : null);
  const notFound = !!err && /not found/i.test(err);
  return { likes: data?.likes, reasonLikes: data?.reason_likes || null, my: data?.my || null, error: notFound ? PLACE_GONE : err, code: data?.code || null, notFound };
}

// What a place can be reported for, in the sheet's order. Keys are the API
// (PS_REPORT_REASONS in the worker), labels the sheet and the admin desk.
export const REPORT_REASONS = [
  { key: 'not_real', label: 'Not a real public place' },
  { key: 'offensive', label: 'Offensive or unkind' },
  { key: 'private', label: 'A private home or property' },
  { key: 'spam', label: 'Spam or advertising' },
  { key: 'other', label: 'Something else' },
];

// Report a place (2026-10-12) — anything people post must be reportable.
// Anyone signed in may, teens too: it's a safety door, not publishing. One
// report per person per place; three hide an open place ('held') until the
// founder decides. Resolves { ok, already } — already: this person had
// reported it before — or { error, code, notFound }: under_age (403),
// notFound (404: unknown, declined or removed).
export async function reportPlace(id, reason) {
  const { data, error } = await callWorker('places/report', { id, reason });
  const failed = error || !data?.ok;
  const err = failed ? (error || data?.error || 'Could not send your report') : null;
  return { ok: !failed, already: !failed && data?.already === true, error: err, code: data?.code || null, notFound: !!err && /not found/i.test(err) };
}

// The founder's review desk (admin only): { op: 'list', tab } → { places, counts }
// — tabs ready | approved | declined | reported, counts for all four, and on
// every place reports: { n, reasons: { key: n } } (its unresolved reports);
// { op: 'decide', id, decision } → { ok } — approved / declined need 5+ (409
// otherwise); removed (a takedown) and keep (the reports were wrong: they're
// cleared and a held place reopens) work at any count;
// { op: 'csv', as: 'json' } → { filename, csv }.
export async function adminPlaceSuggestions(body, opts) {
  const { data, error } = await callWorker('admin/place-suggestions', body || {}, opts);
  return { data, error: error || data?.error || null };
}

// The town, region and country at a point, for the place's own record. The
// precise (~110 m) lookup: the coarse one names a whole 11 km tile after
// whichever town was looked up there first.
export async function cityAt(lat, lng) {
  const { data, error } = await callWorker('reverse-geocode', { latitude: lat, longitude: lng, precise: true });
  if (error || !data || data.error) return null;
  const region = data.region || (data.state_or_country && data.state_or_country !== data.country ? data.state_or_country : '');
  return { city: data.city || null, region: region || null, country: data.country || null };
}

// ── Likes on screen ─────────────────────────────────────────────────────────
// A heart flips at once and settles on the server's totals; a failure puts it
// back. These work on a PlaceSummary wherever a screen keeps it.
const myOf = (p) => p?.my || { suggested: false, reason: null, liked: false, liked_reasons: [] };
export const isLiked = (p, reason = '') => (reason ? (myOf(p).liked_reasons || []).includes(reason) : !!myOf(p).liked);

export function withLike(p, reason, on) {
  if (!p || isLiked(p, reason) === on) return p;
  const my = myOf(p), step = on ? 1 : -1;
  if (!reason) return { ...p, likes: Math.max(0, (p.likes || 0) + step), my: { ...my, liked: on } };
  const mine = my.liked_reasons || [];
  return {
    ...p,
    reasons: (p.reasons || []).map((r) => (r.key === reason ? { ...r, likes: Math.max(0, (r.likes || 0) + step) } : r)),
    my: { ...my, liked_reasons: on ? [...mine, reason] : mine.filter((k) => k !== reason) },
  };
}

// The server's answer, for the one heart this request toggled — the place's
// likes, or one reason's "I agree" — and nothing else: another heart tapped
// while this one was on the wire has its own answer coming, and this one's
// older view of it would undo that tap on screen.
function withLikeResult(p, reason, res) {
  if (!p) return p;
  const my = myOf(p);
  if (!reason) {
    return {
      ...p,
      likes: Number.isFinite(res.likes) ? res.likes : p.likes,
      my: typeof res.my?.liked === 'boolean' ? { ...my, liked: res.my.liked } : p.my,
    };
  }
  const n = res.reasonLikes?.[reason];
  const mine = my.liked_reasons || [];
  const on = Array.isArray(res.my?.liked_reasons) ? res.my.liked_reasons.includes(reason) : null;
  return {
    ...p,
    reasons: Number.isFinite(n) ? (p.reasons || []).map((r) => (r.key === reason ? { ...r, likes: n } : r)) : p.reasons,
    my: on === null ? p.my : { ...my, liked_reasons: on ? (mine.includes(reason) ? mine : [...mine, reason]) : mine.filter((k) => k !== reason) },
  };
}

// Toggle a like on `place` (reason '' = the place itself). update(fn) applies
// fn to this place in the caller's state. Resolves likePlace's result.
export async function toggleLike(place, reason, update) {
  const on = !isLiked(place, reason);
  update((p) => withLike(p, reason, on));
  const res = await likePlace(place.id, { reason, on });
  if (res.error) update((p) => withLike(p, reason, !on));
  else update((p) => withLikeResult(p, reason, res));
  return res;
}
