import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Navigation, Search, Loader2, AlertCircle, Crosshair, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { useLocation } from './LocationContext';
import { useIsTablet } from '@/lib/useIsTablet';
import { useKeyboardOffset } from '@/lib/useKeyboardOffset';
import { useDismissable } from '@/lib/dismissStack';

// Preset cities for one-tap testing in the coordinate-entry mode.
// Order is roughly by global familiarity / common test scenarios so
// the row reads predictably. Keep this list short — these chips are
// shortcuts, not a city directory; the user can paste any lat/lng
// they want in the input above.
const PRESET_COORDS = [
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'New York',      lat: 40.7128, lng: -74.0060 },
  { name: 'London',        lat: 51.5074, lng: -0.1278 },
  { name: 'Tokyo',         lat: 35.6762, lng: 139.6503 },
  { name: 'Manila',        lat: 14.5995, lng: 120.9842 },
  { name: 'Sydney',        lat: -33.8688, lng: 151.2093 },
];

const PLACE_TYPE_ICONS = {
  airport: '✈️',
  hotel: '🏨',
  restaurant: '🍽️',
  shopping: '🛍️',
  attraction: '🎭',
  park: '🌳',
  transit: '🚉',
  current_location: '📍',
  location: '📍'
};

export default function LocationModePicker({ isOpen, onClose, coldOpen = false, lastLocation = null, onSnoozeToday }) {
  const {
    locationMode,
    selectedLocation,
    switchToCurrentLocation,
    switchToNavigateMode,
    getCurrentLocation,
    getSavedLocations,
  } = useLocation();
  // iPad: scale the whole picker up so its (phone-sized) text + controls read
  // comfortably on the large canvas. zoom scales uniformly; the max-height is
  // pulled in to compensate so the zoomed card still fits the viewport.
  const isTablet = useIsTablet();

  const [mode, setMode] = useState('select'); // 'select', 'search', 'coords', 'info'
  // Keyboard-aware placement: only the text-input modes raise the keyboard.
  // Track its height so the card floats centered in the visible area ABOVE the
  // keyboard (input + results stay in view). See useKeyboardOffset.
  const needsKeyboard = mode === 'search' || mode === 'coords';
  const keyboardOffset = useKeyboardOffset(isOpen && needsKeyboard);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savedLocations, setSavedLocations] = useState([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [coordsInput, setCoordsInput] = useState('');
  const [coordsApplying, setCoordsApplying] = useState(false);
  const [coordsError, setCoordsError] = useState('');

  useDismissable(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      loadSavedLocations();
      setMode('select');
      setSearchQuery('');
      setSearchResults([]);
      setErrorMessage('');
      setCoordsInput('');
      setCoordsError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      const timer = setTimeout(() => {
        performSearch(searchQuery);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setErrorMessage('');
    }
  }, [searchQuery]);

  // Saved locations come from on-device storage now (src/lib/savedLocations.js),
  // so this is a synchronous read — no auth/network round-trip that could fail.
  const loadSavedLocations = () => {
    setSavedLocations(getSavedLocations());
  };

  const performSearch = async (query) => {
    setSearching(true);
    setErrorMessage('');
    
    try {
      const { data } = await callWorker(ROUTE.searchLocation, {
        query: query
      });

      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setErrorMessage('');
      } else {
        setSearchResults([]);
        setErrorMessage(data.message || 'No locations found. Please search for a specific address, landmark, or place.');
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      setSearchResults([]);
      setErrorMessage('Error searching. Please try again.');
    }
    
    setSearching(false);
  };

  const handleUseCurrentLocation = async () => {
    setGpsLoading(true);
    setErrorMessage('');
    
    try {
      // Don't pre-check permission - just try to get location
      // The browser will prompt if needed
      await switchToCurrentLocation();
      onClose();
    } catch (error) {
      console.error('Error using current location:', error);
      
      // Show user-friendly error based on error type
      if (error.code === 1) {
        // Permission denied
        setErrorMessage('Location access was denied. Please enable location permissions in your browser settings, then try again.');
      } else if (error.code === 2) {
        // Position unavailable
        setErrorMessage('Unable to determine your location. Please check your GPS/location settings and try again.');
      } else if (error.code === 3) {
        // Timeout
        setErrorMessage('Location request timed out. Please try again.');
      } else {
        setErrorMessage('Unable to get your current location. Please try again or choose a location manually.');
      }
    }
    
    setGpsLoading(false);
  };

  const handleSelectNavigateLocation = (location) => {
    setMode('info');
    setTimeout(async () => {
      await switchToNavigateMode(location);
      onClose();
    }, 1500);
  };

  const handleSelectSavedLocation = async (location) => {
    await switchToNavigateMode(location);
    onClose();
  };

  // Parse "lat, lng" / "lat lng" / "lat,lng" into a coordinate pair,
  // reverse-geocode for the city label, and switch to Navigate Mode.
  // Useful for: simulator testing without a real GPS fix, power users
  // who paste from Google Maps, and field testing at a specific point
  // (no street address yet, just numbers from a GPS unit).
  //
  // The location object shape mirrors what searchLocation returns so
  // the rest of the app (greeting headline, finders, "Detecting your
  // location…" placeholder, saved-locations dedup) treats it
  // identically to a searched-and-tapped result.
  const handleApplyCoordinates = async () => {
    setCoordsError('');

    // Accept comma, comma+space, or just whitespace as the separator —
    // Google Maps copies as "lat, lng" but pasted GPS readings often
    // come as "lat lng" or "lat,lng" with no space.
    const parts = coordsInput.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length !== 2) {
      setCoordsError('Enter two numbers separated by a comma (latitude, longitude).');
      return;
    }

    const lat = Number(parts[0]);
    const lng = Number(parts[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setCoordsError('Both values must be numbers.');
      return;
    }
    if (lat < -90 || lat > 90) {
      setCoordsError('Latitude must be between -90 and 90.');
      return;
    }
    if (lng < -180 || lng > 180) {
      setCoordsError('Longitude must be between -180 and 180.');
      return;
    }

    setCoordsApplying(true);

    try {
      const { data } = await callWorker(ROUTE.reverseGeocode, {
        latitude: lat,
        longitude: lng,
      });

      const formatted = [data.city, data.state_or_country].filter(Boolean).join(', ');
      const location = {
        // Same fallback chain LocationContext uses for GPS fixes — drop
        // the literal placeholder strings, fall back to the bare
        // coordinates if the geocoder returns nothing usable (e.g. a
        // pin in the middle of an ocean).
        placeName: data.city || data.state_or_country || data.country || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        address: {
          formatted: formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          city: data.city || '',
          state: '',
          postalCode: '',
          country: data.country || data.state_or_country || '',
        },
        coordinates: { latitude: lat, longitude: lng },
        placeType: 'location',
      };

      await switchToNavigateMode(location);
      onClose();
    } catch (error) {
      console.error('Error applying coordinates:', error);
      setCoordsError('Could not look up that location. Please try again.');
    }

    setCoordsApplying(false);
  };

  if (!isOpen) return null;

  // Placement: always vertically CENTER the card, but center it inside the
  // space left ABOVE the keyboard (paddingBottom = keyboardOffset). This keeps
  // the address bar near the middle of the screen while guaranteeing the input
  // AND its result list stay visible above the keyboard on iPhone/iPad/Android.
  // The card height is capped to that same visible area so results never hide
  // behind the keyboard (divided by the iPad zoom factor so the cap holds when
  // the card is scaled up).
  const zoomFactor = isTablet ? 1.3 : 1;
  const modalStyle = {
    // Cap to the space between the top safe-area (notch) and the keyboard, using
    // dvh so mobile browser chrome + the notch are respected — the pinned header
    // stays visible and only the results list scrolls.
    maxHeight: keyboardOffset
      ? `calc((100dvh - env(safe-area-inset-top, 0px) - ${keyboardOffset + 40}px) / ${zoomFactor})`
      : (isTablet ? '64vh' : `calc((100dvh - env(safe-area-inset-top, 0px) - 48px) / ${zoomFactor})`),
    ...(isTablet ? { zoom: 1.3 } : {}),
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9998] overflow-y-auto flex items-start justify-center px-3"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            paddingBottom: keyboardOffset ? keyboardOffset + 16 : 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
            style={modalStyle}
          >
            {/* Mode Selection */}
            {mode === 'select' && (
              <>
                <div className="bg-gradient-to-r from-[#3A6EA5] to-[#1E3150] text-white px-5 py-4 flex items-start justify-between flex-shrink-0">
                  <div className="pr-3">
                    <h2 className="text-[20px] font-bold">{coldOpen ? 'Where to today?' : 'Select Location Mode'}</h2>
                    <p className="text-[12.5px] text-white/80 mt-0.5 leading-snug">
                      Globeskimmers finds places near you. Where should we start?
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {/* Cold-open only: one tap to stay where they already were. */}
                  {coldOpen && (lastLocation?.placeName || lastLocation?.address?.city) && (
                    <button
                      onClick={onClose}
                      className="w-full mb-4 bg-blue-50 border-2 border-blue-200 hover:bg-blue-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl flex-shrink-0">🧭</span>
                        <span className="flex flex-col items-start leading-tight min-w-0">
                          <span className="text-[15px] font-bold text-gray-900">Continue in {lastLocation.placeName || lastLocation.address?.city}</span>
                          <span className="text-[12px] text-gray-500 font-medium">Continue where you left off</span>
                        </span>
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </button>
                  )}

                  <Button
                    onClick={handleUseCurrentLocation}
                    disabled={gpsLoading}
                    className="w-full h-16 bg-gradient-to-r from-[#3A6EA5] to-[#4A7EBA] hover:opacity-90 text-white font-semibold mb-4 flex items-center justify-center gap-3 text-[16px]"
                  >
                    {gpsLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Navigation className="w-5 h-5" />
                    )}
                    {gpsLoading ? 'Getting Location...' : 'Use My Current Location'}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-gray-500 font-semibold">OR</span>
                    </div>
                  </div>

                  {savedLocations.length > 0 && (
                    <>
                      {/* One tidy button instead of an inline list — opens a
                          dedicated, scrollable saved-locations view (handles 10+
                          cleanly). */}
                      <button
                        onClick={() => setMode('saved')}
                        className="w-full bg-blue-50 border-2 border-blue-200 hover:bg-blue-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl flex-shrink-0">📌</span>
                          <span className="flex flex-col items-start leading-tight min-w-0">
                            <span className="text-[15px] font-bold text-gray-900">Saved Locations</span>
                            <span className="text-[12px] text-gray-500 font-medium truncate">
                              {savedLocations.length} saved · tap to pick one
                            </span>
                          </span>
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </button>

                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-3 text-gray-500 font-semibold">or search new location</span>
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    onClick={() => setMode('search')}
                    className="w-full h-16 bg-white border-2 border-[#3A6EA5] text-[#3A6EA5] hover:bg-gray-50 font-semibold flex items-center justify-center gap-3 text-[16px]"
                  >
                    <MapPin className="w-5 h-5" />
                    {savedLocations.length > 0 ? 'Search Different Location' : 'Navigate to Another Location'}
                  </Button>

                  {/* Coordinate entry. Tertiary visual weight — most
                      users won't need this, but it's invaluable for
                      simulator testing and for power users who want to
                      pin to an exact lat/lng (e.g., a GPS reading
                      from a handheld unit, a Google Maps right-click
                      paste, or a research / field-work coordinate).
                      Reverse-geocodes the city so the home greeting
                      reads "Hello [Name], in [City]" automatically. */}
                  <button
                    onClick={() => setMode('coords')}
                    className="w-full mt-3 flex items-center justify-center gap-2 text-[12.5px] text-gray-500 hover:text-gray-700 font-medium transition-colors py-2"
                  >
                    <Crosshair className="w-4 h-4" />
                    Or enter coordinates manually
                  </button>

                  {/* Cold-open only: let frequent users silence today's chooser. */}
                  {coldOpen && (
                    <button
                      onClick={() => { onSnoozeToday?.(); onClose(); }}
                      className="w-full mt-4 pt-3 border-t border-gray-100 text-[12.5px] text-gray-400 hover:text-gray-600 font-medium transition-colors py-1"
                    >
                      Don’t ask again today
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Saved Locations Mode — a focused, scrollable list to pick one to
                navigate from (handles 10+). The ✕ returns to the select screen
                (Use current location / search another). */}
            {mode === 'saved' && (
              <>
                <div className="bg-gradient-to-r from-[#3A6EA5] to-[#1E3150] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-[20px] font-bold">Saved Locations</h2>
                  <button
                    onClick={() => setMode('select')}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    aria-label="Back to location options"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Tap a place to navigate from it</p>
                  {savedLocations.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-10">No saved locations yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {savedLocations.map((location, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectSavedLocation(location)}
                          className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-3 border-2 border-blue-200"
                        >
                          <span className="text-2xl flex-shrink-0">{PLACE_TYPE_ICONS[location.placeType] || '📍'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {location.nickname || location.placeName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {location.address.formatted}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Coords Mode */}
            {mode === 'coords' && (
              <>
                <div className="bg-gradient-to-r from-[#3A6EA5] to-[#1E3150] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-[20px] font-bold">Enter Coordinates</h2>
                  <button
                    onClick={() => setMode('select')}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Latitude, Longitude
                  </label>
                  <div className="relative">
                    <Crosshair className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 37.7749, -122.4194"
                      value={coordsInput}
                      onChange={(e) => {
                        setCoordsInput(e.target.value);
                        if (coordsError) setCoordsError('');
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCoordinates(); }}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 mb-4">
                    Paste from Google Maps (right-click any point → coordinates).
                    Latitude first (-90 to 90), then longitude (-180 to 180).
                  </p>

                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Common cities</p>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COORDS.map(p => (
                        <button
                          key={p.name}
                          onClick={() => {
                            setCoordsInput(`${p.lat}, ${p.lng}`);
                            if (coordsError) setCoordsError('');
                          }}
                          className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full font-medium text-gray-700 transition-colors"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {coordsError && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-orange-800">{coordsError}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleApplyCoordinates}
                    disabled={coordsApplying || !coordsInput.trim()}
                    className="w-full h-12 bg-gradient-to-r from-[#3A6EA5] to-[#4A7EBA] hover:opacity-90 text-white font-semibold disabled:opacity-50"
                  >
                    {coordsApplying ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Looking up…</>
                    ) : (
                      'Use This Location'
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Search Mode */}
            {mode === 'search' && (
              <>
                <div className="bg-gradient-to-r from-[#3A6EA5] to-[#1E3150] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-[20px] font-bold">Search Location</h2>
                  <button
                    onClick={() => setMode('select')}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search input — PINNED above the scroll area so results + the
                    on-screen keyboard can't push it off the top of the screen. */}
                <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Enter a specific location
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Empire State Building, JFK Airport, hotel address..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>

                {/* Results / messages — the only part that scrolls. */}
                <div className="flex-1 overflow-y-auto px-5 py-4">

                  {errorMessage && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-orange-800">{errorMessage}</p>
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Search Results</p>
                      <div className="space-y-2">
                        {searchResults.map((result, index) => {
                          const isCity = result.granularity === 'city';
                          return (
                            <button
                              key={index}
                              onClick={() => handleSelectNavigateLocation(result)}
                              className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-start gap-3"
                            >
                              <span className="text-2xl flex-shrink-0">{isCity ? '🏙️' : (PLACE_TYPE_ICONS[result.placeType] || '📍')}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {result.placeName}
                                  </p>
                                  {isCity && (
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">CITY</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {result.address.formatted}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 capitalize">
                                  {isCity ? 'Search across the city' : result.placeType.replace('_', ' ')}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Info Mode */}
            {mode === 'info' && (
              <div className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#3A6EA5] to-[#4A7EBA] rounded-full flex items-center justify-center"
                >
                  <MapPin className="w-10 h-10 text-white" />
                </motion.div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">Navigate Mode Activated</h3>
                <p className="text-sm text-gray-600 mb-4">
                  All features will now use your selected location for finding places and information.
                </p>
                
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#3A6EA5] animate-spin" />
                  <span className="text-sm text-[#3A6EA5]">Updating...</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}