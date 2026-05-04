import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gs_distance_unit';
const MILES_COUNTRIES = ['United States', 'United Kingdom', 'Liberia', 'Myanmar'];

export function defaultUnitForCountry(country) {
  return MILES_COUNTRIES.includes(country) ? 'mi' : 'km';
}

export function formatDistance(miles, unit) {
  if (miles == null || isNaN(miles)) return '';
  if (unit === 'km') {
    const km = miles * 1.60934;
    if (km < 0.1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

export function useDistanceUnit(activeLocation) {
  const [unit, setUnitState] = useState(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'mi' || saved === 'km' ? saved : null;
  });

  useEffect(() => {
    if (unit) return;
    const country = activeLocation?.address?.country;
    setUnitState(country ? defaultUnitForCountry(country) : 'mi');
  }, [activeLocation?.address?.country, unit]);

  const setUnit = (u) => {
    setUnitState(u);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, u);
  };

  const fmt = (miles) => formatDistance(miles, unit || 'mi');
  return { unit: unit || 'mi', setUnit, formatDistance: fmt };
}
