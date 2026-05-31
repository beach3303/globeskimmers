import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home as HomeIcon, Bookmark, Settings as SettingsIcon } from 'lucide-react';
import { createPageUrl } from '@/utils';

// Floating pill nav — fixed, centered, 22px above bottom safe area.
// Per the Claude-design spec: 3 anchors only (Home, Saved, Settings).
// NOT Search — that was explicitly removed.
//
// Props:
//   active: 'home' | 'saved' | 'settings' — controls which item is highlighted.
//   dark:   pass `true` over dark/map surfaces to lift contrast.
export default function FloatingNav({ active = 'home', dark = false }) {
  const navigate = useNavigate();
  const items = [
    { id: 'home',     ico: HomeIcon,     route: 'Home' },
    { id: 'saved',    ico: Bookmark,     route: 'SavedLocations' },
    { id: 'settings', ico: SettingsIcon, route: 'Settings' },
  ];

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
        const isActive = active === it.id;
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
