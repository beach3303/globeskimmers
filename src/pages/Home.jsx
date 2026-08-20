import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapPin, Cloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { trackEvent } from "../Layout";
import { useLocation, isLocationAskSnoozedToday, snoozeLocationAskToday, readOpenBehavior } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import HomeRows from "../components/home/HomeRows";
import StampsNearYou from "../components/home/StampsNearYou";
import StayAnchor from "../components/home/StayAnchor";
import EscapesRow from "../components/home/EscapesRow";
import RightNowStrip from "../components/home/RightNowStrip";
import { getTravelMode } from "@/lib/homeContext";
import HomeBanner from "../components/ads/HomeBanner";
import { CAT, TEAL_DEEP, IVORY } from "../components/redesign/constants";
import { useAuth } from "@/lib/AuthContext";
import { extractFirstName } from "@/lib/extractFirstName";
import { isLocationPermissionGranted } from "@/lib/geolocation";
import { callWorker } from "@/lib/callWorker";
import AirportArrivalPrompt from "@/components/AirportArrivalPrompt";
import BorderCrossingPrompt from "@/components/BorderCrossingPrompt";
import { ROUTE } from "@/lib/workerRoutes";
import FontScaleButton from "@/components/a11y/FontScaleButton";
import { useFontScale } from "@/components/a11y/FontScaleContext";
import { countryCode } from "@/lib/countries";
import { homeTimezoneForCountry } from "@/lib/homePlace";
import { useIsTablet } from "@/lib/useIsTablet";
import HomeTablet from "@/components/home/HomeTablet";
import WelcomeSplash from "@/components/onboarding/WelcomeSplash";

// Translation mapping for greetings — shown next to "Hello 👋"
// when the active location's country has a non-English primary language.
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

// Capital-city coords per home country — used to fetch the home-country
// temperature (free Open-Meteo via the Worker) for the subtle home-info row.
const HOME_CAPITAL_COORDS = {
  'United States': { lat: 38.90, lng: -77.04 }, 'Philippines': { lat: 14.60, lng: 120.98 },
  'Japan': { lat: 35.68, lng: 139.69 }, 'United Kingdom': { lat: 51.51, lng: -0.13 },
  'Australia': { lat: -35.28, lng: 149.13 }, 'Canada': { lat: 45.42, lng: -75.70 },
  'Germany': { lat: 52.52, lng: 13.40 }, 'France': { lat: 48.85, lng: 2.35 },
  'Italy': { lat: 41.90, lng: 12.50 }, 'Spain': { lat: 40.42, lng: -3.70 },
  'Brazil': { lat: -15.79, lng: -47.88 }, 'Mexico': { lat: 19.43, lng: -99.13 },
  'South Korea': { lat: 37.57, lng: 126.98 }, 'Thailand': { lat: 13.75, lng: 100.50 },
  'Vietnam': { lat: 21.03, lng: 105.85 }, 'Singapore': { lat: 1.35, lng: 103.82 },
  'Malaysia': { lat: 3.14, lng: 101.69 }, 'Indonesia': { lat: -6.21, lng: 106.85 },
  'India': { lat: 28.61, lng: 77.21 }, 'China': { lat: 39.90, lng: 116.40 },
};

// Country name → ISO-2 code (flagcdn URLs) comes from the shared countries module
// (countryCode), so EVERY country a user picks in Settings resolves to a flag —
// not just the ~20 that used to be hardcoded here.

// Phone finder tiles — the six core finders (mirrors HomeTablet's FEATURES list).
// `action` is the label fed to handleQuickAction, which owns ALL navigation; no
// routes are invented here.
const PHONE_FEATURES = [
  { cat: CAT.transit,     emoji: '🚌', title: 'Transit Info',       sub: 'Routes & times',   action: 'Transportation' },
  { cat: CAT.food,        emoji: '🍽️', title: 'Nearby Restaurants', sub: 'Where locals eat', action: 'Places to Eat' },
  { cat: CAT.coffee,      emoji: '☕', title: 'Coffee Finder',      sub: 'Cafés near you',   action: 'Coffee' },
  { cat: CAT.atm,         emoji: '🏧', title: 'ATM Finder',         sub: 'Skip the fees',    action: 'ATM' },
  { cat: CAT.restroom,    emoji: '🚻', title: 'Restroom Finder',    sub: 'Clean & rated',    action: 'Restroom' },
  { cat: CAT.convenience, emoji: '🏪', title: 'Convenience',        sub: '24/7 essentials',  action: 'Convenience Store' },
];

// Phone Explore-more cards — smaller gradient tiles (same gradients/glyphs as
// the tablet GradCards). Weather lives here on phone (it is a finder tile on
// tablet); Price + Text scanners are separate cards so BOTH stay reachable.
const PHONE_EXPLORE = [
  { grad: `linear-gradient(135deg, ${CAT.todo.ink} 0%, #E84393 100%)`,     emoji: '🎟️', title: 'Things to do',  action: 'Things to Do' },
  { grad: 'linear-gradient(135deg, #8B3A1E 0%, #B0472F 100%)',             emoji: '🛂', title: 'Virtual Passport', action: 'Passport' },
  { grad: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)',             emoji: '💡', title: 'Insight',       action: 'Insight' },
  { grad: 'linear-gradient(135deg, #0E7C66 0%, #14B8A6 100%)',             emoji: '🧳', title: 'Essentials',    action: 'Travel Essentials' },
  { grad: `linear-gradient(135deg, ${CAT.shopping.ink} 0%, #A855F7 100%)`, emoji: '🛍️', title: 'Shopping',      action: 'Shopping' },
  { grad: `linear-gradient(135deg, ${CAT.culture.ink} 0%, #D97706 100%)`,  emoji: '🏛️', title: 'Cultural Info', action: 'Culture Information' },
  { grad: `linear-gradient(135deg, ${CAT.weather.ink} 0%, #F4B740 100%)`,  emoji: '☀️', title: 'Weather',       action: 'Weather' },
  { grad: `linear-gradient(135deg, ${CAT.phrases.ink} 0%, #EAB308 100%)`,  emoji: '💬', title: 'Phrases',       action: 'Basic Phrases' },
  { grad: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',             emoji: '💲', title: 'Price scanner', action: 'Smart Price Scanner' },
  { grad: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',             emoji: '🔤', title: 'Text scanner',  action: 'Smart Text Scanner' },
];

// Module-scoped so it survives Home re-mounts within one app session: the
// signInTick of the last sign-in we already showed the welcome splash for. Keeps
// the splash to ONCE per sign-in (not on every Home re-mount/navigation).
let lastWelcomeHandledTick = 0;
// Module-scoped so the cold-open "Where to?" chooser fires at most ONCE per app
// launch (a true cold open), not on every Home re-mount/tab navigation.
let coldOpenAsked = false;
// Per-account cap: the welcome splash shows on at most this many sign-ins, then
// it's gone for good. The counter lives on the Supabase profile
// (profile.welcome_splash_count) — see AuthContext.bumpWelcomeSplashCount.
const WELCOME_MAX = 10;

export default function HomePage() {
  const navigate = useNavigate();
  const { locationMode, selectedLocation, currentGpsLocation, getActiveLocation, getCurrentLocation, switchToCurrentLocation, loading: locationLoading } = useLocation();
  const { profile, user: authUser, signInTick, bumpWelcomeSplashCount } = useAuth();
  // iPad gets a dedicated tablet layout (HomeTablet); phone gets the fuller
  // editorial layout below.
  const isTablet = useIsTablet();
  // Text-size step (0-3) from the glasses control. Phone Explore tiles grow with
  // it and the Explore grid drops to 2-col at the larger steps so the enlarged
  // tiles + titles fit (presentation only — see PHONE_EXPLORE render below).
  const { step: fontStep } = useFontScale();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localGreeting, setLocalGreeting] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezone, setTimezone] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [coldOpenChooser, setColdOpenChooser] = useState(false); // picker opened as the cold-open "Where to?" chooser
  const [showWelcome, setShowWelcome] = useState(false); // welcome splash (first launches, before the location selector)
  const [tempUnit, setTempUnit] = useState('F');
  const [homeCountryInfo, setHomeCountryInfo] = useState(null);
  const [homeCountryWeather, setHomeCountryWeather] = useState(null);
  const [shouldShowHomeCountryTime, setShouldShowHomeCountryTime] = useState(false);
  // Physical-location clock (the "You're here" row) — only needed when you've
  // navigated to a place you're not actually at.
  const [physicalTz, setPhysicalTz] = useState(null);
  const [physicalLabel, setPhysicalLabel] = useState('');
  const [showHomeFlag, setShowHomeFlag] = useState(false);
  const [homeFlagUrl, setHomeFlagUrl] = useState(null);
  const pickerPrompted = useRef(false); // gate the one-time location-picker auto-open (per mount)

  useEffect(() => {
    if (!locationLoading) loadUserAndWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationLoading, locationMode, selectedLocation, currentGpsLocation, profile]);

  // ENTRY FLOW — one ATOMIC decision (so the splash and the location picker can
  // never both open at once):
  //   • A FRESH sign-in/sign-up (signInTick bumped in AuthContext — never on a
  //     plain app-launch session restore) shows the Welcome splash, capped at
  //     WELCOME_MAX per account via profile.welcome_splash_count. When shown we
  //     RETURN, so the picker is not opened underneath it (the splash leads; its
  //     Start exploring / Skip / ✕ opens the picker next).
  //   • Otherwise (no fresh sign-in, or cap reached) open the location picker
  //     once if no location is set yet. Keyed to lastWelcomeHandledTick so the
  //     splash shows once per sign-in, not on every Home re-mount in a session.
  useEffect(() => {
    if (locationLoading) return;
    if (signInTick && signInTick !== lastWelcomeHandledTick) {
      if (!profile) return; // wait for the account's count before deciding
      lastWelcomeHandledTick = signInTick;
      if ((profile.welcome_splash_count ?? 0) < WELCOME_MAX) {
        setShowWelcome(true);
        bumpWelcomeSplashCount(); // persist +1 to the per-account counter
        return; // splash leads — do NOT also open the picker underneath
      }
      // cap reached → fall through to the picker
    }
    if (!pickerPrompted.current && !showWelcome) {
      const hasLoc = !!getActiveLocation()?.coordinates;
      if (!hasLoc) {
        // First run / no location yet — open the chooser (📍 current vs 🗺️ pick).
        pickerPrompted.current = true;
        setColdOpenChooser(true);
        setShowLocationPicker(true);
      } else if (!coldOpenAsked) {
        // Returning + genuine cold open → honor the user's Settings default.
        coldOpenAsked = true;
        pickerPrompted.current = true;
        const behavior = readOpenBehavior();
        if (behavior === 'current') {
          switchToCurrentLocation().catch(() => {}); // jump straight to live GPS
        } else if (behavior === 'continue') {
          /* keep the last place — do nothing */
        } else if (!isLocationAskSnoozedToday()) {
          setColdOpenChooser(true); // 'ask' (default), unless snoozed for today
          setShowLocationPicker(true);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationLoading, signInTick, profile, showWelcome, locationMode, selectedLocation, currentGpsLocation]);

  // Tell LocationContext's mismatch detector to defer while the chooser / welcome
  // splash is open, so the two location prompts never stack on top of each other.
  useEffect(() => {
    try { window.__gsChooserOpen = showLocationPicker || showWelcome; } catch { /* ignore */ }
  }, [showLocationPicker, showWelcome]);

  // Drive the local greeting word (e.g. "Hola", "Bonjour") from the active
  // location's country. Theme-system country-code sync was removed when the
  // theme picker was dropped -- this effect now only feeds setLocalGreeting.
  useEffect(() => {
    const currentLocation = getActiveLocation();
    if (currentLocation?.address?.country) {
      const country = currentLocation.address.country;
      const translation = HELLO_TRANSLATIONS[country];
      const englishPrimaryCountries = ['United States', 'United Kingdom', 'Australia', 'New Zealand', 'Ireland'];
      if (!englishPrimaryCountries.includes(country) && translation) {
        setLocalGreeting(translation.greeting);
      } else {
        setLocalGreeting(null);
      }
    }
  }, [locationMode, selectedLocation, currentGpsLocation, getActiveLocation]);

  // Show the home clock when the user toggled "Show Home Country Time" ON and we
  // know their home. Whether it's actually redundant (you're already in the home
  // timezone) is decided later by comparing timezones — that also correctly shows
  // home time when you're in the SAME country but a different zone (e.g. LA home,
  // currently in New York), which the old country-name check missed.
  useEffect(() => {
    setShouldShowHomeCountryTime(!!(user?.show_home_country_info && homeCountryInfo));
  }, [user, homeCountryInfo]);

  // Silent background GPS fetch: while navigating to a place you're NOT at, we
  // still want to know your physical city (for the "You're here" clock row). Only
  // runs when location permission is ALREADY granted — never prompts. Populates
  // currentGpsLocation, which the timezone effect below then reads.
  useEffect(() => {
    if (locationMode !== 'navigate' || currentGpsLocation?.coordinates) return;
    let cancelled = false;
    (async () => {
      const granted = await isLocationPermissionGranted();
      if (cancelled || !granted) return;
      try { await getCurrentLocation(); } catch { /* silent — no prompt, no error UI */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationMode, currentGpsLocation]);

  // Resolve the physical GPS location's timezone for the "You're here" row. Only
  // when navigating to a place you're not at, using the KNOWN GPS fix (no new
  // permission prompt). Clears otherwise (in "current" mode the hero already IS
  // your physical location).
  useEffect(() => {
    const coords = currentGpsLocation?.coordinates;
    if (locationMode !== 'navigate' || !coords) { setPhysicalTz(null); setPhysicalLabel(''); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await callWorker(ROUTE.getWeatherForecast, { latitude: coords.latitude, longitude: coords.longitude });
        if (!cancelled) {
          setPhysicalTz(data?.timezone || null);
          setPhysicalLabel(currentGpsLocation.placeName || currentGpsLocation.address?.city || 'Your location');
        }
      } catch { if (!cancelled) setPhysicalTz(null); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationMode, currentGpsLocation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadUserAndWeather = async () => {
    try {
      // User data comes from the Supabase profile — the app-wide AuthGate
      // already guarantees a signed-in user, so there is NO Base44 auth check
      // here (and no redirect to Base44 login). We shape the profile into the
      // fields the rest of Home reads. The greeting itself reads
      // profile.first_name directly via getFirstName(). show_home_flag /
      // show_home_country_info live in the Supabase profiles table (added via
      // ALTER; Settings toggles persist them) — default off when the column is null.
      const userData = {
        first_name: profile?.first_name || extractFirstName(authUser) || '',
        home_country: profile?.home_country || null,
        home_city: profile?.home_city || null,
        home_lat: profile?.home_lat ?? null,
        home_lng: profile?.home_lng ?? null,
        home_timezone: profile?.home_timezone || null,
        preferred_temperature_scale: profile?.temp_unit === 'C' ? 'celsius' : 'fahrenheit',
        show_home_flag: !!profile?.show_home_flag,
        show_home_country_info: !!profile?.show_home_country_info,
      };

      setUser(userData);
      const preferredScale = userData.preferred_temperature_scale || 'fahrenheit';
      setTempUnit(preferredScale === 'celsius' ? 'C' : 'F');

      // Always load home-country timezone data when home_country is set --
      // the time chip's own visibility logic (the useEffect above) gates
      // whether to actually render the chip. Loading the data eagerly means
      // there's no flicker the moment the user toggles the chip on.
      if (userData.home_country || userData.home_city) {
        loadHomeCountryData(userData);
      }

      // Home-country FLAG overlay — gated by show_home_flag toggle in Settings.
      // Independent of show_home_country_info (which only controls the time
      // chip). User can show the flag whether they're at home or abroad.
      // Show the home-country flag as the greeting-card background when the user
      // turned the "Show Home Country Flag" toggle ON (Settings) AND has a home
      // country whose flag we can resolve. Both come from the Supabase profile, so
      // it works on native. The flag updates immediately after a Settings save
      // (refreshProfile → new profile → this effect re-runs).
      if (userData.show_home_flag && userData.home_country) {
        const homeCode = countryCode(userData.home_country);
        if (homeCode) {
          setHomeFlagUrl(`https://flagcdn.com/w640/${homeCode.toLowerCase()}.png`);
          setShowHomeFlag(true);
        } else {
          setShowHomeFlag(false);
          setHomeFlagUrl(null);
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
      setLoading(false); // AuthGate handles auth — never bounce to Base44 login
    }
  };

  // home = { home_country, home_city, home_lat, home_lng, home_timezone }.
  // Timezone comes from the stored home_timezone (derived from the home city's
  // coordinates → EXACT worldwide). Legacy users with only a country fall back to
  // the per-country default. Label prefers the city so the row reads "🏠 Los
  // Angeles" rather than just the country.
  const loadHomeCountryData = async (home) => {
    const country = home.home_country || '';
    const tz = home.home_timezone || homeTimezoneForCountry(country);
    setHomeCountryInfo({
      country,
      city: home.home_city || country,
      timezone: tz,
      label: home.home_city || country,
    });
    // Home temperature for the subtle row — from the stored home coordinates when
    // we have them (accurate to the city), else the country's capital fallback.
    const coords = (home.home_lat != null && home.home_lng != null)
      ? { lat: home.home_lat, lng: home.home_lng }
      : HOME_CAPITAL_COORDS[country];
    if (!coords) { setHomeCountryWeather(null); return; }
    try {
      const { data, error } = await callWorker(ROUTE.getWeatherForecast, { latitude: coords.lat, longitude: coords.lng });
      const c = Number(data?.current?.temperature_celsius);
      const f = Number(data?.current?.temperature_fahrenheit);
      setHomeCountryWeather(!error && Number.isFinite(c) && Number.isFinite(f) ? { celsius: Math.round(c), fahrenheit: Math.round(f) } : null);
    } catch {
      setHomeCountryWeather(null);
    }
  };

  const loadWeatherData = async (latitude, longitude) => {
    try {
      // Weather now comes from the Worker's Open-Meteo route (free, no key).
      // The old Base44 InvokeLLM call 403s on the native app (no Base44
      // session), which is why this showed "—°" on device.
      const { data, error } = await callWorker(ROUTE.getWeatherForecast, { latitude, longitude });
      if (error || !data?.current) {
        setTimezone('UTC');
        setWeatherInfo(null);
        return;
      }
      setTimezone(data.timezone || 'UTC');
      const c = Number(data.current.temperature_celsius);
      const f = Number(data.current.temperature_fahrenheit);
      if (Number.isFinite(c) && Number.isFinite(f)) {
        setWeatherInfo({
          celsius: Math.round(c),
          fahrenheit: Math.round(f),
          condition: data.current.condition,
        });
      } else {
        setWeatherInfo(null);
      }
    } catch (error) {
      console.error("Error getting weather data:", error);
      setTimezone('UTC');
      setWeatherInfo(null);
    }
  };

  const getFirstName = () => {
    // Supabase profile (captured during onboarding) is the source of truth now.
    if (profile?.first_name) return profile.first_name;
    // Then the signed-in identity's provider metadata (Google given_name, etc.).
    const fromIdentity = extractFirstName(authUser);
    if (fromIdentity) return fromIdentity;
    // Legacy Base44 user fallbacks (web only; null on native).
    if (user?.first_name) return user.first_name;
    if (user?.full_name) {
      const first = user.full_name.trim().split(/\s+/)[0];
      if (first) return first;
    }
    // Email-prefix fallback (Title-Cased) before the generic last resort, e.g.
    // 'maizasimeon@gmail.com' → 'Maizasimeon'. "Traveler" is the final fallback.
    const email = authUser?.email || user?.email;
    if (email) {
      const local = email.split('@')[0];
      if (local) return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
    }
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
      "Insight": "Insight",
      "Passport": "Passport",
      "Coffee": "CoffeeFinder",
      "Restroom": "RestroomFinder",
      "Places to Eat": "PlacesToEat",
      "Transportation": "Transportation",
      "Get A Ride": "GetARide",
      "Find a Hotel": "FindAHotel",
      "Travel Essentials": "TravelEssentials",
      "Shopping": "Shopping",
      "Smart Text Scanner": "SmartTextScanner",
    };
    if (routes[actionLabel]) navigate(createPageUrl(routes[actionLabel]));
  };

  // ── Journey-state: adapt which Discover sections LEAD, by context ──────────
  // home/discovery (you're based here) → escapes/plan first; on a trip
  // (domestic/international) → stamps + what's-nearby first; planning (browsing a
  // place you're not at) → where-people-go first. Reuses the dormant travel-mode
  // brain; data we already have (active location + profile home city).
  const journeyMode = useMemo(() => {
    const active = getActiveLocation();
    const present = locationMode === "current" || active?.placeType === "current_location";
    return getTravelMode({
      present,
      activeCountry: active?.address?.country,
      activeCity: active?.address?.city || active?.placeName,
      activeLat: active?.coordinates?.latitude,
      activeLng: active?.coordinates?.longitude,
      homeCountry: profile?.home_country,
      homeCity: profile?.home_city,
      homeLat: profile?.home_lat,
      homeLng: profile?.home_lng,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationMode, selectedLocation, currentGpsLocation, profile]);

  // Welcome-splash actions:
  //   • Proceed (Start exploring / Skip / ✕) → open the location selector.
  //   • Timeout (30s with no interaction)    → go straight to the home screen.
  // The starter rows are display-only. Both stable (useCallback) so the splash's
  // 30s auto-dismiss timer isn't reset on re-render.
  const welcomeExplore = useCallback(() => {
    setShowWelcome(false);
    pickerPrompted.current = true; // we're opening it; don't let the effect re-open on close
    setShowLocationPicker(true);
  }, []);
  const welcomeClose = useCallback(() => {
    setShowWelcome(false);
  }, []);

  const toggleTempUnit = () => setTempUnit((prev) => (prev === 'C' ? 'F' : 'C'));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 rounded-full"
          style={{ borderColor: TEAL_DEEP, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const activeLocation = getActiveLocation();
  // Greeting headline uses the CITY of the selected location, not its full
  // place name. For an airport like "Mactan-Cebu International Airport
  // Authority (MCIAA)", we want "Hello Maiza, in Cebu" — not the full
  // 8-word venue name. Priority:
  //   1. address.city  (locality / sublocality / postal_town from Google)
  //   2. address.region (administrative_area_level_2 — e.g. "Cebu" when
  //      the airport's locality is the smaller "Lapu-Lapu")
  //   3. placeName    (fallback for legacy saved locations missing both)
  //
  // Filter out leftover placeholder strings ("Current Location",
  // "Selected Location") that older saved-location records might still
  // carry in placeName — these used to leak into the greeting as
  // "Hello Traveler, in Current Location", which read like a real
  // city. The new LocationContext doesn't write those strings anymore,
  // but this filter makes existing users self-heal on next render.
  const PLACEHOLDER_NAMES = new Set(["Current Location", "Selected Location"]);
  const cleanPlaceName = (n) => (n && !PLACEHOLDER_NAMES.has(n)) ? n : '';
  const cityName = activeLocation?.address?.city
    || activeLocation?.address?.region
    || cleanPlaceName(activeLocation?.placeName)
    || '';
  // Location chip below the greeting keeps the full place name so the user
  // can confirm exactly which location they're on. When the GPS pin has
  // no real label (offshore, mid-ocean, brand-new GPS lock before
  // geocode completes), show "Detecting your location…" instead of
  // "Set location" — the user IS at a location, we just don't have a
  // name yet, and the prior "Set location" copy implied the user had to
  // do something.
  const placeText = cleanPlaceName(activeLocation?.placeName)
    || activeLocation?.address?.city
    || (activeLocation?.coordinates ? 'Detecting your location…' : 'Set location');

  // Flag-background greeting card: active when the Show Home Country Flag toggle
  // is on and we can resolve the home country's flag. The flag fills the whole
  // card; chips are kept compact and right-aligned so the flag stays visible.
  const flagActive = !!(showHomeFlag && homeFlagUrl);

  // Clock stack under the hero. The hero shows the SELECTED/active place; these
  // subtle labeled rows add: 📍 where you physically are (only when you've
  // navigated away) and 🏠 your home (when toggled). Only rows whose timezone
  // differs from the hero — and from each other — are kept, so nothing repeats.
  const activeTz = timezone;
  const rawClockRows = [];
  if (physicalTz && physicalTz !== activeTz) {
    rawClockRows.push({ key: 'here', icon: '📍', label: physicalLabel || 'Your location', tz: physicalTz, temp: null });
  }
  if (shouldShowHomeCountryTime && homeCountryInfo?.timezone && homeCountryInfo.timezone !== activeTz) {
    rawClockRows.push({ key: 'home', icon: '🏠', label: homeCountryInfo.label || homeCountryInfo.country, tz: homeCountryInfo.timezone, temp: homeCountryWeather });
  }
  const _seenTz = new Set();
  const clockRows = rawClockRows
    .filter((r) => (_seenTz.has(r.tz) ? false : (_seenTz.add(r.tz), true)))
    .map((r) => ({
      key: r.key,
      icon: r.icon,
      label: r.label,
      dateText: formatLocalDate(currentTime, r.tz),
      timeText: formatLocalTime(currentTime, r.tz),
      tempText: r.temp ? (tempUnit === 'C' ? `${r.temp.celsius}°C` : `${r.temp.fahrenheit}°F`) : null,
    }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans" style={{ background: IVORY }}>
      {/* First-launches Welcome splash — overlays Home (phone + tablet) BEFORE
          the location selector; any dismissal opens the selector → home. */}
      <AnimatePresence>
        {showWelcome && <WelcomeSplash onProceed={welcomeExplore} onTimeout={welcomeClose} />}
      </AnimatePresence>
      {isTablet ? (
        <HomeTablet
          firstName={getFirstName()}
          cityName={cityName}
          placeText={placeText}
          localGreeting={localGreeting}
          weatherInfo={weatherInfo}
          tempUnit={tempUnit}
          toggleTempUnit={toggleTempUnit}
          dateText={formatLocalDate(currentTime, timezone)}
          timeText={formatLocalTime(currentTime, timezone)}
          flagActive={flagActive}
          homeFlagUrl={homeFlagUrl}
          onLocation={() => setShowLocationPicker(true)}
          onAction={handleQuickAction}
          clockRows={clockRows}
          journeyMode={journeyMode}
        />
      ) : (
      <>
      {/* PHONE — fuller editorial Home. Mirrors HomeTablet's structure at phone
          scale (greeting card → Money Exchange hero → 2-col finder tiles →
          Explore-more gradient row) and matches the approved phone preview.
          Single max-w-md column. Presentation only — every handler / data field
          below is reused exactly as the tablet layout consumes it. */}
      {/* HERO GREETING CARD ----------------------------------------------- */}
      <div className="px-4 pt-2 pb-3">
        <div
          className="max-w-md mx-auto rounded-[20px] relative overflow-hidden flex flex-col justify-end"
          style={{
            background: '#FFFFFF',
            border: '1px solid #F0E9DC',
            boxShadow: '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)',
            // CONSTANT fixed height — the box stays exactly this size and never
            // grows/shrinks with the glasses text-size control; only the text
            // inside scales (per user request). A definite height also lets the
            // inner `min-h-full` distribute content top→base and the flag fill
            // the whole card. Mirrors how HomeTablet pins its flag card.
            height: 330,
          }}
        >
          {/* Home-country flag as the greeting-card background. The ENTIRE flag
              is shown undistorted — `contain` = no crop, no stretch — centered
              over a blurred copy of itself so the card is fully filled (no empty
              bars) without cutting off any part of the flag. A scrim keeps text
              legible. Active when the Show Home Country Flag toggle is on. */}
          {flagActive && (
            <>
              {/* Blurred fill: covers the card so there are no empty bars behind
                  the contained flag. A slightly oversized backgroundSize hides any
                  blur edge-seam — WITHOUT a transform (a scaled child escapes the
                  page's overflow clip on iOS WKWebView and makes the whole app
                  pannable sideways). */}
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${homeFlagUrl})`,
                  backgroundSize: '170%',
                  backgroundPosition: 'center',
                  filter: 'blur(22px) saturate(1.2)',
                }}
              />
              {/* The whole flag — uncropped and undistorted. */}
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${homeFlagUrl})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  filter: 'saturate(1.05)',
                }}
              />
              <div
                className="absolute inset-0 z-[1]"
                // Scrim shaped so the flag stays vibrant/filled through the
                // middle: light wash at top (behind the Hello kicker), nearly
                // clear in the center (the flag shows; the serif headline keeps
                // its own text-shadow), darkening only toward the base where the
                // white date·weather·location row needs contrast.
                style={{ background: 'linear-gradient(180deg, rgba(8,10,14,0.42) 0%, rgba(8,10,14,0.12) 28%, rgba(8,10,14,0.08) 52%, rgba(8,10,14,0.55) 82%, rgba(8,10,14,0.82) 100%)' }}
              />
            </>
          )}

          {/* FIXED-big card: content laid out top→base (flex column +
              justify-between) so the greeting/name pin to the top and the
              date·weather·location row sits at the base, letting the flag fill
              the whole card at every font size (mirrors HomeTablet). */}
          <div className="relative z-10 p-4 flex flex-col justify-between h-full">
          {/* TOP LINE — "Hello 👋" (left) · first name (right, just before the
              glasses) · glasses (far right). The city headline sits below,
              right-aligned over the plain fly side of the flag. */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] flex items-center gap-1.5 leading-none flex-shrink-0" style={{ color: flagActive ? 'rgba(255,255,255,.92)' : '#736657' }}>
                <span>Hello 👋</span>
                {localGreeting && (
                  <span className="font-serif italic normal-case tracking-normal" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP }}>
                    {localGreeting.charAt(0).toUpperCase() + localGreeting.slice(1)}
                  </span>
                )}
              </p>
              {/* First name CENTERED in the gap between "Hello 👋" and the glasses
                  (flex-1 + text-center); whitespace-nowrap so it never splits its
                  letters. */}
              {getFirstName() && (
                <span className="flex-1 min-w-0 text-center font-serif italic text-[calc(22px*var(--fs))] whitespace-nowrap" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP, textShadow: flagActive ? '0 1px 10px rgba(0,0,0,0.55)' : 'none', overflowWrap: 'normal', wordBreak: 'keep-all' }}>
                  {getFirstName()}
                </span>
              )}
              <div className="flex-none"><FontScaleButton /></div>
            </div>

            {/* City headline — right-aligned, 2-line clamp. */}
            {cityName && (
              <h1 className="text-right mt-2 font-serif leading-[1.06] text-[calc(28px*var(--fs))]" style={{ color: flagActive ? '#fff' : '#16110D', textShadow: flagActive ? '0 2px 18px rgba(0,0,0,0.55)' : 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                <span style={{ color: flagActive ? 'rgba(255,255,255,.85)' : '#3A3128' }}>in </span>
                <span className="italic" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP }}>{cityName}</span>
              </h1>
            )}
          </div>

          {/* BOTTOM — normally "date · temp" (left) with the location pill
              bottom-right. At the larger text sizes (step ≥ 2) it reflows: the
              temperature + pill move to an upper row and the day·date drops to its
              OWN last line at the bottom-left, so nothing crowds. */}
          {fontStep >= 2 ? (
            <div className="pt-2.5 flex flex-col gap-2" style={{ borderTop: `1px solid ${flagActive ? 'rgba(255,255,255,.25)' : '#F0E9DC'}` }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {weatherInfo && Number.isFinite(weatherInfo.celsius) && Number.isFinite(weatherInfo.fahrenheit) ? (
                  <button onClick={toggleTempUnit} className="inline-flex items-center gap-1 whitespace-nowrap text-[calc(12px*var(--fs))] font-medium" style={{ color: flagActive ? '#fff' : '#3A3128', textShadow: flagActive ? '0 1px 8px rgba(0,0,0,0.5)' : 'none' }}>
                    <Cloud size={13} color={flagActive ? '#FFD9A0' : TEAL_DEEP} strokeWidth={2} />
                    {tempUnit === 'C' ? `${weatherInfo.celsius}°C` : `${weatherInfo.fahrenheit}°F`}
                  </button>
                ) : <span />}
                <button
                  onClick={() => setShowLocationPicker(true)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-w-full min-w-0"
                  style={{ background: flagActive ? 'rgba(0,0,0,0.4)' : '#F7F4EC', backdropFilter: flagActive ? 'blur(10px)' : 'none', WebkitBackdropFilter: flagActive ? 'blur(10px)' : 'none' }}
                >
                  <MapPin size={14} color={flagActive ? '#FFD9A0' : TEAL_DEEP} strokeWidth={2} className="flex-none" />
                  <span className="text-[calc(11.5px*var(--fs))] font-semibold truncate" style={{ color: flagActive ? '#fff' : '#16110D' }}>{placeText}</span>
                  <span className="text-[calc(10.5px*var(--fs))] underline underline-offset-2 flex-none" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP }}>Change</span>
                </button>
              </div>
              {/* day · date — its own last line, bottom-left */}
              <span className="text-[calc(12px*var(--fs))] font-medium" style={{ color: flagActive ? '#fff' : '#3A3128', textShadow: flagActive ? '0 1px 8px rgba(0,0,0,0.5)' : 'none' }}>{formatLocalDate(currentTime, timezone)}</span>
            </div>
          ) : (
            <div
              className="flex items-end justify-between gap-x-2 gap-y-2 flex-wrap pt-2.5"
              style={{ borderTop: `1px solid ${flagActive ? 'rgba(255,255,255,.25)' : '#F0E9DC'}` }}
            >
              <div className="flex items-center gap-1.5 text-[calc(12px*var(--fs))] font-medium" style={{ color: flagActive ? '#fff' : '#3A3128', textShadow: flagActive ? '0 1px 8px rgba(0,0,0,0.5)' : 'none' }}>
                <span className="whitespace-nowrap">{formatLocalDate(currentTime, timezone)}</span>
                {weatherInfo && Number.isFinite(weatherInfo.celsius) && Number.isFinite(weatherInfo.fahrenheit) && (
                  <>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <button onClick={toggleTempUnit} className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Cloud size={13} color={flagActive ? '#FFD9A0' : TEAL_DEEP} strokeWidth={2} />
                      {tempUnit === 'C' ? `${weatherInfo.celsius}°C` : `${weatherInfo.fahrenheit}°F`}
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowLocationPicker(true)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-w-full min-w-0"
                style={{ background: flagActive ? 'rgba(0,0,0,0.4)' : '#F7F4EC', backdropFilter: flagActive ? 'blur(10px)' : 'none', WebkitBackdropFilter: flagActive ? 'blur(10px)' : 'none' }}
              >
                <MapPin size={14} color={flagActive ? '#FFD9A0' : TEAL_DEEP} strokeWidth={2} className="flex-none" />
                <span className="text-[calc(11.5px*var(--fs))] font-semibold truncate" style={{ color: flagActive ? '#fff' : '#16110D' }}>{placeText}</span>
                <span className="text-[calc(10.5px*var(--fs))] underline underline-offset-2 flex-none" style={{ color: flagActive ? '#FFD9A0' : TEAL_DEEP }}>Change</span>
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Clock stack — subtle labeled rows under the hero. 📍 your physical
          location (when you've navigated elsewhere) and 🏠 home (when toggled),
          each: place · day,date · time · temp. Only timezones that differ from
          the hero (and each other) appear. Sits between the greeting card and
          Money Exchange. */}
      {clockRows.length > 0 && (
        <div className="px-5 pb-3 -mt-1">
          {/* Fixed 11.5px — intentionally NOT scaled by --fs, so the text-size
              eyeglass does not enlarge these subtle rows. */}
          <div className="max-w-md mx-auto flex flex-col gap-1">
            {clockRows.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-2 text-[11.5px] font-medium" style={{ color: '#8A93A6' }}>
                <span className="flex items-center gap-1 whitespace-nowrap min-w-0"><span>{r.icon}</span><span className="uppercase tracking-wide truncate">{r.label}</span></span>
                <span className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                  <span>{r.dateText}</span>
                  <span>{r.timeText}</span>
                  {r.tempText && <span>{r.tempText}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FEATURE TILES — 2-col grid of all six finders. Editorial: emoji chip,
          serif title (2-line clamp), tiny subtitle; min-height so enlarging text
          grows the tile instead of clipping. */}
      <div className="px-4 pb-3">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-2.5">
          {/* Row 1: Book a Ride + Find a Hotel (both travel-booking) */}
          <PhoneTile cat={{ ink: '#2563EB' }} emoji="🚗" title="Book a Ride" sub="Cars · transfers · rides" onClick={() => handleQuickAction('Get A Ride')} />
          <PhoneTile cat={{ ink: '#2563EB' }} emoji="🏨" title="Find a Hotel" sub="Best price · all sites" onClick={() => handleQuickAction('Find a Hotel')} />
          <PhoneTile cat={CAT.money} emoji="💱" title="Money Exchange" sub="Compare rates near you" onClick={() => handleQuickAction('Money Exchange')} />
          {PHONE_FEATURES.map((f) => (
            <PhoneTile key={f.title} cat={f.cat} emoji={f.emoji} title={f.title} sub={f.sub} onClick={() => handleQuickAction(f.action)} />
          ))}
        </div>
      </div>

      {/* DISCOVER — living sections below the tiles (tiles stay the lead). Each
          renders NOTHING when there's no owned coverage, so the tiles stand
          alone; all re-center as the user moves (auto-follow / active location). */}
      {journeyMode !== "planning" && <RightNowStrip onAction={handleQuickAction} />}
      <StayAnchor />
      {(() => {
        // Lead with what fits the moment (journey-state). StayAnchor stays on top.
        const active = getActiveLocation();
        const city = active?.address?.city || active?.placeName || "";
        const ORDER = {
          home: ["escapes", "rows", "stamps"],          // based here → get out / plan
          discovery: ["rows", "escapes", "stamps"],
          domestic: ["stamps", "rows", "escapes"],       // on a trip → collect + explore nearby
          international: ["stamps", "rows", "escapes"],
          planning: ["rows", "escapes", "stamps"],       // browsing → top spots + day trips
        };
        const line = {
          home: city ? `You're home in ${city} — plan an escape?` : "",
          domestic: city ? `Exploring ${city}` : "",
          international: city ? `Exploring ${city}` : "",
          planning: city ? `Planning ${city}` : "",
          discovery: "",
        }[journeyMode] || "";
        const SEC = {
          rows: <HomeRows key="rows" onAction={handleQuickAction} />,
          stamps: <StampsNearYou key="stamps" onAction={handleQuickAction} />,
          escapes: <EscapesRow key="escapes" onAction={handleQuickAction} />,
        };
        const order = ORDER[journeyMode] || ["rows", "stamps", "escapes"];
        return (
          <>
            {line && (
              <div className="px-4 pb-1">
                <div className="max-w-md mx-auto font-mono uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold" style={{ color: "#736657" }}>{line}</div>
              </div>
            )}
            {order.map((k) => SEC[k])}
          </>
        );
      })()}

      {/* EXPLORE MORE — mono kicker + gradient cards. At small text steps this
          is a 3-col row of compact cards; once text is enlarged (step >= 2) it
          drops to a 2-col grid so the larger tiles + 2-line serif titles fit and
          read as large as the six finder tiles above. */}
      <div className="px-4 pb-28">
        <div className="max-w-md mx-auto">
          <div className="font-mono uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold mt-1 mb-2" style={{ color: '#736657' }}>
            Explore more
          </div>
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: fontStep >= 2 ? '1fr 1fr' : '1fr 1fr 1fr' }}
          >
            {PHONE_EXPLORE.map((e) => (
              <PhoneGrad key={e.title} grad={e.grad} emoji={e.emoji} title={e.title} step={fontStep} onClick={() => handleQuickAction(e.action)} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom clearance for the AdMob banner overlay + lifted nav.
          The native banner is a system overlay at BOTTOM_CENTER with
          margin: 0 (pinned to the very bottom edge), and on Home the
          FloatingNav pill is lifted to bottom: 64 to sit just above it.
          Neither participates in React layout, so without this spacer
          the last row of cards ("Things to do" / "Shopping" / scanners)
          sits behind them. ~180px = ad height (~60px) + lifted-nav
          extent (~64px) + a small visual gutter. */}
      <div aria-hidden style={{ height: 180 }} />
      </>
      )}

      {/* AdMob banner — iOS/Android only (no-op on web). Mount last
          so showBanner runs after the rest of Home has rendered and
          the user has a complete first paint before any ad UI
          appears in the chrome. Gated on onboarding_completed so the
          native banner overlay never shows during the brief Home mount
          that precedes the onboarding redirect (it would otherwise
          linger over the onboarding screens). ALSO suppressed while the
          Welcome splash or the location picker is open — the native ad
          overlay would otherwise sit at the bottom over those screens;
          unmounting HomeBanner calls AdMob.hideBanner/removeBanner, and it
          re-shows once the user is on the actual home content. */}
      {profile?.onboarding_completed && !showWelcome && !showLocationPicker && <HomeBanner />}

      <LocationModePicker
        isOpen={showLocationPicker}
        onClose={() => { setShowLocationPicker(false); setColdOpenChooser(false); }}
        coldOpen={coldOpenChooser}
        lastLocation={getActiveLocation()}
        onSnoozeToday={snoozeLocationAskToday}
      />

      {/* Arrival stamps — airport (domestic + international) + land/boat border crossings */}
      {profile?.onboarding_completed && !showWelcome && <AirportArrivalPrompt />}
      {profile?.onboarding_completed && !showWelcome && <BorderCrossingPrompt />}
    </div>
  );
}

// ── PhoneTile — compact editorial finder tile (2-col grid) ─────────────────
// Saturated category-ink bg, white emoji chip, serif title (2-line clamp), tiny
// subtitle. min-height (never fixed) so enlarging text grows the tile instead of
// clipping. Mirrors HomeTablet's TabletTile at phone scale.
function PhoneTile({ cat, emoji, title, sub, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[18px] text-white text-left min-w-0 p-[13px]"
      style={{ background: cat.ink, minHeight: 100, boxShadow: `0 10px 22px -12px ${cat.ink}80` }}
    >
      <div
        className="absolute -top-3.5 -right-3.5 rounded-full pointer-events-none"
        style={{ width: 84, height: 84, background: 'rgba(255,255,255,0.12)' }}
      />
      <div
        className="relative flex items-center justify-center flex-none"
        style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,0.2)' }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
      </div>
      <div
        className="font-serif leading-[1.05] tracking-tight relative text-[calc(18px*var(--fs))] mt-2"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {title}
      </div>
      {sub && <div className="text-[calc(11px*var(--fs))] opacity-85 relative mt-0.5">{sub}</div>}
    </motion.button>
  );
}

// ── PhoneGrad — gradient Explore-more card ─────────────────────────────────
// Gradient bg, emoji glyph, serif title (2-line clamp). min-height so the card
// grows with enlarged text. `step` is the glasses text-size step (0-3): once
// enlarged (>= 2) the card matches the six finder tiles — serif title fs(18) and
// min-height ~100px — to read AS LARGE as them in the 2-col Explore grid; at the
// smaller steps it stays compact (fs(14), min-height 82) for the 3-col row.
// Mirrors HomeTablet's TabletGrad at phone scale.
function PhoneGrad({ grad, emoji, title, step = 0, onClick }) {
  const big = step >= 2;
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[15px] text-white text-left p-[11px]"
      style={{ background: grad, minHeight: big ? 100 : 82, boxShadow: '0 12px 26px -14px rgba(15,20,25,0.4)' }}
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</div>
      <div
        className={`font-serif leading-[1.05] tracking-tight mt-[7px] ${big ? 'text-[calc(18px*var(--fs))]' : 'text-[calc(14px*var(--fs))]'}`}
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {title}
      </div>
    </motion.button>
  );
}
