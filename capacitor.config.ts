import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor app configuration. appId / appName are LOCKED for v1.0
// release — changing appId after the app is on the App Store / Play
// Store creates a *new* app entry from Apple's / Google's perspective
// and existing users can't update. Only ever bump this if you're
// intentionally forking a new product line.
const config: CapacitorConfig = {
  appId: 'com.globeskimmers.app',
  appName: 'Globeskimmers',
  webDir: 'dist',

  // Android leaves out @capacitor/status-bar (Play Console, 2026-10-14: its old
  // Window.setStatusBarColor calls are deprecated for edge-to-edge on Android 15+).
  // Capacitor 8's built-in SystemBars (below) does the job there; iOS keeps the plugin.
  // This list is an allowlist: a new native plugin must be added here too, or the
  // Android build won't include it.
  android: {
    includePlugins: [
      '@capacitor/app',
      '@capacitor/browser',
      '@capacitor/filesystem',
      '@capacitor/geolocation',
      '@capacitor/preferences',
      '@capacitor/share',
      '@capacitor/splash-screen',
      '@capgo/capacitor-share-target',
      '@capgo/capacitor-updater',
      '@capacitor/push-notifications',
    ],
  },

  plugins: {
    // Splash screen — the first thing the user sees while the JS
    // bundle parses. Background color matches IVORY (the app's main
    // canvas) so there's no jarring color shift when the React tree
    // mounts.
    //
    // launchAutoHide=false: the splash stays up until it is hidden
    // explicitly — by Capgo once a cold-start OTA install has finished
    // (CapacitorUpdater.autoSplashscreen below), and by src/main.jsx the
    // moment React mounts, as a belt-and-braces so a splash can never
    // outlive the app it covers.
    //
    // launchFadeOutDuration smooths the transition so the splash
    // doesn't disappear with a snap; subtle but noticeably more
    // polished on a real device.
    //
    // androidScaleType=CENTER_CROP centers the splash image without
    // distortion on every Android screen aspect ratio; the default
    // FIT_CENTER leaves grey bars on tall devices.
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      backgroundColor: '#0A1015',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    // Status bar — DARK content (dark icons) on a light surface so
    // the time / signal / battery glyphs remain readable on the
    // ivory home background. overlaysWebView keeps the system bar
    // transparent so the BrandBanner's teal gradient extends
    // edge-to-edge under it (matching what Layout.jsx already does
    // with the fixed-top BrandBanner element).
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true,
    },

    // Android's system bars (Capacitor 8 core). DARK = light icons, as the plugin gave
    // over the teal banner. 'css' keeps the safe-area insets reaching the page: WebView
    // 140+ reports env(safe-area-inset-*) itself, older ones get the page padded below
    // the bars.
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
    },

    // Route the WebView's fetch/XHR through native HTTP. On native the page
    // origin is capacitor://localhost, so calls to the absolute Base44 API
    // host (https://base44.app — see src/api/base44Client.js) are cross-origin
    // and would be blocked by browser CORS. CapacitorHttp issues them from the
    // native layer instead, which is not subject to CORS. Built into
    // @capacitor/core — no extra dependency.
    CapacitorHttp: {
      enabled: true,
    },

    // Photos shared into the app from the phone's share sheet (2026-10-17). iOS: the
    // ShareExtension target (ios/App/ShareExtension) leaves them in this app group, which both
    // targets' entitlements list. Android: the SEND intent filters in AndroidManifest.xml.
    // The JS side is src/lib/sharedPhotos.js. Native: ships in a store build, not over the air.
    CapacitorShareTarget: {
      appGroupId: 'group.com.globeskimmers.app',
    },

    // Alerts outside the app (build 1.0.6, 2026-10-19): shown as a banner even while the app is
    // open. The JS side is src/lib/pushAlerts.js; the sender is the worker's pushNotify. Native:
    // ships in a store build (iOS needs the push capability on the App ID, Android the Firebase
    // google-services.json in android/app — kept out of git).
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Capgo OTA live updates. appId MUST match the native bundle id
    // (com.globeskimmers.app) and the app registered on console.capgo.app —
    // this is how the updater knows which cloud app / channel to pull
    // bundles from. Pair with CapacitorUpdater.notifyAppReady() in
    // src/main.jsx or updates auto-roll-back on next launch.
    //
    // autoUpdate 'onLaunch': a COLD start checks Capgo, downloads any
    // newer bundle and applies it right away behind the splash, so the
    // first open after an upload already shows the new build. (The
    // default 'atBackground' downloads on one open and applies on the
    // next, which reads as "the update never arrives".) Foreground
    // resumes keep the gentle behaviour — never a mid-session reload.
    // autoSplashscreen hides the splash once the install is done or no
    // update is pending; the timeout lets a slow cellular download fall
    // back to installing on the next launch instead of holding the user.
    // These are NATIVE settings: they ship in an Xcode / store build, not
    // over the air.
    CapacitorUpdater: {
      appId: 'com.globeskimmers.app',
      autoUpdate: 'onLaunch',
      autoSplashscreen: true,
      autoSplashscreenTimeout: 8000,
    },
  },
};

export default config;
