// Phone platform and app version, for support reports ("I'm here, but the app
// is saying I'm not", founder 2026-10-10): the native app version plus the OTA
// bundle it runs, so a report says which code refused the stamp. Read once.
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

let _info = null;
export async function appInfo() {
  if (_info) return _info;
  const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  let version = null;
  if (Capacitor.isNativePlatform()) {
    try {
      const cur = await CapacitorUpdater.current();
      const bundle = cur?.bundle?.version;
      version = [cur?.native, bundle && bundle !== 'builtin' ? bundle : null].filter(Boolean).join(' · ') || null;
    } catch { /* unknown */ }
  }
  _info = { platform, version };
  return _info;
}
