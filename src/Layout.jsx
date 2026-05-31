import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import PWASetup from "@/components/PWASetup";
import { ToastContainer } from "@/components/Toast";
import { LocationProvider } from "@/components/location/LocationContext";
import BrandBanner from "@/components/redesign/BrandBanner";
import FloatingNav from "@/components/redesign/FloatingNav";
import { IVORY, TEAL_DEEP } from "@/components/redesign/constants";

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

// Track event helper
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
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, [location.pathname]);

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

  const checkOnboarding = async () => {
    try {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        setChecking(false);
        return;
      }

      const user = await base44.auth.me();
      
      trackEvent('login');
      
      if (!user.onboarding_completed && currentPageName !== "Onboarding") {
        navigate(createPageUrl("Onboarding"));
      } else if (user.onboarding_completed && currentPageName === "Onboarding") {
        navigate(createPageUrl("Home"));
      }
    } catch (error) {
      console.error("Error checking onboarding:", error);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <>
        <PWASetup />
        <ToastContainer />
        <div
          className="min-h-screen flex items-center justify-center font-sans"
          style={{ background: IVORY }}
        >
          <div className="text-center">
            <div
              className="w-16 h-16 mx-auto mb-4 border-4 rounded-full animate-spin"
              style={{ borderColor: TEAL_DEEP, borderTopColor: 'transparent' }}
            />
            <p className="font-semibold" style={{ color: '#0F1419' }}>
              Loading Globeskimmers...
            </p>
          </div>
        </div>
      </>
    );
  }

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

          {/* App Content — offset by banner height (50px) + floating nav
              clearance (96px ≈ pill height + bottom gap + safe area). */}
          <div className="w-full min-h-screen pt-[50px] pb-24">
            {children}
          </div>

          {/* Floating pill nav — 3 anchors (Home / Saved / Settings). */}
          <FloatingNav />
        </div>
      </LocationProvider>
    </>
  );
}

// Export tracking helper for use in other components
export { trackEvent };
