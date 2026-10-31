import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Camera, CircleUserRound, LayoutGrid, MapPin } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { NEUTRAL, rgba } from '@/components/redesign/constants';
import { logEvent } from '@/lib/analytics';

// Floating pill nav — fixed, centred, 22px above the bottom safe area. Five items (founder's
// navigation redesign, 2026-10-31, docs/NAV_REDESIGN_2026-10-31.md): Boards · Nearby · Stamp
// (raised, centre) · Passport · Profile. One rule: Passport is what you've collected, Profile is
// who you are and who you know. Mail left the bar for an envelope at the banner's top-left
// (src/components/mail/MailButton.jsx), Settings for a gear on the Profile cover.
//
// Active state comes from useLocation().pathname so Layout can render <FloatingNav /> without
// prop wiring: Boards (and the board pages) light Boards; Home lights Nearby; Passport lights
// Passport; Profile, Circle and Settings light Profile; everything else (finders, a traveler's
// page, the Mailbox) lights nothing.
//
// The Stamp button opens the Stamp sheet (Upload photos · Stamp where I am · post to a City
// Board) through `onStamp`, which Layout wires; without it, the Passport.
//
// An always-on 1px cream outer ring keeps the pill's edge readable where it floats over dark
// ground. Keyboard focus rings on the tabs are cream too (--gs-focus).
//
// Props:
//   dark:    pass `true` over dark/map surfaces to lift contrast.
//   active:  optional explicit override; otherwise auto-detected from route.
//   onStamp: opens the Stamp sheet (Layout passes it).
const STAMP_RED = '#B0472F';
const FG = '#FAF7EE';

const ITEMS = [
  { id: 'boards',   label: 'Boards',   route: 'Boards',   Icon: LayoutGrid },
  { id: 'nearby',   label: 'Nearby',   route: 'Home',     Icon: MapPin },
  { id: 'stamp',    label: 'Stamp',    route: 'Passport', Icon: Camera, raised: true },
  { id: 'passport', label: 'Passport', route: 'Passport', Icon: BookOpen },
  { id: 'profile',  label: 'Profile',  route: 'Profile',  Icon: CircleUserRound },
];

export default function FloatingNav({ active, dark = false, onStamp = undefined }) {
  const navigate = useNavigate();
  const location = useLocation();

  const path = location.pathname.toLowerCase();
  const detectActive = () => {
    if (active) return active;
    if (path.includes('boards') || path.includes('cityboard')) return 'boards';
    if (path.includes('passport')) return 'passport';
    if (path.includes('profile') || path.includes('circle') || path.includes('settings')) return 'profile';
    if (path === '/' || path.includes('home')) return 'nearby';
    return null;
  };
  const activeTab = detectActive();

  // Hidden through onboarding: the member isn't through the door yet, and the pill covered the
  // country list on small Android viewports.
  if (path.includes('onboarding')) return null;

  const bg = dark ? 'rgba(20,20,20,0.78)' : 'rgba(22,17,13,0.92)';
  const go = (it) => {
    logEvent('nav_tab', { tab: it.id }, 'Nav');
    if (it.id === 'stamp' && typeof onStamp === 'function') { onStamp(); return; }
    navigate(createPageUrl(it.route));
  };

  return (
    <div
      // Cast: React's CSSProperties type has no CSS custom properties (--gs-focus).
      style={/** @type {import('react').CSSProperties} */ ({
        position: 'fixed',
        // env(safe-area-inset-bottom) keeps the pill above the home indicator
        // now that viewport-fit=cover makes the WebView extend edge-to-edge.
        bottom: 'calc(22px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        padding: 6,
        background: bg,
        color: FG,
        borderRadius: 9999,
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        boxShadow:
          `0 18px 40px -10px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${rgba(NEUTRAL.cream, 0.12)}`,
        '--gs-focus': NEUTRAL.cream,
        zIndex: 40,
      })}
    >
      {ITEMS.map((it) => {
        const { Icon } = it;
        if (it.raised) {
          // The stamp: a red disc rising out of the pill, the camera on it, "Stamp" under it.
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => go(it)}
              aria-label="Stamp: upload photos or stamp where you are"
              style={{
                width: 70,
                minHeight: 52,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4,
                padding: 0,
                background: 'transparent',
                border: 'none',
                color: FG,
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 58,
                  height: 58,
                  marginTop: -30,
                  borderRadius: 9999,
                  background: STAMP_RED,
                  boxShadow: `0 0 0 3px ${FG}, 0 10px 22px -8px rgba(176,71,47,0.7)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Camera size={26} strokeWidth={2} color="#fff" aria-hidden="true" focusable="false" />
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1, paddingBottom: 7 }}>{it.label}</span>
            </button>
          );
        }
        const isActive = activeTab === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => go(it)}
            aria-label={it.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              width: 62,
              minHeight: 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '7px 0',
              background: isActive ? 'linear-gradient(180deg,#1AA093,#0E6E66)' : 'transparent',
              border: 'none',
              borderRadius: 18,
              color: FG,
              opacity: isActive ? 1 : 0.62,
              cursor: 'pointer',
              transition: 'background 120ms, opacity 120ms',
            }}
          >
            <Icon size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
