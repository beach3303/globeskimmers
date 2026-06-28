import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { useNavigate } from "react-router-dom";
import { MapPin, Loader2, Phone, Search, TrendingUp, ChevronDown, ArrowUpDown, Info, Map, Navigation, X, ChevronLeft, DollarSign } from "lucide-react";
import { CAT, IVORY } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapRecenterButton from "../components/maps/MapRecenterButton";
import MapAppSelector from "../components/MapAppSelector";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import DistanceUnitToggle from "../components/location/DistanceUnitToggle";
import { CITY_DISCLAIMER, getLocationLabel } from "../components/location/locationLabel";
import RefreshButton from "@/components/RefreshButton";

// Helper function
const createPageUrl = (pageName) => `/${pageName}`;

// ─── EDITORIAL TOKENS ───────────────────────────────────────────────────────
// "Editorial" treatment (matches PlacesToEat / CultureInformation):
// Instrument Serif headings + amounts, JetBrains Mono UPPERCASE kickers, ivory
// canvas, soft white rounded cards with a hairline rule, money-green accent.
// Renders at BOTH widths — full iPad sizing when isTablet, compact phone-tuned
// sizing otherwise (the in-component `t(tab, phone)` helper picks per width).
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#FAF7F0", ED_RULE = "rgba(22,17,13,.10)";
const ED_MONEY = CAT.money.ink; // #0F9A6B page accent
// Respect the app-wide text-scale variable, with a safe 1 fallback.
const fs = (n) => `calc(${n}px*var(--fs))`;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Miles vs Kilometers Configuration
const MILES_COUNTRIES = [
  'United States',
  'United Kingdom',
  'Liberia',
  'Myanmar'
];

const RADIUS_VALUES = {
  km: [1, 2, 5, 10, 25],
  mi: [0.5, 1, 3, 5, 10, 25]
};

const DEFAULT_RADIUS = {
  km: 5,
  mi: 3
};

// Conversion helpers
const kmToMiles = (km) => km * 0.621371;
const milesToKm = (miles) => miles * 1.60934;

// COMPREHENSIVE CURRENCY DATABASE (150+ currencies)
const COUNTRY_TO_CURRENCY = {
  "United States": "USD", "Canada": "CAD", "Mexico": "MXN", "United Kingdom": "GBP",
  "Ireland": "EUR", "France": "EUR", "Germany": "EUR", "Italy": "EUR", "Spain": "EUR",
  "Portugal": "EUR", "Netherlands": "EUR", "Belgium": "EUR", "Austria": "EUR",
  "Greece": "EUR", "Finland": "EUR", "Croatia": "EUR", "Japan": "JPY", "China": "CNY",
  "Hong Kong": "HKD", "South Korea": "KRW", "Taiwan": "TWD", "Singapore": "SGD",
  "Malaysia": "MYR", "Thailand": "THB", "Indonesia": "IDR", "Philippines": "PHP",
  "Vietnam": "VND", "India": "INR", "Pakistan": "PKR", "Bangladesh": "BDT",
  "Australia": "AUD", "New Zealand": "NZD", "Russia": "RUB", "Switzerland": "CHF",
  "Norway": "NOK", "Sweden": "SEK", "Denmark": "DKK", "Poland": "PLN",
  "Czech Republic": "CZK", "Hungary": "HUF", "Romania": "RON", "Bulgaria": "BGN",
  "Turkey": "TRY", "Israel": "ILS", "South Africa": "ZAR", "Nigeria": "NGN",
  "Egypt": "EGP", "Kenya": "KES", "Morocco": "MAD", "Brazil": "BRL",
  "Argentina": "ARS", "Chile": "CLP", "Colombia": "COP", "Peru": "PEN",
  "Uruguay": "UYU", "Venezuela": "VES", "UAE": "AED", "Saudi Arabia": "SAR",
  "Qatar": "QAR", "Kuwait": "KWT", "Oman": "OMR", "Iceland": "ISK",
};

const ALL_CURRENCIES = [
  // Major Global Currencies
  { code: "USD", name: "US Dollar", flag: "🇺🇸", availability: "major" },
  { code: "EUR", name: "Euro", flag: "🇪🇺", availability: "major" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", availability: "major" },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", availability: "major" },
  { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", availability: "major" },
  { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", availability: "major" },
  { code: "AUD", name: "Australian Dollar", flag: "🇦🇺", availability: "major" },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", availability: "major" },
  { code: "HKD", name: "Hong Kong Dollar", flag: "🇭🇰", availability: "major" },
  { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬", availability: "major" },

  // Asian Currencies
  { code: "THB", name: "Thai Baht", flag: "🇹🇭", availability: "common" },
  { code: "KRW", name: "South Korean Won", flag: "🇰🇷", availability: "common" },
  { code: "MYR", name: "Malaysian Ringgit", flag: "🇲🇾", availability: "common" },
  { code: "IDR", name: "Indonesian Rupiah", flag: "🇮🇩", availability: "common" },
  { code: "PHP", name: "Philippine Peso", flag: "🇵🇭", availability: "common" },
  { code: "VND", name: "Vietnamese Dong", flag: "🇻🇳", availability: "common" },
  { code: "TWD", name: "New Taiwan Dollar", flag: "🇹🇼", availability: "common" },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳", availability: "common" },
  { code: "PKR", name: "Pakistani Rupee", flag: "🇵🇰", availability: "order" },
  { code: "BDT", name: "Bangladeshi Taka", flag: "🇧🇩", availability: "order" },
  { code: "LKR", name: "Sri Lankan Rupee", flag: "🇱🇰", availability: "order" },
  { code: "NPR", name: "Nepalese Rupee", flag: "🇳🇵", availability: "order" },
  { code: "MMK", name: "Myanmar Kyat", flag: "🇲🇲", availability: "order" },
  { code: "KHR", name: "Cambodian Riel", flag: "🇰🇭", availability: "order" },
  { code: "LAK", name: "Laotian Kip", flag: "🇱🇦", availability: "order" },
  { code: "MOP", name: "Macanese Pataca", flag: "🇲🇴", availability: "order" },
  { code: "BND", name: "Brunei Dollar", flag: "🇧🇳", availability: "order" },

  // European Currencies
  { code: "NOK", name: "Norwegian Krone", flag: "🇳🇴", availability: "common" },
  { code: "SEK", name: "Swedish Krona", flag: "🇸🇪", availability: "common" },
  { code: "DKK", name: "Danish Krone", flag: "🇩🇰", availability: "common" },
  { code: "PLN", name: "Polish Zloty", flag: "🇵🇱", availability: "common" },
  { code: "CZK", name: "Czech Koruna", flag: "🇨🇿", availability: "common" },
  { code: "HUF", name: "Hungarian Forint", flag: "🇭🇺", availability: "common" },
  { code: "RON", name: "Romanian Leu", flag: "🇷🇴", availability: "order" },
  { code: "BGN", name: "Bulgarian Lev", flag: "🇧🇬", availability: "order" },
  { code: "HRK", name: "Croatian Kuna", flag: "🇭🇷", availability: "order" },
  { code: "ISK", name: "Icelandic Króna", flag: "🇮🇸", availability: "order" },
  { code: "TRY", name: "Turkish Lira", flag: "🇹🇷", availability: "common" },
  { code: "RUB", name: "Russian Ruble", flag: "🇷🇺", availability: "common" },
  { code: "UAH", name: "Ukrainian Hryvnia", flag: "🇺🇦", availability: "order" },
  { code: "BYN", name: "Belarusian Ruble", flag: "🇧🇾", availability: "order" },
  { code: "BAM", name: "Bosnia-Herzegovina Mark", flag: "🇧🇦", availability: "order" },
  { code: "RSD", name: "Serbian Dinar", flag: "🇷🇸", availability: "order" },
  { code: "MKD", name: "Macedonian Denar", flag: "🇲🇰", availability: "order" },
  { code: "ALL", name: "Albanian Lek", flag: "🇦🇱", availability: "order" },
  { code: "GEL", name: "Georgian Lari", flag: "🇬🇪", availability: "order" },
  { code: "AMD", name: "Armenian Dram", flag: "🇦🇲", availability: "order" },
  { code: "AZN", name: "Azerbaijani Manat", flag: "🇦🇿", availability: "order" },
  { code: "MDL", name: "Moldovan Leu", flag: "🇲🇩", availability: "order" },

  // Middle Eastern Currencies
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪", availability: "common" },
  { code: "SAR", name: "Saudi Riyal", flag: "🇸🇦", availability: "common" },
  { code: "QAR", name: "Qatari Rial", flag: "🇶🇦", availability: "common" },
  { code: "KWD", name: "Kuwaiti Dinar", flag: "🇰🇼", availability: "common" },
  { code: "OMR", name: "Omani Rial", flag: "🇴🇲", availability: "common" },
  { code: "BHD", name: "Bahraini Dinar", flag: "🇧🇭", availability: "common" },
  { code: "JOD", name: "Jordanian Dinar", flag: "🇯🇴", availability: "order" },
  { code: "ILS", name: "Israeli Shekel", flag: "🇮🇱", availability: "common" },
  { code: "IQD", name: "Iraqi Dinar", flag: "🇮🇶", availability: "order" },
  { code: "LBP", name: "Lebanese Pound", flag: "🇱🇧", availability: "order" },
  { code: "SYP", name: "Syrian Pound", flag: "🇸🇾", availability: "order" },
  { code: "YER", name: "Yemeni Rial", flag: "🇾🇪", availability: "order" },
  { code: "IRR", name: "Iranian Rial", flag: "🇮🇷", availability: "order" },

  // African Currencies
  { code: "ZAR", name: "South African Rand", flag: "🇿🇦", availability: "common" },
  { code: "EGP", name: "Egyptian Pound", flag: "🇪🇬", availability: "common" },
  { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬", availability: "order" },
  { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪", availability: "order" },
  { code: "MAD", name: "Moroccan Dirham", flag: "🇲🇦", availability: "order" },
  { code: "TZS", name: "Tanzanian Shilling", flag: "🇹🇿", availability: "order" },
  { code: "UGX", name: "Ugandan Shilling", flag: "🇺🇬", availability: "order" },
  { code: "ZMW", name: "Zambian Kwacha", flag: "🇿🇲", availability: "order" },
  { code: "GHS", name: "Ghanaian Cedi", flag: "🇬🇭", availability: "order" },
  { code: "ETB", name: "Ethiopian Birr", flag: "🇪🇹", availability: "order" },
  { code: "MUR", name: "Mauritian Rupee", flag: "🇲🇺", availability: "order" },
  { code: "BWP", name: "Botswanan Pula", flag: "🇧🇼", availability: "order" },
  { code: "NAD", name: "Namibian Dollar", flag: "🇳🇦", availability: "order" },
  { code: "MWK", name: "Malawian Kwacha", flag: "🇲🇼", availability: "order" },
  { code: "AOA", name: "Angolan Kwanza", flag: "🇦🇴", availability: "order" },
  { code: "MZN", name: "Mozambican Metical", flag: "🇲🇿", availability: "order" },
  { code: "DZD", name: "Algerian Dinar", flag: "🇩🇿", availability: "order" },
  { code: "TND", name: "Tunisian Dinar", flag: "🇹🇳", availability: "order" },
  { code: "LYD", name: "Libyan Dinar", flag: "🇱🇾", availability: "order" },
  { code: "SDG", name: "Sudanese Pound", flag: "🇸🇩", availability: "order" },

  // American Currencies
  { code: "MXN", name: "Mexican Peso", flag: "🇲🇽", availability: "common" },
  { code: "BRL", name: "Brazilian Real", flag: "🇧🇷", availability: "common" },
  { code: "ARS", name: "Argentine Peso", flag: "🇦🇷", availability: "order" },
  { code: "CLP", name: "Chilean Peso", flag: "🇨🇱", availability: "order" },
  { code: "COP", name: "Colombian Peso", flag: "🇨🇴", availability: "order" },
  { code: "PEN", name: "Peruvian Sol", flag: "🇵🇪", availability: "order" },
  { code: "UYU", name: "Uruguayan Peso", flag: "🇺🇾", availability: "order" },
  { code: "VES", name: "Venezuelan Bolívar", flag: "🇻🇪", availability: "order" },
  { code: "BOB", name: "Bolivian Boliviano", flag: "🇧🇴", availability: "order" },
  { code: "PYG", name: "Paraguayan Guarani", flag: "🇵🇾", availability: "order" },
  { code: "CRC", name: "Costa Rican Colón", flag: "🇨🇷", availability: "order" },
  { code: "GTQ", name: "Guatemalan Quetzal", flag: "🇬🇹", availability: "order" },
  { code: "HNL", name: "Honduran Lempira", flag: "🇭🇳", availability: "order" },
  { code: "NIO", name: "Nicaraguan Córdoba", flag: "🇳🇮", availability: "order" },
  { code: "PAB", name: "Panamanian Balboa", flag: "🇵🇦", availability: "order" },
  { code: "DOP", name: "Dominican Peso", flag: "🇩🇴", availability: "order" },
  { code: "JMD", name: "Jamaican Dollar", flag: "🇯🇲", availability: "order" },
  { code: "TTD", name: "Trinidad & Tobago Dollar", flag: "🇹🇹", availability: "order" },
  { code: "BBD", name: "Barbadian Dollar", flag: "🇧🇧", availability: "order" },
  { code: "BSD", name: "Bahamian Dollar", flag: "🇧🇸", availability: "order" },

  // Oceania Currencies
  { code: "NZD", name: "New Zealand Dollar", flag: "🇳🇿", availability: "common" },
  { code: "FJD", name: "Fijian Dollar", flag: "🇫🇯", availability: "order" },
  { code: "PGK", name: "Papua New Guinean Kina", flag: "🇵🇬", availability: "order" },
  { code: "TOP", name: "Tongan Paʻanga", flag: "🇹🇴", availability: "order" },
  { code: "WST", name: "Samoan Tala", flag: "🇼🇸", availability: "order" },
  { code: "VUV", name: "Vanuatu Vatu", flag: "🇻🇺", availability: "order" },
  { code: "SBD", name: "Solomon Islands Dollar", flag: "🇸🇧", availability: "order" },

  // Other Currencies
  { code: "AFN", name: "Afghan Afghani", flag: "🇦🇫", availability: "order" },
  { code: "KZT", name: "Kazakhstani Tenge", flag: "🇰🇿", availability: "order" },
  { code: "UZS", name: "Uzbekistan Som", flag: "🇺🇿", availability: "order" },
  { code: "TJS", name: "Tajikistani Somoni", flag: "🇹🇯", availability: "order" },
  { code: "TMT", name: "Turkmenistani Manat", flag: "🇹🇲", availability: "order" },
  { code: "KGS", name: "Kyrgystani Som", flag: "🇰🇬", availability: "order" },
  { code: "MNT", name: "Mongolian Tugrik", flag: "🇲🇳", availability: "order" },
  { code: "BTN", name: "Bhutanese Ngultrum", flag: "🇧🇹", availability: "order" },
  { code: "MVR", name: "Maldivian Rufiyaa", flag: "🇲🇻", availability: "order" },
  { code: "SCR", name: "Seychellois Rupee", flag: "🇸🇨", availability: "order" },
  { code: "XAF", name: "Central African CFA Franc", flag: "🌍", availability: "order" },
  { code: "XOF", name: "West African CFA Franc", flag: "🌍", availability: "order" },
  { code: "XPF", name: "CFP Franc", flag: "🏝️", availability: "order" },
  { code: "XCD", name: "East Caribbean Dollar", flag: "🏝️", availability: "order" },
];



// Map Center Controller Component
function MapCenterController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && map) {
      try {
        map.setView(center, zoom || 15, { animate: true });
      } catch (error) {
        console.error('Error setting map view:', error);
      }
    }
  }, [center, zoom, map]);
  
  return null;
}

export default function MoneyExchangePage() {
  const navigate = useNavigate();
  // iPad: wider centered editorial column + money-green accent (design handoff).
  // Phone layout is unchanged — every tablet branch is gated on this.
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  // Editorial design renders at BOTH widths now. `t(tab, phone)` picks the
  // tablet value when on iPad and the compact phone-tuned value otherwise —
  // matches the PlacesToEat / Culture editorial responsive pattern. Every size
  // stays on fs() so the glasses text-scale control keeps working; multi-line
  // titles are 2-line clamped and cards use min-height (never fixed) so larger
  // text grows the element instead of clipping.
  const t = (tab, phone) => (isTablet ? tab : phone);
  const { activeLocation, locationMode, initialized, switchToCurrentLocation } = useLocation();
  const [user, setUser] = useState(null);
  const [fromAmount, setFromAmount] = useState("1");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("");
  const [localCurrency, setLocalCurrency] = useState("");
  const [convertedAmount, setConvertedAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState(null);
  const [rateTimestamp, setRateTimestamp] = useState(null);
  const [converting, setConverting] = useState(false);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [currencyLookup, setCurrencyLookup] = useState("");
  const [loading, setLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [exchangeStores, setExchangeStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS.km);
  const [radiusIndex, setRadiusIndex] = useState(2);
  const [sortBy, setSortBy] = useState("distance");
  const [usesMiles, setUsesMiles] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState("km");
  const [selectedStoreIndex, setSelectedStoreIndex] = useState(null);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [converterCollapsed, setConverterCollapsed] = useState(false);
  const [expandedStoreIndex, setExpandedStoreIndex] = useState(null);
  // "You are here" map tooltip can be collapsed to a small "📍 You are
  // here ⌄" pill (saves map real estate) or expanded back to the full
  // 3-line card (heading + Current/Selected location + city/state).
  // Same pattern as ThingsToDo's TierMapOverlay.
  const [userPinExpanded, setUserPinExpanded] = useState(true);

  const handleRefresh = () => {
    convertCurrency(true);
    loadExchangeStores(true);
  };

  useEffect(() => {
    loadUserAndLocation();
  }, []);

  useEffect(() => {
    if (initialized && activeLocation?.address?.country) {
      const detectedCurrency = COUNTRY_TO_CURRENCY[activeLocation.address.country] || "USD";
      setLocalCurrency(detectedCurrency);

      if (!toCurrency) {
        setToCurrency(detectedCurrency);
        setCurrencyLookup(detectedCurrency);
      }

      // Only set distance unit based on country if user hasn't set a preference
      if (!user?.preferred_distance_unit) {
        const countryUsesMiles = MILES_COUNTRIES.includes(activeLocation.address.country);
        setUsesMiles(countryUsesMiles);
        setDistanceUnit(countryUsesMiles ? "mi" : "km");

        const defaultRadiusValue = countryUsesMiles ? DEFAULT_RADIUS.mi : DEFAULT_RADIUS.km;
        setSearchRadius(defaultRadiusValue);

        const radiusArray = countryUsesMiles ? RADIUS_VALUES.mi : RADIUS_VALUES.km;
        const defaultIndex = radiusArray.indexOf(defaultRadiusValue);
        setRadiusIndex(defaultIndex >= 0 ? defaultIndex : 2);
      }
    }
  }, [activeLocation, initialized, user]);

  useEffect(() => {
    if (fromAmount && fromCurrency && toCurrency) {
      convertCurrency();
    }
  }, [fromAmount, fromCurrency, toCurrency]);

  useEffect(() => {
    if (initialized && activeLocation?.coordinates && toCurrency && fromCurrency) {
      loadExchangeStores();
    }
  }, [activeLocation, initialized, toCurrency, fromCurrency, searchRadius, sortBy, openOnly]);

  const loadUserAndLocation = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      // Set distance unit preference from user profile
      if (userData.preferred_distance_unit === 'miles') {
        setUsesMiles(true);
        setDistanceUnit('mi');
        setSearchRadius(DEFAULT_RADIUS.mi);
        const radiusArray = RADIUS_VALUES.mi;
        const defaultIndex = radiusArray.indexOf(DEFAULT_RADIUS.mi);
        setRadiusIndex(defaultIndex >= 0 ? defaultIndex : 2);
      } else if (userData.preferred_distance_unit === 'kilometers') {
        setUsesMiles(false);
        setDistanceUnit('km');
        setSearchRadius(DEFAULT_RADIUS.km);
        const radiusArray = RADIUS_VALUES.km;
        const defaultIndex = radiusArray.indexOf(DEFAULT_RADIUS.km);
        setRadiusIndex(defaultIndex >= 0 ? defaultIndex : 2);
      }

      setLoading(false);
    } catch (error) {
      // Auth is guaranteed by the app-wide sign-in gate; never redirect here.
      // Prefs still live in Base44 (migrated later) → fall back to defaults.
      console.warn("User prefs unavailable; using defaults:", error?.message || error);
      setLoading(false);
    }
  };

  const convertCurrency = async (forceRefresh = false) => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setConvertedAmount("");
      setExchangeRate(null);
      setRateTimestamp(null);
      return;
    }

    setConverting(true);
    try {
      const response = await callWorker(ROUTE.getExchangeRate, {
        from: fromCurrency,
        to: toCurrency,
        amount: parseFloat(fromAmount),
        forceRefresh
      });

      if (!response || !response.data || response.error || response.data.error) {
        setConvertedAmount("Error");
        setExchangeRate("Unable to get exchange rate");
        setRateTimestamp(null);
        return;
      }

      setConvertedAmount(response.data.converted_amount ? response.data.converted_amount.toFixed(2) : "0.00");
      setExchangeRate(response.data.exchange_rate);
      setRateTimestamp(new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }));
    } catch (error) {
      console.error("Error converting currency:", error);
      setConvertedAmount("Error");
      setExchangeRate("Unable to get exchange rate");
      setRateTimestamp(null);
    }
    setConverting(false);
  };

  const loadExchangeStores = async (forceRefresh = false) => {
    if (!activeLocation?.coordinates || !toCurrency || !fromCurrency) return;

    setLoadingStores(true);
    try {
      const radiusInMiles = usesMiles ? searchRadius : kmToMiles(searchRadius);

      const { data } = await callWorker(ROUTE.getMoneyExchangeLocations, {
        latitude: activeLocation.coordinates.latitude,
        longitude: activeLocation.coordinates.longitude,
        fromCurrency: fromCurrency,
        toCurrency: toCurrency,
        radiusMiles: radiusInMiles,
        limit: null, // Fetch all stores, then slice for list view
        sortBy: sortBy,
        openOnly: openOnly,
        forceRefresh: forceRefresh
      });

      setExchangeStores(data?.locations || []);
    } catch (error) {
      console.error("Error loading exchange stores:", error);
      setExchangeStores([]);
    }
    setLoadingStores(false);
  };

  const handleRadiusChange = (index) => {
    const radiusArray = usesMiles ? RADIUS_VALUES.mi : RADIUS_VALUES.km;
    setRadiusIndex(index);
    setSearchRadius(radiusArray[index]);
  };

  // Local fallback retained for backward compat with the radius slider values.
  // The card distance display now uses sharedFormatDistance from the hook.
  const formatDistance = (distanceMiles) => {
    if (usesMiles) {
      return `${distanceMiles?.toFixed(1) || '0.0'} mi`;
    } else {
      const distanceKm = milesToKm(distanceMiles);
      return `${distanceKm?.toFixed(1) || '0.0'} km`;
    }
  };

  const swapCurrencies = () => {
    const tempCurrency = fromCurrency;
    const tempAmount = convertedAmount;

    setFromCurrency(toCurrency);
    setToCurrency(tempCurrency);
    setCurrencyLookup(tempCurrency); // Update currency lookup for consistency

    if (tempAmount && tempAmount !== "Error") {
      setFromAmount(tempAmount);
    }
  };

  const getCurrencyFlag = (code) => {
    const curr = ALL_CURRENCIES.find(c => c.code === code);
    return curr ? curr.flag : "💱";
  };

  const getCurrencyName = (code) => {
    const curr = ALL_CURRENCIES.find(c => c.code === code);
    return curr ? curr.name : code;
  };

  const getCurrencyByCode = (code) => {
    return ALL_CURRENCIES.find(c => c.code === code);
  };

  const organizedFromCurrencies = () => {
    const filtered = ALL_CURRENCIES.filter(curr =>
      curr.code.toLowerCase().includes(fromSearch.toLowerCase()) ||
      curr.name.toLowerCase().includes(fromSearch.toLowerCase())
    );

    return filtered.sort((a, b) => {
      if (a.availability === "major" && b.availability !== "major") return -1;
      if (b.availability === "major" && a.availability !== "major") return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const organizedToCurrencies = () => {
    const filtered = ALL_CURRENCIES.filter(curr =>
      curr.code.toLowerCase().includes(toSearch.toLowerCase()) ||
      curr.name.toLowerCase().includes(toSearch.toLowerCase())
    );

    return filtered.sort((a, b) => {
      if (a.code === localCurrency && b.code !== localCurrency) return -1;
      if (b.code === localCurrency && a.code !== localCurrency) return 1;
      if (a.availability === "major" && b.availability !== "major") return -1;
      if (b.availability === "major" && a.availability !== "major") return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const getMajorCurrencies = () => ALL_CURRENCIES.filter(c => c.availability === "major");
  const getCommonCurrencies = () => ALL_CURRENCIES.filter(c => c.availability === "common");
  const getOrderRequiredCurrencies = () => ALL_CURRENCIES.filter(c => c.availability === "order");

  const handleShowOnMap = (index) => {
    setSelectedStoreIndex(index);
    setViewMode("map");
    // Scroll to map section
    setTimeout(() => {
      const mapSection = document.getElementById('exchange-stores-map');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleGetDirections = (store) => {
    setSelectedDestination({
      latitude: store.latitude,
      longitude: store.longitude,
      name: store.name,
      address: store.address
    });
    setShowMapSelector(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f5f7fa] to-[#e2e8f0] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#667eea] animate-spin" />
      </div>
    );
  }

  const localCurrencyData = getCurrencyByCode(localCurrency);
  const radiusArray = usesMiles ? RADIUS_VALUES.mi : RADIUS_VALUES.km;
  const selectedStore = selectedStoreIndex !== null ? exchangeStores[selectedStoreIndex] : null;
  const mapCenter = selectedStore
    ? [selectedStore.latitude, selectedStore.longitude]
    : activeLocation?.coordinates
    ? [activeLocation.coordinates.latitude, activeLocation.coordinates.longitude]
    : null;

  return (
    <div className="min-h-screen font-sans" style={{background:IVORY}}>
      {/* HEADER — chevron back + Currency Exchange pill (redesign) */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]"
            style={{background:'#FFFFFF',border:'1px solid #F0E9DC'}}
            aria-label="Back"
          >
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full uppercase"
            style={{background:CAT.money.bg,color:CAT.money.ink,fontFamily:ED_MONO,fontSize:t(fs(11),fs(10.5)),letterSpacing:".08em",fontWeight:500}}
          >
            <DollarSign size={13} color={CAT.money.ink} strokeWidth={2} />
            Currency Exchange
          </div>
          <RefreshButton onClick={handleRefresh} isRefreshing={converting || loadingStores} tone="light" title="Refresh rates & stores" />
        </div>
      </div>

      {/* Editorial page title + mono kicker (handoff "Money Exchange" frame) */}
      <div className={`px-4 ${colWrap} mx-auto pb-1 text-center`}>
        <h1 className="leading-none" style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:t(fs(46),fs(30)),color:ED_INK}}>Money Exchange</h1>
        <p className="uppercase mt-2 font-semibold" style={{fontFamily:ED_MONO,fontSize:t(fs(10.5),fs(10)),letterSpacing:"0.16em",color:ED_INK3}}>Compare live rates near you</p>
      </div>

      <div className={`${colWrap} mx-auto px-4`}>
        {/* Location Display */}
        <div className="mb-3">
          <div
            className={t("rounded-[20px] p-5", "rounded-[18px] p-4")}
            style={{background:"#FFFFFF",border:`1px solid ${ED_RULE}`,boxShadow:"0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)"}}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-2xl flex-shrink-0">
                  {activeLocation?.granularity === 'city' ? '🏙️' : (locationMode === 'current' ? '📍' : '🧭')}
                </div>
                <div className="flex-1 min-w-0">
                  {(() => {
                    if (!activeLocation) return <p style={{fontSize:fs(13.5),color:ED_INK3}}>Loading location...</p>;

                    return (
                      <>
                        <p className="uppercase" style={{fontFamily:ED_MONO,fontSize:t(fs(10),fs(10)),letterSpacing:".12em",color:ED_INK3,marginBottom:fs(3)}}>
                          {activeLocation?.granularity === 'city' ? 'City' : (locationMode === 'navigate' ? 'Selected location' : 'Current location')}
                        </p>
                        <p className="truncate" style={{fontFamily:ED_SERIF,fontSize:t(fs(24),fs(21)),lineHeight:1.05,color:ED_INK}}>
                          {locationMode === 'navigate' ? activeLocation.placeName : activeLocation.address?.city}
                        </p>
                        {activeLocation.address?.city && locationMode === 'navigate' && (
                          <p className="truncate" style={{fontSize:t(fs(14),fs(13)),color:ED_INK3,marginTop:fs(2)}}>
                            {activeLocation.address.city}, {activeLocation.address.state || activeLocation.address.country}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {locationMode === 'navigate' && (
                  <button
                    onClick={() => switchToCurrentLocation()}
                    className="p-2 rounded-lg transition-colors"
                    style={{background:CAT.money.bg}}
                    title="Use Current Location"
                  >
                    <Navigation className="w-4 h-4" style={{color:ED_MONEY}} />
                  </button>
                )}
                <button
                  onClick={() => setShowLocationPicker(true)}
                  className="flex-none rounded-[10px]"
                  style={{background:CAT.money.bg,color:ED_MONEY,fontFamily:ED_MONO,fontSize:t(fs(11),fs(10.5)),letterSpacing:".06em",fontWeight:600,padding:`${fs(7)} ${fs(12)}`,textTransform:"uppercase"}}
                >
                  Change
                </button>
              </div>
            </div>
          </div>
          {activeLocation?.granularity === 'city' && (
            <div className="mt-2 px-3.5 py-2.5 rounded-[12px] leading-snug flex items-start gap-2" style={{background:CAT.weather.bg,color:CAT.weather.ink,fontSize:t(fs(12),fs(11.5))}}>
              <span>💡</span>
              <span>Showing places across {activeLocation?.address?.city || activeLocation?.placeName} — {CITY_DISCLAIMER}</span>
            </div>
          )}
        </div>

        {/* Currency Converter */}
        <div
          className={t("rounded-[24px] mb-3", "rounded-[20px] mb-3")}
          style={{background:"#FFFFFF",border:`1px solid ${ED_RULE}`,boxShadow:"0 1px 0 rgba(15,20,25,.04), 0 12px 32px -16px rgba(15,20,25,.12)"}}
        >
          <div className={t("flex items-center justify-between p-5 pb-3", "flex items-center justify-between p-4 pb-3")}>
            <div>
              <p className="uppercase" style={{fontFamily:ED_MONO,fontSize:t(fs(10),fs(10)),letterSpacing:".12em",color:ED_INK3,marginBottom:fs(4)}}>Converter</p>
              <h2 style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:t(fs(28),fs(22)),lineHeight:1,color:ED_INK}}>Conversion Calculator</h2>
            </div>
            <button
              onClick={() => setConverterCollapsed(!converterCollapsed)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              aria-label={converterCollapsed ? "Expand" : "Collapse"}
            >
              {converterCollapsed ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <X className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
          
          {!converterCollapsed && (
            <div className={t("px-5 pb-5", "px-4 pb-4")}>
          <div className="mb-3">
            <label
              className="uppercase mb-1 block"
              style={{fontFamily:ED_MONO,fontSize:fs(10),letterSpacing:".1em",color:ED_INK3}}
            >From</label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className={t("flex-1 h-[60px]", "flex-1 h-[52px]")}
                style={{fontFamily:ED_SERIF,fontSize:t(fs(30),fs(26)),color:ED_INK,borderColor:ED_RULE,borderRadius:t("16px","14px"),background:ED_IVORY2}}
                placeholder="1.00"
              />
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger
                  className={t("w-[140px] h-[60px]", "w-[120px] h-[52px]")}
                  style={{borderColor:ED_RULE,borderRadius:t("16px","14px"),background:ED_IVORY2}}
                >
                  <div className="flex items-center gap-2">
                    <span>{getCurrencyFlag(fromCurrency)}</span>
                    <span className="font-semibold">{fromCurrency}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="p-2 sticky top-0 bg-white border-b z-10">
                    <Input
                      placeholder="Search currency..."
                      value={fromSearch}
                      onChange={(e) => e.stopPropagation() || setFromSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  {organizedFromCurrencies().map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      <div className="flex items-center gap-2">
                        <span>{curr.flag}</span>
                        <span className="font-medium">{curr.code}</span>
                        <span className="text-xs text-gray-500">- {curr.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={swapCurrencies}
              className="rounded-full p-2.5 transition-colors"
              style={{background:"#FFFFFF",border:`2px solid ${CAT.money.soft}`,boxShadow:"0 4px 12px -6px rgba(15,154,107,.5)"}}
            >
              <ArrowUpDown className="w-4 h-4" style={{color:ED_MONEY}} />
            </button>
          </div>

          <div className="mb-2">
            <label
              className="uppercase mb-1 block"
              style={{fontFamily:ED_MONO,fontSize:fs(10),letterSpacing:".1em",color:ED_INK3}}
            >To</label>
            <div className="flex gap-2">
              <div
                className={t("flex-1 h-[60px] px-4 flex items-center", "flex-1 h-[52px] px-4 flex items-center")}
                style={{fontFamily:ED_SERIF,fontSize:t(fs(30),fs(26)),color:ED_MONEY,background:CAT.money.bg,border:`1px solid ${CAT.money.soft}`,borderRadius:t("16px","14px")}}
              >
                {converting ? <Loader2 className="w-4 h-4 animate-spin" style={{color:ED_MONEY}} /> : (convertedAmount || "0.00")}
              </div>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger
                  className={t("w-[140px] h-[60px]", "w-[120px] h-[52px]")}
                  style={{borderColor:ED_RULE,borderRadius:t("16px","14px"),background:ED_IVORY2}}
                >
                  {toCurrency ? (
                    <div className="flex items-center gap-2">
                      <span>{getCurrencyFlag(toCurrency)}</span>
                      <span className="font-semibold">{toCurrency}</span>
                      {toCurrency === localCurrency && <span className="text-[calc(10px*var(--fs))]">📍</span>}
                    </div>
                  ) : (
                    <span className="text-gray-500">Select...</span>
                  )}
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="p-2 sticky top-0 bg-white border-b z-10">
                    <Input
                      placeholder="Search currency..."
                      value={toSearch}
                      onChange={(e) => e.stopPropagation() || setToSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  {organizedToCurrencies().map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      <div className="flex items-center gap-2">
                        <span>{curr.flag}</span>
                        <span className="font-medium">{curr.code}</span>
                        {curr.code === localCurrency && (
                          <span className="text-[calc(10px*var(--fs))] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">📍 Local</span>
                        )}
                        <span className="text-xs text-gray-500">- {curr.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rate Information */}
          {exchangeRate && (
            <div className="mt-3 rounded-[16px]" style={{background:CAT.money.bg,border:`1px solid ${CAT.money.soft}`,padding:t(fs(16),fs(14))}}>
              <div className="flex items-start gap-2.5">
                <TrendingUp className="mt-1 flex-shrink-0" style={{width:t(fs(18),fs(16)),height:t(fs(18),fs(16)),color:ED_MONEY}} />
                <div className="flex-1">
                  <p className="uppercase" style={{fontFamily:ED_MONO,fontSize:t(fs(9.5),fs(10)),letterSpacing:".1em",color:ED_MONEY,marginBottom:fs(3)}}>Mid-market rate</p>
                  <p style={{fontFamily:ED_SERIF,fontSize:t(fs(22),fs(20)),lineHeight:1.05,color:ED_INK}}>
                    1 {fromCurrency} = {exchangeRate?.toFixed(4)} {toCurrency}
                  </p>
                  {rateTimestamp && (
                    <p style={{fontSize:t(fs(12),fs(11.5)),color:ED_INK3,marginTop:fs(2)}}>
                      Rate updated: {rateTimestamp}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2 mt-2.5 pt-2.5" style={{borderTop:`1px solid ${ED_RULE}`}}>
                <Info className="mt-0.5 flex-shrink-0" style={{width:fs(14),height:fs(14),color:ED_MONEY}} />
                <p className="leading-relaxed" style={{fontSize:t(fs(12),fs(11.5)),color:ED_INK3}}>
                  Mid-market rate. Exchange stores may charge 2-5% fees.
                </p>
              </div>
            </div>
          )}

          {/* Popular Conversions */}
          {localCurrency && localCurrency !== fromCurrency && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="w-full uppercase" style={{fontFamily:ED_MONO,fontSize:t(fs(9.5),fs(10)),letterSpacing:".12em",color:ED_INK3,marginBottom:fs(2)}}>Popular conversions</span>
              <button
                onClick={() => {
                  setFromCurrency("USD");
                  setToCurrency(localCurrency);
                  setCurrencyLookup(localCurrency);
                }}
                className="rounded-full transition-colors"
                style={{background:CAT.money.bg,color:ED_MONEY,fontFamily:ED_MONO,fontSize:t(fs(11),fs(11)),letterSpacing:".02em",fontWeight:600,padding:`${fs(7)} ${fs(14)}`,border:`1px solid ${CAT.money.soft}`}}
              >
                USD → {localCurrency}
              </button>
              <button
                onClick={() => {
                  setFromCurrency(localCurrency);
                  setToCurrency("USD");
                  setCurrencyLookup("USD");
                }}
                className="rounded-full transition-colors"
                style={{background:CAT.money.bg,color:ED_MONEY,fontFamily:ED_MONO,fontSize:t(fs(11),fs(11)),letterSpacing:".02em",fontWeight:600,padding:`${fs(7)} ${fs(14)}`,border:`1px solid ${CAT.money.soft}`}}
              >
                {localCurrency} → USD
              </button>
              <button
                onClick={() => {
                  setFromCurrency("EUR");
                  setToCurrency(localCurrency);
                  setCurrencyLookup(localCurrency);
                }}
                className="rounded-full transition-colors"
                style={{background:CAT.money.bg,color:ED_MONEY,fontFamily:ED_MONO,fontSize:t(fs(11),fs(11)),letterSpacing:".02em",fontWeight:600,padding:`${fs(7)} ${fs(14)}`,border:`1px solid ${CAT.money.soft}`}}
              >
                EUR → {localCurrency}
              </button>
            </div>
          )}
            </div>
          )}
        </div>

        {/* OR DIVIDER - Only show when converter is expanded */}
        {!converterCollapsed && (
          <div className={t("relative flex items-center justify-center py-7", "relative flex items-center justify-center py-5")}>
            <div className="flex-1" style={{height:1,background:ED_RULE}}></div>
            <span className="mx-4 uppercase" style={{fontFamily:ED_MONO,fontSize:t(fs(11),fs(10.5)),letterSpacing:".18em",color:ED_INK3}}>or</span>
            <div className="flex-1" style={{height:1,background:ED_RULE}}></div>
          </div>
        )}

        {/* Currency Availability Section */}
        <div
          className={t("rounded-[24px] p-5 mb-3", "rounded-[20px] p-4 mb-3")}
          style={{background:"#FFFFFF",border:`1px solid ${ED_RULE}`,boxShadow:"0 1px 0 rgba(15,20,25,.04), 0 12px 32px -16px rgba(15,20,25,.12)"}}
        >
          <h3 className="mb-3" style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:t(fs(28),fs(22)),lineHeight:1,color:ED_INK}}>Money Exchange Near You</h3>

          {/* Editorial prompt banner + Currency Lookup Dropdown */}
          <div className="mb-4">
            <div className="rounded-[16px] p-4 mb-3" style={{background:CAT.money.bg,border:`1px solid ${CAT.money.soft}`}}>
              <div className="flex items-center gap-2.5" style={{color:ED_MONEY}}>
                <Search className="flex-shrink-0" style={{width:t(fs(20),fs(18)),height:t(fs(20),fs(18))}} />
                <p style={{fontFamily:ED_SERIF,fontSize:t(fs(22),fs(20)),lineHeight:1.05,color:ED_INK}}>
                  What currency are you looking for?
                </p>
              </div>
            </div>

            <Select value={currencyLookup} onValueChange={(value) => {
              setCurrencyLookup(value);
              setToCurrency(value);
            }}>
              <SelectTrigger
                className={t("w-full h-[52px]", "w-full h-[48px]")}
                style={{borderColor:ED_RULE,borderRadius:"14px",background:ED_IVORY2}}
              >
                {currencyLookup ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getCurrencyFlag(currencyLookup)}</span>
                    <span className="font-semibold">{currencyLookup} - {getCurrencyName(currencyLookup)}</span>
                  </div>
                ) : (
                  <span className="text-gray-500">Select a currency...</span>
                )}
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                <div className="p-2 border-b bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600">MAJOR CURRENCIES</p>
                </div>
                {getMajorCurrencies().map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{curr.flag}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-[calc(14px*var(--fs))]">{curr.code} - {curr.name}</p>
                        <p className="text-[calc(11px*var(--fs))] text-green-600">✓ Usually Available</p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
                
                <div className="p-2 border-b bg-gray-50 mt-2">
                  <p className="text-xs font-semibold text-gray-600">COMMONLY AVAILABLE</p>
                </div>
                {getCommonCurrencies().map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{curr.flag}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-[calc(14px*var(--fs))]">{curr.code} - {curr.name}</p>
                        <p className="text-[calc(11px*var(--fs))] text-green-600">✓ Commonly Available</p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
                
                <div className="p-2 border-b bg-gray-50 mt-2">
                  <p className="text-xs font-semibold text-gray-600">ORDER REQUIRED</p>
                </div>
                {getOrderRequiredCurrencies().map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{curr.flag}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-[calc(14px*var(--fs))]">{curr.code} - {curr.name}</p>
                        <p className="text-[calc(11px*var(--fs))] text-orange-600">⏱ Order Required (1-3 days)</p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Local Currency Display */}
          {localCurrencyData && (
            <div className="mt-6 pt-4" style={{borderTop:`1px solid ${ED_RULE}`}}>
              <div className="flex items-center gap-2 mb-2">
                <MapPin style={{width:fs(14),height:fs(14),color:ED_INK3}} />
                <h4 className="uppercase" style={{fontFamily:ED_MONO,fontSize:t(fs(10),fs(10)),letterSpacing:".1em",color:ED_INK3}}>Your Local Currency</h4>
              </div>
              <div className="rounded-[14px] p-3.5" style={{background:ED_IVORY2,border:`1px solid ${ED_RULE}`}}>
                <div className="flex items-center gap-2.5">
                  <span style={{fontSize:t(fs(26),fs(24))}}>{localCurrencyData.flag}</span>
                  <div className="flex-1">
                    <p style={{fontFamily:ED_SERIF,fontSize:t(fs(18),fs(17)),lineHeight:1.1,color:ED_INK}}>
                      {localCurrencyData.code} - {localCurrencyData.name}
                    </p>
                    <p style={{fontSize:t(fs(12),fs(11.5)),color:ED_MONEY,marginTop:fs(2),fontWeight:600}}>
                      ✓ Usually available in stock
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Exchange Stores Section */}
        {activeLocation?.coordinates && toCurrency && fromCurrency && (
          <div
            id="exchange-stores-map"
            className={t("rounded-[24px] p-5 mb-6", "rounded-[20px] p-4 mb-6")}
            style={{background:"#FFFFFF",border:`1px solid ${ED_RULE}`,boxShadow:"0 1px 0 rgba(15,20,25,.04), 0 12px 32px -16px rgba(15,20,25,.12)"}}
          >
            <h3 className="mb-1" style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:t(fs(28),fs(22)),lineHeight:1.02,color:ED_INK}}>Exchange Stores for {toCurrency}</h3>
            <p className="mb-4" style={{fontSize:t(fs(13),fs(13.5)),color:ED_INK3}}>
              Showing stores that exchange {fromCurrency} to {toCurrency}
            </p>

            {/* View Mode Tabs + Refresh Button */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p
                  className="uppercase"
                  style={{fontFamily:ED_MONO,fontSize:fs(10),letterSpacing:".1em",color:ED_INK3}}
                >VIEW MODE</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[calc(11px*var(--fs))] px-3"
                  onClick={() => loadExchangeStores(true)}
                  disabled={loadingStores}
                >
                  🔄 Refresh
                </Button>
              </div>
              <div className="flex gap-2" style={{borderBottom:`1px solid ${ED_RULE}`}}>
                <button
                  onClick={() => {
                    setViewMode("list");
                    setSelectedStoreIndex(null);
                  }}
                  className="pb-2 px-3 font-semibold transition-colors"
                  style={{fontSize:t(fs(13),fs(13.5)),color:viewMode === "list" ? ED_MONEY : ED_INK3,borderBottom:viewMode === "list" ? `2px solid ${ED_MONEY}` : "2px solid transparent"}}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className="pb-2 px-3 font-semibold transition-colors"
                  style={{fontSize:t(fs(13),fs(13.5)),color:viewMode === "map" ? ED_MONEY : ED_INK3,borderBottom:viewMode === "map" ? `2px solid ${ED_MONEY}` : "2px solid transparent"}}
                >
                  Map View
                </button>
              </div>
            </div>

            {/* Sort By Tabs - Only show in list view */}
            {viewMode === "list" && (
              <div className="mb-4">
                <p
                  className="mb-2 uppercase"
                  style={{fontFamily:ED_MONO,fontSize:fs(10),letterSpacing:".1em",color:ED_INK3}}
                >SORT BY</p>
                <div className="flex gap-2" style={{borderBottom:`1px solid ${ED_RULE}`}}>
                  <button
                    onClick={() => setSortBy("distance")}
                    className="pb-2 px-3 font-semibold transition-colors"
                    style={{fontSize:t(fs(13),fs(13.5)),color:sortBy === "distance" ? ED_MONEY : ED_INK3,borderBottom:sortBy === "distance" ? `2px solid ${ED_MONEY}` : "2px solid transparent"}}
                  >
                    📍 Nearest
                  </button>
                  <button
                    onClick={() => setSortBy("rate")}
                    className="pb-2 px-3 font-semibold transition-colors"
                    style={{fontSize:t(fs(13),fs(13.5)),color:sortBy === "rate" ? ED_MONEY : ED_INK3,borderBottom:sortBy === "rate" ? `2px solid ${ED_MONEY}` : "2px solid transparent"}}
                  >
                    💰 Best Rate
                  </button>
                </div>
              </div>
            )}

            {/* Open Only Filter */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openOnly}
                  onChange={(e) => setOpenOnly(e.target.checked)}
                  className="w-4 h-4 bg-gray-100 border-gray-300 rounded cursor-pointer"
                  style={{accentColor:ED_MONEY}}
                />
                <span
                  className="font-semibold"
                  style={{fontSize:t(fs(13.5),fs(13.5)),color:ED_INK2}}
                >Show only open stores</span>
              </label>
            </div>

            {/* Radius Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <p
                  className="uppercase"
                  style={{fontFamily:ED_MONO,fontSize:fs(10),letterSpacing:".1em",color:ED_INK3}}
                >Search Radius</p>
                <div className="flex items-center gap-2">
                  <DistanceUnitToggle
                    unit={usesMiles ? 'mi' : 'km'}
                    setUnit={(u) => {
                      const next = u === 'mi';
                      setUsesMiles(next);
                      const arr = next ? RADIUS_VALUES.mi : RADIUS_VALUES.km;
                      const def = next ? DEFAULT_RADIUS.mi : DEFAULT_RADIUS.km;
                      setSearchRadius(def);
                      setRadiusIndex(arr.indexOf(def));
                      setDistanceUnit(next ? 'mi' : 'km');
                    }}
                    variant="light"
                  />
                  <span
                    style={{fontFamily:ED_SERIF,fontSize:t(fs(18),fs(17)),color:ED_MONEY}}
                  >{searchRadius} {distanceUnit}</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={radiusArray.length - 1}
                value={radiusIndex}
                onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{accentColor:ED_MONEY}}
              />
              <div
                className="flex justify-between mt-1"
                style={{fontFamily:ED_MONO,fontSize:fs(10),color:ED_INK3}}
              >
                <span>{radiusArray[0]}{distanceUnit}</span>
                <span>{radiusArray[Math.floor(radiusArray.length / 2)]}{distanceUnit}</span>
                <span>{radiusArray[radiusArray.length - 1]}{distanceUnit}</span>
              </div>
            </div>

            {/* Store Listings */}
            {loadingStores ? (
              <div className="flex flex-col items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mb-3" style={{color:ED_MONEY}} />
                <p style={{fontSize:t(fs(13),fs(13.5)),color:ED_INK3}}>Finding exchange stores...</p>
              </div>
            ) : viewMode === "list" ? (
              exchangeStores.length > 0 ? (
                <div className="space-y-3">
                  {exchangeStores.slice(0, 10).map((store, index) => ( // Slice for list view
                    <div
                      key={index}
                      className={t("rounded-[18px] p-4", "rounded-[18px] p-4")}
                      style={{background:ED_IVORY2,border:`1px solid ${ED_RULE}`}}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex items-center justify-center flex-shrink-0"
                          style={{width:t(fs(36),fs(32)),height:t(fs(36),fs(32)),borderRadius:"50%",background:ED_MONEY}}
                        >
                          <span className="text-white" style={{fontFamily:ED_SERIF,fontSize:t(fs(18),fs(16))}}>{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 style={{fontFamily:ED_SERIF,fontWeight:400,fontSize:t(fs(22),fs(20)),lineHeight:1.05,color:ED_INK,marginBottom:fs(2),display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{store.name}</h4>
                          <NameLanguageHelp placeId={store.place_id || store.placeId || store.id} name={store.name} />

                          {store.exchange_rate && (
                            <div className="inline-block mb-2" style={{background:CAT.money.bg,color:ED_MONEY,fontFamily:ED_MONO,fontSize:t(fs(12),fs(11.5)),fontWeight:600,padding:`${fs(4)} ${fs(10)}`,borderRadius:"10px",border:`1px solid ${CAT.money.soft}`}}>
                              1 {fromCurrency} = {store.exchange_rate.toFixed(4)} {toCurrency}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-3 h-3" style={{color:ED_MONEY}} />
                            <span
                              className="font-semibold"
                              style={{fontSize:t(fs(12.5),fs(12.5)),color:ED_MONEY}}
                            >
                              📍 {formatDistance(store.distance_miles)} away
                            </span>
                          </div>

                          <p
                            className="mb-2"
                            style={{fontSize:t(fs(12.5),fs(12.5)),color:ED_INK3}}
                          >{store.address}</p>

                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            {store.is_open !== undefined && (
                              <span
                                className="font-semibold"
                                style={{fontSize:t(fs(12),fs(12)),color:store.is_open ? ED_MONEY : "#DC2626"}}
                              >
                                {store.is_open ? '● Open Now' : '● Closed'}
                              </span>
                            )}
                            {store.hours_today && (
                              <span
                                style={{fontSize:t(fs(12),fs(12)),color:ED_INK2}}
                              >🕐 {store.hours_today.split(':').slice(1).join(':').trim()}</span>
                            )}
                            {store.phone && (
                              <a
                                href={`tel:${store.phone}`}
                                className="flex items-center gap-1"
                                style={{fontSize:t(fs(12),fs(12)),color:ED_INK3}}
                              >
                                <Phone className="w-3 h-3" />
                                {store.phone}
                              </a>
                            )}
                          </div>

                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className={t("flex-1 h-9", "flex-1 h-9")}
                              style={{fontSize:t(fs(12.5),fs(12.5)),borderColor:CAT.money.soft,color:ED_MONEY,borderRadius:"12px",background:"#FFFFFF"}}
                              onClick={() => handleGetDirections(store)}
                            >
                              <Navigation className="w-3 h-3 mr-1" />
                              Directions
                            </Button>
                            <Button
                              size="sm"
                              className={t("flex-1 h-9", "flex-1 h-9")}
                              style={{fontSize:t(fs(12.5),fs(12.5)),background:ED_MONEY,borderRadius:"12px"}}
                              onClick={() => handleShowOnMap(index)}
                            >
                              <Map className="w-3 h-3 mr-1" />
                              Map
                            </Button>
                            {((store.hours && store.hours.length > 0) || store.website) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={t("flex-1 h-9", "flex-1 h-9")}
                                style={{fontSize:t(fs(12.5),fs(12.5)),borderColor:ED_RULE,color:ED_INK2,borderRadius:"12px",background:"#FFFFFF"}}
                                onClick={() => setExpandedStoreIndex(expandedStoreIndex === index ? null : index)}
                              >
                                {expandedStoreIndex === index ? '▲ Less' : '▼ Details'}
                              </Button>
                            )}
                          </div>

                          {expandedStoreIndex === index && ((store.hours && store.hours.length > 0) || store.website) && (
                            <div
                              className="mt-2 p-3 rounded-[12px]"
                              style={{background:"#FFFFFF",border:`1px solid ${ED_RULE}`}}
                            >
                              {store.hours && store.hours.length > 0 && (
                                <>
                                  <div
                                    className="uppercase mb-1"
                                    style={{fontFamily:ED_MONO,fontSize:t(fs(9.5),fs(10)),letterSpacing:".1em",color:ED_INK3}}
                                  >🕐 Weekly Hours</div>
                                  {store.hours.map((h, di) => {
                                    const today = new Date().getDay();
                                    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                                    const dayIdx = dayNames.findIndex(d => h?.toLowerCase?.().startsWith(d.toLowerCase()));
                                    const isToday = dayIdx === today;
                                    const parts = (h || '').split(':');
                                    const dayName = parts[0];
                                    const hrs = parts.slice(1).join(':').trim();
                                    return (
                                      <div
                                        key={di}
                                        className="flex justify-between py-0.5"
                                        style={{fontSize:t(fs(12),fs(12)),fontWeight:isToday ? 700 : 400,color:isToday ? ED_MONEY : ED_INK2}}
                                      >
                                        <span>{dayName}{isToday && ' (Today)'}</span>
                                        <span className={hrs.toLowerCase() === 'closed' ? 'text-red-600' : ''} style={hrs.toLowerCase() !== 'closed' ? {color:ED_INK2} : undefined}>{hrs}</span>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                              {store.website && (
                                <a
                                  href={store.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`block font-semibold ${store.hours && store.hours.length > 0 ? 'mt-2 pt-2' : ''}`}
                                  style={{fontSize:t(fs(12),fs(12)),color:ED_MONEY,borderTop:(store.hours && store.hours.length > 0) ? `1px solid ${ED_RULE}` : undefined}}
                                >
                                  🌐 Visit Website
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="mb-2" style={{fontFamily:ED_SERIF,fontSize:t(fs(20),fs(20)),color:ED_INK}}>No exchange stores found nearby</p>
                  <p style={{fontSize:t(fs(13),fs(13.5)),color:ED_INK3}}>Try increasing the search radius</p>
                </div>
              )
            ) : ( // Map View
              <div className="relative h-[500px] rounded-lg overflow-hidden border border-gray-200">
                {/* Exit Map Button */}
                <button
                  onClick={() => setViewMode('list')}
                  className="fixed right-4 z-[1200] w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                  style={{ top: 'calc(50px + env(safe-area-inset-top) + 10px)' }}
                  aria-label="Close Map"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>

                {mapCenter && activeLocation?.coordinates && (
                  <MapContainer
                    center={mapCenter}
                    zoom={selectedStore ? 15 : 12}
                    style={{ height: "100%", width: "100%" }}
                    key={`${mapCenter[0]}-${mapCenter[1]}`}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapCenterController center={mapCenter} zoom={selectedStore ? 15 : 12} />

                    {/* "You are here" user-location marker with collapsible
                        tooltip BELOW the pin (mirrors the ThingsToDo
                        TierMapOverlay pattern for anti-overlap + city/state
                        context). The tooltip can be collapsed via the ⌃
                        button to a compact "📍 You are here ⌄" pill, then
                        re-expanded by tapping the pill. Tooltip is rendered
                        below to avoid colliding with store popups above
                        their markers. */}
                    {activeLocation?.coordinates && (
                      <Marker
                        position={[activeLocation.coordinates.latitude, activeLocation.coordinates.longitude]}
                        icon={L.divIcon({
                          className: 'gs-user-loc-icon',
                          html: `<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
                          iconSize: [16, 16],
                          iconAnchor: [8, 8]
                        })}
                      >
                        <Tooltip permanent direction="bottom" offset={[0, 12]} opacity={1} interactive className="gs-user-tooltip">
                          {userPinExpanded ? (
                            <div style={{fontFamily:"-apple-system,sans-serif",padding:"4px 6px",minWidth:"150px",position:"relative"}}>
                              <button
                                onClick={(e)=>{e.stopPropagation();setUserPinExpanded(false);}}
                                aria-label="Collapse"
                                style={{position:"absolute",top:"0",right:"0",width:"22px",height:"22px",borderRadius:"50%",background:"rgba(0,0,0,0.08)",border:"none",cursor:"pointer",color:"#1A2332",fontSize:"calc(10px*var(--fs))",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}
                              >⌃</button>
                              <div style={{fontWeight:800,color:"#1A2332",fontSize:"calc(12px*var(--fs))",marginBottom:"2px",paddingRight:"22px"}}>📍 You are here</div>
                              <div style={{fontWeight:700,color:"#4285F4",fontSize:"calc(11px*var(--fs))",marginBottom:"2px"}}>{activeLocation.mode === 'navigate' ? 'Selected location' : 'Current location'}</div>
                              <div style={{color:"#64748B",fontSize:"calc(10px*var(--fs))",lineHeight:1.3}}>{getLocationLabel(activeLocation) || ''}</div>
                            </div>
                          ) : (
                            <div
                              onClick={(e)=>{e.stopPropagation();setUserPinExpanded(true);}}
                              style={{fontFamily:"-apple-system,sans-serif",padding:"3px 7px",display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"}}
                            >
                              <span style={{fontWeight:700,color:"#1A2332",fontSize:"calc(11px*var(--fs))"}}>📍 You are here</span>
                              <span style={{color:"#64748B",fontSize:"calc(10px*var(--fs))",fontWeight:700}}>⌄</span>
                            </div>
                          )}
                        </Tooltip>
                      </Marker>
                    )}

                    {exchangeStores.map((store, index) => (
                      <Marker
                        key={index}
                        position={[store.latitude, store.longitude]}
                        icon={L.divIcon({
                          className: 'custom-div-icon',
                          html: `<div style='background-color:${selectedStoreIndex === index ? '#FF6B35' : '#667eea'};width:2.5rem;height:2.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);'><span style='color:white;font-weight:bold;font-size:0.9rem;'>${index + 1}</span></div>`,
                          iconSize: [40, 40],
                          iconAnchor: [20, 20]
                        })}
                      >
                        <Popup>
                          <div className="p-2" style={{ minWidth: '200px' }}>
                            <h4 className="font-bold mb-1" style={{ fontSize: 'calc(14px*var(--fs))' }}>{store.name}</h4>
                            {store.exchange_rate && (
                              <p className="text-xs font-semibold text-blue-600 mb-1">
                                1 {fromCurrency} = {store.exchange_rate.toFixed(4)} {toCurrency}
                              </p>
                            )}
                            <p className="text-xs text-gray-600 mb-1">{store.address}</p>
                            <p className="text-xs text-gray-600 mb-2">
                              📍 {formatDistance(store.distance_miles)} away
                            </p>
                            {store.phone && (
                              <p className="text-gray-600 mb-2" style={{ fontSize: 'calc(12px*var(--fs))' }}>
                                📞 {store.phone}
                              </p>
                            )}
                            {store.is_open !== undefined && (
                              <p className={`font-semibold mb-2 ${store.is_open ? 'text-green-600' : 'text-red-600'}`} style={{ fontSize: 'calc(12px*var(--fs))' }}>
                                {store.is_open ? '● Open Now' : '● Closed'}
                                {store.hours_today && (
                                  <span className="text-gray-600 font-normal ml-1">
                                    · {store.hours_today.includes(':') ? store.hours_today.split(':').slice(1).join(':').trim() : store.hours_today}
                                  </span>
                                )}
                              </p>
                            )}
                            <button
                              onClick={() => handleGetDirections(store)}
                              className="w-full text-xs bg-[#667eea] text-white px-3 py-2 rounded hover:bg-[#5568d3] font-semibold flex items-center justify-center gap-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                              </svg>
                              Get Directions
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    
                    <MapRecenterButton
                      map={null}
                      homeLocation={{
                        latitude: activeLocation.coordinates.latitude,
                        longitude: activeLocation.coordinates.longitude
                      }}
                      onRecenter={() => {
                        setSelectedStoreIndex(null);
                      }}
                    />
                  </MapContainer>
                )}
                {!mapCenter && (
                  <div className="h-full flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Map loading...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <LocationModePicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      />

      <MapAppSelector
        isOpen={showMapSelector}
        onClose={() => setShowMapSelector(false)}
        destination={selectedDestination}
        userLat={activeLocation?.coordinates?.latitude}
        userLng={activeLocation?.coordinates?.longitude}
      />
    </div>
  );
}