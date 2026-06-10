/**
 * ============================================================================
 * GLOBESKIMMERS - getCafeWorkProfile ("Good for working" cafe analysis proxy)
 * ============================================================================
 *
 * Powers the "💻 Good for working" panel on the Coffee finder. Auth-gated
 * proxy to Worker /cafe-work-profile, which reads the cafe's Google reviews,
 * asks Claude Haiku to extract laptop/remote-work signals (wifi, outlets,
 * work tables, AC, seating comfort, noise), and caches the result PERMANENTLY
 * in D1 (cafe_work_profiles) — pay Haiku once per cafe, ever.
 *
 * Returns: { workProfile: {...}, _cache: 'hit-d1'|'hit-kv'|'miss'|'miss-stub' }
 * Lazy-loaded — only fires when the user expands the panel on a coffee card.
 * ============================================================================
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";

const WORKER_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const placeId = body?.placeId;
    if (!placeId) {
      return Response.json({ error: "placeId required" }, { status: 400 });
    }

    const r = await fetch(`${WORKER_URL}/cafe-work-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, placeName: body?.placeName }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return Response.json(
        { error: `Worker returned ${r.status}`, details: txt },
        { status: 200 },
      );
    }

    const data = await r.json();
    return Response.json(data);
  } catch (error: any) {
    console.error("getCafeWorkProfile error:", error?.message || error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 200 },
    );
  }
});
