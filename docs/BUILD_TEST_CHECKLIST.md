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
- [ ] Validate: the Times-Square radius query (README / spatial query) returns sensible nearby places ranked by distance
- [ ] Eyeball phone/website coverage (`where phone is not null`) — measures the real fill-rate we couldn't get from docs
- [ ] (Next build) Worker read-path: query `places` first, fall back to Google where thin

## Template for a new build
```
### N · <feature name>
State: Committed <hash> · Deployed <where> · Tested ⬜
- [ ] <test step 1 — what to do, what you should see>
- [ ] <test step 2>
- [ ] <edge case / failure case>
```
