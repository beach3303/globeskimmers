# GlobeSkimmers — Claude Code Context (HISTORICAL SNAPSHOT — March 2026)

> ## ⚠️ DO NOT USE THIS AS A REFERENCE
>
> **This file is a point-in-time snapshot from March 22, 2026 and is no longer maintained.**
> It was the authoritative context doc; it is not any more. Read `CLAUDE.md` instead — it is
> current and verified against the code.
>
> Known-wrong in the text below, as of August 2026:
> - Names `cloudflare-worker-v7.6.js` as the deployed worker. The live worker is
>   `cloudflare-worker-v7.12.js` (see `wrangler.toml`).
> - Describes the data path as Frontend → Base44 Deno Functions → Worker. The frontend now
>   calls the Worker **directly** (`src/lib/callWorker.js`); `base44/functions/` is legacy.
> - Lists D1 and R2 as `[PENDING]`. Both are live — two D1 databases and an R2 bucket are
>   bound in `wrangler.toml`.
> - Says the Worker is a manual dashboard deploy. It auto-deploys from
>   `.github/workflows/deploy-workers.yml` on push to `main`.
> - Gives restaurant tier labels (Authentic / Specialist / Has It / Not Specialist) that do not
>   match the live `TIER_LABELS` (Dish Specialist / Authentic Match / Related / Serves It).
> - Its "Known Remaining Bugs" and "Implementation Priority Order" predate
>   `docs/PRODUCT_AUDIT_2026-08.md`, which supersedes them.
>
> Kept for history: it records why several design decisions were made.

---

## PART 1: ARCHITECTURE

```
User (iOS / Web App)
    ↓
Base44 React Frontend  (src/pages/*.jsx)
    ↓
Base44 Deno Functions  (functions/*.ts)  — TypeScript/Deno, auto-deploy via Base44
    ↓
Cloudflare Worker      (cloudflare-worker-v7.6.js)  — MANUAL deploy to Cloudflare dashboard
    ├── KV Cache (GLOBESKIMMERS_KV)
    │   ├── Text search:   12hr TTL
    │   ├── Nearby search: 3-day TTL
    │   └── Details/Photos: 90-day TTL
    ├── [PENDING] D1 Database — permanent place storage, menus, user feedback
    └── [PENDING] R2 Bucket  — user-uploaded photos
    ↓
Google Places API (New) v1
```

### Active Versions
| Component | Version | Notes |
|-----------|---------|-------|
| PlacesToEat Frontend | v6.4 | `src/pages/PlacesToEat.jsx` |
| getRestaurants Backend | v5.0 | `functions/getRestaurants.ts` |
| Cloudflare Worker | v7.8 | `cloudflare-worker-v7.6.js` (file name outdated) |
| KV Namespace | `GLOBESKIMMERS_KV` | Cloudflare |

**Worker v7.8 is in the local file but NOT yet deployed to Cloudflare.**
Until deployed, server-side filters (openNow, minRating, priceLevels) do not work.

---

## PART 2: PLACES TO EAT — CURRENT STATE (FULLY IMPLEMENTED)

### What Was Fixed / Built
| Version | Change |
|---------|--------|
| v4.8 | Search bar fix — `nearbyTypeList = []` when `searchQuery` set; nearby type searches no longer drown text search |
| v4.9 | Intent-Aware Search — `parseSearchIntent()`, `CULTURAL_INTENTS`, `DISH_MAP`, tier 1–4 system |
| v5.0 | Server-side filters — `filterOpenNow`, `filterMinRating`, `filterMaxPrice` → sent to Google API |
| v5.0 | Sports Bar fix — intent-driven fetch skips generic cuisine queries; excludes karaoke/comedy clubs |
| v5.0 | Honest Fallbacks — `FallbackDisclaimer` banner when no Tier 1/2 results |
| v6.4 | Tier badges on cards, "About This Place" section (editorialSummary), query appending |

### Intent-Aware System (getRestaurants.ts)
- **UMBRELLA:** "Asian food" → Chinese/Japanese/Korean/Thai/Vietnamese/Filipino ONLY (NOT Indian/Middle Eastern)
- **DISH:** "sushi" → tier1: `sushi_restaurant`, tier2: `japanese_restaurant`
- **GENERAL:** no special sorting — use rating + distance
- **Tier 1** = Authentic (green ✓ badge), **Tier 3** = Has It (yellow ~), **Tier 4** = Not Specialist (gray ?)
- `nearbyTypeList = searchQuery?.trim() ? [] : (cuisine === 'all' ? NEARBY_TYPES_ALL : ...)`

### Server-Side Filters (requires Worker v7.8 deployed)
- `filterOpenNow` → `openNow: true` in Google body
- `filterMinRating` → `minRating` in Google body
- `filterMaxPrice` → `priceLevels: [...]` array in Google body
- Cache key includes filter suffix to prevent stale cross-filter cache hits

### Card Features (working in UI)
- Photo carousel (swipe, 1/10 indicator)
- Ranking badges (#1 gold, #2 silver, #3 bronze)
- Smart badges: Authentic, Hidden Gem, Top Rated, Has It, Not Specialist
- WHY box with tier context
- Service tags: Dine-in, Takeout, Delivery, Reservable
- Open/Closed + hours (expandable, current day highlighted)
- Seating section with Confirmed badge
- Parking section with Confirmed badge
- Tap-to-call, Directions / Map / More buttons
- 5 Google reviews shown
- About This Place (editorialSummary)

### Known Remaining Bugs (Places to Eat)
1. **Pasta → Korean restaurant first** — intent tiering should fix this but verify it's actually sorting correctly end-to-end
2. **Reviews missing for some restaurants** — Google Text Search doesn't always return reviews; needs Place Details call for top results
3. **Halal/Kosher zero results** — client-side `detectDietary()` too strict; dietary endpoint exists but matching is weak
4. **Parking data lost in pipeline** — Worker `normalizePlace()` returns `parkingOptions` but `getRestaurants.ts` may not pass it through; `PlacesToEat.jsx` `processRest()` sets `parking: place.parking || null` which may always be null
5. **Seating trust badge always ⚠️** — `seatingSource` never set to `'api'`
6. **Customer Favorites threshold** — Worker has `count >= 2`; should be `count >= 1` (needs Worker redeploy)

---

## PART 3: OTHER FEATURES — CURRENT STATE

### Things to Do
- **Status: 0 results** — likely query parameter name mismatch between frontend and Worker
- Fix: Audit fetch call in `functions/getActivities.ts` — ensure `query` field (not `searchQuery`)
- Also: Add Wikipedia integration — `https://en.wikipedia.org/api/rest_v1/page/summary/{name}`
- Also: Restore all filter chips (Culture, Outdoors, Fun, Nightlife, Family, Free, Bucket List, Audience)

### Shopping
- **Status: Needs architecture overhaul**
- Critical crash: `r.text.toLowerCase()` when `r.text` is an object — add `safeLower()` helper
- Missing: Food Shopping categories (supermarkets, warehouse clubs, farmers markets, etc.)
- Broken: Category filter uses `QUERIES.filter(q => q.includes(category))` — replace with `CATEGORY_QUERIES[category]` map

### Restroom Finder
- **Status: 0 results** — Google has no "restroom" place type
- Fix: Search for venues that HAVE restrooms (coffee shops, parks, malls, transit) and infer `hasRestroom: true`

### ATM Finder
- **Status: Map popup truncated** — parent container overflow or z-index issue
- Fix: Reduce popup `maxWidth` to 220; check Leaflet popup z-index

### Convenience Store
- **Status: Missing action buttons** — no Directions/Map/Hours on cards
- Fix: Add using same pattern as PlacesToEat

### Coffee Finder, Money Exchange, Weather, etc.
- Not audited — assumed working

---

## PART 4: PENDING FEATURES (Not Yet Implemented — From Claude.com Planning)

### 4.1 Cloudflare D1 Database (MEDIUM PRIORITY)
**Purpose:** Store places permanently — eliminate repeat Google API calls ($0.032/call)

**Setup:**
```bash
wrangler d1 create globeskimmers-db
# Add to wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "globeskimmers-db"
# database_id = "..."
wrangler d1 execute globeskimmers-db --file=schema.sql
wrangler deploy
```

**Key Tables:**
| Table | Purpose |
|-------|---------|
| `places` | All Google Places data (100K+ records, permanent cache) |
| `menus` | Restaurant menus (JSON, cached forever) |
| `menu_items` | Individual dishes for search |
| `tips` | Universal tips/reviews for all finders |
| `restaurant_feedback` | Dish accuracy, parking verify |
| `atm_feedback` | Fee amount, location accuracy |
| `restroom_feedback` | Amenities, cleanliness |
| `coffee_feedback` | WiFi, outlets, noise |
| `activity_feedback` | Worth it, wait time, best time |
| `activity_stats` | Aggregated Worth It % scores |
| `convenience_feedback` | Good/Okay/Safe ratings |
| `photos` | Photo metadata (actual files in R2) |
| `users` | Simple user accounts |
| `saved_places` | User favorites with lists |
| `search_logs` | Analytics |
| `interactions` | Views, directions, calls |

**Views:**
- `trending_places` — 7-day weighted interactions
- `top_tips` — highest upvoted tips
- `low_fee_atms` — cheapest ATMs
- `best_restrooms` — highest scored restrooms
- `worth_it_activities` — highest Worth It % activities

**Cost at 10K users: $0** (within Cloudflare free tier — D1 5GB/5M reads/100K writes per day)

### 4.2 Menu System (LOW PRIORITY until D1 exists)
**Storage:** D1 `menus` table — scrape once, cache forever

**Menu JSON structure:**
```json
{
  "sections": [
    { "name": "Pasta", "items": [
        {"name": "Carbonara", "price": 24, "desc": "Pancetta, egg, pecorino"}
    ]}
  ]
}
```

**UI:** Collapsible sections, Popular badge, item count, "View full menu" button, "Menu outdated?" report, "Updated Mar 15" text (NO freshness color indicators)

**Sources:** website_scrape, user_upload, photo_ocr, user_manual

### 4.3 User Engagement / Feedback Forms (MEDIUM PRIORITY)

**Universal (all finders):**
- Tips/reviews with upvote/downvote
- Source badges: "Google" (gray) vs "GlobeSkimmers" (teal)
- Review filter tabs: All / Google / GlobeSkimmers

**Places to Eat:**
- Dish accuracy thumbs (triggered after directions tap)
- Add dish recommendation
- Verify parking Yes/No
- Report outdated hours
- Food photo upload

**ATM Finder:**
- Fee slider ($0–$10+)
- Location accuracy radio
- Pro tip text

**Restroom Finder:**
- Amenities checklist: Clean, TP, Seat covers, Bidet, Sink, Soap
- Hand drying radio: Paper towels / Hand dryer / Neither
- Rating: Good / Okay / Avoid
- Photo upload
- **Score:** Clean(2) + TP(2) + Sink(1.5) + Covers(1) + Bidet(1) + Soap(0.5) + Drying(0.5) + Good(2)/Okay(1)/Avoid(-2) = 0–10

**Coffee Shop:**
- WiFi: Fast / Slow / None
- Outlets: Plenty / Few / None
- Noise: Quiet / Lively / Loud
- Seating: Easy / Limited / Full
- Pro tip text

**Things to Do:**
- Worth it? Yes! / It's okay / Skip it
- **Worth It %:** (Yes + Okay×0.5) ÷ Total × 100
- Price range: Free / $ / $$ / $$$
- Wait time: None / 15 min / 30 min+ / 1 hr+
- Best time: Morning / Afternoon / Evening / Weekday / Weekend (multi-select)
- Photo upload

**Convenience Store:**
- Rating: Good / Okay / Safe
- Pro tip text

### 4.4 Photo Upload — R2 (LOW PRIORITY)
**Storage:** Cloudflare R2 — 10GB free, zero egress fees
**Path:** `photos/{place_type}/{place_id}/{uuid}.jpg`
**Types:** Food photos, restroom, coffee, activities

---

## PART 5: IMPLEMENTATION PRIORITY ORDER

1. ✅ **Intent-Aware Search** — implemented (v4.9/v5.0)
2. ✅ **Sports Bar fix** — implemented (v5.0)
3. ✅ **Honest Fallbacks** — implemented (v5.0/v6.4)
4. 🔴 **Deploy Worker v7.8** — local file ready, needs Cloudflare dashboard deploy
5. 🔴 **Things to Do — fix 0 results** — audit `getActivities.ts` query params
6. 🔴 **Restroom Finder — fix 0 results** — venue-based inference strategy
7. 🟡 **Places to Eat remaining bugs** — parking pipeline, seating source, dietary matching
8. 🟡 **Shopping overhaul** — safeLower crash fix, CATEGORY_QUERIES map, food categories
9. 🟡 **ATM map popup fix** — z-index/width
10. 🟡 **Convenience Store** — add Directions/Map/Hours buttons
11. ⚪ **D1 Database setup** — wrangler commands + schema deploy
12. ⚪ **User engagement forms** — tips, feedback per finder (needs D1 first)
13. ⚪ **Menu system** — scrape + display (needs D1 first)
14. ⚪ **Photo upload (R2)** — needs D1 first

---

## PART 6: GOOGLE PLACES API REFERENCE

### Valid Field Mask Fields
```
places.id, places.displayName, places.formattedAddress, places.location,
places.rating, places.userRatingCount, places.priceLevel, places.types,
places.regularOpeningHours, places.currentOpeningHours, places.photos,
places.reviews, places.editorialSummary, places.websiteUri,
places.nationalPhoneNumber, places.primaryType, places.primaryTypeDisplayName,
places.businessStatus, places.servesBeer, places.servesWine,
places.servesCocktails, places.servesVegetarianFood, places.outdoorSeating,
places.liveMusic, places.delivery, places.dineIn, places.takeout,
places.reservable, places.goodForGroups, places.goodForChildren,
places.parkingOptions
```

### INVALID Fields (cause 400 errors — do not use)
- `places.shortFormattedAddress`
- `places.serviceOptions`
- `places.accessibilityOptions`

---

## PART 7: KEY CODE PATTERNS

### safeTextLower (crash fix for non-string review values)
```javascript
const safeTextLower = (val) => {
  if (typeof val === 'string') return val.toLowerCase();
  if (val && typeof val === 'object' && val.text) return val.text.toLowerCase();
  return '';
};
```

### Review author normalization
```javascript
const authorName = review.authorDisplayName || review.author || 'Anonymous';
```

### Customer Favorites extraction
```javascript
// count >= 2 in Worker (should be >= 1 — needs redeploy)
// Filter generic words: "food", "place", "restaurant", "service"
```

---

## PART 8: DESIGN PREFERENCES (Maiza's)

- **Clean, sophisticated, space-efficient** — NO playful or cluttered UI
- **Cost-conscious** — cache aggressively, every API call matters
- **Honest UX** — fallback disclaimers when results aren't great
- **Quality over quantity** — 6 great matches beats 20 mediocre ones
- **Review sources** — always show Google vs GlobeSkimmers labels
- **No freshness color dots** — just show "Updated Mar 15" text
