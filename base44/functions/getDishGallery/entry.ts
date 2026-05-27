/**
 * ============================================================================
 * GLOBESKIMMERS - getDishGallery (Dish-first photo grid)
 * ============================================================================
 *
 * Powers: src/pages/DishSearchGallery.jsx
 *
 * Different from getRestaurants (PLACE-first listing). This one flattens
 * photos[] across many nearby places that serve the dish and returns a
 * single photo-keyed array. The frontend renders a grid of dish photos;
 * tapping a photo jumps to the underlying place.
 *
 * Strategy:
 *   1. Call Worker /places/text-search with the dish query + user location.
 *   2. For each place, take up to N photos (default 3) and emit
 *      one gallery item per photo.
 *   3. Sort items by (place rating × inverse photo index) so highest-rated
 *      places' lead photos surface first.
 *   4. Return a flat photos[] with placeId, placeName, photo URL, address,
 *      rating, and distance.
 *
 * No new Google API surface — same text-search call as PlacesToEat, just
 * presented differently on the frontend.
 * ============================================================================
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";

const WORKER_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

// Photos per place to fan out into the gallery. Higher = more visual variety
// but each thumbnail render costs one Google Photo redirect call. 3 keeps
// the per-search cost comparable to the existing PlacesToEat fan-out.
const PHOTOS_PER_PLACE = 3;

// Haversine distance in miles. Same formula used elsewhere in the app.
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

Deno.serve(async (req) => {
  console.log("\n📸 === DISH GALLERY ===\n");

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized", photos: [] }, { status: 401 });
    }

    const body = await req.json();
    const {
      query,
      latitude,
      longitude,
      radius = 10,         // miles — slightly wider than default to surface more places
      maxResults = 30,
    } = body;

    if (!query || !latitude || !longitude) {
      return Response.json(
        { error: "query, latitude, longitude are required", photos: [] },
        { status: 400 },
      );
    }

    // Convert radius miles → meters for the Worker.
    const radiusMeters = Math.round(Number(radius) * 1609.34);

    const params = new URLSearchParams({
      query: String(query),
      latitude: String(latitude),
      longitude: String(longitude),
      radius: String(radiusMeters),
      maxResults: String(maxResults),
      forceRefresh: "false",
    });

    const apiUrl = `${WORKER_URL}/places/text-search?${params.toString()}`;
    console.log("📡 Worker URL:", apiUrl);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Worker error:", response.status, errorText);
      return Response.json(
        { error: `Worker returned ${response.status}`, details: errorText, photos: [] },
        { status: 200 },
      );
    }

    const data = await response.json();
    const places = data?.places || data?.restaurants || [];
    console.log("✅ Got", places.length, "places");

    // Flatten photos across all places. Each gallery item carries enough
    // metadata for the frontend to render a tile and let the user tap
    // through to the place.
    const gallery: any[] = [];

    for (const p of places) {
      const photos: string[] = Array.isArray(p.photos) ? p.photos : [];
      if (photos.length === 0) continue;

      const placeLat = p.location?.latitude ?? p.lat;
      const placeLng = p.location?.longitude ?? p.lng;
      const dist = (placeLat != null && placeLng != null)
        ? distanceMiles(Number(latitude), Number(longitude), Number(placeLat), Number(placeLng))
        : null;

      const slice = photos.slice(0, PHOTOS_PER_PLACE);
      slice.forEach((photoUrl: string, idx: number) => {
        gallery.push({
          photoUrl,
          placeId: p.id || p.placeId,
          placeName: p.displayName?.text || p.name || "",
          address: p.formattedAddress || p.address || "",
          rating: p.rating ?? null,
          reviewCount: p.userRatingCount ?? p.reviewCount ?? null,
          distanceMiles: dist,
          photoIndex: idx,
        });
      });
    }

    // Sort: highest-rated places' lead photos first. Tie-break on review
    // count so a 4.5(2k) outranks a 4.5(50).
    gallery.sort((a, b) => {
      const ra = (a.rating ?? 0) * 10 - a.photoIndex;
      const rb = (b.rating ?? 0) * 10 - b.photoIndex;
      if (rb !== ra) return rb - ra;
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    });

    console.log("📸 Returning", gallery.length, "photo tiles");

    return Response.json({
      query,
      photos: gallery,
      placeCount: places.length,
      fromCache: data?.fromCache || false,
    });
  } catch (error: any) {
    console.error("❌ Error:", error?.message || error);
    return Response.json(
      { error: error?.message || String(error), photos: [] },
      { status: 200 },
    );
  }
});
