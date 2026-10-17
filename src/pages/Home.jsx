import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapPin } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { trackEvent } from "../Layout";
import { useLocation, isLocationAskSnoozedToday, snoozeLocationAskToday, readOpenBehavior } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import UsernameNudge from "@/components/social/UsernameNudge";
import StampsNearYou from "../components/home/StampsNearYou";
import DreamShelf from "../components/home/DreamShelf";
import WanderlustLine from "../components/home/WanderlustLine";
import SuggestPlaceSection from "../components/home/SuggestPlaceSection";
// CLUTTER CUT (founder, 2026-09-20): HomeRows (Near you now / Around the
// city today / In the city), ExperiencesRow ("Worth the drive"), EscapesRow
// ("Trips & escapes") and the YOUR TRIP zone (StayAnchor, MyTripCard,
// WishlistCard) no longer mount on the phone Home. StayAnchor + WishlistCard
// moved to MyTrip.jsx; the spot rows get a new home in the next slice.
// iPad gets the HomeRows folder ("Around you") in the same zone stack.
import AllServicesSheet from "../components/home/AllServicesSheet";
import NearbyServices from "../components/home/NearbyServices";
import PassportHero from "../components/home/PassportHero";
import { getTravelMode } from "@/lib/homeContext";
import { IVORY, NEUTRAL, fs } from "../components/redesign/constants";
import { useAuth } from "@/lib/AuthContext";
import { extractFirstName } from "@/lib/extractFirstName";
import { isLocationPermissionGranted } from "@/lib/geolocation";
import { callWorker } from "@/lib/callWorker";
import { listPassport } from "@/lib/passport";
import AirportArrivalPrompt from "@/components/AirportArrivalPrompt";
import BorderCrossingPrompt from "@/components/BorderCrossingPrompt";
import { ROUTE } from "@/lib/workerRoutes";
import { countryCode } from "@/lib/countries";
import { distanceUnit } from "@/lib/units";
import { homeTimezoneForCountry } from "@/lib/homePlace";
import { useIsTablet } from "@/lib/useIsTablet";
import HomeRows from "@/components/home/HomeRows";
import SmartSearchBar from "@/components/search/SmartSearchBar";
import SmartSearchOverlay from "@/components/search/SmartSearchOverlay";
import DestinationStrip from "@/components/search/DestinationStrip";
import WelcomeSplash from "@/components/onboarding/WelcomeSplash";
import CityBoardRow from "@/components/home/CityBoardRow";
import { openAttraction } from "@/lib/openAttraction";

// Translation mapping for greetings — shown next to the mono "Hello" kicker
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

// Times and dates in a place's own timezone (the lobby, its clock rows and the iPad layout).
function formatLocalTime(date, tz) {
  if (!tz) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  try {
    return date.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

function formatLocalDate(date, tz) {
  if (!tz) return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
  try {
    return date.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: '2-digit' });
  } catch {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
  }
}

export default function HomePage() {
  const navigate = useNavigate();
  const { locationMode, selectedLocation, currentGpsLocation, getActiveLocation, getCurrentLocation, switchToCurrentLocation, loading: locationLoading } = useLocation();
  const { profile, user: authUser, signInTick, bumpWelcomeSplashCount } = useAuth();
  // iPad renders the same Home as the phone, in a 720px column, with the local
  // time in the lobby, the inline services grid and the "Around you" rows.
  const isTablet = useIsTablet();

  const [user, setUser] = useState(null);
  const [localGreeting, setLocalGreeting] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
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
  // Lowercase ISO-2 of the home country while the flag toggle is on and the
  // country resolves; both flag image URLs are derived from it at render.
  const [homeFlagCode, setHomeFlagCode] = useState(null);
  // One /passport/list read feeds the passport zone and the stamp shelf:
  // total (null while loading AND on error — never a fake 0), the newest stamp,
  // and earnedIds (the entity ids you hold; null until loaded).
  const [passport, setPassport] = useState({ total: null, newest: null, earnedIds: null, error: null });
  // The passport hero's "next stamp": the closest stampable place, reported up
  // by StampsNearYou (one fetch serves both surfaces).
  const [nearestStamp, setNearestStamp] = useState(null);
  const pickerPrompted = useRef(false); // gate the one-time location-picker auto-open (per mount)

  useEffect(() => {
    if (!locationLoading) loadUserAndWeather();
     
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
     
  }, [locationMode, currentGpsLocation]);

  // One /passport/list read (there is no count-only route). listPassport never
  // throws: a failed read comes back as { error, stats: {} }, which stays an
  // error here, never a total of 0.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let res;
      try { res = await listPassport(); } catch (e) { res = { stamps: [], stats: {}, error: e?.message || 'failed' }; }
      if (cancelled) return;
      if (res.error) { setPassport({ total: null, newest: null, earnedIds: null, error: res.error }); return; }
      const stamps = Array.isArray(res.stamps) ? res.stamps : [];
      let newest = null;
      for (const st of stamps) {
        if (st && (!newest || (Date.parse(st.created_at) || 0) > (Date.parse(newest.created_at) || 0))) newest = st;
      }
      setPassport({
        total: Number.isFinite(res.stats?.total) ? res.stats.total : stamps.length,
        newest,
        earnedIds: new Set(stamps.filter((st) => st && st.entity_id != null).map((st) => String(st.entity_id))),
        error: null,
      });
    })();
    return () => { cancelled = true; };
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
      // Show the home-country flag (iPad: the greeting-card background; phone: a
      // small badge beside the greeting name) when the user turned the "Show Home
      // Country Flag" toggle ON (Settings) AND has a home country whose flag we
      // can resolve. Both come from the Supabase profile, so
      // it works on native. The flag updates immediately after a Settings save
      // (refreshProfile → new profile → this effect re-runs).
      if (userData.show_home_flag && userData.home_country) {
        const homeCode = countryCode(userData.home_country);
        if (homeCode) {
          setHomeFlagCode(homeCode.toLowerCase());
          setShowHomeFlag(true);
        } else {
          setShowHomeFlag(false);
          setHomeFlagCode(null);
        }
      } else {
        setShowHomeFlag(false);
        setHomeFlagCode(null);
      }

      const activeLocation = getActiveLocation();
      if (activeLocation?.coordinates) {
        await loadWeatherData(
          activeLocation.coordinates.latitude,
          activeLocation.coordinates.longitude,
          activeLocation.placeName || activeLocation.address?.city
        );
      }
    } catch (error) {
      // AuthGate handles auth — never bounce to Base44 login. The lobby has already
      // painted; the temperature just doesn't appear.
      console.error("Error loading user or weather:", error);
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

  const handleQuickAction = (actionLabel) => {
    trackEvent('feature_used', { feature_name: actionLabel.toLowerCase().replace(/\s+/g, '_') });
    const routes = {
      "Money Exchange": "MoneyExchange",
      "Basic Phrases": "BasicPhrases",
      "Convenience Store": "ConvenienceStore",
      "ATM": "ATMFinder",
      "Weather": "Weather",
      "Things to Do": "ThingsToDo",
      "Culture Information": "CultureInformation",
      "Passport": "Passport",
      "Coffee": "CoffeeFinder",
      "Restroom": "RestroomFinder",
      "Places to Eat": "PlacesToEat",
      "Shopping": "Shopping",
    };
    if (routes[actionLabel]) navigate(createPageUrl(routes[actionLabel]));
  };

  // Dream-shelf tap → the attraction's Things to Do card.
  const openDreamActivity = (item) => {
    trackEvent("dream_shelf_open_detail", { place_id: item.id, place_name: item.name });
    if (!openAttraction(navigate, item, "From your stamp shelf")) handleQuickAction("Things to Do");
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

  // No full-page spinner: the lobby paints at once from the profile, and the
  // temperature, flag and clock rows appear when their data arrives (the weather
  // call alone can take up to its 25 s timeout).
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
  // The lobby's location pill keeps the full place name so you can confirm
  // exactly where you are. While LocationContext is still loading it says
  // "Finding you…"; a GPS fix with no name yet (offshore, or a fresh lock before
  // the reverse geocode) says "Current location", never a truncated
  // "Detecting your locati…"; no place at all says "Set location".
  const placeText = locationLoading
    ? 'Finding you…'
    : (cleanPlaceName(activeLocation?.placeName)
      || activeLocation?.address?.city
      || (activeLocation?.coordinates ? 'Current location' : 'Set location'));

  // Home-country flag: when the Show Home Country Flag toggle is on and the home
  // country resolves to a flag, the lobby shows a small badge beside the name on
  // phone and iPad alike (the iPad's 440px flag hero is gone).
  const lobbyFlag = showHomeFlag && homeFlagCode
    ? { url: `https://flagcdn.com/h80/${homeFlagCode}.png`, country: profile?.home_country || '' }
    : null;

  // Clock info. The lobby shows the SELECTED/active place; these add where you
  // physically are (only when you've navigated away) and your home (when
  // toggled). Only rows whose timezone differs from the lobby's — and from each
  // other — are kept, so nothing repeats. clockSources feeds the lobby's third
  // line, which formats the times on its own tick.
  const activeTz = timezone;
  const rawClockRows = [];
  if (physicalTz && physicalTz !== activeTz) {
    rawClockRows.push({ key: 'here', label: physicalLabel || 'Your location', tz: physicalTz, temp: null });
  }
  if (shouldShowHomeCountryTime && homeCountryInfo?.timezone && homeCountryInfo.timezone !== activeTz) {
    rawClockRows.push({ key: 'home', label: homeCountryInfo.label || homeCountryInfo.country, tz: homeCountryInfo.timezone, temp: homeCountryWeather });
  }
  const _seenTz = new Set();
  const clockSources = rawClockRows.filter((r) => (_seenTz.has(r.tz) ? false : (_seenTz.add(r.tz), true)));

  // The three-zone spine is IDENTICAL in both journey stacks; the only thing
  // journeyMode still gates on the phone is the DreamShelf (dream stack only).
  const isDreamStack = !["domestic", "international", "discovery"].includes(journeyMode);
  // iPad: "Around you" leads the stamps at home, while discovering and while
  // planning; on a trip (domestic, international) the stamps come first.
  const rowsFirst = !["domestic", "international"].includes(journeyMode);

  // Distances in the zones follow the traveler's unit (Settings, else the country).
  const unit = distanceUnit(profile, countryCode(activeLocation?.address?.country) || activeLocation?.address?.countryCode);

  const openAllServices = () => {
    trackEvent('feature_used', { feature_name: 'all_services_sheet' });
    setShowAllServices(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans" style={{ background: IVORY }}>
      {/* First-launches Welcome splash — overlays Home (phone + tablet) BEFORE
          the location selector; any dismissal opens the selector → home. */}
      <AnimatePresence>
        {showWelcome && <WelcomeSplash onProceed={welcomeExplore} onTimeout={welcomeClose} />}
      </AnimatePresence>
      {/* THE LOBBY (Home-Boxes L29-51): hello and the name, the date (on iPad
          also the local time), temperature and location pill, any extra clocks,
          then the search bar. It paints at once; HomeLobby owns the 1 s clock. */}
      <HomeLobby
        firstName={getFirstName()}
        localGreeting={localGreeting}
        flag={lobbyFlag}
        weatherInfo={weatherInfo}
        tempUnit={tempUnit}
        onToggleTemp={toggleTempUnit}
        timezone={timezone}
        placeText={placeText}
        onChangeLocation={() => setShowLocationPicker(true)}
        clockSources={clockSources}
        showTime={isTablet}
      />

      {/* SMART-SEARCH SPINE — one search that routes into the right world.
          Briefly removed 2026-10-06, restored 2026-10-07 once the audit's four
          fixes landed (typed city wins, best/top-rated sort, authentic tiers,
          whole-word keywords). Sits ABOVE the first zone kicker, with the
          DestinationStrip glued directly underneath it. */}
      <SmartSearchBar onOpen={() => setShowSearch(true)} />
      {destSearch && !destDismissed && (
        <DestinationStrip place={destSearch} onAction={handleQuickAction} onDismiss={() => setDestDismissed(true)} />
      )}

      {/* THE ZONES — one fixed order, each zone its own <section data-zone>
          (bible.home.order): passport, the boards row, nearby services, stamps
          near you, the stamp shelf (dream stack only), local favorites, then
          the closing quote. Your circle's activity lives in the Mailbox only
          (founder, 2026-10-16: "remove your circle activity post from Home page"). Each zone renders nothing when it has nothing
          honest to show, so the stack self-compacts. Layout reserves the
          bottom space for the floating nav. */}
      <PassportHero
        total={passport.total}
        newest={passport.newest}
        error={passport.error}
        nearest={nearestStamp}
        unit={unit}
        onOpen={() => { trackEvent('feature_used', { feature_name: 'passport_hero' }); navigate(createPageUrl('Passport')); }}
      />
      {/* City Board: 'Postcards from Lisbon', only when that board has something to show. */}
      <CityBoardRow city={activeLocation?.address?.city} country={activeLocation?.address?.country} region={activeLocation?.address?.state} />
      <NearbyServices wide={isTablet} onAction={handleQuickAction} onAllServices={openAllServices} />
      {isTablet && rowsFirst && <HomeRows unit={unit} onAction={handleQuickAction} />}
      <StampsNearYou unit={unit} onAction={handleQuickAction} onNearest={setNearestStamp} />
      {isTablet && !rowsFirst && <HomeRows unit={unit} onAction={handleQuickAction} />}
      {isDreamStack && (
        <DreamShelf
          latitude={activeLocation?.coordinates?.latitude}
          longitude={activeLocation?.coordinates?.longitude}
          cityName={cityName}
          cityTempF={weatherInfo?.fahrenheit ?? null}
          cityTempC={weatherInfo?.celsius ?? null}
          tempUnit={tempUnit}
          earnedIds={passport.earnedIds}
          earnedError={!!passport.error}
          onOpenActivity={openDreamActivity}
        />
      )}
      <SuggestPlaceSection wide={isTablet} />
      <WanderlustLine />

      <SmartSearchOverlay isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* "All services" — the eleven finders as crest tiles. Phone only in
          practice: the iPad shows them inline in the services zone. */}
      <AllServicesSheet isOpen={showAllServices} onClose={() => setShowAllServices(false)} onAction={handleQuickAction} />

      <LocationModePicker
        isOpen={showLocationPicker}
        onClose={() => { setShowLocationPicker(false); setColdOpenChooser(false); }}
        coldOpen={coldOpenChooser}
        lastLocation={getActiveLocation()}
        onSnoozeToday={snoozeLocationAskToday}
      />

      <UsernameNudge hold={showLocationPicker || showAllServices} />

      {/* Arrival stamps — airport (domestic + international) + land/boat border crossings */}
      {profile?.onboarding_completed && !showWelcome && <AirportArrivalPrompt />}
      {profile?.onboarding_completed && !showWelcome && <BorderCrossingPrompt />}
    </div>
  );
}

// ── HomeLobby — the top of Home (Home-Boxes L29-51) ────────────────────────
// Line 1: mono HELLO, the local greeting word, the name in teal serif italic and
// the home-country flag. Line 2: the date, the temperature (tap for °C/°F) and the
// location pill; on iPad the local time joins the date. Line 3, only when there
// is one: the extra clocks (where you are, your home). Owns the 1 s tick so the rest of Home doesn't re-render every
// second. Everything wraps at large text sizes instead of clipping.
const DOT = <span aria-hidden="true" style={{ color: NEUTRAL.ink3 }}>·</span>;

function HomeLobby({ firstName, localGreeting, flag, weatherInfo, tempUnit, onToggleTemp, timezone, placeText, onChangeLocation, clockSources, showTime = false }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const temp = weatherInfo && Number.isFinite(weatherInfo.celsius) && Number.isFinite(weatherInfo.fahrenheit) ? weatherInfo : null;
  const tempText = temp ? (tempUnit === 'C' ? `${temp.celsius}°C` : `${temp.fahrenheit}°F`) : '';
  const tempLabel = temp
    ? (tempUnit === 'C'
      ? `${temp.celsius} degrees Celsius. Switch to Fahrenheit`
      : `${temp.fahrenheit} degrees Fahrenheit. Switch to Celsius`)
    : '';
  const greeting = localGreeting ? localGreeting.charAt(0).toUpperCase() + localGreeting.slice(1) : '';
  const placeLabel = placeText === 'Finding you…'
    ? 'Finding your location. Change location'
    : `Location: ${placeText}. Change location`;
  const clocks = (clockSources || []).map((r) => {
    const t = r.temp ? (tempUnit === 'C' ? ` ${r.temp.celsius}°C` : ` ${r.temp.fahrenheit}°F`) : '';
    return { key: r.key, text: `${r.label} ${formatLocalTime(now, r.tz)}${t}` };
  });

  return (
    <div className="px-4 pt-3">
      <div className="max-w-md mx-auto md:max-w-[720px]">
        {/* LINE 1 */}
        <p className="m-0 flex flex-wrap items-baseline" style={{ columnGap: 8, minHeight: 28 }}>
          <span className="font-mono uppercase" style={{ fontSize: fs(10.5), letterSpacing: '.12em', color: NEUTRAL.ink3 }}>Hello</span>
          {greeting && (
            <span className="font-serif italic" style={{ fontSize: fs(14), color: NEUTRAL.brandTeal }}>{greeting}</span>
          )}
          {firstName && (
            <span className="font-serif italic" style={{ fontSize: fs(24), lineHeight: '28px', color: NEUTRAL.brandTeal, overflowWrap: 'anywhere' }}>{firstName}</span>
          )}
          {flag && (
            // A hairline drop-shadow follows the flag's own shape (no box around
            // Nepal's pennant) and keeps white-field flags visible on the ivory.
            // A failed load hides itself; keyed by URL so a new country remounts it.
            <img
              key={flag.url}
              src={flag.url}
              alt={flag.country ? `Home country: ${flag.country}` : 'Home country flag'}
              className="self-center rounded-[3px]"
              style={{ height: fs(15), width: 'auto', filter: 'drop-shadow(0 0 0.5px rgba(22,17,13,.6))' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </p>

        {/* LINE 2 */}
        <div className="flex items-center justify-between" style={{ gap: 10, minHeight: 28, marginTop: 4 }}>
          <div className="flex flex-wrap items-center min-w-0" style={{ columnGap: 6, fontSize: fs(12), fontWeight: 500, lineHeight: '16px', color: NEUTRAL.ink2 }}>
            <span className="whitespace-nowrap">{formatLocalDate(now, timezone)}</span>
            {showTime && (
              <>
                {DOT}
                <span className="whitespace-nowrap">{formatLocalTime(now, timezone)}</span>
              </>
            )}
            {temp && (
              <>
                {DOT}
                <button
                  type="button"
                  onClick={onToggleTemp}
                  aria-label={tempLabel}
                  className="whitespace-nowrap"
                  // A 44px target around a short "16°C": the padding widens it and the
                  // matching negative margin keeps the text where the board puts it.
                  style={{ height: 44, minWidth: 44, margin: '-8px -10px', padding: '0 10px', background: 'transparent', border: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                >
                  {tempText}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onChangeLocation}
            aria-label={placeLabel}
            className="flex items-center min-w-0"
            style={{ flex: '0 1 auto', maxWidth: '62%', height: 44, margin: '-8px 0', padding: 0, background: 'transparent', border: 0, cursor: 'pointer' }}
          >
            <span className="inline-flex items-center min-w-0 rounded-full" style={{ gap: 6, minHeight: 28, padding: '0 12px 0 10px', background: NEUTRAL.ivory2 }}>
              <MapPin size={14} color={NEUTRAL.brandTeal} strokeWidth={2} aria-hidden="true" className="flex-none" />
              <span className="truncate" style={{ fontSize: fs(11.5), fontWeight: 600, lineHeight: 1.2, color: NEUTRAL.ink }}>{placeText}</span>
              <span className="flex-none underline" style={{ fontSize: fs(10.5), lineHeight: 1.2, color: NEUTRAL.tealInk, textUnderlineOffset: 2 }}>Change</span>
            </span>
          </button>
        </div>

        {/* LINE 3 — the extra clocks, only when there are any */}
        {clocks.length > 0 && (
          <p className="m-0 flex flex-wrap" style={{ columnGap: 6, marginTop: 2, fontSize: fs(12), lineHeight: '16px', color: NEUTRAL.ink3 }}>
            {clocks.map((c, i) => (
              <span key={c.key} className="whitespace-nowrap">{i > 0 ? '· ' : ''}{c.text}</span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
