// openPartner — the ONE way the app opens an outside site (an attraction's
// official website, a photo's license page). There is no booking in the app
// (founder, 2026-10-03); this only keeps outside pages in an in-app sheet.
//
// Native → Capacitor Browser (SFSafariViewController on iOS, Chrome Custom Tabs
// on Android): stays inside the app as a sheet with a Done button, keeps its own
// cookie jar between openings (so a partner login persists), honors affiliate
// cookies, and does NOT bounce the initial load to a partner's native app.
// Web → a normal new tab.
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export async function openPartner(url) {
  if (!url) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url, presentationStyle: "popover" });
    } else {
      window.open(url, "_blank", "noopener");
    }
  } catch {
    try { window.open(url, "_blank"); } catch { /* ignore */ }
  }
}
