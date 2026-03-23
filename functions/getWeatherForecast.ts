/**
 * ============================================================================
 * GLOBESKIMMERS - getWeatherForecast (Open-Meteo API)
 * ============================================================================
 * 
 * FREE weather data - no API key required!
 * 
 * Features:
 *   - Current weather conditions
 *   - 7-day daily forecast
 *   - Hourly forecast for each day
 *   - Temperature in both Celsius and Fahrenheit
 *   - Wind, humidity, precipitation, UV index
 * 
 * API: https://open-meteo.com/ (100% free, no API key)
 * 
 * ============================================================================
 */

import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";

// Weather code to condition mapping
const WEATHER_CODES = {
  0: { condition: "Clear sky", icon: "☀️" },
  1: { condition: "Mainly clear", icon: "🌤️" },
  2: { condition: "Partly cloudy", icon: "⛅" },
  3: { condition: "Overcast", icon: "☁️" },
  45: { condition: "Foggy", icon: "🌫️" },
  48: { condition: "Depositing rime fog", icon: "🌫️" },
  51: { condition: "Light drizzle", icon: "🌦️" },
  53: { condition: "Moderate drizzle", icon: "🌦️" },
  55: { condition: "Dense drizzle", icon: "🌧️" },
  56: { condition: "Light freezing drizzle", icon: "🌨️" },
  57: { condition: "Dense freezing drizzle", icon: "🌨️" },
  61: { condition: "Slight rain", icon: "🌧️" },
  63: { condition: "Moderate rain", icon: "🌧️" },
  65: { condition: "Heavy rain", icon: "🌧️" },
  66: { condition: "Light freezing rain", icon: "🌨️" },
  67: { condition: "Heavy freezing rain", icon: "🌨️" },
  71: { condition: "Slight snow", icon: "🌨️" },
  73: { condition: "Moderate snow", icon: "🌨️" },
  75: { condition: "Heavy snow", icon: "❄️" },
  77: { condition: "Snow grains", icon: "❄️" },
  80: { condition: "Slight rain showers", icon: "🌦️" },
  81: { condition: "Moderate rain showers", icon: "🌧️" },
  82: { condition: "Violent rain showers", icon: "⛈️" },
  85: { condition: "Slight snow showers", icon: "🌨️" },
  86: { condition: "Heavy snow showers", icon: "🌨️" },
  95: { condition: "Thunderstorm", icon: "⛈️" },
  96: { condition: "Thunderstorm with slight hail", icon: "⛈️" },
  99: { condition: "Thunderstorm with heavy hail", icon: "⛈️" },
};

function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { condition: "Unknown", icon: "🌡️" };
}

function celsiusToFahrenheit(celsius) {
  return Math.round((celsius * 9/5) + 32);
}

function kmhToMph(kmh) {
  return Math.round(kmh * 0.621371);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function getDayOfWeek(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatHour(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
}

Deno.serve(async (req) => {
  console.log("\n🌤️ === WEATHER FORECAST (Open-Meteo) ===\n");

  try {
    // Auth check
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { latitude, longitude, timezone = "auto" } = body;

    if (!latitude || !longitude) {
      return Response.json({ 
        error: "latitude and longitude are required" 
      }, { status: 400 });
    }

    console.log(`📍 Location: ${latitude}, ${longitude}`);

    // Build Open-Meteo API URL
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      // Current weather
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "uv_index"
      ].join(","),
      // Hourly forecast (for 7 days)
      hourly: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "uv_index"
      ].join(","),
      // Daily forecast
      daily: [
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "apparent_temperature_min",
        "sunrise",
        "sunset",
        "precipitation_sum",
        "precipitation_probability_max",
        "weather_code",
        "wind_speed_10m_max",
        "uv_index_max"
      ].join(","),
      timezone: timezone,
      forecast_days: "7"
    });

    const apiUrl = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    console.log("🔗 Calling Open-Meteo API...");

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Open-Meteo error:", response.status, errorText);
      return Response.json({ 
        error: "Weather API error", 
        details: errorText 
      }, { status: 500 });
    }

    const data = await response.json();
    console.log("✅ Weather data received");

    // Process current weather
    const currentWeather = getWeatherInfo(data.current.weather_code);
    const current = {
      temperature_celsius: Math.round(data.current.temperature_2m),
      temperature_fahrenheit: celsiusToFahrenheit(data.current.temperature_2m),
      feels_like_celsius: Math.round(data.current.apparent_temperature),
      feels_like_fahrenheit: celsiusToFahrenheit(data.current.apparent_temperature),
      humidity: data.current.relative_humidity_2m,
      wind_speed_kmh: Math.round(data.current.wind_speed_10m),
      wind_speed_mph: kmhToMph(data.current.wind_speed_10m),
      wind_direction: data.current.wind_direction_10m,
      uv_index: Math.round(data.current.uv_index || 0),
      condition: currentWeather.condition,
      icon: currentWeather.icon,
      weather_code: data.current.weather_code
    };

    // Process daily forecast with hourly data
    const forecast = data.daily.time.map((date, dayIndex) => {
      const dayWeather = getWeatherInfo(data.daily.weather_code[dayIndex]);
      
      // Get hourly data for this day (24 hours per day)
      const startHourIndex = dayIndex * 24;
      const endHourIndex = startHourIndex + 24;
      
      const hourlyForDay = [];
      for (let h = startHourIndex; h < endHourIndex && h < data.hourly.time.length; h++) {
        const hourWeather = getWeatherInfo(data.hourly.weather_code[h]);
        const hourDate = new Date(data.hourly.time[h]);
        const hour = hourDate.getHours();
        
        hourlyForDay.push({
          time: formatHour(hour),
          hour: hour,
          temperature_celsius: Math.round(data.hourly.temperature_2m[h]),
          temperature_fahrenheit: celsiusToFahrenheit(data.hourly.temperature_2m[h]),
          feels_like_celsius: Math.round(data.hourly.apparent_temperature[h]),
          feels_like_fahrenheit: celsiusToFahrenheit(data.hourly.apparent_temperature[h]),
          humidity: data.hourly.relative_humidity_2m[h],
          precipitation_probability: data.hourly.precipitation_probability[h] || 0,
          precipitation_mm: data.hourly.precipitation[h] || 0,
          wind_speed_kmh: Math.round(data.hourly.wind_speed_10m[h]),
          wind_speed_mph: kmhToMph(data.hourly.wind_speed_10m[h]),
          uv_index: Math.round(data.hourly.uv_index[h] || 0),
          condition: hourWeather.condition,
          icon: hourWeather.icon,
          weather_code: data.hourly.weather_code[h]
        });
      }

      // Parse sunrise/sunset times
      const sunrise = data.daily.sunrise[dayIndex];
      const sunset = data.daily.sunset[dayIndex];
      const sunriseTime = sunrise ? new Date(sunrise).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
      const sunsetTime = sunset ? new Date(sunset).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;

      return {
        date: formatDate(date),
        date_short: date,
        day_of_week: getDayOfWeek(date),
        is_today: dayIndex === 0,
        
        // Temperatures
        high_celsius: Math.round(data.daily.temperature_2m_max[dayIndex]),
        high_fahrenheit: celsiusToFahrenheit(data.daily.temperature_2m_max[dayIndex]),
        low_celsius: Math.round(data.daily.temperature_2m_min[dayIndex]),
        low_fahrenheit: celsiusToFahrenheit(data.daily.temperature_2m_min[dayIndex]),
        
        // Feels like
        feels_like_high_celsius: Math.round(data.daily.apparent_temperature_max[dayIndex]),
        feels_like_high_fahrenheit: celsiusToFahrenheit(data.daily.apparent_temperature_max[dayIndex]),
        feels_like_low_celsius: Math.round(data.daily.apparent_temperature_min[dayIndex]),
        feels_like_low_fahrenheit: celsiusToFahrenheit(data.daily.apparent_temperature_min[dayIndex]),
        
        // Weather condition
        condition: dayWeather.condition,
        icon: dayWeather.icon,
        weather_code: data.daily.weather_code[dayIndex],
        
        // Precipitation
        precipitation_probability: data.daily.precipitation_probability_max[dayIndex] || 0,
        precipitation_mm: data.daily.precipitation_sum[dayIndex] || 0,
        
        // Wind
        wind_speed_kmh: Math.round(data.daily.wind_speed_10m_max[dayIndex]),
        wind_speed_mph: kmhToMph(data.daily.wind_speed_10m_max[dayIndex]),
        
        // UV
        uv_index: Math.round(data.daily.uv_index_max[dayIndex] || 0),
        
        // Sun times
        sunrise: sunriseTime,
        sunset: sunsetTime,
        
        // Hourly breakdown for this day
        hourly: hourlyForDay
      };
    });

    // Get location info from timezone
    const timezoneInfo = data.timezone || timezone;

    return Response.json({
      success: true,
      location: {
        latitude,
        longitude,
        timezone: timezoneInfo,
        elevation: data.elevation
      },
      current,
      forecast,
      units: {
        temperature: "celsius/fahrenheit",
        wind_speed: "km/h and mph",
        precipitation: "mm"
      },
      source: "Open-Meteo (free)",
      fetched_at: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error:", error?.message || error);
    return Response.json({ 
      error: error?.message || String(error) 
    }, { status: 500 });
  }
});