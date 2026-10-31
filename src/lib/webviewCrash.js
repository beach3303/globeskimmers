// webviewCrash — when the Android WebView's renderer died on the previous run, MainActivity.java
// noted it (Preferences key gs_webview_gone_v1) and restarted the activity instead of letting
// Android kill the app (2026-10-30: the founder's Samsung S10 "closes completely" at the first
// location request). On the next start the note becomes one analytics event, so the admin's
// events show which phones and pages it happens on. Native only; a missing note costs nothing.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { logEvent } from "@/lib/analytics";

const KEY = "gs_webview_gone_v1";
let done = false;

export async function reportWebViewCrashOnce() {
  if (done || !Capacitor.isNativePlatform()) return;
  done = true;
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return;
    let note = {};
    try { note = JSON.parse(value) || {}; } catch { note = { raw: String(value).slice(0, 200) }; }
    const ua = typeof navigator !== "undefined" ? String(navigator.userAgent || "") : "";
    const chrome = (ua.match(/Chrome\/(\d+)/) || [])[1] || null;
    logEvent("webview_renderer_gone", { ...note, platform: Capacitor.getPlatform(), chrome, ua: ua.slice(0, 160) }, "App");
    await Preferences.remove({ key: KEY });
  } catch { /* nothing to report */ }
}
