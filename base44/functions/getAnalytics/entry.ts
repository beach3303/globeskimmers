/**
 * ============================================================================
 * GLOBESKIMMERS - getAnalytics (Admin-gated D1 analytics fetcher)
 * ============================================================================
 *
 * Powers: src/pages/AdminAnalytics.jsx
 *
 * Browser sends a list of query types; this function verifies the caller is
 * an admin email, then proxies each query to the Worker's /analytics-query
 * endpoint. Returns a map of { [type]: results[] } so the page can render
 * everything in one round trip.
 *
 * The Worker enforces the SQL allowlist — this function only adds the auth
 * gate and the fan-out.
 * ============================================================================
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";

const WORKER_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

const ADMIN_EMAILS = new Set([
  "maizasimeon@gmail.com",
  "founder@globeskimmers.io",
]);

// Default query bundle — the page asks for everything in one shot. If we
// later add a "drill in" view, the page can pass `types: [...]` to scope.
const DEFAULT_QUERIES = [
  "totals_7d",
  "page_views_7d",
  "event_type_breakdown_7d",
  "top_zero_results",
  "top_searches_7d",
  "events_by_day_14d",
  "dish_gallery_searches",
];

Deno.serve(async (req) => {
  console.log("\n📊 === GET ANALYTICS ===\n");

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = String(user.email || "").toLowerCase();
    if (!ADMIN_EMAILS.has(email)) {
      console.warn("📊 Non-admin attempted analytics access:", email);
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* GET-style call, body optional */ }

    const types: string[] = Array.isArray(body?.types) && body.types.length > 0
      ? body.types
      : DEFAULT_QUERIES;

    // Fan out the queries in parallel — each is a separate D1 round trip
    // but they're independent, so Promise.all is fine.
    const responses = await Promise.all(
      types.map(async (type) => {
        const url = `${WORKER_URL}/analytics-query?type=${encodeURIComponent(type)}`;
        try {
          const r = await fetch(url);
          const j = await r.json();
          return { type, results: j?.results || [], error: j?.error || null };
        } catch (e: any) {
          return { type, results: [], error: e?.message || String(e) };
        }
      }),
    );

    const data: Record<string, any> = {};
    for (const r of responses) {
      data[r.type] = { results: r.results, error: r.error };
    }

    return Response.json({ data, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("❌ Error:", error?.message || error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
