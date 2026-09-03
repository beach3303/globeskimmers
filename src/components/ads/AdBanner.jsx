import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';
import { ADMOB_BANNER_IDS, USE_PRODUCTION_ADS } from '@/lib/admobConfig';

// Generic AdMob bottom banner. Mounts an adaptive banner pinned to the
// bottom edge on iOS / Android; no-op on web (npm run dev / Vite preview /
// Base44 hosted preview) where the native plugin isn't available.
//
// The native AdMob banner is an OVERLAY rendered by the system — it does NOT
// participate in the React/DOM layout flow, so whatever screen mounts it must
// (a) lift the FloatingNav above it and (b) add bottom padding so the last
// card isn't hidden behind it. Layout.jsx does both, keyed off currentPageName
// (Home + the finder pages). Because the plugin shows a single shared banner
// overlay, only ONE instance of this should be mounted at a time — Layout
// guarantees that by rendering it for at most the one active page.
//
// All plugin calls are serialized through one module-level promise chain, and
// teardown is generation-guarded: the native banner is a singleton, so a
// replaced instance's late-resolving hide/remove (Home->finder handoff, Home
// overlay toggles remounting HomeBanner) could land AFTER the next instance's
// showBanner and silently kill the fresh ad. Now: newest generation wins.
let adGeneration = 0;
let adOp = Promise.resolve();
const adQueue = (fn) => { adOp = adOp.then(fn).catch(() => {}); return adOp; };

// HomeBanner re-exports this so Home keeps its identical, proven behavior.
export default function AdBanner() {
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') return; // native-only plugin

    let mounted = true;
    const gen = ++adGeneration;
    const adId = platform === 'ios' ? ADMOB_BANNER_IDS.ios : ADMOB_BANNER_IDS.android;

    const init = async () => {
      try {
        // initializeForTesting registers THIS device as a test device so test
        // ads return even with a production ad unit ID. Mirrors the
        // USE_PRODUCTION_ADS flag (see admobConfig.js for the prod checklist).
        await AdMob.initialize({
          initializeForTesting: !USE_PRODUCTION_ADS,
          testingDevices: [],
        });

        if (!mounted) return;

        await AdMob.showBanner({
          adId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          // Pin to the very bottom edge; FloatingNav is lifted above it.
          margin: 0,
          // Belt-and-suspenders so a single missed prod-flag flip can't serve
          // real ads in a debug build (Google treats self-clicks as invalid).
          isTesting: !USE_PRODUCTION_ADS,
        });
      } catch (error) {
        // Monetization, not core functionality — fail silently so a finder
        // never crashes because an ad couldn't load. Logged for device debug.
        console.error('[AdBanner] showBanner failed:', error);
      }
    };

    adQueue(init);

    return () => {
      mounted = false;
      // Tear down on unmount so the overlay doesn't float over the next
      // screen — but only if no newer instance has taken over the singleton.
      adQueue(async () => {
        if (gen !== adGeneration) return;
        await AdMob.hideBanner().catch(() => {});
        await AdMob.removeBanner().catch(() => {});
      });
    };
  }, []);

  return null;
}
