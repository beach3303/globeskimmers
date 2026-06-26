import React, { useState, useEffect, useRef } from "react";
import { MapPin, Cloud, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { trackEvent } from "../Layout";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import HomeBanner from "../components/ads/HomeBanner";
import { CAT, TEAL_DEEP, IVORY } from "../components/redesign/constants";
import { useAuth } from "@/lib/AuthContext";
import { extractFirstName } from "@/lib/extractFirstName";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import FontScaleButton from "@/components/a11y/FontScaleButton";
import { useFontScale } from "@/components/a11y/FontScaleContext";
import { countryCode } from "@/lib/countries";

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

export default function HomePage() {
  const navigate = useNavigate();
  const { locationMode, selectedLocation, currentGpsLocation, getActiveLocation, loading: locationLoading } = useLocation();
  const { profile, user: authUser } = useAuth();
  // Feature tiles: default is the compact 3+4 grid. The moment the user enlarges
  // text (any glasses bump) the rows reflow to 2-across, where the WIDER boxes
  // keep the full labels whole at a bigger font (chosen design: widen-when-large).
  const { step: fontStep } = useFontScale();
  const twoUp = fontStep >= 1;

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
  const [homeCountryWeather, setHomeCountryWeather] = useState(null);
  const [shouldShowHomeCountryTime, setShouldShowHomeCountryTime] = useState(false);
  const [showHomeFlag, setShowHomeFlag] = useState(false);
  const [homeFlagUrl, setHomeFlagUrl] = useState(null);
  const locationPrompted = useRef(false); // gate the one-time auto-open of the location picker

  useEffect(() => {
    if (!locationLoading) loadUserAndWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationLoading, locationMode, selectedLocation, currentGpsLocation, profile]);

  // If location init finishes with no location set, proactively open the picker
  // so the user can choose "Use My Current Location" or navigate to another —
  // the app is location-centric and does nothing useful without one. Fires once
  // per mount; the user can still dismiss it and tap "Set location" later.
  useEffect(() => {
    if (locationLoading || locationPrompted.current) return;
    if (!getActiveLocation()?.coordinates) {
      locationPrompted.current = true;
      setShowLocationPicker(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationLoading, locationMode, selectedLocation, currentGpsLocation]);

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

  // Show home-country TIME chip when:
  //   1. User toggled "Show Home Country Time" ON (show_home_country_info)
  //   2. AND the user is currently in a DIFFERENT country than their home
  //      (no point showing "Home time" when you're already at home)
  useEffect(() => {
    const checkShowHomeCountryTime = () => {
      if (!user || !homeCountryInfo || !getActiveLocation()?.address) {
        setShouldShowHomeCountryTime(false);
        return;
      }
      if (!user.show_home_country_info) {
        setShouldShowHomeCountryTime(false);
        return;
      }
      const activeLocation = getActiveLocation();
      setShouldShowHomeCountryTime(activeLocation.address.country !== user.home_country);
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
      // User data comes from the Supabase profile — the app-wide AuthGate
      // already guarantees a signed-in user, so there is NO Base44 auth check
      // here (and no redirect to Base44 login). We shape the profile into the
      // fields the rest of Home reads. The greeting itself reads
      // profile.first_name directly via getFirstName(); show_home_flag /
      // show_home_country_info aren't in the Supabase profile schema yet, so
      // they default off until Settings is migrated to Supabase.
      const userData = {
        first_name: profile?.first_name || extractFirstName(authUser) || '',
        home_country: profile?.home_country || null,
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
      if (userData.home_country) {
        loadHomeCountryData(userData.home_country);
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

  const loadHomeCountryData = async (countryName) => {
    const fallbackTimezones = {
      'United States': 'America/New_York', 'Philippines': 'Asia/Manila', 'Japan': 'Asia/Tokyo',
      'United Kingdom': 'Europe/London', 'Australia': 'Australia/Sydney', 'Canada': 'America/Toronto',
      'Germany': 'Europe/Berlin', 'France': 'Europe/Paris', 'Italy': 'Europe/Rome',
      'Spain': 'Europe/Madrid', 'Brazil': 'America/Sao_Paulo', 'Mexico': 'America/Mexico_City',
      'South Korea': 'Asia/Seoul', 'Thailand': 'Asia/Bangkok', 'Vietnam': 'Asia/Ho_Chi_Minh',
      'Singapore': 'Asia/Singapore', 'Malaysia': 'Asia/Kuala_Lumpur', 'Indonesia': 'Asia/Jakarta',
      'India': 'Asia/Kolkata', 'China': 'Asia/Shanghai',
    };
    setHomeCountryInfo({ country: countryName, timezone: fallbackTimezones[countryName] || 'UTC' });
    // Home-country temperature for the subtle home-info row (free Open-Meteo).
    const coords = HOME_CAPITAL_COORDS[countryName];
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
      "Coffee": "CoffeeFinder",
      "Restroom": "RestroomFinder",
      "Places to Eat": "PlacesToEat",
      "Transportation": "Transportation",
      "Shopping": "Shopping",
      "Smart Text Scanner": "SmartTextScanner",
    };
    if (routes[actionLabel]) navigate(createPageUrl(routes[actionLabel]));
  };

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans" style={{ background: IVORY }}>
      {/* HERO GREETING CARD ----------------------------------------------- */}
      <div className="px-4 pt-2 pb-4">
        <div
          className="max-w-md mx-auto rounded-[22px] relative overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1px solid #F0E9DC',
            boxShadow: '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)',
          }}
        >
          {/* Home-country flag as the greeting-card background. Stretched to fill
              the whole card so the ENTIRE flag shows, with a light scrim for text
              legibility. Active when the Show Home Country Flag toggle is on. */}
          {flagActive && (
            <>
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${homeFlagUrl})`,
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                  filter: 'saturate(1.1)',
                }}
              />
              <div
                className="absolute inset-0 z-[1]"
                style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.40) 100%)' }}
              />
            </>
          )}

          {/* ONE unified layout for flag-on AND flag-off: same compact placement
              (greeting top-left, eyeglasses top-right, location + date/time/temp as
              right-aligned ovals at the bottom), same height. No full-width bars.
              Only the colors differ (white-over-flag vs dark-on-white). The flag
              fills the whole box (backgroundSize 100% 100% above). */}
          <div className="relative z-10 p-4 flex flex-col" style={{ minHeight: 'calc(205px * min(var(--fs), 1.25))' }}>
            <div>
              {/* Hello (left) · eyeglasses (right) */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-[calc(13.5px*var(--fs))] flex items-center gap-1.5 leading-none" style={{ color: flagActive ? '#fff' : '#475569', textShadow: flagActive ? '0 1px 8px rgba(0,0,0,0.6)' : 'none' }}>
                  <span>Hello 👋</span>
                  {localGreeting && (
                    <span className="font-serif italic" style={{ color: flagActive ? '#FFE7A3' : '#3A3128' }}>
                      {localGreeting.charAt(0).toUpperCase() + localGreeting.slice(1)}
                    </span>
                  )}
                </p>
                <div className="flex-none"><FontScaleButton /></div>
              </div>

              {/* Name, in <City> */}
              <h1 className="mt-1.5 text-[calc(27px*var(--fs))] font-extrabold tracking-tight leading-tight" style={{ color: flagActive ? '#fff' : '#0F1419', textShadow: flagActive ? '0 2px 14px rgba(0,0,0,0.6)' : 'none' }}>
                {getFirstName()}
                {cityName && (
                  <>
                    <span>, in </span>
                    <span className="font-serif italic font-normal" style={{ color: flagActive ? '#FFE7A3' : TEAL_DEEP }}>{cityName}</span>
                  </>
                )}
              </h1>
            </div>

            {/* Compact ovals pushed to the bottom — each background hugs its text.
                Home time/temp live in the subtle row BELOW the card. */}
            <div className="mt-auto pt-3 flex flex-col items-end gap-2">
              <button
                onClick={() => setShowLocationPicker(true)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 max-w-[88%]"
                style={{ background: flagActive ? 'rgba(0,0,0,0.45)' : '#F7F4EC', backdropFilter: flagActive ? 'blur(10px)' : 'none', WebkitBackdropFilter: flagActive ? 'blur(10px)' : 'none' }}
              >
                <MapPin size={15} color={flagActive ? '#FFE7A3' : TEAL_DEEP} strokeWidth={2} className="flex-none" />
                <span className="text-[calc(13.5px*var(--fs))] font-semibold truncate" style={{ color: flagActive ? '#fff' : '#0F1419' }}>{placeText}</span>
                <span className="text-[calc(10.5px*var(--fs))] underline underline-offset-2 flex-none" style={{ color: flagActive ? 'rgba(255,255,255,0.8)' : TEAL_DEEP }}>Change</span>
              </button>

              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <span className="rounded-full px-2.5 py-1 text-[calc(11.5px*var(--fs))] font-semibold whitespace-nowrap" style={{ background: flagActive ? 'rgba(0,0,0,0.45)' : '#F7F4EC', color: flagActive ? '#fff' : '#0F1419', backdropFilter: flagActive ? 'blur(10px)' : 'none', WebkitBackdropFilter: flagActive ? 'blur(10px)' : 'none' }}>{formatLocalDate(currentTime, timezone)}</span>
                <span className="rounded-full px-2.5 py-1 text-[calc(11.5px*var(--fs))] font-semibold whitespace-nowrap" style={{ background: flagActive ? 'rgba(0,0,0,0.45)' : '#F7F4EC', color: flagActive ? '#fff' : '#0F1419', backdropFilter: flagActive ? 'blur(10px)' : 'none', WebkitBackdropFilter: flagActive ? 'blur(10px)' : 'none' }}>{formatLocalTime(currentTime, timezone)}</span>
                {weatherInfo && Number.isFinite(weatherInfo.celsius) && Number.isFinite(weatherInfo.fahrenheit) && (
                  <button onClick={toggleTempUnit} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[calc(11.5px*var(--fs))] font-semibold whitespace-nowrap" style={{ background: flagActive ? 'rgba(0,0,0,0.45)' : '#F7F4EC', color: flagActive ? '#fff' : '#0F1419', backdropFilter: flagActive ? 'blur(10px)' : 'none', WebkitBackdropFilter: flagActive ? 'blur(10px)' : 'none' }}>
                    <Cloud size={13} color={flagActive ? '#FFE7A3' : TEAL_DEEP} strokeWidth={2} />
                    {tempUnit === 'C' ? `${weatherInfo.celsius}°C` : `${weatherInfo.fahrenheit}°F`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Home-country info row — subtle text, NO background boxes. Shows only when
          "Show Home Country Time" is on and the user is abroad. Spread across:
          🏠 country · day,date · time · temperature. Sits between the greeting
          card and Money Exchange. */}
      {shouldShowHomeCountryTime && homeCountryInfo && (
        <div className="px-5 pb-3 -mt-1">
          {/* Fixed 11.5px — intentionally NOT scaled by --fs, so the text-size
              eyeglass does not enlarge this subtle home-country row. */}
          <div className="max-w-md mx-auto flex items-center justify-between gap-2 text-[11.5px] font-medium" style={{ color: '#8A93A6' }}>
            <span className="flex items-center gap-1 whitespace-nowrap"><span>🏠</span><span className="uppercase tracking-wide">{homeCountryInfo.country}</span></span>
            <span className="whitespace-nowrap">{formatLocalDate(homeCountryTime, homeCountryInfo.timezone)}</span>
            <span className="whitespace-nowrap">{formatLocalTime(homeCountryTime, homeCountryInfo.timezone)}</span>
            {homeCountryWeather && <span className="whitespace-nowrap">{tempUnit === 'C' ? `${homeCountryWeather.celsius}°C` : `${homeCountryWeather.fahrenheit}°F`}</span>}
          </div>
        </div>
      )}

      {/* FEATURED MONEY EXCHANGE ----------------------------------------- */}
      <div className="px-4 pb-3">
        <div className="max-w-md mx-auto">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleQuickAction('Money Exchange')}
            className="w-full rounded-[22px] p-5 relative overflow-hidden flex items-center gap-4 text-left"
            style={{
              background: 'linear-gradient(135deg, #0F9A6B 0%, #0BB572 60%, #16E27A 100%)',
              boxShadow: '0 14px 30px -14px rgba(15,154,107,.5)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-none font-serif italic text-[calc(22px*var(--fs))] text-white"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              $€¥
            </div>
            <div className="flex-1 text-white">
              <div className="text-[calc(21px*var(--fs))] font-bold tracking-tight leading-tight">Money Exchange</div>
              <div className="text-[calc(13px*var(--fs))] opacity-90 mt-1">Compare rates near you</div>
            </div>
            <ChevronRight size={22} color="#fff" strokeWidth={2.2} />
          </motion.button>
        </div>
      </div>

      {/* FEATURE TILES — default 3+4 compact grid; reflows to 2-across the moment
          text is enlarged (twoUp) so the wider boxes keep the full labels whole.
          Words wrap only at spaces (never mid-word); icon + label are packed
          together with a small gap (no large icon↔text space). */}
      {twoUp ? (
        /* ENLARGED: one 2-across grid so there are NO empty holes. The odd 7th
           tile (Weather) spans the full width as a long tile. */
        <div className="px-4 pb-4">
          <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
            <SatTile twoUp cat={CAT.transit} emoji="🚌" label="Transit Info" onClick={() => handleQuickAction('Transportation')} />
            <SatTile twoUp cat={CAT.food} emoji="🍽️" label="Nearby Restaurants" onClick={() => handleQuickAction('Places to Eat')} />
            <SatTile twoUp cat={CAT.coffee} emoji="☕" label="Coffee Shop Finder" onClick={() => handleQuickAction('Coffee')} />
            <SatTile twoUp cat={CAT.atm} emoji="🏧" label="ATM Finder" onClick={() => handleQuickAction('ATM')} />
            <SatTile twoUp cat={CAT.restroom} emoji="🚻" label="Restroom Finder" onClick={() => handleQuickAction('Restroom')} />
            <SatTile twoUp cat={CAT.convenience} emoji="🏪" label="Convenience Store" onClick={() => handleQuickAction('Convenience Store')} />
            <SatTile twoUp wide cat={CAT.weather} emoji="☀️" label="Weather" onClick={() => handleQuickAction('Weather')} />
          </div>
        </div>
      ) : (
        /* DEFAULT: compact 3-on-top + 4-below grid. */
        <>
          <div className="px-4 pb-3">
            <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
              <SatTile cat={CAT.transit} emoji="🚌" label="Transit Info" onClick={() => handleQuickAction('Transportation')} />
              <SatTile cat={CAT.food} emoji="🍽️" label="Nearby Restaurants" onClick={() => handleQuickAction('Places to Eat')} />
              <SatTile cat={CAT.coffee} emoji="☕" label="Coffee Shop Finder" onClick={() => handleQuickAction('Coffee')} />
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="max-w-md mx-auto grid grid-cols-4 gap-3">
              <SatTile small cat={CAT.atm} emoji="🏧" label="ATM Finder" onClick={() => handleQuickAction('ATM')} />
              <SatTile small cat={CAT.restroom} emoji="🚻" label="Restroom Finder" onClick={() => handleQuickAction('Restroom')} />
              <SatTile small cat={CAT.convenience} emoji="🏪" label="Convenience Store" onClick={() => handleQuickAction('Convenience Store')} />
              <SatTile small cat={CAT.weather} emoji="☀️" label="Weather" onClick={() => handleQuickAction('Weather')} />
            </div>
          </div>
        </>
      )}

      {/* EXPLORE MORE — vibrant gradient cards --------------------------- */}
      <div className="px-4 pb-28">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono text-[calc(10.5px*var(--fs))] tracking-[0.16em] uppercase text-[#475569] font-semibold">
              Explore more
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <GradCard
              gradient={`linear-gradient(135deg, ${CAT.todo.ink} 0%, #E84393 60%, #FF7DB1 100%)`}
              emoji="🎟️"
              label="Things to do"
              sub="Sights · tours"
              onClick={() => handleQuickAction('Things to Do')}
            />
            <GradCard
              gradient={`linear-gradient(135deg, ${CAT.shopping.ink} 0%, #A855F7 60%, #C084FC 100%)`}
              emoji="🛍️"
              label="Shopping"
              sub="Markets · malls"
              onClick={() => handleQuickAction('Shopping')}
            />
            <GradCard
              gradient={`linear-gradient(135deg, ${CAT.culture.ink} 0%, #D97706 60%, #FBBF24 100%)`}
              emoji="🏛️"
              label="Cultural Info"
              sub="Museums · sights"
              onClick={() => handleQuickAction('Culture Information')}
            />
            <GradCard
              gradient={`linear-gradient(135deg, ${CAT.phrases.ink} 0%, #CA8A04 60%, #EAB308 100%)`}
              emoji="💬"
              label="Basic Language Phrases"
              sub="50 essentials"
              onClick={() => handleQuickAction('Basic Phrases')}
            />
            <GradCard
              gradient="linear-gradient(135deg, #0F766E 0%, #14B8A6 60%, #2DD4BF 100%)"
              emoji="💲"
              label="Price scanner"
              sub="Convert any price"
              onClick={() => handleQuickAction('Smart Price Scanner')}
            />
            <GradCard
              gradient="linear-gradient(135deg, #6D28D9 0%, #8B5CF6 60%, #A78BFA 100%)"
              emoji="🔤"
              label="Text scanner"
              sub="Menus · signs · labels"
              onClick={() => handleQuickAction('Smart Text Scanner')}
            />
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

      {/* AdMob banner — iOS/Android only (no-op on web). Mount last
          so showBanner runs after the rest of Home has rendered and
          the user has a complete first paint before any ad UI
          appears in the chrome. Gated on onboarding_completed so the
          native banner overlay never shows during the brief Home mount
          that precedes the onboarding redirect (it would otherwise
          linger over the onboarding screens). */}
      {profile?.onboarding_completed && <HomeBanner />}

      <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
    </div>
  );
}

// ── SatTile — saturated category-color tile ────────────────────────────────
// ink bg, white icon chip, ONE-LINE label, decorative circle off the top-right.
// aspect-square keeps the chunky look; the box grows proportionally as the
// auto-fit grid reflows to fewer/wider columns at larger font sizes — so the
// label never wraps and never clips (the box always widens to fit it).
function SatTile({ cat, icon: Icon, emoji, label, onClick, small = false, twoUp = false, wide = false }) {
  // `compact` = the narrow 4-across tile shown at the default text size. When the
  // user enlarges text the grid reflows to 2-across (twoUp): the boxes get WIDER,
  // so the same labels stay whole at a bigger, --fs-scaled font. Icon + label are
  // packed at the top with a small gap (no big icon↔text space). Font sizes are
  // chosen so the longest word fits the box width on ONE line — never mid-word.
  // `wide` makes the tile span both columns (the long Weather tile in the 2-up
  // layout) so there are no empty holes.
  const compact = small && !twoUp;
  const iconBox = compact ? 30 : 38;
  const fontSize = twoUp ? 'calc(13px * var(--fs))' : (compact ? '11px' : '12.5px');
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[18px] text-white text-left min-w-0"
      style={{
        background: cat.ink,
        gridColumn: wide ? 'span 2' : undefined,
        minHeight: twoUp ? 92 : (compact ? 88 : 100),
        padding: compact ? 11 : 14,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: compact ? 6 : 8,
        boxShadow: `0 10px 22px -12px ${cat.ink}80`,
      }}
    >
      <div
        className="absolute -top-3 -right-3 rounded-full pointer-events-none"
        style={{ width: 70, height: 70, background: 'rgba(255,255,255,0.12)' }}
      />
      <div
        className="flex items-center justify-center relative flex-none"
        style={{ width: iconBox, height: iconBox, borderRadius: compact ? 10 : 12, background: 'rgba(255,255,255,0.2)' }}
      >
        {emoji ? (
          <span style={{ fontSize: compact ? 17 : 21, lineHeight: 1 }}>{emoji}</span>
        ) : (
          <Icon size={compact ? 16 : 20} color="#fff" strokeWidth={2} />
        )}
      </div>
      {/* break-normal = words wrap ONLY at spaces, never split mid-word. The font
          is sized to fit the longest word, so nothing overflows or clips. */}
      <div
        className="font-bold tracking-tight relative leading-tight break-normal"
        style={{ fontSize }}
      >
        {label}
      </div>
    </motion.button>
  );
}

// ── GradCard — vibrant gradient feature card (Explore More section) ────────
// Per spec: gradient bg, 1.3:1 aspect, decorative shape + optional glyph,
// icon chip top-left, two-line label bottom-left. Optional `badge` pill
// (top-right) for status callouts like "Soon".
function GradCard({ gradient, emoji, label, sub, badge, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[18px] text-white text-left p-3.5"
      style={{
        background: gradient,
        // Cap height growth (~1 step) so the Explore cards don't balloon as text
        // enlarges. The emoji chip sits in the UPPER-LEFT (the only glyph on the
        // card); the label grows downward from the bottom-left.
        minHeight: 'calc(132px * min(var(--fs), 1.15))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 12px 26px -12px rgba(15,20,25,0.4)',
      }}
    >
      <div
        className="absolute -top-2.5 -right-2.5 rounded-full pointer-events-none"
        style={{ width: 70, height: 70, background: 'rgba(255,255,255,0.14)' }}
      />
      {badge && (
        <span
          className="absolute top-2.5 right-2.5 font-mono font-bold uppercase tracking-[0.12em] text-[calc(9px*var(--fs))] px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', backdropFilter: 'blur(6px)' }}
        >
          {badge}
        </span>
      )}
      {/* EMOJI chip — upper-left. The ONLY icon on the card (no glyph by the label). */}
      <div
        className="relative flex items-center justify-center flex-none"
        style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,0.22)' }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
      </div>
      {/* TEXT — lower-left. */}
      <div className="relative" style={{ paddingRight: 26 }}>
        <div className="font-extrabold text-[calc(16px*var(--fs))] tracking-tight leading-tight">{label}</div>
        {sub && <div className="text-[calc(11.5px*var(--fs))] opacity-90 mt-0.5">{sub}</div>}
      </div>
    </motion.button>
  );
}
