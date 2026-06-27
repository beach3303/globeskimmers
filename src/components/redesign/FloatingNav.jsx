import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { clearAppCache } from '@/lib/clearAppCache';
import { useIsTablet } from '@/lib/useIsTablet';

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
  const [refreshing, setRefreshing] = useState(false);
  const isTablet = useIsTablet();

  // Global refresh (admins + admin-granted users only): wipe cached RESULTS so
  // the user gets fresh data, then reload to refetch. Never touches auth, prefs,
  // or saved locations (see clearAppCache). The 🔄 icon spins from the moment
  // the button is hit until the reload, so clearing the cache is visibly confirmed.
  const handleRefresh = () => {
    if (typeof window !== 'undefined' && !window.confirm('Refresh all cached results? The app will reload with fresh data.')) return;
    setRefreshing(true);
    clearAppCache();
    // Short delay so the spin is visible before the reload swaps the page out.
    setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 600);
  };

  // Emoji nav icons (matches the iPad redesign spec). Shown on BOTH phone and
  // iPad so the chrome is consistent — each item is a real emoji + label.
  const items = [
    { id: 'home',     emoji: '🏠', label: 'Home',     route: 'Home' },
    { id: 'saved',    emoji: '🔖', label: 'Saved',    route: 'SavedLocations' },
    { id: 'settings', emoji: '⚙️', label: 'Settings', route: 'Settings' },
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
          // iPad serves a taller AdMob adaptive banner (~90px, sitting above the
          // home-indicator inset) than phones (~50px), so the pill needs a bigger
          // lift on tablet to clear it instead of hiding behind it.
          ? (isTablet
              ? 'calc(108px + env(safe-area-inset-bottom))'
              : `calc(${Capacitor.getPlatform() === 'android' ? 72 : 64}px + env(safe-area-inset-bottom))`)
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
        const isActive = activeTab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => navigate(createPageUrl(it.route))}
            aria-label={it.id}
            style={{
              minWidth: 62,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '7px 10px',
              background: isActive ? 'linear-gradient(180deg,#1AA093,#0E6E66)' : 'transparent',
              border: 'none',
              borderRadius: 18,
              color: fg,
              opacity: isActive ? 1 : 0.62,
              cursor: 'pointer',
              transition: 'background 120ms, opacity 120ms',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{it.emoji}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1 }}>{it.label}</span>
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
            minWidth: 62,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            padding: '7px 10px',
            background: 'transparent',
            border: 'none',
            borderRadius: 18,
            color: fg,
            opacity: 0.62,
            cursor: 'pointer',
            transition: 'background 120ms, opacity 120ms',
          }}
        >
          <span className={refreshing ? 'animate-spin' : ''} style={{ fontSize: 22, lineHeight: 1, display: 'inline-block' }}>🔄</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1 }}>Refresh</span>
        </button>
      )}
    </div>
  );
}
