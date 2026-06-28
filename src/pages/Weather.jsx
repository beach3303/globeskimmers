import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Loader2, Cloud, MapPin, ChevronDown, ChevronUp, Clock, ChevronLeft, CloudSun } from "lucide-react";
import { CAT, TEAL_DEEP, IVORY, SHADOW_CARD_SOFT } from "@/components/redesign/constants";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import RefreshButton from "@/components/RefreshButton";
import { useIsTablet } from "@/lib/useIsTablet";

// Editorial design tokens (design handoff: "Weather · iPad"). Mirrors the
// shipped PlacesToEat / CultureInformation editorial system. Now rendered at
// BOTH widths — tablet keeps the large handoff sizes, phone gets the same
// editorial layout phone-tuned (sizes branch on the `isTablet` prop).
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#F7F4EC", ED_RULE = "rgba(22,17,13,.10)";
// Text-scaling helper — respects the app-wide --fs variable with a safe 1 fallback.
const fs = (n) => `calc(${n}px*var(--fs,1))`;

// Weather icon mapping
const getWeatherIcon = (condition, code) => {
  if (!condition) return '🌡️';
  const lowerCondition = condition.toLowerCase();
  
  if (lowerCondition.includes('thunder') || lowerCondition.includes('storm')) return '⛈️';
  if (lowerCondition.includes('heavy rain') || lowerCondition.includes('violent')) return '🌧️';
  if (lowerCondition.includes('rain') || lowerCondition.includes('shower') || lowerCondition.includes('drizzle')) return '🌦️';
  if (lowerCondition.includes('snow') || lowerCondition.includes('freezing')) return '❄️';
  if (lowerCondition.includes('fog') || lowerCondition.includes('mist')) return '🌫️';
  if (lowerCondition.includes('overcast')) return '☁️';
  if (lowerCondition.includes('partly') || lowerCondition.includes('mainly')) return '⛅';
  if (lowerCondition.includes('clear') || lowerCondition.includes('sunny')) return '☀️';
  if (lowerCondition.includes('cloud')) return '🌤️';
  if (lowerCondition.includes('wind')) return '💨';
  
  return '🌤️';
};

// ─── EDITORIAL PRESENTATION (phone + tablet) ────────────────────────────────
// Pure presentation. No data fetching/state/handlers live here — they receive
// already-shaped values from WeatherPage so the data layer stays untouched.
const WEATHER_INK = CAT.weather.ink; // #D4861A amber accent

// Mono UPPERCASE eyebrow used to label sections (HOURLY / 7-DAY / DETAILS).
// Phone-tuned down a touch (fs 10) vs tablet (fs 10.5) per the app-wide scale.
const EdKicker = ({ children, isTablet = true }) => (
  <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(isTablet ? 10.5 : 10), letterSpacing: ".14em", margin: 0 }}>
    {children}
  </p>
);

// Big serif current-conditions hero (handoff temperature treatment).
// Tablet keeps the large handoff sizes; phone (!isTablet) gets a compact,
// phone-tuned version of the very same editorial layout (no old phone markup).
function EdCurrentHero({ current, forecast, displayScale, placeLabel, dateLabel, isTablet = true }) {
  const isC = displayScale === 'celsius';
  const temp = isC ? current.temperature_celsius : current.temperature_fahrenheit;
  const feels = isC ? current.feels_like_celsius : current.feels_like_fahrenheit;
  const wind = isC ? current.wind_speed_kmh : current.wind_speed_mph;
  const low = isC ? forecast[0]?.low_celsius : forecast[0]?.low_fahrenheit;
  const detail = [
    { k: 'Humidity', v: `${current.humidity}%` },
    { k: 'Wind', v: `${wind}${isC ? ' km/h' : ' mph'}` },
    { k: 'UV Index', v: current.uv_index },
    { k: 'Low', v: low != null ? `${low}°` : '—' },
  ];
  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: isTablet ? 24 : 20,
        background: "linear-gradient(155deg, #E9A23B 0%, #E5733F 52%, #D94E55 100%)",
        boxShadow: "0 20px 44px -20px rgba(217,84,76,.55)",
      }}
    >
      <div style={{ padding: isTablet ? "30px 34px" : "22px 22px" }}>
        <p className="uppercase" style={{ color: "rgba(255,255,255,.8)", fontFamily: ED_MONO, fontSize: fs(isTablet ? 10.5 : 10), letterSpacing: ".14em", margin: 0 }}>Now</p>
        {placeLabel && (
          <p className="flex items-center gap-1.5" style={{ color: "#FFFFFF", fontSize: fs(13.5), marginTop: fs(6) }}>
            <MapPin size={13} color="#FFFFFF" strokeWidth={2} />{placeLabel}
          </p>
        )}
        <div className="flex items-start justify-between" style={{ marginTop: fs(14), gap: fs(isTablet ? 20 : 14) }}>
          <div className="min-w-0">
            <div className="leading-none" style={{ color: "#FFFFFF", fontFamily: ED_SERIF, fontSize: fs(isTablet ? 96 : 64), letterSpacing: "-0.02em" }}>
              {temp}<span style={{ fontSize: fs(isTablet ? 44 : 30), color: "rgba(255,255,255,.82)" }}>°{isC ? 'C' : 'F'}</span>
            </div>
            <p style={{ color: "#FFFFFF", fontSize: fs(isTablet ? 20 : 18), fontFamily: ED_SERIF, marginTop: fs(4) }}>{current.condition}</p>
            <p style={{ color: "rgba(255,255,255,.85)", fontSize: fs(13.5), marginTop: fs(2) }}>
              Feels like {feels}°{isC ? 'C' : 'F'}
            </p>
            {dateLabel && (
              <p className="uppercase" style={{ color: "rgba(255,255,255,.7)", fontFamily: ED_MONO, fontSize: fs(isTablet ? 10.5 : 10), letterSpacing: ".1em", marginTop: fs(10) }}>{dateLabel}</p>
            )}
          </div>
          <div className="shrink-0" style={{ fontSize: fs(isTablet ? 84 : 56), lineHeight: 1 }}>{current.icon || getWeatherIcon(current.condition)}</div>
        </div>
        <div className="grid grid-cols-4" style={{ marginTop: fs(isTablet ? 24 : 18), paddingTop: fs(isTablet ? 20 : 16), borderTop: "1px solid rgba(255,255,255,.28)", gap: fs(isTablet ? 16 : 10) }}>
          {detail.map((d) => (
            <div key={d.k}>
              <p className="uppercase" style={{ color: "rgba(255,255,255,.72)", fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".1em", margin: 0 }}>{d.k}</p>
              <p className="font-semibold" style={{ color: "#FFFFFF", fontSize: fs(isTablet ? 20 : 18), fontFamily: ED_SERIF, marginTop: fs(3) }}>{d.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// One day in the 7-day list — soft white rounded card with hairline rule,
// expandable into a scrollable hourly strip + DETAILS block. Tablet keeps the
// large handoff sizes; phone (!isTablet) renders the same card, phone-tuned.
function EdForecastDay({ day, index, expanded, onToggle, displayScale, weekRange, isTablet = true }) {
  const isC = displayScale === 'celsius';
  const high = isC ? day.high_celsius : day.high_fahrenheit;
  const low = isC ? day.low_celsius : day.low_fahrenheit;
  // Temp-range bar geometry (Apple Weather-style). Position this day's
  // low→high segment within the whole-week min→max scale. Guard the
  // single-value week so the segment fills the track instead of dividing by 0.
  const wMin = weekRange?.min, wMax = weekRange?.max;
  const span = (wMax != null && wMin != null) ? (wMax - wMin) : 0;
  const segLeft = span > 0 ? ((low - wMin) / span) * 100 : 0;
  const segWidth = span > 0 ? Math.max(12, ((high - low) / span) * 100) : 100;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white overflow-hidden"
      style={{ borderRadius: isTablet ? 20 : 18, boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}
    >
      <button onClick={() => onToggle(index)} className="w-full text-left" style={{ padding: isTablet ? "18px 22px" : "15px 18px" }}>
        <div className="flex items-center justify-between" style={{ gap: fs(isTablet ? 16 : 12) }}>
          <div className="flex items-center min-w-0" style={{ gap: fs(isTablet ? 16 : 12) }}>
            <div className="shrink-0" style={{ fontSize: fs(isTablet ? 40 : 30), lineHeight: 1 }}>{day.icon || getWeatherIcon(day.condition)}</div>
            <div className="min-w-0">
              <h3 className="leading-tight" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(isTablet ? 24 : 21), display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: fs(isTablet ? 27 : 24) }}>
                {day.is_today ? 'Today' : day.day_of_week}
              </h3>
              <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".08em", marginTop: fs(2) }}>
                {day.is_today ? day.day_of_week : day.date}
              </p>
              <p className="truncate" style={{ color: ED_INK3, fontSize: fs(12.5), marginTop: fs(2) }}>{day.condition}</p>
            </div>
          </div>
          <div className="flex items-center shrink-0" style={{ gap: fs(isTablet ? 12 : 8) }}>
            <span className="text-right" style={{ color: ED_INK3, fontFamily: ED_SERIF, fontSize: fs(isTablet ? 20 : 18) }}>{low}°</span>
            <div style={{ width: fs(isTablet ? 72 : 64), height: fs(6), borderRadius: 999, background: "rgba(22,17,13,.08)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${segLeft}%`, width: `${segWidth}%`, borderRadius: 999, background: "linear-gradient(90deg,#5AA9E6 0%, #F2B33D 55%, #E5733F 100%)" }} />
            </div>
            <span style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(isTablet ? 30 : 26) }}>{high}°</span>
            <div style={{ color: WEATHER_INK }}>
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: fs(isTablet ? 18 : 14), marginTop: fs(12) }}>
          <span style={{ color: ED_INK2, fontSize: fs(12.5) }}>💧 <b style={{ color: ED_INK }}>{day.precipitation_probability}%</b></span>
          <span style={{ color: ED_INK2, fontSize: fs(12.5) }}>💨 <b style={{ color: ED_INK }}>{isC ? `${day.wind_speed_kmh} km/h` : `${day.wind_speed_mph} mph`}</b></span>
          <span style={{ color: ED_INK2, fontSize: fs(12.5) }}>☀️ <b style={{ color: WEATHER_INK }}>UV {day.uv_index}</b></span>
          {day.sunrise && <span style={{ color: ED_INK2, fontSize: fs(12.5) }}>🌅 <b style={{ color: ED_INK }}>{day.sunrise}</b></span>}
        </div>
      </button>

      <AnimatePresence>
        {expanded && day.hourly && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div style={{ padding: isTablet ? "16px 22px 22px" : "14px 18px 18px", borderTop: `1px solid ${ED_RULE}` }}>
              <div className="flex items-center" style={{ gap: fs(6), marginBottom: fs(12) }}>
                <Clock className="w-3.5 h-3.5" style={{ color: WEATHER_INK }} />
                <EdKicker isTablet={isTablet}>Hourly</EdKicker>
              </div>
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex pb-1" style={{ gap: fs(10), minWidth: "max-content" }}>
                  {day.hourly.map((hour, hIndex) => (
                    <div key={hIndex} className="flex-shrink-0 text-center rounded-[14px]" style={{ width: fs(isTablet ? 72 : 64), padding: fs(isTablet ? 12 : 10), background: ED_IVORY2, border: `1px solid ${ED_RULE}` }}>
                      <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", margin: 0 }}>{hour.time}</p>
                      <div style={{ fontSize: fs(22), margin: `${fs(6)} 0` }}>{hour.icon || getWeatherIcon(hour.condition)}</div>
                      <p className="font-semibold" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(17) }}>
                        {isC ? hour.temperature_celsius : hour.temperature_fahrenheit}°
                      </p>
                      {hour.precipitation_probability > 0 && (
                        <p style={{ color: WEATHER_INK, fontSize: fs(10), fontWeight: 600, marginTop: fs(2) }}>💧{hour.precipitation_probability}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {(day.sunrise || day.sunset) && (
                <div className="flex" style={{ marginTop: fs(16), gap: fs(12) }}>
                  {day.sunrise && (
                    <div className="flex-1 flex items-center" style={{ gap: fs(10), background: "rgba(212,134,26,.10)", border: "1px solid rgba(212,134,26,.18)", borderRadius: 14, padding: fs(12) }}>
                      <span style={{ fontSize: fs(20) }}>🌅</span>
                      <div className="min-w-0">
                        <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", margin: 0 }}>Sunrise</p>
                        <p className="font-bold" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(15), marginTop: fs(2) }}>{day.sunrise}</p>
                      </div>
                    </div>
                  )}
                  {day.sunset && (
                    <div className="flex-1 flex items-center" style={{ gap: fs(10), background: "rgba(212,134,26,.10)", border: "1px solid rgba(212,134,26,.18)", borderRadius: 14, padding: fs(12) }}>
                      <span style={{ fontSize: fs(20) }}>🌇</span>
                      <div className="min-w-0">
                        <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", margin: 0 }}>Sunset</p>
                        <p className="font-bold" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(15), marginTop: fs(2) }}>{day.sunset}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function WeatherPage() {
  const navigate = useNavigate();
  const { activeLocation, locationMode, initialized } = useLocation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (!activeLocation?.coordinates || refreshing) return;
    setRefreshing(true);
    try { await loadWeatherData(activeLocation, true); }
    finally { setRefreshing(false); }
  };
  const [user, setUser] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [displayScale, setDisplayScale] = useState('fahrenheit');
  const [error, setError] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (initialized && activeLocation?.coordinates) {
      loadWeatherData(activeLocation);
    }
  }, [activeLocation, initialized]);

  const loadUser = async () => {
    try {
      const isAuthenticated = await base44.auth.isAuthenticated();
      
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      const userData = await base44.auth.me();
      setUser(userData);
      
      const preferredScale = userData.preferred_temperature_scale || 'fahrenheit';
      setDisplayScale(preferredScale);

      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
    }
  };

  const loadWeatherData = async (location, forceRefresh = false) => {
    setError(null);
    try {
      const { data, error } = await callWorker(ROUTE.getWeatherForecast, {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
        forceRefresh,
      });

      if (error || !data || data.error) {
        throw new Error(error || data?.error || 'Weather unavailable');
      }

      setWeatherData(data);
    } catch (error) {
      console.error("Error loading weather:", error);
      setError("Unable to load weather data. Please try again.");
    }
  };

  const toggleDayExpansion = (index) => {
    setExpandedDay(expandedDay === index ? null : index);
  };

  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";

  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#E3F2FD] to-[#BBDEFB] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#1976D2] animate-spin mx-auto mb-4" />
          <p className="text-[#0D47A1] font-semibold">Loading weather...</p>
        </div>
      </div>
    );
  }

  const isLoading = !activeLocation?.coordinates || !weatherData;
  const current = weatherData?.current;
  const forecast = weatherData?.forecast || [];

  // Whole-week temperature range (in the active scale) — shared across all day
  // rows so each temp-range bar is positioned on one common min→max axis.
  const isC = displayScale === 'celsius';
  const weekLows = forecast.map((d) => (isC ? d.low_celsius : d.low_fahrenheit)).filter((v) => v != null);
  const weekHighs = forecast.map((d) => (isC ? d.high_celsius : d.high_fahrenheit)).filter((v) => v != null);
  const weekRange = (weekLows.length && weekHighs.length)
    ? { min: Math.min(...weekLows), max: Math.max(...weekHighs) }
    : null;

  return (
    <div className="min-h-screen font-sans" style={{ background: IVORY }}>
      {/* HEADER — redesign pattern */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={() => navigate(createPageUrl("Home"))} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]" style={{ background:'#FFFFFF', border:'1px solid #F0E9DC' }} aria-label="Back">
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]" style={{ background: CAT.weather.bg, color: CAT.weather.ink }}>
            <CloudSun size={13} color={CAT.weather.ink} strokeWidth={2} />
            Weather
          </div>
          <RefreshButton onClick={handleRefresh} isRefreshing={refreshing} tone="light" title="Refresh weather" />
        </div>
      </div>

      <div className={`${colWrap} mx-auto px-4`}>
        {/* LOCATION CARD */}
        <button onClick={() => setShowLocationPicker(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] text-left mb-3 transition-transform active:scale-[0.99]" style={{ background:'#FFFFFF', border:'1px solid #F0E9DC', boxShadow:'0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)' }}>
          <MapPin size={18} color={TEAL_DEEP} strokeWidth={2} className="flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color:'#94A3B8' }}>
              📍 Location
            </div>
            <div className="font-bold text-[calc(14.5px*var(--fs))] text-[#0F1419] mt-0.5 truncate">
              {locationMode === 'current'
                ? (activeLocation?.placeName || activeLocation?.address?.city || 'Current Location')
                : (activeLocation?.placeName || activeLocation?.address?.formatted || 'Select Location')}
            </div>
          </div>
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: CAT.weather.bg, color: CAT.weather.ink }}>
            Change
          </span>
        </button>

        {/* Temperature Scale Toggle */}
        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-1 rounded-full p-1" style={{ background:'#FFFFFF', border:'1px solid rgba(22,17,13,.10)' }}>
            <button onClick={() => setDisplayScale('fahrenheit')} className="px-4 py-1.5 rounded-full text-xs font-bold transition-colors" style={{ background: displayScale === 'fahrenheit' ? CAT.weather.ink : 'transparent', color: displayScale === 'fahrenheit' ? '#FFFFFF' : '#736657' }}>°F</button>
            <button onClick={() => setDisplayScale('celsius')} className="px-4 py-1.5 rounded-full text-xs font-bold transition-colors" style={{ background: displayScale === 'celsius' ? CAT.weather.ink : 'transparent', color: displayScale === 'celsius' ? '#FFFFFF' : '#736657' }}>°C</button>
          </div>
        </div>
      </div>

      {/* ── EDITORIAL CONTENT COLUMN (phone + tablet) ──
          Same editorial layout at both widths; phone (!isTablet) uses the
          single max-w-md column with phone-tuned sizing, tablet uses 1024px. */}
      <div style={{ maxWidth: isTablet ? 1024 : 448, margin: "0 auto", padding: isTablet ? "0 24px 170px" : "0 20px 170px", display: "flex", flexDirection: "column", gap: fs(isTablet ? 30 : 22) }}>
        {error && (
          <div className="bg-white" style={{ borderRadius: isTablet ? 22 : 18, padding: isTablet ? "26px 30px" : "22px 22px", boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}>
            <div className="flex items-start" style={{ gap: fs(14) }}>
              <div style={{ fontSize: fs(isTablet ? 28 : 24) }}>⚠️</div>
              <div className="flex-1">
                <p className="font-bold" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(isTablet ? 22 : 20), marginBottom: fs(6) }}>Weather Data Unavailable</p>
                <p style={{ color: ED_INK2, fontSize: fs(13.5), marginBottom: fs(16) }}>{error}</p>
                <button
                  onClick={() => { setError(null); if (activeLocation?.coordinates) { loadWeatherData(activeLocation); } }}
                  className="rounded-full font-bold text-white transition-transform active:scale-[0.98]"
                  style={{ padding: "10px 20px", background: WEATHER_INK, fontSize: fs(13.5) }}
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {!error && current && (
          <EdCurrentHero
            current={current}
            forecast={forecast}
            displayScale={displayScale}
            isTablet={isTablet}
            placeLabel={locationMode === 'navigate' ? activeLocation?.placeName : activeLocation?.address?.city}
            dateLabel={`Today · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
          />
        )}

        {!error && (
          <div>
            <div className="flex items-end justify-between" style={{ marginBottom: fs(16) }}>
              <div>
                <EdKicker isTablet={isTablet}>7-Day</EdKicker>
                <h2 className="leading-none" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(isTablet ? 34 : 28), marginTop: fs(4) }}>Forecast</h2>
              </div>
              <p className="uppercase" style={{ color: WEATHER_INK, fontFamily: ED_MONO, fontSize: fs(isTablet ? 10.5 : 10), letterSpacing: ".1em" }}>Tap for hourly</p>
            </div>

            {isLoading ? (
              <div className="bg-white flex flex-col items-center justify-center" style={{ borderRadius: isTablet ? 22 : 18, padding: fs(isTablet ? 56 : 40), boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}>
                <Loader2 className="animate-spin" style={{ width: fs(36), height: fs(36), color: WEATHER_INK, marginBottom: fs(12) }} />
                <p style={{ color: ED_INK3, fontSize: fs(13.5) }}>Fetching weather data…</p>
              </div>
            ) : forecast.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: fs(12) }}>
                {forecast.map((day, index) => (
                  <EdForecastDay
                    key={index}
                    day={day}
                    index={index}
                    expanded={expandedDay === index}
                    onToggle={toggleDayExpansion}
                    displayScale={displayScale}
                    weekRange={weekRange}
                    isTablet={isTablet}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white text-center" style={{ borderRadius: isTablet ? 22 : 18, padding: fs(isTablet ? 44 : 32), boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}>
                <Cloud style={{ width: fs(56), height: fs(56), color: ED_INK3, margin: `0 auto ${fs(12)}` }} />
                <p style={{ color: ED_INK2, fontSize: fs(15), marginBottom: fs(4) }}>No weather data available</p>
                <p style={{ color: ED_INK3, fontSize: fs(13) }}>Unable to fetch forecast</p>
              </div>
            )}
          </div>
        )}
      </div>

      <LocationModePicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      />
    </div>
  );
}