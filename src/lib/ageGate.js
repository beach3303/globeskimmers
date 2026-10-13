// src/lib/ageGate.js
//
// The worker's age refusals, heard in one place. A write refused for an age
// reason answers 403 with one of these codes (in `code`, or as the bare
// `error` text):
//   confirm_birthday  the account holds only a birth year, and that year
//                     could fall on either side of a birthday that matters,
//                     so stamping and posting wait for the month and day
//                     (go-live decision 2, 2026-10-13)
//   under_age         the account is frozen (under 13)
//   teen_hold         13-17: social and publishing are held until 18
// callWorker announces each one on window as AGE_GATE_EVENT. AuthContext then
// re-reads the tier, and the confirm-birthday sheet opens on
// confirm_birthday. Whichever screen made the call, the person lands on the
// right screen, and no call site has to remember to.
export const AGE_GATE_EVENT = 'gs:age-gate';
export const AGE_CODES = ['confirm_birthday', 'under_age', 'teen_hold'];
// A birthday was saved: the tier may have changed, so it is re-read.
export const BIRTHDAY_SAVED = 'birthday_saved';

// What a bare code reads as when the worker sent no words of its own.
const SAY = {
  confirm_birthday: 'Confirm your birthday first. It only takes a moment.',
  under_age: "GlobeSkimmers isn't available on this account",
  teen_hold: 'Social features open at age 18',
};

// The age code in a refusal's body, or null.
export function ageCodeOf(body) {
  if (!body || typeof body !== 'object') return null;
  if (AGE_CODES.includes(body.code)) return body.code;
  return AGE_CODES.includes(body.error) ? body.error : null;
}

// The words to show: the worker's own when it sent any, never a bare code.
export function ageErrorText(body, code) {
  const e = body && typeof body === 'object' ? body.error : null;
  return e && e !== code ? String(e) : SAY[code] || String(code);
}

export function announceAgeGate(code) {
  try { window.dispatchEvent(new CustomEvent(AGE_GATE_EVENT, { detail: { code } })); } catch { /* no window */ }
}

// A 4xx/5xx from the worker as callWorker returns it: the body is kept (e.g.
// username suggestions on a 409). A 403 for an age reason is also announced
// app-wide, carries its code in data.code, and never shows a bare code as its
// error text.
export function refusal(status, body) {
  const code = status === 403 ? ageCodeOf(body) : null;
  if (!code) return { data: body ?? null, error: body?.error || `HTTP ${status}` };
  announceAgeGate(code);
  return { data: { ...body, code }, error: ageErrorText(body, code) };
}

// Exact age in whole years on `now` (UTC, like the worker) for a full
// birthday: year + 'MM-DD'. null when either part isn't a real date. Used by
// the Admin portal's Age appeal form to label (and refuse) a correction
// before it is sent; the worker decides the tier.
export function ageOnDate(year, md, now = new Date()) {
  const y = Math.round(Number(year));
  const m = /^(\d{2})-(\d{2})$/.exec(String(md || ''));
  if (!m || !(y >= 1900)) return null;
  const mo = Number(m[1]), d = Number(m[2]);
  const born = new Date(Date.UTC(y, mo - 1, d));
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== mo - 1 || born.getUTCDate() !== d) return null;
  if (born.getTime() > now.getTime()) return null;
  const nm = now.getUTCMonth() + 1, nd = now.getUTCDate();
  const had = nm > mo || (nm === mo && nd >= d);
  return now.getUTCFullYear() - y - (had ? 0 : 1);
}
