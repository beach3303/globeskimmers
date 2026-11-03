// Marks a clip can wear (founder, 2026-11-03: "the marks only we can put on a clip"). A house frame, the
// verified stamp outro, how far the spot is from home, the light at the shot and the flight path are
// stored with the clip as `marks` and drawn at playback from the clip's own verified city, spot and
// date — nothing is re-encoded, and they ride the same road as the looks. The sheet sends what the
// member asked for ({ frame, outro, home, light, flight }); the worker keeps the frame and the stamp,
// and replaces the rest with what only it can work out: home_mi (miles from the sender's home, never
// the home itself), light (golden | blue | night | day) and local (the wall-clock time of the shot).
export const CLIP_FRAMES = [
  { id: "none", name: "None" },
  { id: "airmail", name: "Airmail" },
  { id: "postmark", name: "Postmark" },
  { id: "passport", name: "Passport page" },
  { id: "print", name: "Print" },
];
export const CLIP_FRAME_IDS = CLIP_FRAMES.filter((f) => f.id !== "none").map((f) => f.id);

// The marks as the sheet asks for them: null when nothing is on.
export function packMarks({ frame, outro, home = false, light = false, flight = false }) {
  const out = {};
  if (frame && CLIP_FRAME_IDS.includes(frame)) out.frame = frame;
  if (outro) out.outro = true;
  if (home) out.home = true;
  if (light) out.light = true;
  if (flight) out.flight = true;
  return Object.keys(out).length ? out : null;
}
const obj = (m) => (m && typeof m === "object" ? m : null);
export const frameOf = (marks) => (obj(marks) && CLIP_FRAME_IDS.includes(marks.frame) ? marks.frame : null);
export const outroOf = (marks) => !!(obj(marks) && marks.outro === true);
export const flightOf = (marks) => !!(obj(marks) && marks.flight === true && Number.isFinite(Number(marks.home_mi)));
export const homeMilesOf = (marks) => (obj(marks) && Number.isFinite(Number(marks.home_mi)) ? Number(marks.home_mi) : null);

export const LIGHT_WORDS = { golden: "Golden hour", blue: "Blue hour", night: "After dark", day: null };
// The line under a clip: ["6,012 mi from home", "Golden hour", "Shot at 7:42 PM"] — whatever it carries.
export function marksLine(marks) {
  const m = obj(marks);
  if (!m) return [];
  const parts = [];
  const mi = homeMilesOf(m);
  if (mi != null) parts.push(mi < 30 ? "Near home" : `${mi.toLocaleString()} mi from home`);
  if (m.light && LIGHT_WORDS[m.light]) parts.push(LIGHT_WORDS[m.light]);
  if (m.local) parts.push(`Shot at ${m.local}`);
  return parts;
}

// "12 OCT 2026" from an ISO date or date-time; "" when there is none.
export function markDate(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}
