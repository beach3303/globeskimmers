/**
 * ============================================================================
 * GLOBESKIMMERS API WORKER v7.12
 * ============================================================================
 *
 * Stable baseline: v7.11 (Mar 2026)
 *
 * Changes in v7.12:
 * - FIX: Add caching to handleDietarySearch (was hitting Google API every toggle!)
 * - MERGE: TTS worker (globeskimmers-tts) into main API at /tts route
 *   Requires: GOOGLE_TTS_API_KEY secret + TTS_CACHE KV binding
 *
 * Changes in v7.11:
 * - REVERT: locationRestriction → locationBias in all text search handlers
 *   (locationRestriction was too strict for searchText — Google returned 0 results
 *   for bakeries because few exist within the exact circle. locationBias lets
 *   Google breathe while Deno middleware enforces the radius fence with math)
 * - KEPT: locationRestriction in handleNearbySearch (API requires it)
 * - KEPT: maxResultCount 60 in handleRestaurantSearch
 *
 * Changes in v7.9:
 * - FIX: maxResultCount 20 → 60 in handleRestaurantSearch (POST /)
 *   (Google's max is 60 — gives frontend filters a much larger pool so
 *   bakery/pastry filter doesn't return just 1 result)
 * - FIX: Add radius to cache key suffix (rad10, rad15, rad25)
 *   (Prevents 10mi and 15mi searches from sharing cached results —
 *   previously switching radius served stale data from the first search)
 *
 * Changes in v7.8:
 * - ADD: Server-side filters in handleRestaurantSearch (POST /):
 *   openNow, minRating, priceLevels passed directly to Google Places API
 * - ADD: Same server-side filters in handleNearbySearch (/places/nearby)
 * - ADD: rankPreference: RELEVANCE for text searches
 * - FIX: Filter params included in cache key
 *
 * Changes in v7.7:
 * - ADD: `places.businessStatus` and `places.servesCocktails` to FIELD_MASK
 *
 * Changes in v7.6:
 * - FIX: extractCustomerFavorites threshold lowered from >= 2 to >= 1
 * - ADD: /places/nearby route
 * - FIX: handleNearbySearch now reads both `type` and `types` params
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
  API_KEY_SECRET: 'GOOGLE_API_KEY',

  CACHE_TTL: {
    TEXT_SEARCH: 12 * 60 * 60,       // 12 hours
    NEARBY_SEARCH: 3 * 24 * 60 * 60, // 3 days
    DETAILS: 90 * 24 * 60 * 60,      // 90 days
    PHOTO: 90 * 24 * 60 * 60,        // 90 days
    GEOCODING: 30 * 24 * 60 * 60,    // 30 days
    STALE_WHILE_REVALIDATE: 60 * 60  // 1 hour
  },

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

function roundCoordinate(coord, precision = 3) {
  return Math.round(coord * Math.pow(10, precision)) / Math.pow(10, precision);
}

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

  let priceLevel = place.priceLevel;
  if (typeof priceLevel === 'string') {
    if (priceLevel.includes('FREE')) priceLevel = 0;
    else if (priceLevel.includes('INEXPENSIVE')) priceLevel = 1;
    else if (priceLevel.includes('MODERATE')) priceLevel = 2;
    else if (priceLevel.includes('EXPENSIVE') && !priceLevel.includes('VERY')) priceLevel = 3;
    else if (priceLevel.includes('VERY_EXPENSIVE')) priceLevel = 4;
    else priceLevel = null;
  }

  const hours = place.currentOpeningHours?.weekdayDescriptions ||
                place.regularOpeningHours?.weekdayDescriptions ||
                [];

  const isOpen = place.currentOpeningHours?.openNow ?? null;

  return {
    id: place.id,
    placeId: place.id,
    name: place.displayName?.text || place.name || 'Unknown',
    displayName: place.displayName || { text: place.displayName?.text || place.name || 'Unknown' },
    address: place.formattedAddress || place.address || '',
    formattedAddress: place.formattedAddress || '',
    shortAddress: place.shortFormattedAddress || (place.formattedAddress || '').split(',')[0],
    shortFormattedAddress: place.shortFormattedAddress || '',
    location: place.location,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    rating: place.rating || null,
    reviewCount: place.userRatingCount || 0,
    userRatingCount: place.userRatingCount || 0,
    priceLevel,
    primaryType: place.primaryType || null,
    primaryTypeDisplay: place.primaryTypeDisplayName?.text || null,
    types: place.types || [],
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    nationalPhoneNumber: place.nationalPhoneNumber || '',
    internationalPhoneNumber: place.internationalPhoneNumber || '',
    website: place.websiteUri || null,
    websiteUri: place.websiteUri || '',
    googleMapsUrl: place.googleMapsUri || null,
    googleMapsUri: place.googleMapsUri || '',
    hours,
    isOpen,
    currentOpeningHours: place.currentOpeningHours || null,
    regularOpeningHours: place.regularOpeningHours || null,
    photos,
    reviews: (place.reviews || []).slice(0, 5).map(r => ({
      author: r.authorAttribution?.displayName || 'Anonymous',
      rating: r.rating,
      text: r.text?.text || r.originalText?.text || '',
      time: r.relativePublishTimeDescription || '',
      publishTime: r.publishTime
    })),
    editorialSummary: place.editorialSummary?.text || null,
    servesVegetarianFood: place.servesVegetarianFood || false,
    servesBeer: place.servesBeer || false,
    servesWine: place.servesWine || false,
    servesCoffee: place.servesCoffee || false,
    servesBreakfast: place.servesBreakfast || false,
    servesLunch: place.servesLunch || false,
    servesDinner: place.servesDinner || false,
    servesBrunch: place.servesBrunch || false,
    takeout: place.takeout || false,
    delivery: place.delivery || false,
    dineIn: place.dineIn || false,
    reservable: place.reservable || false,
    outdoorSeating: place.outdoorSeating || false,
    liveMusic: place.liveMusic || false,
    goodForChildren: place.goodForChildren || false,
    goodForGroups: place.goodForGroups || false,
    allowsDogs: place.allowsDogs || false,
    parkingOptions: place.parkingOptions || null,
    paymentOptions: place.paymentOptions || null,
    accessibilityOptions: place.accessibilityOptions || null,
    businessStatus: place.businessStatus || null,
    servesCocktails: place.servesCocktails || false
  };
}

// ============================================================================
// HANDLER: TEXT SEARCH
// v7.11 FIX: locationRestriction → locationBias (text search needs breathing room)
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

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  // v7.11: back to locationBias — locationRestriction was dropping valid text search results
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
      }, 200);
    }

    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl));

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
  const types = params.types || params.type || 'restaurant';
  const radius = parseInt(params.radius) || 5000;
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 20);
  const forceRefresh = params.forceRefresh === 'true';
  const openNow   = params.openNow === 'true';
  const minRating = parseFloat(params.minRating) || 0;
  const priceLevels = params.priceLevels ? params.priceLevels.split(',') : [];

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

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  // Nearby Search already uses locationRestriction (required by API)
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

  const pathParts = pathname.split('/');
  const placeId = pathParts[pathParts.length - 1];

  if (!placeId) {
    return jsonResponse({ error: 'Place ID required' }, 400);
  }

  const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

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
// v7.11 FIX: locationRestriction → locationBias (text search needs breathing room)
// ============================================================================

async function handleDietarySearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  const dietary = params.dietary || '';
  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  const radius = parseInt(params.radius) || 5000;
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 60);

  const dietaryQueries = {
    vegetarian: 'vegetarian restaurant',
    vegan: 'vegan restaurant',
    glutenFree: 'gluten free restaurant',
    halal: 'halal restaurant',
    kosher: 'kosher restaurant'
  };

  const textQuery = dietaryQueries[dietary] || `${dietary} restaurant`;

  // v7.12: ADD CACHING — was completely missing, every toggle hit Google API fresh
  const cacheKey = generateCacheKey('dietary', { latitude, longitude, radius, textQuery: dietary });
  const cached = await getFromCache(env, cacheKey);
  if (cached && cached.age < CONFIG.CACHE_TTL.TEXT_SEARCH * 1000) {
    return jsonResponse({ places: cached.data, count: cached.data.length, dietary, cached: true });
  }

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

    // Cache dietary results (was missing — cost leak)
    await setInCache(env, cacheKey, places, CONFIG.CACHE_TTL.TEXT_SEARCH);

    return jsonResponse({
      places,
      count: places.length,
      dietary: dietary,
      cached: false
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
    version: '7.12',
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
// v7.11 FIX: locationRestriction → locationBias (text search needs breathing room)
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

  // v7.11: back to locationBias — locationRestriction was dropping valid text search results
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
// v7.11 FIX: locationRestriction → locationBias (text search needs breathing room)
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
      openNow = false,
      minRating = 0,
      priceLevels = [],
    } = body;

    if (!latitude || !longitude) {
      return jsonResponse({ error: 'Latitude and longitude required', restaurants: [] }, 400);
    }

    const radiusMeters = Math.min(radiusMiles * 1609.34, 50000);
    const apiKey = env.GOOGLE_API_KEY;
    const url = new URL(request.url);
    const baseUrl = url.origin;

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

    const filterSuffix = [
      openNow ? 'open' : '',
      minRating > 0 ? `r${minRating}` : '',
      priceLevels?.length ? priceLevels.join('-') : '',
      `rad${Math.round(radiusMiles)}`
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

    // v7.11: back to locationBias — locationRestriction was dropping valid text search results
    const requestBody = {
      textQuery: searchQuery,
      maxResultCount: 60,
      rankPreference: 'RELEVANCE',
      locationBias: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters
        }
      }
    };

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

    await setInCache(env, cacheKey, restaurants, CONFIG.CACHE_TTL.TEXT_SEARCH);

    return jsonResponse({
      restaurants,
      places: restaurants,
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
    .filter(([_, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dish, count]) => ({
      dish: dish.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      mentions: count
    }));
}

// ============================================================================
// TTS: PHONETIC PREPROCESSING (merged from globeskimmers-tts worker)
// ============================================================================

function applyPhoneticTweaks(text, languageCode, city) {
  const code = (languageCode || '').toLowerCase();
  const cityLower = (city || '').toLowerCase();
  const isBoholano = code === 'ceb-bohol' || code === 'boholano' ||
    cityLower.includes('bohol') || cityLower.includes('tagbilaran') ||
    cityLower.includes('panglao') || cityLower.includes('loboc');
  if (isBoholano) {
    let tweaked = text;
    tweaked = tweaked.replace(/y(?=[a-zA-Z])/g, 'j');
    tweaked = tweaked.replace(/Y(?=[a-zA-Z])/g, 'J');
    tweaked = tweaked.replace(/nj/g, 'ny');
    tweaked = tweaked.replace(/Nj/g, 'Ny');
    return tweaked;
  }
  return text;
}

const TTS_VOICE_MAP = {
  'en': { languageCode: 'en-US', name: 'en-US-Neural2-J', gender: 'MALE' },
  'en-US': { languageCode: 'en-US', name: 'en-US-Neural2-J', gender: 'MALE' },
  'en-GB': { languageCode: 'en-GB', name: 'en-GB-Neural2-B', gender: 'MALE' },
  'en-AU': { languageCode: 'en-AU', name: 'en-AU-Neural2-B', gender: 'MALE' },
  'es': { languageCode: 'es-ES', name: 'es-ES-Neural2-B', gender: 'MALE' },
  'es-ES': { languageCode: 'es-ES', name: 'es-ES-Neural2-B', gender: 'MALE' },
  'es-MX': { languageCode: 'es-US', name: 'es-US-Neural2-A', gender: 'FEMALE' },
  'fr': { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B', gender: 'MALE' },
  'fr-FR': { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B', gender: 'MALE' },
  'fr-CA': { languageCode: 'fr-CA', name: 'fr-CA-Neural2-B', gender: 'MALE' },
  'de': { languageCode: 'de-DE', name: 'de-DE-Neural2-B', gender: 'MALE' },
  'de-DE': { languageCode: 'de-DE', name: 'de-DE-Neural2-B', gender: 'MALE' },
  'it': { languageCode: 'it-IT', name: 'it-IT-Neural2-C', gender: 'MALE' },
  'it-IT': { languageCode: 'it-IT', name: 'it-IT-Neural2-C', gender: 'MALE' },
  'pt': { languageCode: 'pt-BR', name: 'pt-BR-Neural2-B', gender: 'MALE' },
  'pt-BR': { languageCode: 'pt-BR', name: 'pt-BR-Neural2-B', gender: 'MALE' },
  'pt-PT': { languageCode: 'pt-PT', name: 'pt-PT-Neural2-B', gender: 'MALE' },
  'ja': { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B', gender: 'MALE' },
  'ja-JP': { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B', gender: 'MALE' },
  'ko': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B', gender: 'MALE' },
  'ko-KR': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B', gender: 'MALE' },
  'zh': { languageCode: 'cmn-CN', name: 'cmn-CN-Neural2-B', gender: 'MALE' },
  'zh-CN': { languageCode: 'cmn-CN', name: 'cmn-CN-Neural2-B', gender: 'MALE' },
  'cmn-CN': { languageCode: 'cmn-CN', name: 'cmn-CN-Neural2-B', gender: 'MALE' },
  'zh-TW': { languageCode: 'cmn-TW', name: 'cmn-TW-Neural2-A', gender: 'FEMALE' },
  'yue': { languageCode: 'yue-HK', name: 'yue-HK-Neural2-A', gender: 'FEMALE' },
  'yue-HK': { languageCode: 'yue-HK', name: 'yue-HK-Neural2-A', gender: 'FEMALE' },
  'vi': { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A', gender: 'FEMALE' },
  'vi-VN': { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A', gender: 'FEMALE' },
  'th': { languageCode: 'th-TH', name: 'th-TH-Neural2-C', gender: 'FEMALE' },
  'th-TH': { languageCode: 'th-TH', name: 'th-TH-Neural2-C', gender: 'FEMALE' },
  'id': { languageCode: 'id-ID', name: 'id-ID-Neural2-B', gender: 'MALE' },
  'id-ID': { languageCode: 'id-ID', name: 'id-ID-Neural2-B', gender: 'MALE' },
  'ms': { languageCode: 'ms-MY', name: 'ms-MY-Neural2-A', gender: 'FEMALE' },
  'tl': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-B', gender: 'MALE' },
  'fil': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-B', gender: 'MALE' },
  'fil-PH': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-B', gender: 'MALE' },
  'hi': { languageCode: 'hi-IN', name: 'hi-IN-Neural2-B', gender: 'MALE' },
  'hi-IN': { languageCode: 'hi-IN', name: 'hi-IN-Neural2-B', gender: 'MALE' },
  'bn': { languageCode: 'bn-IN', name: 'bn-IN-Neural2-B', gender: 'MALE' },
  'ta': { languageCode: 'ta-IN', name: 'ta-IN-Neural2-B', gender: 'MALE' },
  'te': { languageCode: 'te-IN', name: 'te-IN-Neural2-B', gender: 'MALE' },
  'mr': { languageCode: 'mr-IN', name: 'mr-IN-Neural2-B', gender: 'MALE' },
  'gu': { languageCode: 'gu-IN', name: 'gu-IN-Neural2-B', gender: 'MALE' },
  'kn': { languageCode: 'kn-IN', name: 'kn-IN-Neural2-B', gender: 'MALE' },
  'ml': { languageCode: 'ml-IN', name: 'ml-IN-Neural2-B', gender: 'MALE' },
  'pa': { languageCode: 'pa-IN', name: 'pa-IN-Neural2-B', gender: 'MALE' },
  'ar': { languageCode: 'ar-XA', name: 'ar-XA-Neural2-B', gender: 'MALE' },
  'he': { languageCode: 'he-IL', name: 'he-IL-Neural2-B', gender: 'MALE' },
  'tr': { languageCode: 'tr-TR', name: 'tr-TR-Neural2-B', gender: 'MALE' },
  'ru': { languageCode: 'ru-RU', name: 'ru-RU-Neural2-B', gender: 'MALE' },
  'pl': { languageCode: 'pl-PL', name: 'pl-PL-Neural2-B', gender: 'MALE' },
  'nl': { languageCode: 'nl-NL', name: 'nl-NL-Neural2-B', gender: 'MALE' },
  'uk': { languageCode: 'uk-UA', name: 'uk-UA-Neural2-A', gender: 'FEMALE' },
  'cs': { languageCode: 'cs-CZ', name: 'cs-CZ-Neural2-A', gender: 'FEMALE' },
  'hu': { languageCode: 'hu-HU', name: 'hu-HU-Neural2-A', gender: 'FEMALE' },
  'el': { languageCode: 'el-GR', name: 'el-GR-Neural2-A', gender: 'FEMALE' },
  'sv': { languageCode: 'sv-SE', name: 'sv-SE-Neural2-A', gender: 'FEMALE' },
  'da': { languageCode: 'da-DK', name: 'da-DK-Neural2-D', gender: 'FEMALE' },
  'no': { languageCode: 'nb-NO', name: 'nb-NO-Neural2-B', gender: 'MALE' },
  'nb': { languageCode: 'nb-NO', name: 'nb-NO-Neural2-B', gender: 'MALE' },
  'fi': { languageCode: 'fi-FI', name: 'fi-FI-Neural2-A', gender: 'FEMALE' },
  'ro': { languageCode: 'ro-RO', name: 'ro-RO-Neural2-A', gender: 'FEMALE' },
  'sk': { languageCode: 'sk-SK', name: 'sk-SK-Neural2-A', gender: 'FEMALE' },
  'bg': { languageCode: 'bg-BG', name: 'bg-BG-Neural2-A', gender: 'FEMALE' },
  'hr': { languageCode: 'hr-HR', name: 'hr-HR-Wavenet-A', gender: 'FEMALE' },
  'sr': { languageCode: 'sr-RS', name: 'sr-RS-Neural2-A', gender: 'FEMALE' },
  'ca': { languageCode: 'ca-ES', name: 'ca-ES-Neural2-A', gender: 'FEMALE' },
  'eu': { languageCode: 'eu-ES', name: 'eu-ES-Neural2-A', gender: 'FEMALE' },
  'gl': { languageCode: 'gl-ES', name: 'gl-ES-Neural2-A', gender: 'FEMALE' },
  'af': { languageCode: 'af-ZA', name: 'af-ZA-Neural2-A', gender: 'FEMALE' },
  'sw': { languageCode: 'sw-KE', name: 'sw-KE-Neural2-A', gender: 'FEMALE' },
  'is': { languageCode: 'is-IS', name: 'is-IS-Neural2-A', gender: 'FEMALE' },
  'lv': { languageCode: 'lv-LV', name: 'lv-LV-Neural2-B', gender: 'MALE' },
  'lt': { languageCode: 'lt-LT', name: 'lt-LT-Neural2-B', gender: 'MALE' },
};

const TTS_DIALECT_FALLBACKS = {
  'ceb': 'fil-PH', 'ceb-bohol': 'fil-PH', 'hil': 'fil-PH', 'war': 'fil-PH',
  'ilo': 'fil-PH', 'bik': 'fil-PH', 'pam': 'fil-PH', 'akl': 'fil-PH',
  'cbk': 'es-ES', 'wuu': 'cmn-CN', 'nan': 'cmn-CN', 'hak': 'cmn-CN',
  'jv': 'id-ID', 'su': 'id-ID', 'ban': 'id-ID',
  'nap': 'it-IT', 'scn': 'it-IT', 'vec': 'it-IT',
  'bar': 'de-DE', 'gsw': 'de-DE', 'ryu': 'ja-JP',
};

function getTtsVoiceConfig(inputCode) {
  const code = (inputCode || 'en').toLowerCase().trim();
  if (TTS_VOICE_MAP[inputCode]) return TTS_VOICE_MAP[inputCode];
  if (TTS_VOICE_MAP[code]) return TTS_VOICE_MAP[code];
  if (TTS_DIALECT_FALLBACKS[code]) {
    const fb = TTS_DIALECT_FALLBACKS[code];
    if (TTS_VOICE_MAP[fb]) return { ...TTS_VOICE_MAP[fb], isDialectFallback: true };
  }
  const base = code.split('-')[0];
  if (TTS_VOICE_MAP[base]) return TTS_VOICE_MAP[base];
  return TTS_VOICE_MAP['en'];
}

function ttsCreateHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// HANDLER: TTS (merged from globeskimmers-tts worker)
// Requires: env.GOOGLE_TTS_API_KEY, env.TTS_CACHE (KV)
// ============================================================================

async function handleTts(request, env, ctx) {
  const url = new URL(request.url);

  // GET: Retrieve cached translation
  if (request.method === 'GET' && url.searchParams.get('action') === 'getTranslation') {
    const key = url.searchParams.get('key');
    if (!key) return jsonResponse({ error: 'Missing key' }, 400);
    try {
      if (env.TTS_CACHE) {
        const cached = await env.TTS_CACHE.get(key);
        if (cached) return jsonResponse({ phrases: JSON.parse(cached), cached: true });
      }
      return jsonResponse({ phrases: null, cached: false });
    } catch (e) {
      return jsonResponse({ phrases: null, error: e.message });
    }
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'POST required' }, 405);

  const body = await request.json();

  // POST: Save translation to KV
  if (body.action === 'saveTranslation') {
    const { key, phrases } = body;
    if (!key || !phrases) return jsonResponse({ error: 'Missing key or phrases' }, 400);
    try {
      if (env.TTS_CACHE) await env.TTS_CACHE.put(key, JSON.stringify(phrases));
      return jsonResponse({ success: true, key });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // POST: Text-to-Speech
  const { text, languageCode, city } = body;
  if (!text) return jsonResponse({ error: 'Missing text', useFallback: true }, 400);

  const truncatedText = text.length > 500 ? text.substring(0, 500) : text;
  const voiceConfig = getTtsVoiceConfig(languageCode);
  if (!voiceConfig) return jsonResponse({ error: `No voice for: ${languageCode}`, useFallback: true });

  const phoneticText = applyPhoneticTweaks(truncatedText, languageCode, city);
  const cacheKey = `tts_v6_${voiceConfig.name}_${ttsCreateHash(phoneticText)}`;

  // Check KV cache
  if (env.TTS_CACHE) {
    const cached = await env.TTS_CACHE.get(cacheKey);
    if (cached) {
      return jsonResponse({ audioContent: cached, cached: true, cacheType: 'kv', voiceUsed: voiceConfig.name });
    }
  }

  if (!env.GOOGLE_TTS_API_KEY) {
    return jsonResponse({ error: 'API key not configured', useFallback: true }, 500);
  }

  // SSML for pause markers
  const hasPauseMarkers = phoneticText.includes('...');
  let inputConfig;
  if (hasPauseMarkers) {
    const escaped = phoneticText.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const ssml = `<speak>${escaped.replace(/\.\.\./g, '<break time="2s"/>')}</speak>`;
    inputConfig = { ssml };
  } else {
    inputConfig = { text: phoneticText };
  }

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputConfig,
          voice: { languageCode: voiceConfig.languageCode, name: voiceConfig.name, ssmlGender: voiceConfig.gender },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0.0, volumeGainDb: 3.0, sampleRateHertz: 24000 }
        })
      }
    );

    if (!response.ok) {
      // Fallback to auto-select voice
      if (response.status === 400) {
        const fbRes = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: inputConfig,
              voice: { languageCode: voiceConfig.languageCode, ssmlGender: 'NEUTRAL' },
              audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, volumeGainDb: 3.0 }
            })
          }
        );
        if (fbRes.ok) {
          const data = await fbRes.json();
          if (data.audioContent) {
            if (env.TTS_CACHE) ctx.waitUntil(env.TTS_CACHE.put(cacheKey, data.audioContent));
            return jsonResponse({ audioContent: data.audioContent, cached: false, voiceUsed: 'auto' });
          }
        }
      }
      return jsonResponse({ error: `TTS error: ${response.status}`, useFallback: true }, 500);
    }

    const data = await response.json();
    if (!data.audioContent) return jsonResponse({ error: 'No audio', useFallback: true }, 500);

    if (env.TTS_CACHE) {
      ctx.waitUntil(env.TTS_CACHE.put(cacheKey, data.audioContent));
    }

    return jsonResponse({
      audioContent: data.audioContent,
      cached: false,
      voiceUsed: voiceConfig.name,
      charCount: phoneticText.length
    });
  } catch (error) {
    return jsonResponse({ error: error.message, useFallback: true }, 500);
  }
}

// ============================================================================
// MAIN WORKER EXPORT
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    try {
      if (pathname === '/' || pathname === '') {
        if (request.method === 'POST') {
          return await handleRestaurantSearch(request, env);
        }
        return new Response('Globeskimmers API Worker v7.12 - All Systems Ready! 📸🍽️☕', {
          headers: CORS_HEADERS
        });
      }

      if (pathname === '/health') {
        return jsonResponse({
          status: 'ok',
          version: '7.12',
          features: ['text-search', 'nearby-search', 'details', 'photo-proxy', 'dietary', 'restaurants', 'coffee', 'tts', 'business-status', 'serves-cocktails'],
          kvBound: !!env.GLOBESKIMMERS_KV,
          timestamp: new Date().toISOString()
        });
      }

      if (pathname === '/places/text-search') {
        return await handleTextSearch(request, env);
      }

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

      if (pathname === '/places/restaurants' && request.method === 'POST') {
        return await handleRestaurantSearch(request, env);
      }

      if (pathname === '/places/coffee') {
        return await handleCoffeeSearch(request, env);
      }

      // TTS routes (merged from globeskimmers-tts worker)
      if (pathname === '/tts') {
        return await handleTts(request, env, ctx);
      }

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
