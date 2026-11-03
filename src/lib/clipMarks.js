// Marks a clip can wear (founder, 2026-11-03: "the marks only we can put on a clip"). A house frame and
// the verified stamp outro are stored with the clip as `marks` ({ frame, outro }) and drawn at playback
// from the clip's own verified city and date — nothing is re-encoded, and they ride the same road as
// the looks. The worker keeps the same frame names (BC_CLIP_FRAMES) and drops any other.
export const CLIP_FRAMES = [
  { id: "none", name: "None" },
  { id: "airmail", name: "Airmail" },
  { id: "postmark", name: "Postmark" },
  { id: "passport", name: "Passport page" },
  { id: "print", name: "Print" },
];
export const CLIP_FRAME_IDS = CLIP_FRAMES.filter((f) => f.id !== "none").map((f) => f.id);

// The marks as the app stores them: null when nothing is on, else { frame?, outro? }.
export function packMarks({ frame, outro }) {
  const out = {};
  if (frame && CLIP_FRAME_IDS.includes(frame)) out.frame = frame;
  if (outro) out.outro = true;
  return Object.keys(out).length ? out : null;
}
export const frameOf = (marks) => (marks && typeof marks === "object" && CLIP_FRAME_IDS.includes(marks.frame) ? marks.frame : null);
export const outroOf = (marks) => !!(marks && typeof marks === "object" && marks.outro === true);

// "12 OCT 2026" from an ISO date or date-time; "" when there is none.
export function markDate(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}
