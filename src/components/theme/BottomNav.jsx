// ============================================================================
// GLOBESKIMMERS BOTTOM NAVIGATION
// ============================================================================
// Navigation: Home | Saved Locations | Theme | Settings
// ============================================================================

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, Bookmark, Palette, Settings } from 'lucide-react';
import { useTheme } from './ThemeContext';
import ThemePickerModal from './ThemePickerModal';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);
  
  // Determine active tab from current path
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
    { id: 'theme', label: 'Theme', icon: Palette, page: null }, // Opens modal
    { id: 'settings', label: 'Settings', icon: Settings, page: 'Settings' },
  ];
  
  const handleNavClick = (item) => {
    if (item.id === 'theme') {
      setShowThemePicker(true);
    } else if (item.page) {
      navigate(createPageUrl(item.page));
    }
  };
  
  return (
    <>
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center transition-colors duration-300"
        style={{
          background: theme.colors.navBg,
          borderTop: `1px solid ${theme.colors.navBorder}`,
          padding: '8px 0',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 16px))',
          boxShadow: theme.isDark 
            ? '0 -4px 20px rgba(0,0,0,0.3)' 
            : '0 -4px 20px rgba(0,0,0,0.06)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'theme' 
            ? showThemePicker 
            : activeTab === item.id;
          
          // Theme icon always shows primary color
          const iconColor = item.id === 'theme'
            ? theme.colors.primary
            : isActive 
              ? theme.colors.navActive
              : theme.colors.navInactive;
          
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
                
                {/* Active indicator dot */}
                {isActive && (
                  <div 
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: theme.colors.navActive }}
                  />
                )}
                
                {/* Theme indicator - colored dot showing current theme */}
                {item.id === 'theme' && !isActive && (
                  <div 
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                    style={{ 
                      background: theme.colors.primary,
                      borderColor: theme.colors.navBg,
                    }}
                  />
                )}
              </div>
              
              <span 
                className="text-[10px] transition-all whitespace-nowrap"
                style={{
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? theme.colors.navActive : theme.colors.navInactive,
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
      
      {/* Theme Picker Modal */}
      <ThemePickerModal 
        isOpen={showThemePicker} 
        onClose={() => setShowThemePicker(false)} 
      />
    </>
  );
}
