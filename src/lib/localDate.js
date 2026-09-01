// localISODate — the phone's LOCAL calendar date as YYYY-MM-DD.
//
// `new Date().toISOString().slice(0, 10)` is the UTC date: at 8pm in Los
// Angeles it is already "tomorrow", so evening stamps recorded a visit date
// the traveler never lived (audit 2026-09-01: ActivityDetail:254, Passport:361).
// Use this for anything that means "today, where I am standing".
export function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
