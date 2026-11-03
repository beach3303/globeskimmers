// Video postcards (planned 2026-10-30, built 2026-11-03): a clip on the front of a private
// postcard. The phone already shrank it to its 20 seconds (or the web rules apply); here its
// poster and four stills go through the postcard send — the same check photos get — and then the
// clip's bytes follow to PUT /postcards/video/<id>. The card shows, and knocks, once they land.
//
//   sendVideoPostcard({ file, filter, ...the postcard's fields }) → { data, error } like sendPostcard
import { workerUpload } from "@/lib/callWorker";
import { sendPostcard } from "@/lib/passport";
import { probeClip, clipStills, CLIP_SECONDS, CLIP_BYTES } from "@/lib/clips";

export async function sendVideoPostcard({ file, filter = null, ...card }) {
  const meta = await probeClip(file);
  if (!meta || !Number.isFinite(meta.duration) || meta.duration <= 0) return { data: null, error: "Couldn’t read this clip" };
  if (meta.duration > CLIP_SECONDS + 0.5) return { data: null, error: `Clips are up to ${CLIP_SECONDS} seconds — trim it first` };
  if (file.size > CLIP_BYTES) return { data: null, error: "That clip is too big — 25 MB at most" };
  let stills;
  try { stills = await clipStills(file, meta.duration); } catch { return { data: null, error: "Couldn’t read this clip" }; }
  const { data, error } = await sendPostcard({ ...card, image: stills.poster, kind: "video", frames: stills.frames, duration: Math.round(meta.duration * 10) / 10, filter });
  if (error || !data?.ok) return { data, error: error || data?.error || "Couldn’t send the postcard" };
  if (!data.upload) return { data, error: null };   // nobody could receive it: answered like a photo card
  const up = await workerUpload(data.upload, file, "video/mp4", { timeoutMs: 180000 });
  if (up.error || !up.data?.ok) return { data, error: up.data?.error || up.error || "The clip didn’t upload — try again" };
  return { data: { ...data, video: up.data.url || data.video }, error: null };
}
