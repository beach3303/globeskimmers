// Clips (founder, 2026-10-30): 20-second videos on City Boards, hosted on R2 like the photos. A clip
// is picked from the camera roll in the same spot as photos; the phone reads it (length, where and
// when it was taken, a poster frame and four stills) and sends it in two steps: the stills go
// through the photo check first (`/board/contribute`, kind 'video'), the clip's bytes follow
// (`PUT /board/video/<id>`) only once that passes. Nothing here needs a native plugin; the
// shrinking step (a native export to 720p H.264) comes before `contributeClip` when it lands.
import { callWorker, workerUpload } from "@/lib/callWorker";

export const CLIP_SECONDS = 20;
export const CLIP_BYTES = 25 * 1024 * 1024;
export const isClip = (file) => /^video\//i.test(file?.type || "") || /\.(mp4|mov|m4v)$/i.test(file?.name || "");
// "0:06"
export const clipLength = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };

// Length and size from the file's own header — no decode, no upload.
export function probeClip(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata"; v.muted = true; v.playsInline = true;
    const done = (r) => { URL.revokeObjectURL(url); v.removeAttribute("src"); resolve(r); };
    v.onloadedmetadata = () => done({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => done(null);
    v.src = url;
  });
}

// A poster (half a second in) and four stills across the clip, as JPEG data URLs no wider than 960.
export async function clipStills(file, duration) {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "auto"; v.muted = true; v.playsInline = true; v.src = url;
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("Couldn’t read this clip")); });
  const d = Number.isFinite(duration) && duration > 0 ? duration : (v.duration || 1);
  const scale = Math.min(1, 960 / (v.videoWidth || 960));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round((v.videoWidth || 960) * scale));
  c.height = Math.max(2, Math.round((v.videoHeight || 540) * scale));
  const ctx = c.getContext("2d");
  const grab = async (t) => {
    const at = Math.min(Math.max(0, t), Math.max(0, d - 0.05));
    if (Math.abs(v.currentTime - at) > 0.02) await new Promise((res) => { const on = () => { v.removeEventListener("seeked", on); res(); }; v.addEventListener("seeked", on); v.currentTime = at; });
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  };
  try {
    const poster = await grab(Math.min(0.5, d / 2));
    const frames = [];
    for (const f of [0.1, 0.35, 0.6, 0.85]) frames.push(await grab(d * f));
    return { poster, frames };
  } finally { URL.revokeObjectURL(url); v.removeAttribute("src"); }
}

// Where and when a clip was taken, from the file's own metadata: the ISO 6709 location string
// iPhones and most Android cameras write ("+34.1016-118.3267+045.000/"), and the creation date
// iPhones write. Read from the file's head and tail only (the index can sit at either end).
export async function readClipLocation(file) {
  const MAX = 4 * 1024 * 1024;
  const parts = file.size > 2 * MAX ? [file.slice(0, MAX), file.slice(file.size - MAX)] : [file];
  const dec = new TextDecoder("latin1");
  let lat = null, lng = null, taken_at = null;
  for (const p of parts) {
    const s = dec.decode(new Uint8Array(await p.arrayBuffer()));
    if (lat == null) {
      const m = /([+-]\d{1,2}\.\d{2,})([+-]\d{1,3}\.\d{2,})(?:[+-]\d+(?:\.\d+)?)?\//.exec(s);
      if (m) { lat = Number(m[1]); lng = Number(m[2]); }
    }
    if (!taken_at) {
      const t = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?[+-]\d{2}:?\d{2}/.exec(s);
      if (t) taken_at = t[1];
    }
    if (lat != null && taken_at) break;
  }
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { lat, lng, taken_at } : { lat: null, lng: null, taken_at };
}

// The whole send. → the worker's answer ({ ok, id, url, video, board, progress, reward }) or
// { ok: false, code, error }. onStep: 'stills' | 'check' | 'upload'.
export async function contributeClip({ file, exif, caption = "", onStep = undefined }) {
  const meta = await probeClip(file);
  if (!meta || !Number.isFinite(meta.duration) || meta.duration <= 0) return { ok: false, code: "unreadable", error: "Couldn’t read this clip" };
  if (meta.duration > CLIP_SECONDS + 0.5) return { ok: false, code: "too_long", error: `Clips are up to ${CLIP_SECONDS} seconds — trim it first` };
  if (file.size > CLIP_BYTES) return { ok: false, code: "too_big", error: "That clip is too big — 25 MB at most" };
  onStep?.("stills");
  let stills;
  try { stills = await clipStills(file, meta.duration); } catch { return { ok: false, code: "unreadable", error: "Couldn’t read this clip" }; }
  onStep?.("check");
  const { data, error } = await callWorker("board/contribute", { kind: "video", image: stills.poster, frames: stills.frames, exif: exif || {}, caption, duration: Math.round(meta.duration * 10) / 10 }, { timeoutMs: 90000 });
  if (error || !data?.ok || !data.upload) return { ok: false, code: data?.code || null, error: data?.error || error || "Upload failed" };
  onStep?.("upload");
  const up = await workerUpload(data.upload, file, "video/mp4", { timeoutMs: 180000 });
  if (up.error || !up.data?.ok) {
    // The poster row without its clip would never show; take it down so it doesn't count.
    await callWorker("board/contributions/delete", { id: data.id }).catch(() => {});
    return { ok: false, code: up.data?.code || null, error: up.data?.error || up.error || "The clip didn’t upload — try again" };
  }
  return { ...data, ok: true, video: up.data.url || data.video };
}
