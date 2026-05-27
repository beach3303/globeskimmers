import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Cloud, Utensils, Coffee as CoffeeIcon, CreditCard, Bath, Store, CloudSun, Search, ShoppingBag, Compass, Landmark, Camera, MessageSquare, Car, LayoutGrid, Navigation, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { trackEvent } from "../Layout";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import { useTheme } from "../components/theme/ThemeContext";

// Translation mapping for greetings
const HELLO_TRANSLATIONS = {
  'Spain': { greeting: 'hola', lang: 'Spanish' },
  'Mexico': { greeting: 'hola', lang: 'Spanish' },
  'France': { greeting: 'bonjour', lang: 'French' },
  'Germany': { greeting: 'hallo', lang: 'German' },
  'Italy': { greeting: 'ciao', lang: 'Italian' },
  'Portugal': { greeting: 'olá', lang: 'Portuguese' },
  'Brazil': { greeting: 'olá', lang: 'Portuguese' },
  'China': { greeting: '你好', lang: 'Chinese' },
  'Japan': { greeting: 'こんにちは', lang: 'Japanese' },
  'South Korea': { greeting: '안녕하세요', lang: 'Korean' },
  'Thailand': { greeting: 'สวัสดี', lang: 'Thai' },
  'Vietnam': { greeting: 'xin chào', lang: 'Vietnamese' },
  'Indonesia': { greeting: 'halo', lang: 'Indonesian' },
  'Philippines': { greeting: 'kumusta', lang: 'Filipino' },
  'India': { greeting: 'namaste', lang: 'Hindi' },
};

// Country code mapping
const COUNTRY_CODES = {
  'United States': 'US', 'Philippines': 'PH', 'Japan': 'JP', 'South Korea': 'KR',
  'Thailand': 'TH', 'Vietnam': 'VN', 'Singapore': 'SG', 'Malaysia': 'MY',
  'Indonesia': 'ID', 'Australia': 'AU', 'United Kingdom': 'GB', 'France': 'FR',
  'Germany': 'DE', 'Italy': 'IT', 'Spain': 'ES', 'Mexico': 'MX', 'Brazil': 'BR',
  'India': 'IN', 'China': 'CN', 'Canada': 'CA',
};

// ============================================================================
// BUTTON CONFIGURATIONS WITH EMOJIS
// ============================================================================

const TIER_1_BUTTONS = [
  { id: 'transportation', emoji: '🚕', label: 'Transportation', action: 'Transportation',
    colors: { light: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', dark: 'linear-gradient(135deg, #1E40AF 0%, #1D4ED8 100%)', space: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', executive: 'linear-gradient(135deg, #0891B2 0%, #0E7490 100%)' }},
  { id: 'places-to-eat', emoji: '🍽️', label: 'Places to Eat', action: 'Places to Eat',
    colors: { light: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', dark: 'linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)', space: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)', executive: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)' }},
  { id: 'coffee', emoji: '☕', label: 'Coffee Finder', action: 'Coffee',
    colors: { light: 'linear-gradient(135deg, #92400E 0%, #78350F 100%)', dark: 'linear-gradient(135deg, #78350F 0%, #451A03 100%)', space: 'linear-gradient(135deg, #B45309 0%, #92400E 100%)', executive: 'linear-gradient(135deg, #A16207 0%, #854D0E 100%)' }},
];

const TIER_2_BUTTONS = [
  { id: 'atm', emoji: '🏧', label: 'ATM Finder', action: 'ATM',
    colors: { light: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)', dark: 'linear-gradient(135deg, #0369A1 0%, #075985 100%)', space: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)', executive: 'linear-gradient(135deg, #0891B2 0%, #0E7490 100%)' }},
  { id: 'restroom', emoji: '🚻', label: 'Restroom Finder', action: 'Restroom',
    colors: { light: 'linear-gradient(135deg, #64748B 0%, #475569 100%)', dark: 'linear-gradient(135deg, #475569 0%, #334155 100%)', space: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)', executive: 'linear-gradient(135deg, #64748B 0%, #475569 100%)' }},
  { id: 'convenience', emoji: '🏪', label: 'Convenience Store', action: 'Convenience Store',
    colors: { light: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)', dark: 'linear-gradient(135deg, #C2410C 0%, #9A3412 100%)', space: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)', executive: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)' }},
  { id: 'weather', emoji: '🌤️', label: 'Weather', action: 'Weather',
    colors: { light: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)', dark: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)', space: 'linear-gradient(135deg, #FCD34D 0%, #FBBF24 100%)', executive: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }},
];

const TIER_3_BUTTONS = [
  { id: 'phrases', emoji: '🗣️', label: 'Basic Phrases', action: 'Basic Phrases',
    colors: { light: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', dark: 'linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)', space: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)', executive: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' }},
  { id: 'price-scanner', emoji: '🧾', label: 'Price Scanner', action: 'Smart Price Scanner',
    colors: { light: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)', dark: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)', space: 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)', executive: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)' }},
  { id: 'shopping', emoji: '🛍️', label: 'Shopping', action: 'Shopping',
    colors: { light: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)', dark: 'linear-gradient(135deg, #BE185D 0%, #9D174D 100%)', space: 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)', executive: 'linear-gradient(135deg, #DB2777 0%, #BE185D 100%)' }},
];

const MORE_BUTTONS = [
  { id: 'things-to-do', emoji: '🎯', label: 'Things to Do', action: 'Things to Do',
    colors: { light: 'linear-gradient(135deg, #A855F7 0%, #9333EA 100%)', dark: 'linear-gradient(135deg, #7E22CE 0%, #6B21A8 100%)', space: 'linear-gradient(135deg, #C084FC 0%, #A855F7 100%)', executive: 'linear-gradient(135deg, #9333EA 0%, #7E22CE 100%)' }},
  { id: 'culture', emoji: '🏛️', label: 'Culture Info', action: 'Culture Information',
    colors: { light: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', dark: 'linear-gradient(135deg, #4338CA 0%, #3730A3 100%)', space: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)', executive: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)' }},
  { id: 'text-scanner', emoji: '📝', label: 'Text Scanner', action: 'Smart Text Scanner',
    colors: { light: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', dark: 'linear-gradient(135deg, #047857 0%, #065F46 100%)', space: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)', executive: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }},
  { id: 'dish-gallery', emoji: '📸', label: 'Dish Gallery', action: 'Dish Gallery',
    colors: { light: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', dark: 'linear-gradient(135deg, #B45309 0%, #92400E 100%)', space: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)', executive: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)' }},
];

export default function HomePage() {
  const navigate = useNavigate();
  const { theme, setCountryCode, setHomeCountryCode } = useTheme();
  const { locationMode, selectedLocation, currentGpsLocation, getActiveLocation, loading: locationLoading } = useLocation();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localGreeting, setLocalGreeting] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezone, setTimezone] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [tempUnit, setTempUnit] = useState('F');
  const [homeCountryInfo, setHomeCountryInfo] = useState(null);
  const [homeCountryTime, setHomeCountryTime] = useState(new Date());
  const [shouldShowHomeCountryTime, setShouldShowHomeCountryTime] = useState(false);
  
  // NEW: State for showing home flag
  const [showHomeFlag, setShowHomeFlag] = useState(false);
  const [homeFlagUrl, setHomeFlagUrl] = useState(null);

  // Layout toggle: classic vs modern (persisted in localStorage)
  const [homeLayout, setHomeLayout] = useState(() => localStorage.getItem('gs_home_layout') || 'classic');
  const toggleHomeLayout = () => {
    const next = homeLayout === 'classic' ? 'modern' : 'classic';
    setHomeLayout(next);
    localStorage.setItem('gs_home_layout', next);
  };
  useEffect(() => {
    const handler = () => setHomeLayout(localStorage.getItem('gs_home_layout') || 'classic');
    window.addEventListener('globeskimmers:layoutChanged', handler);
    return () => window.removeEventListener('globeskimmers:layoutChanged', handler);
  }, []);

  useEffect(() => {
    if (!locationLoading) loadUserAndWeather();
  }, [locationLoading, locationMode, selectedLocation, currentGpsLocation]);

  // Set current location country code (for greeting only, not flag)
  useEffect(() => {
    const currentLocation = getActiveLocation();
    if (currentLocation?.address?.country) {
      const country = currentLocation.address.country;
      const code = COUNTRY_CODES[country];
      if (code) setCountryCode(code);
      
      // Local greeting based on CURRENT location
      const translation = HELLO_TRANSLATIONS[country];
      const englishPrimaryCountries = ['United States', 'United Kingdom', 'Australia', 'New Zealand', 'Ireland'];
      if (!englishPrimaryCountries.includes(country) && translation) {
        setLocalGreeting(translation.greeting);
      } else {
        setLocalGreeting(null);
      }
    }
  }, [locationMode, selectedLocation, currentGpsLocation, getActiveLocation, setCountryCode]);

  // Check if we should show home country time
  useEffect(() => {
    const checkShowHomeCountryTime = () => {
      if (!user || !homeCountryInfo || !getActiveLocation()?.address) {
        setShouldShowHomeCountryTime(false);
        return;
      }
      const activeLocation = getActiveLocation();
      const currentCountry = activeLocation.address.country;
      // Show home country time if in different country
      setShouldShowHomeCountryTime(currentCountry !== user.home_country);
    };
    checkShowHomeCountryTime();
  }, [user, homeCountryInfo, locationMode, selectedLocation, currentGpsLocation, getActiveLocation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setHomeCountryTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadUserAndWeather = async () => {
    try {
      const isAuthenticated = await base44.auth.isAuthenticated();
      if (!isAuthenticated) {
        base44.auth.redirectToLogin();
        return;
      }
      const userData = await base44.auth.me();
      setUser(userData);
      const preferredScale = userData.preferred_temperature_scale || 'fahrenheit';
      setTempUnit(preferredScale === 'celsius' ? 'C' : 'F');
      
      // ============================================
      // FIX: Set HOME COUNTRY flag, not current location
      // ============================================
      if (userData.show_home_country_info && userData.home_country) {
        loadHomeCountryData(userData.home_country);
        
        // Get HOME country code for flag
        const homeCode = COUNTRY_CODES[userData.home_country];
        if (homeCode) {
          setHomeCountryCode(homeCode);
          // Set flag URL for HOME country
          setHomeFlagUrl(`https://flagcdn.com/w640/${homeCode.toLowerCase()}.png`);
          setShowHomeFlag(true);
        }
      } else {
        setShowHomeFlag(false);
        setHomeFlagUrl(null);
      }
      
      const activeLocation = getActiveLocation();
      if (activeLocation?.coordinates) {
        await loadWeatherData(
          activeLocation.coordinates.latitude,
          activeLocation.coordinates.longitude,
          activeLocation.placeName || activeLocation.address?.city
        );
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading user or weather:", error);
      base44.auth.redirectToLogin();
    }
  };

  const loadHomeCountryData = async (countryName) => {
    const fallbackTimezones = {
      'United States': 'America/New_York',
      'Philippines': 'Asia/Manila',
      'Japan': 'Asia/Tokyo',
      'United Kingdom': 'Europe/London',
      'Australia': 'Australia/Sydney',
      'Canada': 'America/Toronto',
      'Germany': 'Europe/Berlin',
      'France': 'Europe/Paris',
      'Italy': 'Europe/Rome',
      'Spain': 'Europe/Madrid',
      'Brazil': 'America/Sao_Paulo',
      'Mexico': 'America/Mexico_City',
      'South Korea': 'Asia/Seoul',
      'Thailand': 'Asia/Bangkok',
      'Vietnam': 'Asia/Ho_Chi_Minh',
      'Singapore': 'Asia/Singapore',
      'Malaysia': 'Asia/Kuala_Lumpur',
      'Indonesia': 'Asia/Jakarta',
      'India': 'Asia/Kolkata',
      'China': 'Asia/Shanghai',
    };
    const fallbackTz = fallbackTimezones[countryName] || 'UTC';
    setHomeCountryInfo({ country: countryName, timezone: fallbackTz });
  };

  const loadWeatherData = async (latitude, longitude, locationName) => {
    try {
      const promptText = `Based on coordinates ${latitude}, ${longitude}, provide current weather. Return ONLY valid JSON: {"timezone": "IANA timezone", "temperature_celsius": number, "temperature_fahrenheit": number, "condition": "brief condition"}`;
      const locationData = await base44.integrations.Core.InvokeLLM({
        prompt: promptText,
        response_json_schema: {
          type: "object",
          properties: {
            timezone: { type: "string" },
            temperature_celsius: { type: "number" },
            temperature_fahrenheit: { type: "number" },
            condition: { type: "string" }
          }
        },
        add_context_from_internet: true
      });
      setTimezone(locationData.timezone);
      setWeatherInfo({
        celsius: Math.round(locationData.temperature_celsius),
        fahrenheit: Math.round(locationData.temperature_fahrenheit),
        condition: locationData.condition
      });
    } catch (error) {
      console.error("Error getting weather data:", error);
      setTimezone('UTC');
      setWeatherInfo(null);
    }
  };

  const getFirstName = () => {
    if (user?.first_name) return user.first_name;
    if (user?.full_name) return user.full_name.split(" ")[0];
    return "Traveler";
  };

  const formatLocalTime = (date, tz) => {
    if (!tz) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    try {
      return date.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  };

  const formatLocalDate = (date, tz) => {
    if (!tz) return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
    try {
      return date.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: '2-digit' });
    } catch (e) {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
    }
  };

  const handleQuickAction = (actionLabel) => {
    trackEvent('feature_used', { feature_name: actionLabel.toLowerCase().replace(/\s+/g, '_') });
    const routes = {
      "Smart Price Scanner": "SmartPriceScanner",
      "Money Exchange": "MoneyExchange",
      "Basic Phrases": "BasicPhrases",
      "Convenience Store": "ConvenienceStore",
      "ATM": "ATMFinder",
      "Weather": "Weather",
      "Things to Do": "ThingsToDo",
      "Culture Information": "CultureInformation",
      "Coffee": "CoffeeFinder",
      "Restroom": "RestroomFinder",
      "Places to Eat": "PlacesToEat",
      "Transportation": "Transportation",
      "Shopping": "Shopping",
      "Smart Text Scanner": "SmartTextScanner",
      "Dish Gallery": "DishSearchGallery"
    };
    if (routes[actionLabel]) navigate(createPageUrl(routes[actionLabel]));
  };

  const toggleTempUnit = () => setTempUnit(prev => prev === 'C' ? 'F' : 'C');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.colors.background }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 rounded-full" style={{ borderColor: theme.colors.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const activeLocation = getActiveLocation();

  // ── MODERN "BOLD BLOCKS" LAYOUT ─────────────────────────────────────────
  const MODERN_TILES = [
    { icon: Utensils,    label: 'Places to Eat',  action: 'Places to Eat',     bg: '#475569' },
    { icon: CoffeeIcon,  label: 'Coffee',         action: 'Coffee',            bg: '#78716C' },
    { icon: CreditCard,  label: 'ATM Finder',     action: 'ATM',               bg: '#0D9488' },
    { icon: Bath,        label: 'Restroom',        action: 'Restroom',          bg: '#6366F1' },
    { icon: Store,       label: 'Convenience',     action: 'Convenience Store', bg: '#EA580C' },
    { icon: CloudSun,    label: 'Weather',         action: 'Weather',           bg: '#0284C7' },
    { icon: MessageSquare, label: 'Phrases',       action: 'Basic Phrases',     bg: '#7C3AED' },
    { icon: ShoppingBag, label: 'Shopping',        action: 'Shopping',          bg: '#DB2777' },
    { icon: Compass,     label: 'Things to Do',    action: 'Things to Do',      bg: '#9333EA' },
    { icon: Landmark,    label: 'Culture Info',    action: 'Culture Information',bg: '#4F46E5' },
    { icon: Camera,      label: 'Text Scanner',   action: 'Smart Text Scanner', bg: '#059669' },
    { icon: Search,      label: 'Price Scanner',  action: 'Smart Price Scanner',bg: '#0F766E' },
  ];
  const QUICK_ACTIONS = [
    { icon: Navigation,  label: 'Directions', action: 'Transportation' },
    { icon: MessageSquare, label: 'Translate', action: 'Basic Phrases' },
    { icon: DollarSign,  label: 'Currency',   action: 'Money Exchange' },
    { icon: Car,         label: 'Transport',  action: 'Transportation' },
  ];

  const locationText = activeLocation?.address
    ? `${activeLocation.address.city || activeLocation.address.neighborhood || ''}, ${activeLocation.address.country || ''}`.replace(/^,\s*/, '')
    : 'Set location';

  const displayTemp = weatherInfo
    ? (tempUnit === 'C' ? `${weatherInfo.tempC}°C` : `${weatherInfo.tempF}°F`)
    : null;

  if (homeLayout === 'modern') {
    return (
      <div style={{ background: '#F1F5F9', minHeight: '100vh', fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
        {/* Dark header */}
        <div style={{ background: '#0F172A', padding: '20px 16px 24px', borderRadius: '0 0 24px 24px' }}>
          {/* Toggle + greeting row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                {localGreeting ? `${localGreeting} 👋` : 'Hello 👋'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff' }}>
                {getFirstName() || 'Traveler'}
              </div>
            </div>
            <button onClick={toggleHomeLayout} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', padding: '8px 12px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
              <LayoutGrid size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Classic
            </button>
          </div>
          {/* Location + weather */}
          <div onClick={() => setShowLocationPicker(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', marginBottom: '12px' }}>
            <MapPin size={14} color="#94A3B8" />
            <span style={{ fontSize: '13px', color: '#CBD5E1', fontWeight: '500', flex: 1 }}>{locationText}</span>
            {displayTemp && <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600' }}>☁️ {displayTemp}</span>}
          </div>
          {/* Time */}
          {timezone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              <span>{formatLocalDate(currentTime, timezone)}</span>
              <span style={{ fontWeight: '700', color: 'rgba(255,255,255,0.7)' }}>{formatLocalTime(currentTime, timezone)}</span>
              {displayTemp && <span onClick={toggleTempUnit} style={{ cursor: 'pointer' }}>{displayTemp}</span>}
            </div>
          )}
          {shouldShowHomeCountryTime && homeCountryInfo && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
              Home: {homeCountryInfo.country} · {formatLocalTime(homeCountryTime, homeCountryInfo.timezone)}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '8px', padding: '16px 16px 8px', overflowX: 'auto' }}>
          {QUICK_ACTIONS.map((qa, i) => {
            const Icon = qa.icon;
            return (
              <button key={i} onClick={() => handleQuickAction(qa.action)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <Icon size={16} color="#6366F1" />
                {qa.label}
              </button>
            );
          })}
        </div>

        {/* Money Exchange banner */}
        <div style={{ padding: '8px 16px' }}>
          <button onClick={() => handleQuickAction('Money Exchange')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, #059669 0%, #0D9488 100%)', borderRadius: '16px', padding: '16px 20px', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: '24px' }}>💱</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Money Exchange</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Compare rates near you</div>
            </div>
          </button>
        </div>

        {/* Main 4-column compact grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '8px 16px 120px' }}>
          {MODERN_TILES.map((tile, i) => {
            const Icon = tile.icon;
            return (
              <button key={i} onClick={() => handleQuickAction(tile.action)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                background: 'transparent', border: 'none', padding: '12px 4px',
                cursor: 'pointer',
              }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: `${tile.bg}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={tile.bg} strokeWidth={2.2} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', lineHeight: '1.2', textAlign: 'center' }}>{tile.label}</span>
              </button>
            );
          })}
        </div>

        <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
      </div>
    );
  }

  // ── CLASSIC LAYOUT (original) ───────────────────────────────────────────
  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: theme.colors.background }}>
      
      {/* Space background for space theme */}
      {theme.id === 'space' && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1f] via-[#0f0f23] to-[#050510]" />
          {[...Array(120)].map((_, i) => (
            <div key={i} className="absolute bg-white rounded-full"
              style={{ width: Math.random() > 0.85 ? '2px' : '1px', height: Math.random() > 0.85 ? '2px' : '1px',
                left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.7 + 0.3, animation: `twinkle ${Math.random() * 4 + 2}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s` }} />
          ))}
        </div>
      )}

      {/* Hero Header Card with HOME COUNTRY Flag */}
      <div className="px-4 pt-3 pb-4 relative z-10">
        <div className="max-w-md mx-auto rounded-[20px] shadow-lg relative overflow-hidden"
          style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.cardBorder}` }}>
          
          {/* ============================================ */}
          {/* FIX: Show HOME COUNTRY flag, bolder/brighter */}
          {/* ============================================ */}
          {showHomeFlag && homeFlagUrl && (
            <div className="absolute inset-0 z-0"
              style={{
                backgroundImage: `url(${homeFlagUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: theme.isDark ? 0.45 : 0.55,  // BOLDER - increased opacity
                filter: 'saturate(1.3) contrast(1.1)',  // BRIGHTER - more vivid colors
              }} />
          )}
          
          {/* Gradient overlay - lighter to show flag more */}
          <div className="absolute inset-0 z-1"
            style={{
              background: theme.isDark 
                ? 'linear-gradient(180deg, rgba(30,41,59,0.55) 0%, rgba(30,41,59,0.75) 100%)'  // Lighter overlay
                : 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.75) 100%)',
            }} />

          <div className="relative p-5 z-10">
            {/* Layout toggle */}
            <button onClick={toggleHomeLayout} style={{ position: 'absolute', top: '12px', right: '12px', background: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: theme.colors.textSecondary, fontSize: '11px', fontWeight: '600', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <LayoutGrid size={12} /> Modern
            </button>
            {/* Greeting */}
            <div className="mb-4">
              <p className="text-sm mb-1" style={{ color: theme.colors.textSecondary }}>
                Hello 👋 
                {localGreeting && (
                  <span className="italic font-serif ml-1">
                    {localGreeting.charAt(0).toUpperCase() + localGreeting.slice(1)}
                  </span>
                )}
              </p>
              <h1 className="text-3xl font-extrabold" style={{ color: theme.colors.textPrimary }}>
                {getFirstName()}
              </h1>
            </div>

            {/* Location */}
            <div className="mb-4 rounded-xl px-3 py-2.5 backdrop-blur-sm"
              style={{ background: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }}>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.primary }} />
                <p className="text-sm font-bold leading-tight truncate flex-1" style={{ color: theme.colors.textPrimary }}>
                  {activeLocation?.placeName || activeLocation?.address?.city || 'Loading...'}
                </p>
              </div>
              <button onClick={() => setShowLocationPicker(true)}
                className="text-xs font-semibold mt-1 underline underline-offset-2 pl-6"
                style={{ color: theme.colors.primary }}>
                Change Location
              </button>
            </div>

            {/* Date, Time, Weather Row */}
            <div className="flex items-center justify-between text-sm rounded-xl px-3 py-2"
              style={{ background: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }}>
              <span style={{ color: theme.colors.textPrimary }}>{formatLocalDate(currentTime, timezone)}</span>
              <span className="font-bold" style={{ color: theme.colors.textPrimary }}>{formatLocalTime(currentTime, timezone)}</span>
              {weatherInfo && (
                <button onClick={toggleTempUnit} className="flex items-center gap-1 font-bold" style={{ color: theme.colors.textPrimary }}>
                  <Cloud className="w-4 h-4" style={{ color: theme.colors.primary }} />
                  <span>{tempUnit === 'C' ? `${weatherInfo.celsius}°C` : `${weatherInfo.fahrenheit}°F`}</span>
                </button>
              )}
            </div>

            {/* Home Country Time */}
            {shouldShowHomeCountryTime && homeCountryInfo && (
              <div className="mt-3 rounded-lg px-3 py-2" style={{ background: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                <p className="text-xs mb-0.5" style={{ color: theme.colors.textMuted }}>Home: {homeCountryInfo.country}</p>
                <div className="flex items-center justify-between text-xs" style={{ color: theme.colors.textSecondary }}>
                  <span>{formatLocalDate(homeCountryTime, homeCountryInfo.timezone)}</span>
                  <span>{formatLocalTime(homeCountryTime, homeCountryInfo.timezone)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 💱 MONEY EXCHANGE */}
      <div className="px-4 pb-3 relative z-10">
        <div className="max-w-md mx-auto">
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleQuickAction("Money Exchange")}
            className="w-full rounded-2xl p-4 shadow-lg transition-all relative overflow-hidden"
            style={{ background: theme.colors.moneyExchangeBg, boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
            <div className="flex items-center justify-center gap-3 relative">
              <span className="text-2xl">💱</span>
              <div className="text-left">
                <span className="text-lg font-bold text-white block">Money Exchange</span>
                <span className="text-xs text-white/80">Compare rates near you</span>
              </div>
            </div>
          </motion.button>
        </div>
      </div>

      {/* 🥇 TIER 1 */}
      <div className="px-4 py-2 relative z-10">
        <div className="max-w-md mx-auto">
          <div className="grid grid-cols-3 gap-2">
            {TIER_1_BUTTONS.map((btn) => (
              <EmojiButton key={btn.id} emoji={btn.emoji} label={btn.label}
                gradient={btn.colors[theme.id] || btn.colors.light}
                onClick={() => handleQuickAction(btn.action)} theme={theme} />
            ))}
          </div>
        </div>
      </div>

      {/* 🥈 TIER 2 */}
      <div className="px-4 py-2 relative z-10">
        <div className="max-w-md mx-auto">
          <div className="grid grid-cols-4 gap-2">
            {TIER_2_BUTTONS.map((btn) => (
              <EmojiButton key={btn.id} emoji={btn.emoji} label={btn.label}
                gradient={btn.colors[theme.id] || btn.colors.light}
                onClick={() => handleQuickAction(btn.action)} theme={theme} compact />
            ))}
          </div>
        </div>
      </div>

      {/* 🥉 TIER 3 */}
      <div className="px-4 py-2 relative z-10">
        <div className="max-w-md mx-auto">
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: theme.colors.textMuted }}>More Tools</p>
          <div className="grid grid-cols-3 gap-2">
            {TIER_3_BUTTONS.map((btn) => (
              <EmojiButton key={btn.id} emoji={btn.emoji} label={btn.label}
                gradient={btn.colors[theme.id] || btn.colors.light}
                onClick={() => handleQuickAction(btn.action)} theme={theme} />
            ))}
          </div>
        </div>
      </div>

      {/* Explore More */}
      <div className="px-4 py-2 pb-28 relative z-10">
        <div className="max-w-md mx-auto">
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: theme.colors.textMuted }}>Explore</p>
          <div className="grid grid-cols-3 gap-2">
            {MORE_BUTTONS.map((btn) => (
              <EmojiButton key={btn.id} emoji={btn.emoji} label={btn.label}
                gradient={btn.colors[theme.id] || btn.colors.light}
                onClick={() => handleQuickAction(btn.action)} theme={theme} />
            ))}
          </div>
        </div>
      </div>

      <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
      
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer 2s infinite; }
        @keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

function EmojiButton({ emoji, label, gradient, onClick, theme, compact = false }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick}
      className={`rounded-xl flex flex-col items-center justify-center transition-all ${compact ? 'p-2.5' : 'p-3'}`}
      style={{ background: gradient, boxShadow: theme.isDark ? '0 4px 15px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.15)' }}>
      <span className={compact ? 'text-xl mb-0.5' : 'text-2xl mb-1'}>{emoji}</span>
      <span className={`font-semibold text-white text-center leading-tight ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
    </motion.button>
  );
}
