import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Navigation, Search, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getCurrentPositionSmart } from "@/lib/geolocation";
import { showToast } from "./Toast";

export default function LocationSelectorModal({ isOpen, onClose, globalLocationManager }) {
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentLocations, setRecentLocations] = useState([]);

  useEffect(() => {
    if (isOpen && globalLocationManager) {
      loadRecentLocations();
    }
  }, [isOpen, globalLocationManager]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      const timer = setTimeout(() => {
        searchLocations(searchQuery);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadRecentLocations = () => {
    if (globalLocationManager) {
      const recent = globalLocationManager.getRecentLocations();
      setRecentLocations(recent);
    }
  };

  const searchLocations = async (query) => {
    setSearchLoading(true);
    try {
      const { data } = await callWorker(ROUTE.searchLocation, {
        query: query
      });

      if (data && data.results) {
        setSearchResults(data.results.slice(0, 5));
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching locations:", error);
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  const handleUseCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      const position = await getCurrentPositionSmart({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });

      const { latitude, longitude } = position.coords;

      const { data: geocodedData } = await callWorker(ROUTE.reverseGeocode, {
        latitude,
        longitude
      });

      const newLocation = {
        city: geocodedData.city,
        state_or_country: geocodedData.state_or_country,
        country: geocodedData.country || geocodedData.state_or_country || "Unknown",
        latitude: geocodedData.latitude || latitude,
        longitude: geocodedData.longitude || longitude
      };

      await updateLocation(newLocation);
    } catch (error) {
      console.error("Error getting current location:", error);
      
      // Show specific error messages
      if (error.code === 1) {
        showToast("Location access denied. Please enable location permissions in your browser settings.", "error");
      } else if (error.code === 2) {
        showToast("Unable to determine your location. Please check your GPS settings.", "error");
      } else if (error.code === 3) {
        showToast("Location request timed out. Please try again.", "error");
      } else {
        showToast("Unable to access your current location. Please try again.", "error");
      }
    }
    setGpsLoading(false);
  };

  const handleSelectLocation = async (location) => {
    const newLocation = {
      city: location.city,
      state_or_country: location.state_or_country,
      country: location.country || location.state_or_country || "Unknown",
      latitude: location.latitude,
      longitude: location.longitude
    };

    await updateLocation(newLocation);
  };

  const updateLocation = async (newLocation) => {
    setLoading(true);
    try {
      if (globalLocationManager) {
        const success = await globalLocationManager.updateLocation(newLocation, base44);

        if (success) {
          showToast(`📍 Location updated to ${newLocation.city}, ${newLocation.state_or_country}`, "success");
          
          loadRecentLocations();
          onClose();
        } else {
          showToast("Failed to update location. Please try again.", "error");
        }
      }
    } catch (error) {
      console.error("Error updating location:", error);
      showToast("Failed to update location. Please try again.", "error");
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9998] overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          
          {/* Modal - Slide up from bottom (stays within app frame) */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[24px] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-[20px] font-bold">Change Location</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-5">
              <Button
                onClick={handleUseCurrentLocation}
                disabled={gpsLoading}
                className="w-full h-12 bg-gradient-to-r from-[#43e97b] to-[#38f9d7] hover:opacity-90 text-white font-semibold mb-4 flex items-center justify-center gap-2"
              >
                {gpsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
                {gpsLoading ? "Getting Location..." : "Use Current Location"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-500 font-semibold">OR</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Search for a location
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search city, airport..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-base"
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Search Results</p>
                  <div className="space-y-2">
                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectLocation(result)}
                        disabled={loading}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {result.city}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {result.state_or_country}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recentLocations.length > 0 && !searchQuery && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <p className="text-xs font-semibold text-gray-500 uppercase">Recent Locations</p>
                  </div>
                  <div className="space-y-2">
                    {recentLocations.map((location, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectLocation(location)}
                        disabled={loading}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {location.city}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {location.state_or_country}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!searchLoading && searchQuery.length > 2 && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No locations found</p>
                  <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}