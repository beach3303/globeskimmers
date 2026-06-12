import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';
import { ADMOB_BANNER_IDS, USE_PRODUCTION_ADS } from '@/lib/admobConfig';

// Renders an AdMob banner pinned to the bottom of the screen on
// iOS / Android. No-op on the web (npm run dev in a browser) so the
// browser dev experience stays unchanged.
//
// Placement rationale (also documented in the conversation log /
// CLAUDE.md): Home is the only page that mounts this for V1.
//   - Home has the highest impression volume (user lands here on
//     every open and after every back-out of a feature).
//   - The user isn't mid-task on Home — every other screen is
//     either a finder, a scanner, or a results view where an ad
//     across the bottom degrades trust on a travel utility.
//   - One banner per session, capped, is the conservative entry
//     point. We can expand to other screens after seeing real
//     impression / revenue data.
//
// The native AdMob banner is rendered as an OVERLAY by the system,
// not as a React element. That means it doesn't participate in the
// React layout flow — content under it can be hidden. To avoid the
// banner covering the last "Explore More" cards, the Home page adds
// extra bottom padding when this component is mounted. With `margin: 0`
// the banner pins to the very bottom edge; the FloatingNav pill is
// lifted to `bottom: 64` on Home (see FloatingNav's `liftForAd` prop +
// Layout.jsx) so it floats just ABOVE the ad instead of over it.
export default function HomeBanner() {
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    // Web fallback — Capacitor.getPlatform() returns 'web' when the
    // app runs in a browser (npm run dev, Vite preview, the Base44
    // hosted preview). The plugin's native impl isn't available
    // there, so any call would throw. Skip cleanly.
    if (platform === 'web') return;

    let mounted = true;
    const adId = platform === 'ios' ? ADMOB_BANNER_IDS.ios : ADMOB_BANNER_IDS.android;

    const init = async () => {
      try {
        // initializeForTesting registers THIS device as a test device
        // so test ads come back even with a production ad unit ID.
        // Mirrors the USE_PRODUCTION_ADS flag — see admobConfig.js
        // for the full dev-vs-prod rationale and the checklist for
        // flipping to live ads.
        await AdMob.initialize({
          initializeForTesting: !USE_PRODUCTION_ADS,
          testingDevices: [],
        });

        if (!mounted) return;

        await AdMob.showBanner({
          adId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          // Pin to the very bottom edge. The FloatingNav is lifted above
          // it on Home (liftForAd) so the ad sits clearly below the nav.
          margin: 0,
          // Belt-and-suspenders. Even if initializeForTesting is
          // already set globally, isTesting on the call guarantees
          // a single missed flip doesn't accidentally serve real
          // ads in a debug build (which Google would treat as
          // invalid traffic if we click them).
          isTesting: !USE_PRODUCTION_ADS,
        });
      } catch (error) {
        // Don't crash Home if AdMob fails. The banner is monetization,
        // not core functionality — silent failure is the correct
        // posture. A logged error is enough for us to spot it in the
        // Xcode / Android Studio console during testing.
        console.error('[HomeBanner] showBanner failed:', error);
      }
    };

    init();

    return () => {
      mounted = false;
      // Always tear down on unmount — leaving the banner up when the
      // user navigates away would have it floating over a different
      // screen's content, which looks broken. Both hide + remove are
      // best-effort; if there's no banner currently up, these are
      // harmless no-ops.
      AdMob.hideBanner().catch(() => {});
      AdMob.removeBanner().catch(() => {});
    };
  }, []);

  return null;
}
