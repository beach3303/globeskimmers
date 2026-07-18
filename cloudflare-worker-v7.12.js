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

// ── Account deletion (Apple Guideline 5.1.1(v) / Google Play) ─────────────
// Lets a signed-in user permanently delete their OWN account + data from
// inside the app. The frontend calls POST /delete-account via callWorker,
// which attaches the user's Supabase JWT as `Authorization: Bearer <jwt>`.
// Flow: (1) resolve that JWT to a user via GoTrue and delete ONLY the id the
// token resolves to (never a client-supplied id); (2) hard-delete that auth
// user with the SERVICE ROLE key. Removing the auth.users row cascades
// public.profiles + public.login_events (FK ON DELETE CASCADE).
// Requires the Worker secret SUPABASE_SERVICE_ROLE_KEY (`wrangler secret put`).
async function handleDeleteAccount(request, env) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return jsonResponse({ error: 'Not signed in' }, 401);

    const SUPABASE_URL = env.SUPABASE_URL || 'https://bkaxadiyehddzkiuheea.supabase.co';
    const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) return jsonResponse({ error: 'Server not configured for deletion' }, 500);

    // 1) Verify + resolve the caller from their JWT — the id comes from the
    //    token, so a user can only ever delete themselves.
    const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (whoRes.status !== 200) return jsonResponse({ error: 'Invalid or expired session' }, 401);
    const who = await whoRes.json();
    const userId = who?.id;
    if (!userId) return jsonResponse({ error: 'Could not identify account' }, 401);

    // 2) Hard-delete the auth user (cascades profiles + login_events).
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (delRes.status !== 200 && delRes.status !== 204) {
      const detail = await delRes.text().catch(() => '');
      return jsonResponse({ error: `Deletion failed (${delRes.status})`, detail: detail.slice(0, 300) }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: e.message || 'Deletion failed' }, 500);
  }
}

// ── Admin user stats — aggregate metrics from Supabase profiles ───────────
// User data lives in Supabase now (not Base44), so the admin dashboard reads it
// here with the SERVICE ROLE key (bypasses RLS). Gated to admin emails, verified
// from the caller's JWT. Returns ONLY aggregates (counts / distributions) — no
// per-user rows, emails, or PII ever leave the Worker.
// Keep ADMIN_EMAILS_WORKER in sync with src/lib/admins.js.
const ADMIN_EMAILS_WORKER = [
  'maizasimeon@gmail.com', 'yreolsleow@gmail.com',
  'founder@globeskimmers.io', 'simeonmaiza@gmail.com',
];

async function handleAdminUserStats(request, env) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return jsonResponse({ error: 'Not signed in' }, 401);

    const SUPABASE_URL = env.SUPABASE_URL || 'https://bkaxadiyehddzkiuheea.supabase.co';
    const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) return jsonResponse({ error: 'Server not configured' }, 500);

    // Verify the caller from their JWT, then gate to admins.
    const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (whoRes.status !== 200) return jsonResponse({ error: 'Invalid or expired session' }, 401);
    const who = await whoRes.json();
    const email = String(who?.email || '').trim().toLowerCase();
    if (!ADMIN_EMAILS_WORKER.includes(email)) return jsonResponse({ error: 'Forbidden' }, 403);

    // Read all profiles with the service key (bypasses RLS). select=* is safe —
    // PostgREST won't error on columns that don't exist.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (res.status !== 200) {
      const detail = await res.text().catch(() => '');
      return jsonResponse({ error: `profiles read failed (${res.status})`, detail: detail.slice(0, 200) }, 502);
    }
    const list = await res.json().then((r) => (Array.isArray(r) ? r : [])).catch(() => []);

    const tally = (key) => {
      const m = {};
      for (const r of list) {
        const v = r?.[key];
        if (v == null || v === '') continue;
        m[v] = (m[v] || 0) + 1;
      }
      return Object.entries(m).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    // Sign-ups per day (last 30d) if a timestamp column exists.
    const dateKey = list.some((r) => r?.created_at) ? 'created_at' : (list.some((r) => r?.inserted_at) ? 'inserted_at' : null);
    let signupsByDay = [];
    if (dateKey) {
      const m = {};
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const r of list) {
        const t = Date.parse(r[dateKey]);
        if (!Number.isFinite(t) || t < cutoff) continue;
        const day = new Date(t).toISOString().slice(0, 10);
        m[day] = (m[day] || 0) + 1;
      }
      signupsByDay = Object.entries(m).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));
    }

    return jsonResponse({
      totalUsers: list.length,
      onboardingCompleted: list.filter((r) => r?.onboarding_completed === true).length,
      byCountry: tally('home_country').slice(0, 15),
      byLanguage: tally('preferred_language').slice(0, 15),
      byCurrency: tally('preferred_currency').slice(0, 15),
      signupsByDay,
      generatedAt: Date.now(),
    });
  } catch (e) {
    return jsonResponse({ error: e.message || 'admin stats failed' }, 500);
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
  // ── ATM AI DETAILS COST SPLIT ───────────────────────────────────────────
  // Same shape as ai_details_paid/free_by_day_14d but filtered to kind='atm'.
  // Lets the dashboard show the ATM-specific cost line alongside the global
  // numbers — important because the ATM redesign drives net-new Haiku spend
  // and we want to verify the cache earns its keep on the ATM panel
  // specifically.
  atm_ai_details_paid_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS paid_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'atm'
      AND json_extract(payload, '$.cache') != 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  atm_ai_details_free_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS free_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'atm'
      AND json_extract(payload, '$.cache') = 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  // ATM-specific cache hit rate over last 7 days. Lower-than-global hit
  // rate here means the ATM cache (or its TTL) needs tuning.
  atm_ai_details_cache_rate_7d: `
    SELECT
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN 1 ELSE 0 END) AS misses,
      COUNT(*) AS total_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'atm'
      AND ts >= strftime('%s','now','-7 days')
  `,
  // ── PER-KIND AI DETAILS COST QUERIES ────────────────────────────────────
  // CONVENTION (for any future AI Details surface — restaurant, coffee,
  // attraction, restroom, atm, and anything we add later): every kind
  // gets its own paid_by_day_14d / free_by_day_14d / cache_rate_7d trio
  // so the dashboard can isolate that surface's Haiku spend and cache
  // health.
  //
  // The events these queries read are already emitted by every AI Details
  // renderer in the app (AIDetailsSection.jsx, AttractionAIDetails.jsx,
  // AtmAIDetails.jsx) with a `kind` payload field. If you add a new AI
  // Details surface (e.g. ShoppingFinder → kind='shopping'), copy the
  // three queries below for the new kind and add them to this block.
  //
  // Schemas:
  //   {kind}_ai_details_paid_by_day_14d  → daily cache MISSES (each row
  //     costs ~$0.025 Claude+Place-Details spend).
  //   {kind}_ai_details_free_by_day_14d  → daily cache HITS (each row is
  //     value delivered at $0 cost).
  //   {kind}_ai_details_cache_rate_7d    → 7-day hits/misses/total roll-up.
  attraction_ai_details_paid_by_day_14d: `
    SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS paid_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'attraction'
      AND json_extract(payload, '$.cache') != 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day ORDER BY day ASC
  `,
  attraction_ai_details_free_by_day_14d: `
    SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS free_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'attraction'
      AND json_extract(payload, '$.cache') = 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day ORDER BY day ASC
  `,
  attraction_ai_details_cache_rate_7d: `
    SELECT
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN 1 ELSE 0 END) AS misses,
      COUNT(*) AS total_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'attraction'
      AND ts >= strftime('%s','now','-7 days')
  `,
  restaurant_ai_details_paid_by_day_14d: `
    SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS paid_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'restaurant'
      AND json_extract(payload, '$.cache') != 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day ORDER BY day ASC
  `,
  restaurant_ai_details_free_by_day_14d: `
    SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS free_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'restaurant'
      AND json_extract(payload, '$.cache') = 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day ORDER BY day ASC
  `,
  restaurant_ai_details_cache_rate_7d: `
    SELECT
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN 1 ELSE 0 END) AS misses,
      COUNT(*) AS total_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'restaurant'
      AND ts >= strftime('%s','now','-7 days')
  `,
  coffee_ai_details_paid_by_day_14d: `
    SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS paid_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'coffee'
      AND json_extract(payload, '$.cache') != 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day ORDER BY day ASC
  `,
  coffee_ai_details_free_by_day_14d: `
    SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS free_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'coffee'
      AND json_extract(payload, '$.cache') = 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day ORDER BY day ASC
  `,
  coffee_ai_details_cache_rate_7d: `
    SELECT
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN 1 ELSE 0 END) AS misses,
      COUNT(*) AS total_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'coffee'
      AND ts >= strftime('%s','now','-7 days')
  `,
  restroom_ai_details_paid_by_day_14d: `
    SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS paid_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'restroom'
      AND json_extract(payload, '$.cache') != 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day ORDER BY day ASC
  `,
  restroom_ai_details_free_by_day_14d: `
    SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS free_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'restroom'
      AND json_extract(payload, '$.cache') = 'hit'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day ORDER BY day ASC
  `,
  restroom_ai_details_cache_rate_7d: `
    SELECT
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN 1 ELSE 0 END) AS misses,
      COUNT(*) AS total_fetches
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND json_extract(payload, '$.kind') = 'restroom'
      AND ts >= strftime('%s','now','-7 days')
  `,
  // Per-kind cost breakdown over the last 30 days. Each row =
  // { kind, paid, free, total } so the dashboard can show every AI Details
  // line item (atm, attraction, restaurant, coffee, restroom) and their
  // share of overall Haiku spend. Sort by paid DESC so the most expensive
  // surface is on top.
  ai_details_by_kind_30d: `
    SELECT
      COALESCE(json_extract(payload, '$.kind'), 'unknown') AS kind,
      SUM(CASE WHEN json_extract(payload, '$.cache') != 'hit' THEN 1 ELSE 0 END) AS paid,
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS free,
      COUNT(*) AS total
    FROM events
    WHERE event_type = 'ai_details_fetched'
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY kind
    ORDER BY paid DESC
  `,
  // ── PRICE SCANNER ANALYTICS ─────────────────────────────────────────────
  // Each 'price_scan' event payload:
  //   { country, city, target_currency, price_count, prices: [{currency, amount, amount_usd, context}, ...] }
  // The dataset is the foundation for the monetizable "what do travelers
  // buy / where / how much" intel.
  price_scans_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS scans,
      COUNT(DISTINCT session_id) AS unique_sessions
    FROM events
    WHERE event_type = 'price_scan'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  price_scans_by_country_30d: `
    SELECT
      json_extract(payload, '$.country') AS country,
      COUNT(*) AS scans,
      COUNT(DISTINCT session_id) AS unique_sessions
    FROM events
    WHERE event_type = 'price_scan'
      AND json_extract(payload, '$.country') IS NOT NULL
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY country
    ORDER BY scans DESC
    LIMIT 30
  `,
  price_scans_by_city_30d: `
    SELECT
      json_extract(payload, '$.city') AS city,
      json_extract(payload, '$.country') AS country,
      COUNT(*) AS scans,
      COUNT(DISTINCT session_id) AS unique_sessions
    FROM events
    WHERE event_type = 'price_scan'
      AND json_extract(payload, '$.city') IS NOT NULL
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY city, country
    ORDER BY scans DESC
    LIMIT 50
  `,
  // Which source currencies are travelers most often photographing?
  // Inferred from the FIRST detected price in each scan (good-enough proxy).
  price_scans_by_currency_30d: `
    SELECT
      json_extract(payload, '$.prices[0].currency') AS currency,
      COUNT(*) AS scans
    FROM events
    WHERE event_type = 'price_scan'
      AND json_extract(payload, '$.prices[0].currency') IS NOT NULL
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY currency
    ORDER BY scans DESC
    LIMIT 30
  `,
  // What target currency are users converting INTO? (their home currency)
  price_scans_target_currency_30d: `
    SELECT
      json_extract(payload, '$.target_currency') AS target_currency,
      COUNT(*) AS scans,
      COUNT(DISTINCT session_id) AS unique_sessions
    FROM events
    WHERE event_type = 'price_scan'
      AND json_extract(payload, '$.target_currency') IS NOT NULL
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY target_currency
    ORDER BY scans DESC
  `,
  // Single-row summary: total scans, unique sessions, avg prices per scan,
  // avg USD-normalized spend per scan. Quick health-check metric.
  price_scans_summary_30d: `
    SELECT
      COUNT(*) AS total_scans,
      COUNT(DISTINCT session_id) AS unique_sessions,
      AVG(CAST(json_extract(payload, '$.price_count') AS INTEGER)) AS avg_prices_per_scan,
      AVG(CAST(json_extract(payload, '$.prices[0].amount_usd') AS REAL)) AS avg_first_price_usd
    FROM events
    WHERE event_type = 'price_scan'
      AND ts >= strftime('%s','now','-30 days')
  `,
  // Most recent 50 price scans (raw feed for debugging / spot-check).
  recent_price_scans: `
    SELECT
      ts,
      session_id,
      json_extract(payload, '$.country') AS country,
      json_extract(payload, '$.city') AS city,
      json_extract(payload, '$.target_currency') AS target_currency,
      json_extract(payload, '$.price_count') AS price_count,
      json_extract(payload, '$.prices[0].currency') AS first_currency,
      json_extract(payload, '$.prices[0].amount') AS first_amount,
      json_extract(payload, '$.prices[0].context') AS first_context
    FROM events
    WHERE event_type = 'price_scan'
    ORDER BY ts DESC
    LIMIT 50
  `,
  // ── PER-ITEM ROLLUPS (linked item x brand x location x price) ──────────
  // The queries below use json_each to UNNEST the prices[] array so each
  // detected item becomes its own analytic row. This is the core dataset
  // for "what people are buying, what brand, where, how much."
  //
  // Phase 1 only populates item.context (item name from vision).
  // Phase 2 will start populating item.brand and item.category as the
  // multi-image capture flow lands -- these queries are forward-compatible
  // and will start returning richer rows automatically once brand fills in.
  //
  // Top-scanned ITEMS across all geos -- "what travelers are pricing globally."
  price_scan_top_items_30d: `
    SELECT
      LOWER(TRIM(json_extract(item.value, '$.context'))) AS item_name,
      COUNT(*) AS sightings,
      COUNT(DISTINCT json_extract(events.payload, '$.city')) AS cities_seen_in,
      AVG(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS avg_price_usd,
      MIN(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS min_price_usd,
      MAX(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS max_price_usd
    FROM events, json_each(events.payload, '$.prices') AS item
    WHERE events.event_type = 'price_scan'
      AND json_extract(item.value, '$.context') IS NOT NULL
      AND TRIM(json_extract(item.value, '$.context')) != ''
      AND events.ts >= strftime('%s','now','-30 days')
    GROUP BY item_name
    ORDER BY sightings DESC
    LIMIT 100
  `,
  // Top-scanned BRANDS across all geos -- Phase 2 will fill this in.
  price_scan_top_brands_30d: `
    SELECT
      json_extract(item.value, '$.brand') AS brand,
      COUNT(*) AS sightings,
      COUNT(DISTINCT json_extract(events.payload, '$.city')) AS cities_seen_in,
      AVG(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS avg_price_usd
    FROM events, json_each(events.payload, '$.prices') AS item
    WHERE events.event_type = 'price_scan'
      AND json_extract(item.value, '$.brand') IS NOT NULL
      AND events.ts >= strftime('%s','now','-30 days')
    GROUP BY brand
    ORDER BY sightings DESC
    LIMIT 50
  `,
  // FULL JOIN ROLLUP: item x brand x city x country x avg price.
  // This is the saleable intel -- "Starbucks latte, Bangkok, avg THB 165
  // across 23 scans". Phase 2 brand-detection makes this complete.
  price_scan_item_brand_city_30d: `
    SELECT
      LOWER(TRIM(json_extract(item.value, '$.context'))) AS item_name,
      json_extract(item.value, '$.brand') AS brand,
      json_extract(events.payload, '$.city') AS city,
      json_extract(events.payload, '$.country') AS country,
      json_extract(item.value, '$.currency') AS local_currency,
      AVG(CAST(json_extract(item.value, '$.amount') AS REAL)) AS avg_price_local,
      AVG(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS avg_price_usd,
      COUNT(*) AS sightings
    FROM events, json_each(events.payload, '$.prices') AS item
    WHERE events.event_type = 'price_scan'
      AND json_extract(item.value, '$.context') IS NOT NULL
      AND json_extract(events.payload, '$.city') IS NOT NULL
      AND events.ts >= strftime('%s','now','-30 days')
    GROUP BY item_name, brand, city, country, local_currency
    ORDER BY sightings DESC
    LIMIT 200
  `,
  // ── PRICE SCANNER PER-SESSION / PER-DAY USAGE ──────────────────────────
  // Answers: "how many freezes per user per day"? Each row = one day. We
  // surface daily total + distinct sessions + avg/max per session so the
  // dashboard can show both engagement (sessions touching the feature) and
  // intensity (how many scans the most active users do).
  price_scans_per_session_14d: `
    SELECT
      day,
      SUM(cnt)                                                   AS total_scans,
      COUNT(*)                                                   AS distinct_sessions,
      ROUND(CAST(SUM(cnt) AS REAL) / NULLIF(COUNT(*), 0), 2)     AS avg_per_session,
      MAX(cnt)                                                   AS max_per_session
    FROM (
      SELECT
        date(ts, 'unixepoch') AS day,
        session_id,
        COUNT(*) AS cnt
      FROM events
      WHERE event_type = 'price_scan'
        AND ts >= strftime('%s','now','-14 days')
      GROUP BY day, session_id
    )
    GROUP BY day
    ORDER BY day ASC
  `,
  // ── PRICE ANALYSIS USAGE ───────────────────────────────────────────────
  // The 'price_analysis_viewed' event fires when a user taps "View price
  // analysis" on a frozen scan and the analyzePrice fetch returns. Payload:
  //   { country, currency, item_currency, cache, paid, verdict, comparisonType }
  // These queries answer:
  //   - per_day_14d        → total tapped per day across all users
  //   - per_session_14d    → daily total / distinct sessions / avg / max
  //   - verdict_dist_30d   → what % great_deal / fair / pricey / unknown
  price_analysis_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*)              AS views,
      COUNT(DISTINCT session_id) AS distinct_sessions
    FROM events
    WHERE event_type = 'price_analysis_viewed'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  price_analysis_per_session_14d: `
    SELECT
      day,
      SUM(cnt)                                                   AS total_views,
      COUNT(*)                                                   AS distinct_sessions,
      ROUND(CAST(SUM(cnt) AS REAL) / NULLIF(COUNT(*), 0), 2)     AS avg_per_session,
      MAX(cnt)                                                   AS max_per_session
    FROM (
      SELECT
        date(ts, 'unixepoch') AS day,
        session_id,
        COUNT(*) AS cnt
      FROM events
      WHERE event_type = 'price_analysis_viewed'
        AND ts >= strftime('%s','now','-14 days')
      GROUP BY day, session_id
    )
    GROUP BY day
    ORDER BY day ASC
  `,
  // Verdict distribution over the last 30 days. Tells us whether the
  // analyzer skews great_deal/fair/pricey/unknown — useful for catching
  // prompt drift (e.g. if 'unknown' creeps up to >50%, the prompt is too
  // strict / cache key is too narrow).
  price_analysis_verdict_distribution_30d: `
    SELECT
      COALESCE(json_extract(payload, '$.verdict'), 'unknown') AS verdict,
      COUNT(*) AS views,
      COUNT(DISTINCT session_id) AS distinct_sessions
    FROM events
    WHERE event_type = 'price_analysis_viewed'
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY verdict
    ORDER BY views DESC
  `,
  // ── DEAL-VERDICT BENCHMARKS (powers the user-facing "is this a good
  // deal?" answer in Phase 3) ────────────────────────────────────────────
  // The queries below answer the THREE questions a traveler is asking:
  //   1. "Is this price typical FOR THIS CITY?"  -> _item_price_by_city
  //   2. "Is this price typical FOR THIS BRAND GLOBALLY?" -> _brand_price_by_city
  //   3. "Is this price typical FOR THIS ITEM GLOBALLY?" -> _item_global_range
  //
  // Each returns min / avg / max (and sightings count for confidence). The
  // Phase 3 deal-verdict layer composes these into "Fair / Pricey /
  // Overpriced" using the user-paid amount + these distributions.

  // Q1 -- "Is this latte expensive for Bangkok?"
  // Pass ?param=latte to filter to that item across all Bangkok scans.
  // Used in the result card: "Avg local latte: THB 120-180. You paid THB 165."
  price_scan_item_price_by_city_30d: `
    SELECT
      json_extract(events.payload, '$.city') AS city,
      json_extract(events.payload, '$.country') AS country,
      json_extract(item.value, '$.currency') AS local_currency,
      COUNT(*) AS sightings,
      MIN(CAST(json_extract(item.value, '$.amount') AS REAL)) AS min_local,
      AVG(CAST(json_extract(item.value, '$.amount') AS REAL)) AS avg_local,
      MAX(CAST(json_extract(item.value, '$.amount') AS REAL)) AS max_local,
      AVG(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS avg_usd
    FROM events, json_each(events.payload, '$.prices') AS item
    WHERE events.event_type = 'price_scan'
      AND events.ts >= strftime('%s','now','-30 days')
      AND LOWER(TRIM(json_extract(item.value, '$.context'))) LIKE LOWER(TRIM(COALESCE(?, '')))
    GROUP BY city, country, local_currency
    HAVING sightings >= 2
    ORDER BY sightings DESC
    LIMIT 100
  `,
  // Q2 -- "Is this Starbucks latte expensive vs. Starbucks lattes globally?"
  // Pass ?param=starbucks. Phase 2 populates the brand field; until then
  // this returns empty. Used in the result card: "Globally fair vs. brand
  // avg $4.20. You paid $4.50."
  price_scan_brand_price_by_city_30d: `
    SELECT
      json_extract(events.payload, '$.city') AS city,
      json_extract(events.payload, '$.country') AS country,
      json_extract(item.value, '$.currency') AS local_currency,
      COUNT(*) AS sightings,
      MIN(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS min_usd,
      AVG(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS avg_usd,
      MAX(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS max_usd
    FROM events, json_each(events.payload, '$.prices') AS item
    WHERE events.event_type = 'price_scan'
      AND events.ts >= strftime('%s','now','-30 days')
      AND LOWER(TRIM(json_extract(item.value, '$.brand'))) LIKE LOWER(TRIM(COALESCE(?, '')))
    GROUP BY city, country, local_currency
    HAVING sightings >= 2
    ORDER BY avg_usd DESC
    LIMIT 100
  `,
  // Q3 -- "What's a typical latte price ANYWHERE in the world?"
  // Pass ?param=latte. Returns global min/avg/max in USD-normalized terms.
  // Used when no city-specific data yet -- still gives the user SOMETHING
  // ("globally, lattes range $1.50 -- $6 USD; you paid $4.50 -- mid range").
  price_scan_item_global_range_30d: `
    SELECT
      LOWER(TRIM(json_extract(item.value, '$.context'))) AS item_name,
      COUNT(*) AS sightings,
      COUNT(DISTINCT json_extract(events.payload, '$.city')) AS cities_seen_in,
      MIN(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS min_usd,
      AVG(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS avg_usd,
      MAX(CAST(json_extract(item.value, '$.amount_usd') AS REAL)) AS max_usd
    FROM events, json_each(events.payload, '$.prices') AS item
    WHERE events.event_type = 'price_scan'
      AND events.ts >= strftime('%s','now','-30 days')
      AND LOWER(TRIM(json_extract(item.value, '$.context'))) LIKE LOWER(TRIM(COALESCE(?, '')))
    GROUP BY item_name
    HAVING sightings >= 3
    LIMIT 10
  `,
  // ── PHASE 2 INTENT FALLBACK ANALYTICS ───────────────────────────────────
  // Track adoption + cache rate + cost of the /parse-intent LLM fallback.
  // Each 'intent_llm_fallback' event:
  //   { query, cache: 'hit'|'miss', success, dishLabel?, cuisine?, strict?,
  //     confidence?, latencyMs, error? }
  intent_llm_fallback_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS calls,
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS cache_hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'miss' THEN 1 ELSE 0 END) AS cache_misses,
      SUM(CASE WHEN json_extract(payload, '$.success') = 1 THEN 0 ELSE 1 END) AS failures
    FROM events
    WHERE event_type = 'intent_llm_fallback'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  // Cache hit rate summary -- single-row metric for the dashboard.
  // Hits = $0 cost. Misses = ~$0.0009 each.
  intent_llm_fallback_cache_rate_7d: `
    SELECT
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'miss' THEN 1 ELSE 0 END) AS misses,
      COUNT(*) AS total,
      ROUND(AVG(CAST(json_extract(payload, '$.latencyMs') AS INTEGER))) AS avg_latency_ms
    FROM events
    WHERE event_type = 'intent_llm_fallback'
      AND ts >= strftime('%s','now','-7 days')
  `,
  // Top queries that triggered the LLM fallback -- shows what dishes
  // users are searching that the keyword parser doesn't recognize.
  // Direct input for future DISH_MAP additions.
  intent_llm_fallback_top_queries_30d: `
    SELECT
      json_extract(payload, '$.query') AS query,
      COUNT(*) AS hits,
      json_extract(payload, '$.cuisine') AS llm_cuisine,
      json_extract(payload, '$.dishLabel') AS llm_dish,
      AVG(CAST(json_extract(payload, '$.confidence') AS REAL)) AS avg_confidence
    FROM events
    WHERE event_type = 'intent_llm_fallback'
      AND json_extract(payload, '$.success') = 1
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY query
    ORDER BY hits DESC
    LIMIT 50
  `,
  // Top cuisines the LLM assigned -- shows which cuisines are most often
  // missing dedicated DISH_MAP entries.
  intent_llm_fallback_top_cuisines_30d: `
    SELECT
      json_extract(payload, '$.cuisine') AS cuisine,
      COUNT(*) AS hits,
      AVG(CAST(json_extract(payload, '$.confidence') AS REAL)) AS avg_confidence
    FROM events
    WHERE event_type = 'intent_llm_fallback'
      AND json_extract(payload, '$.success') = 1
      AND json_extract(payload, '$.cuisine') IS NOT NULL
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY cuisine
    ORDER BY hits DESC
    LIMIT 30
  `,
  // Raw feed of last 50 fallback events -- spot-check what Claude returned.
  intent_llm_fallback_recent_50: `
    SELECT
      ts,
      json_extract(payload, '$.query') AS query,
      json_extract(payload, '$.cache') AS cache,
      json_extract(payload, '$.success') AS success,
      json_extract(payload, '$.dishLabel') AS dish_label,
      json_extract(payload, '$.cuisine') AS cuisine,
      json_extract(payload, '$.strict') AS strict,
      json_extract(payload, '$.confidence') AS confidence,
      json_extract(payload, '$.latencyMs') AS latency_ms,
      json_extract(payload, '$.error') AS error
    FROM events
    WHERE event_type = 'intent_llm_fallback'
    ORDER BY ts DESC
    LIMIT 50
  `,
  // ── TEXT SCANNER ANALYTICS ──────────────────────────────────────────────
  // Each 'text_scan' event payload (Worker T-P1):
  //   { cache, success, sourceLanguage, targetLanguage, textCategory,
  //     menuType, dishKeywords[], confidence, textLength, latencyMs, error? }
  // Cost basis: each cache MISS = ~$0.002 Claude call. Each cache HIT = $0.
  text_scans_by_day_14d: `
    SELECT
      date(ts, 'unixepoch') AS day,
      COUNT(*) AS calls,
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS cache_hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'miss' THEN 1 ELSE 0 END) AS cache_misses,
      SUM(CASE WHEN json_extract(payload, '$.success') = 1 THEN 0 ELSE 1 END) AS failures
    FROM events
    WHERE event_type = 'text_scan'
      AND ts >= strftime('%s','now','-14 days')
    GROUP BY day
    ORDER BY day ASC
  `,
  // What kind of text are travelers translating?
  text_scans_top_categories_30d: `
    SELECT
      json_extract(payload, '$.textCategory') AS category,
      COUNT(*) AS scans,
      ROUND(AVG(CAST(json_extract(payload, '$.confidence') AS REAL)), 2) AS avg_confidence
    FROM events
    WHERE event_type = 'text_scan'
      AND json_extract(payload, '$.success') = 1
      AND json_extract(payload, '$.textCategory') IS NOT NULL
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY category
    ORDER BY scans DESC
  `,
  // Top source languages -- what languages people encounter on trips.
  text_scans_top_source_languages_30d: `
    SELECT
      json_extract(payload, '$.sourceLanguage') AS source_language,
      COUNT(*) AS scans
    FROM events
    WHERE event_type = 'text_scan'
      AND json_extract(payload, '$.success') = 1
      AND json_extract(payload, '$.sourceLanguage') IS NOT NULL
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY source_language
    ORDER BY scans DESC
    LIMIT 25
  `,
  // Top target languages -- what languages travelers want translated INTO
  // (i.e. their native language). Heavy English skew expected.
  text_scans_top_target_languages_30d: `
    SELECT
      json_extract(payload, '$.targetLanguage') AS target_language,
      COUNT(*) AS scans
    FROM events
    WHERE event_type = 'text_scan'
      AND json_extract(payload, '$.success') = 1
      AND json_extract(payload, '$.targetLanguage') IS NOT NULL
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY target_language
    ORDER BY scans DESC
    LIMIT 25
  `,
  // Cache hit rate -- cost monitoring. Single-row summary metric.
  text_scans_cache_rate_7d: `
    SELECT
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN json_extract(payload, '$.cache') = 'miss' THEN 1 ELSE 0 END) AS misses,
      COUNT(*) AS total,
      ROUND(AVG(CAST(json_extract(payload, '$.latencyMs') AS INTEGER))) AS avg_latency_ms
    FROM events
    WHERE event_type = 'text_scan'
      AND ts >= strftime('%s','now','-7 days')
  `,
  // Top dish keywords from menu scans -- feeds the same food-intelligence
  // dataset as the Price Scanner item rollups. Uses json_each to unnest
  // the dishKeywords[] array so each dish becomes its own row.
  text_scans_top_dish_keywords_30d: `
    SELECT
      LOWER(TRIM(dish.value)) AS dish_keyword,
      COUNT(*) AS sightings,
      COUNT(DISTINCT json_extract(events.payload, '$.targetLanguage')) AS target_langs
    FROM events, json_each(events.payload, '$.dishKeywords') AS dish
    WHERE events.event_type = 'text_scan'
      AND events.ts >= strftime('%s','now','-30 days')
      AND json_extract(events.payload, '$.textCategory') = 'menu'
    GROUP BY dish_keyword
    HAVING dish_keyword != ''
    ORDER BY sightings DESC
    LIMIT 50
  `,
  // Most recent 50 text scans -- raw feed for spot-checking + debugging.
  text_scans_recent_50: `
    SELECT
      ts,
      json_extract(payload, '$.cache') AS cache,
      json_extract(payload, '$.success') AS success,
      json_extract(payload, '$.sourceLanguage') AS source_lang,
      json_extract(payload, '$.targetLanguage') AS target_lang,
      json_extract(payload, '$.textCategory') AS category,
      json_extract(payload, '$.menuType') AS menu_type,
      json_extract(payload, '$.confidence') AS confidence,
      json_extract(payload, '$.textLength') AS text_length,
      json_extract(payload, '$.latencyMs') AS latency_ms,
      json_extract(payload, '$.error') AS error
    FROM events
    WHERE event_type = 'text_scan'
    ORDER BY ts DESC
    LIMIT 50
  `,

  // ── Travel-demand data product (from engagement-row logging) ──────────────
  // demand_by_city: which cities people are active in / planning, by intent.
  demand_by_city: `
    SELECT
      json_extract(payload, '$.city') AS city,
      json_extract(payload, '$.country') AS country,
      json_extract(payload, '$.intent') AS intent,
      COUNT(*) AS views
    FROM events
    WHERE event_type = 'home_rows_view'
      AND json_extract(payload, '$.city') IS NOT NULL
      AND json_extract(payload, '$.city') != ''
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY city, country, intent
    ORDER BY views DESC
    LIMIT 100
  `,
  // trending_places: most-tapped places (what's converting) by city/category.
  trending_places: `
    SELECT
      json_extract(payload, '$.place_name') AS place,
      json_extract(payload, '$.city') AS city,
      json_extract(payload, '$.category') AS category,
      COUNT(*) AS taps
    FROM events
    WHERE event_type = 'home_row_card_tap'
      AND ts >= strftime('%s','now','-30 days')
    GROUP BY place, city, category
    ORDER BY taps DESC
    LIMIT 100
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
    // Optional ?param=... for parameterized queries (e.g. item-name filter
    // on price_scan_item_price_by_city_30d). Wraps in % for LIKE matching.
    const param = url.searchParams.get('param');
    const stmt = env.DB.prepare(sql);
    const bound = param ? stmt.bind(`%${param}%`) : stmt;
    const { results } = await bound.all();
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

const AI_DETAILS_PROMPT_VERSION = 'v8';  // v7 -> v8: added practical.tipping (service charge / cover charge / tip norms). Surfaces the #1 traveler-anxiety cluster ("money surprises") directly in the Practical row instead of relying on it accidentally landing in goodToKnow.

function buildAIDetailsSystemPrompt(kind) {
  const safeKind = ['restaurant', 'coffee', 'attraction', 'restroom', 'atm'].includes(kind) ? kind : 'restaurant';

  const isFood = safeKind === 'restaurant' || safeKind === 'coffee';
  const isAttraction = safeKind === 'attraction';
  const isRestroom = safeKind === 'restroom';
  const isATM = safeKind === 'atm';
  // Family / age-fit signals apply to restaurants, coffee shops, attractions.
  // Not relevant for restrooms or ATMs.
  const supportsAgeFit = isFood || isAttraction;

  const starRules = isFood
    ? `- gsStars MUST be an integer 1-5. NEVER 0. Even places with mixed reviews get at least 1 star — every business gets the benefit of the doubt.
- gsRedFlag MUST be false.`
    : isAttraction
      ? `- gsStars MUST be an integer 1-5 (minimum 1).
- gsRedFlag = true ONLY if multiple reviews flag a GENUINE worldwide safety concern (e.g. crime in area, unsafe structures, recent incidents). Otherwise false.`
      : isRestroom
        ? `- gsStars MUST be an integer 0-5. Set gsStars = 0 ONLY if multiple recent reviews say the restroom is consistently dirty or smelly. Otherwise 1-5.
- gsRedFlag = true if reviews flag safety concerns (unsafe area, unsanitary risk, etc.). Otherwise false.`
        : isATM
          ? `- gsStars MUST be an integer 1-5 (minimum 1, even for ATMs with mixed reviews).
- gsRedFlag = true ONLY if reviews show genuine safety concerns at this specific ATM location (e.g., past skimmer reports, multiple recent reviews mentioning unsafe area at night, robbery incidents). Otherwise false.`
          : '- gsStars 1-5, gsRedFlag false.';

  const kindFieldGuidance = isFood
    ? `- bestDish: { name, context } — signature dish/drink. name = the dish (include native script in parens if relevant). context = one short positive line (≤120 chars) — why people love it.
- alsoRecommended: TOP 4 dishes/drinks beyond bestDish that reviewers mention, as an array of { name, context } objects. Each name = just the dish; context = short reason (≤90 chars). Aim for 4 — fewer only if data is thin.
- photoWorthy: 1 short line naming any standout photo-worthy dish or drink (visually striking presentation, vibrant colors, unique vessel, frequently photographed). Include the dish name + WHY it's photo-worthy. Examples: "The rainbow milk tea — served in a clear hourglass jar with layered colors, frequently photographed", "Charcoal-black sushi roll plated on a bed of dry ice — a popular shot among visitors". NULL if no reviewer mentions visual / photo / shareable appeal.
- awards: 1 short line listing notable awards, recognitions, or critical mentions. Examples: "★ 1 Michelin star (2024)", "Bib Gourmand listed (2023)", "James Beard Foundation Award winner — Best Chef Mid-Atlantic", "Top 50 Asia Restaurants 2024 #12", "Featured in Netflix's Chef's Table". NULL if no awards/recognitions are mentioned in reviews/editorialSummary/data.
- worthIt: ONE of "worth_the_stop" | "strong_nearby_pick" | "craving_match" | "know_before_you_go" | "better_if_convenient". Pick the most accurate tier:
  - "worth_the_stop" = standout reviewers say is worth a detour (high enthusiasm, unique, destination-worthy).
  - "strong_nearby_pick" = solid, reliable choice if you're already in the area.
  - "craving_match" = good ONLY if you specifically want this cuisine / vibe / experience (niche but excellent at its thing).
  - "know_before_you_go" = decent food / experience BUT meaningful planning friction (cash-only, long waits, hard-to-find, limited hours, language barrier, etc.) that travelers should know up front.
  - "better_if_convenient" = fine everyday option, not a destination — only stop if it's already on your route.
  Default to "strong_nearby_pick" when truly unsure. NEVER "skip" or negative framing.
- practical: { payment, englishMenu, reservation, dietary, tipping } object with these factual fields (any can be null):
  - payment: short factual line about payment methods (e.g. "Cards + tap accepted; cash also OK", "Cash only — bring local currency", "Card-only, no cash"). NULL if reviews don't say.
  - englishMenu: short factual line about menu language + staff English (e.g. "Menu in English; staff speaks English", "English menu available; limited staff English", "Menu in local language only; photos help"). NULL if unclear.
  - reservation: short factual line (e.g. "Walk-in fine; weekend dinner gets busy", "Reservation recommended for dinner", "Reservations required — book ahead"). NULL if unclear.
  - dietary: short factual line covering vegetarian/vegan/gluten-free/halal/allergens IF mentioned (e.g. "Vegetarian options available; ask staff about gluten-free", "Limited vegetarian options", "Halal-certified"). NULL if no dietary info in reviews.
  - tipping: ONE short factual line about tipping norms / service charges / cover charges / hidden fees AT THIS SPECIFIC PLACE if reviews mention them, OR the COUNTRY-LEVEL tipping norm if the venue itself is silent. Examples: "10% service charge auto-added — no extra tip expected", "15–20% tip standard in the US; servers prefer cash", "No tipping culture — rounding up is appreciated but not required", "Cover charge ~€2 per person", "Service NOT included — leave 5–10% in cash". NEVER editorialize ("overpriced", "rip-off"). NULL only when both review evidence AND country norms are unknown.
- crowd: who eats here — short concrete labels (e.g. "Mostly local diners; family crowd", "Food-focused regulars more than ambiance seekers"). Avoid vague phrasing.
- bestTime: CONCRETE recommendation a traveler can act on. Don't say "weekday lunch is calmer" — say "Aim for weekday lunch around 12:30, or weekend brunch before 11 to avoid the rush". Always pair a SPECIFIC suggested window with a brief reason. Avoid vague "anytime is good" answers.
- vibe: 1 direct sentence describing atmosphere (casual, group-friendly, romantic, energetic, quiet, etc.). Avoid decorative language ("charming", "delightful"). Be concrete.
- value: traveler-friendly value language. Use words travelers actually say: "cheap", "fair for the cuisine", "expensive for what it is", "good for sharing", "small portions, order 2-3", "splurge-worthy". Always include the price tier ($/$$/$$$) AND a 1-line judgment. Examples: "Cheap ($) — generous portions, great for groups", "Fair for the cuisine ($$); order 2-3 small plates to share", "Splurge-worthy ($$$$); tasting menu runs about 2 hours".
- goodToKnow: 2-4 SHORT verified facts that change how a traveler plans the visit. ONLY include items DIRECTLY supported by the reviews or place metadata — do NOT invent or assume. Prioritize: ordering quirks (QR code, table service), kitchen-pace ("Noodles made fresh daily"), parking realities, hours quirks ("Closed Mondays", "Lunch break 3-5pm"), BYOB / corkage, dress code, payment surcharges, busy windows specific enough to act on. AVOID generic platitudes ("good food", "nice place"). If reviews don't support a fact, omit it.
- travelerNotes: practical tips for travelers (best dish to try first, ordering, language).
- whatYouSee: null (restaurant doesn't use this).
- aboutAndHistory: null (restaurant doesn't use this).`
    : isAttraction
      ? `- bestDish = null.
- alsoRecommended: TOP 3 must-see/must-do items at this attraction, as an array of { name, context } objects. name = the item (exhibit, view, ride, etc.), context = short reason (≤90 chars). Aim for 3 — fewer only if data is thin.
- photoWorthy: 1 short line naming a standout photo-worthy spot/exhibit/view at this attraction. Examples: "The cherry blossom canopy walkway at sunset — peak photo season early April", "The infinity-mirror room — most-photographed spot in the museum". NULL if no obvious photo-worthy feature is mentioned.
- awards: 1 short line listing UNESCO status, top-tourist-attraction rankings, Michelin Green Guide stars, or notable recognitions. Examples: "UNESCO World Heritage Site (1996)", "Michelin Green Guide 3-star", "TripAdvisor Travelers' Choice 2024". NULL if no recognitions are mentioned.
- worthIt: ONE of "worth_the_stop" | "strong_nearby_pick" | "craving_match" | "know_before_you_go" | "better_if_convenient". For famous landmarks / UNESCO sites default to "worth_the_stop"; for local parks default to "strong_nearby_pick". Use "know_before_you_go" if there's meaningful planning friction (timed entry, bag check restrictions, limited access). Use "craving_match" if niche-interest only (specific museum types, themed exhibits).
- practical: { payment, englishMenu, reservation, dietary } — for attractions, "payment" = ticket purchase methods, "englishMenu" = signage/audio guide language + staff English, "reservation" = timed entry / advance booking, "dietary" = null (not relevant for attractions).
- whatYouSee: 1-2 short sentences describing what is physically present at the attraction (the buildings, exhibits, sculptures, rides, displays, scenery). Be concrete: "Three immersive haunted houses, a sculpture garden, an IMAX dome, a rooftop observation deck with city views." NULL if reviews/data don't describe what's there.
- aboutAndHistory: 1-2 short sentences on the attraction's purpose / origin / brief history. Be factual and concise: "Built in 1872 as a Meiji-era symbol of modernization. Original wooden structure burned in the 1923 earthquake; current reconstruction completed 1957." NULL if data is silent.
- crowd: who visits — short concrete labels (e.g. "Families with kids; school groups on weekdays", "Photographers and history fans"). Avoid vague phrasing.
- bestTime: CONCRETE actionable recommendation. Don't say "mornings are calmer" — say "Arrive at opening (9 AM) on a weekday to avoid the crowds, or after 3 PM when tour buses leave". Pair a SPECIFIC suggested window with a brief reason.
- vibe: 1 direct sentence describing atmosphere (busy/quiet, contemplative/energetic, kid-friendly/adult-focused). Avoid decorative language.
- value: traveler-friendly admission framing. Use direct words: "free", "cheap", "fair", "pricey but worth it", "splurge-only". Include the actual admission tier and a 1-line judgment. Examples: "Free entry — fully worth a 2-hour visit", "Cheap (~$10); fair for what you see", "Pricey ($25-30); worth it if you have 3+ hours".
- goodToKnow: 2-4 SHORT verified facts that change how a traveler plans the visit. ONLY include items DIRECTLY supported by reviews/metadata. Prioritize: bag-check rules, photography restrictions, accessibility realities, kid-friendliness specifics, audio-guide availability, dress code (temples/religious sites), what to bring, hours quirks, day-of-the-week closures. AVOID generic platitudes.
- travelerNotes: practical traveler tips to make the visit better.`
      : isRestroom
        ? `- bestDish = null. alsoRecommended = [].
- worthIt = null. practical = null.
- crowd = null (typically not relevant).
- bestTime: best time to use it (less busy windows).
- vibe: cleanliness, comfort level (only describe positively or neutrally; if dirty, use gsStars=0 instead of writing it negatively).
- value: paid vs free (e.g. "Free to use" or "Small fee, around X").
- goodToKnow: presence of toilet paper, soap, hand dryer, squat vs sit toilet, accessibility, anything cool/unique.
- travelerNotes: practical tips (carry tissue, bring small change, etc.).`
        : isATM
          ? `- bestDish = null. alsoRecommended = [].
- worthIt = null. practical = null.
- crowd = null (usually not relevant for ATMs).
- bestTime: when access is best — lobby hours, drive-thru hours, when it's less busy or safer (e.g. "Lobby vestibule accessible 6 AM-11 PM. Drive-thru 24/7. Quietest before 8 AM"). Travelers care a lot about this.
- vibe: where the ATM is PHYSICALLY located — this is the most important field. Be specific: inside lobby vestibule, outside on building wall, drive-thru, behind store counter, inside 7-Eleven by the entrance, etc. Reviewers consistently mention location specifics; extract them.
- value: surcharge / fees (e.g. "Free for Chase customers. $3.50 surcharge for non-Chase cards") or "No surcharge".
- goodToKnow: practical facts — foreign card acceptance (Visa/Mastercard/Maestro/Amex), max withdrawal per transaction, currency dispensed (large bills only?), lit at night, surveillance cameras, PIN length supported, languages on screen.
- travelerNotes: practical tips for travelers — e.g. "Press 'English' before inserting card", "Accepts foreign chip cards; magstripe-only may be rejected", "Dispenses ¥10,000 notes only — bring smaller bills elsewhere".`
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
- gsVerdict: 1-2 short sentences matching the chosen worthIt tier. CAN fold in atmosphere-fit caveats using the EXACT pattern "Best if you ... Not ideal for [atmosphere/occasion mismatch]." Atmosphere caveats are allowed; quality complaints are NOT (same FORBIDDEN word list applies). Examples:
  - worth_the_stop: "Locals' choice for authentic sisig — destination-worthy for Filipino BBQ fans."
  - strong_nearby_pick: "Reliable Shanghainese spot for a casual lunch or dinner."
  - craving_match: "Best if you are specifically craving soup dumplings or casual Shanghainese comfort food. Not ideal for late-night dining, fancy ambiance, or a rushed meal."
  - know_before_you_go: "Excellent ramen worth the trip — bring cash and expect a 30-minute weekend wait."
  - better_if_convenient: "Decent coffee stop if you are already in the neighborhood."
  The "Not ideal for ..." clause MUST describe atmosphere/occasion mismatch only (never quality). Keep the whole verdict under 200 chars.

OUTPUT JSON ONLY (no markdown fences, no prose outside the JSON):
{
  "bestDish": { "name": "<name>", "context": "<one short positive line, ≤120 chars>" } | null,
  "alsoRecommended": [
    { "name": "<dish/item name>", "context": "<short reason, ≤90 chars>" },
    ...
  ] (aim for 4 for restaurants/coffee, 3 for attractions, fewer only if data truly doesn't support more),
  "photoWorthy": "<one line: standout photo-worthy dish/spot + why>" | null,
  "awards": "<one line: Michelin, James Beard, UNESCO, top-50 lists, etc.>" | null,
  "worthIt": "worth_the_stop" | "strong_nearby_pick" | "craving_match" | "know_before_you_go" | "better_if_convenient" (food/coffee/attraction only; null otherwise),
  "practical": {
    "payment": "<short factual line about payment methods>" | null,
    "englishMenu": "<short factual line about menu language + staff English>" | null,
    "reservation": "<short factual line>" | null,
    "dietary": "<short factual line about veg/vegan/GF/halal options>" | null,
    "tipping": "<short factual line about tipping norms / service charges / cover charges>" | null
  } | null (food/coffee/attraction only; null otherwise),
  "whatYouSee": "<short concrete description of physical features (attraction only)>" | null,
  "aboutAndHistory": "<short factual purpose / history (attraction only)>" | null,
  "crowd": "<one short sentence>" | null,
  "bestTime": "<concrete actionable recommendation with specific window + reason>" | null,
  "vibe": "<one short concrete sentence>" | null,
  "value": "<price tier + traveler-language judgment>" | null,
  "goodToKnow": ["<short verified fact that changes planning>", ...] (2-4 strings when reviews support; [] otherwise),
  "travelerNotes": "<practical tip>" | null,
  "gsStars": <integer per per-kind rules above>,
  "gsRedFlag": <boolean per per-kind rules above>,
  "gsVerdict": "<one short positive/neutral summary, NO negative wording>"
}

If any field has no positive content to draw from, set it to null/empty. Do NOT fabricate.

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
  const allowedKinds = ['restaurant', 'coffee', 'attraction', 'restroom', 'atm'];
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
      photoWorthy: null,
      awards: null,
      worthIt: null,
      practical: null,
      whatYouSee: null,
      aboutAndHistory: null,
      crowd: null,
      bestTime: null,
      vibe: null,
      value: null,
      goodToKnow: [],
      ageFit: null,
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
        // v7: dropped goodFor/notIdealFor/headsUp (duplicates of verdict +
        // goodToKnow), so the response is leaner again. ~1500 covers the
        // remaining fields with headroom for richer bestTime/value copy.
        max_tokens: 1500,
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
    const redFlagAllowed = (kind === 'restroom' || kind === 'attraction' || kind === 'atm');
    aiDetails.gsRedFlag = redFlagAllowed ? !!aiDetails.gsRedFlag : false;

    // New v4 fields — normalize shape so frontend doesn't get surprises.
    // whatYouSee / aboutAndHistory only meaningful for attractions.
    if (kind !== 'attraction') {
      aiDetails.whatYouSee = null;
      aiDetails.aboutAndHistory = null;
    } else {
      aiDetails.whatYouSee = typeof aiDetails.whatYouSee === 'string' && aiDetails.whatYouSee.trim() ? aiDetails.whatYouSee.trim() : null;
      aiDetails.aboutAndHistory = typeof aiDetails.aboutAndHistory === 'string' && aiDetails.aboutAndHistory.trim() ? aiDetails.aboutAndHistory.trim() : null;
    }
    // photoWorthy + awards apply to restaurant/coffee/attraction only.
    const photoAwardsAllowed = (kind === 'restaurant' || kind === 'coffee' || kind === 'attraction');
    if (!photoAwardsAllowed) {
      aiDetails.photoWorthy = null;
      aiDetails.awards = null;
    } else {
      aiDetails.photoWorthy = typeof aiDetails.photoWorthy === 'string' && aiDetails.photoWorthy.trim() ? aiDetails.photoWorthy.trim() : null;
      aiDetails.awards = typeof aiDetails.awards === 'string' && aiDetails.awards.trim() ? aiDetails.awards.trim() : null;
    }
    // ageFit / goodFor / notIdealFor / headsUp are deprecated in v7 but
    // we normalize to safe-empty shapes so any legacy frontend code reading
    // them gets a stable response (no crash on undefined access).
    aiDetails.ageFit = null;
    aiDetails.goodFor = [];
    aiDetails.notIdealFor = [];
    aiDetails.headsUp = [];

    // v7 fields — worthIt / practical. These apply to restaurant / coffee /
    // attraction only.
    const v7Allowed = (kind === 'restaurant' || kind === 'coffee' || kind === 'attraction');
    const sanitizeStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

    // worthIt: enum or null. v6 expanded to 5 tiers.
    const WORTH_ENUM = new Set([
      'worth_the_stop',
      'strong_nearby_pick',
      'craving_match',
      'know_before_you_go',
      'better_if_convenient',
    ]);
    if (!v7Allowed || !WORTH_ENUM.has(aiDetails.worthIt)) {
      aiDetails.worthIt = v7Allowed ? 'strong_nearby_pick' : null;
    }

    // practical: object with 5 string|null fields (v8 added `tipping`)
    if (!v7Allowed || !aiDetails.practical || typeof aiDetails.practical !== 'object') {
      aiDetails.practical = null;
    } else {
      const p = aiDetails.practical;
      const cleanedP = {
        payment: sanitizeStr(p.payment),
        englishMenu: sanitizeStr(p.englishMenu),
        reservation: sanitizeStr(p.reservation),
        dietary: sanitizeStr(p.dietary),
        tipping: sanitizeStr(p.tipping),
      };
      const anyPresent = Object.values(cleanedP).some(v => v !== null);
      aiDetails.practical = anyPresent ? cleanedP : null;
    }

    // alsoRecommended v5: array of {name, context} objects. Accept legacy
    // string form too in case a stale Haiku response slips through — coerce
    // "Name — context" strings into objects.
    if (!Array.isArray(aiDetails.alsoRecommended)) {
      aiDetails.alsoRecommended = [];
    } else {
      aiDetails.alsoRecommended = aiDetails.alsoRecommended
        .map(item => {
          if (item && typeof item === 'object') {
            const name = sanitizeStr(item.name);
            const context = sanitizeStr(item.context);
            return name ? { name, context } : null;
          }
          if (typeof item === 'string' && item.trim()) {
            const parts = item.split(/\s+—\s+|\s+-\s+/);
            const name = sanitizeStr(parts[0]);
            const context = parts.length > 1 ? sanitizeStr(parts.slice(1).join(' — ')) : null;
            return name ? { name, context } : null;
          }
          return null;
        })
        .filter(Boolean)
        .slice(0, 4);
    }
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
// ATTRACTION AI DETAILS — Things-To-Do redesign, Phase 2.
// ============================================================================
// Forked from handleAIDetails / buildAIDetailsSystemPrompt above so the
// attraction layout can evolve without touching restaurant/coffee/restroom
// code paths. Per the redesign handoff's HARD SCOPE FENCE.
//
// What's new vs the shared /ai-details endpoint:
//   1. Dedicated cache prefix (`attr_ai_details_*`) so attraction iterations
//      don't invalidate the restaurant cache.
//   2. `verifiedFacts` block pre-filled from Google Places data (price band,
//      rating, accessibility flags, reservable). These are HARD facts and
//      get the Verified source stamp in the UI.
//   3. `_sources` map — every renderable field tagged with its source tier
//      ('verified' | 'reviews' | 'forecast' | 'call'). The frontend drives
//      its per-field source-stamp badges from this map.
//   4. Honesty-first prompt: explicit "do not invent" guardrails, omit-when-
//      unknown over guess, conditional sections (sell-out nudge, smart tip)
//      stay null unless evidence is present.
//
// Same Haiku model + voice rules as the shared endpoint; the system prompt
// just adds the per-field tagging and the omission rules. Same restaurant
// red-flag policy (gsRedFlag true only on genuine worldwide safety concerns).
// ============================================================================

const ATTRACTION_AI_DETAILS_TTL_SECONDS = 30 * 24 * 60 * 60;  // 30 days, matches /ai-details
const ATTRACTION_AI_DETAILS_PROMPT_VERSION = 'a2';            // a1 -> a2: added smartTip, typicalDurationMin, wait object (Phase 2.5)

// Cafe "work-friendly" profile (laptop/remote-work signals from reviews).
const CAFE_WORK_TTL_SECONDS = 30 * 24 * 60 * 60;             // 30 days KV secondary
const CAFE_WORK_PROMPT_VERSION = 'w1';                        // bump to regenerate all profiles

function buildAttractionAIDetailsSystemPrompt() {
  return `You are GlobeSkimmers' Things-To-Do AI Details engine. Generate practical, honest insights for a traveler about to visit an ATTRACTION (museum, landmark, park, theme park, viewpoint, religious site, etc.).

KIND: attraction

VOICE RULES (ABSOLUTE):
- DO NOT write ANYTHING that would deter a traveler from visiting. Content is public.
- FORBIDDEN words/phrases: "inconsistent", "complaints", "issues", "concerns", "problems", "poor", "rude", "disappointed", "frustrating", "unreliable", "questionable", "lacking", "subpar", "stay away", "avoid", "skip", "don't go".
- DO mention factual planning info that helps the visit go better.
- ALWAYS lead with what people love.

HONESTY RULES (CRITICAL — these are NEW for the attraction endpoint):
- If a field has no positive content to draw from in the reviews/metadata, set it to null/empty. NEVER invent to fill a slot.
- Do NOT fabricate facts you cannot tie back to the reviews or place metadata.
- For each renderable text field, set its source tier in the "_sources" object using:
    "verified"  → Hard fact from Google place metadata (priceLevel, accessibilityOptions, rating, reservable, editorialSummary).
    "reviews"   → Inferred from review snippets.
    "forecast"  → Computed from external signal (weather, elevation). Not used in this prompt — leave fields null rather than guess.
    "call"      → Not in our data; user should call/visit the venue's website. Use this when you HAVE to render a field but lack supporting evidence.

PER-FIELD FIELDS:
- bestDish = null. (Attractions don't have dishes.)
- alsoRecommended: TOP 3 must-see/must-do items at this attraction, as an array of { name, context } objects. name = the item (exhibit, view, ride, garden, etc.), context = short reason (≤90 chars). Aim for 3 — fewer only if data is thin.
- photoWorthy: 1 short line naming a standout photo-worthy spot/exhibit/view. NULL if no obvious photo-worthy feature is mentioned.
- awards: 1 short line listing UNESCO status, top-tourist-attraction rankings, Michelin Green Guide stars, or notable recognitions. NULL if none.
- worthIt: ONE of "worth_the_stop" | "strong_nearby_pick" | "craving_match" | "know_before_you_go" | "better_if_convenient". For famous landmarks / UNESCO sites default to "worth_the_stop"; for local parks default to "strong_nearby_pick". Use "know_before_you_go" if there's meaningful planning friction (timed entry, bag check, limited access). Use "craving_match" for niche-interest venues.
- practical: { payment, englishMenu, reservation, dietary } object. For attractions:
  - payment: ticket purchase methods (e.g. "Card or cash at gate; book online for skip-the-line"). NULL if unclear.
  - englishMenu: signage/audio-guide language + staff English (e.g. "Audio guide in English available", "Signage in local language only"). NULL if unclear.
  - reservation: timed entry / advance booking (e.g. "Timed-entry tickets recommended for weekends", "Walk-in fine on weekdays"). NULL if unclear.
  - dietary: null for attractions.
- whatYouSee: 1-2 short concrete sentences describing what is physically present (buildings, exhibits, sculptures, rides, displays, scenery). NULL if data is silent.
- aboutAndHistory: 1-2 short factual sentences on purpose / origin / brief history. NULL if data is silent.
- crowd: who visits — short concrete labels (e.g. "Families with kids; school groups on weekdays", "Photographers and history fans"). Avoid vague phrasing.
- bestTime: CONCRETE actionable recommendation. Don't say "mornings are calmer" — say "Arrive at opening (9 AM) on a weekday to avoid crowds, or after 3 PM when tour buses leave". Pair a SPECIFIC suggested window with a brief reason.
- vibe: 1 direct sentence describing atmosphere (busy/quiet, contemplative/energetic, kid-friendly/adult-focused). Avoid decorative language.
- value: traveler-friendly admission framing. Use direct words: "free", "cheap", "fair", "pricey but worth it", "splurge-only". Include actual admission tier + 1-line judgment. Examples: "Free entry — fully worth a 2-hour visit", "Cheap (~$10); fair for what you see".
- goodToKnow: 2-4 SHORT verified facts that change how a traveler plans the visit. ONLY include items DIRECTLY supported by reviews/metadata. Prioritize: bag-check rules, photography restrictions, accessibility realities, kid-friendliness, audio-guide availability, dress code (temples/religious sites), what to bring, hours quirks, day-of-the-week closures.
- travelerNotes: practical traveler tips to make the visit better.
- typicalDurationMin: integer minutes — typical visit duration (NOT wait time; the time the average traveler spends INSIDE this attraction). Examples: 30 (quick viewpoint), 90 (mid-size museum), 240 (theme park half-day), 480 (full-day park). Set to null if reviews don't converge on a window — DO NOT guess. Better to omit than to invent.
- wait: object describing line / queue mechanics. Fill ONLY when reviews mention queueing, capacity, or ride-style throughput. Set the whole field to null for places where waiting isn't a thing (parks, viewpoints, walk-around museums with no entry queue).
    { "builtIn": "...", "crowdDriven": "...", "typicalMinutes": <int> }
    - builtIn: STRUCTURAL wait that timing won't fix — capacity, one-at-a-time mechanics, scheduled entry, etc. State the mechanism confidently (e.g. "One rider at a time on the cliff zipline", "Single-file pathway through the cave"). null if not applicable.
    - crowdDriven: TIMING-FIXABLE bottleneck — weekend rush, after-school crowds, peak-season queues. Pair the time window with the queue (e.g. "Weekends 12–2 PM see ~30-min entry queues"). null if not applicable.
    - typicalMinutes: integer rough wait estimate from reviews. null if reviews don't support a confident number.
- smartTip: ONE concrete planning win travelers learn from reviews — a real save in money, time, or mistake-avoidance. Strict examples ONLY:
    "Book the combo ticket online for ~30% off the gate price."
    "Enter through the south gate to skip the main queue."
    "Bring water — none sold inside; gates close at sunset."
    "The audio guide is included free at the info desk; don't pay extra at the kiosk."
  DEFAULT TO NULL. If no review-supported concrete save exists, return null. NEVER write platitudes ("great place", "go early"), opinions, or vague advice. NEVER invent a tip to fill the slot.

GS VERDICT SCORING:
- gsStars MUST be an integer 1-5 (minimum 1).
- gsRedFlag = true ONLY if multiple reviews flag a GENUINE worldwide safety concern (e.g. crime in area, unsafe structures, recent incidents). Otherwise false.
- gsVerdict: 1-2 short sentences matching the chosen worthIt tier. CAN fold in atmosphere-fit caveats using the EXACT pattern "Best if you ... Not ideal for [atmosphere/occasion mismatch]." Atmosphere caveats are allowed; quality complaints are NOT. Keep under 200 chars.

OUTPUT JSON ONLY (no markdown fences, no prose outside the JSON):
{
  "bestDish": null,
  "alsoRecommended": [ { "name": "...", "context": "..." }, ... ],
  "photoWorthy": "..." | null,
  "awards": "..." | null,
  "worthIt": "worth_the_stop" | "strong_nearby_pick" | "craving_match" | "know_before_you_go" | "better_if_convenient",
  "practical": { "payment": "..." | null, "englishMenu": "..." | null, "reservation": "..." | null, "dietary": null } | null,
  "whatYouSee": "..." | null,
  "aboutAndHistory": "..." | null,
  "crowd": "..." | null,
  "bestTime": "..." | null,
  "vibe": "..." | null,
  "value": "..." | null,
  "goodToKnow": [ "...", ... ],
  "travelerNotes": "..." | null,
  "typicalDurationMin": <integer> | null,
  "wait": { "builtIn": "..." | null, "crowdDriven": "..." | null, "typicalMinutes": <integer> | null } | null,
  "smartTip": "..." | null,
  "gsStars": <1-5>,
  "gsRedFlag": <boolean>,
  "gsVerdict": "...",
  "_sources": {
    "alsoRecommended": "reviews" | "verified" | "call",
    "photoWorthy": "reviews" | "call",
    "awards": "reviews" | "verified" | "call",
    "worthIt": "reviews",
    "practical.payment": "reviews" | "verified" | "call",
    "practical.englishMenu": "reviews" | "verified" | "call",
    "practical.reservation": "reviews" | "verified" | "call",
    "whatYouSee": "reviews" | "verified" | "call",
    "aboutAndHistory": "reviews" | "verified" | "call",
    "crowd": "reviews" | "call",
    "bestTime": "reviews" | "call",
    "vibe": "reviews" | "call",
    "value": "reviews" | "verified" | "call",
    "goodToKnow": "reviews" | "call",
    "travelerNotes": "reviews" | "call",
    "typicalDurationMin": "reviews",
    "wait.builtIn": "reviews",
    "wait.crowdDriven": "reviews",
    "wait.typicalMinutes": "reviews",
    "smartTip": "reviews",
    "gsVerdict": "reviews"
  }
}

Rules for _sources tagging:
- If a field is null/empty/[], you may omit its key OR set it to "call" — either is fine; the frontend treats both the same.
- Use "verified" ONLY when the field clearly mirrors the place metadata (e.g. aboutAndHistory written from editorialSummary, awards naming Michelin/UNESCO etc. that appeared in metadata).
- Default to "reviews" for everything else that you actually filled in from review snippets.

Return JSON only.`;
}

async function handleAttractionAIDetails(request, env) {
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

  // 0) D1 permanent cache — Phase C. Pay Haiku once per placeId, ever.
  // The D1 row outlives KV's 30-day TTL, so popular attractions
  // (Eiffel Tower, Pyramids, etc.) never re-trigger a Haiku call once
  // they've been generated. KV check below stays for unmigrated entries
  // and acts as a fast secondary read path.
  const d1Cached = await readAttractionAiFromD1(env, placeId, ATTRACTION_AI_DETAILS_PROMPT_VERSION);
  if (d1Cached) {
    return jsonResponse({ aiDetails: d1Cached, _cache: 'hit-d1' });
  }

  // 1) Check attraction AI Details cache (30-day TTL, dedicated key prefix).
  const aiCacheKey = `place:${placeId}:attr_ai_details_${ATTRACTION_AI_DETAILS_PROMPT_VERSION}`;
  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(aiCacheKey, { type: 'json' }).catch(() => null);
    if (cached) {
      // Backfill D1 from KV so subsequent reads are served from the
      // permanent layer — and once KV expires, the D1 row keeps
      // serving without paying Haiku.
      await writeAttractionAiToD1(env, placeId, ATTRACTION_AI_DETAILS_PROMPT_VERSION, cached, body?.placeName || null);
      return jsonResponse({ aiDetails: cached, _cache: 'hit-kv-backfilled' });
    }
  }

  // 2) Load Place Details (prefer the existing details_{placeId} cache so
  //    we don't pay Google again for a popular place).
  const detailsCacheKey = `details_${placeId}`;
  let place;
  const cachedDetails = await getFromCache(env, detailsCacheKey);
  if (cachedDetails && cachedDetails.data) {
    place = cachedDetails.data;
  } else {
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

  // 3) Build the verifiedFacts block from Google data. These are HARD facts
  //    that the UI renders with a green Verified stamp.
  const PRICE_BAND_LABELS = ['Free', '$', '$$', '$$$', '$$$$'];
  const accessibility = place.accessibilityOptions || null;
  const verifiedFacts = {
    priceBand: (typeof place.priceLevel === 'number' && place.priceLevel >= 0 && place.priceLevel <= 4)
      ? PRICE_BAND_LABELS[place.priceLevel]
      : null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    ratingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    reservable: typeof place.reservable === 'boolean' ? place.reservable : null,
    accessibility: accessibility
      ? {
          // Google's accessibilityOptions returns booleans (or undefined). Keep
          // null when the field is absent so the UI can distinguish "no data"
          // from "false". Verified stamp ONLY when the value is present.
          wheelchairAccessibleEntrance: typeof accessibility.wheelchairAccessibleEntrance === 'boolean' ? accessibility.wheelchairAccessibleEntrance : null,
          wheelchairAccessibleParking:  typeof accessibility.wheelchairAccessibleParking  === 'boolean' ? accessibility.wheelchairAccessibleParking  : null,
          wheelchairAccessibleRestroom: typeof accessibility.wheelchairAccessibleRestroom === 'boolean' ? accessibility.wheelchairAccessibleRestroom : null,
          wheelchairAccessibleSeating:  typeof accessibility.wheelchairAccessibleSeating  === 'boolean' ? accessibility.wheelchairAccessibleSeating  : null,
        }
      : null,
    hasEditorialSummary: !!place.editorialSummary,
  };

  // 4) Build Claude input — reviews + key metadata.
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

  // 5) If reviews + editorial summary are both empty, return a stub.
  if (reviewSnippets.length === 0 && !placeMeta.editorialSummary) {
    const stub = {
      bestDish: null,
      alsoRecommended: [],
      photoWorthy: null,
      awards: null,
      worthIt: 'strong_nearby_pick',
      practical: null,
      whatYouSee: null,
      aboutAndHistory: null,
      crowd: null,
      bestTime: null,
      vibe: null,
      value: null,
      goodToKnow: [],
      travelerNotes: null,
      typicalDurationMin: null,
      wait: null,
      smartTip: null,
      gsStars: 1,
      gsRedFlag: false,
      gsVerdict: 'Not enough review data yet — check back as more visitors share their experience.',
      verifiedFacts,
      _sources: { worthIt: 'reviews', gsVerdict: 'reviews' },
      websiteUri: placeMeta.websiteUri || null,
      placeName: placeMeta.name || null,
    };
    if (env.GLOBESKIMMERS_KV) {
      await env.GLOBESKIMMERS_KV.put(aiCacheKey, JSON.stringify(stub), { expirationTtl: ATTRACTION_AI_DETAILS_TTL_SECONDS }).catch(() => {});
    }
    // Persist stub to D1 too. A stub is the right cached answer for
    // attractions without enough review signal; if the place later
    // accumulates reviews and we want to regenerate, bump the prompt
    // version and the cache miss will trigger a full Haiku run.
    await writeAttractionAiToD1(env, placeId, ATTRACTION_AI_DETAILS_PROMPT_VERSION, stub, placeMeta.name);
    return jsonResponse({ aiDetails: stub, _cache: 'miss-stub' });
  }

  const userContent = `PLACE METADATA:\n${JSON.stringify(placeMeta, null, 2)}\n\nVERIFIED FACTS (Google place data — already known):\n${JSON.stringify(verifiedFacts, null, 2)}\n\nREVIEW SNIPPETS (up to 5 from Google):\n${JSON.stringify(reviewSnippets, null, 2)}\n\nGenerate the Attraction AI Details JSON per the voice and honesty rules above. Tag each filled field's source in _sources.`;

  // 6) Call Claude Haiku 4.5.
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
        max_tokens: 1900,  // a1 1700 → a2 1900 for the smartTip / typicalDurationMin / wait fields
        system: buildAttractionAIDetailsSystemPrompt(),
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
    aiDetails.verifiedFacts = verifiedFacts;

    // Defensive clamping.
    let stars = parseInt(aiDetails.gsStars, 10);
    if (isNaN(stars)) stars = 1;
    if (stars < 1) stars = 1;
    if (stars > 5) stars = 5;
    aiDetails.gsStars = stars;
    aiDetails.gsRedFlag = !!aiDetails.gsRedFlag;

    // bestDish is always null for attractions.
    aiDetails.bestDish = null;

    // Normalize alsoRecommended into {name, context}[] shape.
    if (!Array.isArray(aiDetails.alsoRecommended)) {
      aiDetails.alsoRecommended = [];
    } else {
      aiDetails.alsoRecommended = aiDetails.alsoRecommended
        .map(item => {
          if (item && typeof item === 'object') {
            const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : null;
            const context = typeof item.context === 'string' && item.context.trim() ? item.context.trim() : null;
            return name ? { name, context } : null;
          }
          if (typeof item === 'string' && item.trim()) {
            const parts = item.split(/\s+—\s+|\s+-\s+/);
            const name = parts[0]?.trim() || null;
            const context = parts.length > 1 ? parts.slice(1).join(' — ').trim() : null;
            return name ? { name, context } : null;
          }
          return null;
        })
        .filter(Boolean)
        .slice(0, 3);
    }

    // Normalize practical object.
    if (!aiDetails.practical || typeof aiDetails.practical !== 'object') {
      aiDetails.practical = null;
    } else {
      const p = aiDetails.practical;
      const sanitize = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      const cleaned = {
        payment: sanitize(p.payment),
        englishMenu: sanitize(p.englishMenu),
        reservation: sanitize(p.reservation),
        dietary: null,  // attractions don't use this
      };
      const anyPresent = Object.values(cleaned).some(v => v !== null);
      aiDetails.practical = anyPresent ? cleaned : null;
    }

    // Normalize goodToKnow.
    if (!Array.isArray(aiDetails.goodToKnow)) {
      aiDetails.goodToKnow = [];
    } else {
      aiDetails.goodToKnow = aiDetails.goodToKnow
        .map(s => (typeof s === 'string' && s.trim() ? s.trim() : null))
        .filter(Boolean)
        .slice(0, 4);
    }

    // worthIt enum guard.
    const WORTH_ENUM = new Set([
      'worth_the_stop', 'strong_nearby_pick', 'craving_match',
      'know_before_you_go', 'better_if_convenient',
    ]);
    if (!WORTH_ENUM.has(aiDetails.worthIt)) {
      aiDetails.worthIt = 'strong_nearby_pick';
    }

    // Phase 2.5 fields — clamp / defensive null-out.
    // typicalDurationMin: positive integer or null. Cap at 12h so a bad
    // model response doesn't render as "Allow 47h".
    const dur = parseInt(aiDetails.typicalDurationMin, 10);
    aiDetails.typicalDurationMin = (Number.isFinite(dur) && dur > 0 && dur <= 720) ? dur : null;

    // wait object: each sub-field independently nullable; whole object
    // null if every sub-field is null after sanitization.
    if (!aiDetails.wait || typeof aiDetails.wait !== 'object') {
      aiDetails.wait = null;
    } else {
      const w = aiDetails.wait;
      const sanitizeWait = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      const wm = parseInt(w.typicalMinutes, 10);
      const cleanedW = {
        builtIn: sanitizeWait(w.builtIn),
        crowdDriven: sanitizeWait(w.crowdDriven),
        typicalMinutes: (Number.isFinite(wm) && wm > 0 && wm <= 600) ? wm : null,
      };
      const anyWait = cleanedW.builtIn || cleanedW.crowdDriven || cleanedW.typicalMinutes != null;
      aiDetails.wait = anyWait ? cleanedW : null;
    }

    // smartTip: string or null. Hard cap at 200 chars so the prompt can't
    // smuggle a paragraph in.
    if (typeof aiDetails.smartTip === 'string' && aiDetails.smartTip.trim()) {
      const trimmed = aiDetails.smartTip.trim();
      aiDetails.smartTip = trimmed.length > 200 ? trimmed.slice(0, 198).trim() + '…' : trimmed;
    } else {
      aiDetails.smartTip = null;
    }

    // Normalize _sources map.
    if (!aiDetails._sources || typeof aiDetails._sources !== 'object') {
      aiDetails._sources = {};
    } else {
      const VALID_TIERS = new Set(['verified', 'reviews', 'forecast', 'call']);
      const cleanedSources = {};
      for (const [k, v] of Object.entries(aiDetails._sources)) {
        if (typeof v === 'string' && VALID_TIERS.has(v)) cleanedSources[k] = v;
      }
      aiDetails._sources = cleanedSources;
    }
  } catch (e) {
    return jsonResponse({ error: 'Claude parse error: ' + e.message }, 500);
  }

  // 7) Cache the AI Details JSON for 30 days under the dedicated attraction key.
  if (env.GLOBESKIMMERS_KV) {
    await env.GLOBESKIMMERS_KV.put(
      aiCacheKey,
      JSON.stringify(aiDetails),
      { expirationTtl: ATTRACTION_AI_DETAILS_TTL_SECONDS }
    ).catch(() => {});
  }

  // 8) D1 permanent cache (Phase C). Pay Haiku ONCE per attraction,
  // ever. The KV write above stays for fast read-paths, but the D1
  // row is what survives past the 30-day KV expiry — and what stops
  // popular attractions like Eiffel Tower from triggering a fresh
  // Haiku call every month.
  await writeAttractionAiToD1(env, placeId, ATTRACTION_AI_DETAILS_PROMPT_VERSION, aiDetails, placeMeta.name);

  return jsonResponse({ aiDetails, _cache: 'miss' });
}

// ============================================================================
// CAFE WORK-FRIENDLY PROFILE — "Good for working" signals from reviews.
// Mirrors the attraction AI-details pattern: D1 permanent cache → KV 30d →
// Place Details (reused cache) → Haiku → cache. Pay Haiku once per cafe, ever.
// ============================================================================
function buildCafeWorkSystemPrompt() {
  return `You analyze a coffee shop's Google reviews + editorial summary to judge how good it is for getting WORK done (laptop / remote work / studying). Output STRICT JSON only — no prose, no markdown fences.

HONESTY RULES:
- Use ONLY what the reviews/summary actually say. If a topic is not mentioned, set its status to "unknown" — NEVER guess or infer from vibe.
- Prefer recent, repeated signals. One offhand mention = low confidence (reflect in evidenceCount).
- State negatives plainly but neutrally (e.g. "reviewers say outlets are limited").

Return EXACTLY this JSON shape:
{
  "laptopFriendly": "great" | "ok" | "not_ideal" | "unknown",
  "wifi":    { "status": "yes" | "no" | "unknown", "note": "<=8 words or empty string" },
  "outlets": { "status": "yes" | "limited" | "no" | "unknown", "note": "<=8 words or empty string" },
  "tables":  { "status": "yes" | "limited" | "no" | "unknown", "note": "<=8 words (work-suitable tables/space) or empty string" },
  "ac":      { "status": "yes" | "no" | "unknown", "note": "<=8 words or empty string" },
  "seatingComfort": "comfy" | "basic" | "cramped" | "unknown",
  "noise": "quiet" | "moderate" | "lively" | "unknown",
  "summary": "<=18 words, one honest line about working here",
  "bestForWork": "<=8 words (e.g. weekday mornings) or null",
  "evidenceCount": 0
}

evidenceCount = how many of the provided reviews actually touched on work topics (wifi/outlets/seating/noise/working).
laptopFriendly: "great" = several positive work signals; "ok" = mixed/some positives; "not_ideal" = reviews say loud/cramped/no outlets/no wifi/laptops discouraged; "unknown" = reviews do not cover it.`;
}

async function handleCafeWorkProfile(request, env) {
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

  // 0) D1 permanent cache — pay Haiku once per cafe, ever.
  const d1Cached = await readCafeWorkFromD1(env, placeId, CAFE_WORK_PROMPT_VERSION);
  if (d1Cached) return jsonResponse({ workProfile: d1Cached, _cache: 'hit-d1' });

  // 1) KV 30-day secondary (backfills D1 on hit).
  const kvKey = `place:${placeId}:cafe_work_${CAFE_WORK_PROMPT_VERSION}`;
  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(kvKey, { type: 'json' }).catch(() => null);
    if (cached) {
      await writeCafeWorkToD1(env, placeId, CAFE_WORK_PROMPT_VERSION, cached, body?.placeName || null);
      return jsonResponse({ workProfile: cached, _cache: 'hit-kv' });
    }
  }

  // 2) Place Details — reuse the details_{placeId} cache (no new Google cost when warm).
  const detailsCacheKey = `details_${placeId}`;
  let place;
  const cachedDetails = await getFromCache(env, detailsCacheKey);
  if (cachedDetails && cachedDetails.data) {
    place = cachedDetails.data;
  } else {
    try {
      const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
        method: 'GET',
        headers: { 'X-Goog-Api-Key': env.GOOGLE_API_KEY, 'X-Goog-FieldMask': CONFIG.DETAILS_FIELD_MASK }
      });
      if (!detailsRes.ok) return jsonResponse({ error: 'Place details fetch failed', status: detailsRes.status }, 502);
      place = normalizePlace(await detailsRes.json(), new URL(request.url).origin, true);
      await setInCache(env, detailsCacheKey, place, CONFIG.CACHE_TTL.DETAILS);
    } catch (e) {
      return jsonResponse({ error: 'Place details error: ' + e.message }, 502);
    }
  }

  const reviewSnippets = (place.reviews || []).slice(0, 5).map(r => ({ text: r.text || '', rating: r.rating })).filter(r => r.text);
  const placeName = place.name || place.displayName?.text || null;
  const editorialSummary = place.editorialSummary || null;

  const UNKNOWN = {
    laptopFriendly: 'unknown',
    wifi: { status: 'unknown', note: '' },
    outlets: { status: 'unknown', note: '' },
    tables: { status: 'unknown', note: '' },
    ac: { status: 'unknown', note: '' },
    seatingComfort: 'unknown',
    noise: 'unknown',
    summary: 'Not enough reviews yet to assess work-friendliness.',
    bestForWork: null,
    evidenceCount: 0,
    placeName,
  };

  // 3) No review/editorial signal → cache an "unknown" stub so we do not re-check.
  if (reviewSnippets.length === 0 && !editorialSummary) {
    if (env.GLOBESKIMMERS_KV) await env.GLOBESKIMMERS_KV.put(kvKey, JSON.stringify(UNKNOWN), { expirationTtl: CAFE_WORK_TTL_SECONDS }).catch(() => {});
    await writeCafeWorkToD1(env, placeId, CAFE_WORK_PROMPT_VERSION, UNKNOWN, placeName);
    return jsonResponse({ workProfile: UNKNOWN, _cache: 'miss-stub' });
  }

  const userContent = `CAFE: ${JSON.stringify({ name: placeName, primaryType: place.primaryTypeDisplay || place.primaryType, editorialSummary })}\n\nREVIEW SNIPPETS (up to 5 from Google):\n${JSON.stringify(reviewSnippets, null, 2)}\n\nReturn the work-friendliness JSON per the rules. Use "unknown" for anything the reviews do not mention — never guess.`;

  let workProfile;
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: buildCafeWorkSystemPrompt(),
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
    workProfile = JSON.parse(cleaned);

    // Defensive normalization.
    const VERDICTS = new Set(['great', 'ok', 'not_ideal', 'unknown']);
    if (!VERDICTS.has(workProfile.laptopFriendly)) workProfile.laptopFriendly = 'unknown';
    for (const k of ['wifi', 'outlets', 'tables', 'ac']) {
      if (!workProfile[k] || typeof workProfile[k] !== 'object') workProfile[k] = { status: 'unknown', note: '' };
    }
    workProfile.evidenceCount = Number.isFinite(workProfile.evidenceCount) ? workProfile.evidenceCount : 0;
    workProfile.placeName = placeName;
  } catch (e) {
    return jsonResponse({ error: 'Claude parse error: ' + e.message }, 500);
  }

  if (env.GLOBESKIMMERS_KV) await env.GLOBESKIMMERS_KV.put(kvKey, JSON.stringify(workProfile), { expirationTtl: CAFE_WORK_TTL_SECONDS }).catch(() => {});
  await writeCafeWorkToD1(env, placeId, CAFE_WORK_PROMPT_VERSION, workProfile, placeName);
  return jsonResponse({ workProfile, _cache: 'miss' });
}

// ============================================================================
// RESTROOM AI DETAILS — traveler/tourist/elderly/family restroom intel.
// Dedicated endpoint (not the generic /ai-details restaurant voice). Returns 7
// honest restroom-specific sections + a structured restroomAmenities object
// with confidence labels. KV-cached 90d (pay Haiku ~once per place).
// ============================================================================
const RESTROOM_AI_PROMPT_VERSION = 'r1';   // bump to regenerate all restroom details

function buildRestroomAIDetailsSystemPrompt() {
  return `You are GlobeSkimmers' RESTROOM AI Details engine. A traveler, tourist, elderly user, family, or someone with an URGENT restroom need is about to walk to this place. Help them quickly understand what kind of restroom this is, what supplies it may have, and whether it is easy/safe to use. Output STRICT JSON only — no prose, no markdown fences.

PRIORITY ORDER (what matters most): 1) Access 2) Toilet setup 3) Supplies 4) Cleanliness 5) Accessibility 6) Family/elderly comfort 7) Safety.

HONESTY RULES (CRITICAL):
- Use ONLY what the reviews + place metadata actually support. NEVER guess or present unknown amenities as facts.
- Amenity confidence values: "confirmed" (hard metadata or repeated explicit reviews), "reported" (a review explicitly mentions it), "likely" (strongly implied by venue type but not stated — use SPARINGLY, only for soap / toilet paper / hand-drying at a normal staffed indoor business), "not_confirmed" (no evidence either way — THE DEFAULT), "unknown" (truly no basis).
- Prefer "not_confirmed" over inventing. Do NOT claim "has bidet" unless evidence confirms it — mark bidet "not_confirmed".
- Soft wording for gaps in the section text: "not confirmed", "may need to ask staff", "bring wipes just in case", "confirm at location if needed".

USE THE METADATA YOU ARE GIVEN:
- If accessibilityOptions.wheelchairAccessibleRestroom is true → restroomAmenities.accessibleStall = "confirmed".
- Venue category coffee/cafe/restaurant/fast food → purchaseRequired "likely"; in US/Canada/UK/W.Europe/Australia toiletType "western"; soap & toilet paper "likely" at a normal staffed indoor business.
- Gas station / convenience store → keyOrCodeRequired may be "likely" (ask staff for a key).
- Squat toilets only appear in parts of Asia / Middle East — only mark "squat"/"both" with regional or review support; otherwise "western" (with support) or "unknown".

SECTION TEXT — each 1-2 short, plain, traveler-friendly sentences (no marketing fluff):
- verdict: Is this a good restroom option right now? Name WHAT it is (inside a coffee shop / mall / gas station / transit station / public building / hotel / airport, etc.) and any access caveat.
- toiletSetup: toilet type + bidet / seat-cover status, using "not confirmed" honestly.
- supplies: toilet paper / soap / hand drying with confidence + a "bring wipes" nudge when there are gaps.
- accessRules: how to get in (public, customer-only, purchase may be required, ask staff for key/code, inside business/mall/transit, may close with the business).
- accessibility: wheelchair / stall / grab bars / doorway / stairs / elevator / walker — use confirm-at-location wording when unsure.
- familyElderly: suitability for elderly travelers, kids, families; baby-changing / family-restroom status (honest); note if it is a staffed indoor location.
- safety: short comfort/safety note (staffed indoor vs isolated public; best used during open hours).

Return EXACTLY this JSON shape:
{
  "verdict": "...",
  "toiletSetup": "...",
  "supplies": "...",
  "accessRules": "...",
  "accessibility": "...",
  "familyElderly": "...",
  "safety": "...",
  "restroomAmenities": {
    "toiletType": "western" | "squat" | "both" | "unknown",
    "bidet": "confirmed" | "reported" | "not_confirmed" | "unknown",
    "toiletPaper": "confirmed" | "reported" | "likely" | "not_confirmed" | "unknown",
    "toiletSeatCovers": "confirmed" | "reported" | "not_confirmed" | "unknown",
    "soap": "confirmed" | "reported" | "likely" | "not_confirmed" | "unknown",
    "handDryerOrPaperTowels": "confirmed" | "reported" | "likely" | "not_confirmed" | "unknown",
    "babyChangingTable": "confirmed" | "reported" | "not_confirmed" | "unknown",
    "familyRestroom": "confirmed" | "reported" | "not_confirmed" | "unknown",
    "accessibleStall": "confirmed" | "reported" | "not_confirmed" | "unknown",
    "keyOrCodeRequired": "confirmed" | "reported" | "likely" | "not_confirmed" | "unknown",
    "purchaseRequired": "confirmed" | "reported" | "likely" | "not_confirmed" | "unknown"
  }
}`;
}

async function handleRestroomAIDetails(request, env) {
  if (!env.ANTHROPIC_API_KEY) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  let body;
  try { body = await request.json(); } catch (_e) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }
  const placeId = body?.placeId;
  if (!placeId) return jsonResponse({ error: 'placeId required' }, 400);
  const ctxVenue = body?.venueLabel || body?.venueCategory || null;
  const ctxAccess = body?.accessType || null;

  // KV 90-day cache — pay Haiku ~once per place.
  const kvKey = `place:${placeId}:restroom_ai_${RESTROOM_AI_PROMPT_VERSION}`;
  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(kvKey, { type: 'json' }).catch(() => null);
    if (cached) return jsonResponse({ restroomDetails: cached, _cache: 'hit-kv' });
  }

  // Place Details — reuse the details_{placeId} cache (no new Google cost when warm).
  const detailsCacheKey = `details_${placeId}`;
  let place;
  const cachedDetails = await getFromCache(env, detailsCacheKey);
  if (cachedDetails && cachedDetails.data) {
    place = cachedDetails.data;
  } else {
    try {
      const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
        method: 'GET',
        headers: { 'X-Goog-Api-Key': env.GOOGLE_API_KEY, 'X-Goog-FieldMask': CONFIG.DETAILS_FIELD_MASK }
      });
      if (!detailsRes.ok) return jsonResponse({ error: 'Place details fetch failed', status: detailsRes.status }, 502);
      place = normalizePlace(await detailsRes.json(), new URL(request.url).origin, true);
      await setInCache(env, detailsCacheKey, place, CONFIG.CACHE_TTL.DETAILS);
    } catch (e) {
      return jsonResponse({ error: 'Place details error: ' + e.message }, 502);
    }
  }

  const placeName = place.name || place.displayName?.text || body?.placeName || null;
  const reviewSnippets = (place.reviews || []).slice(0, 5).map(r => ({ text: r.text || '', rating: r.rating })).filter(r => r.text);
  const accessibility = place.accessibilityOptions || null;

  const userContent = `PLACE: ${JSON.stringify({
    name: placeName,
    venue: ctxVenue,
    primaryType: place.primaryTypeDisplay || place.primaryType,
    types: (place.types || []).slice(0, 8),
    accessFromFinder: ctxAccess,
    editorialSummary: place.editorialSummary || null,
    accessibilityOptions: accessibility,
  })}\n\nREVIEW SNIPPETS (up to 5 from Google):\n${JSON.stringify(reviewSnippets, null, 2)}\n\nReturn the restroom AI Details JSON per the rules. Use "not_confirmed" / "unknown" for anything not supported — never guess.`;

  let restroomDetails;
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: buildRestroomAIDetailsSystemPrompt(),
        messages: [{ role: 'user', content: userContent }]
      })
    });
    if (!apiRes.ok) { const t = await apiRes.text(); return jsonResponse({ error: 'Claude API error', status: apiRes.status, details: t }, 502); }
    const data = await apiRes.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    restroomDetails = JSON.parse(cleaned);
  } catch (e) {
    return jsonResponse({ error: 'Claude parse error: ' + e.message }, 500);
  }

  // Defensive normalization + hard-metadata override.
  const A = (restroomDetails && typeof restroomDetails.restroomAmenities === 'object' && restroomDetails.restroomAmenities) || {};
  const amenityKeys = ['toiletType','bidet','toiletPaper','toiletSeatCovers','soap','handDryerOrPaperTowels','babyChangingTable','familyRestroom','accessibleStall','keyOrCodeRequired','purchaseRequired'];
  for (const k of amenityKeys) if (!A[k]) A[k] = 'unknown';
  if (accessibility?.wheelchairAccessibleRestroom === true) A.accessibleStall = 'confirmed';
  restroomDetails.restroomAmenities = A;
  restroomDetails.placeName = placeName;

  if (env.GLOBESKIMMERS_KV) await env.GLOBESKIMMERS_KV.put(kvKey, JSON.stringify(restroomDetails), { expirationTtl: 60 * 60 * 24 * 90 }).catch(() => {});
  return jsonResponse({ restroomDetails, _cache: 'miss' });
}

// ============================================================================
// ATM AI DETAILS — ATM Finder redesign, Phase A3.
// ============================================================================
// Forked from handleAIDetails / buildAIDetailsSystemPrompt above so the
// ATM panel can evolve a richer schema (cardCompatibility, atmOperatorFee,
// withdrawalLimits, locationContext, safety, dccWarning) without touching
// restaurant or attraction code paths. Per the redesign HARD SCOPE FENCE.
//
// What's new vs the shared /ai-details endpoint:
//   1. Dedicated cache prefix (`atm_ai_details_*`) so ATM iterations
//      don't invalidate the restaurant cache.
//   2. `verifiedFacts` block pre-filled from Google Places (open status,
//      hours, primary type, accessibility, address).
//   3. ATM-specific schema fields the AtmAIDetails.jsx component already
//      reads in Phase A2 — those sections will start rendering real data
//      the moment this endpoint is deployed.
//   4. `_sources` per-field map driving the source-stamp badges.
//   5. Voice rules tuned for INFRASTRUCTURE, not businesses-to-protect:
//      safety warnings (outdoor at night, skimmer reports, no-cameras)
//      ARE allowed and important. Fee facts are reported neutrally.
//
// Same Haiku 4.5 model as the shared endpoint.
// ============================================================================

const ATM_AI_DETAILS_TTL_SECONDS = 30 * 24 * 60 * 60;  // 30 days
const ATM_AI_DETAILS_PROMPT_VERSION = 'atm1';

function buildAtmAIDetailsSystemPrompt() {
  return `You are GlobeSkimmers' ATM Finder AI Details engine. Generate practical, honest insights for a traveler about to use this ATM.

KIND: atm

CORE PRINCIPLE — this is INFRASTRUCTURE, not a business we're protecting from negative reviews:
- Travelers' safety and money come first. Honest safety warnings benefit the user.
- Fee facts are stated neutrally. "Operator fee: 220 THB (reported by travelers)" is correct; "expensive ATM" is not.
- We do NOT editorialize or attack operators. We DO surface risk signals (skimmer reports, outdoor location after dark, no cameras).

FORBIDDEN words/phrases (still no inflammatory language): "rip-off", "scam", "garbage", "trash", "stay away" — these are emotional, not informative. Use neutral terms: "high fee compared to nearby ATMs", "outdoor location — use caution at night", "reports of card-skimming incidents — be cautious".

HONESTY RULES (CRITICAL):
- For every renderable field, set its source tier in "_sources":
    "verified"  → From Google place metadata (hours, openNow, accessibilityOptions, address, primaryType).
    "confirmed" → Stated by the operator's official channel (rare — use sparingly, only if reviewers cite the official posted fee schedule).
    "reported"  → Multiple traveler reports back the same number/fact.
    "reviews"   → Inferred from one or two review snippets.
    "estimated" → Country/operator pattern-based estimate (e.g. "Bangkok Bank ATMs in Thailand typically charge 220 THB").
    "call"      → Not in our data; user should call/visit the operator's site. Use when the field MUST render but lacks evidence.
- DEFAULT TO NULL when you can't tie a fact back to reviews/metadata/known patterns. Empty beats invented.
- Operator-fee CONFIDENCE field must match the source tier you set for atmOperatorFee in _sources.

PER-FIELD GUIDANCE:

- bestDish = null. alsoRecommended = []. (ATMs don't have these.)

- worthIt: ONE of "worth_the_stop" | "strong_nearby_pick" | "craving_match" | "know_before_you_go" | "better_if_convenient":
  - "worth_the_stop" = inside a bank branch, low/no surcharge, accepts global networks, safe location. The ATM you'd send a traveler to.
  - "strong_nearby_pick" = solid bank-network ATM in a normal location. Most common pick.
  - "craving_match" = specific bank-branch ATM for travelers wanting that bank's fee waiver (use sparingly).
  - "know_before_you_go" = meaningful friction: high surcharge, limited network compatibility, awkward access, language barrier on screen, or safety caveat.
  - "better_if_convenient" = independent / convenience-store ATM with reasonable fees but not a destination.
  Default to "strong_nearby_pick" when unsure. NEVER "skip".

- gsStars: integer 1–5 (minimum 1, even for ATMs with mixed reviews).
- gsRedFlag: true ONLY if reviews show GENUINE safety concerns at this specific ATM (past skimmer reports, multiple recent reviews mentioning unsafe area at night, robbery incidents). Otherwise false.
- gsVerdict: 1–2 short sentences synthesizing the verdict. Mention the network/operator + location type + key fee/safety signal. Example: "Good ATM for most travelers — inside a bank branch with a reported 220 THB operator fee and Visa/Mastercard/Plus/Cirrus support. Decline ATM-side currency conversion for a better rate."

- cardCompatibility: array of { network, accepted } objects covering ONLY networks travelers commonly need. Valid network keys: "visa", "mastercard", "plus", "cirrus", "maestro", "unionpay", "jcb", "discover", "amex". Set accepted=true ONLY when reviews/metadata indicate the network works at this ATM (or when the operator's bank brand reliably accepts it). Set accepted=false ONLY when explicit reviews say it doesn't. Omit unknown networks rather than guessing true. If you can't confidently judge ANY network, return null and let the UI show the safe-default copy.

- atmOperatorFee: object { amount, currency, confidence } | null.
  - amount: numeric, in local currency. NEVER include the foreign-transaction-fee or your-home-bank-fee here; this is the surcharge the ATM operator charges at withdrawal time only.
  - currency: ISO 4217 code matching the country (e.g. "THB" for Thailand).
  - confidence: "confirmed" | "reported" | "estimated".
  - Return null if you have no confident grounding. DO NOT estimate randomly. Estimating is fine when the operator brand has a well-documented pattern (e.g. Bangkok Bank, Wells Fargo, CIBC); not fine when the operator is unknown.

- withdrawalLimits: object { perTransaction, daily, currency, dependsOnCard, confidence } | null.
  - perTransaction / daily: numeric, in local currency. Either can be null while the other is filled.
  - dependsOnCard: true when the actual limit varies by the traveler's home bank/card (almost always true). Default true.
  - confidence: "confirmed" | "reported" | "estimated".
  - Return null if you can't ground a number.

- locationContext: { venueType, subLocation, summary } | null.
  - venueType: ONE of "airport" | "bank_branch" | "mall" | "grocery" | "convenience" | "hotel" | "restaurant" | "transit" | "outdoor" | "other".
  - subLocation: short specific phrase like "Terminal 3 Arrivals near baggage claim" or "Inside 7-Eleven by the front entrance". Null if not in reviews.
  - summary: 1 short sentence combining the two, e.g. "Located inside Terminal 3 Arrivals near baggage claim.".

- safety: object | null with the following boolean (or null when unknown) flags. Include a flag ONLY when reviews / metadata support a confident verdict; OMIT the field entirely otherwise.
    indoor:           ATM is inside a building.
    wellLit:          Area is well-lit.
    securityGuard:    Visible security staff or guard.
    bankBranch:       ATM is at a bank branch (strongest safety signal).
    cameras:          Visible CCTV at or near the ATM.
    highFootTraffic:  Busy area (passive safety from foot traffic).
    open24h:          Vestibule / area accessible 24/7.
    skimmerReports:   true if MULTIPLE reviews mention card-skimming incidents at THIS ATM. Use sparingly; this is a strong claim.
  Return null for the entire safety object if you have no signals at all.

- dccWarning: boolean. Almost always true — most ATMs offer Dynamic Currency Conversion at withdrawal time. Set false only when reviews specifically say this ATM doesn't ask.

- crowd: who uses this ATM (short — e.g. "Mostly arriving international travelers"). Avoid vague phrasing.
- bestTime: CONCRETE actionable window. e.g. "Before 8 AM weekdays for the shortest queue. Avoid 11 PM–5 AM if the area is dark.".
- vibe: physical-location detail. KEEP THIS POPULATED for back-compat with current ATM panel — even if locationContext.summary covers similar ground.
- value: short fee-framing line in traveler language. e.g. "Mid-range surcharge for a bank-branch ATM" or "Free if you bank with Chase". NOT a duplicate of atmOperatorFee.
- goodToKnow: 2–4 SHORT verified facts that change planning. e.g. "Drive-thru only after 10 PM", "Dispenses 1000-THB notes; bring smaller bills for taxis".
- travelerNotes: 1 practical tip beyond what's above. e.g. "Press 'English' BEFORE inserting your card to avoid the local-language flow.".

OUTPUT JSON ONLY (no markdown fences, no prose outside the JSON):
{
  "bestDish": null,
  "alsoRecommended": [],
  "worthIt": "worth_the_stop" | "strong_nearby_pick" | "craving_match" | "know_before_you_go" | "better_if_convenient",
  "cardCompatibility": [ { "network": "visa", "accepted": true|false }, ... ] | null,
  "atmOperatorFee": { "amount": <number>, "currency": "<ISO>", "confidence": "confirmed"|"reported"|"estimated" } | null,
  "withdrawalLimits": { "perTransaction": <number>|null, "daily": <number>|null, "currency": "<ISO>", "dependsOnCard": <bool>, "confidence": "confirmed"|"reported"|"estimated" } | null,
  "locationContext": { "venueType": "airport"|..., "subLocation": "..."|null, "summary": "..." } | null,
  "safety": { "indoor": <bool>, "wellLit": <bool>, "securityGuard": <bool>, "bankBranch": <bool>, "cameras": <bool>, "highFootTraffic": <bool>, "open24h": <bool>, "skimmerReports": <bool> } | null,
  "dccWarning": <bool>,
  "crowd": "..." | null,
  "bestTime": "..." | null,
  "vibe": "..." | null,
  "value": "..." | null,
  "goodToKnow": [ "...", ... ],
  "travelerNotes": "..." | null,
  "gsStars": <1-5>,
  "gsRedFlag": <boolean>,
  "gsVerdict": "...",
  "_sources": {
    "worthIt": "reviews",
    "cardCompatibility": "verified"|"reviews"|"estimated"|"call",
    "atmOperatorFee": "confirmed"|"reported"|"estimated"|"call",
    "withdrawalLimits": "confirmed"|"reported"|"estimated"|"call",
    "locationContext": "verified"|"reviews"|"call",
    "safety": "verified"|"reviews"|"call",
    "crowd": "reviews"|"call",
    "bestTime": "reviews"|"call",
    "vibe": "reviews"|"call",
    "value": "reviews"|"call",
    "goodToKnow": "reviews"|"call",
    "travelerNotes": "reviews"|"call",
    "gsVerdict": "reviews"
  }
}

Return JSON only.`;
}

async function handleAtmAIDetails(request, env) {
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

  const aiCacheKey = `place:${placeId}:atm_ai_details_${ATM_AI_DETAILS_PROMPT_VERSION}`;
  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(aiCacheKey, { type: 'json' }).catch(() => null);
    if (cached) {
      return jsonResponse({ aiDetails: cached, _cache: 'hit' });
    }
  }

  // Load Place Details (reuse the existing 90-day cached payload).
  const detailsCacheKey = `details_${placeId}`;
  let place;
  const cachedDetails = await getFromCache(env, detailsCacheKey);
  if (cachedDetails && cachedDetails.data) {
    place = cachedDetails.data;
  } else {
    try {
      const apiKey = env.GOOGLE_API_KEY;
      const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': CONFIG.DETAILS_FIELD_MASK,
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

  // Pre-fill verifiedFacts from Google data — these get the Verified
  // stamp in the UI without any LLM involvement.
  const accessibility = place.accessibilityOptions || null;
  const verifiedFacts = {
    openNow: place.regularOpeningHours?.openNow ?? place.currentOpeningHours?.openNow ?? null,
    open24h: !!place.is24Hours || /24[\s\-/]?hours?|24[\s\-/]?7|always open/i.test(place.regularOpeningHours?.weekdayDescriptions?.join(' ') || ''),
    hours: place.regularOpeningHours?.weekdayDescriptions || null,
    address: place.formattedAddress || place.shortFormattedAddress || null,
    primaryType: place.primaryTypeDisplay || place.primaryType || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    ratingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    accessibility: accessibility
      ? {
          wheelchairAccessibleEntrance: typeof accessibility.wheelchairAccessibleEntrance === 'boolean' ? accessibility.wheelchairAccessibleEntrance : null,
          wheelchairAccessibleParking:  typeof accessibility.wheelchairAccessibleParking  === 'boolean' ? accessibility.wheelchairAccessibleParking  : null,
        }
      : null,
  };

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
    primaryType: place.primaryTypeDisplay || place.primaryType,
    websiteUri: place.websiteUri,
  };

  if (reviewSnippets.length === 0 && !place.editorialSummary) {
    const stub = {
      bestDish: null,
      alsoRecommended: [],
      worthIt: 'strong_nearby_pick',
      cardCompatibility: null,
      atmOperatorFee: null,
      withdrawalLimits: null,
      locationContext: null,
      safety: null,
      dccWarning: true,
      crowd: null,
      bestTime: null,
      vibe: null,
      value: null,
      goodToKnow: [],
      travelerNotes: null,
      gsStars: 1,
      gsRedFlag: false,
      gsVerdict: 'Not enough review data yet — check the ATM screen before confirming any withdrawal.',
      verifiedFacts,
      _sources: { worthIt: 'reviews', gsVerdict: 'reviews' },
      websiteUri: placeMeta.websiteUri || null,
      placeName: placeMeta.name || null,
    };
    if (env.GLOBESKIMMERS_KV) {
      await env.GLOBESKIMMERS_KV.put(aiCacheKey, JSON.stringify(stub), { expirationTtl: ATM_AI_DETAILS_TTL_SECONDS }).catch(() => {});
    }
    return jsonResponse({ aiDetails: stub, _cache: 'miss-stub' });
  }

  const userContent = `PLACE METADATA:\n${JSON.stringify(placeMeta, null, 2)}\n\nVERIFIED FACTS (Google place data — already known):\n${JSON.stringify(verifiedFacts, null, 2)}\n\nREVIEW SNIPPETS (up to 5 from Google):\n${JSON.stringify(reviewSnippets, null, 2)}\n\nGenerate the ATM AI Details JSON per the voice and honesty rules above. Tag each filled field's source in _sources.`;

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
        max_tokens: 1800,  // headroom for the richer ATM schema + _sources map
        system: buildAtmAIDetailsSystemPrompt(),
        messages: [{ role: 'user', content: userContent }],
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
    aiDetails.verifiedFacts = verifiedFacts;
    aiDetails.bestDish = null;
    aiDetails.alsoRecommended = [];

    // Defensive normalization.
    const sanitizeStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const sanitizeNum = (v) => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    let stars = parseInt(aiDetails.gsStars, 10);
    if (isNaN(stars)) stars = 1;
    if (stars < 1) stars = 1;
    if (stars > 5) stars = 5;
    aiDetails.gsStars = stars;
    aiDetails.gsRedFlag = !!aiDetails.gsRedFlag;
    aiDetails.dccWarning = aiDetails.dccWarning === false ? false : true;

    const WORTH_ENUM = new Set([
      'worth_the_stop', 'strong_nearby_pick', 'craving_match',
      'know_before_you_go', 'better_if_convenient',
    ]);
    if (!WORTH_ENUM.has(aiDetails.worthIt)) aiDetails.worthIt = 'strong_nearby_pick';

    // cardCompatibility: array of { network, accepted } objects.
    const VALID_NETWORKS = new Set(['visa', 'mastercard', 'plus', 'cirrus', 'maestro', 'unionpay', 'jcb', 'discover', 'amex']);
    if (Array.isArray(aiDetails.cardCompatibility)) {
      const seen = new Set();
      aiDetails.cardCompatibility = aiDetails.cardCompatibility
        .map(item => {
          if (!item || typeof item !== 'object') return null;
          const net = typeof item.network === 'string' ? item.network.toLowerCase().trim() : null;
          if (!net || !VALID_NETWORKS.has(net) || seen.has(net)) return null;
          seen.add(net);
          return { network: net, accepted: !!item.accepted };
        })
        .filter(Boolean);
      if (aiDetails.cardCompatibility.length === 0) aiDetails.cardCompatibility = null;
    } else {
      aiDetails.cardCompatibility = null;
    }

    // atmOperatorFee object.
    const CONF_ENUM = new Set(['confirmed', 'reported', 'estimated']);
    if (aiDetails.atmOperatorFee && typeof aiDetails.atmOperatorFee === 'object') {
      const f = aiDetails.atmOperatorFee;
      const amount = sanitizeNum(f.amount);
      const currency = sanitizeStr(f.currency);
      const confidence = CONF_ENUM.has(f.confidence) ? f.confidence : 'estimated';
      aiDetails.atmOperatorFee = (amount != null && amount >= 0 && currency)
        ? { amount, currency: currency.toUpperCase().slice(0, 4), confidence }
        : null;
    } else {
      aiDetails.atmOperatorFee = null;
    }

    // withdrawalLimits object.
    if (aiDetails.withdrawalLimits && typeof aiDetails.withdrawalLimits === 'object') {
      const w = aiDetails.withdrawalLimits;
      const perTransaction = sanitizeNum(w.perTransaction);
      const daily = sanitizeNum(w.daily);
      const currency = sanitizeStr(w.currency);
      const confidence = CONF_ENUM.has(w.confidence) ? w.confidence : 'estimated';
      const dependsOnCard = w.dependsOnCard === false ? false : true;
      aiDetails.withdrawalLimits = (perTransaction != null || daily != null)
        ? {
            perTransaction,
            daily,
            currency: currency ? currency.toUpperCase().slice(0, 4) : null,
            dependsOnCard,
            confidence,
          }
        : null;
    } else {
      aiDetails.withdrawalLimits = null;
    }

    // locationContext.
    const VALID_VENUES = new Set(['airport', 'bank_branch', 'mall', 'grocery', 'convenience', 'hotel', 'restaurant', 'transit', 'outdoor', 'other']);
    if (aiDetails.locationContext && typeof aiDetails.locationContext === 'object') {
      const l = aiDetails.locationContext;
      const venueType = typeof l.venueType === 'string' && VALID_VENUES.has(l.venueType) ? l.venueType : null;
      const subLocation = sanitizeStr(l.subLocation);
      const summary = sanitizeStr(l.summary);
      aiDetails.locationContext = (venueType || summary) ? { venueType, subLocation, summary } : null;
    } else {
      aiDetails.locationContext = null;
    }

    // safety flags.
    if (aiDetails.safety && typeof aiDetails.safety === 'object') {
      const SAFETY_KEYS = ['indoor', 'wellLit', 'securityGuard', 'bankBranch', 'cameras', 'highFootTraffic', 'open24h', 'skimmerReports'];
      const out = {};
      for (const k of SAFETY_KEYS) {
        if (typeof aiDetails.safety[k] === 'boolean') out[k] = aiDetails.safety[k];
      }
      aiDetails.safety = Object.keys(out).length > 0 ? out : null;
    } else {
      aiDetails.safety = null;
    }

    // goodToKnow.
    if (!Array.isArray(aiDetails.goodToKnow)) aiDetails.goodToKnow = [];
    else aiDetails.goodToKnow = aiDetails.goodToKnow.map(sanitizeStr).filter(Boolean).slice(0, 4);

    // _sources map — validate tier strings.
    const VALID_TIERS = new Set(['verified', 'confirmed', 'reported', 'reviews', 'estimated', 'call']);
    if (!aiDetails._sources || typeof aiDetails._sources !== 'object') {
      aiDetails._sources = {};
    } else {
      const cleanedSources = {};
      for (const [k, v] of Object.entries(aiDetails._sources)) {
        if (typeof v === 'string' && VALID_TIERS.has(v)) cleanedSources[k] = v;
      }
      aiDetails._sources = cleanedSources;
    }
    // Override _sources.atmOperatorFee with the actual confidence value
    // so the stamp always agrees with the fee object's confidence field.
    if (aiDetails.atmOperatorFee?.confidence) {
      aiDetails._sources['atmOperatorFee'] = aiDetails.atmOperatorFee.confidence;
    }
    if (aiDetails.withdrawalLimits?.confidence) {
      aiDetails._sources['withdrawalLimits'] = aiDetails.withdrawalLimits.confidence;
    }
  } catch (e) {
    return jsonResponse({ error: 'Claude parse error: ' + e.message }, 500);
  }

  if (env.GLOBESKIMMERS_KV) {
    await env.GLOBESKIMMERS_KV.put(
      aiCacheKey,
      JSON.stringify(aiDetails),
      { expirationTtl: ATM_AI_DETAILS_TTL_SECONDS }
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
const NAME_INFO_PROMPT_VERSION = 'v3';  // v2->v3: added `nativeScript` field

const NAME_INFO_SYSTEM_PROMPT = `You translate and romanize business names for English-speaking travelers, and provide the native script + language code so the device's Text-to-Speech can pronounce the name authentically.

Given a business name, return STRICT JSON with FOUR fields:
{
  "romanization": "<how to pronounce the name in Latin alphabet, or null if the original is already pure Latin>",
  "translation": "<what the name means in English, or null if it's already a recognizable English phrase / person's name>",
  "lang": "<BCP-47 language code: 'ja-JP', 'zh-CN', 'ko-KR', 'ar-SA', 'it-IT', 'fr-FR', 'es-MX', 'en-US', etc.>",
  "nativeScript": "<the SAME name written in the original/native script, when the displayed name is a romanization of a non-Latin language (e.g. 'Daimaru Tokyo' -> '大丸東京', 'Tokyo Station' -> '東京駅'). Return null if the displayed name is already in its native script, OR if the language natively uses Latin alphabet (Italian/French/Spanish/etc.).>"
}

WHY nativeScript matters: iOS/Android TTS voices pronounce native-script text far more naturally than romanized text. Kyoko (Japanese voice) speaking "大丸東京" sounds like a native Japanese speaker. The same voice trying to read "Daimaru Tokyo" may spell letters out. So when the displayed name is a romanization of CJK/Arabic/etc., give us the original script.

EXAMPLES:
Input: "寿司"
Output: {"romanization": "Sushi", "translation": "Sushi", "lang": "ja-JP", "nativeScript": null}

Input: "Daimaru Tokyo"
Output: {"romanization": null, "translation": null, "lang": "ja-JP", "nativeScript": "大丸東京"}

Input: "Tokyo Station"
Output: {"romanization": null, "translation": null, "lang": "ja-JP", "nativeScript": "東京駅"}

Input: "Mitsukoshi Ginza"
Output: {"romanization": null, "translation": null, "lang": "ja-JP", "nativeScript": "三越銀座"}

Input: "Lotte World"
Output: {"romanization": null, "translation": null, "lang": "ko-KR", "nativeScript": "롯데월드"}

Input: "イマーシブ脱出ゲーム（横浜店）"
Output: {"romanization": "Imāshibu Dasshutsu Gēmu (Yokohama-ten)", "translation": "Immersive Escape Game (Yokohama Branch)", "lang": "ja-JP", "nativeScript": null}

Input: "Trattoria della Nonna"
Output: {"romanization": null, "translation": "Grandmother's Trattoria", "lang": "it-IT", "nativeScript": null}

Input: "Joe's Pizza"
Output: {"romanization": null, "translation": null, "lang": "en-US", "nativeScript": null}

Input: "मसाला हाउस"
Output: {"romanization": "Masala House", "translation": "Spice House", "lang": "hi-IN", "nativeScript": null}

Input: "Café du Monde"
Output: {"romanization": null, "translation": "Café of the World", "lang": "fr-FR", "nativeScript": null}

Input: "北京烤鸭店"
Output: {"romanization": "Běijīng Kǎoyā Diàn", "translation": "Beijing Roast Duck Restaurant", "lang": "zh-CN", "nativeScript": null}

RULES:
- Romanization: ONLY include if the original has non-Latin characters. Use widely-accepted transliteration (Hepburn for Japanese, Pinyin for Chinese, etc.). Preserve original parentheses / punctuation structure.
- Translation: ONLY include if the meaning is non-obvious to an English speaker. Leave null for plain English names.
- For partial-translation cases (e.g., "Sushi Sato"): translate only the non-English parts in context.
- Person's names: leave translation null.
- Lang: ALWAYS return a BCP-47 language code (region-tagged). For Chinese: 'zh-CN' simplified, 'zh-TW' traditional. For Spanish: infer regional ('es-MX', 'es-ES') else 'es-419'. Default to the most common local variant when uncertain.
- NativeScript: ONLY for romanized non-Latin-script languages (Japanese, Chinese, Korean, Russian, Arabic, Hebrew, Thai, Hindi, Greek, etc.). Don't fabricate — only include if you're confident in the native form (well-known brands / common terms / geographic names). For languages that natively use Latin alphabet, this is always null.
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
      nativeScript: typeof nameInfo.nativeScript === 'string' && nameInfo.nativeScript.trim() ? nameInfo.nativeScript.trim() : null,
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
// PARSE-INTENT — LLM intent fallback for long-tail dish/restaurant queries.
// Used when getRestaurants' keyword-based parseSearchIntent can't confidently
// route the query (e.g. "chicken inasal" -> the generic /chicken/ pattern
// instead of filipino_restaurant). Triggered by Strategy B in entry.ts:
// GENERAL intents AND dish matches that left unrecognized words in the query.
//
// Returns structured intent matching the existing DISH_MAP shape so the
// downstream tier classifier doesn't need to know the LLM ever touched it.
// Cached in KV (24h TTL) per normalized query -- expected ~80% cache hit
// rate after a week of accumulation.
// ============================================================================

const PARSE_INTENT_TTL_SECONDS = 24 * 60 * 60;  // 24 hours
const PARSE_INTENT_PROMPT_VERSION = 'v1';

// Valid Google Places API (New) Table A primary types we use in the app.
// Claude is instructed to ONLY emit types from this set; anything else is
// dropped during normalization.
const VALID_GOOGLE_PLACE_TYPES = new Set([
  // Cuisine-specific restaurants
  'african_restaurant','american_restaurant','asian_restaurant','brazilian_restaurant',
  'breakfast_restaurant','brunch_restaurant','chinese_restaurant','filipino_restaurant',
  'french_restaurant','greek_restaurant','hamburger_restaurant','indian_restaurant',
  'indonesian_restaurant','italian_restaurant','japanese_restaurant','korean_restaurant',
  'lebanese_restaurant','mediterranean_restaurant','mexican_restaurant',
  'middle_eastern_restaurant','pizza_restaurant','ramen_restaurant','restaurant',
  'sandwich_shop','seafood_restaurant','spanish_restaurant','steak_house',
  'sushi_restaurant','thai_restaurant','turkish_restaurant','vegan_restaurant',
  'vegetarian_restaurant','vietnamese_restaurant',
  // Specialty / casual
  'bagel_shop','bakery','bar','barbecue_restaurant','cafe','cafeteria','chocolate_shop',
  'coffee_shop','deli','dessert_restaurant','dessert_shop','diner','donut_shop',
  'fast_food_restaurant','fine_dining_restaurant','food_court','ice_cream_shop',
  'juice_shop','meal_delivery','meal_takeaway','pastry_shop','pub','tea_house',
  'wine_bar',
]);

const PARSE_INTENT_SYSTEM_PROMPT = `You are a restaurant-search intent parser for Globeskimmers, a travel app. Given a free-text query, return STRICT JSON describing the search intent so the app can find matching restaurants.

OUTPUT SCHEMA (return EXACTLY this shape — no extra keys, no markdown):
{
  "dishLabel": "<canonical short English label for the dish/cuisine, max 30 chars>" | null,
  "cuisine": "<lowercase cuisine slug, e.g. 'filipino', 'japanese', 'mexican'>" | null,
  "tier1Types": ["<1-3 Google primary types for the specialist place>"],
  "tier2Types": ["<0-3 related Google primary types>"],
  "nameKeywords": ["<chain names + signature dish words for name-based matching, max 8>"],
  "mealTime": "breakfast" | "brunch" | "lunch" | "dinner" | null,
  "strict": <true|false>,
  "strictPrimaryTypes": ["<REQUIRED if strict=true: allowlist of valid types>"],
  "confidence": <0.0-1.0>
}

VALID GOOGLE PRIMARY TYPES (use ONLY these — anything else will be dropped):
african_restaurant, american_restaurant, asian_restaurant, brazilian_restaurant,
breakfast_restaurant, brunch_restaurant, chinese_restaurant, filipino_restaurant,
french_restaurant, greek_restaurant, hamburger_restaurant, indian_restaurant,
indonesian_restaurant, italian_restaurant, japanese_restaurant, korean_restaurant,
lebanese_restaurant, mediterranean_restaurant, mexican_restaurant,
middle_eastern_restaurant, pizza_restaurant, ramen_restaurant, restaurant,
sandwich_shop, seafood_restaurant, spanish_restaurant, steak_house, sushi_restaurant,
thai_restaurant, turkish_restaurant, vegan_restaurant, vegetarian_restaurant,
vietnamese_restaurant, bagel_shop, bakery, bar, barbecue_restaurant, cafe, cafeteria,
chocolate_shop, coffee_shop, deli, dessert_restaurant, dessert_shop, diner, donut_shop,
fast_food_restaurant, fine_dining_restaurant, food_court, ice_cream_shop, juice_shop,
meal_delivery, meal_takeaway, pastry_shop, pub, tea_house, wine_bar

RULES:
1. dishLabel: canonical English. "chicken inasal" stays "chicken inasal"; "kare-kare" stays "kare-kare"; "pho" stays "pho". Set to null if the query isn't food-related.
2. cuisine: lowercase snake_case slug. Set to null if cross-cuisine (e.g. "salad", "sandwich" -- no single cuisine).
3. strict: TRUE if the dish is so cuisine-specific that a non-cuisine restaurant serving it would be a misleading result. Examples: TRUE for inasal/sisig/butter chicken/ramen/pho. FALSE for chicken/salad/burger/pizza (cross-cuisine).
4. strictPrimaryTypes (required when strict=true): the allowlist of Google primary types that ARE legitimate for this dish. For chicken inasal: ['filipino_restaurant']. For ramen: ['ramen_restaurant','japanese_restaurant'].
5. mealTime: only set if the dish is tied to a specific meal (e.g. "pancakes" -> breakfast). Leave null for all-day foods.
6. nameKeywords: chain names + obvious signature words. For inasal: ['inasal','mang inasal','bacolod']. For pho: ['pho','phở','pho 79','pho saigon']. Max 8.
7. confidence: 0.0-1.0. Below 0.5 means "I'm not sure" and the app should ignore your output.
8. If the query is a brand/restaurant name (not a dish), set dishLabel = null and only fill cuisine + tier1Types + nameKeywords with the brand name.
9. Return ONLY JSON. No prose, no markdown fences, no commentary.

EXAMPLES:

Input: "chicken inasal"
Output: {"dishLabel":"chicken inasal","cuisine":"filipino","tier1Types":["filipino_restaurant"],"tier2Types":["barbecue_restaurant"],"nameKeywords":["inasal","chicken inasal","mang inasal","bacolod chicken house"],"mealTime":null,"strict":true,"strictPrimaryTypes":["filipino_restaurant"],"confidence":0.95}

Input: "pho"
Output: {"dishLabel":"pho","cuisine":"vietnamese","tier1Types":["vietnamese_restaurant"],"tier2Types":[],"nameKeywords":["pho","phở","pho 79","pho saigon","pho hoa"],"mealTime":null,"strict":true,"strictPrimaryTypes":["vietnamese_restaurant"],"confidence":0.98}

Input: "bibimbap"
Output: {"dishLabel":"bibimbap","cuisine":"korean","tier1Types":["korean_restaurant"],"tier2Types":[],"nameKeywords":["bibimbap","dolsot","korean bbq"],"mealTime":null,"strict":true,"strictPrimaryTypes":["korean_restaurant"],"confidence":0.97}

Input: "rendang"
Output: {"dishLabel":"rendang","cuisine":"indonesian","tier1Types":["indonesian_restaurant"],"tier2Types":["malaysian_restaurant"],"nameKeywords":["rendang","nasi padang"],"mealTime":null,"strict":true,"strictPrimaryTypes":["indonesian_restaurant","malaysian_restaurant"],"confidence":0.95}

Input: "salad"
Output: {"dishLabel":"salad","cuisine":null,"tier1Types":["vegan_restaurant","vegetarian_restaurant"],"tier2Types":["cafe","restaurant"],"nameKeywords":["salad","sweetgreen","tossed","chop'd"],"mealTime":null,"strict":false,"strictPrimaryTypes":[],"confidence":0.85}

Input: "asdfqwer"
Output: {"dishLabel":null,"cuisine":null,"tier1Types":[],"tier2Types":[],"nameKeywords":[],"mealTime":null,"strict":false,"strictPrimaryTypes":[],"confidence":0.1}`;

// Best-effort D1 logger for intent fallback events. Fire-and-forget,
// never blocks the response. session_id is 'worker' since the Worker
// doesn't know which user session triggered the call (would require
// passing it through from Base44 -- not needed for the aggregate
// analytics we care about: trigger volume, cache rate, top queries).
async function writeIntentFallbackEvent(env, payload) {
  if (!env.DB) return;
  try {
    const ts = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO events (ts, user_id, session_id, event_type, page, payload, ua_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(ts, null, 'worker', 'intent_llm_fallback', null, JSON.stringify(payload), null).run();
  } catch (_e) { /* swallow -- analytics never breaks the response */ }
}

async function handleParseIntent(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  let body;
  try { body = await request.json(); } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const query = (body?.query || '').toString().trim().toLowerCase();
  if (!query) {
    return jsonResponse({ error: 'query required' }, 400);
  }

  const startedAt = Date.now();

  // Normalize query for cache key: collapse whitespace, drop punctuation that
  // doesn't change meaning. "Chicken Inasal!" and "chicken  inasal" share a key.
  const normalizedQuery = query.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const cacheKey = `parse_intent:${PARSE_INTENT_PROMPT_VERSION}:${normalizedQuery}`;

  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(cacheKey, { type: 'json' }).catch(() => null);
    if (cached) {
      writeIntentFallbackEvent(env, {
        query: normalizedQuery,
        cache: 'hit',
        success: true,
        dishLabel: cached.dishLabel,
        cuisine: cached.cuisine,
        strict: cached.strict,
        confidence: cached.confidence,
        latencyMs: Date.now() - startedAt,
      });
      return jsonResponse({ ...cached, _cache: 'hit' });
    }
  }

  let intent;
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
        max_tokens: 400,
        // Cache the long system prompt -- repeat queries within 5 min hit
        // the cache at ~10% the input cost.
        system: [{ type: 'text', text: PARSE_INTENT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Query: ${query}` }],
      }),
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      writeIntentFallbackEvent(env, { query: normalizedQuery, cache: 'miss', success: false, error: `claude_api_${apiRes.status}`, latencyMs: Date.now() - startedAt });
      return jsonResponse({ error: 'Claude API error', status: apiRes.status, details: errText }, 502);
    }
    const data = await apiRes.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    intent = JSON.parse(cleaned);
  } catch (e) {
    writeIntentFallbackEvent(env, { query: normalizedQuery, cache: 'miss', success: false, error: 'parse_' + (e.message || 'unknown').slice(0, 80), latencyMs: Date.now() - startedAt });
    return jsonResponse({ error: 'Claude parse error: ' + e.message }, 500);
  }

  // Defensive normalization: clamp shape, validate types against known set,
  // drop unknown types instead of letting them poison the downstream tier
  // classifier with strings Google doesn't recognize.
  const filterValidTypes = (arr) => Array.isArray(arr)
    ? arr.filter((t) => typeof t === 'string' && VALID_GOOGLE_PLACE_TYPES.has(t.trim()))
    : [];
  const tier1Types = filterValidTypes(intent.tier1Types);
  const tier2Types = filterValidTypes(intent.tier2Types);
  const strictPrimaryTypes = filterValidTypes(intent.strictPrimaryTypes);
  const confidence = typeof intent.confidence === 'number' ? Math.max(0, Math.min(1, intent.confidence)) : 0;
  const validMealTimes = new Set(['breakfast','brunch','lunch','dinner']);
  const mealTime = (typeof intent.mealTime === 'string' && validMealTimes.has(intent.mealTime)) ? intent.mealTime : null;

  const normalized = {
    dishLabel: typeof intent.dishLabel === 'string' && intent.dishLabel.trim() ? intent.dishLabel.trim() : null,
    cuisine: typeof intent.cuisine === 'string' && intent.cuisine.trim() ? intent.cuisine.trim().toLowerCase() : null,
    tier1Types,
    tier2Types,
    nameKeywords: Array.isArray(intent.nameKeywords)
      ? intent.nameKeywords.filter((k) => typeof k === 'string' && k.trim()).slice(0, 8).map((k) => k.trim().toLowerCase())
      : [],
    mealTime,
    // Strict only allowed if we have at least one valid allowlist type.
    strict: intent.strict === true && strictPrimaryTypes.length > 0,
    strictPrimaryTypes,
    confidence,
  };

  if (env.GLOBESKIMMERS_KV) {
    await env.GLOBESKIMMERS_KV.put(cacheKey, JSON.stringify(normalized), { expirationTtl: PARSE_INTENT_TTL_SECONDS }).catch(() => {});
  }
  writeIntentFallbackEvent(env, {
    query: normalizedQuery,
    cache: 'miss',
    success: true,
    dishLabel: normalized.dishLabel,
    cuisine: normalized.cuisine,
    strict: normalized.strict,
    confidence: normalized.confidence,
    latencyMs: Date.now() - startedAt,
  });
  return jsonResponse({ ...normalized, _cache: 'miss' });
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

// ============================================================================
// TEXT SCANNER — Claude Haiku 4.5 vision for OCR + translation + romanization
// Mirrors the Price Scanner pattern: image base64 in, structured JSON out.
// KV-cached 24hr per (imageHash + targetLanguage) so retries / re-aims at the
// same text cost $0. Frontend handles rate limiting (75/day per device) since
// that's user-facing UX, not a security boundary.
// ============================================================================

const TEXT_SCAN_TTL_SECONDS = 24 * 60 * 60;  // 24 hours
const TEXT_SCAN_PROMPT_VERSION = 'v1';

const TEXT_SCAN_SYSTEM_PROMPT = `You are a vision OCR + translation engine for travelers using Globeskimmers, a travel app.

ROLE
Read the visible text in the image, identify its language, translate it into the requested target language, provide pronunciation for non-Latin scripts, AND classify what kind of text it is (menu, sign, label, etc) so the app can build category-level analytics. Return strict JSON. Never include narrative text, markdown fences, or commentary outside the JSON object.

OUTPUT SCHEMA (exact shape, no extra keys):
{
  "originalText": "<the text as it appears in the image, in the source language, preserving line breaks with \\\\n>",
  "sourceLanguage": "<BCP-47 code: 'ja', 'zh-Hans', 'ko', 'th', 'es', 'fr', etc. — best guess>",
  "sourceLanguageName": "<English name of the source language: 'Japanese', 'Spanish', etc.>",
  "translation": "<the same text translated into the target language>",
  "romanization": "<Latin-alphabet phonetic spelling, ONLY when sourceLanguage uses a non-Latin script (Japanese, Chinese, Korean, Arabic, Hebrew, Thai, Russian, Greek, Hindi, etc.). Use Hepburn for Japanese, Pinyin for Chinese, Revised Romanization for Korean. NULL when source uses Latin alphabet>",
  "lang": "<full BCP-47 code suitable for browser speechSynthesis: 'ja-JP', 'zh-CN', 'es-MX', etc.>",
  "textCategory": "<one of: menu | directional_sign | informational_sign | warning_sign | product_label | document | newspaper | display_screen | handwritten | other>",
  "menuType": "<ONLY when textCategory='menu', one of: appetizer | main | dessert | drink | breakfast | mixed | unclear. NULL otherwise>",
  "dishKeywords": [<ONLY when textCategory='menu', up to 5 short dish name strings extracted from the menu (canonical English names if recognizable). Empty array otherwise>],
  "confidence": <0.0-1.0 — how confident you are the OCR is accurate>
}

RULES

1. OCR accuracy: read EXACTLY what's in the image. Don't fix typos, don't expand abbreviations, don't infer missing characters. If text is partially obscured, transcribe only the visible parts. If you can't read it at all, return originalText: "" and confidence: 0.

2. Source language detection: identify the actual language of the text. If the image has English text and the user's target is English, still translate (e.g. confirm "Coffee" -> "Coffee").

3. Translation: natural, fluent translation into the target language. For menus/signs, preserve formatting (line breaks, bullet points). Keep proper nouns in their original form. Don't translate brand names ("Coca-Cola" stays "Coca-Cola").

4. Romanization: ONLY for non-Latin scripts. Examples:
   - Japanese "こんにちは" -> romanization: "Konnichiwa"
   - Chinese "你好" -> romanization: "Nǐ hǎo"
   - Korean "안녕하세요" -> romanization: "Annyeonghaseyo"
   - Thai "สวัสดี" -> romanization: "Sawatdi"
   - Spanish "Hola" -> romanization: null (already Latin alphabet)

5. lang field: BCP-47 with region tag suitable for speechSynthesis. Use:
   - ja -> "ja-JP"
   - zh-Hans -> "zh-CN", zh-Hant -> "zh-TW"
   - ko -> "ko-KR"
   - es -> "es-MX" (default Mexico) or "es-ES" (Spain context)
   - pt -> "pt-BR" (default Brazil) or "pt-PT" (Portugal context)
   - en -> "en-US" (default)

6. textCategory: classify what kind of text this is:
   - menu: restaurant/cafe menu, food list, drinks list, daily specials board
   - directional_sign: street signs, station signs, exit signs, navigation arrows, room numbers, gate numbers
   - informational_sign: museum plaques, park info boards, store hours, building info
   - warning_sign: "Caution", "No entry", construction signs, safety warnings, "Wet floor"
   - product_label: package labels, ingredient lists, instruction manuals, price tags, washing labels
   - document: official paperwork, forms, tickets, receipts, contracts
   - newspaper: printed periodicals, magazines, posters with article-like text
   - display_screen: digital boards, kiosk screens, TV captions, departure/arrival boards
   - handwritten: handwritten notes, blackboard menus, handwritten signs
   - other: anything that doesn't fit the above (graffiti, art, mixed types)

7. menuType (ONLY when textCategory='menu'):
   - appetizer: starters, hors d'oeuvres section
   - main: entrees, main courses, mains section
   - dessert: dessert, sweet section
   - drink: beverages, wine list, cocktails, coffee menu
   - breakfast: breakfast / brunch items
   - mixed: full menu spanning multiple categories
   - unclear: menu but section not identifiable

8. dishKeywords (ONLY when textCategory='menu'): up to 5 short dish names from the menu. Use canonical English names when recognizable (e.g. for "ramen" / "pho" / "tacos" — keep the international name). Skip generic words like "soup" or "rice" unless that's literally the dish name. Empty array for non-menu scans.

9. Quality gate: if the image is too blurry, dark, or doesn't contain readable text, return:
   {"originalText": "", "sourceLanguage": null, "sourceLanguageName": null, "translation": "", "romanization": null, "lang": null, "textCategory": "other", "menuType": null, "dishKeywords": [], "confidence": 0}

10. Multiple separate items: if the image shows a menu with multiple dishes, keep them on separate lines (use \\\\n in originalText and translation).

11. Currency, numbers, dates: keep them in their original numeric form. Don't convert units.

Return strict JSON. No prose.`;

// SHA-256 hash of the base64 image (truncated to 16 chars) so cache keys are
// short but collision-resistant. Hashing the image content + target language
// means re-aiming at the same menu returns instantly.
async function hashImageContent(base64, targetLanguage) {
  const enc = new TextEncoder();
  // Just hash the first 8KB of base64 — typical phone photo is 50-200KB, but
  // any meaningful change in the image changes the first chunk too.
  const sample = base64.slice(0, 8192) + '|' + targetLanguage + '|' + TEXT_SCAN_PROMPT_VERSION;
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(sample));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function writeTextScanEvent(env, payload) {
  if (!env.DB) return;
  try {
    const ts = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO events (ts, user_id, session_id, event_type, page, payload, ua_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(ts, null, 'worker', 'text_scan', 'SmartTextScanner', JSON.stringify(payload), null).run();
  } catch (_e) { /* analytics never breaks the response */ }
}

async function handleScanText(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const imageBase64 = body.image;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return jsonResponse({ error: 'image (base64 string) is required' }, 400);
  }
  const mediaType = body.mediaType || 'image/jpeg';
  const targetLanguage = (body.targetLanguage || 'en').toLowerCase();

  const startedAt = Date.now();
  const imgHash = await hashImageContent(imageBase64, targetLanguage);
  const cacheKey = `text_scan:${TEXT_SCAN_PROMPT_VERSION}:${imgHash}`;

  // Cache check — re-aiming at the same menu / sign returns instantly at $0.
  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(cacheKey, { type: 'json' }).catch(() => null);
    if (cached) {
      writeTextScanEvent(env, {
        cache: 'hit',
        success: true,
        sourceLanguage: cached.sourceLanguage,
        targetLanguage,
        textCategory: cached.textCategory || null,
        menuType: cached.menuType || null,
        confidence: cached.confidence,
        latencyMs: Date.now() - startedAt,
      });
      return jsonResponse({ ...cached, _cache: 'hit' });
    }
  }

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
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: TEXT_SCAN_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              {
                type: 'text',
                text: `Read all visible text in this image and translate it into language code: ${targetLanguage}. Return strict JSON matching the schema.`,
              },
            ],
          },
        ],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => '');
      writeTextScanEvent(env, { cache: 'miss', success: false, error: `claude_api_${apiRes.status}`, latencyMs: Date.now() - startedAt });
      return jsonResponse({ error: `Claude API error ${apiRes.status}`, details: errText }, 502);
    }

    const data = await apiRes.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const raw = textBlock?.text || '';

    let parsed;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      writeTextScanEvent(env, { cache: 'miss', success: false, error: 'parse_error', latencyMs: Date.now() - startedAt });
      return jsonResponse({ error: 'Model returned non-JSON', raw }, 500);
    }

    // Defensive normalization
    const VALID_CATEGORIES = new Set(['menu','directional_sign','informational_sign','warning_sign','product_label','document','newspaper','display_screen','handwritten','other']);
    const VALID_MENU_TYPES = new Set(['appetizer','main','dessert','drink','breakfast','mixed','unclear']);
    const rawCategory = typeof parsed.textCategory === 'string' ? parsed.textCategory.toLowerCase().trim() : 'other';
    const textCategory = VALID_CATEGORIES.has(rawCategory) ? rawCategory : 'other';
    const rawMenuType = typeof parsed.menuType === 'string' ? parsed.menuType.toLowerCase().trim() : null;
    const menuType = (textCategory === 'menu' && rawMenuType && VALID_MENU_TYPES.has(rawMenuType)) ? rawMenuType : null;
    const dishKeywords = (textCategory === 'menu' && Array.isArray(parsed.dishKeywords))
      ? parsed.dishKeywords.filter(k => typeof k === 'string' && k.trim()).slice(0, 5).map(k => k.trim().toLowerCase())
      : [];

    const normalized = {
      originalText: typeof parsed.originalText === 'string' ? parsed.originalText : '',
      sourceLanguage: typeof parsed.sourceLanguage === 'string' && parsed.sourceLanguage.trim() ? parsed.sourceLanguage.trim() : null,
      sourceLanguageName: typeof parsed.sourceLanguageName === 'string' && parsed.sourceLanguageName.trim() ? parsed.sourceLanguageName.trim() : null,
      translation: typeof parsed.translation === 'string' ? parsed.translation : '',
      romanization: typeof parsed.romanization === 'string' && parsed.romanization.trim() ? parsed.romanization.trim() : null,
      lang: typeof parsed.lang === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(parsed.lang) ? parsed.lang : null,
      textCategory,
      menuType,
      dishKeywords,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    };

    if (env.GLOBESKIMMERS_KV) {
      await env.GLOBESKIMMERS_KV.put(cacheKey, JSON.stringify(normalized), { expirationTtl: TEXT_SCAN_TTL_SECONDS }).catch(() => {});
    }

    writeTextScanEvent(env, {
      cache: 'miss',
      success: true,
      sourceLanguage: normalized.sourceLanguage,
      targetLanguage,
      textCategory: normalized.textCategory,
      menuType: normalized.menuType,
      dishKeywords: normalized.dishKeywords,
      confidence: normalized.confidence,
      textLength: normalized.originalText.length,
      latencyMs: Date.now() - startedAt,
    });

    return jsonResponse({ ...normalized, _cache: 'miss' });
  } catch (error) {
    writeTextScanEvent(env, { cache: 'miss', success: false, error: 'network_' + (error.message || 'unknown').slice(0, 80), latencyMs: Date.now() - startedAt });
    return jsonResponse({ error: error.message }, 500);
  }
}

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

// ============================================================================
// DESCRIBE ITEM — Smart Price Scanner vision pass.
// ============================================================================
// Given a photo of a retail/product item, return a SHORT generic item
// description (3–8 words, no brand names unless visibly printed, including
// material/type/category) that the frontend feeds into /analyze-price for a
// price comparison. Mirrors handlePriceScan's auth / endpoint / CORS / parse
// pattern exactly; only the prompt and max_tokens differ.
// ============================================================================
async function handleDescribeItem(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured', itemDescription: '' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body', itemDescription: '' }, 400);
  }

  const imageBase64 = body.image;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return jsonResponse({ error: 'image (base64 string) is required', itemDescription: '' }, 400);
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
        max_tokens: 150,
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
                text: 'Identify the main retail/product item in this photo for a price comparison. Look at the WHOLE image. If it does NOT clearly show an actual product to price-compare — e.g. it is only a price tag/label, a barcode, a receipt, a store sign or logo, an empty shelf, a hand/finger, or is too blurry/ambiguous to tell — then DO NOT guess a product. Return ONLY a JSON object: {"itemDescription": "<short generic description, 3-8 words, no brand names unless visibly printed, include material/type/category; empty string if not identifiable>", "identified": <true only if you can clearly see a specific product, false otherwise>, "confidence": "high"|"medium"|"low"}. Examples of identified items: "women\'s sleeveless A-line cotton dress", "stainless steel water bottle 750ml". If you cannot clearly see a product, set identified=false, itemDescription="", confidence="low". Respond with JSON only, no prose, no markdown fences.'
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return jsonResponse({ error: `Anthropic API error ${response.status}`, details: errText, itemDescription: '' }, 200);
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const raw = textBlock?.text || '';

    let parsed = { itemDescription: '' };
    try {
      // Strip any accidental markdown fences, then slice the first { to the
      // last } so leading/trailing prose doesn't break JSON.parse.
      let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        cleaned = cleaned.slice(first, last + 1);
      }
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      return jsonResponse({ error: 'Model returned non-JSON', raw, itemDescription: '' }, 200);
    }

    const itemDescription = typeof parsed.itemDescription === 'string' ? parsed.itemDescription.trim() : '';
    // Explicit "could I actually see a product?" signal so the app can be honest
    // instead of price-comparing a fabricated item (e.g. a bare price tag).
    const identified = parsed.identified === true && itemDescription.length > 0;
    const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : (identified ? 'medium' : 'low');
    return jsonResponse({ itemDescription, identified, confidence, usage: data.usage || null });
  } catch (error) {
    return jsonResponse({ error: error.message, itemDescription: '' }, 200);
  }
}

// ============================================================================
// ANALYZE PRICE — Price Scanner Phase P2.
// ============================================================================
// Given an OCR'd item description + a price + the country where the user is
// shopping (+ optionally their home country), Haiku returns:
//   - A 4-tier verdict (great_deal / fair_price / pricey / unknown)
//   - 3–5 alternatives at nearby stores or online with TYPICAL price ranges
//   - A 1–2 sentence GS Verdict
//   - A home-country reference line ("In the US, similar dresses run $20-40")
//
// HONESTY RULES (enforced in the system prompt):
//   - No exact prices — only ranges. Haiku doesn't have live pricing data.
//   - No "this exact item is at store X" claims. Only "similar items at
//     store X typically run Y-Z".
//   - For niche items / unknown brands / low-data countries, return
//     verdict='unknown' so the frontend renders "Not enough data to analyze"
//     instead of guessing.
//   - Every filled alternative is tagged source='estimated' on the way out.
//
// Cache key includes item description + currency + price bucket + country
// pair so repeat scans of the "same kind of item near the same price" share
// the cached analysis. 30-day TTL.
// ============================================================================

const ANALYZE_PRICE_TTL_SECONDS = 30 * 24 * 60 * 60;
const ANALYZE_PRICE_PROMPT_VERSION = 'ap2';  // ap1 -> ap2: handcraft/artisan support via comparisonType=similar_style; unknown is true-last-resort only

// Bucket the price into a coarse band so a $19 and $21 dress (same item type)
// share a cache entry. Avoids burning Haiku on every micro price diff while
// keeping the verdict ("good deal" vs "pricey") meaningful inside each band.
function bucketPrice(price) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (p < 100)   return Math.round(p / 10)   * 10;
  if (p < 1000)  return Math.round(p / 50)   * 50;
  if (p < 10000) return Math.round(p / 500)  * 500;
  return Math.round(p / 5000) * 5000;
}

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildAnalyzePricePrompt() {
  return `You are GlobeSkimmers' Price Analyzer. A traveler has scanned a price tag. Tell them whether the price is a good deal, where similar items are typically sold nearby (or online), and how the price compares to their home country.

HONESTY RULES (ABSOLUTE):
- You do NOT have real-time pricing data. You can name brands / chains / market types you know operate in the country and estimate the TYPICAL price range they charge for SIMILAR items.
- Always use price RANGES, never exact prices. ✅ "₱500-1,200" ✅ "$15-40" ❌ "₱990" ❌ "$24.99".
- Never claim a specific item is available at a specific store. ✅ "Similar A-line dresses at Uniqlo PH typically run ₱990-1,499" ❌ "Uniqlo has this dress for ₱990".
- Never editorialize ("rip-off", "scam", "overpriced for what it is"). Use neutral words: "above typical range", "below typical range".

COMPARISON TYPE — pick exactly one:
- "exact_match"   — Branded / mass-market / chain-store item where you can name 3+ comparable stores selling the SAME TYPE of item (e.g. branded clothing, electronics, packaged goods).
- "similar_style" — Handmade, artisan, local craft, market-stall item, or anything where the EXACT item won't be at chain stores but similar CATEGORY pieces are sold at artisan markets, craft cooperatives, local boutiques, or online artisan platforms (Etsy, local craft sections on Lazada / Shopee). Make the effort here — list the kinds of places that sell COMPARABLE handcrafted items in that style / category / material. Phrase notes like "comparable hand-carved wooden bowls" or "similar handmade silver earrings".
- "unknown"       — True last resort: very obscure niche, you cannot confidently name even 2 comparable category venues. Returns alternatives:[] and homeReference:null.

VERDICT TIERS:
- "great_deal"  — At least ~20% below the typical range for comparable items at known nearby places.
- "fair_price"  — Within the typical range.
- "pricey"      — At least ~20% above the typical range.
- "unknown"     — Use only when comparisonType is also 'unknown'.

VERDICT BADGES (use the EXACT strings):
- great_deal       → "💎 Great Deal"
- fair_price       → "✅ Fair Price"
- pricey           → "⚠️ Above Typical Range"
- unknown          → "❓ Not Enough Data to Analyze"

ALTERNATIVES (when comparisonType !== 'unknown'):
- 3 to 5 entries.
- For "exact_match": LOCAL brick-and-mortar stores in the country (scope='local') + 1–2 online options (Shein, ASOS, Amazon, Lazada, Shopee, Zalora — whatever's relevant to the region) tagged scope='online'. Use brand names travelers recognize ("Uniqlo PH", "H&M US").
- For "similar_style": artisan markets, craft cooperatives, local boutiques, weekend markets, souvenir districts — name them when you can ("Tabo-an Public Market", "Maginhawa weekend craft fair"); otherwise use category labels ("local artisan markets in Cebu", "handicraft cooperatives in the region"). Online: Etsy, Lazada's artisan / handicraft sections, Shopee's handmade sections.
- "store" includes a regional suffix when ambiguous.
- "priceRange" must use the SAME currency as the input price (don't auto-convert).
- "note" is ONE short clarifier of the style/category match. For exact_match: dish/style/category. For similar_style: explicitly call out the look-alike framing ("comparable hand-painted ceramic mugs", "similar silver filigree style").

HOME REFERENCE:
- If homeCountry is provided AND different from country: ONE short sentence comparing typical prices in the home country (using the home country's local currency or USD if uncertain).
  - exact_match example: "In the US, similar dresses typically run $15-40 at Target / Old Navy / H&M."
  - similar_style example: "In the US, comparable handmade silver earrings typically run $25-80 on Etsy or at independent jewelers."
- If homeCountry is null OR same as country OR you can't estimate confidently: return null.

GS VERDICT:
- 1–2 short sentences synthesizing the call. Reference the alternatives in passing.
  - exact_match: "Fair price for fast-fashion in PH — in line with what Uniqlo, H&M, and Zara charge for similar casual dresses."
  - similar_style: "Fair price for a hand-carved wooden bowl this size — comparable pieces at Cebu's artisan markets typically run ₱400-900."
  - unknown: "Not enough data to analyze this item right now. Try a price-comparison site or scan a more common item."
- Keep under 240 chars.

OUTPUT JSON ONLY (no markdown fences, no prose outside the JSON):
{
  "verdict": "great_deal" | "fair_price" | "pricey" | "unknown",
  "verdictBadge": "<badge string per the mapping above>",
  "comparisonType": "exact_match" | "similar_style" | "unknown",
  "gsVerdict": "<1-2 sentence summary>",
  "alternatives": [
    { "store": "...", "scope": "local" | "online", "priceRange": "...", "note": "..." },
    ...
  ],
  "homeReference": "<one short sentence>" | null,
  "confidence": "high" | "medium" | "low",
  "_sources": {
    "verdict":       "estimated",
    "alternatives":  "estimated",
    "homeReference": "estimated"
  }
}

Return JSON only.`;
}

async function handleAnalyzePrice(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  let body;
  try { body = await request.json(); } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const itemDescription = (body?.itemDescription || '').toString().trim().slice(0, 200);
  const price = Number(body?.price);
  const currency = (body?.currency || '').toString().trim().toUpperCase().slice(0, 4);
  const country = (body?.country || '').toString().trim().slice(0, 80);
  const homeCountry = (body?.homeCountry || '').toString().trim().slice(0, 80);

  if (!itemDescription || !Number.isFinite(price) || price <= 0 || !currency) {
    return jsonResponse({ error: 'itemDescription, price, currency required' }, 400);
  }

  // Cache key. Lowercase + collapse whitespace so "Women's Dress" and
  // "WOMEN'S  DRESS " share. priceBucket lets prices within the same band
  // share. homeCountry is part of the key because the homeReference line
  // depends on it.
  const itemNorm = itemDescription.toLowerCase().replace(/\s+/g, ' ');
  const priceB = bucketPrice(price);
  const keyMaterial = `${itemNorm}|${currency}|${priceB}|${country.toLowerCase()}|${homeCountry.toLowerCase()}`;
  const keyHash = await sha256Hex(keyMaterial);
  const cacheKey = `price_analysis:${ANALYZE_PRICE_PROMPT_VERSION}:${keyHash}`;

  if (env.GLOBESKIMMERS_KV) {
    const cached = await env.GLOBESKIMMERS_KV.get(cacheKey, { type: 'json' }).catch(() => null);
    if (cached) return jsonResponse({ analysis: cached, _cache: 'hit' });
  }

  const userContent = `INPUT:
${JSON.stringify({ itemDescription, price, currency, country: country || null, homeCountry: homeCountry || null }, null, 2)}

Produce the Price Analysis JSON per the rules above. Remember: price RANGES only, every alternative tagged 'estimated', verdict='unknown' if you can't confidently name 3+ comparable nearby stores.`;

  let analysis;
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        // Sonnet (not Haiku) for the price analysis — more precise verdicts and
        // similar-item estimates. Matches scan-prices + describe-item. Results
        // are cached per (item + currency + price bucket + country), so the
        // higher per-call cost is paid once per product type.
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: buildAnalyzePricePrompt(),
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return jsonResponse({ error: 'Claude API error', status: apiRes.status, details: errText }, 502);
    }
    const data = await apiRes.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    analysis = JSON.parse(cleaned);
  } catch (e) {
    return jsonResponse({ error: 'Claude parse error: ' + e.message }, 500);
  }

  // Defensive normalization.
  const sanitizeStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const VERDICTS = new Set(['great_deal', 'fair_price', 'pricey', 'unknown']);
  const VERDICT_BADGES = {
    great_deal: '💎 Great Deal',
    fair_price: '✅ Fair Price',
    pricey:     '⚠️ Above Typical Range',
    unknown:    '❓ Not Enough Data to Analyze',
  };
  if (!VERDICTS.has(analysis.verdict)) analysis.verdict = 'unknown';
  // Force the badge to match the verdict so a slipped prompt response can't
  // render an inconsistent chip ("pricey" verdict + "Great Deal" badge).
  analysis.verdictBadge = VERDICT_BADGES[analysis.verdict];

  // comparisonType (ap2): drives the frontend's alternatives header. Forced
  // to 'unknown' whenever the verdict is unknown so the two are consistent.
  // For non-unknown verdicts, default to 'exact_match' if the model didn't
  // tag (legacy ap1 responses).
  const COMPARISON_TYPES = new Set(['exact_match', 'similar_style', 'unknown']);
  if (analysis.verdict === 'unknown') {
    analysis.comparisonType = 'unknown';
  } else if (!COMPARISON_TYPES.has(analysis.comparisonType)) {
    analysis.comparisonType = 'exact_match';
  }

  analysis.gsVerdict = sanitizeStr(analysis.gsVerdict)
    || (analysis.verdict === 'unknown'
      ? 'Not enough data to analyze this item right now. Try a price-comparison site or scan a more common item.'
      : 'Price reviewed.');

  // Cap gsVerdict at 240 chars.
  if (analysis.gsVerdict.length > 240) analysis.gsVerdict = analysis.gsVerdict.slice(0, 238).trim() + '…';

  if (!Array.isArray(analysis.alternatives) || analysis.comparisonType === 'unknown') {
    analysis.alternatives = [];
  } else {
    const VALID_SCOPES = new Set(['local', 'online']);
    analysis.alternatives = analysis.alternatives
      .map(a => {
        if (!a || typeof a !== 'object') return null;
        const store = sanitizeStr(a.store);
        const scope = VALID_SCOPES.has(a.scope) ? a.scope : 'local';
        const priceRange = sanitizeStr(a.priceRange);
        const note = sanitizeStr(a.note);
        return store && priceRange ? { store, scope, priceRange, note } : null;
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  analysis.homeReference = (analysis.comparisonType === 'unknown') ? null : sanitizeStr(analysis.homeReference);
  analysis.confidence = ['high', 'medium', 'low'].includes(analysis.confidence) ? analysis.confidence : 'low';

  // _sources — pin to 'estimated' for every renderable; any other claim is
  // a violation of the prompt's honesty rules. The frontend's stamp UI uses
  // these to label every line as inferred-not-verified.
  analysis._sources = {
    verdict: 'estimated',
    alternatives: 'estimated',
    homeReference: 'estimated',
  };

  if (env.GLOBESKIMMERS_KV) {
    await env.GLOBESKIMMERS_KV.put(cacheKey, JSON.stringify(analysis), { expirationTtl: ANALYZE_PRICE_TTL_SECONDS }).catch(() => {});
  }

  return jsonResponse({ analysis, _cache: 'miss' });
}

// ─────────────────────────────────────────────────────────────────────
// Phase C — AI details permanent D1 cache (for /attraction-ai-details)
// ─────────────────────────────────────────────────────────────────────
// Replaces the 30-day KV TTL cache with a permanent D1 cache so we
// only ever pay Haiku ONCE per attraction. Every subsequent request
// for the same placeId returns the cached JSON in <50ms, $0.

// Read a cached AI details payload from D1 keyed by placeId. Returns
// null on miss (D1 binding absent, no row, prompt version drift, or
// any DB error). Designed to be best-effort — a D1 hiccup falls
// through to the existing KV/Haiku path silently.
async function readAttractionAiFromD1(env, placeId, promptVersion) {
  if (!env.ATTRACTIONS_DB) return null;
  try {
    const row = await env.ATTRACTIONS_DB
      .prepare('SELECT ai_json, prompt_version FROM attraction_ai_details WHERE place_id = ?')
      .bind(placeId)
      .first();
    if (!row) return null;
    // Reject rows generated under an older prompt version — forces a
    // regeneration with the current prompt schema rather than serving
    // stale shape that the frontend may no longer understand.
    if (row.prompt_version !== promptVersion) return null;
    try { return JSON.parse(row.ai_json); } catch { return null; }
  } catch {
    return null;
  }
}

// Persist an AI details payload to D1 for permanent reuse. INSERT OR
// REPLACE so a fresh prompt-version regen overwrites the older row
// for the same place_id. Best-effort — any DB error is swallowed
// because the call site already returned the response to the user.
async function writeAttractionAiToD1(env, placeId, promptVersion, aiDetails, placeName) {
  if (!env.ATTRACTIONS_DB) return;
  try {
    await env.ATTRACTIONS_DB.prepare(`
      INSERT OR REPLACE INTO attraction_ai_details
        (place_id, place_name, prompt_version, ai_json, generated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      placeId,
      placeName || null,
      promptVersion,
      JSON.stringify(aiDetails),
    ).run();
  } catch (e) {
    console.error('attraction_ai_details write failed:', e?.message);
  }
}

// Cafe work-profile D1 cache (same best-effort pattern as the attraction helpers).
async function readCafeWorkFromD1(env, placeId, promptVersion) {
  if (!env.ATTRACTIONS_DB) return null;
  try {
    const row = await env.ATTRACTIONS_DB
      .prepare('SELECT work_json, prompt_version FROM cafe_work_profiles WHERE place_id = ?')
      .bind(placeId)
      .first();
    if (!row || row.prompt_version !== promptVersion) return null;
    try { return JSON.parse(row.work_json); } catch { return null; }
  } catch {
    return null;
  }
}

async function writeCafeWorkToD1(env, placeId, promptVersion, workProfile, placeName) {
  if (!env.ATTRACTIONS_DB) return;
  try {
    await env.ATTRACTIONS_DB.prepare(`
      INSERT OR REPLACE INTO cafe_work_profiles
        (place_id, place_name, prompt_version, work_json, generated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      placeId,
      placeName || null,
      promptVersion,
      JSON.stringify(workProfile),
    ).run();
  } catch (e) {
    console.error('cafe_work_profiles write failed:', e?.message);
  }
}

// ============================================================================
// LOCATION — reverse geocode (coords→city) + location text search.
// Ported from base44/functions/{reverseGeocode,searchLocation} for the native
// data path (Phase 7). OPEN routes (no per-user data), use env.GOOGLE_API_KEY.
// NOTE: /reverse-geocode needs the Geocoding API enabled on that key.
// ============================================================================
async function handleReverseGeocode(request, env) {
  let body;
  try { body = await request.json(); } catch (_e) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }
  const { latitude, longitude } = body || {};
  if (latitude == null || longitude == null) {
    return jsonResponse({ error: 'Latitude and longitude are required' }, 400);
  }

  // Transient performance cache (ToS-safe BRIDGE, ~30d). A coarse ~0.1° (~11km)
  // tile's city/state/country basically never changes, so caching it slashes
  // repeat Google Geocoding calls (and speeds every location naming in the app).
  // NOT a permanent copy of Google data — only coarse ADMIN fields are cached
  // (never the precise street formatted_address), for a bounded TTL. Retires
  // entirely once we reverse-geocode from our own OSM/Overture data.
  const rLat = Math.round(Number(latitude) * 10) / 10;
  const rLng = Math.round(Number(longitude) * 10) / 10;
  const revKey = `revgeo_${rLat}_${rLng}`;
  const REVGEO_TTL_SECONDS = 30 * 24 * 60 * 60;
  const canCache = env.GLOBESKIMMERS_KV && Number.isFinite(rLat) && Number.isFinite(rLng);
  if (canCache) {
    const hit = await env.GLOBESKIMMERS_KV.get(revKey, { type: 'json' }).catch(() => null);
    if (hit && hit.country != null) {
      const formatted_address = [hit.city, hit.state_or_country].filter(Boolean).join(', ');
      return jsonResponse({ ...hit, latitude, longitude, formatted_address, cached: true });
    }
  }

  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'Google API key not configured' }, 500);
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return jsonResponse({ error: 'Geocoding API request failed', details: await response.text() }, 502);
    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.length) {
      return jsonResponse({ error: 'Geocoding error', details: data.status }, 502);
    }
    const result = data.results[0];
    const comps = result.address_components || [];
    const cityComponent = comps.find(c =>
      c.types.includes('locality') || c.types.includes('sublocality') ||
      c.types.includes('postal_town') || c.types.includes('administrative_area_level_3') ||
      c.types.includes('administrative_area_level_2'));
    const stateComponent = comps.find(c => c.types.includes('administrative_area_level_1'));
    const countryComponent = comps.find(c => c.types.includes('country'));
    const city = cityComponent?.long_name || '';
    const country = countryComponent?.long_name || '';
    const stateOrCountry = (countryComponent?.short_name === 'US' || countryComponent?.short_name === 'CA')
      ? (stateComponent?.long_name || country) : country;

    // Cache only the coarse admin fields (~30d). The precise street
    // formatted_address is returned fresh but NOT cached (not coarse-safe).
    if (canCache) {
      await env.GLOBESKIMMERS_KV.put(revKey, JSON.stringify({ city, state_or_country: stateOrCountry, country }), { expirationTtl: REVGEO_TTL_SECONDS }).catch(() => {});
    }

    return jsonResponse({ city, state_or_country: stateOrCountry, country, latitude, longitude, formatted_address: result.formatted_address });
  } catch (e) {
    return jsonResponse({ error: 'Internal server error', details: e.message }, 500);
  }
}

function haversineMilesLoc(lat1, lon1, lat2, lon2) {
  const R = 3959, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function handleSearchLocation(request, env) {
  let body;
  try { body = await request.json(); } catch (_e) { return jsonResponse({ error: 'Invalid request', results: [] }, 200); }
  const query = body?.query;
  if (!query || typeof query !== 'string') {
    return jsonResponse({ error: 'Query required', message: 'Please enter a search term', results: [] }, 200);
  }
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'Service unavailable', results: [] }, 200);

  const isHotelSearch = /hotel|lodging|accommodation/i.test(query);
  const requestBody = { textQuery: query, ...(isHotelSearch && { includedType: 'lodging', rankPreference: 'RELEVANCE' }) };

  let response;
  try {
    response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.viewport,places.addressComponents,places.types,places.primaryType',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (_e) { return jsonResponse({ error: 'Network error', results: [] }, 200); }
  if (!response.ok) return jsonResponse({ error: 'Location search unavailable', results: [] }, 200);

  let data;
  try { data = await response.json(); } catch (_e) { return jsonResponse({ error: 'Invalid response', results: [] }, 200); }
  if (data.error) return jsonResponse({ error: `Google API Error: ${data.error.message || data.error.status}`, results: [] }, 200);
  if (!data.places?.length) {
    return jsonResponse({ results: [], message: isHotelSearch ? 'No hotels found. Try a specific hotel name or area.' : 'No locations found. Try a different search term.' }, 200);
  }

  const results = [];
  let rejectedTooBroadCount = 0;
  for (const place of data.places.slice(0, 8)) {
    const types = place.types || [];
    const primaryType = place.primaryType || '';
    const hasSpecificType = types.some(t => ['street_address','premise','point_of_interest','establishment','airport','train_station','transit_station','bus_station','subway_station','tourist_attraction','lodging','restaurant','park','shopping_mall','store','museum','stadium','university','school','cafe'].includes(t))
      || ['airport','lodging','tourist_attraction','shopping_mall','store','restaurant','train_station','museum','park'].includes(primaryType);
    const isStreetAddress = types.includes('street_address') || types.includes('premise');
    const isCity = types.includes('locality') || types.includes('sublocality') || types.includes('postal_town');
    const isState = types.includes('administrative_area_level_1') && !isCity;
    const isCountry = types.includes('country') && !types.includes('administrative_area_level_1') && !isCity;
    let granularity;
    if (isStreetAddress) granularity = 'address';
    else if (hasSpecificType) granularity = 'place';
    else if (isCity) granularity = 'city';
    else if (isState) granularity = 'state';
    else if (isCountry) granularity = 'country';
    else granularity = 'place';
    if (granularity === 'state' || granularity === 'country') { rejectedTooBroadCount++; continue; }

    const c = place.addressComponents || [];
    const streetNumber = c.find(x => x.types.includes('street_number'))?.longText || '';
    const route = c.find(x => x.types.includes('route'))?.longText || '';
    const street = streetNumber && route ? `${streetNumber} ${route}` : route || streetNumber;
    const city = c.find(x => x.types.includes('locality'))?.longText || c.find(x => x.types.includes('sublocality'))?.longText || c.find(x => x.types.includes('postal_town'))?.longText || '';
    const state = c.find(x => x.types.includes('administrative_area_level_1'))?.shortText || '';
    const region = c.find(x => x.types.includes('administrative_area_level_2'))?.longText || '';
    const postalCode = c.find(x => x.types.includes('postal_code'))?.longText || '';
    const countryComp = c.find(x => x.types.includes('country'));
    const country = countryComp?.longText || '';
    const stateOrCountry = (countryComp?.shortText === 'US' || countryComp?.shortText === 'CA') ? (state || country) : country;

    let placeType = 'location';
    if (types.includes('airport') || primaryType === 'airport') placeType = 'airport';
    else if (types.includes('lodging') || primaryType === 'lodging') placeType = 'hotel';
    else if (types.includes('restaurant') || primaryType === 'restaurant') placeType = 'restaurant';
    else if (types.includes('shopping_mall') || types.includes('store') || primaryType === 'shopping_mall') placeType = 'shopping';
    else if (types.includes('tourist_attraction') || types.includes('museum') || primaryType === 'tourist_attraction') placeType = 'attraction';
    else if (types.includes('park') || primaryType === 'park') placeType = 'park';
    else if (types.includes('transit_station') || types.includes('train_station') || types.includes('bus_station') || primaryType === 'train_station') placeType = 'transit';

    let suggestedRadius = null;
    if (granularity === 'city') {
      const vp = place.viewport;
      if (vp?.high?.latitude && vp?.low?.latitude) {
        const halfDiagMi = haversineMilesLoc(vp.high.latitude, vp.high.longitude, vp.low.latitude, vp.low.longitude) / 2;
        suggestedRadius = Math.max(5, Math.min(25, Math.round(halfDiagMi)));
      } else suggestedRadius = 15;
    }

    results.push({
      placeId: place.id,
      placeName: place.displayName?.text || '',
      granularity,
      suggestedRadius,
      address: { formatted: place.formattedAddress || '', street, city, region, state, postalCode, country },
      coordinates: { latitude: place.location?.latitude || 0, longitude: place.location?.longitude || 0 },
      placeType,
      types,
      city: place.displayName?.text || city,
      state_or_country: stateOrCountry,
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      full_name: place.formattedAddress || '',
    });
  }

  if (results.length === 0) {
    const message = rejectedTooBroadCount > 0
      ? "That's too broad — please add a city (e.g. \"Paris, France\") or pick a specific address or landmark."
      : 'No locations found. Try a different search term.';
    return jsonResponse({ results: [], message }, 200);
  }
  return jsonResponse({ results }, 200);
}

// ─────────────────────────────────────────────────────────────────────
// Phase B helpers — auto-seed for non-launch cities
// ─────────────────────────────────────────────────────────────────────
// When a user visits a city not in the Phase A curated launch seed,
// /attractions/nearby returns empty, the Base44 backend falls back to
// the slow Places-based discovery path, AND in the background the
// Worker fires off a one-time seed task. The next visitor to that
// same city gets the fast D1 path automatically — the app self-seeds.

// Google Places type -> our D1 category enum. Any returned types not
// in this map cause the place to be REJECTED (we don't want
// restaurants, hotels, gas stations, etc. polluting the static
// attractions DB).
const PLACES_TYPE_TO_CATEGORY = {
  tourist_attraction:   'landmark',
  museum:               'museum',
  art_gallery:          'art_gallery',
  park:                 'park',
  national_park:        'national_park',
  amusement_park:       'theme_park',
  water_park:           'theme_park',
  zoo:                  'zoo',
  aquarium:             'aquarium',
  natural_feature:      'viewpoint',
  beach:                'beach',
  historical_landmark:  'historic',
  monument:             'monument',
  church:               'religious',
  mosque:               'mosque',
  hindu_temple:         'temple',
  synagogue:            'religious',
  place_of_worship:     'religious',
  garden:               'garden',
  observation_deck:     'observation_deck',
  fortress:             'fortress',
  castle:               'palace',
  shrine:               'shrine',
};

// Places types we explicitly do NOT want — these have to fall fully
// outside the staple categories or get filtered out even when they
// also carry a usable type. Belt-and-suspenders against Places
// returning a museum that's "also" a cafe.
const PLACES_REJECT_TYPES = new Set([
  'restaurant','food','cafe','bar','night_club','bakery',
  'lodging','hotel','rv_park',
  'shopping_mall','store','clothing_store','grocery_store','supermarket',
  'gas_station','parking','car_rental','car_dealer','car_repair',
  'bank','atm','accounting','insurance_agency','real_estate_agency',
  'hospital','doctor','dentist','pharmacy','health',
  'school','university','library','primary_school','secondary_school',
  'gym','beauty_salon','hair_care','spa',
  'post_office','police','courthouse','embassy',
  'movie_theater','bowling_alley','casino','liquor_store',
  'taxi_stand','transit_station','airport','bus_station','subway_station',
]);

// Slug helper for auto-seeded ids. Mirrors emit_d1_seed.py's logic so
// curated and auto-seeded entries share the same id format.
function autoSeedSlug(name, country, city) {
  const parts = [country.toLowerCase().replace(/\s+/g, '-')];
  if (city) parts.push(city.toLowerCase().replace(/\s+/g, '-'));
  parts.push(
    name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)
  );
  return 'auto:' + parts.join('-');
}

// Pick the best D1 category for a Place. Walks `types` in order, takes
// the first hit on PLACES_TYPE_TO_CATEGORY, and rejects (returns null)
// if any reject type is present.
function categorizePlace(place) {
  const types = place.types || [];
  if (types.some((t) => PLACES_REJECT_TYPES.has(t))) return null;
  for (const t of types) {
    if (PLACES_TYPE_TO_CATEGORY[t]) return PLACES_TYPE_TO_CATEGORY[t];
  }
  // No staple-type match — reject. We only seed places we can confidently
  // categorize, not generic POIs.
  return null;
}

// Auto-marquee: a place qualifies as marquee when it's strongly rated
// AND broadly reviewed. Tuned conservatively so the auto-seed doesn't
// flood the marquee tier with random parks that happen to have
// 5-star ratings from 50 reviewers.
function isAutoMarquee(place) {
  const rating = place.rating || 0;
  const count = place.userRatingCount || 0;
  return rating >= 4.5 && count >= 1500;
}

// Determine free_to_visit from category. Conservative — only flag
// categories where the answer is almost always yes (parks, viewpoints,
// public plazas). Museums / theme parks / observation decks default
// to false even though some are free; the live Places hit at detail-
// tap time corrects this when needed.
const FREE_CATEGORIES = new Set([
  'park','national_park','viewpoint','beach','waterfall',
  'nature_reserve','garden','river','lake','square','district',
]);

// Quality filter — only seed places that meet the bar. Returns true if
// the place is worth saving.
function passesSeedQuality(place) {
  if (!place.displayName?.text && !place.name) return false;
  if (!place.location?.latitude || !place.location?.longitude) return false;
  if ((place.rating || 0) < 4.0) return false;
  if ((place.userRatingCount || 0) < 100) return false;
  return true;
}

// Build the D1 row record from a Google Places result.
function placeToAttractionRow(place, city, country) {
  const cat = categorizePlace(place);
  if (!cat) return null;
  if (!passesSeedQuality(place)) return null;

  const name = (place.displayName?.text || place.name || '').trim();
  const lat = place.location.latitude;
  const lng = place.location.longitude;
  const desc = (place.editorialSummary?.text || place.editorialSummary || '').toString().trim();
  const marquee = isAutoMarquee(place);
  const freeToVisit = FREE_CATEGORIES.has(cat);

  // Typical visit duration heuristic by category — same buckets the
  // curators used for the hand-seeded launch set, just programmatic
  // instead of human-judged.
  const minutesByCategory = {
    museum: 120, art_gallery: 90, theme_park: 240, water_park: 240,
    zoo: 180, aquarium: 90, national_park: 240, park: 60,
    viewpoint: 30, beach: 120, waterfall: 60, garden: 60,
    landmark: 60, monument: 30, historic: 60,
    religious: 45, mosque: 45, temple: 45, shrine: 45,
    cathedral: 60, palace: 90, tower: 60, observation_deck: 60,
    fortress: 90, district: 90, square: 30, market: 90,
    nature_reserve: 180, river: 45, lake: 60, wildlife: 180,
    experience: 120,
  };

  return {
    id: autoSeedSlug(name, country, city),
    name,
    category: cat,
    lat,
    lng,
    city: city || '',
    country,
    description: desc,
    why_visit: '',  // empty — only the human-curated launch set has why_visit
    typical_minutes: minutesByCategory[cat] || 60,
    rating: place.rating || null,
    is_marquee: marquee ? 1 : 0,
    free_to_visit: freeToVisit ? 1 : 0,
  };
}

// One round of seed queries for a region. Hits the Worker's own
// /places/text-search via internal request (which uses the existing
// GLOBESKIMMERS_KV cache, so repeat runs are free).
const SEED_QUERY_TEMPLATES = [
  'top tourist attractions in {region}',
  'famous landmarks in {region}',
  'must see places in {region}',
  'museums in {region}',
  'parks in {region}',
  'historic sites in {region}',
  'temples in {region}',
  'monuments in {region}',
];

async function runSeedDiscovery(env, city, country, lat, lng) {
  const region = city || country;
  const tasks = SEED_QUERY_TEMPLATES.map(async (tpl) => {
    const query = tpl.replace('{region}', region);
    const url = new URL('https://internal/places/text-search');
    url.searchParams.set('query', query);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set('radius', '40000'); // 40km — covers a major city
    url.searchParams.set('maxResults', '15');
    url.searchParams.set('cacheTtl', String(60 * 60 * 24 * 7)); // 7-day TTL
    try {
      const res = await handleTextSearch(new Request(url), env);
      if (!res.ok) return [];
      const data = await res.json();
      return data.places || [];
    } catch {
      return [];
    }
  });
  const batches = await Promise.all(tasks);
  // Dedupe by place id
  const byId = new Map();
  for (const batch of batches) {
    for (const p of batch) {
      if (p.id) byId.set(p.id, p);
    }
  }
  return [...byId.values()];
}

// Returns true if this region was attempted recently and we should
// skip a fresh seed run. Conservative 24h throttle window.
async function wasSeededRecently(env, regionKey) {
  if (!env.ATTRACTIONS_DB) return true; // no DB → can't throttle, assume yes (skip)
  try {
    const stmt = env.ATTRACTIONS_DB
      .prepare("SELECT attempted_at FROM seed_attempts WHERE region_key = ?");
    const row = await stmt.bind(regionKey).first();
    if (!row) return false;
    const last = new Date(row.attempted_at).getTime();
    return Date.now() - last < 24 * 3600 * 1000;
  } catch {
    return true; // err on the side of "skip" so a broken throttle doesn't loop-seed
  }
}

// Run the actual seed for a region. Discovery + categorize + filter +
// INSERT OR IGNORE + record attempt. Designed to run inside
// ctx.waitUntil() so it doesn't block the user response.
async function seedCityNow(env, lat, lng, cityName, countryName) {
  if (!env.ATTRACTIONS_DB) return;
  const city = (cityName || '').trim();
  const country = (countryName || '').trim();
  if (!country) return;

  const regionKey = `${city.toLowerCase()}::${country.toLowerCase()}`;

  if (await wasSeededRecently(env, regionKey)) return;

  let foundCount = 0;
  let insertedCount = 0;
  let status = 'ok';
  let notes = '';

  try {
    const places = await runSeedDiscovery(env, city, country, lat, lng);
    foundCount = places.length;

    const rows = [];
    for (const p of places) {
      const row = placeToAttractionRow(p, city, country);
      if (row) rows.push(row);
    }

    if (rows.length > 0) {
      // Bulk INSERT OR IGNORE. SQLite supports multi-row VALUES but D1's
      // statement size limit is generous (~1MB) — fits hundreds of rows
      // easily, but we batch in groups of 50 to keep query plans
      // predictable and avoid hitting any per-statement quirks.
      const insertSql = `
        INSERT OR IGNORE INTO attractions
          (id, name, category, lat, lng, city, country, description,
           why_visit, typical_minutes, rating, is_marquee, free_to_visit,
           source, last_reviewed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto-seeded', date('now'))
      `;
      for (const r of rows) {
        try {
          const result = await env.ATTRACTIONS_DB
            .prepare(insertSql)
            .bind(r.id, r.name, r.category, r.lat, r.lng, r.city, r.country,
                  r.description, r.why_visit, r.typical_minutes, r.rating,
                  r.is_marquee, r.free_to_visit)
            .run();
          // D1's run() returns { meta: { changes: 0|1 } } — 0 means the
          // OR IGNORE took (row already existed).
          if (result?.meta?.changes > 0) insertedCount += 1;
        } catch (e) {
          notes = (e?.message || 'insert failed').slice(0, 500);
        }
      }
    } else {
      notes = 'no_quality_matches';
    }
  } catch (e) {
    status = 'error';
    notes = (e?.message || 'discovery failed').slice(0, 500);
  }

  // Record the attempt regardless of outcome (so the throttle works
  // even when discovery returned nothing).
  try {
    await env.ATTRACTIONS_DB.prepare(`
      INSERT OR REPLACE INTO seed_attempts
        (region_key, city, country, trigger_lat, trigger_lng,
         attempted_at, found_count, inserted_count, status, notes)
      VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)
    `).bind(
      regionKey, city, country, lat, lng,
      foundCount, insertedCount, status, notes
    ).run();
  } catch (e) {
    console.error('seed_attempts insert failed:', e?.message);
  }

  console.log(`🌱 seed-city: ${city || '(no city)'}, ${country} → found=${foundCount}, inserted=${insertedCount}, status=${status}${notes ? ', notes=' + notes : ''}`);
}

// HTTP endpoint version. Lets you trigger a seed manually for testing:
//   curl -X POST .../attractions/seed-city -d '{...}'
// In production, this is mostly invoked indirectly via ctx.waitUntil
// from handleAttractionsNearby when D1 returns sparse.
async function handleSeedCity(request, env) {
  if (!env.ATTRACTIONS_DB) {
    return jsonResponse({ ok: false, reason: 'ATTRACTIONS_DB binding not present' }, 200);
  }
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }
  const { latitude, longitude, cityName, countryName } = body || {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return jsonResponse({ error: 'latitude and longitude required' }, 400);
  }
  if (!countryName || !String(countryName).trim()) {
    return jsonResponse({ error: 'countryName required' }, 400);
  }
  // Synchronous when called as an HTTP endpoint so you can see the
  // result. When called via waitUntil from handleAttractionsNearby it
  // already runs asynchronously without blocking the response.
  await seedCityNow(env, latitude, longitude, cityName || '', countryName);
  return jsonResponse({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────
// /attractions/nearby — D1 attractions seed lookup
// ─────────────────────────────────────────────────────────────────────
// Reads the static attractions D1 database (table `attractions`) and
// returns nearby marquee + regional icons in a single round-trip.
// Replaces ~70 sequential Places calls with one SQL query, cutting
// ThingsToDo mobile cold-load from 30s → ~500ms.
//
// See cloudflare-worker/handlers/handleAttractionsNearby.js for the
// reference design + full doc comment. This in-file copy is the
// version the deployed Worker actually loads.
//
// Phase B: when ctx is passed in AND the D1 query returns sparse
// results (<5) AND the request body includes cityName + countryName,
// schedules a background seed-city task via ctx.waitUntil so the next
// visitor to this region gets the fast D1 path automatically. The
// background task is rate-limited via the seed_attempts table (1
// attempt per region per 24h).
async function handleAttractionsNearby(request, env, ctx) {
  const startedAt = Date.now();

  // Tolerate missing binding so the Base44 backend can roll out a
  // call to this endpoint BEFORE D1 is provisioned. Returns empty
  // payload, not an error, so the existing Places-based path takes over.
  if (!env.ATTRACTIONS_DB) {
    return jsonResponse({
      source: 'd1',
      attractions: [],
      tookMs: Date.now() - startedAt,
      note: 'ATTRACTIONS_DB binding not present — falling back to Places',
    });
  }

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const {
    latitude,
    longitude,
    radiusKm = 80,
    categories = null,
    limit = 60,
    marqueeOnly = false,
    // Phase B: client passes these so the Worker can trigger a
    // background seed when D1 returns sparse coverage. Empty strings
    // are tolerated (and skip seeding) for fresh-GPS lookups before
    // reverse-geocode has resolved.
    cityName = '',
    countryName = '',
  } = body || {};

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return jsonResponse({ error: 'latitude and longitude required' }, 400);
  }

  // Bounding box prefilter. 1° lat ≈ 111 km; longitude width shrinks
  // toward the poles by cos(lat). The box is a CHEAP indexed query
  // (uses the indexed lat/lng columns); we re-rank by true great-circle
  // distance after the rows come back. Slightly larger box than the
  // requested radius lets the haversine pass do the precise circle clip
  // without missing edge cases.
  const latDelta = (radiusKm * 1.05) / 111;
  const lngDelta = (radiusKm * 1.05) / (111 * Math.cos(latitude * Math.PI / 180) || 1);
  const minLat = latitude - latDelta;
  const maxLat = latitude + latDelta;
  const minLng = longitude - lngDelta;
  const maxLng = longitude + lngDelta;

  const wheres = ['lat BETWEEN ? AND ?', 'lng BETWEEN ? AND ?'];
  const params = [minLat, maxLat, minLng, maxLng];

  if (Array.isArray(categories) && categories.length > 0) {
    const placeholders = categories.map(() => '?').join(',');
    wheres.push(`category IN (${placeholders})`);
    params.push(...categories);
  }

  if (marqueeOnly === true) {
    wheres.push('is_marquee = 1');
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 60, 200));

  const sql = `
    SELECT id, name, category, lat, lng, city, country, description,
           why_visit, typical_minutes, photo_url, rating,
           is_marquee, free_to_visit
      FROM attractions
     WHERE ${wheres.join(' AND ')}
  ORDER BY is_marquee DESC, rating DESC
     LIMIT ${safeLimit};
  `;

  let rows;
  try {
    const stmt = env.ATTRACTIONS_DB.prepare(sql).bind(...params);
    const result = await stmt.all();
    rows = result.results || [];
  } catch (err) {
    // Graceful degradation: log + return empty so caller falls back
    // to Places. Worker logs surface this during dev; we don't want
    // a D1 hiccup to take down ThingsToDo.
    console.error('attractions/nearby D1 query failed:', err?.message);
    return jsonResponse({
      source: 'd1',
      attractions: [],
      tookMs: Date.now() - startedAt,
      error: err?.message || 'D1 query failed',
    });
  }

  // Haversine pass — refine the bounding-box prefilter to a true
  // circular radius and compute distance miles for each row.
  const R_KM = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const enriched = rows.map((r) => {
    const dLat = toRad(r.lat - latitude);
    const dLng = toRad(r.lng - longitude);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(latitude)) * Math.cos(toRad(r.lat)) *
              Math.sin(dLng / 2) ** 2;
    const distKm = R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      lat: r.lat,
      lng: r.lng,
      city: r.city || '',
      country: r.country,
      description: r.description || '',
      whyVisit: r.why_visit || '',
      typicalMinutes: r.typical_minutes ?? null,
      photoUrl: r.photo_url || null,
      rating: r.rating ?? null,
      isMarquee: r.is_marquee === 1,
      freeToVisit: r.free_to_visit === 1,
      distanceKm: distKm,
      distanceMiles: distKm * 0.621371,
    };
  });

  // Drop rows outside the true circle (bounding box can include
  // corners up to ~1.4x the radius). Re-sort by marquee-first +
  // rating + distance — stable so distance ties preserve the D1
  // ordering.
  const within = enriched.filter((r) => r.distanceKm <= radiusKm);
  within.sort((a, b) => {
    if (a.isMarquee !== b.isMarquee) return a.isMarquee ? -1 : 1;
    const ra = a.rating ?? 0, rb = b.rating ?? 0;
    if (ra !== rb) return rb - ra;
    return a.distanceKm - b.distanceKm;
  });

  // Phase B background seed trigger. When D1 has sparse coverage for
  // this region AND we have the city/country labels to identify it,
  // kick off a discovery+seed task that runs after the response. The
  // throttle inside seedCityNow() means we attempt at most once per
  // region per 24h, so a stampede of users hitting Boise on day 1
  // results in a SINGLE seed run, not 10,000.
  if (ctx && within.length < 5 && countryName) {
    ctx.waitUntil(seedCityNow(env, latitude, longitude, cityName, countryName));
  }

  return jsonResponse({
    source: 'd1',
    tookMs: Date.now() - startedAt,
    attractions: within,
  });
}

// ============================================================================
// LIVING HOMEPAGE ROWS — POST /home/rows
// Assembles 2–3 photo-forward carousels ENTIRELY from owned data (ATTRACTIONS_DB
// / D1) + light context (day-part, weather, season — passed by the client from
// homeContext.js). ZERO new Google Places calls. The assembled bundle is cached
// in KV so repeat opens are one KV read; rows reshuffle across the day because
// the cache key includes dayPart + weather.
// Body: { latitude, longitude, localHour?, weather?, season?, cityName?, countryName? }
// Returns: { rows:[{ key, title, subtitle, seeAll, cards:[...] }], dayPart, cached }
// FOLLOW-UPS (not yet wired): Unsplash inspiration rows (needs UNSPLASH_ACCESS_KEY,
// makes rows global beyond the ~25 seeded cities); opportunistic finder-cache rows
// (restaurants/coffee); Wave-2 "Because you saved" (needs saves→Supabase).
// ============================================================================

// Assembled-response freshness — NOT the place data (that lives longer in D1 /
// Google cache). Just how long we keep the assembled bundle before rebuilding.
// Tunable: attraction rows are stable for hours, and the key already changes per
// day-part so the homepage reshuffles through the day regardless.
const HOME_ROWS_TTL_SECONDS = 6 * 60 * 60;

const HOME_SEASONAL_ROWS = {
  summer:   { title: 'Made for summer',     subtitle: 'Sun-soaked spots to explore' },
  winter:   { title: 'Cozy up this season', subtitle: 'Warm, memorable places nearby' },
  spring:   { title: 'Fresh-air season',    subtitle: 'Get out and wander' },
  fall:     { title: 'Golden-season picks', subtitle: 'Crisp days, great walks' },
  tropical: { title: 'Tropical anytime',    subtitle: 'Year-round adventures' },
};

// Static, hemisphere-correct destination lists for the global "Where to next"
// inspiration row (Unsplash-powered). Curated; free to expand later.
const HOME_SEASONAL_DESTINATIONS = {
  summer:   ['Santorini, Greece', 'Amalfi Coast, Italy', 'Barcelona, Spain', 'Maui, Hawaii', 'Nice, France', 'Dubrovnik, Croatia'],
  winter:   ['Zermatt, Switzerland', 'Kyoto, Japan', 'Vienna, Austria', 'Reykjavik, Iceland', 'Quebec City, Canada', 'Lapland, Finland'],
  spring:   ['Amsterdam, Netherlands', 'Kyoto, Japan', 'Paris, France', 'Marrakech, Morocco', 'Lisbon, Portugal', 'Charleston, USA'],
  fall:     ['Kyoto, Japan', 'Munich, Germany', 'Tuscany, Italy', 'Seoul, South Korea', 'Vermont, USA', 'Quebec City, Canada'],
  tropical: ['Bali, Indonesia', 'Phuket, Thailand', 'Tulum, Mexico', 'Maldives', 'Boracay, Philippines', 'Cairns, Australia'],
};

const HOME_DAYPART_ROW = {
  earlyMorning: { title: 'Start your morning',  subtitle: 'Ease into the day nearby' },
  morning:      { title: 'Good morning nearby', subtitle: 'Worth an early look' },
  midday:       { title: 'Midday around you',   subtitle: 'Great for right now' },
  afternoon:    { title: 'This afternoon',      subtitle: 'Make the most of it' },
  evening:      { title: 'Tonight nearby',      subtitle: 'Where the evening takes you' },
  lateNight:    { title: 'Still worth a look',  subtitle: 'Late-night nearby' },
};

const HOME_WEATHER_ACCENT = { hot: 'It’s hot out', cold: 'Bundle up', rain: 'Rainy-day picks', mild: 'Nice out' };

function homeRowsDayPart(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return 'midday';
  if (h >= 5 && h < 8) return 'earlyMorning';
  if (h >= 8 && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'midday';
  if (h >= 15 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'lateNight';
}

// Fetch a representative photo for a place from Unsplash, cached in KV (30d).
// Gated on UNSPLASH_ACCESS_KEY (returns null when not configured). Fires the
// Unsplash "download" trigger (required by their API ToS) and returns attribution.
async function fetchUnsplashPhoto(env, query, ctx) {
  if (!env.UNSPLASH_ACCESS_KEY) return null;
  const cacheKey = `unsplash:v1:${String(query).toLowerCase()}`;
  const cached = await env.GLOBESKIMMERS_KV.get(cacheKey, { type: 'json' }).catch(() => null);
  if (cached && cached.url) return cached;
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&content_filter=high&query=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.results?.[0];
    const photo = { url: p?.urls?.regular || p?.urls?.small || '', photographer: p?.user?.name || '', link: p?.links?.html || '' };
    if (!photo.url) return null;
    // Unsplash ToS: trigger a download event when a photo is used.
    if (ctx && ctx.waitUntil && p?.links?.download_location) {
      ctx.waitUntil(fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } }).catch(() => {}));
    }
    await env.GLOBESKIMMERS_KV.put(cacheKey, JSON.stringify(photo), { expirationTtl: 30 * 24 * 60 * 60 }).catch(() => {});
    return photo;
  } catch { return null; }
}

// Build the global "Where to next" inspiration row from Unsplash destination
// photos. Returns null if Unsplash isn't configured or too few photos resolve.
async function buildWhereToNextRow(env, seasonKey, ctx) {
  if (!env.UNSPLASH_ACCESS_KEY) return null;
  const dests = (HOME_SEASONAL_DESTINATIONS[seasonKey] || HOME_SEASONAL_DESTINATIONS.summer).slice(0, 6);
  const cards = [];
  for (const dest of dests) {
    const photo = await fetchUnsplashPhoto(env, dest, ctx);
    if (photo?.url) {
      cards.push({ id: `esc_${dest}`, name: dest.split(',')[0].trim(), whyVisit: dest, photoUrl: photo.url, photographer: photo.photographer, credit: 'Unsplash' });
    }
  }
  if (cards.length < 3) return null;
  return { key: 'whereToNext', title: 'Where to next ✈️', subtitle: 'Dreaming of your next trip', seeAll: { action: 'Things to Do' }, cards };
}

async function handleHomeRows(request, env, ctx) {
  const startedAt = Date.now();
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const { latitude, longitude, localHour, weather, season, cityName = '', countryName = '' } = body || {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return jsonResponse({ error: 'latitude and longitude required' }, 400);
  }

  const dayPart = homeRowsDayPart(localHour);
  const weatherBucket = (weather || 'unknown').toString().toLowerCase();
  const seasonKey = (season || '').toString().toLowerCase();

  // Coarse (0.1°) key so nearby users share the bundle; dayPart + weather in the
  // key make the homepage reshuffle across the day.
  const rLat = Math.round(latitude * 10) / 10;
  const rLng = Math.round(longitude * 10) / 10;
  const cacheKey = `homerows_${rLat}_${rLng}_${dayPart}_${weatherBucket}`;

  const cachedBundle = await env.GLOBESKIMMERS_KV.get(cacheKey, { type: 'json' }).catch(() => null);
  if (cachedBundle && Array.isArray(cachedBundle.rows)) {
    return jsonResponse({ ...cachedBundle, cached: true, tookMs: Date.now() - startedAt });
  }

  // Owned attractions via the existing D1 handler (reuses its bounding-box query
  // + background-seed trigger). No Google Places spend.
  let attractions = [];
  try {
    const origin = new URL(request.url).origin;
    const res = await handleAttractionsNearby(new Request(`${origin}/attractions/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, radiusKm: 60, limit: 60, cityName, countryName }),
    }), env, ctx);
    const data = await res.json();
    attractions = Array.isArray(data.attractions) ? data.attractions : [];
  } catch (e) {
    console.error('home/rows attractions fetch failed:', e?.message);
  }

  // No owned coverage here (outside seeded cities) → empty rows so the client
  // shows its cold-start fallback, never an empty carousel. Unsplash inspiration
  // rows will fill this globally once wired.
  if (attractions.length === 0) {
    // No owned coverage — still offer global Unsplash inspiration so the page
    // isn't empty. If Unsplash isn't configured, fall back to the cold-start.
    const wtn = await buildWhereToNextRow(env, seasonKey, ctx);
    return jsonResponse({ rows: wtn ? [wtn] : [], dayPart, reason: wtn ? undefined : 'no_owned_coverage', tookMs: Date.now() - startedAt });
  }

  const trim = (a) => ({
    id: a.id, name: a.name, category: a.category, city: a.city, country: a.country,
    photoUrl: a.photoUrl, rating: a.rating, whyVisit: a.whyVisit,
    distanceMiles: a.distanceMiles, freeToVisit: a.freeToVisit, lat: a.lat, lng: a.lng,
  });
  const withPhoto = attractions.filter((a) => a.photoUrl);
  const pool = withPhoto.length >= 6 ? withPhoto : attractions;

  // Rows draw from the pool INDEPENDENTLY (mild overlap ok) so even a small owned
  // pool yields several distinct rows — each row's different ordering (rotated /
  // nearest / marquee) keeps them from looking identical.
  const take = (list, n) => list.slice(0, n).map(trim);

  const rows = [];

  // Trending row — most-tapped places (last 7d, from home_row_card_tap events)
  // that are ALSO nearby (intersect ranked place_ids with the local pool → geo-
  // scoped without fragile city-string matching). Leads when present; silently
  // skipped until there's enough data (cold-start). At scale, add a city filter
  // to the query for perf. Reads env.DB (events D1); result is cached with the
  // bundle (6hr), so it's one query per tile per day-part, not per request.
  if (env.DB) {
    try {
      const q = await env.DB.prepare(
        `SELECT json_extract(payload,'$.place_id') AS pid, COUNT(*) AS c
           FROM events
          WHERE event_type = 'home_row_card_tap'
            AND ts >= strftime('%s','now','-7 days')
          GROUP BY pid
          ORDER BY c DESC
          LIMIT 60`
      ).all();
      const byId = new Map(pool.map((a) => [String(a.id), a]));
      const trendingCards = [];
      for (const r of (q?.results || [])) {
        const a = byId.get(String(r.pid));
        if (a) trendingCards.push(trim(a));
        if (trendingCards.length >= 10) break;
      }
      if (trendingCards.length >= 4) {
        rows.push({
          key: 'trending',
          title: cityName ? `Trending in ${cityName}` : 'Trending near you',
          subtitle: 'What travelers are loving now',
          seeAll: { action: 'Things to Do' },
          cards: trendingCards,
        });
      }
    } catch (e) { console.error('home/rows trending query failed:', e?.message); }
  }

  // Row 1 — day-part row, rotated so morning vs evening opens differ visibly.
  const order = ['earlyMorning', 'morning', 'midday', 'afternoon', 'evening', 'lateNight'];
  const off = pool.length ? (Math.max(0, order.indexOf(dayPart)) % pool.length) : 0;
  const rotated = pool.slice(off).concat(pool.slice(0, off));
  const dp = HOME_DAYPART_ROW[dayPart] || HOME_DAYPART_ROW.midday;
  const wAccent = HOME_WEATHER_ACCENT[weatherBucket];
  const dpCards = take(rotated, 10);
  if (dpCards.length) rows.push({ key: 'dayPart', title: dp.title, subtitle: wAccent ? `${wAccent} · ${dp.subtitle}` : dp.subtitle, seeAll: { action: 'Things to Do' }, cards: dpCards });

  // Row 2 — nearest to you now.
  const nearest = [...pool].sort((a, b) => (a.distanceMiles ?? 1e9) - (b.distanceMiles ?? 1e9));
  const nearCards = take(nearest, 10);
  if (nearCards.length) rows.push({ key: 'nearYou', title: 'Near you now', subtitle: 'Closest to where you are', seeAll: { action: 'Things to Do' }, cards: nearCards });

  // Row 3 — seasonal (client-passed season = hemisphere-correct).
  const seasonCfg = HOME_SEASONAL_ROWS[seasonKey];
  if (seasonCfg) {
    const seasonCards = take(pool, 10);
    if (seasonCards.length) rows.push({ key: 'seasonal', title: seasonCfg.title, subtitle: seasonCfg.subtitle, seeAll: { action: 'Things to Do' }, cards: seasonCards });
  }

  // Where to next — global Unsplash inspiration (gated on key), a nice closer.
  const wtn = await buildWhereToNextRow(env, seasonKey, ctx);
  if (wtn) rows.push(wtn);

  // Photo fallback: owned attraction cards have no photo_url in D1 → fetch an
  // Unsplash photo by "{name}, {city}" so the feed is photo-forward (cached 30d,
  // gated on key). Parallel + capped so first build stays fast; the "Where to
  // next" cards already have photos and are skipped.
  if (env.UNSPLASH_ACCESS_KEY) {
    // Dedup by "{name}, {city}" so cards repeated across rows don't waste the
    // budget — fetch each unique place once, apply the photo to all its cards.
    const byQuery = new Map();
    for (const r of rows) for (const c of r.cards) {
      if (c.photoUrl || !c.name) continue;
      const q = c.city ? `${c.name}, ${c.city}` : c.name;
      if (!byQuery.has(q)) byQuery.set(q, []);
      byQuery.get(q).push(c);
    }
    await Promise.all([...byQuery.keys()].slice(0, 30).map(async (q) => {
      const photo = await fetchUnsplashPhoto(env, q, ctx);
      if (photo?.url) for (const c of byQuery.get(q)) { c.photoUrl = photo.url; c.photographer = photo.photographer; c.credit = 'Unsplash'; }
    }));
  }

  const bundle = { rows, dayPart };
  const store = env.GLOBESKIMMERS_KV.put(cacheKey, JSON.stringify(bundle), { expirationTtl: HOME_ROWS_TTL_SECONDS }).catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(store); else await store;

  return jsonResponse({ ...bundle, cached: false, tookMs: Date.now() - startedAt });
}

// ============================================================================
// RESTROOM FINDER — ported from base44/functions/getRestroomLocations (v4.0).
// Runs the same enrichment over results from the Worker's own /places/text-search
// (so it works on native with no Base44 platform auth). Output shape matches the
// Base44 function exactly, so the frontend reads it unchanged ({restrooms,...}).
// ============================================================================
const RR_COUNTRY_DATA = {
  US: { terms:['restroom','bathroom','washroom','toilet'], tip:'Hotel lobbies, Starbucks, Target, and libraries are reliable free options.', expectPaper:true, hasPaidPublicToilets:false },
  CA: { terms:['washroom','restroom','bathroom','toilet'], tip:'Tim Hortons, libraries, and shopping centers are reliable.', expectPaper:true, hasPaidPublicToilets:false },
  MX: { terms:['baño','sanitario','WC'], tip:'Tip 5–10 MXN to attendant. Carry tissue.', expectPaper:false, hasPaidPublicToilets:true, currency:'MXN', typicalFee:'5–10 MXN' },
  GB: { terms:['toilet','loo','WC','lavatory'], tip:'Train stations may charge £0.30–0.50.', expectPaper:true, hasPaidPublicToilets:true, currency:'GBP', typicalFee:'£0.30–0.50' },
  FR: { terms:['toilettes','WC'], tip:'Cafés may require purchase. Stations charge €0.50–1.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50–1' },
  DE: { terms:['Toilette','WC','Klo'], tip:'Sanifair stations charge €0.50–1.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50–1' },
  IT: { terms:['bagno','toilette','WC'], tip:'Bars require purchase. Carry €0.50.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50–1' },
  ES: { terms:['baño','aseo','servicio','WC'], tip:'Bars free with purchase.', expectPaper:true, hasPaidPublicToilets:false },
  NL: { terms:['toilet','WC'], tip:'Often €0.50 fee.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50' },
  CH: { terms:['Toilette','WC'], tip:'Stations charge CHF 1–2.', expectPaper:true, hasPaidPublicToilets:true, currency:'CHF', typicalFee:'CHF 1–2' },
  AT: { terms:['Toilette','WC'], tip:'Cafés free with purchase.', expectPaper:true, hasPaidPublicToilets:false },
  BE: { terms:['toilet','WC'], tip:'Often €0.50.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.50' },
  PT: { terms:['casa de banho','WC'], tip:'May charge €0.30–0.50.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.30–0.50' },
  SE: { terms:['toalett','WC'], tip:'Card payment common.', expectPaper:true, hasPaidPublicToilets:false },
  NO: { terms:['toalett','WC'], tip:'Card payment standard.', expectPaper:true, hasPaidPublicToilets:false },
  DK: { terms:['toilet','WC'], tip:'Some charge DKK 5.', expectPaper:true, hasPaidPublicToilets:true },
  FI: { terms:['WC','vessa'], tip:'Malls and libraries free.', expectPaper:true, hasPaidPublicToilets:false },
  PL: { terms:['toaleta','WC'], tip:'Often PLN 1–2.', expectPaper:true, hasPaidPublicToilets:true, currency:'PLN', typicalFee:'PLN 1–2' },
  CZ: { terms:['toaleta','WC'], tip:'Usually CZK 10–20.', expectPaper:true, hasPaidPublicToilets:true, currency:'CZK', typicalFee:'CZK 10–20' },
  HU: { terms:['WC','mosdó'], tip:'HUF 100–200 typical.', expectPaper:true, hasPaidPublicToilets:true, currency:'HUF', typicalFee:'HUF 100–200' },
  RO: { terms:['toaletă','WC'], tip:'Often RON 1–2.', expectPaper:true, hasPaidPublicToilets:true, currency:'RON', typicalFee:'RON 1–2' },
  HR: { terms:['zahod','WC'], tip:'€0.30–0.50 in tourist areas.', expectPaper:true, hasPaidPublicToilets:true, currency:'EUR', typicalFee:'€0.30–0.50' },
  GR: { terms:['τουαλέτα','WC'], tip:"Don't flush paper.", expectPaper:false, hasPaidPublicToilets:false },
  TR: { terms:['tuvalet','WC'], tip:'Mosques free. Charge TRY 2–5 elsewhere.', expectSquat:true, expectBidet:true, expectPaper:false, hasPaidPublicToilets:true, currency:'TRY', typicalFee:'TRY 2–5' },
  RU: { terms:['туалет','WC'], tip:'Metro RUB 30–50. Bring tissue.', expectPaper:false, hasPaidPublicToilets:true, currency:'RUB', typicalFee:'RUB 30–50' },
  AE: { terms:['toilet','restroom','مرحاض'], tip:'Malls excellent. Water hose standard.', expectBidet:true, expectPaper:false, hasPaidPublicToilets:false },
  SA: { terms:['دورة مياه','toilet'], tip:'Mosques have facilities.', expectBidet:true, expectSquat:true, expectPaper:false, hasPaidPublicToilets:false },
  IL: { terms:['שירותים','toilet'], tip:'Malls and hotels reliable.', expectPaper:true, hasPaidPublicToilets:false },
  JP: { terms:['トイレ','お手洗い','toilet'], tip:'Extremely clean. Konbini always have toilets.', expectBidet:true, expectPaper:true, hasPaidPublicToilets:false },
  KR: { terms:['화장실','toilet'], tip:'Very clean. Subway stations free.', expectBidet:true, expectPaper:true, hasPaidPublicToilets:false },
  CN: { terms:['厕所','卫生间','toilet'], tip:'Carry tissue. Squat common in older areas.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:false },
  TW: { terms:['廁所','toilet'], tip:"7-Eleven has toilets. Don't flush paper.", expectPaper:false, hasPaidPublicToilets:false },
  HK: { terms:['廁所','toilet'], tip:'MTR stations have facilities.', expectPaper:true, hasPaidPublicToilets:false },
  PH: { terms:['CR','comfort room','toilet'], tip:'Look for "CR" signs. Malls excellent.', expectPaper:false, hasPaidPublicToilets:true, currency:'PHP', typicalFee:'₱5–10' },
  TH: { terms:['ห้องน้ำ','toilet'], tip:'Squat common. THB 3–5 in some places.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:true, currency:'THB', typicalFee:'THB 3–5' },
  VN: { terms:['nhà vệ sinh','toilet'], tip:'Carry tissue. 2,000–5,000 VND.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:true, currency:'VND', typicalFee:'2,000–5,000 VND' },
  ID: { terms:['toilet','kamar mandi'], tip:'IDR 2,000–5,000. Water hose standard.', expectBidet:true, hasPaidPublicToilets:true, currency:'IDR', typicalFee:'IDR 2,000–5,000' },
  MY: { terms:['tandas','toilet'], tip:'Malls free. Carry tissue elsewhere.', expectPaper:false, hasPaidPublicToilets:false },
  SG: { terms:['toilet','restroom'], tip:'Extremely clean. Hawker centers have facilities.', expectPaper:true, hasPaidPublicToilets:false },
  IN: { terms:['toilet','शौचालय'], tip:'Sulabh toilets ₹5–10. Squat common.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:true, currency:'INR', typicalFee:'₹5–10' },
  PK: { terms:['toilet','bathroom'], tip:'Mosques have facilities.', expectSquat:true, expectPaper:false, hasPaidPublicToilets:false },
  AU: { terms:['toilet','loo','bathroom'], tip:'Many free public toilets.', expectPaper:true, hasPaidPublicToilets:false },
  NZ: { terms:['toilet','loo'], tip:'Generally free and clean.', expectPaper:true, hasPaidPublicToilets:false },
  ZA: { terms:['toilet','bathroom'], tip:'Malls reliable. R2–5 in some places.', expectPaper:true, hasPaidPublicToilets:true, currency:'ZAR', typicalFee:'R2–5' },
  EG: { terms:['حمام','toilet'], tip:'Tourist sites LE 5–10. Mosques free.', expectPaper:false, hasPaidPublicToilets:true, currency:'EGP', typicalFee:'LE 5–10' },
  KE: { terms:['toilet','choo'], tip:'KES 10–30 in public.', expectPaper:false, hasPaidPublicToilets:true, currency:'KES', typicalFee:'KES 10–30' },
  BR: { terms:['banheiro','toalete'], tip:'Shopping centers free.', expectPaper:true, hasPaidPublicToilets:false },
  AR: { terms:['baño','sanitario'], tip:'Malls reliable.', expectPaper:true, hasPaidPublicToilets:false },
  PE: { terms:['baño','servicios higiénicos'], tip:'S/.0.50–1 in some places.', hasPaidPublicToilets:true, currency:'PEN', typicalFee:'S/.0.50–1' },
};
const RR_VENUE_QUERIES = {
  all: ['public restroom','public toilet','bathroom','coffee shop','cafe','starbucks','coffee bean','shopping mall','grocery store','supermarket','gas station','convenience store','hotel lobby','hospital','library','subway station','train station','airport','restaurant','fast food'],
  public: ['public restroom','public toilet','comfort station','park bathroom','beach restroom','rest stop'],
  transit: ['subway station','metro station','train station','bus terminal','airport terminal','ferry terminal','rail station','transit center'],
  coffee_food: ['coffee shop','cafe','starbucks','coffee bean','peets coffee','dutch bros','tea house','bakery','restaurant','fast food','food court','diner'],
  shopping: ['shopping mall','department store','target','walmart','costco','grocery store','supermarket','whole foods','trader joes','marshalls','tj maxx','ross','nordstrom'],
  medical: ['hospital','clinic','medical center','urgent care'],
  hospitality: ['hotel lobby','resort','casino','conference center'],
  attractions: ['museum','zoo','aquarium','theme park','tourist attraction','stadium','arena','gallery'],
  institutions: ['library','bank','university','school','government building','post office','community center'],
  fuel: ['gas station','petrol station','truck stop','service plaza','convenience store','7-eleven','ampm','circle k'],
  outdoor: ['park restroom','trail','campground','beach','recreation area'],
};
const RR_PROPERTY_SIGNALS = {
  free: ['free','no charge','complimentary','free to use'],
  paid: ['paid','charge','fee','coin','token','costs'],
  clean: ['clean','spotless','well maintained','sanitary','hygienic','very clean'],
  dirty: ['dirty','filthy','disgusting','gross','unclean','smells'],
  squat: ['squat toilet','squat style','floor toilet','hole in floor'],
  bidet: ['bidet','washlet','water spray','shower toilet','hose','shattaf'],
  accessible: ['accessible','wheelchair','disabled','ada','handicap','ramp'],
  family: ['family','baby changing','changing table','infant'],
  paper: ['toilet paper','tissue','paper provided'],
  noPaper: ['no paper','bring tissue','no toilet paper'],
  purchaseRequired: ['customers only','purchase required','buy something','patrons only'],
  locked: ['locked','key required','code required','ask staff'],
  stairs: ['stairs','downstairs','upstairs','basement','second floor','lower level'],
  elevator: ['elevator','lift','escalator'],
  open24: ['24 hour','24/7','always open','open all night'],
};
const RR_NO_SQUAT_COUNTRIES = ['US','CA','GB','AU','NZ','IE','DE','FR','IT','ES','NL','BE','AT','CH','SE','NO','DK','FI'];
const RR_FEE_REQUIRED_COUNTRIES = ['CH','DE','NL','PL','CZ','HU','PH','TH','VN','IN','ID','EG','KE','ZA','MX','PE','TR','RU','GB','FR','IT','BE','PT','HR','RO','DK'];
const RR_STRICT_TYPE_MAP = {
  public:      new Set(['library','city_hall','community_center','local_government_office']),
  transit:     new Set(['transit_station','bus_station','train_station','subway_station','light_rail_station','airport']),
  coffee_food: new Set(['cafe','coffee_shop','fast_food_restaurant','restaurant','bakery','meal_takeaway']),
  shopping:    new Set(['shopping_mall','department_store','supermarket','grocery_store','grocery_or_supermarket']),
  medical:     new Set(['hospital','doctor','medical_clinic','health']),
  fuel:        new Set(['gas_station','convenience_store','rest_stop']),
  outdoor:     new Set(['park','national_park','campground','hiking_area','amusement_park','zoo']),
};
// The generic "bathroom" query drags in contractors/showrooms that are NOT
// usable restrooms — exclude bathroom remodeling / construction / plumbing /
// home-improvement businesses by name or Google place type.
const RR_EXCLUDE_NAME = /remodel|renovat|construction|contractor|plumb|countertop|granite|cabinetry|cabinets|home improvement|building (supply|material)|hardware store|bath(room)?\s*(remodel|design|fixture|works|gallery|showroom)|kitchen\s*(&|and|\+)?\s*bath|\bgym\b|fitness|food truck|taco truck/i;
const RR_EXCLUDE_TYPES = new Set(['general_contractor','plumber','home_improvement_store','hardware_store','roofing_contractor','electrician','painter','gym','fitness_center']);
function rrDetectCountry(lat, lng) {
  if (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) return 'US';
  if (lat >= 42 && lat <= 83 && lng >= -141 && lng <= -52) return 'CA';
  if (lat >= 49 && lat <= 61 && lng >= -10 && lng <= 2)   return 'GB';
  if (lat >= 41 && lat <= 51 && lng >= -5 && lng <= 10)   return 'FR';
  if (lat >= 47 && lat <= 55 && lng >= 6 && lng <= 15)    return 'DE';
  if (lat >= 36 && lat <= 47 && lng >= 6 && lng <= 19)    return 'IT';
  if (lat >= 36 && lat <= 44 && lng >= -9 && lng <= 5)    return 'ES';
  if (lat >= 35 && lat <= 42 && lng >= 26 && lng <= 45)   return 'TR';
  if (lat >= 30 && lat <= 53 && lng >= 73 && lng <= 135)  return 'CN';
  if (lat >= 31 && lat <= 46 && lng >= 130 && lng <= 146) return 'JP';
  if (lat >= 34 && lat <= 43 && lng >= 124 && lng <= 130) return 'KR';
  if (lat >= 5 && lat <= 21 && lng >= 117 && lng <= 127)  return 'PH';
  if (lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106)   return 'TH';
  if (lat >= 1 && lat <= 28 && lng >= 68 && lng <= 98)    return 'IN';
  if (lat >= 1 && lat <= 7 && lng >= 100 && lng <= 104)   return 'SG';
  if (lat >= -44 && lat <= -10 && lng >= 113 && lng <= 154) return 'AU';
  if (lat >= -47 && lat <= -34 && lng >= 166 && lng <= 178) return 'NZ';
  if (lat >= 22 && lat <= 32 && lng >= 50 && lng <= 60)   return 'AE';
  if (lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33) return 'ZA';
  if (lat >= 15 && lat <= 37 && lng >= 25 && lng <= 37)   return 'EG';
  if (lat >= -33 && lat <= 5 && lng >= -73 && lng <= -34) return 'BR';
  if (lat >= 16 && lat <= 33 && lng >= -118 && lng <= -86)return 'MX';
  return 'US';
}
function rrSafeText(r) {
  if (!r) return '';
  if (r.text && typeof r.text === 'object' && r.text.text) return String(r.text.text);
  if (typeof r.text === 'string') return r.text;
  if (r.originalText?.text) return String(r.originalText.text);
  return '';
}
function rrScore(text, keywords) { return keywords.filter(k => text.includes(k)).length; }
function rrDeriveAccessType(props, venueCategory, country, countryData) {
  if (['museum','theme_park','attraction','stadium','zoo','aquarium'].includes(venueCategory)) return 'ticketed_entry';
  if (props.isPaid && RR_FEE_REQUIRED_COUNTRIES.includes(country) && countryData?.hasPaidPublicToilets) {
    if (['public','transit','park'].includes(venueCategory)) return 'fee_required';
  }
  if (props.purchaseRequired || ['coffee','restaurant','fastfood'].includes(venueCategory)) return 'customers_only';
  if (props.isFree) return 'free';
  if (['grocery','shopping','mall','hotel','library','medical'].includes(venueCategory)) return 'free';
  return 'unknown';
}
function rrDeriveReachability(reviewText) {
  const hasStairs = rrScore(reviewText, RR_PROPERTY_SIGNALS.stairs) > 0;
  const hasElevator = rrScore(reviewText, RR_PROPERTY_SIGNALS.elevator) > 0;
  const hasLocked = rrScore(reviewText, RR_PROPERTY_SIGNALS.locked) > 0;
  if (hasStairs && !hasElevator) return 'moderate';
  if (hasLocked) return 'moderate';
  if (hasStairs && hasElevator) return 'easy';
  return 'unknown';
}
function rrDeriveConfidence(venueCategory, reviewText, types) {
  const restroomMentioned = /restroom|bathroom|toilet|washroom|loo|wc|cr\b/i.test(reviewText);
  const isHighConfidenceVenue = ['public','mall','grocery','hotel','medical','transit','airport','coffee','restaurant','fastfood','gas','convenience','library','park','museum'].includes(venueCategory);
  if (restroomMentioned && isHighConfidenceVenue) return 'high';
  if (restroomMentioned || isHighConfidenceVenue) return 'medium';
  return 'low';
}
function rrDeriveSmartNote(accessType, venueCategory, reachability, country, countryData) {
  if (accessType === 'ticketed_entry') return 'Inside ticketed venue';
  if (accessType === 'fee_required' && countryData?.typicalFee) return `Fee usually ${countryData.typicalFee}`;
  if (accessType === 'customers_only') {
    if (['coffee','restaurant','fastfood'].includes(venueCategory)) return 'Purchase may be required';
    return 'Customers only';
  }
  if (reachability === 'moderate') return 'May involve stairs or staff access';
  if (venueCategory === 'transit') return 'May be inside fare-paid area';
  return '';
}
function rrClassifyVenue(name, types) {
  const allText = `${name.toLowerCase()} ${types.join(' ').toLowerCase()}`;
  if (/whole foods|trader joe|target|walmart|costco|ralphs|safeway|kroger|vons|albertsons|publix|heb|wegmans/.test(allText)) return { icon:'🛒', label:'Grocery Store', category:'grocery' };
  if (/coffee bean|starbucks|peets|dutch bros|dunkin|philz|blue bottle|intelligentsia/.test(allText)) return { icon:'☕', label:'Coffee Shop', category:'coffee' };
  if (/ampm|7-eleven|7eleven|circle k|wawa|sheetz|quicktrip|racetrac|loves|pilot|flying j/.test(allText)) return { icon:'🏪', label:'Convenience Store', category:'convenience' };
  if (/marshalls|tj maxx|ross|nordstrom|macys|jcpenney|kohls|burlington/.test(allText)) return { icon:'🛍️', label:'Department Store', category:'shopping' };
  if (/airport|terminal|aeropuerto|flughafen/.test(allText)) return { icon:'✈️', label:'Airport', category:'airport' };
  if (/subway|metro|train station|rail station|transit|bus terminal|ferry/.test(allText)) return { icon:'🚇', label:'Transit Station', category:'transit' };
  if (/hospital|medical|clinic|health|urgent care/.test(allText)) return { icon:'🏥', label:'Hospital/Medical', category:'medical' };
  if (/hotel|inn|lodge|resort|motel|marriott|hilton|hyatt/.test(allText)) return { icon:'🏨', label:'Hotel', category:'hotel' };
  if (/mall|shopping center|plaza|shopping/.test(allText) || types.includes('shopping_mall')) return { icon:'🛍️', label:'Shopping Mall', category:'mall' };
  if (/supermarket|grocery/.test(allText) || types.includes('supermarket') || types.includes('grocery_or_supermarket')) return { icon:'🛒', label:'Grocery Store', category:'grocery' };
  if (/mcdonald|burger king|kfc|wendy|taco bell|chipotle|chick-fil-a|in-n-out|five guys|popeyes|jack in the box|carl|subway|pizza hut|domino/.test(allText)) return { icon:'🍔', label:'Fast Food', category:'fastfood' };
  if (/coffee|cafe|tea house|bakery|espresso/.test(allText) || types.includes('cafe')) return { icon:'☕', label:'Coffee Shop', category:'coffee' };
  if (/restaurant|diner|bistro|eatery|grill/.test(allText) || types.includes('restaurant')) return { icon:'🍽️', label:'Restaurant', category:'restaurant' };
  if (/gas station|petrol|fuel|shell|chevron|bp|exxon|mobil|arco|76|texaco|valero/.test(allText) || types.includes('gas_station')) return { icon:'⛽', label:'Gas Station', category:'gas' };
  if (/convenience|mini mart|bodega/.test(allText) || types.includes('convenience_store')) return { icon:'🏪', label:'Convenience Store', category:'convenience' };
  if (/library/.test(allText) || types.includes('library')) return { icon:'📚', label:'Library', category:'library' };
  if (/museum|gallery/.test(allText) || types.includes('museum')) return { icon:'🏛️', label:'Museum', category:'museum' };
  if (/zoo|aquarium/.test(allText) || types.includes('zoo') || types.includes('aquarium')) return { icon:'🦁', label:'Zoo/Aquarium', category:'zoo' };
  if (/theme park|amusement|disneyland|universal|six flags/.test(allText) || types.includes('amusement_park')) return { icon:'🎢', label:'Theme Park', category:'theme_park' };
  if (/stadium|arena|ballpark/.test(allText) || types.includes('stadium')) return { icon:'🏟️', label:'Stadium', category:'stadium' };
  if (/bank/.test(allText) || types.includes('bank')) return { icon:'🏦', label:'Bank', category:'bank' };
  if (/school|university|college|campus/.test(allText) || types.includes('school') || types.includes('university')) return { icon:'🏫', label:'School/University', category:'school' };
  if (/park|garden|recreation|beach|trail|campground/.test(allText) || types.includes('park')) return { icon:'🌳', label:'Park/Outdoors', category:'park' };
  return { icon:'🚻', label:'Public Restroom', category:'public' };
}
function rrCalcDist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function rrTextSearch(env, ctx, origin, { query, latitude, longitude, radius, maxResults, forceRefresh }) {
  const params = new URLSearchParams({
    query, latitude: String(latitude), longitude: String(longitude),
    radius: String(radius), maxResults: String(maxResults),
    ...(forceRefresh ? { forceRefresh: 'true' } : {}),
  });
  const req = new Request(`${origin}/places/text-search?${params.toString()}`);
  const res = await handleTextSearch(req, env, ctx);
  const data = await res.json();
  return data.places || [];
}
// Shared keep-filter: require an exact address, drop contractors/remodel/
// plumbers/gyms/food-trucks (the generic "bathroom" query drags them in).
function rrKeep(p) {
  if (!(p.formattedAddress || '').trim()) return false;
  const nm = (p.displayName?.text || p.name || '').toLowerCase();
  if (RR_EXCLUDE_NAME.test(nm)) return false;
  if ((p.types || []).some(t => RR_EXCLUDE_TYPES.has(t))) return false;
  return true;
}
// Distance-ranked nearby query over restroom-reliable venue types — used by the
// fast "quick" pass to surface the literally-closest spots immediately.
async function rrNearbySearch(env, ctx, origin, { types, latitude, longitude, radius, maxResults, forceRefresh }) {
  const params = new URLSearchParams({
    types, latitude: String(latitude), longitude: String(longitude),
    radius: String(radius), maxResults: String(maxResults), rankBy: 'DISTANCE',
    ...(forceRefresh ? { forceRefresh: 'true' } : {}),
  });
  const req = new Request(`${origin}/places/nearby?${params.toString()}`);
  const res = await handleNearbySearch(req, env, ctx);
  const data = await res.json();
  return data.places || [];
}
// Enrich one normalized place into the restroom card shape (venue class,
// property signals, accessType/reachability/confidence/smartNote, quality).
function rrProcessPlace(place, latitude, longitude, country, countryData) {
  const lat = place.location?.latitude || 0;
  const lng = place.location?.longitude || 0;
  const distKm = rrCalcDist(latitude, longitude, lat, lng);
  const weekdayDesc = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || place.hours || [];
  const photos = (place.photos || []).map(p => p.url || p).filter(Boolean).slice(0, 2);
  const name = place.displayName?.text || place.name || '';
  const types = place.types || [];
  const venue = rrClassifyVenue(name, types);
  const reviews = (place.reviews || []).map(r => rrSafeText(r).toLowerCase());
  const reviewText = reviews.join(' ');
  const combinedText = `${name.toLowerCase()} ${reviewText}`;
  const props = {
    isFree: rrScore(combinedText, RR_PROPERTY_SIGNALS.free) > rrScore(combinedText, RR_PROPERTY_SIGNALS.paid),
    isPaid: rrScore(combinedText, RR_PROPERTY_SIGNALS.paid) > 0,
    isClean: rrScore(combinedText, RR_PROPERTY_SIGNALS.clean) > 0,
    isDirty: rrScore(combinedText, RR_PROPERTY_SIGNALS.dirty) > 0,
    hasSquat: !RR_NO_SQUAT_COUNTRIES.includes(country) && (rrScore(combinedText, RR_PROPERTY_SIGNALS.squat) > 0 || countryData.expectSquat),
    hasBidet: rrScore(combinedText, RR_PROPERTY_SIGNALS.bidet) > 0 || countryData.expectBidet,
    isAccessible: rrScore(combinedText, RR_PROPERTY_SIGNALS.accessible) > 0 || place.accessibilityOptions?.wheelchairAccessibleEntrance,
    hasFamily: rrScore(combinedText, RR_PROPERTY_SIGNALS.family) > 0,
    hasPaper: rrScore(combinedText, RR_PROPERTY_SIGNALS.paper) > 0 || (countryData.expectPaper && rrScore(combinedText, RR_PROPERTY_SIGNALS.noPaper) === 0),
    noPaper: rrScore(combinedText, RR_PROPERTY_SIGNALS.noPaper) > 0 || !countryData.expectPaper,
    purchaseRequired: rrScore(combinedText, RR_PROPERTY_SIGNALS.purchaseRequired) > 0,
    hasStairs: rrScore(combinedText, RR_PROPERTY_SIGNALS.stairs) > 0,
    hasElevator: rrScore(combinedText, RR_PROPERTY_SIGNALS.elevator) > 0,
    is24Hours: rrScore(combinedText, RR_PROPERTY_SIGNALS.open24) > 0,
  };
  const accessType = rrDeriveAccessType(props, venue.category, country, countryData);
  const reachability = rrDeriveReachability(combinedText);
  const confidence = rrDeriveConfidence(venue.category, reviewText, types);
  const smartNote = rrDeriveSmartNote(accessType, venue.category, reachability, country, countryData);
  let quality = 50;
  if (props.isClean) quality += 20;
  if (props.isDirty) quality -= 30;
  if (accessType === 'free') quality += 15;
  if (accessType === 'customers_only') quality += 5;
  if (props.isAccessible) quality += 5;
  if (props.hasBidet) quality += 5;
  if (props.hasPaper) quality += 5;
  if (reachability === 'moderate' || reachability === 'difficult') quality -= 5;
  if (confidence === 'high') quality += 10;
  if (confidence === 'low') quality -= 10;
  quality = Math.max(0, Math.min(100, quality));
  return {
    id: place.id, placeId: place.id, name,
    displayName: place.displayName || { text: name },
    location: { latitude: lat, longitude: lng }, lat, lng,
    formattedAddress: place.formattedAddress || '',
    distanceKm: distKm, distanceMiles: distKm * 0.621371,
    rating: place.rating || null, userRatingCount: place.userRatingCount || 0,
    isOpen: place.isOpen ?? null, weekdayDescriptions: weekdayDesc,
    photos, photoUrl: photos[0] || null,
    nationalPhoneNumber: place.nationalPhoneNumber || '',
    internationalPhoneNumber: place.internationalPhoneNumber || '',
    websiteUri: place.websiteUri || '', googleMapsUri: place.googleMapsUri || '',
    types, venueIcon: venue.icon, venueLabel: venue.label, venueCategory: venue.category,
    accessType, reachability, confidence, smartNote,
    properties: props, qualityScore: quality, country,
  };
}
async function handleRestroomSearch(request, env, ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, radius = 8000, maxResults = 30, venueType = 'all', forceRefresh = false, quick = false } = body;
    if (!latitude || !longitude) {
      return jsonResponse({ error: 'Latitude and longitude required', restrooms: [] }, 400);
    }
    const origin = new URL(request.url).origin;
    const country = rrDetectCountry(latitude, longitude);
    const countryData = RR_COUNTRY_DATA[country] || RR_COUNTRY_DATA['US'];

    // QUICK pass: one distance-ranked nearby query over restroom-reliable venue
    // types → the literally-closest few, returned fast so the UI renders the
    // first results instantly while the full pass loads. Same card shape.
    if (quick) {
      const quickTypes = 'gas_station,convenience_store,cafe,restaurant,fast_food_restaurant,supermarket,grocery_store,shopping_mall,department_store,park,transit_station';
      const places = await rrNearbySearch(env, ctx, origin, {
        types: quickTypes, latitude, longitude, radius: Math.min(radius, 50000), maxResults: 20, forceRefresh,
      });
      const quickProcessed = places
        .filter(rrKeep)
        .map(p => rrProcessPlace(p, latitude, longitude, country, countryData))
        .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
        .slice(0, maxResults);
      return jsonResponse({ restrooms: quickProcessed, count: quickProcessed.length, country, countryTip: countryData.tip, version: 'v4.2-quick', quick: true });
    }

    const venueQueries = RR_VENUE_QUERIES[venueType] || RR_VENUE_QUERIES['all'];
    const localTerms = countryData.terms.slice(0, 2);
    const allQueries = [...new Set([...localTerms, ...venueQueries])];

    const allPlaces = [];
    const seenIds = new Set();
    const batchSize = 8;
    for (let i = 0; i < allQueries.length; i += batchSize) {
      const batch = allQueries.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(q =>
        rrTextSearch(env, ctx, origin, { query: q, latitude, longitude, radius, maxResults: 15, forceRefresh }).catch(() => [])
      ));
      for (const places of results) {
        for (const p of places) {
          const id = p.id || p.placeId;
          if (id && !seenIds.has(id)) { seenIds.add(id); allPlaces.push(p); }
        }
      }
    }

    const strictTypes = RR_STRICT_TYPE_MAP[venueType];
    let filteredPlaces = allPlaces;
    if (strictTypes && venueType !== 'all') {
      filteredPlaces = allPlaces.filter(p => (p.types || []).some(t => strictTypes.has(t)));
      if (filteredPlaces.length === 0) filteredPlaces = allPlaces;
    }

    filteredPlaces = filteredPlaces.filter(rrKeep);

    if (filteredPlaces.length === 0) {
      return jsonResponse({ restrooms: [], count: 0, country, countryTip: countryData.tip, error: 'No restrooms found. Try expanding radius.' });
    }

    // Enrich ALL kept places, then distance-first sort, then take the nearest N
    // (sorting before the slice guarantees we return the truly-closest set).
    const processed = filteredPlaces.map(p => rrProcessPlace(p, latitude, longitude, country, countryData));
    processed.sort((a, b) => {
      const dDiff = (a.distanceKm || 0) - (b.distanceKm || 0);
      if (Math.abs(dDiff) > 0.2) return dDiff;
      return b.qualityScore - a.qualityScore;
    });
    const top = processed.slice(0, maxResults);

    return jsonResponse({ restrooms: top, count: top.length, country, countryTip: countryData.tip, version: 'v4.2-worker' });
  } catch (err) {
    return jsonResponse({ error: err.message, restrooms: [] }, 200);
  }
}

// ============================================================================
// COFFEE FINDER — ported from base44/functions/getCoffeeShops (v5.2).
// 2-query pattern: text "coffee shop" + nearby coffee_shop ranked by distance
// (catches chains Google text-search skips), dedup, distance-sort. Reuses the
// restroom internal helpers (rrTextSearch / rrNearbySearch / rrCalcDist).
// ============================================================================
async function handleCoffeeShops(request, env, ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, radius = 16093, maxResults = 60, forceRefresh = false } = body;
    if (!latitude || !longitude) return jsonResponse({ error: 'Latitude and longitude required', places: [] }, 400);
    const origin = new URL(request.url).origin;

    const seen = new Set();
    const all = [];
    const addAll = (places) => { for (const p of places) { const id = p.id || p.placeId; if (id && !seen.has(id)) { seen.add(id); all.push(p); } } };

    const [textHits, nearbyHits] = await Promise.all([
      rrTextSearch(env, ctx, origin, { query: 'coffee shop', latitude, longitude, radius, maxResults: 20, forceRefresh }).catch(() => []),
      rrNearbySearch(env, ctx, origin, { types: 'coffee_shop', latitude, longitude, radius, maxResults: 20, forceRefresh }).catch(() => []),
    ]);
    addAll(textHits); addAll(nearbyHits);

    if (all.length === 0) return jsonResponse({ places: [], count: 0, error: 'No coffee shops found in this area.' });

    const processed = all.slice(0, maxResults).map(place => {
      const lat = place.location?.latitude || 0;
      const lng = place.location?.longitude || 0;
      const dist = rrCalcDist(latitude, longitude, lat, lng);
      const mi = dist * 0.621371;
      const photos = (place.photos || []).map(p => p.url || p).filter(Boolean);
      const name = place.displayName?.text || place.name || '';
      const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
      const hours = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || place.hours || [];
      const serviceOptions = { dineIn: place.dineIn, outdoorSeating: place.outdoorSeating, takeout: place.takeout, delivery: place.delivery };
      return {
        id: place.id, placeId: place.id,
        displayName: place.displayName || { text: name }, name,
        location: { latitude: lat, longitude: lng }, latitude: lat, longitude: lng,
        formattedAddress: place.formattedAddress || '',
        shortFormattedAddress: place.shortFormattedAddress || '',
        distanceKm: dist, distanceMiles: mi,
        distanceText: mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`,
        rating: place.rating || null, userRatingCount: place.userRatingCount || 0,
        currentOpeningHours: { openNow: place.isOpen, weekdayDescriptions: hours },
        regularOpeningHours: { weekdayDescriptions: hours },
        hours, isOpen: place.isOpen ?? null,
        priceLevel: place.priceLevel,
        photos,
        types: place.types || [], primaryType: place.primaryType,
        nationalPhoneNumber: phone, internationalPhoneNumber: phone,
        websiteUri: place.websiteUri || '', googleMapsUri: place.googleMapsUri || '',
        serviceOptions,
        reviews: place.reviews || [],
        parking: null,
        seating: null,
        hasIndoorSeating: place.dineIn ?? null,
        hasOutdoorSeating: place.outdoorSeating ?? null,
        outdoorSeating: place.outdoorSeating,
        dineIn: place.dineIn,
      };
    });
    processed.sort((a, b) => a.distanceKm - b.distanceKm);

    return jsonResponse({ places: processed, count: processed.length, version: 'v5.2-worker' });
  } catch (err) {
    return jsonResponse({ error: err.message, places: [] }, 200);
  }
}

// ============================================================================
// ATM FINDER — ported from base44/functions/getATMLocations (v6.0).
// Category query sets + bank-network detection + venue typing. Reuses the
// restroom internal text-search helper (rrTextSearch) and rrCalcDist.
// ============================================================================
const ATM_NETWORKS = {
  'chase': { name: 'Chase', network: 'Chase', feeInfo: 'Free for Chase customers', surcharge: '$3.00–$3.50 non-customer' },
  'bank of america': { name: 'Bank of America', network: 'BofA', feeInfo: 'Free for BofA customers', surcharge: '$2.50–$3.00 non-customer' },
  'wells fargo': { name: 'Wells Fargo', network: 'Wells Fargo', feeInfo: 'Free for Wells Fargo customers', surcharge: '$3.00 non-customer' },
  'citibank': { name: 'Citibank', network: 'Citi', feeInfo: 'Free for Citi customers', surcharge: '$2.50–$3.00 non-customer' },
  'citi bank': { name: 'Citibank', network: 'Citi', feeInfo: 'Free for Citi customers', surcharge: '$2.50–$3.00 non-customer' },
  'us bank': { name: 'US Bank', network: 'US Bank', feeInfo: 'Free for US Bank customers', surcharge: '$3.00 non-customer' },
  'u.s. bank': { name: 'US Bank', network: 'US Bank', feeInfo: 'Free for US Bank customers', surcharge: '$3.00 non-customer' },
  'pnc': { name: 'PNC', network: 'PNC', feeInfo: 'Free for PNC customers', surcharge: '$3.00 non-customer' },
  'td bank': { name: 'TD Bank', network: 'TD', feeInfo: 'Free for TD customers', surcharge: '$3.00 non-customer' },
  'capital one': { name: 'Capital One', network: 'Capital One', feeInfo: 'Free for Capital One 360 customers', surcharge: '$0–$2.00 non-customer' },
  'allpoint': { name: 'Allpoint', network: 'Allpoint', feeInfo: 'Fee-free for network members', surcharge: '$0 in-network' },
  'moneypass': { name: 'MoneyPass', network: 'MoneyPass', feeInfo: 'Fee-free for network members', surcharge: '$0 in-network' },
  'co-op': { name: 'CO-OP', network: 'CO-OP', feeInfo: 'Fee-free for credit union members', surcharge: '$0 in-network' },
  'credit union': { name: 'Credit Union', network: 'CO-OP', feeInfo: 'Fee-free for members', surcharge: 'Varies' },
  'hsbc': { name: 'HSBC', network: 'HSBC', feeInfo: 'Free for HSBC customers', surcharge: '$2.50–$5.00 non-customer' },
  'barclays': { name: 'Barclays', network: 'Barclays', feeInfo: 'Free for Barclays customers', surcharge: 'Varies by country' },
  'santander': { name: 'Santander', network: 'Santander', feeInfo: 'Free for Santander customers', surcharge: 'Varies by country' },
  'scotiabank': { name: 'Scotiabank', network: 'Scotiabank', feeInfo: 'Free for Scotiabank customers', surcharge: 'Varies' },
  'bmo': { name: 'BMO', network: 'BMO', feeInfo: 'Free for BMO customers', surcharge: 'Varies' },
  'rbc': { name: 'RBC', network: 'RBC', feeInfo: 'Free for RBC customers', surcharge: 'Varies' },
  'anz': { name: 'ANZ', network: 'ANZ', feeInfo: 'Free for ANZ customers', surcharge: 'Varies' },
  'westpac': { name: 'Westpac', network: 'Westpac', feeInfo: 'Free for Westpac customers', surcharge: 'Varies' },
  'commonwealth': { name: 'Commonwealth Bank', network: 'CommBank', feeInfo: 'Free for CommBank customers', surcharge: 'Varies' },
  'natwest': { name: 'NatWest', network: 'NatWest', feeInfo: 'Free for NatWest customers', surcharge: 'Varies' },
  'lloyds': { name: 'Lloyds', network: 'Lloyds', feeInfo: 'Free for Lloyds customers', surcharge: 'Varies' },
  'deutsche bank': { name: 'Deutsche Bank', network: 'Deutsche Bank', feeInfo: 'Free for DB customers', surcharge: 'Varies' },
};
const ATM_CATEGORY_QUERIES = {
  all: ['ATM','cash machine','cash point','cash dispenser','automated teller machine','cajero automático','Geldautomat','distributeur automatique','bancomat','caixa eletrônico','เครื่องเอทีเอ็ม','ATM machine near me'],
  safe_lobbies: ['ATM bank lobby','ATM bank branch','ATM credit union','ATM financial center','ATM savings bank','ATM building society','ATM hospital lobby','ATM medical center','ATM hotel lobby','ATM post office','ATM government building'],
  airport_transit: ['ATM airport','ATM airport terminal','ATM departure lounge','ATM arrivals hall','ATM train station','ATM railway station','ATM subway station','ATM metro station','ATM underground station','ATM bus terminal','ATM bus station','ATM ferry terminal','ATM port','ATM transit hub','cash machine train station','ATM tram stop'],
  gas_stations: ['ATM gas station','ATM fuel station','ATM petrol station','ATM filling station','ATM service station','ATM forecourt','ATM Shell','ATM BP','ATM Chevron','ATM ExxonMobil','ATM Mobil','ATM Texaco','ATM Valero','ATM Sunoco','ATM Marathon','ATM Circle K','ATM Speedway','ATM Wawa',"ATM Casey's",'ATM RaceTrac','ATM Total','ATM Esso'],
  retail: ['ATM supermarket','ATM grocery store','ATM walmart','ATM target','ATM kroger','ATM safeway','ATM albertsons','ATM costco','ATM whole foods','ATM trader joes','ATM CVS pharmacy','ATM walgreens','ATM rite aid','ATM boots pharmacy','ATM tesco','ATM sainsburys','ATM aldi','ATM lidl','ATM carrefour','ATM department store'],
  small_retail: ['ATM liquor store','ATM off licence','ATM bottle shop','ATM corner store','ATM bodega','ATM convenience store','ATM 7-eleven','ATM minimart','ATM newsagent','ATM tobacconist','ATM deli','ATM off-license','ATM pawn shop','ATM check cashing','ATM payday loan'],
  shopping: ['ATM mall','ATM shopping mall','ATM shopping center','ATM shopping centre','ATM outlet mall','ATM strip mall','ATM retail park','ATM food court','ATM flea market','ATM public market','ATM bazaar','ATM night market'],
  education: ['ATM university','ATM college campus','ATM student union','ATM campus','ATM school','ATM library','ATM cafeteria school','ATM dormitory','ATM community college','ATM polytechnic'],
  entertainment: ['ATM casino','ATM hotel casino','ATM resort casino','ATM stadium','ATM sports arena','ATM concert venue','ATM arena','ATM movie theater','ATM cinema','ATM theme park','ATM amusement park','ATM water park','ATM fairground','ATM carnival','ATM bowling alley','ATM bingo hall','ATM racetrack','ATM nightclub','ATM bar'],
  hospitality: ['ATM hotel','ATM resort','ATM motel','ATM hostel','ATM bed and breakfast','ATM vacation rental','ATM cruise terminal','ATM marina','ATM tourist area','ATM spa resort'],
  community: ['ATM post office','ATM library','ATM community center','ATM city hall','ATM government office','ATM courthouse','ATM police station','ATM fire station','ATM church','ATM mosque','ATM temple','ATM laundromat','ATM barbershop','ATM hair salon'],
};
async function handleAtmLocations(request, env, ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, radius = 10000, maxResults = 40, category = 'all', bankFilter = 'all', openOnly = false, forceRefresh = false } = body;
    if (!latitude || !longitude) return jsonResponse({ error: 'Latitude and longitude required', atms: [] }, 400);
    const origin = new URL(request.url).origin;
    const queries = ATM_CATEGORY_QUERIES[category] || ATM_CATEGORY_QUERIES['all'];

    const seen = new Set();
    const all = [];
    const batchSize = 8;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(q =>
        rrTextSearch(env, ctx, origin, { query: q, latitude, longitude, radius, maxResults: 20, forceRefresh }).catch(() => [])
      ));
      for (const places of results) for (const p of places) { const id = p.id || p.placeId; if (id && !seen.has(id)) { seen.add(id); all.push(p); } }
    }

    if (all.length === 0) return jsonResponse({ atms: [], count: 0, banks: [], error: 'No ATMs found in this area. Try expanding your search radius.' });

    const processed = all.map(place => {
      const lat = place.location?.latitude || 0;
      const lng = place.location?.longitude || 0;
      const distance = rrCalcDist(latitude, longitude, lat, lng);
      const weekdayDescriptions = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || place.hours || [];
      const photos = (place.photos || []).map(p => p.url || p).filter(Boolean).slice(0, 2);
      const placeName = (place.displayName?.text || place.name || '').toLowerCase();
      let networkInfo = { name: 'Independent ATM', network: 'Independent', feeInfo: 'Standard fees may apply', surcharge: '$2.50–$4.00 typical' };
      for (const [key, info] of Object.entries(ATM_NETWORKS)) { if (placeName.includes(key)) { networkInfo = info; break; } }
      let venueType = 'standalone', venueIcon = '🏧';
      const types = (place.types || []).join(' ').toLowerCase();
      if (types.includes('airport') || placeName.includes('airport') || placeName.includes('terminal')) { venueType = 'airport'; venueIcon = '✈️'; }
      else if (types.includes('train') || types.includes('subway') || types.includes('transit') || placeName.includes('station') || placeName.includes('metro')) { venueType = 'transit'; venueIcon = '🚇'; }
      else if (types.includes('hospital') || placeName.includes('hospital') || placeName.includes('medical')) { venueType = 'hospital'; venueIcon = '🏥'; }
      else if (types.includes('hotel') || types.includes('lodging') || placeName.includes('hotel')) { venueType = 'hotel'; venueIcon = '🏨'; }
      else if (types.includes('gas_station') || placeName.includes('shell') || placeName.includes('chevron') || placeName.includes('arco') || placeName.includes('exxon') || placeName.includes('mobil') || placeName.includes('bp')) { venueType = 'gas'; venueIcon = '⛽'; }
      else if (types.includes('convenience_store') || placeName.includes('7-eleven') || placeName.includes('cvs') || placeName.includes('walgreens') || placeName.includes('wawa') || placeName.includes('circle k')) { venueType = 'convenience'; venueIcon = '🏪'; }
      else if (types.includes('shopping_mall') || placeName.includes('mall') || placeName.includes('plaza') || placeName.includes('center')) { venueType = 'mall'; venueIcon = '🛒'; }
      else if (types.includes('supermarket') || types.includes('grocery') || placeName.includes('walmart') || placeName.includes('target') || placeName.includes('costco') || placeName.includes('safeway') || placeName.includes('kroger')) { venueType = 'grocery'; venueIcon = '🛒'; }
      else if (types.includes('casino') || types.includes('night_club') || types.includes('stadium')) { venueType = 'entertainment'; venueIcon = '🎰'; }
      else if (types.includes('bank') || types.includes('credit_union') || types.includes('financial')) { venueType = 'bank'; venueIcon = '🏦'; }
      return {
        id: place.id, placeId: place.id,
        displayName: place.displayName || { text: place.name || '' }, name: place.displayName?.text || place.name || '',
        location: { latitude: lat, longitude: lng }, lat, lng,
        formattedAddress: place.formattedAddress || place.address || '',
        shortFormattedAddress: place.shortFormattedAddress || place.shortAddress || '',
        distanceKm: distance, distanceMiles: distance * 0.621371,
        rating: place.rating || null, userRatingCount: place.userRatingCount || 0,
        currentOpeningHours: { openNow: place.isOpen, weekdayDescriptions },
        regularOpeningHours: { weekdayDescriptions }, hours: weekdayDescriptions, isOpen: place.isOpen ?? null,
        photos, photoUrl: photos[0] || null, photoUrl2: photos[1] || null,
        nationalPhoneNumber: place.nationalPhoneNumber || place.phone || '',
        internationalPhoneNumber: place.internationalPhoneNumber || place.phone || '',
        websiteUri: place.websiteUri || place.website || '', googleMapsUri: place.googleMapsUri || place.googleMapsUrl || '',
        types: place.types || [], primaryType: place.primaryType,
        network: networkInfo.network, networkName: networkInfo.name, feeInfo: networkInfo.feeInfo, surcharge: networkInfo.surcharge,
        venueType, venueIcon,
        serviceOptions: place.serviceOptions || {},
      };
    });

    let filtered = processed;
    if (openOnly) filtered = filtered.filter(a => a.isOpen === true);
    if (bankFilter && bankFilter !== 'all') filtered = filtered.filter(a => a.network === bankFilter);
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);
    const results = filtered.slice(0, maxResults);

    const bankSet = new Set();
    for (const a of processed) if (a.network && a.network !== 'Independent') bankSet.add(a.network);
    const banks = Array.from(bankSet).sort();

    return jsonResponse({ atms: results, count: results.length, banks, version: 'v6.0-worker' });
  } catch (err) {
    return jsonResponse({ error: err.message, atms: [] }, 200);
  }
}

// ============================================================================
// SHOPPING FINDER — ported from base44/functions/getShoppingPlaces (v3.0).
// Food-shopping vs general-shopping split, detectKind classifier, traveler
// score, highlights. Reuses rrTextSearch / rrCalcDist.
// ============================================================================
const SHOP_CATEGORY_QUERIES = {
  all: ['shopping mall','supermarket','grocery store','farmers market','night market','souvenir market','outlet mall','bazaar','souk','warehouse club','bodega','wet market','craft market','department store','luxury shopping','duty free shop','local market','butcher shop'],
  food_shopping: ['supermarket','grocery store','hypermarket','food market','farmers market','wet market','produce market','bodega','warehouse club','wholesale club','neighborhood market','butcher shop','fish market','bakery specialty','natural foods store'],
  supermarkets: ['supermarket','grocery store','hypermarket','supercenter','Whole Foods','Trader Joes','Ralphs','Vons','Albertsons','Kroger','Safeway','Publix','HEB','Aldi','Lidl','Food 4 Less','Sprouts','Wegmans','WinCo','Meijer','Harris Teeter','Giant','natural foods grocery','organic grocery'],
  warehouse_clubs: ['warehouse club','wholesale club','membership warehouse','Costco','Sams Club','BJs Wholesale','Makro','Metro Cash and Carry'],
  farmers_markets: ['farmers market',"farmer's market",'open air produce market','weekend food market','fresh produce market','community market food'],
  wet_markets: ['wet market','public market','fish market','meat market','produce market','fresh market','municipal market','morning market food'],
  bodegas_corner_stores: ['bodega','corner store','mini market','neighborhood grocer','convenience food store','local food shop','alimentari','sari-sari store','warung','minimarket food'],
  butcher_shops: ['butcher shop','butcher','meat market','fish market','fishmonger','fish shop','bakery specialty food'],
  general_shopping: ['shopping mall','outlet mall','department store','souvenir market','boutique district','luxury shopping','craft market','night market','bazaar','souk','duty free shop'],
  malls: ['shopping mall','shopping center','shopping centre','department store','retail mall'],
  outlets: ['outlet mall','premium outlet','factory outlet','discount outlet center'],
  souvenir_shopping: ['souvenir market','souvenir shop','gift shop','local souvenir shopping','tourist souvenirs','handicraft shop'],
  night_markets: ['night market','pasar malam','evening market','night bazaar'],
  luxury_shopping: ['luxury shopping','designer boutique','high end shopping','luxury brands','designer brands district'],
  local_crafts: ['craft market','artisan market','handmade market','local crafts','artisan goods'],
  markets_bazaars: ['bazaar','souk','mercado','marché','mercato','pasar','talaat','flea market','street market','local market','antique market','vintage market'],
  duty_free: ['duty free shop','tax free shopping','airport duty free'],
};
const SHOP_SIG = {
  luxury: ['luxury','designer','gucci','louis vuitton','chanel','prada','hermes','burberry','premium','high-end','upscale'],
  budget: ['budget','affordable','cheap','bargain','discount','value','sale','clearance','outlet','wholesale'],
  foodCourt: ['food court','dining','restaurants','food hall','hawker','food stalls'],
  parking: ['free parking','parking available','ample parking','underground parking','valet'],
  outdoor: ['outdoor','open air','alfresco','street','open-air'],
  indoor: ['indoor','air conditioned','air-con','covered','climate'],
  local: ['local','artisan','handmade','craft','traditional','authentic','souvenirs','handicraft'],
  dutyFree: ['duty free','tax free','duty-free','tax-free'],
  bargain: ['bargain','haggle','negotiate','wholesale','discount market'],
  tourist: ['tourist','traveler','popular','iconic','must visit','famous'],
  fresh: ['fresh produce','fresh food','organic','farm fresh','seasonal'],
};
function shopSafeLower(v) { if (typeof v === 'string') return v.toLowerCase(); if (v == null) return ''; if (typeof v === 'object') return (v.text || '').toLowerCase(); return String(v).toLowerCase(); }
function shopSc(t, k) { return k.filter(w => t.includes(w)).length; }
function shopDetectKind(name, types = [], rev = '') {
  const x = `${name} ${types.join(' ')} ${rev}`.toLowerCase();
  if (/supermarket|grocery|hypermarket|whole foods|trader joe|ralphs|vons|kroger|albertsons|aldi|lidl|publix|safeway|winco|wegmans|sprouts|heb|meijer|food 4 less|natural food/.test(x)) return { shoppingFamily: 'food_shopping', shoppingSubtype: 'supermarket', venueIcon: '🛒', venueLabel: 'Supermarket', venueColor: '#2E7D32' };
  if (/costco|sam'?s club|bj'?s|warehouse club|wholesale club|makro|metro cash/.test(x)) return { shoppingFamily: 'food_shopping', shoppingSubtype: 'warehouse_club', venueIcon: '📦', venueLabel: 'Warehouse Club', venueColor: '#1565C0' };
  if (/farmer'?s? market|open air produce|weekend food market/.test(x)) return { shoppingFamily: 'food_shopping', shoppingSubtype: 'farmers_market', venueIcon: '🥕', venueLabel: 'Farmers Market', venueColor: '#689F38' };
  if (/wet market|fish market|meat market|produce market|public market|municipal market|fishmonger/.test(x)) return { shoppingFamily: 'food_shopping', shoppingSubtype: 'fresh_market', venueIcon: '🍎', venueLabel: 'Fresh Food Market', venueColor: '#D97706' };
  if (/bodega|corner store|mini market|sari.sari|warung|neighbourhood food|neighborhood food|alimentari/.test(x)) return { shoppingFamily: 'food_shopping', shoppingSubtype: 'bodega', venueIcon: '🏪', venueLabel: 'Neighborhood Food Shop', venueColor: '#059669' };
  if (/butcher|butcher shop|fishmonger|fish shop/.test(x)) return { shoppingFamily: 'food_shopping', shoppingSubtype: 'butcher_shop', venueIcon: '🥩', venueLabel: 'Butcher / Fish Shop', venueColor: '#B45309' };
  if (/outlet|factory outlet|premium outlet/.test(x)) return { shoppingFamily: 'general_shopping', shoppingSubtype: 'outlet', venueIcon: '🏷️', venueLabel: 'Outlet', venueColor: '#DC2626' };
  if (/night market|pasar malam|night bazaar/.test(x)) return { shoppingFamily: 'general_shopping', shoppingSubtype: 'night_market', venueIcon: '🌙', venueLabel: 'Night Market', venueColor: '#1565C0' };
  if (/souk|bazaar|bazar/.test(x)) return { shoppingFamily: 'general_shopping', shoppingSubtype: 'bazaar', venueIcon: '🏺', venueLabel: 'Souk / Bazaar', venueColor: '#B45309' };
  if (/souvenir|handicraft|gift shop|tourist shop/.test(x)) return { shoppingFamily: 'general_shopping', shoppingSubtype: 'souvenir', venueIcon: '🎁', venueLabel: 'Souvenir Market', venueColor: '#7C3AED' };
  if (/craft|artisan|handmade/.test(x)) return { shoppingFamily: 'general_shopping', shoppingSubtype: 'crafts', venueIcon: '🧶', venueLabel: 'Craft Market', venueColor: '#D97706' };
  if (/luxury|designer boutique|high.end shopping/.test(x)) return { shoppingFamily: 'general_shopping', shoppingSubtype: 'luxury', venueIcon: '💎', venueLabel: 'Luxury Shopping', venueColor: '#BE185D' };
  if (/duty.free|tax.free/.test(x)) return { shoppingFamily: 'general_shopping', shoppingSubtype: 'duty_free', venueIcon: '✈️', venueLabel: 'Duty Free', venueColor: '#0891B2' };
  if (/mall|shopping center|shopping centre|department store|nordstrom|macy|saks|selfridge|harrods|galeries/.test(x)) return { shoppingFamily: 'general_shopping', shoppingSubtype: 'mall', venueIcon: '🏬', venueLabel: 'Shopping Mall', venueColor: '#7C3AED' };
  return { shoppingFamily: 'general_shopping', shoppingSubtype: 'shopping', venueIcon: '🛍️', venueLabel: 'Shopping', venueColor: '#7C3AED' };
}
function shopTravelerScore(p, category) {
  const kind = p.shoppingKind || {};
  const familyMatch = (category === 'food_shopping' || ['supermarkets','warehouse_clubs','farmers_markets','wet_markets','bodegas_corner_stores','butcher_shops'].includes(category))
    ? (kind.shoppingFamily === 'food_shopping' ? 40 : 0)
    : (kind.shoppingFamily === 'general_shopping' ? 30 : 0);
  const openNow = p.isOpen === true ? 15 : 0;
  const ratingScore = ((p.rating || 0) / 5) * 15;
  const distanceScore = Math.max(0, 12 - (p.distanceMiles || 0) * 2);
  const photoScore = Math.min((p.photos?.length || 0), 5);
  return familyMatch + openNow + ratingScore + distanceScore + photoScore;
}
async function handleShoppingPlaces(request, env, ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, radius = 16093, maxResults = 30, category = 'all', forceRefresh = false } = body;
    if (!latitude || !longitude) return jsonResponse({ error: 'Location required', places: [] }, 400);
    const origin = new URL(request.url).origin;
    const queries = SHOP_CATEGORY_QUERIES[category] || SHOP_CATEGORY_QUERIES.all;

    const seen = new Set();
    const places = [];
    const batchSize = 8;
    for (let i = 0; i < queries.length; i += batchSize) {
      const results = await Promise.all(queries.slice(i, i + batchSize).map(q =>
        rrTextSearch(env, ctx, origin, { query: q, latitude, longitude, radius, maxResults: 10, forceRefresh }).catch(() => [])
      ));
      for (const arr of results) for (const pl of arr) { const id = pl.id || pl.placeId; if (id && !seen.has(id)) { seen.add(id); places.push(pl); } }
    }

    if (!places.length) return jsonResponse({ places: [], count: 0, error: 'No shopping found nearby.' });

    const out = places.slice(0, maxResults * 2).map(p => {
      const lat = p.location?.latitude || 0;
      const lng = p.location?.longitude || 0;
      const d = rrCalcDist(latitude, longitude, lat, lng);
      const name = p.displayName?.text || p.name || '';
      const rev = (p.reviews || []).map(r => shopSafeLower(r?.text?.text ?? r?.text ?? r?.originalText?.text ?? '')).join(' ');
      const txt = `${name.toLowerCase()} ${(p.types || []).join(' ')} ${rev}`;
      const photos = (p.photos || []).map(ph => ph.url || ph).filter(Boolean).slice(0, 5);
      const hours = p.currentOpeningHours?.weekdayDescriptions || p.regularOpeningHours?.weekdayDescriptions || p.hours || [];
      const shoppingKind = shopDetectKind(name, p.types || [], rev);
      const highlights = [];
      if (shoppingKind.shoppingFamily === 'food_shopping') {
        if (shopSc(txt, SHOP_SIG.fresh) > 0) highlights.push('Fresh Produce');
        if (/organic/.test(txt)) highlights.push('Organic Options');
        if (/international/.test(txt)) highlights.push('International Foods');
        if (/prepared food/.test(txt)) highlights.push('Prepared Foods');
        if (shopSc(txt, SHOP_SIG.budget) > 0) highlights.push('Budget Friendly');
        if (shopSc(txt, SHOP_SIG.tourist) > 0) highlights.push('Tourist Friendly');
        if (/24 hour|open late/.test(txt)) highlights.push('Open Late');
      } else {
        if (shopSc(txt, SHOP_SIG.luxury) > 1) highlights.push('Luxury Brands');
        if (shopSc(txt, SHOP_SIG.dutyFree) > 0) highlights.push('Duty Free');
        if (shopSc(txt, SHOP_SIG.local) > 1) highlights.push('Local Crafts');
        if (shopSc(txt, SHOP_SIG.foodCourt) > 0) highlights.push('Food & Dining');
        if (shopSc(txt, SHOP_SIG.bargain) > 0) highlights.push('Bargain Hunting');
        if (shopSc(txt, SHOP_SIG.tourist) > 1) highlights.push('Tourist Favorite');
        if (shopSc(txt, SHOP_SIG.outdoor) > 0) highlights.push('Open Air');
      }
      return {
        id: p.id, placeId: p.id,
        displayName: p.displayName || { text: name },
        name, location: { latitude: lat, longitude: lng }, lat, lng,
        formattedAddress: p.formattedAddress || '', shortFormattedAddress: p.shortFormattedAddress || '',
        distanceKm: d, distanceMiles: d * 0.621371, distance: `${(d * 0.621371).toFixed(1)} mi`,
        rating: p.rating || null, userRatingCount: p.userRatingCount || 0,
        isOpen: p.isOpen ?? null, hours,
        currentOpeningHours: { openNow: p.isOpen, weekdayDescriptions: hours },
        photos, photoUrl: photos[0] || null,
        nationalPhoneNumber: p.nationalPhoneNumber || '', internationalPhoneNumber: p.internationalPhoneNumber || '',
        websiteUri: p.websiteUri || '', googleMapsUri: p.googleMapsUri || '',
        types: p.types || [], primaryType: p.primaryType || null,
        shoppingFamily: shoppingKind.shoppingFamily, shoppingSubtype: shoppingKind.shoppingSubtype,
        venueIcon: shoppingKind.venueIcon, venueLabel: shoppingKind.venueLabel, venueColor: shoppingKind.venueColor,
        highlights,
        props: {
          isLuxury: shopSc(txt, SHOP_SIG.luxury) > 1,
          isBudget: shopSc(txt, SHOP_SIG.budget) > 0,
          hasFoodCourt: shopSc(txt, SHOP_SIG.foodCourt) > 0,
          hasFreeParking: shopSc(txt, SHOP_SIG.parking) > 0,
          isOutdoor: shopSc(txt, SHOP_SIG.outdoor) > 0,
          isIndoor: shopSc(txt, SHOP_SIG.indoor) > 0,
          hasLocalCrafts: shopSc(txt, SHOP_SIG.local) > 1,
          isDutyFree: shopSc(txt, SHOP_SIG.dutyFree) > 0,
          isBargain: shopSc(txt, SHOP_SIG.bargain) > 0,
          isTouristFav: shopSc(txt, SHOP_SIG.tourist) > 1,
          isFoodShopping: shoppingKind.shoppingFamily === 'food_shopping',
          hasFreshProduce: shopSc(txt, SHOP_SIG.fresh) > 0,
          isOpenLate: /24 hour|open late|midnight/.test(txt),
          isBudgetFriendly: shopSc(txt, SHOP_SIG.budget) > 0,
        },
        shoppingKind,
      };
    });

    out.sort((a, b) => shopTravelerScore(b, category) - shopTravelerScore(a, category));
    const final = out.slice(0, maxResults).map(({ shoppingKind, ...rest }) => rest);
    return jsonResponse({ places: final, count: final.length, version: 'v3.0-worker' });
  } catch (e) {
    return jsonResponse({ error: e.message, places: [] }, 200);
  }
}

// ============================================================================
// CONVENIENCE STORE FINDER — ported from base44/functions/getConvenienceStores.
// Country/region detection, chain DB, payment analysis, location-context,
// traveler scoring. Drops the Base44-entity cache (Worker text-search already
// caches per query). Reuses rrTextSearch / rrCalcDist.
// ============================================================================
const CONV_STORE_CATEGORIES = { convenience: { label: 'Convenience Store', icon: '🏪' }, drugstore: { label: 'Drugstore', icon: '💊' }, gas_station: { label: 'Gas Station Mart', icon: '⛽' }, mini_market: { label: 'Mini Market', icon: '🛒' }, grocery_express: { label: 'Grocery Express', icon: '🥬' }, transit_kiosk: { label: 'Transit Kiosk', icon: '🚇' } };
const CONV_LOCATION_CONTEXTS = { standalone: { label: 'Standalone', icon: '🏬' }, gas_station: { label: 'In Gas Station', icon: '⛽' }, subway: { label: 'Subway/Transit', icon: '🚇' }, airport: { label: 'Airport', icon: '✈️' }, mall: { label: 'Inside Mall', icon: '🛍️' }, highway: { label: 'Highway/Roadside', icon: '🛣️' } };
const CONV_PAYMENT_NORMS = { US: { cards: 'high', tip: 'Cards and Apple Pay widely accepted' }, CA: { cards: 'high', tip: 'Cards widely accepted' }, GB: { cards: 'high', tip: 'Contactless very common' }, JP: { cards: 'high', tip: 'IC cards work everywhere' }, KR: { cards: 'high', tip: 'Cards accepted everywhere' }, DE: { cards: 'medium', tip: 'Cash still preferred in many places' }, CH: { cards: 'high', tip: 'Cards widely accepted' }, PH: { cards: 'low', tip: 'Cash preferred. GCash/Maya growing' }, TH: { cards: 'medium', tip: 'Big chains accept cards' }, MX: { cards: 'medium', tip: 'OXXO accepts cards' }, CO: { cards: 'medium', tip: 'Cash common at small stores' }, AU: { cards: 'high', tip: 'Tap-to-pay very common' }, AE: { cards: 'high', tip: 'Cards and Apple Pay widely accepted' }, IL: { cards: 'high', tip: 'Cards widely accepted' }, IR: { cards: 'none', tip: 'Cash only. International cards do not work' }, DEFAULT: { cards: 'medium', tip: 'Payment methods may vary' } };
const CONV_CHAIN_DB = {
  '7-Eleven': { category: 'convenience', services: ['atm','hot_food','coffee'], open_24h: true, payments: ['visa','mastercard','apple_pay','cash'], score: 95 },
  'Circle K': { category: 'convenience', services: ['atm','hot_food','fuel'], open_24h: true, payments: ['visa','mastercard','apple_pay','cash'], gas: true, score: 90 },
  'FamilyMart': { category: 'convenience', services: ['atm','hot_food','coffee'], open_24h: true, payments: ['visa','mastercard','cash'], score: 92 },
  'Wawa': { category: 'convenience', services: ['atm','hot_food','coffee','fuel'], open_24h: true, payments: ['visa','mastercard','apple_pay','cash'], score: 94 },
  'Sheetz': { category: 'convenience', services: ['atm','hot_food','fuel'], open_24h: true, payments: ['visa','mastercard','apple_pay','cash'], score: 93 },
  'CVS': { category: 'drugstore', services: ['atm','pharmacy'], payments: ['visa','mastercard','apple_pay','cash'], score: 88 },
  'Walgreens': { category: 'drugstore', services: ['atm','pharmacy'], payments: ['visa','mastercard','apple_pay','cash'], score: 87 },
  'OXXO': { category: 'convenience', services: ['atm','hot_food'], open_24h: true, payments: ['visa','mastercard','cash'], score: 90 },
  'Lawson': { category: 'convenience', services: ['atm','hot_food','coffee'], open_24h: true, payments: ['visa','mastercard','cash'], score: 93 },
  'CU': { category: 'convenience', services: ['atm','hot_food'], open_24h: true, payments: ['visa','mastercard','cash'], score: 90 },
  'GS25': { category: 'convenience', services: ['atm','hot_food'], open_24h: true, payments: ['visa','mastercard','cash'], score: 90 },
  'Mercury Drug': { category: 'drugstore', services: ['pharmacy'], payments: ['cash','gcash'], score: 85 },
  'Alfamart': { category: 'convenience', services: [], payments: ['cash','gcash'], score: 75 },
  'Indomaret': { category: 'convenience', services: ['atm'], payments: ['visa','mastercard','cash'], score: 78 },
  'Tesco Express': { category: 'grocery_express', services: ['atm'], payments: ['visa','mastercard','apple_pay','cash'], score: 85 },
  'Boots': { category: 'drugstore', services: ['pharmacy'], payments: ['visa','mastercard','apple_pay','cash'], score: 88 },
  'Coop Pronto': { category: 'convenience', services: ['atm','coffee'], payments: ['visa','mastercard','cash'], score: 85 },
  'Migrolino': { category: 'convenience', services: ['atm','hot_food'], payments: ['visa','mastercard','cash'], score: 85 },
  'Shell': { category: 'gas_station', services: ['atm','fuel'], payments: ['visa','mastercard','cash'], gas: true, score: 82 },
  'BP': { category: 'gas_station', services: ['atm','fuel'], payments: ['visa','mastercard','cash'], gas: true, score: 80 },
  'Zoom': { category: 'convenience', services: ['atm'], open_24h: true, payments: ['visa','mastercard','apple_pay','cash'], score: 85 },
  'AMPM': { category: 'convenience', services: ['atm','hot_food'], open_24h: true, payments: ['visa','mastercard','cash'], score: 88 },
};
const CONV_REGIONAL_TERMS = { usa: ['convenience store','7-Eleven','CVS','Walgreens','gas station'], japan: ['convenience store','konbini','Lawson','FamilyMart'], korea: ['convenience store','CU','GS25'], philippines: ['convenience store','Mercury Drug','sari-sari'], europe: ['convenience store','Tesco Express','Spar'], default: ['convenience store','mini mart','drugstore','pharmacy'] };
function convDetectCountry(lat, lng) {
  if (lat >= 24 && lat <= 50 && lng >= -130 && lng <= -65) return 'US';
  if (lat >= 42 && lat <= 83 && lng >= -141 && lng <= -52) return 'CA';
  if (lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86) return 'MX';
  if (lat >= -4 && lat <= 13 && lng >= -82 && lng <= -66) return 'CO';
  if (lat >= 4 && lat <= 21 && lng >= 116 && lng <= 127) return 'PH';
  if (lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154) return 'JP';
  if (lat >= 33 && lat <= 43 && lng >= 124 && lng <= 132) return 'KR';
  if (lat >= 49 && lat <= 61 && lng >= -11 && lng <= 2) return 'GB';
  if (lat >= 45.5 && lat <= 48 && lng >= 5.5 && lng <= 10.5) return 'CH';
  if (lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57) return 'AE';
  if (lat >= 29 && lat <= 34 && lng >= 34 && lng <= 36) return 'IL';
  if (lat >= -45 && lat <= -10 && lng >= 110 && lng <= 155) return 'AU';
  return 'DEFAULT';
}
function convGetRegion(cc) { return ({ US: 'usa', CA: 'usa', MX: 'usa', JP: 'japan', KR: 'korea', PH: 'philippines', TH: 'philippines', ID: 'philippines', GB: 'europe', DE: 'europe', FR: 'europe', CH: 'europe' })[cc] || 'default'; }
function convMatchChain(name) { const lower = (name || '').toLowerCase(); for (const cn of Object.keys(CONV_CHAIN_DB)) { if (lower.includes(cn.toLowerCase())) return { name: cn, ...CONV_CHAIN_DB[cn] }; } return null; }
function convDetectContext(place) {
  const name = ((place.displayName && place.displayName.text) || place.name || '').toLowerCase();
  const types = (place.types || []).join(' ');
  if (name.includes('airport') || name.includes('terminal')) return 'airport';
  if (name.includes('station') || name.includes('metro') || name.includes('subway')) return 'subway';
  if (name.includes('mall') || name.includes('plaza')) return 'mall';
  if (name.includes('highway') || name.includes('truck stop')) return 'highway';
  if (types.includes('gas_station') || name.includes('gas') || name.includes('petrol')) return 'gas_station';
  return 'standalone';
}
function convAnalyzePayments(chain, cc) {
  const norms = CONV_PAYMENT_NORMS[cc] || CONV_PAYMENT_NORMS.DEFAULT;
  if (chain && chain.payments) return { payments: chain.payments, confidence: 'likely', sources: ['Chain standard'], warnings: [], tip: norms.tip, acceptsCards: chain.payments.includes('visa') || chain.payments.includes('mastercard'), acceptsMobile: chain.payments.includes('apple_pay') || chain.payments.includes('google_pay'), cashOnly: chain.payments.length === 1 && chain.payments[0] === 'cash' };
  if (norms.cards === 'high') return { payments: ['visa','mastercard','cash'], confidence: 'estimated', sources: ['Country norm'], warnings: [], tip: norms.tip, acceptsCards: true, acceptsMobile: false, cashOnly: false };
  if (norms.cards === 'none') return { payments: ['cash'], confidence: 'estimated', sources: ['Country norm'], warnings: ['International cards do not work'], tip: norms.tip, acceptsCards: false, acceptsMobile: false, cashOnly: true };
  return { payments: ['cash'], confidence: 'unknown', sources: ['Country norm'], warnings: ['Cards may not be accepted'], tip: norms.tip, acceptsCards: false, acceptsMobile: false, cashOnly: true };
}
function convProcessStore(place, userLat, userLng, cc) {
  const name = (place.displayName && place.displayName.text) || place.name || 'Unknown';
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (!lat || !lng) return null;
  const distance = rrCalcDist(userLat, userLng, lat, lng) * 0.621371;
  const chain = convMatchChain(name);
  const context = (chain && chain.gas) ? 'gas_station' : convDetectContext(place);
  const pay = convAnalyzePayments(chain, cc);
  let category = 'convenience';
  const types = place.types || [];
  if (chain) category = chain.category;
  else if (types.includes('pharmacy') || types.includes('drugstore')) category = 'drugstore';
  else if (types.includes('gas_station')) category = 'gas_station';
  else if (types.includes('supermarket')) category = 'mini_market';
  const hours = place.currentOpeningHours || place.regularOpeningHours || {};
  const isOpen = hours.openNow != null ? hours.openNow : null;
  const is24h = (chain && chain.open_24h) || false;
  const services = (chain && chain.services) || [];
  const photos = (place.photos || []).slice(0, 3);
  const catInfo = CONV_STORE_CATEGORIES[category] || { label: 'Store', icon: '🏪' };
  const locInfo = CONV_LOCATION_CONTEXTS[context] || { label: 'Standalone', icon: '🏬' };
  return {
    id: place.id || place.placeId || `store-${lat}-${lng}`, place_id: place.id || place.placeId,
    name, address: place.formattedAddress || place.vicinity || '',
    latitude: lat, longitude: lng, distance_miles: Math.round(distance * 100) / 100,
    rating: place.rating || null, review_count: place.userRatingCount || 0,
    category, category_label: catInfo.label, category_icon: catInfo.icon,
    location_context: context, location_context_label: locInfo.label, location_context_icon: locInfo.icon,
    is_in_gas_station: context === 'gas_station', is_standalone: context === 'standalone',
    is_open: isOpen, is_24_hours: is24h, hours: hours.weekdayDescriptions || [],
    has_atm: services.includes('atm'), has_restroom: services.includes('restroom'),
    has_pharmacy: services.includes('pharmacy') || category === 'drugstore',
    has_hot_food: services.includes('hot_food'), has_coffee: services.includes('coffee'), has_fuel: services.includes('fuel'),
    payments: pay.payments, payment_confidence: pay.confidence, payment_sources: pay.sources, payment_warnings: pay.warnings, payment_country_tip: pay.tip,
    accepts_cards: pay.acceptsCards, accepts_mobile_pay: pay.acceptsMobile, cash_only: pay.cashOnly, foreign_cards_friendly: pay.acceptsCards,
    is_known_chain: !!chain, matched_chain: chain ? chain.name : null, traveler_score: chain ? chain.score : 50,
    photos: photos.map((p, i) => ({ name: p.name, type: i === 0 ? 'exterior' : 'interior' })), has_photos: photos.length > 0,
    phone: place.nationalPhoneNumber || null, website: place.websiteUri || null, google_maps_url: place.googleMapsUri || null,
  };
}
async function handleConvenienceStores(request, env, ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, radius = 10, category = 'all', openOnly = false, open24Hours = false, hasHotFood = false, hasATM = false, hasPharmacy = false, hasRestroom = false, hasCoffee = false, acceptsCards = false, acceptsMobilePay = false, hasGas = false, locationType = 'all', sortBy = 'traveler_best', limit = 50, forceRefresh = false } = body;
    if (!latitude || !longitude) return jsonResponse({ error: 'Latitude and longitude required', stores: [], total_count: 0 }, 400);
    const radiusMiles = parseFloat(radius);
    const radiusMeters = radiusMiles * 1609.34;
    const cc = convDetectCountry(latitude, longitude);
    const region = convGetRegion(cc);
    const origin = new URL(request.url).origin;

    const terms = CONV_REGIONAL_TERMS[region] || CONV_REGIONAL_TERMS.default;
    const seen = new Set();
    const allStores = [];
    const batchSize = 8;
    for (let i = 0; i < terms.length; i += batchSize) {
      const results = await Promise.all(terms.slice(i, i + batchSize).map(q =>
        rrTextSearch(env, ctx, origin, { query: q, latitude, longitude, radius: radiusMeters, maxResults: 20, forceRefresh }).catch(() => [])
      ));
      for (const arr of results) for (const p of arr) {
        const id = p.id || p.placeId;
        if (id && !seen.has(id)) { seen.add(id); const store = convProcessStore(p, latitude, longitude, cc); if (store && store.distance_miles <= radiusMiles) allStores.push(store); }
      }
    }

    let filtered = [...allStores];
    if (category !== 'all') filtered = filtered.filter(s => s.category === category);
    if (openOnly) filtered = filtered.filter(s => s.is_open === true || s.is_24_hours);
    if (open24Hours) filtered = filtered.filter(s => s.is_24_hours);
    if (hasHotFood) filtered = filtered.filter(s => s.has_hot_food);
    if (hasATM) filtered = filtered.filter(s => s.has_atm);
    if (hasPharmacy) filtered = filtered.filter(s => s.has_pharmacy);
    if (hasRestroom) filtered = filtered.filter(s => s.has_restroom);
    if (hasCoffee) filtered = filtered.filter(s => s.has_coffee);
    if (hasGas) filtered = filtered.filter(s => s.has_fuel);
    if (acceptsCards) filtered = filtered.filter(s => s.accepts_cards);
    if (acceptsMobilePay) filtered = filtered.filter(s => s.accepts_mobile_pay);
    if (locationType !== 'all') filtered = filtered.filter(s => s.location_context === locationType);

    if (sortBy === 'nearby') filtered.sort((a, b) => a.distance_miles - b.distance_miles);
    else if (sortBy === 'rating') filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === '24h_first') filtered.sort((a, b) => { if (a.is_24_hours && !b.is_24_hours) return -1; if (!a.is_24_hours && b.is_24_hours) return 1; return a.distance_miles - b.distance_miles; });
    else filtered.sort((a, b) => { const sa = (a.is_known_chain ? 20 : 0) + (a.is_open ? 15 : 0) + (10 - a.distance_miles); const sb = (b.is_known_chain ? 20 : 0) + (b.is_open ? 15 : 0) + (10 - b.distance_miles); return sb - sa; });

    const categoryCounts = { all: filtered.length, convenience: filtered.filter(s => s.category === 'convenience').length, drugstore: filtered.filter(s => s.category === 'drugstore').length, gas_station: filtered.filter(s => s.category === 'gas_station').length, mini_market: filtered.filter(s => s.category === 'mini_market').length };
    const commonPayments = cc === 'PH' ? ['GCash','Maya','Cash'] : cc === 'JP' ? ['IC Cards','Cash'] : ['Cards','Apple Pay','Cash'];

    return jsonResponse({ stores: filtered.slice(0, limit), all_stores: allStores, total_count: filtered.length, category_counts: categoryCounts, country_code: cc, region, common_payments: commonPayments, from_cache: false });
  } catch (e) {
    return jsonResponse({ error: e.message, stores: [] }, 200);
  }
}

// ── Money Exchange (ported from Base44 getExchangeRate + getMoneyExchangeLocations) ──
// Live mid-market rate from exchangerate-api.com. Requires secret EXCHANGERATE_API_KEY.
async function handleExchangeRate(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { from, to, amount } = body;
    if (!from || !to) return jsonResponse({ error: 'from and to currencies are required' }, 400);

    const apiKey = env.EXCHANGERATE_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'Exchange Rate API key not configured' }, 500);

    const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from}/${to}`);
    if (!res.ok) {
      const details = await res.text().catch(() => '');
      return jsonResponse({ error: `Exchange Rate API returned ${res.status}`, details }, 502);
    }
    const data = await res.json();
    if (data.result !== 'success') return jsonResponse({ error: 'Exchange rate API error', details: data }, 502);

    const rate = data.conversion_rate;
    const convertedAmount = amount ? parseFloat(amount) * rate : null;
    return jsonResponse({
      from_currency: from,
      to_currency: to,
      exchange_rate: rate,
      rate_description: `1 ${from} = ${rate.toFixed(4)} ${to}`,
      converted_amount: convertedAmount,
      last_updated: data.time_last_update_utc,
    });
  } catch (e) {
    return jsonResponse({ error: 'Internal server error', details: e.message }, 500);
  }
}

// Currency-exchange storefronts near a point. Locations come from the cached
// Google text/nearby helpers; the rate is fetched LIVE per request (never
// cached) with a ±2% per-location spread to mimic counter-to-counter variance.
async function handleMoneyExchange(request, env, ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      latitude, longitude, fromCurrency, toCurrency,
      radiusMiles = 5, limit, sortBy = 'distance', openOnly = false, forceRefresh = false,
    } = body;

    if (!latitude || !longitude) {
      return jsonResponse({ error: 'Latitude and longitude required', locations: [], all_locations: [] }, 400);
    }

    const origin = new URL(request.url).origin;
    const radiusMeters = Math.min(radiusMiles * 1609.34, 50000);
    const fetchCount = openOnly ? 50 : 20;

    // Primary: text search for exchange storefronts. Fallback: nearby financial institutions.
    let places = await rrTextSearch(env, ctx, origin, {
      query: 'currency exchange OR money exchange OR bureau de change',
      latitude, longitude, radius: radiusMeters, maxResults: fetchCount, forceRefresh,
    }).catch(() => []);
    if (!places.length) {
      places = await rrNearbySearch(env, ctx, origin, {
        types: 'financial_institution',
        latitude, longitude, radius: radiusMeters, maxResults: fetchCount, forceRefresh,
      }).catch(() => []);
    }

    // Live mid-market rate (never cached). Per-location variance applied below.
    let baseRate = null;
    if (fromCurrency && toCurrency && env.EXCHANGERATE_API_KEY) {
      try {
        const r = await fetch(`https://v6.exchangerate-api.com/v6/${env.EXCHANGERATE_API_KEY}/pair/${fromCurrency}/${toCurrency}`);
        const d = await r.json();
        if (d.result === 'success') baseRate = d.conversion_rate;
      } catch { /* rate is optional; locations still return */ }
    }

    const today = new Date().getDay();
    const locations = [];
    for (const place of places) {
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (lat == null || lng == null) continue;

      const distance = rrCalcDist(latitude, longitude, lat, lng) * 0.621371; // km → miles
      if (distance > radiusMiles) continue;

      const isOpen = place.currentOpeningHours?.openNow ?? place.regularOpeningHours?.openNow ?? place.isOpen ?? false;
      if (openOnly && !isOpen) continue;

      let rate = null;
      if (baseRate) rate = baseRate * (1 + ((Math.random() * 0.04) - 0.02)); // ±2%

      const weekday = place.currentOpeningHours?.weekdayDescriptions
        || place.regularOpeningHours?.weekdayDescriptions
        || place.hours || [];

      locations.push({
        name: place.displayName?.text || place.name || 'Currency Exchange',
        address: place.formattedAddress || place.address || '',
        phone: place.nationalPhoneNumber || place.phone || null,
        latitude: lat,
        longitude: lng,
        distance_miles: distance,
        exchange_rate: rate,
        type: 'Currency Exchange',
        hours_today: weekday[today] || null,
        hours: weekday,
        website: place.websiteUri || place.website || null,
        is_open: isOpen,
      });
    }

    if (sortBy === 'rate') {
      const withRates = locations.filter(l => l.exchange_rate != null).sort((a, b) => b.exchange_rate - a.exchange_rate);
      const withoutRates = locations.filter(l => l.exchange_rate == null);
      locations.length = 0;
      locations.push(...withRates, ...withoutRates);
    } else {
      locations.sort((a, b) => a.distance_miles - b.distance_miles);
    }

    const limited = limit ? locations.slice(0, limit) : locations;
    return jsonResponse({ locations: limited, all_locations: locations, source: 'live', fetched_at: new Date().toISOString() });
  } catch (e) {
    return jsonResponse({ error: 'Internal server error', details: e.message, locations: [], all_locations: [] }, 500);
  }
}

// ════════════════════════════════════════════════════════════════════════
// Things To Do (ported from Base44 getActivities v6.1-d1)
// Worldwide activities: landmarks, museums, parks, tours, nightlife, etc.
// D1 curated seed (fast) merged with Google Places fallback (slow). Same
// input/output shape as the Base44 function so the page is a 1-line repoint.
// ════════════════════════════════════════════════════════════════════════
const GA_QUERIES = [
  // Landmarks & Culture
  "tourist attraction","historic landmark","monument","heritage site",
  "museum","art gallery","cultural center",
  // Nature & Outdoors
  "national park","nature reserve","botanical garden",
  "scenic viewpoint","hiking trail","beach","waterfall",
  "lighthouse","ancient ruins",
  // Water (universal: inland + coastal)
  "kayaking","canoeing","snorkeling","swimming hole","river swimming",
  // Mountain & Adventure (universal: Google returns 0 in flat regions)
  "rock climbing","zip line","cave","canyon",
  // Wellness (universal per founder direction — every culture has these)
  "spa","massage","hot spring",
  // Tours & Experiences (tour_mode derived from the query name)
  "guided tour","walking tour","bike tour","boat tour","food tour",
  // Entertainment
  "theme park","amusement park","water park","theater",
  // Nightlife
  "rooftop bar","night club","winery","distillery",
  // Family
  "zoo","aquarium",
];

// Country-conditional queries layered on top of the universal list.
const GA_REGIONAL_QUERIES = {
  Japan:        ['onsen'],
  'South Korea':['onsen','jjimjilbang'],
  Taiwan:       ['onsen','hot spring resort'],
  Morocco:      ['hammam','souk'],
  Tunisia:      ['hammam'],
  Egypt:        ['hammam','souk'],
  Turkey:       ['hammam','turkish bath'],
  Jordan:       ['hammam'],
  'United Arab Emirates': ['hammam','souk'],
};

// Tour-mode mapping — frontend shows "🚶 Walking tour" etc. without re-parsing.
const GA_TOUR_MODE_BY_QUERY = {
  'walking tour': 'walking',
  'food tour':    'walking',
  'bike tour':    'biking',
  'boat tour':    'boating',
};

// Named-landmark seed queries by city / region / country (Stage B guarantee).
const GA_STAPLE_LANDMARKS = {
  // ── East Asia ──
  Japan:       ['cherry blossoms','sakura viewing','Mount Fuji','tea ceremony'],
  Tokyo:       ['Shibuya crossing','Sensoji temple','Tokyo Skytree','Tsukiji outer market','Meiji shrine','teamLab planets'],
  Kyoto:       ['Fushimi Inari shrine','Kinkakuji','Arashiyama bamboo grove','Gion district','Kiyomizu-dera'],
  Osaka:       ['Osaka Castle','Dotonbori','Universal Studios Japan','Shitennoji'],
  'South Korea':['Gyeongbokgung palace','Bukchon hanok village','Nami island'],
  Seoul:       ['Gyeongbokgung palace','Bukchon hanok village','N Seoul Tower','Myeongdong','Insadong'],
  Taiwan:      ['Taipei 101','Taroko gorge','night market','Sun Moon Lake'],
  Taipei:      ['Taipei 101','Shilin night market','Chiang Kai-shek memorial','Longshan temple'],
  China:       ['Great Wall of China','Forbidden City','Terracotta Army'],
  Beijing:     ['Great Wall of China','Forbidden City','Temple of Heaven','Summer Palace'],
  'Hong Kong': ['Victoria Peak','Star Ferry','Tian Tan Buddha','Symphony of Lights'],
  // ── Southeast Asia ──
  Philippines: ['jeepney ride','island hopping','halo halo'],
  Bohol:       ['Chocolate Hills','Tarsier sanctuary','Loboc river cruise','Panglao beach','Hinagdanan cave','Sandugo blood compact marker'],
  Cebu:        ['Magellan Cross','Basilica Santo Nino','Kawasan Falls','Oslob whale shark watching','Temple of Leah'],
  Palawan:     ['Puerto Princesa underground river','El Nido island hopping','Coron lagoons','Honda Bay'],
  Manila:      ['Intramuros','Rizal Park','Fort Santiago','National Museum of the Philippines','Binondo Chinatown'],
  Boracay:     ['White Beach','Puka Shell Beach','Mount Luho','Ariels Point cliff jumping'],
  Vietnam:     ['Ha Long Bay','Mekong delta','pho','egg coffee'],
  Hanoi:       ['Hoan Kiem lake','Temple of Literature','Old Quarter','Ho Chi Minh mausoleum'],
  'Ho Chi Minh City': ['Cu Chi tunnels','War Remnants Museum','Notre-Dame Saigon','Ben Thanh market'],
  Thailand:    ['Grand Palace','floating market','Phi Phi Islands','Buddhist temple'],
  Bangkok:     ['Grand Palace','Wat Pho','Wat Arun','Chatuchak market','Khao San road'],
  'Chiang Mai':['Doi Suthep','Old City temples','Night Bazaar','Elephant Nature Park'],
  Indonesia:   ['Borobudur','Komodo dragon','rice terraces'],
  Bali:        ['Tegalalang rice terraces','Tanah Lot','Uluwatu temple','Mount Batur sunrise','Ubud monkey forest','Gili Islands'],
  Singapore:   ['Marina Bay Sands','Gardens by the Bay','Sentosa','Merlion park','Hawker centre'],
  Malaysia:    ['Petronas Towers','Batu Caves','Penang street art'],
  Cambodia:    ['Angkor Wat','Ta Prohm','Bayon temple','Tonle Sap'],
  Laos:        ['Luang Prabang','Kuang Si falls','Plain of Jars'],
  // ── South Asia ──
  India:       ['Taj Mahal','Ganges','Holi festival','tuk tuk ride'],
  Delhi:       ['Red Fort','Qutub Minar','India Gate','Humayuns Tomb'],
  Mumbai:      ['Gateway of India','Marine Drive','Elephanta Caves','Dharavi tour'],
  Jaipur:      ['Amber Fort','Hawa Mahal','City Palace','Jantar Mantar'],
  Agra:        ['Taj Mahal','Agra Fort','Mehtab Bagh'],
  'Sri Lanka': ['Sigiriya','tea plantations','Galle Fort','elephant safari'],
  Nepal:       ['Mount Everest','Annapurna','Pashupatinath','Boudhanath'],
  // ── Middle East ──
  'United Arab Emirates': ['Burj Khalifa','Burj Al Arab','desert safari','Dubai Mall'],
  Dubai:       ['Burj Khalifa','Burj Al Arab','Palm Jumeirah','desert safari','Dubai Fountain','Dubai Mall'],
  Turkey:      ['Cappadocia balloon ride','Pamukkale','Bosphorus cruise'],
  Istanbul:    ['Hagia Sophia','Blue Mosque','Grand Bazaar','Topkapi Palace','Bosphorus cruise'],
  Jordan:      ['Petra','Wadi Rum','Dead Sea'],
  Israel:      ['Western Wall','Dead Sea','Masada'],
  // ── North Africa ──
  Egypt:       ['Pyramids of Giza','Sphinx','Nile cruise','Karnak temple'],
  Cairo:       ['Pyramids of Giza','Sphinx','Egyptian Museum','Khan el-Khalili'],
  Morocco:     ['Sahara desert tour','Atlas Mountains','medina'],
  Marrakech:   ['Jemaa el-Fnaa','Bahia Palace','Majorelle Garden','Medina souk'],
  // ── Sub-Saharan Africa ──
  Kenya:       ['Maasai Mara safari','Mount Kenya','Diani Beach'],
  Tanzania:    ['Serengeti safari','Mount Kilimanjaro','Zanzibar','Ngorongoro Crater'],
  'South Africa': ['Table Mountain','Kruger safari','Robben Island'],
  'Cape Town': ['Table Mountain','Cape of Good Hope','Robben Island','V&A Waterfront'],
  // ── Europe ──
  France:      ['Eiffel Tower','Louvre','Versailles'],
  Paris:       ['Eiffel Tower','Louvre','Notre-Dame','Sacre-Coeur','Champs-Elysees','Seine river cruise','Versailles'],
  Italy:       ['Colosseum','Vatican','gondola ride','Cinque Terre'],
  Rome:        ['Colosseum','Vatican Museums','Trevi Fountain','Pantheon','Roman Forum'],
  Venice:      ['gondola ride','St Marks Square','Doges Palace','Rialto bridge','Murano glass'],
  Florence:    ['Uffizi Gallery','Duomo','Ponte Vecchio','Accademia Galleria'],
  Spain:       ['Sagrada Familia','flamenco','Alhambra','tapas tour'],
  Barcelona:   ['Sagrada Familia','Park Guell','Casa Batllo','Gothic Quarter','La Rambla'],
  Madrid:      ['Prado Museum','Royal Palace','Retiro Park','Plaza Mayor'],
  Granada:     ['Alhambra','Generalife gardens','Albaicin'],
  'United Kingdom':['Stonehenge','Buckingham Palace','Roman Baths'],
  London:      ['Tower of London','Buckingham Palace','British Museum','London Eye','Westminster Abbey','Tower Bridge'],
  Germany:     ['Neuschwanstein Castle','Brandenburg Gate','Christmas market'],
  Berlin:      ['Brandenburg Gate','Reichstag','Berlin Wall memorial','Museum Island'],
  Netherlands: ['canal cruise','tulip fields','windmills'],
  Amsterdam:   ['Anne Frank House','Van Gogh Museum','Rijksmuseum','canal cruise'],
  Greece:      ['Acropolis','Santorini sunset','Mykonos'],
  Athens:      ['Acropolis','Parthenon','Plaka','Ancient Agora'],
  Portugal:    ['Pena Palace','port wine tour','Belem Tower'],
  Lisbon:      ['Belem Tower','Jeronimos Monastery','tram 28','Alfama district'],
  Iceland:     ['Northern Lights','Blue Lagoon','Geysir','Gullfoss waterfall'],
  Reykjavik:   ['Hallgrimskirkja','Blue Lagoon','Golden Circle tour','Northern Lights'],
  Norway:      ['fjord cruise','Northern Lights','Preikestolen','midnight sun'],
  // ── Americas ──
  'United States': [],
  'New York':  ['Statue of Liberty','Empire State Building','Central Park','Times Square','9/11 Memorial','Brooklyn Bridge','High Line'],
  'San Francisco': ['Golden Gate Bridge','Alcatraz','Fishermans Wharf','Cable Car','Lombard Street','Painted Ladies'],
  'Los Angeles': ['Hollywood Walk of Fame','Griffith Observatory','Santa Monica Pier','Universal Studios Hollywood'],
  'Las Vegas': ['Las Vegas Strip','Fremont Street','Bellagio fountains','Hoover Dam'],
  Honolulu:    ['Diamond Head','Pearl Harbor','Waikiki Beach','Hanauma Bay'],
  Mexico:      ['Chichen Itza','Teotihuacan','cenote'],
  'Mexico City':['Frida Kahlo Museum','Teotihuacan','Zocalo','Xochimilco'],
  Cancun:      ['Tulum ruins','Chichen Itza day trip','Xcaret','cenote tour'],
  Peru:        ['Machu Picchu','Inca Trail','Rainbow Mountain','Lake Titicaca'],
  Cusco:       ['Machu Picchu','Sacred Valley','Rainbow Mountain','Saksaywaman'],
  Brazil:      ['Christ the Redeemer','Iguazu Falls','Copacabana','Amazon'],
  'Rio de Janeiro':['Christ the Redeemer','Sugarloaf Mountain','Copacabana','Ipanema','Tijuca rainforest'],
  Argentina:   ['Iguazu Falls','Perito Moreno glacier','tango show'],
  'Buenos Aires':['La Boca','Recoleta cemetery','tango show','San Telmo market'],
  Chile:       ['Atacama desert','Easter Island','Patagonia'],
  Cuba:        ['Old Havana','classic car tour','Vinales tobacco farm'],
  Havana:      ['Old Havana','Malecon','classic car tour','Capitolio'],
  // ── Oceania ──
  Australia:   ['Great Barrier Reef','Uluru','Sydney Opera House','Great Ocean Road'],
  Sydney:      ['Sydney Opera House','Sydney Harbour Bridge','Bondi Beach','Taronga Zoo','Manly Beach'],
  Melbourne:   ['Federation Square','Great Ocean Road','Queen Victoria Market','MCG','Royal Botanic Gardens'],
  'New Zealand':['Hobbiton','Milford Sound','glacier hike','Tongariro crossing'],
  Auckland:    ['Sky Tower','Waiheke Island','Auckland Zoo'],
  Queenstown:  ['Bungy jumping','Milford Sound','Lord of the Rings tour','Skyline gondola'],
  Fiji:        ['island hopping','snorkeling','Sigatoka river safari'],
  // ── Eastern Europe & Russia ──
  Russia:      ['Red Square','Hermitage Museum','Trans-Siberian','Lake Baikal'],
  Moscow:      ['Red Square','Saint Basil Cathedral','Kremlin','Bolshoi Theatre','Gorky Park'],
  'Saint Petersburg':['Hermitage Museum','Peterhof Palace','Church of the Savior on Spilled Blood'],
  Poland:      ['Wawel Castle','Auschwitz Birkenau','Wieliczka salt mine'],
  Warsaw:      ['Warsaw Old Town','Royal Castle','Wilanow Palace','Lazienki Park'],
  Krakow:      ['Wawel Castle','Auschwitz Birkenau','Wieliczka salt mine','Main Market Square'],
  'Czech Republic':['Prague Castle','Charles Bridge','Cesky Krumlov'],
  Prague:      ['Prague Castle','Charles Bridge','Old Town Square','Astronomical Clock','Petrin Tower'],
  Hungary:     ['Buda Castle','Hungarian Parliament','thermal baths'],
  Budapest:    ['Buda Castle','Hungarian Parliament','Szechenyi thermal bath','Fishermans Bastion','Chain Bridge'],
  Croatia:     ['Plitvice Lakes','Dubrovnik Old Town','Diocletian Palace'],
  Dubrovnik:   ['Dubrovnik Old Town','City Walls','Lokrum island','Game of Thrones tour'],
  Romania:     ['Bran Castle','Peles Castle','Transfagarasan'],
  Bucharest:   ['Palace of the Parliament','Old Town','Romanian Athenaeum'],
  Ukraine:     ['Kyiv Pechersk Lavra','Saint Sophia Cathedral','Lviv Old Town'],
  // ── Scandinavia & Northern Europe ──
  Sweden:      ['Vasa Museum','ABBA Museum','Gamla Stan','Northern Lights'],
  Stockholm:   ['Vasa Museum','Gamla Stan','Skansen','ABBA Museum','Drottningholm Palace'],
  Denmark:     ['Tivoli Gardens','Nyhavn','Christiansborg Palace'],
  Copenhagen:  ['Tivoli Gardens','Nyhavn','Little Mermaid statue','Christiania','Rosenborg Castle'],
  Finland:     ['Suomenlinna','Northern Lights','Santa Claus Village','Helsinki Cathedral'],
  Helsinki:    ['Suomenlinna','Helsinki Cathedral','Temppeliaukio Church','Market Square'],
  Oslo:        ['Vigeland Park','Viking Ship Museum','Akershus Fortress','Opera House'],
  Bergen:      ['Bryggen wharf','Floyen funicular','fjord cruise','Mount Ulriken'],
  Belgium:     ['Grand Place','Atomium','Bruges canals'],
  Brussels:    ['Grand Place','Atomium','Manneken Pis','Royal Palace'],
  Bruges:      ['Bruges canals','Markt square','Belfry of Bruges','Basilica of the Holy Blood'],
  Ireland:     ['Cliffs of Moher','Ring of Kerry','Guinness Storehouse','Blarney Castle'],
  Dublin:      ['Guinness Storehouse','Trinity College','Temple Bar','Dublin Castle'],
  Switzerland: ['Matterhorn','Jungfraujoch','Lake Geneva','Glacier Express'],
  Zurich:      ['Lake Zurich','Bahnhofstrasse','Old Town','Lindt Home of Chocolate'],
  Austria:     ['Schonbrunn Palace','Hallstatt','Salzburg Old Town'],
  Vienna:      ['Schonbrunn Palace','St Stephens Cathedral','Belvedere Palace','Hofburg','Prater'],
  // ── Central America & Caribbean ──
  'Costa Rica':['Arenal volcano','Manuel Antonio','Monteverde cloud forest','sloth sanctuary','zip line canopy'],
  Panama:      ['Panama Canal','Casco Viejo','San Blas islands'],
  Guatemala:   ['Tikal','Lake Atitlan','Antigua Guatemala'],
  Belize:      ['Great Blue Hole','barrier reef','Mayan ruins'],
  Nicaragua:   ['Granada','Ometepe island','Mombacho Volcano'],
  Jamaica:     ['Dunns River Falls','Blue Mountains','Bob Marley Museum','Negril beach'],
  'Dominican Republic':['Punta Cana','Saona Island','27 waterfalls','Zona Colonial'],
  Bahamas:     ['Atlantis Paradise Island','swimming pigs','Blue Lagoon','Pink Sand Beach'],
  Barbados:    ['Crane Beach','Harrisons Cave','rum distillery tour'],
  'Puerto Rico':['Old San Juan','El Yunque rainforest','bioluminescent bay'],
  // ── More US & Canada cities ──
  Chicago:     ['Millennium Park','Navy Pier','Art Institute of Chicago','Willis Tower','architecture river cruise'],
  Boston:      ['Freedom Trail','Fenway Park','Boston Common','Harvard tour','New England Aquarium'],
  Miami:       ['South Beach','Art Deco district','Wynwood Walls','Everglades airboat','Vizcaya'],
  Seattle:     ['Space Needle','Pike Place Market','Chihuly Garden','Boeing tour'],
  Washington:  ['National Mall','Smithsonian museums','Lincoln Memorial','White House','Capitol'],
  'New Orleans':['French Quarter','Bourbon Street','Garden District','swamp tour','Mardi Gras World'],
  Nashville:   ['Grand Ole Opry','Country Music Hall of Fame','Broadway honky tonks','Parthenon'],
  Orlando:     ['Walt Disney World','Universal Orlando','SeaWorld','Kennedy Space Center'],
  'Grand Canyon':['Grand Canyon South Rim','Skywalk','helicopter tour'],
  Canada:      ['Niagara Falls','CN Tower','Banff','Whistler'],
  Toronto:     ['CN Tower','Niagara Falls day trip','Royal Ontario Museum','Distillery District','Casa Loma'],
  Vancouver:   ['Stanley Park','Capilano Suspension Bridge','Grouse Mountain','Granville Island'],
  Montreal:    ['Old Montreal','Notre-Dame Basilica','Mount Royal','Jean-Talon Market'],
  // ── More European cities ──
  Edinburgh:   ['Edinburgh Castle','Royal Mile','Arthurs Seat','Holyrood Palace','Old Town'],
  Naples:      ['Pompeii','Mount Vesuvius','Naples historic centre','Capri day trip'],
  Milan:       ['Duomo Milano','Last Supper','Galleria Vittorio Emanuele','La Scala','Sforza Castle'],
  Seville:     ['Royal Alcazar','Plaza de Espana','Cathedral of Seville','flamenco show'],
  Munich:      ['Marienplatz','Neuschwanstein day trip','Oktoberfest','BMW Museum','Englischer Garten'],
  Hamburg:     ['Speicherstadt','Miniatur Wunderland','Elbphilharmonie','St Pauli'],
  Frankfurt:   ['Romerberg','Main Tower','Goethe House'],
  Porto:       ['Livraria Lello','Ribeira district','port wine cellar','Douro river cruise','Sao Bento station'],
  Madeira:     ['Funchal cable car','Levada walks','Pico do Areeiro'],
  Malta:       ['Valletta','Blue Lagoon Comino','Mdina','Hagar Qim temples'],
  // ── More Asian destinations ──
  Myanmar:     ['Bagan temples','Shwedagon Pagoda','Inle Lake'],
  Bhutan:      ['Tigers Nest Monastery','Punakha Dzong','Thimphu'],
  Mongolia:    ['Gobi Desert','Naadam Festival','Ulaanbaatar'],
  Maldives:    ['overwater bungalow','snorkeling','dolphin cruise','sunset cruise'],
  // ── More Middle East ──
  'Saudi Arabia':['AlUla','Diriyah','Red Sea diving'],
  Oman:        ['Wadi Shab','Nizwa Fort','Mutrah Souq'],
  Lebanon:     ['Baalbek ruins','Jeita Grotto','Byblos'],
  // ── More African destinations ──
  Ethiopia:    ['Lalibela rock churches','Simien Mountains','Danakil Depression'],
  Ghana:       ['Cape Coast Castle','Mole National Park','Kakum canopy walk'],
  Namibia:     ['Sossusvlei dunes','Etosha National Park','Skeleton Coast'],
  Botswana:    ['Okavango Delta safari','Chobe National Park'],
  Madagascar:  ['Avenue of the Baobabs','Tsingy de Bemaraha','lemur watching'],
  Rwanda:      ['gorilla trekking','Volcanoes National Park','Kigali Genocide Memorial'],
  // ── Antarctica / extreme ──
  Antarctica:  ['penguin colonies','iceberg cruise','Antarctic Peninsula'],
};

// Walk city → region → country and gather staple landmarks (deduped, capped 8).
function gaStaplesForLocation(city, region, country) {
  const out = [];
  if (city    && GA_STAPLE_LANDMARKS[city])    out.push(...GA_STAPLE_LANDMARKS[city]);
  if (region  && GA_STAPLE_LANDMARKS[region])  out.push(...GA_STAPLE_LANDMARKS[region]);
  if (country && GA_STAPLE_LANDMARKS[country]) out.push(...GA_STAPLE_LANDMARKS[country]);
  return [...new Set(out)].slice(0, 8);
}

const GA_NEARBY_TYPES = [
  'tourist_attraction','museum','park','amusement_park','zoo','aquarium',
  'art_gallery','bowling_alley','casino','night_club','spa','stadium',
  'movie_theater','campground',
];

const GA_CATEGORY_NEARBY = {
  culture:       ['museum','art_gallery','historical_landmark','performing_arts_theater'],
  outdoor:       ['park','national_park','hiking_area','marina','campground'],
  entertainment: ['amusement_center','bowling_alley','movie_theater','casino'],
  nightlife:     ['night_club','bar'],
  family:        ['amusement_park','aquarium','zoo','park'],
  wellness:      ['spa','beauty_salon'],
  adventure:     ['campground','ski_resort','marina','national_park'],
  tours:         ['tourist_attraction','museum'],
};

const GA_SIG = {
  free:        ['free admission','free entry','no charge','no fee','free access','complimentary'],
  family:      ['family','kids','children','all ages','child-friendly','stroller'],
  outdoor:     ['outdoor','outside','open air','nature','trail',
               'hiking','forest','mountain','lake','river','waterfall','canyon','cave',
               'cliff','scenic','campground','wilderness','reef','snorkel','dive',
               'lighthouse','bird watching','wildlife','fishing','volcano'],
  indoor:      ['indoor','inside','air conditioned','museum','gallery','theater'],
  guided:      ['guided','tour guide','expert','led tour','docent','commentary'],
  bucket:      ['bucket list','must see','once in lifetime','world famous','iconic','legendary'],
  hidden:      ['hidden gem','off the beaten','secret','local secret','underrated','undiscovered'],
  photo:       ['photo','instagram','photogenic','beautiful','stunning views','scenic','panoramic'],
  adventure:   ['adventure','thrill','extreme','adrenaline','exciting','challenging'],
  cultural:    ['cultural','traditional','authentic','local','historic','heritage'],
  budget:      ['free','cheap','affordable','budget','inexpensive','worth every penny'],
  accessibility:['wheelchair','accessible','disabled','ada','mobility'],
  couples:     ['romantic','date','couples','honeymoon','anniversary','intimate','perfect for couples'],
  seniors:     ['senior','elderly','easy walk','gentle','leisurely','no stairs','slow pace'],
  petFriendly: ['dog friendly','pet friendly','dogs allowed','pets welcome','bring your dog'],
  groups:      ['group friendly','perfect for groups','large groups','group activity','team building','party','bachelorette','bachelor party','group rate','group discount'],
  singles:     ['solo traveler','solo travelers','solo friendly','meet people','meet new people','hostel','social hostel','make friends','singles welcome'],
  teens:       ['teen','teenager','teenagers','high school','great for teens','escape room','arcade','theme park','water park','zip line','zipline','trampoline park','go kart','laser tag','mini golf','virtual reality','vr arcade','rope course','ropes course','flow rider','indoor skydiving','bowling','axe throwing','rage room','rock climbing'],
  highlights:  ['amazing','spectacular','breathtaking','incredible','beautiful','must visit','loved it','fantastic','perfect','outstanding','stunning','highly recommend','worth it'],
  warnings:    ['long line','wait time','crowded','expensive','overpriced','disappointing','avoid','rude','dirty','loud','overcrowded','parking issue','too hot','too cold'],
  adultsOnly:  ['shooting range','gun range','clay shooting','skeet shooting','shooting club','axe throwing','rage room','smash room'],
};

const GA_NON_NATURE_TYPES = new Set([
  'museum','art_gallery','historical_landmark','monument','cemetery',
  'church','place_of_worship','city_hall','library','school','university',
  'shopping_mall','store','restaurant','cafe','lodging','hospital',
]);

const GA_NATURE_TYPES = ['park','national_park','campground','natural_feature',
  'hiking_area','state_park','beach','ski_resort','marina'];

function gaSafeLower(v) {
  if (typeof v === 'string') return v.toLowerCase();
  if (v == null) return '';
  if (typeof v === 'object') return (v.text || '').toLowerCase();
  return String(v).toLowerCase();
}

function gaSc(t, k) { return k.filter(w => t.includes(w)).length; }
function gaKm(la1, lo1, la2, lo2) {
  const R = 6371, dL = (la2 - la1) * Math.PI / 180, dN = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function gaActivityType(name, types) {
  const n = name.toLowerCase(); const t = types.join(' ');
  if (/museum|gallery|exhibit/.test(n) || /museum/.test(t))             return { icon:'🏛️', label:'Museum / Gallery', color:'#7C3AED', category:'culture' };
  if (/park|garden|nature|reserve|trail|forest|canyon|cave|waterfall|lake|river|volcano|lighthouse|campground|ruins/.test(n) || /park|natural_feature/.test(t)) return { icon:'🌳', label:'Nature & Outdoors', color:'#059669', category:'outdoor' };
  if (/beach|surf|reef|snorkel|dive|coast/.test(n) || /beach/.test(t))  return { icon:'🏖️', label:'Beach & Water', color:'#0891B2', category:'outdoor' };
  if (/theme park|amusement|water park/.test(n))                        return { icon:'🎢', label:'Theme Park', color:'#DC2626', category:'entertainment' };
  if (/zoo|aquarium|wildlife/.test(n) || /zoo/.test(t))                 return { icon:'🦁', label:'Zoo / Aquarium', color:'#D97706', category:'family' };
  if (/spa|hot spring|onsen|hammam|bath/.test(n))                       return { icon:'♨️', label:'Spa & Wellness', color:'#DB2777', category:'wellness' };
  if (/bar|club|nightlife|brewery|winery|distillery/.test(n))           return { icon:'🍻', label:'Nightlife', color:'#1D4ED8', category:'nightlife' };
  if (/tour|walking|food tour|experience/.test(n))                      return { icon:'🗺️', label:'Tours & Experiences', color:'#F59E0B', category:'tour' };
  if (/historic|heritage|monument|castle|temple|church|cathedral|mosque|shrine/.test(n) || /historical_landmark|place_of_worship/.test(t)) return { icon:'🏰', label:'Historic Site', color:'#92400E', category:'culture' };
  if (/sport|stadium|arena|gym|fitness/.test(n))                        return { icon:'🏟️', label:'Sports & Fitness', color:'#1D4ED8', category:'sport' };
  if (/adventure|climb|zip|surf|dive|skydive/.test(n))                  return { icon:'🧗', label:'Adventure', color:'#DC2626', category:'adventure' };
  if (/cooking|class|workshop|lesson/.test(n))                          return { icon:'👨‍🍳', label:'Classes & Workshops', color:'#059669', category:'experience' };
  return { icon:'⭐', label:'Attraction', color:'#F59E0B', category:'attraction' };
}

// D1 category → icon/label/color/parent-category lookup.
const GA_D1_CAT_TABLE = {
  museum:        { icon:'🏛️', label:'Museum',          color:'#7C3AED', cat:'culture' },
  landmark:      { icon:'🏛️', label:'Landmark',        color:'#92400E', cat:'culture' },
  viewpoint:     { icon:'📷', label:'Viewpoint',       color:'#059669', cat:'outdoor' },
  beach:         { icon:'🏖️', label:'Beach',           color:'#0891B2', cat:'outdoor' },
  park:          { icon:'🌳', label:'Park',            color:'#059669', cat:'outdoor' },
  national_park: { icon:'🌲', label:'National Park',   color:'#059669', cat:'outdoor' },
  theme_park:    { icon:'🎢', label:'Theme Park',      color:'#DC2626', cat:'entertainment' },
  zoo:           { icon:'🦁', label:'Zoo',             color:'#D97706', cat:'family' },
  aquarium:      { icon:'🐠', label:'Aquarium',        color:'#0891B2', cat:'family' },
  art_gallery:   { icon:'🎨', label:'Art Gallery',     color:'#7C3AED', cat:'culture' },
  historic:      { icon:'🏰', label:'Historic Site',   color:'#92400E', cat:'culture' },
  religious:     { icon:'⛪', label:'Religious Site',  color:'#92400E', cat:'culture' },
  market:        { icon:'🛍️', label:'Market',          color:'#D97706', cat:'culture' },
  monument:      { icon:'🗿', label:'Monument',        color:'#92400E', cat:'culture' },
  nature_reserve:{ icon:'🌿', label:'Nature Reserve',  color:'#059669', cat:'outdoor' },
  waterfall:     { icon:'💧', label:'Waterfall',       color:'#0891B2', cat:'outdoor' },
  garden:        { icon:'🌷', label:'Garden',          color:'#059669', cat:'outdoor' },
  observation_deck:{icon:'🌆',label:'Observation Deck',color:'#7C3AED', cat:'culture' },
  district:      { icon:'🏙️', label:'District',        color:'#1D4ED8', cat:'culture' },
  square:        { icon:'🏛️', label:'Square',          color:'#92400E', cat:'culture' },
  palace:        { icon:'🏰', label:'Palace',          color:'#92400E', cat:'culture' },
  tower:         { icon:'🗼', label:'Tower',           color:'#7C3AED', cat:'culture' },
  cathedral:     { icon:'⛪', label:'Cathedral',       color:'#92400E', cat:'culture' },
  temple:        { icon:'⛩️', label:'Temple',          color:'#92400E', cat:'culture' },
  shrine:        { icon:'⛩️', label:'Shrine',          color:'#92400E', cat:'culture' },
  mosque:        { icon:'🕌', label:'Mosque',          color:'#92400E', cat:'culture' },
  fortress:      { icon:'🏰', label:'Fortress',        color:'#92400E', cat:'culture' },
  wildlife:      { icon:'🦁', label:'Wildlife',        color:'#D97706', cat:'family' },
  experience:    { icon:'🎭', label:'Experience',      color:'#F59E0B', cat:'tour' },
  river:         { icon:'🌊', label:'River',           color:'#0891B2', cat:'outdoor' },
  lake:          { icon:'🏞️', label:'Lake',           color:'#0891B2', cat:'outdoor' },
};

// Map ONE D1 record into the shape the ActivityCard renders.
function gaMapD1ToActivity(d) {
  const distMi = d.distanceMiles ?? 0;
  const ct = GA_D1_CAT_TABLE[d.category] || { icon:'⭐', label:'Attraction', color:'#F59E0B', cat:'attraction' };
  const isOutdoorCat = ['park','national_park','beach','viewpoint','waterfall','nature_reserve','garden','river','lake'].includes(d.category);
  const isIndoorCat = ['museum','art_gallery','observation_deck','cathedral','temple','mosque','shrine','palace','tower','fortress'].includes(d.category);
  const isCulturalCat = ['museum','art_gallery','religious','historic','cathedral','temple','mosque','shrine','monument','palace','fortress'].includes(d.category);
  const isTeenCat = ['theme_park','zoo','aquarium','observation_deck'].includes(d.category);
  return {
    id: d.id, placeId: d.id, displayName: { text: d.name }, name: d.name,
    location: { latitude: d.lat, longitude: d.lng }, lat: d.lat, lng: d.lng,
    formattedAddress: [d.city, d.country].filter(Boolean).join(', '),
    shortFormattedAddress: d.city || d.country || '',
    distanceKm: d.distanceKm, distanceMiles: distMi, distance: `${distMi.toFixed(1)} mi`,
    rating: d.rating ?? null, userRatingCount: 0,
    isOpen: null, hours: [],
    currentOpeningHours: { openNow: null, weekdayDescriptions: [] },
    photos: d.photoUrl ? [d.photoUrl] : [], photoUrl: d.photoUrl || null, photoUrl2: null,
    nationalPhoneNumber: '', websiteUri: '', googleMapsUri: '',
    activityIcon: ct.icon, activityLabel: ct.label, activityColor: ct.color, activityCategory: ct.cat,
    editorialSummary: d.description || '', outdoorContext: null, types: [],
    badges: d.isMarquee ? ['🏆 Bucket List'] : [],
    qualityScore: d.isMarquee ? 95 : 80,
    highlights: [], warnings: [], bestTime: '',
    props: {
      isFree: d.freeToVisit === true,
      isFamilyFriendly: ['zoo','aquarium','theme_park','park','garden'].includes(d.category),
      isOutdoor: isOutdoorCat, isIndoor: isIndoorCat, hasGuidedTour: false,
      isBucketList: d.isMarquee === true, isHiddenGem: false, isPhotoWorthy: true,
      isAdventure: false, isCultural: isCulturalCat, isAccessible: false,
      isBudgetFriendly: d.freeToVisit === true, isGoodForCouples: false,
      isSeniorFriendly: false, isPetFriendly: false, isGoodForGroups: false,
      isGoodForSingles: false, isGoodForTeens: isTeenCat,
    },
    tourMode: undefined,
    travelType: distMi > 100 ? '✈️ Flights Required' : distMi > 50 ? '🚗 Drive' : distMi > 15 ? '🚗 Short Drive' : '📍 Nearby',
    whyVisit: d.whyVisit || '', typicalMinutes: d.typicalMinutes || null,
    _source: 'd1',
  };
}

// Internal search helpers — call the Worker's own handlers (no HTTP hop).
async function gaText(env, ctx, origin, { query, latitude, longitude, radius, maxResults, forceRefresh }) {
  const p = new URLSearchParams({
    query, latitude: String(latitude), longitude: String(longitude),
    radius: String(radius), maxResults: String(maxResults),
    ...(forceRefresh ? { forceRefresh: 'true' } : {}),
  });
  const res = await handleTextSearch(new Request(`${origin}/places/text-search?${p}`), env, ctx);
  return (await res.json()).places || [];
}
async function gaNearby(env, ctx, origin, { type, latitude, longitude, radius, maxResults, forceRefresh }) {
  const p = new URLSearchParams({
    type, latitude: String(latitude), longitude: String(longitude),
    radius: String(radius), maxResults: String(maxResults),
    ...(forceRefresh ? { forceRefresh: 'true' } : {}),
  });
  const res = await handleNearbySearch(new Request(`${origin}/places/nearby?${p}`), env, ctx);
  return (await res.json()).places || [];
}
async function gaAttractions(env, ctx, origin, { latitude, longitude, cityName, countryName }) {
  try {
    const res = await handleAttractionsNearby(new Request(`${origin}/attractions/nearby`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, radiusKm: 100, limit: 60, cityName, countryName }),
    }), env, ctx);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.attractions) ? data.attractions : null;
  } catch { return null; }
}

async function handleActivities(request, env, ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, radius = 24140, maxResults = 30, category = 'all',
            smartRadius = false, countryName = '', regionName = '', cityName = '',
            forceRefresh = false } = body;
    if (!latitude || !longitude) return jsonResponse({ error: 'Location required' }, 400);

    const origin = new URL(request.url).origin;
    const INNER_RADIUS = 40234; // 25 miles in meters
    const useSmartRadius = smartRadius && radius > INNER_RADIUS;

    // ── STAGE 0: D1 attractions seed (fast path) ──
    const d1Promise = gaAttractions(env, ctx, origin, { latitude, longitude, cityName, countryName });

    const map = {
      culture:['museum','gallery','historic','heritage','ancient ruins','cultural center','fine arts'],
      outdoor:['national park','nature','beach','hiking','waterfall','forest','canyon','cave','volcano','river','fishing','reef','lighthouse','ruins','scenic','campground','camping','bird','trail','lake','reserve','sanctuary','botanical','kayaking','canoeing','cliff jumping','swimming hole','parasailing','paragliding','bike rental','fruit picking','bonfire','rafting','white water rafting','island hopping','snowboarding','skiing'],
      entertainment:['theme park','escape room','arcade','live theater','comedy club','virtual reality','live music venue','casino','bowling','cable car','gondola ride','karaoke','batting cage','indoor baseball','go kart','kayaking','canoeing','ice skating','indoor rock climbing','water park','indoor playground','paintball','laser tag','golf range','topgolf','shooting range','clay shooting','trampoline park','beach','axe throwing','rage room','indoor skydiving','skydiving','roller skating','skate park','bumper cars','indoor miniature golf','mini golf','dave and busters','arcade bar','entertainment center','horse racing','racetrack','bullfight','parasailing','paragliding','chocolate making','chocolate factory','fruit picking','bungee jumping','horseshoe toss','billiards','pool hall','ping pong','bonfire','rafting','island hopping','snowboarding','skiing'],
      nightlife:['bar','club','music','brewery','winery','arcade bar','casino','pool hall','billiards','karaoke'],
      family:['zoo','aquarium','childrens museum','family fun center','mini golf','indoor miniature golf','kid friendly activities','interactive exhibits','theme park','cable car','indoor playground','water park','trampoline park','go kart','roller skating','skate park','dave and busters','entertainment center','camping','campground','bike rental','chocolate factory','chocolate making','fruit picking','billiards','ping pong','bonfire'],
      wellness:['spa','hot springs','massage therapy','wellness retreat','onsen','bathhouse'],
      adventure:['rock climbing','zip lining','zipline','ATV trails','atv rental','white water rafting','rafting','scuba diving','bungee jumping','extreme sports','kayaking','indoor skydiving','skydiving','parasailing','paragliding','cliff jumping','island hopping','snowboarding','skiing'],
      tours:['tour','experience','cooking class','chocolate making','island hopping','boat tour'],
    };
    const regional = GA_REGIONAL_QUERIES[countryName] || [];
    const queries = category === 'all' ? [...GA_QUERIES, ...regional] : (map[category] || []);

    const seen = new Set(); const places = [];
    const searchRadius = useSmartRadius ? INNER_RADIUS : radius;

    // ── HELPERS (hoisted) ──
    const EXCLUDE_TYPES_SET_H = new Set(['cemetery','funeral_home']);
    const EXCLUDE_NAME_RE_H = /\bshrine\b|\bmemorial wall\b|\bplaque\b/i;
    const filterJunkH = (arr) => arr.filter(p => {
      const types = p.types || [];
      if (types.some(t => EXCLUDE_TYPES_SET_H.has(t))) return false;
      if (EXCLUDE_NAME_RE_H.test(p.displayName?.text || p.name || '')) return false;
      return true;
    });
    const processPlaceH = (p) => {
      const lat = p.location?.latitude || 0, lng = p.location?.longitude || 0;
      const d = gaKm(latitude, longitude, lat, lng);
      const name = p.displayName?.text || p.name || '';
      const revArr = (p.reviews || []).map(r => gaSafeLower(r?.text?.text ?? r?.text ?? ''));
      const rev = revArr.join(' ');
      const txt = `${name.toLowerCase()} ${rev}`;
      const placeTypes = p.types || [];
      const at = gaActivityType(name, placeTypes);
      const isSmallFeature = /waterfall|fountain|pond|stream|creek/.test(name.toLowerCase());
      const isWilderness = placeTypes.some(t => ['national_park','hiking_area','state_park','natural_feature'].includes(t));
      const isInsideManagedPark = placeTypes.some(t => ['botanical_garden','amusement_park','zoo'].includes(t));
      const outdoorContext = isSmallFeature && !isWilderness ? 'Walk-through inside a park' : isSmallFeature && isInsideManagedPark ? 'Managed Park / Walk-through' : null;
      const photos = (p.photos || []).map(ph => ph.url || ph).filter(Boolean).slice(0, 3);
      const hours = p.currentOpeningHours?.weekdayDescriptions || p.regularOpeningHours?.weekdayDescriptions || p.hours || [];
      const editorialSummary = p.editorialSummary?.text || p.editorialSummary || '';
      const highlights = GA_SIG.highlights.filter(w => rev.includes(w)).slice(0, 5);
      const warnings = GA_SIG.warnings.filter(w => rev.includes(w)).slice(0, 4);
      const timeMatches = (rev.match(/\b(morning|afternoon|evening|sunrise|sunset|weekday|weekend|summer|winter|spring|fall|autumn|off.season)\b/gi) || []);
      const bestTime = timeMatches.length > 0 ? [...new Set(timeMatches.map(s => s.toLowerCase()))].slice(0, 3).join(', ') : '';
      const badges = [];
      if (gaSc(txt, GA_SIG.bucket) > 0)    badges.push('🏆 Bucket List');
      if (gaSc(txt, GA_SIG.hidden) > 0)    badges.push('💎 Hidden Gem');
      if (gaSc(txt, GA_SIG.photo) > 1)     badges.push('📸 Photo Worthy');
      if (gaSc(txt, GA_SIG.free) > 0)      badges.push('🆓 Free Entry');
      if (gaSc(txt, GA_SIG.family) > 0)    badges.push('👨‍👩‍👧 Family Friendly');
      if (gaSc(txt, GA_SIG.adventure) > 0) badges.push('⚡ Adventure');
      if (gaSc(txt, GA_SIG.cultural) > 1)  badges.push('🎭 Authentic Culture');
      if (gaSc(txt, GA_SIG.adultsOnly) > 0 || /shooting range|gun club|axe throwing|clay shooting/i.test(name)) badges.push('🔞 Adults Only');
      let qs = 50;
      if (p.rating >= 4.5) qs += 25; else if (p.rating >= 4.0) qs += 15;
      if (p.userRatingCount > 1000) qs += 10; else if (p.userRatingCount > 200) qs += 5;
      if (gaSc(txt, GA_SIG.bucket) > 0) qs += 10;
      if (gaSc(txt, GA_SIG.photo) > 0)  qs += 5;
      if (gaSc(txt, GA_SIG.hidden) > 0) qs += 5;
      return {
        id: p.id, placeId: p.id, displayName: p.displayName || { text: name },
        name, location: { latitude: lat, longitude: lng }, lat, lng,
        formattedAddress: p.formattedAddress || '', shortFormattedAddress: p.shortFormattedAddress || '',
        distanceKm: d, distanceMiles: d * 0.621371, distance: `${(d * 0.621371).toFixed(1)} mi`,
        rating: p.rating || null, userRatingCount: p.userRatingCount || 0,
        isOpen: p.isOpen ?? null, hours,
        currentOpeningHours: { openNow: p.isOpen, weekdayDescriptions: hours },
        photos, photoUrl: photos[0] || null, photoUrl2: photos[1] || null,
        nationalPhoneNumber: p.nationalPhoneNumber || '',
        websiteUri: p.websiteUri || '', googleMapsUri: p.googleMapsUri || '',
        activityIcon: at.icon, activityLabel: at.label, activityColor: at.color, activityCategory: at.category,
        editorialSummary, outdoorContext, types: placeTypes,
        badges, qualityScore: Math.min(qs, 100), highlights, warnings, bestTime,
        props: {
          isFree: gaSc(txt, GA_SIG.free) > 0, isFamilyFriendly: p.goodForChildren === true || gaSc(txt, GA_SIG.family) > 0,
          isOutdoor: (() => { if (placeTypes.some(t => GA_NON_NATURE_TYPES.has(t))) return false; return placeTypes.some(t => GA_NATURE_TYPES.includes(t)) || gaSc(txt, GA_SIG.outdoor) >= 2 || at.category === 'outdoor'; })(),
          isIndoor: gaSc(txt, GA_SIG.indoor) > 0, hasGuidedTour: gaSc(txt, GA_SIG.guided) > 0,
          isBucketList: gaSc(txt, GA_SIG.bucket) > 0, isHiddenGem: gaSc(txt, GA_SIG.hidden) > 0,
          isPhotoWorthy: gaSc(txt, GA_SIG.photo) > 1, isAdventure: gaSc(txt, GA_SIG.adventure) > 0,
          isCultural: gaSc(txt, GA_SIG.cultural) > 1, isAccessible: gaSc(txt, GA_SIG.accessibility) > 0,
          isBudgetFriendly: gaSc(txt, GA_SIG.budget) > 0, isGoodForCouples: gaSc(txt, GA_SIG.couples) > 0,
          isSeniorFriendly: gaSc(txt, GA_SIG.seniors) > 0, isPetFriendly: gaSc(txt, GA_SIG.petFriendly) > 0,
          isGoodForGroups: gaSc(txt, GA_SIG.groups) > 0,
          isGoodForSingles: gaSc(txt, GA_SIG.singles) > 0,
          isGoodForTeens: gaSc(txt, GA_SIG.teens) > 0,
        },
        tourMode: GA_TOUR_MODE_BY_QUERY[p._foundByQuery] || undefined,
      };
    };
    const popScoreH = (a) => (a.rating || 0) * Math.log10((a.userRatingCount || 0) + 1);

    // ── STAGE B (concurrent): National Icons → Regional Gems ──
    const iconsAndRegionalPromise = (async () => {
      const t1Seen = new Set();
      const t1Places = [];
      const cn = countryName || 'nearby';
      const t1Queries = [`top tourist attractions in ${cn}`, `bucket list landmarks ${cn}`, `famous must see ${cn}`];
      await Promise.all(t1Queries.map(async q => {
        try {
          const pls = await gaText(env, ctx, origin, { query: q, latitude, longitude, radius: 500000, maxResults: 20, forceRefresh });
          for (const pl of pls) { const id = pl.id; if (id && !t1Seen.has(id)) { t1Seen.add(id); t1Places.push(pl); } }
        } catch {}
      }));
      const t1Processed = filterJunkH(t1Places).map(processPlaceH)
        .filter(a => (a.rating || 0) >= 4.0 && (a.userRatingCount || 0) >= 100)
        .sort((a, b) => popScoreH(b) - popScoreH(a))
        .slice(0, 40);
      t1Processed.forEach(a => {
        const mi = a.distanceMiles;
        a.travelType = mi > 100 ? '✈️ Flights Required' : mi > 50 ? '🚗 Drive' : '🚗 Short Drive';
      });
      const nationalIcons = t1Processed;

      const t2Seen = new Set(nationalIcons.map(a => a.id));
      const t2Places = [];
      const rn = regionName || cityName || 'nearby';
      const stapleQueries = gaStaplesForLocation(cityName, regionName, countryName);
      const t2Queries = [
        `top attractions in ${rn}`,
        `things to do in ${rn}`,
        `best places to visit ${rn}`,
        ...stapleQueries,
      ];
      await Promise.all(t2Queries.map(async q => {
        try {
          const pls = await gaText(env, ctx, origin, { query: q, latitude, longitude, radius: 160934, maxResults: 20, forceRefresh });
          for (const pl of pls) { const id = pl.id; if (id && !t2Seen.has(id)) { t2Seen.add(id); t2Places.push(pl); } }
        } catch {}
      }));
      const t2Processed = filterJunkH(t2Places).map(processPlaceH)
        .filter(a => (a.rating || 0) >= 3.5)
        .sort((a, b) => popScoreH(b) - popScoreH(a))
        .slice(0, 20)
        .sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));
      t2Processed.forEach(a => {
        const mi = a.distanceMiles;
        a.travelType = mi > 100 ? '✈️ Flights Required' : mi > 50 ? '🚗 Drive' : mi > 15 ? '🚗 Short Drive' : '📍 Nearby';
      });
      return { nationalIcons, regionalGems: t2Processed };
    })();

    // Primary: text search (uses inner radius when smartRadius active).
    const BATCH = 10;
    for (let i = 0; i < queries.length; i += BATCH) {
      await Promise.all(queries.slice(i, i + BATCH).map(async q => {
        try {
          const pls = await gaText(env, ctx, origin, { query: q, latitude, longitude, radius: searchRadius, maxResults: 20, forceRefresh });
          for (const pl of pls) {
            const id = pl.id;
            if (id && !seen.has(id)) { seen.add(id); pl._foundByQuery = q; places.push(pl); }
          }
        } catch {}
      }));
    }

    // Fallback: nearby search when text search yielded < 5 results
    if (places.length < 5) {
      const nearbyTypes = (GA_CATEGORY_NEARBY[category] || GA_NEARBY_TYPES).slice(0, 8);
      await Promise.all(nearbyTypes.map(async t => {
        try {
          const pls = await gaNearby(env, ctx, origin, { type: t, latitude, longitude, radius: searchRadius, maxResults: 10, forceRefresh });
          for (const pl of pls) { const id = pl.id; if (id && !seen.has(id)) { seen.add(id); places.push(pl); } }
        } catch {}
      }));
    }

    // Smart Radius Pass 2: iconic spots at full radius (25-50mi zone).
    if (useSmartRadius) {
      const iconicQueries = ['tourist attraction','historic landmark','national park','theme park','amusement park','world heritage site','famous museum','iconic landmark'];
      for (let i = 0; i < iconicQueries.length; i += BATCH) {
        await Promise.all(iconicQueries.slice(i, i + BATCH).map(async q => {
          try {
            const pls = await gaText(env, ctx, origin, { query: q, latitude, longitude, radius, maxResults: 10, forceRefresh });
            for (const pl of pls) {
              const id = pl.id; if (!id || seen.has(id)) continue;
              const plLat = pl.location?.latitude || 0, plLng = pl.location?.longitude || 0;
              const dist = gaKm(latitude, longitude, plLat, plLng);
              const distMi = dist * 0.621371;
              if (distMi > 25 && (pl.rating >= 4.5 || (pl.rating >= 4.0 && (pl.userRatingCount || 0) >= 500))) {
                seen.add(id); places.push(pl);
              }
            }
          } catch {}
        }));
      }
      const iconicNearby = ['tourist_attraction','amusement_park','museum'];
      await Promise.all(iconicNearby.map(async t => {
        try {
          const pls = await gaNearby(env, ctx, origin, { type: t, latitude, longitude, radius, maxResults: 10, forceRefresh });
          for (const pl of pls) {
            const id = pl.id; if (!id || seen.has(id)) continue;
            const plLat = pl.location?.latitude || 0, plLng = pl.location?.longitude || 0;
            const dist = gaKm(latitude, longitude, plLat, plLng);
            const distMi = dist * 0.621371;
            if (distMi > 25 && (pl.rating >= 4.5 || (pl.rating >= 4.0 && (pl.userRatingCount || 0) >= 500))) {
              seen.add(id); places.push(pl);
            }
          }
        } catch {}
      }));
    }

    // ── TIER 3: Nearby (uses hoisted helpers) ──
    const nearbyFiltered = filterJunkH(places);
    const nearby = nearbyFiltered.slice(0, 60).map(processPlaceH);
    nearby.sort((a, b) => b.qualityScore - a.qualityScore || (b.rating || 0) - (a.rating || 0));

    // ── Merge D1 layer with the existing icons/regional stage ──
    const [d1Raw, stageB] = await Promise.all([d1Promise, iconsAndRegionalPromise]);
    const d1Mapped = (d1Raw || []).map(gaMapD1ToActivity);
    const d1Marquees = d1Mapped.filter(a => a.props?.isBucketList);
    const d1Regulars = d1Mapped.filter(a => !a.props?.isBucketList);

    // Prefer the LIVE Google-Places stage for the marquee tiers. It carries real
    // photos, street address, phone, hours and website (built by processPlaceH);
    // the D1 seed rows carry none of those, so a D1-only tier renders as emoji
    // placeholders with "Phone not available". stageB is already fetched on every
    // call (no extra Google cost), so we use it and fall back to the D1 cache
    // ONLY when the live stage returned nothing for the tiers.
    const stageBNat = stageB.nationalIcons || [];
    const stageBReg = stageB.regionalGems || [];
    let nationalIcons;
    let regionalGems;
    if (stageBNat.length > 0 || stageBReg.length > 0) {
      nationalIcons = stageBNat.slice(0, 40);
      regionalGems = stageBReg.slice(0, 30);
    } else if (d1Mapped.length > 0) {
      nationalIcons = d1Marquees.slice(0, 40);
      regionalGems = d1Regulars.slice(0, 30);
    } else {
      nationalIcons = stageBNat;
      regionalGems = stageBReg;
    }

    // Deduplicate nearby against Tier 1 & 2 (icons get priority)
    const iconIds = new Set([...nationalIcons.map(a => a.id), ...regionalGems.map(a => a.id)]);
    const dedupedNearby = nearby.filter(a => !iconIds.has(a.id));

    // ── "About this place" synthesis ──
    const allForAbout = [...dedupedNearby, ...nationalIcons, ...regionalGems];
    for (const a of allForAbout) {
      const city = (a.formattedAddress || '').split(',').slice(-3, -1).join(',').trim();
      const cat = a.activityLabel || 'attraction';
      const parts = [`A popular ${cat.toLowerCase()}${city ? ` in ${city}` : ''}.`];
      const tags = [];
      if (a.props?.isFamilyFriendly) tags.push('Family friendly');
      if (a.props?.isOutdoor) tags.push('Outdoor');
      if (a.props?.isFree) tags.push('Free entry');
      if (a.props?.isAdventure) tags.push('Adventure');
      if (a.props?.isGoodForCouples) tags.push('Great for couples');
      if (tags.length) parts.push(tags.join(' · ') + '.');
      if (a.highlights?.length > 0) parts.push(`Visitors love: ${a.highlights.slice(0, 3).join(', ')}.`);
      if (a.rating && a.userRatingCount > 0) parts.push(`Rated ${a.rating} by ${a.userRatingCount.toLocaleString()} reviewers.`);
      a.aboutText = parts.join(' ');
    }

    const total = dedupedNearby.length + nationalIcons.length + regionalGems.length;
    return jsonResponse({ activities: dedupedNearby, nationalIcons, regionalGems, count: total, version: 'v6.1-d1-worker' });
  } catch (e) {
    return jsonResponse({ error: e.message, activities: [] }, 200);
  }
}

// ════════════════════════════════════════════════════════════════════════
// Places to Eat (ported from Base44 getRestaurants v5.1)
// The full intent/tier/cuisine/dish orchestrator, moved onto the Worker so it
// works on native (no Base44 auth_required 403). Types stripped via esbuild;
// self-HTTP calls (POST /, /places/nearby, /places/dietary, /places/text-search,
// /parse-intent, /label-photos) rewritten to internal handler calls (rxDispatch)
// — no HTTP round-trip. Same {places, count, fallbackInfo, fallbackPlaces, ...}
// output shape so PlacesToEat.jsx is a 1-line repoint.
// ════════════════════════════════════════════════════════════════════════
const grResp = (obj, init) => jsonResponse(obj, init?.status || 200);
async function rxDispatch(env, ctx, origin, pathAndQuery, opts = {}) {
  const req = new Request(`${origin}${pathAndQuery}`, {
    method: opts.method || 'GET',
    headers: opts.headers || {},
    body: opts.body,
  });
  const p = new URL(req.url).pathname;
  if (p === '/' && req.method === 'POST') return await handleRestaurantSearch(req, env, ctx);
  if (p === '/places/nearby') return await handleNearbySearch(req, env, ctx);
  if (p === '/places/dietary') return await handleDietarySearch(req, env);
  if (p === '/places/text-search') return await handleTextSearch(req, env, ctx);
  if (p === '/parse-intent' && req.method === 'POST') return await handleParseIntent(req, env);
  if (p === '/label-photos' && req.method === 'POST') return await handleLabelPhotos(req, env);
  return jsonResponse({ error: 'unknown internal route: ' + p }, 404);
}

// API_BASE_URL removed — self-calls now route through rxDispatch (internal).
const NON_FOOD_TYPES = /* @__PURE__ */ new Set([
  "grocery_or_supermarket",
  "supermarket",
  "grocery_store",
  "food_store",
  "convenience_store",
  "department_store",
  "clothing_store",
  "hardware_store",
  "pharmacy",
  "drug_store",
  "gas_station",
  "car_wash",
  "laundry",
  "health",
  "beauty_salon",
  "hair_care",
  "bank",
  "atm",
  "school",
  "church",
  "hospital",
  "doctor",
  "book_store",
  "library",
  "shopping_mall",
  "furniture_store",
  "home_goods_store",
  "electronics_store",
  "pet_store",
  "shoe_store",
  "jewelry_store"
]);
const STRICT_NON_FOOD_PRIMARY = /* @__PURE__ */ new Set([
  "convenience_store",
  "gas_station",
  "pharmacy",
  "drug_store",
  "car_wash",
  "laundry",
  "beauty_salon",
  "hair_care",
  "bank",
  "atm",
  "school",
  "church",
  "hospital",
  "doctor",
  "book_store",
  "library",
  "shopping_mall",
  "furniture_store",
  "home_goods_store",
  "electronics_store",
  "pet_store",
  "shoe_store",
  "jewelry_store",
  "clothing_store",
  "hardware_store",
  "department_store"
]);
const FOOD_TYPES = /* @__PURE__ */ new Set([
  "restaurant",
  "meal_delivery",
  "meal_takeaway",
  "cafe",
  "bakery",
  "bar",
  "night_club",
  "fast_food_restaurant",
  "american_restaurant",
  "chinese_restaurant",
  "japanese_restaurant",
  "mexican_restaurant",
  "italian_restaurant",
  "thai_restaurant",
  "korean_restaurant",
  "vietnamese_restaurant",
  "indian_restaurant",
  "mediterranean_restaurant",
  "seafood_restaurant",
  "steak_house",
  "pizza_restaurant",
  "ramen_restaurant",
  "sushi_restaurant",
  "breakfast_restaurant",
  "brunch_restaurant",
  "sandwich_shop",
  "hamburger_restaurant",
  "ice_cream_shop",
  "dessert_shop",
  "coffee_shop",
  "donut_shop",
  "bagel_shop",
  "pastry_shop",
  "diner",
  "buffet_restaurant",
  "tapas_bar",
  "wine_bar",
  "juice_bar",
  "boba_tea_shop",
  "food_court",
  "halal_restaurant",
  "kosher_restaurant",
  "vegan_restaurant",
  "vegetarian_restaurant",
  "middle_eastern_restaurant",
  "greek_restaurant",
  "spanish_restaurant",
  "french_restaurant",
  "german_restaurant",
  "filipino_restaurant",
  "indonesian_restaurant",
  "latin_american_restaurant",
  "pub",
  "sports_bar",
  "lounge",
  "brewery",
  "winery"
]);
function isActuallyARestaurant(place) {
  const types = place.types || [];
  const primaryType = place.primaryType || "";
  const status = (place.businessStatus || "").toUpperCase();
  if (status === "CLOSED_PERMANENTLY" || status === "CLOSED_TEMPORARILY") return false;
  if (STRICT_NON_FOOD_PRIMARY.has(primaryType)) return false;
  const hasFoodSignal = FOOD_TYPES.has(primaryType) || primaryType.includes("restaurant") || primaryType.includes("cafe") || primaryType.includes("bar") || types.some(
    (t) => FOOD_TYPES.has(t) || t.includes("restaurant") || t.includes("cafe") || t.includes("bar") || t.includes("bakery")
  );
  if (hasFoodSignal) return true;
  if (NON_FOOD_TYPES.has(primaryType)) return false;
  if (types.some((t) => NON_FOOD_TYPES.has(t))) return false;
  return false;
}
const SPORTS_REVIEW_KEYWORDS = [
  // Infrastructure signals
  "tv",
  "tvs",
  "screen",
  "screens",
  "big screen",
  "flat screen",
  "flatscreen",
  "multiple tvs",
  "big tv",
  "projector",
  "hd screen",
  // Social viewing behavior
  "watch the game",
  "watch the match",
  "watch sports",
  "watch party",
  "game night",
  "watching",
  "game day",
  "gameday",
  "came to watch",
  "showing sports",
  "showing the game",
  "live sports",
  "showing live",
  // Atmosphere
  "cheer",
  "cheering",
  "loud",
  "crowd",
  "lively",
  "energetic",
  "rowdy",
  "packed",
  "buzzing",
  "electric",
  "full house",
  "chanting",
  // US leagues
  "nfl",
  "nba",
  "mlb",
  "nhl",
  "ufc",
  "playoff",
  "playoffs",
  "touchdown",
  "overtime",
  // Global leagues / sports
  "soccer",
  "football",
  "rugby",
  "cricket",
  "boxing",
  "mma",
  "wrestling",
  "premier league",
  "champions league",
  "world cup",
  "copa america",
  "nrl",
  "afl",
  "super rugby",
  "six nations",
  // Event words
  "match",
  "game",
  "jersey",
  "halftime",
  "penalty",
  // Sports identity
  "sports",
  "sports bar",
  // Food & drink (social sports bar staples)
  "wing",
  "wings",
  "nachos",
  "beer",
  "draft",
  "pitchers",
  "pints",
  "happy hour",
  "pub food",
  "bar food",
  "finger food"
];
const SPORTS_BAR_TYPES = /* @__PURE__ */ new Set([
  "bar",
  "pub",
  "tapas_bar",
  "wine_bar",
  "lounge",
  "brewery",
  "night_club"
]);
function calcSportsScore(place) {
  const types = [...place.types || [], place.primaryType || ""].map((t) => t.toLowerCase());
  const name = (place.displayName?.text || place.name || "").toLowerCase();
  const reviews = place.reviews || [];
  const allReviewText = reviews.map((r) => r.text?.text || r.text || "").join(" ").toLowerCase();
  let score = 0;
  if (types.includes("sports_bar")) {
    score += 20 + 15;
  } else if (types.some((t) => SPORTS_BAR_TYPES.has(t))) {
    score += 12;
  } else if (types.some((t) => t.includes("restaurant"))) {
    score += 5;
  }
  if (/sports?\s*(bar|grill|pub|lounge|tavern)/i.test(name)) {
    score += 15;
  } else if (/(football|soccer|match|game)\s*(pub|bar|lounge|café|cafe)/i.test(name)) {
    score += 12;
  } else if (["tavern", "pub", "alehouse", "taproom", "roadhouse", "grille", "clubhouse", "stadium"].some((k) => name.includes(k))) {
    score += 8;
  } else if (["biergarten", "bier garten", "beer hall", "taphouse", "tap house", " taps ", "brewhouse", "beerhouse"].some((k) => name.includes(k)) || /\btaps\b/.test(name)) {
    score += 7;
  } else if (["brewery", "brewpub", "brew pub", "sports lounge", "bar deportivo", "cerveceria"].some((k) => name.includes(k))) {
    score += 5;
  }
  let reviewHits = 0;
  SPORTS_REVIEW_KEYWORDS.forEach((kw) => {
    const regex = new RegExp("\\b" + kw.replace(/\s+/g, "\\s+") + "\\b", "gi");
    const matches = allReviewText.match(regex);
    if (matches) reviewHits += matches.length;
  });
  score += Math.min(reviewHits * 2, 35);
  const foodKws = ["wings", "nachos", "burgers", "burger", "beer", "draft", "pitchers", "pints", "happy hour", "pub food", "bar food", "finger food"];
  const foodHits = foodKws.filter((k) => allReviewText.includes(k)).length;
  score += Math.min(foodHits * 2, 10);
  if (place.servesBeer === true) score += 3;
  if (place.servesCocktails === true) score += 2;
  return Math.min(score, 100);
}
function sportsLabel(score) {
  if (score >= 85) return "Best Sports Bar";
  if (score >= 70) return "Sports-Friendly";
  if (score >= 55) return "Casual Watch Spot";
  return null;
}
const ASIAN_TYPES = /* @__PURE__ */ new Set([
  "chinese_restaurant",
  "japanese_restaurant",
  "korean_restaurant",
  "thai_restaurant",
  "vietnamese_restaurant",
  "filipino_restaurant",
  "ramen_restaurant",
  "sushi_restaurant"
]);
const CUISINE_CHIP_TO_UMBRELLA = {
  italian: { label: "Italian", types: /* @__PURE__ */ new Set(["italian_restaurant"]), keywords: ["pasta", "pizza", "risotto", "lasagna", "antipasto"] },
  mexican: { label: "Mexican", types: /* @__PURE__ */ new Set(["mexican_restaurant"]), keywords: ["taco", "burrito", "enchilada", "quesadilla", "tamale"] },
  chinese: { label: "Chinese", types: /* @__PURE__ */ new Set(["chinese_restaurant"]), keywords: ["dim sum", "noodle", "dumpling", "chow mein", "kung pao"] },
  japanese: { label: "Japanese", types: /* @__PURE__ */ new Set(["japanese_restaurant", "ramen_restaurant"]), keywords: ["sushi", "ramen", "tempura", "udon", "teriyaki"] },
  sushi: { label: "Sushi", types: /* @__PURE__ */ new Set(["sushi_restaurant", "japanese_restaurant"]), keywords: ["sushi", "sashimi", "maki", "nigiri", "omakase"] },
  korean: { label: "Korean", types: /* @__PURE__ */ new Set(["korean_restaurant"]), keywords: ["bibimbap", "kimchi", "bulgogi", "korean bbq", "tteokbokki"] },
  thai: { label: "Thai", types: /* @__PURE__ */ new Set(["thai_restaurant"]), keywords: ["pad thai", "tom yum", "green curry", "massaman", "satay"] },
  vietnamese: { label: "Vietnamese", types: /* @__PURE__ */ new Set(["vietnamese_restaurant"]), keywords: ["pho", "banh mi", "spring roll", "vermicelli", "bun bo hue"] },
  indian: { label: "Indian", types: /* @__PURE__ */ new Set(["indian_restaurant"]), keywords: ["curry", "biryani", "naan", "tikka masala", "tandoori"] },
  filipino: { label: "Filipino", types: /* @__PURE__ */ new Set(["filipino_restaurant"]), keywords: ["adobo", "sinigang", "lumpia", "sisig", "halo halo"] },
  french: { label: "French", types: /* @__PURE__ */ new Set(["french_restaurant"]), keywords: ["croissant", "baguette", "crepe", "quiche", "bouillabaisse"] },
  pizza: { label: "Pizza", types: /* @__PURE__ */ new Set(["pizza_restaurant"]), keywords: ["pizza", "slice", "margherita", "pepperoni", "sicilian"] },
  seafood: { label: "Seafood", types: /* @__PURE__ */ new Set(["seafood_restaurant"]), keywords: ["fish", "shrimp", "lobster", "crab", "clam", "oyster"] },
  mediterranean: { label: "Mediterranean", types: /* @__PURE__ */ new Set(["mediterranean_restaurant", "greek_restaurant"]), keywords: ["gyro", "hummus", "falafel", "shawarma", "tzatziki"] },
  american: { label: "American", types: /* @__PURE__ */ new Set(["american_restaurant", "hamburger_restaurant"]), keywords: ["burger", "fries", "sandwich", "wing", "bbq"] },
  breakfast: { label: "Breakfast", types: /* @__PURE__ */ new Set(["breakfast_restaurant", "brunch_restaurant"]), keywords: ["pancake", "waffle", "egg", "french toast", "omelet"] }
};
const CULTURAL_INTENTS = {
  asian: {
    label: "Asian",
    types: ASIAN_TYPES,
    keywords: [
      "chinese",
      "japanese",
      "korean",
      "thai",
      "vietnamese",
      "filipino",
      "asian",
      "dim sum",
      "ramen",
      "sushi",
      "pho",
      "pad thai",
      "boba",
      "banh mi",
      "kimchi"
    ]
  },
  latin: {
    label: "Latin",
    types: /* @__PURE__ */ new Set(["mexican_restaurant", "latin_american_restaurant", "spanish_restaurant"]),
    keywords: ["mexican", "latin", "taco", "burrito", "tamale", "empanada", "torta", "ceviche"]
  },
  mediterranean: {
    label: "Mediterranean",
    types: /* @__PURE__ */ new Set(["mediterranean_restaurant", "greek_restaurant", "middle_eastern_restaurant"]),
    keywords: ["mediterranean", "greek", "middle eastern", "lebanese", "turkish", "hummus", "falafel", "shawarma"]
  },
  european: {
    label: "European",
    types: /* @__PURE__ */ new Set(["italian_restaurant", "french_restaurant", "german_restaurant", "spanish_restaurant"]),
    keywords: ["italian", "french", "german", "european", "pasta", "risotto", "crepe", "schnitzel"]
  }
};
const KNOWN_BREAKFAST_CHAINS = [
  // US
  "mcdonald",
  "ihop",
  "denny",
  "waffle house",
  "cracker barrel",
  "bob evans",
  "corner bakery",
  "panera",
  "first watch",
  "snooze",
  "black bear diner",
  "mimi's cafe",
  "coco's",
  "marie callender",
  "bob's big boy",
  "perkins",
  "village inn",
  "le pain quotidien",
  "einstein",
  "the original pancake",
  "stack'd",
  "another broken egg",
  "wildflower",
  "norms",
  // SoCal 24hr family chain — pancakes, French toast, breakfast platters
  // International expansion (Step 4.6, 2026-05-22)
  "tim hortons",
  // Canada / US / Mexico / global
  "cora's",
  // Canada — pancake-specialty breakfast chain
  "sunset grill",
  // Canada — breakfast specialty
  "eggsmart",
  // Canada — breakfast chain
  "the breakfast club",
  // UK — modern brunch / pancakes
  "granger",
  // UK / Australia — Bill Granger's fluffy pancakes
  "pret a manger",
  // UK / US — breakfast staples
  "komeda",
  // Japan — morning-set breakfast chain
  "doutor",
  // Japan — breakfast / coffee chain
  "caf\xE9 du monde",
  // US / Japan — beignets / pastries
  "cafe du monde",
  //   (no-accent fallback for Google name variants)
  "egg slut",
  // US / global — egg-focused breakfast spot
  "eggslut",
  //   (concatenated variant)
  "stack pancake"
  // UK — pancake specialty
];
const BREAKFAST_PLAUSIBLE_TYPES = /* @__PURE__ */ new Set([
  "breakfast_restaurant",
  "brunch_restaurant",
  "diner",
  // 'american_restaurant' intentionally NOT included — Google tags
  // Chick-fil-A, KFC, Applebee's, and similar fast-food chains with this
  // type, so admitting it as a breakfast signal lets them tier 3/4 on
  // pancakes searches even though they don't actually serve breakfast.
  // McDonald's stays via KNOWN_BREAKFAST_CHAINS (chain list is trustworthy).
  "bakery",
  "pastry_shop",
  "donut_shop",
  "bagel_shop"
]);
const DISH_MAP = [
  // ── Japanese ────────────────────────────────────────────────────────────────
  { pattern: /\bsushi\b/, tier1: ["sushi_restaurant"], tier2: ["japanese_restaurant"], label: "sushi", nameKeywords: ["sushi", "sashimi", "maki", "nigiri", "omakase"] },
  { pattern: /\bramen\b/, tier1: ["ramen_restaurant"], tier2: ["japanese_restaurant"], label: "ramen", nameKeywords: ["ramen", "ramenya", "jinya", "daikokuya", "tsujita", "tatsu"] },
  { pattern: /\budon\b/, tier1: ["japanese_restaurant"], tier2: ["noodle_restaurant"], label: "udon", nameKeywords: ["udon", "udonya", "marugame"] },
  { pattern: /\bteriyaki\b/, tier1: ["japanese_restaurant"], tier2: ["asian_restaurant"], label: "teriyaki", nameKeywords: ["teriyaki", "teriyaki bowl", "teriyaki house", "yoshinoya", "waba grill", "teriyaki madness"] },
  { pattern: /\bdonburi\b|\bgyudon\b|\bkatsudon\b|\boyakodon\b|\bchirashi\b/, tier1: ["japanese_restaurant"], tier2: ["asian_restaurant"], label: "donburi", nameKeywords: ["donburi", "gyudon", "katsudon", "oyakodon", "rice bowl", "yoshinoya"] },
  { pattern: /\btempura\b/, tier1: ["japanese_restaurant"], tier2: [], label: "tempura", nameKeywords: ["tempura"] },
  { pattern: /\bokonomiyaki\b/, tier1: ["japanese_restaurant"], tier2: [], label: "okonomiyaki", nameKeywords: ["okonomiyaki"] },
  { pattern: /\btonkatsu\b/, tier1: ["japanese_restaurant"], tier2: [], label: "tonkatsu", nameKeywords: ["tonkatsu", "katsu", "wakana"] },
  { pattern: /\byakitori\b/, tier1: ["japanese_restaurant"], tier2: [], label: "yakitori", nameKeywords: ["yakitori", "torisushi"] },
  { pattern: /\bshabu[\s-]*shabu\b|\bshabu\b/, tier1: ["japanese_restaurant"], tier2: ["korean_restaurant"], label: "shabu shabu", nameKeywords: ["shabu", "shabu shabu", "shabuya"] },
  { pattern: /\bhot\s*pot\b/, tier1: ["chinese_restaurant", "korean_restaurant"], tier2: ["japanese_restaurant"], label: "hot pot", nameKeywords: ["hot pot", "hotpot", "haidilao", "little sheep", "boiling point"] },
  { pattern: /\bkatsu\b|\bchicken\s*katsu\b|\bpork\s*katsu\b/, tier1: ["japanese_restaurant"], tier2: [], label: "katsu", nameKeywords: ["katsu", "tonkatsu", "curry house"] },
  { pattern: /\bgyoza\b/, tier1: ["japanese_restaurant"], tier2: ["chinese_restaurant"], label: "gyoza", nameKeywords: ["gyoza", "gyozaya"] },
  { pattern: /\btakoyaki\b/, tier1: ["japanese_restaurant"], tier2: [], label: "takoyaki", nameKeywords: ["takoyaki", "octopus ball"] },
  { pattern: /\byakiniku\b/, tier1: ["japanese_restaurant", "korean_restaurant"], tier2: ["barbecue_restaurant"], label: "yakiniku", nameKeywords: ["yakiniku", "gyu-kaku", "gyukaku"] },
  { pattern: /\byakisoba\b|\bsoba\b/, tier1: ["japanese_restaurant"], tier2: ["noodle_house"], label: "soba", nameKeywords: ["soba", "yakisoba", "sobaya"] },
  { pattern: /\bonigiri\b|\briceballs?\b/, tier1: ["japanese_restaurant"], tier2: [], label: "onigiri", nameKeywords: ["onigiri", "riceball", "musubi"] },
  { pattern: /\bomurice\b|\bomu\s*rice\b/, tier1: ["japanese_restaurant"], tier2: [], label: "omurice", nameKeywords: ["omurice", "omu rice"] },
  { pattern: /\bbento\b/, tier1: ["japanese_restaurant"], tier2: [], label: "bento", nameKeywords: ["bento", "bentoya", "bento box"] },
  { pattern: /\bmochi\b|\bdaifuku\b/, tier1: ["japanese_restaurant", "dessert_shop"], tier2: ["ice_cream_shop"], label: "mochi", nameKeywords: ["mochi", "mochiko", "daifuku", "mikawaya"] },
  // ── Chinese ─────────────────────────────────────────────────────────────────
  { pattern: /\bdim\s*sum\b|\bdimsum\b/, tier1: ["chinese_restaurant"], tier2: [], label: "dim sum", nameKeywords: ["dim sum", "dimsum", "yum cha", "sea harbour"] },
  { pattern: /\bxiaolong\s*bao\b|\bsoup\s*dump\w+/, tier1: ["chinese_restaurant"], tier2: [], label: "xiaolongbao", nameKeywords: ["xiaolongbao", "xlb", "soup dumpling", "din tai fung", "joe shanghai"] },
  { pattern: /\bmapo\s*tofu\b/, tier1: ["chinese_restaurant"], tier2: [], label: "mapo tofu", nameKeywords: ["mapo", "mapo tofu"] },
  { pattern: /\bpeking\s*duck\b|\bbeijing\s*duck\b/, tier1: ["chinese_restaurant"], tier2: [], label: "Peking duck", nameKeywords: ["peking duck", "beijing duck", "duck house", "quanjude"] },
  { pattern: /\bdumplings?\b|\bpotstickers?\b/, tier1: ["chinese_restaurant"], tier2: ["japanese_restaurant"], label: "dumplings", nameKeywords: ["dumpling", "dumplings", "potsticker", "jiaozi"] },
  { pattern: /\bdan\s*dan\b/, tier1: ["chinese_restaurant"], tier2: [], label: "dan dan noodles", nameKeywords: ["dan dan", "dan dan noodle"] },
  { pattern: /\bcongee\b|\bjook\b/, tier1: ["chinese_restaurant"], tier2: [], label: "congee", nameKeywords: ["congee", "jook"] },
  { pattern: /\bchar\s*siu\b|\bbbq\s*pork\b/, tier1: ["chinese_restaurant"], tier2: [], label: "char siu", nameKeywords: ["char siu", "bbq pork", "siu mei"] },
  { pattern: /\bwonton\b/, tier1: ["chinese_restaurant"], tier2: [], label: "wonton", nameKeywords: ["wonton", "wonton house"] },
  { pattern: /\bchow\s*mein\b|\blo\s*mein\b/, tier1: ["chinese_restaurant"], tier2: [], label: "chow mein", nameKeywords: ["chow mein", "lo mein", "noodle house", "noodle world"] },
  { pattern: /\bfried\s*rice\b/, tier1: ["chinese_restaurant", "thai_restaurant"], tier2: ["asian_restaurant"], label: "fried rice", nameKeywords: ["fried rice"] },
  { pattern: /\bkung\s*pao\b/, tier1: ["chinese_restaurant"], tier2: [], label: "kung pao", nameKeywords: ["kung pao"] },
  { pattern: /\bgeneral\s*tso\b|\borange\s*chicken\b/, tier1: ["chinese_restaurant"], tier2: [], label: "Chinese-American", nameKeywords: ["general tso", "orange chicken", "panda express", "panda inn"] },
  { pattern: /\bbao(zi)?\b|\bsteamed\s*buns?\b/, tier1: ["chinese_restaurant"], tier2: [], label: "bao", nameKeywords: ["bao", "baozi", "steamed bun", "wow bao"] },
  { pattern: /\bsiu\s*mai\b|\bshumai\b|\bhar\s*gow\b/, tier1: ["chinese_restaurant"], tier2: [], label: "dim sum", nameKeywords: ["siu mai", "shumai", "har gow", "dim sum"] },
  { pattern: /\bhong\s*kong\s*style\b|\bcantonese\b/, tier1: ["cantonese_restaurant", "chinese_restaurant"], tier2: [], label: "Cantonese", nameKeywords: ["cantonese", "hong kong"] },
  // ── Korean ──────────────────────────────────────────────────────────────────
  { pattern: /\bbibimbap\b/, tier1: ["korean_restaurant"], tier2: [], label: "bibimbap", nameKeywords: ["bibimbap", "bibibop", "dolsot"] },
  { pattern: /\bbulgogi\b/, tier1: ["korean_restaurant"], tier2: [], label: "bulgogi", nameKeywords: ["bulgogi"] },
  { pattern: /\bkorean\s*bbq\b|\bkbbq\b/, tier1: ["korean_restaurant"], tier2: [], label: "Korean BBQ", nameKeywords: ["kbbq", "korean bbq", "gen korean", "quarters bbq", "sura korean", "park's bbq", "kang ho dong"] },
  { pattern: /\bjjigae\b|\bkimchi\s*stew\b/, tier1: ["korean_restaurant"], tier2: [], label: "jjigae", nameKeywords: ["jjigae", "kimchi stew"] },
  { pattern: /\bbossam\b|\bsamgyeopsal\b/, tier1: ["korean_restaurant"], tier2: [], label: "Korean BBQ", nameKeywords: ["bossam", "samgyeopsal", "kbbq", "korean bbq"] },
  { pattern: /\btteokbokki\b/, tier1: ["korean_restaurant"], tier2: [], label: "tteokbokki", nameKeywords: ["tteokbokki", "rice cake"] },
  { pattern: /\bkimchi\b/, tier1: ["korean_restaurant"], tier2: [], label: "kimchi", nameKeywords: ["kimchi"] },
  { pattern: /\bjajangmyeon\b|\bjjajangmyeon\b/, tier1: ["korean_restaurant"], tier2: ["chinese_restaurant"], label: "jajangmyeon", nameKeywords: ["jajangmyeon", "jjajangmyeon", "black bean noodle"] },
  { pattern: /\bmandu\b/, tier1: ["korean_restaurant"], tier2: ["chinese_restaurant"], label: "mandu", nameKeywords: ["mandu", "korean dumpling"] },
  { pattern: /\bjapchae\b/, tier1: ["korean_restaurant"], tier2: [], label: "japchae", nameKeywords: ["japchae"] },
  { pattern: /\bgimbap\b|\bkimbap\b/, tier1: ["korean_restaurant"], tier2: [], label: "gimbap", nameKeywords: ["gimbap", "kimbap", "korean roll"] },
  { pattern: /\bsoondubu\b|\bsundubu\b/, tier1: ["korean_restaurant"], tier2: [], label: "soondubu", nameKeywords: ["soondubu", "sundubu", "tofu house", "tofu soup", "beverly soon tofu"] },
  { pattern: /\bkorean\s*fried\s*chicken\b|\bkfc\s*korean\b/, tier1: ["korean_restaurant", "chicken_restaurant"], tier2: [], label: "Korean fried chicken", nameKeywords: ["korean fried chicken", "bonchon", "kyochon", "bb.q", "pelicana"] },
  { pattern: /\bbingsu\b|\bbingsoo\b|\bpatbingsu\b/, tier1: ["korean_restaurant", "dessert_shop"], tier2: ["ice_cream_shop"], label: "bingsu", nameKeywords: ["bingsu", "bingsoo", "patbingsu", "snowflake", "snow ice"] },
  // ── Vietnamese ──────────────────────────────────────────────────────────────
  { pattern: /\bpho\b/, tier1: ["vietnamese_restaurant"], tier2: [], label: "pho", nameKeywords: ["pho", "pho saigon", "pho 79", "pho ha noi", "pho hoa", "pho 24"] },
  { pattern: /\bbanh\s*mi\b/, tier1: ["vietnamese_restaurant"], tier2: [], label: "banh mi", nameKeywords: ["banh mi", "sandwich vietnam", "lee's sandwiches"] },
  { pattern: /\bbun\s*cha\b/, tier1: ["vietnamese_restaurant"], tier2: [], label: "bun cha", nameKeywords: ["bun cha"] },
  { pattern: /\bcuon\b|\bspring\s*rolls?\b/, tier1: ["vietnamese_restaurant"], tier2: ["asian_restaurant"], label: "spring rolls", nameKeywords: ["spring roll", "cuon", "goi cuon"] },
  { pattern: /\bbun\s*bo\s*hue\b/, tier1: ["vietnamese_restaurant"], tier2: [], label: "bun bo hue", nameKeywords: ["bun bo hue"] },
  { pattern: /\bcom\s*tam\b|\bbroken\s*rice\b/, tier1: ["vietnamese_restaurant"], tier2: [], label: "com tam", nameKeywords: ["com tam", "broken rice"] },
  { pattern: /\bvietnamese\s*coffee\b|\bca\s*phe\s*sua\s*da\b/, tier1: ["vietnamese_restaurant", "coffee_shop"], tier2: ["cafe"], label: "Vietnamese coffee", nameKeywords: ["vietnamese coffee", "ca phe sua da", "phin filter"] },
  // ── Thai ────────────────────────────────────────────────────────────────────
  { pattern: /\bpad\s*thai\b/, tier1: ["thai_restaurant"], tier2: [], label: "Pad Thai", nameKeywords: ["pad thai", "thai house"] },
  { pattern: /\bpad\s*see\s*ew\b|\bpad\s*kra\s*pao\b/, tier1: ["thai_restaurant"], tier2: [], label: "Thai noodles", nameKeywords: ["pad see ew", "pad kra pao", "pad kee mao"] },
  { pattern: /\bsom\s*tam\b|\bpapaya\s*salad\b/, tier1: ["thai_restaurant"], tier2: [], label: "som tam", nameKeywords: ["som tam", "papaya salad"] },
  { pattern: /\btom\s*yum\b/, tier1: ["thai_restaurant"], tier2: [], label: "tom yum", nameKeywords: ["tom yum", "tom yum goong"] },
  { pattern: /\bthai\s*curry\b|\bgreen\s*curry\b|\bred\s*curry\b|\byellow\s*curry\b|\bpanang\b|\bmassaman\b|\bkhao\s*soi\b/, tier1: ["thai_restaurant"], tier2: [], label: "Thai curry", nameKeywords: ["thai curry", "green curry", "red curry", "yellow curry", "panang", "massaman", "khao soi"] },
  { pattern: /\bthai\s*iced\s*tea\b|\bthai\s*tea\b/, tier1: ["thai_restaurant"], tier2: [], label: "Thai tea", nameKeywords: ["thai tea", "thai iced tea", "cha yen"] },
  { pattern: /\bmango\s*sticky\s*rice\b/, tier1: ["thai_restaurant"], tier2: ["dessert_shop"], label: "mango sticky rice", nameKeywords: ["mango sticky rice", "khao niao mamuang"] },
  { pattern: /\blarb\b/, tier1: ["thai_restaurant"], tier2: [], label: "larb", nameKeywords: ["larb", "laap", "laab"] },
  { pattern: /\btom\s*kha\b/, tier1: ["thai_restaurant"], tier2: [], label: "tom kha", nameKeywords: ["tom kha", "tom kha gai"] },
  { pattern: /\bdrunken\s*noodles\b|\bpad\s*kee\s*mao\b/, tier1: ["thai_restaurant"], tier2: [], label: "drunken noodles", nameKeywords: ["drunken noodles", "pad kee mao"] },
  // ── Indian ──────────────────────────────────────────────────────────────────
  { pattern: /\bcurry\b/, tier1: ["indian_restaurant"], tier2: ["thai_restaurant"], label: "curry", nameKeywords: ["curry", "curry house", "curry leaves", "curry up"] },
  { pattern: /\bbiryani\b/, tier1: ["indian_restaurant"], tier2: [], label: "biryani", nameKeywords: ["biryani", "biryani house", "paradise biryani"] },
  { pattern: /\bdosa\b|\bmasala\s*dosa\b/, tier1: ["indian_restaurant"], tier2: [], label: "dosa", nameKeywords: ["dosa", "dosa hut", "dosa palace", "masala dosa", "udupi"] },
  { pattern: /\btandoori\b|\bbutter\s*chicken\b|\bmurgh\s*makhani\b/, tier1: ["indian_restaurant"], tier2: [], label: "tandoori", nameKeywords: ["tandoori", "tandoor", "butter chicken", "murgh makhani", "clay oven"] },
  { pattern: /\btikka\s*masala\b/, tier1: ["indian_restaurant"], tier2: [], label: "tikka masala", nameKeywords: ["tikka masala", "tikka"] },
  { pattern: /\bpalak\s*paneer\b|\bsaag\b/, tier1: ["indian_restaurant"], tier2: [], label: "palak paneer", nameKeywords: ["palak paneer", "saag paneer"] },
  { pattern: /\bsamosa\b/, tier1: ["indian_restaurant"], tier2: [], label: "samosa", nameKeywords: ["samosa", "samosa house"] },
  { pattern: /\bchana\s*masala\b/, tier1: ["indian_restaurant"], tier2: [], label: "chana masala", nameKeywords: ["chana masala", "chole"] },
  { pattern: /\bvindaloo\b|\bkorma\b|\brogan\s*josh\b/, tier1: ["indian_restaurant"], tier2: [], label: "Indian curry", nameKeywords: ["vindaloo", "korma", "rogan josh"] },
  { pattern: /\bnaan\b|\bgarlic\s*naan\b/, tier1: ["indian_restaurant"], tier2: [], label: "naan", nameKeywords: ["naan", "naan stop", "tandoor"] },
  { pattern: /\bchaat\b|\bpani\s*puri\b|\bgolgappa\b|\bbhel\s*puri\b/, tier1: ["indian_restaurant"], tier2: [], label: "chaat", nameKeywords: ["chaat", "chaat bhavan", "chaat corner", "pani puri", "golgappa", "bhel puri"] },
  { pattern: /\bvada\s*pav\b|\bpav\s*bhaji\b|\bvada\b|\bpakora\b/, tier1: ["indian_restaurant"], tier2: [], label: "Indian street food", nameKeywords: ["vada pav", "pav bhaji", "pakora", "chaat"] },
  { pattern: /\bthali\b/, tier1: ["indian_restaurant"], tier2: [], label: "thali", nameKeywords: ["thali", "thali house", "udupi"] },
  { pattern: /\bchai\b|\bmasala\s*chai\b|\bchai\s*latte\b/, tier1: ["indian_restaurant", "tea_house"], tier2: ["cafe", "coffee_shop"], label: "chai", nameKeywords: ["chai", "masala chai", "chai latte", "chaiwala", "dishoom"] },
  { pattern: /\blassi\b|\bmango\s*lassi\b/, tier1: ["indian_restaurant"], tier2: [], label: "lassi", nameKeywords: ["lassi", "mango lassi"] },
  { pattern: /\bgulab\s*jamun\b|\bjalebi\b|\brasmalai\b|\bkulfi\b/, tier1: ["indian_restaurant", "dessert_shop"], tier2: [], label: "Indian dessert", nameKeywords: ["gulab jamun", "jalebi", "rasmalai", "kulfi", "mithai", "sweets"] },
  { pattern: /\baloo\s*gobi\b|\bsaag\b/, tier1: ["indian_restaurant"], tier2: [], label: "Indian vegetarian", nameKeywords: ["aloo gobi", "saag", "udupi"] },
  // ── Filipino ────────────────────────────────────────────────────────────────
  { pattern: /\badobo\b/, tier1: ["filipino_restaurant"], tier2: [], label: "adobo", nameKeywords: ["adobo"] },
  { pattern: /\bsinigang\b/, tier1: ["filipino_restaurant"], tier2: [], label: "sinigang", nameKeywords: ["sinigang"] },
  { pattern: /\blechon\b/, tier1: ["filipino_restaurant"], tier2: [], label: "lechon", nameKeywords: ["lechon"] },
  { pattern: /\bsisig\b/, tier1: ["filipino_restaurant"], tier2: [], label: "sisig", nameKeywords: ["sisig"] },
  { pattern: /\bkare[\s-]*kare\b/, tier1: ["filipino_restaurant"], tier2: [], label: "kare kare", nameKeywords: ["kare kare", "kare-kare"] },
  { pattern: /\blumpia\b/, tier1: ["filipino_restaurant"], tier2: [], label: "lumpia", nameKeywords: ["lumpia", "lumpia shanghai"] },
  { pattern: /\bpancit\b/, tier1: ["filipino_restaurant"], tier2: [], label: "pancit", nameKeywords: ["pancit", "pansit"] },
  { pattern: /\bhalo[\s-]*halo\b/, tier1: ["filipino_restaurant"], tier2: [], label: "halo halo", nameKeywords: ["halo halo", "halo-halo", "jollibee", "chowking"] },
  { pattern: /\bbulalo\b/, tier1: ["filipino_restaurant"], tier2: [], label: "bulalo", nameKeywords: ["bulalo"] },
  { pattern: /\bbicol\s*express\b|\blaing\b/, tier1: ["filipino_restaurant"], tier2: [], label: "Bicolano", nameKeywords: ["bicol express", "laing"] },
  { pattern: /\btapsilog\b|\bsilog\b|\blongganisa\b/, tier1: ["filipino_restaurant"], tier2: [], label: "Filipino breakfast", nameKeywords: ["tapsilog", "silog", "tocilog", "longsilog", "longganisa"] },
  { pattern: /\bcaldereta\b|\bpinakbet\b|\bcrispy\s*pata\b|\blechon\s*kawali\b/, tier1: ["filipino_restaurant"], tier2: [], label: "Filipino classics", nameKeywords: ["caldereta", "pinakbet", "crispy pata", "lechon kawali"] },
  { pattern: /\bube\b|\bleche\s*flan\b|\bbibingka\b|\bensaymada\b|\bturon\b/, tier1: ["filipino_restaurant", "bakery", "dessert_shop"], tier2: [], label: "Filipino dessert", nameKeywords: ["ube", "leche flan", "bibingka", "ensaymada", "turon", "goldilocks", "red ribbon", "valerio's"] },
  { pattern: /\bchicken\s*inasal\b|\binasal\b/, tier1: ["filipino_restaurant"], tier2: ["barbecue_restaurant"], label: "chicken inasal", nameKeywords: ["inasal", "chicken inasal", "mang inasal", "bacolod chicken house", "bacolod"], strict: true, strictPrimaryTypes: ["filipino_restaurant"] },
  // ── Southeast Asian ─────────────────────────────────────────────────────────
  { pattern: /\blaksa\b/, tier1: ["malaysian_restaurant", "singaporean_restaurant"], tier2: [], label: "laksa", nameKeywords: ["laksa"] },
  { pattern: /\bsatay\b/, tier1: ["malaysian_restaurant", "indonesian_restaurant"], tier2: ["thai_restaurant"], label: "satay", nameKeywords: ["satay", "sate"] },
  { pattern: /\brendang\b/, tier1: ["indonesian_restaurant", "malaysian_restaurant"], tier2: [], label: "rendang", nameKeywords: ["rendang"] },
  { pattern: /\bnasi\s*goreng\b/, tier1: ["indonesian_restaurant", "malaysian_restaurant"], tier2: [], label: "nasi goreng", nameKeywords: ["nasi goreng"] },
  // ── Middle Eastern ──────────────────────────────────────────────────────────
  { pattern: /\bshawarma\b/, tier1: ["middle_eastern_restaurant", "turkish_restaurant"], tier2: [], label: "shawarma", nameKeywords: ["shawarma", "halal guys", "the halal guys"] },
  { pattern: /\bkebab\b|\bdoner\b/, tier1: ["middle_eastern_restaurant", "turkish_restaurant"], tier2: [], label: "kebab", nameKeywords: ["kebab", "doner", "shish kebab", "adana kebab", "kabob"] },
  { pattern: /\bfalafel\b/, tier1: ["middle_eastern_restaurant", "greek_restaurant"], tier2: ["mediterranean_restaurant"], label: "falafel", nameKeywords: ["falafel", "falafel king", "maoz"] },
  { pattern: /\bhummus\b/, tier1: ["middle_eastern_restaurant", "mediterranean_restaurant"], tier2: [], label: "hummus", nameKeywords: ["hummus", "hummus bar", "cava"] },
  { pattern: /\bkofta\b|\bkefta\b|\bkafta\b/, tier1: ["middle_eastern_restaurant", "turkish_restaurant"], tier2: ["indian_restaurant", "mediterranean_restaurant"], label: "kofta", nameKeywords: ["kofta", "kefta", "kafta"] },
  { pattern: /\bshakshuka\b/, tier1: ["middle_eastern_restaurant", "israeli_restaurant"], tier2: ["mediterranean_restaurant", "brunch_restaurant"], label: "shakshuka", nameKeywords: ["shakshuka"] },
  { pattern: /\btabb?ouleh\b|\bbaba\s*ganoush\b|\bmezz?e\b/, tier1: ["middle_eastern_restaurant"], tier2: ["mediterranean_restaurant"], label: "mezze", nameKeywords: ["mezze", "meze", "tabbouleh", "baba ganoush"] },
  { pattern: /\bbaklava\b/, tier1: ["middle_eastern_restaurant", "turkish_restaurant", "dessert_shop"], tier2: ["pastry_shop", "bakery"], label: "baklava", nameKeywords: ["baklava"] },
  { pattern: /\bdolmas?\b|\bdolmadakia\b/, tier1: ["greek_restaurant", "middle_eastern_restaurant", "turkish_restaurant"], tier2: [], label: "dolma", nameKeywords: ["dolma", "dolmas", "dolmadakia"] },
  { pattern: /\bpita\b/, tier1: ["middle_eastern_restaurant", "mediterranean_restaurant"], tier2: ["greek_restaurant"], label: "pita", nameKeywords: ["pita", "pita pit", "pita way", "pita inn"] },
  { pattern: /\bmansaf\b|\bkabsa\b|\bmaqluba\b/, tier1: ["middle_eastern_restaurant"], tier2: [], label: "Levantine", nameKeywords: ["mansaf", "kabsa", "maqluba", "levantine"] },
  // ── Turkish ─────────────────────────────────────────────────────────────────
  { pattern: /\bgozleme\b|\bgözleme\b/, tier1: ["turkish_restaurant"], tier2: ["middle_eastern_restaurant"], label: "g\xF6zleme", nameKeywords: ["gozleme", "g\xF6zleme"] },
  { pattern: /\blahmacun\b|\bpide\b/, tier1: ["turkish_restaurant"], tier2: ["middle_eastern_restaurant"], label: "Turkish flatbread", nameKeywords: ["lahmacun", "pide", "turkish pizza"] },
  { pattern: /\bborek\b|\bbörek\b/, tier1: ["turkish_restaurant", "bakery"], tier2: [], label: "b\xF6rek", nameKeywords: ["borek", "b\xF6rek"] },
  { pattern: /\bmeze\b|\bmezeler\b/, tier1: ["turkish_restaurant", "middle_eastern_restaurant"], tier2: ["mediterranean_restaurant"], label: "meze", nameKeywords: ["meze", "mezeler"] },
  // ── European ────────────────────────────────────────────────────────────────
  { pattern: /\bpasta\b|\blasagna\b|\brigatoni\b|\bpenne\b|\bspaghetti\b|\bcarbonara\b|\bcacio\s*e\s*pepe\b|\bfettuccine\b|\balfredo\b/, tier1: ["italian_restaurant"], tier2: ["mediterranean_restaurant"], label: "pasta", nameKeywords: ["pasta", "spaghetti", "lasagna", "carbonara", "fettuccine", "alfredo", "olive garden", "spaghetti factory", "buca di beppo", "maggiano", "sbarro", "noodles & company"] },
  { pattern: /\bneapolitan\s*pizza\b|\bnew\s*york\s*style\s*pizza\b|\bdeep\s*dish\b|\bpizza\b/, tier1: ["pizza_restaurant"], tier2: ["italian_restaurant"], label: "pizza", nameKeywords: ["pizza", "pizzeria", "blaze pizza", "mod pizza", "pizza hut", "domino", "papa john", "little caesars", "round table", "sbarro", "&pizza", "marco's"] },
  { pattern: /\barancini\b|\bsupplì\b|\bsuppli\b/, tier1: ["italian_restaurant"], tier2: [], label: "arancini", nameKeywords: ["arancini", "suppli"] },
  { pattern: /\baperitivo\b/, tier1: ["italian_restaurant", "wine_bar", "cafe"], tier2: ["bar"], label: "aperitivo", nameKeywords: ["aperitivo", "aperol", "spritz"] },
  { pattern: /\bcroissant\b|\bpain\s*au\s*chocolat\b|\bchocolatines?\b|\bpastries\b/, tier1: ["french_restaurant", "bakery", "pastry_shop"], tier2: ["cafe"], label: "pastries", nameKeywords: ["croissant", "pain au chocolat", "pastries", "french bakery", "la madeleine", "paul"] },
  { pattern: /\bschnitzel\b/, tier1: ["german_restaurant"], tier2: [], label: "schnitzel", nameKeywords: ["schnitzel", "wiener schnitzel"] },
  { pattern: /\bpaella\b/, tier1: ["spanish_restaurant"], tier2: [], label: "paella", nameKeywords: ["paella"] },
  { pattern: /\btapas\b/, tier1: ["spanish_restaurant", "tapas_bar"], tier2: [], label: "tapas", nameKeywords: ["tapas", "tapas bar", "jaleo"] },
  { pattern: /\bfish\s*and\s*chips\b/, tier1: ["british_restaurant"], tier2: ["pub"], label: "fish and chips", nameKeywords: ["fish and chips", "chippy", "long john silver"] },
  { pattern: /\bgyro(s)?\b/, tier1: ["greek_restaurant", "mediterranean_restaurant"], tier2: [], label: "gyros", nameKeywords: ["gyro", "gyros", "daphne's", "great greek"] },
  // ── Italian beyond pasta ──
  { pattern: /\brisotto\b/, tier1: ["italian_restaurant"], tier2: [], label: "risotto", nameKeywords: ["risotto"] },
  { pattern: /\bravioli\b|\btortellini\b|\bgnocchi\b/, tier1: ["italian_restaurant"], tier2: ["mediterranean_restaurant"], label: "pasta", nameKeywords: ["ravioli", "tortellini", "gnocchi", "pasta"] },
  { pattern: /\bbruschetta\b|\bantipasto\b|\bcaprese\b/, tier1: ["italian_restaurant"], tier2: [], label: "Italian appetizer", nameKeywords: ["bruschetta", "antipasto", "caprese"] },
  { pattern: /\bpanini\b|\bfocaccia\b/, tier1: ["italian_restaurant", "sandwich_shop"], tier2: ["cafe", "deli"], label: "panini", nameKeywords: ["panini", "focaccia", "panera", "potbelly"] },
  { pattern: /\bcalzone\b|\bstromboli\b/, tier1: ["pizza_restaurant", "italian_restaurant"], tier2: [], label: "calzone", nameKeywords: ["calzone", "stromboli"] },
  { pattern: /\bchicken\s*parm(igiana|esan)?\b|\beggplant\s*parm/, tier1: ["italian_restaurant"], tier2: ["american_restaurant"], label: "chicken parm", nameKeywords: ["chicken parm", "chicken parmesan", "eggplant parm", "parmigiana"] },
  { pattern: /\bmeatballs?\b/, tier1: ["italian_restaurant"], tier2: ["american_restaurant", "sandwich_shop"], label: "meatballs", nameKeywords: ["meatball", "meatballs", "the meatball shop"] },
  { pattern: /\bminestrone\b/, tier1: ["italian_restaurant"], tier2: [], label: "minestrone", nameKeywords: ["minestrone"] },
  { pattern: /\btiramisu\b|\bcannoli\b|\baffogato\b/, tier1: ["italian_restaurant", "dessert_shop"], tier2: ["cafe", "pastry_shop"], label: "Italian dessert", nameKeywords: ["tiramisu", "cannoli", "affogato", "gelato", "venchi"] },
  // ── French beyond crepes ──
  { pattern: /\bfrench\s*onion\s*soup\b/, tier1: ["french_restaurant"], tier2: ["european_restaurant"], label: "French onion soup", nameKeywords: ["french onion soup"] },
  { pattern: /\bescargot\b|\bbouillabaisse\b|\bratatouille\b|\bcoq\s*au\s*vin\b/, tier1: ["french_restaurant"], tier2: [], label: "French classic", nameKeywords: ["escargot", "bouillabaisse", "ratatouille", "coq au vin"] },
  { pattern: /\bboeuf\s*bourguignon\b|\bbeef\s*bourguignon\b/, tier1: ["french_restaurant"], tier2: [], label: "boeuf bourguignon", nameKeywords: ["boeuf bourguignon", "beef bourguignon"] },
  { pattern: /\bcassoulet\b/, tier1: ["french_restaurant"], tier2: [], label: "cassoulet", nameKeywords: ["cassoulet"] },
  { pattern: /\bquiche\b/, tier1: ["french_restaurant", "brunch_restaurant"], tier2: ["cafe", "bakery"], label: "quiche", nameKeywords: ["quiche", "la madeleine"] },
  { pattern: /\bfoie\s*gras\b/, tier1: ["french_restaurant"], tier2: [], label: "foie gras", nameKeywords: ["foie gras"] },
  // ── Spanish beyond paella/tapas ──
  { pattern: /\bjamon\b|\bjamón\b|\bchorizo\b/, tier1: ["spanish_restaurant"], tier2: [], label: "Spanish cured meat", nameKeywords: ["jamon", "jam\xF3n", "chorizo", "iberico", "jamoner\xEDa"] },
  { pattern: /\bgazpacho\b/, tier1: ["spanish_restaurant"], tier2: [], label: "gazpacho", nameKeywords: ["gazpacho"] },
  { pattern: /\bpatatas\s*bravas\b|\bpintxos?\b|\btortilla\s*espanola\b/, tier1: ["spanish_restaurant", "tapas_bar"], tier2: [], label: "Spanish tapas", nameKeywords: ["patatas bravas", "pintxos", "tortilla espanola", "tapas bar"] },
  { pattern: /\bvermut\b|\bvermouth\s*hour\b/, tier1: ["spanish_restaurant", "wine_bar", "bar"], tier2: ["tapas_bar"], label: "vermut", nameKeywords: ["vermut", "vermouth"] },
  // ── German / Austrian / Swiss ──
  { pattern: /\bbratwurst\b|\bsausages?\b|\bwurst\b/, tier1: ["german_restaurant"], tier2: ["american_restaurant"], label: "sausage", nameKeywords: ["bratwurst", "sausage", "wurst", "sausage haus"] },
  { pattern: /\bpretzels?\b|\bbrezel\b/, tier1: ["german_restaurant", "bakery"], tier2: [], label: "pretzel", nameKeywords: ["pretzel", "brezel", "auntie anne", "wetzel", "philly pretzel"] },
  { pattern: /\bsauerkraut\b|\bspaetzle\b/, tier1: ["german_restaurant"], tier2: [], label: "German classic", nameKeywords: ["sauerkraut", "spaetzle"] },
  { pattern: /\bfondue\b|\braclette\b/, tier1: ["swiss_restaurant", "french_restaurant"], tier2: ["european_restaurant"], label: "fondue", nameKeywords: ["fondue", "raclette", "melting pot"] },
  // ── British / Irish ──
  { pattern: /\bshepherds?\s*pie\b/, tier1: ["british_restaurant", "irish_restaurant"], tier2: ["pub"], label: "shepherd's pie", nameKeywords: ["shepherd's pie", "shepherds pie"] },
  { pattern: /\bbangers?\s*and\s*mash\b/, tier1: ["british_restaurant", "irish_restaurant"], tier2: ["pub"], label: "bangers and mash", nameKeywords: ["bangers and mash"] },
  { pattern: /\bfull\s*english\b|\benglish\s*breakfast\b/, tier1: ["british_restaurant"], tier2: ["breakfast_restaurant", "brunch_restaurant"], label: "English breakfast", nameKeywords: ["full english", "english breakfast"] },
  { pattern: /\bmeat\s*pie\b|\bmince\s*pie\b|\bsteak\s*and\s*kidney\s*pie\b/, tier1: ["british_restaurant", "australian_restaurant"], tier2: ["pub", "bakery"], label: "meat pie", nameKeywords: ["meat pie", "mince pie", "steak and kidney", "pie hole", "pie shop"] },
  { pattern: /\byorkshire\s*pudding\b/, tier1: ["british_restaurant"], tier2: [], label: "Yorkshire pudding", nameKeywords: ["yorkshire pudding"] },
  // ── Eastern European ──
  { pattern: /\bpierogi(es)?\b|\bperogi(es)?\b/, tier1: ["polish_restaurant", "ukrainian_restaurant"], tier2: ["european_restaurant"], label: "pierogi", nameKeywords: ["pierogi", "pierogies", "perogi", "perogies"] },
  { pattern: /\bborscht\b/, tier1: ["russian_restaurant", "ukrainian_restaurant", "polish_restaurant"], tier2: ["european_restaurant"], label: "borscht", nameKeywords: ["borscht"] },
  { pattern: /\bgoulash\b/, tier1: ["hungarian_restaurant", "german_restaurant"], tier2: ["european_restaurant"], label: "goulash", nameKeywords: ["goulash"] },
  { pattern: /\bstroganoff\b|\bbeef\s*stroganoff\b/, tier1: ["russian_restaurant"], tier2: ["european_restaurant"], label: "stroganoff", nameKeywords: ["stroganoff", "beef stroganoff"] },
  { pattern: /\bblini\b|\bpelmeni\b/, tier1: ["russian_restaurant"], tier2: [], label: "Russian classic", nameKeywords: ["blini", "pelmeni"] },
  // ── South American ──────────────────────────────────────────────────────────
  { pattern: /\bceviche\b/, tier1: ["peruvian_restaurant", "latin_american_restaurant"], tier2: ["seafood_restaurant"], label: "ceviche", nameKeywords: ["ceviche", "cebicheria", "sebastian"] },
  { pattern: /\bempanadas?\b/, tier1: ["latin_american_restaurant"], tier2: ["mexican_restaurant"], label: "empanadas", nameKeywords: ["empanada", "empanadas"] },
  { pattern: /\barepas?\b/, tier1: ["venezuelan_restaurant", "latin_american_restaurant"], tier2: [], label: "arepas", nameKeywords: ["arepa", "arepas"] },
  { pattern: /\bchurrasco\b|\bbrazilian\s*bbq\b|\bbrazilian\s*steak\b/, tier1: ["brazilian_restaurant", "steak_house"], tier2: [], label: "churrasco", nameKeywords: ["churrasco", "brazilian bbq", "brazilian steak", "fogo de chao", "texas de brazil", "rodizio"] },
  { pattern: /\bfeijoada\b|\bpicanha\b|\bmoqueca\b/, tier1: ["brazilian_restaurant"], tier2: [], label: "Brazilian classic", nameKeywords: ["feijoada", "picanha", "moqueca"] },
  { pattern: /\bpao\s*de\s*queijo\b|\bp[aã]o\s*de\s*queijo\b|\bcoxinha\b|\bpastel\b/, tier1: ["brazilian_restaurant"], tier2: ["bakery"], label: "Brazilian snack", nameKeywords: ["pao de queijo", "p\xE3o de queijo", "coxinha", "pastel"] },
  { pattern: /\bcaipirinha\b/, tier1: ["brazilian_restaurant", "bar"], tier2: [], label: "caipirinha", nameKeywords: ["caipirinha"] },
  // ── African ─────────────────────────────────────────────────────────────────
  { pattern: /\binjera\b|\bethiopian\b/, tier1: ["ethiopian_restaurant"], tier2: ["african_restaurant"], label: "Ethiopian", nameKeywords: ["injera", "ethiopian", "meskerem", "messob", "queen sheba"] },
  { pattern: /\bjollof\s*rice\b/, tier1: ["nigerian_restaurant", "west_african_restaurant"], tier2: ["african_restaurant"], label: "jollof rice", nameKeywords: ["jollof", "jollof rice"] },
  { pattern: /\btagine\b|\bmoroccan\b/, tier1: ["moroccan_restaurant"], tier2: ["north_african_restaurant"], label: "tagine", nameKeywords: ["tagine", "moroccan", "tagine house"] },
  // ── American ────────────────────────────────────────────────────────────────
  { pattern: /\btaco(s)?\b|\bburrito(s)?\b|\bquesadilla\b/, tier1: ["mexican_restaurant"], tier2: ["latin_american_restaurant"], label: "tacos", nameKeywords: ["taco", "tacos", "burrito", "quesadilla", "taqueria", "rubio's", "baja fresh", "chipotle", "qdoba", "el pollo loco"] },
  { pattern: /\benchilada(s)?\b|\btamale(s)?\b|\bchilaquiles\b|\btostada(s)?\b|\bchimichanga\b/, tier1: ["mexican_restaurant"], tier2: ["latin_american_restaurant"], label: "Mexican", nameKeywords: ["enchilada", "tamale", "chilaquiles", "tostada", "chimichanga"] },
  { pattern: /\bmole\b|\bpozole\b|\bbirria\b/, tier1: ["mexican_restaurant"], tier2: [], label: "Mexican classic", nameKeywords: ["mole", "pozole", "birria", "birrieria", "birria-landia"] },
  { pattern: /\bcarnitas\b|\bal\s*pastor\b|\bbarbacoa\b/, tier1: ["mexican_restaurant", "taqueria"], tier2: [], label: "Mexican meat", nameKeywords: ["carnitas", "al pastor", "barbacoa", "taqueria", "leo's tacos", "tacos el gordo", "guisados"] },
  { pattern: /\bfajita(s)?\b/, tier1: ["mexican_restaurant"], tier2: ["tex_mex_restaurant"], label: "fajitas", nameKeywords: ["fajita", "fajitas", "on the border"] },
  { pattern: /\belote(s)?\b|\besquite(s)?\b/, tier1: ["mexican_restaurant"], tier2: [], label: "elote", nameKeywords: ["elote", "elotes", "esquite", "esquites"] },
  { pattern: /\bhorchata\b|\baguas?\s*frescas?\b/, tier1: ["mexican_restaurant"], tier2: [], label: "horchata", nameKeywords: ["horchata", "aguas frescas", "aguas"] },
  { pattern: /\bchurros?\b/, tier1: ["mexican_restaurant", "spanish_restaurant", "dessert_shop"], tier2: [], label: "churros", nameKeywords: ["churro", "churros", "churreria"] },
  { pattern: /\btres\s*leches\b|\bflan\b/, tier1: ["mexican_restaurant", "latin_american_restaurant", "dessert_shop"], tier2: [], label: "Latin dessert", nameKeywords: ["tres leches", "flan"] },
  { pattern: /\bburger(s)?\b|\bwhopper\b/, tier1: ["hamburger_restaurant"], tier2: ["american_restaurant", "fast_food_restaurant"], label: "burgers", nameKeywords: ["burger", "burgers", "whopper", "in-n-out", "five guys", "shake shack", "smashburger", "habit", "fatburger", "wendy", "jack in the box", "carl's jr", "hardee's", "culver's", "whataburger", "mcdonald", "burger king", "sonic", "white castle", "a&w", "red robin", "fuddruckers", "burgerfi", "steak n shake", "steak 'n shake", "krystal"], strict: true, strictPrimaryTypes: ["hamburger_restaurant", "american_restaurant"] },
  { pattern: /\bsteak\b/, tier1: ["steak_house"], tier2: ["american_restaurant", "brazilian_restaurant"], label: "steak", nameKeywords: ["steak", "steakhouse", "steak house", "outback", "ruth's chris", "morton", "fleming", "black angus", "sizzler", "longhorn", "texas roadhouse", "lawry's", "peter luger", "capital grille", "smith & wollensky", "del frisco", "st. elmo", "palm restaurant", "lone star", "keens steakhouse"], strict: true, strictPrimaryTypes: ["steak_house", "american_restaurant", "brazilian_restaurant", "barbecue_restaurant"] },
  { pattern: /\bbbq\b|\bbarbeque\b|\bbarbecue\b/, tier1: ["barbecue_restaurant"], tier2: ["american_restaurant"], label: "BBQ", nameKeywords: ["bbq", "barbecue", "barbeque", "smokehouse", "dickey", "sonny", "famous dave", "rudy's", "phil's bbq", "salt lick"] },
  { pattern: /\bribs?\b|\bbrisket\b|\bpulled\s*pork\b/, tier1: ["barbecue_restaurant"], tier2: ["american_restaurant", "southern_restaurant"], label: "ribs", nameKeywords: ["rib", "ribs", "brisket", "pulled pork", "smokehouse", "tony roma", "baby back", "lucille's"] },
  { pattern: /\bwings\b|\bchicken\s*wings\b|\bbuffalo\s*wings\b/, tier1: ["chicken_restaurant"], tier2: ["pizza_restaurant", "sports_bar", "bar"], label: "wings", nameKeywords: ["wing", "wings", "buffalo wing", "hooters", "wingstop", "buffalo wild wings", "wing zone"] },
  { pattern: /\bfried\s*chicken\b|\bchicken\b/, tier1: ["chicken_restaurant"], tier2: ["fast_food_restaurant", "american_restaurant"], label: "fried chicken", nameKeywords: ["fried chicken", "chick-fil-a", "chick fil a", "kfc", "kentucky fried", "popeyes", "raising cane", "church's chicken", "el pollo loco", "dave's hot chicken", "jollibee"] },
  { pattern: /\bseafood\b|\bshellfish\b|\boysters?\b|\bclams?\b|\blobster\s*roll\b|\bclam\s*chowder\b|\bfish\s*and\s*chips\b/, tier1: ["seafood_restaurant"], tier2: ["american_restaurant"], label: "seafood", nameKeywords: ["seafood", "oysters", "clam chowder", "lobster roll", "red lobster", "joe's crab", "bonefish", "legal sea foods", "crab shack"] },
  { pattern: /\bgumbo\b|\bpo[\s-]*boy\b/, tier1: ["cajun_restaurant", "southern_restaurant"], tier2: ["american_restaurant"], label: "Cajun", nameKeywords: ["gumbo", "po boy", "po-boy", "popeyes", "cajun"] },
  { pattern: /\bjambalaya\b|\bcrawfish\b|\bcrayfish\b/, tier1: ["cajun_restaurant", "southern_restaurant"], tier2: ["seafood_restaurant"], label: "Cajun", nameKeywords: ["jambalaya", "crawfish", "crayfish", "cajun"] },
  { pattern: /\bshrimp\s*and\s*grits\b|\bbiscuits?\s*and\s*gravy\b|\bchicken\s*and\s*waffles\b/, tier1: ["southern_restaurant", "soul_food_restaurant"], tier2: ["american_restaurant", "breakfast_restaurant"], label: "Southern", nameKeywords: ["shrimp and grits", "biscuits and gravy", "chicken and waffles", "cracker barrel", "roscoe's", "soul food"] },
  { pattern: /\bcheesesteak\b|\bphilly\s*cheesesteak\b/, tier1: ["sandwich_shop", "american_restaurant"], tier2: [], label: "cheesesteak", nameKeywords: ["cheesesteak", "philly cheesesteak", "philly", "pat's", "geno's", "jim's steaks"] },
  // Breakfast sandwich — MUST precede the generic "sandwich" and "breakfast"
  // patterns below (first-match wins), else "breakfast" hijacks it into a strict
  // breakfast_restaurant search that filters out sandwich shops/delis (the
  // reported bug: "breakfast sandwich" → bakeries). NOT strict, so sandwich
  // shops + delis + diners survive tiering.
  { pattern: /\bbreakfast\s*sandwich(es)?\b|\begg\s*sandwich(es)?\b|\bbreakfast\s*(bagel|wrap|biscuit)\b|\b(bacon|sausage)\s*egg\s*(and\s*)?cheese\b/, tier1: ["sandwich_shop", "american_restaurant", "breakfast_restaurant"], tier2: ["deli", "diner", "cafe", "bagel_shop", "fast_food_restaurant"], label: "breakfast sandwich", nameKeywords: ["breakfast sandwich", "egg sandwich", "breakfast bagel", "breakfast wrap", "breakfast biscuit", "egg and cheese", "bacon egg", "sausage egg", "mcmuffin"], mealTime: "breakfast" },
  { pattern: /\breuben\b|\bclub\s*sandwich\b|\bblt\b/, tier1: ["sandwich_shop", "deli"], tier2: ["american_restaurant"], label: "deli sandwich", nameKeywords: ["reuben", "club sandwich", "blt", "deli", "katz's", "langer's", "canter's"] },
  { pattern: /\bsandwich(es)?\b|\bsub(marine|s)?\b|\bhoagie\b|\bgrinder\b/, tier1: ["sandwich_shop", "deli"], tier2: ["cafe", "american_restaurant"], label: "sandwich", nameKeywords: ["sandwich", "sub", "hoagie", "grinder", "subway", "jimmy john", "jersey mike", "firehouse", "potbelly", "quiznos", "which wich", "blimpie"] },
  { pattern: /\bgrilled\s*cheese\b/, tier1: ["sandwich_shop", "american_restaurant"], tier2: ["cafe", "diner"], label: "grilled cheese", nameKeywords: ["grilled cheese", "melt", "tom and chee"] },
  { pattern: /\bhot\s*dog\b|\bcorn\s*dog\b|\bfrankfurter\b/, tier1: ["american_restaurant", "fast_food_restaurant"], tier2: [], label: "hot dog", nameKeywords: ["hot dog", "corn dog", "frankfurter", "wienerschnitzel", "pink's", "nathan's", "portillo", "sonic", "five guys"] },
  { pattern: /\bnachos\b/, tier1: ["mexican_restaurant"], tier2: ["american_restaurant", "sports_bar"], label: "nachos", nameKeywords: ["nacho", "nachos"] },
  { pattern: /\bchili\b/, tier1: ["american_restaurant"], tier2: ["mexican_restaurant"], label: "chili", nameKeywords: ["chili", "chili's", "wendy's chili"] },
  { pattern: /\bmeatloaf\b/, tier1: ["american_restaurant", "diner"], tier2: ["southern_restaurant"], label: "meatloaf", nameKeywords: ["meatloaf"] },
  { pattern: /\bchicken\s*tenders?\b|\bchicken\s*strips?\b|\bnuggets?\b|\bsliders?\b/, tier1: ["chicken_restaurant", "american_restaurant", "fast_food_restaurant"], tier2: [], label: "finger food", nameKeywords: ["chicken tender", "chicken strip", "nugget", "slider", "raising cane", "tender shack", "white castle", "krystal"] },
  { pattern: /\bonion\s*rings\b|\bfries?\b|\bfrench\s*fries\b|\bpoutine\b/, tier1: ["american_restaurant", "fast_food_restaurant"], tier2: ["canadian_restaurant"], label: "fries", nameKeywords: ["fries", "french fries", "poutine", "onion ring"] },
  { pattern: /\bchicken\s*pot\s*pie\b/, tier1: ["american_restaurant", "southern_restaurant"], tier2: ["diner"], label: "chicken pot pie", nameKeywords: ["chicken pot pie", "pot pie", "marie callender"] },
  { pattern: /\bbuffalo\s*chicken\b/, tier1: ["chicken_restaurant", "american_restaurant"], tier2: ["sports_bar"], label: "buffalo", nameKeywords: ["buffalo chicken", "buffalo wild wings"] },
  { pattern: /\bpancakes?\b|\bwaffles?\b/, tier1: ["breakfast_restaurant"], tier2: ["american_restaurant", "diner"], label: "pancakes", nameKeywords: ["pancake", "pancakes", "waffle", "flapjack", "griddle", "pancake house", "ihop", "waffle house", "stack pancake"], mealTime: "breakfast", strict: true, strictPrimaryTypes: ["breakfast_restaurant", "brunch_restaurant", "diner", "american_restaurant"] },
  { pattern: /\bbagels?\b/, tier1: ["bagel_shop"], tier2: ["deli", "bakery"], label: "bagels", nameKeywords: ["bagel", "bagels", "einstein", "noah", "manhattan bagel", "bruegger"], strict: true, strictPrimaryTypes: ["bagel_shop"] },
  { pattern: /\bdonuts?\b|\bdoughnuts?\b/, tier1: ["donut_shop"], tier2: ["bakery", "dessert_shop", "pastry_shop"], label: "donuts", nameKeywords: ["donut", "donuts", "doughnut", "dunkin", "krispy kreme", "tim hortons", "randy's", "sidecar", "blue star", "voodoo", "winchell", "yum yum"], strict: true, strictPrimaryTypes: ["donut_shop"] },
  { pattern: /\bmac\s*and\s*cheese\b|\bmac\s*n\s*cheese\b/, tier1: ["american_restaurant"], tier2: ["soul_food_restaurant"], label: "mac and cheese", nameKeywords: ["mac and cheese", "mac n cheese", "noodles & company"] },
  { pattern: /\bpoke\b|\bpoke\s*bowl\b/, tier1: ["hawaiian_restaurant"], tier2: ["japanese_restaurant"], label: "poke", nameKeywords: ["poke", "poke bowl", "poki", "sweetfin", "pokeworks"] },
  // ── Brunch / Breakfast ─────────────────────────────────────────────────────
  { pattern: /\bbrunch\b/, tier1: ["brunch_restaurant"], tier2: ["breakfast_restaurant", "cafe"], label: "brunch", nameKeywords: ["brunch", "brunch club"], mealTime: "brunch", strict: true, strictPrimaryTypes: ["brunch_restaurant", "breakfast_restaurant", "cafe", "diner"] },
  { pattern: /\bbreakfast\b/, tier1: ["breakfast_restaurant"], tier2: ["diner", "cafe"], label: "breakfast", nameKeywords: ["breakfast", "breakfast club", "breakfast republic", "first watch", "snooze"], mealTime: "breakfast", strict: true, strictPrimaryTypes: ["breakfast_restaurant", "brunch_restaurant", "diner"] },
  { pattern: /\beggs\s*benedict\b|\bbenedict\b/, tier1: ["brunch_restaurant", "breakfast_restaurant"], tier2: ["cafe", "diner"], label: "eggs benedict", nameKeywords: ["eggs benedict", "benedict", "egg slut", "eggslut"], mealTime: "brunch", strict: true, strictPrimaryTypes: ["brunch_restaurant", "breakfast_restaurant", "cafe", "diner"] },
  { pattern: /\bomelet(te)?\b|\bfrittata\b/, tier1: ["breakfast_restaurant", "brunch_restaurant"], tier2: ["diner", "cafe"], label: "omelette", nameKeywords: ["omelet", "omelette", "frittata"], mealTime: "breakfast", strict: true, strictPrimaryTypes: ["breakfast_restaurant", "brunch_restaurant", "diner", "cafe"] },
  { pattern: /\bavocado\s*toast\b|\bacai\b|\baçaí\s*bowl\b/, tier1: ["brunch_restaurant", "cafe"], tier2: ["juice_bar", "vegan_restaurant"], label: "brunch bowl", nameKeywords: ["avocado toast", "acai bowl", "a\xE7a\xED bowl", "vitality bowls"], mealTime: "brunch", strict: true, strictPrimaryTypes: ["brunch_restaurant", "cafe", "juice_shop", "vegan_restaurant"] },
  { pattern: /\bfrench\s*toast\b/, tier1: ["breakfast_restaurant", "brunch_restaurant"], tier2: ["cafe", "diner"], label: "French toast", nameKeywords: ["french toast"], mealTime: "breakfast", strict: true, strictPrimaryTypes: ["breakfast_restaurant", "brunch_restaurant", "cafe", "diner"] },
  { pattern: /\bbreakfast\s*burrito\b/, tier1: ["mexican_restaurant", "breakfast_restaurant"], tier2: [], label: "breakfast burrito", nameKeywords: ["breakfast burrito"], mealTime: "breakfast", strict: true, strictPrimaryTypes: ["mexican_restaurant", "breakfast_restaurant"] },
  // ── Australian ────────────────────────────────────────────────────────────
  { pattern: /\bpavlova\b|\blamington\b/, tier1: ["australian_restaurant", "dessert_shop"], tier2: ["bakery"], label: "Australian dessert", nameKeywords: ["pavlova", "lamington"] },
  { pattern: /\bchicken\s*parm(igiana)?\b/, tier1: ["italian_restaurant", "australian_restaurant"], tier2: ["pub", "american_restaurant"], label: "chicken parmigiana", nameKeywords: ["chicken parm", "chicken parmigiana", "parmi"] },
  // ── Drinks & Cafe ──────────────────────────────────────────────────────────
  { pattern: /\bmatcha\b/, tier1: ["japanese_restaurant", "tea_house", "cafe"], tier2: ["coffee_shop", "dessert_shop"], label: "matcha", nameKeywords: ["matcha", "matcha bar", "matcha cafe"] },
  { pattern: /\btea\b|\bteahouse\b/, tier1: ["tea_house", "cafe"], tier2: ["bubble_tea_shop"], label: "tea", nameKeywords: ["tea", "teahouse", "tea house", "teavana", "adagio", "david's tea"] },
  { pattern: /\bjuice\b|\bfresh\s*juice\b|\bjuice\s*bar\b|\bsmoothie(s)?\b/, tier1: ["juice_bar"], tier2: ["cafe", "vegan_restaurant"], label: "juice", nameKeywords: ["juice", "smoothie", "jamba", "jamba juice", "tropical smoothie", "smoothie king", "juice it up", "nekter"] },
  { pattern: /\bmilkshake(s)?\b|\bshakes?\b/, tier1: ["ice_cream_shop", "diner", "american_restaurant"], tier2: ["dessert_shop"], label: "milkshake", nameKeywords: ["milkshake", "shake", "shake shack", "steak n shake"] },
  { pattern: /\bcocktails?\b|\bmartini\b|\bmojito\b/, tier1: ["cocktail_bar", "bar"], tier2: ["lounge", "restaurant"], label: "cocktails", nameKeywords: ["cocktail", "martini", "mojito", "cocktail bar", "speakeasy"] },
  { pattern: /\bwine\b|\bwinery\b|\bwine\s*bar\b/, tier1: ["wine_bar", "winery"], tier2: ["bar", "restaurant"], label: "wine", nameKeywords: ["wine", "winery", "wine bar"] },
  { pattern: /\bbeer\b|\bbrewery\b|\bbrewpub\b|\bcraft\s*beer\b/, tier1: ["brewery", "brewpub"], tier2: ["bar", "pub"], label: "beer", nameKeywords: ["beer", "brewery", "brewpub", "craft beer", "taproom", "stone brewing"] },
  { pattern: /\bwhiskey\b|\bwhisky\b|\bscotch\b|\bbourbon\b/, tier1: ["whiskey_bar", "bar"], tier2: ["lounge"], label: "whiskey", nameKeywords: ["whiskey", "whisky", "scotch", "bourbon", "whiskey bar"] },
  { pattern: /\bsake\b/, tier1: ["japanese_restaurant", "bar"], tier2: [], label: "sake", nameKeywords: ["sake", "sake bar"] },
  // ── Generic categories ─────────────────────────────────────────────────────
  { pattern: /\bsalad(s)?\b/, tier1: ["salad_bar", "vegan_restaurant", "vegetarian_restaurant"], tier2: ["cafe", "restaurant"], label: "salad", nameKeywords: ["salad", "salad bar", "sweetgreen", "chop't", "tossed", "tender greens"] },
  { pattern: /\bsoup(s)?\b/, tier1: ["soup_restaurant"], tier2: ["cafe", "asian_restaurant"], label: "soup", nameKeywords: ["soup", "souplantation", "soup plantation"] },
  { pattern: /\bnoodles?\b/, tier1: ["noodle_house", "ramen_restaurant"], tier2: ["chinese_restaurant", "japanese_restaurant", "vietnamese_restaurant", "thai_restaurant"], label: "noodles", nameKeywords: ["noodle", "noodles", "noodle house", "noodle bar", "noodles & company"] },
  { pattern: /\brice\s*bowl(s)?\b|\bpoke\s*bowl(s)?\b|\bgrain\s*bowl(s)?\b/, tier1: ["bowl_restaurant", "asian_restaurant"], tier2: ["vegan_restaurant", "vegetarian_restaurant"], label: "bowl", nameKeywords: ["bowl", "rice bowl", "grain bowl", "poke bowl"] },
  { pattern: /\bdessert(s)?\b/, tier1: ["dessert_shop", "ice_cream_shop", "bakery"], tier2: ["pastry_shop", "cafe"], label: "dessert", nameKeywords: ["dessert", "desserts", "sweets", "sweet shop"], strict: true, strictPrimaryTypes: ["dessert_shop", "ice_cream_shop", "bakery", "cake_shop", "pastry_shop", "chocolate_shop"] },
  { pattern: /\bvegan\b/, tier1: ["vegan_restaurant"], tier2: ["vegetarian_restaurant"], label: "vegan", nameKeywords: ["vegan", "plant based", "vegan kitchen", "plant power", "veggie grill"] },
  { pattern: /\bvegetarian\b/, tier1: ["vegetarian_restaurant"], tier2: ["vegan_restaurant", "indian_restaurant"], label: "vegetarian", nameKeywords: ["vegetarian", "veggie", "plant based"] },
  { pattern: /\bgluten[\s-]*free\b/, tier1: ["gluten_free_restaurant"], tier2: ["vegan_restaurant"], label: "gluten free", nameKeywords: ["gluten free", "gf bakery", "gf kitchen"] },
  { pattern: /\bhalal\b/, tier1: ["halal_restaurant"], tier2: ["middle_eastern_restaurant", "indian_restaurant"], label: "halal", nameKeywords: ["halal", "halal guys", "halal cart", "the halal guys"] },
  { pattern: /\bkosher\b/, tier1: ["kosher_restaurant"], tier2: ["israeli_restaurant"], label: "kosher", nameKeywords: ["kosher", "kosher kitchen", "kosher deli"] },
  { pattern: /\bbuffet\b|\ball\s*you\s*can\s*eat\b/, tier1: ["buffet_restaurant"], tier2: ["restaurant"], label: "buffet", nameKeywords: ["buffet", "all you can eat", "golden corral", "hometown buffet", "sizzler"] },
  { pattern: /\bdiner\b/, tier1: ["diner"], tier2: ["american_restaurant", "breakfast_restaurant"], label: "diner", nameKeywords: ["diner"] },
  { pattern: /\bpub\b|\bgastropub\b/, tier1: ["pub", "gastropub"], tier2: ["british_restaurant", "bar"], label: "pub", nameKeywords: ["pub", "gastropub", "tavern"] },
  { pattern: /\bfast\s*food\b/, tier1: ["fast_food_restaurant"], tier2: [], label: "fast food", nameKeywords: ["fast food"] },
  // snacks: STRICT. Removed `cafe` from tier2 (coffee shops aren't snack
  // places). Allowlist: snack_bar, convenience_store, fast_food_restaurant,
  // food_court. Drops pizza restaurants / sit-down restaurants / coffee
  // shops / sandwich shops that previously leaked in via Tier 4 review-text.
  { pattern: /\bsnacks?\b|\bfinger\s*food\b/, tier1: ["snack_bar", "convenience_store"], tier2: ["fast_food_restaurant", "food_court"], label: "snacks", nameKeywords: ["snacks", "finger food"], strict: true, strictPrimaryTypes: ["snack_bar", "convenience_store", "fast_food_restaurant", "food_court"] },
  // comfort food: STRICT. Allowlist American comfort categories only.
  // Drops Asian/Mexican/Italian sit-down restaurants that previously
  // leaked in via Tier 4 review-text mention of "comfort food".
  { pattern: /\bcomfort\s*food\b|\bhome\s*cooking\b/, tier1: ["diner", "american_restaurant"], tier2: ["southern_restaurant", "soul_food_restaurant", "bbq_restaurant"], label: "comfort food", nameKeywords: ["comfort food", "home cooking", "soul food"], strict: true, strictPrimaryTypes: ["diner", "american_restaurant", "southern_restaurant", "soul_food_restaurant", "bbq_restaurant"] },
  // ── Bakery & Desserts (dishes whose "specialty" is a shop type, not a cuisine) ─────────
  { pattern: /\bcakes?\b|\bcupcakes?\b/, tier1: ["cake_shop", "bakery"], tier2: ["dessert_shop", "pastry_shop", "cafe"], label: "cake", nameKeywords: ["cake", "cakes", "cupcake", "sprinkles", "crumbs", "magnolia bakery"] },
  { pattern: /\bbread\b|\bsourdough\b|\bbaguette\b/, tier1: ["bakery"], tier2: ["cafe", "sandwich_shop"], label: "bread", nameKeywords: ["bread", "sourdough", "baguette", "breadworks", "le pain quotidien", "la brea bakery"] },
  { pattern: /\bpastr(y|ies)\b|\bdanish\b|\beclair\b|\bmacarons?\b/, tier1: ["pastry_shop", "bakery"], tier2: ["french_restaurant", "cafe", "dessert_shop"], label: "pastries", nameKeywords: ["pastry", "pastries", "danish", "eclair", "macaron", "laduree", "pierre herme", "dominique ansel"] },
  { pattern: /\bpies?\b|\bcobblers?\b/, tier1: ["bakery", "dessert_shop"], tier2: ["american_restaurant", "diner"], label: "pie", nameKeywords: ["pie", "pies", "cobbler", "marie callender", "house of pies", "pie hole", "pie shop"] },
  { pattern: /\bcookies?\b/, tier1: ["bakery", "dessert_shop"], tier2: ["cafe"], label: "cookies", nameKeywords: ["cookie", "cookies", "crumbl", "insomnia", "mrs. fields", "dirty dough", "levain", "tate's"] },
  { pattern: /\bice\s*cream\b|\bgelato\b|\bsorbet\b/, tier1: ["ice_cream_shop", "gelato_shop"], tier2: ["dessert_shop", "cafe"], label: "ice cream", nameKeywords: ["ice cream", "gelato", "sorbet", "baskin robbins", "ben & jerry", "cold stone", "salt & straw", "jeni's", "h\xE4agen-dazs", "dairy queen", "mcconnell", "rite aid", "handel's"] },
  { pattern: /\bcrepes?\b/, tier1: ["creperie", "french_restaurant"], tier2: ["dessert_shop", "cafe"], label: "crepes", nameKeywords: ["crepe", "crepes", "creperie"] },
  { pattern: /\bboba\b|\bbubble\s*tea\b/, tier1: ["bubble_tea_shop", "tea_house"], tier2: ["cafe"], label: "boba", nameKeywords: ["boba", "bubble tea", "tpumps", "7 leaves", "sharetea", "kung fu tea", "85c", "happy lemon", "tiger sugar", "yi fang", "coco fresh"] },
  { pattern: /\bbakery\b|\bboulangerie\b|\bpatisserie\b/, tier1: ["bakery", "bakery_cafe"], tier2: ["pastry_shop", "cafe"], label: "bakery", nameKeywords: ["bakery", "boulangerie", "patisserie", "panaderia"] },
  // coffee: STRICT. Coffee/espresso/latte restricted to actual coffee
  // venues. Drops restaurants that happen to mention coffee in reviews.
  { pattern: /\bcoffee\b|\bespresso\b|\blatte\b/, tier1: ["coffee_shop", "cafe"], tier2: ["bakery", "bakery_cafe", "tea_house"], label: "coffee", nameKeywords: ["coffee", "espresso", "latte", "starbucks", "peet", "blue bottle", "dutch bros", "dunkin", "la colombe", "intelligentsia", "philz", "stumptown", "caribou", "tim hortons", "coffee bean", "verve"], strict: true, strictPrimaryTypes: ["coffee_shop", "cafe", "bakery", "bakery_cafe", "tea_house"] },
  // cheesecake: STRICT. Drops random restaurants that mention cheesecake
  // in reviews (sushi places with "cheesecake roll", etc.). Cheesecake
  // Factory is american_restaurant — kept via allowlist + nameKeyword.
  { pattern: /\bcheesecake\b/, tier1: ["dessert_shop", "bakery", "cake_shop"], tier2: ["cafe", "american_restaurant", "bakery_cafe"], label: "cheesecake", nameKeywords: ["cheesecake", "cheesecake factory", "junior's"], strict: true, strictPrimaryTypes: ["dessert_shop", "bakery", "cake_shop", "bakery_cafe", "cafe", "american_restaurant"] },
  // chocolate: STRICT. Real chocolate venues only. Drops bakeries that
  // happen to have chocolate-cake reviews, etc.
  { pattern: /\bchocolate\b|\bcacao\b|\btruffles?\b/, tier1: ["chocolatier", "dessert_shop", "candy_store"], tier2: ["bakery", "bakery_cafe"], label: "chocolate", nameKeywords: ["chocolate", "cacao", "truffle", "godiva", "lindt", "see's", "ghirardelli", "vosges", "jacques torres"], strict: true, strictPrimaryTypes: ["chocolatier", "dessert_shop", "candy_store", "bakery", "bakery_cafe"] },
  { pattern: /\bbrownies?\b/, tier1: ["bakery", "dessert_shop"], tier2: ["cafe"], label: "brownies", nameKeywords: ["brownie", "brownies", "fairytale brownies"] },
  // frozen yogurt: STRICT mode. Allowlist is real frozen-dessert types
  // ONLY (ice_cream_shop / gelato_shop / frozen_yogurt_shop). dessert_shop
  // is intentionally EXCLUDED because Google over-tags Asian bakeries,
  // donut shops, candy stores, and Indian markets with that tag — including
  // it leaked 85°C / JJ Bakery / Tous Les Jours / Donut King / Bhanu Indian
  // into results. Tier 4 review-text fallback is also skipped (see
  // `if (isStrict) return 5;` in computeTier above) so AI summaries or
  // contextual reviews that mention "frozen yogurt" can't promote
  // unrelated places.
  // Named brands (Yogurtland, Menchie's, Pinkberry, etc.) still hit Tier 1
  // via nameKeywords regardless of their Google primaryType.
  // Tradeoff: small independent froyo shops Google tags as dessert_shop
  // will not appear unless they match a brand keyword. Acceptable per
  // 2026-05-26 design call.
  { pattern: /\bfrozen\s*yogurt\b|\bfro[\s-]?yo\b/, tier1: ["ice_cream_shop", "gelato_shop", "frozen_yogurt_shop"], tier2: [], label: "frozen yogurt", nameKeywords: ["frozen yogurt", "froyo", "yogurtland", "menchie", "pinkberry", "tcby", "sweetfrog", "red mango", "16 handles", "tutti frutti"], strict: true, strictPrimaryTypes: ["ice_cream_shop", "gelato_shop", "frozen_yogurt_shop"] },
  { pattern: /\bshaved\s*ice\b|\bsno[\s-]*cone\b|\bhalo[\s-]*halo\b/, tier1: ["ice_cream_shop", "dessert_shop"], tier2: [], label: "shaved ice", nameKeywords: ["shaved ice", "sno cone", "snow cone", "snowflake", "hawaiian shaved ice", "class 302"] },
  { pattern: /\bcr[eè]me\s*br[uû]l[eé]e\b|\bsouffl[eé]\b/, tier1: ["french_restaurant", "dessert_shop"], tier2: ["bakery"], label: "French dessert", nameKeywords: ["creme brulee", "cr\xE8me br\xFBl\xE9e", "souffl\xE9", "souffle"] },
  // candy: STRICT. Drops restaurants/cafes that mention candy in reviews.
  { pattern: /\bcandy\b|\bsweets?\b|\bfudge\b/, tier1: ["candy_store", "dessert_shop"], tier2: ["bakery", "chocolatier"], label: "candy", nameKeywords: ["candy", "sweets", "fudge", "see's", "jelly belly", "dylan's candy", "sugarfina"], strict: true, strictPrimaryTypes: ["candy_store", "dessert_shop", "bakery", "chocolatier"] }
];
function levenshtein(a, b, maxDist) {
  if (a === b) return 0;
  const aLen = a.length, bLen = b.length;
  if (Math.abs(aLen - bLen) > maxDist) return maxDist + 1;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  let prev = new Array(bLen + 1);
  let curr = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) prev[j] = j;
  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[bLen];
}
const FUZZY_VOCAB_SINGLE = /* @__PURE__ */ new Set([
  // Cuisines
  "italian",
  "mexican",
  "chinese",
  "japanese",
  "korean",
  "thai",
  "vietnamese",
  "filipino",
  "indian",
  "french",
  "greek",
  "spanish",
  "german",
  "british",
  "irish",
  "mediterranean",
  "european",
  "asian",
  "latin",
  "latino",
  "american",
  "brazilian",
  "peruvian",
  "ethiopian",
  "moroccan",
  "turkish",
  "israeli",
  "polish",
  "russian",
  "hawaiian",
  "cantonese",
  "venezuelan",
  "indonesian",
  "malaysian",
  "singaporean",
  "swiss",
  "hungarian",
  "ukrainian",
  "nigerian",
  "australian",
  "canadian",
  // Venue types
  "trattoria",
  "osteria",
  "bistro",
  "bistrot",
  "brasserie",
  "taberna",
  "bodega",
  "izakaya",
  "cantina",
  "taqueria",
  "creperie",
  "gastropub",
  "pub",
  "diner",
  "cafe",
  "bakery",
  "grill",
  "restaurant",
  "buffet",
  "deli",
  // Dietary
  "vegan",
  "vegetarian",
  "halal",
  "kosher",
  // Dishes — Japanese
  "sushi",
  "ramen",
  "udon",
  "tempura",
  "okonomiyaki",
  "tonkatsu",
  "yakitori",
  "shabu",
  "katsu",
  "gyoza",
  "takoyaki",
  "yakiniku",
  "yakisoba",
  "soba",
  "onigiri",
  "omurice",
  "bento",
  "mochi",
  "daifuku",
  // Dishes — Chinese
  "dumplings",
  "potstickers",
  "congee",
  "jook",
  "wonton",
  "dimsum",
  "bao",
  "baozi",
  "shumai",
  // Dishes — Korean
  "bibimbap",
  "bulgogi",
  "kbbq",
  "jjigae",
  "bossam",
  "samgyeopsal",
  "tteokbokki",
  "kimchi",
  "jajangmyeon",
  "jjajangmyeon",
  "mandu",
  "japchae",
  "gimbap",
  "kimbap",
  "soondubu",
  "sundubu",
  "bingsu",
  "bingsoo",
  "patbingsu",
  // Dishes — Vietnamese / Thai
  "pho",
  "cuon",
  "larb",
  // Dishes — Indian
  "curry",
  "biryani",
  "dosa",
  "tandoori",
  "samosa",
  "vindaloo",
  "korma",
  "naan",
  "chaat",
  "vada",
  "pakora",
  "thali",
  "chai",
  "lassi",
  "jalebi",
  "rasmalai",
  "kulfi",
  "saag",
  "paneer",
  // Dishes — Filipino
  "adobo",
  "sinigang",
  "lechon",
  "sisig",
  "lumpia",
  "pancit",
  "bulalo",
  "laing",
  "tapsilog",
  "silog",
  "longganisa",
  "caldereta",
  "pinakbet",
  "ube",
  "bibingka",
  "ensaymada",
  "turon",
  // Dishes — SE Asian
  "laksa",
  "satay",
  "rendang",
  // Dishes — Middle Eastern / Turkish
  "shawarma",
  "kebab",
  "doner",
  "falafel",
  "hummus",
  "shakshuka",
  "tabbouleh",
  "tabouleh",
  "baba",
  "mezze",
  "meze",
  "baklava",
  "dolma",
  "pita",
  "mansaf",
  "kabsa",
  "maqluba",
  "gozleme",
  "lahmacun",
  "pide",
  "borek",
  // Dishes — Italian
  "pasta",
  "lasagna",
  "rigatoni",
  "penne",
  "spaghetti",
  "carbonara",
  "pizza",
  "arancini",
  "suppli",
  "aperitivo",
  "risotto",
  "ravioli",
  "tortellini",
  "gnocchi",
  "bruschetta",
  "antipasto",
  "caprese",
  "panini",
  "focaccia",
  "calzone",
  "stromboli",
  "meatballs",
  "minestrone",
  "tiramisu",
  "cannoli",
  "affogato",
  // Dishes — French
  "croissant",
  "baguette",
  "escargot",
  "bouillabaisse",
  "ratatouille",
  "cassoulet",
  "quiche",
  // Dishes — Spanish
  "paella",
  "tapas",
  "jamon",
  "chorizo",
  "gazpacho",
  "pintxos",
  "vermut",
  "vermouth",
  // Dishes — German / Swiss
  "schnitzel",
  "bratwurst",
  "wurst",
  "pretzel",
  "pretzels",
  "brezel",
  "sauerkraut",
  "spaetzle",
  "fondue",
  "raclette",
  // Dishes — Eastern European
  "pierogi",
  "pierogies",
  "perogi",
  "perogies",
  "borscht",
  "goulash",
  "stroganoff",
  "blini",
  "pelmeni",
  // Dishes — South American
  "ceviche",
  "empanada",
  "empanadas",
  "arepa",
  "arepas",
  "churrasco",
  "feijoada",
  "picanha",
  "moqueca",
  "coxinha",
  "pastel",
  "caipirinha",
  // Dishes — African
  "injera",
  "jollof",
  "tagine",
  // Dishes — Mexican
  "taco",
  "tacos",
  "burrito",
  "burritos",
  "quesadilla",
  "enchilada",
  "enchiladas",
  "tamale",
  "tamales",
  "chilaquiles",
  "tostada",
  "tostadas",
  "chimichanga",
  "mole",
  "pozole",
  "birria",
  "carnitas",
  "barbacoa",
  "fajita",
  "fajitas",
  "elote",
  "elotes",
  "esquites",
  "horchata",
  "churros",
  "flan",
  // Dishes — American
  "burger",
  "burgers",
  "whopper",
  "steak",
  "bbq",
  "barbeque",
  "barbecue",
  "ribs",
  "brisket",
  "wings",
  "seafood",
  "shellfish",
  "oysters",
  "clams",
  "lobster",
  "gumbo",
  "jambalaya",
  "crawfish",
  "crayfish",
  "cheesesteak",
  "reuben",
  "blt",
  "sandwich",
  "sandwiches",
  "submarine",
  "sub",
  "subs",
  "hoagie",
  "grinder",
  "nachos",
  "chili",
  "meatloaf",
  "sliders",
  "poutine",
  "poke",
  // Dishes — Brunch
  "brunch",
  "breakfast",
  "benedict",
  "omelet",
  "omelette",
  "frittata",
  "acai",
  // Australian
  "pavlova",
  "lamington",
  "parmigiana",
  // Drinks
  "matcha",
  "tea",
  "teahouse",
  "juice",
  "smoothie",
  "smoothies",
  "milkshake",
  "cocktails",
  "martini",
  "mojito",
  "wine",
  "winery",
  "beer",
  "brewery",
  "brewpub",
  "whiskey",
  "whisky",
  "scotch",
  "bourbon",
  "sake",
  "coffee",
  "espresso",
  "latte",
  // Generic
  "salad",
  "salads",
  "soup",
  "soups",
  "noodles",
  "dessert",
  "desserts",
  "snacks",
  "snack",
  // Bakery / Sweets
  "cake",
  "cakes",
  "cupcakes",
  "bread",
  "sourdough",
  "pastries",
  "pastry",
  "danish",
  "eclair",
  "macaron",
  "macarons",
  "pie",
  "pies",
  "cobblers",
  "cookies",
  "gelato",
  "sorbet",
  "crepe",
  "crepes",
  "boba",
  "cheesecake",
  "chocolate",
  "cacao",
  "truffles",
  "brownies",
  "froyo",
  "candy",
  "sweets",
  "fudge",
  "bagel",
  "bagels",
  "donut",
  "donuts",
  "doughnut",
  "doughnuts"
]);
const FUZZY_VOCAB_PHRASES = [
  "gluten free",
  "gluten-free",
  "pad thai",
  "pad see ew",
  "pad kee mao",
  "pad kra pao",
  "tom yum",
  "tom kha",
  "green curry",
  "red curry",
  "khao soi",
  "massaman curry",
  "banh mi",
  "bun cha",
  "bun bo hue",
  "com tam",
  "spring rolls",
  "spring roll",
  "dim sum",
  "peking duck",
  "dan dan",
  "char siu",
  "chow mein",
  "lo mein",
  "fried rice",
  "kung pao",
  "steamed buns",
  "siu mai",
  "har gow",
  "hong kong",
  "soup dumplings",
  "soup dumpling",
  "xiao long bao",
  "xiaolong bao",
  "korean bbq",
  "korean fried chicken",
  "kimchi stew",
  "kare kare",
  "halo halo",
  "butter chicken",
  "murgh makhani",
  "tikka masala",
  "palak paneer",
  "chana masala",
  "rogan josh",
  "garlic naan",
  "pani puri",
  "golgappa",
  "bhel puri",
  "vada pav",
  "pav bhaji",
  "aloo gobi",
  "mango lassi",
  "masala chai",
  "masala dosa",
  "gulab jamun",
  "leche flan",
  "bicol express",
  "crispy pata",
  "lechon kawali",
  "nasi goreng",
  "baba ganoush",
  "sticky rice",
  "thai tea",
  "thai iced tea",
  "mango sticky rice",
  "papaya salad",
  "drunken noodles",
  "som tam",
  "cacio e pepe",
  "french onion",
  "french onion soup",
  "coq au vin",
  "beef bourguignon",
  "boeuf bourguignon",
  "foie gras",
  "pao de queijo",
  "jollof rice",
  "brazilian bbq",
  "brazilian steak",
  "fish and chips",
  "shepherds pie",
  "bangers and mash",
  "full english",
  "english breakfast",
  "meat pie",
  "mince pie",
  "yorkshire pudding",
  "fried chicken",
  "pulled pork",
  "chicken wings",
  "buffalo wings",
  "clam chowder",
  "lobster roll",
  "po boy",
  "poor boy",
  "poboy",
  "shrimp and grits",
  "biscuits and gravy",
  "chicken and waffles",
  "philly cheesesteak",
  "club sandwich",
  "grilled cheese",
  "hot dog",
  "corn dog",
  "onion rings",
  "french fries",
  "chicken tenders",
  "chicken strips",
  "chicken nuggets",
  "chicken parm",
  "chicken parmesan",
  "chicken parmigiana",
  "chicken pot pie",
  "buffalo chicken",
  "mac and cheese",
  "mac n cheese",
  "poke bowl",
  "rice bowl",
  "grain bowl",
  "eggs benedict",
  "avocado toast",
  "acai bowl",
  "french toast",
  "breakfast burrito",
  "frozen yogurt",
  "shaved ice",
  "sno cone",
  "creme brulee",
  "fast food",
  "finger food",
  "comfort food",
  "home cooking",
  "all you can eat",
  "soul food",
  "tres leches",
  "agua fresca",
  "aguas frescas",
  "orange chicken",
  "general tso",
  "tapas bar",
  "food hall",
  "food court",
  "food market",
  "wine bar",
  "sports bar",
  "cocktail bar",
  "sushi bar",
  "juice bar",
  "noodle bar"
];
let _phrasesByLen = null;
function phrasesByTokenCount() {
  if (_phrasesByLen) return _phrasesByLen;
  const m = /* @__PURE__ */ new Map();
  for (const p of FUZZY_VOCAB_PHRASES) {
    const n = p.split(/\s+/).length;
    if (!m.has(n)) m.set(n, []);
    m.get(n).push(p);
  }
  _phrasesByLen = m;
  return m;
}
const FUZZY_VOCAB_PHRASES_SET = new Set(FUZZY_VOCAB_PHRASES);
function fuzzyMatchSingle(token) {
  if (FUZZY_VOCAB_SINGLE.has(token)) return token;
  let maxDist;
  if (token.length <= 3) return null;
  else if (token.length <= 5) maxDist = 1;
  else maxDist = 2;
  let best = null;
  let tied = false;
  for (const vocab of FUZZY_VOCAB_SINGLE) {
    if (Math.abs(vocab.length - token.length) > maxDist) continue;
    const d = levenshtein(token, vocab, maxDist);
    if (d > maxDist) continue;
    if (!best || d < best.dist) {
      best = { word: vocab, dist: d };
      tied = false;
    } else if (d === best.dist && vocab !== best.word) tied = true;
  }
  return best && !tied ? best.word : null;
}
function fuzzyMatchPhrase(phrase) {
  if (FUZZY_VOCAB_PHRASES_SET.has(phrase)) return phrase;
  const tokenCount = phrase.split(/\s+/).length;
  const candidates = phrasesByTokenCount().get(tokenCount);
  if (!candidates) return null;
  const maxDist = 2;
  let best = null;
  let tied = false;
  for (const vocab of candidates) {
    if (Math.abs(vocab.length - phrase.length) > maxDist) continue;
    const d = levenshtein(phrase, vocab, maxDist);
    if (d > maxDist) continue;
    if (!best || d < best.dist) {
      best = { word: vocab, dist: d };
      tied = false;
    } else if (d === best.dist && vocab !== best.word) tied = true;
  }
  return best && !tied ? best.word : null;
}
function fuzzyNormalizeQuery(query) {
  const trimmed = query?.trim();
  if (!trimmed) return query;
  const tokens = trimmed.toLowerCase().split(/\s+/);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    if (i + 1 < tokens.length) {
      const pair = `${tokens[i]} ${tokens[i + 1]}`;
      const phraseHit = fuzzyMatchPhrase(pair);
      if (phraseHit) {
        out.push(phraseHit);
        i += 2;
        continue;
      }
    }
    const tok = tokens[i];
    if (/^[a-z]+$/.test(tok)) {
      out.push(fuzzyMatchSingle(tok) ?? tok);
    } else {
      out.push(tok);
    }
    i += 1;
  }
  return out.join(" ");
}
function detectDietaryModifier(query, dishLabel) {
  const q = (query || "").toLowerCase();
  if (dishLabel) {
    const dl = dishLabel.toLowerCase();
    if (["halal", "kosher", "vegan", "vegetarian", "gluten free"].includes(dl)) return null;
  }
  if (/\bhalal\b/.test(q)) return "halal";
  if (/\bkosher\b/.test(q)) return "kosher";
  if (/\bvegan\b/.test(q)) return "vegan";
  if (/\bvegetarian\b/.test(q)) return "vegetarian";
  if (/\bgluten[\s-]?free\b/.test(q)) return "glutenFree";
  return null;
}
const QUERY_STOPWORDS = /* @__PURE__ */ new Set([
  "the",
  "and",
  "with",
  "for",
  "restaurant",
  "food",
  "place",
  "near",
  "me",
  "best",
  "top",
  "good",
  "great",
  "open",
  "now",
  "close",
  "closest",
  "find",
  "show",
  "any",
  "some",
  "this",
  "that",
  "place",
  "places",
  "have",
  "has",
  "want",
  "need",
  "around",
  "here"
]);
function hasUnrecognizedDishWords(searchQuery, intent) {
  if (intent?.kind !== "DISH") return false;
  const queryWords = new Set(
    searchQuery.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\w]/g, "")).filter((w) => w.length >= 3 && !QUERY_STOPWORDS.has(w))
  );
  if (queryWords.size <= 1) return false;
  const recognized = /* @__PURE__ */ new Set([
    ...intent.rawWords || [],
    ...(intent.nameKeywords || []).flatMap((k) => k.toLowerCase().split(/\s+/))
  ]);
  for (const w of queryWords) {
    if (!recognized.has(w)) return true;
  }
  return false;
}
function parseSearchIntent(query) {
  if (!query?.trim()) return { kind: "GENERAL" };
  const direct = parseSearchIntentInner(query.toLowerCase());
  if (direct.kind !== "GENERAL") return direct;
  const fuzzed = fuzzyNormalizeQuery(query);
  if (fuzzed && fuzzed !== query.toLowerCase()) {
    return parseSearchIntentInner(fuzzed);
  }
  return { kind: "GENERAL" };
}
function parseSearchIntentInner(q) {
  if (/\basian\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "asian", ...CULTURAL_INTENTS.asian };
  if (/\blatin\b|\blatino\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "latin", ...CULTURAL_INTENTS.latin };
  if (/\bmediterranean\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "mediterranean", ...CULTURAL_INTENTS.mediterranean };
  if (/\beuropean\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "european", ...CULTURAL_INTENTS.european };
  if (/\btrattoria\b|\bosteria\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "italian", label: "Trattoria", types: /* @__PURE__ */ new Set(["italian_restaurant"]), keywords: ["trattoria", "osteria", "pasta", "pizza", "antipasto"] };
  if (/\bbistro(t)?\b|\bbrasserie\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "french", label: "Bistro", types: /* @__PURE__ */ new Set(["french_restaurant"]), keywords: ["bistro", "brasserie", "croissant", "crepe"] };
  if (/\btaberna\b|\btapas\s*bar\b|\bbodega\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "spanish", label: "Taberna", types: /* @__PURE__ */ new Set(["spanish_restaurant", "tapas_bar"]), keywords: ["tapas", "pintxos", "jamon", "wine", "vermut"] };
  if (/\bizakaya\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "japanese", label: "Izakaya", types: /* @__PURE__ */ new Set(["japanese_restaurant", "bar"]), keywords: ["sake", "yakitori", "small plates", "japanese pub"] };
  if (/\bcantina\b|\btaqueria\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "mexican", label: "Cantina", types: /* @__PURE__ */ new Set(["mexican_restaurant"]), keywords: ["tacos", "tequila", "margarita", "tortas"] };
  if (/\bfood\s*hall\b|\bfood\s*market\b|\bmercato\b|\bmercado\b|\bfood\s*court\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "market", label: "Food Market", types: /* @__PURE__ */ new Set(["food_court"]), keywords: ["market", "hall", "stall", "street food"] };
  if (/\bitalian\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "italian", label: "Italian", types: /* @__PURE__ */ new Set(["italian_restaurant"]), keywords: ["pasta", "pizza", "risotto", "lasagna"] };
  if (/\bmexican\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "mexican", label: "Mexican", types: /* @__PURE__ */ new Set(["mexican_restaurant"]), keywords: ["taco", "burrito", "enchilada", "quesadilla"] };
  if (/\bchinese\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "chinese", label: "Chinese", types: /* @__PURE__ */ new Set(["chinese_restaurant"]), keywords: ["dim sum", "noodle", "dumpling", "chow mein"] };
  if (/\bjapanese\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "japanese", label: "Japanese", types: /* @__PURE__ */ new Set(["japanese_restaurant"]), keywords: ["sushi", "ramen", "tempura", "udon"] };
  if (/\bkorean\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "korean", label: "Korean", types: /* @__PURE__ */ new Set(["korean_restaurant"]), keywords: ["bibimbap", "kimchi", "bulgogi", "korean bbq"] };
  if (/\bthai\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "thai", label: "Thai", types: /* @__PURE__ */ new Set(["thai_restaurant"]), keywords: ["pad thai", "tom yum", "green curry"] };
  if (/\bvietnamese\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "vietnamese", label: "Vietnamese", types: /* @__PURE__ */ new Set(["vietnamese_restaurant"]), keywords: ["pho", "banh mi", "spring roll"] };
  if (/\bfilipino\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "filipino", label: "Filipino", types: /* @__PURE__ */ new Set(["filipino_restaurant"]), keywords: ["adobo", "sinigang", "lumpia", "sisig"] };
  if (/\bindian\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "indian", label: "Indian", types: /* @__PURE__ */ new Set(["indian_restaurant"]), keywords: ["curry", "biryani", "naan", "tikka masala"] };
  if (/\bfrench\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "french", label: "French", types: /* @__PURE__ */ new Set(["french_restaurant"]), keywords: ["croissant", "baguette", "crepe"] };
  if (/\bgreek\b/.test(q)) return { kind: "UMBRELLA", cultureKey: "greek", label: "Greek", types: /* @__PURE__ */ new Set(["greek_restaurant"]), keywords: ["gyro", "souvlaki", "tzatziki"] };
  for (const entry of DISH_MAP) {
    const m = q.match(entry.pattern);
    if (m) {
      const matched = (m[0] || "").toLowerCase();
      const rawWords = Array.from(new Set(matched.split(/\s+/).filter((w) => w.length >= 3)));
      let mealTime = entry.mealTime;
      if (/\bbreakfast\b/.test(q)) mealTime = "breakfast";
      else if (/\bbrunch\b/.test(q)) mealTime = "brunch";
      else if (/\blunch\b/.test(q)) mealTime = "lunch";
      else if (/\bdinner\b|\bsupper\b/.test(q)) mealTime = "dinner";
      return { kind: "DISH", label: entry.label, tier1Types: entry.tier1, tier2Types: entry.tier2, rawWords, nameKeywords: entry.nameKeywords || [], mealTime, strict: entry.strict, strictPrimaryTypes: entry.strictPrimaryTypes };
    }
  }
  return { kind: "GENERAL" };
}
// Known restaurant chains — used ONLY to (a) stop a chain's brand name from
// earning a top "specialist" tier just because it appears in a dish's
// nameKeywords, and (b) demote chains BELOW independents within the same tier
// when ranking. Nothing is ever excluded by this list (not a blacklist) — chains
// still appear, just below authentic/specialist places. Lowercase substrings.
const KNOWN_CHAINS = [
  // pizza
  "domino", "pizza hut", "papa john", "little caesars", "sbarro", "california pizza kitchen", "blaze pizza", "mod pizza", "papa murphy", "round table pizza", "marco's pizza", "jet's pizza",
  // italian / pasta
  "olive garden", "buca di beppo", "maggiano", "old spaghetti factory", "spaghetti factory", "fazoli", "carrabba", "macaroni grill", "noodles & company", "noodles and company",
  // fried chicken / wings
  "kfc", "popeyes", "chick-fil-a", "chick fil a", "raising cane", "zaxby", "bojangles", "church's chicken", "churchs chicken", "jollibee", "pollo campero", "el pollo loco", "wingstop", "buffalo wild wings",
  // burgers
  "mcdonald", "burger king", "wendy's", "five guys", "in-n-out", "in n out", "shake shack", "whataburger", "carl's jr", "carls jr", "hardee", "jack in the box", "sonic drive", "white castle", "culver", "smashburger", "the habit", "fatburger", "checkers",
  // mexican
  "chipotle", "qdoba", "taco bell", "del taco", "moe's southwest", "rubio", "baja fresh",
  // asian
  "panda express", "p.f. chang", "pf chang", "pei wei",
  // sandwich / deli
  "subway", "jimmy john", "jersey mike", "firehouse subs", "potbelly", "quiznos", "arby", "panera",
  // coffee / donuts / dessert
  "starbucks", "dunkin", "krispy kreme", "peet's coffee", "dutch bros", "tim hortons", "baskin-robbins", "baskin robbins", "cold stone", "dairy queen",
  // casual dining
  "applebee", "chili's", "tgi friday", "denny's", "ihop", "cracker barrel", "red lobster", "outback", "texas roadhouse", "cheesecake factory", "red robin", "ruby tuesday", "golden corral", "bj's restaurant",
];
const isKnownChain = (name) => {
  const n = (name || "").toLowerCase();
  return KNOWN_CHAINS.some((c) => n.includes(c));
};

function getTierForPlace(place, intent) {
  if (intent.kind === "GENERAL") return 1;
  const types = new Set([...place.types || [], place.primaryType || ""].map((t) => t.toLowerCase()));
  const name = (place.displayName?.text || place.name || "").toLowerCase();
  const reviewText = (place.reviews || []).map((r) => r.text?.text || r.text || "").join(" ").toLowerCase();
  if (intent.kind === "UMBRELLA") {
    if ([...types].some((t) => intent.types.has(t))) return 1;
    if (intent.keywords.some((kw) => name.includes(kw) || reviewText.includes(kw))) return 2;
    return 4;
  }
  if (intent.kind === "DISH") {
    const dishWords = Array.from(new Set([
      intent.label.toLowerCase(),
      ...intent.rawWords || [],
      ...intent.nameKeywords || []
    ].filter(Boolean)));
    const strictDishWords = Array.from(new Set([
      intent.label.toLowerCase(),
      ...intent.nameKeywords || []
    ].filter(Boolean)));
    const isBreakfasty = intent.mealTime === "breakfast" || intent.mealTime === "brunch";
    const hasBreakfastPlausibleType = !isBreakfasty || (BREAKFAST_PLAUSIBLE_TYPES.has(place.primaryType || "") || [...types].some((t) => BREAKFAST_PLAUSIBLE_TYPES.has(t)));
    // Tier 1 = genuine dish specialist (dish word in the name). A KNOWN chain
    // does NOT earn Tier 1 just because its brand is in nameKeywords — it falls
    // through to type-based tiers (so Olive Garden → "Authentic Match" via
    // italian_restaurant, not "Dish Specialist"), then gets demoted in the sort.
    if (!isKnownChain(name) && dishWords.some((w) => name.includes(w))) return 1;
    const isStrict = intent.strict === true && Array.isArray(intent.strictPrimaryTypes) && intent.strictPrimaryTypes.length > 0;
    if (isStrict) {
      const primary = (place.primaryType || "").toString();
      if (!intent.strictPrimaryTypes.includes(primary)) {
        return 5;
      }
    }
    if (isBreakfasty) {
      const inChainList = KNOWN_BREAKFAST_CHAINS.some((c) => name.includes(c));
      if (!inChainList) {
        const primary = place.primaryType || "";
        const isFastFood = primary === "fast_food_restaurant" || types.has("fast_food_restaurant");
        const isCoffeeShop = primary === "coffee_shop" || types.has("coffee_shop");
        if (isFastFood || isCoffeeShop) return 5;
      }
    }
    if (intent.tier1Types.some((t) => types.has(t)) && hasBreakfastPlausibleType) return 2;
    if (intent.tier2Types.some((t) => types.has(t)) && hasBreakfastPlausibleType) return 3;
    if (isStrict) return 5;
    const editorial = (place.editorialSummary?.text || place.editorialSummary || "").toString().toLowerCase();
    if (hasBreakfastPlausibleType && editorial && strictDishWords.some((w) => editorial.includes(w))) return 4;
    if (isBreakfasty) {
      if (types.has("bakery") || place.primaryType === "bakery") return 4;
      if (KNOWN_BREAKFAST_CHAINS.some((c) => name.includes(c))) return 4;
    }
    if (intent.mealTime === "lunch" && place.servesLunch === true) return 4;
    if (intent.mealTime === "dinner" && place.servesDinner === true) return 4;
    if (hasBreakfastPlausibleType && strictDishWords.some((w) => reviewText.includes(w))) return 4;
    const menuDishes = place.menuDishes || [];
    if (hasBreakfastPlausibleType && menuDishes.length && strictDishWords.some((w) => menuDishes.some((md) => md.includes(w)))) return 4;
    const aiSummary = (place.generativeSummary?.overview?.text || "").toString().toLowerCase();
    if (hasBreakfastPlausibleType && aiSummary && strictDishWords.some((w) => aiSummary.includes(w))) return 4;
    const contextualReviewText = (place.contextualContents?.reviews || []).map((r) => (r?.text?.text || r?.text || "").toString()).join(" ").toLowerCase();
    if (hasBreakfastPlausibleType && contextualReviewText && strictDishWords.some((w) => contextualReviewText.includes(w))) return 4;
    return 5;
  }
  return 1;
}
const TIER_LABELS = {
  1: "Dish Specialist",
  // dish word in the place name AND not a known chain → the most expected match
  2: "Authentic Match",
  // place type matches the dish's primary cuisine type (e.g. italian_restaurant)
  3: "Related",
  // place type matches a secondary/cultural cuisine
  4: "Serves It"
  // editorialSummary / cached reviews / menu OCR mention the dish
  // 5 = noise (not in TIER_LABELS by design — filtered out before reaching the frontend)
};
const CUISINE_QUERIES = {
  // 'all': reduced from 8 to 3 queries (saves 5 API calls per page load)
  // nearby types already cover fast food, bakery, takeout — no need to duplicate via text
  all: ["restaurant", "best restaurant near me", "popular restaurant"],
  american: ["american restaurant", "burger restaurant", "diner"],
  mexican: ["mexican restaurant", "taqueria", "tacos"],
  italian: ["italian restaurant", "pasta restaurant", "trattoria"],
  chinese: ["chinese restaurant", "dim sum"],
  japanese: ["japanese restaurant", "ramen"],
  sushi: ["sushi restaurant", "sushi bar"],
  thai: ["thai restaurant"],
  indian: ["indian restaurant", "curry restaurant"],
  korean: ["korean restaurant", "korean bbq"],
  vietnamese: ["vietnamese restaurant", "pho"],
  mediterranean: ["mediterranean restaurant", "greek restaurant"],
  seafood: ["seafood restaurant", "fish restaurant"],
  steakhouse: ["steakhouse", "steak restaurant"],
  pizza: ["pizza restaurant", "pizzeria"],
  breakfast: ["breakfast restaurant", "brunch restaurant"],
  fast_food: ["fast food", "quick service restaurant"],
  vegetarian: ["vegetarian restaurant", "vegan restaurant", "plant based restaurant"],
  vegan: ["vegan restaurant", "plant based restaurant"],
  halal: ["halal restaurant", "halal food", "halal meat"],
  kosher: ["kosher restaurant", "kosher food", "kosher deli"],
  dessert: ["dessert shop", "ice cream", "bakery"],
  // reduced from 6 to 3 (nearby types cover pastry_shop/dessert_shop already)
  bakery: ["bakery", "pastry shop", "donut shop"],
  // Sports bar: 2 text queries max (more causes network timeouts at 25mi).
  // Query 1 "sports bar" — finds explicitly self-labeled sports bars (Rocco's Tavern,
  //   Barney's Beanery, 33 Taps — anything with "sports bar" in Google name/description/reviews).
  // Query 2 "bar" — broad bar text-scan so British/local pubs like Lucky Baldwin's, T. Boyle's
  //   Tavern, and Yard House (tagged 'bar' not 'sports_bar') enter the candidate pool for scoring.
  //   sportsScore sorting ensures actual sports bars float to top over generic bars.
  sports_bar: ["sports bar", "bar"],
  filipino: ["filipino restaurant", "pinoy restaurant"],
  // Trending: broad queries — Worker uses rankPreference:RELEVANCE; frontend sorts by rating×reviews
  trending: ["best restaurant", "most popular restaurant"],
  local: ["local favorite restaurant", "neighborhood restaurant"],
  // Hidden Gems: specific language Google understands for underrated spots
  // Client-side badge threshold: rating ≥4.5, reviews 50–500 (under the radar but proven)
  hidden: ["hidden gem restaurant", "underrated local restaurant", "best kept secret restaurant"],
  fine: ["fine dining", "upscale restaurant"],
  budget: ["cheap eats", "budget friendly restaurant"],
  latenight: ["late night food", "24 hour restaurant", "open late restaurant"]
};
async function handleRestaurantsFull(request, env, ctx) {
  console.log("\n\u{1F37D}\uFE0F === getRestaurants v5.0 START ===\n");
  try {
    const origin = new URL(request.url).origin;
    let hasStrongDietaryMatch = function(place, cuisine2) {
      const types = [...place.types || [], place.primaryType || ""].filter(Boolean).map((t) => t.toLowerCase());
      const text = [
        place.name || "",
        ...(place.reviews || []).map((r) => r.text || "")
      ].join(" ").toLowerCase();
      if (cuisine2 === "halal")
        return types.includes("halal_restaurant") || /\bhalal\b/.test(text) || /\bzabiha\b/.test(text);
      if (cuisine2 === "kosher")
        return types.includes("kosher_restaurant") || /\bkosher\b/.test(text) || /\bhechsher\b|\bmashgiach\b|\bglatt\b|\bparve\b|\bshomer\s*shabbat\b/.test(text) || /\b(?:ou|star-k|kof-k|crc|orb)[\s-]?(?:kosher|certified|approved)\b/.test(text);
      if (cuisine2 === "vegan")
        return types.includes("vegan_restaurant") || /\bvegan\b/.test(text) || /\bplant[\s-]?based\b/.test(text);
      if (cuisine2 === "vegetarian")
        return place.servesVegetarianFood === true || types.includes("vegetarian_restaurant") || /\bvegetarian\b/.test(text);
      if (cuisine2 === "glutenFree")
        return /\bgluten[\s-]?free\b/.test(text) || /\bceliac\b|\bcoeliac\b/.test(text) || /\bgf\s*(?:menu|bakery|bread|pizza|pasta|options?|friendly)\b/.test(text) || /\bdedicated\s+gluten[\s-]?free\b/.test(text) || /\bwheat[\s-]?free\b/.test(text) || /\bgfco\b|\bgluten[\s-]?free\s+certified\b/.test(text);
      return true;
    }, dietaryScore = function(place, cuisine2) {
      const types = [...place.types || [], place.primaryType || ""].filter(Boolean).map((t) => t.toLowerCase());
      const text = [
        place.name || "",
        ...(place.reviews || []).map((r) => r.text || "")
      ].join(" ").toLowerCase();
      let score = 0;
      if (cuisine2 === "halal") {
        if (types.includes("halal_restaurant")) score += 100;
        if (/\bhalal\b/.test(text)) score += 20;
        if (/\bzabiha\b|\bhmc\b/.test(text)) score += 10;
      }
      if (cuisine2 === "kosher") {
        if (types.includes("kosher_restaurant")) score += 100;
        if (/\bkosher\b/.test(text)) score += 20;
        if (/\bhechsher\b|\bmashgiach\b|\bglatt\b|\bparve\b|\bshomer\s*shabbat\b/.test(text)) score += 10;
        if (/\b(?:ou|star-k|kof-k|crc|orb)[\s-]?(?:kosher|certified|approved)\b/.test(text)) score += 10;
      }
      if (cuisine2 === "vegan") {
        if (types.includes("vegan_restaurant")) score += 100;
        if (/\bvegan\b/.test(text)) score += 20;
        if (/\bplant[\s-]?based\b/.test(text)) score += 10;
      }
      score += (place.rating || 0) * 5;
      score += Math.min(place.userRatingCount || 0, 500) / 25;
      score -= place.distanceKm || 0;
      return score;
    };
    const body = await request.json().catch(() => ({}));
    const {
      latitude,
      longitude,
      radius = 16093,
      // PlacesToEat sends radius * 1609 (meters)
      maxResults = 40,
      cuisine = "all",
      searchQuery = "",
      forceRefresh = false,
      // v5.0: server-side filter params (passed from PlacesToEat filters)
      filterOpenNow = false,
      filterMinRating = 0,
      filterMaxPrice = 0,
      // 0=any, 1=$, 2=$$, 3=$$$, 4=$$$$
      // v5.2: user's active dietary chip. Passed alongside searchQuery so we
      // can still filter+tag results even when the dietary shortcut is skipped
      // (which happens whenever searchQuery is non-empty).
      activeDietary = null,
      // v5.3: full UI filter state for the Semantic Text Compiler. All chip
      // state is translated into one natural-language query Google AI can
      // match on, instead of being stripped client-side after the fetch.
      filterDriveThru = false,
      filterOutdoor = false,
      filterIndoor = false,
      filterParking = false,
      filterBakery = false,
      filterBars = false,
      filterVibes = {},
      // { family, liveMusic, groups, sportsBar, outdoor }
      filterDietary = {}
      // { vegetarian, vegan, halal, kosher, glutenFree }
    } = body;
    const PRICE_LEVEL_NAMES = [
      "PRICE_LEVEL_FREE",
      "PRICE_LEVEL_INEXPENSIVE",
      "PRICE_LEVEL_MODERATE",
      "PRICE_LEVEL_EXPENSIVE",
      "PRICE_LEVEL_VERY_EXPENSIVE"
    ];
    let priceLevels = filterMaxPrice > 0 ? PRICE_LEVEL_NAMES.slice(0, filterMaxPrice + 1) : [];
    if (cuisine === "fine") {
      priceLevels = ["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"];
    } else if (cuisine === "budget") {
      priceLevels = ["PRICE_LEVEL_INEXPENSIVE"];
    }
    if (!latitude || !longitude) {
      return grResp({ error: "Latitude and longitude required", places: [] }, { status: 400 });
    }
    const radiusMiles = Math.round(radius / 1609.34);
    console.log("\u{1F4CB} Request:", { latitude, longitude, radius, radiusMiles: radiusMiles.toFixed(1), cuisine, searchQuery, forceRefresh });
    let intent = parseSearchIntent(searchQuery);
    if (intent.kind === "GENERAL" && cuisine && cuisine !== "all") {
      const chipUmbrella = CUISINE_CHIP_TO_UMBRELLA[cuisine];
      if (chipUmbrella) {
        intent = {
          kind: "UMBRELLA",
          cultureKey: cuisine,
          label: chipUmbrella.label,
          types: chipUmbrella.types,
          keywords: chipUmbrella.keywords
        };
        console.log(`\u{1F9E0} Intent synthesized from cuisine chip: ${cuisine} -> UMBRELLA(${chipUmbrella.label})`);
      }
    }
    if (!!searchQuery?.trim() && (intent.kind === "GENERAL" || hasUnrecognizedDishWords(searchQuery, intent))) {
      try {
        const llmRes = await rxDispatch(env, ctx, origin, `/parse-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery })
        });
        if (llmRes.ok) {
          const llmIntent = await llmRes.json();
          if (llmIntent.confidence >= 0.5 && Array.isArray(llmIntent.tier1Types) && llmIntent.tier1Types.length > 0 && llmIntent.dishLabel) {
            console.log(`\u{1F916} LLM fallback hit: "${searchQuery}" -> dish=${llmIntent.dishLabel} cuisine=${llmIntent.cuisine} strict=${llmIntent.strict} conf=${llmIntent.confidence} cache=${llmIntent._cache}`);
            intent = {
              kind: "DISH",
              label: llmIntent.dishLabel,
              tier1Types: llmIntent.tier1Types,
              tier2Types: Array.isArray(llmIntent.tier2Types) ? llmIntent.tier2Types : [],
              rawWords: searchQuery.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\w]/g, "")).filter((w) => w.length >= 3),
              nameKeywords: Array.isArray(llmIntent.nameKeywords) ? llmIntent.nameKeywords : [],
              mealTime: llmIntent.mealTime,
              strict: llmIntent.strict === true,
              strictPrimaryTypes: Array.isArray(llmIntent.strictPrimaryTypes) ? llmIntent.strictPrimaryTypes : []
            };
          } else {
            console.log(`\u{1F916} LLM fallback ignored (conf=${llmIntent.confidence}): "${searchQuery}"`);
          }
        }
      } catch (e) {
        console.warn(`\u{1F916} LLM fallback failed (non-fatal):`, e.message);
      }
    }
    console.log(`\u{1F9E0} Intent: ${intent.kind}${intent.kind !== "GENERAL" ? ` (${intent.label})` : ""}`);
    const DIETARY_TYPES = ["halal", "kosher", "vegan", "vegetarian", "glutenFree"];
    const dietaryShortcutKey = DIETARY_TYPES.includes(cuisine) ? cuisine : activeDietary && DIETARY_TYPES.includes(activeDietary) ? activeDietary : null;
    if (!searchQuery?.trim() && dietaryShortcutKey) {
      console.log(`\u{1F957} Dietary shortcut: calling /places/dietary?dietary=${dietaryShortcutKey}`);
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          radius: String(radius),
          maxResults: String(maxResults),
          dietary: dietaryShortcutKey
        });
        const res = await rxDispatch(env, ctx, origin, `/places/dietary?${params}`);
        if (res.ok) {
          const data = await res.json();
          const places = data.places || [];
          console.log(`\u2705 /places/dietary returned ${places.length} places`);
          if (places.length > 0) {
            const tagged = places.map((p) => ({ ...p, dietary: { ...p.dietary || {}, [dietaryShortcutKey]: true } }));
            return grResp({ places: tagged, count: tagged.length, version: "v4.3", dietary: dietaryShortcutKey });
          }
          console.warn(`\u26A0\uFE0F /places/dietary returned 0 \u2014 falling back to text search`);
        }
      } catch (e) {
        console.error(`/places/dietary error: ${e.message} \u2014 falling back`);
      }
    }
    const rawQuery = searchQuery?.trim() || "";
    const baseTypes = [];
    const features = [];
    const cuisineReadable = {
      fast_food: "fast food",
      fine: "fine dining",
      latenight: "late night",
      glutenFree: "gluten-free",
      sports_bar: "sports bar",
      dessert: "desserts"
    };
    const skipCuisineInSemantic = cuisine === "all" || cuisine === "sports_bar" || cuisine === "bakery";
    if (!skipCuisineInSemantic) {
      const friendly = cuisineReadable[cuisine] ?? cuisine.replace(/_/g, " ");
      const needsVenue = !/(shop|dining|bar|restaurant|desserts?)/i.test(friendly);
      baseTypes.push(needsVenue ? `${friendly} restaurant` : friendly);
    }
    if (filterBakery) baseTypes.push("bakeries and pastries");
    if (filterBars) baseTypes.push("bars pubs");
    if (filterVibes.sportsBar) baseTypes.push("sports bar");
    const DIETARY_READABLE = {
      vegan: "vegan",
      vegetarian: "vegetarian",
      halal: "halal",
      kosher: "kosher",
      glutenFree: "gluten-free"
    };
    const activeDietaryKeys = Object.keys(filterDietary || {}).filter((k) => filterDietary[k]);
    activeDietaryKeys.forEach((k) => {
      const adj = DIETARY_READABLE[k];
      if (adj) baseTypes.unshift(adj);
    });
    if (filterDriveThru) features.push("drive-thru");
    if (filterOutdoor) features.push("outdoor seating");
    if (filterIndoor) features.push("indoor seating");
    if (filterParking) features.push("parking");
    const vibes = filterVibes || {};
    if (vibes.family) features.push("family friendly");
    if (vibes.liveMusic) features.push("live music");
    if (vibes.groups) features.push("good for groups");
    const wantsRooftop = /\brooftop\b/i.test(rawQuery);
    const wantsFarmToTable = /\bfarm[\s-]*to[\s-]*table\b/i.test(rawQuery);
    const wantsHiddenGem = /\bhidden\s*gem(s)?\b/i.test(rawQuery);
    if (wantsRooftop) features.push("with view");
    if (wantsFarmToTable) features.push("locally sourced");
    let semanticQuery = rawQuery;
    let dishHasItQuery = null;
    const isRawFoodNoun = !baseTypes.length && semanticQuery && !/restaurant|food|near me|cafe|bar|bakery|shop|grill|diner|bistro|place/i.test(semanticQuery);
    if (isRawFoodNoun && intent.kind === "DISH" && intent.tier1Types?.length > 0) {
      const tier1Type = intent.tier1Types[0];
      const expertType = tier1Type.replace(/_/g, " ");
      semanticQuery = `${semanticQuery} ${expertType}`;
      const SKIP_DUAL = /* @__PURE__ */ new Set(["pizza_restaurant", "sushi_restaurant", "ramen_restaurant", "bakery"]);
      if (!SKIP_DUAL.has(tier1Type)) {
        dishHasItQuery = rawQuery.replace(/\bbest\b/i, "").trim();
      }
    }
    if (baseTypes.length) {
      semanticQuery = semanticQuery ? `${baseTypes.join(" ")} ${semanticQuery}` : baseTypes.join(" ");
    }
    if (!semanticQuery.trim()) semanticQuery = "restaurant";
    if (features.length) {
      semanticQuery = `${semanticQuery} with ${features.join(" and ")}`;
    }
    {
      const seen = /* @__PURE__ */ new Set();
      semanticQuery = semanticQuery.split(/\s+/).filter((w) => {
        const lw = w.toLowerCase();
        if (seen.has(lw)) return false;
        seen.add(lw);
        return true;
      }).join(" ");
    }
    if (dishHasItQuery !== null) {
      if (baseTypes.length) {
        dishHasItQuery = dishHasItQuery ? `${baseTypes.join(" ")} ${dishHasItQuery}` : baseTypes.join(" ");
      }
      if (!dishHasItQuery.trim()) dishHasItQuery = "restaurant";
      if (features.length) {
        dishHasItQuery = `${dishHasItQuery} with ${features.join(" and ")}`;
      }
      const seen = /* @__PURE__ */ new Set();
      dishHasItQuery = dishHasItQuery.split(/\s+/).filter((w) => {
        const lw = w.toLowerCase();
        if (seen.has(lw)) return false;
        seen.add(lw);
        return true;
      }).join(" ");
      if (dishHasItQuery === semanticQuery) dishHasItQuery = null;
    }
    const anyFilterActive = baseTypes.length > 0 || features.length > 0 || !!rawQuery;
    const queries = anyFilterActive ? dishHasItQuery ? [semanticQuery, dishHasItQuery] : [semanticQuery] : CUISINE_QUERIES[cuisine] || CUISINE_QUERIES.all;
    console.log(`\u{1F9E9} Semantic query: "${semanticQuery}"${dishHasItQuery ? ` | + Has-It: "${dishHasItQuery}"` : ""} | anyFilterActive: ${anyFilterActive}`);
    const allPlaces = [];
    const seenPlaceIds = /* @__PURE__ */ new Set();
    const errors = [];
    const NEARBY_TYPES_ALL = [
      "restaurant",
      // general: local, ethnic, sit-down
      "fast_food_restaurant",
      // chains: Subway, Taco Bell, KFC, Panda Express, McDonald's, IHOP
      "meal_takeaway"
      // takeout-only spots often missed by other types
    ];
    const NEARBY_TYPES_CUISINE = {
      chinese: ["chinese_restaurant"],
      japanese: ["japanese_restaurant", "ramen_restaurant"],
      sushi: ["sushi_restaurant"],
      korean: ["korean_restaurant"],
      thai: ["thai_restaurant"],
      vietnamese: ["vietnamese_restaurant"],
      indian: ["indian_restaurant"],
      mexican: ["mexican_restaurant"],
      american: ["american_restaurant", "hamburger_restaurant"],
      // 'pizza_restaurant' INTENTIONALLY excluded from Italian nearby fan-out.
      // Pizza chains (Domino's, Papa Johns, Little Caesars, Pizza Hut, Sbarro)
      // were drowning the Italian chip's results in stuff that's pizza-only,
      // not authentically Italian. They still appear under the Pizza chip
      // (which has its own pizza_restaurant nearby fan-out below).
      italian: ["italian_restaurant"],
      pizza: ["pizza_restaurant"],
      seafood: ["seafood_restaurant"],
      mediterranean: ["mediterranean_restaurant", "greek_restaurant"],
      fast_food: ["fast_food_restaurant", "hamburger_restaurant", "sandwich_shop"],
      breakfast: ["breakfast_restaurant", "brunch_restaurant"],
      dessert: ["ice_cream_shop", "dessert_shop", "bakery", "donut_shop"],
      filipino: ["filipino_restaurant"],
      // Bakery: removed 'cafe' — it flooded results with Starbucks that stole the 40-item slots,
      // then got filtered out by the frontend bakery filter, leaving 0 results.
      bakery: ["bakery", "pastry_shop", "dessert_shop"],
      sports_bar: ["sports_bar", "bar"]
      // nearby fetch; text search queries above do the heavy lifting
    };
    const hasAdvancedFilters = filterBakery || filterBars || filterDriveThru || filterOutdoor || filterIndoor || filterParking || Object.values(filterVibes || {}).some((v) => v) || Object.keys(filterDietary || {}).length > 0;
    const isDishSearch = intent.kind === "DISH";
    const skipNearby = hasAdvancedFilters || !!searchQuery?.trim() && !isDishSearch;
    const DISH_BROAD_TYPES = ["restaurant", "fast_food_restaurant", "meal_takeaway", "bakery"];
    const dishSpecialistTypes = isDishSearch ? [...intent.tier1Types || [], ...intent.tier2Types || []] : [];
    const isBreakfastyDish = isDishSearch && (intent.mealTime === "breakfast" || intent.mealTime === "brunch");
    const breakfastyBakeryTypes = isBreakfastyDish && !intent.strict ? ["bakery", "pastry_shop", "donut_shop", "bagel_shop"] : [];
    const dishNearbyTypes = isDishSearch ? Array.from(/* @__PURE__ */ new Set([...dishSpecialistTypes, ...DISH_BROAD_TYPES, ...breakfastyBakeryTypes])) : [];
    const TYPED_BAKERY_PATTERN = /\b(?:bakery|bakeries|pastr(?:y|ies)|patisserie|boulangerie|donuts?|doughnuts?|bagels?)\b/i;
    const typedBakeryActive = !!searchQuery?.trim() && TYPED_BAKERY_PATTERN.test(searchQuery);
    const qLower = (searchQuery || "").toLowerCase();
    const typedSpecificBakeryType = typedBakeryActive ? /\b(?:donuts?|doughnuts?)\b/.test(qLower) ? "donut_shop" : /\bbagels?\b/.test(qLower) ? "bagel_shop" : null : null;
    const bakeryNearbyTypes = filterBakery ? ["bakery", "pastry_shop", "dessert_shop", "donut_shop", "bagel_shop"] : typedBakeryActive ? typedSpecificBakeryType ? [typedSpecificBakeryType] : ["bakery", "pastry_shop", "dessert_shop", "donut_shop", "bagel_shop"] : [];
    const barsNearbyTypes = filterBars ? ["bar", "pub"] : [];
    const sportsBarVibeActive = !!filterVibes?.sportsBar;
    const sportsBarNearbyTypes = sportsBarVibeActive ? ["sports_bar", "bar"] : [];
    const venueChipTypes = Array.from(/* @__PURE__ */ new Set([
      ...bakeryNearbyTypes,
      ...barsNearbyTypes,
      ...sportsBarNearbyTypes
    ]));
    const nearbyTypeList = skipNearby ? venueChipTypes : isDishSearch ? Array.from(/* @__PURE__ */ new Set([...dishNearbyTypes, ...venueChipTypes])) : cuisine === "all" ? Array.from(/* @__PURE__ */ new Set([...NEARBY_TYPES_ALL, ...venueChipTypes])) : Array.from(/* @__PURE__ */ new Set([...NEARBY_TYPES_CUISINE[cuisine] || ["restaurant"], ...venueChipTypes]));
    const BAKERY_TYPES_SET = /* @__PURE__ */ new Set(["bakery", "pastry_shop", "dessert_shop", "donut_shop", "bagel_shop"]);
    const SPORTS_TYPES_SET = /* @__PURE__ */ new Set(["sports_bar", "bar"]);
    const BAKERY_RANK_BY = radiusMiles > 5 ? "POPULARITY" : "DISTANCE";
    const SPORTS_BAR_ACTIVE = sportsBarVibeActive || cuisine === "sports_bar";
    const rankByForType = (type) => {
      if (filterBakery && BAKERY_TYPES_SET.has(type)) return BAKERY_RANK_BY;
      if (SPORTS_BAR_ACTIVE && SPORTS_TYPES_SET.has(type)) return "POPULARITY";
      return "DISTANCE";
    };
    const nearbyPromise = Promise.allSettled(
      nearbyTypeList.map(async (type) => {
        try {
          const params = new URLSearchParams({
            type,
            latitude: String(latitude),
            longitude: String(longitude),
            radius: String(Math.min(radius, 5e4)),
            maxResults: "20",
            rankBy: rankByForType(type),
            // v5.0: pass server-side filters to nearby search too
            ...filterOpenNow ? { openNow: "true" } : {},
            ...filterMinRating > 0 ? { minRating: String(filterMinRating) } : {},
            ...priceLevels.length ? { priceLevels: priceLevels.join(",") } : {}
          });
          const res = await rxDispatch(env, ctx, origin, `/places/nearby?${params}`);
          if (!res.ok) return;
          const data = await res.json();
          const places = data.places || [];
          console.log(`\u{1F5FA}\uFE0F nearby type=${type}: ${places.length} places`);
          for (const place of places) {
            const pid = place.id || place.placeId;
            if (pid && !seenPlaceIds.has(pid) && isActuallyARestaurant(place)) {
              seenPlaceIds.add(pid);
              allPlaces.push(place);
            }
          }
        } catch (e) {
          console.warn(`nearby type=${type} error (non-fatal):`, e.message);
        }
      })
    );
    const cuisineTypeList = NEARBY_TYPES_CUISINE[cuisine];
    const cuisineIncludedType = !rawQuery && !hasAdvancedFilters && cuisine !== "all" && cuisineTypeList?.length === 1 ? cuisineTypeList[0] : "";
    const isStrictBreakfasty = isDishSearch && intent.strict && (intent.mealTime === "breakfast" || intent.mealTime === "brunch");
    const mealTimeIncludedType = isStrictBreakfasty ? intent.mealTime === "breakfast" ? "breakfast_restaurant" : "brunch_restaurant" : "";
    const serverIncludedType = cuisineIncludedType || mealTimeIncludedType;
    const runQueryPass = async (passRadiusMiles) => {
      const passRadiusMeters = Math.round(passRadiusMiles * 1609.34);
      for (const query of queries) {
        try {
          console.log(`\u{1F4E1} POST /  query: "${query}" radiusMiles: ${passRadiusMiles.toFixed(1)}${serverIncludedType ? ` includedType: ${serverIncludedType}` : ""}`);
          const response = await rxDispatch(env, ctx, origin, `/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude,
              longitude,
              query,
              radiusMiles: passRadiusMiles,
              dietary: {},
              // v5.0: server-side filters — Google filters at source, not client-side
              openNow: filterOpenNow || false,
              minRating: filterMinRating > 0 ? filterMinRating : 0,
              priceLevels: priceLevels.length ? priceLevels : [],
              // v5.4: honor caller's forceRefresh flag. Was temporarily hardcoded
              // to true to purge the poisoned 0-result KV cache — now that the
              // cache is healthy, revert to normal caching behavior so we stop
              // paying for duplicate Google calls on repeat searches.
              forceRefresh,
              // v5.1: pass includedType so Google narrows by type (italian_restaurant etc.)
              ...serverIncludedType ? { includedType: serverIncludedType } : {}
            })
          });
          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.error(`POST / HTTP ${response.status}: ${errText}`);
            errors.push(`"${query}": HTTP ${response.status}`);
            try {
              const params = new URLSearchParams({
                query,
                latitude: String(latitude),
                longitude: String(longitude),
                radius: String(passRadiusMeters),
                maxResults: "20",
                cacheTtl: String(60 * 60 * 2),
                // 2hr fallback TTL
                ...forceRefresh ? { forceRefresh: "true" } : {}
              });
              const fbRes = await rxDispatch(env, ctx, origin, `/places/text-search?${params}`);
              if (fbRes.ok) {
                const fbData = await fbRes.json();
                for (const place of fbData.places || []) {
                  const pid = place.id || place.placeId;
                  if (pid && !seenPlaceIds.has(pid) && isActuallyARestaurant(place)) {
                    seenPlaceIds.add(pid);
                    allPlaces.push(place);
                  }
                }
                console.log(`   Fallback got ${fbData.places?.length || 0}`);
              }
            } catch (_e) {
            }
            continue;
          }
          const data = await response.json();
          console.log(`   _cache:${data._cache || "none"} total:${data.totalFound || 0}`);
          if (data.error) errors.push(`"${query}": ${data.error}`);
          const places = data.restaurants || data.places || data.results || [];
          console.log(`   \u2705 ${places.length} places`);
          for (const place of places) {
            const pid = place.id || place.placeId;
            if (pid && !seenPlaceIds.has(pid) && isActuallyARestaurant(place)) {
              seenPlaceIds.add(pid);
              allPlaces.push(place);
            }
          }
        } catch (err) {
          console.error(`Error for "${query}":`, err.message);
          errors.push(`"${query}": ${err.message}`);
        }
      }
    };
    await runQueryPass(radiusMiles);
    await nearbyPromise;
    console.log(`\u{1F4CA} Total unique after all searches: ${allPlaces.length}`);
    if (errors.length) console.error("\u26A0\uFE0F Errors:", errors);
    let autoExpandedFrom = null;
    let effectiveRadiusMiles = radiusMiles;
    const SPARSE_THRESHOLD = 15;
    const MAX_EXPAND_RADIUS = 25;
    const intentful = intent.kind !== "GENERAL" || !!searchQuery?.trim() || cuisine !== "all";
    if (intentful && allPlaces.length < SPARSE_THRESHOLD && radiusMiles < MAX_EXPAND_RADIUS) {
      const expandedRadius = Math.min(radiusMiles + 10, MAX_EXPAND_RADIUS);
      console.log(`\u{1F52D} Auto-expanding radius: ${radiusMiles} \u2192 ${expandedRadius} mi (only ${allPlaces.length} raw results)`);
      autoExpandedFrom = radiusMiles;
      effectiveRadiusMiles = expandedRadius;
      await runQueryPass(expandedRadius);
      console.log(`\u{1F52D} After auto-expand: ${allPlaces.length} total`);
    }
    if (allPlaces.length === 0) {
      return grResp({
        places: [],
        count: 0,
        debug: {
          errors,
          hint: errors.length > 0 ? "Check Worker deployment + Google API key" : "API succeeded but 0 results \u2014 Worker may have empty cache for this area"
        },
        error: "No restaurants found. Try expanding your search radius."
      });
    }
    const foodPlaces = allPlaces.filter(isActuallyARestaurant);
    console.log(`\u{1F354} After restaurant filter: ${foodPlaces.length} (removed ${allPlaces.length - foodPlaces.length} non-food)`);
    const processedPlaces = foodPlaces.map((place) => {
      const lat = place.location?.latitude || place.lat || 0;
      const lng = place.location?.longitude || place.lng || 0;
      const dist = calcDistance(latitude, longitude, lat, lng);
      const weekdayDescriptions = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || place.hours || [];
      const photos = (place.photos || []).map((p) => p.url || p).filter(Boolean);
      const customerFavorites = place.customerFavorites || place.customer_favorites || [];
      const reviews = (place.reviews || []).map((r) => ({
        rating: r.rating || 0,
        text: r.text?.text || r.text || "",
        author: r.authorDisplayName || r.authorAttribution?.displayName || r.author || "Anonymous",
        time: r.relativePublishTimeDescription || r.relative_time_description || r.time || "",
        profilePhoto: r.authorAttribution?.photoUri || r.profilePhoto || null
      }));
      const hasDriveThru = place.hasDriveThru || false;
      const isTakeoutOnly = place.isTakeoutOnly || false;
      const isCashOnly = place.isCashOnly || false;
      const bestTimeNote = place.bestTimeNote || detectBestTime(reviews);
      const sportsScore = calcSportsScore(place);
      const sportsBadge = sportsLabel(sportsScore);
      return {
        id: place.id || place.placeId,
        placeId: place.id || place.placeId,
        displayName: place.displayName || { text: place.name || "" },
        name: place.displayName?.text || place.name || "",
        location: { latitude: lat, longitude: lng },
        latitude: lat,
        longitude: lng,
        formattedAddress: place.formattedAddress || "",
        shortFormattedAddress: place.shortFormattedAddress || "",
        distanceKm: dist,
        distanceMiles: dist * 0.621371,
        rating: place.rating || null,
        userRatingCount: place.userRatingCount || 0,
        priceLevel: place.priceLevel,
        currentOpeningHours: { openNow: place.isOpen, weekdayDescriptions },
        regularOpeningHours: { weekdayDescriptions },
        hours: weekdayDescriptions,
        isOpen: place.isOpen ?? null,
        photos,
        photoUrl: photos[0] || null,
        photoUrl2: photos[1] || null,
        types: place.types || [],
        primaryType: place.primaryType || null,
        nationalPhoneNumber: place.nationalPhoneNumber || "",
        internationalPhoneNumber: place.internationalPhoneNumber || "",
        websiteUri: place.websiteUri || null,
        googleMapsUri: place.googleMapsUri || null,
        serviceOptions: place.serviceOptions || {},
        dineIn: place.serviceOptions?.dineIn ?? place.dineIn ?? null,
        takeout: place.serviceOptions?.takeout ?? place.takeout ?? null,
        delivery: place.serviceOptions?.delivery ?? place.delivery ?? null,
        outdoorSeating: place.serviceOptions?.outdoorSeating ?? place.outdoorSeating ?? null,
        reservable: place.reservable ?? null,
        goodForChildren: place.goodForChildren ?? null,
        goodForGroups: place.goodForGroups ?? null,
        servesBeer: place.servesBeer ?? null,
        servesWine: place.servesWine ?? null,
        servesCocktails: place.servesCocktails ?? null,
        servesVegetarianFood: place.servesVegetarianFood ?? null,
        customerFavorites,
        reviews,
        hasDriveThru,
        isTakeoutOnly,
        isCashOnly,
        bestTimeNote,
        why: place.why || null,
        is_breakthrough: place.is_breakthrough || false,
        paymentOptions: place.paymentOptions || {},
        parkingOptions: place.parkingOptions || null,
        seatingSource: place.dineIn != null || place.outdoorSeating != null ? "api" : null,
        sportsScore,
        // 0–100 confidence score (ChatGPT + Gemini multi-signal algorithm)
        sportsBadge,
        // "Best Sports Bar" | "Sports-Friendly" | "Casual Watch Spot" | null
        // Intent-aware tiering (1=Authentic, 2=Good Match, 3=Has It, 4=Other)
        // Overrides any Worker-pass-through tier with our richer client-side logic
        tier: getTierForPlace(place, intent),
        tierLabel: TIER_LABELS[getTierForPlace(place, intent)] || "Match",
        isChain: isKnownChain(place.displayName?.text || place.name || "")
      };
    }).filter((p) => p.distanceMiles <= effectiveRadiusMiles + 1);
    const DIETARY_FILTER_TYPES = ["halal", "kosher", "vegan", "vegetarian", "glutenFree"];
    const DIETARY_INTENT_LABEL_TO_KEY = {
      "halal": "halal",
      "kosher": "kosher",
      "vegan": "vegan",
      "vegetarian": "vegetarian",
      "gluten free": "glutenFree"
    };
    const intentDietary = intent.kind === "DISH" ? DIETARY_INTENT_LABEL_TO_KEY[(intent.label || "").toLowerCase()] || null : null;
    const compoundDietary = detectDietaryModifier(
      searchQuery || "",
      intent.kind === "DISH" ? intent.label : null
    );
    const effectiveDietary = DIETARY_FILTER_TYPES.includes(cuisine) ? cuisine : activeDietary && DIETARY_FILTER_TYPES.includes(activeDietary) ? activeDietary : compoundDietary || intentDietary;
    let finalPlaces = processedPlaces;
    if (cuisine === "latenight") {
      finalPlaces = finalPlaces.filter((p) => {
        if (!p.hours || p.hours.length === 0) return false;
        return p.hours.some((dayStr) => {
          const text = dayStr.toLowerCase();
          if (text.includes("24 hours")) return true;
          const parts = text.split(/[-–to]/);
          const closingPart = parts.length > 1 ? parts[parts.length - 1] : text;
          return /(10|11):\d{2}\s*pm|(12|1|2|3|4|5):\d{2}\s*am/i.test(closingPart);
        });
      });
    }
    if (effectiveDietary) {
      finalPlaces = processedPlaces.filter((p) => hasStrongDietaryMatch(p, effectiveDietary));
      finalPlaces.sort((a, b) => dietaryScore(b, effectiveDietary) - dietaryScore(a, effectiveDietary));
      finalPlaces.forEach((p) => {
        if (hasStrongDietaryMatch(p, effectiveDietary)) {
          p.dietary = { ...p.dietary || {}, [effectiveDietary]: true };
        }
      });
    } else if (intent.kind !== "GENERAL" && searchQuery?.trim()) {
      // TIER-FIRST dish ranking: the most authentic/expected place leads
      // regardless of distance — so a farther authentic Italian outranks a closer
      // chain for "pasta". (Previously banded-by-distance, which surfaced close
      // chains/related spots ABOVE farther authentic ones — not what we want.)
      //   1) dish tier       → Dish Specialist → Authentic → Related → Serves It
      //   2) non-chain first → independents above chains within the same tier
      //   3) quality         → rating × log10(reviews) (hidden-gem de-weights mega)
      //   4) distance        → final tiebreak only
      finalPlaces.sort((a, b) => {
        if ((a.tier || 4) !== (b.tier || 4)) return (a.tier || 4) - (b.tier || 4);
        if (!!a.isChain !== !!b.isChain) return a.isChain ? 1 : -1;
        const qa0 = (a.rating || 0) * Math.log10(Math.max(a.userRatingCount || 1, 1));
        const qb0 = (b.rating || 0) * Math.log10(Math.max(b.userRatingCount || 1, 1));
        const qa = wantsHiddenGem && (a.userRatingCount || 0) > 5e3 ? qa0 * 0.5 : qa0;
        const qb = wantsHiddenGem && (b.userRatingCount || 0) > 5e3 ? qb0 * 0.5 : qb0;
        if (Math.abs(qb - qa) > 0.05) return qb - qa;
        return (a.distanceKm || 999) - (b.distanceKm || 999);
      });
    } else if (cuisine === "sports_bar" || sportsBarVibeActive) {
      finalPlaces.sort((a, b) => {
        const qa = (a.rating || 0) * Math.log10(Math.max(a.userRatingCount || 1, 1));
        const qb = (b.rating || 0) * Math.log10(Math.max(b.userRatingCount || 1, 1));
        return qb - qa;
      });
    } else {
      finalPlaces.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    if (intent.kind === "DISH") {
      const before = finalPlaces.length;
      finalPlaces = finalPlaces.filter((p) => (p.tier || 5) <= 4);
      const dropped = before - finalPlaces.length;
      if (dropped > 0) console.log(`\u{1F6AE} Dropped ${dropped} tier-5 noise places`);
    }
    let fallbackPlaces = [];
    let fallbackCuisine = null;
    let fallbackQueryLabel = null;
    if (finalPlaces.length === 0 && intent.kind === "DISH" && intent.strict) {
      const tier1 = (intent.tier1Types || [])[0] || "";
      const cuisineKey = tier1.replace(/_restaurant$/, "");
      const umbrella = CUISINE_CHIP_TO_UMBRELLA[cuisineKey];
      if (umbrella) {
        fallbackCuisine = umbrella.label;
        fallbackQueryLabel = intent.label || searchQuery;
        fallbackPlaces = processedPlaces.filter((p) => {
          const types = new Set([
            ...p.types || [],
            p.primaryType || ""
          ].map((t) => t.toLowerCase()));
          return [...types].some((t) => umbrella.types.has(t));
        }).map((p) => ({ ...p, fallback: true, fallbackCuisine: umbrella.label })).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
        console.log(`\u{1F504} Fallback fired for "${fallbackQueryLabel}" -> ${fallbackPlaces.length} ${fallbackCuisine} restaurants from existing pool`);
      }
    }
    const intentSorted = intent.kind !== "GENERAL" && !!searchQuery?.trim();
    finalPlaces.forEach((p, i) => {
      p.backendRank = i + 1;
    });
    fallbackPlaces.forEach((p, i) => {
      p.backendRank = i + 1;
    });
    if (intent.kind === "DISH") {
      const dishLabelLower = intent.label?.toString().toLowerCase() || "";
      const dishRawWords = intent.rawWords || [];
      const matchers = [dishLabelLower, ...dishRawWords].filter(Boolean);
      const EAGER_PLACES = 20;
      const PHOTOS_PER_PLACE = 5;
      const eagerTargets = finalPlaces.slice(0, EAGER_PLACES);
      await Promise.all(eagerTargets.map(async (place) => {
        try {
          const allPhotos = place.photos || [];
          const photosToLabel = allPhotos.slice(0, PHOTOS_PER_PLACE).filter((p) => p?.name || typeof p === "string");
          if (photosToLabel.length === 0) return;
          const labelReq = await rxDispatch(env, ctx, origin, `/label-photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              placeId: place.id || place.placeId,
              photos: photosToLabel.map((p) => ({ name: p?.name || p }))
            })
          });
          if (!labelReq.ok) return;
          const { labels, dishes } = await labelReq.json();
          if (Array.isArray(dishes) && dishes.length) {
            place.menuDishes = dishes;
            if ((place.tier === 5 || place.tier == null) && matchers.some((w) => dishes.some((md) => md.includes(w)))) {
              place.tier = 4;
              place.tierLabel = TIER_LABELS[4];
            }
          }
          if (labels && Object.keys(labels).length) {
            const isMatch = (photoName) => {
              const tag = (labels[photoName] || "").toString().toLowerCase();
              return matchers.some((w) => tag.includes(w));
            };
            const matchedFront = [];
            const rest = [];
            for (const ph of allPhotos) {
              const phName = ph?.name || ph;
              if (typeof phName === "string" && isMatch(phName)) matchedFront.push(ph);
              else rest.push(ph);
            }
            if (matchedFront.length) place.photos = [...matchedFront, ...rest];
          }
          place.photosLabeled = true;
        } catch (_e) {
        }
      }));
    }
    const tier1Count = finalPlaces.filter((p) => p.tier === 1).length;
    const tier2Count = finalPlaces.filter((p) => p.tier === 2).length;
    const allTier1 = processedPlaces.filter((p) => p.tier === 1).sort((a, b) => a.distanceKm - b.distanceKm);
    const fallbackInfo = {
      needed: intent.kind !== "GENERAL" && !!searchQuery?.trim() && tier1Count + tier2Count === 0,
      intentKind: intent.kind,
      intentLabel: intent.kind === "UMBRELLA" ? intent.label : intent.kind === "DISH" ? intent.label : null,
      tier1Count,
      tier2Count,
      nearestAuthenticName: allTier1[0]?.name || null,
      nearestAuthenticDistanceMiles: allTier1[0] ? +(allTier1[0].distanceKm * 0.621371).toFixed(1) : null
    };
    console.log(`\u2705 Returning ${finalPlaces.length} places | tier1:${tier1Count} tier2:${tier2Count} fallback:${fallbackInfo.needed}`);
    console.log("\u{1F37D}\uFE0F === getRestaurants v5.1 END ===\n");
    return grResp({
      places: finalPlaces,
      count: finalPlaces.length,
      version: "v5.2",
      intentSorted,
      fallbackInfo,
      // Auto-expand-on-sparse signal: lets the frontend display a small banner
      // ("Expanded to 20 mi — only 3 results within 10 mi") when results were
      // sparse and the backend widened the search.
      autoExpanded: autoExpandedFrom !== null,
      autoExpandedFrom,
      effectiveRadiusMiles,
      // ── Phase 1.5 "Also serves X" fallback section ────────────────────
      // Populated when strict DISH search returned 0 results AND we found
      // umbrella-cuisine restaurants in the existing pool. Frontend renders
      // these below a divider explaining no exact match was found.
      fallbackPlaces,
      fallbackCuisine,
      fallbackQueryLabel
    });
  } catch (error) {
    console.error("\u{1F4A5} ERROR:", error.message);
    return grResp({ error: error.message, places: [] }, { status: 200 });
  }
}
function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function detectBestTime(reviews) {
  if (!reviews?.length) return null;
  const text = reviews.map((r) => r.text || "").join(" ").toLowerCase();
  if (text.match(/\b(lunch|midday|noon)\b.*\b(quiet|empty|not crowded|easy|quick)\b/)) return "Lunchtime or early";
  if (text.match(/\b(weekday|monday|tuesday|wednesday|thursday)\b.*\b(better|quiet|less crowded|easier)\b/)) return "Weekday visit";
  if (text.match(/\b(weekend|saturday|sunday)\b.*\b(crowded|busy|wait|packed)\b/)) return "Go on weekdays \u2014 busy weekends";
  if (text.match(/\b(evening|dinner|night)\b.*\b(best|great|romantic|recommend)\b/)) return "Dinner time";
  if (text.match(/\b(early|open|first|11am|10am)\b.*\b(best|less|avoid|beat)\b/)) return "Early \u2014 beats the rush";
  return null;
}

// ── Weather (Open-Meteo, free, no API key) ──────────────────────────────────
// Replaces the old Base44 InvokeLLM weather, which 403s on the native app (no
// Base44 session). Returns a shape consumed by BOTH the Home weather chip
// (current.*) and the Weather page (current.* + 7-day forecast[] with hourly).
// 30-min KV cache keyed to ~1km coords; forceRefresh bypasses it.
const WX_WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};
function wxCondition(code) { return WX_WMO[code] || 'Clear sky'; }
function wxIcon(code) {
  if (code === 0 || code === 1) return '☀️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return code === 65 ? '🌧️' : '🌦️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return code === 82 ? '🌧️' : '🌦️';
  if (code >= 85 && code <= 86) return '❄️';
  if (code >= 95) return '⛈️';
  return '🌤️';
}
const wxCtoF = (c) => Math.round((Number(c) * 9) / 5 + 32);
const wxKmhToMph = (k) => Math.round(Number(k) * 0.621371);
function wxClock(iso) {
  // iso like "2026-06-17T05:42" (already local to the location). Format 12h.
  const t = String(iso).split('T')[1] || '';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${mStr || '00'} ${ampm}`;
}
function wxHourLabel(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh} ${ampm}`;
}

async function handleWeatherForecast(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const lat = parseFloat(body.latitude);
    const lng = parseFloat(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return jsonResponse({ error: 'latitude and longitude are required' }, 400);
    }
    const forceRefresh = body.forceRefresh === true;

    const cacheKey = `wx:v1:${roundCoordinate(lat, 2)}:${roundCoordinate(lng, 2)}`;
    const kv = env.GLOBESKIMMERS_KV;
    if (kv && !forceRefresh) {
      const hit = await kv.get(cacheKey, 'json').catch(() => null);
      if (hit) return jsonResponse(hit);
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&timezone=auto&forecast_days=7&temperature_unit=celsius&wind_speed_unit=kmh` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
      `&hourly=temperature_2m,weather_code,precipitation_probability`;

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const details = await res.text().catch(() => '');
      return jsonResponse({ error: `Weather API returned ${res.status}`, details }, 502);
    }
    const d = await res.json();

    const cur = d.current || {};
    const curCode = Number(cur.weather_code);
    const current = {
      temperature_celsius: Math.round(Number(cur.temperature_2m)),
      temperature_fahrenheit: wxCtoF(cur.temperature_2m),
      feels_like_celsius: Math.round(Number(cur.apparent_temperature)),
      feels_like_fahrenheit: wxCtoF(cur.apparent_temperature),
      condition: wxCondition(curCode),
      icon: wxIcon(curCode),
      humidity: Math.round(Number(cur.relative_humidity_2m)) || 0,
      wind_speed_kmh: Math.round(Number(cur.wind_speed_10m)) || 0,
      wind_speed_mph: wxKmhToMph(cur.wind_speed_10m || 0),
      uv_index: Math.round(Number(cur.uv_index)) || 0,
    };

    const daily = d.daily || {};
    const hourly = d.hourly || {};
    const numDays = Array.isArray(daily.time) ? daily.time.length : 0;
    const forecast = [];
    for (let i = 0; i < numDays; i++) {
      const code = Number(daily.weather_code[i]);
      const dateObj = new Date(`${daily.time[i]}T00:00:00`);
      const hours = [];
      const base = i * 24;
      if (Array.isArray(hourly.time)) {
        for (let h = 0; h < 24; h++) {
          const idx = base + h;
          if (idx >= hourly.time.length) break;
          const hc = Number(hourly.weather_code[idx]);
          hours.push({
            hour: h,
            time: wxHourLabel(h),
            temperature_celsius: Math.round(Number(hourly.temperature_2m[idx])),
            temperature_fahrenheit: wxCtoF(hourly.temperature_2m[idx]),
            condition: wxCondition(hc),
            icon: wxIcon(hc),
            precipitation_probability: Math.round(Number(hourly.precipitation_probability?.[idx])) || 0,
          });
        }
      }
      forecast.push({
        is_today: i === 0,
        day_of_week: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
        date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        high_celsius: Math.round(Number(daily.temperature_2m_max[i])),
        high_fahrenheit: wxCtoF(daily.temperature_2m_max[i]),
        low_celsius: Math.round(Number(daily.temperature_2m_min[i])),
        low_fahrenheit: wxCtoF(daily.temperature_2m_min[i]),
        condition: wxCondition(code),
        icon: wxIcon(code),
        precipitation_probability: Math.round(Number(daily.precipitation_probability_max?.[i])) || 0,
        wind_speed_kmh: Math.round(Number(daily.wind_speed_10m_max?.[i])) || 0,
        wind_speed_mph: wxKmhToMph(daily.wind_speed_10m_max?.[i] || 0),
        uv_index: Math.round(Number(daily.uv_index_max?.[i])) || 0,
        sunrise: wxClock(daily.sunrise?.[i]),
        sunset: wxClock(daily.sunset?.[i]),
        hourly: hours,
      });
    }

    const payload = { timezone: d.timezone || 'UTC', current, forecast };

    if (kv) {
      await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: 1800 }).catch(() => {});
    }
    return jsonResponse(payload);
  } catch (e) {
    return jsonResponse({ error: 'Internal server error', details: e.message }, 500);
  }
}

// Generic LLM proxy (Anthropic) — replaces Base44's InvokeLLM, which 403s on the
// native app. Accepts { prompt, response_json_schema? }. With a schema, Claude is
// instructed to return ONLY a JSON object and we parse + return it directly (the
// same shape Base44's InvokeLLM returned). Used by Basic Phrases translation.
async function handleInvokeLLM(request, env) {
  try {
    if (!env.ANTHROPIC_API_KEY) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt;
    if (!prompt || typeof prompt !== 'string') return jsonResponse({ error: 'prompt is required' }, 400);
    const schema = body.response_json_schema || null;
    const system = schema
      ? 'You return ONLY a single valid JSON object that conforms to this JSON schema. No markdown, no code fences, no commentary. Schema: ' + JSON.stringify(schema)
      : 'You are a helpful assistant.';

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!apiRes.ok) {
      const details = await apiRes.text().catch(() => '');
      return jsonResponse({ error: `Anthropic returned ${apiRes.status}`, details }, 502);
    }
    const data = await apiRes.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';
    if (!schema) return jsonResponse({ text });

    // Extract the JSON object from the response (strip fences / stray prose).
    let jsonStr = text.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) jsonStr = fence[1].trim();
    const first = jsonStr.indexOf('{');
    const last = jsonStr.lastIndexOf('}');
    if (first !== -1 && last !== -1) jsonStr = jsonStr.slice(first, last + 1);
    try {
      return jsonResponse(JSON.parse(jsonStr));
    } catch (e) {
      return jsonResponse({ error: 'Failed to parse LLM JSON', details: e.message }, 502);
    }
  } catch (e) {
    return jsonResponse({ error: 'Internal server error', details: e.message }, 500);
  }
}

// ─── Cultural Info (two-layer Country / City / Region guide) ─────────────────
// Generic cached-LLM endpoint for the Cultural Info page. The FRONTEND owns the
// section catalog (prompts, JSON schemas, per-section TTLs) and posts one bundle
// at a time: { cacheKey, ttlDays, prompt, response_json_schema, forceRefresh }.
// We cache each bundle in shared KV keyed by (section + geo) so one traveler's
// fetch serves every user, apply stale-while-revalidate, and stamp REAL
// last_verified_at / expires_at (server time of the fetch — never a model claim).
// Volatile bundles (city leadership 24h, travel advisory 1d, safety 30d) get
// short TTLs from the client; when stale, the UI shows "May have changed — tap
// to refresh" instead of presenting stale data as current. source_url is always
// null here — Haiku has no web grounding (see handleInvokeLLM); the only real
// links live in the client-side curated travel-advisory list.
const CULTURE_KEY_PREFIX = 'culture:v2:';
const CULTURE_FRESH_FLOOR_S = 60 * 60;            // 1h minimum fresh window
const CULTURE_FRESH_MAX_S = 400 * 24 * 60 * 60;   // ~400d ceiling (clamp client TTL)
const CULTURE_MAX_TOKENS = 8000;

function sanitizeCultureKey(raw) {
  return String(raw || '').toLowerCase().trim().replace(/[^a-z0-9:_|\-]+/g, '-').slice(0, 256);
}

// Calls Haiku with a JSON schema and returns the parsed object (or throws).
// Mirrors handleInvokeLLM's proven prompt + extraction so existing behavior is
// untouched.
async function cultureLLM(env, prompt, schema) {
  const system = schema
    ? 'You return ONLY a single valid JSON object that conforms to this JSON schema. No markdown, no code fences, no commentary. Schema: ' + JSON.stringify(schema)
    : 'You are a helpful assistant.';
  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: CULTURE_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!apiRes.ok) {
    const details = await apiRes.text().catch(() => '');
    throw new Error(`Anthropic ${apiRes.status}: ${details.slice(0, 200)}`);
  }
  const json = await apiRes.json();
  const text = (json.content && json.content[0] && json.content[0].text) || '';
  let jsonStr = text.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonStr = fence[1].trim();
  const first = jsonStr.indexOf('{');
  const last = jsonStr.lastIndexOf('}');
  if (first !== -1 && last !== -1) jsonStr = jsonStr.slice(first, last + 1);
  return JSON.parse(jsonStr);
}

function cultureMeta(timestamp, freshTtlS, stale, extra) {
  return {
    source_type: 'ai_estimate',
    source_url: null,
    last_verified_at: new Date(timestamp).toISOString(),
    expires_at: new Date(timestamp + freshTtlS * 1000).toISOString(),
    stale: !!stale,
    cache_age_seconds: Math.max(0, Math.round((Date.now() - timestamp) / 1000)),
    ...(extra || {}),
  };
}

async function handleCulture(request, env, ctx) {
  try {
    if (!env.ANTHROPIC_API_KEY) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt;
    const schema = body.response_json_schema || null;
    const rawKey = body.cacheKey;
    const ttlDays = Number(body.ttlDays);
    const forceRefresh = body.forceRefresh === true;
    if (!prompt || typeof prompt !== 'string') return jsonResponse({ error: 'prompt is required' }, 400);
    if (!rawKey || typeof rawKey !== 'string') return jsonResponse({ error: 'cacheKey is required' }, 400);
    if (!ttlDays || ttlDays <= 0) return jsonResponse({ error: 'ttlDays must be > 0' }, 400);

    const key = CULTURE_KEY_PREFIX + sanitizeCultureKey(rawKey);
    const freshTtlS = Math.min(CULTURE_FRESH_MAX_S, Math.max(CULTURE_FRESH_FLOOR_S, Math.round(ttlDays * 86400)));
    const swrTtlS = freshTtlS;                 // serve stale for up to one more fresh window
    const totalTtlS = freshTtlS + swrTtlS;      // KV entry lifetime

    const refresher = async () => {
      const fresh = await cultureLLM(env, prompt, schema);
      await setInCache(env, key, fresh, totalTtlS);
    };

    if (!forceRefresh) {
      const cached = await getFromCache(env, key);
      if (cached) {
        const ageS = cached.age / 1000;
        if (ageS < freshTtlS) {
          return jsonResponse({ data: cached.data, meta: cultureMeta(cached.timestamp, freshTtlS, false) });
        }
        if (ageS < totalTtlS) {
          // Stale-but-servable: return immediately, refresh in the background.
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(refresher().catch(e => console.error(`culture SWR refresh failed for ${key}:`, e)));
          }
          return jsonResponse({ data: cached.data, meta: cultureMeta(cached.timestamp, freshTtlS, true) });
        }
        // Beyond SWR window: fetch fresh, but fall back to stale data on failure.
        try {
          const fresh = await cultureLLM(env, prompt, schema);
          await setInCache(env, key, fresh, totalTtlS);
          return jsonResponse({ data: fresh, meta: cultureMeta(Date.now(), freshTtlS, false) });
        } catch (e) {
          return jsonResponse({ data: cached.data, meta: cultureMeta(cached.timestamp, freshTtlS, true, { refresh_failed: true }) });
        }
      }
    }

    // Miss (or forceRefresh): fetch fresh from Haiku.
    const fresh = await cultureLLM(env, prompt, schema);
    await setInCache(env, key, fresh, totalTtlS);
    return jsonResponse({ data: fresh, meta: cultureMeta(Date.now(), freshTtlS, false) });
  } catch (e) {
    return jsonResponse({ error: 'culture fetch failed', details: e.message }, 502);
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
      if (pathname === '/delete-account' && request.method === 'POST') return await handleDeleteAccount(request, env);
      if (pathname === '/admin-user-stats') return await handleAdminUserStats(request, env);
      if (pathname === '/analytics-query') return await handleAnalyticsQuery(request, env);
      if (pathname.startsWith('/places/details/')) return await handlePlaceDetails(request, env);
      if (pathname === '/places/photo') return await handlePhotoProxy(request, env);
      if (pathname === '/places/dietary') return await handleDietarySearch(request, env);
      if (pathname === '/cache/stats') return await handleCacheStats(request, env);
      if (pathname === '/places/restaurants' && request.method === 'POST') return await handleRestaurantSearch(request, env);
      if (pathname === '/places/coffee') return await handleCoffeeSearch(request, env);
      if (pathname === '/restroom-locations' && request.method === 'POST') return await handleRestroomSearch(request, env, ctx);
      if (pathname === '/coffee-shops' && request.method === 'POST') return await handleCoffeeShops(request, env, ctx);
      if (pathname === '/atm-locations' && request.method === 'POST') return await handleAtmLocations(request, env, ctx);
      if (pathname === '/shopping' && request.method === 'POST') return await handleShoppingPlaces(request, env, ctx);
      if (pathname === '/convenience-stores' && request.method === 'POST') return await handleConvenienceStores(request, env, ctx);
      if (pathname === '/exchange-rate' && request.method === 'POST') return await handleExchangeRate(request, env);
      if (pathname === '/weather-forecast' && request.method === 'POST') return await handleWeatherForecast(request, env);
      if (pathname === '/invoke-llm' && request.method === 'POST') return await handleInvokeLLM(request, env);
      if (pathname === '/culture' && request.method === 'POST') return await handleCulture(request, env, ctx);
      if (pathname === '/money-exchange' && request.method === 'POST') return await handleMoneyExchange(request, env, ctx);
      if (pathname === '/activities' && request.method === 'POST') return await handleActivities(request, env, ctx);
      if (pathname === '/restaurants-full' && request.method === 'POST') return await handleRestaurantsFull(request, env, ctx);
      if (pathname === '/scan-prices' && request.method === 'POST') return await handlePriceScan(request, env);
      if (pathname === '/describe-item' && request.method === 'POST') return await handleDescribeItem(request, env);
      if (pathname === '/analyze-price' && request.method === 'POST') return await handleAnalyzePrice(request, env);
      if (pathname === '/scan-text' && request.method === 'POST') return await handleScanText(request, env);
      if (pathname === '/label-photos' && request.method === 'POST') return await handleLabelPhotos(request, env);
      if (pathname === '/ai-details' && request.method === 'POST') return await handleAIDetails(request, env);
      if (pathname === '/attraction-ai-details' && request.method === 'POST') return await handleAttractionAIDetails(request, env);
      if (pathname === '/atm-ai-details' && request.method === 'POST') return await handleAtmAIDetails(request, env);
      if (pathname === '/cafe-work-profile' && request.method === 'POST') return await handleCafeWorkProfile(request, env);
      if (pathname === '/restroom-ai-details' && request.method === 'POST') return await handleRestroomAIDetails(request, env);
      if (pathname === '/reverse-geocode' && request.method === 'POST') return await handleReverseGeocode(request, env);
      if (pathname === '/search-location' && request.method === 'POST') return await handleSearchLocation(request, env);
      if (pathname === '/name-info' && request.method === 'POST') return await handleNameInfo(request, env);
      if (pathname === '/parse-intent' && request.method === 'POST') return await handleParseIntent(request, env);
      // ThingsToDo D1 attractions lookup. Fast path for the launch-city +
      // launch-country marquee + regional layer; replaces the prior
      // ~70-Places-call discovery sequence that dominated mobile cold-load
      // time. Returns empty when ATTRACTIONS_DB binding isn't attached, so
      // the Base44 backend's existing Places-based fallback takes over.
      // ctx is forwarded so the handler can ctx.waitUntil() a Phase B
      // background seed task when D1 returns sparse for this region.
      if (pathname === '/attractions/nearby' && request.method === 'POST') return await handleAttractionsNearby(request, env, ctx);
      if (pathname === '/home/rows' && request.method === 'POST') return await handleHomeRows(request, env, ctx);
      // Phase B manual / debug trigger. Same seed logic as the
      // ctx.waitUntil path above, just synchronous so the response
      // tells you whether the seed worked. Useful for hand-seeding
      // specific cities or running smoke tests against the discovery.
      if (pathname === '/attractions/seed-city' && request.method === 'POST') return await handleSeedCity(request, env);

      return jsonResponse({ error: 'Not found', path: pathname }, 404);
    } catch (error) {
      return jsonResponse({ error: error.message, stack: error.stack }, 500);
    }
  }
};
// CI test Mon May 11 06:28:51 PDT 2026
