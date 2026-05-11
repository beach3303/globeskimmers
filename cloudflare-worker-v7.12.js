/**
 * GLOBESKIMMERS API WORKER v7.12 - Cost Optimized
 * 
 * COST SAVINGS:
 * - Search endpoints: Advanced tier ($5/1K) - no reviews
 * - Details endpoint: Preferred tier ($20/1K) - with reviews, cached 90 days
 * - Estimated savings: ~75% on search API costs
 */

const CONFIG = {
  CACHE_TTL: {
    TEXT_SEARCH: 12 * 60 * 60,
    NEARBY_SEARCH: 3 * 24 * 60 * 60,
    DETAILS: 90 * 24 * 60 * 60,
    PHOTO: 90 * 24 * 60 * 60,
    DIETARY: 12 * 60 * 60,
    STALE_WHILE_REVALIDATE: 60 * 60
  },

  // SEARCH - Advanced tier ($5/1K) - NO reviews
  SEARCH_FIELD_MASK: [
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
    'places.servesCocktails',
    'places.editorialSummary',
    'places.menuForChildren'
  ].join(','),

  // DETAILS - Preferred tier ($20/1K) - WITH reviews
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
    'servesCocktails',
    'menuForChildren'
  ].join(',')
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function handleCORS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function roundCoordinate(coord, precision = 1) {
  return Math.round(coord * Math.pow(10, precision)) / Math.pow(10, precision);
}

function generateCacheKey(prefix, params) {
  const lat = roundCoordinate(parseFloat(params.latitude) || 0);
  const lng = roundCoordinate(parseFloat(params.longitude) || 0);
  const query = (params.textQuery || params.query || '').toLowerCase().trim();
  const types = (params.types || params.type || '').toLowerCase();
  const includedType = (params.includedType || '').toLowerCase();
  const radius = params.radius || '5000';
  return `${prefix}_${lat}_${lng}_${radius}_${query}_${types}_${includedType}`.replace(/\s+/g, '_');
}

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

function normalizePlace(place, baseUrl = '', includeReviews = false) {
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
                place.regularOpeningHours?.weekdayDescriptions || [];
  const isOpen = place.currentOpeningHours?.openNow ?? null;

  const normalized = {
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

  if (includeReviews) {
    normalized.reviews = (place.reviews || []).slice(0, 5).map(r => ({
      author: r.authorAttribution?.displayName || 'Anonymous',
      rating: r.rating,
      text: r.text?.text || r.originalText?.text || '',
      time: r.relativePublishTimeDescription || '',
      publishTime: r.publishTime
    }));
    normalized.editorialSummary = place.editorialSummary?.text || null;
    normalized.customer_favorites = extractCustomerFavorites(place.reviews || []);
    normalized.top_reviews = normalized.reviews.slice(0, 3);
  } else {
    normalized.reviews = [];
    normalized.editorialSummary = null;
    normalized.customer_favorites = [];
    normalized.top_reviews = [];
    normalized.needsDetailsFetch = true;
  }

  return normalized;
}

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

async function handleTextSearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const textQuery = params.textQuery || params.query || '';
  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  const radius = Math.min(parseInt(params.radius) || 5000, 50000);
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 60);
  const forceRefresh = params.forceRefresh === 'true';

  if (!textQuery) {
    return jsonResponse({ error: 'textQuery is required', places: [] }, 400);
  }

  const cacheKey = generateCacheKey('text', params);
  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached && cached.age < CONFIG.CACHE_TTL.TEXT_SEARCH * 1000) {
      return jsonResponse({ places: cached.data, count: cached.data.length, cached: true, cacheAge: Math.round(cached.age / 1000) });
    }
  }

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.SEARCH_FIELD_MASK
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "en",
        maxResultCount: maxResults,
        locationBias: { circle: { center: { latitude, longitude }, radius } },
        ...(params.includedType ? { includedType: params.includedType, strictTypeFiltering: false } : {})
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: 'Google Places API error', status: response.status, details: errorText, places: [] }, 200);
    }

    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl, false));
    await setInCache(env, cacheKey, places, CONFIG.CACHE_TTL.TEXT_SEARCH);
    return jsonResponse({ places, count: places.length, cached: false });
  } catch (error) {
    return jsonResponse({ error: error.message, places: [] }, 200);
  }
}

async function handleNearbySearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  const types = params.types || params.type || 'restaurant';
  const radius = Math.min(parseInt(params.radius) || 5000, 50000);
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 20);
  const forceRefresh = params.forceRefresh === 'true';
  const openNow = params.openNow === 'true';
  const minRating = parseFloat(params.minRating) || 0;
  const priceLevels = params.priceLevels ? params.priceLevels.split(',') : [];

  const filterSuffix = [openNow ? 'open' : '', minRating > 0 ? `r${minRating}` : '', priceLevels.length ? priceLevels.join('-') : ''].filter(Boolean).join('_');
  const cacheKey = generateCacheKey('nearby', { ...params, types }) + (filterSuffix ? `_${filterSuffix}` : '');

  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached && cached.age < CONFIG.CACHE_TTL.NEARBY_SEARCH * 1000) {
      return jsonResponse({ places: cached.data, count: cached.data.length, cached: true, cacheAge: Math.round(cached.age / 1000) });
    }
  }

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  const requestBody = {
    includedTypes: types.split(',').map(t => t.trim()),
    languageCode: "en",
    maxResultCount: maxResults,
    locationRestriction: { circle: { center: { latitude, longitude }, radius } },
    rankPreference: params.rankBy === 'DISTANCE' ? 'DISTANCE' : 'POPULARITY'
  };

  if (openNow) requestBody.openNow = true;
  if (minRating > 0) requestBody.minRating = minRating;
  if (priceLevels.length) requestBody.priceLevels = priceLevels;

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.SEARCH_FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: 'Google Places API error', status: response.status, details: errorText, places: [] }, 200);
    }

    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl, false));
    await setInCache(env, cacheKey, places, CONFIG.CACHE_TTL.NEARBY_SEARCH);
    return jsonResponse({ places, count: places.length, cached: false });
  } catch (error) {
    return jsonResponse({ error: error.message, places: [] }, 200);
  }
}

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
      return jsonResponse({ place: cached.data, cached: true, cacheAge: Math.round(cached.age / 1000) });
    }
  }

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.DETAILS_FIELD_MASK
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: 'Place not found', status: response.status, details: errorText }, 404);
    }

    const place = await response.json();
    const normalized = normalizePlace(place, baseUrl, true);
    await setInCache(env, cacheKey, normalized, CONFIG.CACHE_TTL.DETAILS);
    return jsonResponse({ place: normalized, cached: false });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

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
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800', 'X-Cache': 'HIT', ...CORS_HEADERS }
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
      return jsonResponse({ error: 'Photo not found' }, 404);
    }

    const photoBuffer = await photoRes.arrayBuffer();
    const contentType = photoRes.headers.get('Content-Type') || 'image/jpeg';

    if (env.GLOBESKIMMERS_KV) {
      try {
        await env.GLOBESKIMMERS_KV.put(cacheKey, photoBuffer, { expirationTtl: CONFIG.CACHE_TTL.PHOTO });
      } catch (e) {
        console.error('Photo cache write error:', e);
      }
    }

    return new Response(photoBuffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=604800', 'X-Cache': 'MISS', ...CORS_HEADERS }
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleDietarySearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const dietary = params.dietary || '';
  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  const radius = Math.min(parseInt(params.radius) || 5000, 50000);
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 60);
  const forceRefresh = params.forceRefresh === 'true';

  const dietaryQueries = {
    vegetarian: 'vegetarian restaurant',
    vegan: 'vegan restaurant',
    glutenFree: 'gluten free restaurant',
    halal: 'halal restaurant',
    kosher: 'kosher restaurant'
  };

  const textQuery = dietaryQueries[dietary] || `${dietary} restaurant`;
  const cacheKey = generateCacheKey('dietary', { latitude, longitude, radius, textQuery: dietary });

  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached && cached.age < CONFIG.CACHE_TTL.DIETARY * 1000) {
      return jsonResponse({ places: cached.data, count: cached.data.length, dietary, cached: true, cacheAge: Math.round(cached.age / 1000) });
    }
  }

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.SEARCH_FIELD_MASK
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "en",
        maxResultCount: maxResults,
        locationBias: { circle: { center: { latitude, longitude }, radius } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: 'Dietary search failed', details: errorText, places: [] }, 200);
    }

    const data = await response.json();
    let places = (data.places || []).map(p => normalizePlace(p, baseUrl, false));
    // Native boolean verification: Google Places API (New) only exposes
    // servesVegetarianFood (there is no servesVeganFood field). Use it to
    // prefer verified vegetarian places, but fall back to the full set if
    // Google hasn't populated the boolean for most results.
    if (dietary === 'vegetarian') {
      const verified = places.filter(p => p.servesVegetarianFood === true);
      if (verified.length >= 3) places = verified;
    }
    await setInCache(env, cacheKey, places, CONFIG.CACHE_TTL.DIETARY);
    return jsonResponse({ places, count: places.length, dietary, cached: false });
  } catch (error) {
    return jsonResponse({ error: error.message, places: [] }, 200);
  }
}

async function handleCoffeeSearch(request, env) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const latitude = parseFloat(params.latitude) || 0;
  const longitude = parseFloat(params.longitude) || 0;
  const radius = Math.min(parseInt(params.radius) || 5000, 50000);
  const maxResults = Math.min(parseInt(params.maxResults) || 20, 40);
  const query = params.query || 'coffee shop cafe';
  const forceRefresh = params.forceRefresh === 'true';

  const cacheKey = generateCacheKey('coffee', { latitude, longitude, radius, textQuery: query });

  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached && cached.age < CONFIG.CACHE_TTL.TEXT_SEARCH * 1000) {
      return jsonResponse({ places: cached.data, count: cached.data.length, cached: true });
    }
  }

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.SEARCH_FIELD_MASK
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "en",
        maxResultCount: maxResults,
        locationBias: { circle: { center: { latitude, longitude }, radius } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: 'Coffee search failed', details: errorText, places: [] }, 200);
    }

    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl, false));
    await setInCache(env, cacheKey, places, CONFIG.CACHE_TTL.TEXT_SEARCH);
    return jsonResponse({ places, count: places.length, cached: false });
  } catch (error) {
    return jsonResponse({ error: error.message, places: [] }, 200);
  }
}

async function handleRestaurantSearch(request, env) {
  try {
    const body = await request.json();
    const { latitude, longitude, radiusMiles = 10, query = '', category = '', cuisineType = '', dietary = '', forceRefresh = false, openNow = false, minRating = 0, priceLevels = [], includedType = '' } = body;

    if (!latitude || !longitude) {
      return jsonResponse({ error: 'Latitude and longitude required', restaurants: [] }, 400);
    }

    const radiusMeters = Math.min(radiusMiles * 1609.34, 50000);
    const apiKey = env.GOOGLE_API_KEY;
    const url = new URL(request.url);
    const baseUrl = url.origin;

    let searchQuery = query || 'restaurant';
    if (cuisineType && cuisineType !== 'all') searchQuery = `${cuisineType} restaurant`;
    if (category && category !== 'all' && category !== 'All Food') searchQuery = `${category} restaurant`;
    if (dietary) searchQuery = `${dietary} ${searchQuery}`;

    const filterSuffix = [openNow ? 'open' : '', minRating > 0 ? `r${minRating}` : '', priceLevels?.length ? priceLevels.join('-') : '', includedType ? `t-${includedType}` : '', `rad${Math.round(radiusMiles)}`].filter(Boolean).join('_');
    const cacheKey = generateCacheKey('restaurants', { latitude, longitude, radius: radiusMeters, textQuery: searchQuery }) + (filterSuffix ? `_${filterSuffix}` : '');

    if (!forceRefresh) {
      const cached = await getFromCache(env, cacheKey);
      if (cached && cached.age < CONFIG.CACHE_TTL.TEXT_SEARCH * 1000) {
        return jsonResponse({ restaurants: cached.data, count: cached.data.length, cached: true, cacheAge: Math.round(cached.age / 1000) });
      }
    }

    const requestBody = {
      textQuery: searchQuery,
      languageCode: "en",
      maxResultCount: 60,
      rankPreference: 'RELEVANCE',
      locationBias: { circle: { center: { latitude, longitude }, radius: radiusMeters } }
    };

    if (openNow) requestBody.openNow = true;
    if (minRating > 0) requestBody.minRating = minRating;
    if (priceLevels?.length) requestBody.priceLevels = priceLevels;
    if (includedType) { requestBody.includedType = includedType; requestBody.strictTypeFiltering = false; }

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.SEARCH_FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: 'Search failed', details: errorText, restaurants: [] }, 200);
    }

    const data = await response.json();
    const restaurants = (data.places || []).map(p => {
      const normalized = normalizePlace(p, baseUrl, false);
      return { ...normalized, customer_favorites: [], top_reviews: [], needsDetailsFetch: true };
    });

    await setInCache(env, cacheKey, restaurants, CONFIG.CACHE_TTL.TEXT_SEARCH);
    return jsonResponse({ restaurants, places: restaurants, count: restaurants.length, cached: false, note: 'Reviews available via /places/details/{id}' });
  } catch (error) {
    return jsonResponse({ error: error.message, restaurants: [], places: [] }, 200);
  }
}

async function handleCacheStats(request, env) {
  return jsonResponse({
    status: 'ok',
    version: '7.12-optimized',
    kvBound: !!env.GLOBESKIMMERS_KV,
    costOptimization: { search: 'Advanced tier ($5/1K)', details: 'Preferred tier ($20/1K) - cached 90 days' },
    cacheTTLs: { textSearch: '12 hours', nearbySearch: '3 days', dietary: '12 hours', details: '90 days', photo: '90 days' },
    timestamp: new Date().toISOString()
  });
}

// ============================================================================
// PRICE SCANNER — direct Anthropic Claude Sonnet 4.6 with prompt caching
// Replaces Base44 InvokeLLM for the SmartPriceScanner. Set ANTHROPIC_API_KEY
// as a Worker secret in the Cloudflare dashboard before deploying.
// ============================================================================

const PRICE_SCAN_SYSTEM_PROMPT = `You are a vision price-extraction engine for travelers using GlobeSkimmers, a travel app.

ROLE
Read the image and extract every visible price. Return strict JSON. Never include narrative text, markdown fences, or commentary outside the JSON object.

OUTPUT SCHEMA
{
  "prices": [
    {
      "amount": <number>,        // numeric value only, no commas, no currency symbol
      "currency": <string>,      // ISO 4217 code (3 letters), e.g. "USD", "EUR", "JPY", "PHP", "GBP"
      "symbol": <string>,        // the symbol or short label as it appears on the tag (€, ¥, $, ₱, £, kr, Rp, ₩, ₹, R$, etc.)
      "context": <string>        // brief label: what is being priced ("Main dish", "Latte", "T-shirt"). Empty string if unknown.
    }
  ]
}

If no prices are visible: {"prices": []}.
Return only the JSON. No prose. No markdown.

CURRENCY DETECTION RULES
- Use the printed symbol AND surrounding context (country, language, store branding) to infer the ISO code.
- $ alone is ambiguous. Disambiguate using context:
  • "USD" if no other country signal is present and language is English-only.
  • "CAD" if Canadian context (province/postal code, French-English bilingual).
  • "AUD" if Australian context.
  • "MXN" if Mexican context.
  • "ARS", "CLP", "COP" for South American Spanish contexts.
  • "HKD" if "HK$" or "HKD" appears, or Hong Kong context.
  • "SGD" if "S$" or Singapore context.
  • "NT$" → "TWD".
- £ → "GBP" by default; "EGP" if Egyptian context (e.g. Arabic text, Cairo, "ج.م").
- ¥ → "JPY" if Japanese context (kana, kanji); "CNY" if Chinese context (simplified Chinese, mainland brands).
- € → "EUR".
- ₱ → "PHP".
- ₩ → "KRW".
- ₹ → "INR".
- ฿ → "THB".
- ₫ → "VND".
- Rp → "IDR".
- RM → "MYR".
- kr → "DKK"/"NOK"/"SEK" depending on context (Denmark/Norway/Sweden).
- Fr or CHF → "CHF".
- zł → "PLN".
- Kč → "CZK".
- Ft → "HUF".
- ₺ → "TRY".
- R$ → "BRL".
- R alone (with South African context) → "ZAR".
- AED, د.إ → "AED".
- ₪ → "ILS".

NUMBER PARSING
- Strip currency symbols and thousands separators.
- Both "1,500" and "1.500" can mean 1500 depending on locale. If decimals are clearly present (two digits after a separator typical for the inferred currency), treat them as decimals; otherwise treat as thousands.
- For currencies with no minor unit (JPY, KRW, VND, IDR, CLP, HUF), expect integer amounts.
- For currencies with major+minor units (USD, EUR, GBP, CAD, AUD, etc.), keep two decimals if shown.

EDGE CASES
- Price ranges ("$5–$8"): emit two entries, one per endpoint, using the same context.
- Strikethrough / discounted: emit only the current/effective price (the one not crossed out). Skip the original price.
- Buy-one-get-one or "2 for $X": emit a single entry with amount = X.
- Per-unit pricing ("$3.99/lb"): emit amount = 3.99, append the unit to context (e.g. "Apples per lb").
- Tax-inclusive vs exclusive: ignore the tax distinction; report the printed amount as-is.
- Membership / loyalty prices: include only if there is no separate non-member price. If both are shown, return the regular (non-member) price.
- Tip suggestions on receipts: skip — those are not item prices.
- Subtotal, total, tax lines on receipts: skip individual line items if a clear total is shown; otherwise emit each visible item line.
- Partially obscured or blurry numbers: skip entirely. Do NOT guess.
- Multiple items on a menu/sign: emit one entry per visible price.

CONTEXT FIELD
- Extract a SHORT label (≤ 40 chars). Use the item name when visible.
- If only a price tag is visible without an item name, set context to "" (empty string).
- Keep context in the source language as printed; do not translate.

QUALITY GATE
- If the image is too dark, blurry, glare-blocked, or pointed at non-price content (faces, sky, floor), return {"prices": []}.
- Better to return an empty array than to hallucinate.

Return strict JSON only.`;

async function handlePriceScan(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured', prices: [] }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body', prices: [] }, 400);
  }

  const imageBase64 = body.image;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return jsonResponse({ error: 'image (base64 string) is required', prices: [] }, 400);
  }
  const mediaType = body.mediaType || 'image/jpeg';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        // Cache the long stable system prompt — every scan re-uses it, so we
        // pay full input price only on the first call per ~5 minutes; cache
        // hits are ~90% cheaper.
        system: [
          {
            type: 'text',
            text: PRICE_SCAN_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: 'Extract every visible price from this image. Return strict JSON matching the schema.'
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return jsonResponse({ error: `Anthropic API error ${response.status}`, details: errText, prices: [] }, 200);
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const raw = textBlock?.text || '';

    let parsed = { prices: [] };
    try {
      // Strip any accidental markdown fences before parsing.
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      return jsonResponse({ error: 'Model returned non-JSON', raw, prices: [] }, 200);
    }

    return jsonResponse({
      prices: Array.isArray(parsed.prices) ? parsed.prices : [],
      usage: data.usage || null
    });
  } catch (error) {
    return jsonResponse({ error: error.message, prices: [] }, 200);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'OPTIONS') return handleCORS();

    try {
      if (pathname === '/' || pathname === '') {
        if (request.method === 'POST') return await handleRestaurantSearch(request, env);
        return new Response('Globeskimmers API v7.12 - Cost Optimized! 💰🍽️☕', { headers: CORS_HEADERS });
      }

      if (pathname === '/health') {
        return jsonResponse({
          status: 'ok',
          version: '7.12-optimized',
          features: ['text-search', 'nearby-search', 'details-with-reviews', 'photo-proxy', 'dietary-cached', 'restaurants', 'coffee', 'split-field-masks'],
          costOptimization: { search: 'Advanced ($5/1K)', details: 'Preferred ($20/1K)' },
          kvBound: !!env.GLOBESKIMMERS_KV,
          timestamp: new Date().toISOString()
        });
      }

      if (pathname === '/places/text-search') return await handleTextSearch(request, env);
      if (pathname === '/places/nearby' || pathname === '/places/search') return await handleNearbySearch(request, env);
      if (pathname.startsWith('/places/details/')) return await handlePlaceDetails(request, env);
      if (pathname === '/places/photo') return await handlePhotoProxy(request, env);
      if (pathname === '/places/dietary') return await handleDietarySearch(request, env);
      if (pathname === '/cache/stats') return await handleCacheStats(request, env);
      if (pathname === '/places/restaurants' && request.method === 'POST') return await handleRestaurantSearch(request, env);
      if (pathname === '/places/coffee') return await handleCoffeeSearch(request, env);
      if (pathname === '/scan-prices' && request.method === 'POST') return await handlePriceScan(request, env);

      return jsonResponse({ error: 'Not found', path: pathname }, 404);
    } catch (error) {
      return jsonResponse({ error: error.message, stack: error.stack }, 500);
    }
  }
};
// CI test Mon May 11 06:28:51 PDT 2026
