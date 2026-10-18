// Photos shared into the app from the phone's own share sheet: Photos / Gallery → Share →
// Globeskimmers (2026-10-17: a traveler sharing from the gallery found no Globeskimmers in the
// list). Native only. iOS's ShareExtension target and Android's SEND intent filters hand the
// files to @capgo/capacitor-share-target; they wait here until the Passport opens Stamp a place
// with them, since a share often starts a closed app before sign-in has finished. The iOS
// copies keep the photo's own location tag and capture time, the proof Stamp a place reads.
import { Capacitor } from "@capacitor/core";
import { CapacitorShareTarget } from "@capgo/capacitor-share-target";

export const SHARED_PHOTOS_EVENT = "gs:shared-photos";
let waiting = [];

// The shared photos as File objects, handed over once.
export function takeSharedPhotos() {
  const out = waiting;
  waiting = [];
  return out;
}

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
    const files = (await Promise.all((event?.files || []).filter((f) => f?.uri).map(toFile))).filter(Boolean);
    if (!files.length) return;
    waiting = files;
    window.dispatchEvent(new Event(SHARED_PHOTOS_EVENT));
    onShared?.();
  }).catch(() => null);
}
