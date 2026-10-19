// passportGate — the required passport (a full birthday, and a @username at 18+) is asked
// for when it is first needed — a stamp, a photo, a postcard, a share, a follow — not at the
// door (founder, 2026-10-19: "yes" to moving it from the open to right after the first
// stamps appear). src/lib/passport.js calls requirePassport() before those writes;
// FinishPassport registers the screens while it is mounted.
//
//   requirePassport()   → Promise<boolean>: true once the account is complete (at once when
//                         it already was), false when the member signed out instead. With no
//                         FinishPassport mounted (mid-onboarding, signed out) it resolves
//                         true and the worker's own gates decide.
//   registerPassportGate(fn)   FinishPassport's trigger; returns the unregister.
//   passportGateDone(ok)       FinishPassport answers every waiting call.
let handler = null;
let waiting = [];

export function registerPassportGate(fn) {
  handler = fn;
  return () => { if (handler === fn) { handler = null; passportGateDone(true); } };
}

export function requirePassport() {
  if (typeof handler !== 'function') return Promise.resolve(true);
  return new Promise((resolve) => { waiting.push(resolve); handler(); });
}

export function passportGateDone(ok) {
  const w = waiting;
  waiting = [];
  for (const r of w) r(ok === true);
}
