import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useIsTablet } from '@/lib/useIsTablet';
import { socialUnread } from '@/lib/passport';

// Floating pill nav — fixed, centered, 22px above bottom safe area.
// 4 anchors: Home, Trips, Passport, Settings.
// NOT Search — that was explicitly removed (per the Claude-design spec).
// Saved now lives inside Trips (its SAVED tab); /SavedLocations stays routed
// for management + deep links. The old admin-gated Refresh action moved to
// Settings ("Refresh app data").
//
// Active state is derived from useLocation().pathname so Layout can render
// <FloatingNav /> without prop wiring. Pass `dark` over dark/map surfaces
// for higher contrast.
//
// Props:
//   dark:   pass `true` over dark/map surfaces to lift contrast.
//   active: optional explicit override; otherwise auto-detected from route.
export default function FloatingNav({ active, dark = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isTablet = useIsTablet();

  // The unread dot on Mailbox: refreshed on navigation and when the app comes
  // back to the foreground (at most once a minute), cleared the moment the
  // Mailbox marks everything seen (the gs:unread event).
  const [unread, setUnread] = useState(0);
  const lastCheck = useRef(0);
  useEffect(() => {
    let gone = false;
    const check = async (force = false) => {
      if (!force && Date.now() - lastCheck.current < 60000) return;
      lastCheck.current = Date.now();
      const { total, error } = await socialUnread();
      if (!gone && !error) setUnread(total);
    };
    check();
    const onSeen = () => { setUnread(0); lastCheck.current = Date.now(); };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('gs:unread', onSeen);
    document.addEventListener('visibilitychange', onVisible);
    return () => { gone = true; window.removeEventListener('gs:unread', onSeen); document.removeEventListener('visibilitychange', onVisible); };
  }, [location.pathname]);

  // Emoji nav icons (matches the iPad redesign spec). Shown on BOTH phone and
  // iPad so the chrome is consistent — each item is a real emoji + label.
  const items = [
    { id: 'home',     emoji: '🏠', label: 'Home',     route: 'Home' },
    { id: 'mailbox',  emoji: '📬', label: 'Mailbox',  route: 'Mailbox' },
    { id: 'passport', emoji: '🛂', label: 'Passport', route: 'Passport' },
    { id: 'profile',  emoji: '👤', label: 'Profile',  route: 'Profile' },
    { id: 'settings', emoji: '⚙️', label: 'Settings', route: 'Settings' },
  ];

  // Auto-detect active tab from route. The Trips anchor also lights up on the
  // surfaces it absorbed (MyTrip / Wishlist / SavedLocations stay routed for
  // deep links), so the pill never loses the highlight on those pages.
  const path = location.pathname.toLowerCase();
  const detectActive = () => {
    if (active) return active;
    if (path.includes('passport')) return 'passport';
    if (path.includes('profile')) return 'profile';
    if (path.includes('mailbox')) return 'mailbox';
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
  //     country, currency, language, temperature). Showing the nav during
  //     onboarding is hostile because the user hasn't been authenticated to
  //     those features yet AND the pill overlaps the content on small Android
  //     viewports (Galaxy S10 reported this hiding the country dropdown /
  //     language list behind it). The "Skip for now" link inside each step is
  //     the intentional escape hatch.
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
        // env(safe-area-inset-bottom) keeps the pill above the home indicator
        // now that viewport-fit=cover makes the WebView extend edge-to-edge.
        bottom: 'calc(22px + env(safe-area-inset-bottom))',
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
            aria-label={it.id === 'mailbox' && unread > 0 ? `mailbox, ${unread} new` : it.id}
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
            <span style={{ fontSize: 22, lineHeight: 1, position: 'relative' }}>
              {it.emoji}
              {it.id === 'mailbox' && unread > 0 && !isActive && (
                <span aria-hidden="true" style={{ position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 9999, background: '#E0533C', boxShadow: `0 0 0 2px ${bg}` }} />
              )}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
