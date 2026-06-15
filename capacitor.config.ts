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

  plugins: {
    // Splash screen — the first thing the user sees while the JS
    // bundle parses. Background color matches IVORY (the app's main
    // canvas) so there's no jarring color shift when the React tree
    // mounts.
    //
    // launchAutoHide=true means Capacitor dismisses the splash on its
    // own after launchShowDuration; if we ever need to dismiss it
    // manually (e.g. after auth handshake completes), flip this to
    // false and call SplashScreen.hide() from React.
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
      launchAutoHide: true,
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

    // Route the WebView's fetch/XHR through native HTTP. On native the page
    // origin is capacitor://localhost, so calls to the absolute Base44 API
    // host (https://base44.app — see src/api/base44Client.js) are cross-origin
    // and would be blocked by browser CORS. CapacitorHttp issues them from the
    // native layer instead, which is not subject to CORS. Built into
    // @capacitor/core — no extra dependency.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
