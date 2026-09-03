import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapPin, Cloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { trackEvent } from "../Layout";
import { useLocation, isLocationAskSnoozedToday, snoozeLocationAskToday, readOpenBehavior } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import HomeRows from "../components/home/HomeRows";
import StampsNearYou from "../components/home/StampsNearYou";
import StayAnchor from "../components/home/StayAnchor";
import EscapesRow from "../components/home/EscapesRow";
import RightNowStrip from "../components/home/RightNowStrip";
import EventsRow from "../components/home/EventsRow";
import MyTripCard from "../components/home/MyTripCard";
import WishlistCard from "../components/home/WishlistCard";
import AllServicesSheet from "../components/home/AllServicesSheet";
import { getTravelMode } from "@/lib/homeContext";
import { TEAL_DEEP, IVORY, IVORY_2 } from "../components/redesign/constants";
import { useAuth } from "@/lib/AuthContext";
import { extractFirstName } from "@/lib/extractFirstName";
import { isLocationPermissionGranted } from "@/lib/geolocation";
import { callWorker } from "@/lib/callWorker";
import AirportArrivalPrompt from "@/components/AirportArrivalPrompt";
import BorderCrossingPrompt from "@/components/BorderCrossingPrompt";
import { ROUTE } from "@/lib/workerRoutes";
import FontScaleButton from "@/components/a11y/FontScaleButton";
import { countryCode } from "@/lib/countries";
import { homeTimezoneForCountry } from "@/lib/homePlace";
import { useIsTablet } from "@/lib/useIsTablet";
import HomeTablet from "@/components/home/HomeTablet";
import SmartSearchBar from "@/components/search/SmartSearchBar";
import SmartSearchOverlay from "@/components/search/SmartSearchOverlay";
import DestinationStrip from "@/components/search/DestinationStrip";
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

// Finder chip row — ONE stable set of five (never shuffled by journey mode, per
// the never-shuffle rule). The four lead finders navigate directly through
// handleQuickAction (which owns ALL navigation — no routes invented here);
// "All services" opens AllServicesSheet, which carries every destination the
// two retired tile grids offered.
const FINDER_CHIPS = [
  { label: 'Eat', action: 'Places to Eat' },
  { label: 'Coffee', action: 'Coffee' },
  { label: 'Things to do', action: 'Things to Do' },
  { label: 'Hotels', action: 'Find a Hotel' },
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

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localGreeting, setLocalGreeting] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezone, setTimezone] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false); // Smart-Search spine overlay
  const [showAllServices, setShowAllServices] = useState(false); // "All services" sheet behind the finder chip row
  const routerLocation = useRouterLocation();
  const [destDismissed, setDestDismissed] = useState(false);
  const destSearch = routerLocation.state?.destinationSearch || null; // "everything <place>" mode
  useEffect(() => { setDestDismissed(false); }, [destSearch]);
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
          destinationSearch={destSearch && !destDismissed ? destSearch : null}
          onDismissDestination={() => setDestDismissed(true)}
        />
      ) : (
      <>
      {/* PHONE — editorial Home (Phase-1a-lite): greeting header → clock stack →
          Smart-Search spine → finder chip row (+ All-services sheet) → the
          journey-ordered Discover stack. Single max-w-md column. Presentation
          only — every handler / data field below is reused exactly as the
          tablet layout consumes it (tablet converges later). */}
      {/* COMPACT HERO HEADER ----------------------------------------------
          Replaces the 330px flag greeting card: one serif greeting line with
          the glasses kept on the right, then a date · temp · location row.
          No fixed height, no flag layers — the search bar now sits well
          within the first viewport. Every handler/data field below is the
          card's, just reflowed. */}
      <div className="px-4 pt-2 pb-3">
        <div className="max-w-md mx-auto">
          {/* LINE 1 — mono "Hello 👋" kicker (+ local greeting) flowing into
              the serif name (italic) and "in {city}" (regular serif) as one
              wrappable line; FontScaleButton keeps its spot far right. */}
          <div className="flex items-start justify-between gap-2">
            <p className="flex-1 min-w-0 leading-snug">
              <span className="font-mono uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))]" style={{ color: '#736657' }}>Hello 👋</span>
              {localGreeting && (
                <span className="font-serif italic text-[calc(14px*var(--fs))]" style={{ color: TEAL_DEEP }}>
                  {' '}{localGreeting.charAt(0).toUpperCase() + localGreeting.slice(1)}
                </span>
              )}
              {getFirstName() && (
                <span className="font-serif italic text-[calc(22px*var(--fs))]" style={{ color: TEAL_DEEP }}>
                  {' '}{getFirstName()}
                </span>
              )}
              {cityName && (
                <span className="font-serif text-[calc(22px*var(--fs))]">
                  <span style={{ color: '#3A3128' }}> in </span>
                  <span style={{ color: '#16110D' }}>{cityName}</span>
                </span>
              )}
            </p>
            <div className="flex-none"><FontScaleButton /></div>
          </div>

          {/* LINE 2 — date · temp toggle (°C/°F, same handler) · location pill
              ("Change" opens LocationModePicker). flex-wrap so the larger text
              steps (text-size glasses) reflow onto extra lines instead of crowding. */}
          <div className="mt-2 flex items-center justify-between gap-x-2 gap-y-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[calc(12px*var(--fs))] font-medium" style={{ color: '#3A3128' }}>
              <span className="whitespace-nowrap">{formatLocalDate(currentTime, timezone)}</span>
              {weatherInfo && Number.isFinite(weatherInfo.celsius) && Number.isFinite(weatherInfo.fahrenheit) && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <button onClick={toggleTempUnit} className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Cloud size={13} color={TEAL_DEEP} strokeWidth={2} />
                    {tempUnit === 'C' ? `${weatherInfo.celsius}°C` : `${weatherInfo.fahrenheit}°F`}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => setShowLocationPicker(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-w-full min-w-0"
              style={{ background: '#F7F4EC' }}
            >
              <MapPin size={14} color={TEAL_DEEP} strokeWidth={2} className="flex-none" />
              <span className="text-[calc(11.5px*var(--fs))] font-semibold truncate" style={{ color: '#16110D' }}>{placeText}</span>
              <span className="text-[calc(10.5px*var(--fs))] underline underline-offset-2 flex-none" style={{ color: TEAL_DEEP }}>Change</span>
            </button>
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

      {/* SMART-SEARCH SPINE — one search that routes into the right world. */}
      <SmartSearchBar onOpen={() => setShowSearch(true)} />

      {/* FINDER CHIPS — one stable horizontal row of five quiet pills directly
          under the search bar (replaces BOTH old tile grids). Same set in every
          journey mode (never shuffled); "All services" opens the sheet with
          every destination the old grids offered. */}
      <div className="px-4 pb-3">
        <div className="max-w-md mx-auto flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FINDER_CHIPS.map((c) => (
            <FinderChip key={c.label} label={c.label} onClick={() => handleQuickAction(c.action)} />
          ))}
          <FinderChip
            label="All services"
            accent
            onClick={() => {
              trackEvent('feature_used', { feature_name: 'all_services_sheet' });
              setShowAllServices(true);
            }}
          />
        </div>
      </div>
      {destSearch && !destDismissed && (
        <DestinationStrip place={destSearch} onAction={handleQuickAction} onDismiss={() => setDestDismissed(true)} />
      )}

      {/* DISCOVER — living sections below the chips (each renders NOTHING when
          there's no coverage, and all re-center as the user moves). Two stable
          stacks, capped and mode-correct — getTravelMode decides which:
            nearby (domestic/international/discovery): what's on right now →
              stamps → events → top spots, then the trip anchors (self-hiding);
            home/planning: the dream shelf (HomeRows until the dedicated one
              exists) → escapes → events, then the trip anchors.
          VibeBundles + WhereToStay moved OFF Home — the planner and the
          FindAHotel flow own them next. */}
      {["domestic", "international", "discovery"].includes(journeyMode) ? (
        <>
          <RightNowStrip onAction={handleQuickAction} />
          <StampsNearYou onAction={handleQuickAction} />
          <EventsRow />
          <HomeRows onAction={handleQuickAction} />
          <StayAnchor />
          <MyTripCard />
          <WishlistCard />
        </>
      ) : (
        <>
          <HomeRows onAction={handleQuickAction} />
          <EscapesRow onAction={handleQuickAction} />
          <EventsRow />
          <WishlistCard />
          <MyTripCard />
          <StayAnchor />
        </>
      )}

      {/* Bottom clearance for the FloatingNav pill. Home no longer mounts an
          ad banner and the pill is no longer lifted here (Layout passes
          liftForAd only on the finder pages), so this only needs to clear the
          resting pill: 22px bottom offset + ~60px pill + a small gutter, plus
          the home-indicator safe area. */}
      <div aria-hidden style={{ height: 'calc(96px + env(safe-area-inset-bottom))' }} />
      </>
      )}

      <SmartSearchOverlay isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* "All services" bottom sheet — every destination the two retired tile
          grids offered, grouped. Phone-only in practice (only the chip row sets
          showAllServices). */}
      <AllServicesSheet isOpen={showAllServices} onClose={() => setShowAllServices(false)} onAction={handleQuickAction} />

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

// ── FinderChip — quiet pill in the finder row ──────────────────────────────
// Ivory ground, 1px border, small sans label — no emoji, no tile color (per the
// design doctrine's chip spec). `accent` tints the label teal for the one chip
// that opens a sheet instead of navigating ("All services").
function FinderChip({ label, accent = false, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex-none rounded-full px-3.5 py-2 text-[calc(12.5px*var(--fs))] font-semibold whitespace-nowrap"
      style={{ background: IVORY_2, border: '1px solid #E6DFD0', color: accent ? TEAL_DEEP : '#16110D' }}
    >
      {label}
    </motion.button>
  );
}
