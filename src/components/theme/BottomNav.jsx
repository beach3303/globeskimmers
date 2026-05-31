// ============================================================================
// GLOBESKIMMERS BOTTOM NAVIGATION
// ============================================================================
// 3-tab nav: Home | Saved Locations | Settings.
// Hardcoded warm-ivory + ink redesign tokens. ThemeContext removed in RD-P4.
// Will be swapped for FloatingNav (centered pill) in RD-P5.
// ============================================================================

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, Bookmark, Settings } from 'lucide-react';
import { TEAL_DEEP } from '@/components/redesign/constants';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('savedlocations') || path.includes('saved')) return 'saved';
    if (path.includes('settings')) return 'settings';
    if (path === '/' || path.includes('home')) return 'home';
    return 'home';
  };

  const activeTab = getActiveTab();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, page: 'Home' },
    { id: 'saved', label: 'Saved Locations', icon: Bookmark, page: 'SavedLocations' },
    { id: 'settings', label: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const handleNavClick = (item) => {
    if (item.page) navigate(createPageUrl(item.page));
  };

  // Active = TEAL_DEEP. Inactive = muted ink-3. Bg = warm-ivory white-ish.
  const activeColor = TEAL_DEEP;
  const inactiveColor = '#94A3B8';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center font-sans"
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #F0E9DC',
        padding: '8px 0',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 16px))',
        boxShadow: '0 -4px 20px rgba(15,20,25,0.06)',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const iconColor = isActive ? activeColor : inactiveColor;
        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item)}
            className="flex flex-col items-center gap-1 px-4 py-2 transition-all active:scale-95"
            style={{ minWidth: '64px' }}
          >
            <div className="relative">
              <Icon
                size={24}
                color={iconColor}
                strokeWidth={isActive ? 2.5 : 2}
                style={{
                  transition: 'all 0.2s ease',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              />
              {isActive && (
                <div
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: activeColor }}
                />
              )}
            </div>
            <span
              className="text-[10px] whitespace-nowrap"
              style={{
                fontWeight: isActive ? 700 : 500,
                color: isActive ? activeColor : inactiveColor,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
