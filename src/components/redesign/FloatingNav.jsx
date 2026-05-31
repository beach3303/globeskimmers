import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Bookmark, Settings as SettingsIcon } from 'lucide-react';
import { createPageUrl } from '@/utils';

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
export default function FloatingNav({ active, dark = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { id: 'home',     ico: HomeIcon,     route: 'Home' },
    { id: 'saved',    ico: Bookmark,     route: 'SavedLocations' },
    { id: 'settings', ico: SettingsIcon, route: 'Settings' },
  ];

  // Auto-detect active tab from route. Mirrors the BottomNav logic so swapping
  // BottomNav -> FloatingNav doesn't lose the highlight behavior.
  const detectActive = () => {
    if (active) return active;
    const path = location.pathname.toLowerCase();
    if (path.includes('savedlocations') || path.endsWith('/saved')) return 'saved';
    if (path.includes('settings')) return 'settings';
    if (path === '/' || path.includes('home')) return 'home';
    return null;  // any other finder/page -> no tab highlighted
  };
  const activeTab = detectActive();

  const bg = dark ? 'rgba(20,20,20,0.78)' : 'rgba(22,17,13,0.92)';
  const fg = '#FAF7EE';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 22,
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
    </div>
  );
}
