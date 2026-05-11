import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Loader2, Cloud, MapPin, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import RefreshButton from "@/components/RefreshButton";

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
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }

      const userData = await base44.auth.me();
      setUser(userData);
      
      const preferredScale = userData.preferred_temperature_scale || 'fahrenheit';
      setDisplayScale(preferredScale);

      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      base44.auth.redirectToLogin(window.location.pathname);
    }
  };

  const loadWeatherData = async (location, forceRefresh = false) => {
    setError(null);
    try {
      const result = await base44.functions.invoke('getWeatherForecast', {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
        forceRefresh,
      });

      // Base44 wraps response in 'data' property
      const weatherResult = result.data || result;
      
      if (weatherResult.error) {
        throw new Error(weatherResult.error);
      }

      setWeatherData(weatherResult);
    } catch (error) {
      console.error("Error loading weather:", error);
      setError("Unable to load weather data. Please try again.");
    }
  };

  const toggleDayExpansion = (index) => {
    setExpandedDay(expandedDay === index ? null : index);
  };

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
    <div className="min-h-screen bg-gradient-to-br from-[#FF9800] via-[#FF6F00] to-[#FF5722]">
      {/* Header */}
      <div className="px-5 py-4">
        <div className="max-w-md mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => navigate(createPageUrl("Home"))}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </button>
            <RefreshButton onClick={handleRefresh} isRefreshing={refreshing} tone="light" title="Refresh weather" />
          </div>

          <h1 className="text-xl font-bold text-white mb-4">Weather Forecast</h1>

          {/* Location Selector */}
          <div onClick={() => setShowLocationPicker(true)} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", background: "#fff", borderRadius: "10px",
            border: "1px solid #E2E8F0", fontSize: "13px", marginBottom: "12px", cursor: "pointer"
          }}>
            <span style={{ color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              📍 {locationMode === 'current' 
                ? (activeLocation?.placeName || activeLocation?.address?.city || 'Current Location')
                : (activeLocation?.placeName || activeLocation?.address?.formatted || 'Select Location')}
            </span>
            <span style={{ background: "#FFF8E1", color: "#F57F17", padding: "4px 10px", borderRadius: "6px", fontWeight: "600", fontSize: "12px" }}>
              Change
            </span>
          </div>

          {/* Temperature Scale Toggle */}
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center gap-1 bg-white rounded-full p-1">
              <button
                onClick={() => setDisplayScale('fahrenheit')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  displayScale === 'fahrenheit' ? 'bg-blue-500 text-white' : 'text-gray-600'
                }`}
              >
                °F
              </button>
              <button
                onClick={() => setDisplayScale('celsius')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  displayScale === 'celsius' ? 'bg-blue-500 text-white' : 'text-gray-600'
                }`}
              >
                °C
              </button>
            </div>
          </div>
        </div>
      </div>

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
                <div className="text-[10px] text-white/70">Humidity</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">💨</div>
                <div className="text-sm font-bold">
                  {displayScale === 'celsius' ? current.wind_speed_kmh : current.wind_speed_mph}
                </div>
                <div className="text-[10px] text-white/70">Wind</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">☀️</div>
                <div className="text-sm font-bold">{current.uv_index}</div>
                <div className="text-[10px] text-white/70">UV Index</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">🌡️</div>
                <div className="text-sm font-bold">
                  {displayScale === 'celsius' 
                    ? `${forecast[0]?.low_celsius}°` 
                    : `${forecast[0]?.low_fahrenheit}°`}
                </div>
                <div className="text-[10px] text-white/70">Low</div>
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
                          <p className="text-[10px] text-gray-500">{day.date}</p>
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
                        <p className="text-[10px] text-gray-500 mt-0.5">{day.condition}</p>
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
                          <span className="text-[10px] text-gray-500 font-semibold">HOURLY FORECAST</span>
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
                                <p className="text-[10px] font-bold text-gray-600 mb-1">
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
                                  <p className="text-[9px] text-blue-600 font-semibold mt-0.5">
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
                                  <p className="text-[9px] text-gray-500">Sunrise</p>
                                  <p className="text-xs font-bold text-gray-700">{day.sunrise}</p>
                                </div>
                              </div>
                            )}
                            {day.sunset && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">🌇</span>
                                <div>
                                  <p className="text-[9px] text-gray-500">Sunset</p>
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

      <LocationModePicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      />
    </div>
  );
}