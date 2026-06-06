import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const LocationContext = createContext();

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
}

export function LocationProvider({ children }) {
  const [locationMode, setLocationMode] = useState('current'); // 'current' or 'navigate'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [currentGpsLocation, setCurrentGpsLocation] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Helper to calculate distance between two points (in km)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Initialize location from user profile
  useEffect(() => {
    initializeLocation();
  }, []);

  // Update activeLocation whenever mode or locations change
  useEffect(() => {
    const newActiveLocation = getActiveLocation();
    setActiveLocation(newActiveLocation);
  }, [locationMode, selectedLocation, currentGpsLocation]);

  const initializeLocation = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        setLoading(false);
        setInitialized(true);
        return;
      }

      const user = await base44.auth.me();
      
      // Check if user has a saved location mode from last session
      if (user.location_mode === 'navigate' && user.selected_location) {
        // User was in Navigate Mode - restore it
        setLocationMode('navigate');
        setSelectedLocation(user.selected_location);
      } else if (user.location_mode === 'current') {
        // User was using current location - try to restore it
        // Don't check permission flag - just try GPS
        try {
          const gpsLoc = await getCurrentLocation();
          setLocationMode('current');
          
          // Update permission flag since it worked
          await base44.auth.updateMe({
            location_permission_granted: true
          });
        } catch (error) {
          console.log('GPS not available during init, using fallback');
          // GPS not available, use last_used_location or selected_location as fallback
          if (user.last_used_location) {
            setLocationMode('navigate');
            setSelectedLocation(user.last_used_location);
          } else if (user.selected_location) {
            setLocationMode('navigate');
            setSelectedLocation(user.selected_location);
          } else {
            setLocationMode('navigate');
          }
        }
      } else if (user.custom_location && !user.location_mode) {
        // Migration: Handle old custom_location format
        const oldLocation = user.custom_location;
        if (oldLocation.latitude && oldLocation.longitude) {
          // Convert to new format - assume user wants to navigate to this saved location
          const migratedLocation = {
            placeName: oldLocation.city || "Selected Location",
            address: {
              formatted: `${oldLocation.city}, ${oldLocation.state_or_country}`,
              city: oldLocation.city || "",
              state: "",
              postalCode: "",
              country: oldLocation.country || oldLocation.state_or_country || ""
            },
            coordinates: {
              latitude: oldLocation.latitude,
              longitude: oldLocation.longitude
            },
            placeType: "location",
            migrated: true
          };

          setLocationMode('navigate');
          setSelectedLocation(migratedLocation);

          // Save migrated data
          await base44.auth.updateMe({
            location_mode: 'navigate',
            selected_location: migratedLocation
          });
        }
      } else {
        // No saved preference - NEW USER: default to current location
        // Try to get GPS location for first-time users
        try {
          const gpsLoc = await getCurrentLocation();
          setLocationMode('current');

          // Save preference for future sessions
          await base44.auth.updateMe({
            location_mode: 'current',
            location_permission_granted: true
          });
        } catch (error) {
          // GPS not available, default to navigate mode
          setLocationMode('navigate');
        }
      }

      setInitialized(true);
      setLoading(false);
    } catch (error) {
      // Silently fail - location will default to current mode
      setLocationMode('current');
      setLoading(false);
      setInitialized(true);
    }
  };

  const getCurrentLocation = async () => {
    try {
      // Request current GPS location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Reverse geocode to get address
      const { data } = await base44.functions.invoke('reverseGeocode', {
        latitude,
        longitude
      });

      // Drop the literal "Current Location" placeholder string here.
      // It used to land in placeName whenever Google's reverse geocode
      // returned no locality, and then leaked through to the home page
      // greeting as 'Hello Traveler, in Current Location' — which looks
      // like a real city. Now we walk a real fallback chain (city →
      // region → country) and let the consumer (Home.jsx) decide what
      // to do with an empty string. The address.formatted string also
      // gets cleaned so it doesn't read ', US' when city is missing.
      const formatted = [data.city, data.state_or_country]
        .filter(Boolean)
        .join(", ");
      const gpsLocation = {
        placeName: data.city || data.state_or_country || data.country || "",
        address: {
          formatted,
          city: data.city || "",
          state: "",
          postalCode: "",
          country: data.country || data.state_or_country || ""
        },
        coordinates: {
          latitude,
          longitude
        },
        placeType: "current_location"
      };

      setCurrentGpsLocation(gpsLocation);
      return gpsLocation;
    } catch (error) {
      // Re-throw to let caller handle
      throw error;
    }
  };

  const switchToCurrentLocation = async () => {
    try {
      setLoading(true);

      // Always try to get GPS location - don't block based on previous denial
      // The browser will prompt again if needed
      const gpsLoc = await getCurrentLocation();
      
      if (gpsLoc) {
        setLocationMode('current');
        setSelectedLocation(null);
        setCurrentGpsLocation(gpsLoc);

        // Save to user profile - mark permission as granted since it worked
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          await base44.auth.updateMe({
            location_mode: 'current',
            selected_location: null,
            last_used_location: gpsLoc,
            location_permission_granted: true // Reset to true since GPS worked
          });
        }

        // Broadcast change
        window.dispatchEvent(new CustomEvent('location:changed', {
          detail: { mode: 'current', location: gpsLoc }
        }));
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error getting current location:', error);
      
      // Only set to false if it's actually a permission denial
      if (error.code === 1) { // GeolocationPositionError.PERMISSION_DENIED
        try {
          const isAuth = await base44.auth.isAuthenticated();
          if (isAuth) {
            await base44.auth.updateMe({
              location_permission_granted: false
            });
          }
        } catch (e) {
          console.error('Error updating permission status:', e);
        }
      }

      throw error; // Re-throw so caller can handle
    } finally {
      setLoading(false);
    }
  };

  const switchToNavigateMode = async (location) => {
    try {
      setLocationMode('navigate');
      setSelectedLocation(location);

      // Save to user profile - also save as last_used_location for logout/login restore
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        await base44.auth.updateMe({
          location_mode: 'navigate',
          selected_location: location,
          last_used_location: location
        });
      }

      // Broadcast change
      window.dispatchEvent(new CustomEvent('location:changed', {
        detail: { mode: 'navigate', location }
      }));
    } catch (error) {
      // Silently fail
    }
  };

  const saveLocation = async (location, nickname = null) => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return false;

      const user = await base44.auth.me();
      const savedLocations = user.saved_locations || [];
      
      const locationToSave = {
        ...location,
        nickname: nickname || location.placeName,
        savedAt: new Date().toISOString()
      };

      // Check if already saved
      const exists = savedLocations.some(loc => 
        loc.coordinates.latitude === location.coordinates.latitude &&
        loc.coordinates.longitude === location.coordinates.longitude
      );

      if (!exists) {
        savedLocations.push(locationToSave);
        await base44.auth.updateMe({
          saved_locations: savedLocations
        });
      }

      return true;
    } catch (error) {
      // Silently fail
      return false;
    }
  };

  const deleteLocation = async (location) => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return false;

      const user = await base44.auth.me();
      const savedLocations = user.saved_locations || [];
      
      const updated = savedLocations.filter(loc => 
        !(loc.coordinates.latitude === location.coordinates.latitude &&
          loc.coordinates.longitude === location.coordinates.longitude)
      );

      await base44.auth.updateMe({
        saved_locations: updated
      });

      return true;
    } catch (error) {
      // Silently fail
      return false;
    }
  };

  const getActiveLocation = () => {
    if (locationMode === 'current') {
      return currentGpsLocation;
    }
    return selectedLocation;
  };

  const value = {
    locationMode,
    selectedLocation,
    currentGpsLocation,
    activeLocation,
    loading,
    initialized,
    switchToCurrentLocation,
    switchToNavigateMode,
    saveLocation,
    deleteLocation,
    getActiveLocation,
    getCurrentLocation
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}