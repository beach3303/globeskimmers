import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Home as HomeIcon, Bookmark, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { clearAppCache } from '@/lib/clearAppCache';

// Floating pill nav — fixed, centered, 22px above bottom safe area.
// Per the Claude-design spec: 3 anchors only (Home, Saved, Settings).
// NOT Search — that was explicitly removed.
//
// Active state is derived from useLocation().pathname so Layout can render
// <FloatingNav /> without prop wiring. Pass `dark` over dark/map surfaces
// for higher contrast.
//
// Props:
//   dark:   pass `true` over dark/map surfaces to lift contrast.
//   active: optional explicit override; otherwise auto-detected from route.
export default function FloatingNav({ active, dark = false, liftForAd = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { canRefresh } = useAuth();

  // Global refresh (admins + admin-granted users only): wipe cached RESULTS so
  // the user gets fresh data, then reload to refetch. Never touches auth, prefs,
  // or saved locations (see clearAppCache).
  const handleRefresh = () => {
    if (typeof window !== 'undefined' && !window.confirm('Refresh all cached results? The app will reload with fresh data.')) return;
    clearAppCache();
    setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 60);
  };

  const items = [
    { id: 'home',     ico: HomeIcon,     route: 'Home' },
    { id: 'saved',    ico: Bookmark,     route: 'SavedLocations' },
    { id: 'settings', ico: SettingsIcon, route: 'Settings' },
  ];

  // Auto-detect active tab from route. Mirrors the BottomNav logic so swapping
  // BottomNav -> FloatingNav doesn't lose the highlight behavior.
  const path = location.pathname.toLowerCase();
  const detectActive = () => {
    if (active) return active;
    if (path.includes('savedlocations') || path.endsWith('/saved')) return 'saved';
    if (path.includes('settings')) return 'settings';
    if (path === '/' || path.includes('home')) return 'home';
    return null;  // any other finder/page -> no tab highlighted
  };
  const activeTab = detectActive();

  // Hide the floating nav on screens where it would actively interfere:
  //
  //   - Camera-led pages (Smart Text Scanner / Smart Price Scanner) need
  //     the bottom of the screen for their primary CTA ("Freeze & translate"
  //     / "Freeze & convert price"). The user exits via the page's own X
  //     button at the top.
  //
  //   - Onboarding flow (multi-step form: referral source, location, home
  //     country, currency, language, temperature). Showing Home/Saved/
  //     Settings during onboarding is hostile because the user hasn't been
  //     authenticated to those features yet AND the pill overlaps the
  //     content on small Android viewports (Galaxy S10 reported this hiding
  //     the country dropdown / language list behind it). The "Skip for now"
  //     link inside each step is the intentional escape hatch.
  if (
    path.includes('smarttextscanner') ||
    path.includes('smartpricescanner') ||
    path.includes('onboarding')
  ) {
    return null;
  }

  const bg = dark ? 'rgba(20,20,20,0.78)' : 'rgba(22,17,13,0.92)';
  const fg = '#FAF7EE';

  return (
    <div
      style={{
        position: 'fixed',
        // Lifted above the AdMob banner on Home (liftForAd) so the ad can
        // pin to the very bottom edge without the pill overlapping it.
        // env(safe-area-inset-bottom) keeps the pill above the home indicator
        // now that viewport-fit=cover makes the WebView extend edge-to-edge.
        //
        // Android has no iOS-style bottom safe-area inset (env resolves to 0)
        // and the AdMob banner sits lower, so the pill needs a bigger base
        // lift there to clear the ad. iOS keeps the tighter value + its inset.
        bottom: liftForAd
          ? `calc(${Capacitor.getPlatform() === 'android' ? 72 : 64}px + env(safe-area-inset-bottom))`
          : 'calc(22px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        background: bg,
        color: fg,
        borderRadius: 9999,
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        boxShadow:
          '0 18px 40px -10px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.06) inset',
        zIndex: 40,
      }}
    >
      {items.map((it) => {
        const Icon = it.ico;
        const isActive = activeTab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => navigate(createPageUrl(it.route))}
            aria-label={it.id}
            style={{
              width: 52,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? 'rgba(255,255,255,.14)' : 'transparent',
              border: 'none',
              borderRadius: 9999,
              color: fg,
              opacity: isActive ? 1 : 0.7,
              cursor: 'pointer',
              transition: 'background 120ms, opacity 120ms',
            }}
          >
            <Icon size={20} strokeWidth={1.8} />
          </button>
        );
      })}

      {/* 4th icon: global refresh / clear-cache. Only for admins + granted users
          (canRefresh). Runs an action, not a route. */}
      {canRefresh && (
        <button
          onClick={handleRefresh}
          aria-label="refresh"
          title="Refresh app (clear cached results)"
          style={{
            width: 52,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 9999,
            color: fg,
            opacity: 0.7,
            cursor: 'pointer',
            transition: 'background 120ms, opacity 120ms',
          }}
        >
          <RefreshCw size={20} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
