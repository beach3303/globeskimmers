// pickPhotosNative — the phone's own photo picker for the Passport's doors (2026-11-21).
//
// Why: iOS's WEB file picker hands the app a JPEG with the location tag removed, so every photo
// proof read "no location" (the event log: 25 of 25 reads without GPS in the last two weeks) —
// the passport still stamped through the picture itself, but City Boards, which need the place,
// refused. The native picker (@capawesome/capacitor-file-picker, already in the build for clips)
// copies the original file, location and capture time included, and src/lib/photoExif.js reads it.
//
//   canPickNative()                 true on a phone with the plugin; the web input is the fallback
//   pickPhotosNative(limit) → { files: File[], clips: [{ path, name, mimeType }] } | null (cancelled)
//
// Photos come back as Files (the original bytes); clips stay paths, the way the share sheet hands
// them over, so the photo sorter and the Contribute sheet treat them as today.
import { available, pickMedia, fileAt, isClipFile } from "@/lib/videoShrink";

export const canPickNative = () => { try { return available(); } catch { return false; } };

export async function pickPhotosNative(limit = 20) {
  let picked;
  try { picked = await pickMedia(limit); } catch { return null; }   // cancelled
  if (!picked || !picked.length) return null;
  const files = [];
  const clips = [];
  for (const f of picked) {
    if (isClipFile(f)) { clips.push({ path: f.path, name: f.name || "clip.mp4", mimeType: f.mimeType || "video/mp4" }); continue; }
    try { files.push(await fileAt(f.path, f.name || "photo.jpg", f.mimeType || "image/jpeg")); } catch { /* skip one that would not read */ }
  }
  return files.length || clips.length ? { files, clips } : null;
}
