import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Cloud, Utensils, Coffee as CoffeeIcon, CreditCard, Bath, Store, CloudSun, Bus, ChevronRight, Star, ShoppingBag, Compass, Languages, ScanLine, MessageSquare } from "lucide-react";
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

// Country name → ISO-2 code for flagcdn URLs.
const COUNTRY_CODES = {
  'United States': 'US', 'Philippines': 'PH', 'Japan': 'JP', 'South Korea': 'KR',
  'Thailand': 'TH', 'Vietnam': 'VN', 'Singapore': 'SG', 'Malaysia': 'MY',
  'Indonesia': 'ID', 'Australia': 'AU', 'United Kingdom': 'GB', 'France': 'FR',
  'Germany': 'DE', 'Italy': 'IT', 'Spain': 'ES', 'Mexico': 'MX', 'Brazil': 'BR',
  'India': 'IN', 'China': 'CN', 'Canada': 'CA',
};

export default function HomePage() {
  const navigate = useNavigate();
  const { locationMode, selectedLocation, currentGpsLocation, getActiveLocation, loading: locationLoading } = useLocation();
  const { profile, user: authUser } = useAuth();

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
        show_home_flag: false,
        show_home_country_info: false,
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
      if (userData.show_home_flag && userData.home_country) {
        const homeCode = COUNTRY_CODES[userData.home_country];
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
  };

  const loadWeatherData = async (latitude, longitude) => {
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
            condition: { type: "string" },
          },
        },
        add_context_from_internet: true,
      });
      setTimezone(locationData.timezone || 'UTC');

      // Guard against incomplete LLM responses. We saw "NaN°F" on first
      // onboard — root cause is that the InvokeLLM weather call sometimes
      // returns a JSON object missing temperature_celsius /
      // temperature_fahrenheit (or with a string like "unknown"), and
      // Math.round(undefined) === NaN flows straight to the render.
      // Coerce to Number, gate on Number.isFinite, fall back to null so
      // the render shows the existing "—°" placeholder instead.
      const c = Number(locationData.temperature_celsius);
      const f = Number(locationData.temperature_fahrenheit);
      if (Number.isFinite(c) && Number.isFinite(f)) {
        setWeatherInfo({
          celsius: Math.round(c),
          fahrenheit: Math.round(f),
          condition: locationData.condition,
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
          {/* Home country flag overlay (when user has show_home_country_info on).
              Soft-tinted so the foreground text + chips stay legible. The bolder
              landscape-flag treatment from the Claude-design Medium variant is
              still TBD -- intentionally keeping the existing soft look until
              users see Phase 1 land. */}
          {showHomeFlag && homeFlagUrl && (
            <>
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${homeFlagUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: 0.5,
                  filter: 'saturate(1.3) contrast(1.05)',
                }}
              />
              <div
                className="absolute inset-0 z-[1]"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,252,247,0.62) 0%, rgba(255,252,247,0.82) 100%)',
                }}
              />
            </>
          )}

          <div className="relative z-10 p-5">
            {/* Hello row */}
            <p className="text-[14px] text-[#475569] flex items-center gap-1.5 leading-none">
              <span>Hello 👋</span>
              {localGreeting && (
                <span className="font-serif italic text-[#3A3128]">
                  {localGreeting.charAt(0).toUpperCase() + localGreeting.slice(1)}
                </span>
              )}
            </p>

            {/* Name, in <City> */}
            <h1 className="mt-2 text-[30px] font-extrabold tracking-tight leading-none text-[#0F1419]">
              {getFirstName()}
              {cityName && (
                <>
                  <span>, in </span>
                  <span className="font-serif italic font-normal" style={{ color: TEAL_DEEP }}>
                    {cityName}
                  </span>
                </>
              )}
            </h1>

            {/* Location chip */}
            <button
              onClick={() => setShowLocationPicker(true)}
              className="mt-4 w-full px-3.5 py-2.5 rounded-[14px] flex items-center gap-2.5 transition-colors hover:bg-[#EFE8D6]"
              style={{ background: '#F7F4EC' }}
            >
              <MapPin size={18} color={TEAL_DEEP} strokeWidth={2} />
              <div className="flex-1 text-left">
                <p className="text-[14.5px] font-semibold text-[#0F1419] leading-tight truncate">
                  {placeText}
                </p>
                <p className="text-[11.5px] font-medium leading-none mt-1 underline underline-offset-2" style={{ color: TEAL_DEEP }}>
                  Change location
                </p>
              </div>
            </button>

            {/* Date / Time / Weather row */}
            <div
              className="mt-2.5 px-3.5 py-2.5 rounded-[14px] flex items-center justify-between text-[13.5px] font-semibold text-[#0F1419]"
              style={{ background: '#F7F4EC' }}
            >
              <span>{formatLocalDate(currentTime, timezone)}</span>
              <span>{formatLocalTime(currentTime, timezone)}</span>
              {/* Defense-in-depth NaN guard. setWeatherInfo already
                  refuses non-finite values, but if a stale object ever
                  reaches this branch we'd render 'NaN°F' — better to
                  show the em-dash placeholder than the bug. */}
              {weatherInfo && Number.isFinite(weatherInfo.celsius) && Number.isFinite(weatherInfo.fahrenheit) ? (
                <button onClick={toggleTempUnit} className="flex items-center gap-1.5">
                  <Cloud size={16} color={TEAL_DEEP} strokeWidth={2} />
                  <span>{tempUnit === 'C' ? `${weatherInfo.celsius}°C` : `${weatherInfo.fahrenheit}°F`}</span>
                </button>
              ) : (
                <span className="opacity-50">—°</span>
              )}
            </div>

            {/* Home country time chip (only when traveling) */}
            {shouldShowHomeCountryTime && homeCountryInfo && (
              <div
                className="mt-2.5 px-3.5 py-2 rounded-[12px] text-[12px] text-[#3A3128]"
                style={{ background: 'rgba(15,124,115,0.08)' }}
              >
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase opacity-70 mb-0.5">
                  Home · {homeCountryInfo.country}
                </p>
                <div className="flex items-center justify-between font-semibold">
                  <span>{formatLocalDate(homeCountryTime, homeCountryInfo.timezone)}</span>
                  <span>{formatLocalTime(homeCountryTime, homeCountryInfo.timezone)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-none font-serif italic text-[22px] text-white"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              $€¥
            </div>
            <div className="flex-1 text-white">
              <div className="text-[21px] font-bold tracking-tight leading-tight">Money Exchange</div>
              <div className="text-[13px] opacity-90 mt-1">Compare rates near you</div>
            </div>
            <ChevronRight size={22} color="#fff" strokeWidth={2.2} />
          </motion.button>
        </div>
      </div>

      {/* 3-COL FEATURE TIER (Transit / Food / Coffee) -------------------- */}
      <div className="px-4 pb-2.5">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2.5">
          <SatTile cat={CAT.transit} icon={Bus} label="Transit Info" onClick={() => handleQuickAction('Transportation')} />
          <SatTile cat={CAT.food} icon={Utensils} label="Places to eat" onClick={() => handleQuickAction('Places to Eat')} />
          <SatTile cat={CAT.coffee} icon={CoffeeIcon} label="Coffee" onClick={() => handleQuickAction('Coffee')} />
        </div>
      </div>

      {/* 4-COL SECONDARY TIER (ATM / Restroom / 24h / Weather) ----------- */}
      <div className="px-4 pb-4">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-2.5">
          <SatTile small cat={CAT.atm} icon={CreditCard} label="ATM" onClick={() => handleQuickAction('ATM')} />
          <SatTile small cat={CAT.restroom} icon={Bath} label="Restroom" onClick={() => handleQuickAction('Restroom')} />
          <SatTile small cat={CAT.convenience} icon={Store} label="Convenience store" onClick={() => handleQuickAction('Convenience Store')} />
          <SatTile small cat={CAT.weather} icon={CloudSun} label="Weather" onClick={() => handleQuickAction('Weather')} />
        </div>
      </div>

      {/* EXPLORE MORE — vibrant gradient cards --------------------------- */}
      <div className="px-4 pb-28">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-[#475569] font-semibold">
              Explore more
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <GradCard
              gradient={`linear-gradient(135deg, ${CAT.todo.ink} 0%, #E84393 60%, #FF7DB1 100%)`}
              icon={Star}
              label="Things to do"
              decoration="✦"
              onClick={() => handleQuickAction('Things to Do')}
            />
            <GradCard
              gradient={`linear-gradient(135deg, ${CAT.shopping.ink} 0%, #A855F7 60%, #C084FC 100%)`}
              icon={ShoppingBag}
              label="Shopping"
              sub="Markets · malls"
              onClick={() => handleQuickAction('Shopping')}
            />
            <GradCard
              gradient={`linear-gradient(135deg, ${CAT.culture.ink} 0%, #D97706 60%, #FBBF24 100%)`}
              icon={Compass}
              label="Cultural Info"
              sub="Museums · sights"
              onClick={() => handleQuickAction('Culture Information')}
            />
            <GradCard
              gradient={`linear-gradient(135deg, ${CAT.phrases.ink} 0%, #CA8A04 60%, #EAB308 100%)`}
              icon={Languages}
              label="Basic Language Phrases"
              sub="50 essentials"
              decoration="あ"
              decorationSerif
              onClick={() => handleQuickAction('Basic Phrases')}
            />
            <GradCard
              gradient="linear-gradient(135deg, #0F766E 0%, #14B8A6 60%, #2DD4BF 100%)"
              icon={ScanLine}
              label="Price scanner"
              sub="Convert any price"
              onClick={() => handleQuickAction('Smart Price Scanner')}
            />
            <GradCard
              gradient="linear-gradient(135deg, #6D28D9 0%, #8B5CF6 60%, #A78BFA 100%)"
              icon={MessageSquare}
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
          appears in the chrome. */}
      <HomeBanner />

      <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
    </div>
  );
}

// ── SatTile — saturated category-color tile ────────────────────────────────
// Per Claude-design spec: ink bg, white icon chip on rgba(255,255,255,.18),
// label bottom-left, decorative white circle bleeding off top-right corner.
function SatTile({ cat, icon: Icon, label, onClick, small = false }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[18px] text-white text-left"
      style={{
        background: cat.ink,
        aspectRatio: '1 / 1',
        padding: small ? 11 : 14,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: `0 10px 22px -12px ${cat.ink}80`,
      }}
    >
      <div
        className="absolute -top-3 -right-3 rounded-full pointer-events-none"
        style={{ width: 70, height: 70, background: 'rgba(255,255,255,0.12)' }}
      />
      <div
        className="flex items-center justify-center relative"
        style={{
          width: small ? 30 : 38,
          height: small ? 30 : 38,
          borderRadius: small ? 10 : 12,
          background: 'rgba(255,255,255,0.2)',
        }}
      >
        <Icon size={small ? 16 : 20} color="#fff" strokeWidth={2} />
      </div>
      <div
        className="font-bold tracking-tight relative leading-tight"
        style={{ fontSize: small ? 11.5 : 14.5 }}
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
function GradCard({ gradient, icon: Icon, label, sub, decoration, decorationSerif = false, badge, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-[18px] text-white text-left p-3.5"
      style={{
        background: gradient,
        aspectRatio: '1.3 / 1',
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
      {decoration && (
        <div
          className={`absolute pointer-events-none opacity-70 ${decorationSerif ? 'font-serif italic' : ''}`}
          style={{ top: decorationSerif ? 12 : 22, right: decorationSerif ? 14 : 28, fontSize: decorationSerif ? 30 : 22, color: '#fff' }}
        >
          {decoration}
        </div>
      )}
      {badge && (
        <span
          className="absolute top-2.5 right-2.5 font-mono font-bold uppercase tracking-[0.12em] text-[9px] px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', backdropFilter: 'blur(6px)' }}
        >
          {badge}
        </span>
      )}
      {/* TEXT — upper-left. paddingRight keeps long labels clear of the
          decorative circle / accent glyph in the top-right corner. */}
      <div className="relative" style={{ paddingRight: 26 }}>
        <div className="font-extrabold text-[16px] tracking-tight leading-tight">{label}</div>
        {sub && <div className="text-[11.5px] opacity-90 mt-0.5">{sub}</div>}
      </div>
      {/* ICON — moved to the bottom-right to balance the text now at top-left. */}
      <div className="relative flex justify-end">
        <div
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,0.22)' }}
        >
          <Icon size={18} color="#fff" strokeWidth={2} />
        </div>
      </div>
    </motion.button>
  );
}
