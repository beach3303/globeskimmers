// VideoShrink (founder, 2026-10-30): on the phone, a clip is read and shrunk before it goes up — the
// chosen 20 seconds as 720p H.264, a few MB — and where and when it was taken comes from the clip's
// own metadata. The native halves: ios/App/App/VideoShrinkPlugin.swift and
// android/.../VideoShrinkPlugin.java. The camera roll is opened by the native picker
// (@capawesome/capacitor-file-picker), which hands back paths the native side can read.
// On the web, or an install without the plugin, `available()` is false and the web picker's rules
// apply (a clip must already be 20 seconds and under 40 MB).
import { Capacitor, registerPlugin } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { CLIP_BYTES } from "@/lib/clips";

let plugin = null;
try { plugin = registerPlugin("VideoShrink"); } catch { plugin = null; }

export const CLIP_SECONDS = 20;
// What the export aims under — well below the 40 MB door (CLIP_BYTES). iOS honours it from the build
// that reads `maxBytes` (fileLengthLimit); before that, Apple's 720p preset ran ~10 Mbps and 20 seconds
// landed at ~26 MB — the founder's own clip, refused at the old 25 MB door on 2026-11-03.
export const SHRINK_BYTES = 22 * 1024 * 1024;
export const available = () => !!plugin && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("VideoShrink");

// Photos and clips from the camera roll, with paths. → [{ path, name, mimeType, size, duration }]
// Throws when the member cancels (the caller treats that as nothing picked).
export async function pickMedia(limit = 20) {
  const r = await FilePicker.pickMedia({ limit, skipTranscoding: true });
  return (r?.files || []).filter((f) => f && f.path);
}
export const isClipFile = (f) => /^video\//i.test(f?.mimeType || "") || /\.(mp4|mov|m4v)$/i.test(f?.name || "");

// { duration, width, height, size, lat?, lng?, takenAt? }
export async function probe(path) { return plugin.probe({ path }); }
// The seconds from `start`, shrunk → { path, duration, size }. A result still over the door gets one
// more pass at 540p; if that can't make it smaller (an older build only knows 720p), the first result
// stands and the door has the last word.
export async function shrink(path, start = 0, seconds = CLIP_SECONDS) {
  const first = await plugin.shrink({ path, start, duration: seconds, maxHeight: 720, maxBytes: SHRINK_BYTES });
  if (!(Number(first?.size) > CLIP_BYTES)) return first;
  let again = null;
  try { again = await plugin.shrink({ path, start, duration: seconds, maxHeight: 540, maxBytes: SHRINK_BYTES }); } catch { again = null; }
  return again && Number(again.size) > 0 && Number(again.size) < Number(first.size) ? again : first;
}

// A native file as a File the web code can read, through the app's own file URL. iOS answers a clip
// (.mp4/.mov, and audio) with a plain URLResponse so <video> can stream it, and WebKit's fetch reports
// that as status 0 with the whole body attached — photos answer 200 (measured 2026-11-03; it is why
// every iPhone clip came back "Couldn’t read the file"). So 0 with bytes is a read; only an HTTP
// refusal (Android's 404 for a missing file) or an empty body is not.
export async function fileAt(path, name, type) {
  const res = await fetch(Capacitor.convertFileSrc(path));
  if (!res.ok && res.status !== 0) throw new Error(`Couldn’t read the file (${res.status})`);
  const blob = await res.blob();
  if (!blob.size) throw new Error("Couldn’t read the file (empty)");
  return new File([blob], name, { type });
}
export const previewUrl = (path) => Capacitor.convertFileSrc(path);
