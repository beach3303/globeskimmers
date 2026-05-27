/**
 * placeDetailsHydrator.js — Phase 3 / P4 scaffold
 *
 * Hydrates Google Place Details for the top-N results of a search WITHOUT
 * blowing the per-day API spend budget. Each Place Details call is the
 * Preferred SKU tier ($20/1K = $0.02/call), so without a cap a heavy
 * search could rack up dollars in minutes.
 *
 * The Worker has aggressive KV caching (90-day TTL on Place Details
 * responses), so subsequent calls for the same placeId are FREE.
 * The cost ceiling only applies to FRESH calls — cache hits don't count.
 *
 * Strategy:
 *   1. Caller passes an array of placeIds and a "max fresh calls" cap.
 *   2. Hydrator first asks the Worker for ALL ids (Worker handles cache
 *      internally). Each placeId costs $0.02 IF the Worker has to fetch
 *      from Google, $0 if cached.
 *   3. To bound cost, the hydrator stops dispatching new fetches once it
 *      counts maxFreshCalls cache MISSES. Subsequent placeIds are skipped
 *      (caller falls back to the search-response data without rich
 *      Details).
 *
 * Currently the Worker doesn't tell us whether a result was cached or
 * fresh, so this version is a STARTER — it just enforces a hard cap on
 * total dispatches. Future increment: have the Worker return
 * `X-Cache-Hit: 1|0` so we can distinguish cache hits from fresh calls
 * and let cache hits flow without consuming the budget.
 *
 * Usage:
 *   import { hydratePlaceDetails } from '@/lib/placeDetailsHydrator';
 *   const enriched = await hydratePlaceDetails(
 *     places.slice(0, 5).map(p => p.placeId),
 *     { maxCalls: 5 }
 *   );
 *   // enriched is a Map<placeId, detailsObject | null>; null = skipped
 *   //   (over budget) or fetch failed
 */

const WORKER_URL = 'https://globeskimmers-api.maizasimeon.workers.dev';

/**
 * @param {string[]} placeIds — ordered list (most important first; hydrator
 *   skips later ids once the cap is hit)
 * @param {object} opts
 * @param {number} [opts.maxCalls=5] — max number of fetches to dispatch
 * @param {number} [opts.timeoutMs=5000] — per-call timeout
 * @returns {Promise<Map<string, object|null>>} — placeId → details, or null
 *   if skipped / failed
 */
export async function hydratePlaceDetails(placeIds, opts = {}) {
  const maxCalls = opts.maxCalls ?? 5;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const result = new Map();
  if (!Array.isArray(placeIds) || placeIds.length === 0) return result;

  let dispatched = 0;
  const tasks = placeIds.map((placeId) => {
    if (dispatched >= maxCalls) {
      result.set(placeId, null);
      return Promise.resolve();
    }
    dispatched++;
    return fetchDetailsWithTimeout(placeId, timeoutMs)
      .then((details) => result.set(placeId, details))
      .catch(() => result.set(placeId, null));
  });

  await Promise.all(tasks);
  return result;
}

async function fetchDetailsWithTimeout(placeId, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(
      `${WORKER_URL}/places/details/${encodeURIComponent(placeId)}`,
      { signal: controller.signal }
    );
    if (!r.ok) return null;
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Daily spend tracker (rough). Stored in localStorage as a single counter
 * keyed by YYYY-MM-DD. Caller can read this to enforce a daily cap across
 * sessions — e.g. "stop hydrating once today's spend > $5".
 *
 * NOTE: this is a CLIENT-SIDE estimate. Actual spend is what Google bills.
 * If we want server-side enforcement, future increment: move the counter
 * to Worker KV and have /log-event also track API spend per session.
 */
const SPEND_KEY = 'gs_pd_spend';

export function getTodaySpend() {
  try {
    const raw = localStorage.getItem(SPEND_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    return parsed.date === today ? (parsed.cents || 0) : 0;
  } catch {
    return 0;
  }
}

export function trackSpend(callCount, costPerCallCents = 2) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const current = getTodaySpend();
    const next = current + callCount * costPerCallCents;
    localStorage.setItem(SPEND_KEY, JSON.stringify({ date: today, cents: next }));
    return next;
  } catch {
    return 0;
  }
}
