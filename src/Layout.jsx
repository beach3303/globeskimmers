import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import useSwipeDownDismiss from "@/lib/swipeDismiss";
import PWASetup from "@/components/PWASetup";
import { LocationProvider } from "@/components/location/LocationContext";
import LocationMismatchSheet from "@/components/location/LocationMismatchSheet";
import LocationAutoFollowOffer from "@/components/location/LocationAutoFollowOffer";
import BrandBanner from "@/components/redesign/BrandBanner";
import FloatingNav from "@/components/redesign/FloatingNav";
import FontScaleButton from "@/components/a11y/FontScaleButton";
import BackToTop from "@/components/BackToTop";
import BoardNudge from "@/components/passport/BoardNudge";
import { PageGroundProvider, usePageGroundValue, usePageInk } from "@/components/redesign/PageGround";
import { logEvent } from "@/lib/analytics";
import "@/lib/cloudSync"; // starts Wishlist/Saved → account sync on sign-in (side-effect)
import { IVORY, NEUTRAL, WORLD, WORLD_BY_PAGE, CLOTH, DEFAULT_CLOTH, rgba } from "@/components/redesign/constants";

// Long, scrollable content/list pages that get the floating "back to top" button.
const BACK_TO_TOP_PAGES = new Set([
  "PlacesToEat", "CoffeeFinder", "ATMFinder", "RestroomFinder",
  "ConvenienceStore", "ThingsToDo", "Shopping", "MoneyExchange",
  "CultureInformation", "BasicPhrases", "Weather",
  "Mailbox", "Postcards", "CityBoard", "CityBoards", "Circle",
]);

// The bottom reserve under every page except Onboarding: the nav pill sits 22px above
// the safe area and is about 62px tall, so 96px keeps the last card (and Back-to-top)
// 12px clear of it.
const BOTTOM_RESERVE = "calc(96px + env(safe-area-inset-bottom))";

// Each page's ground (the paper it is printed on), painted all the way down. A page can
// override it with usePageGround (Profile, Circle and Traveler set the owner's cloth
// paper); every other page uses this default, and pages not listed here stay ivory.
// Profile, Circle and Traveler start on Harbour paper so there is no ivory flash
// before the cloth loads.
const HARBOUR = CLOTH[DEFAULT_CLOTH];
const FINDER_PAGES = Object.entries(WORLD_BY_PAGE); // [page key, world key]
const PAGE_GROUND = new Map(Object.entries({
  ...Object.fromEntries(FINDER_PAGES.map(([page, key]) => [page, WORLD[key].paper])),
  Mailbox: NEUTRAL.airmail,
  Postcards: NEUTRAL.airmail,
  CityBoard: NEUTRAL.airmail,
  CityBoards: NEUTRAL.airmail,
  Profile: HARBOUR.paper,
  Circle: HARBOUR.paper,
  Traveler: HARBOUR.paper,
}));

// The ink of the shared chrome over a page (Back-to-top): the world ink on a finder,
// airmail blue on Mailbox and the postcard box, the owner's cloth on Circle (the page
// sets it through usePageGround; Harbour until then), the neutral ink elsewhere.
const PAGE_INK = new Map(Object.entries({
  ...Object.fromEntries(FINDER_PAGES.map(([page, key]) => [page, WORLD[key].ink])),
  Mailbox: NEUTRAL.airmailBlue,
  Postcards: NEUTRAL.airmailBlue,
  CityBoard: NEUTRAL.airmailBlue,
  CityBoards: NEUTRAL.airmailBlue,
  Circle: HARBOUR.cloth,
}));


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

  // Swipe-down gesture: close the frontmost overlay (photo, form, location
  // picker) via the dismiss stack. Page-level swipe-to-exit was REMOVED per user
  // request — a downward swipe no longer navigates back or to Home; it only
  // closes an open overlay. Passing no callback disables the page-exit path.
  useSwipeDownDismiss();
  // Onboarding fills the screen itself (each step sizes to viewport − banner and
  // pins its own footer), so it must NOT get the bottom reserve — that extra
  // 96px pushes the step taller than the viewport and scrolls the icon/Back up
  // under the banner.
  const isOnboarding = currentPageName === "Onboarding";

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
      <LocationProvider>
        <PageGroundProvider fallback={PAGE_GROUND.get(currentPageName) || IVORY}>
          <PageShell currentPageName={currentPageName} isOnboarding={isOnboarding}>
            {children}
          </PageShell>
        </PageGroundProvider>
      </LocationProvider>
    </>
  );
}

// The chrome around every page, painted in the page's ground. A child of the
// PageGroundProvider so it sees a page's usePageGround override.
function PageShell({ currentPageName, isOnboarding, children }) {
  const ground = usePageGroundValue();
  const pageInk = usePageInk();

  // Paint <body> as well: iOS shows the body's colour in the rubber-band overscroll
  // above and below the page, so the ground has to be there too. Cleared when Layout
  // unmounts (the sign-in gate and the frozen screen paint their own).
  useEffect(() => {
    const { style } = document.body;
    style.backgroundColor = ground;
    return () => { style.backgroundColor = ""; };
  }, [ground]);

  const backToTopColor = rgba(pageInk || PAGE_INK.get(currentPageName) || NEUTRAL.ink, 0.82);

  return (
    <div className="min-h-screen font-sans gs-app-bg" style={{ background: ground }}>
      {/* Brand banner — teal gradient (redesign primitive). Fixed top
          so it stays above scrolled content; content offset by pt-[50px]
          below to clear it. The gs-app-banner class lets the native camera
          hide it (it would otherwise block the camera preview behind the
          transparent webview). */}
      <div className="fixed top-0 left-0 right-0 z-50 gs-app-banner">
        <BrandBanner />
      </div>

      {/* Global text-size (glasses) control at the banner's right, on every
          page but Onboarding (Home included), so text can be resized from
          anywhere. The artboard puts the 40px disc 5px below the safe area and
          12px from the edge; its 44px hit area reaches 2px further each way,
          hence 3px and 10px here. */}
      {!isOnboarding && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 3px)', right: 10, zIndex: 60 }}>
          <FontScaleButton />
        </div>
      )}

      {/* App Content — offset by banner height (50px + status-bar safe
          area, so content clears the now-safe-area-aware BrandBanner) and
          ending in the bottom reserve that clears the floating nav. */}
      <div
        className="w-full max-w-full overflow-x-clip min-h-screen"
        style={{
          paddingTop: 'calc(50px + env(safe-area-inset-top))',
          paddingBottom: isOnboarding ? undefined : BOTTOM_RESERVE,
        }}
      >
        {children}
      </div>

      {/* Floating "back to top" on long content/list pages, in the page's ink. */}
      {BACK_TO_TOP_PAGES.has(currentPageName) && <BackToTop color={backToTopColor} />}

      {/* Floating pill nav — 5 anchors (Home / Mailbox / Passport / Profile / Settings). */}
      <FloatingNav />

      {/* Global location nudges — mounted here (not in Home) so they catch
          their events on ANY page after foreground: the "you appear to be in
          <city>" travel nudge, and the one-time "auto-follow?" offer. */}
      <LocationMismatchSheet />
      <LocationAutoFollowOffer />

      {/* After a verified stamp in a city: 'Send a postcard to Lisbon's board' (City Boards). */}
      {!isOnboarding && <BoardNudge />}
    </div>
  );
}

// Export tracking helper for use in other components
export { trackEvent };
