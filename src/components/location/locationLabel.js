// Single source of truth for how a saved/active location is rendered in the UI.
// Cities get an "Across [City]" label; everything else uses the formatted address.

export function getLocationLabel(loc) {
  if (!loc) return 'Set location';
  if (loc.granularity === 'city') {
    const cityName = loc.address?.city || loc.placeName || 'this city';
    return `Across ${cityName}`;
  }
  return loc.label || loc.address?.formatted || loc.placeName || 'Set location';
}

export function isCityLocation(loc) {
  return loc?.granularity === 'city';
}

export const CITY_DISCLAIMER =
  'enter a specific address or well-known location to get more accurate nearby results.';
