/**
 * ============================================================================
 * GLOBESKIMMERS - getCoffeeShops v5.2
 * ============================================================================
 *
 * FIXES vs v5.1:
 * - Query 2 changed from text search "cafe" → nearby type search for cafe,coffee_shop
 *   Nearby type search returns ALL matching businesses in radius (chains included)
 *   Text search was relevance-ranked and often skipped chains entirely
 * - Still 2 queries (within Deno CPU limit)
 * - Deduplication + forceRefresh retained
 *
 * ============================================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const API_BASE_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

Deno.serve(async (req) => {
  console.log("\n☕ === getCoffeeShops v5.2 START ===\n");

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', places: [] }, { status: 401 });

    const body = await req.json();
    const {
      latitude,
      longitude,
      radius = 16093,
      maxResults = 60,
      forceRefresh = false,
    } = body;

    if (!latitude || !longitude)
      return Response.json({ error: "Latitude and longitude required", places: [] }, { status: 400 });

    console.log("Request:", { latitude, longitude, radius, maxResults, forceRefresh });

    // ── 2 queries max to stay under Deno CPU limit ─────────────────────────
    // Query 1: text search — relevance-ranked (specialty, local favorites)
    // Query 2: nearby type search — returns ALL cafes/coffee_shops in radius (ensures chains appear)

    const allPlaces = [];
    const seenIds = new Set();
    const errors = [];

    const addPlaces = (places) => {
      for (const place of places) {
        const id = place.id || place.placeId;
        if (id && !seenIds.has(id)) { seenIds.add(id); allPlaces.push(place); }
      }
    };

    // Query 1: Text search for "coffee shop"
    try {
      const p1 = new URLSearchParams({
        query: 'coffee shop',
        latitude: String(latitude),
        longitude: String(longitude),
        radius: String(radius),
        maxResults: '20',
      });
      if (forceRefresh) p1.set('forceRefresh', 'true');

      console.log('Searching: "coffee shop" (text)');
      const r1 = await fetch(`${API_BASE_URL}/places/text-search?${p1}`);
      if (r1.ok) {
        const d1 = await r1.json();
        console.log(`  cached:${d1.cached||false} count:${d1.count||0}`);
        addPlaces(d1.places || []);
      } else {
        errors.push(`text-search: HTTP ${r1.status}`);
      }
    } catch (e) {
      console.error('Error text-search:', e.message);
      errors.push(`text-search: ${e.message}`);
    }

    // Query 2: Nearby type search for cafe + coffee_shop (catches chains Google text search may skip)
    try {
      const p2 = new URLSearchParams({
        types: 'cafe,coffee_shop',
        latitude: String(latitude),
        longitude: String(longitude),
        radius: String(radius),
        maxResults: '20',
      });
      if (forceRefresh) p2.set('forceRefresh', 'true');

      console.log('Searching: nearby cafe,coffee_shop (type)');
      const r2 = await fetch(`${API_BASE_URL}/places/nearby?${p2}`);
      if (r2.ok) {
        const d2 = await r2.json();
        console.log(`  cached:${d2.cached||false} count:${d2.count||0}`);
        addPlaces(d2.places || []);
      } else {
        errors.push(`nearby: HTTP ${r2.status}`);
      }
    } catch (e) {
      console.error('Error nearby:', e.message);
      errors.push(`nearby: ${e.message}`);
    }

    console.log(`Total unique: ${allPlaces.length}`);

    if (allPlaces.length === 0) {
      return Response.json({
        places: [], count: 0,
        debug: { errors },
        error: "No coffee shops found in this area.",
      });
    }

    // ── NORMALIZE ──────────────────────────────────────────────────────────
    const processedPlaces = allPlaces.slice(0, maxResults).map(place => {
      const lat = place.location?.latitude || 0;
      const lng = place.location?.longitude || 0;
      const dist = calculateDistance(latitude, longitude, lat, lng);
      const photos = (place.photos || []).map(p => p.url || p).filter(Boolean);
      const serviceOptions = place.serviceOptions || {};
      const seating = place.seating || null;
      // Worker v7.2 returns displayName object, not plain name
      const name = place.displayName?.text || place.name || '';
      const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
      const hours = place.currentOpeningHours?.weekdayDescriptions
        || place.regularOpeningHours?.weekdayDescriptions
        || place.hours || [];

      return {
        id: place.id, placeId: place.id,
        displayName: place.displayName || { text: name }, name,
        location: { latitude: lat, longitude: lng }, latitude: lat, longitude: lng,
        formattedAddress: place.formattedAddress || '',
        shortFormattedAddress: place.shortFormattedAddress || '',
        distanceKm: dist, distanceMiles: dist * 0.621371,
        distanceText: formatDistance(dist, 'miles'),
        rating: place.rating || null, userRatingCount: place.userRatingCount || 0,
        currentOpeningHours: { openNow: place.isOpen, weekdayDescriptions: hours },
        regularOpeningHours: { weekdayDescriptions: hours },
        hours, isOpen: place.isOpen ?? null,
        priceLevel: place.priceLevel,
        photos,
        types: place.types || [], primaryType: place.primaryType,
        nationalPhoneNumber: phone,
        internationalPhoneNumber: phone,
        websiteUri: place.websiteUri || '',
        googleMapsUri: place.googleMapsUri || '',
        serviceOptions,
        reviews: (place.reviews || []).map(r => ({
          rating: r.rating,
          text: r.text?.text || r.text || '',
          author: r.authorDisplayName || r.author || 'Anonymous',
          time: r.relativePublishTimeDescription || r.time || '',
          profilePhoto: r.authorAttribution?.photoUri || null,
        })),
        parking: convertParking(place.parking),
        seating,
        hasIndoorSeating: seating?.hasIndoorSeating ?? (serviceOptions.dineIn === true) ?? null,
        hasOutdoorSeating: seating?.hasOutdoorSeating ?? (serviceOptions.outdoorSeating === true) ?? null,
        outdoorSeating: serviceOptions.outdoorSeating,
        dineIn: serviceOptions.dineIn,
      };
    });

    processedPlaces.sort((a, b) => a.distanceKm - b.distanceKm);

    console.log(`Returning ${processedPlaces.length} shops`);
    console.log("☕ === getCoffeeShops v5.2 END ===\n");

    return Response.json({
      places: processedPlaces,
      count: processedPlaces.length,
      version: 'v5.2',
    });

  } catch (error) {
    console.error("FATAL:", error.message);
    return Response.json({ error: error.message, places: [] }, { status: 200 });
  }
});

// Convert Worker v7.2 parking format → page-compatible format with details[]
function convertParking(parking) {
  if (!parking) return null;
  if (!parking.hasParking) return null;
  const details = [];
  const t = parking.parkingTypes || {};
  if (t.freeParking)   details.push({ icon: '🆓', label: 'Free Parking',    free: true });
  if (t.paidParking)   details.push({ icon: '💳', label: 'Paid Parking',    free: false });
  if (t.streetParking) details.push({ icon: '🚗', label: 'Street Parking',  free: t.freeParking || null });
  if (t.valetParking)  details.push({ icon: '🎩', label: 'Valet',           free: false });
  if (t.garageParking) details.push({ icon: '🏢', label: 'Garage Parking',  free: t.freeParking || null });
  return {
    noParking: false,
    details,
    source: parking.source || 'api',
  };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km, unit) {
  if (unit === 'miles') {
    const mi = km * 0.621371;
    return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`;
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}