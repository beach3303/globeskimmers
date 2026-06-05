/**
 * ============================================================================
 * GLOBESKIMMERS - analyzePrice (Price Scanner Phase P2 proxy)
 * ============================================================================
 *
 * Powers: the "💡 View Price Analysis" card on SmartPriceScanner after the
 * user freezes a price tag. Frontend invokes this with:
 *   {
 *     itemDescription: "<OCR'd item description>",
 *     price: <number>,
 *     currency: "<ISO>",
 *     country: "<country where shopping>",
 *     homeCountry: "<user's home country>" | null
 *   }
 *
 * Auth-gated proxy to Worker /analyze-price. Worker handles Claude Haiku
 * synthesis with strict honesty guardrails (price ranges only, every
 * alternative tagged 'estimated', 'unknown' verdict for niche items), and
 * 30-day KV caching keyed by (item + currency + price-bucket + country pair).
 *
 * Returns:
 *   { analysis: {...}, _cache: 'hit' | 'miss' }
 *
 * Lazy — only fires when the user explicitly taps "View Price Analysis".
 * Same (item, country, price band) repeats are served from cache for 30
 * days globally, so popular items + popular destinations stay cheap.
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
    if (!body?.itemDescription || !body?.price || !body?.currency) {
      return Response.json(
        { error: "itemDescription, price, and currency are required" },
        { status: 400 },
      );
    }

    const r = await fetch(`${WORKER_URL}/analyze-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemDescription: body.itemDescription,
        price: body.price,
        currency: body.currency,
        country: body.country || null,
        homeCountry: body.homeCountry || null,
      }),
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
    console.error("analyzePrice error:", error?.message || error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 200 },
    );
  }
});
