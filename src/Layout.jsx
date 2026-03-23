import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import PWASetup from "@/components/PWASetup";
import { ToastContainer } from "@/components/Toast";
import { LocationProvider } from "@/components/location/LocationContext";
import BottomNav from "@/components/theme/BottomNav";
import { useTheme } from "@/components/theme/ThemeContext";

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
  const { theme } = useTheme();
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
          className="min-h-screen flex items-center justify-center"
          style={{ background: theme.colors.background }}
        >
          <div className="text-center">
            <div 
              className="w-16 h-16 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: theme.colors.primary, borderTopColor: 'transparent' }}
            />
            <p style={{ color: theme.colors.textPrimary }} className="font-semibold">
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
        <div 
          className="min-h-screen transition-colors duration-300"
          style={{ background: theme.colors.background }}
        >
          {/* Globeskimmers Banner - Top */}
          <div 
            className="fixed top-0 left-0 right-0 z-50 text-white py-2 text-center shadow-md transition-all duration-300"
            style={{ background: theme.colors.headerBg }}
          >
            <span className="font-bold text-sm tracking-wide">Globeskimmers</span>
          </div>
          
          {/* App Content */}
          <div className="w-full min-h-screen pt-10 pb-16">
            {children}
          </div>

          {/* Bottom Navigation */}
          <BottomNav />
        </div>
      </LocationProvider>
    </>
  );
}

// Export tracking helper for use in other components
export { trackEvent };
