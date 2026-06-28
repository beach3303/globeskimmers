import React, { useState, useEffect } from "react";
import { MapPin, AlertCircle, CheckCircle2, X, Settings, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCurrentPositionSmart } from "@/lib/geolocation";

export default function LocationStep({ onNext, onLocationGranted, onExit }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [granted, setGranted] = useState(false);
  const [showSorryMessage, setShowSorryMessage] = useState(false);
  const [denialCount, setDenialCount] = useState(0);
  const [permissionState, setPermissionState] = useState(null);
  const [browserType, setBrowserType] = useState('');
  const [isIOS, setIsIOS] = useState(false);
  // Inline help card shown when openLocationSettings runs — replaces
  // a pair of system alert() calls that interrupted the onboarding
  // flow with a browser-style dialog. Inline rendering keeps the user
  // on this screen and shows the steps as a checklist they can
  // refer back to while toggling between Settings and the app.
  const [settingsHelp, setSettingsHelp] = useState(null);

  useEffect(() => {
    checkPermissionState();
    detectBrowser();
    detectIOS();

    // Auto-check permission when page regains focus (user returns from Settings)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPermissionState();
        // If permission is now granted, automatically try to get location
        setTimeout(() => {
          if (permissionState === 'granted' || permissionState === 'prompt') {
            requestLocation();
          }
        }, 500);
      }
    };

    const handleFocus = () => {
      checkPermissionState();
      setTimeout(() => {
        if (permissionState === 'granted' || permissionState === 'prompt') {
          requestLocation();
        }
      }, 500);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [permissionState]);

  const detectIOS = () => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);
  };

  const detectBrowser = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      setBrowserType('safari');
    } else if (userAgent.includes('chrome')) {
      setBrowserType('chrome');
    } else if (userAgent.includes('firefox')) {
      setBrowserType('firefox');
    } else {
      setBrowserType('other');
    }
  };

  const checkPermissionState = async () => {
    try {
      if (!navigator.permissions) {
        return;
      }

      const result = await navigator.permissions.query({ name: 'geolocation' });
      setPermissionState(result.state);
      
      // Clear error if permission is now granted
      if (result.state === 'granted' || result.state === 'prompt') {
        setError(null);
        setShowSorryMessage(false);
        setDenialCount(0);
      }
      
      result.addEventListener('change', () => {
        setPermissionState(result.state);
        
        // Auto-request if permission granted
        if (result.state === 'granted') {
          requestLocation();
        }
      });
    } catch {
      // Permissions API unavailable — non-fatal; the request flow still works.
    }
  };

  const requestLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!navigator.geolocation) {
        setError("Location services are not supported by your browser.");
        setLoading(false);
        return;
      }

      // RE-CHECK permission state before attempting
      await checkPermissionState();

      // Attempt the request regardless of cached state (native plugin on
      // iOS/Android, browser geolocation on web — see src/lib/geolocation.js).
      const position = await getCurrentPositionSmart({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });

      // Success! Save permission status to user profile
      setGranted(true);
      setError(null);
      setDenialCount(0);
      setShowSorryMessage(false);
      
      // Best-effort: persist permission status. GUARDED so a missing Base44
      // session (Supabase auth path) can't throw into this success path and
      // surface a false "location error" AFTER GPS already succeeded.
      try {
        const { base44 } = await import("@/api/base44Client");
        await base44.auth.updateMe({
          location_permission_granted: true,
          location_permission_date: new Date().toISOString(),
          location_enabled: true
        });
      } catch { /* prefs unavailable — non-fatal */ }

      onLocationGranted({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      
      setTimeout(() => onNext(), 1000);
      
    } catch (err) {
      console.error("Location error:", err);
      
      if (err.code === 1) { // Permission denied
        const newDenialCount = denialCount + 1;
        setDenialCount(newDenialCount);
        
        // Best-effort: record denial. GUARDED — non-fatal without a Base44 session.
        try {
          const { base44 } = await import("@/api/base44Client");
          await base44.auth.updateMe({
            location_permission_granted: false,
            location_permission_date: new Date().toISOString()
          });
        } catch { /* prefs unavailable — non-fatal */ }
        
        // Only show "sorry" screen after 3 attempts
        if (newDenialCount >= 3) {
          setShowSorryMessage(true);
        } else {
          if (isIOS) {
            setError(
              "Location blocked. Steps to fix:\n\n" +
              "1. Enable location in iPhone Settings > Safari > Location\n" +
              "2. Tap the 🔄 button below to refresh\n" +
              "3. Try again"
            );
          } else {
            setError(
              "Location access was denied. Please enable location services in your device settings, then refresh the page and try again."
            );
          }
        }
      } else if (err.code === 2) {
        setError("Unable to get your location. Please check that GPS/location services are enabled on your device.");
      } else if (err.code === 3) {
        setError("Location request timed out. Please check your connection and try again.");
      } else {
        setError("Error getting location. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTryAgain = async () => {
    setShowSorryMessage(false);
    setError(null);
    setDenialCount(0);
    
    // Force re-check of permission state
    await checkPermissionState();
    
    // If permission is now granted or prompt, automatically trigger request
    if (permissionState === 'granted' || permissionState === 'prompt') {
      requestLocation();
    }
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

  const openLocationSettings = () => {
    if (isIOS) {
      // Try to deep-link into iOS Settings → Privacy → Location.
      // App-Prefs:// only works inside Safari (not Chrome iOS, not
      // in-app WebView), so the inline help card below covers the
      // case where the deep link is silently rejected by the OS.
      window.location.href = 'App-Prefs:Privacy&path=LOCATION';

      setTimeout(() => {
        setSettingsHelp({
          title: 'If Settings didn\'t open automatically',
          steps: [
            'Open the Settings app',
            'Tap Safari',
            'Tap Location',
            'Select "Ask" or "Allow"',
            'Return here — the page will auto-check',
          ],
        });
      }, 1000);
    } else {
      setSettingsHelp({
        title: 'Enable location for your browser',
        steps: [
          'Open your device settings',
          'Find your browser app',
          'Enable Location Services for it',
          'Return here — the page will auto-check',
        ],
      });
    }
  };

  const getBrowserInstructions = () => {
    switch (browserType) {
      case 'safari':
        return (
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Tap the <strong>aA</strong> icon in the address bar</li>
            <li>Tap <strong>"Website Settings"</strong></li>
            <li>Under <strong>"Location"</strong>, tap <strong>"Ask"</strong></li>
            <li><strong>Return to this page</strong> - it will auto-detect</li>
          </ol>
        );
      case 'chrome':
        return (
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Tap the <strong>lock icon</strong> or <strong>ⓘ</strong> in the address bar</li>
            <li>Tap <strong>"Permissions"</strong> or <strong>"Site Settings"</strong></li>
            <li>Find <strong>"Location"</strong> and tap <strong>"Allow"</strong></li>
            <li><strong>Return to this page</strong> - it will auto-detect</li>
          </ol>
        );
      default:
        return (
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Tap the site information icon in the address bar</li>
            <li>Find Location permissions</li>
            <li>Change to "Allow" or "Ask"</li>
            <li><strong>Return to this page</strong> - it will auto-detect</li>
          </ol>
        );
    }
  };

  if (showSorryMessage) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-screen p-6"
      >
        <div className="w-full max-w-md text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
            className="w-24 h-24 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center"
          >
            <Settings className="w-12 h-12 text-orange-500" />
          </motion.div>

          <h2 className="text-3xl font-bold text-[#0A4D68] mb-4">
            Location Blocked in Browser
          </h2>
          
          <p className="text-gray-700 mb-6 text-lg">
            Location access is blocked in your browser. Follow these steps:
          </p>

          <div className="bg-blue-50 rounded-xl p-5 mb-4 text-left border-2 border-blue-200">
            <div className="flex items-start gap-3 mb-3">
              <Globe className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="font-bold text-blue-900">Reset Browser Permission:</p>
            </div>
            {getBrowserInstructions()}
          </div>

          <div className="bg-green-50 rounded-xl p-4 mb-6 text-left border border-green-200">
            <p className="text-sm text-green-900 font-semibold mb-2">✨ Auto-Detection Enabled!</p>
            <p className="text-sm text-green-800">
              Once you enable location, <strong>just return to this page</strong> and we'll automatically detect the change. No manual refresh needed!
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleRefreshPage}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 text-white h-12 text-lg font-semibold"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh Page & Try Again
            </Button>

            <Button
              onClick={handleTryAgain}
              variant="outline"
              className="w-full h-12 text-lg border-2 border-[#088395] text-[#088395] hover:bg-teal-50"
            >
              I've Fixed It - Try Now
            </Button>

            <Button
              onClick={onExit}
              variant="outline"
              className="w-full h-12 text-lg border-2 border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              Exit to Login
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center min-h-screen px-6 pt-6 pb-8 relative"
    >
      <button
        onClick={onExit}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5 text-gray-600" />
      </button>

      <div className="w-full max-w-md">
        <motion.div
          animate={{ 
            scale: granted ? [1, 1.2, 1] : 1,
            rotate: granted ? [0, 360] : 0
          }}
          transition={{ duration: 0.5 }}
          className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
            granted 
              ? "bg-green-100" 
              : "bg-gradient-to-br from-[#088395] to-[#05BFDB]"
          }`}
        >
          {granted ? (
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          ) : (
            <MapPin className="w-10 h-10 text-white" />
          )}
        </motion.div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          Enable Location Access
        </h2>
        
        <p className="text-gray-600 mb-8 text-center">
          Globeskimmers needs your location to provide personalized travel recommendations and nearby experiences
        </p>

        {error && (
          <div className="mb-6 space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm whitespace-pre-line">{error}</AlertDescription>
            </Alert>
            
            {/* Refresh Button */}
            <Button
              onClick={handleRefreshPage}
              variant="outline"
              className="w-full h-12 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh Page & Try Again
            </Button>

            {/* iOS-specific guidance */}
            {isIOS && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      iOS Tip:
                    </p>
                    <p className="text-sm text-blue-800 mb-3">
                      After enabling location in Settings, <strong>return to this page</strong> and we'll automatically detect the change!
                    </p>
                    <Button
                      onClick={openLocationSettings}
                      size="sm"
                      variant="outline"
                      className="text-xs border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      ⚙️ Try Opening Settings
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inline help card — appears after tapping "Try Opening
            Settings" when the App-Prefs deep link is silently
            rejected (Chrome iOS, in-app WebView, Android) or when
            the user is on an unsupported browser. Replaces a pair
            of alert() calls that interrupted onboarding with a
            browser dialog. Card stays visible while the user
            toggles between Settings and the app, so they can refer
            back to the steps. */}
        {settingsHelp && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm font-bold text-blue-900">
                {settingsHelp.title}
              </p>
              <button
                onClick={() => setSettingsHelp(null)}
                className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5 text-blue-700" />
              </button>
            </div>
            <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside ml-1">
              {settingsHelp.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </motion.div>
        )}

        {granted && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Location access granted! Redirecting...
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button
            onClick={requestLocation}
            disabled={loading || granted}
            className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold"
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                />
                Requesting Location...
              </>
            ) : granted ? (
              "Location Enabled ✓"
            ) : (
              "Allow Location Access"
            )}
          </Button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700 font-semibold mb-2">Why we need this:</p>
          <p className="text-sm text-gray-700">
            Required for nearby ATMs, currency exchange, weather updates, and location-based features.
          </p>
        </div>

        {!error && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <Settings className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-yellow-900 mb-1">Need help?</p>
                <p className="text-xs text-yellow-800">
                  If you're having trouble, look for the <strong>🔒 lock icon</strong> or <strong>aA button</strong> in your browser's address bar to manage location permissions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}