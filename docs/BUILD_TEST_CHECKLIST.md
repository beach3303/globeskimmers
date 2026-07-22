# Build → Test Checklist

Every feature build gets a row here with concrete test steps. A build isn't "done" until **Tested ✅**.
Claude adds new builds here as they're made; you check them off as you test.

**Legend:** ⬜ not done · ✅ done · 🟡 partial · ⏳ waiting (external) · ❌ blocked/failed

> 📱 **Device build is current** — `npm run build && npx cap copy ios` run 2026-07-17, so items 1–3 are ready to test in the Simulator/device (set a Simulator location: Features → Location → Custom, e.g. New York 40.7128, -74.0060).

| # | Build | Committed | Deployed / Live | Tested | Notes |
|---|-------|-----------|-----------------|--------|-------|
| 1 | Home-city timezone (city → exact tz + Here/Selected/Home clocks) | ✅ | ⬜ (frontend not pushed) | ⬜ | SQL ran ✅; device test pending |
| 2 | Engagement rows — Wave 1 (`/home/rows` + HomeRows) | ✅ `daa954d`,`f07dbb2` | ✅ worker | 🟡 curl ✅ / in-app ⬜ | endpoint returns real NYC rows via curl; needs in-app render test |
| 3 | Silent auto-follow location + Settings toggle | ✅ `5cfa72e` | ⬜ (frontend not pushed) | ⬜ | move-cities test pending |
| 4 | Reverse-geocode cache (30-day) | ✅ `cc201de` | ✅ `b63ecd3c` | ✅ | verified: call 1 miss → call 2 `cached:true` (London) |
| 5 | AdMob production ads | ✅ (prior) | ✅ live | ✅ | real ad seen on device 2026-07-16 |
| 6 | app-ads.txt (globeskimmers.io) | — (Base44) | ✅ live | ✅ | curl returns plain text 200 |
| 7 | Demand + tap logging (HomeRows → D1) | ✅ `53b4d3e` | frontend-only (in device build) | ⬜ | logs home_rows_view + card_tap + see_all; verify events land in D1 |
| 8 | Trending row (reads tap events → /home/rows) | ✅ `99724e9` | ✅ `b63ecd3c` | ⬜ | leads with top-tapped nearby places once ≥4 exist; empty until data |
| 9 | B2B/admin demand view (demand_by_city + trending_places) | ✅ `0708342` | ✅ deployed | ⬜ | admin panels live; fill as event data accumulates |
| 10 | Unsplash "Where to next" global rows | ✅ `697d873` | ✅ deployed + key set | ✅ | verified: Boise → "Where to next" w/ real photos + attribution |
| 11 | Unsplash photo fallback for owned cards | ✅ `fa5c403` | ✅ `80aa8640` | ✅ | verified: LA "Tonight nearby" 10/10 cards have photos + credit |

---

## Test steps

### 1 · Home-city timezone
- [ ] Settings → set a home **city** (e.g., Los Angeles) → reload → it persisted
- [ ] Home shows the correct **home timezone** (LA → Pacific, not Eastern)
- [ ] Here / Selected / Home clock rows only appear when their zones actually differ

### 2 · Engagement rows (Wave 1)
- [x] Endpoint returns rows via curl (verified: NYC → Times Square, Statue of Liberty)
- [ ] Rows render on **Home** (below Money Exchange) in a seeded city
- [ ] Swipe a row **sideways**; cards show photo + name + meta
- [ ] **"See all"** opens the correct finder page
- [ ] Two opens at different times of day show **different** row titles/order
- [ ] Outside a seeded city → **no empty rows** (falls back cleanly)
- [ ] Rows also render on the **iPad/tablet** layout (full-width, larger cards)

### 3 · Silent auto-follow location
- [ ] In GPS mode, move ~>10km to a new city → results/rows update to the new city
- [ ] On app **foreground** in a new city → it refreshes
- [ ] A **manually-picked** city (navigate mode) is **NOT** overridden
- [ ] Settings toggle "Update to my location as I travel" shows and turns it off

### 4 · Reverse-geocode cache ✅
> Fixed (await the KV put) + redeployed `b63ecd3c`. Verified 2026-07-17: London call 1 `cached:false` → call 2 `cached:true`.
- [x] Deploy the worker with the await fix
- [x] `curl` the same coords twice → 2nd response `"cached": true`
- [x] City name correct for the coords

### 5 · AdMob production ads
- [x] Real (non-"Test mode") ad shows on the live App Store build

### 6 · app-ads.txt
- [x] `https://globeskimmers.io/app-ads.txt` returns the plain-text line, 200

---

### 7 · Demand + tap logging
Frontend-only (no worker deploy) — events flow via `trackEvent → logEvent → D1`. Reading/aggregating them (trending row, B2B dashboard) is a later build that needs a new allowlisted `ANALYTICS_QUERIES` entry.
- [ ] Load Home in a city → a `home_rows_view` event fires (city / country / intent / row_count)
- [ ] Tap a card → `home_row_card_tap` (place_id, name, category, city, country)
- [ ] Tap "See all" → `home_row_see_all` (row, action)
- [ ] Verify in D1: `wrangler d1 execute globeskimmers-events --remote --command "SELECT event_type, payload, ts FROM events WHERE event_type LIKE 'home_%' ORDER BY ts DESC LIMIT 10"` shows the rows

### 8 · Trending row
> Needs tap data (build #7) to accumulate + a worker redeploy. Correctly **empty** until ≥4 nearby places have been tapped in the last 7 days.
- [ ] `wrangler deploy` the worker (also ships the geocode-cache fix #4)
- [ ] Once card taps exist, `/home/rows` returns a **"Trending in {city}"** row (leads the list)
- [ ] With no tap data → trending row does **not** appear (no empty row)

### 9 · B2B / admin demand view
> Needs event data (#7) + a worker redeploy. Panels fill as `home_rows_view` / `home_row_card_tap` events accumulate.
- [ ] `wrangler deploy` the worker (adds the 2 allowlisted queries)
- [ ] Admin → Analytics shows **"Travel demand by city"** + **"Trending places"** panels
- [ ] With data, cities + tapped places rank correctly; friendly empty message otherwise

### 10 · Unsplash "Where to next" global rows
> Gated on `UNSPLASH_ACCESS_KEY`. Without it, the row is silently skipped (no error). Get a free key at unsplash.com/developers, then `wrangler secret put UNSPLASH_ACCESS_KEY`.
- [ ] `wrangler deploy` the worker (also ships #9's demand queries)
- [ ] Get an Unsplash Access Key + `wrangler secret put UNSPLASH_ACCESS_KEY`
- [ ] `/home/rows` in a NON-seeded city returns a "Where to next ✈️" row (not empty)
- [ ] Cards show the "📷 name / Unsplash" credit (required attribution)

| 12 | Analytics growth pack (DAU/WAU/MAU, retention, stickiness, taps/session) | ✅ `bdce98c` | ✅ `5265dcd0` | ⬜ | Admin→Analytics → Growth & Retention panel + active-users chart (test later) |

## 📋 Device-test findings (2026-07-17 device pass — backlog)
- [x] Engagement rows render on device (phone) — verified in screenshots
- [x] `home_rows_view` logging fires — seen in Admin → Analytics event breakdown
- [x] **Card tap → opens the attraction's own detail** (fixed 2026-07-17; was routing to the list)
- [x] **Directions → Waze/Apple/Google chooser** (origin = user location) — fixed `b44e68e`
- [ ] **Full rich card** — address · tap-to-call phone · today's hours · AI details. Needs an on-tap fetch (resolve owned attraction → Google place_id → /places/details + getAIDetails, cached). Bigger build.
- [ ] 🔍 **Search-location modal overflows above the top safe-area** — pin the header/input below the notch, scroll only the results (`LocationModePicker.jsx`)
- [ ] 📷 **Owned cards show a pin, no photo** — `ATTRACTIONS_DB` has **zero `photo_url`**. Fix: backfill Wikimedia photos into the DB (owned, best for landmarks) OR Unsplash-fallback per attraction in the row builder (reuses `fetchUnsplashPhoto`, gated on key)
- [ ] 📰 **More feed-forward layout** — more rows, photo-forward cards, lead with the feed above the tiles (Living-Homepage direction)
- [ ] 📈 **Analytics growth pack** — DAU/WAU/MAU, retention (D1/D7/D30), stickiness, monthly signups, rows-per-session, onboarding funnel

## 💰 Cost-optimization pass (2026-07-17)
- [x] **`/invoke-llm` now cached** (KV, 30d, `aa1e9ce`) — was the only uncached AI endpoint (~5¢/call). **Needs `wrangler deploy`.** Test: call the same prompt twice, 2nd is instant/free.
- [x] Verified **tile cache already exists** (~11km grid) and **lazy photos already exist** (detail loads current photo only) — no work needed.
- [ ] (Later) **Conditional atmosphere field mask** — lean search mask by default, atmosphere fields only when a SmartFilter is active (~$0.005/search saved on unfiltered searches).
- [ ] **Verify real Google bill tier** — search mask may bill Enterprise+Atmosphere (~$0.040), not the $0.005 the stale code comment claims.

## 🗺️ Owned Places DB — pilot (NYC) — scaffolding built 2026-07-17
Scripts in `scripts/places-pilot/`. Untested until you run DuckDB locally. Paste me any errors and I'll fix (Overture field paths are the main risk).
- [x] `brew install duckdb` ✅ (1.5.4)
- [x] `duckdb < 02_extract.sql` ✅ **484,400 places** extracted 2026-07-17; quality good (normalized categories, ~80% phone / ~60% website in sample). Note: bbox is a rectangle so it includes NYC-metro NJ (Woodbridge etc.) — fine/more coverage. Overture carries some closed businesses (has `date_closed` to filter later). Fixed bug: quote `"primary"` (reserved word).
- [x] Run `01_schema.sql` in Supabase ✅ (PostGIS + `places` table + spatial index created)
- [x] `duckdb < 03_load.sql` ✅ **484,400 rows loaded** into Supabase 2026-07-18. Gotcha: bulk load hit Supabase's default `statement_timeout` at ~99% and rolled back to 0 — fix = `alter role postgres set statement_timeout = '3600s';` then re-run. Use the SESSION POOLER connection (IPv4). Connect via keyword string (not URI) so `!` in the password needs no encoding.
- [x] Validate: Times-Square radius query ✅ 2026-07-18 — returned 20 real places ranked by exact meters (Times Square Building @ 6m, Morosco Theatre, Sunglass Hut, McDonald's, Duane Reade…). **PILOT PROVEN end-to-end: own ingest → own PostGIS store → own spatial search, $0 ongoing.**
- [ ] (Next build) Worker read-path: query `places` first, fall back to Google where thin / for live hours
- [ ] Eyeball phone/website coverage (`where phone is not null`) — measures the real fill-rate we couldn't get from docs
- [ ] (Next build) Worker read-path: query `places` first, fall back to Google where thin

## 📸 Photo swipe (2026-07-18) — `07ab112`
Added `useHorizontalSwipe` hook → swipe left/right on ENLARGED photos. Device build synced (`npx cap copy ios`).
- [ ] Restaurant detail (PlacesToEat) → open a place with ≥2 photos → **swipe the header photo** left/right → it pages
- [ ] Coffee / ATM / Restroom / Things-to-Do → tap a photo to enlarge (PhotoGalleryModal) → **swipe** pages through
- [ ] Activity detail → **swipe** the big header image → pages; thumbnail strip below still scrolls + tap-selects
- [ ] Swiping down/vertically still dismisses / scrolls (swipe hook ignores vertical drags — shouldn't fight it)
- [ ] Convenience-store + in-card carousels (already had swipe) still work

## 🏛️ Rich owned attraction page (2026-07-18)
Turns "Explore more" into a full page powered by owned/free data. **Activate:** set 2 secrets + `wrangler deploy` (see below).
- [x] #2 "Explore more" → full ActivityDetail page (not the list) — `a0fa65e`
- [x] #3 Owned Wikimedia photos (Worker `/places/wiki-photos`, cached 180d) + swipeable gallery + credit — `253ee4e` — **needs deploy**
- [x] #4 Owned address from Overture read-path — `9a4b099` — **needs #1 secrets + deploy**
- [ ] **Activate #1:** `wrangler secret put SUPABASE_URL` (→ https://bkaxadiyehddzkiuheea.supabase.co), `wrangler secret put SUPABASE_SERVICE_KEY` (→ service_role), then `wrangler deploy`
- [ ] Test: `curl -s -X POST .../places/wiki-photos -H 'Content-Type: application/json' -d '{"name":"Times Square","lat":40.758,"lng":-73.9855}'` → returns photos[]
- [ ] Device: tap a "place to go" card → Explore more → full page with **multiple swipeable photos** + credit; address shows once read-path is live
- [ ] Quality check: photos are mostly the actual place (filter drops pre-2000/maps/docs/logos) — flag any junk

## 🗺️ Finder migration → owned planet DB (2026-07-22)
Swap the finder DATA source from rented Google to our OWNED 75M-place planet DB. Same cards / AI-details / map — just fed by free data + free photos.

### Restaurants — `65afedb` · deployed `62efdbb0` · Tested ⬜
- [x] List comes from planet DB (`/restaurants-full`), $0 per search, no Unsplash tiles
- [x] On first expand → `/places/enrich-owned` fetches **3 real Google photos + hours** (cached), review-count removed from card
- [ ] Device: PlacesToEat in NYC → cards show cuisine tile, expand → 3 real photos of that place + today's hours + open/closed bar
- [ ] Cost check: default page load doesn't fire Google list calls (planet DB only); photos only on tap

### Things-to-Do — `ef7945b` · **needs SQL + deploy** · Tested ⬜
**Activate:** (1) run `scripts/finders/attractions.sql` in Supabase SQL editor, (2) `cd "…/globeskimmers-cacf36e4-10" && wrangler deploy`
- [x] Worker: `api.nearby_attractions` RPC → mapped to card shape, Wikimedia photos hydrated top-10, deduped vs curated/Google
- [x] Frontend: new "📍 Nearby Attractions" TierSection reads `data.nearbyAttractions` (+ cached)
- [ ] Verify RPC: `curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/nearby_attractions" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{"in_lat":40.758,"in_lng":-73.9855,"in_radius_m":20000,"in_limit":24}'` → attraction rows
- [ ] Device: ThingsToDo in a mid-size city (not just NYC) → **National Icons / Regional rows unchanged**, plus a new "Nearby Attractions" row with real photos
- [ ] Edge: a location with NO curated icons still shows Nearby Attractions from planet DB (global coverage proof)

## 📸 Guestbook photo upload — crowdsource food/place photos (2026-07-22)
Let signed-in users attach ONE photo to a guestbook note. Client resizes → Worker moderates (Claude vision, fails closed) → stores in R2 → serves at `/gb-photo/<key>`. Photos purged from R2 on note-delete + account-delete. **No passport stamp** (stamps stay travel-only).
**Activate:** (1) run `scripts/guestbook/02_photos.sql` in Supabase, (2) `wrangler r2 bucket create globeskimmers-media`, (3) `wrangler deploy`, (4) publish `legal/terms.html` (UGC-license + DMCA) to globeskimmers.io.
- [x] Worker: `/guestbook/photo-upload` (moderate→R2), `/gb-photo/<key>` serve, sign saves photo cols, delete + account-delete purge R2
- [x] Frontend: photo picker + client resize + preview + lightbox + public/license disclosure
- [x] SQL migration + R2 binding + Terms draft committed
- [ ] Verify bucket: `wrangler r2 bucket list` shows `globeskimmers-media`
- [ ] Device: open a place → Guestbook → Sign → "📸 Add a photo" → pick a food photo → "Checking…" → preview → Sign → photo shows in the note
- [ ] Moderation: try a clearly non-food/inappropriate image → rejected with a friendly message, note not blocked
- [ ] Delete: delete your note → photo 404s at its URL (purged from R2)
- [ ] Must-Try prompt shows "Add a photo of your dish" copy
- [ ] Confirm NO passport stamp fires for a food-photo post

### Coffee — `PENDING` · **needs SQL + deploy** · Tested ⬜
**Activate:** (1) run `scripts/finders/coffee.sql` in Supabase, (2) `wrangler deploy`
- [x] Worker `/coffee-owned` (RPC `nearby_coffee`) → card shape, free list, cached per-tile
- [x] Frontend fetch swapped to `getCoffeeOwned`; card enrich-on-expand (3 Google photos + hours), open bar + daily hours from enrich
- [x] Owned→Google resolver shared: café work-profile + AI details now pass name+lat/lng and resolve the UUID (reuse enrich's warm cache)
- [ ] Device: Coffee finder in NYC → cards (chains detected by name, ☕ tile), expand → 3 real photos + open/closed + daily hours
- [ ] Expand → "Good for working" panel loads (wifi/outlets/noise) and AI details load for an owned shop
- [ ] Cost check: default load fires no Google list calls; only expanded shops cost

## Template for a new build
```
### N · <feature name>
State: Committed <hash> · Deployed <where> · Tested ⬜
- [ ] <test step 1 — what to do, what you should see>
- [ ] <test step 2>
- [ ] <edge case / failure case>
```
