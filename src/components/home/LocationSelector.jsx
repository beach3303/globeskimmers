import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, Navigation } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getCurrentPositionSmart } from "@/lib/geolocation";
import { motion } from "framer-motion";

export default function LocationSelector({ isOpen, onClose, onLocationSelected }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [gettingCurrent, setGettingCurrent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    setErrorMessage("");
    
    try {
      console.log("Searching for location:", searchQuery);
      
      const response = await callWorker(ROUTE.searchLocation, {
        query: searchQuery
      });

      console.log("Search response:", response);

      // Check if response has data property
      if (!response || !response.data) {
        setErrorMessage("Invalid response from server. Please try again.");
        setSearchResults([]);
        return;
      }

      // Check if there's an error in the response data
      if (response.data.error) {
        setErrorMessage(response.data.error + (response.data.details ? `: ${response.data.details}` : ''));
        setSearchResults([]);
        return;
      }

      const results = response.data.results || [];
      setSearchResults(results);
      
      if (results.length === 0) {
        setErrorMessage("No locations found. Try a different search term.");
      }
    } catch (error) {
      console.error("Error searching location:", error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error occurred';
      setErrorMessage(`Search failed: ${errorMsg}`);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectLocation = (location) => {
    onLocationSelected({
      city: location.city,
      state_or_country: location.state_or_country,
      country: location.country || location.state_or_country,
      latitude: location.latitude,
      longitude: location.longitude,
      last_updated: new Date().toISOString()
    });
    setSearchQuery("");
    setSearchResults([]);
    setErrorMessage("");
    onClose();
  };

  const useCurrentLocation = async () => {
    setGettingCurrent(true);
    setErrorMessage("");
    
    try {
      console.log("Getting current location...");
      
      const position = await getCurrentPositionSmart({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

      const { latitude, longitude } = position.coords;
      
      console.log("Got coordinates:", latitude, longitude);
      console.log("Reverse geocoding...");

      const response = await callWorker(ROUTE.reverseGeocode, {
        latitude,
        longitude
      });

      console.log("Reverse geocode response:", response);

      if (!response || !response.data) {
        setErrorMessage("Invalid response from server. Please try again.");
        return;
      }

      if (response.data.error) {
        setErrorMessage(response.data.error + (response.data.details ? `: ${response.data.details}` : ''));
        return;
      }

      onLocationSelected({
        city: response.data.city,
        state_or_country: response.data.state_or_country,
        country: response.data.country,
        latitude: response.data.latitude,
        longitude: response.data.longitude,
        last_updated: new Date().toISOString()
      });
      
      setSearchQuery("");
      setSearchResults([]);
      onClose();
    } catch (error) {
      console.error("Error getting current location:", error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      setErrorMessage(`Unable to get your location: ${errorMsg}`);
    } finally {
      setGettingCurrent(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90%] max-w-[340px] rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0A4D68]">
            Change Location
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            onClick={useCurrentLocation}
            disabled={gettingCurrent}
            className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-11 text-sm"
          >
            {gettingCurrent ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Getting Location...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 mr-2" />
                Use Current Location
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or search</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Search city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && searchLocation()}
              className="flex-1 h-10 text-sm"
            />
            <Button
              onClick={searchLocation}
              disabled={searching || !searchQuery.trim()}
              className="bg-[#088395] hover:bg-[#0A4D68] h-10 w-10 p-0"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {errorMessage && (
            <div className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="font-semibold mb-1">Error:</p>
              <p>{errorMessage}</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {searchResults.map((result, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectLocation(result)}
                  className="w-full flex items-center gap-2 p-2.5 hover:bg-gray-50 rounded-lg border border-gray-200 text-left transition-colors"
                >
                  <MapPin className="w-4 h-4 text-[#088395] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#0A4D68] truncate">{result.city}</p>
                    <p className="text-xs text-gray-600 truncate">{result.state_or_country}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}