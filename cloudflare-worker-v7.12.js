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

const AI_DETAILS_PROMPT_VERSION = 'v6';  // v5 -> v6: expanded worthIt enum to 5 tiers (worth_the_stop / strong_nearby_pick / craving_match / know_before_you_go / better_if_convenient); gsVerdict can now be 1-2 sentences and fold in atmosphere-fit caveats

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
- goodFor: array of 3-6 short positive tags (each ≤4 words). Examples: ["families", "solo diners", "casual lunch", "dumpling lovers", "first-time Shanghainese food", "quick weekday meal"]. Tags should be navigational (who/what occasion fits), not generic ("good food").
- notIdealFor: array of 0-3 short ATMOSPHERE-FIT tags (≤5 words each). Frame as occasion/setting mismatch ONLY, never as quality complaint. OK examples: "large groups (small space)", "fancy date nights (casual setting)", "quiet conversation (lively room)", "late-night dining (early close)". NOT OK: "picky eaters", "anyone wanting good service", "tourists". If nothing applies, return [].
- practical: { payment, englishMenu, reservation, dietary } object with these factual fields (any can be null):
  - payment: short factual line about payment methods (e.g. "Cards + tap accepted; cash also OK", "Cash only — bring local currency", "Card-only, no cash"). NULL if reviews don't say.
  - englishMenu: short factual line about menu language + staff English (e.g. "Menu in English; staff speaks English", "English menu available; limited staff English", "Menu in local language only; photos help"). NULL if unclear.
  - reservation: short factual line (e.g. "Walk-in fine; weekend dinner gets busy", "Reservation recommended for dinner", "Reservations required — book ahead"). NULL if unclear.
  - dietary: short factual line covering vegetarian/vegan/gluten-free/halal/allergens IF mentioned (e.g. "Vegetarian options available; ask staff about gluten-free", "Limited vegetarian options", "Halal-certified"). NULL if no dietary info in reviews.
- headsUp: array of 0-3 SHORT factual planning items, NEUTRALLY framed (NOT complaints). Examples: "Cash only — bring local currency", "QR code ordering at the table", "Most popular at weekend dinner", "Limited street parking — try side streets", "Closed Mondays". NOT OK: "slow service", "long waits", "rude staff", or anything in the FORBIDDEN words list. Empty array [] if nothing planning-worthy.
- crowd: who eats here — short concrete labels preferred (e.g. "Mostly local diners; family crowd", "Food-focused regulars more than ambiance seekers"). Avoid vague phrasing.
- bestTime: recommended time + factual note on busy hours (e.g. "Weekday lunch is calmer; weekend dinner is the busiest stretch").
- vibe: 1 direct sentence describing atmosphere (casual, group-friendly, romantic, etc.). Avoid decorative language.
- value: price range + value framing in traveler-friendly terms (e.g. "Budget-friendly ($$); good for sharing", "Mid-range ($$$); fair value for the cuisine").
- goodToKnow: positive/neutral factual tips beyond what's already in practical/headsUp. NOT complaints.
- travelerNotes: practical tips for travelers (best dish to try first, ordering, language).
- whatYouSee: null (restaurant doesn't use this).
- aboutAndHistory: null (restaurant doesn't use this).`
    : isAttraction
      ? `- bestDish = null.
- alsoRecommended: TOP 3 must-see/must-do items at this attraction, as an array of { name, context } objects. name = the item (exhibit, view, ride, etc.), context = short reason (≤90 chars). Aim for 3 — fewer only if data is thin.
- photoWorthy: 1 short line naming a standout photo-worthy spot/exhibit/view at this attraction. Examples: "The cherry blossom canopy walkway at sunset — peak photo season early April", "The infinity-mirror room — most-photographed spot in the museum". NULL if no obvious photo-worthy feature is mentioned.
- awards: 1 short line listing UNESCO status, top-tourist-attraction rankings, Michelin Green Guide stars, or notable recognitions. Examples: "UNESCO World Heritage Site (1996)", "Michelin Green Guide 3-star", "TripAdvisor Travelers' Choice 2024". NULL if no recognitions are mentioned.
- worthIt: ONE of "worth_the_stop" | "strong_nearby_pick" | "craving_match" | "know_before_you_go" | "better_if_convenient". For famous landmarks / UNESCO sites default to "worth_the_stop"; for local parks default to "strong_nearby_pick". Use "know_before_you_go" if there's meaningful planning friction (timed entry, bag check restrictions, limited access). Use "craving_match" if niche-interest only (specific museum types, themed exhibits).
- goodFor: 3-6 short positive tags (e.g. "families with kids", "photographers", "history buffs", "rainy day", "first-time visitors").
- notIdealFor: 0-3 ATMOSPHERE-FIT tags (e.g. "limited mobility (lots of stairs)", "quick stops (needs 2+ hours)"). Parenthetical reason required. [] if none.
- practical: { payment, englishMenu, reservation, dietary } — for attractions, "payment" = ticket purchase methods, "englishMenu" = signage/audio guide language + staff English, "reservation" = timed entry / advance booking, "dietary" = null (not relevant for attractions).
- headsUp: 0-3 neutral planning facts (e.g. "Bag check at entrance", "No photography in main hall", "Timed-entry tickets sell out", "Closed Tuesdays").
- whatYouSee: 1-2 short sentences describing what is physically present at the attraction (the buildings, exhibits, sculptures, rides, displays, scenery). Be concrete: "Three immersive haunted houses, a sculpture garden, an IMAX dome, a rooftop observation deck with city views." NULL if reviews/data don't describe what's there.
- aboutAndHistory: 1-2 short sentences on the attraction's purpose / origin / brief history. Be factual and concise: "Built in 1872 as a Meiji-era symbol of modernization. Original wooden structure burned in the 1923 earthquake; current reconstruction completed 1957." NULL if data is silent.
- crowd: who visits (families, photographers, history fans, etc.).
- bestTime: recommended time + factual busy-hour note.
- vibe: atmosphere of the attraction.
- value: admission price + value framing (positive only).
- goodToKnow: positive/neutral factual tips (what to bring, photo spots, accessibility, language).
- travelerNotes: practical traveler tips to make the visit better.`
      : isRestroom
        ? `- bestDish = null. alsoRecommended = [].
- worthIt = null. goodFor = []. notIdealFor = []. practical = null. headsUp = [].
- crowd = null (typically not relevant).
- bestTime: best time to use it (less busy windows).
- vibe: cleanliness, comfort level (only describe positively or neutrally; if dirty, use gsStars=0 instead of writing it negatively).
- value: paid vs free (e.g. "Free to use" or "Small fee, around X").
- goodToKnow: presence of toilet paper, soap, hand dryer, squat vs sit toilet, accessibility, anything cool/unique.
- travelerNotes: practical tips (carry tissue, bring small change, etc.).`
        : isATM
          ? `- bestDish = null. alsoRecommended = [].
- worthIt = null. goodFor = []. notIdealFor = []. practical = null. headsUp = [].
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
  "goodFor": ["<short positive tag>", ...] (3-6 tags for food/coffee/attraction; [] otherwise),
  "notIdealFor": ["<short atmosphere-fit tag>", ...] (0-3 tags for food/coffee/attraction; [] otherwise),
  "practical": {
    "payment": "<short factual line about payment methods>" | null,
    "englishMenu": "<short factual line about menu language + staff English>" | null,
    "reservation": "<short factual line>" | null,
    "dietary": "<short factual line about veg/vegan/GF/halal options>" | null
  } | null (food/coffee/attraction only; null otherwise),
  "headsUp": ["<short neutral planning fact>", ...] (0-3 items; food/coffee/attraction; [] otherwise),
  "whatYouSee": "<short concrete description of physical features (attraction only)>" | null,
  "aboutAndHistory": "<short factual purpose / history (attraction only)>" | null,
  "crowd": "<one short sentence>" | null,
  "bestTime": "<recommended time + factual busy-window note>" | null,
  "vibe": "<one short sentence>" | null,
  "value": "<one short sentence with price range if known>" | null,
  "goodToKnow": ["<positive/neutral fact 1>", ...] (up to 3 strings, can be empty),
  "ageFit": null,
  "travelerNotes": "<practical tip>" | null,
  "gsStars": <integer per per-kind rules above>,
  "gsRedFlag": <boolean per per-kind rules above>,
  "gsVerdict": "<one short positive/neutral summary, NO negative wording>"
}

GOOD FOR / NOT IDEAL FOR RULES (CRITICAL):
- ${supportsAgeFit ? 'For this kind (restaurant/coffee/attraction), fill goodFor with 3-6 tags and notIdealFor with 0-3 tags.' : 'For this kind, return goodFor = [] and notIdealFor = [].'}
- goodFor tags must be navigational (who / what occasion fits). Examples: "families", "solo diners", "casual lunch", "date night", "kid-friendly", "dumpling lovers", "first-time Shanghainese food", "quick weekday meal", "long leisurely meals".
- notIdealFor tags must describe ATMOSPHERE / OCCASION mismatch, framed in parentheses. NEVER quality complaints. OK: "large groups (small space)", "fancy occasions (casual setting)", "quiet conversation (lively room)", "late-night dining (closes early)". FORBIDDEN: "picky eaters", "anyone wanting good service", "tourists", "people with taste buds".
- If notIdealFor would require a quality complaint, return [] instead of inventing one.

HEADS-UP RULES (CRITICAL):
- headsUp items are NEUTRAL planning facts, NOT complaints. Same FORBIDDEN word list applies.
- OK examples: "Cash only — bring local currency", "QR code ordering at the table", "Most popular at weekend dinner", "Limited street parking — try side streets", "Closed Mondays", "BYOB welcome", "Card surcharge applies".
- NOT OK: "slow service", "rude staff", "long waits", "overpriced", "inconsistent quality" — none of these can appear.
- If reviews only reveal complaint-type info with no neutral framing possible, return [].

If any other field has no positive content to draw from, set it to null/empty. Do NOT fabricate.

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
      goodFor: [],
      notIdealFor: [],
      practical: null,
      headsUp: [],
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
        // v5: bumped 1400 -> 1800 to make room for worthIt + goodFor +
        // notIdealFor + practical{4} + headsUp + structured alsoRecommended
        // ({name,context} per item). Most cards land ~1000-1300 tokens now.
        max_tokens: 1800,
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
    // ageFit is deprecated in v5 but we still normalize to null so any
    // legacy frontend code reading it gets a stable shape.
    aiDetails.ageFit = null;

    // v5 fields — worthIt / goodFor / notIdealFor / practical / headsUp.
    // These apply to restaurant / coffee / attraction only.
    const v5Allowed = (kind === 'restaurant' || kind === 'coffee' || kind === 'attraction');
    const sanitizeStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

    // worthIt: enum or null. v6 expanded to 5 tiers.
    const WORTH_ENUM = new Set([
      'worth_the_stop',
      'strong_nearby_pick',
      'craving_match',
      'know_before_you_go',
      'better_if_convenient',
    ]);
    if (!v5Allowed || !WORTH_ENUM.has(aiDetails.worthIt)) {
      aiDetails.worthIt = v5Allowed ? 'strong_nearby_pick' : null;
    }

    // goodFor / notIdealFor: arrays of short strings (cap at 6 / 3)
    const sanitizeTagArray = (arr, cap) => {
      if (!Array.isArray(arr)) return [];
      return arr
        .map(t => sanitizeStr(t))
        .filter(Boolean)
        .slice(0, cap);
    };
    aiDetails.goodFor = v5Allowed ? sanitizeTagArray(aiDetails.goodFor, 6) : [];
    aiDetails.notIdealFor = v5Allowed ? sanitizeTagArray(aiDetails.notIdealFor, 3) : [];

    // practical: object with 4 string|null fields
    if (!v5Allowed || !aiDetails.practical || typeof aiDetails.practical !== 'object') {
      aiDetails.practical = null;
    } else {
      const p = aiDetails.practical;
      const cleanedP = {
        payment: sanitizeStr(p.payment),
        englishMenu: sanitizeStr(p.englishMenu),
        reservation: sanitizeStr(p.reservation),
        dietary: sanitizeStr(p.dietary),
      };
      const anyPresent = Object.values(cleanedP).some(v => v !== null);
      aiDetails.practical = anyPresent ? cleanedP : null;
    }

    // headsUp: array of up to 3 short strings
    aiDetails.headsUp = v5Allowed ? sanitizeTagArray(aiDetails.headsUp, 3) : [];

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
      if (pathname === '/scan-text' && request.method === 'POST') return await handleScanText(request, env);
      if (pathname === '/label-photos' && request.method === 'POST') return await handleLabelPhotos(request, env);
      if (pathname === '/ai-details' && request.method === 'POST') return await handleAIDetails(request, env);
      if (pathname === '/name-info' && request.method === 'POST') return await handleNameInfo(request, env);
      if (pathname === '/parse-intent' && request.method === 'POST') return await handleParseIntent(request, env);

      return jsonResponse({ error: 'Not found', path: pathname }, 404);
    } catch (error) {
      return jsonResponse({ error: error.message, stack: error.stack }, 500);
    }
  }
};
// CI test Mon May 11 06:28:51 PDT 2026
