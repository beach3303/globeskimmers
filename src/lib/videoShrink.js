// VideoShrink (founder, 2026-10-30): on the phone, a clip is read and shrunk before it goes up — the
// chosen 20 seconds as 720p H.264, a few MB — and where and when it was taken comes from the clip's
// own metadata. The native halves: ios/App/App/VideoShrinkPlugin.swift and
// android/.../VideoShrinkPlugin.java. The camera roll is opened by the native picker
// (@capawesome/capacitor-file-picker), which hands back paths the native side can read.
// On the web, or an install without the plugin, `available()` is false and the web picker's rules
// apply (a clip must already be 20 seconds and under 25 MB).
import { Capacitor, registerPlugin } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";

let plugin = null;
try { plugin = registerPlugin("VideoShrink"); } catch { plugin = null; }

export const CLIP_SECONDS = 20;
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
// The seconds from `start`, shrunk → { path, duration, size }
export async function shrink(path, start = 0, seconds = CLIP_SECONDS) { return plugin.shrink({ path, start, duration: seconds, maxHeight: 720 }); }

// A native file as a File the web code can read, through the app's own file URL.
export async function fileAt(path, name, type) {
  const res = await fetch(Capacitor.convertFileSrc(path));
  if (!res.ok) throw new Error("Couldn’t read the file");
  return new File([await res.blob()], name, { type });
}
export const previewUrl = (path) => Capacitor.convertFileSrc(path);
