import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { getCurrentPositionSmart } from '@/lib/geolocation';

const LocationContext = createContext();

// Module-level store — survives LocationProvider RE-MOUNTS. The provider was
// re-mounting in a loop (each per-route Layout renders its own provider, and a
// render/auth churn was remounting it), and every remount reset the React state
// to null — so the detected/selected location could never "stick". Holding the
// canonical values here (and seeding useState from them) makes location persist
// across remounts, and `initDone` guarantees the one-time GPS init runs ONCE
// for the whole app session instead of on every remount (which was the loop).
const _store = {
  locationMode: 'current',
  selectedLocation: null,
  currentGpsLocation: null,
  initDone: false,
};

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
}

export function LocationProvider({ children }) {
  const [locationMode, _setLocationMode] = useState(_store.locationMode);
  const [selectedLocation, _setSelectedLocation] = useState(_store.selectedLocation);
  const [currentGpsLocation, _setCurrentGpsLocation] = useState(_store.currentGpsLocation);
  const [activeLocation, setActiveLocation] = useState(null);
  const [loading, setLoading] = useState(!_store.initDone);
  const [initialized, setInitialized] = useState(_store.initDone);

  // Setters mirror into the module store so values survive a remount.
  const setLocationMode = useCallback((v) => { _store.locationMode = v; _setLocationMode(v); }, []);
  const setSelectedLocation = useCallback((v) => { _store.selectedLocation = v; _setSelectedLocation(v); }, []);
  const setCurrentGpsLocation = useCallback((v) => { _store.currentGpsLocation = v; _setCurrentGpsLocation(v); }, []);

  // Detect the device's current location. GPS itself is throttled inside
  // getCurrentPositionSmart; a reverseGeocode failure falls back to bare
  // coordinates instead of throwing.
  const getCurrentLocation = useCallback(async () => {
    const position = await getCurrentPositionSmart({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
    const { latitude, longitude } = position.coords;

    let data = {};
    try {
      const res = await callWorker(ROUTE.reverseGeocode, { latitude, longitude });
      data = (res && res.data) || {};
    } catch (geoErr) {
      console.log('reverseGeocode failed; using coordinates only:', geoErr?.message || geoErr);
    }

    const formatted = [data.city, data.state_or_country].filter(Boolean).join(', ');
    const gpsLocation = {
      placeName: data.city || data.state_or_country || data.country || '',
      address: {
        formatted,
        city: data.city || '',
        state: '',
        postalCode: '',
        country: data.country || data.state_or_country || '',
      },
      coordinates: { latitude, longitude },
      placeType: 'current_location',
    };

    setCurrentGpsLocation(gpsLocation);
    return gpsLocation;
  }, [setCurrentGpsLocation]);

  // One-time init from the saved profile. Guarded by _store.initDone so it runs
  // exactly once per app session even if the provider remounts repeatedly.
  const initializeLocation = useCallback(async () => {
    if (_store.initDone) {
      setLoading(false);
      setInitialized(true);
      return;
    }
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        // Don't mark initDone — let a later mount retry once auth is ready.
        setLoading(false);
        setInitialized(true);
        return;
      }

      _store.initDone = true; // claim init (prevents concurrent/remount re-runs)

      const user = await base44.auth.me();

      if (user.location_mode === 'navigate' && user.selected_location) {
        setLocationMode('navigate');
        setSelectedLocation(user.selected_location);
      } else if (user.location_mode === 'current') {
        try {
          await getCurrentLocation();
          setLocationMode('current');
          await base44.auth.updateMe({ location_permission_granted: true });
        } catch (error) {
          console.log('GPS not available during init, using fallback');
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
        const oldLocation = user.custom_location;
        if (oldLocation.latitude && oldLocation.longitude) {
          const migratedLocation = {
            placeName: oldLocation.city || 'Selected Location',
            address: {
              formatted: `${oldLocation.city}, ${oldLocation.state_or_country}`,
              city: oldLocation.city || '',
              state: '',
              postalCode: '',
              country: oldLocation.country || oldLocation.state_or_country || '',
            },
            coordinates: {
              latitude: oldLocation.latitude,
              longitude: oldLocation.longitude,
            },
            placeType: 'location',
            migrated: true,
          };
          setLocationMode('navigate');
          setSelectedLocation(migratedLocation);
          await base44.auth.updateMe({
            location_mode: 'navigate',
            selected_location: migratedLocation,
          });
        }
      } else {
        // New user — default to current location.
        try {
          await getCurrentLocation();
          setLocationMode('current');
          await base44.auth.updateMe({
            location_mode: 'current',
            location_permission_granted: true,
          });
        } catch (error) {
          setLocationMode('navigate');
        }
      }

      setInitialized(true);
      setLoading(false);
    } catch (error) {
      setLocationMode('current');
      setLoading(false);
      setInitialized(true);
    }
  }, [getCurrentLocation, setLocationMode, setSelectedLocation]);

  const getActiveLocation = useCallback(() => {
    return locationMode === 'current' ? currentGpsLocation : selectedLocation;
  }, [locationMode, selectedLocation, currentGpsLocation]);

  // TEMP DIAGNOSTIC: mount/unmount. If these spam, the provider is re-mounting
  // in a loop (the real bug). If it logs once, re-mount is NOT the issue.
  useEffect(() => {
    console.log('🟢 LocationProvider MOUNTED');
    return () => console.log('🔴 LocationProvider UNMOUNTED');
  }, []);

  // Run init once (initializeLocation is stable). Safe across remounts because
  // of the initDone guard.
  useEffect(() => {
    initializeLocation();
  }, [initializeLocation]);

  // Keep activeLocation in sync with mode + the two location slots.
  useEffect(() => {
    const al = getActiveLocation();
    console.log('🔵 activeLocation →', al?.placeName ?? '(none)', '| mode:', locationMode);
    setActiveLocation(al);
  }, [getActiveLocation, locationMode]);

  const switchToCurrentLocation = useCallback(async () => {
    try {
      setLoading(true);
      const gpsLoc = await getCurrentLocation();

      if (gpsLoc) {
        setLocationMode('current');
        setSelectedLocation(null);
        setCurrentGpsLocation(gpsLoc);

        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          await base44.auth.updateMe({
            location_mode: 'current',
            selected_location: null,
            last_used_location: gpsLoc,
            location_permission_granted: true,
          });
        }

        window.dispatchEvent(new CustomEvent('location:changed', {
          detail: { mode: 'current', location: gpsLoc },
        }));

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error getting current location:', error);
      if (error.code === 1) {
        try {
          const isAuth = await base44.auth.isAuthenticated();
          if (isAuth) {
            await base44.auth.updateMe({ location_permission_granted: false });
          }
        } catch (e) {
          console.error('Error updating permission status:', e);
        }
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getCurrentLocation, setLocationMode, setSelectedLocation, setCurrentGpsLocation]);

  const switchToNavigateMode = useCallback(async (location) => {
    try {
      console.log('🟣 switchToNavigateMode →', location?.placeName);
      setLocationMode('navigate');
      setSelectedLocation(location);

      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        await base44.auth.updateMe({
          location_mode: 'navigate',
          selected_location: location,
          last_used_location: location,
        });
      }

      window.dispatchEvent(new CustomEvent('location:changed', {
        detail: { mode: 'navigate', location },
      }));
    } catch (error) {
      // Silently fail
    }
  }, [setLocationMode, setSelectedLocation]);

  const saveLocation = useCallback(async (location, nickname = null) => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return false;

      const user = await base44.auth.me();
      const savedLocations = user.saved_locations || [];

      const locationToSave = {
        ...location,
        nickname: nickname || location.placeName,
        savedAt: new Date().toISOString(),
      };

      const exists = savedLocations.some(loc =>
        loc.coordinates.latitude === location.coordinates.latitude &&
        loc.coordinates.longitude === location.coordinates.longitude
      );

      if (!exists) {
        savedLocations.push(locationToSave);
        await base44.auth.updateMe({ saved_locations: savedLocations });
      }

      return true;
    } catch (error) {
      return false;
    }
  }, []);

  const deleteLocation = useCallback(async (location) => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return false;

      const user = await base44.auth.me();
      const savedLocations = user.saved_locations || [];

      const updated = savedLocations.filter(loc =>
        !(loc.coordinates.latitude === location.coordinates.latitude &&
          loc.coordinates.longitude === location.coordinates.longitude)
      );

      await base44.auth.updateMe({ saved_locations: updated });
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  const value = useMemo(() => ({
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
    getCurrentLocation,
  }), [
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
    getCurrentLocation,
  ]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}
