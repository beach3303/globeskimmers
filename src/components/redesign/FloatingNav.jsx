import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, CircleUserRound, Stamp, Users } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { NEUTRAL, rgba } from '@/components/redesign/constants';
import { logEvent } from '@/lib/analytics';
import { refreshUnread, useUnread, wireUnread } from '@/lib/unreadStore';

// Floating pill nav — fixed, centred, 22px above the bottom safe area. FOUR items (founder decision
// 6B, 2026-11-20): Passport · Stamp (raised) · Friends · Profile. Passport is what you've
// collected (with the stamps near you and the Traveler tools door inside it); Friends is your
// people — the Mailbox first, with the circle and the City Boards one tap away; Profile is who you
// are. The 2026-10-31 bar (Boards · Nearby · Stamp · Passport · Profile) is in git history; the
// Nearby page (Home) still exists as Traveler tools, reached from the Passport.
// Settings is a gear on the Profile cover.
//
// Active state comes from useLocation().pathname so Layout can render <FloatingNav /> without
// prop wiring: Passport lights Passport; the Mailbox, Postcards, Sent, Circle, Friends' news, a
// traveler's page and the board pages light Friends; Profile and Settings light Profile;
// everything else (the finders, Home as Traveler tools) lights nothing.
//
// The Stamp button opens the Stamp sheet (Upload photos · Stamp where I am · post to a City
// Board) through `onStamp`, which Layout wires; without it, the Passport. On the bar: the founder's
// photo-real rubber stamp, standing by itself (2026-11-01, option C: a flared flat-topped handle,
// no disc behind it — not a camera, since the button doesn't open the camera), 64 × 64, served by
// the API worker from R2 like the trunk renders (stamp-art/ui/stamp-button-2x.png 128 px and
// -3x.png 192 px; docs/STAMP_ICON_RENDER_PROMPT.md). Until that render exists, and while it loads,
// the flat version: a stamp-red disc with a cream ring and the lucide Stamp glyph.
//
// The Friends dot: a follow request waiting, or passport news unread (src/lib/unreadStore.js;
// mail lights the envelope instead, never this dot).
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
const DOT = '#E0533C';
const PILL = '#16110D';
const STAMP_ART = 'https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/ui/stamp-button-2x.png';
const STAMP_ART_3X = 'https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/ui/stamp-button-3x.png';

const ITEMS = [
  { id: 'passport', label: 'Passport', route: 'Passport', Icon: BookOpen },
  { id: 'stamp',    label: 'Stamp',    route: 'Passport', Icon: Stamp, raised: true },
  { id: 'friends',  label: 'Friends',  route: 'Mailbox',  Icon: Users },
  { id: 'profile',  label: 'Profile',  route: 'Profile',  Icon: CircleUserRound },
];

// The render, once: null while unknown, true when it loaded, false when there is none yet.
let artKnown = null;
function useStampArt() {
  const [art, setArt] = useState(artKnown);
  useEffect(() => {
    if (artKnown !== null || typeof Image === 'undefined') return undefined;
    let gone = false;
    const img = new Image();
    img.onload = () => { artKnown = true; if (!gone) setArt(true); };
    img.onerror = () => { artKnown = false; if (!gone) setArt(false); };
    img.src = STAMP_ART;
    return () => { gone = true; };
  }, []);
  return art === true;
}

export default function FloatingNav({ active, dark = false, onStamp = undefined }) {
  const navigate = useNavigate();
  const location = useLocation();
  const art = useStampArt();
  const { news, requests, mail } = useUnread();
  const friendsDot = news > 0 || requests > 0 || mail > 0;   // Friends is where all of it lives now (2026-11-21)

  const path = location.pathname.toLowerCase();
  // The shared unread read: on navigation, at most once a minute (the envelope reads it too).
  useEffect(() => { wireUnread(); refreshUnread(); }, [location.pathname]);

  const detectActive = () => {
    if (active) return active;
    if (path === '/' || path.includes('passport')) return 'passport';
    if (path.includes('mailbox') || path.includes('postcards') || path.includes('sent') || path.includes('circle') || path.includes('friendsnews') || path.includes('traveler') || path.includes('boards') || path.includes('cityboard')) return 'friends';
    if (path.includes('profile') || path.includes('settings')) return 'profile';
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
          // The stamp rising out of the pill, "Stamp" under it: the render by itself once it loads,
          // the flat red disc until then.
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
              {art ? (
                <img src={STAMP_ART} srcSet={`${STAMP_ART} 2x, ${STAMP_ART_3X} 3x`} alt="" width={64} height={64} draggable={false} aria-hidden="true"
                  style={{ width: 64, height: 64, marginTop: -34, display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.45))' }} />
              ) : (
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
                  <Icon size={26} strokeWidth={2} color="#fff" aria-hidden="true" focusable="false" />
                </span>
              )}
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1, paddingBottom: 7 }}>{it.label}</span>
            </button>
          );
        }
        const isActive = activeTab === it.id;
        const dot = it.id === 'friends' && friendsDot;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => go(it)}
            aria-label={dot ? 'Friends, something new' : it.label}
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
            <span style={{ position: 'relative', display: 'inline-flex', lineHeight: 0 }}>
              <Icon size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
              {dot ? (
                // A follow request or unread news: a red dot at the icon's top-right, ringed in the pill.
                <span aria-hidden="true" style={{ position: 'absolute', top: -3, right: -4, width: 10, height: 10, borderRadius: 999, background: DOT, boxShadow: `0 0 0 2px ${isActive ? '#13877C' : PILL}` }} />
              ) : null}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
