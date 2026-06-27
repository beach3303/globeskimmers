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

// iPad editorial design tokens (design handoff: "Weather · iPad"). Mirrors the
// shipped PlacesToEat / CultureInformation editorial system. Phone layout never
// touches these — every tablet branch is gated behind useIsTablet().
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

// ─── iPad EDITORIAL PRESENTATION (tablet-only) ──────────────────────────────
// Pure presentation. No data fetching/state/handlers live here — they receive
// already-shaped values from WeatherPage so the data layer stays untouched.
const WEATHER_INK = CAT.weather.ink; // #D4861A amber accent

// Mono UPPERCASE eyebrow used to label sections (HOURLY / 7-DAY / DETAILS).
const EdKicker = ({ children }) => (
  <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".14em", margin: 0 }}>
    {children}
  </p>
);

// Big serif current-conditions hero (handoff temperature treatment).
function EdCurrentHero({ current, forecast, displayScale, placeLabel, dateLabel }) {
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
    <div className="bg-white rounded-[24px] overflow-hidden" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}>
      <div style={{ padding: "30px 34px" }}>
        <EdKicker>Now</EdKicker>
        {placeLabel && (
          <p className="flex items-center gap-1.5" style={{ color: ED_INK3, fontSize: fs(13.5), marginTop: fs(6) }}>
            <MapPin size={13} color={WEATHER_INK} strokeWidth={2} />{placeLabel}
          </p>
        )}
        <div className="flex items-start justify-between" style={{ marginTop: fs(14), gap: fs(20) }}>
          <div className="min-w-0">
            <div className="leading-none" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(96), letterSpacing: "-0.02em" }}>
              {temp}<span style={{ fontSize: fs(44), color: WEATHER_INK }}>°{isC ? 'C' : 'F'}</span>
            </div>
            <p style={{ color: ED_INK2, fontSize: fs(20), fontFamily: ED_SERIF, marginTop: fs(4) }}>{current.condition}</p>
            <p style={{ color: ED_INK3, fontSize: fs(13.5), marginTop: fs(2) }}>
              Feels like {feels}°{isC ? 'C' : 'F'}
            </p>
            {dateLabel && (
              <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".1em", marginTop: fs(10) }}>{dateLabel}</p>
            )}
          </div>
          <div className="shrink-0" style={{ fontSize: fs(84), lineHeight: 1 }}>{current.icon || getWeatherIcon(current.condition)}</div>
        </div>
        <div className="grid grid-cols-4" style={{ marginTop: fs(24), paddingTop: fs(20), borderTop: `1px solid ${ED_RULE}`, gap: fs(16) }}>
          {detail.map((d) => (
            <div key={d.k}>
              <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".1em", margin: 0 }}>{d.k}</p>
              <p className="font-semibold" style={{ color: ED_INK, fontSize: fs(20), fontFamily: ED_SERIF, marginTop: fs(3) }}>{d.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// One day in the 7-day list — soft white rounded card with hairline rule,
// expandable into a scrollable hourly strip + DETAILS block.
function EdForecastDay({ day, index, expanded, onToggle, displayScale }) {
  const isC = displayScale === 'celsius';
  const high = isC ? day.high_celsius : day.high_fahrenheit;
  const low = isC ? day.low_celsius : day.low_fahrenheit;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white rounded-[20px] overflow-hidden"
      style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}
    >
      <button onClick={() => onToggle(index)} className="w-full text-left" style={{ padding: "18px 22px" }}>
        <div className="flex items-center justify-between" style={{ gap: fs(16) }}>
          <div className="flex items-center" style={{ gap: fs(16) }}>
            <div style={{ fontSize: fs(40), lineHeight: 1 }}>{day.icon || getWeatherIcon(day.condition)}</div>
            <div>
              <h3 className="leading-tight" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(24) }}>
                {day.is_today ? 'Today' : day.day_of_week}
              </h3>
              <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".08em", marginTop: fs(2) }}>
                {day.is_today ? day.day_of_week : day.date}
              </p>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: fs(16) }}>
            <div className="text-right">
              <div className="flex items-baseline justify-end" style={{ gap: fs(6) }}>
                <span style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(30) }}>{high}°</span>
                <span style={{ color: ED_INK3, fontFamily: ED_SERIF, fontSize: fs(20) }}>{low}°</span>
              </div>
              <p style={{ color: ED_INK3, fontSize: fs(12.5), marginTop: fs(2) }}>{day.condition}</p>
            </div>
            <div style={{ color: WEATHER_INK }}>
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: fs(18), marginTop: fs(12) }}>
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
            <div style={{ padding: "16px 22px 22px", borderTop: `1px solid ${ED_RULE}` }}>
              <div className="flex items-center" style={{ gap: fs(6), marginBottom: fs(12) }}>
                <Clock className="w-3.5 h-3.5" style={{ color: WEATHER_INK }} />
                <EdKicker>Hourly</EdKicker>
              </div>
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex pb-1" style={{ gap: fs(10), minWidth: "max-content" }}>
                  {day.hourly.map((hour, hIndex) => (
                    <div key={hIndex} className="flex-shrink-0 text-center rounded-[14px]" style={{ width: fs(72), padding: fs(12), background: ED_IVORY2, border: `1px solid ${ED_RULE}` }}>
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
                <div style={{ marginTop: fs(16), paddingTop: fs(14), borderTop: `1px solid ${ED_RULE}` }}>
                  <EdKicker>Details</EdKicker>
                  <div className="flex" style={{ gap: fs(28), marginTop: fs(8) }}>
                    {day.sunrise && (
                      <div className="flex items-center" style={{ gap: fs(8) }}>
                        <span style={{ fontSize: fs(18) }}>🌅</span>
                        <div>
                          <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", margin: 0 }}>Sunrise</p>
                          <p className="font-semibold" style={{ color: ED_INK, fontSize: fs(14) }}>{day.sunrise}</p>
                        </div>
                      </div>
                    )}
                    {day.sunset && (
                      <div className="flex items-center" style={{ gap: fs(8) }}>
                        <span style={{ fontSize: fs(18) }}>🌇</span>
                        <div>
                          <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", margin: 0 }}>Sunset</p>
                          <p className="font-semibold" style={{ color: ED_INK, fontSize: fs(14) }}>{day.sunset}</p>
                        </div>
                      </div>
                    )}
                  </div>
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
          <div className="flex items-center gap-1 rounded-full p-1" style={{ background:'#F7F4EC' }}>
            <button onClick={() => setDisplayScale('fahrenheit')} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${displayScale === 'fahrenheit' ? 'text-white' : 'text-gray-600'}`} style={{ background: displayScale === 'fahrenheit' ? CAT.weather.ink : 'transparent' }}>°F</button>
            <button onClick={() => setDisplayScale('celsius')} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${displayScale === 'celsius' ? 'text-white' : 'text-gray-600'}`} style={{ background: displayScale === 'celsius' ? CAT.weather.ink : 'transparent' }}>°C</button>
          </div>
        </div>
      </div>

      {isTablet ? (
        /* ── iPad EDITORIAL CONTENT COLUMN ── */
        <div style={{ maxWidth: 1024, margin: "0 auto", padding: "0 24px 170px", display: "flex", flexDirection: "column", gap: fs(30) }}>
          {error && (
            <div className="bg-white rounded-[22px]" style={{ padding: "26px 30px", boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}>
              <div className="flex items-start" style={{ gap: fs(14) }}>
                <div style={{ fontSize: fs(28) }}>⚠️</div>
                <div className="flex-1">
                  <p className="font-bold" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(22), marginBottom: fs(6) }}>Weather Data Unavailable</p>
                  <p style={{ color: ED_INK2, fontSize: fs(14), marginBottom: fs(16) }}>{error}</p>
                  <button
                    onClick={() => { setError(null); if (activeLocation?.coordinates) { loadWeatherData(activeLocation); } }}
                    className="rounded-full font-bold text-white transition-transform active:scale-[0.98]"
                    style={{ padding: "10px 20px", background: WEATHER_INK, fontSize: fs(14) }}
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
              placeLabel={locationMode === 'navigate' ? activeLocation?.placeName : activeLocation?.address?.city}
              dateLabel={`Today · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
            />
          )}

          {!error && (
            <div>
              <div className="flex items-end justify-between" style={{ marginBottom: fs(16) }}>
                <div>
                  <EdKicker>7-Day</EdKicker>
                  <h2 className="leading-none" style={{ color: ED_INK, fontFamily: ED_SERIF, fontSize: fs(34), marginTop: fs(4) }}>Forecast</h2>
                </div>
                <p className="uppercase" style={{ color: ED_INK3, fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".1em" }}>Tap for hourly</p>
              </div>

              {isLoading ? (
                <div className="bg-white rounded-[22px] flex flex-col items-center justify-center" style={{ padding: fs(56), boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}>
                  <Loader2 className="animate-spin" style={{ width: fs(36), height: fs(36), color: WEATHER_INK, marginBottom: fs(12) }} />
                  <p style={{ color: ED_INK3, fontSize: fs(14) }}>Fetching weather data…</p>
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
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-[22px] text-center" style={{ padding: fs(44), boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${ED_RULE}` }}>
                  <Cloud style={{ width: fs(56), height: fs(56), color: ED_INK3, margin: `0 auto ${fs(12)}` }} />
                  <p style={{ color: ED_INK2, fontSize: fs(15), marginBottom: fs(4) }}>No weather data available</p>
                  <p style={{ color: ED_INK3, fontSize: fs(13) }}>Unable to fetch forecast</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
      <div className="max-w-md mx-auto px-5 pb-6">
        {/* Current Weather Card */}
        {!error && current && (
          <div className="bg-gradient-to-br from-[#1976D2] to-[#1565C0] rounded-2xl shadow-lg p-5 mb-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4" />
              <p className="text-sm font-bold text-yellow-300">
                {locationMode === 'navigate' 
                  ? activeLocation?.placeName 
                  : activeLocation?.address?.city}
              </p>
            </div>
            <p className="text-xs font-bold text-black mb-4">
              Today, {new Date().toLocaleDateString('en-US', { weekday: 'long' })}, {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-5xl font-bold mb-1">
                  {displayScale === 'celsius' 
                    ? current.temperature_celsius
                    : current.temperature_fahrenheit}°
                  <span className="text-2xl">{displayScale === 'celsius' ? 'C' : 'F'}</span>
                </div>
                <p className="text-sm font-medium mb-1">{current.condition}</p>
                <p className="text-xs text-white/80">
                  Feels like {displayScale === 'celsius' 
                    ? current.feels_like_celsius
                    : current.feels_like_fahrenheit}°{displayScale === 'celsius' ? 'C' : 'F'}
                </p>
              </div>
              <div className="text-5xl">{current.icon || getWeatherIcon(current.condition)}</div>
            </div>
            
            <div className="grid grid-cols-4 gap-3 pt-4 border-t border-white/20">
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">💧</div>
                <div className="text-sm font-bold">{current.humidity}%</div>
                <div className="text-[calc(10px*var(--fs))] text-white/70">Humidity</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">💨</div>
                <div className="text-sm font-bold">
                  {displayScale === 'celsius' ? current.wind_speed_kmh : current.wind_speed_mph}
                </div>
                <div className="text-[calc(10px*var(--fs))] text-white/70">Wind</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">☀️</div>
                <div className="text-sm font-bold">{current.uv_index}</div>
                <div className="text-[calc(10px*var(--fs))] text-white/70">UV Index</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">🌡️</div>
                <div className="text-sm font-bold">
                  {displayScale === 'celsius' 
                    ? `${forecast[0]?.low_celsius}°` 
                    : `${forecast[0]?.low_fahrenheit}°`}
                </div>
                <div className="text-[calc(10px*var(--fs))] text-white/70">Low</div>
              </div>
            </div>
          </div>
        )}

        {/* 7-Day Forecast */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">7-Day Forecast</h2>
          <p className="text-xs text-white/70">Tap for hourly</p>
        </div>
        
        {error && (
          <div className="bg-white rounded-2xl p-6 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <p className="text-red-900 font-bold mb-2">Weather Data Unavailable</p>
                <p className="text-red-800 text-sm mb-4">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    if (activeLocation?.coordinates) {
                      loadWeatherData(activeLocation);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && !error ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-3" />
            <p className="text-sm text-gray-600">Fetching weather data...</p>
          </div>
        ) : !error && forecast.length > 0 ? (
          <div className="space-y-2">
            {forecast.map((day, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-md overflow-hidden"
              >
                {/* Day Summary - Clickable */}
                <button
                  onClick={() => toggleDayExpansion(index)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{day.icon || getWeatherIcon(day.condition)}</div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">
                          {day.is_today ? 'Today' : day.day_of_week}
                        </h3>
                        {day.is_today && (
                          <p className="text-sm font-bold text-gray-900">{day.day_of_week}</p>
                        )}
                        {!day.is_today && (
                          <p className="text-[calc(10px*var(--fs))] text-gray-500">{day.date}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1">
                          <p className="text-2xl font-bold text-gray-900">
                            {displayScale === 'celsius' 
                              ? day.high_celsius
                              : day.high_fahrenheit}°
                          </p>
                          <p className="text-sm text-gray-500">
                            {displayScale === 'celsius' 
                              ? day.low_celsius
                              : day.low_fahrenheit}°
                          </p>
                        </div>
                        <p className="text-[calc(10px*var(--fs))] text-gray-500 mt-0.5">{day.condition}</p>
                      </div>
                      
                      <div className="text-gray-400">
                        {expandedDay === index ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-blue-600">
                      <span>💧</span>
                      <span className="font-semibold">{day.precipitation_probability}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>💨</span>
                      <span className="font-semibold">
                        {displayScale === 'celsius' ? `${day.wind_speed_kmh}km/h` : `${day.wind_speed_mph}mph`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-orange-600">
                      <span>☀️</span>
                      <span className="font-semibold">UV {day.uv_index}</span>
                    </div>
                    {day.sunrise && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <span>🌅</span>
                        <span className="font-semibold">{day.sunrise}</span>
                      </div>
                    )}
                  </div>
                </button>

                {/* Hourly Forecast - Expandable */}
                <AnimatePresence>
                  {expandedDay === index && day.hourly && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                        <div className="flex items-center gap-1 mb-2">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-[calc(10px*var(--fs))] text-gray-500 font-semibold">HOURLY FORECAST</span>
                        </div>
                        
                        {/* Scrollable hourly forecast */}
                        <div className="overflow-x-auto -mx-1 px-1">
                          <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
                            {day.hourly.map((hour, hIndex) => (
                              <div 
                                key={hIndex}
                                className={`flex-shrink-0 w-14 rounded-lg p-2 text-center ${
                                  hour.hour >= 6 && hour.hour <= 18 
                                    ? 'bg-gradient-to-b from-blue-50 to-blue-100' 
                                    : 'bg-gradient-to-b from-indigo-50 to-indigo-100'
                                }`}
                              >
                                <p className="text-[calc(10px*var(--fs))] font-bold text-gray-600 mb-1">
                                  {hour.time}
                                </p>
                                <div className="text-lg mb-1">
                                  {hour.icon || getWeatherIcon(hour.condition)}
                                </div>
                                <p className="text-sm font-bold text-gray-900">
                                  {displayScale === 'celsius' 
                                    ? hour.temperature_celsius
                                    : hour.temperature_fahrenheit}°
                                </p>
                                {hour.precipitation_probability > 0 && (
                                  <p className="text-[calc(9px*var(--fs))] text-blue-600 font-semibold mt-0.5">
                                    💧{hour.precipitation_probability}%
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sunrise/Sunset info */}
                        {(day.sunrise || day.sunset) && (
                          <div className="flex justify-center gap-6 mt-3 pt-2 border-t border-gray-100">
                            {day.sunrise && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">🌅</span>
                                <div>
                                  <p className="text-[calc(9px*var(--fs))] text-gray-500">Sunrise</p>
                                  <p className="text-xs font-bold text-gray-700">{day.sunrise}</p>
                                </div>
                              </div>
                            )}
                            {day.sunset && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">🌇</span>
                                <div>
                                  <p className="text-[calc(9px*var(--fs))] text-gray-500">Sunset</p>
                                  <p className="text-xs font-bold text-gray-700">{day.sunset}</p>
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
            ))}
          </div>
        ) : !error && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Cloud className="w-16 h-16 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-1">No weather data available</p>
            <p className="text-sm text-gray-500">Unable to fetch forecast</p>
          </div>
        )}
      </div>
      )}

      <LocationModePicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      />
    </div>
  );
}