import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { getCurrentPositionSmart } from '@/lib/geolocation';
import {
  getSavedLocations as readSavedLocations,
  saveSavedLocation,
  updateSavedLocation,
  deleteSavedLocation,
} from '@/lib/savedLocations';

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

// Last active location, persisted ON-DEVICE so it survives app launches with no
// Base44/Supabase round-trip (the old base44.auth.me() restore is dead on native).
// First-time users with nothing saved fall through to the welcome / location-
// picker flow on Home.
const LAST_LOC_KEY = 'gs_last_location_v1';
const readLastLocation = () => { try { const r = localStorage.getItem(LAST_LOC_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const writeLastLocation = (loc) => { try { if (loc?.coordinates) localStorage.setItem(LAST_LOC_KEY, JSON.stringify(loc)); } catch { /* ignore */ } };

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
    } catch {
      // reverseGeocode failed — non-fatal; fall back to bare coordinates.
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
    _store.initDone = true; // claim init (prevents concurrent/remount re-runs)
    try {
      // Restore the last location from on-device storage — auth-independent, so
      // it works on native where there's no Base44 session. A returning user
      // gets their last location immediately (finders work, no picker); a
      // first-time user has nothing saved and falls through to Home's welcome /
      // location-picker flow to choose one.
      const last = readLastLocation();
      if (last?.coordinates) {
        setLocationMode('navigate');
        setSelectedLocation(last);
      }
    } catch (e) { /* ignore — picker flow handles a fresh start */ }
    setInitialized(true);
    setLoading(false);
  }, [setLocationMode, setSelectedLocation]);

  const getActiveLocation = useCallback(() => {
    return locationMode === 'current' ? currentGpsLocation : selectedLocation;
  }, [locationMode, selectedLocation, currentGpsLocation]);

  // Run init once (initializeLocation is stable). Safe across remounts because
  // of the initDone guard.
  useEffect(() => {
    initializeLocation();
  }, [initializeLocation]);

  // Keep activeLocation in sync with mode + the two location slots.
  useEffect(() => {
    setActiveLocation(getActiveLocation());
  }, [getActiveLocation, locationMode]);

  const switchToCurrentLocation = useCallback(async () => {
    try {
      setLoading(true);
      const gpsLoc = await getCurrentLocation();

      if (gpsLoc) {
        setLocationMode('current');
        setSelectedLocation(null);
        setCurrentGpsLocation(gpsLoc);
        writeLastLocation(gpsLoc); // remember across launches (on-device)

        window.dispatchEvent(new CustomEvent('location:changed', {
          detail: { mode: 'current', location: gpsLoc },
        }));

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getCurrentLocation, setLocationMode, setSelectedLocation, setCurrentGpsLocation]);

  const switchToNavigateMode = useCallback(async (location) => {
    try {
      setLocationMode('navigate');
      setSelectedLocation(location);
      writeLastLocation(location); // remember across launches (on-device)

      window.dispatchEvent(new CustomEvent('location:changed', {
        detail: { mode: 'navigate', location },
      }));
    } catch (error) {
      // Silently fail
    }
  }, [setLocationMode, setSelectedLocation]);

  // Saved / favorite locations now live ON-DEVICE (localStorage) — see
  // src/lib/savedLocations.js. (The old base44.auth.updateMe({saved_locations})
  // path silently failed once auth moved to Supabase, so saves never stuck.)
  // These wrappers keep the existing async-ish call sites working.
  const saveLocation = useCallback((location, nickname = null) => {
    try { saveSavedLocation(location, nickname); return true; } catch (e) { return false; }
  }, []);

  const updateLocation = useCallback((match, changes) => {
    try { return updateSavedLocation(match, changes); } catch (e) { return false; }
  }, []);

  const deleteLocation = useCallback((location) => {
    try { deleteSavedLocation(location); return true; } catch (e) { return false; }
  }, []);

  const getSavedLocations = useCallback(() => readSavedLocations(), []);

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
    updateLocation,
    deleteLocation,
    getSavedLocations,
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
    updateLocation,
    deleteLocation,
    getSavedLocations,
    getActiveLocation,
    getCurrentLocation,
  ]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}
