/**
 * ============================================================================
 * GLOBESKIMMERS - getAIDetails (per-place AI synthesis proxy)
 * ============================================================================
 *
 * Powers: the "AI Details" section on PlacesToEat's expanded restaurant card.
 *
 * Auth-gated proxy to Worker /ai-details. Frontend invokes this with a
 * placeId; Worker handles Place Details lookup, Claude Haiku synthesis,
 * and 30-day KV caching. Returns:
 *   { aiDetails: {...}, _cache: 'hit'|'miss'|'miss-stub' }
 *
 * Lazy-loaded — only fires when the user expands a restaurant card.
 * After first generation per place, served from cache for 30 days globally.
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
    // Kind drives per-kind voice rules + star scheme in the Worker.
    // 'restaurant' | 'coffee' | 'attraction' | 'restroom'. Defaults to
    // 'restaurant' if missing/unknown.
    const kind = body?.kind;

    const r = await fetch(`${WORKER_URL}/ai-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, kind }),
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
    console.error("getAIDetails error:", error?.message || error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 200 },
    );
  }
});
