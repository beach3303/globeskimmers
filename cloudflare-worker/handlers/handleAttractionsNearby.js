// ─────────────────────────────────────────────────────────────────────
// Globeskimmers Worker — handleAttractionsNearby
// ─────────────────────────────────────────────────────────────────────
// New endpoint: POST /attractions/nearby
// Reads the static attractions D1 database (table `attractions`) and
// returns nearby marquee + regional icons in a single round-trip.
//
// This is the speed-critical path that turns ThingsToDo first-load on
// mobile from 30s -> ~500ms. Previously the page hit Google Places
// ~70 times sequentially to discover staple attractions; this handler
// returns hundreds of attractions in one indexed bounding-box query.
//
// PASTE INTO cloudflare-worker-v7.12.js:
// 1. Drop this whole function before the `export default { fetch }`
//    block at the bottom.
// 2. In the router's switch, add (anywhere alongside the other places/*
//    endpoints):
//      if (pathname === '/attractions/nearby' && request.method === 'POST')
//        return await handleAttractionsNearby(request, env);
// 3. In wrangler.toml, add a second D1 binding:
//      [[d1_databases]]
//      binding = "ATTRACTIONS_DB"
//      database_name = "globeskimmers-attractions"
//      database_id = "<from `wrangler d1 create globeskimmers-attractions`>"
// 4. Deploy: cd "<repo>" && wrangler deploy
//
// REQUEST BODY (JSON):
//   {
//     "latitude":  14.5995,
//     "longitude": 120.9842,
//     "radiusKm":  50,         // optional, default 80 (~50 mi)
//     "categories": ["museum","landmark","national_park"],  // optional
//     "limit":     40,         // optional, default 60
//     "marqueeOnly": false     // optional, default false
//   }
//
// RESPONSE (JSON):
//   {
//     "source": "d1",
//     "tookMs": 23,
//     "attractions": [
//       {
//         "id":"curated:eiffel-tower",
//         "name":"Eiffel Tower",
//         "category":"landmark",
//         "lat":48.8584,"lng":2.2945,
//         "city":"Paris","country":"France",
//         "description":"...",
//         "whyVisit":"...",
//         "typicalMinutes":180,
//         "photoUrl":null,
//         "rating":4.7,
//         "isMarquee":true,
//         "freeToVisit":false,
//         "distanceMiles":1.4
//       },
//       ...
//     ]
//   }
//
// FAILURE MODE:
// - No D1 binding present: returns 200 with attractions=[] so the
//   caller can fall back to Places-based discovery (graceful
//   degradation while the binding is being provisioned).
// - DB error: returns 200 with attractions=[] and `error: "..."` field
//   so the caller still degrades gracefully instead of breaking.
async function handleAttractionsNearby(request, env) {
  const startedAt = Date.now();

  // Tolerate missing binding so the Base44 backend can roll out a
  // call to this endpoint BEFORE D1 is provisioned (or in regions
  // where the binding isn't attached). Returns empty payload, not
  // an error, so the existing Places-based path takes over.
  if (!env.ATTRACTIONS_DB) {
    return jsonResponse({
      source: 'd1',
      attractions: [],
      tookMs: Date.now() - startedAt,
      note: 'ATTRACTIONS_DB binding not present — falling back to Places'
    });
  }

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const {
    latitude,
    longitude,
    radiusKm   = 80,
    categories = null,
    limit      = 60,
    marqueeOnly = false,
  } = body || {};

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return jsonResponse({ error: 'latitude and longitude required' }, 400);
  }

  // Bounding box. 1 degree of latitude ≈ 111 km; longitude width
  // shrinks toward the poles by cos(lat). The box is a CHEAP prefilter
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

  // Build the WHERE clause dynamically. Always include the bounding
  // box; conditionally include category filter and marquee filter.
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

  // Cap limit at a hard maximum so a misbehaving client can't request
  // 100K rows and exhaust the worker's CPU time.
  const safeLimit = Math.max(1, Math.min(Number(limit) || 60, 200));

  const sql = `
    SELECT id, name, category, lat, lng, city, country, description,
           why_visit, typical_minutes, photo_url, rating,
           is_marquee, free_to_visit
      FROM attractions
     WHERE ${wheres.join(' AND ')}
  ORDER BY is_marquee DESC, rating DESC NULLS LAST
     LIMIT ${safeLimit};
  `;

  let rows;
  try {
    const stmt = env.ATTRACTIONS_DB.prepare(sql).bind(...params);
    const result = await stmt.all();
    rows = result.results || [];
  } catch (err) {
    // Graceful degradation: log + return empty so the caller falls
    // back to Places. Worker logs make this visible during dev; we
    // don't want a D1 hiccup to take down ThingsToDo.
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
  // corners up to ~1.4x the radius). Then re-sort by the original
  // marquee-first + rating order; THIS sort is stable so distance
  // ties go to D1's row order which already favors marquee+rating.
  const within = enriched.filter((r) => r.distanceKm <= radiusKm);
  within.sort((a, b) => {
    if (a.isMarquee !== b.isMarquee) return a.isMarquee ? -1 : 1;
    const ra = a.rating ?? 0, rb = b.rating ?? 0;
    if (ra !== rb) return rb - ra;
    return a.distanceKm - b.distanceKm;
  });

  return jsonResponse({
    source: 'd1',
    tookMs: Date.now() - startedAt,
    attractions: within,
  });
}
