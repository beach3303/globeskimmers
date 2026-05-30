/**
 * ============================================================================
 * GLOBESKIMMERS - getNameInfo (business name translate + romanize proxy)
 * ============================================================================
 *
 * Powers: src/components/NameLanguageHelp.jsx — the "🔤 Pronounce" + "🌐
 * Translate" buttons rendered under non-English business names on the
 * finder pages (PlacesToEat, CoffeeFinder, MoneyExchange, ThingsToDo,
 * Shopping, ConvenienceStore).
 *
 * Auth-gated proxy to Worker /name-info. Frontend invokes this with
 * { placeId, name }. Worker handles the Claude call and KV caching.
 * Returns: { romanization, translation, _cache: 'hit'|'miss' }.
 *
 * Lazy-loaded — only fires when user taps a button on a name that
 * the client-side heuristic flagged as needing help.
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
    const name = body?.name;
    if (!placeId || !name) {
      return Response.json({ error: "placeId + name required" }, { status: 400 });
    }

    const r = await fetch(`${WORKER_URL}/name-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, name }),
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
    console.error("getNameInfo error:", error?.message || error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 200 },
    );
  }
});
