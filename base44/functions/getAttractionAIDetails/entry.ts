/**
 * ============================================================================
 * GLOBESKIMMERS - getAttractionAIDetails (Things-To-Do AI synthesis proxy)
 * ============================================================================
 *
 * Powers: the "AI Details" section on the ThingsToDo attraction card
 * (forked from getAIDetails as part of the Things-To-Do redesign so the
 * attraction layout can evolve without affecting restaurant rendering).
 *
 * Auth-gated proxy to Worker /attraction-ai-details. Frontend invokes
 * this with a placeId; Worker handles Place Details lookup, Claude Haiku
 * synthesis, source-tier tagging, verifiedFacts pre-fill from Google,
 * and 30-day KV caching (dedicated `attr_ai_details_*` prefix).
 *
 * Returns:
 *   { aiDetails: {...}, _cache: 'hit'|'miss'|'miss-stub' }
 *
 * The aiDetails shape includes a `_sources` map (per-field source tier:
 * 'verified' | 'reviews' | 'forecast' | 'call') and a `verifiedFacts`
 * block pre-filled from Google place data.
 *
 * Lazy-loaded — only fires when the user expands an attraction card.
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

    const r = await fetch(`${WORKER_URL}/attraction-ai-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
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
    console.error("getAttractionAIDetails error:", error?.message || error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 200 },
    );
  }
});
