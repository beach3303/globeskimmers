/**
 * GLOBESKIMMERS API WORKER v7.12 - Cost Optimized
 * 
 * COST SAVINGS:
 * - Search endpoints: Advanced tier ($5/1K) - no reviews
 * - Details endpoint: Preferred tier ($20/1K) - with reviews, cached 90 days
 * - Estimated savings: ~75% on search API costs
 */

// Text Search ONLY uses the standard SEARCH mask PLUS Google's native AI
// fields. Pro/Enterprise SKU tier — same as our existing editorialSummary,
// so no per-call cost change. Scoped to handleTextSearch only so cost
// impact is isolated to text-search calls.
//
//   places.generativeSummary          — Gemini-powered place overview, lives
//                                       INSIDE each Place object.
//   contextualContents.reviews        — query-aware review snippets, lives
//                                       at the TOP LEVEL of the response as
//                                       a sibling to places[], index-aligned.
//   contextualContents.photos         — query-aware photo subset, same shape.
//
// EXPERIMENTAL — Google explicitly marks contextualContents experimental
// (per https://developers.google.com/maps/documentation/places/web-service/
//  experimental/places-generative). Field may change/disappear; integration
// is null-safe end-to-end so worst case we silently lose the feature.
//
// HISTORY: 'places.contextualContents' was tried on 2026-05-22 — Google
// returned 400 INVALID_ARGUMENT because contextualContents is NOT under
// places[]. The correct path (verified against Google's official searchText
// reference) uses no 'places.' prefix. handleTextSearch below merges the
// top-level array into each place by position before normalizePlace runs.
const TEXT_SEARCH_AI_FIELDS =
  'places.generativeSummary,contextualContents.reviews,contextualContents.photos';

const CONFIG = {
  CACHE_TTL: {
    // Fresh windows — within this age, cache is returned as-is.
    TEXT_SEARCH: 12 * 60 * 60,
    NEARBY_SEARCH: 3 * 24 * 60 * 60,
    DETAILS: 90 * 24 * 60 * 60,
    PHOTO: 90 * 24 * 60 * 60,
    DIETARY: 12 * 60 * 60,
    // Stale-while-revalidate windows — past the fresh window but within
    // FRESH + SWR, we return the cached response immediately AND trigger
    // a background refresh via ctx.waitUntil. KV expirationTtl is set to
    // FRESH + SWR so entries survive long enough to be served stale.
    TEXT_SEARCH_SWR: 12 * 60 * 60,      // 12hr fresh + 12hr stale = 24hr total
    NEARBY_SEARCH_SWR: 4 * 24 * 60 * 60, // 3d fresh + 4d stale = 7d total
    STALE_WHILE_REVALIDATE: 60 * 60      // legacy constant (unused)
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

// Stale-while-revalidate cache check. Returns one of:
//   { status: 'fresh', data, cacheAge }  — within fresh TTL; serve as-is.
//   { status: 'stale', data, cacheAge }  — past fresh, within fresh+SWR;
//                                          serve immediately AND schedule
//                                          a background refresh.
//   null                                 — miss, or beyond SWR window;
//                                          caller must fetch upstream.
// `refresher` is an async closure that re-fetches from upstream and re-caches.
// Set `expirationTtl` on writes to (freshTtl + swrTtl) so entries persist
// long enough to be served stale.
async function tryCacheWithSWR(env, ctx, cacheKey, freshTtl, swrTtl, refresher) {
  const cached = await getFromCache(env, cacheKey);
  if (!cached) return null;
  const ageSec = cached.age / 1000;
  if (ageSec < freshTtl) {
    return { status: 'fresh', data: cached.data, cacheAge: Math.round(ageSec) };
  }
  if (ageSec < freshTtl + swrTtl) {
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(refresher().catch(e => console.error(`SWR refresh failed for ${cacheKey}:`, e)));
    }
    return { status: 'stale', data: cached.data, cacheAge: Math.round(ageSec) };
  }
  return null;
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
    servesCocktails: place.servesCocktails || false,
    // Native Google Places API (New) AI fields. Only populated for places
    // Google has analyzed AND only returned when requested via field mask
    // (currently scoped to handleTextSearch via TEXT_SEARCH_AI_FIELDS).
    generativeSummary: place.generativeSummary || null,
    contextualContents: place.contextualContents || null
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

async function handleTextSearch(request, env, ctx) {
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

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;
  const cacheKey = generateCacheKey('text', params);
  const FRESH = CONFIG.CACHE_TTL.TEXT_SEARCH;
  const SWR = CONFIG.CACHE_TTL.TEXT_SEARCH_SWR;

  const fetchAndCache = async () => {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CONFIG.SEARCH_FIELD_MASK + ',' + TEXT_SEARCH_AI_FIELDS
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
      const err = new Error(errorText);
      err.upstreamStatus = response.status;
      throw err;
    }
    const data = await response.json();
    // contextualContents is a top-level array, index-aligned with places[].
    // Inject each entry onto its place so normalizePlace's existing
    // passthrough (line ~295) surfaces it on the normalized object.
    const contextualContents = data.contextualContents || [];
    const places = (data.places || []).map((p, i) => {
      p.contextualContents = contextualContents[i] || null;
      return normalizePlace(p, baseUrl, false);
    });
    await setInCache(env, cacheKey, places, FRESH + SWR);
    return places;
  };

  if (!forceRefresh) {
    const hit = await tryCacheWithSWR(env, ctx, cacheKey, FRESH, SWR, fetchAndCache);
    if (hit) {
      return jsonResponse({ places: hit.data, count: hit.data.length, cached: true, stale: hit.status === 'stale', cacheAge: hit.cacheAge });
    }
  }

  try {
    const places = await fetchAndCache();
    return jsonResponse({ places, count: places.length, cached: false, stale: false });
  } catch (error) {
    return jsonResponse({ error: 'Google Places API error', status: error.upstreamStatus, details: error.message, places: [] }, 200);
  }
}

async function handleNearbySearch(request, env, ctx) {
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

  const apiKey = env.GOOGLE_API_KEY;
  const baseUrl = url.origin;
  const FRESH = CONFIG.CACHE_TTL.NEARBY_SEARCH;
  const SWR = CONFIG.CACHE_TTL.NEARBY_SEARCH_SWR;

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

  const fetchAndCache = async () => {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Include generativeSummary (Gemini AI overview) so ThingsToDo nearby
        // results carry historical/contextual content for the "About This Place"
        // panel, same as the text-search and restaurant-search endpoints.
        // Same Pro/Enterprise SKU, no per-call cost change.
        'X-Goog-FieldMask': CONFIG.SEARCH_FIELD_MASK + ',places.generativeSummary'
      },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      const errorText = await response.text();
      const err = new Error(errorText);
      err.upstreamStatus = response.status;
      throw err;
    }
    const data = await response.json();
    const places = (data.places || []).map(p => normalizePlace(p, baseUrl, false));
    await setInCache(env, cacheKey, places, FRESH + SWR);
    return places;
  };

  if (!forceRefresh) {
    const hit = await tryCacheWithSWR(env, ctx, cacheKey, FRESH, SWR, fetchAndCache);
    if (hit) {
      return jsonResponse({ places: hit.data, count: hit.data.length, cached: true, stale: hit.status === 'stale', cacheAge: hit.cacheAge });
    }
  }

  try {
    const places = await fetchAndCache();
    return jsonResponse({ places, count: places.length, cached: false, stale: false });
  } catch (error) {
    return jsonResponse({ error: 'Google Places API error', status: error.upstreamStatus, details: error.message, places: [] }, 200);
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

async function handleRestaurantSearch(request, env, ctx) {
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
    const FRESH = CONFIG.CACHE_TTL.TEXT_SEARCH;
    const SWR = CONFIG.CACHE_TTL.TEXT_SEARCH_SWR;

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

    const fetchAndCache = async () => {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          // POST / is the main search endpoint the Base44 orchestration layer
          // calls. Include the AI fields here (same as handleTextSearch above)
          // so generativeSummary + contextualContents flow on every search,
          // not just the fallback path.
          'X-Goog-FieldMask': CONFIG.SEARCH_FIELD_MASK + ',' + TEXT_SEARCH_AI_FIELDS
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(errorText);
        err.upstreamStatus = response.status;
        throw err;
      }
      const data = await response.json();
      // contextualContents is a top-level array, index-aligned with places[].
      // Inject each entry onto its place so normalizePlace's existing
      // passthrough surfaces it on the normalized object.
      const contextualContents = data.contextualContents || [];
      const restaurants = (data.places || []).map((p, i) => {
        p.contextualContents = contextualContents[i] || null;
        const normalized = normalizePlace(p, baseUrl, false);
        return { ...normalized, customer_favorites: [], top_reviews: [], needsDetailsFetch: true };
      });
      await setInCache(env, cacheKey, restaurants, FRESH + SWR);
      return restaurants;
    };

    if (!forceRefresh) {
      const hit = await tryCacheWithSWR(env, ctx, cacheKey, FRESH, SWR, fetchAndCache);
      if (hit) {
        return jsonResponse({ restaurants: hit.data, places: hit.data, count: hit.data.length, cached: true, stale: hit.status === 'stale', cacheAge: hit.cacheAge });
      }
    }

    const restaurants = await fetchAndCache();
    return jsonResponse({ restaurants, places: restaurants, count: restaurants.length, cached: false, stale: false, note: 'Reviews available via /places/details/{id}' });
  } catch (error) {
    return jsonResponse({ error: error.message, restaurants: [], places: [] }, 200);
  }
}

// ── P3 — /log-event endpoint (Phase 2 analytics scaffold) ─────────────────
// Accepts POST body { event_type, page, payload?, session_id?, user_id?,
// ua_summary? } and inserts a row into the D1 events table.
//
// Until the D1 binding is provisioned (wrangler d1 create + uncomment
// wrangler.toml block + run analytics-schema.sql), this endpoint NO-OPs
// gracefully: returns 200 { logged: false, reason: 'no_db_binding' } so
// the frontend can fire events without crashing.
//
// Once the binding is live, env.DB will be defined and the endpoint will
// actually persist rows. ts is server-issued (don't trust client clocks).
async function handleLogEvent(request, env) {
  try {
    const body = await request.json();
    if (!body?.event_type) {
      return jsonResponse({ logged: false, reason: 'missing_event_type' }, 400);
    }
    if (!env.DB) {
      // D1 not bound yet — graceful no-op so the frontend can ship events
      // before the analytics DB is provisioned.
      return jsonResponse({ logged: false, reason: 'no_db_binding' });
    }
    const ts = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO events (ts, user_id, session_id, event_type, page, payload, ua_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      ts,
      body.user_id || null,
      body.session_id || 'anon',
      body.event_type,
      body.page || null,
      body.payload ? JSON.stringify(body.payload) : null,
      body.ua_summary || null,
    ).run();
    return jsonResponse({ logged: true, ts });
  } catch (e) {
    return jsonResponse({ logged: false, error: e.message }, 500);
  }
}

// ── Analytics query endpoint — read-only allowlisted SELECTs against D1 ───
// Browser sends { type: 'page_views_7d' | 'top_zero_results' | ... }, NOT
// raw SQL. Each type maps to a hardcoded prepared statement. This is the
// only safe way to expose D1 reads to the frontend.
//
// Auth: this endpoint relies on the calling Deno function (getAnalytics)
// having already verified the admin email. The Worker itself doesn't do
// auth — anyone hitting this URL directly will get analytics data, which
// is acceptable for now (the data is aggregate, no PII), but if that
// changes we'd add a shared-secret header check here.
const ANALYTICS_QUERIES = {
  // Total events + unique sessions in the last 7 days
  totals_7d: `
    SELECT
      COUNT(*) AS total_events,
      COUNT(DISTINCT session_id) AS unique_sessions
    FROM events
    WHERE ts >= strftime('%s','now','-7 days')
  `,
  // Page view counts per page, last 7 days
  page_views_7d: `
    SELECT page, COUNT(*) AS views
    FROM events
    WHERE event_type = 'page_view' AND ts >= strftime('%s','now','-7 days')
    GROUP BY page
    ORDER BY views DESC
  `,
  // Event type breakdown, last 7 days
  event_type_breakdown_7d: `
    SELECT event_type, COUNT(*) AS count
    FROM events
    WHERE ts >= strftime('%s','now','-7 days')
    GROUP BY event_type
    ORDER BY count DESC
  `,
  // Top 20 queries that returned zero results — the most actionable analytic
  top_zero_results: `
    SELECT
      json_extract(payload, '$.query') AS query,
      json_extract(payload, '$.cuisine') AS cuisine,
      COUNT(*) AS hits
    FROM events
    WHERE event_type = 'search_zero_results'
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY query, cuisine
    ORDER BY hits DESC
    LIMIT 20
  `,
  // Top successful search queries, last 7 days
  top_searches_7d: `
    SELECT
      json_extract(payload, '$.query') AS query,
      COUNT(*) AS hits,
      AVG(CAST(json_extract(payload, '$.resultCount') AS INTEGER)) AS avg_results
    FROM events
    WHERE event_type = 'search'
      AND ts >= strftime('%s','now','-7 days')
      AND json_extract(payload, '$.query') IS NOT NULL
    GROUP BY query
    ORDER BY hits DESC
    LIMIT 20
  `,
  // Events per day for the last 14 days (sparkline data)
  events_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS count
    FROM events
    WHERE ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  // Dish gallery searches by query
  dish_gallery_searches: `
    SELECT
      json_extract(payload, '$.query') AS query,
      COUNT(*) AS searches,
      AVG(CAST(json_extract(payload, '$.photoCount') AS INTEGER)) AS avg_photos
    FROM events
    WHERE event_type = 'dish_gallery_search'
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY query
    ORDER BY searches DESC
    LIMIT 20
  `,
  // Most recent 50 events (raw feed for debugging)
  recent_events: `
    SELECT ts, page, event_type, payload, session_id
    FROM events
    ORDER BY ts DESC
    LIMIT 50
  `,
  // AI Details opens per day across all users (14-day sparkline)
  ai_details_opens_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS opens
    FROM events
    WHERE event_type = 'ai_details_opened'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  // Per-session: how many distinct restaurants did each user open AI
  // Details for, plus their total opens. Top 20 sessions in last 7 days.
  // Each session_id ≈ one user visit (per-browser-tab, sessionStorage).
  ai_details_per_session_7d: `
    SELECT
      session_id,
      COUNT(DISTINCT json_extract(payload, '$.placeId')) AS distinct_places_opened,
      COUNT(*) AS total_opens
    FROM events
    WHERE event_type = 'ai_details_opened'
      AND ts >= strftime('%s','now','-7 days')
      AND json_extract(payload, '$.placeId') IS NOT NULL
    GROUP BY session_id
    ORDER BY distinct_places_opened DESC
    LIMIT 20
  `,
  // PAID AI Details fetches per day (cache MISS only). Each row = $0.025
  // of Claude+Place-Details spend. Total cost = COUNT × $0.025.
  ai_details_paid_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS paid_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.cache') != 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  // FREE AI Details fetches per day (cache HIT). Each one is value
  // delivered at $0 cost — the cache earning its keep.
  ai_details_free_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS free_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.cache') = 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  // Per-session breakdown of paid vs cached. Top 20 sessions by paid
  // count — these are the most expensive users for the AI Details
  // feature. Useful for understanding which user behavior drives cost.
  ai_details_cost_per_session_7d: `
    SELECT
      session_id,
      SUM(CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN 1 ELSE 0 END) AS paid_opens,
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS free_opens,
      COUNT(DISTINCT CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN json_extract(payload, '$.placeId') END) AS distinct_paid_places,
      COUNT(DISTINCT CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN json_extract(payload, '$.placeId') END) AS distinct_free_places
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND ts >= strftime('%s','now','-7 days')
    GROUP BY session_id
    ORDER BY paid_opens DESC
    LIMIT 20
  `,
  // Cache hit rate over last 7 days — % of fetches served from cache
  // (no Google or Claude call needed). Single-row summary metric.
  ai_details_cache_rate_7d: `
    SELECT
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN 1 ELSE 0 END) AS misses,
      COUNT(*) AS total_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND ts >= strftime('%s','now','-7 days')
  `,
};

async function handleAnalyticsQuery(request, env) {
  try {
    if (!env.DB) {
      return jsonResponse({ error: 'D1 not bound', results: [] }, 503);
    }
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    if (!type) {
      return jsonResponse({
        error: 'type param required',
        available: Object.keys(ANALYTICS_QUERIES),
      }, 400);
    }
    const sql = ANALYTICS_QUERIES[type];
    if (!sql) {
      return jsonResponse({
        error: `unknown query type: ${type}`,
        available: Object.keys(ANALYTICS_QUERIES),
      }, 400);
    }
    const { results } = await env.DB.prepare(sql).all();
    return jsonResponse({ type, results: results || [] });
  } catch (e) {
    return jsonResponse({ error: e.message, results: [] }, 500);
  }
}

async function handleCacheStats(request, env) {
  return jsonResponse({
    status: 'ok',
    version: '7.12-optimized',
    kvBound: !!env.GLOBESKIMMERS_KV,
    costOptimization: { search: 'Advanced tier ($5/1K)', details: 'Preferred tier ($20/1K) - cached 90 days' },
    cacheTTLs: {
      textSearch: '12 hours fresh + 12 hours SWR (24 hours total)',
      nearbySearch: '3 days fresh + 4 days SWR (7 days total)',
      dietary: '12 hours',
      details: '90 days',
      photo: '90 days'
    },
    timestamp: new Date().toISOString()
  });
}

// ============================================================================
// PHOTO LABELER + MENU OCR — Haiku 4.5 vision, 180-day KV cache
// Powers dish-first photo ordering on PlacesToEat AND Tier 4 "Serves It"
// detection. One Haiku call per photo: classifies as exterior/interior/menu/
// dish, and for menu photos also extracts the visible dish list.
// ============================================================================

const PHOTO_LABEL_TTL_SECONDS = 180 * 24 * 60 * 60;  // 6 months

const PHOTO_LABEL_PROMPT = `Classify the photo and extract menu items if it is a menu.

Return STRICT JSON, no markdown, no prose:
{
  "label": "exterior" | "interior" | "menu" | "dish:<short name>" | "other",
  "dishes": [ "<dish 1>", "<dish 2>", ... ]
}

Rules:
- "label":
  - "exterior" — building exterior, signage, storefront, parking
  - "interior" — dining room, seating area, counter, bar
  - "menu" — printed menu board, paper menu, sandwich board with dishes
  - "dish:<name>" — close-up of a specific food/drink. Replace <name> with the dish (e.g., "dish:pancakes", "dish:pizza", "dish:ramen", "dish:burger", "dish:salad", "dish:latte"). One short dish name only.
  - "other" — staff, customers, abstract, unclear
- "dishes":
  - Empty array unless "label" is "menu"
  - For menu photos: list each visible dish name (just the name, no price), lowercase, deduped
  - Examples: ["pancakes", "french toast", "bacon and eggs", "avocado toast"]
  - If unreadable, return []

Output JSON only.`;

async function handleLabelPhotos(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured', labels: {}, dishes: [] }, 500);
  }
  let body;
  try { body = await request.json(); } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body', labels: {}, dishes: [] }, 400);
  }
  if (!body?.placeId || !Array.isArray(body.photos)) {
    return jsonResponse({ error: 'placeId + photos[] required', labels: {}, dishes: [] }, 400);
  }

  // Cache key includes version so format changes invalidate cleanly.
  const cacheKey = `place:${body.placeId}:photo_labels_v2`;
  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(cacheKey, { type: 'json' }).catch(() => null);
    if (cached) {
      return jsonResponse({ labels: cached.labels || {}, dishes: cached.dishes || [], _cache: 'hit' });
    }
  }

  // Fetch image → base64 → Haiku 4.5 vision per photo, in parallel.
  const labelOne = async (photo) => {
    const photoName = photo?.name || photo;
    if (!photoName || typeof photoName !== 'string') return [photoName, null];
    try {
      const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${env.GOOGLE_API_KEY}&maxWidthPx=400`;
      const imgRes = await fetch(photoUrl);
      if (!imgRes.ok) return [photoName, null];
      const buf = await imgRes.arrayBuffer();
      // Convert to base64 in chunks to avoid call-stack overflow on large images.
      const bytes = new Uint8Array(buf);
      let binary = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);

      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: PHOTO_LABEL_PROMPT,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
              { type: 'text', text: 'Classify this photo.' }
            ]
          }]
        })
      });
      if (!apiRes.ok) return [photoName, null];
      const data = await apiRes.json();
      const raw = data?.content?.[0]?.text?.trim() || '';
      // Strip any accidental markdown fences before parsing.
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        return [photoName, parsed];
      } catch (_e) {
        return [photoName, null];
      }
    } catch (_e) {
      return [photoName, null];
    }
  };

  const results = await Promise.all((body.photos || []).slice(0, 10).map(labelOne));

  // Roll up: labels map (per-photo) + global dishes list (deduped across all menu photos).
  const labels = {};
  const dishSet = new Set();
  for (const [photoName, parsed] of results) {
    if (!photoName) continue;
    const label = (parsed?.label || 'unknown').toString().toLowerCase();
    labels[photoName] = label;
    if (Array.isArray(parsed?.dishes)) {
      for (const d of parsed.dishes) {
        if (typeof d === 'string' && d.trim()) dishSet.add(d.trim().toLowerCase());
      }
    }
  }
  const dishes = Array.from(dishSet);

  // Cache 180 days.
  if (env.GLOBESKIMMERS_KV) {
    await env.GLOBESKIMMERS_KV.put(
      cacheKey,
      JSON.stringify({ labels, dishes }),
      { expirationTtl: PHOTO_LABEL_TTL_SECONDS }
    ).catch(() => {});
  }
  return jsonResponse({ labels, dishes, _cache: 'miss' });
}

// ============================================================================
// AI DETAILS — Haiku 4.5 synthesizes a structured "AI Details" panel from
// the place's reviews + metadata. Used across PlacesToEat, CoffeeFinder,
// (future) ThingsToDo, (future) RestroomFinder.
//
// Voice rules (POSITIVE-ONLY policy, enforced in prompt):
// - Do NOT write anything that would deter a customer from trying the place.
// - Do NOT cite specific complaints from reviewers. Omit negatives entirely.
// - DO mention factual planning info (busy hours, customer favorites,
//   best time, what to order, language tips, payment notes).
// - Always lead with what people love.
//
// GS Verdict scoring (stars, replaces old 1-10 number):
// - restaurant/coffee: gsStars 1-5 (minimum 1, even for mixed reviews).
//   gsRedFlag always false.
// - attraction: gsStars 1-5. gsRedFlag=true ONLY if reviews flag genuine
//   safety concerns (renders as red flag instead of stars).
// - restroom: gsStars 0-5 (0 if consistently dirty/smelly). gsRedFlag=true
//   if safety concerns. Restroom-specific fields favor toilet paper,
//   soap, paid/free, squat/sit, etc.
//
// Cache key includes prompt version (v2) + kind so a prompt or schema
// change invalidates cleanly and different kinds get separate cache lines.
// ============================================================================

const AI_DETAILS_TTL_SECONDS = 30 * 24 * 60 * 60;  // 30 days

const AI_DETAILS_PROMPT_VERSION = 'v2';

function buildAIDetailsSystemPrompt(kind) {
  const safeKind = ['restaurant', 'coffee', 'attraction', 'restroom'].includes(kind) ? kind : 'restaurant';

  const isFood = safeKind === 'restaurant' || safeKind === 'coffee';
  const isAttraction = safeKind === 'attraction';
  const isRestroom = safeKind === 'restroom';

  const starRules = isFood
    ? `- gsStars MUST be an integer 1-5. NEVER 0. Even places with mixed reviews get at least 1 star — every business gets the benefit of the doubt.
- gsRedFlag MUST be false.`
    : isAttraction
      ? `- gsStars MUST be an integer 1-5 (minimum 1).
- gsRedFlag = true ONLY if multiple reviews flag a GENUINE worldwide safety concern (e.g. crime in area, unsafe structures, recent incidents). Otherwise false.`
      : isRestroom
        ? `- gsStars MUST be an integer 0-5. Set gsStars = 0 ONLY if multiple recent reviews say the restroom is consistently dirty or smelly. Otherwise 1-5.
- gsRedFlag = true if reviews flag safety concerns (unsafe area, unsanitary risk, etc.). Otherwise false.`
        : '- gsStars 1-5, gsRedFlag false.';

  const kindFieldGuidance = isFood
    ? `- bestDish: the signature dish/drink. context cites why people love it.
- alsoRecommended: up to 4 other popular items.
- crowd: who eats here.
- bestTime: recommended time + factual note on busy hours (e.g. "Weekday lunch is calmer; weekend dinner is the busiest stretch").
- vibe: atmosphere (casual, group-friendly, romantic, etc.).
- value: price range + value framing (positive only).
- goodToKnow: positive/neutral factual tips (parking, language, payment, reservation tips). NOT complaints.
- travelerNotes: practical tips for travelers (best dish to try first, ordering, language).`
    : isAttraction
      ? `- bestDish = null. alsoRecommended = list up to 4 must-see/must-do items.
- crowd: who visits (families, photographers, history fans, etc.).
- bestTime: recommended time + factual busy-hour note.
- vibe: atmosphere of the attraction.
- value: admission price + value framing (positive only).
- goodToKnow: positive/neutral factual tips (what to bring, photo spots, accessibility, language).
- travelerNotes: practical traveler tips to make the visit better.`
      : isRestroom
        ? `- bestDish = null. alsoRecommended = [].
- crowd = null (typically not relevant).
- bestTime: best time to use it (less busy windows).
- vibe: cleanliness, comfort level (only describe positively or neutrally; if dirty, use gsStars=0 instead of writing it negatively).
- value: paid vs free (e.g. "Free to use" or "Small fee, around X").
- goodToKnow: presence of toilet paper, soap, hand dryer, squat vs sit toilet, accessibility, anything cool/unique.
- travelerNotes: practical tips (carry tissue, bring small change, etc.).`
        : '';

  return `You are GlobeSkimmers' AI Details engine. Generate practical, helpful insights for a traveler about to visit a place.

KIND: ${safeKind}

VOICE RULES (ABSOLUTE — these are inviolable):
- DO NOT write ANYTHING that would deter a customer from trying the business. The app shows these notes publicly; negative content creates legal/reputational risk.
- FORBIDDEN words/phrases: "inconsistent", "complaints", "issues", "concerns", "problems", "poor", "rude", "disappointed", "frustrating", "unreliable", "complained", "service issues", "quality concerns", "questionable", "lacking", "subpar", "stay away", "avoid", "skip", "don't go".
- DO NOT cite specific reviewer complaints. If reviewers said something negative, OMIT it entirely. Do not paraphrase a complaint as a "factual note".
- DO mention factual planning info that helps the visit go better: busy hours (framed neutrally as "weekend dinner is the busiest window" not "long waits"), customer favorites, best time to visit, what to order, language tips, payment methods, parking notes (positive framing only).
- ALWAYS lead with what people love.
- If there is genuinely nothing positive to say about a field, set that field to null. Do NOT invent positives. Do NOT fall back to a complaint.
- The goal: help travelers have a great visit AND protect the business from lost customers due to public negative content.

PER-KIND FIELDS:
${kindFieldGuidance}

GS VERDICT SCORING:
${starRules}
- gsVerdict: one short positive/neutral summary line. NO negative wording. Examples for high score: "Locals' choice for authentic sisig". Examples for mixed-review minimum score (restaurants/coffee always ≥1 star): "Casual neighborhood spot worth checking out".

OUTPUT JSON ONLY (no markdown fences, no prose outside the JSON):
{
  "bestDish": { "name": "<name>", "context": "<one positive line>" } | null,
  "alsoRecommended": ["<item 1>", ...] (up to 4 strings, can be empty),
  "crowd": "<one short sentence>" | null,
  "bestTime": "<recommended time + factual busy-window note>" | null,
  "vibe": "<one short sentence>" | null,
  "value": "<one short sentence with price range if known>" | null,
  "goodToKnow": ["<positive/neutral fact 1>", ...] (up to 3 strings, can be empty),
  "travelerNotes": "<practical tip>" | null,
  "gsStars": <integer per per-kind rules above>,
  "gsRedFlag": <boolean per per-kind rules above>,
  "gsVerdict": "<one short positive/neutral summary, NO negative wording>"
}

If a field has no positive content to draw from, set it to null/empty. Do NOT fabricate.

Return JSON only.`;
}

async function handleAIDetails(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  let body;
  try { body = await request.json(); } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const placeId = body?.placeId;
  if (!placeId) {
    return jsonResponse({ error: 'placeId required' }, 400);
  }
  // Kind drives the voice rules and star-scoring scheme. Allowlist + default
  // to 'restaurant' so old callers (no kind param) still work.
  const allowedKinds = ['restaurant', 'coffee', 'attraction', 'restroom'];
  const kind = allowedKinds.includes(body?.kind) ? body.kind : 'restaurant';

  // 1) Check AI Details cache (30-day TTL). Key includes prompt version
  //    (so prompt changes invalidate cleanly) and kind (so a place opened
  //    from PlacesToEat vs RestroomFinder gets separate cached outputs
  //    with kind-appropriate voice and star scheme).
  const aiCacheKey = `place:${placeId}:ai_details_${AI_DETAILS_PROMPT_VERSION}:${kind}`;
  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(aiCacheKey, { type: 'json' }).catch(() => null);
    if (cached) {
      return jsonResponse({ aiDetails: cached, _cache: 'hit' });
    }
  }

  // 2) Load Place Details — prefer the existing details_{placeId} cache (90d)
  //    so a popular place doesn't pay the $0.02 Google call here again.
  const detailsCacheKey = `details_${placeId}`;
  let place;
  const cachedDetails = await getFromCache(env, detailsCacheKey);
  if (cachedDetails && cachedDetails.data) {
    place = cachedDetails.data;
  } else {
    // Fresh fetch from Google. Cache the normalized result for 90 days
    // so any later handlePlaceDetails call benefits too.
    try {
      const apiKey = env.GOOGLE_API_KEY;
      const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': CONFIG.DETAILS_FIELD_MASK
        }
      });
      if (!detailsRes.ok) {
        return jsonResponse({ error: 'Place details fetch failed', status: detailsRes.status }, 502);
      }
      const raw = await detailsRes.json();
      place = normalizePlace(raw, new URL(request.url).origin, true);
      await setInCache(env, detailsCacheKey, place, CONFIG.CACHE_TTL.DETAILS);
    } catch (e) {
      return jsonResponse({ error: 'Place details error: ' + e.message }, 502);
    }
  }

  // 3) Build Claude input — reviews + key metadata only
  const reviewSnippets = (place.reviews || []).slice(0, 5).map(r => ({
    text: r.text || '',
    rating: r.rating,
    when: r.time || '',
  })).filter(r => r.text);

  const placeMeta = {
    name: place.name || place.displayName?.text,
    address: place.address || place.formattedAddress,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    priceLevel: place.priceLevel,
    primaryType: place.primaryTypeDisplay || place.primaryType,
    editorialSummary: place.editorialSummary,
    websiteUri: place.websiteUri,
  };

  if (reviewSnippets.length === 0 && !placeMeta.editorialSummary) {
    // Nothing to synthesize from. Return a minimal stub. Stars default to
    // 1 for restaurant/coffee/attraction (minimum allowed), 1 for restroom
    // (we don't know if it's dirty without reviews, so give benefit of doubt).
    const stub = {
      bestDish: null,
      alsoRecommended: [],
      crowd: null,
      bestTime: null,
      vibe: null,
      value: null,
      goodToKnow: [],
      travelerNotes: null,
      gsStars: 1,
      gsRedFlag: false,
      gsVerdict: 'Not enough review data yet — check back as more visitors share their experience.',
      websiteUri: placeMeta.websiteUri || null,
      placeName: placeMeta.name || null,
    };
    if (env.GLOBESKIMMERS_KV) {
      await env.GLOBESKIMMERS_KV.put(aiCacheKey, JSON.stringify(stub), { expirationTtl: AI_DETAILS_TTL_SECONDS }).catch(() => {});
    }
    return jsonResponse({ aiDetails: stub, _cache: 'miss-stub' });
  }

  const userContent = `PLACE METADATA:\n${JSON.stringify(placeMeta, null, 2)}\n\nREVIEW SNIPPETS (up to 5 from Google):\n${JSON.stringify(reviewSnippets, null, 2)}\n\nGenerate the AI Details JSON per the voice rules above.`;

  // 4) Call Claude Haiku 4.5
  let aiDetails;
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        // Lowered 1500 -> 800. Caps generation time (Haiku ~80 tok/sec, so
        // 1500 tokens could be 18s output alone). The AI Details fields
        // are short and structured; 800 is plenty. Most cards average
        // ~400-500 output tokens in practice.
        max_tokens: 800,
        system: buildAIDetailsSystemPrompt(kind),
        messages: [{ role: 'user', content: userContent }]
      })
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return jsonResponse({ error: 'Claude API error', status: apiRes.status, details: errText }, 502);
    }
    const data = await apiRes.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    aiDetails = JSON.parse(cleaned);
    aiDetails.websiteUri = placeMeta.websiteUri || null;
    aiDetails.placeName = placeMeta.name || null;

    // Defensive clamping — enforce per-kind star rules even if Claude slips.
    // Restaurants/coffee: 1-5 minimum. Restroom: 0-5. Attraction: 1-5.
    // Red flag only allowed for restroom + attraction.
    let stars = parseInt(aiDetails.gsStars, 10);
    if (isNaN(stars)) stars = 1;
    if (stars > 5) stars = 5;
    if (kind === 'restroom') {
      if (stars < 0) stars = 0;
    } else {
      if (stars < 1) stars = 1;
    }
    aiDetails.gsStars = stars;
    const redFlagAllowed = (kind === 'restroom' || kind === 'attraction');
    aiDetails.gsRedFlag = redFlagAllowed ? !!aiDetails.gsRedFlag : false;
  } catch (e) {
    return jsonResponse({ error: 'Claude parse error: ' + e.message }, 500);
  }

  // 5) Cache the AI Details JSON for 30 days
  if (env.GLOBESKIMMERS_KV) {
    await env.GLOBESKIMMERS_KV.put(
      aiCacheKey,
      JSON.stringify(aiDetails),
      { expirationTtl: AI_DETAILS_TTL_SECONDS }
    ).catch(() => {});
  }

  return jsonResponse({ aiDetails, _cache: 'miss' });
}

// ============================================================================
// NAME LANGUAGE HELP — Haiku 4.5 returns { romanization, translation } for
// any place name. Used by the <NameLanguageHelp> frontend component which
// renders "🔤 Pronounce" + "🌐 Translate" buttons under business names that
// aren't plain English. Single call returns both so user can tap either
// without a second round trip.
//
// Cached 90 days per placeId — names rarely change. ~$0.0002 per fresh call.
// ============================================================================

const NAME_INFO_TTL_SECONDS = 90 * 24 * 60 * 60;  // 90 days
const NAME_INFO_PROMPT_VERSION = 'v2';  // bumped from v1 to invalidate cache when `lang` field was added

const NAME_INFO_SYSTEM_PROMPT = `You translate and romanize business names for English-speaking travelers, and tag the language so the device can pronounce the name in the local voice.

Given a business name, return STRICT JSON with three fields:
{
  "romanization": "<how to pronounce the name written in Latin alphabet, or null if the original is already pure Latin alphabet>",
  "translation": "<what the name means in English, or null if it's already a recognizable English phrase / English person's name>",
  "lang": "<BCP-47 language code of the original name, e.g. 'ja-JP', 'zh-CN', 'ko-KR', 'ar-SA', 'it-IT', 'fr-FR', 'es-MX', 'en-US'. Used by the browser's Text-to-Speech engine to select the right local voice.>"
}

EXAMPLES:
Input: "寿司"
Output: {"romanization": "Sushi", "translation": "Sushi", "lang": "ja-JP"}

Input: "イマーシブ脱出ゲーム（横浜店）"
Output: {"romanization": "Imāshibu Dasshutsu Gēmu (Yokohama-ten)", "translation": "Immersive Escape Game (Yokohama Branch)", "lang": "ja-JP"}

Input: "Trattoria della Nonna"
Output: {"romanization": null, "translation": "Grandmother's Trattoria", "lang": "it-IT"}

Input: "Joe's Pizza"
Output: {"romanization": null, "translation": null, "lang": "en-US"}

Input: "मसाला हाउस"
Output: {"romanization": "Masala House", "translation": "Spice House", "lang": "hi-IN"}

Input: "Café du Monde"
Output: {"romanization": null, "translation": "Café of the World", "lang": "fr-FR"}

Input: "北京烤鸭店"
Output: {"romanization": "Běijīng Kǎoyā Diàn", "translation": "Beijing Roast Duck Restaurant", "lang": "zh-CN"}

RULES:
- Romanization: ONLY include if the original has non-Latin characters. Use widely-accepted transliteration (Hepburn for Japanese, Pinyin for Chinese, etc.). Preserve original parentheses / punctuation structure.
- Translation: ONLY include if the meaning is non-obvious to an English speaker. Leave null for plain English names ("Joe's Pizza", "Blue Bottle Coffee").
- For partial-translation cases (e.g., "Sushi Sato"): translate only the non-English parts in context.
- Person's names: leave translation null (e.g., "Mario's", "Hiroshi Sato" don't need translation).
- Lang: ALWAYS return a BCP-47 language code (region-tagged). For Chinese, prefer 'zh-CN' for simplified, 'zh-TW' for traditional. For Spanish, infer regional variant if possible ('es-MX', 'es-ES') else 'es-419'. When uncertain, default to the most common local variant.
- Return JSON only. No markdown, no commentary.`;

async function handleNameInfo(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  let body;
  try { body = await request.json(); } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const placeId = body?.placeId;
  const name = (body?.name || '').toString().trim();
  if (!placeId || !name) {
    return jsonResponse({ error: 'placeId + name required' }, 400);
  }

  // Cache key includes prompt version so changes invalidate cleanly.
  const cacheKey = `name_info:${placeId}:${NAME_INFO_PROMPT_VERSION}`;
  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(cacheKey, { type: 'json' }).catch(() => null);
    if (cached) {
      return jsonResponse({ ...cached, _cache: 'hit' });
    }
  }

  let nameInfo;
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: NAME_INFO_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Business name: ${name}` }],
      }),
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return jsonResponse({ error: 'Claude API error', status: apiRes.status, details: errText }, 502);
    }
    const data = await apiRes.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    nameInfo = JSON.parse(cleaned);
    // Defensive normalization — guarantee keys exist as string|null.
    // `lang` is BCP-47 (e.g. 'ja-JP'). Loose regex validation so the
    // browser's speechSynthesis gets a usable code.
    const rawLang = typeof nameInfo.lang === 'string' ? nameInfo.lang.trim() : '';
    const validLang = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(rawLang) ? rawLang : null;
    nameInfo = {
      romanization: typeof nameInfo.romanization === 'string' && nameInfo.romanization.trim() ? nameInfo.romanization.trim() : null,
      translation: typeof nameInfo.translation === 'string' && nameInfo.translation.trim() ? nameInfo.translation.trim() : null,
      lang: validLang,
    };
  } catch (e) {
    return jsonResponse({ error: 'Claude parse error: ' + e.message }, 500);
  }

  if (env.GLOBESKIMMERS_KV) {
    await env.GLOBESKIMMERS_KV.put(cacheKey, JSON.stringify(nameInfo), { expirationTtl: NAME_INFO_TTL_SECONDS }).catch(() => {});
  }
  return jsonResponse({ ...nameInfo, _cache: 'miss' });
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
        if (request.method === 'POST') return await handleRestaurantSearch(request, env, ctx);
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

      if (pathname === '/places/text-search') return await handleTextSearch(request, env, ctx);
      if (pathname === '/places/nearby' || pathname === '/places/search') return await handleNearbySearch(request, env, ctx);
      if (pathname === '/log-event' && request.method === 'POST') return await handleLogEvent(request, env);
      if (pathname === '/analytics-query') return await handleAnalyticsQuery(request, env);
      if (pathname.startsWith('/places/details/')) return await handlePlaceDetails(request, env);
      if (pathname === '/places/photo') return await handlePhotoProxy(request, env);
      if (pathname === '/places/dietary') return await handleDietarySearch(request, env);
      if (pathname === '/cache/stats') return await handleCacheStats(request, env);
      if (pathname === '/places/restaurants' && request.method === 'POST') return await handleRestaurantSearch(request, env);
      if (pathname === '/places/coffee') return await handleCoffeeSearch(request, env);
      if (pathname === '/scan-prices' && request.method === 'POST') return await handlePriceScan(request, env);
      if (pathname === '/label-photos' && request.method === 'POST') return await handleLabelPhotos(request, env);
      if (pathname === '/ai-details' && request.method === 'POST') return await handleAIDetails(request, env);
      if (pathname === '/name-info' && request.method === 'POST') return await handleNameInfo(request, env);

      return jsonResponse({ error: 'Not found', path: pathname }, 404);
    } catch (error) {
      return jsonResponse({ error: error.message, stack: error.stack }, 500);
    }
  }
};
// CI test Mon May 11 06:28:51 PDT 2026
