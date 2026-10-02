import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import useSwipeDownDismiss from "@/lib/swipeDismiss";
import PWASetup from "@/components/PWASetup";
import { ToastContainer } from "@/components/Toast";
import { LocationProvider } from "@/components/location/LocationContext";
import LocationMismatchSheet from "@/components/location/LocationMismatchSheet";
import LocationAutoFollowOffer from "@/components/location/LocationAutoFollowOffer";
import BrandBanner from "@/components/redesign/BrandBanner";
import FloatingNav from "@/components/redesign/FloatingNav";
import AdBanner from "@/components/ads/AdBanner";
import FontScaleButton from "@/components/a11y/FontScaleButton";
import BackToTop from "@/components/BackToTop";
import { logEvent } from "@/lib/analytics";
import "@/lib/cloudSync"; // starts Wishlist/Saved → account sync on sign-in (side-effect)
import { IVORY } from "@/components/redesign/constants";

// Finder list pages that show a bottom AdMob banner ("per-feature ads").
// Home shows NO banner (Phase-1a-lite moved the ad off Home), so it's
// intentionally NOT in this set. These keys must match the page keys in
// pages.config.js (= currentPageName).
const AD_FINDER_PAGES = new Set([
  "PlacesToEat", "CoffeeFinder", "ATMFinder", "RestroomFinder",
  "ConvenienceStore", "ThingsToDo", "Shopping",
]);

// Long, scrollable content/list pages that get the floating "back to top" button.
const BACK_TO_TOP_PAGES = new Set([
  "PlacesToEat", "CoffeeFinder", "ATMFinder", "RestroomFinder",
  "ConvenienceStore", "ThingsToDo", "Shopping",
  "CultureInformation", "BasicPhrases", "Weather",
]);


// Track event helper. Now writes to the LIVE Cloudflare D1 events table via
// logEvent (the same path the AI-details analytics already use). It used to
// write to Base44 UserEvent, which silently no-ops since auth moved to Supabase
// (no Base44 session) — that's why the admin analytics stopped collecting page
// views, sessions and feature usage. Signature is unchanged, so every existing
// call site keeps working; `page_name` in the data maps to the events `page`
// column (what page_views_7d groups by), the rest becomes the JSON payload.
const trackEvent = (eventType, data = {}) => {
  try {
    const { page_name, ...rest } = data || {};
    logEvent(eventType, rest, page_name || null);
  } catch {
    // Silently fail - event tracking is non-critical.
  }
};

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const { profile, user, isAuthenticated, isLoadingAuth } = useAuth();

  // Whether the current page should show the bottom banner (finder pages).
  // Drives the banner mount, the FloatingNav lift, and extra bottom padding so
  // the last card / radius row clears the overlay.
  const showFinderAd = AD_FINDER_PAGES.has(currentPageName);

  // Swipe-down gesture: close the frontmost overlay (photo, form, location
  // picker) via the dismiss stack. Page-level swipe-to-exit was REMOVED per user
  // request — a downward swipe no longer navigates back or to Home; it only
  // closes an open overlay. Passing no callback disables the page-exit path.
  useSwipeDownDismiss();
  // Onboarding fills the screen itself (each step sizes to viewport − banner and
  // pins its own footer), so it must NOT get the FloatingNav bottom padding —
  // that extra 96px pushes the step taller than the viewport and scrolls the
  // icon/Back up under the banner.
  const isOnboarding = currentPageName === "Onboarding";

  // Global text-size (glasses) control in the banner — available on every page
  // so the user can resize text from ANYWHERE (the size is global + persisted).
  // Home has its own glasses inside the hello card; the camera scanners use a
  // full-screen dark UI, so skip those.
  const showGlobalFontBtn =
    !isOnboarding &&
    currentPageName !== "Home" &&
    currentPageName !== "SmartTextScanner" &&
    currentPageName !== "SmartPriceScanner";

  // Account-tied onboarding gate. Drives off the Supabase profile flag, which
  // is set once-ever when onboarding completes (survives reinstall / 2nd
  // device). Wait for the profile to load (it's null briefly on a cold start)
  // before deciding, so we never bounce an already-onboarded user to /Onboarding.
  useEffect(() => {
    if (isLoadingAuth || !profile) return;
    // The App Review demo account replays the full onboarding on every app
    // launch (founder, 2026-10-02): the reviewer always sees the first-run
    // experience — including the reworked location screen — never a lived-in
    // account. sessionStorage keeps it to once per launch so finishing
    // onboarding doesn't loop.
    let reviewerTour = false;
    try {
      reviewerTour = (user?.email || "").toLowerCase() === "appreview@globeskimmers.io"
        && !sessionStorage.getItem("gsk_review_toured");
    } catch { /* storage unavailable → no replay */ }
    const completed = profile.onboarding_completed === true && !reviewerTour;
    if (!completed && currentPageName !== "Onboarding") {
      navigate(createPageUrl("Onboarding"));
    } else if (completed && currentPageName === "Onboarding") {
      navigate(createPageUrl("Home"));
    }
  }, [profile, isLoadingAuth, currentPageName, navigate]);

  // Track page views
  useEffect(() => {
    if (isAuthenticated && currentPageName) {
      trackEvent('page_view', { page_name: currentPageName });
    }
  }, [currentPageName, isAuthenticated]);

  // Track session start — stamp the session's start time once (used by the
  // session_end duration calc below) and fire session_start a single time.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!sessionStorage.getItem('globeskimmers_session_start')) {
      sessionStorage.setItem('globeskimmers_session_start', new Date().toISOString());
      trackEvent('session_start');
    }
  }, [isAuthenticated]);

  // Track session end on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isAuthenticated) {
        const sessionStart = sessionStorage.getItem('globeskimmers_session_start');
        if (sessionStart) {
          const duration = Math.floor((new Date() - new Date(sessionStart)) / 1000);
          trackEvent('session_end', { metadata: { duration_seconds: duration } });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated]);

  return (
    <>
      <PWASetup />
      <ToastContainer />
      <LocationProvider>
        <div className="min-h-screen font-sans gs-app-bg" style={{ background: IVORY }}>
          {/* Brand banner — teal gradient (redesign primitive). Fixed top
              so it stays above scrolled content; content offset by pt-[50px]
              below to clear it. The gs-app-banner class lets the native camera
              hide it (it would otherwise block the camera preview behind the
              transparent webview). */}
          <div className="fixed top-0 left-0 right-0 z-50 gs-app-banner">
            <BrandBanner />
          </div>

          {/* Global text-size (glasses) control, pinned in the banner's right
              side so text can be resized from any page. */}
          {showGlobalFontBtn && (
            <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 9px)', right: 12, zIndex: 60 }}>
              <FontScaleButton />
            </div>
          )}

          {/* App Content — offset by banner height (50px + status-bar safe
              area, so content clears the now-safe-area-aware BrandBanner) +
              floating nav clearance (pb-24). On finder pages an AdMob banner
              overlays the bottom edge, so add ~64px extra bottom padding there
              so the last card / radius row isn't hidden behind it. */}
          <div
            className={`w-full max-w-full overflow-x-clip min-h-screen ${isOnboarding ? "" : "pb-24"}`}
            style={{
              paddingTop: 'calc(50px + env(safe-area-inset-top))',
              // On finder pages the FloatingNav is lifted (~64-72px) AND an
              // AdMob banner (~56px) sits below it. Clear both + the home-
              // indicator safe area so the last card / Directions·Map·Less /
              // AI DETAILS never end up hidden under the pill at full scroll.
              ...(showFinderAd ? { paddingBottom: 'calc(6rem + 84px + env(safe-area-inset-bottom))' } : {}),
            }}
          >
            {children}
          </div>

          {/* Per-feature bottom banner on finder pages (Home mounts its own via
              Home.jsx). Single mount point so only one overlay banner is ever
              active. */}
          {showFinderAd && <AdBanner />}

          {/* Floating "back to top" on long content/list pages. Lifted higher on
              finder pages so it clears the ad banner + lifted nav. */}
          {BACK_TO_TOP_PAGES.has(currentPageName) && <BackToTop bottom={showFinderAd ? 150 : 96} />}

          {/* Floating pill nav — 3 anchors (Home / Saved / Settings). Lifted
              above the AdMob banner on the finder pages so the ad can pin to
              the bottom edge without the pill overlapping it. Home no longer
              mounts a banner, so it keeps the resting 22px height. */}
          <FloatingNav liftForAd={showFinderAd} />

          {/* Global location nudges — mounted here (not in Home) so they catch
              their events on ANY page after foreground: the "you appear to be in
              <city>" travel nudge, and the one-time "auto-follow?" offer. */}
          <LocationMismatchSheet />
          <LocationAutoFollowOffer />
        </div>
      </LocationProvider>
    </>
  );
}

// Export tracking helper for use in other components
export { trackEvent };
