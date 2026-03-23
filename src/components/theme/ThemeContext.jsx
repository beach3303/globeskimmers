// ============================================================================
// GLOBESKIMMERS THEME CONTEXT v2.0
// ============================================================================
// 4 Themes: Original, Dark Navigator, Space Explorer, Executive Blue
// Now with page-specific colors for consistent theming across ALL features
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';

const THEMES = {
  light: {
    id: 'light',
    name: 'Original',
    description: 'Bright & colorful',
    isDark: false,
    colors: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceMuted: '#F1F5F9',
      textPrimary: '#1E293B',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
      primary: '#0D9488',
      primaryLight: '#14B8A6',
      accent: '#06B6D4',
      headerBg: 'linear-gradient(135deg, #0D9488 0%, #06B6D4 100%)',
      headerText: '#FFFFFF',
      cardBg: '#FFFFFF',
      cardBorder: '#E2E8F0',
      navBg: '#FFFFFF',
      navBorder: '#E2E8F0',
      navActive: '#0D9488',
      navInactive: '#94A3B8',
      pageBg: {
        placesToEat: '#FFF7ED',
        thingsToDo: '#EFF6FF',
        coffee: '#FEF3C7',
        atm: '#E0F2FE',
        restroom: '#F1F5F9',
        transportation: '#EDE9FE',
        weather: '#FEF9C3',
        moneyExchange: '#DCFCE7',
        phrases: '#F3E8FF',
        priceScanner: '#CCFBF1',
        shopping: '#FCE7F3',
        culture: '#E0E7FF',
      },
      moneyExchangeBg: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    },
    effects: {
      cardShadow: '0 1px 3px rgba(0,0,0,0.1)',
      headerShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    }
  },
  
  dark: {
    id: 'dark',
    name: 'Dark Navigator',
    description: 'Easy on the eyes',
    isDark: true,
    colors: {
      background: '#0F172A',
      surface: '#1E293B',
      surfaceMuted: '#334155',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      primary: '#22D3EE',
      primaryLight: '#67E8F9',
      accent: '#A78BFA',
      headerBg: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
      headerText: '#F8FAFC',
      cardBg: '#1E293B',
      cardBorder: '#334155',
      navBg: '#1E293B',
      navBorder: '#334155',
      navActive: '#22D3EE',
      navInactive: '#64748B',
      pageBg: {
        placesToEat: '#0F172A',
        thingsToDo: '#0F172A',
        coffee: '#0F172A',
        atm: '#0F172A',
        restroom: '#0F172A',
        transportation: '#0F172A',
        weather: '#0F172A',
        moneyExchange: '#0F172A',
        phrases: '#0F172A',
        priceScanner: '#0F172A',
        shopping: '#0F172A',
        culture: '#0F172A',
      },
      featureAccents: {
        placesToEat: '#F97316',
        thingsToDo: '#3B82F6',
        coffee: '#D97706',
        atm: '#0EA5E9',
        restroom: '#64748B',
        transportation: '#8B5CF6',
        weather: '#FBBF24',
        moneyExchange: '#10B981',
        phrases: '#A78BFA',
        priceScanner: '#14B8A6',
        shopping: '#EC4899',
        culture: '#6366F1',
      },
      moneyExchangeBg: 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
    },
    effects: {
      cardShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
      headerShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
    }
  },
  
  space: {
    id: 'space',
    name: 'Space Explorer',
    description: 'Cosmic vibes',
    isDark: true,
    colors: {
      background: '#0a0a1f',
      surface: 'rgba(30, 41, 59, 0.8)',
      surfaceMuted: 'rgba(51, 65, 85, 0.6)',
      textPrimary: '#F8FAFC',
      textSecondary: '#E2E8F0',
      textMuted: '#94A3B8',
      primary: '#EC4899',
      primaryLight: '#F472B6',
      accent: '#8B5CF6',
      headerBg: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
      headerText: '#FFFFFF',
      cardBg: 'rgba(30, 41, 59, 0.7)',
      cardBorder: 'rgba(139, 92, 246, 0.3)',
      navBg: 'rgba(15, 23, 42, 0.95)',
      navBorder: 'rgba(139, 92, 246, 0.2)',
      navActive: '#EC4899',
      navInactive: '#64748B',
      pageBg: {
        placesToEat: '#0a0a1f',
        thingsToDo: '#0a0a1f',
        coffee: '#0a0a1f',
        atm: '#0a0a1f',
        restroom: '#0a0a1f',
        transportation: '#0a0a1f',
        weather: '#0a0a1f',
        moneyExchange: '#0a0a1f',
        phrases: '#0a0a1f',
        priceScanner: '#0a0a1f',
        shopping: '#0a0a1f',
        culture: '#0a0a1f',
      },
      featureAccents: {
        placesToEat: '#F472B6',
        thingsToDo: '#A78BFA',
        coffee: '#D97706',
        atm: '#06B6D4',
        restroom: '#6B7280',
        transportation: '#8B5CF6',
        weather: '#FBBF24',
        moneyExchange: '#34D399',
        phrases: '#C084FC',
        priceScanner: '#2DD4BF',
        shopping: '#EC4899',
        culture: '#818CF8',
      },
      moneyExchangeBg: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
    },
    effects: {
      cardShadow: '0 4px 20px rgba(139, 92, 246, 0.15)',
      headerShadow: '0 4px 20px rgba(236, 72, 153, 0.2)',
      glowEffect: '0 0 20px rgba(139, 92, 246, 0.3)',
    }
  },
  
  executive: {
    id: 'executive',
    name: 'Executive Blue',
    description: 'Professional & sleek',
    isDark: true,  // Changed to dark for blue background
    colors: {
      background: '#0C4A6E',
      surface: '#0E7490',
      surfaceMuted: '#155E75',
      textPrimary: '#F0F9FF',
      textSecondary: '#BAE6FD',
      textMuted: '#7DD3FC',
      primary: '#38BDF8',
      primaryLight: '#7DD3FC',
      accent: '#22D3EE',
      headerBg: 'linear-gradient(135deg, #0369A1 0%, #0284C7 100%)',
      headerText: '#FFFFFF',
      cardBg: '#0E7490',
      cardBorder: '#0891B2',
      navBg: '#0C4A6E',
      navBorder: '#0E7490',
      navActive: '#38BDF8',
      navInactive: '#7DD3FC',
      pageBg: {
        placesToEat: '#0C4A6E',
        thingsToDo: '#0C4A6E',
        coffee: '#0C4A6E',
        atm: '#0C4A6E',
        restroom: '#0C4A6E',
        transportation: '#0C4A6E',
        weather: '#0C4A6E',
        moneyExchange: '#0C4A6E',
        phrases: '#0C4A6E',
        priceScanner: '#0C4A6E',
        shopping: '#0C4A6E',
        culture: '#0C4A6E',
      },
      featureAccents: {
        placesToEat: '#FB923C',
        thingsToDo: '#38BDF8',
        coffee: '#D97706',
        atm: '#22D3EE',
        restroom: '#94A3B8',
        transportation: '#A78BFA',
        weather: '#FBBF24',
        moneyExchange: '#34D399',
        phrases: '#C084FC',
        priceScanner: '#2DD4BF',
        shopping: '#F472B6',
        culture: '#818CF8',
      },
      moneyExchangeBg: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    },
    effects: {
      cardShadow: '0 4px 15px rgba(0,0,0,0.2)',
      headerShadow: '0 4px 6px -1px rgba(0,0,0,0.2)',
    }
  }
};

const getFlagUrl = (countryCode) => {
  if (!countryCode) return null;
  return `https://flagcdn.com/w640/${countryCode.toLowerCase()}.png`;
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState('light');
  const [countryCode, setCountryCode] = useState(null);
  const [homeCountryCode, setHomeCountryCode] = useState(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('gs_theme');
    if (saved && THEMES[saved]) setThemeId(saved);
  }, []);
  
  useEffect(() => {
    localStorage.setItem('gs_theme', themeId);
    if (THEMES[themeId]?.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeId]);
  
  const theme = THEMES[themeId];
  const flagUrl = getFlagUrl(countryCode);
  const homeFlagUrl = getFlagUrl(homeCountryCode);
  
  const setTheme = (id) => { if (THEMES[id]) setThemeId(id); };
  const getPageBackground = (pageName) => theme.colors.pageBg?.[pageName] || theme.colors.background;
  const getFeatureAccent = (featureName) => theme.colors.featureAccents?.[featureName] || theme.colors.primary;
  
  return (
    <ThemeContext.Provider value={{
      theme, themeId, setTheme, themes: THEMES,
      countryCode, setCountryCode,
      homeCountryCode, setHomeCountryCode,
      flagUrl, homeFlagUrl, getFlagUrl,
      getPageBackground, getFeatureAccent,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

export { THEMES };
