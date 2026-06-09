// src/lib/supabaseClient.js
//
// Supabase auth + data client. This REPLACES the Base44 auth path: accounts,
// sessions, onboarding answers, and CRM all live in the project's OWN Supabase
// project (https://bkaxadiyehddzkiuheea.supabase.co). The anon key is the PUBLIC
// client key — Row Level Security (see supabase/crm-schema.sql) is what actually
// guards data, not key secrecy.
//
// Native specifics (verified against current Supabase + Capacitor docs):
//   - Session AND the PKCE code-verifier are persisted in NATIVE device storage
//     via @capacitor/preferences (iOS UserDefaults / Android SharedPreferences),
//     NOT WebView localStorage. The verifier must survive the in-app-browser
//     round trip when iOS backgrounds the WKWebView; native storage guarantees
//     that. (This is the single most common cause of "code verifier disappears".)
//   - flowType 'pkce' → the OAuth callback carries ?code= as a query param,
//     exchanged manually in src/lib/nativeAuth.js. (Not the implicit #token hash.)
//   - detectSessionInUrl MUST be false ON NATIVE: the page origin is
//     capacitor://localhost (the local bundle), not the deep-link URL, so the
//     library can't auto-detect the code — we exchange it ourselves in the
//     appUrlOpen handler. On WEB it stays true so a normal OAuth redirect-back
//     (?code= in the page URL) is handled automatically.
//   - autoRefreshToken's internal timer is NOT visibility-aware inside a
//     Capacitor WebView, so we drive start/stopAutoRefresh off the app
//     foreground/background state below.
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isNative = Capacitor.isNativePlatform();

// Capacitor Preferences-backed async storage adapter (supabase-js SupportedStorage).
// supabase-js awaits these internally, so returning Promises is first-class.
// Preferences stores ONLY strings, and supabase already JSON.stringifies the
// session before calling setItem — do NOT stringify again here (double-encode).
// Both the session and the `${storageKey}-code-verifier` persist here, surviving
// app restart/update (cleared only on uninstall).
const capacitorPreferencesStorage = {
  async getItem(key) {
    const { value } = await Preferences.get({ key });
    return value; // string | null — exactly what supabase expects
  },
  async setItem(key, value) {
    await Preferences.set({ key, value });
  },
  async removeItem(key) {
    await Preferences.remove({ key });
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isNative, // false on native (manual exchange); true on web
    flowType: 'pkce',
    // Native: native device storage. Web: undefined → supabase uses localStorage.
    storage: isNative ? capacitorPreferencesStorage : undefined,
    storageKey: 'globeskimmers.auth',
  },
});

// Tie token auto-refresh to app foreground/background. Registered exactly ONCE
// (module top-level) to avoid duplicate listeners from React re-renders.
if (isNative) {
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
  // Kick it off for the initial foreground state on cold start.
  supabase.auth.startAutoRefresh();
}
