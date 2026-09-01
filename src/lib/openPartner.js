// openPartner — the ONE way the app hands a traveler to a partner site.
//
// Why this exists (founder call, 2026-08-31 — "as much in-app as we can"):
// three money paths (Viator tours, Events, Stay22 hotels) used bare
// window.open(_blank). Inside a Capacitor shell on iOS that ejects the user to
// Safari, where viator.com's Universal Links then hand off to the Viator native
// app — a fresh session, so they sign in again — and the affiliate's "mobile web
// only" tracking is lost on the way. Two other screens already did it right.
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

// openPartnerAndWait — the same sheet, but resolves when the traveler closes it
// (native `browserFinished`). Used by in-app checkout: when the payment sheet
// closes we ask the worker whether the session booked.
//
// Returns true only when it actually WAITED for the sheet to close. Web has no
// close signal: it opens a tab and resolves at once with false — the caller must
// not poll on its own there (the session is legitimately still "pending" while
// the traveler types a card number in the other tab) and instead offers
// "I've paid — check my booking".
export async function openPartnerAndWait(url) {
  if (!url) return false;
  if (!Capacitor.isNativePlatform()) {
    try { window.open(url, "_blank", "noopener"); } catch { /* ignore */ }
    return false;
  }
  await new Promise((resolve) => {
    let done = false, handle = null;
    const finish = () => { if (done) return; done = true; try { handle?.remove?.(); } catch { /* ignore */ } resolve(); };
    Browser.addListener("browserFinished", finish).then((h) => { handle = h; }).catch(() => {});
    Browser.open({ url, presentationStyle: "popover" }).catch(() => finish());
  });
  return true;
}
