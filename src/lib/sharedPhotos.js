// Photos shared into the app from the phone's own share sheet: Photos / Gallery → Share →
// Globeskimmers (2026-10-17: a traveler sharing from the gallery found no Globeskimmers in the
// list). Native only. iOS's ShareExtension target and Android's SEND intent filters hand the
// files to @capgo/capacitor-share-target; they wait here until the Passport opens Stamp a place
// with them, since a share often starts a closed app before sign-in has finished. The iOS
// copies keep the photo's own location tag and capture time, the proof Stamp a place reads.
//
// Clips too (founder, 2026-10-30: "upload a video from my gallery … have the option to upload to
// city board"). A clip is never read whole into memory here — it can be hundreds of MB — it
// travels as a PATH ({ path, name, mimeType }); the phone's VideoShrink plugin reads it there,
// and on an install without the plugin the Contribute sheet reads it then, under the web rules.
import { Capacitor } from "@capacitor/core";
import { CapacitorShareTarget } from "@capgo/capacitor-share-target";

export const SHARED_PHOTOS_EVENT = "gs:shared-photos";
let waiting = { files: [], clips: [] };

// What was shared, handed over once: { files: File[] (photos), clips: [{ path, name, mimeType }] }.
export function takeSharedPhotos() {
  const out = waiting;
  waiting = { files: [], clips: [] };
  return out;
}

const isVideo = (f) => /^video\//i.test(f?.mimeType || "") || /\.(mp4|mov|m4v)(\?|$)/i.test(f?.name || f?.uri || "");
const clipType = (f) => (/^video\//i.test(f?.mimeType || "") ? f.mimeType : /\.mov(\?|$)/i.test(f?.name || f?.uri || "") ? "video/quicktime" : "video/mp4");

// A file path from the plugin (the app group on iOS, the cache on Android) read through the
// WebView's own file route.
async function toFile(f, i) {
  try {
    const res = await fetch(Capacitor.convertFileSrc(f.uri));
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = /^image\//.test(f.mimeType || "") ? f.mimeType : /^image\//.test(blob.type) ? blob.type : "image/jpeg";
    return new File([blob], f.name || `shared-${i + 1}.jpg`, { type });
  } catch { return null; }
}

// onShared runs once a share's photos are ready (AuthContext routes to the Passport). The
// plugin holds a share that arrives before this listener, so a cold start loses nothing. A
// store build from before the plugin answers "not implemented": null, quietly.
export function listenForSharedPhotos(onShared) {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  return CapacitorShareTarget.addListener("shareReceived", async (event) => {
    const list = (event?.files || []).filter((f) => f?.uri);
    const clips = list.filter(isVideo).map((f, i) => ({ path: f.uri, name: f.name || `shared-${i + 1}.mp4`, mimeType: clipType(f) }));
    const files = (await Promise.all(list.filter((f) => !isVideo(f)).map(toFile))).filter(Boolean);
    if (!files.length && !clips.length) return;
    waiting = { files, clips };
    window.dispatchEvent(new Event(SHARED_PHOTOS_EVENT));
    onShared?.();
  }).catch(() => null);
}
