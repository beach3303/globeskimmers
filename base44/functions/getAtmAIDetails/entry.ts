/**
 * ============================================================================
 * GLOBESKIMMERS - getAtmAIDetails (ATM Finder AI synthesis proxy)
 * ============================================================================
 *
 * Powers: the "AI Details" section on the ATMFinder card (forked from
 * getAIDetails as part of the ATM redesign so the ATM layout can evolve
 * without affecting restaurant rendering).
 *
 * Auth-gated proxy to Worker /atm-ai-details. Frontend invokes this
 * with a placeId; Worker handles Place Details lookup, Claude Haiku
 * synthesis, source-tier tagging, verifiedFacts pre-fill from Google,
 * ATM-specific schema (cardCompatibility, atmOperatorFee, withdrawal
 * limits, locationContext, safety, dccWarning), and 30-day KV caching
 * (dedicated `atm_ai_details_*` prefix).
 *
 * Returns:
 *   { aiDetails: {...}, _cache: 'hit'|'miss'|'miss-stub' }
 *
 * Lazy-loaded — only fires when the user expands an ATM card.
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

    const r = await fetch(`${WORKER_URL}/atm-ai-details`, {
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
    console.error("getAtmAIDetails error:", error?.message || error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 200 },
    );
  }
});
