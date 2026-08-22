// placeContext — one disambiguated place phrase + cache key for all AI-content
// surfaces (Where-to-stay, day trips, viral foods, Insight).
//
// The bug this fixes: those surfaces keyed AI content on "city, country" only
// ("Arcadia, United States"), which (a) let the model resolve the WRONG same-named
// city (Arcadia FL instead of Arcadia CA → Florida day trips + a Florida airport)
// and (b) COLLIDED both Arcadias into one cache entry. Including the STATE/region
// disambiguates the prompt AND the cache. The geocoder already returns the region
// (as state_or_country); we surface it here even for locations stored before
// address.state was populated, by recovering it from the formatted line.
const slug = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";

// {city, state, country} from any location shape, recovering the state from the
// formatted address ("Arcadia, California") when the dedicated field is empty.
export function placeParts(loc) {
  const a = (loc && loc.address) || {};
  const city = a.city || loc?.city || loc?.placeName || "";
  let state = a.state || a.region || "";
  const country = a.country || loc?.country || "";
  if (!state && a.formatted && city) {
    const parts = String(a.formatted).split(",").map((s) => s.trim()).filter(Boolean);
    // formatted is typically "City, Region" — take the middle part as the region
    // when it isn't just the country repeated.
    if (parts.length >= 2 && parts[0].toLowerCase() === city.toLowerCase()) {
      const mid = parts[1];
      if (mid && mid.toLowerCase() !== country.toLowerCase()) state = mid;
    }
  }
  return { city, state, country };
}

// Human phrase for AI prompts — "City, State, Country" (disambiguates same-named
// cities). Falls back gracefully when parts are missing.
export function placePhrase(loc) {
  const { city, state, country } = placeParts(loc);
  return [city, state, country].filter(Boolean).join(", ");
}

// Cache-key suffix. With a state we key on city|state|country (shares across the
// whole city, separates Arcadia CA from Arcadia FL). Without a state (legacy /
// non-US), we add coarse coords (~11 km) as a hard disambiguator.
export function geoKey(loc) {
  const { city, state, country } = placeParts(loc);
  if (state) return `${slug(city)}|${slug(state)}|${slug(country)}`;
  const lat = loc?.coordinates?.latitude, lng = loc?.coordinates?.longitude;
  const geo = (Number.isFinite(lat) && Number.isFinite(lng)) ? `${lat.toFixed(1)},${lng.toFixed(1)}` : "";
  return [slug(city), slug(country), geo].filter(Boolean).join("|") || "unknown";
}
