import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { useDismissable } from '@/lib/dismissStack';
import { useKeyboardOffset } from '@/lib/useKeyboardOffset';

const PLACE_TYPE_ICONS = {
  airport: '✈️',
  hotel: '🏨',
  restaurant: '🍽️',
  shopping: '🛍️',
  attraction: '🎭',
  park: '🌳',
  transit: '🚉',
  location: '📍'
};

export default function AddLocationDialog({ isOpen, onAdd, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Float the card centered ABOVE the on-screen keyboard (input is pinned at
  // the top, results scroll below) — see useKeyboardOffset.
  const keyboardOffset = useKeyboardOffset(isOpen);

  useDismissable(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) {
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

  const handleSelectLocation = (location) => {
    onAdd(location);
    setSearchQuery('');
    setSearchResults([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center px-3 py-[6vh]"
      style={keyboardOffset ? { paddingTop: 16, paddingBottom: keyboardOffset + 16 } : undefined}
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
        style={{ maxHeight: keyboardOffset ? `calc(100vh - ${keyboardOffset + 32}px)` : '85vh' }}
      >
        <div className="bg-gradient-to-r from-[#3A6EA5] to-[#1E3150] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-[20px] font-bold">Add New Location</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input — PINNED above the scroll area so the on-screen keyboard
            and populating results can never push it off the top of the screen. */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Search for a location
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Empire State Building, hotel name, restaurant..."
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
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 Search for a place to save it for quick access later
            </p>
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
                {searchResults.map((result, index) => {
                  const isCity = result.granularity === 'city';
                  return (
                    <button
                      key={index}
                      onClick={() => handleSelectLocation(result)}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors flex items-start gap-3 border-2 border-transparent hover:border-blue-300"
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
                      <div className="text-green-600 font-bold text-xl flex-shrink-0">+</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}