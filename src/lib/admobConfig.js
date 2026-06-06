// AdMob configuration — production-bound IDs and the dev/prod gate.
//
// These IDs are NOT secret. They ship in the app binary (Info.plist /
// AndroidManifest.xml) and are visible to anyone who downloads the
// app. The auth that attributes ad revenue to your AdMob account
// happens server-side via your publisher account + the app's signing
// certificate — not these identifiers. So no .env, no secret manager,
// just commit them.
//
// App IDs use `~` separator. Ad Unit IDs use `/`. Don't mix them up —
// the Google SDK silently 0-impressions an ad unit ID used as an app
// ID (and vice versa), and the failure mode is "no ads ever, no
// error in the console."

export const ADMOB_APP_IDS = {
  ios:     'ca-app-pub-2858807823087664~5847327858',
  android: 'ca-app-pub-2858807823087664~6207410187',
};

export const ADMOB_BANNER_IDS = {
  ios:     'ca-app-pub-2858807823087664/8059547902',
  android: 'ca-app-pub-2858807823087664/4942429976',
};

// ─── Dev / Prod gate ─────────────────────────────────────────────────
// HARD RULE (Google policy): never let real ads serve in builds where
// you might click your own ads. AdMob calls that "invalid traffic" and
// it gets accounts banned permanently.
//
// During development we want:
//   - Real ad UNIT IDs in the integration (so prod is one bool flip)
//   - But the SDK in TEST MODE so Google serves placeholder test ads
//
// In production we want:
//   - Real ad unit IDs + test mode OFF → real revenue
//
// Vite's `import.meta.env.DEV` is true in `npm run dev` and false in
// any production-mode build. Capacitor's iOS / Android apps load the
// /dist/ output, which is built with `npm run build` → MODE=production
// → `import.meta.env.DEV` === false. So we can't use it to detect
// "device build still in development testing."
//
// Instead: an explicit env var that defaults to test ads. Set
// `VITE_ADMOB_PRODUCTION=1` in your .env.local before the final
// production `cap:sync` to enable real ads. Every other build —
// dev server, simulator builds, ad-hoc TestFlight, Play Store
// internal test — stays on test ads.
//
// CHECKLIST before flipping to production:
//   [ ] App is approved and live on App Store
//   [ ] App is approved and live on Google Play
//   [ ] AdMob account is "Ready" (not "Limited") in the AdMob console
//   [ ] You have your own device for testing — never click your own
//       real ads even after the flip.
export const USE_PRODUCTION_ADS = import.meta.env.VITE_ADMOB_PRODUCTION === '1';
