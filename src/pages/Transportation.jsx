import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { callWorker, invokeLLM } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft, Hotel, Plane, Loader2, ExternalLink, Search, X, Star, Navigation, Phone, ChevronRight, Bus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import { getCurrentPositionSmart } from "@/lib/geolocation";
import { isCityLocation } from "../components/location/locationLabel";
import { CAT, TEAL_DEEP, IVORY } from "../components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

// Editorial design tokens (design handoff: ivory canvas + 1024 column).
// These now feed BOTH widths — phone is phone-tuned, tablet keeps the 1024 column.
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_INK = "#16110D";
const fs = (n) => `calc(${n}px*var(--fs))`;

// ============================================================================
// FIX: CACHING CONFIGURATION - Saves ~$55-165/month
// ============================================================================
const WORKER_URL = 'https://globeskimmers-api.maizasimeon.workers.dev';
const ROUTE_INFO_CACHE_KEY = 'globeskimmers_route_info_v1';
const ROUTE_INFO_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const LOCATION_SEARCH_CACHE_KEY = 'globeskimmers_location_search_v1';
const LOCATION_SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cache helper functions for route info
const getRouteCacheKey = (originLat, originLng, destLat, destLng, city) => {
  const roundLat = (lat) => Math.round(lat * 100) / 100; // ~1km precision
  const roundLng = (lng) => Math.round(lng * 100) / 100;
  return `${ROUTE_INFO_CACHE_KEY}:${city}:${roundLat(originLat)}:${roundLng(originLng)}:${roundLat(destLat)}:${roundLng(destLng)}`;
};

const getCachedRouteInfo = (originLat, originLng, destLat, destLng, city) => {
  try {
    const cacheKey = getRouteCacheKey(originLat, originLng, destLat, destLng, city);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < ROUTE_INFO_CACHE_TTL) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Route cache read error:', error);
    return null;
  }
};

const setCachedRouteInfo = (originLat, originLng, destLat, destLng, city, data) => {
  try {
    const cacheKey = getRouteCacheKey(originLat, originLng, destLat, destLng, city);
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Route cache write error:', error);
  }
};

// Cache helper functions for location search
const getLocationSearchCacheKey = (query, lat, lng) => {
  const roundLat = Math.round(lat * 10) / 10; // ~10km precision for search
  const roundLng = Math.round(lng * 10) / 10;
  const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 50);
  return `${LOCATION_SEARCH_CACHE_KEY}:${roundLat}:${roundLng}:${normalizedQuery}`;
};

const getCachedLocationSearch = (query, lat, lng) => {
  try {
    const cacheKey = getLocationSearchCacheKey(query, lat, lng);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < LOCATION_SEARCH_CACHE_TTL) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Location search cache read error:', error);
    return null;
  }
};

const setCachedLocationSearch = (query, lat, lng, data) => {
  try {
    const cacheKey = getLocationSearchCacheKey(query, lat, lng);
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Location search cache write error:', error);
  }
};

// ============================================================================
// CONFIGURATION: CITY TRAFFIC FACTORS
// ============================================================================
const CITY_TRAFFIC_FACTORS = {
  "Manila": 0.55, "Makati": 0.55, "Quezon City": 0.55, "Pasig": 0.55,
  "Metro Manila": 0.55, "Bangkok": 0.50, "Jakarta": 0.50, "Mumbai": 0.55,
  "Delhi": 0.55, "Bangalore": 0.60, "Ho Chi Minh City": 0.60, "Hanoi": 0.60,
  "Kuala Lumpur": 0.65, "Singapore": 0.75, "Tokyo": 0.70, "Osaka": 0.70,
  "Seoul": 0.65, "Beijing": 0.55, "Shanghai": 0.60, "Hong Kong": 0.65,
  "Los Angeles": 0.60, "New York": 0.55, "Manhattan": 0.50, "San Francisco": 0.65,
  "Chicago": 0.65, "Mexico City": 0.50, "São Paulo": 0.50, "London": 0.60,
  "Paris": 0.65, "Rome": 0.60, "Berlin": 0.75, "Dubai": 0.70, "Cairo": 0.50,
  "Sydney": 0.70, "Melbourne": 0.70, "default": 0.80
};

// ============================================================================
// CONFIGURATION: TIME OF DAY MULTIPLIERS
// ============================================================================
const getTimeMultiplier = (hour, isWeekend) => {
  if (isWeekend) {
    if (hour >= 10 && hour <= 18) return 0.85;
    return 0.95;
  }
  if (hour >= 7 && hour < 9) return 0.50;
  if (hour >= 9 && hour < 11) return 0.70;
  if (hour >= 11 && hour < 15) return 0.80;
  if (hour >= 15 && hour < 16) return 0.70;
  if (hour >= 16 && hour < 19) return 0.50;
  if (hour >= 19 && hour < 21) return 0.75;
  if (hour >= 21 || hour < 6) return 1.00;
  return 0.85;
};

// ============================================================================
// CONFIGURATION: GLOBAL HOLIDAYS DATABASE
// ============================================================================
const GLOBAL_HOLIDAYS = {
  "01-01": { name: "New Year's Day", type: "holiday", regions: ["global"] },
  "12-25": { name: "Christmas Day", type: "holiday", regions: ["global"] },
  "12-24": { name: "Christmas Eve", type: "eve", regions: ["global"] },
  "12-31": { name: "New Year's Eve", type: "eve", regions: ["global"] },
  "01-09": { name: "Black Nazarene", type: "heavy", regions: ["PH"] },
  "10-31": { name: "All Saints Eve", type: "heavy", regions: ["PH"] },
  "11-01": { name: "All Saints Day", type: "eve", regions: ["PH"] },
  "04-09": { name: "Araw ng Kagitingan", type: "holiday", regions: ["PH"] },
  "06-12": { name: "Independence Day", type: "holiday", regions: ["PH"] },
  "07-04": { name: "Independence Day", type: "holiday", regions: ["US"] },
  "04-13": { name: "Songkran", type: "holiday", regions: ["TH"] },
  "04-14": { name: "Songkran", type: "holiday", regions: ["TH"] },
  "04-15": { name: "Songkran", type: "holiday", regions: ["TH"] },
};

const VARIABLE_HOLIDAYS = {
  lunarNewYear: { 2024: "2024-02-10", 2025: "2025-01-29", 2026: "2026-02-17", 2027: "2027-02-06" },
  eidAlFitr: { 2024: "2024-04-10", 2025: "2025-03-30", 2026: "2026-03-20" },
  thanksgiving: { 2024: "2024-11-28", 2025: "2025-11-27", 2026: "2026-11-26" },
};

const getHolidayMultiplier = (date, countryCode) => {
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const holiday = GLOBAL_HOLIDAYS[dateStr];
  if (holiday) {
    const isRelevant = holiday.regions.includes("global") || holiday.regions.includes(countryCode);
    if (isRelevant) {
      if (holiday.type === "heavy") return 0.35;
      if (holiday.type === "eve") return 0.40;
      if (holiday.type === "holiday") return 1.15;
    }
  }
  return 1.0;
};

// ============================================================================
// CONFIGURATION: RIDESHARE PROVIDERS BY COUNTRY (ACCURATE)
// ============================================================================
const RIDESHARE_PROVIDERS = {
  grab: {
    name: "Grab",
    logo: "🟢",
    color: "bg-green-500",
    countries: ["PH", "SG", "MY", "TH", "VN", "ID", "KH", "MM"],
    deepLink: (origin, dest) => `grab://open?screenType=BOOKING&dropoffLatitude=${dest.latitude}&dropoffLongitude=${dest.longitude}`,
    appStore: "https://apps.apple.com/app/grab/id647268330",
    playStore: "https://play.google.com/store/apps/details?id=com.grabtaxi.passenger"
  },
  uber: {
    name: "Uber",
    logo: "⬛",
    color: "bg-black",
    countries: ["US", "CA", "MX", "BR", "AU", "NZ", "GB", "FR", "DE", "ES", "IT", "IN", "JP", "KR", "TW", "HK"],
    excludeCountries: ["PH", "SG", "MY", "TH", "VN", "ID", "CN"],
    deepLink: (origin, dest) => `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${dest.latitude}&dropoff[longitude]=${dest.longitude}&dropoff[nickname]=${encodeURIComponent(dest.name || 'Destination')}`,
    appStore: "https://apps.apple.com/app/uber/id368677368",
    playStore: "https://play.google.com/store/apps/details?id=com.ubercab"
  },
  lyft: {
    name: "Lyft",
    logo: "🩷",
    color: "bg-pink-500",
    countries: ["US", "CA"],
    deepLink: (origin, dest) => `lyft://ridetype?id=lyft&destination[latitude]=${dest.latitude}&destination[longitude]=${dest.longitude}`,
    appStore: "https://apps.apple.com/app/lyft/id529379082",
    playStore: "https://play.google.com/store/apps/details?id=me.lyft.android"
  },
  bolt: {
    name: "Bolt",
    logo: "⚡",
    color: "bg-green-400",
    countries: ["GB", "IE", "EE", "PL", "RO", "ZA", "NG", "KE", "PT", "ES", "FR"],
    deepLink: (origin, dest) => `bolt://open?dropoff_lat=${dest.latitude}&dropoff_lng=${dest.longitude}`,
    appStore: "https://apps.apple.com/app/bolt/id675033630",
    playStore: "https://play.google.com/store/apps/details?id=ee.mtakso.client"
  },
  gojek: {
    name: "Gojek",
    logo: "🟢",
    color: "bg-green-600",
    countries: ["ID", "SG", "VN"],
    deepLink: (origin, dest) => `gojek://goride?type=RIDE&drop_lat=${dest.latitude}&drop_long=${dest.longitude}`,
    appStore: "https://apps.apple.com/app/gojek/id944875099",
    playStore: "https://play.google.com/store/apps/details?id=com.gojek.app"
  },
  didi: {
    name: "DiDi",
    logo: "🟠",
    color: "bg-orange-500",
    countries: ["CN", "MX", "BR", "CL", "CO", "AU", "NZ", "JP"],
    deepLink: (origin, dest) => `didiglobal://open?lat=${dest.latitude}&lng=${dest.longitude}`,
    appStore: "https://apps.apple.com/app/didi/id554499054",
    playStore: "https://play.google.com/store/apps/details?id=com.didiglobal.passenger"
  },
  kakao: {
    name: "Kakao T",
    logo: "🟡",
    color: "bg-yellow-400",
    countries: ["KR"],
    deepLink: (origin, dest) => `kakaot://taxi?dest_lat=${dest.latitude}&dest_lng=${dest.longitude}`,
    appStore: "https://apps.apple.com/app/kakao-t/id981110422",
    playStore: "https://play.google.com/store/apps/details?id=com.kakao.taxi"
  },
  careem: {
    name: "Careem",
    logo: "🟢",
    color: "bg-green-500",
    countries: ["AE", "SA", "EG", "JO", "PK", "QA"],
    deepLink: (origin, dest) => `careem://booking?dropoff_latitude=${dest.latitude}&dropoff_longitude=${dest.longitude}`,
    appStore: "https://apps.apple.com/app/careem/id592978487",
    playStore: "https://play.google.com/store/apps/details?id=com.careem.acma"
  }
};

// ============================================================================
// CONFIGURATION: TAXI SERVICES BY COUNTRY
// ============================================================================
const TAXI_SERVICES = {
  PH: [
    { name: "Grab Philippines", phone: "+63 2 8651 8888", note: "Tap to call Grab hotline" },
    { name: "LTFRB Complaint", phone: "1342", note: "Report taxi issues" }
  ],
  US: [
    { name: "Yellow Cab", phone: "+1 212 666 6666", note: "NYC Yellow Cab" },
    { name: "Curb Taxi", phone: "+1 800 228 2872", note: "Nationwide taxi service" }
  ],
  GB: [
    { name: "Black Cab", phone: "+44 20 7272 0272", note: "London Black Cab" },
    { name: "Gett", phone: "+44 20 7225 2525", note: "UK taxi service" }
  ],
  JP: [
    { name: "Nihon Kotsu", phone: "+81 3 5755 2336", note: "Tokyo taxi" },
    { name: "JapanTaxi", phone: "+81 3 6265 6265", note: "Nationwide" }
  ],
  SG: [
    { name: "ComfortDelGro", phone: "+65 6552 1111", note: "Singapore taxi" },
    { name: "SMRT Taxi", phone: "+65 6555 8888", note: "Singapore taxi" }
  ],
  TH: [
    { name: "Grab Thailand", phone: "+66 2 021 9600", note: "Grab hotline" },
    { name: "All Thai Taxi", phone: "+66 2 661 6666", note: "Bangkok taxi" }
  ],
  default: [
    { name: "Local Taxi", phone: "", note: "Search for local taxi services" }
  ]
};

// ============================================================================
// CONFIGURATION: BASE FARE RATES BY COUNTRY
// ============================================================================
const FARE_RATES = {
  // Asia-Pacific
  PH: { base: 40, perKm: 13, currency: "PHP", symbol: "₱", name: "Philippine Peso" },
  SG: { base: 3.90, perKm: 0.75, currency: "SGD", symbol: "S$", name: "Singapore Dollar" },
  MY: { base: 3, perKm: 1.25, currency: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  TH: { base: 35, perKm: 6, currency: "THB", symbol: "฿", name: "Thai Baht" },
  VN: { base: 12000, perKm: 10000, currency: "VND", symbol: "₫", name: "Vietnamese Dong" },
  ID: { base: 8000, perKm: 4500, currency: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  JP: { base: 500, perKm: 300, currency: "JPY", symbol: "¥", name: "Japanese Yen" },
  KR: { base: 4800, perKm: 1200, currency: "KRW", symbol: "₩", name: "South Korean Won" },
  CN: { base: 13, perKm: 2.5, currency: "CNY", symbol: "¥", name: "Chinese Yuan" },
  TW: { base: 85, perKm: 30, currency: "TWD", symbol: "NT$", name: "Taiwan Dollar" },
  HK: { base: 27, perKm: 10, currency: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  IN: { base: 25, perKm: 18, currency: "INR", symbol: "₹", name: "Indian Rupee" },
  // Eurozone
  FR: { base: 2.60, perKm: 1.20, currency: "EUR", symbol: "€", name: "Euro" },
  DE: { base: 3.50, perKm: 2.00, currency: "EUR", symbol: "€", name: "Euro" },
  IT: { base: 3.50, perKm: 1.10, currency: "EUR", symbol: "€", name: "Euro" },
  ES: { base: 2.50, perKm: 1.20, currency: "EUR", symbol: "€", name: "Euro" },
  NL: { base: 3.40, perKm: 2.30, currency: "EUR", symbol: "€", name: "Euro" },
  BE: { base: 2.40, perKm: 1.80, currency: "EUR", symbol: "€", name: "Euro" },
  PT: { base: 3.25, perKm: 0.50, currency: "EUR", symbol: "€", name: "Euro" },
  AT: { base: 3.80, perKm: 1.50, currency: "EUR", symbol: "€", name: "Euro" },
  IE: { base: 4.10, perKm: 1.45, currency: "EUR", symbol: "€", name: "Euro" },
  GR: { base: 1.50, perKm: 0.90, currency: "EUR", symbol: "€", name: "Euro" },
  FI: { base: 5.90, perKm: 1.55, currency: "EUR", symbol: "€", name: "Euro" },
  // Other Europe
  GB: { base: 3.20, perKm: 2.00, currency: "GBP", symbol: "£", name: "British Pound" },
  CH: { base: 6.00, perKm: 4.00, currency: "CHF", symbol: "CHF", name: "Swiss Franc" },
  SE: { base: 50, perKm: 16, currency: "SEK", symbol: "kr", name: "Swedish Krona" },
  NO: { base: 100, perKm: 25, currency: "NOK", symbol: "kr", name: "Norwegian Krone" },
  DK: { base: 50, perKm: 14, currency: "DKK", symbol: "kr", name: "Danish Krone" },
  PL: { base: 8, perKm: 3, currency: "PLN", symbol: "zł", name: "Polish Złoty" },
  CZ: { base: 60, perKm: 30, currency: "CZK", symbol: "Kč", name: "Czech Koruna" },
  TR: { base: 10, perKm: 4, currency: "TRY", symbol: "₺", name: "Turkish Lira" },
  // Americas
  US: { base: 2.50, perKm: 1.50, currency: "USD", symbol: "$", name: "US Dollar" },
  CA: { base: 3.50, perKm: 1.80, currency: "CAD", symbol: "C$", name: "Canadian Dollar" },
  MX: { base: 30, perKm: 15, currency: "MXN", symbol: "Mex$", name: "Mexican Peso" },
  BR: { base: 5, perKm: 2.5, currency: "BRL", symbol: "R$", name: "Brazilian Real" },
  AR: { base: 200, perKm: 100, currency: "ARS", symbol: "$", name: "Argentine Peso" },
  // Oceania
  AU: { base: 4.50, perKm: 2.20, currency: "AUD", symbol: "A$", name: "Australian Dollar" },
  NZ: { base: 3.50, perKm: 2.50, currency: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  // Middle East / Africa
  AE: { base: 12, perKm: 2.20, currency: "AED", symbol: "د.إ", name: "UAE Dirham" },
  IL: { base: 12, perKm: 5, currency: "ILS", symbol: "₪", name: "Israeli Shekel" },
  EG: { base: 10, perKm: 5, currency: "EGP", symbol: "E£", name: "Egyptian Pound" },
  ZA: { base: 30, perKm: 12, currency: "ZAR", symbol: "R", name: "South African Rand" },
  default: { base: 2.50, perKm: 1.50, currency: "USD", symbol: "$", name: "US Dollar" }
};

const PUBLIC_TRANSPORT_COST_MULTIPLIER = {
  bus: 0.15, train: 0.20, jeepney: 0.08, tricycle: 0.25
};

const BASE_SPEEDS = {
  walk: 5, taxi: 30, rideshare: 30, bus: 18, train: 40, jeepney: 15, tricycle: 20
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const getCountryCode = (location) => {
  if (!location?.address?.country) return "US";
  const country = location.address.country.toUpperCase();
  const countryMap = {
    // Asia-Pacific
    "PHILIPPINES": "PH", "SINGAPORE": "SG", "MALAYSIA": "MY", "THAILAND": "TH",
    "VIETNAM": "VN", "INDONESIA": "ID", "JAPAN": "JP", "SOUTH KOREA": "KR",
    "KOREA": "KR", "CHINA": "CN", "TAIWAN": "TW", "HONG KONG": "HK",
    "INDIA": "IN",
    // Europe — names that don't match the 2-letter ISO prefix
    "FRANCE": "FR", "GERMANY": "DE", "ITALY": "IT", "SPAIN": "ES",
    "NETHERLANDS": "NL", "BELGIUM": "BE", "PORTUGAL": "PT", "AUSTRIA": "AT",
    "GREECE": "GR", "IRELAND": "IE", "FINLAND": "FI",
    "UNITED KINGDOM": "GB", "UK": "GB", "ENGLAND": "GB", "SCOTLAND": "GB", "WALES": "GB",
    "SWITZERLAND": "CH", "SWEDEN": "SE", "NORWAY": "NO", "DENMARK": "DK",
    "POLAND": "PL", "CZECH REPUBLIC": "CZ", "CZECHIA": "CZ", "TURKEY": "TR", "TÜRKIYE": "TR",
    // Americas
    "UNITED STATES": "US", "USA": "US", "CANADA": "CA", "MEXICO": "MX",
    "BRAZIL": "BR", "ARGENTINA": "AR",
    // Oceania
    "AUSTRALIA": "AU", "NEW ZEALAND": "NZ",
    // Middle East / Africa
    "UAE": "AE", "UNITED ARAB EMIRATES": "AE",
    "ISRAEL": "IL", "EGYPT": "EG", "SOUTH AFRICA": "ZA"
  };
  return countryMap[country] || country.substring(0, 2);
};

// Get timezone for country code
// Get timezone based on country code AND city (for countries with multiple timezones)
const getTimezone = (countryCode, location) => {
  // US cities and their timezones
  const US_CITY_TIMEZONES = {
    // Eastern Time (UTC-5)
    "new york": "America/New_York", "manhattan": "America/New_York", "brooklyn": "America/New_York",
    "queens": "America/New_York", "bronx": "America/New_York", "staten island": "America/New_York",
    "boston": "America/New_York", "philadelphia": "America/New_York", "washington": "America/New_York",
    "miami": "America/New_York", "orlando": "America/New_York", "tampa": "America/New_York",
    "jacksonville": "America/New_York", "atlanta": "America/New_York", "charlotte": "America/New_York",
    "detroit": "America/New_York", "cleveland": "America/New_York", "pittsburgh": "America/New_York",
    "baltimore": "America/New_York", "richmond": "America/New_York", "raleigh": "America/New_York",
    "columbus": "America/New_York", "indianapolis": "America/New_York", "cincinnati": "America/New_York",
    // Central Time (UTC-6)
    "chicago": "America/Chicago", "houston": "America/Chicago", "dallas": "America/Chicago",
    "san antonio": "America/Chicago", "austin": "America/Chicago", "fort worth": "America/Chicago",
    "memphis": "America/Chicago", "nashville": "America/Chicago", "new orleans": "America/Chicago",
    "milwaukee": "America/Chicago", "minneapolis": "America/Chicago", "st. paul": "America/Chicago",
    "kansas city": "America/Chicago", "st. louis": "America/Chicago", "oklahoma city": "America/Chicago",
    "omaha": "America/Chicago", "des moines": "America/Chicago", "wichita": "America/Chicago",
    // Mountain Time (UTC-7)
    "denver": "America/Denver", "phoenix": "America/Phoenix", "albuquerque": "America/Denver",
    "salt lake city": "America/Denver", "tucson": "America/Phoenix", "el paso": "America/Denver",
    "colorado springs": "America/Denver", "boise": "America/Denver", "las vegas": "America/Los_Angeles",
    // Pacific Time (UTC-8)
    "los angeles": "America/Los_Angeles", "san francisco": "America/Los_Angeles", 
    "san diego": "America/Los_Angeles", "seattle": "America/Los_Angeles", "portland": "America/Los_Angeles",
    "sacramento": "America/Los_Angeles", "san jose": "America/Los_Angeles", "oakland": "America/Los_Angeles",
    "fresno": "America/Los_Angeles", "long beach": "America/Los_Angeles", "anaheim": "America/Los_Angeles",
    "santa ana": "America/Los_Angeles", "irvine": "America/Los_Angeles", "pasadena": "America/Los_Angeles",
    "arcadia": "America/Los_Angeles", "glendale": "America/Los_Angeles", "burbank": "America/Los_Angeles",
    // Alaska Time (UTC-9)
    "anchorage": "America/Anchorage", "fairbanks": "America/Anchorage", "juneau": "America/Juneau",
    // Hawaii Time (UTC-10)
    "honolulu": "Pacific/Honolulu", "hilo": "Pacific/Honolulu",
    // Florida Panhandle (Central Time)
    "pensacola": "America/Chicago", "panama city": "America/Chicago",
  };

  // Canada cities and their timezones
  const CA_CITY_TIMEZONES = {
    "toronto": "America/Toronto", "ottawa": "America/Toronto", "montreal": "America/Montreal",
    "vancouver": "America/Vancouver", "calgary": "America/Edmonton", "edmonton": "America/Edmonton",
    "winnipeg": "America/Winnipeg", "halifax": "America/Halifax", "quebec": "America/Montreal",
  };

  // Australia cities and their timezones
  const AU_CITY_TIMEZONES = {
    "sydney": "Australia/Sydney", "melbourne": "Australia/Melbourne", "brisbane": "Australia/Brisbane",
    "perth": "Australia/Perth", "adelaide": "Australia/Adelaide", "darwin": "Australia/Darwin",
    "hobart": "Australia/Hobart", "canberra": "Australia/Sydney",
  };

  // Get city name from location
  const city = (location?.city || location?.address?.city || "").toLowerCase();
  const fullAddress = (location?.address?.formatted || "").toLowerCase();

  // Check country-specific city timezones
  if (countryCode === "US") {
    for (const [cityName, tz] of Object.entries(US_CITY_TIMEZONES)) {
      if (city.includes(cityName) || fullAddress.includes(cityName)) {
        return tz;
      }
    }
    // Default to Eastern for unknown US cities (most populated timezone)
    return "America/New_York";
  }

  if (countryCode === "CA") {
    for (const [cityName, tz] of Object.entries(CA_CITY_TIMEZONES)) {
      if (city.includes(cityName) || fullAddress.includes(cityName)) {
        return tz;
      }
    }
    return "America/Toronto";
  }

  if (countryCode === "AU") {
    for (const [cityName, tz] of Object.entries(AU_CITY_TIMEZONES)) {
      if (city.includes(cityName) || fullAddress.includes(cityName)) {
        return tz;
      }
    }
    return "Australia/Sydney";
  }

  // Default timezone map for single-timezone countries
  const timezoneMap = {
    "PH": "Asia/Manila",
    "SG": "Asia/Singapore",
    "MY": "Asia/Kuala_Lumpur",
    "TH": "Asia/Bangkok",
    "VN": "Asia/Ho_Chi_Minh",
    "ID": "Asia/Jakarta",
    "JP": "Asia/Tokyo",
    "KR": "Asia/Seoul",
    "CN": "Asia/Shanghai",
    "TW": "Asia/Taipei",
    "HK": "Asia/Hong_Kong",
    "IN": "Asia/Kolkata",
    "GB": "Europe/London",
    "FR": "Europe/Paris",
    "DE": "Europe/Berlin",
    "IT": "Europe/Rome",
    "ES": "Europe/Madrid",
    "NZ": "Pacific/Auckland",
    "AE": "Asia/Dubai",
    "SA": "Asia/Riyadh",
    "BR": "America/Sao_Paulo",
    "MX": "America/Mexico_City",
  };
  return timezoneMap[countryCode] || "UTC";
};

// Get local time for a specific timezone, with optional city name override
const getLocalTimeForTimezone = (timezone, location) => {
  try {
    const now = new Date();
    
    // Get the actual city name from the location (not from the timezone)
    let cityName = location?.city || location?.address?.city || "";
    
    // If no city found, fall back to extracting from timezone
    if (!cityName) {
      cityName = timezone.split('/')[1]?.replace('_', ' ') || timezone;
    }
    
    return {
      time: now.toLocaleTimeString('en-US', { 
        timeZone: timezone, 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      }),
      date: now.toLocaleDateString('en-US', { 
        timeZone: timezone, 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      cityName: cityName
    };
  } catch (error) {
    // Fallback to local time if timezone not supported
    const now = new Date();
    const cityName = location?.city || location?.address?.city || "Local";
    return {
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      date: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      cityName: cityName
    };
  }
};

const getCityTrafficFactor = (location) => {
  const city = location?.city || location?.address?.city || "";
  if (CITY_TRAFFIC_FACTORS[city]) return CITY_TRAFFIC_FACTORS[city];
  for (const [key, value] of Object.entries(CITY_TRAFFIC_FACTORS)) {
    if (city.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return CITY_TRAFFIC_FACTORS.default;
};

const calculateTravelTime = (distanceKm, mode, location, date = new Date()) => {
  const countryCode = getCountryCode(location);
  const baseSpeed = BASE_SPEEDS[mode] || BASE_SPEEDS.taxi;
  const timezone = getTimezone(countryCode, location);
  
  // Get hour and day of week in the destination's timezone
  let hour, dayOfWeek;
  try {
    const timeStr = date.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    const dayStr = date.toLocaleString('en-US', { timeZone: timezone, weekday: 'short' });
    hour = parseInt(timeStr);
    dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayStr);
    if (dayOfWeek === -1) dayOfWeek = date.getDay(); // Fallback
  } catch (e) {
    // Fallback to local time if timezone conversion fails
    hour = date.getHours();
    dayOfWeek = date.getDay();
  }
  
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  const timeMultiplier = getTimeMultiplier(hour, isWeekend);
  const cityFactor = getCityTrafficFactor(location);
  const holidayMultiplier = getHolidayMultiplier(date, countryCode);
  
  let trafficImpact = 1;
  if (mode === "walk") trafficImpact = 1;
  else if (mode === "train") trafficImpact = 0.9 + (timeMultiplier * 0.1);
  else trafficImpact = timeMultiplier * cityFactor * holidayMultiplier;
  
  const effectiveSpeed = baseSpeed * trafficImpact;
  const timeMinutes = Math.round((distanceKm / effectiveSpeed) * 60);
  
  return { minutes: timeMinutes, trafficLevel: trafficImpact < 0.5 ? "heavy" : trafficImpact < 0.7 ? "moderate" : "light" };
};

const calculateFare = (distanceKm, countryCode, mode = "taxi") => {
  const rates = FARE_RATES[countryCode] || FARE_RATES.default;
  let baseCost = rates.base + (rates.perKm * distanceKm);
  
  if (mode === "bus") baseCost *= PUBLIC_TRANSPORT_COST_MULTIPLIER.bus;
  if (mode === "train") baseCost *= PUBLIC_TRANSPORT_COST_MULTIPLIER.train;
  if (mode === "jeepney") baseCost *= PUBLIC_TRANSPORT_COST_MULTIPLIER.jeepney;
  
  return {
    low: Math.round(baseCost * 0.85),
    high: Math.round(baseCost * 1.15),
    currency: rates.currency,
    symbol: rates.symbol
  };
};

const getAvailableProviders = (countryCode) => {
  return Object.values(RIDESHARE_PROVIDERS).filter(provider => {
    const isInCountry = provider.countries.includes(countryCode);
    const isExcluded = provider.excludeCountries?.includes(countryCode);
    return isInCountry && !isExcluded;
  });
};

const getTrafficStatus = (date, location) => {
  const countryCode = getCountryCode(location);
  const timezone = getTimezone(countryCode, location);
  
  // Get hour and day of week in the destination's timezone
  let hour, dayOfWeek;
  try {
    const timeStr = date.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    const dayStr = date.toLocaleString('en-US', { timeZone: timezone, weekday: 'short' });
    hour = parseInt(timeStr);
    dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayStr);
    if (dayOfWeek === -1) dayOfWeek = date.getDay(); // Fallback
  } catch (e) {
    // Fallback to local time if timezone conversion fails
    hour = date.getHours();
    dayOfWeek = date.getDay();
  }
  
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const combined = getTimeMultiplier(hour, isWeekend) * getCityTrafficFactor(location) * getHolidayMultiplier(date, countryCode);
  
  if (combined < 0.35) return { text: "Extreme traffic", color: "text-red-600", bg: "bg-red-100", icon: "🔴" };
  if (combined < 0.50) return { text: "Heavy traffic", color: "text-orange-600", bg: "bg-orange-100", icon: "🟠" };
  if (combined < 0.70) return { text: "Moderate traffic", color: "text-yellow-600", bg: "bg-yellow-100", icon: "🟡" };
  return { text: "Light traffic", color: "text-green-600", bg: "bg-green-100", icon: "🟢" };
};

// Exchange rate caching
const EXCHANGE_RATE_CACHE_KEY = 'globeskimmers_exchange_rates';
const getCachedExchangeRate = async (toCurrency) => {
  try {
    const cached = localStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000 && data.rates?.[toCurrency]) {
        return data.rates[toCurrency];
      }
    }
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
    const data = await response.json();
    localStorage.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), rates: data.rates }));
    return data.rates[toCurrency] || 1;
  } catch (error) {
    const fallbackRates = { PHP: 56, SGD: 1.35, MYR: 4.7, THB: 36, JPY: 150, KRW: 1320, GBP: 0.79, EUR: 0.92, AUD: 1.55 };
    return fallbackRates[toCurrency] || 1;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function Transportation() {
  const navigate = useNavigate();
  const { activeLocation, locationMode, initialized } = useLocation();
  // Editorial design renders at BOTH widths now. Tablet widens the centered
  // column; phone keeps the existing max-w-md. Both promote section kickers to
  // Instrument Serif headings with a hairline rule — phone-tuned smaller.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  // Section label: Instrument Serif editorial heading + thin rule at every
  // width. Phone-tuned to ~fs(20); tablet keeps the larger fs(25).
  const SectionLabel = ({ children, mt = "mt-3" }) => (
    <div className={`${mt} mb-2`}>
      <h2 className="leading-tight line-clamp-2" style={{ fontFamily: ED_SERIF, fontSize: isTablet ? fs(25) : fs(20), color: ED_INK }}>{children}</h2>
      <div className="mt-2" style={{ height: 1, background: "rgba(22,17,13,.10)" }} />
    </div>
  );

  // State
  const [loading, setLoading] = useState(true);
  const [destination, setDestination] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1);
  
  // Modal states
  const [showDestinationSearch, setShowDestinationSearch] = useState(false);
  const [showAirportPicker, setShowAirportPicker] = useState(false);
  const [showSavedLocations, setShowSavedLocations] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [fromGpsLoading, setFromGpsLoading] = useState(false);
  const [fromGpsError, setFromGpsError] = useState(null);

  // "Use my current location as the starting point" — updates ONLY the FROM /
  // origin (never the destination). GPS → reverse geocode → street address +
  // city; bare coordinates as the last-resort fallback.
  const handleUseCurrentAsStart = async () => {
    setFromGpsError(null);
    setFromGpsLoading(true);
    try {
      const pos = await getCurrentPositionSmart();
      const lat = pos?.coords?.latitude;
      const lng = pos?.coords?.longitude;
      if (lat == null || lng == null) throw new Error('No coordinates');
      let name = 'Current GPS Location';
      let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      try {
        const { data } = await callWorker(ROUTE.reverseGeocode, { latitude: lat, longitude: lng });
        const fa = data?.formatted_address || '';
        if (fa) {
          const idx = fa.indexOf(',');
          if (idx > 0) { name = fa.slice(0, idx).trim(); address = fa.slice(idx + 1).trim(); }
          else { name = fa; }
        } else if (data?.city) {
          name = data.city;
          address = [data.state_or_country, data.country].filter(Boolean)[0] || address;
        }
      } catch { /* keep the coordinate fallback */ }
      setOrigin({ name, address, latitude: lat, longitude: lng });
    } catch (e) {
      const denied = e?.code === 1 || /denied|permission/i.test(e?.message || '');
      setFromGpsError(denied
        ? 'Location access is needed to update your starting point.'
        : "Couldn't update your starting point. Try again or choose a location manually.");
    } finally {
      setFromGpsLoading(false);
    }
  };
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [nearbyAirports, setNearbyAirports] = useState([]);
  const [loadingAirports, setLoadingAirports] = useState(false);
  
  // Route info from AI
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRouteInfo, setLoadingRouteInfo] = useState(false);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const userData = await base44.auth.me();
          setUser(userData);
          setSavedLocations(userData.saved_locations || []);
        }
      } catch (error) {
        console.error('Auth error:', error);
      }
      
      if (activeLocation) {
        // Handle different location structures (from GPS vs saved locations)
        const locationName = activeLocation.placeName || 
                            activeLocation.city || 
                            activeLocation.address?.city ||
                            "Current Location";
        const locationAddress = activeLocation.address?.formatted || 
                               `${activeLocation.city || ''}, ${activeLocation.address?.country || ''}`.trim();
        const lat = activeLocation.coordinates?.latitude || activeLocation.latitude;
        const lng = activeLocation.coordinates?.longitude || activeLocation.longitude;
        
        setOrigin({
          name: locationName,
          address: locationAddress,
          latitude: lat,
          longitude: lng
        });
        
        const countryCode = getCountryCode(activeLocation);
        const rates = FARE_RATES[countryCode] || FARE_RATES.default;
        const rate = await getCachedExchangeRate(rates.currency);
        setExchangeRate(rate);
      }
      
      setLoading(false);
    };
    
    if (initialized) init();
  }, [initialized, activeLocation]);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Listen for location changes from the LocationModePicker
  useEffect(() => {
    const handleLocationChange = (event) => {
      const { location } = event.detail;
      if (location) {
        const locationName = location.placeName || 
                            location.city || 
                            location.address?.city ||
                            "Current Location";
        const locationAddress = location.address?.formatted || 
                               `${location.city || ''}, ${location.address?.country || ''}`.trim();
        const lat = location.coordinates?.latitude || location.latitude;
        const lng = location.coordinates?.longitude || location.longitude;
        
        setOrigin({
          name: locationName,
          address: locationAddress,
          latitude: lat,
          longitude: lng
        });
        
        // Reset destination when location changes
        setDestination(null);
        setRouteInfo(null);
      }
    };

    window.addEventListener('location:changed', handleLocationChange);
    return () => window.removeEventListener('location:changed', handleLocationChange);
  }, []);

  // Fetch route info when destination changes
  useEffect(() => {
    if (destination && origin && activeLocation) {
      fetchRouteInfo();
    }
  }, [destination]);

  // Search for places - WITH CACHING
  const searchPlaces = async (query) => {
    if (!query || query.length < 3 || !activeLocation) return;
    
    const lat = activeLocation.coordinates?.latitude || activeLocation.latitude;
    const lng = activeLocation.coordinates?.longitude || activeLocation.longitude;
    
    // Check local cache first
    const cached = getCachedLocationSearch(query, lat, lng);
    if (cached) {
      setSearchResults(cached);
      return;
    }
    
    setSearching(true);
    try {
      // Try Worker cached search first
      try {
        const workerResponse = await fetch(
          `${WORKER_URL}/search-location?` +
          `query=${encodeURIComponent(query)}` +
          `&latitude=${lat}&longitude=${lng}`
        );
        
        if (workerResponse.ok) {
          const workerData = await workerResponse.json();
          if (workerData.success && workerData.results) {
            const results = workerData.results.slice(0, 8).map(place => ({
              name: place.placeName || place.city || place.full_name,
              address: place.address?.formatted || place.full_name,
              latitude: place.coordinates?.latitude || place.latitude,
              longitude: place.coordinates?.longitude || place.longitude
            }));
            
            // Cache locally
            setCachedLocationSearch(query, lat, lng, results);
            setSearchResults(results);
            setSearching(false);
            return;
          }
        }
      } catch (workerError) {
        console.warn('Worker search failed, using base44:', workerError);
      }
      
      // Fallback to base44
      const { data } = await callWorker(ROUTE.searchLocation, {
        query,
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude
      });
      
      if (data?.results) {
        const results = data.results.slice(0, 8).map(place => ({
          name: place.placeName || place.city || place.full_name,
          address: place.address?.formatted || place.full_name,
          latitude: place.coordinates?.latitude || place.latitude,
          longitude: place.coordinates?.longitude || place.longitude
        }));
        
        // Cache locally
        setCachedLocationSearch(query, lat, lng, results);
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
    setSearching(false);
  };

  // ============================================================================
  // LUZON PHILIPPINES SPECIAL CASE - Show NAIA Terminals instead of airports
  // ============================================================================
  const LUZON_CITIES_PROVINCES = [
    // Metro Manila
    "manila", "makati", "quezon city", "pasig", "taguig", "paranaque", "pasay",
    "mandaluyong", "san juan", "marikina", "caloocan", "malabon", "navotas",
    "valenzuela", "las pinas", "muntinlupa", "pateros", "metro manila",
    // Calabarzon
    "cavite", "laguna", "batangas", "rizal", "quezon", "lucena", "antipolo",
    "bacoor", "imus", "dasmarinas", "general trias", "tagaytay", "taal",
    "calamba", "santa rosa", "binan", "san pedro", "cabuyao", "los banos",
    "lipa", "batangas city", "tanauan", "san pablo", "cainta", "taytay",
    // Central Luzon
    "bulacan", "pampanga", "nueva ecija", "tarlac", "zambales", "bataan", "aurora",
    "angeles", "san fernando", "malolos", "meycauayan", "san jose del monte",
    "cabanatuan", "palayan", "tarlac city", "olongapo", "subic", "balanga",
    // Ilocos Region
    "pangasinan", "la union", "ilocos sur", "ilocos norte", "dagupan",
    "san fernando la union", "vigan", "laoag", "alaminos", "urdaneta",
    // Cagayan Valley
    "cagayan", "isabela", "nueva vizcaya", "quirino", "batanes", "tuguegarao",
    "ilagan", "santiago", "bayombong", "cauayan",
    // Cordillera
    "baguio", "benguet", "abra", "apayao", "ifugao", "kalinga", "mountain province",
    // Bicol Region  
    "albay", "camarines sur", "camarines norte", "sorsogon", "catanduanes", "masbate",
    "legazpi", "naga", "iriga", "tabaco", "ligao", "sorsogon city", "masbate city"
  ];

  // NAIA 4 Terminals with specific locations
  const NAIA_TERMINALS = [
    {
      name: "NAIA Terminal 1",
      address: "Andrews Avenue, Pasay City, Metro Manila (International flights - various airlines)",
      latitude: 14.5103,
      longitude: 121.0195,
      isInternational: true,
      terminal: 1,
      airlines: "International flights: Japan Airlines, Korean Air, Emirates, Qatar Airways, etc."
    },
    {
      name: "NAIA Terminal 2 (Centennial Terminal)",
      address: "Ninoy Aquino Avenue, Pasay City, Metro Manila (Philippine Airlines exclusive)",
      latitude: 14.5171,
      longitude: 121.0198,
      isInternational: true,
      terminal: 2,
      airlines: "Philippine Airlines (PAL) - Domestic & International"
    },
    {
      name: "NAIA Terminal 3",
      address: "Newport Boulevard, Pasay City, Metro Manila (Main International Terminal)",
      latitude: 14.5074,
      longitude: 121.0215,
      isInternational: true,
      terminal: 3,
      airlines: "Cebu Pacific, AirAsia, Delta, Singapore Airlines, Cathay Pacific, etc."
    },
    {
      name: "NAIA Terminal 4 (Domestic)",
      address: "Domestic Road, Pasay City, Metro Manila (Domestic flights)",
      latitude: 14.5158,
      longitude: 121.0136,
      isInternational: false,
      terminal: 4,
      airlines: "Domestic flights: AirSWIFT, Sunlight Air, etc."
    }
  ];

  // ============================================================================
  // MAJOR HUB AIRPORTS DATABASE - Main international gateway airports by region
  // ============================================================================
  const MAJOR_HUB_AIRPORTS = {
    // USA - Major Metropolitan Hubs
    US: [
      // Los Angeles Metro (covers LA, Orange County, Inland Empire, Ventura)
      { 
        name: "Los Angeles International Airport (LAX)", 
        address: "1 World Way, Los Angeles, CA 90045, USA",
        latitude: 33.9425, longitude: -118.4081,
        isInternational: true, isMajorHub: true,
        coverageRadius: 150, // km - covers greater LA area
        metroKeywords: ["los angeles", "la", "hollywood", "beverly hills", "santa monica", "pasadena", "glendale", "burbank", "long beach", "anaheim", "irvine", "orange", "arcadia", "azusa", "covina", "pomona", "ontario", "riverside", "san bernardino", "torrance", "inglewood", "compton", "downey", "norwalk", "whittier", "fullerton", "costa mesa", "newport beach", "huntington beach", "santa ana", "garden grove", "westwood", "culver city", "el monte", "alhambra", "monrovia", "duarte", "glendora", "claremont", "upland", "rancho cucamonga", "fontana", "redlands", "ventura", "oxnard", "thousand oaks", "simi valley", "calabasas", "malibu"]
      },
      // San Francisco Bay Area
      { 
        name: "San Francisco International Airport (SFO)", 
        address: "San Francisco, CA 94128, USA",
        latitude: 37.6213, longitude: -122.3790,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["san francisco", "sf", "oakland", "berkeley", "san jose", "palo alto", "mountain view", "sunnyvale", "santa clara", "fremont", "hayward", "richmond", "daly city", "south san francisco", "san mateo", "redwood city", "menlo park", "cupertino", "milpitas", "union city", "pleasanton", "livermore", "walnut creek", "concord", "san rafael", "sausalito", "vallejo", "napa", "santa rosa"]
      },
      // New York Metro
      { 
        name: "John F. Kennedy International Airport (JFK)", 
        address: "Queens, NY 11430, USA",
        latitude: 40.6413, longitude: -73.7781,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["new york", "nyc", "manhattan", "brooklyn", "queens", "bronx", "staten island", "jersey city", "newark", "hoboken", "yonkers", "white plains", "new rochelle", "stamford", "long island", "nassau", "suffolk", "westchester"]
      },
      // Chicago Metro
      { 
        name: "Chicago O'Hare International Airport (ORD)", 
        address: "10000 W O'Hare Ave, Chicago, IL 60666, USA",
        latitude: 41.9742, longitude: -87.9073,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["chicago", "evanston", "oak park", "cicero", "naperville", "aurora", "joliet", "elgin", "waukegan", "schaumburg", "arlington heights", "skokie", "des plaines", "oak lawn", "berwyn", "orland park", "tinley park", "downers grove", "wheaton", "lombard"]
      },
      // Miami/South Florida
      { 
        name: "Miami International Airport (MIA)", 
        address: "2100 NW 42nd Ave, Miami, FL 33142, USA",
        latitude: 25.7959, longitude: -80.2870,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["miami", "fort lauderdale", "hollywood", "hialeah", "coral gables", "miami beach", "boca raton", "pompano beach", "deerfield beach", "plantation", "sunrise", "davie", "pembroke pines", "miramar", "homestead", "kendall", "doral", "aventura", "key biscayne"]
      },
      // Dallas/Fort Worth
      { 
        name: "Dallas/Fort Worth International Airport (DFW)", 
        address: "2400 Aviation Dr, DFW Airport, TX 75261, USA",
        latitude: 32.8998, longitude: -97.0403,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["dallas", "fort worth", "arlington", "plano", "irving", "garland", "grand prairie", "mckinney", "frisco", "denton", "richardson", "carrollton", "lewisville", "allen", "flower mound", "rowlett", "mesquite", "euless", "bedford", "hurst", "grapevine", "coppell", "southlake"]
      },
      // Atlanta
      { 
        name: "Hartsfield-Jackson Atlanta International Airport (ATL)", 
        address: "6000 N Terminal Pkwy, Atlanta, GA 30320, USA",
        latitude: 33.6407, longitude: -84.4277,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["atlanta", "marietta", "roswell", "sandy springs", "alpharetta", "johns creek", "smyrna", "dunwoody", "brookhaven", "decatur", "lawrenceville", "duluth", "kennesaw", "peachtree city", "newnan", "carrollton", "gainesville"]
      },
      // Seattle
      { 
        name: "Seattle-Tacoma International Airport (SEA)", 
        address: "17801 International Blvd, Seattle, WA 98158, USA",
        latitude: 47.4502, longitude: -122.3088,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["seattle", "tacoma", "bellevue", "everett", "kent", "renton", "federal way", "kirkland", "redmond", "auburn", "sammamish", "lakewood", "shoreline", "burien", "olympia", "bellingham"]
      },
      // Boston
      { 
        name: "Boston Logan International Airport (BOS)", 
        address: "1 Harborside Dr, Boston, MA 02128, USA",
        latitude: 42.3656, longitude: -71.0096,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["boston", "cambridge", "somerville", "quincy", "newton", "brookline", "worcester", "lowell", "springfield", "lynn", "framingham", "haverhill", "malden", "medford", "waltham", "brockton", "plymouth", "providence"]
      },
      // Denver
      { 
        name: "Denver International Airport (DEN)", 
        address: "8500 Peña Blvd, Denver, CO 80249, USA",
        latitude: 39.8561, longitude: -104.6737,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["denver", "aurora", "lakewood", "thornton", "arvada", "westminster", "centennial", "boulder", "fort collins", "pueblo", "colorado springs", "greeley", "longmont", "loveland", "broomfield", "castle rock", "littleton", "englewood", "parker"]
      },
      // Washington DC
      { 
        name: "Washington Dulles International Airport (IAD)", 
        address: "1 Saarinen Cir, Dulles, VA 20166, USA",
        latitude: 38.9531, longitude: -77.4565,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["washington", "dc", "arlington", "alexandria", "bethesda", "silver spring", "rockville", "fairfax", "reston", "tysons", "mclean", "falls church", "vienna", "herndon", "manassas", "fredericksburg", "baltimore", "annapolis", "columbia"]
      },
      // Houston
      { 
        name: "George Bush Intercontinental Airport (IAH)", 
        address: "2800 N Terminal Rd, Houston, TX 77032, USA",
        latitude: 29.9902, longitude: -95.3368,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["houston", "sugar land", "the woodlands", "pearland", "league city", "baytown", "pasadena", "missouri city", "conroe", "galveston", "texas city", "friendswood", "katy", "humble", "spring", "tomball", "cypress"]
      },
      // Phoenix
      { 
        name: "Phoenix Sky Harbor International Airport (PHX)", 
        address: "3400 E Sky Harbor Blvd, Phoenix, AZ 85034, USA",
        latitude: 33.4373, longitude: -112.0078,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["phoenix", "scottsdale", "mesa", "tempe", "chandler", "gilbert", "glendale", "peoria", "surprise", "goodyear", "avondale", "buckeye", "cave creek", "fountain hills", "paradise valley", "sedona", "flagstaff", "tucson"]
      },
      // San Diego
      { 
        name: "San Diego International Airport (SAN)", 
        address: "3225 N Harbor Dr, San Diego, CA 92101, USA",
        latitude: 32.7336, longitude: -117.1897,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["san diego", "chula vista", "oceanside", "escondido", "carlsbad", "el cajon", "vista", "san marcos", "encinitas", "national city", "la mesa", "santee", "poway", "coronado", "imperial beach", "del mar", "solana beach", "la jolla", "tijuana"]
      },
      // Las Vegas
      { 
        name: "Harry Reid International Airport (LAS)", 
        address: "5757 Wayne Newton Blvd, Las Vegas, NV 89119, USA",
        latitude: 36.0840, longitude: -115.1537,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["las vegas", "henderson", "north las vegas", "paradise", "spring valley", "sunrise manor", "enterprise", "summerlin", "boulder city", "mesquite", "pahrump"]
      },
      // Orlando
      { 
        name: "Orlando International Airport (MCO)", 
        address: "1 Jeff Fuqua Blvd, Orlando, FL 32827, USA",
        latitude: 28.4312, longitude: -81.3081,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["orlando", "kissimmee", "sanford", "lake mary", "winter park", "altamonte springs", "oviedo", "apopka", "clermont", "daytona beach", "deltona", "melbourne", "palm bay", "cocoa beach", "titusville", "disney", "universal"]
      },
      // Minneapolis
      { 
        name: "Minneapolis-Saint Paul International Airport (MSP)", 
        address: "4300 Glumack Dr, St Paul, MN 55111, USA",
        latitude: 44.8848, longitude: -93.2223,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["minneapolis", "saint paul", "st paul", "bloomington", "brooklyn park", "plymouth", "maple grove", "eagan", "eden prairie", "burnsville", "blaine", "lakeville", "coon rapids", "woodbury", "minnetonka", "shakopee", "rochester"]
      },
      // Detroit
      { 
        name: "Detroit Metropolitan Wayne County Airport (DTW)", 
        address: "11050 Rogell Dr, Detroit, MI 48242, USA",
        latitude: 42.2162, longitude: -83.3554,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["detroit", "warren", "sterling heights", "ann arbor", "dearborn", "livonia", "troy", "westland", "farmington hills", "southfield", "royal oak", "pontiac", "taylor", "st clair shores", "novi", "ypsilanti", "canton", "rochester hills"]
      },
      // Philadelphia
      { 
        name: "Philadelphia International Airport (PHL)", 
        address: "8000 Essington Ave, Philadelphia, PA 19153, USA",
        latitude: 39.8744, longitude: -75.2424,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["philadelphia", "philly", "camden", "chester", "wilmington", "norristown", "allentown", "reading", "trenton", "cherry hill", "king of prussia", "media", "upper darby", "bensalem", "levittown", "abington", "doylestown"]
      },
      // Honolulu
      { 
        name: "Daniel K. Inouye International Airport (HNL)", 
        address: "300 Rodgers Blvd, Honolulu, HI 96819, USA",
        latitude: 21.3187, longitude: -157.9225,
        isInternational: true, isMajorHub: true,
        coverageRadius: 50,
        metroKeywords: ["honolulu", "pearl city", "hilo", "kailua", "kaneohe", "waipahu", "mililani", "ewa beach", "kapolei", "aiea", "hawaii", "oahu", "waikiki"]
      },
    ],
    // CANADA
    CA: [
      { 
        name: "Toronto Pearson International Airport (YYZ)", 
        address: "6301 Silver Dart Dr, Mississauga, ON L5P 1B2, Canada",
        latitude: 43.6777, longitude: -79.6248,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["toronto", "mississauga", "brampton", "markham", "vaughan", "richmond hill", "oakville", "burlington", "hamilton", "oshawa", "pickering", "ajax", "whitby", "newmarket", "aurora", "scarborough", "etobicoke", "north york"]
      },
      { 
        name: "Vancouver International Airport (YVR)", 
        address: "3211 Grant McConachie Way, Richmond, BC V7B 0A4, Canada",
        latitude: 49.1951, longitude: -123.1779,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["vancouver", "burnaby", "richmond", "surrey", "coquitlam", "langley", "delta", "north vancouver", "west vancouver", "new westminster", "port coquitlam", "maple ridge", "abbotsford", "victoria", "whistler"]
      },
      { 
        name: "Montréal-Pierre Elliott Trudeau International Airport (YUL)", 
        address: "975 Roméo-Vachon Blvd N, Dorval, QC H4Y 1H1, Canada",
        latitude: 45.4706, longitude: -73.7408,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["montreal", "laval", "longueuil", "gatineau", "brossard", "terrebonne", "repentigny", "saint-jerome", "drummondville", "granby", "quebec city", "sherbrooke", "trois-rivieres"]
      },
    ],
    // UK
    GB: [
      { 
        name: "London Heathrow Airport (LHR)", 
        address: "Longford TW6, United Kingdom",
        latitude: 51.4700, longitude: -0.4543,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["london", "westminster", "camden", "kensington", "chelsea", "hackney", "islington", "southwark", "lambeth", "wandsworth", "hammersmith", "fulham", "tower hamlets", "greenwich", "lewisham", "bromley", "croydon", "barnet", "ealing", "hounslow", "richmond", "kingston", "merton", "sutton", "bexley", "havering", "redbridge", "waltham forest", "enfield", "haringey", "newham", "barking", "dagenham", "hillingdon", "harrow", "brent", "reading", "slough", "windsor", "watford", "st albans", "luton", "brighton", "oxford", "cambridge", "guildford", "woking", "epsom"]
      },
      { 
        name: "Manchester Airport (MAN)", 
        address: "Manchester M90 1QX, United Kingdom",
        latitude: 53.3537, longitude: -2.2750,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["manchester", "salford", "stockport", "bolton", "bury", "oldham", "rochdale", "wigan", "tameside", "trafford", "liverpool", "leeds", "sheffield", "bradford", "preston", "blackpool", "chester", "warrington"]
      },
    ],
    // GERMANY
    DE: [
      { 
        name: "Frankfurt Airport (FRA)", 
        address: "60547 Frankfurt am Main, Germany",
        latitude: 50.0379, longitude: 8.5622,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["frankfurt", "mainz", "wiesbaden", "darmstadt", "offenbach", "hanau", "heidelberg", "mannheim", "kassel", "giessen", "marburg", "fulda", "aschaffenburg", "bad homburg", "kronberg"]
      },
      { 
        name: "Munich Airport (MUC)", 
        address: "85356 Munich, Germany",
        latitude: 48.3537, longitude: 11.7750,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["munich", "münchen", "augsburg", "nuremberg", "regensburg", "ingolstadt", "freising", "erding", "rosenheim", "landshut", "passau", "salzburg"]
      },
    ],
    // FRANCE
    FR: [
      { 
        name: "Paris Charles de Gaulle Airport (CDG)", 
        address: "95700 Roissy-en-France, France",
        latitude: 49.0097, longitude: 2.5479,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["paris", "versailles", "boulogne", "saint-denis", "montreuil", "argenteuil", "nanterre", "creteil", "vitry", "champigny", "drancy", "noisy", "aubervilliers", "pantin", "aulnay", "colombes", "courbevoie", "rueil", "meaux", "fontainebleau", "melun", "evry", "marne la vallee", "disneyland"]
      },
    ],
    // JAPAN
    JP: [
      { 
        name: "Tokyo Narita International Airport (NRT)", 
        address: "1-1 Furugome, Narita, Chiba 282-0004, Japan",
        latitude: 35.7647, longitude: 140.3864,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["tokyo", "shibuya", "shinjuku", "ginza", "roppongi", "akihabara", "ikebukuro", "ueno", "asakusa", "odaiba", "yokohama", "kawasaki", "chiba", "saitama", "omiya", "funabashi", "machida", "hachioji", "tachikawa", "mitaka", "musashino"]
      },
      { 
        name: "Kansai International Airport (KIX)", 
        address: "1 Senshu-kuko Kita, Izumisano, Osaka 549-0001, Japan",
        latitude: 34.4347, longitude: 135.2441,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["osaka", "kyoto", "kobe", "nara", "sakai", "himeji", "wakayama", "otsu", "takatsuki", "suita", "toyonaka", "higashiosaka", "amagasaki", "nishinomiya", "ashiya"]
      },
    ],
    // SOUTH KOREA
    KR: [
      { 
        name: "Incheon International Airport (ICN)", 
        address: "272 Gonghang-ro, Jung-gu, Incheon, South Korea",
        latitude: 37.4602, longitude: 126.4407,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["seoul", "incheon", "suwon", "seongnam", "goyang", "yongin", "bucheon", "ansan", "anyang", "namyangju", "hwaseong", "uijeongbu", "siheung", "gwangmyeong", "gunpo", "hanam", "icheon", "osan", "pyeongtaek", "gangnam", "hongdae", "itaewon", "myeongdong"]
      },
    ],
    // CHINA
    CN: [
      { 
        name: "Beijing Capital International Airport (PEK)", 
        address: "Shunyi District, Beijing, China",
        latitude: 40.0799, longitude: 116.6031,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["beijing", "tianjin", "hebei", "chaoyang", "haidian", "dongcheng", "xicheng", "fengtai", "shijingshan", "tongzhou", "shunyi", "changping", "daxing"]
      },
      { 
        name: "Shanghai Pudong International Airport (PVG)", 
        address: "Pudong, Shanghai, China",
        latitude: 31.1443, longitude: 121.8083,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["shanghai", "pudong", "puxi", "hongqiao", "jing'an", "xuhui", "huangpu", "changning", "putuo", "yangpu", "minhang", "baoshan", "jiading", "songjiang", "qingpu", "fengxian", "jinshan", "suzhou", "hangzhou", "wuxi", "nanjing"]
      },
      { 
        name: "Hong Kong International Airport (HKG)", 
        address: "1 Sky Plaza Rd, Chek Lap Kok, Hong Kong",
        latitude: 22.3080, longitude: 113.9185,
        isInternational: true, isMajorHub: true,
        coverageRadius: 60,
        metroKeywords: ["hong kong", "kowloon", "tsim sha tsui", "mong kok", "wan chai", "central", "causeway bay", "admiralty", "north point", "tseung kwan o", "sha tin", "tai po", "yuen long", "tuen mun", "tsuen wan", "lantau", "macau", "zhuhai", "shenzhen", "guangzhou"]
      },
    ],
    // SINGAPORE
    SG: [
      { 
        name: "Singapore Changi Airport (SIN)", 
        address: "Airport Blvd, Singapore 819643",
        latitude: 1.3644, longitude: 103.9915,
        isInternational: true, isMajorHub: true,
        coverageRadius: 50,
        metroKeywords: ["singapore", "changi", "orchard", "marina bay", "sentosa", "jurong", "tampines", "woodlands", "bedok", "ang mo kio", "bishan", "toa payoh", "clementi", "bukit timah", "holland village", "geylang", "little india", "chinatown", "johor bahru", "batam"]
      },
    ],
    // THAILAND
    TH: [
      { 
        name: "Suvarnabhumi International Airport (BKK)", 
        address: "999 Nong Prue, Bang Phli, Samut Prakan 10540, Thailand",
        latitude: 13.6900, longitude: 100.7501,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["bangkok", "pattaya", "nonthaburi", "pak kret", "samut prakan", "pathum thani", "ayutthaya", "nakhon pathom", "samut sakhon", "hua hin", "kanchanaburi", "sukhumvit", "silom", "siam", "chatuchak", "thonburi", "rattanakosin"]
      },
    ],
    // AUSTRALIA
    AU: [
      { 
        name: "Sydney Kingsford Smith Airport (SYD)", 
        address: "Airport Dr, Mascot NSW 2020, Australia",
        latitude: -33.9399, longitude: 151.1753,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["sydney", "parramatta", "penrith", "liverpool", "campbelltown", "blacktown", "hornsby", "sutherland", "bankstown", "canterbury", "hurstville", "bondi", "manly", "cronulla", "newcastle", "wollongong", "central coast", "blue mountains"]
      },
      { 
        name: "Melbourne Airport (MEL)", 
        address: "Departure Dr, Melbourne Airport VIC 3045, Australia",
        latitude: -37.6690, longitude: 144.8410,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["melbourne", "geelong", "ballarat", "bendigo", "frankston", "dandenong", "doncaster", "ringwood", "footscray", "st kilda", "south yarra", "prahran", "richmond", "fitzroy", "carlton", "brunswick", "coburg", "preston", "heidelberg", "box hill", "glen waverley"]
      },
    ],
    // UAE
    AE: [
      { 
        name: "Dubai International Airport (DXB)", 
        address: "Dubai, United Arab Emirates",
        latitude: 25.2528, longitude: 55.3644,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["dubai", "sharjah", "ajman", "deira", "bur dubai", "jumeirah", "marina", "downtown", "business bay", "palm jumeirah", "jbr", "al barsha", "silicon oasis", "academic city", "sports city", "motor city", "discovery gardens", "jlt", "abu dhabi"]
      },
    ],
    // INDIA
    IN: [
      { 
        name: "Indira Gandhi International Airport (DEL)", 
        address: "New Delhi, Delhi 110037, India",
        latitude: 28.5562, longitude: 77.1000,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["delhi", "new delhi", "gurgaon", "gurugram", "noida", "faridabad", "ghaziabad", "greater noida", "dwarka", "rohini", "karol bagh", "connaught place", "saket", "south delhi", "vasant kunj", "nehru place", "lajpat nagar"]
      },
      { 
        name: "Chhatrapati Shivaji Maharaj International Airport (BOM)", 
        address: "Mumbai, Maharashtra 400099, India",
        latitude: 19.0896, longitude: 72.8656,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["mumbai", "bombay", "thane", "navi mumbai", "kalyan", "dombivli", "ulhasnagar", "mira-bhayandar", "bhiwandi", "vasai-virar", "panvel", "pune", "andheri", "bandra", "juhu", "colaba", "worli", "lower parel", "powai", "goregaon", "borivali", "malad"]
      },
    ],
    // MEXICO
    MX: [
      { 
        name: "Mexico City International Airport (MEX)", 
        address: "Av. Capitán Carlos León S/N, Peñón de los Baños, 15620 Ciudad de México, CDMX, Mexico",
        latitude: 19.4363, longitude: -99.0721,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["mexico city", "ciudad de mexico", "cdmx", "guadalajara", "monterrey", "polanco", "condesa", "roma", "coyoacan", "san angel", "santa fe", "tlalpan", "xochimilco", "iztapalapa", "ecatepec", "naucalpan", "tlalnepantla", "cuautitlan", "nezahualcoyotl"]
      },
    ],
    // BRAZIL
    BR: [
      { 
        name: "São Paulo/Guarulhos International Airport (GRU)", 
        address: "Rod. Hélio Smidt, s/nº - Cumbica, Guarulhos - SP, 07190-100, Brazil",
        latitude: -23.4356, longitude: -46.4731,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["sao paulo", "são paulo", "guarulhos", "osasco", "santo andre", "sao bernardo", "diadema", "maua", "mogi das cruzes", "suzano", "itaquaquecetuba", "taboao da serra", "embu", "barueri", "santana de parnaiba", "paulista", "pinheiros", "vila madalena", "moema", "itaim bibi", "jardins"]
      },
    ],
    // NETHERLANDS
    NL: [
      { 
        name: "Amsterdam Airport Schiphol (AMS)", 
        address: "Evert van de Beekstraat 202, 1118 CP Schiphol, Netherlands",
        latitude: 52.3105, longitude: 4.7683,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["amsterdam", "rotterdam", "the hague", "den haag", "utrecht", "eindhoven", "haarlem", "almere", "zaanstad", "amersfoort", "leiden", "dordrecht", "breda", "groningen", "nijmegen", "enschede", "tilburg", "arnhem"]
      },
    ],
    // SPAIN
    ES: [
      { 
        name: "Adolfo Suárez Madrid–Barajas Airport (MAD)", 
        address: "Av de la Hispanidad, s/n, 28042 Madrid, Spain",
        latitude: 40.4983, longitude: -3.5676,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["madrid", "barcelona", "valencia", "sevilla", "seville", "malaga", "zaragoza", "murcia", "palma", "bilbao", "alicante", "cordoba", "granada", "toledo", "segovia", "salamanca", "alcala", "getafe", "mostoles", "leganes", "fuenlabrada", "alcorcon"]
      },
    ],
    // ITALY
    IT: [
      { 
        name: "Leonardo da Vinci–Fiumicino Airport (FCO)", 
        address: "Via dell'Aeroporto di Fiumicino, 320, 00054 Fiumicino RM, Italy",
        latitude: 41.8003, longitude: 12.2389,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["rome", "roma", "vatican", "trastevere", "termini", "colosseum", "pantheon", "spanish steps", "trevi", "piazza navona", "ostia", "tivoli", "frascati", "ciampino", "viterbo", "rieti", "latina", "civitavecchia"]
      },
      { 
        name: "Milan Malpensa Airport (MXP)", 
        address: "21010 Ferno, Varese VA, Italy",
        latitude: 45.6306, longitude: 8.7281,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["milan", "milano", "bergamo", "brescia", "como", "monza", "pavia", "varese", "lecco", "cremona", "mantova", "lodi", "sondrio", "duomo", "navigli", "brera", "porta nuova", "san siro", "cinisello", "sesto san giovanni"]
      },
    ],
    // NEW ZEALAND
    NZ: [
      { 
        name: "Auckland Airport (AKL)", 
        address: "Ray Emery Dr, Auckland Airport, Auckland 2022, New Zealand",
        latitude: -37.0082, longitude: 174.7850,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["auckland", "north shore", "manukau", "waitakere", "henderson", "albany", "takapuna", "newmarket", "ponsonby", "parnell", "mt eden", "grey lynn", "remuera", "mission bay", "devonport", "hamilton", "tauranga", "rotorua"]
      },
    ],
    // INDONESIA
    ID: [
      { 
        name: "Soekarno-Hatta International Airport (CGK)", 
        address: "Pajang, Kec. Benda, Kota Tangerang, Banten 15126, Indonesia",
        latitude: -6.1256, longitude: 106.6559,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["jakarta", "tangerang", "bekasi", "depok", "bogor", "south tangerang", "menteng", "kemang", "senayan", "kuningan", "sudirman", "thamrin", "ancol", "kelapa gading", "pik", "bsd", "serpong", "alam sutera", "karawang", "cikarang"]
      },
    ],
    // MALAYSIA
    MY: [
      { 
        name: "Kuala Lumpur International Airport (KUL)", 
        address: "64000 KLIA, Selangor, Malaysia",
        latitude: 2.7456, longitude: 101.7099,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["kuala lumpur", "kl", "petaling jaya", "subang jaya", "shah alam", "klang", "ampang", "cheras", "puchong", "kajang", "seremban", "putrajaya", "cyberjaya", "bukit bintang", "klcc", "bangsar", "mont kiara", "damansara", "sunway", "setia alam", "rawang", "sungai buloh"]
      },
    ],
    // VIETNAM
    VN: [
      { 
        name: "Tan Son Nhat International Airport (SGN)", 
        address: "Truong Son, Tan Binh, Ho Chi Minh City, Vietnam",
        latitude: 10.8188, longitude: 106.6519,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["ho chi minh", "ho chi minh city", "saigon", "district 1", "district 2", "district 3", "district 7", "binh thanh", "phu nhuan", "tan binh", "go vap", "thu duc", "binh duong", "dong nai", "long an", "vung tau", "ben tre", "can tho"]
      },
    ],
    // TAIWAN
    TW: [
      { 
        name: "Taiwan Taoyuan International Airport (TPE)", 
        address: "No. 9, Hangzhan S. Rd., Dayuan Dist., Taoyuan City 337, Taiwan",
        latitude: 25.0797, longitude: 121.2342,
        isInternational: true, isMajorHub: true,
        coverageRadius: 80,
        metroKeywords: ["taipei", "taoyuan", "new taipei", "keelung", "hsinchu", "zhongzheng", "da'an", "xinyi", "zhongshan", "songshan", "wanhua", "datong", "shilin", "beitou", "neihu", "nangang", "wenshan", "banqiao", "yonghe", "zhonghe", "sanchong", "xinzhuang", "tucheng", "luzhou"]
      },
    ],
    // SOUTH AFRICA
    ZA: [
      { 
        name: "O.R. Tambo International Airport (JNB)", 
        address: "1 Jones Rd, Kempton Park, Johannesburg, 1627, South Africa",
        latitude: -26.1367, longitude: 28.2411,
        isInternational: true, isMajorHub: true,
        coverageRadius: 100,
        metroKeywords: ["johannesburg", "pretoria", "soweto", "sandton", "midrand", "centurion", "randburg", "roodepoort", "kempton park", "boksburg", "benoni", "springs", "alberton", "germiston", "edenvale", "bedfordview", "fourways", "sunninghill", "rosebank", "melrose"]
      },
    ],
  };

  // Check if location is in Luzon, Philippines
  const isInLuzon = (location) => {
    if (!location) return false;
    
    const countryCode = getCountryCode(location);
    if (countryCode !== "PH") return false;
    
    const city = (location.city || location.address?.city || "").toLowerCase();
    const region = (location.address?.region || location.address?.state || "").toLowerCase();
    const fullAddress = (location.address?.formatted || "").toLowerCase();
    
    // Check if city/region matches any Luzon location
    for (const luzonPlace of LUZON_CITIES_PROVINCES) {
      if (city.includes(luzonPlace) || 
          region.includes(luzonPlace) || 
          fullAddress.includes(luzonPlace) ||
          luzonPlace.includes(city)) {
        return true;
      }
    }
    
    // Also check by coordinates (rough bounding box for Luzon)
    // Luzon roughly: Lat 12.0 to 19.5, Lng 119.5 to 126.5
    const lat = location.latitude;
    const lng = location.longitude;
    if (lat && lng) {
      if (lat >= 12.0 && lat <= 19.5 && lng >= 119.5 && lng <= 126.5) {
        // Additional check: exclude Visayas/Mindanao coordinates
        // Visayas is roughly below lat 12.5 with lng around 123-125
        if (lat < 12.5 && lng > 123) {
          return false; // Likely Visayas
        }
        return true;
      }
    }
    
    return false;
  };

  // Get NAIA terminals with distances
  const getNAIATerminals = (userLat, userLng) => {
    return NAIA_TERMINALS.map(terminal => {
      const distance = calculateDistance(userLat, userLng, terminal.latitude, terminal.longitude);
      return {
        ...terminal,
        distance: distance,
        distanceMiles: (distance * 0.621371).toFixed(1)
      };
    }).sort((a, b) => a.distance - b.distance);
  };

  // Search for nearby airports (TOP 3) - With Luzon/NAIA special case
  const searchNearbyAirports = async () => {
    if (!origin || !activeLocation) return;
    
    setLoadingAirports(true);
    setShowAirportPicker(true);
    
    try {
      // SPECIAL CASE: If in Luzon, Philippines - show NAIA terminals
      if (isInLuzon(activeLocation)) {
        const naiaTerminals = getNAIATerminals(origin.latitude, origin.longitude);
        setNearbyAirports(naiaTerminals);
        setLoadingAirports(false);
        return;
      }
      
      // Get city and country for better search context
      const city = activeLocation.city || activeLocation.address?.city || "";
      const country = activeLocation.address?.country || "";
      const countryCode = getCountryCode(activeLocation);
      const userCity = city.toLowerCase();

      let airports = [];
      let usedCache = false;
      
      // =====================================================================
      // STEP 1: Try Cloudflare Cache first (saves API costs!)
      // =====================================================================
      const AIRPORT_CACHE_URL = "https://globeskimmers-airport-cache.maizasimeon.workers.dev/api/airports/search";
      
      try {
        const cacheResponse = await fetch(AIRPORT_CACHE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: city,
            country: country,
            countryCode: countryCode,
            latitude: origin.latitude,
            longitude: origin.longitude
          })
        });
        
        if (cacheResponse.ok) {
          const cacheData = await cacheResponse.json();
          
          if (cacheData.airports && cacheData.airports.length > 0) {
            // Process cached airports: calculate distances from user's exact location
            airports = cacheData.airports
              .map(airport => {
                const distance = calculateDistance(origin.latitude, origin.longitude, airport.latitude, airport.longitude);
                const airportName = (airport.name || "").toLowerCase();
                const airportAddress = (airport.address || "").toLowerCase();
                
                const isInSameCity = (userCity.length >= 3) && (
                  airportName.includes(userCity) || 
                  airportAddress.includes(userCity)
                );
                
                return {
                  ...airport,
                  distance: distance,
                  distanceMiles: (distance * 0.621371).toFixed(1),
                  isInternational: airportName.includes("international"),
                  isInSameCity: isInSameCity
                };
              })
              .filter(a => {
                if (!a.latitude || !a.longitude) return false;
                if (a.distance > 800) return false;
                return true;
              })
              .sort((a, b) => {
                if (a.isInSameCity && !b.isInSameCity) return -1;
                if (!a.isInSameCity && b.isInSameCity) return 1;
                return a.distance - b.distance;
              });
            
            usedCache = true;
          }
        }
      } catch {
        // Cache unavailable — fall through to direct API call below.
      }
      
      // =====================================================================
      // STEP 2: If cache miss or failed, use direct API call
      // =====================================================================
      if (!usedCache || airports.length === 0) {
        const searchQuery = `airport ${city} ${country}`.trim();
        
        const { data } = await callWorker(ROUTE.searchLocation, {
          query: searchQuery,
          latitude: origin.latitude,
          longitude: origin.longitude
        });
        
        if (data?.results) {
          airports = data.results
            .filter(place => {
              const name = (place.placeName || place.full_name || "").toLowerCase();
              return name.includes("airport") || name.includes("international") || name.includes("terminal") || name.includes("aeropuerto") || name.includes("aeroporto");
            })
            .map(airport => {
              const lat = airport.coordinates?.latitude || airport.latitude;
              const lng = airport.coordinates?.longitude || airport.longitude;
              const distance = calculateDistance(origin.latitude, origin.longitude, lat, lng);
              const name = airport.placeName || airport.full_name;
              const airportAddress = (airport.address?.formatted || airport.full_name || "").toLowerCase();
              const airportName = name.toLowerCase();
              
              const isInSameCity = (userCity.length >= 3) && (
                airportName.includes(userCity) || 
                airportAddress.includes(userCity)
              );
              
              return {
                name: name,
                address: airport.address?.formatted || airport.full_name,
                latitude: lat,
                longitude: lng,
                distance: distance,
                distanceMiles: (distance * 0.621371).toFixed(1),
                isInternational: name.toLowerCase().includes("international"),
                isInSameCity: isInSameCity
              };
            })
            .filter(a => {
              if (!a.latitude || !a.longitude) return false;
              if (a.distance > 800) return false;
              if (Math.abs(a.latitude - origin.latitude) < 0.001 && Math.abs(a.longitude - origin.longitude) < 0.001) return false;
              return true;
            })
            .sort((a, b) => {
              if (a.isInSameCity && !b.isInSameCity) return -1;
              if (!a.isInSameCity && b.isInSameCity) return 1;
              return a.distance - b.distance;
            });
        }
      }
      
      // =====================================================================
      // ALWAYS combine with fallback airports to ensure we have enough options
      // =====================================================================
      const fallbackAirports = getFallbackAirports(countryCode, origin.latitude, origin.longitude);
      
      // Merge API results with fallback, avoiding duplicates
      const existingCoords = new Set(airports.map(a => `${a.latitude.toFixed(2)},${a.longitude.toFixed(2)}`));
      
      for (const fallback of fallbackAirports) {
        const coordKey = `${fallback.latitude.toFixed(2)},${fallback.longitude.toFixed(2)}`;
        if (!existingCoords.has(coordKey)) {
          existingCoords.add(coordKey);
          // Set isInSameCity flag for fallback airports too
          const airportName = (fallback.name || "").toLowerCase();
          const airportAddress = (fallback.address || "").toLowerCase();
          const isInSameCity = (userCity.length >= 3) && (
            airportName.includes(userCity) || 
            airportAddress.includes(userCity)
          );
          airports.push({
            ...fallback,
            isInSameCity: isInSameCity
          });
        }
      }
      
      // Re-sort after merging: same city first, then by distance
      airports.sort((a, b) => {
        if (a.isInSameCity && !b.isInSameCity) return -1;
        if (!a.isInSameCity && b.isInSameCity) return 1;
        return a.distance - b.distance;
      });

      // Build smart airport list: local airports + nearest major hub (minimum 6)
      const finalAirports = buildSmartAirportList(airports, countryCode, origin.latitude, origin.longitude, activeLocation);
      
      setNearbyAirports(finalAirports);
    } catch (error) {
      console.error("Airport search error:", error);
      
      // SPECIAL CASE on error: If in Luzon, show NAIA terminals
      if (isInLuzon(activeLocation)) {
        const naiaTerminals = getNAIATerminals(origin.latitude, origin.longitude);
        setNearbyAirports(naiaTerminals);
        setLoadingAirports(false);
        return;
      }
      
      // Use fallback on error
      const countryCode = getCountryCode(activeLocation);
      const fallbackAirports = getFallbackAirports(countryCode, origin.latitude, origin.longitude);
      const finalAirports = buildSmartAirportList(fallbackAirports, countryCode, origin.latitude, origin.longitude, activeLocation);
      setNearbyAirports(finalAirports);
    }
    setLoadingAirports(false);
  };

  // ============================================================================
  // SMART AIRPORT SELECTION ALGORITHM - Works globally for all travelers
  // ============================================================================
  // Priority:
  // 1. ALL airports in the same city (could be 1, 3, or 6)
  // 2. Expand to nearby cities to reach minimum of 6 airports
  // 3. Always include 1 closest major international hub
  // 4. MINIMUM 6 airports always shown
  // ============================================================================
  
  const buildSmartAirportList = (airports, countryCode, userLat, userLng, location) => {
    const MIN_AIRPORTS = 6;

    if (!airports || airports.length === 0) {
      // No airports found, return major hubs from database
      const majorHub = findClosestMajorHub(countryCode, userLat, userLng);
      if (majorHub) {
        return [{
          ...majorHub,
          distance: calculateDistance(userLat, userLng, majorHub.latitude, majorHub.longitude),
          distanceMiles: (calculateDistance(userLat, userLng, majorHub.latitude, majorHub.longitude) * 0.621371).toFixed(1)
        }];
      }
      return [];
    }
    
    const userCity = (location?.city || location?.address?.city || "").toLowerCase();
    
    // Separate into same-city and nearby
    const sameCityAirports = airports.filter(a => a.isInSameCity);
    const nearbyAirports = airports.filter(a => !a.isInSameCity);

    // Start building final list
    let finalList = [];
    
    // Step 1: Add all same-city airports first
    finalList = [...sameCityAirports];
    
    // Step 2: Add nearby airports to fill up to (MIN_AIRPORTS - 1), reserving 1 slot for major hub
    const nearbyNeeded = Math.max(0, MIN_AIRPORTS - 1 - finalList.length);
    if (nearbyNeeded > 0) {
      const nearbyToAdd = nearbyAirports.slice(0, nearbyNeeded);
      finalList = [...finalList, ...nearbyToAdd];
    }
    
    // Step 3: Check if we already have a major hub
    const closestHub = findClosestMajorHub(countryCode, userLat, userLng);
    let hasMajorHub = false;
    
    if (closestHub) {
      hasMajorHub = finalList.some(airport => {
        // Check by coordinates (more reliable)
        return Math.abs(airport.latitude - closestHub.latitude) < 0.05 && 
               Math.abs(airport.longitude - closestHub.longitude) < 0.05;
      });
      
      // Step 4: Add major hub if not already in list
      if (!hasMajorHub) {
        const hubWithDistance = {
          ...closestHub,
          distance: calculateDistance(userLat, userLng, closestHub.latitude, closestHub.longitude),
          distanceMiles: (calculateDistance(userLat, userLng, closestHub.latitude, closestHub.longitude) * 0.621371).toFixed(1),
          isMajorHub: true
        };
        finalList.push(hubWithDistance);
      }
    }
    
    // Step 5: If still under 6 airports, keep adding from nearby
    if (finalList.length < MIN_AIRPORTS) {
      const existingCoords = new Set(finalList.map(a => `${a.latitude.toFixed(2)},${a.longitude.toFixed(2)}`));
      
      for (const airport of nearbyAirports) {
        if (finalList.length >= MIN_AIRPORTS) break;
        
        const coordKey = `${airport.latitude.toFixed(2)},${airport.longitude.toFixed(2)}`;
        if (!existingCoords.has(coordKey)) {
          existingCoords.add(coordKey);
          finalList.push(airport);
        }
      }
    }
    
    // Final sort: same city first, then by distance, major hub last if far
    finalList.sort((a, b) => {
      // Same city airports first
      if (a.isInSameCity && !b.isInSameCity) return -1;
      if (!a.isInSameCity && b.isInSameCity) return 1;
      
      // Far major hub goes last (more than 200km away)
      const aIsFarHub = a.isMajorHub && a.distance > 200;
      const bIsFarHub = b.isMajorHub && b.distance > 200;
      if (aIsFarHub && !bIsFarHub) return 1;
      if (!aIsFarHub && bIsFarHub) return -1;
      
      // Otherwise by distance
      return a.distance - b.distance;
    });

    return finalList;
  };

  // Find the closest major hub airport by distance
  const findClosestMajorHub = (countryCode, userLat, userLng) => {
    const countryHubs = MAJOR_HUB_AIRPORTS[countryCode];
    if (!countryHubs || countryHubs.length === 0) return null;
    
    let closestHub = null;
    let closestDistance = Infinity;
    
    for (const hub of countryHubs) {
      const distance = calculateDistance(userLat, userLng, hub.latitude, hub.longitude);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestHub = hub;
      }
    }
    
    return closestHub;
  };

  // Fallback airports database by country
  const getFallbackAirports = (countryCode, userLat, userLng) => {
    const AIRPORTS_DB = {
      PH: [
        { name: "Ninoy Aquino International Airport (NAIA)", address: "Terminal 1, 2, 3 - Pasay City, Metro Manila", latitude: 14.5086, longitude: 121.0197, isInternational: true },
        { name: "Clark International Airport", address: "Clark Freeport Zone, Pampanga", latitude: 15.1859, longitude: 120.5594, isInternational: true },
        { name: "Mactan-Cebu International Airport", address: "Lapu-Lapu City, Cebu", latitude: 10.3075, longitude: 123.9794, isInternational: true },
        { name: "Davao International Airport", address: "Davao City, Davao del Sur", latitude: 7.1255, longitude: 125.6458, isInternational: true },
        { name: "Iloilo International Airport", address: "Santa Barbara, Iloilo", latitude: 10.8330, longitude: 122.4935, isInternational: true },
        { name: "Bohol-Panglao International Airport", address: "Panglao, Bohol", latitude: 9.5764, longitude: 123.7747, isInternational: true },
      ],
      US: [
        // Major Hubs
        { name: "Los Angeles International Airport (LAX)", address: "1 World Way, Los Angeles, CA", latitude: 33.9425, longitude: -118.4081, isInternational: true },
        { name: "John F. Kennedy International Airport (JFK)", address: "Queens, New York, NY", latitude: 40.6413, longitude: -73.7781, isInternational: true },
        { name: "San Francisco International Airport (SFO)", address: "San Francisco, CA", latitude: 37.6213, longitude: -122.3790, isInternational: true },
        { name: "Chicago O'Hare International Airport (ORD)", address: "Chicago, IL", latitude: 41.9742, longitude: -87.9073, isInternational: true },
        { name: "Miami International Airport (MIA)", address: "Miami, FL", latitude: 25.7959, longitude: -80.2870, isInternational: true },
        { name: "Dallas/Fort Worth International Airport (DFW)", address: "Dallas, TX", latitude: 32.8998, longitude: -97.0403, isInternational: true },
        { name: "Denver International Airport (DEN)", address: "Denver, CO", latitude: 39.8561, longitude: -104.6737, isInternational: true },
        { name: "Seattle-Tacoma International Airport (SEA)", address: "Seattle, WA", latitude: 47.4502, longitude: -122.3088, isInternational: true },
        { name: "Hartsfield-Jackson Atlanta International Airport (ATL)", address: "Atlanta, GA", latitude: 33.6407, longitude: -84.4277, isInternational: true },
        { name: "Boston Logan International Airport (BOS)", address: "Boston, MA", latitude: 42.3656, longitude: -71.0096, isInternational: true },
        { name: "Phoenix Sky Harbor International Airport (PHX)", address: "Phoenix, AZ", latitude: 33.4373, longitude: -112.0078, isInternational: true },
        { name: "George Bush Intercontinental Airport (IAH)", address: "Houston, TX", latitude: 29.9902, longitude: -95.3368, isInternational: true },
        { name: "Orlando International Airport (MCO)", address: "Orlando, FL", latitude: 28.4312, longitude: -81.3081, isInternational: true },
        { name: "Minneapolis-Saint Paul International Airport (MSP)", address: "Minneapolis, MN", latitude: 44.8848, longitude: -93.2223, isInternational: true },
        { name: "Detroit Metropolitan Airport (DTW)", address: "Detroit, MI", latitude: 42.2162, longitude: -83.3554, isInternational: true },
        { name: "Philadelphia International Airport (PHL)", address: "Philadelphia, PA", latitude: 39.8744, longitude: -75.2424, isInternational: true },
        { name: "Newark Liberty International Airport (EWR)", address: "Newark, NJ", latitude: 40.6895, longitude: -74.1745, isInternational: true },
        { name: "Charlotte Douglas International Airport (CLT)", address: "Charlotte, NC", latitude: 35.2140, longitude: -80.9431, isInternational: true },
        { name: "Las Vegas Harry Reid International Airport (LAS)", address: "Las Vegas, NV", latitude: 36.0840, longitude: -115.1537, isInternational: true },
        { name: "San Diego International Airport (SAN)", address: "San Diego, CA", latitude: 32.7336, longitude: -117.1897, isInternational: true },
        // Southern California Regional
        { name: "Ontario International Airport (ONT)", address: "Ontario, CA", latitude: 34.0560, longitude: -117.6012, isInternational: true },
        { name: "John Wayne Airport (SNA)", address: "Santa Ana, CA", latitude: 33.6757, longitude: -117.8682, isInternational: false },
        { name: "Hollywood Burbank Airport (BUR)", address: "Burbank, CA", latitude: 34.2005, longitude: -118.3585, isInternational: false },
        { name: "Long Beach Airport (LGB)", address: "Long Beach, CA", latitude: 33.8177, longitude: -118.1516, isInternational: false },
        { name: "Palm Springs International Airport (PSP)", address: "Palm Springs, CA", latitude: 33.8303, longitude: -116.5067, isInternational: true },
        // Florida Regional
        { name: "Pensacola International Airport (PNS)", address: "Pensacola, FL", latitude: 30.4734, longitude: -87.1866, isInternational: true },
        { name: "Destin-Fort Walton Beach Airport (VPS)", address: "Fort Walton Beach, FL", latitude: 30.4832, longitude: -86.5254, isInternational: false },
        { name: "Northwest Florida Beaches International Airport (ECP)", address: "Panama City, FL", latitude: 30.3571, longitude: -85.7955, isInternational: true },
        { name: "Tallahassee International Airport (TLH)", address: "Tallahassee, FL", latitude: 30.3965, longitude: -84.3503, isInternational: true },
        { name: "Jacksonville International Airport (JAX)", address: "Jacksonville, FL", latitude: 30.4941, longitude: -81.6879, isInternational: true },
        { name: "Tampa International Airport (TPA)", address: "Tampa, FL", latitude: 27.9756, longitude: -82.5333, isInternational: true },
        { name: "Fort Lauderdale-Hollywood International Airport (FLL)", address: "Fort Lauderdale, FL", latitude: 26.0742, longitude: -80.1506, isInternational: true },
        { name: "Southwest Florida International Airport (RSW)", address: "Fort Myers, FL", latitude: 26.5362, longitude: -81.7552, isInternational: true },
        // Alabama/Gulf Coast
        { name: "Mobile Regional Airport (MOB)", address: "Mobile, AL", latitude: 30.6914, longitude: -88.2428, isInternational: false },
        { name: "Birmingham-Shuttlesworth International Airport (BHM)", address: "Birmingham, AL", latitude: 33.5629, longitude: -86.7535, isInternational: true },
        // Louisiana
        { name: "Louis Armstrong New Orleans International Airport (MSY)", address: "New Orleans, LA", latitude: 29.9934, longitude: -90.2580, isInternational: true },
        { name: "Baton Rouge Metropolitan Airport (BTR)", address: "Baton Rouge, LA", latitude: 30.5332, longitude: -91.1496, isInternational: false },
        // Texas Regional
        { name: "Austin-Bergstrom International Airport (AUS)", address: "Austin, TX", latitude: 30.1975, longitude: -97.6664, isInternational: true },
        { name: "San Antonio International Airport (SAT)", address: "San Antonio, TX", latitude: 29.5337, longitude: -98.4698, isInternational: true },
        { name: "William P. Hobby Airport (HOU)", address: "Houston, TX", latitude: 29.6454, longitude: -95.2789, isInternational: true },
        // Northern California
        { name: "Oakland International Airport (OAK)", address: "Oakland, CA", latitude: 37.7213, longitude: -122.2208, isInternational: true },
        { name: "San Jose International Airport (SJC)", address: "San Jose, CA", latitude: 37.3626, longitude: -121.9291, isInternational: true },
        { name: "Sacramento International Airport (SMF)", address: "Sacramento, CA", latitude: 38.6954, longitude: -121.5908, isInternational: true },
        // Pacific Northwest
        { name: "Portland International Airport (PDX)", address: "Portland, OR", latitude: 45.5898, longitude: -122.5951, isInternational: true },
        // Northeast Regional
        { name: "LaGuardia Airport (LGA)", address: "Queens, New York, NY", latitude: 40.7769, longitude: -73.8740, isInternational: false },
        { name: "Washington Dulles International Airport (IAD)", address: "Dulles, VA", latitude: 38.9531, longitude: -77.4565, isInternational: true },
        { name: "Ronald Reagan Washington National Airport (DCA)", address: "Arlington, VA", latitude: 38.8521, longitude: -77.0377, isInternational: false },
        { name: "Baltimore/Washington International Airport (BWI)", address: "Baltimore, MD", latitude: 39.1754, longitude: -76.6684, isInternational: true },
      ],
      SG: [
        { name: "Singapore Changi Airport", address: "Airport Boulevard, Singapore", latitude: 1.3644, longitude: 103.9915, isInternational: true },
        { name: "Seletar Airport", address: "Seletar, Singapore", latitude: 1.4165, longitude: 103.8679, isInternational: false },
      ],
      MY: [
        { name: "Kuala Lumpur International Airport (KLIA)", address: "Sepang, Selangor", latitude: 2.7456, longitude: 101.7099, isInternational: true },
        { name: "KLIA2", address: "Sepang, Selangor", latitude: 2.7297, longitude: 101.7442, isInternational: true },
        { name: "Sultan Abdul Aziz Shah Airport (Subang)", address: "Subang, Selangor", latitude: 3.1303, longitude: 101.5492, isInternational: false },
        { name: "Penang International Airport", address: "Penang", latitude: 5.2972, longitude: 100.2769, isInternational: true },
        { name: "Langkawi International Airport", address: "Langkawi, Kedah", latitude: 6.3297, longitude: 99.7286, isInternational: true },
      ],
      TH: [
        { name: "Suvarnabhumi International Airport", address: "Bang Phli, Samut Prakan", latitude: 13.6900, longitude: 100.7501, isInternational: true },
        { name: "Don Mueang International Airport", address: "Don Mueang, Bangkok", latitude: 13.9126, longitude: 100.6068, isInternational: true },
        { name: "Phuket International Airport", address: "Thalang, Phuket", latitude: 8.1132, longitude: 98.3169, isInternational: true },
        { name: "Chiang Mai International Airport", address: "Chiang Mai", latitude: 18.7669, longitude: 98.9625, isInternational: true },
      ],
      JP: [
        { name: "Tokyo Narita International Airport", address: "Narita, Chiba", latitude: 35.7647, longitude: 140.3864, isInternational: true },
        { name: "Tokyo Haneda International Airport", address: "Ota City, Tokyo", latitude: 35.5494, longitude: 139.7798, isInternational: true },
        { name: "Kansai International Airport", address: "Izumisano, Osaka", latitude: 34.4347, longitude: 135.2441, isInternational: true },
        { name: "Chubu Centrair International Airport", address: "Tokoname, Aichi", latitude: 34.8584, longitude: 136.8125, isInternational: true },
      ],
      KR: [
        { name: "Incheon International Airport", address: "Incheon, South Korea", latitude: 37.4602, longitude: 126.4407, isInternational: true },
        { name: "Gimpo International Airport", address: "Gangseo-gu, Seoul", latitude: 37.5585, longitude: 126.7906, isInternational: true },
        { name: "Jeju International Airport", address: "Jeju City, Jeju", latitude: 33.5066, longitude: 126.4928, isInternational: true },
      ],
      GB: [
        { name: "London Heathrow International Airport", address: "Longford, London", latitude: 51.4700, longitude: -0.4543, isInternational: true },
        { name: "London Gatwick Airport", address: "Gatwick, West Sussex", latitude: 51.1537, longitude: -0.1821, isInternational: true },
        { name: "London Stansted Airport", address: "Stansted Mountfitchet, Essex", latitude: 51.8850, longitude: 0.2350, isInternational: true },
        { name: "London Luton Airport", address: "Luton, Bedfordshire", latitude: 51.8747, longitude: -0.3683, isInternational: true },
        { name: "Manchester International Airport", address: "Manchester", latitude: 53.3537, longitude: -2.2750, isInternational: true },
      ],
      AU: [
        { name: "Sydney Kingsford Smith International Airport", address: "Mascot, NSW", latitude: -33.9399, longitude: 151.1753, isInternational: true },
        { name: "Melbourne International Airport", address: "Tullamarine, VIC", latitude: -37.6690, longitude: 144.8410, isInternational: true },
        { name: "Brisbane International Airport", address: "Brisbane Airport, QLD", latitude: -27.3942, longitude: 153.1218, isInternational: true },
        { name: "Perth International Airport", address: "Perth, WA", latitude: -31.9385, longitude: 115.9672, isInternational: true },
      ],
      ID: [
        { name: "Soekarno-Hatta International Airport", address: "Tangerang, Banten", latitude: -6.1256, longitude: 106.6559, isInternational: true },
        { name: "Ngurah Rai International Airport", address: "Badung, Bali", latitude: -8.7467, longitude: 115.1667, isInternational: true },
        { name: "Juanda International Airport", address: "Surabaya, East Java", latitude: -7.3798, longitude: 112.7869, isInternational: true },
      ],
      VN: [
        { name: "Tan Son Nhat International Airport", address: "Ho Chi Minh City", latitude: 10.8188, longitude: 106.6519, isInternational: true },
        { name: "Noi Bai International Airport", address: "Hanoi", latitude: 21.2212, longitude: 105.8072, isInternational: true },
        { name: "Da Nang International Airport", address: "Da Nang", latitude: 16.0439, longitude: 108.1994, isInternational: true },
      ],
      AE: [
        { name: "Dubai International Airport", address: "Dubai, UAE", latitude: 25.2528, longitude: 55.3644, isInternational: true },
        { name: "Abu Dhabi International Airport", address: "Abu Dhabi, UAE", latitude: 24.4330, longitude: 54.6511, isInternational: true },
        { name: "Sharjah International Airport", address: "Sharjah, UAE", latitude: 25.3286, longitude: 55.5172, isInternational: true },
      ],
      IN: [
        { name: "Indira Gandhi International Airport", address: "New Delhi", latitude: 28.5562, longitude: 77.1000, isInternational: true },
        { name: "Chhatrapati Shivaji International Airport", address: "Mumbai", latitude: 19.0896, longitude: 72.8656, isInternational: true },
        { name: "Kempegowda International Airport", address: "Bangalore", latitude: 13.1986, longitude: 77.7066, isInternational: true },
        { name: "Chennai International Airport", address: "Chennai", latitude: 12.9941, longitude: 80.1709, isInternational: true },
        { name: "Rajiv Gandhi International Airport", address: "Hyderabad", latitude: 17.2403, longitude: 78.4294, isInternational: true },
      ],
      CA: [
        { name: "Toronto Pearson International Airport", address: "Mississauga, ON", latitude: 43.6777, longitude: -79.6248, isInternational: true },
        { name: "Vancouver International Airport", address: "Richmond, BC", latitude: 49.1951, longitude: -123.1779, isInternational: true },
        { name: "Montréal-Trudeau International Airport", address: "Dorval, QC", latitude: 45.4706, longitude: -73.7408, isInternational: true },
        { name: "Calgary International Airport", address: "Calgary, AB", latitude: 51.1215, longitude: -114.0076, isInternational: true },
      ],
      MX: [
        { name: "Mexico City International Airport", address: "Mexico City", latitude: 19.4363, longitude: -99.0721, isInternational: true },
        { name: "Cancún International Airport", address: "Cancún, Quintana Roo", latitude: 21.0365, longitude: -86.8771, isInternational: true },
        { name: "Guadalajara International Airport", address: "Guadalajara, Jalisco", latitude: 20.5218, longitude: -103.3111, isInternational: true },
      ],
      FR: [
        { name: "Paris Charles de Gaulle International Airport", address: "Roissy-en-France", latitude: 49.0097, longitude: 2.5479, isInternational: true },
        { name: "Paris Orly Airport", address: "Orly", latitude: 48.7233, longitude: 2.3794, isInternational: true },
        { name: "Nice Côte d'Azur International Airport", address: "Nice", latitude: 43.6584, longitude: 7.2159, isInternational: true },
      ],
      DE: [
        { name: "Frankfurt International Airport", address: "Frankfurt am Main", latitude: 50.0379, longitude: 8.5622, isInternational: true },
        { name: "Munich International Airport", address: "Munich", latitude: 48.3537, longitude: 11.7750, isInternational: true },
        { name: "Berlin Brandenburg International Airport", address: "Berlin", latitude: 52.3667, longitude: 13.5033, isInternational: true },
      ],
      CN: [
        { name: "Beijing Capital International Airport", address: "Chaoyang, Beijing", latitude: 40.0799, longitude: 116.6031, isInternational: true },
        { name: "Shanghai Pudong International Airport", address: "Pudong, Shanghai", latitude: 31.1443, longitude: 121.8083, isInternational: true },
        { name: "Guangzhou Baiyun International Airport", address: "Guangzhou", latitude: 23.3924, longitude: 113.2988, isInternational: true },
        { name: "Shenzhen Bao'an International Airport", address: "Shenzhen", latitude: 22.6393, longitude: 113.8107, isInternational: true },
      ],
      HK: [
        { name: "Hong Kong International Airport", address: "Chek Lap Kok, Hong Kong", latitude: 22.3080, longitude: 113.9185, isInternational: true },
      ],
      TW: [
        { name: "Taiwan Taoyuan International Airport", address: "Taoyuan City, Taiwan", latitude: 25.0797, longitude: 121.2342, isInternational: true },
        { name: "Taipei Songshan Airport", address: "Taipei, Taiwan", latitude: 25.0694, longitude: 121.5525, isInternational: false },
        { name: "Kaohsiung International Airport", address: "Kaohsiung, Taiwan", latitude: 22.5771, longitude: 120.3500, isInternational: true },
      ],
      NZ: [
        { name: "Auckland International Airport", address: "Auckland, New Zealand", latitude: -37.0082, longitude: 174.7850, isInternational: true },
        { name: "Wellington International Airport", address: "Wellington, New Zealand", latitude: -41.3272, longitude: 174.8053, isInternational: true },
        { name: "Christchurch International Airport", address: "Christchurch, New Zealand", latitude: -43.4894, longitude: 172.5322, isInternational: true },
      ],
      BR: [
        { name: "São Paulo–Guarulhos International Airport", address: "Guarulhos, São Paulo", latitude: -23.4356, longitude: -46.4731, isInternational: true },
        { name: "Rio de Janeiro–Galeão International Airport", address: "Rio de Janeiro", latitude: -22.8090, longitude: -43.2506, isInternational: true },
        { name: "Brasília International Airport", address: "Brasília", latitude: -15.8711, longitude: -47.9186, isInternational: true },
      ],
    };
    
    const countryAirports = AIRPORTS_DB[countryCode] || AIRPORTS_DB["US"];
    
    return countryAirports
      .map(airport => {
        const distance = calculateDistance(userLat, userLng, airport.latitude, airport.longitude);
        return {
          ...airport,
          distance: distance,
          distanceMiles: (distance * 0.621371).toFixed(1)
        };
      })
      .sort((a, b) => a.distance - b.distance);
  };

  // Fetch detailed route info using AI - WITH CACHING
  const fetchRouteInfo = async () => {
    if (!origin || !destination || !activeLocation) return;
    
    const city = activeLocation.city || activeLocation.address?.city || '';
    const countryCode = getCountryCode(activeLocation);
    const distanceKm = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
    
    // CHECK LOCAL CACHE FIRST
    const cached = getCachedRouteInfo(
      origin.latitude, origin.longitude,
      destination.latitude, destination.longitude,
      city
    );
    
    if (cached) {
      setRouteInfo(cached);
      return;
    }
    
    setLoadingRouteInfo(true);
    try {
      // Try Worker cache first
      try {
        const workerResponse = await fetch(
          `${WORKER_URL}/route-info?` + 
          `originLat=${origin.latitude}&originLng=${origin.longitude}` +
          `&destLat=${destination.latitude}&destLng=${destination.longitude}` +
          `&city=${encodeURIComponent(city)}`
        );
        
        if (workerResponse.ok) {
          const workerData = await workerResponse.json();
          if (workerData.success && workerData.data) {
            setRouteInfo(workerData.data);
            // Also cache locally
            setCachedRouteInfo(
              origin.latitude, origin.longitude,
              destination.latitude, destination.longitude,
              city, workerData.data
            );
            setLoadingRouteInfo(false);
            return;
          }
        }
      } catch (workerError) {
        console.warn('Worker route cache miss, fetching fresh:', workerError);
      }
      
      // Fetch fresh from LLM
      const result = await invokeLLM({
        prompt: `You are a local transportation expert for ${city}, ${activeLocation.address?.country || ''}.

Provide detailed transportation options from "${origin.name}" to "${destination.name}" (approximately ${distanceKm.toFixed(1)} km).

Return a JSON object with transportation options. Include realistic local information:

{
  "rideshare": {
    "recommended": true/false,
    "apps": ["list available apps in this country"],
    "pickup_instructions": "Where to find rideshare pickup",
    "estimated_wait": "typical wait time"
  },
  "public_transport": {
    "available": true/false,
    "best_option": {
      "type": "bus/train/metro",
      "name": "specific route name if known",
      "from_station": "nearest station/stop to origin",
      "to_station": "station/stop near destination",
      "walk_to_station": "walking directions to station",
      "walk_time_minutes": number,
      "travel_time_minutes": number,
      "fare_local": "fare in local currency",
      "frequency": "how often it runs",
      "ticket_info": "how to buy tickets"
    },
    "alternative": {
      "type": "bus/train/jeepney",
      "description": "brief description"
    },
    "steps": [
      {"step": 1, "instruction": "Walk to...", "duration": "X min"},
      {"step": 2, "instruction": "Board...", "duration": "X min"}
    ]
  },
  "taxi": {
    "available": true,
    "where_to_find": "Where to find taxis near origin",
    "estimated_fare_local": "XXX-XXX in local currency",
    "payment_methods": ["cash", "card", "GrabPay"],
    "safety_tips": "local safety advice"
  },
  "walking": {
    "feasible": true/false,
    "time_minutes": number,
    "route_description": "brief walking directions",
    "safety_notes": "any safety considerations"
  },
  "recommendation": {
    "best_option": "rideshare/public_transport/taxi/walk",
    "reason": "why this is recommended"
  }
}

Be specific to ${city}. Use real station names, route names, and local knowledge.`,
        response_json_schema: {
          type: "object",
          properties: {
            rideshare: { type: "object" },
            public_transport: { type: "object" },
            taxi: { type: "object" },
            walking: { type: "object" },
            recommendation: { type: "object" }
          }
        }
      });
      
      // CACHE THE RESULT (locally)
      setCachedRouteInfo(
        origin.latitude, origin.longitude,
        destination.latitude, destination.longitude,
        city, result
      );
      
      // Also cache in Worker for other users (fire and forget)
      fetch(`${WORKER_URL}/route-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originLat: origin.latitude,
          originLng: origin.longitude,
          destLat: destination.latitude,
          destLng: destination.longitude,
          city: city,
          data: result
        })
      }).catch(e => console.warn('Failed to cache route in Worker:', e));
      
      setRouteInfo(result);
    } catch (error) {
      console.error("Route info error:", error);
      setRouteInfo(null);
    }
    setLoadingRouteInfo(false);
  };

  // Select saved location as destination
  const selectSavedLocation = (location) => {
    setDestination({
      name: location.nickname || location.placeName,
      address: location.address.formatted,
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
      type: "saved"
    });
    setShowSavedLocations(false);
  };

  // Select airport as destination
  const selectAirport = (airport) => {
    setDestination({
      name: airport.name,
      address: airport.address,
      latitude: airport.latitude,
      longitude: airport.longitude,
      type: "airport"
    });
    setShowAirportPicker(false);
  };

  // Select hotel as destination
  const selectHotel = () => {
    if (user?.hotel) {
      setDestination({
        name: user.hotel.name,
        address: user.hotel.address,
        latitude: user.hotel.latitude,
        longitude: user.hotel.longitude,
        type: "hotel"
      });
    }
  };

  // Calculate transport data
  const getTransportData = () => {
    if (!origin || !destination) return null;
    
    const distanceKm = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
    const distanceMiles = distanceKm * 0.621371;
    const countryCode = getCountryCode(activeLocation);
    const rates = FARE_RATES[countryCode] || FARE_RATES.default;
    
    const modes = ['taxi', 'bus', 'train', 'walk'];
    if (countryCode === 'PH') modes.splice(1, 0, 'jeepney');
    
    const options = modes.map(mode => {
      const time = calculateTravelTime(distanceKm, mode, activeLocation, currentTime);
      const fare = calculateFare(distanceKm, countryCode, mode);
      const usdLow = (fare.low / exchangeRate).toFixed(2);
      const usdHigh = (fare.high / exchangeRate).toFixed(2);
      return { mode, time, fare, usdFare: { low: usdLow, high: usdHigh } };
    });
    
    return { distance: { km: distanceKm.toFixed(1), miles: distanceMiles.toFixed(1) }, options, countryCode, currency: rates };
  };

  const transportData = getTransportData();
  const trafficStatus = activeLocation ? getTrafficStatus(currentTime, activeLocation) : null;
  const availableProviders = activeLocation ? getAvailableProviders(getCountryCode(activeLocation)) : [];
  const taxiServices = TAXI_SERVICES[getCountryCode(activeLocation)] || TAXI_SERVICES.default;

  // Loading state
  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans pb-28" style={{ background: IVORY }}>
      {/* HEADER — chevron back + Transportation pill (redesign) */}
      <div className="px-4 pt-2 pb-4">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button
            onClick={() => {
              // P2: if user arrived from ThingsToDo map (?fromMap=true), pop the stack.
              const params = new URLSearchParams(window.location.search);
              if (params.get('fromMap') === 'true') navigate(-1);
              else navigate(createPageUrl("Home"));
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]"
            style={{ background: '#FFFFFF', border: '1px solid #F0E9DC' }}
            aria-label="Back"
          >
            <ArrowLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))] font-sans"
            style={{ background: CAT.transit.bg, color: CAT.transit.ink }}
          >
            <Bus size={13} color={CAT.transit.ink} strokeWidth={2} />
            Transportation Information
          </div>
          <div className="w-10 h-10" />
        </div>
      </div>

      <div
        className={`px-4 ${colWrap} mx-auto space-y-3`}
        style={isTablet ? { paddingBottom: "170px" } : undefined}
      >
        {/* ROUTE CARD — From → To with timeline rail (redesign) */}
        <div
          className="rounded-[20px] p-4"
          style={{
            background: '#FFFFFF',
            border: '1px solid #F0E9DC',
            boxShadow: '0 8px 24px -14px rgba(15,20,25,.12)',
          }}
        >
          <div className="flex gap-3">
            {/* timeline rail */}
            <div className="flex flex-col items-center pt-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ border: `3px solid ${CAT.money.ink}` }} />
              <div className="w-0.5 flex-1 my-1" style={{ background: '#E5DDC8', minHeight: 26 }} />
              <svg width="14" height="16" viewBox="0 0 24 24" fill={CAT.food.ink}>
                <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              {/* FROM */}
              <div className="pb-3 border-b border-dashed" style={{ borderColor: '#E5DDC8' }}>
                <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: '#94A3B8' }}>FROM</div>
                <div className="font-bold text-[calc(14.5px*var(--fs))] text-[#0F1419] mt-0.5 truncate">{origin?.name || 'Set your location'}</div>
                {origin?.address && <div className="text-[calc(11px*var(--fs))] text-[#6B7280] mt-0.5 truncate">{origin.address}</div>}
                <button onClick={() => setShowLocationPicker(true)} className="text-[calc(11.5px*var(--fs))] font-semibold mt-1 underline underline-offset-2" style={{ color: TEAL_DEEP }}>
                  Change
                </button>
                {/* Secondary action — set the starting point to live GPS. A
                    FULL-WIDTH button (not a fixed-height pill) so the long label
                    wraps cleanly and the control grows with the text-size control
                    instead of spilling out. Stacked below "Change" so the two
                    never collide. Updates the origin only (never the destination). */}
                <button
                  onClick={handleUseCurrentAsStart}
                  disabled={fromGpsLoading}
                  className="w-full flex items-center justify-center gap-2 mt-2 rounded-xl font-semibold text-[calc(11.5px*var(--fs))] disabled:opacity-60 active:scale-[0.99] transition"
                  style={{ padding: '9px 14px', background: '#E6F4F1', color: TEAL_DEEP, border: '1px solid #B6E3DC', lineHeight: 1.3 }}
                >
                  {fromGpsLoading ? <Loader2 size={13} className="animate-spin flex-none" /> : <Navigation size={13} className="flex-none" />}
                  <span className="text-center">{fromGpsLoading ? 'Updating starting point…' : 'Use my current location as the starting point'}</span>
                </button>
                {fromGpsError && <div className="text-[calc(11px*var(--fs))] text-red-600 mt-1.5">{fromGpsError}</div>}
              </div>
              {/* TO */}
              <div className="pt-3">
                <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: '#94A3B8' }}>TO</div>
                {destination ? (
                  <>
                    <div className="font-bold text-[calc(14.5px*var(--fs))] text-[#0F1419] mt-0.5 flex items-center gap-1.5">
                      {destination.type === 'airport' && <Plane size={13} color={CAT.atm.ink} />}
                      {destination.type === 'hotel' && <Hotel size={13} color={CAT.food.ink} />}
                      {destination.type === 'saved' && <Star size={13} color={CAT.todo.ink} />}
                      {destination.type === 'search' && <Navigation size={13} color={TEAL_DEEP} />}
                      <span className="truncate">{destination.name}</span>
                    </div>
                    {destination.address && <div className="text-[calc(11px*var(--fs))] text-[#6B7280] mt-0.5 truncate">{destination.address}</div>}
                    <button onClick={() => { setDestination(null); setRouteInfo(null); }} className="text-[calc(11.5px*var(--fs))] font-semibold mt-1 underline underline-offset-2" style={{ color: TEAL_DEEP }}>
                      Clear
                    </button>
                  </>
                ) : (
                  <div className="text-[calc(13px*var(--fs))] text-[#94A3B8] mt-1">Pick a destination below</div>
                )}
              </div>
            </div>
          </div>

          {/* Meta chips when destination set: distance + traffic + local time */}
          {destination && transportData && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[calc(11.5px*var(--fs))] font-semibold" style={{ background: '#F7F4EC', color: '#374151' }}>
                📍 {transportData.distance.miles} mi · {transportData.distance.km} km
              </span>
              {trafficStatus && (
                <span className={`px-2.5 py-1 rounded-full text-[calc(11.5px*var(--fs))] font-semibold ${trafficStatus.bg} ${trafficStatus.color}`}>
                  {trafficStatus.icon} {trafficStatus.text}
                </span>
              )}
              {(() => {
                const countryCode = getCountryCode(activeLocation);
                const timezone = getTimezone(countryCode, activeLocation);
                const localTime = getLocalTimeForTimezone(timezone, activeLocation);
                return (
                  <span className="px-2.5 py-1 rounded-full text-[calc(11.5px*var(--fs))] font-semibold" style={{ background: '#F7F4EC', color: '#374151' }}>
                    🕐 {localTime.time}
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* QUICK DESTINATION SHORTCUTS (when no destination chosen) */}
        {!destination && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={searchNearbyAirports}
              className="flex flex-col items-center gap-1.5 py-3.5 rounded-[14px] transition-transform active:scale-95"
              style={{ background: CAT.atm.bg, color: CAT.atm.ink }}
            >
              <Plane size={20} color={CAT.atm.ink} strokeWidth={2} />
              <span className="font-bold text-[calc(12px*var(--fs))]">Airport</span>
            </button>
            <button
              onClick={() => setShowDestinationSearch(true)}
              className="flex flex-col items-center gap-1.5 py-3.5 rounded-[14px] transition-transform active:scale-95"
              style={{ background: CAT.todo.bg, color: CAT.todo.ink }}
            >
              <Search size={20} color={CAT.todo.ink} strokeWidth={2} />
              <span className="font-bold text-[calc(12px*var(--fs))]">Search</span>
            </button>
            {user?.hotel && (
              <button
                onClick={selectHotel}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-[14px] transition-transform active:scale-95"
                style={{ background: CAT.food.bg, color: CAT.food.ink }}
              >
                <Hotel size={20} color={CAT.food.ink} strokeWidth={2} />
                <span className="font-bold text-[calc(12px*var(--fs))]">My Hotel</span>
              </button>
            )}
            {savedLocations.length > 0 && (
              <button
                onClick={() => setShowSavedLocations(true)}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-[14px] transition-transform active:scale-95"
                style={{ background: CAT.shopping.bg, color: CAT.shopping.ink }}
              >
                <Star size={20} color={CAT.shopping.ink} strokeWidth={2} />
                <span className="font-bold text-[calc(12px*var(--fs))]">Saved</span>
              </button>
            )}
          </div>
        )}

        {/* CITY WARNING — when active location is a broad city pin, not an address */}
        {destination && isCityLocation(activeLocation) && (
          <div className="px-3.5 py-3 rounded-[14px] text-[calc(12.5px*var(--fs))] font-medium flex items-start gap-2" style={{ background: CAT.weather.bg, color: CAT.weather.ink }}>
            <span>⚠️</span>
            <span>For more accurate directions, use a full address or a well-known place (like a hotel or airport).</span>
          </div>
        )}

        {/* WAYS TO GET THERE — unified transit options list (replaces old Trip Summary + fare table) */}
        {destination && transportData && (
          <>
            <SectionLabel mt="mt-2">Ways to get there</SectionLabel>
            <div className="space-y-2.5">
              {(() => {
                const modeMap = {
                  taxi:    { cat: CAT.weather,    icon: '🚕', label: 'Rideshare / Taxi', tag: 'Door to door' },
                  bus:     { cat: CAT.transit,    icon: '🚌', label: 'Bus',               tag: 'Public transit' },
                  train:   { cat: CAT.atm,        icon: '🚇', label: 'Metro / Train',     tag: 'Fastest' },
                  walk:    { cat: CAT.convenience,icon: '🚶', label: 'Walk',              tag: 'Healthiest · Free' },
                  jeepney: { cat: CAT.food,       icon: '🚐', label: 'Jeepney',           tag: 'Local · Cash' },
                };
                // Pick the "best" pick: prefer train when distance > 1km (typical urban),
                // else taxi. Walk is excluded from best since it's free + slow.
                const distKm = parseFloat(transportData.distance.km);
                const hasTrain = transportData.options.find(o => o.mode === 'train');
                const bestMode = (hasTrain && distKm > 1) ? 'train' : 'taxi';
                return transportData.options.map(option => {
                  const m = modeMap[option.mode] || modeMap.bus;
                  const isBest = option.mode === bestMode;
                  return (
                    <motion.div
                      key={option.mode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-[16px]"
                      style={{
                        background: isBest ? m.cat.ink : '#FFFFFF',
                        color: isBest ? '#fff' : '#0F1419',
                        border: isBest ? '0' : '1px solid #F0E9DC',
                        boxShadow: isBest ? `0 12px 26px -12px ${m.cat.ink}80` : '0 1px 0 rgba(15,20,25,.03)',
                      }}
                    >
                      <div
                        className="w-11 h-11 rounded-[12px] flex items-center justify-center text-xl flex-none"
                        style={{ background: isBest ? 'rgba(255,255,255,0.2)' : m.cat.bg }}
                      >
                        <span>{m.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-[calc(16px*var(--fs))]">{m.label}</span>
                          {isBest && <span className="font-mono text-[calc(10px*var(--fs))] tracking-[0.12em] uppercase opacity-85">· best</span>}
                        </div>
                        <div className="text-[calc(12.5px*var(--fs))] mt-0.5" style={{ color: isBest ? 'rgba(255,255,255,0.85)' : '#6B7280' }}>
                          {m.tag} · {option.time.trafficLevel} traffic
                        </div>
                      </div>
                      <div className="text-right flex-none">
                        <div className="font-serif italic text-[calc(22px*var(--fs))] leading-none">
                          {option.mode === 'walk' ? 'Free' : `${option.fare.symbol}${option.fare.low}-${option.fare.high}`}
                        </div>
                        <div className="mt-1 text-[calc(12px*var(--fs))] font-semibold" style={{ color: isBest ? 'rgba(255,255,255,0.9)' : CAT.money.ink }}>
                          ~{option.time.minutes} min
                        </div>
                        {option.mode !== 'walk' && option.fare.currency !== 'USD' && option.usdFare && (
                          <div className="text-[calc(10px*var(--fs))] font-medium mt-0.5 opacity-70">
                            ~${option.usdFare.low}-${option.usdFare.high} USD
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>
          </>
        )}

        {/* BOOK A RIDE — rideshare providers (region-aware) */}
        {destination && transportData && availableProviders.length > 0 && (
          <>
            <SectionLabel>Book a ride</SectionLabel>
            {routeInfo?.rideshare?.pickup_instructions && (
              <div className="px-3.5 py-2.5 rounded-[12px] text-[calc(12.5px*var(--fs))] mb-2" style={{ background: CAT.shopping.bg, color: CAT.shopping.ink }}>
                <span className="font-semibold">📍 Pickup:</span> {routeInfo.rideshare.pickup_instructions}
                {routeInfo.rideshare.estimated_wait && (
                  <span> · <span className="font-semibold">⏱️ Wait:</span> {routeInfo.rideshare.estimated_wait}</span>
                )}
              </div>
            )}
            <div className="space-y-2">
              {availableProviders.map(provider => {
                const taxiOption = transportData.options.find(o => o.mode === 'taxi');
                return (
                  <button
                    key={provider.name}
                    onClick={() => {
                      window.location.href = provider.deepLink(origin, destination);
                      setTimeout(() => {
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        window.open(isIOS ? provider.appStore : provider.playStore, '_blank');
                      }, 2000);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px] transition-transform active:scale-[0.99]"
                    style={{ background: '#FFFFFF', border: '1px solid #F0E9DC' }}
                  >
                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-xl text-white flex-none" style={{ background: '#0F1419' }}>
                      {provider.logo}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-bold text-[calc(15px*var(--fs))] text-[#0F1419]">{provider.name}</div>
                      {taxiOption && (
                        <div className="text-[calc(11.5px*var(--fs))] text-[#6B7280] mt-0.5">
                          ~{taxiOption.fare.symbol}{taxiOption.fare.low}-{taxiOption.fare.high} · ~{taxiOption.time.minutes} min
                        </div>
                      )}
                    </div>
                    <div className="px-3.5 py-2 rounded-[10px] text-white font-bold text-[calc(12.5px*var(--fs))] flex-none flex items-center gap-1" style={{ background: '#0F1419' }}>
                      Open <ExternalLink size={12} color="#fff" strokeWidth={2.4} />
                    </div>
                  </button>
                );
              })}
            </div>
            {availableProviders.length === 1 && (
              <div className="text-[calc(11.5px*var(--fs))] text-[#6B7280] text-center mt-1">
                {availableProviders[0].name} is the primary rideshare service in this region
              </div>
            )}
          </>
        )}

        {/* CALL A TAXI — country-specific hotlines */}
        {destination && taxiServices.length > 0 && taxiServices.some(t => t.phone) && (
          <>
            <SectionLabel>Call a taxi</SectionLabel>
            <div className="space-y-2">
              {taxiServices.filter(t => t.phone).map((taxi, i) => (
                <a
                  key={i}
                  href={`tel:${taxi.phone}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-[16px] transition-transform active:scale-[0.99]"
                  style={{ background: CAT.weather.bg, color: CAT.weather.ink }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-none" style={{ background: CAT.weather.ink, color: '#fff' }}>
                    <Phone size={18} color="#fff" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[calc(14.5px*var(--fs))]">{taxi.name}</div>
                    <div className="text-[calc(12px*var(--fs))] mt-0.5 opacity-85">{taxi.phone}</div>
                  </div>
                  <span className="font-mono text-[calc(10px*var(--fs))] tracking-[0.14em] uppercase font-bold opacity-80">Tap to call</span>
                </a>
              ))}
            </div>
            {routeInfo?.taxi?.where_to_find && (
              <div className="px-3.5 py-2.5 rounded-[12px] mt-2 text-[calc(12px*var(--fs))]" style={{ background: '#F7F4EC', color: '#374151' }}>
                <span className="font-semibold">📍 Where to find:</span> {routeInfo.taxi.where_to_find}
              </div>
            )}
            {routeInfo?.taxi?.safety_tips && (
              <div className="px-3.5 py-2.5 rounded-[12px] mt-2 text-[calc(12px*var(--fs))]" style={{ background: CAT.food.bg, color: CAT.food.ink }}>
                <span className="font-semibold">⚠️ Safety:</span> {routeInfo.taxi.safety_tips}
              </div>
            )}
          </>
        )}

        {/* OPEN IN MAPS — Google + Apple TRANSIT shortcuts (transit routing is
            the point of this page; do NOT swap for the driving-only picker). */}
        {destination && origin && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=transit`;
                window.open(url, '_blank');
              }}
              className="flex items-center justify-center gap-2 py-3 rounded-[14px] font-semibold text-[calc(13px*var(--fs))]"
              style={{ background: CAT.atm.bg, color: CAT.atm.ink }}
            >
              🗺️ Google Maps
            </button>
            <button
              onClick={() => {
                const url = `http://maps.apple.com/?saddr=${origin.latitude},${origin.longitude}&daddr=${destination.latitude},${destination.longitude}&dirflg=r`;
                window.open(url, '_blank');
              }}
              className="flex items-center justify-center gap-2 py-3 rounded-[14px] font-semibold text-[calc(13px*var(--fs))]"
              style={{ background: '#F7F4EC', color: '#374151' }}
            >
              🍎 Apple Maps
            </button>
          </div>
        )}

        {/* BEST PUBLIC-TRANSIT ROUTE — AI-fetched route info with step-by-step */}
        {destination && (loadingRouteInfo || routeInfo?.public_transport?.best_option) && (
          <>
            <SectionLabel>Best transit route</SectionLabel>
            <div className="px-4 py-3.5 rounded-[16px]" style={{ background: CAT.transit.bg, color: CAT.transit.ink }}>
              {loadingRouteInfo ? (
                <div className="flex items-center justify-center gap-2 py-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-[calc(13px*var(--fs))] font-medium">Finding best route...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl flex-none">
                      {routeInfo.public_transport.best_option.type === 'train' ? '🚇' : routeInfo.public_transport.best_option.type === 'bus' ? '🚌' : '🚐'}
                    </span>
                    <div className="flex-1">
                      <div className="font-bold text-[calc(14.5px*var(--fs))]">{routeInfo.public_transport.best_option.name || `Take the ${routeInfo.public_transport.best_option.type}`}</div>
                      {routeInfo.public_transport.best_option.from_station && (
                        <div className="text-[calc(12px*var(--fs))] mt-0.5 opacity-90">From {routeInfo.public_transport.best_option.from_station}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {routeInfo.public_transport.best_option.travel_time_minutes && (
                      <span className="px-2.5 py-1 rounded-full text-[calc(11.5px*var(--fs))] font-semibold bg-white/40">⏱️ {routeInfo.public_transport.best_option.travel_time_minutes} min</span>
                    )}
                    {routeInfo.public_transport.best_option.fare_local && (
                      <span className="px-2.5 py-1 rounded-full text-[calc(11.5px*var(--fs))] font-semibold bg-white/40">💰 {routeInfo.public_transport.best_option.fare_local}</span>
                    )}
                    {routeInfo.public_transport.best_option.frequency && (
                      <span className="px-2.5 py-1 rounded-full text-[calc(11.5px*var(--fs))] font-semibold bg-white/40">🕐 {routeInfo.public_transport.best_option.frequency}</span>
                    )}
                  </div>
                  {routeInfo.public_transport.steps && routeInfo.public_transport.steps.length > 0 && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(63,73,212,0.2)' }}>
                      <div className="font-semibold text-[calc(12px*var(--fs))] mb-2">📋 Step-by-step:</div>
                      <div className="space-y-1.5">
                        {routeInfo.public_transport.steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-[calc(12.5px*var(--fs))]">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[calc(11px*var(--fs))] font-bold flex-none" style={{ background: CAT.transit.ink, color: '#fff' }}>{step.step}</div>
                            <div className="flex-1">
                              {step.instruction}
                              {step.duration && <span className="opacity-75"> · ⏱️ {step.duration}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {routeInfo.public_transport.best_option.ticket_info && (
                    <div className="mt-2 text-[calc(11.5px*var(--fs))] opacity-90">🎫 {routeInfo.public_transport.best_option.ticket_info}</div>
                  )}
                  {routeInfo.public_transport.alternative && (
                    <div className="mt-3 pt-3 border-t text-[calc(12px*var(--fs))]" style={{ borderColor: 'rgba(63,73,212,0.2)' }}>
                      <span className="font-semibold">Alternative:</span> {routeInfo.public_transport.alternative.description}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* HONEST TIP / RECOMMENDATION */}
        {destination && routeInfo?.recommendation && (
          <div className="px-3.5 py-3 rounded-[14px] flex items-start gap-2 mt-3" style={{ background: CAT.transit.bg, color: CAT.transit.ink }}>
            <span className="text-base">💡</span>
            <div className="text-[calc(12.5px*var(--fs))] leading-relaxed font-medium">{routeInfo.recommendation.reason}</div>
          </div>
        )}

      </div>
      {/* ============================================================ */}
      {/* AIRPORT PICKER MODAL */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showAirportPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAirportPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-hidden shadow-2xl"
            >
              {/* Check if showing NAIA terminals (has terminal property) */}
              {(() => {
                const isNAIATerminals = nearbyAirports.length > 0 && nearbyAirports[0].terminal !== undefined;
                return (
                  <>
                    <div className="p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Plane className="w-6 h-6 text-white" />
                          <h3 className="text-lg font-bold text-white">
                            {isNAIATerminals ? "Select NAIA Terminal" : "Select Airport"}
                          </h3>
                        </div>
                        <button onClick={() => setShowAirportPicker(false)} className="p-2 hover:bg-white/20 rounded-lg">
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                      <p className="text-white/80 text-sm mt-1">
                        {isNAIATerminals 
                          ? "Choose your terminal based on your airline" 
                          : "Choose from the nearest airports"}
                      </p>
                    </div>

                    <div className="p-4 max-h-[60vh] overflow-y-auto">
                      {loadingAirports ? (
                        <div className="text-center py-8">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                          <p className="text-gray-500">
                            {isInLuzon(activeLocation) ? "Loading NAIA terminals..." : "Finding nearby airports..."}
                          </p>
                        </div>
                      ) : nearbyAirports.length > 0 ? (
                        <div className="space-y-3">
                          {nearbyAirports.map((airport, index) => (
                            <button
                              key={index}
                              onClick={() => selectAirport(airport)}
                              className="w-full p-4 text-left bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors border-2 border-gray-200 hover:border-blue-300"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  airport.terminal 
                                    ? airport.terminal === 3 ? 'bg-green-100' : 
                                      airport.terminal === 2 ? 'bg-blue-100' :
                                      airport.terminal === 1 ? 'bg-purple-100' : 'bg-orange-100'
                                    : 'bg-blue-100'
                                }`}>
                                  {airport.terminal ? (
                                    <span className={`font-bold text-lg ${
                                      airport.terminal === 3 ? 'text-green-600' : 
                                      airport.terminal === 2 ? 'text-blue-600' :
                                      airport.terminal === 1 ? 'text-purple-600' : 'text-orange-600'
                                    }`}>
                                      T{airport.terminal}
                                    </span>
                                  ) : (
                                    <Plane className="w-5 h-5 text-blue-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-gray-900 break-words pr-6">{airport.name}</p>
                                  <p className="text-sm text-gray-500 break-words pr-6">{airport.address}</p>
                                  {/* Show airline info for NAIA terminals */}
                                  {airport.airlines && (
                                    <p className="text-xs text-blue-700 mt-1 bg-blue-50 px-2 py-1 rounded-lg inline-block">
                                      ✈️ {airport.airlines}
                                    </p>
                                  )}
                                  <p className="text-sm text-blue-600 mt-2 font-semibold">
                                    📍 {airport.distanceMiles} miles away
                                  </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">No airports found nearby</p>
                      )}
                      
                      {/* Helpful tip for NAIA */}
                      {isNAIATerminals && (
                        <div className="mt-4 p-3 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                          <p className="text-sm text-yellow-800">
                            <span className="font-semibold">💡 Tip:</span> Check your airline's terminal before booking transport. 
                            Terminal 3 is the main international terminal for most airlines.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* SAVED LOCATIONS MODAL */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showSavedLocations && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
            onClick={() => setShowSavedLocations(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] overflow-hidden"
            >
              <div className="p-4 border-b bg-gradient-to-r from-purple-500 to-purple-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Star className="w-6 h-6 text-white" />
                    <h3 className="text-lg font-bold text-white">Saved Locations</h3>
                  </div>
                  <button onClick={() => setShowSavedLocations(false)} className="p-2 hover:bg-white/20 rounded-lg">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto pb-6">
                {savedLocations.length > 0 ? (
                  <div className="space-y-3">
                    {savedLocations.map((location, index) => (
                      <button
                        key={index}
                        onClick={() => selectSavedLocation(location)}
                        className="w-full p-4 text-left bg-gray-50 hover:bg-purple-50 rounded-xl transition-colors border-2 border-gray-200 hover:border-purple-300"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Star className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-bold text-gray-900 break-words">{location.nickname || location.placeName}</p>
                            <p className="text-sm text-gray-500 break-words">{location.address.formatted}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No saved locations yet</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* SEARCH MODAL */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showDestinationSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
            onClick={() => setShowDestinationSearch(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] overflow-hidden"
            >
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Search Destination</h3>
                  <button onClick={() => setShowDestinationSearch(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchPlaces(e.target.value);
                    }}
                    placeholder="Search for a place..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto p-4">
                {searching ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((place, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setDestination({ ...place, type: "custom" });
                          setShowDestinationSearch(false);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="w-full p-3 text-left hover:bg-gray-50 rounded-xl transition-colors"
                      >
                        <p className="font-semibold text-gray-900">{place.name}</p>
                        <p className="text-sm text-gray-500 truncate">{place.address}</p>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length >= 3 ? (
                  <p className="text-center text-gray-500 py-8">No results found</p>
                ) : (
                  <p className="text-center text-gray-500 py-8">Type at least 3 characters to search</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Picker Modal */}
      <LocationModePicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      />

      <div className="h-20"></div>
    </div>
  );
}