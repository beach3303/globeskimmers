/**
 * ============================================================================
 * GLOBESKIMMERS - getPlacesFromWorker (Universal Feature Finder)
 * ============================================================================
 *
 * Powers: ATM Finder, Convenience Stores, Restroom Finder,
 *         Coffee Shop Finder (via type), Things to Do
 *
 * FIX: Changed textQuery → query to match Worker v7.2 /places/text-search
 *      Worker reads ?query=  not  ?textQuery=
 *
 * ============================================================================
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";

const WORKER_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

Deno.serve(async (req) => {
  console.log("\n🔍 === PLACES FROM WORKER (Universal) v2.0 ===\n");

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized", places: [] }, { status: 401 });
    }

    const body = await req.json();
    const {
      latitude,
      longitude,
      types,
      textQuery,      // accepted from caller for backwards compat
      query,          // also accepted
      radius = 5000,
      maxResults = 20,
      forceRefresh = false
    } = body;

    if (!latitude || !longitude) {
      return Response.json({ error: "latitude and longitude are required", places: [] }, { status: 400 });
    }

    const searchText = query || textQuery; // accept either name
    const refresh = forceRefresh ? "true" : "false";

    let apiUrl;

    if (searchText) {
      // FIX: was "textQuery" — Worker v7.2 reads "query" param
      const params = new URLSearchParams({
        query: searchText,          // ← FIXED (was textQuery)
        latitude: String(latitude),
        longitude: String(longitude),
        radius: String(radius),
        maxResults: String(maxResults),
        forceRefresh: refresh
      });
      apiUrl = `${WORKER_URL}/places/text-search?${params.toString()}`;
    } else if (types) {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        type: types,               // Worker reads "type" not "types"
        radius: String(radius),
        maxResults: String(maxResults),
        forceRefresh: refresh
      });
      apiUrl = `${WORKER_URL}/places/search?${params.toString()}`;
    } else {
      return Response.json({ error: "Either 'types'/'query'/'textQuery' is required", places: [] }, { status: 400 });
    }

    console.log("📡 Worker URL:", apiUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Worker error:", response.status, errorText);
      return Response.json({ error: `Worker returned ${response.status}`, details: errorText, places: [] }, { status: 200 });
    }

    const data = await response.json();
    console.log("✅ Got", data.places?.length || 0, "places, fromCache:", data.fromCache || false);

    if (data.error) {
      console.error("⚠️ Worker returned error:", data.error, data.detail || "");
    }

    return Response.json(data);

  } catch (error) {
    console.error("❌ Error:", error?.message || error);
    return Response.json({ error: error?.message || String(error), places: [] }, { status: 200 });
  }
});