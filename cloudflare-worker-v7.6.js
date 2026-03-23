/**
 * ============================================================================
 * GLOBESKIMMERS API WORKER v7.8
 * ============================================================================
 *
 * Stable baseline: v7.7 (Mar 2026)
 *
 * Changes in v7.8:
 * - ADD: Server-side filters in handleRestaurantSearch (POST /):
 *   openNow, minRating, priceLevels passed directly to Google Places API
 *   (previously filtered client-side AFTER fetching — now Google filters before returning)
 * - ADD: Same server-side filters in handleNearbySearch (/places/nearby)
 * - ADD: rankPreference: RELEVANCE for text searches in handleRestaurantSearch
 *   (Google default is already RELEVANCE for text search, but now explicit)
 * - FIX: Filter params included in cache key so different filter combos cache separately
 *   (previously openNow=true and openNow=false shared the same cache entry)
 *
 * Changes in v7.7:
 * - ADD: `places.businessStatus` to FIELD_MASK and DETAILS_FIELD_MASK
 *   (enables ghost restaurant filtering in getRestaurants — CLOSED_PERMANENTLY/CLOSED_TEMPORARILY)
 * - ADD: `places.servesCocktails` to FIELD_MASK and DETAILS_FIELD_MASK
 *   (used by calcSportsScore() Signal 5 — cocktail bars score higher for sports bar detection)
 * - ADD: `businessStatus` and `servesCocktails` fields to normalizePlace() return object
 *
 * Changes in v7.6:
 * - FIX: extractCustomerFavorites threshold lowered from >= 2 to >= 1
 *   (Customer Favorites and WHY box now appear with fewer reviews)
 * - ADD: /places/nearby route (alias for /places/search, used by getActivities v3.0)
 * - FIX: handleNearbySearch now reads both `type` and `types` params
 *   (getActivities sends `type=tourist_attraction`, Worker was reading `types`)
 *
 * Features:
 * - Text Search with KV caching (12 hours)
 * - Nearby Search with KV caching (3 days)
 * - Place Details with KV caching (90 days)
 * - Photo Proxy with KV caching (90 days)
 * - Restaurant search with reviews & customer favorites
 * - Coffee shop search
 * - Dietary endpoint (/places/dietary)
 * - Field normalization (name, address, phone, hours, photos)
 * - Coordinate rounding for cache hit optimization
 *
 * KV Binding Required: GLOBESKIMMERS_KV
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  API_KEY_SECRET: 'GOOGLE_API_KEY', // Cloudflare secret name

  // Cache TTLs (in seconds)
  CACHE_TTL: {
    TEXT_SEARCH: 12 * 60 * 60,       // 12 hours
    NEARBY_SEARCH: 3 * 24 * 60 * 60, // 3 days
    DETAILS: 90 * 24 * 60 * 60,      // 90 days (rarely changes)
    PHOTO: 90 * 24 * 60 * 60,        // 90 days (never changes)
    GEOCODING: 30 * 24 * 60 * 60,    // 30 days
    STALE_WHILE_REVALIDATE: 60 * 60  // 1 hour
  },

  // Field mask for Places API (New) - excludes menuUri which causes 502
  FIELD_MASK: [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.shortFormattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.priceLevel',
    'places.primaryType',
    'places.primaryTypeDisplayName',
    'places.types',
    'places.currentOpeningHours',
    'places.regularOpeningHours',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.googleMapsUri',
    'places.photos',
    'places.reviews',
    'places.editorialSummary',
    'places.servesVegetarianFood',
    'places.servesBeer',
    'places.servesWine',
    'places.servesCoffee',
    'places.servesBreakfast',
    'places.servesLunch',
    'places.servesDinner',
    'places.servesBrunch',
    'places.takeout',
    'places.delivery',
    'places.dineIn',
    'places.reservable',
    'places.outdoorSeating',
    'places.liveMusic',
    'places.goodForChildren',
    'places.goodForGroups',
    'places.accessibilityOptions',
    'places.parkingOptions',
    'places.paymentOptions',
    'places.allowsDogs',
    'places.businessStatus',
    'places.servesCocktails'
  ].join(','),

  // Details field mask
  DETAILS_FIELD_MASK: [
    'id',
    'displayName',
    'formattedAddress',
    'shortFormattedAddress',
    'location',
    'rating',
    'userRatingCount',
    'priceLevel',
    'primaryType',
    'primaryTypeDisplayName',
    'types',
    'currentOpeningHours',
    'regularOpeningHours',
    'nationalPhoneNumber',
    'internationalPhoneNumber',
    'websiteUri',
    'googleMapsUri',
    'photos',
    'reviews',
    'editorialSummary',
    'servesVegetarianFood',
    'servesBeer',
    'servesWine',
    'servesCoffee',
    'servesBreakfast',
    'servesLunch',
    'servesDinner',
    'servesBrunch',
    'takeout',
    'delivery',
    'dineIn',
    'reservable',
    'outdoorSeating',
    'liveMusic',
    'goodForChildren',
    'goodForGroups',
    'accessibilityOptions',
    'parkingOptions',
    'paymentOptions',
    'allowsDogs',
    'businessStatus',
    'servesCocktails'
  ].join(',')
};

// ============================================================================
// CORS HEADERS
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function handleCORS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Round coordinates to improve cache hit rate (~100m precision)
function roundCoordinate(coord, precision = 3) {
  return Math.round(coord * Math.pow(10, precision)) / Math.pow(10, precision);
}

// Generate cache key for searches
function generateCacheKey(prefix, params) {
  const lat = roundCoordinate(parseFloat(params.latitude) || 0);
  const lng = roundCoordinate(parseFloat(params.longitude) || 0);
  const query = (params.textQuery || params.query || '').toLowerCase().trim();
  const types = (params.types || params.type || '').toLowerCase();
  const radius = params.radius || '5000';

  return `${prefix}_${lat}_${lng}_${radius}_${query}_${types}`.replace(/\s+/g, '_');
}

// ============================================================================
// KV CACHE HELPERS
// ============================================================================

async function getFromCache(env, key) {
  if (!env.GLOBESKIMMERS_KV) return null;
  try {
    const cached = await env.GLOBESKIMMERS_KV.get(key, { type: 'json' });
    if (cached) {
      const age = Date.now() - (cached.timestamp || 0);
      return { data: cached.data, age, timestamp: cached.timestamp };
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
}

async function setInCache(env, key, data, ttl) {
  if (!env.GLOBESKIMMERS_KV) return;
  try {
    await env.GLOBESKIMMERS_KV.put(
      key,
      JSON.stringify({ data, timestamp: Date.now() }),
      { expirationTtl: ttl }
    );
  } catch (e) {
    console.error('Cache write error:', e);
  }
}

// ============================================================================
// NORMALIZE PLACE DATA
// ============================================================================

function normalizePlace(place, baseUrl = '') {
  // Photos with constructed URLs
  const photos = (place.photos || []).map(photo => {
    const photoName = photo.name || '';
    return {
      name: photoName,
      url: baseUrl ? `${baseUrl}/places/photo?name=${encodeURIComponent(photoName)}&maxWidth=400` : null,
      thumbnail: baseUrl ? `${baseUrl}/places/photo?name=${encodeURIComponent(photoName)}&maxWidth=200` : null,
      full: baseUrl ? `${baseUrl}/places/photo?name=${encodeURIComponent(photoName)}&maxWidth=800` : null,
      attribution: photo.authorAttributions?.[0]?.displayName || null
    };
  });

  // Parse price level
  let priceLevel = place.priceLevel;
  if (typeof priceLevel === 'string') {
    if (priceLevel.includes('FREE')) priceLevel = 0;
    else if (priceLevel.includes('INEXPENSIVE')) priceLevel = 1;
    else if (priceLevel.includes('MODERATE')) priceLevel = 2;
    else if (priceLevel.includes('EXPENSIVE') && !priceLevel.includes('VERY')) priceLevel = 3;
    else if (priceLevel.includes('VERY_EXPENSIVE')) priceLevel = 4;
    else priceLevel = null;
  }

  // Hours array
  const hours = place.currentOpeningHours?.weekdayDescriptions ||
                place.regularOpeningHours?.weekdayDescriptions ||
                [];

  // Is open
  const isOpen = place.currentOpeningHours?.openNow ?? null;

  return {
    // IDs
    id: place.id,
    placeId: place.id,

    // Basic info (normalized field names)
    name: place.displayName?.text || place.name || 'Unknown',
    displayName: place.displayName || { text: place.displayName?.text || place.name || 'Unknown' },
    address: place.formattedAddress || place.address || '',
    formattedAddress: place.formattedAddress || '',
    shortAddress: place.shortFormattedAddress || (place.formattedAddress || '').split(',')[0],
    shortFormattedAddress: place.shortFormattedAddress || '',

    // Location
    location: place.location,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,

    // Ratings
    rating: place.rating || null,
    reviewCount: place.userRatingCount || 0,
    userRatingCount: place.userRatingCount || 0,

    // Price
    priceLevel,

    // Type
    primaryType: place.primaryType || null,
    primaryTypeDisplay: place.primaryTypeDisplayName?.text || null,
    types: place.types || [],

    // Contact
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    nationalPhoneNumber: place.nationalPhoneNumber || '',
    internationalPhoneNumber: place.internationalPhoneNumber || '',
    website: place.websiteUri || null,
    websiteUri: place.websiteUri || '',
    googleMapsUrl: place.googleMapsUri || null,
    googleMapsUri: place.googleMapsUri || '',

    // Hours
    hours,
    isOpen,
    currentOpeningHours: place.currentOpeningHours || null,
    regularOpeningHours: place.regularOpeningHours || null,

    // Photos (with URLs)
    photos,

    // Reviews (top 5)
    reviews: (place.reviews || []).slice(0, 5).map(r => ({
      author: r.authorAttribution?.displayName || 'Anonymous',
      rating: r.rating,
      text: r.text?.text || r.originalText?.text || '',
      time: r.relativePublishTimeDescription || '',
      publishTime: r.publishTime
    })),

    // Editorial
    editorialSummary: place.editorialSummary?.text || null,

    // Services
    servesVegetarianFood: place.servesVegetarianFood || false,
    servesBeer: place.servesBeer || false,
    servesWine: place.servesWine || false,
    servesCoffee: place.servesCoffee || false,
    servesBreakfast: place.servesBreakfast || false,
    servesLunch: place.servesLunch || false,
    servesDinner: place.servesDinner || false,
    servesBrunch: place.servesBrunch || false,

    // Options
    takeout: place.takeout || false,
    delivery: place.delivery || false,
    dineIn: place.dineIn || false,
    reservable: place.reservable || false,
    outdoorSeating: place.outdoorSeating || false,
    liveMusic: place.liveMusic || false,
    goodForChildren: place.goodForChildren || false,
    goodForGroups: place.goodForGroups || false,
    allowsDogs: place.allowsDogs || false,

    // Parking
    parkingOptions: place.parkingOptions || null,

    // Payment
    paymentOptions: place.paymentOptions || null,

    // Accessibility
    accessibilityOptions: place.accessibilityOptions || null,

    // Business status (for ghost restaurant filtering)
    businessStatus: place.businessStatus || null,

    // Cocktails (used by sports bar scoring)
    servesCocktails: place.servesCocktails || false
  };
}

// ============================================================================
// HANDLER: TEXT SEARCH
// ============================================================================

async function handleTextSearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  const textQuery = params.textQuery || params.query || '';
  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  const radius = parseInt(params.radius) || 5000;
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 60);
  const forceRefresh = params.forceRefresh === 'true';

  if (!textQuery) {
    return jsonResponse({ error: 'textQuery is required', places: [] }, 400);
  }

  // Check cache
  const cacheKey = generateCacheKey('text', params);
  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached) {
      const isStale = cached.age > CONFIG.CACHE_TTL.TEXT_SEARCH * 1000;
      if (!isStale || cached.age < (CONFIG.CACHE_TTL.TEXT_SEARCH + CONFIG.CACHE_TTL.STALE_WHILE_REVALIDATE) * 1000) {
        return jsonResponse({
          places: cached.data,
          count: cached.data.length,
          cached: true,
          cacheAge: Math.round(cached.age / 1000)
        });
      }
    }
  }

  // Call Google Places API (New)
  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  const requestBody = {
    textQuery,
    maxResultCount: maxResults,
    locationBias: {
      circle: {
        center: { latitude, longitude },
        radius: radius
      }
    }
  };

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API error:', response.status, errorText);
      return jsonResponse({
        error: 'Google Places API error',
        status: response.status,
        details: errorText,
        places: []
      }, 200); // Return 200 with error to not break frontend
    }

    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl));

    // Cache results
    await setInCache(env, cacheKey, places, CONFIG.CACHE_TTL.TEXT_SEARCH);

    return jsonResponse({
      places,
      count: places.length,
      cached: false
    });

  } catch (error) {
    console.error('Text search error:', error);
    return jsonResponse({ error: error.message, places: [] }, 200);
  }
}

// ============================================================================
// HANDLER: NEARBY SEARCH (by types)
// ============================================================================

async function handleNearbySearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  // v7.6 FIX: accept both `type` (singular, from getActivities) and `types` (plural)
  const types = params.types || params.type || 'restaurant';
  const radius = parseInt(params.radius) || 5000;
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 20);
  const forceRefresh = params.forceRefresh === 'true';
  // v7.8: server-side filters
  const openNow   = params.openNow === 'true';
  const minRating = parseFloat(params.minRating) || 0;
  const priceLevels = params.priceLevels ? params.priceLevels.split(',') : [];

  // Check cache — include active filters so different combos cache separately
  const filterSuffix = [
    openNow ? 'open' : '',
    minRating > 0 ? `r${minRating}` : '',
    priceLevels.length ? priceLevels.join('-') : '',
  ].filter(Boolean).join('_');
  const cacheKey = generateCacheKey('nearby', { ...params, types }) + (filterSuffix ? `_${filterSuffix}` : '');
  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached) {
      const isStale = cached.age > CONFIG.CACHE_TTL.NEARBY_SEARCH * 1000;
      if (!isStale || cached.age < (CONFIG.CACHE_TTL.NEARBY_SEARCH + CONFIG.CACHE_TTL.STALE_WHILE_REVALIDATE) * 1000) {
        return jsonResponse({
          places: cached.data,
          count: cached.data.length,
          cached: true,
          cacheAge: Math.round(cached.age / 1000)
        });
      }
    }
  }

  // Call Google Places API (New) - Nearby Search
  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  const requestBody = {
    includedTypes: types.split(',').map(t => t.trim()),
    maxResultCount: maxResults,
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radius: radius
      }
    },
    rankPreference: params.rankBy === 'DISTANCE' ? 'DISTANCE' : 'POPULARITY'
  };
  // v7.8: server-side filters for nearby search
  if (openNow)             requestBody.openNow     = true;
  if (minRating > 0)       requestBody.minRating   = minRating;
  if (priceLevels.length)  requestBody.priceLevels = priceLevels;

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API error:', response.status, errorText);
      return jsonResponse({
        error: 'Google Places API error',
        status: response.status,
        details: errorText,
        places: []
      }, 200);
    }

    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl));

    // Cache results
    await setInCache(env, cacheKey, places, CONFIG.CACHE_TTL.NEARBY_SEARCH);

    return jsonResponse({
      places,
      count: places.length,
      cached: false
    });

  } catch (error) {
    console.error('Nearby search error:', error);
    return jsonResponse({ error: error.message, places: [] }, 200);
  }
}

// ============================================================================
// HANDLER: PLACE DETAILS
// ============================================================================

async function handlePlaceDetails(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Extract place ID from path: /places/details/{placeId}
  const pathParts = pathname.split('/');
  const placeId = pathParts[pathParts.length - 1];

  if (!placeId) {
    return jsonResponse({ error: 'Place ID required' }, 400);
  }

  const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

  // Check cache
  const cacheKey = `details_${placeId}`;
  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached) {
      return jsonResponse({
        place: cached.data,
        cached: true,
        cacheAge: Math.round(cached.age / 1000)
      });
    }
  }

  // Call Google Places API
  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.DETAILS_FIELD_MASK
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({
        error: 'Place not found',
        status: response.status,
        details: errorText
      }, 404);
    }

    const place = await response.json();
    const normalized = normalizePlace(place, baseUrl);

    // Cache result
    await setInCache(env, cacheKey, normalized, CONFIG.CACHE_TTL.DETAILS);

    return jsonResponse({
      place: normalized,
      cached: false
    });

  } catch (error) {
    console.error('Details error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================================================
// HANDLER: PHOTO PROXY
// ============================================================================

async function handlePhotoProxy(request, env) {
  const url = new URL(request.url);

  const photoName = url.searchParams.get('name');
  const maxWidth = url.searchParams.get('maxWidth') || '400';

  if (!photoName) {
    return jsonResponse({ error: 'Photo name required' }, 400);
  }

  // Check cache first
  const cacheKey = `photo_${photoName}_${maxWidth}`;

  if (env.GLOBESKIMMERS_KV) {
    try {
      const cached = await env.GLOBESKIMMERS_KV.get(cacheKey, { type: 'arrayBuffer' });
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=604800',
            'X-Cache': 'HIT',
            ...CORS_HEADERS
          }
        });
      }
    } catch (e) {
      console.error('Photo cache read error:', e);
    }
  }

  // Fetch from Google
  const apiKey = env.GOOGLE_API_KEY;
  const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;

  try {
    const photoRes = await fetch(photoUrl);

    if (!photoRes.ok) {
      console.error('Photo fetch error:', photoRes.status);
      return jsonResponse({ error: 'Photo not found' }, 404);
    }

    const photoBuffer = await photoRes.arrayBuffer();
    const contentType = photoRes.headers.get('Content-Type') || 'image/jpeg';

    // Cache the photo (90 days)
    if (env.GLOBESKIMMERS_KV) {
      try {
        await env.GLOBESKIMMERS_KV.put(cacheKey, photoBuffer, {
          expirationTtl: CONFIG.CACHE_TTL.PHOTO
        });
      } catch (e) {
        console.error('Photo cache write error:', e);
      }
    }

    return new Response(photoBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800',
        'X-Cache': 'MISS',
        ...CORS_HEADERS
      }
    });

  } catch (error) {
    console.error('Photo proxy error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================================================
// HANDLER: DIETARY SEARCH (for PlacesToEat)
// ============================================================================

async function handleDietarySearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  const dietary = params.dietary || '';
  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  const radius = parseInt(params.radius) || 5000;
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 60);

  // Build search query based on dietary preference
  const dietaryQueries = {
    vegetarian: 'vegetarian restaurant',
    vegan: 'vegan restaurant',
    glutenFree: 'gluten free restaurant',
    halal: 'halal restaurant',
    kosher: 'kosher restaurant'
  };

  const textQuery = dietaryQueries[dietary] || `${dietary} restaurant`;

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  const requestBody = {
    textQuery,
    maxResultCount: maxResults,
    locationBias: {
      circle: {
        center: { latitude, longitude },
        radius: radius
      }
    }
  };

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({
        error: 'Dietary search failed',
        details: errorText,
        places: []
      }, 200);
    }

    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl));

    return jsonResponse({
      places,
      count: places.length,
      dietary: dietary
    });

  } catch (error) {
    console.error('Dietary search error:', error);
    return jsonResponse({ error: error.message, places: [] }, 200);
  }
}

// ============================================================================
// HANDLER: CACHE STATS
// ============================================================================

async function handleCacheStats(request, env) {
  return jsonResponse({
    status: 'ok',
    version: '7.8',
    kvBound: !!env.GLOBESKIMMERS_KV,
    cacheTTLs: {
      textSearch: `${CONFIG.CACHE_TTL.TEXT_SEARCH / 3600} hours`,
      nearbySearch: `${CONFIG.CACHE_TTL.NEARBY_SEARCH / 86400} days`,
      details: `${CONFIG.CACHE_TTL.DETAILS / 86400} days`,
      photo: `${CONFIG.CACHE_TTL.PHOTO / 86400} days`
    },
    timestamp: new Date().toISOString()
  });
}

// ============================================================================
// HANDLER: COFFEE SHOP SEARCH
// ============================================================================

async function handleCoffeeSearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  const radius = parseInt(params.radius) || 5000;
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 40);
  const query = params.query || 'coffee shop cafe';
  const forceRefresh = params.forceRefresh === 'true';

  // Check cache
  const cacheKey = generateCacheKey('coffee', { latitude, longitude, radius, textQuery: query });
  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached && cached.age < CONFIG.CACHE_TTL.TEXT_SEARCH * 1000) {
      return jsonResponse({
        places: cached.data,
        count: cached.data.length,
        cached: true
      });
    }
  }

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  const requestBody = {
    textQuery: query,
    maxResultCount: maxResults,
    locationBias: {
      circle: {
        center: { latitude, longitude },
        radius: radius
      }
    }
  };

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: 'Coffee search failed', details: errorText, places: [] }, 200);
    }

    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl));

    await setInCache(env, cacheKey, places, CONFIG.CACHE_TTL.TEXT_SEARCH);

    return jsonResponse({ places, count: places.length, cached: false });

  } catch (error) {
    console.error('Coffee search error:', error);
    return jsonResponse({ error: error.message, places: [] }, 200);
  }
}

// ============================================================================
// HANDLER: RESTAURANT SEARCH (POST - for PlacesToEat)
// ============================================================================

async function handleRestaurantSearch(request, env) {
  try {
    const body = await request.json();
    const {
      latitude,
      longitude,
      radiusMiles = 10,
      query = '',
      category = '',
      cuisineType = '',
      dietary = '',
      forceRefresh = false,
      // v7.8: server-side filters passed to Google directly
      openNow = false,
      minRating = 0,
      priceLevels = [],   // e.g. ["PRICE_LEVEL_INEXPENSIVE","PRICE_LEVEL_MODERATE"]
    } = body;

    if (!latitude || !longitude) {
      return jsonResponse({ error: 'Latitude and longitude required', restaurants: [] }, 400);
    }

    const radiusMeters = Math.min(radiusMiles * 1609.34, 50000);
    const apiKey = env.GOOGLE_API_KEY;
    const url = new URL(request.url);
    const baseUrl = url.origin;

    // Build search query
    let searchQuery = query || 'restaurant';
    if (cuisineType && cuisineType !== 'all') {
      searchQuery = `${cuisineType} restaurant`;
    }
    if (category && category !== 'all' && category !== 'All Food') {
      searchQuery = `${category} restaurant`;
    }
    if (dietary) {
      searchQuery = `${dietary} ${searchQuery}`;
    }

    // Check cache — include active filters in key so openNow=true and false don't share a slot
    const filterSuffix = [
      openNow ? 'open' : '',
      minRating > 0 ? `r${minRating}` : '',
      priceLevels?.length ? priceLevels.join('-') : '',
    ].filter(Boolean).join('_');
    const cacheKey = generateCacheKey('restaurants', {
      latitude, longitude, radius: radiusMeters, textQuery: searchQuery
    }) + (filterSuffix ? `_${filterSuffix}` : '');

    if (!forceRefresh) {
      const cached = await getFromCache(env, cacheKey);
      if (cached && cached.age < CONFIG.CACHE_TTL.TEXT_SEARCH * 1000) {
        return jsonResponse({
          restaurants: cached.data,
          count: cached.data.length,
          cached: true,
          cacheAge: Math.round(cached.age / 1000)
        });
      }
    }

    // Call Google Places API — server-side filters applied at source
    const requestBody = {
      textQuery: searchQuery,
      maxResultCount: 20,
      rankPreference: 'RELEVANCE',   // v7.8: explicit relevance for text queries
      locationBias: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters
        }
      }
    };
    // v7.8: pass filters to Google so it excludes them before returning (more efficient than client-side)
    if (openNow)              requestBody.openNow     = true;
    if (minRating > 0)        requestBody.minRating   = minRating;
    if (priceLevels?.length)  requestBody.priceLevels = priceLevels;

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Restaurant search error:', response.status, errorText);
      return jsonResponse({
        error: 'Search failed',
        details: errorText,
        restaurants: []
      }, 200);
    }

    const data = await response.json();
    const restaurants = (data.places || []).map(p => {
      const normalized = normalizePlace(p, baseUrl);

      // Extract customer favorites from reviews
      const customerFavorites = extractCustomerFavorites(p.reviews || []);

      return {
        ...normalized,
        customer_favorites: customerFavorites,
        top_reviews: (p.reviews || []).slice(0, 3).map(r => ({
          author: r.authorAttribution?.displayName || 'Anonymous',
          rating: r.rating,
          text: r.text?.text || r.originalText?.text || '',
          time: r.relativePublishTimeDescription || ''
        }))
      };
    });

    // Cache results
    await setInCache(env, cacheKey, restaurants, CONFIG.CACHE_TTL.TEXT_SEARCH);

    return jsonResponse({
      restaurants,
      places: restaurants, // Alias for compatibility
      count: restaurants.length,
      cached: false
    });

  } catch (error) {
    console.error('Restaurant search error:', error);
    return jsonResponse({
      error: error.message,
      restaurants: [],
      places: []
    }, 200);
  }
}

// ============================================================================
// HELPER: Extract customer favorites from reviews
// v7.6 FIX: threshold lowered from >= 2 to >= 1
// ============================================================================

function extractCustomerFavorites(reviews) {
  if (!reviews || reviews.length === 0) return [];

  const dishMentions = {};
  const dishPatterns = [
    /(?:the|their|try the|loved the|best|amazing|excellent|fantastic|delicious)\s+([a-zA-Z\s]{3,25}?)(?:\s+(?:is|was|were|are|here)|\.|,|!)/gi,
    /(?:order(?:ed)?|had|got|tried)\s+(?:the\s+)?([a-zA-Z\s]{3,25}?)(?:\s+and|\.|,|!)/gi
  ];

  const skipWords = ['food', 'service', 'place', 'restaurant', 'staff', 'experience', 'time', 'wait', 'price', 'portion', 'atmosphere', 'location', 'parking'];

  for (const review of reviews) {
    const text = review.text?.text || review.originalText?.text || '';

    for (const pattern of dishPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dish = match[1].trim().toLowerCase();
        if (dish.length >= 3 && dish.length <= 30 && !skipWords.some(w => dish.includes(w))) {
          dishMentions[dish] = (dishMentions[dish] || 0) + 1;
        }
      }
    }
  }

  return Object.entries(dishMentions)
    .filter(([_, count]) => count >= 1)  // v7.6: was >= 2, now >= 1
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dish, count]) => ({
      dish: dish.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      mentions: count
    }));
}

// ============================================================================
// MAIN WORKER EXPORT
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    try {
      // Root endpoint: POST = restaurant search, GET = health check
      if (pathname === '/' || pathname === '') {
        if (request.method === 'POST') {
          return await handleRestaurantSearch(request, env);
        }
        return new Response('Globeskimmers API Worker v7.8 - All Systems Ready! 📸🍽️☕', {
          headers: CORS_HEADERS
        });
      }

      if (pathname === '/health') {
        return jsonResponse({
          status: 'ok',
          version: '7.8',
          features: ['text-search', 'nearby-search', 'details', 'photo-proxy', 'dietary', 'restaurants', 'coffee', 'business-status', 'serves-cocktails'],
          kvBound: !!env.GLOBESKIMMERS_KV,
          timestamp: new Date().toISOString()
        });
      }

      // Routes
      if (pathname === '/places/text-search') {
        return await handleTextSearch(request, env);
      }

      // /places/nearby — used by getActivities v3.0 (new in v7.6)
      // /places/search — legacy alias, kept for backwards compatibility
      if (pathname === '/places/nearby' || pathname === '/places/search') {
        return await handleNearbySearch(request, env);
      }

      if (pathname.startsWith('/places/details/')) {
        return await handlePlaceDetails(request, env);
      }

      if (pathname === '/places/photo') {
        return await handlePhotoProxy(request, env);
      }

      if (pathname === '/places/dietary') {
        return await handleDietarySearch(request, env);
      }

      if (pathname === '/cache/stats') {
        return await handleCacheStats(request, env);
      }

      // POST /places/restaurants - Full restaurant search with reviews
      if (pathname === '/places/restaurants' && request.method === 'POST') {
        return await handleRestaurantSearch(request, env);
      }

      // GET /places/coffee - Coffee shop search
      if (pathname === '/places/coffee') {
        return await handleCoffeeSearch(request, env);
      }

      // 404 for unknown routes
      return jsonResponse({ error: 'Not found', path: pathname }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        error: error.message,
        stack: error.stack
      }, 500);
    }
  }
};

// ============================================================================
// KV NAMESPACE BINDING (add to wrangler.toml)
// ============================================================================
/*

[[kv_namespaces]]
binding = "GLOBESKIMMERS_KV"
id = "your-kv-namespace-id"

# Also set the secret:
# wrangler secret put GOOGLE_API_KEY

*/
