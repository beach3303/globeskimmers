import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import PWASetup from "@/components/PWASetup";
import { ToastContainer } from "@/components/Toast";
import { LocationProvider } from "@/components/location/LocationContext";
import BrandBanner from "@/components/redesign/BrandBanner";
import FloatingNav from "@/components/redesign/FloatingNav";
import { IVORY } from "@/components/redesign/constants";

// Generate or retrieve session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('globeskimmers_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('globeskimmers_session_id', sessionId);
    sessionStorage.setItem('globeskimmers_session_start', new Date().toISOString());
  }
  return sessionId;
};

// Track event helper. Legacy Base44 analytics — safely no-ops when there's no
// Base44 session (e.g. native), so it does not interfere with the Supabase
// auth path. (Analytics move to the Workers data path in a later phase.)
const trackEvent = async (eventType, data = {}) => {
  try {
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) return;

    const user = await base44.auth.me();
    const sessionId = getSessionId();

    await base44.entities.UserEvent.create({
      user_email: user.email,
      event_type: eventType,
      session_id: sessionId,
      ...data
    });
  } catch (error) {
    // Silently fail - event tracking is non-critical
  }
};

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const { profile, isAuthenticated, isLoadingAuth } = useAuth();

  // Account-tied onboarding gate. Drives off the Supabase profile flag, which
  // is set once-ever when onboarding completes (survives reinstall / 2nd
  // device). Wait for the profile to load (it's null briefly on a cold start)
  // before deciding, so we never bounce an already-onboarded user to /Onboarding.
  useEffect(() => {
    if (isLoadingAuth || !profile) return;
    const completed = profile.onboarding_completed === true;
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

  // Track session start
  useEffect(() => {
    if (isAuthenticated) {
      const sessionStart = sessionStorage.getItem('globeskimmers_session_start');
      if (sessionStart) {
        trackEvent('session_start');
      }
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
        <div className="min-h-screen font-sans" style={{ background: IVORY }}>
          {/* Brand banner — teal gradient (redesign primitive). Fixed top
              so it stays above scrolled content; content offset by pt-[50px]
              below to clear it. */}
          <div className="fixed top-0 left-0 right-0 z-50">
            <BrandBanner />
          </div>

          {/* App Content — offset by banner height (50px + status-bar safe
              area, so content clears the now-safe-area-aware BrandBanner) +
              floating nav clearance (pb-24). */}
          <div
            className="w-full min-h-screen pb-24"
            style={{ paddingTop: 'calc(50px + env(safe-area-inset-top))' }}
          >
            {children}
          </div>

          {/* Floating pill nav — 3 anchors (Home / Saved / Settings).
              Lifted above the AdMob banner on Home only (the banner is
              Home-only and pins to the bottom edge). */}
          <FloatingNav liftForAd={currentPageName === "Home"} />
        </div>
      </LocationProvider>
    </>
  );
}

// Export tracking helper for use in other components
export { trackEvent };
