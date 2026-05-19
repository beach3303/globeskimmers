# Globeskimmers — Complete Search Reliability + App-Wide Analytics + DishSearchGallery Handoff (v3)

**For:** Claude Code working in VS Code on the `beach3303/globeskimmers` repo
**From:** Maiza (founder)
**Supersedes:** v1 (PlacesToEat search only) and v2 (added app-wide analytics)

## What's New in v3

v2 covered PlacesToEat search fixes + app-wide analytics. v3 adds **DishSearchGallery as a launch feature** (previously deferred to month 3+, now promoted to Phase 4 of launch). This is a genuinely differentiated feature: users search for a dish (e.g., "pancakes") and see a grid of actual dish photos from nearby restaurants, powered by your existing Haiku 4.5 menu OCR cache.

Marginal cost analysis showed this adds only ~$10 one-time pre-warm + $20–50/month ongoing. Build cost is 3–4 days. Worth shipping at launch for marketing differentiation and customer trust.

The PlacesToEat search fixes (Phase 1) and analytics layer (Phase 2) are unchanged.

---

## Section 1: Context — The Whole App

Globeskimmers is a travel utility PWA for international travelers. Twelve user-facing features:

| Feature | What it does | Main API costs |
|---|---|---|
| PlacesToEat | Restaurant finder with tiering, filters, dish search | Google Places API New + Haiku 4.5 vision |
| ATM Finder | Find ATMs by network, with multi-photo cards | Google Places API New |
| Coffee Finder | Coffee shops with drink-type and amenity filters | Google Places API New |
| Restroom Finder | Public restrooms with accessType, smartNote, country tips | Google Places API New |
| Shopping Finder | Stores by category | Google Places API New |
| Things to Do | Activities and attractions | Google Places API New |
| Currency Exchange Finder | Real-time exchange rates | Free external rates API |
| Basic Phrases | TTS phrases in local languages/dialects | Google Neural2 TTS (separate Worker) |
| Smart Price Scanner | Camera-based price recognition with currency conversion | Anthropic Claude (sonnet-4-6) vision |
| Cultural Info | Country guides | Static content |
| Weather | Location-based weather | Free weather API |
| Transportation | Local transport info | Free or static |

**Stack:**
- **Frontend:** Base44 React app (PWA), synced to VS Code via GitHub `beach3303/globeskimmers`
- **Backend:** Deno/TypeScript Base44 functions (one per feature, e.g., `getRestaurants.ts`, `getATMs.ts`, etc.)
- **Worker:** Cloudflare Worker `cloudflare-worker-v7.12.js` at `globeskimmers-api.maizasimeon.workers.dev`
- **TTS Worker:** Separate Worker at `globeskimmers-tts.maizasimeon.workers.dev` for Basic Phrases
- **Cache:** Cloudflare KV (`GLOBESKIMMERS_KV`)
- **APIs:** Google Places API (New), Google Neural2 TTS, Anthropic Claude (Haiku 4.5 for menu OCR, Sonnet 4.6 for price scanning)
- **Analytics storage (TO BUILD):** Cloudflare D1

---

## Section 2: Goals (in priority order)

1. **PlacesToEat search bar at 98–100% accuracy** for dishes, cuisines, restaurant names, and dietary terms — including searches Google can handle (semantic queries like "rooftop with view," "hidden gems") plus the tier-based ranking system already in place
2. **Advanced filters return what users ask for** — Open Now, Dietary (Vegan, Halal, Kosher, Gluten-Free, Vegetarian), Vibe (Family, Outdoor, Live Music, Groups, Sports Bar), Seating/Parking (with trust labels), Min Rating, Max Price, Radius, Cuisine multi-select
3. **Founder admin dashboard** showing daily active users, per-user behavior across all 12 features, top queries, failed queries, tap-through rates, retention, and cost-vs-revenue attribution
4. **Cost savings + hard cap on Place Details** — 5-call ceiling per search, 2,500-call daily budget cap across all users, graceful degradation when cap is hit

---

## Section 3: Cost Decision Tree (Settled Rule)

Before paying for Place Details, ask in order:

1. **Does the restaurant name contain the dish or a synonym?** → Free. Use `nameKeywords` in DISH_MAP. Tier 1.
2. **Is the restaurant typed as the cuisine specialist?** → Free. Type match in tier1/tier2 arrays. Tier 2.
3. **Did Google's `editorialSummary` mention the dish?** → Free. Already in search response. Tier 4.
4. **Did reviews mention the dish?** → **PAID. Place Details $0.025/call, max 5 per search, 90-day cache.** Only for ambiguous tier 3/4 candidates when tier 1+2 < 5 results.
5. **Did menu OCR find the dish?** → Haiku 4.5 vision, separate cost, 180-day cache. Already implemented.

Questions 1–3 are free. Question 4 is the only paid step and only for hard cases.

---

## Section 4: Architectural Decisions Already Made

Settled. Do not question, just implement.

1. **Free fixes alone get to 90–95% accuracy.** No new API spend required for them.
2. **Place Details fires only for genuinely ambiguous DISH cases**, capped at 5 calls per search. 90-day KV cache amortizes cost.
3. **Daily Place Details budget cap (2,500 calls/day = $62.50/day max)** enforced in Worker via KV counter. Graceful degradation when exceeded.
4. **Analytics-first launch.** Logging goes live BEFORE Place Details is turned on, so we have baseline behavior to compare against.
5. **Event-based logging schema.** Single `events` table in D1 with JSON metadata field. Every feature logs to the same table. New features added later don't require schema changes.
6. **Privacy:** Lat/lng rounded to 0.01° (~1km grid) before storage. No exact location stored. No user-identifiable PII beyond user_id (which is the Base44 user UUID).

---

## Section 5: Phase 1 — Free Search Fixes for PlacesToEat (target: 1 day)

### 5.1 Add `nameKeywords` field to DISH_MAP

**File:** `getRestaurants.ts` (the `DISH_MAP` array, ~line 240)

**Problem:** When a user types "froyo," `rawWords = ['froyo']` is added to `dishWords`. Yogurtland's name doesn't contain "froyo" → fails Tier 1 → drops to Tier 2/3. Same asymmetry breaks "pho," "bbq," "ramen," "sushi" when typed colloquially vs. with the canonical label.

**Fix:** Add a third field to every DISH_MAP entry listing canonical name fragments that always count as namesake matches.

**Type signature:**
```typescript
const DISH_MAP: Array<{
  pattern: RegExp;
  tier1: string[];
  tier2: string[];
  label: string;
  nameKeywords?: string[];  // ← NEW
  mealTime?: 'breakfast' | 'brunch' | 'lunch' | 'dinner';
}> = [ /* ... */ ];
```

**Examples (apply the rule to all ~80 entries):**

```typescript
{ pattern: /\bfrozen\s*yogurt\b|\bfro[\s-]?yo\b/,
  tier1:['ice_cream_shop'], tier2:['dessert_shop'],
  label:'frozen yogurt',
  nameKeywords:['yogurt','froyo','frozen yogurt'] },

{ pattern: /\bsushi\b/,
  tier1:['sushi_restaurant'], tier2:['japanese_restaurant'],
  label:'sushi',
  nameKeywords:['sushi','maki','sashimi'] },

{ pattern: /\bramen\b/,
  tier1:['ramen_restaurant'], tier2:['japanese_restaurant'],
  label:'ramen',
  nameKeywords:['ramen','noodle'] },

{ pattern: /\bpancakes?\b|\bwaffles?\b/,
  tier1:['breakfast_restaurant'], tier2:['american_restaurant','diner'],
  label:'pancakes',
  nameKeywords:['pancake','pancakes','flapjack','griddle','ihop'],
  mealTime:'breakfast' },

{ pattern: /\bbbq\b|\bbarbeque\b|\bbarbecue\b/,
  tier1:['barbecue_restaurant'], tier2:['american_restaurant'],
  label:'BBQ',
  nameKeywords:['bbq','barbecue','barbeque','smokehouse'] },

{ pattern: /\bpho\b/,
  tier1:['vietnamese_restaurant'], tier2:[],
  label:'pho',
  nameKeywords:['pho'] },

{ pattern: /\bneapolitan\s*pizza\b|\bnew\s*york\s*style\s*pizza\b|\bdeep\s*dish\b|\bpizza\b/,
  tier1:['pizza_restaurant'], tier2:['italian_restaurant'],
  label:'pizza',
  nameKeywords:['pizza','pizzeria'] },
```

**Rule:** For each DISH_MAP entry, include the canonical English name(s) plus common alternate spellings or industry terms a restaurant might brand with. Always include the literal label word(s). Skip generic words like 'food' or 'kitchen'. Keep all keywords lowercase.

### 5.2 Update `getTierForPlace` to use `nameKeywords`

**File:** `getRestaurants.ts` (`getTierForPlace` function)

```typescript
// OLD
const dishWords = Array.from(new Set([
  intent.label.toLowerCase(),
  ...(intent.rawWords || [])
].filter(Boolean)));

// NEW
const dishWords = Array.from(new Set([
  intent.label.toLowerCase(),
  ...(intent.rawWords || []),
  ...(intent.nameKeywords || [])  // ← NEW LINE
].filter(Boolean)));
```

**Also update `parseSearchIntentInner`** to pass `nameKeywords` into the returned intent:

```typescript
return {
  kind: 'DISH',
  label: entry.label,
  tier1Types: entry.tier1,
  tier2Types: entry.tier2,
  rawWords,
  nameKeywords: entry.nameKeywords || [],  // ← NEW
  mealTime: entry.mealTime,
};
```

**Update the `ParsedIntent` type:**

```typescript
type ParsedIntent =
  | { kind: 'UMBRELLA'; cultureKey: string; label: string; types: Set<string>; keywords: string[] }
  | { kind: 'DISH'; label: string; tier1Types: string[]; tier2Types: string[]; rawWords: string[]; nameKeywords: string[]; mealTime?: 'breakfast' | 'brunch' | 'lunch' | 'dinner' }
  | { kind: 'GENERAL' };
```

### 5.3 Remove the bare `servesBreakfast === true` Tier 4 path

**File:** `getRestaurants.ts` (`getTierForPlace`, ~line 690)

```typescript
// OLD
if (isBreakfasty) {
  if (place.servesBreakfast === true || place.servesBrunch === true) return 4;  // ← REMOVE
  if (types.has('bakery') || place.primaryType === 'bakery') return 4;
  if (KNOWN_BREAKFAST_CHAINS.some(c => name.includes(c))) return 4;
}

// NEW
if (isBreakfasty) {
  // servesBreakfast/servesBrunch are too noisy alone — Google's data is stale for many chains
  // (e.g., Taco Bell still flagged true from 2014-2020 breakfast menu).
  // Rely on bakery type + known chain list + editorialSummary + reviews + menu OCR instead.
  if (types.has('bakery') || place.primaryType === 'bakery') return 4;
  if (KNOWN_BREAKFAST_CHAINS.some(c => name.includes(c))) return 4;
}
```

### 5.4 Verify `detectDietaryModifier` is defined

Search the codebase for `function detectDietaryModifier`. If missing, add:

```typescript
function detectDietaryModifier(query: string, dishLabel: string | null): string | null {
  const q = (query || '').toLowerCase();
  if (dishLabel) {
    const dl = dishLabel.toLowerCase();
    if (['halal','kosher','vegan','vegetarian','gluten free'].includes(dl)) return null;
  }
  if (/\bhalal\b/.test(q)) return 'halal';
  if (/\bkosher\b/.test(q)) return 'kosher';
  if (/\bvegan\b/.test(q)) return 'vegan';
  if (/\bvegetarian\b/.test(q)) return 'vegetarian';
  if (/\bgluten[\s-]?free\b/.test(q)) return 'glutenFree';
  return null;
}
```

### 5.5 Rename TIER_LABELS for clarity

**File:** `getRestaurants.ts` (~line 720)

```typescript
// OLD
const TIER_LABELS: Record<number, string> = {
  1:'Specialty', 2:'Cuisine Match', 3:'Cultural', 4:'Serves It',
};

// NEW
const TIER_LABELS: Record<number, string> = {
  1:'Namesake',       // name contains the dish or synonym
  2:'Specialist',     // typed as the dish's primary cuisine
  3:'Related Cuisine',// typed as secondary cultural cuisine
  4:'Serves It',      // editorialSummary / reviews / menu OCR / known chain
};
```

Also search `PlacesToEat.jsx` for references to the old labels and update.

### Phase 1 Acceptance Criteria

Manually test these searches. Each should return the expected top result type:

| Query | Top 3 expected | Should NOT see |
|---|---|---|
| `froyo` | Yogurtland, Menchie's, Pinkberry | Random places without "yogurt" in name |
| `fro yo` | Same | — |
| `frozen yogurt` | Same | — |
| `pancakes` | Original Pancake House, IHOP, Black Bear Diner | Taco Bell, generic fast food |
| `sushi` | Sushi specialists by name, then `sushi_restaurant` | Generic Asian fusion |
| `ramen` | Ramen specialists, then `ramen_restaurant` | Pho places at top |
| `pho` | Pho specialists, Vietnamese restaurants | Generic Asian |
| `bbq` | BBQ specialists, smokehouses | Generic American |
| `vegan tacos` | Vegan + Mexican, then taco places with vegan options | Non-vegan Mexican at top |
| `halal pizza` | Halal pizza places | Non-halal pizza at top |

---

## Section 6: Phase 2 — App-Wide Analytics + Founder Dashboard (target: 3–4 days)

This is the major expansion vs. v1. The dashboard covers all 12 features, not just PlacesToEat.

### 6.1 Cloudflare D1 Database Setup

**Step 1: Create the database** (requires wrangler CLI):

```bash
wrangler d1 create globeskimmers-analytics
```

Note the returned database ID, add to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "ANALYTICS_DB"
database_name = "globeskimmers-analytics"
database_id = "YOUR_DATABASE_ID_HERE"
```

**Step 2: Schema (events-based design):**

Save as `schema.sql`:

```sql
-- Single events table for ALL features.
-- New features just log new event_type values — no schema change needed.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  feature TEXT NOT NULL,           -- 'places_to_eat', 'atm_finder', 'coffee_finder', etc.
  event_type TEXT NOT NULL,        -- 'search', 'tap', 'view', 'play', 'scan', 'filter_change', 'session_start', 'feature_open'
  metadata TEXT,                   -- JSON blob, event-specific data
  lat REAL,                        -- rounded to 0.01 deg for privacy
  lng REAL,
  platform TEXT,                   -- 'web', 'ios', 'android'
  app_version TEXT
);

CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_feature ON events(feature);
CREATE INDEX idx_events_feature_type ON events(feature, event_type);
CREATE INDEX idx_events_session ON events(session_id);

-- Daily cost rollup table (separate so dashboard queries stay fast)
CREATE TABLE daily_costs (
  date TEXT PRIMARY KEY,
  text_search_calls INTEGER DEFAULT 0,
  nearby_calls INTEGER DEFAULT 0,
  details_calls INTEGER DEFAULT 0,
  photo_label_calls INTEGER DEFAULT 0,
  tts_calls INTEGER DEFAULT 0,
  price_scan_calls INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0
);

-- Daily user rollup (for fast DAU/WAU/MAU queries)
CREATE TABLE daily_users (
  date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  features_used TEXT,              -- JSON array of feature names
  first_seen_today TEXT,
  last_seen_today TEXT,
  PRIMARY KEY (date, user_id)
);

CREATE INDEX idx_daily_users_date ON daily_users(date);
```

Run:
```bash
wrangler d1 execute globeskimmers-analytics --file=schema.sql
```

### 6.2 Worker Logging Endpoints

**File:** `cloudflare-worker-v7.12.js`

Add three endpoints: `/log-event` (used by every feature), `/admin/stats` (read-only), `/admin/user-detail` (per-user drill-down).

**Add to the main `fetch` handler:**

```javascript
if (pathname === "/log-event" && request.method === "POST") return await handleLogEvent(request, env);
if (pathname === "/admin/stats") return await handleAdminStats(request, env, ctx);
if (pathname === "/admin/user-detail") return await handleUserDetail(request, env);
```

**Implementation:**

```javascript
async function handleLogEvent(request, env) {
  try {
    const body = await request.json();
    if (!env.ANALYTICS_DB) {
      return jsonResponse({ logged: false, reason: 'D1 not bound' });
    }

    const timestamp = new Date().toISOString();
    const today = timestamp.slice(0, 10);

    // 1. Insert the event
    await env.ANALYTICS_DB.prepare(`
      INSERT INTO events (
        timestamp, user_id, session_id, feature, event_type,
        metadata, lat, lng, platform, app_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      timestamp,
      body.user_id || null,
      body.session_id || null,
      body.feature,
      body.event_type,
      JSON.stringify(body.metadata || {}),
      body.lat ? Math.round(body.lat * 100) / 100 : null,
      body.lng ? Math.round(body.lng * 100) / 100 : null,
      body.platform || 'web',
      body.app_version || null
    ).run();

    // 2. Update daily_users rollup
    if (body.user_id) {
      await env.ANALYTICS_DB.prepare(`
        INSERT INTO daily_users (date, user_id, session_count, event_count, features_used, first_seen_today, last_seen_today)
        VALUES (?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(date, user_id) DO UPDATE SET
          event_count = event_count + 1,
          last_seen_today = excluded.last_seen_today,
          session_count = CASE
            WHEN excluded.session_count > 0 THEN session_count + 1
            ELSE session_count
          END
      `).bind(
        today,
        body.user_id,
        body.event_type === 'session_start' ? 1 : 0,
        JSON.stringify([body.feature]),
        timestamp,
        timestamp
      ).run();
    }

    // 3. Update daily_costs if metadata includes cost-bearing API calls
    const m = body.metadata || {};
    const costCalls = {
      text_search_calls: m.text_search_calls || 0,
      nearby_calls: m.nearby_calls || 0,
      details_calls: m.details_calls || 0,
      photo_label_calls: m.photo_labels_fired || 0,
      tts_calls: m.tts_calls || 0,
      price_scan_calls: m.price_scan_calls || 0,
    };
    const estimatedCost = costCalls.text_search_calls * 0.035
                       + costCalls.nearby_calls * 0.035
                       + costCalls.details_calls * 0.025
                       + costCalls.photo_label_calls * 0.002
                       + costCalls.tts_calls * 0.000016  // Google Neural2 per char, approximate
                       + costCalls.price_scan_calls * 0.005;  // Sonnet 4.6 vision approximate

    if (Object.values(costCalls).some(v => v > 0)) {
      await env.ANALYTICS_DB.prepare(`
        INSERT INTO daily_costs (date, text_search_calls, nearby_calls, details_calls, photo_label_calls, tts_calls, price_scan_calls, estimated_cost_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          text_search_calls = text_search_calls + excluded.text_search_calls,
          nearby_calls = nearby_calls + excluded.nearby_calls,
          details_calls = details_calls + excluded.details_calls,
          photo_label_calls = photo_label_calls + excluded.photo_label_calls,
          tts_calls = tts_calls + excluded.tts_calls,
          price_scan_calls = price_scan_calls + excluded.price_scan_calls,
          estimated_cost_usd = estimated_cost_usd + excluded.estimated_cost_usd
      `).bind(today, costCalls.text_search_calls, costCalls.nearby_calls,
              costCalls.details_calls, costCalls.photo_label_calls,
              costCalls.tts_calls, costCalls.price_scan_calls, estimatedCost).run();
    }

    return jsonResponse({ logged: true });
  } catch (e) {
    return jsonResponse({ logged: false, error: e.message }, 200);
  }
}
```

**Admin stats endpoint** (returns aggregated data for the dashboard):

```javascript
async function handleAdminStats(request, env, ctx) {
  if (!env.ANALYTICS_DB) return jsonResponse({ error: 'D1 not bound' }, 500);

  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 90);
  const today = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const [dau, costs, featureUsage, topQueries, failedQueries, retention] = await Promise.all([
    // DAU/WAU/MAU over the period
    env.ANALYTICS_DB.prepare(`
      SELECT date, COUNT(DISTINCT user_id) as dau, SUM(event_count) as total_events
      FROM daily_users WHERE date >= ? GROUP BY date ORDER BY date DESC
    `).bind(startDate).all(),

    // Daily costs over the period
    env.ANALYTICS_DB.prepare(`
      SELECT * FROM daily_costs WHERE date >= ? ORDER BY date DESC
    `).bind(startDate).all(),

    // Feature usage breakdown
    env.ANALYTICS_DB.prepare(`
      SELECT feature, COUNT(*) as event_count, COUNT(DISTINCT user_id) as unique_users
      FROM events WHERE timestamp >= ? GROUP BY feature ORDER BY event_count DESC
    `).bind(startDate + 'T00:00:00').all(),

    // Top PlacesToEat queries
    env.ANALYTICS_DB.prepare(`
      SELECT
        json_extract(metadata, '$.query') as query,
        COUNT(*) as count,
        AVG(json_extract(metadata, '$.result_count')) as avg_results
      FROM events
      WHERE feature='places_to_eat' AND event_type='search'
        AND timestamp >= ?
        AND json_extract(metadata, '$.query') != ''
      GROUP BY query ORDER BY count DESC LIMIT 20
    `).bind(startDate + 'T00:00:00').all(),

    // Failed queries (zero results or only tier 4)
    env.ANALYTICS_DB.prepare(`
      SELECT
        json_extract(metadata, '$.query') as query,
        COUNT(*) as count
      FROM events
      WHERE feature='places_to_eat' AND event_type='search'
        AND timestamp >= ?
        AND (json_extract(metadata, '$.result_count') = 0
             OR (json_extract(metadata, '$.tier1_count') = 0
                 AND json_extract(metadata, '$.tier2_count') = 0))
      GROUP BY query ORDER BY count DESC LIMIT 20
    `).bind(startDate + 'T00:00:00').all(),

    // Retention: D1, D7, D30 cohorts
    env.ANALYTICS_DB.prepare(`
      WITH first_seen AS (
        SELECT user_id, MIN(date) as cohort_date FROM daily_users GROUP BY user_id
      )
      SELECT
        cohort_date,
        COUNT(DISTINCT first_seen.user_id) as cohort_size,
        COUNT(DISTINCT CASE WHEN julianday(du.date) - julianday(first_seen.cohort_date) = 1 THEN du.user_id END) as d1,
        COUNT(DISTINCT CASE WHEN julianday(du.date) - julianday(first_seen.cohort_date) = 7 THEN du.user_id END) as d7,
        COUNT(DISTINCT CASE WHEN julianday(du.date) - julianday(first_seen.cohort_date) = 30 THEN du.user_id END) as d30
      FROM first_seen
      LEFT JOIN daily_users du ON first_seen.user_id = du.user_id
      WHERE cohort_date >= ?
      GROUP BY cohort_date ORDER BY cohort_date DESC LIMIT 30
    `).bind(startDate).all(),
  ]);

  return jsonResponse({
    dau_series: dau.results,
    cost_series: costs.results,
    feature_usage: featureUsage.results,
    top_queries: topQueries.results,
    failed_queries: failedQueries.results,
    retention_cohorts: retention.results,
    period_days: days,
  });
}
```

**Per-user detail endpoint:**

```javascript
async function handleUserDetail(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) return jsonResponse({ error: 'user_id required' }, 400);

  const [profile, recentEvents, featureBreakdown] = await Promise.all([
    env.ANALYTICS_DB.prepare(`
      SELECT
        MIN(date) as first_seen,
        MAX(date) as last_seen,
        COUNT(DISTINCT date) as active_days,
        SUM(event_count) as total_events,
        SUM(session_count) as total_sessions
      FROM daily_users WHERE user_id = ?
    `).bind(userId).first(),

    env.ANALYTICS_DB.prepare(`
      SELECT timestamp, feature, event_type, metadata
      FROM events WHERE user_id = ?
      ORDER BY timestamp DESC LIMIT 100
    `).bind(userId).all(),

    env.ANALYTICS_DB.prepare(`
      SELECT feature, COUNT(*) as count
      FROM events WHERE user_id = ?
      GROUP BY feature ORDER BY count DESC
    `).bind(userId).all(),
  ]);

  return jsonResponse({ profile, recent_events: recentEvents.results, feature_breakdown: featureBreakdown.results });
}
```

### 6.3 Per-Feature Logging Instrumentation

Each feature's backend function needs to call `/log-event` at the end of its handler. Here's the pattern:

**PlacesToEat (`getRestaurants.ts`):** at end of main handler, before return:

```typescript
fetch(`${API_BASE_URL}/log-event`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    feature: 'places_to_eat',
    event_type: 'search',
    user_id: user?.id || null,
    session_id: body.session_id || null,
    lat: latitude,
    lng: longitude,
    metadata: {
      query: searchQuery,
      intent_kind: intent.kind,
      intent_label: intent.kind === 'GENERAL' ? null : (intent as any).label,
      cuisine,
      radius_miles: radiusMiles,
      result_count: finalPlaces.length,
      tier1_count: finalPlaces.filter(p => p.tier === 1).length,
      tier2_count: finalPlaces.filter(p => p.tier === 2).length,
      tier3_count: finalPlaces.filter(p => p.tier === 3).length,
      tier4_count: finalPlaces.filter(p => p.tier === 4).length,
      details_calls: detailsCallCount,
      photo_labels_fired: photoLabelsFired,
      fallback_needed: fallbackInfo.needed,
      text_search_calls: queries.length,
      nearby_calls: nearbyTypeList.length,
      filters_active: {
        cuisines: [...selectedCuisines],
        open_now: filterOpenNow,
        min_rating: filterMinRating,
        max_price: filterMaxPrice,
        vibes: filterVibes,
        dietary: filterDietary,
      },
    },
  }),
}).catch(() => {});
```

**ATM Finder (`getATMs.ts`):**

```typescript
fetch(`${API_BASE_URL}/log-event`, {
  method: 'POST',
  body: JSON.stringify({
    feature: 'atm_finder',
    event_type: 'search',
    user_id: user?.id || null,
    lat: latitude, lng: longitude,
    metadata: {
      radius_miles: radiusMiles,
      network_filter: networkFilter,
      result_count: atms.length,
      nearby_calls: nearbyCallsCount,
    },
  }),
  headers: { 'Content-Type': 'application/json' },
}).catch(() => {});
```

**Coffee Finder, Restroom Finder, Shopping Finder, Things to Do:** same pattern, just change `feature` name and metadata fields to match what each feature tracks.

**Basic Phrases (TTS Worker):**

```javascript
fetch(`${ANALYTICS_WORKER_URL}/log-event`, {
  method: 'POST',
  body: JSON.stringify({
    feature: 'basic_phrases',
    event_type: 'play',
    user_id: userId,
    metadata: {
      language: lang,
      dialect: dialect,
      phrase_id: phraseId,
      category: category,
      cache_hit: cacheHit,
      tts_calls: cacheHit ? 0 : 1,
    },
  }),
  headers: { 'Content-Type': 'application/json' },
}).catch(() => {});
```

**Smart Price Scanner:** log a `scan` event with `currency_detected`, `prices_found`, `scan_success`, `price_scan_calls: 1`.

**Currency Exchange, Weather, Transportation, Cultural Info:** log `view` or `query` events (no cost-bearing API calls if using free external APIs).

### 6.4 Frontend Session + Tap Tracking

**File:** Create a shared utility `src/lib/analytics.js`:

```javascript
const ANALYTICS_URL = 'https://globeskimmers-api.maizasimeon.workers.dev/log-event';

let sessionId = null;
function getSessionId() {
  if (!sessionId) {
    sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return sessionId;
}

export function logEvent(feature, eventType, metadata = {}) {
  const userId = window.currentUserId || null;  // set by Base44 auth
  fetch(ANALYTICS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feature,
      event_type: eventType,
      user_id: userId,
      session_id: getSessionId(),
      metadata,
      platform: 'web',
      app_version: '6.4',
    }),
  }).catch(() => {});
}

// Call on app load
export function startSession() {
  logEvent('app', 'session_start', {});
}

// Call when user navigates to a feature
export function logFeatureOpen(feature) {
  logEvent(feature, 'feature_open', {});
}
```

**Wire into every feature page:**

In `PlacesToEat.jsx`, `ATMFinder.jsx`, `CoffeeFinder.jsx`, `RestroomFinder.jsx`, etc., add at the top:

```jsx
import { logFeatureOpen, logEvent } from '@/lib/analytics';

useEffect(() => {
  logFeatureOpen('places_to_eat');  // adjust per feature
}, []);
```

**For taps (PlacesToEat as example):**

```jsx
const handleDirections = (restaurant, rank) => {
  logEvent('places_to_eat', 'tap', {
    place_id: restaurant.id,
    place_name: restaurant.name,
    tier: restaurant.tier,
    rank_in_results: rank,
    action: 'directions',
  });
  setDirModal({ open: true, lat: restaurant.lat, lng: restaurant.lng, name: restaurant.name });
};
```

Apply to: Directions button, Map button, More expand, Phone tap, Website tap.

### 6.5 Founder Admin Dashboard

**File:** Create `AdminDashboard.jsx` as a new page in the Base44 app. Route under `/admin`. Gate access with a check on Base44 user ID matching the founder's ID.

**Dashboard layout (sections in order):**

**Section A — Today at a Glance:**
- DAU today
- Total events today
- Total estimated cost today (in dollars)
- Place Details calls today (X of 2,500 daily budget)
- Top 5 active features (with event counts)

**Section B — Trend Charts (last 7 / 30 / 90 days):**
- DAU line chart
- Daily cost stacked bar (text_search, nearby, details, photo_ocr, tts, price_scan)
- New users per day
- Sessions per user (average)

**Section C — Feature Usage Breakdown:**
- Table: each feature with event count, unique users, % of DAU
- Click into a feature for deeper drilldown

**Section D — PlacesToEat Deep Dive (because it's the most expensive feature):**
- Top 20 queries this week
- Top 20 failed queries (zero results or only tier-4 results) — these are the cases that need Place Details OR menu OCR investment
- Tier tap distribution (% of taps on tier 1 vs 2 vs 3 vs 4)
- Cache hit rate
- Place Details fire rate (% of searches that triggered Details)
- Cost per PlacesToEat search

**Section E — User Behavior:**
- Distribution of sessions per user (histogram)
- Average session length
- Feature usage per user (heatmap: rows = users, columns = features, intensity = event count)
- Retention cohorts: D1, D7, D30 curves

**Section F — Cost vs. Revenue:**
- API cost this month (from D1)
- AdMob revenue this month (manual entry initially — adds a form field; future: AdMob API)
- Affiliate revenue this month (manual entry initially)
- Net profit/loss
- Cost per active user (DAU)
- Most expensive single query (rare cases like Details cache miss)

**Section G — Per-User Drilldown:**
- Search bar to look up a specific user_id
- Shows: first seen, last seen, total events, total sessions, feature usage breakdown, recent 100 events with timestamps

**Implementation skeleton:**

```jsx
import React, { useState, useEffect } from 'react';
import { LineChart, BarChart, ... } from 'recharts';

const ADMIN_URL = 'https://globeskimmers-api.maizasimeon.workers.dev/admin/stats';

export default function AdminDashboard() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${ADMIN_URL}?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [days]);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div>
      <div>
        <button onClick={() => setDays(7)}>7d</button>
        <button onClick={() => setDays(30)}>30d</button>
        <button onClick={() => setDays(90)}>90d</button>
      </div>

      <SectionA data={data} />
      <SectionB data={data} />
      <SectionC data={data} />
      <SectionD data={data} />
      <SectionE data={data} />
      <SectionF data={data} />
      <SectionG />
    </div>
  );
}
```

Recharts is already a dependency. Use `LineChart`, `BarChart`, `AreaChart` for the trend visuals.

---

## Section 7: Phase 3 — Place Details with Strict Ceiling (target: 1 day)

Same as v1. After analytics is live (Phase 2), turn this on.

### 7.1 Conditional Place Details Fetch

**File:** `getRestaurants.ts` (in main handler, after tiering, before return)

```typescript
const DETAILS_PER_SEARCH_CAP = 5;
const STRONG_RESULTS_THRESHOLD = 5;

let detailsCallCount = 0;
if (intent.kind === 'DISH') {
  const strongCount = finalPlaces.filter(p => p.tier === 1 || p.tier === 2).length;
  if (strongCount < STRONG_RESULTS_THRESHOLD) {
    const dishWords = Array.from(new Set([
      (intent as any).label.toLowerCase(),
      ...((intent as any).rawWords || []),
      ...((intent as any).nameKeywords || []),
    ].filter(Boolean)));

    const ambiguousCandidates = finalPlaces
      .filter(p => (p.tier === 3 || p.tier === 4) && !p.reviewMentionsDish)
      .sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999))
      .slice(0, DETAILS_PER_SEARCH_CAP);

    await Promise.all(ambiguousCandidates.map(async (place: any) => {
      try {
        const detailsRes = await fetch(`${API_BASE_URL}/places/details/${place.id}`);
        if (!detailsRes.ok) return;

        const detailsData = await detailsRes.json();
        if (detailsData.budgetExhausted) return;  // gracefully degrade
        detailsCallCount++;

        const details = detailsData.place;
        if (!details?.reviews?.length) return;

        const reviewText = details.reviews.map((r: any) =>
          (r.text || '').toLowerCase()
        ).join(' ');

        if (dishWords.some(w => reviewText.includes(w))) {
          place.tier = 4;
          place.tierLabel = TIER_LABELS[4];
          place.reviewMentionsDish = true;
          place.reviews = details.reviews;
          place.editorialSummary = details.editorialSummary || place.editorialSummary;
        }
      } catch (_e) { /* best-effort */ }
    }));
  }
}
```

### 7.2 Daily Details Budget Cap in Worker

**File:** `cloudflare-worker-v7.12.js`

Add at top near CONFIG:
```javascript
const DAILY_DETAILS_BUDGET = 2500;  // Hard cap = $62.50/day = $1,875/mo
```

Modify `handlePlaceDetails`:

```javascript
async function handlePlaceDetails(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const placeId = pathParts[pathParts.length - 1];
  if (!placeId) return jsonResponse({ error: "Place ID required" }, 400);

  const forceRefresh = url.searchParams.get("forceRefresh") === "true";
  const cacheKey = `details_${placeId}`;

  if (!forceRefresh) {
    const cached = await getFromCache(env, cacheKey);
    if (cached) {
      return jsonResponse({ place: cached.data, cached: true, cacheAge: Math.round(cached.age / 1000) });
    }
  }

  // Daily budget check
  const today = new Date().toISOString().slice(0, 10);
  const budgetKey = `details_budget_${today}`;
  const todayCount = parseInt(await env.GLOBESKIMMERS_KV.get(budgetKey) || '0', 10);

  if (todayCount >= DAILY_DETAILS_BUDGET) {
    console.warn(`⚠️ Place Details daily budget reached (${todayCount}/${DAILY_DETAILS_BUDGET})`);
    return jsonResponse({
      error: "Daily Place Details budget reached",
      place: null,
      budgetExhausted: true,
    }, 200);
  }

  // ... existing Google API call logic ...

  // Increment counter after successful fetch
  await env.GLOBESKIMMERS_KV.put(
    budgetKey,
    String(todayCount + 1),
    { expirationTtl: 48 * 60 * 60 }
  );

  // ... return normalized data ...
}
```

---

## Section 7.5: Phase 4 — DishSearchGallery (target: 3–4 days)

A photo-first search view that surfaces actual dish photos from nearby restaurants. The user searches "pancakes" and sees a grid of pancake photos (each tagged via Haiku 4.5 menu OCR), tap a photo to see the restaurant. Genuinely differentiated — no other travel app does this — and the data infrastructure already exists.

### Why this is in launch (not deferred)

- Data dependencies are already in place: `photo_labels_v2` KV cache, `place.menuDishes` field, `dish:<name>` photo labels from `/label-photos`
- Marginal API cost is negligible: ~$10 one-time pre-warm for top 10 cities × 100 restaurants × 5 photos at $0.002/image; ongoing $20–50/month as new cities get queried naturally
- The feature is screenshot-worthy and marketing-worthy in a way "yet another restaurant finder" is not
- It's a *new view* on existing data, not new data infrastructure

### 7.5.1 Backend endpoint

**File:** Create a new Base44 function `getDishGallery.ts` (parallel to `getRestaurants.ts`).

**Behavior:**
1. Accepts: `latitude`, `longitude`, `radius` (miles), `dish` (string), `maxResults` (default 30)
2. Runs `getRestaurants` internally with the dish as the search query (reuses all tiering, caching, free fixes)
3. For each returned place, checks if any photo in `place.photos` has a label matching the dish via `photo_labels_v2` KV
4. Filters to only places with at least one matching photo
5. Returns array of `{place_id, place_name, place_address, lat, lng, distance_miles, rating, matching_photo_url, matching_photo_name, photo_label, tier, tierLabel}`

**Implementation skeleton:**

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const API_BASE_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', dishes: [] }, { status: 401 });

    const body = await req.json();
    const { latitude, longitude, radius = 16093, dish, maxResults = 30 } = body;
    if (!latitude || !longitude || !dish) {
      return Response.json({ error: 'latitude, longitude, dish required', dishes: [] }, { status: 400 });
    }

    // Reuse the existing restaurant search pipeline — all tiering + caching applies
    const restaurantsRes = await base44.functions.invoke('getRestaurants', {
      latitude, longitude, radius,
      maxResults: 40,
      cuisine: 'all',
      searchQuery: dish,
      forceRefresh: false,
    });

    const places = restaurantsRes?.data?.places || [];
    const dishLower = dish.toLowerCase().trim();
    const dishWords = dishLower.split(/\s+/).filter(w => w.length >= 3);

    // For each place, find any photo labeled as matching the dish
    const galleryItems: any[] = [];
    for (const place of places) {
      const photos = place.photos || [];
      if (!photos.length) continue;

      // Check Worker's label cache for this place
      const labelsRes = await fetch(`${API_BASE_URL}/label-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: place.id || place.placeId,
          photos: photos.slice(0, 5).map((p: any) => ({ name: p?.name || p })),
        }),
      });
      if (!labelsRes.ok) continue;
      const { labels } = await labelsRes.json();
      if (!labels) continue;

      // Find first photo whose label mentions the dish
      let matchingPhoto = null;
      let matchedLabel = null;
      for (const photo of photos) {
        const photoName = photo?.name || photo;
        const label = (labels[photoName] || '').toString().toLowerCase();
        if (dishWords.some(w => label.includes(w))) {
          matchingPhoto = photo;
          matchedLabel = label;
          break;
        }
      }

      if (matchingPhoto) {
        galleryItems.push({
          place_id: place.id || place.placeId,
          place_name: place.name || place.displayName?.text,
          place_address: place.shortFormattedAddress || place.formattedAddress,
          lat: place.latitude || place.location?.latitude,
          lng: place.longitude || place.location?.longitude,
          distance_miles: place.distanceMiles,
          rating: place.rating,
          matching_photo_url: matchingPhoto?.url || matchingPhoto?.full || matchingPhoto?.thumbnail,
          matching_photo_name: matchingPhoto?.name || matchingPhoto,
          photo_label: matchedLabel,
          tier: place.tier,
          tierLabel: place.tierLabel,
        });
      }

      if (galleryItems.length >= maxResults) break;
    }

    // Log analytics event
    fetch(`${API_BASE_URL}/log-event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feature: 'dish_gallery', event_type: 'search',
        user_id: user.id, lat: latitude, lng: longitude,
        metadata: { dish, result_count: galleryItems.length, places_checked: places.length },
      }),
    }).catch(() => {});

    return Response.json({
      dishes: galleryItems,
      count: galleryItems.length,
      query: dish,
      places_checked: places.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message, dishes: [] }, { status: 200 });
  }
});
```

### 7.5.2 Frontend page

**File:** Create `DishSearchGallery.jsx` in the Base44 app.

**UX flow:**
1. User opens the gallery (either from PlacesToEat header toggle or as a home-screen feature card)
2. Search bar at top: "Search for a dish..."
3. Below: a grid of photo cards (2 columns on mobile, 3–4 on desktop). Each card shows: the dish photo (large), restaurant name, distance, rating, tier badge
4. Tap a card → expands or routes to the restaurant detail (reuse PlacesToEat's `RestaurantCard` expanded view)
5. Empty states:
   - No search yet: show a few "popular dishes" chips (pizza, sushi, ramen, tacos, pancakes) — tap to fill search
   - No results for query: "No dish photos found nearby for '[query]'. Try a different dish or expand your radius."
   - Loading: skeleton cards

**Component structure:**

```jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from '@/components/location/LocationContext';
import { useDistanceUnit } from '@/components/location/distanceUnit';
import { base44 } from '@/api/base44Client';
import { logEvent, logFeatureOpen } from '@/lib/analytics';

const POPULAR_DISHES = ['pizza','sushi','ramen','tacos','pancakes','pho','burger','pasta'];

export default function DishSearchGallery() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [radius, setRadius] = useState(10);

  const { activeLocation } = useLocation();
  const { formatDistance } = useDistanceUnit(activeLocation);
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;

  React.useEffect(() => { logFeatureOpen('dish_gallery'); }, []);

  const handleSearch = async (q = query) => {
    if (!q.trim() || !lat || !lng) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const { data } = await base44.functions.invoke('getDishGallery', {
        latitude: lat, longitude: lng,
        radius: radius * 1609,
        dish: q.trim(),
        maxResults: 30,
      });
      setResults(data?.dishes || []);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCardTap = (item) => {
    logEvent('dish_gallery', 'tap', {
      place_id: item.place_id,
      place_name: item.place_name,
      dish: query,
      tier: item.tier,
    });
    // Navigate to restaurant detail or open modal — reuse PlacesToEat patterns
  };

  return (
    <div>
      <div className="header">
        <h1>What dish are you craving?</h1>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search for a dish (e.g., pancakes, ramen, tacos)..."
        />
        <button onClick={() => handleSearch()}>Search</button>
      </div>

      {!hasSearched && (
        <div className="popular-dishes">
          <p>Popular dishes:</p>
          {POPULAR_DISHES.map(d => (
            <button key={d} onClick={() => { setQuery(d); handleSearch(d); }}>
              {d}
            </button>
          ))}
        </div>
      )}

      {loading && <div>Loading dish photos...</div>}

      {!loading && hasSearched && results.length === 0 && (
        <div className="empty">
          No dish photos found nearby for "{query}". Try a different dish or expand your radius.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid">
          {results.map((item, i) => (
            <motion.div
              key={item.place_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="dish-card"
              onClick={() => handleCardTap(item)}
            >
              <img src={item.matching_photo_url} alt={item.photo_label} />
              <div className="card-info">
                <div className="place-name">{item.place_name}</div>
                <div className="meta">
                  ★ {item.rating?.toFixed(1)} · {formatDistance(item.distance_miles)}
                </div>
                {item.tierLabel && <span className="tier-badge">{item.tierLabel}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
```

(Use existing GlobeSkimmers theme tokens for styling — refer to `PlacesToEat.jsx` for color constants and spacing patterns.)

### 7.5.3 Pre-warm script for launch

**File:** Create `scripts/prewarm-dish-gallery.ts` (run once before launch).

**Purpose:** Populate the `photo_labels_v2` KV cache for top restaurants in top launch cities, so day-one users see populated galleries.

**Cities to pre-warm at launch:** Los Angeles, New York, San Francisco, Chicago, Miami, London, Paris, Tokyo, Bangkok, Mexico City. (Adjust based on expected user geography.)

**Per city:** fetch top 100 restaurants via `getRestaurants` (cuisine='all'), then for each call `/label-photos` to populate KV.

```typescript
// scripts/prewarm-dish-gallery.ts
// Run: deno run --allow-net scripts/prewarm-dish-gallery.ts

const API_BASE = 'https://globeskimmers-api.maizasimeon.workers.dev';
const BASE44_FN = 'YOUR_BASE44_GETRESTAURANTS_ENDPOINT';  // get from Base44 dashboard

const CITIES = [
  { name: 'Los Angeles',  lat: 34.0522, lng: -118.2437 },
  { name: 'New York',     lat: 40.7128, lng:  -74.0060 },
  { name: 'San Francisco',lat: 37.7749, lng: -122.4194 },
  { name: 'Chicago',      lat: 41.8781, lng:  -87.6298 },
  { name: 'Miami',        lat: 25.7617, lng:  -80.1918 },
  { name: 'London',       lat: 51.5074, lng:   -0.1278 },
  { name: 'Paris',        lat: 48.8566, lng:    2.3522 },
  { name: 'Tokyo',        lat: 35.6762, lng:  139.6503 },
  { name: 'Bangkok',      lat: 13.7563, lng:  100.5018 },
  { name: 'Mexico City',  lat: 19.4326, lng:  -99.1332 },
];

async function prewarmCity(city: { name: string; lat: number; lng: number }) {
  console.log(`Pre-warming ${city.name}...`);

  // 1. Fetch top 100 restaurants in city (10mi radius)
  const restRes = await fetch(BASE44_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YOUR_AUTH_TOKEN}` },
    body: JSON.stringify({
      latitude: city.lat,
      longitude: city.lng,
      radius: 10 * 1609,
      maxResults: 100,
      cuisine: 'all',
      searchQuery: '',
    }),
  });
  const restData = await restRes.json();
  const places = restData?.places || [];
  console.log(`  Found ${places.length} restaurants`);

  // 2. For each, call /label-photos
  let labeled = 0;
  for (const place of places.slice(0, 100)) {
    const photos = (place.photos || []).slice(0, 5).filter((p: any) => p?.name || typeof p === 'string');
    if (photos.length === 0) continue;
    try {
      const res = await fetch(`${API_BASE}/label-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: place.id || place.placeId,
          photos: photos.map((p: any) => ({ name: p?.name || p })),
        }),
      });
      if (res.ok) labeled++;
    } catch (_e) {}
    // Rate limit: 1 call/sec
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`  Labeled ${labeled}/${places.length} restaurants`);
}

for (const city of CITIES) {
  await prewarmCity(city);
}
console.log('Pre-warm complete.');
```

**Expected cost:** 10 cities × 100 restaurants × 5 photos × $0.002 = **$10 one-time**.

**Expected duration:** ~10 cities × 100 restaurants × 1 sec = ~17 minutes.

### 7.5.4 Integration with PlacesToEat

Add a toggle in PlacesToEat's header: **"List View" / "Photo Gallery"**. Tapping "Photo Gallery" routes to `DishSearchGallery` with the current search context preserved.

Also add a feature card to the home screen so users can discover the gallery on its own.

### Phase 4 Acceptance Criteria

| Test | Expected |
|---|---|
| Pre-warm script runs and completes | KV has labeled photos for top restaurants in 10 cities |
| Search "pancakes" in LA after pre-warm | Returns 10–20+ pancake photo cards from real restaurants |
| Search "kare kare" in Santa Clarita (niche dish, sparse coverage) | Returns 0–3 cards with honest empty state if zero |
| Search "pizza" anywhere in pre-warmed city | Returns 20+ pizza photo cards |
| Tap a card | Logs `dish_gallery.tap` event, routes to restaurant detail |
| Search a city NOT pre-warmed (e.g., Phoenix) | Returns fewer cards day-one; populates naturally as users search |
| Empty state for unknown dish | Shows "No dish photos found nearby for 'X'" message |

### Phase 4 Cost Impact on Projections

| Scale | Pre-warm | Ongoing OCR | Net add to monthly cost |
|---|---|---|---|
| Launch (one-time) | $10 | — | — |
| 1K daily users | — | ~$20/mo | $20/mo |
| 5K daily users | — | ~$50/mo | $50/mo |
| 50K daily users | — | ~$300/mo | $300/mo |

Negligible against the $4.1K/month total at 1K users.

---

## Section 8: Cost Guardrails (Non-Negotiable)

These limits MUST be enforced in code:

1. **5 Place Details calls per user search.** Enforced in `getRestaurants.ts` via `DETAILS_PER_SEARCH_CAP`.
2. **2,500 Place Details calls per day, globally.** Enforced in Worker via `DAILY_DETAILS_BUDGET` and KV counter.
3. **Photo OCR cached 180 days, max 5 photos per place per search.** Already enforced.
4. **Place Details cached 90 days.** Already enforced.
5. **Graceful degradation when caps are hit.** Search continues to work, just without Details hydration. Never throw an error to the user.
6. **No retroactive Details fetches.** If a search returns Tier 3/4 results, Details only fires inside that search request. No background batch processing.

---

## Section 9: Order of Operations

Do not skip the order:

1. **Phase 1 first** — pure refactor, zero new costs, immediate accuracy improvement. Test with the 10 acceptance queries before moving on.
2. **Phase 2 second** — analytics + dashboard. Get observability live BEFORE turning on the paid Place Details path.
3. **Phase 3 third** — Place Details with ceiling. Turn on only after you have baseline analytics data showing real user behavior.
4. **Phase 4 fourth** — DishSearchGallery. Build after Place Details is stable. Run the pre-warm script the day before public launch.

**Rationale:** Customer trust requires high accuracy (Phases 1+3) AND demoable differentiation (Phase 4). Customer trust is also damaged by sudden cost spikes that force you to pull features. Analytics-first (Phase 2) ensures you know exactly what each phase costs in your real user base before committing to it long-term.

---

## Section 10: Files to Modify

| File | Phase | Changes |
|---|---|---|
| `getRestaurants.ts` | 1 | DISH_MAP `nameKeywords`, dishWords update, remove bare `servesBreakfast`, verify/add `detectDietaryModifier`, rename TIER_LABELS |
| `getRestaurants.ts` | 2 | Add fire-and-forget `/log-event` call at end of handler |
| `getRestaurants.ts` | 3 | Add conditional Place Details fetch with 5-call ceiling |
| `getATMs.ts`, `getCoffee.ts`, `getRestroomLocations.ts`, `getShopping.ts`, `getThingsToDo.ts` | 2 | Add `/log-event` calls |
| `globeskimmers-tts.maizasimeon.workers.dev` TTS Worker | 2 | Add `/log-event` calls for play events |
| `cloudflare-worker-v7.12.js` | 2 | Add `/log-event`, `/admin/stats`, `/admin/user-detail` endpoints |
| `cloudflare-worker-v7.12.js` | 3 | Add `DAILY_DETAILS_BUDGET` cap in `handlePlaceDetails` |
| `PlacesToEat.jsx` | 1 | Update tier label references |
| `PlacesToEat.jsx`, `ATMFinder.jsx`, `CoffeeFinder.jsx`, `RestroomFinder.jsx`, `BasicPhrases.jsx`, `SmartPriceScanner.jsx`, `ThingsToDo.jsx`, etc. | 2 | Import `logEvent`, call `logFeatureOpen` and tap-tracking events |
| `src/lib/analytics.js` | 2 | New file — shared analytics utility |
| `AdminDashboard.jsx` | 2 | New file — founder dashboard |
| `wrangler.toml` | 2 | Bind ANALYTICS_DB |
| `schema.sql` | 2 | New file — D1 schema |
| `getDishGallery.ts` | 4 | New file — Base44 function backing the gallery |
| `DishSearchGallery.jsx` | 4 | New file — gallery page UI |
| `PlacesToEat.jsx` | 4 | Add "List View / Photo Gallery" toggle in header |
| `Home.jsx` (or wherever feature cards live) | 4 | Add "Dish Photo Gallery" feature card |
| `scripts/prewarm-dish-gallery.ts` | 4 | New file — one-time pre-warm script |

---

## Section 11: Out of Scope (Do Not Build Yet)

- Booking.com / Wise / Skyscanner / Viator affiliate integrations — separate workstream (founder is handling marketing/biz dev side, this handoff is engineering only)
- Premium / freemium paywall — separate workstream, month 2+
- Scale-stage optimizations (query dedup, pre-warming, field mask trimming, geographic sharding) — only relevant at 10K+ DAU; revisit at the 10K milestone, projected month 7–9 if growth holds
- AdMob API integration for revenue auto-pull — manual entry in dashboard is fine for launch

---

## Section 12: Questions to Ask Founder Before Starting

If ambiguous, ask before guessing:

1. "I see `detectDietaryModifier` is called but may not be defined. Should I add the stub from Section 5.4, or is it imported from another file I should look for?"
2. "For Section 5.1, the `nameKeywords` rule says 'include cuisine-specific synonyms.' For dish X, should the list include Y and Z?"
3. "The daily Details budget is 2,500 calls/day. Should this be higher or lower based on your expected launch user count?"
4. "The Admin Dashboard route — is there an existing admin role check in Base44, or should I gate it to your specific Base44 user UUID? If the latter, what's your UUID?"
5. "For TTS Worker logging in Section 6.3 — what's the exact URL or binding name for the analytics Worker? I assume it's the same Worker that handles `/log-event`, but I want to confirm the cross-Worker call setup."

---

## Section 13: Test Checklist (Per Phase)

**Phase 1:**
- [ ] All 10 acceptance query tests pass (Section 5.5 table)
- [ ] No regressions in cuisine searches (Italian, Thai, Mexican)
- [ ] No regressions in dietary filters (Vegan, Halal, Kosher chips)
- [ ] No regressions in restaurant-name searches (Starbucks, In-N-Out)
- [ ] No Worker deploy needed for Phase 1

**Phase 2:**
- [ ] D1 database created and bound
- [ ] Searches log to D1 within 30 seconds (verify with `wrangler d1 execute globeskimmers-analytics --command="SELECT * FROM events ORDER BY id DESC LIMIT 5"`)
- [ ] Taps log to D1
- [ ] `/log-event` endpoint returns `{logged: true}`
- [ ] `/admin/stats?days=7` returns all six data sets
- [ ] AdminDashboard.jsx renders without errors
- [ ] All 12 features have `logFeatureOpen` wired in
- [ ] Estimated cost in dashboard matches actual Google Cloud / Anthropic console within 10% (check next day)

**Phase 3:**
- [ ] Easy searches return `detailsCallCount: 0` (e.g., "pancakes" in Santa Clarita)
- [ ] Hard searches return `detailsCallCount: 1–5` (e.g., "kare kare" in suburbs)
- [ ] Daily budget cap returns `budgetExhausted: true` gracefully when exceeded
- [ ] KV cache hits drop Details calls to near zero on repeat hard searches
- [ ] Tier 4 results show "Serves It" badge with review-mention evidence

**Phase 4:**
- [ ] `getDishGallery.ts` function deployed and returns valid response shape
- [ ] `DishSearchGallery.jsx` renders without errors
- [ ] Search bar accepts dish input, Enter key fires search
- [ ] Popular dishes chips work (pizza, sushi, ramen, etc.)
- [ ] Pre-warm script runs and completes in ~15–20 minutes for 10 cities
- [ ] After pre-warm: searching "pancakes" in LA returns 10+ photo cards
- [ ] Empty state shows for unknown dishes
- [ ] Tap on card logs `dish_gallery.tap` event and routes correctly
- [ ] Toggle between "List View" and "Photo Gallery" in PlacesToEat works
- [ ] Analytics dashboard now shows `dish_gallery` in feature usage breakdown

---

## Section 14: How to Hand This to Claude Code

1. Save this document to your repo as `docs/search-handoff-v3.md`
2. Commit it: `git add docs/search-handoff-v3.md && git commit -m "Add v3 handoff: search + analytics + dish gallery"`
3. Open Claude Code in your VS Code workspace
4. Tell Claude Code: *"Read docs/search-handoff-v3.md and walk me through your plan for Phase 1 before making any changes. Open getRestaurants.ts and confirm the current state of DISH_MAP."*
5. Review Claude Code's plan. Approve or revise. Then proceed.
6. After each phase passes its acceptance criteria, move to the next.
7. **Do not paste this entire document into Claude Code's chat.** Reading the file from disk is cleaner and preserves the file's structure.

---

End of v3 handoff.
