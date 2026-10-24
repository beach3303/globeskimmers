// pushAlerts — alerts outside the app (build 1.0.6, founder 2026-10-19). The phone's own
// notification: a postcard, a follow, a reaction on your pages, the inner circle's stamps
// once a day. Asked for in context, never at launch: after a postcard is sent or someone is
// followed (askForAlerts). The token the phone hands back goes to the worker (push/register),
// which decides every alert (adults only, the member's switches, quiet hours, a weekly cap).
// Tapping an alert opens the screen it names (route) through AuthContext's pendingRoute.
// On the web, or a build without the plugin, every call is a quiet no-op.
//
//   attachPushListeners(onRoute)  once, at start: registration → the worker; a tap → onRoute
//   syncPushToken()               every open once signed in: re-register when already allowed
//   askForAlerts()                the in-context ask; resolves the permission ('granted' …)
//   askAlertsOnce()               the first open after sign-up asks once (founder, 2026-10-19: "on by
//                                 default" — the phone still needs one Allow; it's asked up front)
//   pushPermission()              'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unavailable'
//   unregisterPush()              on sign-out: this phone stops getting this account's alerts
//   testAlerts()                  Settings → Notifications "Send a test": re-registers, then knocks once
//                                 → { sent, phones, error }
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';

// callWorker is loaded when first needed: AuthContext imports this file, and a load-time
// import chain back into the auth layer would be a cycle (the boot check caught one).
const worker = async (route, body) => (await import('@/lib/callWorker')).callWorker(route, body);
const KEY = 'gs_push_token';
const native = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
let listening = false;
let onRegistered = null; // testAlerts waits here until the worker has this phone's token

async function versionLabel() {
  try { const i = await App.getInfo(); return `${i.version} (${i.build})`; } catch { return null; }
}

export async function pushPermission() {
  if (!native()) return 'unavailable';
  try { return (await PushNotifications.checkPermissions()).receive || 'unavailable'; } catch { return 'unavailable'; }
}

export function attachPushListeners(onRoute) {
  if (!native() || listening) return;
  listening = true;
  PushNotifications.addListener('registration', async ({ value }) => {
    if (!value) return;
    try { localStorage.setItem(KEY, value); } catch { /* storage off */ }
    await worker('push/register', { token: value, platform: Capacitor.getPlatform(), app_version: await versionLabel() }).catch(() => {});
    if (onRegistered) { const done = onRegistered; onRegistered = null; done(); }
  });
  PushNotifications.addListener('registrationError', () => { /* no token this time; the next open tries again */ });
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const d = (notification && notification.data) || {};
    const route = typeof d.route === 'string' ? d.route : null;
    // Only a path of ours, never an outside address.
    if (route && /^\/[A-Za-z0-9?=&_-]*$/.test(route) && typeof onRoute === 'function') onRoute(route);
  });
  if (Capacitor.getPlatform() === 'android') {
    PushNotifications.createChannel({ id: 'alerts', name: 'Notifications', description: 'Postcards, follows and your passport', importance: 4, visibility: 1, vibration: true }).catch(() => {});
  }
}

export async function syncPushToken() {
  if (!native()) return;
  try {
    const p = await PushNotifications.checkPermissions();
    if (p.receive === 'granted') await PushNotifications.register();
  } catch { /* no alerts this open */ }
}

export async function askForAlerts() {
  if (!native()) return 'unavailable';
  try {
    let p = await PushNotifications.checkPermissions();
    if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') p = await PushNotifications.requestPermissions();
    if (p.receive === 'granted') await PushNotifications.register();
    return p.receive || 'unavailable';
  } catch { return 'unavailable'; }
}

const ASKED = 'gs_push_asked_v1';
export async function askAlertsOnce() {
  if (!native()) return;
  try {
    if (localStorage.getItem(ASKED)) return;
    const p = await PushNotifications.checkPermissions();
    if (p.receive !== 'prompt' && p.receive !== 'prompt-with-rationale') { localStorage.setItem(ASKED, '1'); return; }
    localStorage.setItem(ASKED, '1');
    await askForAlerts();
  } catch { /* asked another time, in context */ }
}

export async function unregisterPush() {
  if (!native()) return;
  let t = null;
  try { t = localStorage.getItem(KEY); localStorage.removeItem(KEY); } catch { /* storage off */ }
  if (t) await worker('push/unregister', { token: t }).catch(() => {});
}

export async function testAlerts() {
  if (!native()) return { sent: 0, phones: 0, error: 'unavailable' };
  try {
    if ((await PushNotifications.checkPermissions()).receive !== 'granted') return { sent: 0, phones: 0, error: 'not_allowed' };
    // Register again first, so a phone whose token never reached us is fixed by the test itself.
    await new Promise((resolve) => {
      onRegistered = resolve;
      setTimeout(() => { if (onRegistered === resolve) onRegistered = null; resolve(); }, 6000);
      PushNotifications.register().catch(() => resolve());
    });
    const { data, error } = await worker('push/test', {});
    return { sent: Number(data?.sent) || 0, phones: Number(data?.phones) || 0, error: error || data?.error || null };
  } catch { return { sent: 0, phones: 0, error: 'failed' }; }
}
