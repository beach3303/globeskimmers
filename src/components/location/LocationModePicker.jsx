import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Navigation, Search, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useLocation } from './LocationContext';

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

export default function LocationModePicker({ isOpen, onClose }) {
  const { 
    locationMode, 
    selectedLocation,
    switchToCurrentLocation,
    switchToNavigateMode,
    getCurrentLocation
  } = useLocation();

  const [mode, setMode] = useState('select'); // 'select', 'search', 'info'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savedLocations, setSavedLocations] = useState([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSavedLocations();
      setMode('select');
      setSearchQuery('');
      setSearchResults([]);
      setErrorMessage('');
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

  const loadSavedLocations = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return;

      const user = await base44.auth.me();
      setSavedLocations(user.saved_locations || []);
    } catch (error) {
      console.error('Error loading saved locations:', error);
    }
  };

  const performSearch = async (query) => {
    setSearching(true);
    setErrorMessage('');
    
    try {
      const { data } = await base44.functions.invoke('searchLocation', {
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9998] overflow-hidden flex items-center justify-center px-3">
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
            className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Mode Selection */}
            {mode === 'select' && (
              <>
                <div className="bg-gradient-to-r from-[#3A6EA5] to-[#1E3150] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-[20px] font-bold">Select Location Mode</h2>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
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
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">📌</span>
                        <p className="text-sm font-bold text-gray-700">Your Saved Locations</p>
                      </div>
                      <div className="space-y-2 mb-4">
                        {savedLocations.map((location, index) => (
                          <button
                            key={index}
                            onClick={() => handleSelectSavedLocation(location)}
                            className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-3 border-2 border-blue-200"
                          >
                            <span className="text-2xl">{PLACE_TYPE_ICONS[location.placeType] || '📍'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {location.nickname || location.placeName}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {location.address.formatted}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-3 text-gray-500 font-semibold">or search new location</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => setMode('search')}
                    className="w-full h-16 bg-white border-2 border-[#3A6EA5] text-[#3A6EA5] hover:bg-gray-50 font-semibold flex items-center justify-center gap-3 text-[16px]"
                  >
                    <MapPin className="w-5 h-5" />
                    {savedLocations.length > 0 ? 'Search Different Location' : 'Navigate to Another Location'}
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

                <div className="flex-1 overflow-y-auto p-5">
                  <div className="mb-4">
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
                        {searchResults.map((result, index) => (
                          <button
                            key={index}
                            onClick={() => handleSelectNavigateLocation(result)}
                            className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-start gap-3"
                          >
                            <span className="text-2xl flex-shrink-0">{PLACE_TYPE_ICONS[result.placeType] || '📍'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {result.placeName}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {result.address.formatted}
                              </p>
                              <p className="text-xs text-gray-400 mt-1 capitalize">
                                {result.placeType.replace('_', ' ')}
                              </p>
                            </div>
                          </button>
                        ))}
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