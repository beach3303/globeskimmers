// appUpdate — is a newer GlobeSkimmers waiting in this phone's store? (founder, 2026-10-24: "only
// my phone has notification … can we spread the love to all iphones and androids?") Alerts need
// the push plugin, which only a store build carries — an OTA can't add it — so phones on an
// older store build are asked to update.
//
// The live store versions are in site/app-version.json ({ "ios": "1.0.5", "android": "1.0.9" }),
// set by hand the day Apple / Google release a build; null = nothing to offer. So no card ever
// points at a store page that has no update yet. Web: never.
//
//   storeUpdate()     → { url, where, alerts } when this phone's build is older than its store's,
//                       else null. where: 'in the App Store' / 'on Google Play'.
//                       alerts: this build has no alert plugin, so the update brings them.
//   alertsNeedStore() → true on a phone build without the alert plugin
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const VERSIONS = 'https://globeskimmers.io/app-version.json';
const STORES = {
  ios: { url: 'https://apps.apple.com/app/id6753154199', where: 'in the App Store' },
  android: { url: 'https://play.google.com/store/apps/details?id=com.globeskimmers.app', where: 'on Google Play' },
};

// '1.0.10' is newer than '1.0.9'.
const newer = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
};

export const alertsNeedStore = () => Capacitor.isNativePlatform() && !Capacitor.isPluginAvailable('PushNotifications');

let once = null;   // one read per app open
export function storeUpdate() {
  if (!once) once = (async () => {
    const platform = Capacitor.getPlatform();
    if (!Capacitor.isNativePlatform() || !STORES[platform]) return null;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      // Native fetch goes through CapacitorHttp (capacitor.config.ts), so no CORS.
      const [info, res] = await Promise.all([App.getInfo(), fetch(VERSIONS, { signal: ctl.signal, cache: 'no-store' })]);
      const live = res.ok ? (await res.json())?.[platform] : null;
      if (!live || !info?.version || !newer(live, info.version)) return null;
      return { ...STORES[platform], alerts: alertsNeedStore() };
    } catch { return null; } finally { clearTimeout(t); }
  })();
  return once;
}
