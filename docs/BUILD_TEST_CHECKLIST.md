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

### Remaining finders (ATM / Shopping / Restroom / Convenience / Money-exchange) — `b7e9faf`…`2b84179` · **needs SQL + deploy** · Tested ⬜
Same recipe as Coffee: list source → owned planet DB, real Google photos + hours on-tap via `/places/enrich-owned`. **Every finder's own AI-details logic is left untouched.** Shared worker helper `handleOwnedFinder(rpc, tag)` + 5 routes; owned handler now also emits top-level `lat`/`lng`.
- [x] Worker: `/atm-owned` `/shopping-owned` `/restroom-owned` `/convenience-owned` `/moneyexchange-owned` (RPCs `nearby_atm` … `nearby_moneyexchange`), each free list + cached per-tile
- [x] Frontend: list fetch swapped to the owned route on each page; enrich-on-expand added where the card shows photos/hours (Shopping, Restroom, Convenience) or hours (Money-exchange); ATM list-only (no photos)
- [x] ATM: forked bank-network/fee/DCC/skimmer AI details untouched; RestroomAIDetails untouched; Money-exchange RATE fetch (`getExchangeRate`) untouched
- [ ] **Activate:** run each `scripts/finders/<x>.sql` (`atm.sql`, `shopping.sql`, `restroom.sql`, `convenience.sql`, `moneyexchange.sql`) in Supabase + `wrangler deploy`
- [ ] Verify each RPC: `curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/nearby_atm" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{"in_lat":40.758,"in_lng":-73.9855,"in_radius_m":8000,"in_limit":40}'` → rows (repeat per finder)
- [ ] Device (NYC): ATM / Shopping / Convenience finders list from planet DB; expand a Shopping/Convenience card → real photos + today/weekly hours; ATM cards + bank/fee/skimmer AI details still work
- [ ] Money-exchange: LOCATIONS list from planet DB, distance + directions + map pins correct; the CONVERTER (rates) still works exactly as before; expand a store → hours load (or "Hours not listed")
- [ ] Restroom: ⚠️ **evaluate coverage** — Overture has few restroom POIs; confirm results are reasonable, else consider keeping Google or supplementing
- [ ] Cost check: default load fires no Google list calls on any of the five; only expanded cards cost

## ✂️ Onboarding-friction cut (2026-07-23)
Cut signup from ~14 tap-through screens to **3 essentials** — name (if unknown) · location · home city. Currency/language/temperature/distance are **inferred** (home country + device locale, `src/lib/inferProfileDefaults.js`); the 7 travel-preference steps are **deferred** (components kept for Settings/contextual use, removed from signup).
- [x] `Onboarding.jsx` steps trimmed to first_name?/location/home_country; `finish()` fills inferred currency/language/temp/distance
- [x] Lint + build clean
- [ ] **Fresh-account test:** new email → onboarding shows only ~3 screens → lands on Home (not stuck)
- [ ] Profile after onboarding has: home_city/country + coords + timezone, and **inferred** preferred_currency / preferred_language / temp_unit / distance_unit (check a US home → USD/F/mi; a France home → EUR/C/km)
- [ ] Google/Apple signup (first name already known) → first_name step is **skipped** (2 screens)
- [ ] Skipping the home-city step still completes onboarding (inference falls back: USD / device language / C / km)
- [ ] Settings still lets the user change currency/language/temp/distance/home city afterward
- [ ] ⚠️ Deferred data (travel purpose/budget/etc.) is no longer collected at signup by design — confirm no feature hard-crashes on those being null (they were already optional)

## 🚗 Get A Ride — bookable transport (Home tile → page) (2026-07-23)
"Book a ride" as its own Home surface, OUTSIDE transit directions. Car rental (Discover Cars, LIVE `a_aid=beach3303`) + Airport transfer ("Soon" until Travelpayouts approves) + Same-day ride (Uber deep-link, utility). Every bookable tap → `trackAffiliateClick` (SubID→D1) → opens partner site. FTC disclosure at the bottom.
- [x] New page `src/pages/GetARide.jsx` + registered in `pages.config.js`
- [x] Home tile "🚗 Book a Ride" on phone (PHONE_EXPLORE) + tablet (HomeTablet EXPLORE) → route `Get A Ride`→`GetARide`
- [x] Lint + build clean
- [ ] Device: Home → "Book a Ride" tile opens the page (phone + iPad)
- [ ] Tap **Rent a car** → opens Discover Cars with `a_aid=beach3303` in the URL (commission tracked)
- [ ] **Airport transfer** shows a greyed "Soon" card, not tappable (wires in when TP approves — just set its `link`)
- [ ] Tap **Same-day ride** → opens Uber (app or m.uber.com)
- [ ] Note: our own D1 click-logging (`/aff/click`) only records once the affiliate schema + worker are deployed; until then the link still works + earns via `a_aid` (helper falls back to the raw URL)

## 🎟️ Viator "Book a tour here" on Things-to-Do (2026-07-26)
First live affiliate revenue surface. Each attraction card (ActivityCardTablet) gets a "🎟️ Book a tour here · Viator ↗" button → Viator search deep-link for that place → earns via `pid=P00311514`. Routed through `/aff/click` (SubID→D1); our sub-id rides in Viator's `campaign` param (doesn't touch payout).
- [x] `src/lib/viator.js` (viatorSearchLink; pid P00311514 + mcid 42383 + medium=link)
- [x] Worker AFF_SUBID_PARAM.viator: 'pid' → 'campaign' (was clobbering the payout id)
- [x] ThingsToDo card button + handler; lint + build clean
- [x] **pid VERIFIED 2026-08-31** — Viator partner dashboard shows account `Globeskimmers - USD - P00311514 - Affiliate`, matching `VIATOR_PID` exactly; dashboard already reports 5 visitors/30d, so attributed clicks are flowing from the app. [ ] mcid=42383 still to confirm via Tools → Link creation (one generated link; compare the `mcid=` param).
- [ ] Device: Things-to-Do → attraction card → "Book a tour here" opens Viator search for that place with `pid=P00311514` in the URL
- [ ] Activate full tracking: run `scripts/affiliate/01_schema.sql` (D1) + `wrangler deploy` — until then the link still earns via pid (helper falls back to the raw URL)

## 💡 Insight page (2026-07-28)
New per-city planning surface alongside Cultural Info + Things to Do. Answers the "how do I actually DO this trip" questions: **Do you need a car here? · 1-day/3-day plan · Skip the crowds · Do it like a local · Day trips.** Content is AI-estimated (reuses the generic `/culture` Worker endpoint — cached Haiku + SWR, honest "Updated <date>" + double-check disclaimer). **Frontend-only — NO worker deploy needed.** Routes into Book a Ride + Travel Essentials at the useful moment (honest affiliate placement, no neutral comparison to muddy). Culture was pulled from the *planning* lead-strip and replaced by Insight; Culture tile/page kept.
- [x] `src/pages/Insight.jsx` (5 AI sections + Plan-ahead strip + personalization teaser); lint + build clean
- [x] Registered in pages.config.js; Home route `"Insight"→"Insight"`; planning strip Culture→💡 Insight; Insight added to phone Explore grid + tablet EXPLORE
- [ ] Device: Home → **Explore more → 💡 Insight** opens the page; title shows your city; 5 cards each load ("Thinking it through…" → content)
- [ ] "Do you need a car here?" shows a verdict pill (Skip the car / Get wheels / etc.) — set Simulator to **New York** (expect "Skip the car") vs **Los Angeles** (expect "Get wheels/Nice to have")
- [ ] "🚗 Rent a car…" / "Book a ride" button → opens **Get A Ride**; Plan-ahead tiles → **Get A Ride** / **Travel Essentials**
- [ ] Each card footer shows "Updated <date>"; top amber note = AI-estimated disclaimer visible
- [ ] Planning mode (navigate to a place you're NOT at): Home lead-strip shows **Things to do + 💡 Insight** (no more Culture there)
- [ ] Change location → cards refetch for the new city; per-card 🔄 refresh works
- [ ] Cost check: first open of a city = 5 Haiku calls (~cheap), cached 180–365d; re-open = instant (KV hit)

## 🏙️ Living Rows quality fixes — Cebu/Manila (2026-07-28)
Coverage check found the home carousels populate globally, but in less-curated regions (esp. PH/SE-Asia) they showed **residential condos mis-tagged as landmarks** (Cebu: "Sundance Residences", "M5 Staffhouse") and **photoless real attractions** (Manila: non-Latin / ALL-CAPS names missed photo search). Three fixes, all in the planet-fallback path (curated seeded cities like NYC were already fine).
- [x] SQL: residential exclusion in `nearby_attractions` (scripts/finders/attractions.sql + RUN_ALL.sql) — condos/staffhouses/townhomes/dorms; keeps Villa/Palace/Basilica
- [x] Worker: `looksResidential()` gate in `homeRowsPlanetPool` (works on deploy, before SQL re-run) + `cleanPhotoQuery()` (strips non-Latin, de-shouts CAPS, appends city/country) in the home-rows photo fallback
- [ ] **RUN SQL:** paste `scripts/finders/attractions.sql` in Supabase SQL editor (also cleans ThingsToDo)
- [ ] **DEPLOY:** `wrangler deploy`
- [ ] After both: re-check Cebu (10.3157, 123.8854) + Manila (14.5995, 120.9842) — condos gone from Home rows + ThingsToDo; more real sights get photos
- [ ] Sanity: NYC / London / Bangkok still perfect (no regressions)

## 🛍️ Shopping fix — photos + working filters (2026-07-28)
Two real bugs found + fixed. (1) **No photos:** owned path hard-coded `photos:[]` + never hydrated. (2) **Filters broken:** the category chip was passed but IGNORED (every filter = same list), and the Food/Luxury toggles read fields (`shoppingFamily`/`props.isLuxury`) the worker never set → returned 0. Fix spans SQL + worker; **no frontend change** (the card already read these fields).
- [x] Worker: `buildOwnedShoppingPlaces()` — classify each row (`shopDetectKind`, underscores→spaces), apply the selected chip via `SHOP_OWNED_FILTER`, hydrate top-12 Wikimedia photos (notable venues; ordinary shops keep the category-emoji placeholder — honest), set venueLabel/icon/color + shoppingFamily + props
- [x] Worker: strengthened luxury detection (brand names LV/Gucci/Rolex…; excludes budget "Designer Warehouse")
- [x] SQL: broadened `nearby_shopping` category filter (grocery/supermarket/butcher/warehouse/outlet/duty_free/souvenir/craft) so food chips have raw material
- [ ] **RUN SQL:** paste `scripts/finders/shopping.sql` in Supabase SQL editor
- [ ] **DEPLOY:** `wrangler deploy`
- [ ] Device: Shopping → tap a category chip (Malls / Groceries / Luxury) → list narrows to THAT store type (previously unchanged). "🛒 Food Only" and "💎 Luxury" toggles now return matching stores (previously 0)
- [ ] Notable malls/markets show a real photo in the list; ordinary shops show a category emoji (🛒/🏬/🥩) not a blank bag
- [ ] Card kicker + top-right tag show the store type (e.g. "Shopping Mall"); map pins use the category icon
- [ ] ⚠️ Known limit: "🟢 Open Now" toggle returns nothing on owned list (no live hours until a card is tapped) — separate follow-up, not in this fix

## 🛂 Passport Phase 1 (2026-08-01)
The retention core: "I was here" → an EARNED stamp → memory photos, private per user. Memory-journal first, tiered stamps, GPS/photo-proof/self earning. Spec: docs/PASSPORT_MEANING_MODEL.md. Reuses the existing MEDIA R2 bucket + JWT auth (gbUser) — no new infra.
- [x] Worker `/passport/*` (stamp/list/photo/serve/date/delete) + account-delete purge; syntax clean
- [x] `src/lib/passport.js`, `src/pages/Passport.jsx`, ActivityDetail "I was here", registered + Home/tablet Explore tile; lint + build clean
- [ ] **RUN SQL:** paste `scripts/passport/01_schema.sql` in Supabase SQL editor (creates api.passport_stamps + passport_stamp_photos)
- [ ] **DEPLOY:** `wrangler deploy` + `git push`
- [ ] Device: Things to Do → open an attraction → **📍 I was here** → toast "added to your passport"; if you're physically there (GPS), toast says **✓ Verified**
- [ ] Home → Explore → **🛂 Passport** opens; the stamp is there with holder name + stats
- [ ] On a stamp → **Add a photo** → uploads; a self-added stamp flips to **✓ Verified · photo**; tap photo → lightbox "I was here! {name}"
- [ ] **Photo-proof backfill:** stamp a place you're NOT at (self) → add your own photo + set an earlier date → earns ✓ + shows that date
- [ ] Edit date + delete photo + delete stamp all work; refresh persists (Supabase)
- [ ] Signed-out: Passport shows the "sign in to start" empty state (no crash)
- [ ] **Buddy tagging (share link):** on a stamp → "Tag who you were with" → the **native share sheet** opens with an invite link → send via WhatsApp/iMessage/etc. (Re-run `01_schema.sql` — idempotent — for the `token` column.)
- [ ] Recipient with app: tap the link → `/t/<token>` landing → "Open in Globeskimmers" → app opens to a **claim card** → **Allow** mints the stamp on their passport / **Decline** = nothing (consent-gated; can't claim your own)
- [ ] Recipient without app: link → landing page shows stamp preview + **Download for iPhone/Android** buttons
- [ ] Anti-spam: 30 tags/day cap; landing page shows "already used" for a claimed token
- [ ] ⚠️ Set the real **iOS App Store numeric ID** in `PP_IOS_URL` (worker) once assigned — the iPhone download button is a placeholder until then
- [ ] Email inbox path ("🙌 Tagged you") still works if a tag ever carries an email
- [ ] ⚠️ Not yet built: **Phase B email** (notify existing users + invite non-users w/ download links — needs an email provider); onboarding page-one reframe; city/airport/icon/wonder auto-stamps; share card (P2)

## 📡 Capgo OTA live updates (2026-08-05)
Push JS/HTML/CSS updates to installed apps with **no App Store resubmission** — only native changes (new plugins/permissions) still need a store build. Capgo cloud app = `com.globeskimmers.app` (org "Globeskimmers"); plugin `@capgo/capacitor-updater@8`; `notifyAppReady()` in `src/main.jsx`.
State: Committed <hash> · Native build required (this build adds the plugin) · Tested ⬜
- [x] Capgo cloud app created with correct bundle id `com.globeskimmers.app` (wrong `com.globeskimmers.globeskimmers` deleted)
- [x] Plugin installed + `notifyAppReady()` wired + `cap sync` (plugin shows in iOS/Android)
- [ ] **Capgo dashboard:** create a **production** channel + set it as the **default / self-assign, auto-update** channel (Settings → Channels)
- [ ] **⚠️ Native build required THIS once:** archive + submit a new App Store (and Play) build that includes the Capgo plugin — OTA only reaches versions that ship the updater
- [ ] After that build is live + installed: `npx @capgo/cli bundle upload com.globeskimmers.app --channel production` pushes a JS change
- [ ] Device: make a small visible JS tweak → upload bundle → reopen app → change appears **without** a store update
- [ ] Rollback sanity: `notifyAppReady()` fires (no auto-revert on next launch)
- [ ] ⏰ MAU/plan: on Solo (2K). Upgrade before 2K→Maker→Team(100K) or OTA stops past the cap

## 🔎 Things to Do — real in-app activity search (2026-08-09)
Search bar now finds activities NOT in the tiered load (zipline, snorkeling, kayaking, ATV, ice skating, water parks, hot springs, jet ski…) as real in-app businesses, instead of always exiting to Viator. Worker `/activities/search` = Google Places keyword search ∥ Viator; frontend merges owned/cached + live Google, splits within-radius / a-bit-farther, demotes Viator below in-app results, logs search terms.
State: Committed f14da06 · Frontend auto-deploys on push · **Worker needs `wrangler deploy`** · Tested ⬜
- [ ] **DEPLOY WORKER:** `cd "/Users/globeskimmers/Desktop/CODES PROTECT/globeskimmers-cacf36e4-10" && wrangler deploy` (search returns `places` only after this)
- [ ] Device (coastal/varied city): search **"zipline"**, **"kayaking"**, **"ATV"**, **"ice skating"** → real local businesses appear under **"Places matching …"** as full cards (photo, rating, hours, Directions, I-was-here)
- [ ] Search something genuinely far (snorkeling in an inland city) → few/none within radius, **"A bit farther — worth the trip"** shows the closest options beyond radius (honest)
- [ ] **Viator "Book … experiences"** section appears BELOW the in-app results (not above); tapping a tour opens the **exact product page** (direct deep-link), not a Viator search
- [ ] Exit-to-Viator dashed link shows **only** when there are zero in-app places AND zero Viator products
- [ ] Owned-data-first: a term that matches a loaded attraction shows instantly (before the live Google call returns)
- [ ] No duplicate cards when a place is in both owned + Google (dedupe by placeId)
- [ ] Map View plots the searched places (within + a-bit-farther); Directions works
- [ ] Analytics: `activity_search` events land in D1 with the query term (AdminAnalytics)
- [ ] Cost sanity: repeat the same search → served from KV (no new Google call)

## ☕ Coffee — café + drink search (2026-08-09)
Adds the missing search box to CoffeeFinder: search a café NAME or a DRINK (latte, cold brew, caramel macchiato). Owned-first client match + live Google café search (`/coffee/search`, biased to type 'cafe'), merged/deduped/distance-sorted; within-radius or closest-few-beyond. Also: Things to Do advanced filters now filter across all tiers in browse mode (`ce24c15`).
State: Committed 49c4849 (+ce24c15) · Frontend auto-deploys on push · **Worker needs `wrangler deploy`** · Tested ⬜
- [ ] **DEPLOY WORKER:** `cd "/Users/globeskimmers/Desktop/CODES PROTECT/globeskimmers-cacf36e4-10" && wrangler deploy` (café search returns places only after this)
- [ ] Coffee: search a **drink** ("latte", "cold brew", "matcha") → real cafés appear under "Cafés matching…"; search a **café name** → that café appears
- [ ] Owned-first: a name matching a loaded shop shows instantly before the Google call returns
- [ ] Existing filters (Open Now / Specialty / WiFi / sort) still apply to search results; map + Directions work on results
- [ ] Empty/edge: a nonsense query shows "No cafés for … nearby"; clearing (✕) returns to nearby browse
- [ ] `coffee_search` events land in D1 (AdminAnalytics)
- [ ] Things to Do: with nothing typed, tap Open Now / Outdoors / Popular / a category → tiers collapse into one "Filtered results" list that reflects the filter (not ignored)
- [ ] Cost: repeat a search → served from KV (no new Google call)

## 🍽️☕ Eat + Coffee search overhaul #9–#11 (2026-08-09)
State: Committed 7aa2682 (#9) · 83c2a54 (#10) · 9c70203 (#11) · **Worker needs `wrangler deploy`** (for #9 + #10) · Tested ⬜
- [ ] **DEPLOY WORKER:** `cd "/Users/globeskimmers/Desktop/CODES PROTECT/globeskimmers-cacf36e4-10" && wrangler deploy`
- [ ] **#9 Restaurants:** Places to Eat → search a **dish** ("ramen", "tacos", "adobo") → relevant results with tier badges (Dish Specialist / Authentic / Serves It); tap **halal** / **kosher** dietary chip → certified-leaning results; plain browse (no query/filter) still loads the free owned list instantly
- [ ] #9 safety: if the engine errors it silently falls back to the owned list (search never blank) — spot-check a few searches return *something*
- [ ] **#10 Coffee:** Advanced Filters → **💻 Good for working / 🔌 Outlets / 🔇 Quiet / ❄️ A/C** → list narrows to matching cafés; "checking cafés…" shows briefly on first use in a new area; "⚠️ estimated · call ahead" label present; cafés w/o data aren't shown as false matches
- [ ] #10 cost: re-toggle the same work filter in the same area → instant (cached, no recompute)
- [ ] **#11:** Things to Do → search "spectacular views" → returns viewpoints/lookouts (synonym expansion); typed text still displays as-is
- [ ] Analytics: `activity_search`, `coffee_search`, and Eat `search`/`search_zero_results` all land in D1 (AdminAnalytics)

## 🏨 Find a Hotel — goal-based Stay22 finder (2026-08-09)
New Home tile → Find a Hotel page. Goal (this area/airport/centre/sights) + dates + guests → Stay22 multi-OTA best-price handoff. Amenities filtered on results page (meta-search); Agoda in-app amenity filtering is the follow-up.
State: Committed 4afe7fc · Frontend auto-deploys on push · **Worker needs `wrangler deploy`** (stay22→campaign SubID map) · Tested ⬜
- [ ] **DEPLOY WORKER:** `cd "/Users/globeskimmers/Desktop/CODES PROTECT/globeskimmers-cacf36e4-10" && wrangler deploy`
- [ ] **⚠️ Paste real Stay22 aid** into `src/lib/stay22.js` (STAY22_AID) once approved — until then links work but don't earn
- [ ] Home → **🏨 Find a Hotel** tile opens the page
- [ ] Pick a goal + dates + guests → **Find hotels** → heads-up modal → opens Stay22 with a price comparison for the right place/dates/occupancy
- [ ] "This area" uses your coords; "Near the airport" / "City centre" / "Near the sights" pass the right address
- [ ] Affiliate: click logs to D1 with partner "stay22" (SubID in Stay22 `campaign`); disclosure + "filter amenities on results page" note visible
- [ ] Signed-out / no-location: button disabled with "Set your location to search"

## 🛂 Virtual Passport → real page-flip book (2026-08-10)
Passport now opens like a physical booklet: the navy **"My Virtual Passport"** cover (R2 hero, `/stamp-art/passport-cover-default.jpg`) swings open from the left spine → ownership page → one portrait page per country with stamps pressed on ivory paper. `src/components/passport/PassportBook.jsx` (framer-motion 3D hinge + swipe/keyboard flip), wired into `src/pages/Passport.jsx` (old scroll-snap book removed; all stamp/share/tag/claim/detail features preserved). Single portrait page per view (mobile-first). **No Worker deploy** (cover reuses the stamp-art passthrough). No local asset added — cover served from R2.
State: Uncommitted · Frontend auto-deploys on push · Tested ⬜
- [ ] Passport (with ≥1 stamp) shows the **closed navy cover** centered, 2:3, with contact shadow + "Tap to open" hint
- [ ] **Tap the cover** → it swings open from the left spine (~0.85s) → **ownership page** appears (Globeskimmers · My Virtual Passport · your name · Traveler Since / Countries / Stamps · "Not a government document")
- [ ] **Swipe left / ›** turns to the next page; **swipe right / ‹** goes back; **Close** returns to the closed cover
- [ ] Each country page shows flag + name + stamps scattered at slight angles; **tap a stamp** → detail modal (photos, date, delete, share) still works
- [ ] GPS-verified stamps show the green ✓; airport stamps render the arrival stamp; landmark stamps show the illustrated art
- [ ] Page indicator "Page X / N" + prev/next buttons show **outside** the book; keyboard: Enter opens, ← → flip, Esc closes
- [ ] **Reduced motion** (iOS: Settings → Accessibility → Motion → Reduce Motion) → cover/pages crossfade instead of 3D turn
- [ ] Read-only shared view: book opens, stamps view-only (no edit/delete), ownership page shows the holder's name, no home-country leak
- [ ] Narrow phone (320px) + tablet: book scales, no horizontal page scroll, stamps stay tappable (44px targets)
- [ ] **0 stamps (signed in):** still shows the closed cover → open → ownership page + a **"My Travel Collection · Your first destination stamp will appear here" + "Find places to stamp"** page (→ Things to Do)
- [ ] **0 stamps (signed out):** shows the sign-in prompt (not the book); **read-only friend, empty:** shows "Nothing to show"

## 🧳 My Trip hub — bookings you started (2026-08-21)
The traveler's bookings hub. New worker `POST /aff/mine` (`handleAffiliateMine`) reads the SIGNED-IN user's own `affiliate_clicks` (JWT→user_id via `gbUser`), collapses repeat taps of the same product into one entry, and reports an HONEST status: **Started** (a tap ≠ a booking) until the partner's offline conversion report marks it **Confirmed** — never "Booked". `src/pages/MyTrip.jsx` groups items by category (🏨 stays / 🎟️ tours / 🎫 events / 🚕 rides / 🚗 car / 📶 data / 🧳 storage); tapping a card reopens the partner (Capacitor Browser on native, window.open on web). `src/components/home/MyTripCard.jsx` = a compact Home banner that renders ONLY when the user has ≥1 saved item; also linked from Saved Locations. Reuses the existing `affiliate_clicks` D1 table (no schema change).
State: Uncommitted · Worker DEPLOYED (9f67e324) · Frontend auto-deploys on push · Tested ⬜
- [ ] Signed in, after opening ≥1 Viator tour / hotel / event: Home shows the **"Your trip · N items saved"** banner (below the Stay Anchor); Saved Locations shows a **🧳 My Trip** row
- [ ] Tap either → **My Trip** page lists items grouped by category with the right emoji headers + counts
- [ ] Each card shows a grey **Started** chip, the partner name, product name, city + date; **tap a card** → reopens the partner in the in-app browser
- [ ] The honest note is visible up top ("Started means you opened the partner — it isn't a confirmed reservation")
- [ ] **Signed out:** page shows "🔒 Sign in to see your trip" + Sign in button (→ Settings); the Home banner does NOT appear
- [ ] **Signed in, zero taps:** page shows "🧳 Nothing here yet" + "Explore things to do" (→ Things to Do); the Home banner does NOT appear
- [ ] Repeat taps of the SAME product collapse into ONE card (deduped), not many
- [ ] Auth safety: only your own rows appear — no token / a bad token returns `{items:[],needsAuth:true}` (verified via curl)
- [ ] Tablet width: banner + page render wide, no horizontal scroll
- [ ] (Later) When a conversion is backfilled (`status='confirmed'`), that item's chip turns green **Confirmed**

## ❤️ Wishlist — demand capture + book-later (2026-08-21)
"I want to go / do / see this." A drop-in `<WishlistButton item={...} />` (`src/components/WishlistButton.jsx`) toggles items into an on-device wishlist (`src/lib/wishlist.js`, localStorage `gs_wishlist_v1`) — instant, works signed-out (same choice as Saved Locations). Every add/remove is logged via `logDiscover('wishlist_add'/'wishlist_remove')` → the **DEMAND SIGNAL** for the Radar (aggregate, no PII). `src/pages/Wishlist.jsx` groups saved items by kind (🌆 destinations / 📍 places / 🎟️ tours / 🎫 events / 🍜 food / 🏨 stays) and turns each into a booking (**Find tours** = Viator affiliate; **Find hotels** = FindAHotel presetCity). `src/components/home/WishlistCard.jsx` = a Home banner that appears only with ≥1 item; also a row in Saved Locations. First capture surface = ThingsToDo attraction cards (❤️ overlay on the photo). Worker: added `wishlist_top_30d` / `wishlist_by_city_30d` / `wishlist_by_kind_30d` to ANALYTICS_QUERIES.
State: Uncommitted · Worker DEPLOYED (6b1d1c0c) · Frontend auto-deploys on push · Tested ⬜
- [ ] On a ThingsToDo attraction card, a **❤️ appears top-right of the photo**; tapping it fills red (and does NOT open the card); tapping again un-fills
- [ ] After ❤️-ing ≥1 place: Home shows the **"Your wishlist · N places saved"** banner (below My Trip); Saved Locations shows a **❤️ Wishlist** row
- [ ] Open Wishlist → the saved place appears under **📍 Places to visit** with photo, name, city
- [ ] Tap **Find tours** → opens Viator (attributed affiliate click) for that place; tap **Remove** → it disappears and the card's ❤️ un-fills live
- [ ] **Empty wishlist:** page shows "💫 Start your wishlist" + "Explore things to do"; the Home banner does NOT appear
- [ ] Signed-out still works (localStorage); ❤️ state persists across app reloads
- [ ] Demand signal: after a few ❤️s, `GET /analytics-query?type=wishlist_by_city_30d` returns rows (city → wishes/people)
- [ ] Tablet width: ❤️ overlay + Wishlist page render wide, no horizontal scroll

## 👥 Persona — "who's traveling" re-rank (2026-08-21)
A compact **"Who's traveling?"** chip row (`src/components/PersonaChooser.jsx`) sets a party-composition persona — **solo / couple / family / friends** (party composition ONLY; never age/life-stage labels, per founder rule). `src/lib/persona.js` stores it on-device (`gs_persona_v1`), exposes `usePersona()` + a stable `personaRank()` that re-sorts attractions by the `props` block already computed server-side (isFamilyFriendly / isGoodForCouples / isGoodForGroups / isAdventure / …) — zero new data, and it only nudges matches up (ties keep their order). Every pick logs `persona_set` (the segment signal for the demand loop; no PII). Wired into ThingsToDo: chooser above the tiers + live re-rank inside each TierSection. Frontend-only (no worker change).
State: Uncommitted · Frontend auto-deploys on push · Tested ⬜
- [ ] On Things to Do (default browse view with attractions), a **"Who's traveling?"** chip row shows above the tiers
- [ ] Tap **Family** → cards re-order so family-friendly places rise to the front of each tier; tap again (or **Clear**) → returns to default order
- [ ] The choice persists across app reloads (localStorage) and applies on next visit
- [ ] With NO persona set, tiers render in their normal quality order (no-op)
- [ ] After a few picks, `events` has `persona_set` rows (persona → segment)
- [ ] No attractions (coverage-less area): the chip row does NOT show
- [ ] Tablet + phone: chip row scrolls horizontally, no page horizontal scroll

## ✨ Vibe Bundles — Discover "what's the vibe?" (2026-08-21)
Mood combos on Home: pick a vibe (💆 Self-care / 🍻 Night out / 👨‍👩‍👧 Family / 🧘 Active & reset / 🛍️ Relaxed & easy / 📸 The classics) → its slots expand as chips, each routing to the right in-app finder (real, already-cached cards there = **no new API spend**) or a **FREE Google-Maps search** for local-life types we have no finder for (spa/gym/salon/cinema). Mood labels only (never demographic). Persona (party composition) gives a light re-order; the set never changes. Selections log `vibe_select` / `discover_select` for the demand loop. `src/lib/vibeBundles.js` (config + orderedBundles + mapsSearchUrl), `src/components/home/VibeBundles.jsx` (the surface). Frontend-only.
State: Uncommitted · Frontend auto-deploys on push · Tested ⬜
- [ ] Home shows a **"What's the vibe? ✨"** row of 6 mood cards (below the Wishlist card)
- [ ] Tap a vibe (e.g. Self-care day) → it highlights + a slot-chip row expands ("Spa/massage · Nail salon · Healthy lunch · Quiet café"); tap again → collapses
- [ ] Tap an in-app slot (Healthy lunch) → opens the Eat finder; (Café) → Coffee; (Top sights) → Things to Do; (Shopping) → Shopping
- [ ] Tap a local-life slot (Spa/massage · Cinema · Gym) → opens a Google Maps search for that type near your city
- [ ] With a persona set (e.g. Family), the **Family** vibe leads the row; the full set is still present
- [ ] After taps, `events` has `vibe_select` / `discover_select` rows (vibe + slot → demand)
- [ ] Tablet + phone: mood cards + slot chips scroll/wrap, no page horizontal scroll

## 📊 Behavior tracking — directions + persona + Demand Radar surfaced (2026-08-21)
Closes the top gaps from the behavior-pipeline audit. (1) **`directions_tap`** — the highest-intent signal ("actually going here") now logs from `MapAppSelector.launch()`, covering EVERY finder in one place. (2) **Persona stamped into `logDiscover`** ctx (reads `gs_persona_v1` directly to avoid a circular import) → every Discover event now carries the party-composition segment → unlocks segment slicing. (3) **Surfaced the invisible data** in AdminAnalytics: the Wishlist Demand Radar (top destinations / most-wishlisted / by-type / →Book CTA), directions taps, and persona mix. New worker queries: `directions_by_place_30d`, `persona_distribution_30d`, `wishlist_by_persona_30d`, `wishlist_cta_30d` (deployed 9eeb409b). Privacy: aggregate only, `COUNT(DISTINCT session_id) AS people`, no PII.
State: Uncommitted · Worker DEPLOYED (9eeb409b) · Frontend auto-deploys on push · Tested ⬜
- [ ] Tap **Directions** on any finder card → maps app opens AND an event fires; `GET /analytics-query?type=directions_by_place_30d` returns the place after a few taps
- [ ] Pick a persona on Things to Do, then ❤️ a place / tap a vibe → those events now carry `persona`; `persona_distribution_30d` returns the segment
- [ ] Admin Analytics shows the new sections: ❤️ Wishlist top destinations / most-wishlisted / by type / →Book, 🧭 Directions taps, 👥 persona mix (all "No data yet" until events accrue, never error)
- [ ] No double-count regression on page views; existing sections still render
- [ ] Privacy: every new query returns counts + `people` (distinct session), never individual identifiers

## 🔒 /analytics-query locked to admins (2026-08-21)
The analytics read endpoint was **world-readable** (anyone could pull aggregate demand intel). Added a `requireAdmin(request, env)` gate (verifies the caller's Supabase JWT via `/auth/v1/user`, then checks `ADMIN_EMAILS_WORKER`) at the top of `handleAnalyticsQuery` — mirrors the existing `handleAdminUserStats` pattern. No frontend change: AdminAnalytics already sends the admin JWT via `callWorker`. Verified: no-auth → **HTTP 401**; deployed 140180b4.
State: Uncommitted (worker) · Worker DEPLOYED (140180b4) · Tested ⬜
- [ ] Signed in as an ADMIN email → Admin Analytics still loads every section (JWT accepted)
- [ ] `GET /analytics-query?type=totals_7d` with no auth → 401; with a bogus token → 401
- [ ] Signed in as a NON-admin → Admin Analytics redirects home AND the endpoint returns 403 if called directly

## 💸 Affiliate money funnel — session join (2026-08-21)
`affiliate_clicks` now carries **`session_id` (+ intent, persona)** so a click JOINS to its view/tap events → a real **view→tap→click→book** funnel, even for anonymous (not-signed-in) users. `affiliate.js` reads `gs_session_id` / `gs_last_location_v1` / `gs_persona_v1` and passes them; `handleAffiliateClick` inserts them; the **live D1 was migrated** (3× ADD COLUMN + session index). New queries: `affiliate_funnel_30d` (4-stage distinct-session totals) + `affiliate_clicks_by_intent_30d`; both surfaced in AdminAnalytics. **"Booked" stays 0 until the offline conversion import** (the next piece — needs each network's report). Verified end-to-end: a real `/aff/click` persisted session_id/intent/persona; test rows cleaned.
State: Uncommitted (frontend) · Worker DEPLOYED (91b18bf4) · D1 migrated · Frontend auto-deploys on push · Tested ⬜
- [ ] Tap any affiliate link (Viator "book a tour" / hotel / event) → the click still opens the partner (SubID intact) AND the row now has session_id/intent/persona
- [ ] Admin Analytics shows "💸 Affiliate funnel" (Sessions → Engaged → Clicked → Booked) + "Booking intent — planning vs present"
- [ ] Funnel numbers are distinct-session counts; Booked = 0 until the conversion import lands
- [ ] Behind the scenes: engaged→clicked join works for anonymous users (session_id matches events)

## Template for a new build
```
### N · <feature name>
State: Committed <hash> · Deployed <where> · Tested ⬜
- [ ] <test step 1 — what to do, what you should see>
- [ ] <test step 2>
- [ ] <edge case / failure case>
```

## 🔎 Search-intent graph — capture EVERY search + WHERE (2026-08-23)
One canonical `logSearch(category, query, extra)` (over `logDiscover`) so every finder search is stamped with the city/country it was made in + `intent` (present = there now · planning = dreaming about it). Wired into **Eat, Coffee, Things-to-Do, Shopping, Hotel** + ride-type on **Get-a-Ride**. Unified old per-finder event names (`coffee_search`/`activity_search`) → `search` / `search_zero_results`. 4 new admin queries + an Admin section answer "what people search, and where". First-party demand-intent graph; NO PII (aggregate only). See `project_search_intent_graph` memory.
State: Committed (8a77fdd frontend · bf082ca worker · 80ef467 admin) · Worker deploy ⬜ · Frontend auto-deploys on push · Tested ⬜
- [ ] Places to Eat: search "ramen" in a set city → in `/log-event`/D1 an `event_type='search'` row has payload `{category:'eat', query:'ramen', city, country, intent}` (city NOW attached — the whole point)
- [ ] Coffee / Things-to-Do / Shopping (tap a category) / Find-a-Hotel (run a search) each emit a `search` row with the right `category` + city
- [ ] A search that returns nothing → `event_type='search_zero_results'` with the query + city
- [ ] Get-a-Ride: tap "Rent a car" vs "Airport transfer" vs a rideshare app → `ride_option_tap` rows with `type` = car / transfer / rideshare
- [ ] Present vs planning: search while on GPS ("current") → `intent:present`; search after switching to a navigate/selected city → `intent:planning`
- [ ] Admin Analytics shows the 4 new sections: 🔎 Top searches — and where · 🗺️ Demand mix per city · 🚗 Transfers vs rental cars · 🕳️ Searches with NO results (all honest empty states pre-traffic)
- [ ] Regression: existing `top_searches_7d` + `top_zero_results` admin rows still populate (event names unified, not dropped)

## 🏠 Home living rows — delivery fix (2026-08-23)
The two headline "Discover" rows (**"Where people go / Near you / Trending"** = `HomeRows`, and **"Stamps near your stay 🛂"** = `StampsNearYou`) had NEVER rendered: they read top-level `loc.latitude/lat`, but the active-location object nests coords under `coordinates.{latitude,longitude}` (the shape every finder uses), so the finite-check tripped every time and both silently returned `null` — only the static tiles showed. Fixed the coord resolution (nested-first, top-level fallback). `StampsNearYou` also passed `radius:15000` which the worker ignores (reads `radiusKm`, default 80km) → now `radiusKm:40` (~25mi) so "near your stay" distances are honest. `WhereToStay` got the same city/country fallback the sibling rows use. Both phone (`Home.jsx`) + tablet (`HomeTablet.jsx`). See `reference_active_location_shape` memory.
State: Committed (2c198c2) · Frontend auto-deploys on push (⚠️ push blocked until GitHub token has Contents:write) · Tested ⬜
- [ ] ⚠️ Before device test: `npm run build && npx cap copy ios` (sim shows a stale bundle otherwise)
- [ ] Set location to a seeded city (e.g. New York / Cebu / Tokyo) → BELOW the finder tiles, "Where people go / Near you now" carousels appear WITH real photos + "★ rating · X.X mi", and "Stamps near your stay 🛂" shows a row of stamp chips with distances
- [ ] Swipe each row sideways; tap a card → quick-look modal opens with swipeable photos → "Explore more" opens the full attraction page; "🧭 Directions" opens the map-app chooser
- [ ] "Stamps near your stay" distances are all ≲25mi (no ~50mi stamps under a "near your stay" header)
- [ ] Move the location (Simulator custom location or switch to a navigate/selected city) → both rows re-center to the new place (auto-follow)
- [ ] A no-coverage spot (remote/ocean) → both rows hide cleanly, tiles stand alone (no empty carousels)
- [ ] iPad width (HomeTablet): same two rows render `wide` below the tiles
- [ ] Confirm `home_rows_view` + `home_row_card_tap` now fire in `/log-event` (they never could before — unlocks the "Trending" row + demand analytics)

## 🛂 Passport crash fix (2026-08-24)
The Virtual Passport showed **"Your passport didn't open"** (error boundary) on every open — `PassportBook.jsx` used `useMemo` (L239, first-fit pagination) but never imported it → `ReferenceError: useMemo is not defined`. Root cause behind 0586c7a; the error boundary (83fe02b/c6b4f03) only masked it. Fixed by adding the import. The globe-cover, 3D page-flip booklet is unchanged — it just renders again now.
State: Committed (0295dd8) · Frontend auto-deploys on push · Tested ⬜
- [ ] ⚠️ Before device test: `npm run build && npx cap copy ios` (else the sim keeps the crashing bundle)
- [ ] Open Passport tab → the **navy globe cover** shows (NOT "Your passport didn't open")
- [ ] Tap the cover → it swings open (3D hinge) → **ownership page** (name / countries / stamps)
- [ ] Swipe / arrow through pages → stamps render on ivory paper; **page number** shows in the corner; "X / total" counter updates
- [ ] A stamp with memory photos shows the 2×2 photo grid; GPS-verified stamps show the green ✓
- [ ] "Share" renders the current page to an image + opens the share sheet; "Close" returns to the cover
- [ ] Fresh/empty passport still shows a flippable 10-page booklet (no crash with zero stamps)

## 🏧 ATM / Convenience / Money-Exchange — filters + coverage restored (2026-08-24)
These three were routed to the generic owned handler, which ignored every filter param and had no Google fallback → filters did nothing + empty in most cities. Re-pointed each page to its rich Google route (handleAtmLocations / handleConvenienceStores / handleMoneyExchange). Frontend-only (no worker deploy). Cost note: these now hit Google (~3¢/search, KV-cached 3-day) — acceptable for low-traffic utility finders; the payoff is working filters + coverage everywhere. Also fixed ConvenienceStore radius unit (was sending meters to a miles handler). Also caught earlier: Get Directions on ActivityDetail (0e44c24 batch is finders; directions was 44f9a22).
State: Committed (0e44c24) · Frontend auto-deploys on push (PUSHED) · Tested ⬜
- [ ] ⚠️ Before device test: `npm run build && npx cap copy ios`
- [ ] **ATM**: open in a real city → ATMs appear; the **bank-filter dropdown now shows** (was missing) and picking a bank narrows results; **"Open now"** toggle changes the list
- [ ] **Convenience**: results appear; toggling **Open 24h / Has ATM / Hot food / Pharmacy / etc.** actually filters; the radius feels right (~25 mi, not a giant/degenerate area — the meters→miles bug is fixed)
- [ ] **Money Exchange**: locations appear; **"Best rate"** sort reorders; **"Open now"** filters; the rate converter (from/to/amount) still works (it was always fine)
- [ ] All three: a city with no coverage no longer shows blank — Google backfills
- [ ] Cost sanity: repeated searches in the same area are served from cache (not a new Google call each time)

## 🔎 Smart-Search spine v1 (2026-08-24)
The blueprint's unifying search: one bar at the top of Home → full-screen overlay (input + scope chips Near me / At my stay / A place… + place autocomplete + recents). Parses free text (FREE client rules first, Haiku `/invoke-llm` fallback only on rule-miss) into {category, scope, place, query}, then re-centers + opens the right finder with the query prefilled, or re-centers Home for a bare place. Logs every search to the demand graph. Frontend-only (reuses `/invoke-llm`, `/search-location`, finder endpoints) — no worker deploy. Files: `src/lib/smartSearch.js`, `src/components/search/SmartSearchBar.jsx` + `SmartSearchOverlay.jsx`, reader wiring in CoffeeFinder/ThingsToDo (PlacesToEat/FindAHotel already read presetQuery).
State: Committed (7509bee + f13a844) · Frontend auto-deploys on push · Tested ⬜
- [ ] ⚠️ Before device test: `npm run build && npx cap copy ios`
- [ ] Home shows the search bar above the finder tiles (phone + iPad); tap → full-screen overlay opens, input auto-focuses
- [ ] "coffee near me" → opens Coffee, centered on GPS, café search auto-runs
- [ ] "ramen" with "At my stay" chip (stay set) → PlacesToEat re-centers on the stay + auto-runs "ramen"; chip is DISABLED when no stay is set
- [ ] "A place…" chip → type a city → autocomplete lists places → pick one → then "things to do" → Home re-centers to that city + opens ThingsToDo with the query
- [ ] Bare "Positano" (no category) → Home re-centers to Positano; the Discover feed shows Positano content (destination mode)
- [ ] A recent search chip re-runs it; suggestions show before any recents exist
- [ ] Confirm a `search` event with `source:'smart_search'` + `scope` fires in `/log-event`
- [ ] Cost check: simple queries ("coffee", "hotel", "things to do in Tokyo") make ZERO `/invoke-llm` calls (rule-parsed); only messy free-text ("viral desserts my kids would love") hits the AI parser

## 🔎 Smart-Search spine Phase 2 (2026-08-24)
Two upgrades: (1) a dedicated cheap `/parse-search` worker endpoint (Haiku 4.5, prompt-cached, KV 24h, ~$0.0009/miss vs ~$0.045 via `/invoke-llm`) — `smartSearch.aiParse` now calls it on a rule-miss; (2) Smart-Search demand analytics — 3 `ANALYTICS_QUERIES` (by scope, by world + AI-parse count, top named destinations) + 3 Admin Analytics sections. Files: `cloudflare-worker-v7.12.js` (handleParseSearch + route + queries), `src/lib/workerRoutes.js`, `src/lib/smartSearch.js`, `src/pages/AdminAnalytics.jsx`.
State: Committed (0e108ad) · **NEEDS WORKER DEPLOY** (`wrangler deploy`) + git push (frontend) · Tested ⬜
- [ ] Deploy: `cd "…/globeskimmers-cacf36e4-10" && npx wrangler deploy`; then git push (frontend auto-deploys)
- [ ] Ambiguous query ("viral desserts my kids would love") → still routes correctly; in the network log it calls `/parse-search` (not `/invoke-llm`), and a repeat of the same query returns `_cache:'hit'`
- [ ] Simple queries ("coffee near me", "things to do in Tokyo") make ZERO `/parse-search` calls (rule-parsed for free)
- [ ] Before the worker deploy, the spine still works (AI fallback returns null → rule result) — no crash/hang
- [ ] Admin Analytics shows 3 new "Smart-Search" sections (scope · worlds opened + AI count · top destinations), honest empty states until real searches accrue
- [ ] `/analytics-bundle` (or the admin fetch) returns `smart_search_by_scope` / `smart_search_by_category` / `smart_search_top_places` without a "type not found" error (confirms the worker deploy landed)

## 🔎 Smart-Search spine Phase 2.5 (2026-08-24)
Two polish items, frontend-only (no worker deploy): (1) **"Exploring <place>" destination strip** — a bare-place search now lands on Home with a teal strip (`DestinationStrip.jsx`) showing the place + quick-jumps into Eat/Coffee/Things/Stay/Shopping, above the tiles (phone + tablet); (2) **shopping query → category chip mapping** — "souvenirs"/"luxury"/"grocery"/etc. open Shopping on the right chip. Files: `src/components/search/DestinationStrip.jsx`, `src/lib/smartSearch.js`, `src/pages/Home.jsx`, `src/components/home/HomeTablet.jsx`, `src/pages/Shopping.jsx`.
State: Committed (f6b5460 + 959414c) · Frontend auto-deploys on push · Tested ⬜
- [ ] ⚠️ Before device test: `npm run build && npx cap copy ios`
- [ ] Search a bare place ("Positano") → Home re-centers AND shows the "🌍 Exploring Positano" strip above the tiles with 5 quick-jump chips
- [ ] Tap a chip (e.g. "Things to do") → opens that finder centered on Positano; dismiss (✕) hides the strip; a NEW place search shows it again
- [ ] Strip renders on iPad (HomeTablet) too
- [ ] "souvenirs" (or "souvenirs in Kyoto") → opens Shopping with the **Souvenir** chip selected; "luxury shopping" → Luxury chip; "grocery" → Groceries chip
- [ ] A generic "shopping" with no sub-term → Shopping opens on "All" (no wrong chip forced)

## 🎟️ Viator tour rows on the attraction card (2026-08-31)
Rung 2 of the booking lane. The "Book a tour here" button deep-linked to a Viator SEARCH page; now the card lists the top 3 tours AT the attraction (thumb · title · ★ rating (n) · duration · Free cancellation / Skip the line · "from $89" · Book) and a tap lands on the PRODUCT in the in-app sheet with the product code on the click record. Expanding the card adds "Runs daily · next Sat, Sep 5" from Viator's operating schedule (labeled "schedule per Viator" — not live inventory). Worker: `viatorMapProduct()` shared mapper, `POST /viator/products` (KV 24h / 7d-empty), `POST /viator/schedule` (raw calendar KV 12h; weekday pattern read from the 14 days at the next open date, capped at season end — unit-tested), `/activities/search` products gain duration + flags. Old `/viator/match` route kept for installed app versions. Files: `cloudflare-worker-v7.12.js`, `src/pages/ThingsToDo.jsx`.
State: Pushed (b19b9aa) → deploy-workers run 33478493199 green · live-verified on production (/viator/products 200 in 1.5s, second call source:cache; /viator/schedule 200) · **follow-up dd83383: destination scoping** — the unscoped search led with Disneyland PARIS tickets for Anaheim; now scoped to the attraction's Viator destination via lat/lng · **follow-up 16f3dbd: name re-rank** — within Anaheim an LA sights tour outranked the Disneyland tickets; titles carrying the attraction name now lead; tightened in 0e779b8 (first distinctive token decides; page-wide tokens like "california" ignored) · Tested ⬜
- [ ] Push → `.github/workflows/deploy-workers.yml` green; then `npm run build && npx cap sync ios` + ⌘R on the iPhone
- [ ] Things To Do → a marquee attraction (Disneyland, Louvre, Eiffel Tower) shows "🎟️ Tours here" with up to 3 rows: price, duration, ★ rating; "Free cancellation" only where Viator flags it
- [ ] Tap a row → in-app sheet opens on THAT product (not a search page); `affiliate_clicks` row in D1 has `product_id` = the Viator product code
- [ ] "See all · Viator ↗" → in-app sheet on the Viator search results for the attraction name
- [ ] Tap "More ▾" → each row gains a schedule line ("Runs daily · next Tue, Sep 1" or "Runs Tue, Thu, Sat"); footer gains "· schedule per Viator". Collapsing and re-expanding does NOT refetch
- [ ] A plain park/beach/plaza (not tourable) shows NO tours block and NO button (unchanged)
- [ ] Cost/rate check: a 20-card list makes ≤20 `/viator/products` calls and ZERO `/viator/schedule` calls until a card is expanded; a second visit to the same attraction returns `source:'cache'`
- [ ] Activity search ("zipline") product rows now show duration + "Free cancellation" where flagged; footer reads "Tours & prices by Viator"
- [ ] Airplane mode / worker down → the card falls back to the plain "Book a tour here" button ('na' path); nothing crashes

## 🏨 Nuitée Connect in-app hotel booking lane (2026-09-01)
The hotel lane a traveler can finish INSIDE the app, beside the Stay22 referral lane. Nuitée (LiteAPI) is Merchant of Record; its Payment SDK takes the card on a page served by OUR worker, opened in the in-app sheet; the return page books server-side from a KV session and writes ONE confirmed row into `affiliate_clicks` (partner `nuitee`, category `hotel`) so My Trips lists the stay immediately — no conversion import. Closed-User-Group pricing is permitted because the whole app sits behind sign-in — **rates must never render outside the app** (no share cards, no web pages). Environment = which secret: wrangler var `NUITEE_ENV` (`sandbox` → `NUITEE_SANDBOX_KEY`, else `NUITEE_API_KEY`); both secrets are set. Worker routes: `POST /hotels/nuitee/search · prebook · status · booking`, `GET /hotels/nuitee/checkout?sid= · return?sid=`. Files: `cloudflare-worker-v7.12.js`, `wrangler.toml` ([vars] NUITEE_ENV), `src/pages/FindAHotel.jsx`, `src/components/hotels/HotelBookSheet.jsx`, `src/lib/openPartner.js` (openPartnerAndWait), `src/pages/MyTrip.jsx`.
State: **Deployed in SANDBOX** (worker f0b110d → 995cd6d; frontend 09ffb23 + 723dea1, synced to iOS) · D1 table `nuitee_sessions` created (05_nuitee_sessions.sql applied 2026-09-01) · **curl-verified end to end in sandbox:** 40 priced Anaheim hotels → prebook → checkout page (SDK, publicKey sandbox) → simulated payment → CONFIRMED bookings hdbud59bL · AU2XF47Vp · o3AcNZlpZ · XEkz3tbkt → status `booked` immediately (D1) → confirmed rows in affiliate_clicks · unpaid landing stays pending + re-prebooks · Device ⬜ · **Production flip ⬜ (founder go)**
- [x] **Deploy 1 (sandbox):** push → deploy-workers green. Smoke via curl: `/hotels/nuitee/search` (Anaheim, dates next month) returns priced hotels with `env:"sandbox"` → `/hotels/nuitee/prebook` (sandbox needs no JWT) returns `sid` + `checkoutUrl` → GET checkout renders the card page (or "Simulate payment" if sandbox issues no SDK transaction) → GET return renders "You're booked" with a bookingId → `/hotels/nuitee/status` says `booked` → the D1 row exists: `select * from affiliate_clicks where partner='nuitee'`
- [x] Fixes found by the smoke test, all deployed: offerId cap (ids are ~1k chars) · a prebook is consumed by its first /rates/book — unpaid landing now re-prebooks · one clientReference per attempt · sessions moved KV→D1 (KV edge cache served stale `pending`) · sandbox `simulate=1` path · sandbox rows tagged `intent=sandbox`
- [ ] **Device (still sandbox):** `npm run build && npx cap sync ios` + ⌘R → Find a Hotel → pick dates → "🔐 Book in the app · SANDBOX" section above Stay22 → Book here → sheet prefilled with your name/email → Continue → confirmed price → Pay securely → sandbox card 4242 4242 4242 4242 → Done → sheet shows "You're booked" → My Trips lists the stay under Stays with "Booked in app"
- [ ] Payment sheet closed WITHOUT paying → sheet shows "Payment not completed yet" with Reopen / Check again; no D1 row
- [ ] Flexible dates (no range) → NO in-app section, Stay22 only; address-only search (city centre / typed sight) → Stay22 only
- [ ] **Deploy 2 (production):** set `NUITEE_ENV = "production"` in wrangler.toml → push → real rates appear (no SANDBOX label). ⚠️ From here a completed payment is a REAL reservation.
- [ ] Nuitée dashboard: Commission section — confirm the default markup is set (this is what we earn); Payouts — payout method attached before the first real booking
- [ ] Privacy policy §5 already discloses booking partners; add "Nuitée Travel Ltd (hotel payments, merchant of record)" by name before public launch

## ⬜ White screen after splash — fixed (2026-09-01)
Device/simulator showed the splash then a blank white screen. Cause: `src/pages/MyTrip.jsx` and `src/components/home/VibeBundles.jsx` used `openPartner` at module top level without importing it (in-app-browser wiring, 2026-08-31) → ReferenceError at module evaluation → React never mounted. Neither `npm run lint` (no `no-undef`) nor `npm run build` (Rollup ignores free identifiers) can catch this; booting the bundle does. New gate: **`npm run boot-check`** (`scripts/boot-check.sh` — vite preview + headless Chrome, fails on uncaught errors / empty #root), added to CLAUDE.md's pre-push block. Files: `src/pages/MyTrip.jsx`, `src/components/home/VibeBundles.jsx`, `scripts/boot-check.sh`, `package.json`, `CLAUDE.md`.
State: Committed + pushed (frontend-only, no worker deploy) · iOS bundle synced · boot-check ✅ on the fixed bundle, ❌ on the broken one (verified both ways) · Device ⬜
- [ ] ⌘R → app reaches the sign-in gate / Home (no white screen)
- [ ] Then run the Nuitée sandbox device checklist above (it was blocked by this)

## 🔍 Runtime-hazard audit + fixes (2026-09-01)
After the white-screen bug, a 113-agent audit read every frontend file changed this session for runtime-only defects (lint/build-invisible), with 3 adversarial refuters per finding: 32 candidates → **30 confirmed** (1 screen-crash · 24 wrong-behavior · 5 cosmetic). A second fleet fixed them (one implementer + one reviewer per file group); reviewer follow-ups applied by hand. **26 fixed** across three commits (hotel checkout ×5 · passport/stamps ×12 · reliability ×9). Gates: eslint ✓ · build ✓ · **boot-check ✓**.
State: Committed + pushed (frontend-only) · iOS bundle synced · Device ⬜
**Deferred (Phase B backlog):** ActivityDetail:139 whole page blocks on the LLM tips call (design: fire-and-forget + tips skeleton) · ActivityDetail:286 Share/Copy link is a capacitor:// URL nobody can open (needs deep links) · stampVariants GPS bypass uses the family's 60 km gate, not the park footprint (latent until a fix lands inside a park) · MyTrip asserts "Confirmation emailed" for sandbox rows too.
- [ ] ⌘R → Find a Hotel → change dates after a search → in-app results clear; open a sheet then move >10 km (or wait for auto-follow) → sheet stays
- [ ] Stamp a place at 8pm+ local → passport shows TODAY's date
- [ ] Open a Home-row attraction → stamp → country appears in the passport country count
- [ ] Things To Do in airplane mode with a warm cache → tiers stay, red connectivity note (not "No activities found")
- [ ] Vibe bundle → Souvenirs → Shopping opens on the Souvenir chip

## 🧱 Phase B — Tier-1 close-out + Tier-2 labels (2026-09-01)
Seven frontend file groups (one implementer + one reviewer each) + a worker batch (adversarially reviewed, 3 findings folded in). Frontend pushed; worker HELD. Files: PlacesToEat, CoffeeFinder, ATMFinder, Shopping, ConvenienceStore, RestroomFinder, RightNowStrip, CultureInformation, AtmAIDetails, AttractionAIDetails, LocationContext, ThingsToDo (labels); worker: attractions handler, restaurants dispatch (T1.10/T1.14), activity mappers (T2.4), enrich-owned (T1.5), AI stubs (T2.3).
State: Frontend + worker DEPLOYED (push-all 2026-09-02, run 33649204321) · iOS bundle synced · Device ⬜
- [ ] Cold start with location denied → every finder shows "Choose a location to search", no spinner, badges read "–"
- [ ] Navigate to Tokyo from the US → Eat/Coffee/Shopping Open/Closed match Tokyo time (or show nothing), never the phone's clock
- [ ] Coffee browse in an owned-DB city → "Open Now" chip disabled with the one-line hint until a café's hours load
- [ ] Every star rating shows a quiet "Google" beside it (Eat, Coffee, Shopping, ATM, Convenience, Restroom — cards + map popups)
- [ ] Home "Most-hyped" dishes and Cultural Info safety cards carry "(AI estimate)"
- [ ] Cold open after a GPS session → header reads "Your current location", not yesterday's city as a pick
- [ ] After the worker push: "bagels" in a city with no bagel shop → "other bakeries nearby" fallback (not "No exact match"); "spicy ramen" returns without a multi-second stall; Things To Do distance chips read "≈15–50 mi" etc. (no "Drive"/"Flights")

## 🏅 Stamp-worthiness bar — LIVE in D1 (2026-09-02)
Founder philosophy (see memory `stamp-worthiness-philosophy`): a place earns a stamp by clearing an ABSOLUTE fame bar, never by being a city's best. Calibrated on 58 founder-labeled places (binary 58/58; zero locals through) + 2 adversarial passes; scorer `scripts/attractions-seed/score-fame.mjs` (QID-keyed w/ 30 km coordinate check · class gate before fame · WDQS-free P279 closure · resumable · coverage guard). All 1,706 D1 rows graded + deduped by QID: **65 world · 424 national · 299 regional · 918 local (browse-only) · 95 duplicates retired.** Valencia's rail: 20 auto-seeded parks → **Six Flags Magic Mountain**. Paris rail now leads Eiffel → Louvre → Orsay → Notre-Dame → Versailles.
State: **DEPLOYED 2026-09-02** (push-all: 10 commits, run 33649204321 green) · live-verified: stamps rail near Valencia = Six Flags only; browse unchanged (18 rows); distance bands verb-free · iOS bundle synced (⌘R pending) · founder-review queue open
- [ ] Founder review (set `founder_scope` to promote): Sorbonne (86, campus) · La Bastille (84, 'prison' — demolished landmark, promote?) · Gothic Quarter (29) · Nanjing Road (28, shopping street)
- [ ] After worker push + ⌘R: Home in Valencia shows Six Flags + nearest LA icons, zero neighborhood parks
- [ ] Event venues (Dodger Stadium etc.) scored regional+ but game-day gating is ROADMAP #24b — stamps allowed meanwhile
- [ ] Global seed MUST run through this same bar (rule saved in memory)

## 🧭 "The Google of Travel" — north-star brief delivered (2026-09-02)
Product + design brief synthesized from a code-verified surface inventory (31 pages, dead routes found), a coherence audit of 9 founder screenshots, and 3 research tracks (anticipation psychology, arrive-rested flight timing, package-pricing UX). Artifact: https://claude.ai/code/artifact/7b3b4221-403e-457b-9d65-838879a0d4a9 · One search box, two modes (DREAM/NEARBY); 19 tiles → 5 doors + toolkit; Trips = MyTrip+Wishlist+Saved; Smart Packages S1–S7 (one corridor first; flights only inside packages); anticipation loop without dark patterns.
State: Brief delivered · hygiene #1 (poisoned homerows cache) ALREADY SHIPPED (59dfc82) · Phase 0 rest awaits founder go
- [ ] Founder reads the brief → go/no-go on Phase 0 (photo roulette → P18-by-QID, one-pool dedup, chrome un-stack, hero collapse, dead-surface deletes) and Phase 1 (the spine)
- [ ] Apply to Flex Pay (Uplift) — longest lead item; needed for Smart Packages installments
- [ ] Nuitée sandbox device test → production flip (Phase 0's money item)

## 2026-09-03 — Global Stamp Atlas applied to D1 (source='icons')
- **What:** 1,363 founder-approved atlas rows resolved via enwiki search → Wikidata QID + P625 coords; 1,263 inserted into `globeskimmers-attractions` as `id='icon:<qid>'`, `source='icons'`, `founder_scope=<atlas scope>`, `scope=<fame-bar verdict from measured sitelinks>`, `tier='page'`. 77 unresolved went to a second pass (`seed-atlas-retry.mjs`, top-5 candidate scan gated on coords) — remainder goes to the founder's manual list.
- **Dedup v2** run after apply: one row per qid, priority founder > icons > curated > wikivoyage > ranked > auto; losers demoted to `scope='local'`, `founder_scope=NULL` (new — old dedup left founder_scope set, which `coalesce(founder_scope,scope)` would still have stamped), `class_ban='duplicate'`. 106 demoted. Verified: Q243 Eiffel → icon row canonical, curated+wikivoyage twins demoted.
- **State:** stampable rows by source now icons 1,261 · ranked 301 · wikivoyage 190 · curated 143 · auto 47 · founder 3.
- **Deployed/activated:** yes — applied directly to remote D1 in 200-stmt chunks. No worker change; no Activate steps pending.
- **Also:** `aggregate-pageviews.mjs` rewritten (v2) after the full-planet run OOM'd Node's 2GB heap: shell-side grep prefilter, index-scan parsing, Float64Array tallies, per-month checkpoints (resumable).

## 2026-09-03 — Atlas close-out: retry + triage passes applied; 1,317 icons live
- **Retry pass** (`seed-atlas-retry.mjs`): 73/77 first-pass misses re-resolved via top-5 candidate scan gated on coords. **P31 verifier** (`verify-atlas-retry.mjs`) then flagged 31 wrong entities (cities, events, sub-venues — e.g. EPCOT→Orlando, White House→Burning of Washington).
- **Founder-triage pass** (`seed-atlas-final.mjs` + `data/atlas-decisions.json`): 35 accepts by qid, 20 exact-title corrections (municipal guard still enforced), micro-round recovered Lake District (Q211778) + Dashashwamedh Ghat (Q3630402, stands in for Varanasi Ghats).
- **Applied to remote D1** + dedup v2 re-run + popularity copied from qid twins. **Final: 1,317 `source='icons'` rows** (1,315 stampable), **23 places on `data/atlas-founder-manual.json`** — no confident enwiki/Wikidata identity exists; founder supplies coords or drops them.
- **Deployed/activated:** yes, all D1 changes applied remote. No worker change in this batch.

## 2026-09-03 — Google-of-Travel Phase 0 + Smart Package plumbing (worker + frontend)
- **Worker** (auto-deploys on this push): (a) `/attractions/nearby` + home-rows now carry `qid`; new `getWikiPhotoByQid` — canonical Wikidata P18 by KNOWN QID for card photos, Openverse only for qid-less rows (ends photo roulette); Where-to-next uses Commons via getWikiPhotos first; home rows PARTITION the pool (no attraction twice per bundle, rows under 3 cards dropped); `homerows_v2_`→`homerows_v3_` (poison-proof bump). (b) NEW `POST /attractions/get` {id} for deep links. (c) Smart Packages: `recordPriceHistory` ambient capture wired into Nuitée search (3 cheapest nightly) + Viator products/availability; NEW `POST /viator/availability` (rung 3, /availability/check, 10-min KV; defensive mapping — probe live and adjust). (d) `/parse-search` v2: `dream_destination` intent ("see bears catch fish") grounded against attractions D1 (world/national) → `destination {grounded, id, lat, lng…}`; prompt version v1→v2 (cache keys rotate).
- **Frontend:** ActivityDetail is id-addressable (`/ActivityDetail?id=…`; writers pass it; shares now deep-link; LLM tips no longer block first paint — skeleton via loadingDetails); Home hero collapsed 330px card → compact greeting (search above the fold); dead surfaces deleted (/Map, /AdminDashboard routes + GenerateIcon.jsx, TestAPI.jsx — removes 2 of 3 remaining base44.functions call sites); AdBanner ops serialized + generation-guarded (replaced instance's late teardown can't kill the fresh banner).
- **D1 (events):** `07_package_orders.sql` APPLIED remote 2026-09-03 (package_orders + price_history). No Activate steps pending.
- **Gates:** node --check ✓ eslint ✓ build ✓ boot-check ✓ (adversarial reviews: 2 findings found and fixed — camelCase deep-link mapping, small-pool row collapse).

## 2026-09-03 — The six-section Home (Passport Standard, Phase 1a)
- **What:** both tile grids (9 + 10) replaced by one stable finder chip row (Eat · Coffee · Things to do · Hotels · All services) + new `AllServicesSheet` (every old destination, grouped EAT&DRINK / GET AROUND / MONEY / EXPLORE / ESSENTIALS, MapAppSelector-pattern bottom sheet). VibeBundles + WhereToStay unmounted from phone Home (files intact; both return inside the Perfect Day planner / FindAHotel flow per the doctrine). HomeBanner OFF Home (finder pages keep theirs; FloatingNav no longer lifts on Home; spacer 180px → calc(96px + safe-area)). Section order = the doctrine's two stacks keyed on journeyMode. Tablet (HomeTablet.jsx) deliberately unchanged — converges in a later pass.
- **Doctrine:** The Passport Standard artifact (memory: google-of-travel-brief). Home now ≤7 self-hiding sections per mode, search + chips above the fold.
- **Gates:** eslint ✓ build ✓ boot-check ✓ · adversarial review CLEAN (19/19 nav targets verified against PAGES).
- **Deployed/activated:** frontend-only — ships to web/native on next app build; `npm run cap:sync` run tonight so the iOS project carries it.

## 2026-09-03 — Backlog trio: T1.15 batch enrich · T2.5p2 GPS-first cold start · My Trips detail
- **T1.15 (worker + 3 finders):** `/places/enrich-owned` accepts `{places:[…]}` (cap 20, 5 lanes, per-item isolation → `{results:{id:payload}}`); per-place logic extracted to `enrichOwnedOne` so KV keys/TTLs identical between single+batch (shared cache). Single-place contract byte-compatible — ATM/Convenience/Money/Restroom/ThingsToDo callers untouched. PlacesToEat/Coffee/Shopping batch the rendered page: ~20 calls → 1 per page.
- **T2.5 part 2 (LocationContext):** cold start with pref `'current'` + permission already granted → 5s-capped coarse GPS verify BEFORE the restored city stands; failure/denial falls back to the restore. `'ask'`/`'continue'` byte-identical. Covers deep-link cold opens too (init-level).
- **My Trips:** rows open a BookingDetailSheet (sheet pattern, mono dates·ref·status, copy booking ref, honest status chips; nuitee = stored fields only, partner rows = View on {partner}). No new worker calls.
- **Gates:** node --check ✓ eslint ✓ build ✓ boot-check ✓ · adversarial review CLEAN. AUDIT: T1.15 done → Tier 1 fully closed; T2.5 fully done.

## 2026-09-03 — enrich-owned gid guard (attraction ids no longer masquerade as Google ids)
- Probe found `matched:false` for `icon:Q243` — the uuid-only test let every attractions-D1 prefixed id (`icon:`/`wikidata:`/`curated:`/`wv:`) pass straight into the details call AS a Google place id → 404 → no hours/utcOffsetMinutes for any attraction row (silently undermining T1.5). Only Google-shaped ids skip resolution now; deployed + live-verified: Eiffel `matched:true`, utcOffsetMinutes 120, photos 3, openNow true.

## 2026-09-04 — NOW phase: Today card · Dream shelf · masthead passport line · Perfect Day planner
- **TodayCard** replaces RightNowStrip on phone NEARBY Home — one answer card: meal-window headline, dish chips (byte-identical culture cache keys — zero new AI spend), TONIGHT priced-event line (shared 6h events KV), one teal Find-{meal} action.
- **DreamShelf** — DREAM-mode stampable rail with the endowed denominator ('{CITY} · N OF 12'); photo cards or engraved stamp cards, never placeholders; COLLECTED tags; no secrets (found by being there).
- **Masthead** — mono 'PASSPORT · N' (never a fake count; arrow when 0/loading) in the Home header.
- **PerfectDay** page (registered manually in pages.config) — selection-before-itinerary: 8 stampable cards, mood lens (VibeBundles moods, de-emoji'd), pick 2–4 → Morning/Afternoon/Evening with mono travel-delta estimates (footnoted), owned lunch/dinner anchors (source-labeled), TONIGHT event, deterministic Swap/Regenerate, Save-this-day (localStorage). Entry cards on both Home stacks. All owned/cached data; no new AI calls.
- **Review:** 2 confirmed findings fixed post-review (selection ring teal→stamp red; StopRow img onError→StampVisual). Tablet still on RightNowStrip — tabled by founder.
- **Gates:** eslint ✓ build ✓ boot-check ✓ (re-run after fixes).

## 2026-09-04 — Wave A SHIPPED + /package/draft live-verified
- Deployed (bdf1df0): dream-search answer card, Trips + nav pill, package endpoints. Live probe: Anaheim 10/09–10/12 ×2 adults → [cheapest] Candlewood Suites $320.63 total · [second_cheapest] DoubleTree $380.97 · 2 priced tours (Universal VIP $359.96, LA icons $99) · event: none in window (honest) · draft persisted (package_orders, status 'priced', sandbox). cap:sync ✓ — native projects carry Wave A.
- Ops note: two boot-check zombie hangs traced to orphaned vite/Chrome holding port 4173 after a foreground timeout; gates now run with explicit orphan kills + a 200s watchdog. `split` 2-letter-suffix cap (676 files) silently truncated the planet load — tail re-chunked with -a 3 and loaded in parallel.

## 2026-09-04 — Wave B1: door primitives + Shopping/Coffee/ATM converged + TTD date picker
- **Primitives** (src/components/finder/): FinderHeader (the extracted 3-block top + mono count segment '{N} NEAR YOU'), PhotoOrIcon (first-working-photo, icon-on-tint fallback — never a bare box), FinderEmptyState (serif title · mono reason · ONE honest action; dead radius buttons abolished), FilterSheet (AllServicesSheet mechanics, z under location surfaces) + src/lib/sourceMeta.js (honest-source vocabulary promoted).
- **Converted:** Shopping (pilot; + refresh it never had, + WishlistButton), CoffeeFinder (quick pills capped at 2, rest → sheet; + save), ATMFinder (bank <select> → sheet chips; emoji badges → mono BEST OVERALL/SAFEST). Empty/error states across all three now honest (Search somewhere else / Clear filters / Try again).
- **ThingsToDo date picker:** 'Pick a date' chip (page + per-card) → POST /viator/availability per code+date → 'available · from $X' / 'not available' / silence when unverifiable (credit only when a real answer rendered). adults=2 v1.
- **Review:** 1 confirmed fix (Coffee stale count mid-refetch) + tone + quick-pill clear-filters gap — all fixed pre-push. Gates: eslint ✓ build ✓ boot-check ✓.

## 2026-09-04 — Wave B2: all ten doors on the template
- Converted: RestroomFinder (dual-refresh collapsed; auto-widen kept), ConvenienceStore (local PhotoGallery deleted → shared modal; +save; popup CSS hoisted), PlacesToEat (7-group accordion → sheet; cuisine scroller stays the signature; +save; zero behavior change to fetch/tiers — reviewer diffed the pipeline byte-level), MoneyExchange (the app's last radius slider dies; data-row variant documented), GetARide + Transportation headers. FallbackDisclaimer button copy aligned with its new action ("Search a wider area").
- Review: CLEAN, zero confirmed defects. Gates: eslint ✓ build ✓ boot-check ✓.

## 2026-09-04 — THE PLANET IS LIVE: global seed loaded, scored, deduped, remediated
- **Loaded:** 104,875 emitted rows (734 chunks; split-suffix truncation caught + tail-loaded) → **102294 total rows** in ATTRACTIONS_DB covering 20,923 city pages worldwide.
- **Scored:** fame bar over every row — near-API-free via prewarmed caches (QIDs decoded from ids; signals from the classify fetch; P279 closure memoized). Tally pre-dedup: 734 world · 9,368 national · 11,122 regional.
- **Repaired:** 3,292 duplicate-id collisions P625-verified (214 restored — the Kolkata-owned Eiffel among them, 8,961 km off; 117 full-mistag deletes). qid backfilled; dedup v2 re-run (icons > wikivoyage priority).
- **Remediated (4 passes + 1 surgical):** name+proximity stamp dups (Magellan's Cross case) · mall/creative-work/pure-city classes · pre-classify six-city leaks (rides, teams, sports-concepts) · P279-closure subclass sweep (Tatsu-class). **Final: 18654 stampable rows planet-wide.**
- **Rails verified live:** Valencia CA = Six Flags ONLY (the founder's original bar, now planet-scale) · Paris = Eiffel→Arc→Louvre→Catacombs→Panthéon · Anaheim = Disneyland·Queen Mary·Knott's · Cebu, Tokyo, Marrakech serving real attractions.
- **Founder review lane (deliberate residuals):** stadiums/arenas stay pending event-gated stamping (philosophy); Shinjuku Station, NYSE, Gap Bluff, Officers' Mess, 'Disney Animation' await verdicts; **Harrods + Galleria V.E. II demoted as malls — promote via founder-lane if they should stamp.** 696 dup-ids had no P625 (left alone), 21 residual concept/team rows were cache-blind (2 fixed surgically).

## 2026-09-05 — Bookings v2, Waves 1+2: My Trips v2 + checkout redesign
- **Trips v2:** soonest-due sort (local-midnight math, DST-proof), in-stay pin ('ENJOY YOUR STAY'), 'IN N DAYS' countdown, undated partner rows honest ('Dates live with {partner}'), Past section (checkout+1 sinks; CANCELLED sinks immediately; COMPLETED chip), expanded detail via lazy POST /hotels/nuitee/booking (confirmation code primary + copy, rooms/holder/cancellation verbatim, 'Paid X · charged by Nuitée' + statement small print — no card data exists, none faked), redacted share (name/dates/city/address/party — never refs/amounts) via navigator.share→clipboard.
- **Checkout redesign (worker-served):** Passport Standard shell, price recap card, 'Pay {total}' serif commitment heading above the SDK mount, verbatim cancellation line, Stripe+MoR trust block with lock, 52px actions; confirmation state with copyable refs + 'Return to GlobeSkimmers'. Stripe Appearance pass-through attempted (harmless if ignored). Sandbox gates untouched.
- **Review:** CLEAN; 1 minor DST edge + currency-code duplication fixed pre-push. Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-05 — Bookings v2, Wave 3: address/date plumbing
- Prebook payload + session carry address/lat/lng/thumbnail/roomLabel (guarded, zero new API calls); /hotels/nuitee/booking merges them (live payload wins, nothing invented for legacy rows); affiliate_clicks gains checkin/checkout (08 migration APPLIED remote 2026-09-05; worker degrades gracefully either deploy order — INSERT + SELECT fallbacks simulated by the reviewer); Trips sorting prefers real columns over the name regex; detail sheet address card opens MapAppSelector ("Directions"); share picks up address automatically.
- Review: CLEAN. Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-05 — Bookings v2, Wave 4: rooms & rates
- Worker: maxRatesPerHotel 1→6 + roomMapping; per-hotel rates[] (≤6, price ASC, offerId-deduped) with top-level fields still the cheapest rate (package-draft verified compatible); KV key nuitee:search v1→v2.
- Frontend: results card leads with trip total ('$X total · N nights', nightly beneath) + cancellation line; 'See rooms' opens the new first stage in the book sheet — ≤3 room cards (supplier's real names, serif) × cheapest + refundable alt ('+$X · free cancellation until {date}'), 'More rooms' disclosure; no-rates hotels behave exactly as before; page accents blue→teal.
- Review: 1 CONFIRMED (rates[] emitted 'refundable' vs sheet's 'freeCancellation' — the refundable-upgrade feature was silently inert + labels wrong; fixed at source) + offerId dedupe + valid-rates gate. Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-05 — Bookings v2, Wave 5: amenity filters (FINAL WAVE)
- Worker: /data/facilities KV-cached 30d; name→id resolution with alias table; request params facilities/refundableRatesOnly/boardType (docs-verified); 400-degrade retry; refundableOnly double-enforced locally; deterministic filterSuffix on the KV key; response carries filtersApplied/filtersDropped.
- Frontend: chip row (Parking · Free breakfast · Free WiFi · A/C · Free cancellation) + More disclosure (Gym · Fridge · Microwave · Airport transfer · Shuttle service, coverage note); honest amber line for dropped filters; re-search through the request-seq guard, gated on exact dates.
- Review: 2 CONFIRMED fixed pre-push (top-level freeCancellation went undefined after the W4 rename — every card read Non-refundable; chip toggles re-fired Stay22 + demand analytics without dates). Gates all ✓.
- **Bookings v2 COMPLETE (Waves 1–5). Next: founder sandbox re-test → production flip.** Post-deploy smoke: probe facilities:["parking","free wifi","gym","air conditioning","airport shuttle","shuttle service","breakfast"] and check the applied/dropped split.

## 2026-09-05 — 🎉 NUITÉE PRODUCTION FLIP (founder-authorized)
- Founder completed TWO sandbox device tests end-to-end (wumWlmV9Q on the v1 flow; uSFAzVwPN through the full Bookings-v2 flow) and said "flip it". NUITEE_ENV sandbox→production (one line); sandbox rows purged (affiliate_clicks intent='sandbox' + nuitee_sessions env='sandbox'); privacy page names Nuitée Travel Ltd as merchant of record. In-app hotel bookings are LIVE with real inventory and real payments.
- Still on founder: Commission/Payout in the Nuitée dashboard (margin accrual); one real low-value booking to verify the statement descriptor + cancellation path. "Book a Hotel" rename remains an open verdict — not shipped without the word.

## 2026-09-05 — Smart Packages storefront v1 (bookable packages, day one of production hotels)
- New /SmartPackages: destination (dream-search state or geocode) → dates/party → POST /package/draft → the TWO hotel choices (LOWEST PRICE / BEST REVIEWED kickers, stamp-red selection, teal reserved for Book) · ≤2 tours per Viator (payout-wrapped links) · event row · honest hotel-only total ("Tours and tickets are booked separately at the prices shown") → Book this hotel hands the choice into the LIVE production HotelBookSheet. Entries: Dream card "Build my trip" (grounded only) + Home DREAM-stack card.
- Review: 2 CONFIRMED fixed pre-push — raw Viator urls dropped the pid that pays us (viatorProductLink wrap); same-day date range composed into a worker 400 labeled as a network error (canCompose now requires checkout > checkin). Gates: eslint ✓ build ✓ boot-check ✓.

## 2026-09-05 — Events v2: destination-scoped Viator, honest dated windows, photo-led cards
- Founder screenshots showed Abu Dhabi/Las Vegas/Barcelona products under "Tonight in Santa Clarita" — the Viator lane was a BARE freetext with no geo scope. Worker: Viator now scoped via viatorDestinations + viatorNearestDestination(lat,lng,40mi) + productFiltering.destination, ladder destination→parent→honest empty (429 breaks); no local destination → experiences:[] (empty beats wrong-city). Response split {events (dated TM), experiences (Viator, never dated), destination}; TM rows gained dateTime/localTime + endDate/endTime (only when TM reports a real non-approximate end — "when does it end" is a decision variable for parents; never estimated); KV events:v3→v4.
- EventsRow redesigned: photo-led 300px cards (4:3 image — the photo got bigger, not the font, per founder), mono "Sat, Sep 6 · 7:30 PM – 10:00 PM" line (end only when TM has one; date-only when no time — never invented), venue · city line, chips count/filter DATED events only (undated flex passes dropped), EXPERIENCES NEARBY sub-rail with the real scoped destination name, emoji removed per design language.
- Review: 3 CONFIRMED fixed pre-push — experiences field rename (image/id) left frontend reading thumbnail/code (every photo would fall back — the W4 contract lesson again; frontend reads both), destination documented-but-never-sent (worker now sends the actual scope name), parent-ladder products mislabeled with the nearest city's name (now labeled with the parent's own name). Verified consumers: TodayCard/PerfectDay/handlePackageDraft read only preserved fields.
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓ (bundle boots, 5870 chars).

## 2026-09-05 — Dream Galleries v1 ($0 destination photo browsing → package funnel)
- Founder: users dreaming about Greece/Japan/beaches need LOTS of realistic photos of the actual place — destinations, food, waterside — without big spend. Worker: POST /destination/gallery — Wikimedia Commons only ($0, existing WIKI_UA fetch), buckets views/beach/food/family, junk-filtered (svg/maps/flags/logos/low-res/panorama-stitches), attribution (artist+license+link) carried on every photo, KV dreamgal:v1 30d non-empty-only. Honest empty — never padded, never another destination's photos.
- Frontend: DreamGallery.jsx full-screen photo wall (2-col, lightbox with Commons credit link, bucket chips that hide when honestly empty, shimmer loading) + sticky "Build my trip" → SmartPackages via the existing router-state handoff. Opens from Dream Shelf taps (old details path kept as secondary) and from grounded dream answers ("See photos").
- Review: 2 CONFIRMED fixed pre-push — cache key omitted limit (the filterSuffix class; now always fetch/cache 40, slice per request) and a stuck-shimmer race on dest-swap-while-open (state keys now destination-scoped). Contract diff worker↔frontend verified field-by-field clean; no Google calls in the new path.
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-05 — Events: distance-honest experiences rail ("nearby" must be true)
- Founder (live on device): "Experiences nearby — it's not even the same city" (Santa Clarita user, Santa Monica rail — Viator has no Santa Clarita catalog, nearest real one is ~29 mi). Worker now sends destinationMi (rounded straight-line miles to the scoped destination, parent-attempt distance computed from the parent's own coords); KV events:v5.
- EventsRow: kicker says EXPERIENCES NEARBY only when the destination is the user's own city or ≤12 mi; otherwise WORTH THE DRIVE · {dest} · ~{mi} mi — distance reframed as the day-trip pitch instead of a false "nearby". Alternative on the table if founder prefers: hide the rail entirely outside the user's city.
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-05 — Events cards: date always shown, Today vs Tonight, no "Undefined" pill
- Founder: "Add date of event on each card. Even if it says today and tomorrow." Card line is now "Tonight · Sep 5 · 7:30 PM" / "Today · Sep 5 · 10:00 AM – 12:00 PM" — relative label keeps the short calendar date beside it; full "Sat, Sep 12" stays for non-relative dates. End times unchanged (shown only when TM reports a real one).
- Honesty polish from the same screenshots: morning/afternoon events (start < 5 PM, or unknown time) say "Today", not "Tonight"; TM's literal segment name "Undefined" is stripped at the worker source and guarded in the pill render (covers 6h-cached v5 payloads).
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-05 — Hotel checkout: big Pay button with the amount on it
- Founder: "make Pay a larger button". Inspected Nuitée's payment wrapper (loader + liteAPIPaymentStripe.js): the submit button is class .lp-submit-button, label set via config submitButton.text using textContent, and Nuitée ships NO CSS for it (cssFile empty in their /config) — hence the tiny default button. Our checkout page now styles it: full-width, 58px, 18px bold, TEAL_DEEP #0E7C73 with pressed/disabled states, matching the page's .btn language. Label is now "Pay $213.63"-style (raw nuiteeMoney — textContent, so unescaped by design).
- Gates: node --check ✓ (worker-only change; no frontend build needed).

## 2026-09-07 — STRIPE WAVE 1: the packages money path (test mode)
- Founder created the GlobeSkimmers Stripe account (own account, NOT the Nuitée Connect payout account) and uploaded STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY via wrangler. Klarna rides Stripe (auto-available on new accounts) — the separate Klarna application is now moot.
- Worker: stripeApi helper (form-encoded, secret only in the Authorization header); POST /package/checkout (amount ONLY from the D1 package_orders row — smallest-unit, non-2-decimal currencies rejected honestly; GoTrue-verified users get a Stripe Customer via new stripe_customers table, anonymous pays guest-style); GET /package/pay (nuiteeHtml-language page, Payment Element, big lp-submit-button "Pay $X", TEST MODE banner on pk_test_); GET /package/pay/return (server-side intent re-read, redirect params ignored; package_orders → paid/paid_test only on succeeded); GET /stripe/health; POST /stripe/domain/register (2-host allowlist). D1: 09_stripe_payments.sql applied remotely (stripe_customers + stripe_payments; client_secret lives only in D1 + the rendered page — never a URL).
- Frontend: SmartPackages gains a hidden ?stripetest=1 lane — "Test package checkout · Stripe" opens the hosted pay page via the same openPartnerAndWait flow as hotel checkout. Regular users see zero change.
- Review (money-path adversarial): 3 CONFIRMED fixed pre-push — double-charge window (abandoned redirect left a payable/succeeded intent; checkout now settles or REUSES the prior intent and refuses to mint when its fate is unverifiable), error contract (non-2xx bodies discarded by callWorker made every failure "check your connection" — business failures now 200 {ok:false,reason}), /stripe/health echoed Stripe's invalid-key message (key fragments; now code-only).
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓. Post-deploy: health probe, domain registration, live pay-page probe below.
- Post-deploy receipts (2026-09-07, after founder re-entered full keys): /stripe/health {ok:true, livemode:false}; /stripe/domain/register on globeskimmers-api.maizasimeon.workers.dev → apple_pay ACTIVE, google_pay ACTIVE, link ACTIVE, klarna ACTIVE. E2E: Anaheim draft sid 470e17ae… (Candlewood Suites $325.32) → /package/checkout amount 32532 USD → second call returned the SAME pid with reused:true (double-charge fix verified live) → /package/pay page carries js.stripe.com/v3, pk_test cfg, TEST MODE banner, lp-submit-button "Pay $325.32", return_url. client_secret confined to page HTML; URL carries pid only.

## 2026-09-07 — Stripe account ACTIVE (live mode exists; worker deliberately stays on TEST keys)
- Founder completed activation ~2:11 AM: account "globeskimmers.io", payments enabled, live keys issued. Radar Standard on; Stripe Tax skipped deliberately (memory reminder set for first real revenue); Klarna auto-enabled.
- Worker keeps TEST keys ON PURPOSE: /package/checkout charges but does not yet fulfill (no auto hotel booking from our funds). Live swap is gated on Wave 2 fulfillment — charging real money before delivery exists is the one thing we never do. NOTE: payment_method_domains registration is PER MODE — re-register the domain after the live swap.

## 2026-09-07 — DREAMER'S CORNER (Where-to-next reborn, $0 photo dreaming)
- Founder mandate: rename to Dreamer's Corner, events-size cards, swipeable per-country photo galleries with place-name captions, food photos, type-any-country, 10-20+ photos preseeded — all at $0 (Commons engine).
- HomeRows: row renders DREAMER'S CORNER kicker + "Places to dream about"; 300px 4:3 photo cards (EventsRow spec, serif name + mono COUNTRY, no emoji); tap opens DreamGallery (old quick-look kept as "View details"); end-of-rail "Dream anywhere" card with a real type-a-country input.
- DreamGallery: lightbox is now an index — swipe left/right (48px horizontal-dominant), chevrons hidden at ends, arrow keys, mono "N of M", reduced-motion-safe fade; wall photos gained serif place-name captions.
- scripts/prewarm-dream-galleries.mjs: warms 45 countries (typed path) + 27 curated card {name,country} PAIRS × all+food buckets, sequential 400ms, $0, re-run monthly.
- Review: 2 CONFIRMED fixed pre-push — preseed warmed only bare-country keys while curated cards key on name+country (the feature's primary taps would all have been cold; DESTINATIONS pairs added), and a stale lightbox index that swallowed Escape and could pop the lightbox open uninvited after an all-images-failed wall (empty-list clear effect). Gates: eslint ✓ build ✓ boot-check ✓ node --check ✓; frontend-only (no worker deploy).
- Preseed receipt (2026-09-07): full run 72/72 targets warmed · 4,278 photos cached · 0 empty · 0 failures. Re-run monthly: node scripts/prewarm-dream-galleries.mjs

## 2026-09-08 — FULL PACKAGE WAVE A: the composer brain
- Doctrine artifact 6bdbfe16 (founder-dictated tiers/rules) + Wave A shipped. Worker: POST /destination/intel (house AI pattern, strict-JSON hard validation → available:false on ANY doubt, money-claim regex guard mirroring sibling FORBIDDEN lists, KV destintel:v1 90d, guidance label on every response); /package/draft gains childrenAges (index-aligned, invalid→null never filtered) + rooms (clamped ≤min(adults,4)) + inline intel + attractions[] (top-8 owned ATTRACTIONS_DB fame ranking within 30mi, ~mi from city center, ticketedHint 'tours available' only from real attached-tour token overlap — no free/ticketed guesses) + A/C→breakfast→unfiltered 3-pass ladder with honest acNote/breakfastNote; /hotels/nuitee/search gains rooms+childrenAges via nuiteeOccupancies (legacy shapes keep byte-identical KV keys; all-default ages don't fork the key).
- SmartPackages: children ages row + rooms stepper (max = adults, re-clamped when adults shrinks) "4 travelers can be two couples"; KNOW BEFORE YOU GO intel card (renders nothing when unavailable); WHAT YOU'LL SEE selectable attraction rail (stamp-red picks, local-only, reset per compose, "distances are from the city center"); amber A/C-breakfast honesty notes.
- Review: 5 CONFIRMED fixed pre-push — rooms overstated vs quote (persisted count the quote didn't cover), See-tours keyboard hijack (lost affiliate clicks), missing money-claim guard on the new AI surface, occupancy cache fork on all-default ages, ages filter-before-slice misalignment (both public routes). Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.
- Intel hardening (post-deploy probe found nondeterministic available:false): validator now clips overlong strings at word boundaries and tolerates/slices knownFor lists instead of all-or-nothing rejection; one retry on parse/validate failure (honest {"known":false} never retries); debug:true stage markers (http_*/parse/validate/model_unknown) + rejected-sample for ops. Kyoto/Paris probes below.
- Intel receipts post-hardening: Kyoto available:true (cache hit path OK), Paris available:true, Tulum available:true — all with guidance label, no money language.

## 2026-09-08 — DEAL RADAR v1 (honest airline promo watching, daily cron)
- First cron on the worker: [triggers] crons 0 15 * * * (7am PT) + scheduled export (fetch untouched; sweep errors fully swallowed). Watches 7 OFFICIAL airline deals pages (Southwest/Alaska/Hawaiian/JetBlue/United/Delta/American; PAL omitted honestly — per-campaign URLs only). Pipeline: fetch → hash-skip (zero AI spend on unchanged) → Haiku strict-JSON classify (temp 0, one retry) → ANTI-HALLUCINATION validator: evidence must be a verbatim substring of the page, every number and date in a card must appear inside that evidence — fail → dropped. D1 airline_promos (applied); evidence never leaves the server. GET+POST /deals/list (7-day fresh, KV 1h); POST /deals/sweep gated on DEAL_SWEEP_KEY (404-indistinguishable). Home: self-hiding DEAL RADAR row, "Fare sales, straight from the airlines", verbatim Ends strings, See-the-sale link-outs (tracked, service-over-commission until Travelpayouts), "Build my trip" → SmartPackages name prefill.
- Review: 2 CONFIRMED fixed pre-push — /deals/list was GET-only while callWorker can only POST (feature dead on arrival; now accepts both) and unchanged pages never refreshed last_seen (a steady 3-week sale would vanish after day 7; unchanged sweeps now touch active rows). Plus: name-only Build-my-trip handoffs now prefill the destination search instead of being discarded; "Ends ends…" doubling guarded. Known honest limits (disclosed): JetBlue/United/American sit behind bot walls → 'fail: fetch' skips cleanly; digit check is presence-based; qualitative wording is prompt-enforced.
- Gates: node --check ✓ eslint ✓ wrangler deploy --dry-run ✓ (TOML + triggers parse, 5 bindings intact) build ✓ boot-check ✓. D1 10_deal_radar.sql applied; DEAL_SWEEP_KEY set (generated, never displayed).
- Live receipts: first sweep found Southwest "One-way flights as low as $59" (evidence-verified) + Alaska co-brand card offer → classifier tightened to FARE SALES ONLY (a232b00, hash v2 reclassify); stale Alaska card row deactivated by hand; JetBlue/United/American/Hawaiian bot-walled → clean 'fail: fetch' skips as designed; Delta honest zero. Cron fires daily 7am PT. deals/list KV refreshes within 1h of any change.

## 2026-09-08 — HOME THREE ZONES (the founder's three-intent mandate, shipped)
- Audit graded old Home: screen 3 = D (DREAM content sandwiched into NEARBY unmarked); SmartPackages = 70px text row on screen 4. Rebuild: single canonical spine in BOTH journey stacks — masthead capped at 2 lines (clock folded, 👋☁📍🏠 purged) → SmartSearchBar (the hinge) → NEARBY NOW kicker (chips · TodayCard · StampsNearYou · dated-only EventsRow · HomeRows nearby keys) → DREAM & PLAN kicker (PackageHero photo-led card replaces the text row, top of zone both stacks · DreamersCorner extracted from HomeRows · DreamShelf · ExperiencesRow extracted from EventsRow · DealRadarRow minus its CTA · EscapesRow) → YOUR TRIP kicker (StayAnchor · MyTripCard · WishlistCard, canonical order).
- Enticement data lines: whereToNext cards now carry lat/lng + live tempF (Open-Meteo batched, $0, KV 3h; homerows KV v4) → "84°F NOW · ~9H FLIGHT (EST)" mono lines on Dreamer's Corner + DreamShelf (est via new src/lib/flightTime.js, 150mi floor, EST label, no-NaN paths). Emoji purge across StampsNearYou/EscapesRow (mono TRAIN 1.5H tags)/MyTripCard/WishlistCard chips.
- Fetch discipline preserved: shared client caches (fetchHomeRows in DreamersCorner, fetchEventsSearch in ExperiencesRow) keep /home/rows and /events/search at ONE call each with all consumers mounted.
- Review: 3 CONFIRMED fixed pre-push — HomeTablet silently lost BOTH extracted surfaces incl. the Viator revenue rail (now mounts dreamers+experiences in all 5 mode orders); DreamShelf temp fragment dead via three-way contract fumble (cityTempF now wired from Home's weatherInfo); Number(null)===0 would have rendered the Gulf of Guinea's temperature for any future unmapped destination (null guards added). Known deltas: event_view now counts dated events only (exp_view is the new experiences metric); PerfectDayCard standalone pending StampsNearYou footer merge (TODO in Home.jsx).
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-08 — WAVE B: the dream tease + the guesstimator
- Worker: POST /package/estimate — intel-anchored auto-dates (monthTokens parses "May–June & September"/"November–April" with year-wrap + 14th-passed logic, scenario-tested; unparseable window → real 21-day-lead dates with monthLabel:null so "Best in {month}" is only ever an intel claim), dry-run draft (persist:false — byte-identical default path, zero package_orders rows, no phantom price_history), cheapest-choice supplier total for 2 adults, splitFour arithmetic, 6h KV keyed by slug+month, all failures 200 {ok:false}. Wave A attractions now carry the matched tour's REAL tourPrice/tourCurrency — each tour prices AT MOST ONE attraction (double-count killed) and tower/bridge/castle/palace/museum joined the stopwords.
- DreamGallery: the living-room pitch above Build-my-trip — serif "Want to take this vacation?" + "Best in May · roughly $650 for two · 4 nights" (Roughly-only when no intel month) + "~$163 × 4 if you split it · hotel only — tours and tickets priced separately"; CTA hands dest+checkin/checkout so the composer opens pre-dated; strict normalizeEstimate (partial data → no tease, ever); dream_tease_view/build analytics.
- SmartPackages: dates prefill from router state (strict validation, past rejected); "Trip estimate" block recomputes per render — hotel choice + picked tours (per-traveler from-rates × party adults, same-currency only, label "(from-rates × 2)"), unpriced picks "priced at booking", "~$X × 4 if you split it". Attraction cards show real "from $" prices.
- Review: 3 CONFIRMED framing fixes pre-push — generic-lead dates could masquerade as "Best in {month}" (intel-only now), per-traveler from-price summed once into a party total (× adults + labeled), one tour could price two attractions (exclusive pricing + stopwords). Grep across diff: zero klarna/financing/installment promises — split-4 is arithmetic framing everywhere. Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-08 — DEMAND INTELLIGENCE WAVE (the counting house)
- Client: dev guard (localhost analytics never pollute prod D1 — statically DCE'd from prod bundles); src/lib/useDwell.js honest foreground-dwell hook (pauses on hidden, once per session, 2s floor/10min cap); instrumented DreamGallery (per-destination gallery sessions) + SmartPackages (page dwell); force-flush on report so tab-close dwell survives (the module-level pagehide flush runs BEFORE component teardown — reviewer catch).
- Worker: nightly analyticsRollup on the existing cron (yesterday→events_daily upsert, idempotent; raw events >180d deleted in bounded rowid batches); engaged-events allowlist +8 post-launch taps (funnel undercount fixed); sandbox filter on all converted/intent affiliate queries; 5 demand queries + trip_feedback_recent (booking_ref dropped from SELECT — joinable to identity, page never renders it); POST /trip/feedback (validated, dupe-guarded per booking + 5/day/identity cap — public-write flood protection); paid_test → 'test (not revenue)' bucket in tier mix.
- Pages: DemandReport (admin-gated, founder-readable: What people browse/search/linger on/book + trip feedback; honest empty states; privacy footer now precisely true); AdminAnalytics link; Trips past-stay "How was your stay?" star prompt (past+dated only, idempotent thanks, localStorage dismissal).
- Review: 5 CONFIRMED fixed pre-push — tab-close dwell silently dropped (flush ordering), SmartPackages dwell key dest vs $.place_name (surface collapsed to ''), paid_test counted as paid on a founder metric, privacy footer overstated the feedback section + booking_ref leaked into the JSON, unbounded public feedback writes. D1 11_demand_intel.sql applied remotely.
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-08 — Rental cars lane (DiscoverCars, a_aid=beach3303)
- GetARide.jsx: RENTAL CARS section card (Passport Standard, no emoji) replacing the thin "Rent a car" row — "Compare rentals with insurance options · Free cancellation on most bookings · Full Coverage available at checkout" (Full Coverage = their UPSELL, never "insurance included") · "DiscoverCars — prices on their site" (no prices we can't source) · quiet teal "Browse rental cars" → trackAffiliateClick(partner:'discovercars', category:'car') → confirm sheet → opens returned url. Link = confirmed homepage form https://www.discovercars.com/?a_aid=beach3303 (city deep-link grammar NOT doc-confirmed → no invented prefill). ~$15-25/booking, 365d cookie.
- Review CLEAN (no findings): a_aid survives (worker AFF_SUBID_PARAM sets 'subId', a different key — searchParams.set can't clobber a_aid; raw-url fallback also carries it), no insurance-included claim, no prices, house pattern byte-consistent. Gates: eslint ✓ build ✓ boot-check ✓. Frontend-only — no worker deploy.
- TODO (worker, fold into flights ship): AFF_SUBID_PARAM.discovercars should be 'data1' (PostAffiliatePro's documented sub-id param) not 'subId' — click credits via a_aid either way, but sub-id won't surface in DiscoverCars reports until fixed.

## 2026-09-08 — WAVE C: flights lane (Travelpayouts, marker 755378) + split-line reword
- Worker: POST /flights/months {originLat,originLng,destLat,destLng,destName} — nearestHub (50-hub IATA map, 600mi honest cap, no_hub/same_hub) both ends → Travelpayouts /v1/prices/monthly (x-access-token header, currency usd); months[{month,label,price,direct}] cheapest-first, direct = transfers===0 (real data or null, NEVER invented), expired/past-departure fares dropped; note 'cheapest fares travelers found recently — not live quotes'; Aviasales deep link for the cheapest month with marker=755378 (NEVER-drop const); KV flmonths:v1 24h non-empty only; all failures 200 {ok:false}. env.TRAVELPAYOUTS_TOKEN live.
- DreamGallery: flight line inside the tease — "Flights: cheapest in {label} · from ${price} · LAX→NRT[ · nonstop]" + worker note verbatim + "See flights" opening the worker-built link (marker intact, never rebuilt client-side) via trackAffiliateClick(partner:'aviasales'); lazy, GPS-origin-gated, once per destKey.
- Review: 1 CONFIRMED fixed pre-push — the nonstop "promotion" reordered months[0] so "cheapest in {month}" could name a pricier direct month while the link opened a different (cheaper) month (fabricated claim). Fix: calendar stays PURELY cheapest-first (nonstop-first is a flight-SELECTION rule for the future itinerary picker, not a which-month rule); "· nonstop" now appears only when the genuine cheapest month is itself a nonstop fare; link always = months[0]. Marker/hub/honesty/contract all verified clean. Aviasales per-click sub-id rides as bare sub_id (marker commission intact; granular join is a later refinement).
- Founder copy: dream-tease + composer split line "~$X × 4 if you split it" → "≈ $X/mo × 4 months" (founder preference; upgrades to real Klarna wording when our own checkout goes live).
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.
- Copy honesty (founder): dream-tease affordability line → "≈ $X a night for two" (pure room rate, no payment-plan implication until our own checkout offers one); composer split sub-line REMOVED (decision surface wants the real total; no payment option at checkout yet). Full "Flexible payment options" presentation (founder heading choice, visual-dominant monthly over full price, Klarna supplies compliant terms as lender) is banked in memory for the checkout-live moment.

## 2026-09-08 — Keep partners in-app (no more Safari eject) + Wanderlust line
- Partner link-outs: 7 sites across 6 files converted from bare window.open (ejects to Safari on native) → openPartner (Capacitor Browser in-app sheet, Done button, affiliate cookies kept). GetARide DiscoverCars/Welcome Pickups (the founder's rental-car "exiting out" complaint), TravelEssentials Airalo/Radical, ThingsToDo website, ATM/Attraction operator sites, DreamGallery Wikimedia credit. Marker/subid preserved (trackAffiliateClick runs first, openPartner opens the RETURNED url). LEFT external (correct): MapAppSelector + Transportation transit routing + rideProviders app-scheme deep links (uber://grab://…) + App-Store fallbacks — Browser.open can't open Maps or dial. Review CLEAN, no findings.
- WanderlustLine.jsx: a quiet daily-rotating travel quote at the foot of Home (encouragement, never a sales line). 15 quotes — 9 public-domain authors (Augustine/Lao Tzu/Andersen/Seneca/Proust/Emerson/Thoreau/Twain/Stevenson) + 6 original GlobeSkimmers lines; NO living/20th-c-copyright authors (deliberate legal line); never a fabricated attribution. Deterministic by local day-of-year. Passport Standard (serif quote, mono attribution, no emoji).
- Gates: eslint ✓ build ✓ boot-check ✓. Frontend-only.

## 2026-09-08 — Dream gallery polish + passport page art fix (founder screenshot batch)
- Worker: destinationIntel gains `about` (3–5 sentence intro: what/character/how to get there/why go; 40–600 chars REQUIRED for available:true; first clause of the money-claim guard; destintel KV v1→v2; max_tokens 600→900); /package/estimate passes it through. Gallery relevance: root cause was CirrusSearch precedence — "Kyoto Japan skyline OR landscape OR panorama" parsed as (Kyoto AND Japan AND skyline) OR landscape OR panorama, matching worldwide files (Château de Rentilly, Bangkok, Iceland, an Iranian village under "Kyoto"); fixed to "Kyoto Japan (skyline OR landscape OR panorama)" = name mandatory, plus a diacritic-folded name-token post-filter (keeps Commons top order only if filtering would empty); dreamgal KV v1→v2.
- DreamGallery: intro blurb under the destination name (serif, "AI overview · verify details locally" mono label; renders nothing when unavailable); lightbox X moved into the safe area (top/right max(12px, env(safe-area-inset)) — was under the Dynamic Island, unreachable), 44px target, backdrop-tap close kept, swipe-DOWN-to-dismiss (vertical-dominant dy>80, reduced-motion-safe follow), image fallback ladder full→src(thumbnail)→"Photo unavailable" (keyed to climb exactly once, no loop).
- Copy (founder): "Build my trip"→"Build my vacation"; tease "Dream it? Build your vacation."; PackageHero subtitle "Hotel books in-app; tours & flights a tap away" (TRUE — no whole-package one-tap claim).
- PassportBook: the isCity branch (every "Stamp a place" stamp) was text-only and DROPPED the engraved art/TypographicStamp on the keepsake page even when the detail sheet showed it (Lake Louise #86 engraving never reached the page). Now city stamps render art-or-typographic + the "Visited / I was here @ / date" caption. GPS never gated art (only the ✓ badge) — kept that way per founder ("just type Banff and get the I-was-here thing").
- Review CLEAN (0 findings). Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.
- HOTFIX (post-deploy probe caught it): the paren-grouped OR query did NOT scope to the destination on Commons (CirrusSearch ignores the grouping — "Kyoto Japan (skyline OR landscape OR panorama)" = 0/8 Kyoto), and the "keep Commons order rather than empty" fallback then shipped the off-name photos anyway. Fix: plain AND per theme ("Kyoto Japan landscape" = 8/8 Kyoto, verified live) + intitle:"name" backstop; off-name photos NEVER shown (zero real → honest empty, uncached); dreamgal KV v2→v3 so Kyoto's bad cached set expires.
- OTA CONFIRMED WORKING (founder screenshot 9:37 PM: Kyoto blurb, real Kyoto photos, per-night line, flights line all arrived over the air on the Xcode-refreshed shell). Follow-up fix: the gallery SHEET header (kicker/name/close X) padded a fixed 16px and sat under the status bar — X unreachable; now paddingTop max(16px, safe-area-inset-top+12px) and a 44px close target.

## 2026-09-08 — OTA: the honest record + the cadence fix
- CORRECTION to the entry above: the 9:37 PM Kyoto screenshot was an XCODE install, not OTA (founder: "I didn't do that over the air"). What IS true, from Capgo's own device record (device 5859dd3b…, iOS 26.6.1, is_prod:false = the Xcode shell): bundle 1.0.2609080244 applied at 04:35Z and 1.0.2609080427 applied at 04:56Z — two OTA bundles landed on the founder's phone over the air. Server side (channel production, plugin 8.51.3, notifyAppReady in main.jsx) was never the problem.
- Why it read as "never arrives": Capgo's default autoUpdate 'atBackground' DOWNLOADS on one open and APPLIES on the next, so the phone was always one bundle behind the latest upload. Fix (capacitor.config.ts): autoUpdate 'onLaunch' (a cold start installs the newest bundle behind the splash), autoSplashscreen true + 8s timeout, SplashScreen launchAutoHide false; main.jsx hides the splash after first paint as a belt-and-braces.
- **Activate: these are NATIVE settings — one Xcode run (or the next TestFlight/store build) is required; after that, every bundle is over the air for every installed device.** Capgo CLI upload recipe unchanged (`npm run build && npx cap sync && npx @capgo/cli bundle upload --channel production --bundle 1.0.$(date -u +%y%m%d%H%M)`).

## 2026-09-08 — DEAL ENGINE PHASE 1: cruises + cars + budget airlines (live, 23 verified deals)
- Worker: DEAL_SOURCES 7→18 (flight: +Frontier, Sun Country, Avelo; cruise: Holland America, Celebrity, Virgin Voyages, Princess, Royal Caribbean, Norwegian; car: Avis, Budget; Spirit defunct May 2026; Allegiant/Breeze/MSC/Carnival/Disney/Hertz/Sixt bot-walled/JS shells). Kind-aware prompts share the five verbatim evidence rules; only the scope bullet differs (cruise allows % off fares / instant savings / kids sail free / reduced deposit / booking OBC, excludes add-on packages, loyalty, casino, credit cards; car allows base-rate %/$ and pay-now savings). Window = the DENSEST cluster of price signals (reviewer caught Budget's real page: a "$2345 Base rates" placeholder at char ~700 hid the offers 30k in — density fix verified live, windowStart 30042). Volatile tokens ("Updated N minutes ago", countdowns) stripped pre-hash; dealpage KV v2→v3; v1 SQL fallbacks fire ONLY on a missing-column error; /deals/list v2 {kind, brand, dest} LIMIT 24; probe mode {key, probe:true} = fetch+window every source, zero model calls. Home row: Flights · Cruises · Cars chips, FLIGHT SALE / CRUISE OFFER / CAR OFFER tags, partner ids airline-direct/cruise-direct/car-direct.
- Expiry: /deals/list drops deals whose `ends` is behind us (9/3, 9/7/26, Sept 30, October 15, 2026; year-less = this year; unparseable never hides) — a page that keeps its expired banner never re-hashes, so this has to happen at list time. TODO: apply the same filter on the KV-cached path (pending the composer hotel build's worker lock).
- Live receipts: sweep ok — Southwest 1, Frontier 1, Sun Country 3, Avelo 3, Celebrity 3, Virgin 2, Royal Caribbean 2, Norwegian 2, Avis 3, Budget 3; fetch-walled: Hawaiian/JetBlue/United/American/Princess; Alaska fail:classify (credit-card page). Review CLEAN (2 non-blocking, both fixed before push). D1 12_deal_radar_v2.sql applied remotely BEFORE the push. Gates: node --check ✓ harness ALL OK (+2 fixtures) ✓ eslint ✓ build ✓ boot-check ✓.

## 2026-09-08 — Search location + composer: the "Compose my package won't click" bug
- Root cause (founder typed "vietnam", picked dates, button dead): /search-location rejected every administrative_area_level_1 as "too broad" — "Da Nang, Vietnam" returned NOTHING (Google types Da Nang, Tokyo, Bali, Hong Kong as province-level, never locality); a country got a helpful "add a city" message the composer never displayed; the button stayed disabled with "Pick a destination".
- Worker: state/country results whose viewport half-diagonal ≤110 mi are kept as granularity 'region' (measured live: Hong Kong ≤60, Da Nang 67, Tuscany 103, Tokyo 105; Lapland 207, Hawaii 236, Maldives 321, Vietnam 581 stay broad); rejected places are reported in tooBroad[] {name, kind, country, halfDiagMi}; address components without `types` no longer throw (Bali crashed the whole search). New: /hotels/nuitee/search accepts minStars/minRating (LiteAPI starRating + minRating, own cache-key segment, stripped on 400) — live: Makati 4★+/8.5+ = 33 hotels, none dropped. New: POST /hotels/nuitee/hotel {hotelId} → LiteAPI /data/hotel static content (photos, rooms, bedTypes, facilities), KV 14d.
- Composer: Compose resolves typed text itself (top result); a country/region answers with curated city chips (src/lib/destinationCities.js, ~130 countries/regions/aliases; mapped regions like Tuscany/Bali route to chips even when Google admits them — "Bali" resolves to a rice terrace otherwise); the worker's honest no-result line is shown instead of silence.
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓. Live probes: Da Nang/Tokyo/Tuscany → region, Vietnam/Maldives/Hawaii → tooBroad with sizes, Bali → no longer throws.

## 2026-09-08 — COMPOSER HOTEL UPGRADE: quality bar, stay areas, photos, rooms/beds, honest amenities (founder's Manila screenshot)
- Root cause of the 3★ 7.4 "Also great": the old A/C+breakfast facility ladder pulled a DIFFERENT, cheaper 40-hotel page (LiteAPI facilities are OR-semantics; U Hotels $178 / Berjaya 7.4) than the unfiltered or quality pages (Peninsula, Conrad, Seda 9.2, Lanson Place 9.8). Gone.
- Worker /package/draft: QUALITY ladder (4★+ & 8.5+ → 3★+ & 8.0+ → best available, labelled; supplier-side starRating/minRating via /hotels/nuitee/search minStars/minRating). Two-choice: BEST VALUE first (default) + TOP PICK; when the top-rated hotel is also the cheapest it takes the value slot and the next-best-rated becomes RUNNER-UP (reviewer catch: a pricier, lower-rated hotel could otherwise wear the value label). draft.qualityBar {pass, minStars, minRating, poolSize}. Enrichment for the ≤2 picks only from Nuitée /data/hotel (nuitee:hotel:v1, KV 14d, $0): photos ≤24, description, check-in/out, REAL reviewCount, amenity tags from hotelFacilities only (free_wifi ≠ wifi; "public areas only / on request / additional charge" never tag), rooms with bed labels (1 King · 2 Queens · 1 Twin + 1 Double · 1 Super king + 1 Sofa bed), room photos/amenities (fridge, microwave, kitchenette, A/C…), rates↔rooms via mappedRoomId, per-rate breakfast/boardLabel (Half board stays "Half board"), per-choice honest A/C + breakfast notes. Stay areas: intel stayAreas (3–5, money-guarded, omitted when <3; destintel KV v3), body.stayArea geocoded once (Google text search, 20 mi guard, KV 180d keyed on destination coords — same-named cities can't collide), 4 km ring then honest widen (radiusKm null). NOTE: the /deals/list cached-path expiry filter rode along in this worker commit (f51a53e) — split threshold miss, not a scope creep.
- Frontend: PhotoLightbox (portal z-9999, swipe/keys/backdrop/swipe-down, safe-area close, src→hd ladder, dismiss-stack), HotelChoiceCard (div[role=button], 120px cover + N PHOTOS pill, kickers BEST VALUE / TOP PICK / RUNNER-UP / BEST AVAILABLE, supplier-backed amenity pills ≤6, bed label + supplier room name, base-rate facts shown before any pick, 0 never a score), RoomChooserSheet (rates grouped by room: photo, bed label, Suite tag, sleeps, m²/ft², room amenities, board, whole-stay price + delta, refundability, honest footer), SmartPackages (quality-bar line names the real scope near <area> / in <city>; WHERE IN <CITY>? chips recompose with stayArea; "staying in" only when the ring held the pool, else amber widen line; per-choice notes follow the selected card and hush once a breakfast rate is picked; picked rate drives total/refundability/estimate/booking offerId → HotelBookSheet initialOfferId, Change room kept; ✅ emoji → CheckCircle2). Countries/mapped regions answer WHERE IN <NAME>? chips before any Google call.
- Review: FIX FIRST → 7 CONFIRMED fixed (fabricated "Free WiFi"; default card blind to base-rate facts; stay-area KV key collision across same-named cities; value-pricier-than-top; notes described choice[0] regardless of selection; "0.0" score; "staying in" on a widened pool) → re-review SHIP, 0 regressions. Gates: node --check ✓ harness ALL OK (hotel_enrich + deal_ends) ✓ eslint ✓ build ✓ boot-check ✓.
- LIVE RECEIPTS (Manila, Oct 4–10, 2 adults): pass 1 pool 35 → BEST VALUE City Garden Hotel Makati 4★ 8.6 (3,772 reviews) $284 · 24 photos · 12 rooms (1 Queen 25 m², fridge/A-C) · TOP PICK Lanson Place Mall of Asia 4★ 9.8 (383) $726 · 24 photos · 2 Twins / 1 King / Grand Suite; stayAreas Intramuros · Makati · BGC · Ermita; stayArea "Makati" → ring 4 km, City Garden $270 vs Somerset Central Salcedo 9.8 $472 (0.3–0.6 mi from Makati City); "Intramuros" → pool 5, Ramada Manila Central 8.5 $281 vs Admiral Hotel MGallery 5★ 9.6 $699. Draft payload 38 KB. OTA bundle uploaded to production.
- TODO: intel stayAreas.why clips mid-sentence at 90 chars (prompt asks ≤90, model writes longer) — raise the cap or ask for ≤80; Lanson Place description says "outdoor pool" but hotelFacilities carries no pool string → no pill (correct by doctrine, worth a description-derived "mentions a pool" register later); the founder-only /package/checkout still charges hotelChoices[i].stayTotal, not a pricier picked rate — must carry the picked offerId before that lane goes real.

## 2026-09-12 — WAVE 0: honesty repair (founder-approved 1–6, reviewed line-by-line in thread)
- Worker (cd73cf7, deployed via Actions ✓ both jobs): restroom + Things To Do `isAccessible` now ONLY Google's `accessibilityOptions.wheelchairAccessibleEntrance === true` (the review-keyword OR scored "not wheelchair accessible" as accessible); `isSeniorFriendly` retired (life-stage label, text-inferred) and its GA_SIG lists deleted. Home rows: trending titled for what the data IS — "Trending near you · Most-tapped nearby this week" (a city-string filter was tried and dropped in review: the tap payload's `city` is the CARD's city — Six Flags rows say "Valencia" — so it would silently empty the row); day-part row → "Around {city}" + weather accent (rotation is not a time-of-day filter); seasonal row removed (pool leftovers under a calendar caption) with HOME_SEASONAL_ROWS / HOME_DAYPART_ROW. AI prompts (restaurant/coffee, attraction, ATM) gain ACCESSIBILITY CLAIMS (never "ADA compliant", "accessible room guaranteed", "wheelchair-friendly", "fully accessible", "assistance booked"); AI_DETAILS_PROMPT_VERSION v8→v9.
- Caveat severity model (#6): /package/draft emits `caveats[] {severity info|caution|serious, code, text, source}` built ONLY from signals already on the draft (quality_bar_missed, stay_area_dropped, stay_area_widened, no_tours); legacy fields untouched. Composer renders ONE list (info quiet mono · caution amber · serious stamp-red) in place of the three ad-hoc lines; `gate()` wraps "Book this hotel" and the Stripe test lane — a serious caveat opens a once-per-draft "Still book?" sheet (Go back / Still book). Nothing produces `serious` yet; the mobility + tour waves will.
- Frontend: ThingsToDo drops the Senior Friendly badge; AIDetailsSection no longer paints accessibility phrases green.
- Review: three open questions settled by hand after the agent review was killed with the session — (a) `processPlaceH(p)` receives raw Google places under the mask that includes accessibilityOptions ✓; (b) the city-filter contract mismatch (above) → fixed by retitling; (c) no leftover references ✓.
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.
- LIVE RECEIPTS: /home/rows Santa Clarita (17:00) → `Around Santa Clarita · Worth a look` (10) · `Near you now` (10) · `Where to next` (6); no trending (<4 taps → hidden), no seasonal. /package/draft Manila Oct 4–10 persist:false → ok, qualityBar pass 1 (4★/8.5, pool 34), hotelChoices City Garden Hotel Makati + Lanson Place, `caveats: [{info, no_tours, per Viator}]`.
- OTA bundle **1.0.2609122024** uploaded to production. Home-row bundles are cached 6h — old titles may linger on already-cached tiles until expiry.
- **Activate:** none (worker auto-deployed). Native: the OTA cadence fix still needs ONE Xcode run before bundles apply automatically on cold start.
- NEXT (launch bar, in order): checkout `offerId` fix (money) → new Home (canvas) → My Trips Ledger A → mobility profile.

## 2026-09-13 — CHECKOUT PRICES THE PICKED ROOM (the launch-bar money fix)
- Bug: /package/checkout charged `hotelChoices[0].stayTotal` — the FIRST hotel's BASE room — whatever the traveler picked; the composer sent only `{orderId}` (no choice, no room). A pricier room chosen in RoomChooserSheet would have been undercharged.
- Worker (fcd89a8, deployed ✓): composer sends `choice` + the picked rate's `offerId` as POINTERS; the worker prices that rate from the draft persisted in D1 (`rates[].price`, whole-stay total) — an unknown offerId → `rate_not_found`, never a silent fallback to the base price. Prior unpaid intent reused only when amount+currency match; otherwise cancelled first (refuse with `prior_intent_uncancelable` if Stripe won't). The pick {choice, hotelId, hotelName, offerId, roomName, board, checkin, checkout, nights, stayTotal, currency} is written onto package_orders.data.picked (the booking step reads offerId from HERE) and into intent metadata (choice/hotel/room); /package/pay shows "Stay · hotel · room · checkin → checkout" above the total.
- Gates: node --check ✓ eslint ✓ build ✓ boot-check ✓.
- LIVE RECEIPTS (Manila Oct 4–10, persist:true, sid 29959962…): A choice 1 base → amount 72527 USD (Lanson Place · Superior Twin · 725.27) ✓ · B choice 1 + Superior Room offerId → 78882 USD (788.82) ✓, and A's live 72527 intent was cancelled + re-minted (amount changed) ✓ · C bogus offerId → `rate_not_found` ✓. Test-mode intents, harmless.
- Still owned by the founder before real money: Nuitée Commission/Payout, Stripe live keys (`STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` via wrangler secret put) — the code adapts; `paid_test` never counts as revenue.
- Frontend half rides the next OTA bundle (founder-only ?stripetest=1 lane only).

## 2026-09-14 — HOME COUNTRY ROW + PHONE FLAG BADGE (founder: "no place to select home country"; the flag toggle did nothing)
- Root cause: 36b75b0 (2026-09-03 hero collapse) removed the phone flag card, so the Settings "Show Home Country Flag" toggle kept saving while nothing on iPhone read it (only HomeTablet did). Settings had no country field since 728b075 (July): the country came silently from the home-city pick.
- Home (03235dd): small flag after the first name in the phone greeting — flagcdn h80, calc(15px × --fs), baseline-aligned, drop-shadow edge (no empty box around Nepal), hidden on load error. Name + flag share a nowrap span: review measured an inline flag stranding before "in {city}" in WebKit, and inline-block still stranded it at larger text. iPad card unchanged; homeFlagUrl now derives from a stored ISO code.
- Settings (9eb79e1): Home Country row above Home City — searchable picker (auto-saves home_country, flag beside the pick, check mark by ISO code, locked while a city resolves). Home City shows the city only and still fills the country (last pick wins, visible in the row above). countries.js: alias search one-way ("Aus"/"Russia" no longer pin United States); countryCode loose-matches Google spellings (Czechia, Türkiye, Myanmar (Burma), "&"/"St" forms) plus territories PR/HK/TW/MO/PS/XK. homeContext: within 60 km of home coordinates = 'home' before any country check; countries compare by ISO code. homePlace: unmapped country timezone → null (home clock hidden, never a guessed UTC).
- Review (two workflow reviews + skeptic per finding): CONFIRMED + fixed — flag stranding on wrap, baseline sag, US-first search, Google spellings with no flag, UTC home clock for country-only profiles, 'international' mode at home when country ≠ city's country, city-resolve race. REFUTED — decorative alt="" (kept the informative alt); "keep a chosen country on city pick" (would freeze the country for nearly every existing user; needs a manual-choice column if ever wanted, plus the travel-mode fix already shipped).
- Gates: eslint ✓ build ✓ boot-check ✓. Logic harness 52/52 (search order, 33 countryCode lookups, 8 travel-mode cases). typecheck +1, the pre-existing EdRow missing-`last` class (15 rows, 4 with last).
- OTA bundle **1.0.2609140908** uploaded; production channel confirmed on it. Push carried no worker files → no deploy run. Device apply NOT yet verified: devicectl launch refused at 09:09Z (phone locked).
- DEVICE FINDING (Xcode signed in on the laptop; the one Xcode run is DONE, onLaunch installed): the ⌘R install (native 1.0.2 build 6) kept serving the Sep 12 OTA bundle p73MfkHnig via serverBasePath. Capgo resets to builtin only when version/build changes, so a same-number Xcode install never shows new web code — OTA is the path. Capgo's server device record lags (it showed this phone on Sep 8 while the phone served Sep 12). Diagnose by copying Library/Preferences/com.globeskimmers.app.plist from the app data container (never print CapacitorStorage.globeskimmers.auth).
- **Activate:** none. Founder: fully close + reopen the app (a second reopen if the first still shows the old version), Settings → Home Country → pick, Show Home Country Flag on.

## 2026-09-14 — WEBSITE: globeskimmers.io landing page on its own Worker (founder: "can we deploy the landing page?")
- Commits: 48e1c81 (site/ + wrangler-site.toml + deploy-site.yml), 1d1e3b0 (worker POST /contact + /admin/contact; Admin "Website messages" section), a3cdab8 (privacy names Nuitée in the sharing list + website messages). Runs for a3cdab8: Deploy website 34870739237 ✓ (1m7s), Deploy Cloudflare Workers 34870739364 ✓ (54s).
- Live receipts on https://globeskimmers-site.maizasimeon.workers.dev: / 200 (title Globeskimmers), /legal/privacy 200, /legal/terms 200, /delete-account/ 200, /robots.txt 200, /sitemap.xml 200, /img/og.png 200, unknown path 404 via 404.html. /app-ads.txt byte-identical to the live globeskimmers.io copy. API: OPTIONS /contact 204 with Access-Control-Allow-Origin *; POST /contact {} → {"ok":false,"reason":"missing_fields"} (validation returns before the KV rate limit and D1, so the probe stored nothing).
- FOUND after deploy: _redirects and _headers NOT applied. /privacy, /terms, /coming-soon return 404, no security headers are sent, and /_redirects and /_headers are served as plain files. Cause: cloudflare/wrangler-action@v3 installs Wrangler 3.90.0 when no version is given (run log: "npm i wrangler@3.90.0"). Wrangler 4.131.2 reads both files and uploads them as routing rules (wrangler-dist/cli.js REDIRECTS_FILENAME / HEADERS_FILENAME); local dry-run ✓. Fix on disk, NOT pushed: wranglerVersion '4.131.2' in deploy-site.yml.
- Privacy follow-up on disk, NOT pushed: the Nuitée sharing line now says Nuitée shares the booking details with the hotel (the live R2 copy says so; the repo copy had dropped it). The R2 copy the app links to is still the Aug 31 version and needs npx wrangler login to replace. The 2026-09-05 flip entry's "privacy page names Nuitée Travel Ltd as merchant of record" is correct for that R2 copy.
- Phone layout pass on disk, NOT pushed (founder, Sep 14, with a screenshot of the menu-less phone view): under 700px the four section links become a two-column menu under the logo (Contact now jumps to the form); under 560px the headline stacks each italic phrase on its own line; Android is a badge the same size as Apple's; mode and passport cards use a short hue marker instead of a 3px top border bent around 18px corners; the phone rail snaps; Send is full width under 480px. Built from the scratchpad template (build_site.py); checked at 390px in light and dark, then the menu moved to content-sized aligned columns and the Android caption got more contrast.
- DNS today: globeskimmers.io serves the Base44 "Nexus" app (proxied A/AAAA); www 301 → apex; MX 1 smtp.google.com; SPF "v=spf1 include:_spf-us.ionos.com ~all" (no Google include); no _dmarc TXT; no TXT at google._domainkey.
- **Activate:** push the Wrangler pin, then re-check /privacy → 301 and the headers. Founder (Launch Ledger N7): Workers & Pages → globeskimmers-site → Settings → Domains & Routes → add globeskimmers.io and www.globeskimmers.io; if Cloudflare reports existing records, delete only the old A/AAAA for that name (keep MX + TXT). Then workers_dev = false. The Admin "Website messages" section reaches the app with the next OTA bundle (not uploaded).

## 2026-09-20 — HOME CLUTTER CUT, slice 1 (founder: "so much clutter… simple like the iPhone"; "let's build")
- Commit 0655a8e. Off the phone Home: ExperiencesRow "Worth the drive" (removed), EscapesRow "Trips & escapes" (removed), HomeRows "Near you now / Around the city today / In the city" (off Home; re-homed on the Nearby surface in slice 2 once the audit names it), and the YOUR TRIP zone. StayAnchor + WishlistCard moved to MyTrip.jsx; StayAnchor `persistent` prop there (no snooze, no dismiss) because it is the only setter of the primary stay that Stamps near your stay and EventsRow re-center on. Kept: SmartSearchBar, finder chips + All services, TodayCard, StampsNearYou, PerfectDayCard, EventsRow, PackageHero, DreamersCorner, DreamShelf, DealRadarRow, WanderlustLine. Unmentioned by the founder and left in place pending the audit: TodayCard, PerfectDayCard, DealRadarRow, WanderlustLine, DestinationStrip.
- Gates: eslint ✓ (Home.jsx, MyTrip.jsx, StayAnchor.jsx), npm run build ✓, boot-check ✓. Component files untouched (HomeTablet still mounts them).
- Audit workflow home-simplify (wf_beff322a-5e6) running in parallel: Navan study, full Home inventory, search/finders, first-time user, three designs, judges, skeptics → founder proposal page.
- **Activate:** push (no worker files, so no deploy run) + Capgo OTA upload on the founder's word; then the founder cold-opens the app twice and checks Home and My Trip.

## 2026-09-20 — HOME CUT SHIPPED + WEBSITE FIX LIVE (founder: "push")
- Pushed a3cdab8..d86449b (0655a8e Home cut · 9412e93 site phone menu + Wrangler 4 pin · 698202e privacy line · d86449b docs). Deploy website run 35561436493 ✓; no worker files, so no worker deploy.
- Website verified on globeskimmers-site.maizasimeon.workers.dev after the pin: /privacy, /terms, /coming-soon → 301 to the new paths; five security headers present; /_redirects now 404 (no longer served as a file); the phone menu CSS is in the live page. Domain still not attached (Launch Ledger N7).
- OTA bundle **1.0.2609210433** uploaded; Capgo production channel confirmed on it at 04:36Z. Device apply not yet verified: founder cold-opens the app twice, then checks that Home has two zones (Nearby now · Dream and plan) and that My Trip shows "Where are you staying?" with no dismiss button.
- **Activate:** none.

## 2026-09-20 — HOME: "A perfect day in {city}" card removed (founder: "also remove the thing that says perfect day in 'city'")
- Commit 9a324f0, pushed. The mount, its openPerfectDay handler and the local PerfectDayCard component left Home.jsx (45 lines). The Perfect Day planner page stays reachable from the smart search's dream answer ("Plan a perfect day", DreamAnswerCard → SmartSearchOverlay).
- Gates: eslint ✓, npm run build ✓ (built bundle no longer contains the card text), boot-check ✓.
- OTA bundle **1.0.2609210442** uploaded to the production channel. Device apply not yet verified: founder cold-opens twice and checks Home has no Perfect day card.
- **Activate:** none.

## 2026-09-21 — WEBSITE LIVE ON globeskimmers.io (founder attached the domains; Claude verified)
- Founder, in the Cloudflare dashboard (zone and Worker in the same account, Maizasimeon@gmail): deleted the two Base44 A records (globeskimmers.io and www → 216.24.57.1, proxied), kept MX smtp.google.com, the SPF TXT, the auth CNAME to Supabase and the IONOS/verification leftovers; added custom domains globeskimmers.io and www.globeskimmers.io to globeskimmers-site (Domains tab → Add Domain → pick the zone → subdomain empty, then www).
- Verified on the real domain: / 200 title Globeskimmers with the new headline; /privacy, /terms, /coming-soon → 301; /legal/privacy, /legal/terms, /delete-account/, /sitemap.xml, /robots.txt 200; app-ads.txt byte-identical to what AdMob verified; five security headers. www.globeskimmers.io serves the same site (200, same title).
- Follow-up commits: 8aa865d (workers_dev = false, preview_urls = false, plus a www→apex rule in _redirects) FAILED to deploy: Workers static assets accept only relative paths in _redirects (API error 100324 "Only relative URLs are allowed", run 35678325097). 9d766af removed the rule; run 35678482387 ✓. Test addresses now 404 (globeskimmers-site.maizasimeon.workers.dev and the preview wildcard). Pages declare https://globeskimmers.io canonical; a www→apex 301 can be added later as a Cloudflare Redirect Rule in the dashboard if wanted.
- Registrar facts: IONOS SE is the registrar (expires 2027-06-21); Cloudflare runs the DNS (remy/magnolia.ns.cloudflare.com). Launch Ledger N7 and G79 ticked.
- **Activate:** none. Still open for the domain: N8 email records (SPF lists IONOS not Google; no DKIM at google._domainkey; no DMARC).

## 2026-09-21 — NUITÉE EARNS: 12% markup set, payout confirmed, privacy page republished (founder: "yes")
- Founder, in the Nuitée Connect dashboard (Production): Stays → Commission → Account-level → Default Markup 0% → **12%** (10.71% of what the guest pays). The worker sends no `margin`, so this default governs every in-app hotel rate. Nuitée's Live markup check on 92 sampled rates: market reference $374.50, our selling price $364.72, earned $39.07 on the sample; labelled "Elevated (11–18%), watch conversion". Flights → Commission left at 0; the Flights API access form was not submitted (waits on N9).
- Payout was already in place: Payments → Earnings → Settings shows a Primary bank account through Stripe Connect Express, weekly deposits; commission locks in after the guest checks out.
- Founder ran `npx wrangler login` on this Mac (G70); `wrangler whoami` → Maizasimeon@gmail.com's Account.
- D1 baseline, read-only: zero Nuitée rows in affiliate_clicks since the 2026-09-05 production switch; nuitee_sessions holds one production session from 2026-09-05 14:55Z, still pending (opened, never paid). No real hotel booking has happened yet, so the 0% period cost nothing.
- R2 `globeskimmers-media/legal/privacy.html` replaced with the repo's September 14 version (website messages, Nuitée in the sharing list, the in-app hotel booking section). Verified: /legal/privacy on the API worker returns 200 text/html, byte-identical to legal/privacy.html, "Last updated: September 14, 2026".
- **Activate:** none. Still on the founder: one real low-value refundable booking, cancel it in the Nuitée dashboard, send the booking ID (G12); Claude then checks its D1 rows.

## 2026-09-22 — HOTEL BATCH PUSHED, RESEND DNS LIVE, CITY PICKER (founder: "Push now")
- Pushed 707ac69..8d0d710 (cce2947 prettyRoom crash fix · eb7d9da cancel a refundable stay + sync-back · 5c36fb5 Return button → Trips, email claims removed · 8d0d710 Nuitée webhook receiver · 813447a docs). Deploy Cloudflare Workers run 35756657015 ✓ (deploy-api ✓, deploy-tts ✓).
- Live receipt: POST /hotels/nuitee/webhook with no token → 503 {"error":"webhook not configured"} — correct until NUITEE_WEBHOOK_TOKEN exists.
- Resend: domain globeskimmers.io **Verified** (us-east-1). Records added by hand in Cloudflare (Resend's "Go to Cloudflare" button only opens the dashboard): TXT resend._domainkey (p=MIGfMA0GCS…), CNAME send → send.forge.rmta.net, CNAME rsend → rsend.forge.rmta.net (both DNS only — Cloudflare defaulted them to Proxied; fixed), TXT _dmarc "v=DMARC1; p=none;". "Enable Receiving" left OFF (it would replace the Google MX). dig on magnolia.ns.cloudflare.com + 1.1.1.1: all four resolve; root MX still 1 smtp.google.com. RESEND_API_KEY set on globeskimmers-api by the founder (wrangler secret list ✓). Sender agreed: From bookings@globeskimmers.io, Reply-To founder@, BCC founder@.
- D1 read-only: affiliate_clicks nuitee_PDdzItYUt (Kawada Hotel · Dec 10–11 · $117.83) is still status=confirmed/converted=1; nuitee_sessions 0ed46b71… booked/CONFIRMED. The manual write was denied by the session's permission gate — not needed anyway: handleNuiteeBooking's write-through (eb7d9da, now live) flips the row when the founder opens that booking in Trips.
- FindAHotel city picker db39d7a (not pushed): one geocode match auto-selects (card ✕ undoes); several show "N matches · tap the one you mean"; none shows "No place found for …". eslint ✓ build ✓ (copy present in dist bundle) boot-check ✓.
- Research (subagent, cited in session) for the founder's hotel-lane questions saved to Claude memory hotel-filters-multiroom-research: facility ids (Beachfront 146, Private beach 114, Pool 301, Pets 4, Spa 54…), board codes RO/BI/HB/FB/AI already forwarded by the worker, NRFN cancel = CANCELLED_WITH_CHARGES at LiteAPI (we gate it), multi-room has a latent price-dedup bug if `rooms`>1 is ever sent.
- **Activate (founder, Terminal, in ~/Developer/globeskimmers):** (1) webhook token: `T=$(openssl rand -hex 32) && printf '%s' "$T" | npx wrangler secret put NUITEE_WEBHOOK_TOKEN && printf '%s' "$T" | pbcopy && echo copied` → Nuitée Connect → Developer tools → Webhooks → URL https://globeskimmers-api.maizasimeon.workers.dev/hotels/nuitee/webhook, paste the token as Authentication Token, events booking.cancel · booking.refund · booking.book.hotelConfirmationNumber; then curl the route with the token → expect 200 {"ok":true,"ignored":true}. (2) OTA: `V="1.0.$(date -u +%y%m%d%H%M)"; npm run build && npx cap sync && npx @capgo/cli bundle upload --channel production --bundle "$V"` (includes db39d7a if run after it). (3) Open the Kawada booking in Trips once → row syncs to cancelled.

## 2026-09-22 — NUITÉE WEBHOOK ACTIVATED (founder: "done with webhook")
- A NUITEE_WEBHOOK_TOKEN secret already existed on globeskimmers-api (wrangler secret list ✓; route answered 401, not 503) but its value was lost — Cloudflare cannot read a secret back and the clipboard had moved on. Founder rotated it with the same one-liner (`openssl rand -hex 32` → `wrangler secret put`), then registered the endpoint in Nuitée Connect → Developer tools → Webhooks: URL https://globeskimmers-api.maizasimeon.workers.dev/hotels/nuitee/webhook, the new token as Authentication Token (the worker strips an optional `Bearer ` prefix), retries left at 3 / 2s, events booking.cancel · booking.refund · booking.book.hotelConfirmationNumber, no custom headers. Founder-reported; the Nuitée-side registration and the token curl were not re-checked from this session.
- Live receipt after rotation: POST /hotels/nuitee/webhook with no token → 401 {"error":"unauthorized"}. Nothing to redeploy — a secret takes effect on the running worker.
- The lost-token lesson: the Activate one-liner only put the token on the clipboard. Next time a shared secret is generated, also print it (`echo "$T"`) and file it in the password manager before leaving Terminal.
- **Activate (founder):** (1) webhook — **done**. Still open from the 2026-09-22 push entry: (2) OTA upload of db39d7a (`V="1.0.$(date -u +%y%m%d%H%M)"; npm run build && npx cap sync && npx @capgo/cli bundle upload --channel production --bundle "$V"`); (3) open the Kawada booking in Trips once → row syncs to cancelled. First real webhook proof comes with the next dashboard cancellation: expect the Trips row to flip without opening it, plus a cancellation email from bookings@globeskimmers.io.

## 2026-09-22 — BOOKING EMAILS VIA RESEND (founder: "we can begin the booking emails")
- Commit (local, NOT pushed at time of writing): worker "Guest emails via Resend" — sendEmail (Bearer, Idempotency-Key, X-Entity-Ref-ID, 8 s abort, never throws), templates nuiteeEmailConfirmation / nuiteeEmailCancellation / nuiteeEmailHotelCode (inline-styled HTML + text twin), orchestrator nuiteeSendBookingEmail (sandbox never sends; strict single-address rule; per-user cap 6/day in KV; claim written BEFORE the send; every write a json_set PATCH via new nuiteeSessPatch), triggers in handleNuiteeReturn (hotel record prefetched during the book call; page waits 4 s then says "sending"), handleNuiteeCancel (cancelIntent before the PUT so the webhook leaves the notice to the handler; a cancel found already done upstream sends the notice once), handleNuiteeWebhook (dedup marked on ack only; hotel number before our row → 503 retry), prebook stores cancelTz. Status/booking responses carry emailedTo / cancellationEmailedTo; HotelBookSheet + BookingDetailSheet print "Confirmation emailed to x" only from those.
- Also fixed (pre-existing): a reload during the booking call ran a second /rates/book and could overwrite the booked row as failed — the return page now takes a one-writer claim (nuiteeSessClaimBooking; status 'booking', stale after 2 min); the loser renders "Finishing your booking" with a 3 s refresh; /hotels/nuitee/status reports 'booking' as pending.
- Reviews: design critique (3 lenses, one background agent — the Workflow tool stalled for 4 h in this session) → applied: lost-update fix, "Booking received" for non-CONFIRMED, address hardening, cap, cancelBy timezone, supplier reference at the desk, softened refund timing, absent amount ≠ zero. Adversarial diff review → 6 findings, all applied (double-GET race, intent ordering, thrown PUT, "sending" gate, emailed-vs-received, webhook-before-row).
- Gates: node --check ✓ · eslint ✓ (both sheets) · build ✓ · boot-check ✓ · `node scripts/nuitee/email-harness.mjs` **86/86** (real handlers over node:sqlite; LiteAPI + Resend mocked; covers reload, concurrent double-GET, PENDING wording, sandbox, webhook retry/duplicate/cancel-intent).
- Privacy: legal/privacy.html + site/legal/privacy.html name Resend (and the founder BCC); R2 copy republished, live at /legal/privacy ("Last updated: September 22, 2026").
- NOT verified live: no email has been sent yet (no secret-free way to test). The founder's next real booking is the live test — check the inbox AND the BCC copy's Authentication-Results header (expect dkim=pass d=globeskimmers.io, dmarc=pass), then Resend → Emails for the delivery event.
- **Activate:** push (worker deploys itself). App copy lines ride the next OTA bundle. Founder: confirm the card-statement descriptor really reads "Nuitée" on the Kawada charge (the emails say so); consider a Google Workspace alias bookings@ → founder@ so direct replies/bounces to the From address don't vanish; after the first real email, read Resend's dashboard for whether the BCC counts against the 100/day quota.

## 2026-09-22 (evening) — PUSHED 8d0d710..9d00010: booking emails, city picker, privacy (founder: "Push")
- Pushed from the original session after a state check: HEAD had moved to 9d00010 (a second session's local commits db39d7a city picker · 37c800c docs · 3f7386c privacy names Resend · 0ec9d9e plans · c353df5 booking emails via Resend · 9d00010 docs). Deploy Cloudflare Workers run 35806514976 ✓, Deploy website run 35806514981 ✓.
- Live receipts: POST /hotels/nuitee/cancel → 401 {"needsAuth":true}; POST /hotels/nuitee/webhook (no token) → 401 {"error":"unauthorized"}; /legal/privacy "Last updated: September 22, 2026" and names Resend. Secrets present: NUITEE_WEBHOOK_TOKEN, RESEND_API_KEY.
- Capgo production channel still serves 1.0.2609210442 (Sep 21). The OTA upload from this session was denied by the permission gate (production deploy) — founder runs it.
- D1: nuitee_PDdzItYUt still status=confirmed/converted=1 (dashboard cancel predates the webhook registration); the write-through flips it on the first open of that booking in Trips once the OTA lands.
- **Activate (founder, Terminal, in ~/Developer/globeskimmers):** `V="1.0.$(date -u +%y%m%d%H%M)"; npm run build && npx cap sync && npx @capgo/cli bundle upload --channel production --bundle "$V"` → cold-open the app twice → Trips › BOOKED → open Kawada Hotel: sheet opens (no white screen), reads Cancelled, row sinks to Past. The first real email arrives with the next real booking.

## 2026-09-26 — SECOND REAL BOOKING, FOUR FIXES FROM THE FOUNDER'S SCREENSHOTS (Return landing, cancelled cards, hotel/room photos, email link)
- Founder's second real booking: Homewood Suites by Hilton Atlanta / Perimeter Center, Sep 27–28, "1 King Bed Studio Suite Nonsmoking · Breakfast Included", non-refundable, $139.72 (prebook showed the −1.0% move honestly), bookingId vgC_Tg7eH, supplier ref 14806559, hotel confirmation number not in yet. The first real confirmation email arrived via Resend — founder: "Beautiful email sent as confirmation wow!" and, on the room picker, "so pleased with room selection … king, queen … access type of rooms".
- The phone still runs a pre-5c36fb5 bundle: its My Trip card prints the unconditional "Confirmation emailed" line that 5c36fb5 removed (present in ios/App/App/public/assets/index-BEUvn3NE.js, absent at HEAD). Capgo production was last uploaded Sep 21, so eb7d9da's write-through never ran on the phone and Kawada still reads CONFIRMED. The OTA remains the founder's step.
- Fixes (local, uncommitted — see Activate):
  1. **"Return to GlobeSkimmers" lands where Done lands** (the sheet's "You're booked"), not the Trips tab. src/lib/openPartner.js keeps the native sheet's resolver (isCheckoutSheetOpen / closeCheckoutSheet); AuthContext's appUrlOpen handler settles it and skips navigation when the checkout sheet is up. Needed because @capacitor/browser's close() dismisses the view controller without emitting browserFinished (BrowserPlugin.swift, close()) — the old code survived only by navigating away. The email path (no sheet) still lands on Trips.
  2. **Cancelled stays show as cancelled in My Trip**: cancelled rows are listed (chip CANCELLED in red, card muted, grey accent bar, sorted after live rows in their section) — the rule Trips' BOOKED tab already had. Note copy: "a cancelled stay stays listed, marked Cancelled".
  3. **Hotel and room photos**: worker POST /hotels/nuitee/photos (the KV-cached /data/hotel record → packageHotelPhotos ×40 + packageRoom photos ×6, rooms without a picture dropped); src/lib/hotelPhotos.js (one fetch per hotel per session, failures not cached); results card split into two real buttons — the photo (with a small gallery badge) opens the shared PhotoLightbox (swipe left/right, chevrons, X, swipe-down) seeded with the card's own photo until the gallery answers, the rest opens the room picker; HotelBookSheet header gains "N hotel photos ›", each room card a 64px RoomThumb (now exported from RoomChooserSheet) + "N photos ›", matched by the rate's mappedRoomId (now carried through rates[]) else exact normalised room name — no match, no picture, never a stock image. Lightbox rendered inside the sheet's inner div so portal clicks never reach the backdrop's onClose.
  4. **Email "Open in My Trips" works from mail apps**: the button (and both text twins) now point at https://globeskimmers.io/open/trips?booking=… — new static site/open/trips.html (strict [A-Za-z0-9_-]{1,80} id check, button carrying globeskimmers://trips?booking=, Smart App Banner app-argument, one automatic attempt on iPhone/Android only, App Store / Play links). Outlook ignored the custom-scheme href. Verified headless: href and banner argument scoped to vgC_Tg7eH.
- Gates: node --check ✓ · eslint ✓ (FindAHotel, HotelBookSheet, MyTrip, RoomChooserSheet) · build ✓ · boot-check ✓ · `node scripts/nuitee/email-harness.mjs` **87/87** (the deep-link assertion now checks the landing link and that no raw scheme is embedded).
- NOT verified: the photos route against live LiteAPI (curl it after the push: `curl -s -X POST -H 'content-type: application/json' -d '{"hotelId":"<a hotelId from any Find a hotel result>"}' https://globeskimmers-api.maizasimeon.workers.dev/hotels/nuitee/photos | head -c 400`), the lightbox and room thumbs on device, the landing page from Outlook/Gmail.
- **Activate (founder):** (1) say "commit" / "push" — the worker (photos route, email link) and the site (landing page) deploy themselves on push. (2) OTA after the push (Return landing, cancelled cards, photos are app copy): `V="1.0.$(date -u +%y%m%d%H%M)"; npm run build && npx cap sync && npx @capgo/cli bundle upload --channel production --bundle "$V"`. (3) Kawada row: open it once in Trips after the OTA (write-through), or flip it directly: `npx wrangler d1 execute globeskimmers-events --remote --command "update affiliate_clicks set status='cancelled', converted=0 where partner='nuitee' and product_id='PDdzItYUt'"`.

## 2026-09-27 — PUSHED 9d00010..fe01a69: Return landing, cancelled cards, hotel/room photos, email landing link (founder: "push")
- Five commits from the 2026-09-26 batch (f884665 Return lands on the sheet · 6fccbc4 cancelled rows in My Trip · da7f915 hotel + room photos · 4cf7e1b email → globeskimmers.io/open/trips · fe01a69 docs) plus the three docs commits that were still local (f0a2aff, 997799c, 02a02c6). Deploy Cloudflare Workers run 36332075007 ✓, Deploy website run 36332074942 ✓.
- Live receipts: POST /hotels/nuitee/photos with a bogus id → {"ok":false,"reason":"not_found"} (route exists); with lp226cc (La Quinta by Wyndham Atlanta Perimeter Medical, from a live search near Perimeter Center) → ok, 40 hotel photos, 5 rooms with photos (Deluxe King Room 5 · One-Bedroom King Suite 4 · Double Room … Mobility/Hearing Accessible 4). https://globeskimmers.io/open/trips?booking=vgC_Tg7eH → 200 text/html with the open button. Note: /hotels/nuitee/search answered a curl WITHOUT a sign-in token — the CUG-rates gate is the app's sign-in wall, not the worker; worth a worker-side check later (pre-existing, unchanged by this push).
- Still on the founder's phone until the OTA: Return landing, cancelled cards, the gallery and room thumbs, the "Confirmation emailed" line fix from 5c36fb5. The email link change is live for every email from now on.
- **Activate (founder, Terminal, in ~/Developer/globeskimmers):** (1) OTA: `V="1.0.$(date -u +%y%m%d%H%M)"; npm run build && npx cap sync && npx @capgo/cli bundle upload --channel production --bundle "$V"` → cold-open twice → Find a hotel → tap a result's photo (gallery) → See rooms (room thumbs) → Trips › Kawada reads Cancelled after one open. (2) Or flip Kawada directly: `npx wrangler d1 execute globeskimmers-events --remote --command "update affiliate_clicks set status='cancelled', converted=0 where partner='nuitee' and product_id='PDdzItYUt'"`.
- **2026-09-27, later (founder: "done with 1, 2, 3"):** OTA upload founder-reported (the Capgo channel listing could not be read from this session — needs the founder's login). D1 read at the same time: affiliate_clicks nuitee_PDdzItYUt is **still status=confirmed / converted=1** and vgC_Tg7eH confirmed/converted=1 — the Kawada one-liner did not take effect (not logged in, a typo, or a declined prompt); rerun it and read the output, or open Kawada once in Trips after the OTA (eb7d9da's write-through). Founder moves to G21 (Stripe Tax + accountant) next.

## 2026-09-27 — PASSPORT BATCH FROM THE GEORGIA AQUARIUM VISIT (founder screenshots: share did nothing; auto-sense stampable places; stamp options; photos)
- Founder stamped the Georgia Aquarium on 2026-09-26 (the app's own "I was here"). Asks: (1) the booklet's Share button "nothing is happening" — it must post the page to Instagram / Facebook / Snapchat / X, branded with Globeskimmers and "Virtual Passport"; (2) opening the Passport should sense the nearest stampable place (attraction footprint or the airport you are inside) and offer it — several → a list to pick from or close; (3) tapping a stamp → choices: add memory photos (now or later), move to a solo page / back to a shared page, delete the stamp, exit; delete a memory photo; keep the full-screen photo with scroll and ×.
- **Share (root cause + fix).** The old flow rendered with html2canvas then called navigator.share — WebKit only allows share() inside a user gesture, so after the async render it rejected and the catch swallowed it: a silent no-op. Now two taps: Share renders a BRANDED image (navy header "GLOBESKIMMERS" in gold + "My Virtual Passport", the page, a footer "globeskimmers.io · collect stamps where you go") into a preview; the preview's own button opens the share sheet inside the tap. Paths: native build with @capacitor/share + @capacitor/filesystem (added to package.json; needs a NEW NATIVE BUILD, an OTA cannot add plugins) → Filesystem.writeFile(Cache) + Share.share({files}); else the Web Share API (works in today's native build when the file share is allowed); web → download. Every failure now toasts its reason.
- **NearbyStampPrompt** (src/components/passport/NearbyStampPrompt.jsx): on Passport open (owner, signed in, after the stamps load) one GPS fix → attractions/nearby (radiusKm 2, stampsOnly, includeSecrets) kept only inside each row's footprint_radius_m (else stampRadiusFor, else 250 m) + airportAt geofence; skips places already in the passport and session dismissals; one candidate → card with "Stamp it ✓ / Not now", several → list (max 5) with per-row Stamp + Close. Same addStamp payloads as ActivityDetail (variant resolution, cc) and AirportArrivalPrompt; after a stamp the options sheet opens so photos can be added at once.
- **StampActions** (src/components/passport/StampActions.jsx): tap a stamp → sheet: photo strip (tap = full-screen, × = delete), Add memory photos (multiple, cap 4), View photos, Give this stamp its own page / Share a page with other stamps, Details, date & tag a friend (the old card), Delete (inline confirm), Close. Friend view / admin sample: view only.
- **Solo pages**: migration supabase/migrations/20260927200000_passport_stamp_layout.sql adds `layout text default 'auto'` (check auto|solo); worker POST /passport/stamp/layout (user-scoped PATCH; answers ok:false "isn't available yet" until the column exists); src/lib/passport.js setStampLayout; PassportBook's first-fit packer gives a 'solo' stamp its own page and never back-fills it.
- **Photo viewer**: Passport now uses the shared PhotoLightbox (swipe left/right, chevrons, ×, swipe-down) for memory photos, title "I was here! <name>", credit = the visit date. resizePhoto moved to src/lib/resizePhoto.js (shared).
- Gates: node --check ✓ · eslint ✓ (Passport, PassportBook, StampActions, NearbyStampPrompt) · build ✓ (new strings present in dist) · boot-check ✓.
- NOT verified on device: the share sheet (needs the phone), the nearby prompt at a real footprint, the solo-page repack after the migration. Observation: the passport cover URL /stamp-art/passport-cover-default-v2.jpg answers 404 from curl (the phone shows a cover — possibly cached); check handleStampArtServe / the R2 key.
- **Activate (founder):** (1) say "push" — worker deploys; the Supabase migration applies itself through deploy-migrations.yml (no approval step — CLAUDE.md's "gated on the production environment" is not in the workflow file); watch that run, solo pages read "isn't available yet" until it succeeds. (2) OTA for the app copy: `npm run ota` (new script — build, sync both platforms, Capgo upload; one bundle serves iOS and Android) — this ships the prompt, the options sheet, solo pages, the branded preview and the Web-Share path. (3) NATIVE build for the guaranteed share sheet: `npm run cap:all` → Xcode archive → TestFlight/App Store AND Android Studio → Play (the two new plugins ride only in native builds; founder rule 2026-09-27: both platforms always). (4) On the phone: open Passport at the Aquarium or any stampable spot → prompt; tap the Georgia Aquarium stamp → options; Share → preview → share sheet.
- **Scripts (founder, 2026-09-27: "when I do npm, I want iOS and Android both always updated"):** cap:ios / cap:android now run `npx cap sync` for BOTH platforms before opening one IDE; new `cap:all` opens both; new `ota` = build + sync + Capgo upload with the timestamp version. CLAUDE.md's Commands block updated.

## 2026-09-27 (evening) — PUSHED 7fcc1f3..b275efb: Passport batch + both-platform scripts (founder: "push")
- Five commits: 3257015 solo pages (migration + /passport/stamp/layout + packer) · f3a28a6 branded Share with preview + native plugins · 3de5173 stamp options, nearby-stamp prompt, swipeable photos · 79aeec5 scripts sync both platforms, cap:all, ota · b275efb docs. Deploy Cloudflare Workers run 36347867700 ✓; **Apply Supabase Migrations run 36347867684 ✓** — log: "Applying migration 20260927200000_passport_stamp_layout.sql… Finished" (no approval step; the destructive-SQL check passed). Live: POST /passport/stamp/layout without a token → 401 {"error":"Sign in"}.
- Solo pages are therefore available as soon as the OTA lands. The nearby prompt, stamp options and the branded share preview are app code → OTA. The plugin share path → store builds for BOTH platforms.
- **Activate (founder, Terminal):** (1) `npm run ota` → cold-open twice. (2) `npm run cap:all` → Xcode archive → TestFlight/App Store; Android Studio → Play (carries @capacitor/share + @capacitor/filesystem). (3) On the phone: Passport → tap the Georgia Aquarium stamp → options (add photos, own page, delete); Share → preview → sheet; open the Passport while standing at a stampable spot → prompt.
- **2026-09-27, later — 5ced84a** (founder asks): "Sense nearby stamps" switch in Settings → Virtual Passport and a small on/off pill under the Passport's Stamp-a-place button (one key pp_suggest_nearby, default on; off = no GPS fix, no pop-up); the Passport page opens scrolled to the full-size book (top just under the app header), still scrollable up to the stats/share. eslint ✓ build ✓ boot-check ✓. App code only → rides `npm run ota` (no CI deploy on this push). Founder question answered: `npm run ota` is the must; `npm run cap:all` (store builds) only if Share doesn't open the sheet after the OTA.
- **2026-09-27 16:42 — `npm run ota` opened "Capgo Cloud Build · Onboarding, Step 1 of 8 · Connect to Appflow"** (founder screenshot). That is the CLI's cloud native-build product (an Ionic Appflow migration wizard), not the OTA upload; the founder does not use Appflow. Fix: the ota script now runs the upload with `CI=true` (the CLI's non-interactive switch — `process.env.CI === "true"` in its dist) and pins `@capgo/cli@8.68.1`. Founder: Ctrl+C out of the wizard, later run `npm run ota` again and confirm the new bundle under console.capgo.app → Bundles. Capgo Cloud Build for both platforms is a separate (paid) decision, not needed for the OTA.
- **2026-09-27 19:40–20:05 — Share still "nothing at all" after the OTA.** Capgo's API (GET /device, curl with a browser UA — Python's urllib is blocked by Cloudflare 1010) shows the founder's iPhone (iOS 26.6.1) on **1.0.2609272336 at 23:47Z** and a second iPhone (iOS 18.6.2) on the same bundle — the OTA works (channel production → 1.0.2609272336, native 1.0.2 build 6, plugin 8.51.3). So the Share tap itself fails before any UI: most likely the page element ref or html2canvas never settling. `npx @capgo/cli app debug` is unusable non-interactively (its Yes/No prompt ignores CI=true and a pty-fed Enter). Fix committed: the preview overlay opens on the tap with "Preparing your page…", shows the exact error text on failure, finds the page by a DOM marker when the ref misses, and races the render against a 25 s timeout. Next: founder `npm run ota` → tap Share → report the overlay's words.

## 2026-09-28 — FIRST INSTAGRAM STORY FROM THE PASSPORT; INK + SIZES ROUND (founder screenshot of the story)
- **Share works on the phone** via the Web Share path (no store build yet): the founder posted the Georgia Aquarium page to an Instagram story ("a page from Virtual Passport! 1st stamp yay!!!!"). Feedback: had to shrink the image by hand to see the header and footer; a feed post crops it; frame text (VISITED, ATLANTA · UNITED STATES, date) and "I was here!" too faded and small; footer should mention memories; add an × to exit open pages; loves the memory-photo thumbnail.
- Mockups published (private artifact): https://claude.ai/artifact/Hivj8DCxdPgkLV611bt17Y — the real TypographicStamp server-rendered at strengths 0–3 (Today, A, B recommended, C) in Story 9:16 with Instagram's covered bands shown, the 4:5 post, the booklet page with the ×, and other layouts at B.
- Commits b5f54a3 (ink: `strength` prop, frame text capped to the stamp width, lighter wear, solid red strike from 1; STAMP_INK_STRENGTH = 2 in stampDesign.js pending the founder's A/B/C; Ledger date box stacked; Ring/Oval strike moved clear) · 4bba19f (share at Instagram sizes: Story 1080×1920 inside the safe area, Post 1080×1350 with a one-line header, toggle in the preview; footer "collect stamps & memories where you go"; × on the open book) · native plugin registration from the founder's cap sync. eslint ✓ build ✓ boot-check ✓. App code → `npm run ota`.
- **Activate (founder):** reply A / B / C (B is already set); `npm run ota`; on the phone: open a page (× top right closes it), Share → pick Story or Post → post.
- **2026-09-28 09:40 — founder picked ink B** ("I like B") and asked for the place name, "I was here!" and the date 2–3 sizes larger. STAMP_INK_STRENGTH stays 2; the stamp on the page grows 0.50 → 0.64 of the page width (ART_FRAC, 1.28× — all three grow together; the name is width-fitted so only the stamp can grow). Page-fit estimate for city/place stamps corrected to the stamp's real height (the old 110px guess let pages overflow). Consequence on a phone: one stamp per page. The shared image follows (it is drawn from the page). eslint ✓ build ✓ boot-check ✓ → `npm run ota`.
- **2026-09-28 09:48 — founder: "Updated B" for stories** (the mockup's third frame) and asked about posts. ART_FRAC 0.64 → 0.76 (on a phone: name ≈ 39 px, "I was here!" ≈ 20 px, date ≈ 15 px). Posts follow automatically: Story and Post are both drawn from the same rendered page, which lands ≈ 689 px wide in a Story and ≈ 683 px in a Post. Note: the first mockup drew B at 62% of the page while the app drew 50% — corrected in version 2 of the mockup page, which shows Current / B / Updated with on-phone sizes. eslint ✓ build ✓ boot-check ✓ → `npm run ota`.
- **2026-09-28 — carousel posts** (founder: "make it multiple posts: first is the sign, then each memory photo enlarged in post size; give the choice to post just the sign with the thumbnails"). In the share preview, Post · 4:5 shows "Add my memory photos as slides 2–N" (on by default when the page has photos; off = just the stamp page with its thumbnails). Each photo → 1080×1350 JPEG, cover-cropped, dark band at the bottom with a solid red "I was here!", the place, city · country · date and the brand line; up to 9 photo slides (Instagram's 10-image cap). Slides are drawn while the preview shows, so share() still runs inside the tap; the Share button reads "Share post · N images". Native plugin path writes every file; Web Share passes all files, and if a phone refuses several it shares the stamp page and says so. Story stays one image. eslint ✓ build ✓ boot-check ✓ → `npm run ota`. Not verified on device: Instagram receiving several images from the share sheet as one carousel.
- **2026-09-28 10:24 — post content choice** (founder, on the movie mockup: "before posting, let the user choose between the slide 1 design or slide 2"). The Post preview's photo checkbox is now a three-way choice: **Stamp page** (the page with its photo thumbnails), **My photos** (each memory photo full size with the I was here! band), **Both** (the carousel, page first; the default when the page has photos). The big preview shows the first image of the choice; the thumbnail strip and "Share post · N images" follow it; "My photos" falls back to the page if no photo slide could be drawn. eslint ✓ build ✓ boot-check ✓ (the first boot-check run hung in headless Chrome and was restarted). → `npm run ota`.

## 2026-09-28 — SHARE ANALYTICS + A LOGGER BUG FROM LAUNCH (founder: counts per month, stamped vs shared, per platform, story/post/message)
- **Bug found and fixed (b1st of two commits):** events.session_id is NOT NULL with no default; the worker's gbLogEvent inserted without it, so EVERY server-side event — passport_stamp and the guestbook family, 11 call sites — failed silently since launch (D1: zero passport_stamp rows all-time, 4,089 client events). Why the admin passport sections read empty. Now session_id='server', page by family. Historical stamps are NOT backfilled into D1; the new admin endpoint reads Supabase instead.
- **Share analytics:** the preview logs passport_share_open / passport_share / passport_share_cancel {format, mix, images, platform, activity, via}. platform = iOS activityType from @capacitor/share (store build) mapped by pattern (instagram, facebook, messenger, whatsapp, tiktok, snapchat, x, messages, mail, saved…), else 'unknown' (Android + browser shares can't say). ANALYTICS_QUERIES passport_shares_by_month_12m (month × platform × use; messaging apps = message) and passport_share_funnel_12m (previews / shared / cancelled) — both ran clean against live D1 (0 rows yet). POST /admin/passport-monthly = stamps per month from passport_stamps (source of truth, paged ×1000, cap 50k — needs an RPC at scale). Admin Analytics → "🛂 Passport — stamped vs shared, per month".
- Deploy run 36437874007 ✓; live POST /admin/passport-monthly without a token → 401. eslint ✓ build ✓ boot-check ✓ (boot-check can't render the admin page — it's behind sign-in; reviewed by hand, one undefined `out` caught and fixed before commit).
- Next: platform presets (Instagram / Facebook / TikTok / Snapchat / X story & post, message) with exact sizes and safe zones — research running; the preview's "where" picker then sets `platform` for Android/web shares too.
- **Activate (founder):** `npm run ota` (share logging is app code). Admin → Analytics → the new table fills as people share. Platform names on iPhone need the store build (`npm run cap:all`).
- **2026-09-28 — why the Georgia Aquarium stamp has no ✓** (founder: "we were really there"). It was made with "Stamp a place" (the caption VISITED ATLANTA, UNITED STATES only renders for its kind:'city' stamps), and that form always saved verified:'self' with no GPS check. The memory photo upgraded it to 'photo' (worker handlePassportPhotoUpload), but the app shows the green ✓ and counts "Verified" for 'gps' only (VerifiedBadge: "a photo is a memory, not verification") — this contradicts docs/PASSPORT_MEANING_MODEL.md §3, where photo-proof also earns a ✓; **founder decision pending**. Fixes: Stamp a place takes one GPS fix when the visit is dated today and a venue is picked, against the VENUE's own coordinates (the form used to keep the city centre's when the city was picked first), within stampRadiusFor → 'gps'; stamp options gain "Verify I'm here" for any non-GPS stamp with coordinates (radius per place, airports 3 km; re-stamp upgrades in place; the worker's country/travel-speed checks still apply). The existing Aquarium stamp can only get the GPS ✓ by verifying on a future visit. eslint ✓ build ✓ boot-check ✓ → `npm run ota`.
- **2026-09-28 — movie scene stamps: founder "go with the defaults".** Seed build started (background agent → scripts/film-spots/: candidates.csv, seed_400.csv, review_40.csv, README) from Wikidata P915 films + TV series, fame = sitelinks × spot pageviews, deduped against the owned attractions (dupes → film line on the existing stamp), ~100 curated non-Western spots with sources. No database writes.
- **2026-09-28 — three proofs for the green ✓** (founder: "use the 3 ways … the check mark on the stamp, not on the photos"). verified ranks self < photo < photo_ai < photo_loc < gps; only gps / photo_loc / photo_ai earn the ✓ (booklet badge moved to the stamp's top-left so it never covers "I was here!"; detail chips "✓ Verified visit" / "✓ Verified · photo location" / "✓ Verified · photo"; the Verified count includes all three). (1) GPS: Stamp a place on the day, "Verify I'm here", the nearby prompt, I was here. (2) Photo location: src/lib/photoExif.js reads GPS + DateTimeOriginal from the ORIGINAL file before resizing (fixture test: LE + BE + no-EXIF + garbage all pass); the upload sends only {lat,lng,taken_at}; the worker accepts within 400 m (airports 3 km) and ±2 days of the visit; not stored. (3) Place recognition: worker ppRecognizePlace → Claude Opus 5 (PP_VISION_MODEL, one constant; Haiku 4.5 is the cheaper option, ~0.2¢ vs ~1.3¢ per photo), structured JSON {match, confidence, reason}, effort low, server-side fallbacks "default"; yes + ≥0.8 → photo_ai; 20 checks per traveler per day; skipped when a stronger proof exists. POST /passport/stamp/check-photos runs recognition on a stamp's EXISTING photos (they were stored without location tags) — "Check my photos for proof" in stamp options. Events: passport_photo {has_gps, has_time, proof, ai_match}, passport_photo_exif {has_gps, has_time} — tells us whether iOS keeps photo locations through the picker. Also: platformFromActivity now maps Android package names (Messenger = com.facebook.orca, Google Messages, Gmail, Photos) — the research showed @capacitor/share on Android does return the chosen app. eslint ✓ build ✓ boot-check ✓ node --check ✓. NOT verified live: the recognition call (needs the founder's session) — try "Check my photos for proof" on the Georgia Aquarium stamp after the OTA.
- **2026-09-28 — share destinations with per-platform safe areas** (founder: TikTok, X, Instagram, Facebook story + post, Snapchat, messages; all components inside each platform's frame). Research (subagent, cited): Meta story 14%/35% (ads) with ~300 px organic reply bar; TikTok safe-zone overlay top 240 / bottom 484–660 / right rail 140–300 px; Snap top 150 / bottom 330; Instagram feed 4:5 and 3:4 since 2025 (carousel = one shape for all items, up to 20); X shows 3:4 uncropped, 4 images; TikTok photo mode up to 35; no platform publishes a minimum font size → floor 40 px at 1080 wide (Apple 11 pt ≈ 30 px). Presets (src/lib/shareCanvas.js, moved out of PassportBook): story_meta 1080×1920 (keep 280 top / 300 bottom), story_tiktok (240 / 500 / right 170, page shifted left of the rail), story_snap (170 / 340), post_3x4 1080×1440 (Instagram, X), post_4x5 1080×1350 (Facebook, messages). Preview: pick the destination (Instagram · Facebook · TikTok · Snapchat · X · WhatsApp · Messages) then Story / Post / Message (WhatsApp "Status", TikTok "Photo post"); photo slides rebuild at the destination's size; carousel caps per destination; button "Share to Instagram Story" etc.; analytics now record use + preset + chosen destination (platform = what the phone reports, else the chosen destination). Rendered all five presets + a photo slide with the keep-clear bands overlaid in headless Chrome — nothing inside a band. eslint ✓ build ✓ boot-check ✓ → `npm run ota`. Not done: direct-to-app sharing (Instagram/Facebook Stories URL schemes, Snap Creative Kit, TikTok Share Kit) — each needs a developer app registration and a native build; the share sheet covers every app today.
- **2026-09-28 — movie scene stamps, slices 1–3 (app + data plumbing; the seed list is still being built).** D1: cloudflare-worker/sql/13_film_scenes.sql (film_scenes: attraction_id → work title/type/year, two leads with roles, scene sentence, also_in, sources) — founder applies it with the data load. Worker: /attractions/nearby and /attractions/get return `film` for spots that have a row (separate query, so a missing table only means no film); stamping stores a sanitized meta.film on the stamp (only when present — ordinary stamps never touch meta), a re-stamp adds a film to an older stamp of the same place. Supabase migration 20260928160000_passport_stamp_meta.sql adds passport_stamps.meta jsonb. App: TypographicStamp "Scene" layout (film strips, ★ FILMED HERE ★, place solid, TITLE · YEAR — long titles wrap with the year on line two — city · country, date, solid red "I was here!" centred above FILMED HERE); rendered 4 real cases (Rocky Steps, Hobbiton Movie Set, Katz's Delicatessen, Glenfinnan Viaduct) — no collisions. Booklet, stamp card ("The scene from Rocky (1976)", scene, cast), nearby prompt ("Filmed here: …" + scene; the film rides into the stamp), home Stamps near you, attraction page "★ Filmed here" card. Next: slice 4 (photo-first page, stamp above/below, film line on share slides), then the seed review and the data load.
- **2026-09-28 — movie scene stamps, slice 4: the photo-first page.** A stamp that carries a film and at least one memory photo prints on a page of its own (packer: solo) as the mockup showed: one photo open (grows to fill the page, floor 0.72 × page width), the next photo as a thumbnail on the far corner — tap to swap, "2" or "2/3" badge — the Scene stamp at half the page width touching only the photo's edge, then "The scene from *Title* (Year)", the scene sentence (clipped at 120 chars) and "Actor as Role · Actor as Role". Placement: **Auto** (src/lib/photoEdge.js: the photo drawn at 64 px, cropped like the page, top vs bottom quarter by edge energy; top only when the top is clearly calmer — open sky — else below; any failure = below) or pinned **Above photo / Below photo** from the stamp options ("Where the stamp sits", replaces the page-sharing row for these stamps). Stored as meta.stamp_pos through the existing POST /passport/stamp/layout (new field stamp_pos top|bottom|auto; read-merge-write of meta so the film is kept). Share photo slides gain a gold "The scene from Title (Year)" line under the place.
- **Share-capture fixes found while testing (html2canvas 1.4.1, measured in headless Chrome):** (1) it ignores object-fit, so memory photos on shared pages were stretched — page photos and the 2×2 thumbnails are now cover-sized backgrounds; (2) it paints the page's inset spine shadow as a dark fill over the WHOLE page — the capture now drops inset shadows from its copy (the screen keeps them); (3) a radial-gradient anywhere on the page made it draw the page blank, and box-shadows inside the rotated stamp landed in the wrong place — the stamp's halo is two flat ivory discs, the ✓ has a white ring instead of a shadow. Verified: captures of scene pages with the stamp above and below, and an ordinary page with thumbnails, all correct and uncropped.
- Test harness: four scene pages (auto top, auto below, pinned top, swapped photo) + an ordinary page, rendered through the real PassportBook with reduced motion; calmEdge answered top / bottom / bottom for sky-over-crowd, skyline-over-water, all-busy test photos. eslint ✓ build ✓ boot-check ✓ node --check ✓.
- **Activate (founder):** the worker change (stamp_pos on /passport/stamp/layout) deploys by CI with this push; then `npm run ota` for the app. The share-capture fixes show at once on any page with photos; the scene page shows once film data is loaded — next: the seed review (~40 spots) and the D1 load (13_film_scenes.sql + the data file).
- **2026-09-28 — movie scene stamps: the seed is in (27064e0) and the load generator is ready (8043e37).** scripts/film-spots/: 400 spots from Wikidata P915 (films + TV, season/episode items) and a hand-checked list that is mostly non-Western, with cast, pageviews, Wikipedia evidence, and dedupe against the owned attractions. 250 are new spots and 150 are film lines on stamps we already have. Read-only D1 export; nothing loaded. s9_load_sql.py writes data/load_film_scenes.sql: new spots as 'film:<qid>' rows (existing browse category, footprint, scope regional); 51 spots we already hold but don't stamp are reused, never duplicated, and promoted with founder_scope 'regional' only when not already stampable (the app's rule is coalesce(founder_scope, scope) in world/national/regional, not is_marquee); one film_scenes row per spot. It also applies scenes_roles.csv (scene and cast fixes plus drop verdicts, being written by a background agent: 301 rows lack a scene, and some leads are wrong even when unflagged, e.g. Lawrence of Arabia without Peter O'Toole) and review_decisions.csv (keep / drop / merge). Tested against an in-memory SQLite copy of the schema.
- **Founder review page:** https://claude.ai/artifact/3imzpvM5UHGArxyLvni2id (private). The 40 unsure rows, each with Claude's pick: 30 keep, 3 merge onto an existing stamp (Supertree Grove → Gardens by the Bay, the Intrepid museum → USS Intrepid, Washington Square Park → Washington Square Arch), 7 drop (Waverly Place and Cheyenne Mountain are story settings, not filming spots; UPenn's evidence never names the film; Westin Grand Berlin, Water Wizz, Normandale Community College are weak stamps; Suga Shrine stairs is animated, so "Filmed here" would be untrue). Picks save to the page's db collection `decisions`; Claude reads them with ArtifactData. Verified: the store answers and is empty before any tap; the tap-to-save path runs only in the viewer's browser.
- **Activate (founder), after the review and the scene pass:** say "review done"; Claude rebuilds the load file; then, in order:
  `npx wrangler d1 execute globeskimmers-attractions --remote --file=cloudflare-worker/sql/13_film_scenes.sql`
  `npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/film-spots/data/load_film_scenes.sql`
  then `npm run ota` if not already done. No worker deploy is needed; the worker already reads film_scenes.
- **Stamp art inventory (founder asked):** 452 illustrated stamp PNGs are on R2, counted by probing about 2,500 names from the icon list, the atlas and the curated rows. None exist for Atlanta: its 10 stampable places, the Georgia Aquarium included, show the lettered typographic stamp.
- **2026-09-29 — movie scene stamps: DATA READY.** The scene/cast pass finished (scenes_roles.csv committed); all 80 flagged rows decided; the founder's 40-row review returned unchanged. Final load: **155 new spots + 45 promoted owned rows + 348 film lines**, 251 with a checked scene sentence, 347 with the two leads per the work's Wikipedia billing. 52 seed rows dropped (story settings, demolished/closed, private, secure, large areas), 5 merged onto existing stamps. Also today: scene context printed under photo-less scene stamps and on shared photo slides (49b9626); the founder is choosing a lying-S film-strip design (mockup GmLw964zQEwtUU1NqjXvkv) — the strip swap is a follow-up edit to TypographicStamp's scn frame only.
- **Activate (founder, Terminal, in this order):**
  `npx wrangler d1 execute globeskimmers-attractions --remote --file=cloudflare-worker/sql/13_film_scenes.sql`
  `npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/film-spots/data/load_film_scenes.sql`
  then `npm run ota` (ships the scene-context print + slice 4 if not already). Verify: open ActivityDetail on Rocky Steps → "★ Filmed here"; Passport near a film spot → the prompt shows "Filmed here: …".
- **2026-09-29 — THE PIVOT (founder: "we're going to pivot… effective immediately").** The app is now the Virtual Passport + nearby finders. Commit 99a2dd8 removes: pages GetARide, Transportation, FindAHotel, MyTrip, Trips, Insight, TravelEssentials, SmartPackages; home surfaces TodayCard, EventsRow, WhereToStay, MyTripCard, StayAnchor, EscapesRow, VibeBundles, PackageHero (plus tablet tiles); components/hotels + components/trips + hotelPhotos; the trips deep link, hotel/ride search intents, the transit quick action, ThingsToDo's transit hand-off, PerfectDay's tonight event, the nav Trips tab. KEPT: all finders the founder listed, PerfectDay, Wishlist, SavedLocations, Dream rows, DealRadarRow, admin pages. Server side untouched on purpose: worker routes, Supabase bookings, webhooks all stay (existing bookings remain servable; the email "Open in My Trips" link now dead-ends at the site landing — flagged to the founder). Gates: eslint ✓ build ✓ boot-check ✓. **Activate: `npm run ota`** (app-only change; the push deploys nothing).
- Shelved by the pivot (do not build without a new decision): booking emails, hotel filters/multi-room, saved cards, flights, car rental, Apple Pay/Nuitée items, Smart Packages doctrine builds.
- **2026-09-29 (night) — Suitcase v1 built (672e47c) + the landing page tells the pivot (386afb3, deployed).** Trunk on the Passport page: 7 label rules derived from stamps (maiden voyage, first flight w/ IATA, aquarium creature incl. the Georgia Aquarium whale shark, filmed here, city collector 3+, wayfarer 5/10 countries, first verified "I was here!"); engraved luggage-label art in 6 shapes; story sheets; earn toasts; branded trunk share (two-tap, native + web paths); the photo-real skin auto-loads from stamp-art/trunk-steamer-front-v1.jpg with an in-app studio-lit interim until the founder uploads their render (kit: docs/TRUNK_RENDER_PROMPT.md). Passport-page sharing untouched (founder: keep it). Unit-checked the label rules on the founder's real Atlanta trip shape (6 labels); eslint ✓ build ✓ boot-check ✓. **Activate: `npm run ota`.** Site: hero/modes/doors/metas now sell the passport + finders ("Collect the world. Keep the memories."), quotes kept + Augustine added, verified live, app-ads.txt byte-identical. Teen-safety platform research (Meta/TikTok/Snap practices) running → docs/research/teen-safety-platforms-2026-09.md.
- **2026-09-29 (late night) — "BUILD ALL": queue slices 1–4 shipped.** (1) Onboarding v2 (b674bba): name → home city → the passport step (page-one origin stamp rendered live, Atlanta explainer, privacy promise) → the location ask reframed; finish() mints the home-city stamp (origin:true, worker sanitizes it into meta); Home's Stamps Near You gains the once-only explainer card. (2) Home v2 (8062dff): the passport hero card leads — stamp count / warm zero state + "NEXT STAMP: … · MI" fed by StampsNearYou's one fetch. (3) Share renderer (d02f4c0): ART_FRAC back to 0.56 (two stamps per page again), share preview gains "Whole page / <stamp> · big" — a hidden hero page at 0.76 captures one chosen stamp at Updated-B scale; scene stamps' strips are now the founder's lying S (sine bands + sprockets riding the curve, verified on the 4 reference stamps). (4) Social P0 (2afb2bc): migration 20260930090000 applied by CI ✓ (tags presence/revoked_at, shares handle columns + unique index, api.user_blocks); worker /social/handle (reserved list, taken check, 2 changes/30d) + /social/block (silent both-direction enforcement at tag create and claim) — both live (answer "Sign in" unauth); claim card asks two questions + Block link; Settings → Username row. Near-miss logged: Settings used getHandle without the import (behind sign-in, invisible to boot-check) — caught by hand, bundle-verified. All gates ✓ on every slice. **Activate: `npm run ota`** (one bundle carries all four).
- Next in "build all": Social P1 (profiles, visibility, photo moderation at share boundary, age gate + OS age signal, reports) — carries the store-questionnaire flip, so it ships WITH a native build; then consent/privacy page + birthday stamp; then P2 follow + mailbox feed.
- **2026-09-30 — FILM DATA LIVE (founder ran both D1 commands): 593 queries, 1,997 rows — 155 new film: attractions + 348 film_scenes.** Verified from the live API: Aït Benhaddou answers its Game of Thrones line with cast and scene; Philadelphia City Hall answers its Philadelphia (1993) line on nearby. Scene stamps now mint with meta.film everywhere (nearby prompt, attraction page, Stamps near you); the lying-S strip ships in the same OTA the founder just ran. Social P1 core deployed the same night (26a63ee).
- **2026-09-30 — "continue building": Profile v1 + safety desk (1ce297d) and Social P2 follow + Mailbox (2c58ffb), both deployed.** Profile page (👤 tab): editable name/bio through the moderated /social/profile door, @handle or claim-nudge, traveler chips, 4-stat row (stamps/countries/followers/following), favorites picked only from OWN stamps, 3 dreams, the public/private dial with inline age gate + share-link copy, the luggage. Admin → Analytics: Safety reports desk (child-safety first with the 24h badge, Resolved/Dismiss). P2: api.user_follows migration applied ✓; /social/follow + /social/feed live ✓ (both answer "Sign in" unauth); Mailbox page (📬 tab): follow by @username, teen approval queue, reverse-chron feed (visibility-aware: public|friends-mutual; teen 24h delay; no coords; no photos v1; ✓ boolean; film titles ride), unfollow chips. Nav is now Home · Mailbox · Passport · Profile · Settings. Gates ✓ everywhere; bundle-verified strings. **Activate: `npm run ota`.** Remaining queue: albums/photo packets, postcards build, consent/privacy page + birthday stamp, avatar upload + native age-signal + store questionnaire (one native build).
- **2026-09-30 — photo packets (089f236) + birthday stamp & privacy group (ae13143), migration applied ✓.** Packets: destination envelopes derived client-side from the stamps payload (zero network; friend view moderation-safe by construction), kraft-envelope shelf with peeking prints → shared PhotoLightbox; mounted on Profile + Passport (owner and friend view). Birthday: Settings asks MM-DD only (year stays locked behind the gate), /social/age carries birth_md, the Passport mints "My Birthday" (entity birthday:<yyyy>, meta.birthday) once a year on the day with a toast. Settings gains the Privacy group with the promise as app copy + policy/terms links. Gates ✓. **Activate: `npm run ota`.** Queue remainder: postcards build, avatar+native age signal+store questionnaire (the one native build), tablet convergence.
- **2026-09-30 — POSTCARDS SHIPPED (13c6d1b), migration ✓, worker ✓.** api.postcards; /postcards/send (synchronous fail-closed photo moderation at send — a postcard is shared by definition; teen senders: mutuals only, no broadcast; blocks silent; URLs stripped); /pc-photo/ serve; the feed merges postcards + stamps newest-first, and a card addressed to YOU arrives even with zero follows (early-return bug caught pre-ship). Mailbox: ✉️ compose (photo → resize → send, message, where + dish, address chips: everyone / a follower) and postcard cards in the feed (front photo, italic message, dish · place, FROM @x · TO YOU). Stamp options: "Send as a postcard" with place prefilled. **Activate: `npm run ota`.** The founder's postcard concept is now real end to end: Passport = proof · Postcards = moments · Suitcase = personality.
- **2026-09-30 — avatars (8741724) + the growth link, "with @friend" chips and a photo bug (a5a2ed0), all deployed ✓.** Avatars: /social/avatar (2MB, sync fail-closed moderation, old object deleted) + /av-photo/ serve; the Profile circle is now a tappable photo. NATIVE_BUILD_CHECKLIST.md: the whole store session in one doc — the only native code left is the pasted AgeRangePlugin.swift. Growth: shares carry the traveler's /p/<slug> landing URL (native url + text); the landing logs share_landing_view; store buttons hop via /go/ios|android (verified live: 302s with ct= and Play referrer attribution) logging share_landing_store; ANALYTICS_QUERIES.share_funnel_30d gives shares → views → store taps by day. ppLoad resolves tagged_by → the booklet's green "WITH MAIZA" chip. BUG FIXED: photo select lacked mod_status, so the public serializer hid every photo on public passports (fail-closed against approved photos too) — reviewed photos now show. Lesson repeated twice tonight: `gh run list -1` can grab the PREVIOUS run — always match headSha before "watch". **Activate: `npm run ota`.**
- **2026-09-30 — STORE-FIRST CLOSEOUT (79b4e5f, deployed ✓ — matched the CI run by headSha this time).** Founder: partnerships wait; finish + deploy to both stores first. Closed: (1) ageSignal.js pre-wires Apple's Declared Age Range into both gates (silently preferred the moment the native plugin exists; busy-flag recursion guard caught in review); (2) tablet convergence — PassportHero extracted + leads the tablet, RightNowStrip retired; (3) city sets — /passport/sets live ("Sign in" unauth ✓), quiet chips on the Passport ("ATLANTA · 5 OF 10", green ✓ when complete). THE APP-SIDE QUEUE IS EMPTY. Everything between here and both stores is the founder's single native session: docs/NATIVE_BUILD_CHECKLIST.md. **Activate: `npm run ota`** (age wiring, tablet hero, city sets).

## 2026-09-30 — The Blotter (reactions + guestbook AROUND a shared page)
- Committed + deployed: e282fb6. Migration 20260930220000_blotter.sql applied by CI ✓ (blotter_marks / blotter_entries / blotter_cosigns, passport_stamp_photos.food_subject).
- Worker routes live + probed ✓: /blotter/read (public-safe), /blotter/mark, /blotter/sign, /blotter/cosign, /blotter/sweep (all auth-gated), GET /bl-doodle/<key>.
- Five reaction stamps (own engraved ink, never platform emoji artwork): WOW · TAKE ME · BEEN ♥ · I WANNA GO (auto-adds to the presser's On the Horizon) · MORE PICS — plus contextual YUMMY! (photo food_subject=1 only; gbModeratePhoto now answers the food question in the same call).
- Guestbook: signatures (text-moderated, edit/peel own) + finger DOODLES (DoodlePad: 4 inks, undo; fail-closed vision moderation; R2 bl/; tap to enlarge, tap to shrink). Co-signs = comment-likes with public authorship (who-signed list; lift your pen to unlike). Owner sweeps any mark/entry.
- Rails: non-owners need the booklet public; blocked pairs vanish silently; teen authors sign only where they follow the owner (accepted).
- Also fixed: Passport.jsx preview state declared after its first use in effect deps (TDZ crash, latent — was not yet OTA'd).
- Activate: nothing manual — migration + worker were CI. Frontend ships with the next `npm run ota`.

## 2026-09-30 — Virtual Luggage v2 (six trunks · five faces · placed stickers)
- Committed + deployed: 9d4f071. Migration 20260930231000_luggage.sql applied by CI ✓ (api.luggage_state). Worker /luggage/get + /luggage/set live + probed ✓.
- Per the founder's ChatGPT reference boards: Classic/Cognac/Midnight/Expedition/Voyager/Explorer; FRONT→RIGHT→BACK→LEFT swipe (320ms pseudo-3D), TOP chip, subtle dots; luggage = background layer, stickers = separate layer (drag / pinch-resize / rotate / per-face / normalized coords / server-persisted, no low cap — safety rail 900).
- Sticker inventory is earned: storied labels (labels.js) + one sticker per stamped city + airport roundels. Tray shows the unplaced; each trunk keeps its own arrangement.
- Faces load from R2 `stamp-art/luggage/<type>/<face>.webp`; engraved fallback face until renders upload. Entry point: Profile → My luggage → "Open 🧳".
- Judgment call flagged: all six trunks selectable now; milestone unlocks are a later decision.
- Activate (founder): 1) generate CLEAN per-face renders in the same ChatGPT session (no stickers/text — see docs/TRUNK_RENDER_PROMPT.md §Virtual Luggage v2) and upload via the `npx wrangler r2 object put` one-liners (Classic's five faces first); 2) frontend ships with the next `npm run ota`.

## 2026-10-01 — iOS 1.0.3 (8) SUBMITTED to App Store Review
- Submission ID 281dd542-35d4-4be8-b540-b74c4d791dba, Waiting for Review since 4:54 AM.
- Carries: location-primer fix (5.1.1(iv) reply posted in-thread), Declared Age Range capability + plugin, Capgo updater (first store binary with OTA inside), passport-era listing (copy/keywords/screenshots/support URL), UGC = YES flips, 13+ age rating, App Privacy + User Content/User ID.
- On approval: existing users update once via the store; all future releases flow by OTA.
- Play Store: blocked on founder's D-U-N-S/organization-account decision (old account closed for inactivity 2021; signed .aab + keystore + listing assets all ready).

## 2026-10-02 (evening) — verified stamps batch + social polish (ec962a8, ee48f5b)
- Attraction page: verified-only stamping (GPS at the place; no honor button), address+hours hero,
  Website/Parking/real Pricing cards, AI provenance on Good to Know; guestbook = notes + finger
  doodles (photo upload removed, doodle moderation door live).
- **Activate:** `npx wrangler d1 execute globeskimmers-attractions --file=scripts/city-icons/data/add_attraction_facts.sql --remote` (once; founder).
  The guestbook `is_doodle` Supabase migration applied itself via CI on push.
- Usernames: held-for-family mechanism (HANDLE_HELD), suggestions on taken/reserved names,
  Settings chips. Worker live on push; app chips ride the next OTA.
- Birthday ask card on Passport (2+ stamps, snoozable), age-mix bars in Admin Analytics.
- Virtual Luggage: swipe capture wrapper (fixes dead lower half) + inverted vertical mapping.
- Gates: node --check ✓, eslint --quiet ✓, npm run build ✓, cap copy ✓. App-side changes reach
  devices on the next `npm run ota` / native build — not yet on any phone at write time.

## 2026-10-03 — held-username release ceremony + the GlobeSkimmers Seal
- api.held_handles table (migration auto-applies on push) replaces the in-worker map;
  founder manages names/emails/invites in Admin Analytics ("Held usernames" desk).
- Claim ceremony card on the Passport for the matching sign-in email (hello-by-name,
  current-username-change notice, 🎉 celebration + travel quote). Claims mark the row.
- Verification = the GlobeSkimmers Seal (dashed mini stamp-seal SVG, never a checkmark);
  passport_shares.verified, admin grant/revoke desk, renders on Profile + Mailbox rows.
- Invitation email sends via Resend when RESEND_API_KEY is set; until then the desk
  composes + copies the message for manual sending.
- **Activate (optional, founder):** `npx wrangler secret put RESEND_API_KEY` (+ later
  Resend domain DNS) to make "Send invitation" email for real.
- Gates: node --check ✓, eslint ✓, build ✓, cap copy ✓.

## 2026-10-03 — the founder's save list, brand reserve, request door
- 214 family names + 423 brand/entity names (sports, parks, hotels, airlines, cruise,
  luxury, travel platforms, figures, government/military/political/monarchy) held via
  migration 20261003110000 — all read as "taken" app-wide; kind column separates desks.
  Skipped (impossible): tj, jp, f1 (under 3 chars — unclaimable by anyone), and
  erikakristadivinagracia, universalstudiosjapan (over 20 — shorter forms held).
- Admin Analytics: Brand & entity reserve (tap a chip → attach partner email / release),
  Username & Seal requests queue (Done/Dismiss), kind toggle on the hold form.
- Settings: "A business or official page?" request door → /social/request (3 open max).

## 2026-10-03 — Seal tiers, save batch 3, and the username blocklist
- Seal tiers: gold = Honored (founder's personal honor, foil), burgundy = Official
  (businesses/partners/figures), teal = House (team). passport_shares.seal; admin desk
  grants with a tier picker; Profile/Mailbox render the tier ink. Existing grants
  backfilled burgundy.
- Save batch 3 (754 held): Kirk/TPUSA, CEOs+founders (~100), Facebook/Samsung/Fox set,
  sacred names, Trump set + 20 US leadership titles, 228 countries, 404 world cities
  (kind 'place', for future official tourism accounts).
- Username blocklist (policy, no release path): 142 exact + 91 substring terms —
  satanic/evil names, terror/gang entities, profanity+slurs in ~15 languages. Verified
  zero collisions against all 1,392 held names and a real-name probe set (therapist,
  michelle, bahamas, pakistan, phuket…). osama/jihad stay claimable (real first names;
  binladen/alqaeda blocked); troia/weed/sinaloa stay (real places).

## 2026-10-03 — Seal letters wired to the grant desk
- Founder-approved letters (word-final): burgundy = official welcome ("It's an honor to
  have you here. Welcome."), gold = the honor letter ("the highest Seal of Honor and
  Respect… The founder honors you."). Teal/House grants send nothing.
- Grant → letter emails via Resend when RESEND_API_KEY exists; otherwise the desk shows
  the composed letter and copies it to the clipboard. Email via auth admin API, name
  from social_profiles.

## 2026-10-03 — No stamp without proof
- Worker lock (handlePassportStamp): a NEW stamp needs corroborated GPS or `await_proof`
  (photo next); birthday exempt; existing stamps (incl. grandfathered unverified) can
  always be re-stamped/upgraded. Failed GPS corroboration now refuses (409 proof_needed)
  instead of downgrading to an unverified stamp.
- Roaming exemption: IP country == traveler's home country (home SIM abroad) no longer
  counts as a GPS spoof (profiles.home_country → ICU region code).
- Tags (claim + inbox): no stamp minted; presence recorded; the app opens Stamp a place
  prefilled with the tag's place/date for photo proof.
- Stamp a place: GPS today at the venue, or ≥1 photo that proves it; an unproven new
  stamp is deleted after upload. Page one (onboarding + Passport button): GPS within
  40 km of the home city; stored at the city centre, never the user's position.
- Gates: node --check, eslint, eslint no-undef, build, cap copy, sim clean install +
  bundle-hash match.

## 2026-10-03 (late) — Mailbox unread, flags, photo comments, Wishlist out, Base44 out
- Mailbox: /social/unread + dot on the tab + "On your passport · N new" activity; claim
  @username in Mailbox; invite at zero friends; admin accounts can claim names held for
  admin emails (@maiza from founder@).
- Flag stickers: 200 flags in R2 (stamp-art/flags/<cc>.svg, CSP-hardened SVG); home flag
  + live-country flag by default (profiles.home_city_country, migration applied); earned
  on airport/border arrival; old plane placements render as the country flag.
- Photos: captions (moderated), reactions + comments via Blotter ph: targets; purge on
  photo/stamp delete; visitor visibility filter; reviewed (no authz hole).
- Wishlist page/hearts/route retired (data + sync kept). 34 dead files removed.
- Base44: tracker, Contact Us (now → worker /contact), onboarding LocationStep, Money
  Exchange, Basic Phrases (language detection was dead), price scanner, ATM, 404 — all off.
- Gates each step: node --check, eslint, eslint no-undef, build exit 0, cap copy, sim
  clean-install boot with bundle-content check.
- Founder: `git pull && npm run cap:sync && npm run ota` to ship the app side.

## 2026-10-03 (night) — Trip notes on arrival stamps (40c0be8)
- Migration 20261003210000_stamp_trip_note (passport_stamps.note, note_public default
  false) applied by CI. Worker POST /passport/stamp/note live (401 unsigned, verified).
- After an airport stamp: "What brings you to {city}?" — saved owner-only. The stamp sheet
  (airport + border stamps) edits it; "Show on my shared passport" runs text moderation
  first (422 + nothing saved if refused). The public booklet strips every unshared note.
- Gates: node --check, eslint, eslint no-undef (touched + app-wide = 0), build exit 0,
  cap copy, sim clean-install Release boot to sign-in, bundle contains the new route.
- To test on a phone (after OTA): land at an airport or use the Passport arrival prompt →
  write a note → Skip/Save; open the stamp → toggle sharing → view your public link.
- Founder: `git pull && npm run cap:sync && npm run ota` to ship the app side.

## 2026-10-03 (night) — Top 3 dishes, counted honestly (bad5f92 → v13)
- /ai-details for restaurant + coffee: the AI names up to 5 candidates with literal words
  and the reviews about each; worker code counts a review only if claimed AND literal,
  keeps the top 3 (topDishes + dishReviewsRead). bestDish/alsoRecommended still filled for
  older builds. Prompt v13 — every food panel regenerates once (Haiku only; details cached).
- Iterations, from live tests: v10 literal-only gave Guelaguetza "Mole Negro 5 of 5"
  ("molé sampler" → "mole"); v11 claims-only undercounted; v12 shared-word filter dropped
  Langer's pastrami to 1; v13 holds on 9 places (DTF, Guelaguetza, Langer's, Tsujita,
  Phở 79, Leo's, Blue Bottle [coffee], Sushi Gen, Ichiran Shibuya), spot-checked by hand.
- Regex "Customer favorites" retired in the worker (returns []) and the card.
- App side (TOP DISHES / ☕ TOP ORDERS list with the count line) ships with the next OTA.

## 2026-10-03 (night) — "Add your dish" (Option C phase 2, restaurants + cafés)
- Migration 20261004090000_place_dishes applied by CI. Worker live: POST /places/dishes
  (200, empty list verified), /places/dishes/add (401 unsigned verified), /places/dishes/
  delete, GET /dish-photo/<key> (bad key 400, missing 404 verified).
- A post: photo + dish name; proof = device GPS ≤150 m of the place (Google's cached
  location when known) or the photo's location tag ≤150 m; photo must pass review with
  food/drink as the main subject; dish name text-moderated; 12/day; one per traveler per
  dish per place (new photo replaces old). Anonymous; owner can remove.
- NOT end-to-end tested with a signed-in account (no test account used). First real
  test: founder at a restaurant after the OTA → card → "Here now? Add your dish".
- Gates: node --check, eslint, no-undef (touched + app-wide 0), build 0, cap copy, sim
  Release clean install boots, bundle contains the route.

## 2026-10-03 (night) — Stamp pages: tickets, parking, AI panel, server GPS check
- /attractions/visit-info { id }: Sonnet 5 fetches the official site (Wikidata P856) and
  follows its links; web_search only without an official site. Code keeps a price only if
  its page was fetched and states the amount; every number in text lines must be on the
  page; labels' ages/words too. Live: Getty Villa = free + timed reservation + parking
  $25 / $15 after 3pm / $10 after 6pm (6k tokens); Battleship Iowa = parking verified,
  admission not (prices live in a booking widget; Sonnet's reseller prices were dropped by
  the check — working as intended). Caps: 150/day signed-in (20 per traveler), 20/day
  unsigned (5 per network). Cache 30 days, 3 when nothing found.
- Cost to watch: Iowa read 113k input tokens on Sonnet 5 (138k on Opus 5); Getty 6k.
  visit_info_lookup events in D1 carry in_tok/out_tok per lookup.
- /attraction-ai-details accepts stamp ids (resolveStampGid → Google id, IDs-only text
  search in a footprint-sized box). All 21 LA recommended stamps resolve.
- handlePassportStamp: attraction stamps with a `fix` are distance-checked against the D1
  row (ppStampRadius = server copy of stampRadius.js); too far → 409 not_here. No fix
  (older builds) → old checks. ActivityDetail + NearbyStampPrompt send the fix.
- "Add your order" copy + "Did you like it?" (migration 20261004100000 applied; worker live).
- Gates: node --check, eslint, no-undef (app-wide 0), build 0, cap copy, sim clean boot,
  bundle contains visit-info + "Add your order". App side ships with the next OTA.

## 2026-10-03 (evening) — No booking; Things to Do = the attraction page; kind guestbooks
- Guestbook: migration 20261004110000 applied; worker live. Verified live: list maps a stamp
  id to the Google id; report/sign/admin need sign-in (401); anon PostgREST reads of
  guestbook_entries and the gb_report RPC now "permission denied". Review self-test on 14
  canned notes: tips/favorites/shout-outs publish; complaints, "skip it", sarcasm hold; spam
  link + profanity block. Admin Portal → 📝 Guestbook review (Publish / Keep private / Delete).
- Things to Do: /activities/one (verified: icon:Q1337576 → Universal card, 3 photos, 8.8 mi,
  stamp linked), /attractions/link (Universal → icon:Q1337576 after the D1-duplicate fix;
  D1 also has icon:Q639090 for the same place — founder: retire one), visit-info for Google ids.
- Booking: /hotels/nuitee/prebook → 410 booking_removed (verified); /activities/search
  returns places only (verified 20 places, 0 products).
- App (ships with the next OTA): stamp taps open the pinned Things to Do card; card shows
  GPS stamp + prices + parking + guestbook; "You're here — get the stamp" on list cards;
  Viator/ExperiencesRow/DreamGallery builder/affiliate libs removed; hotels out of search;
  stray "0" on search suggestion chips fixed.
- Gates: node --check, eslint (src clean; android build artifact lint error pre-existing),
  no-undef app-wide 0 (caught a removed IVORY_2 import in DreamGallery), build 0, cap copy,
  sim clean-install Release boot, bundle has the new routes and none of viator/products,
  "Build your vacation", "Search food, hotels".
- NOT tested end-to-end with a signed-in account: posting a held note, admin approve, an
  "I was here" stamp at a real place. First real test: founder on a phone after the OTA.

## 2026-10-03 (late) — Review fixes, the shared ChatGPT plan, landing page
- Three reviews (app, worker security, completeness) → fixed and deployed:
  CRITICAL guestbook list PostgREST injection (crafted entity_id dropped the hidden/held
  filters) — ids now strict + URL-encoded; verified live (exploit → 400). Every GPS
  attraction stamp needs its fix, measured against our/Google's coordinates; places:/owned:
  ids (all non-iconic "I was here" stamps were rejected before the fix); variant slugs via
  parent_id; gid2d1v2 written only from server data + stampable rows; guestbook age gate
  (428), adult-only city, edit cap + blocked check, kept-private stays private, report
  retry, founder email caps, no author ids in public lists; older builds' Viator/flight/
  package routes answer "nothing to show".
- App: pinned card opens once and survives list errors; GPS-only "You're here"; mi/km;
  owned places get prices; "See this place" on passport stamps; Doodle on every guestbook.
- Shared plan (ChatGPT, "if you were there, you can stamp it"): memory note on every stamp,
  "Who can see this stamp: Only me / My passport" (/passport/stamp/visibility), sensitive
  places (hospital, clinic, school, worship…) start private (Google types first, name as
  fallback), "How stamps work", restaurants/cafés stamp "I was here" while GPS is inside,
  warm invite text.
- Site: founder's 4 screenshots in the phone frames; "If you were there, you can stamp it"
  with 4 typographic stamps rendered by TypographicStamp; booking copy removed; privacy
  policy: stamps & location, sensitive places, "No Bookings or Affiliate Links". Live.
- Stamp layouts: Justified/Banner/Oval no longer take 3-word names (collisions in Chrome).
- Founder: `git pull && npm run cap:sync && npm run ota`; then test on a phone: an "I was
  here" stamp at a café, a held guestbook note + Admin Portal → Guestbook review, Only me /
  My passport on a stamp. Retire one of the duplicate D1 Universal rows (icon:Q639090 vs
  icon:Q1337576).

## 2026-10-03 (late) — Stamp taps get the full Things to Do card (54ca826, bae9381, e3f07ce)
- Founder compared the stamp page with the Things to Do card ("I like that the old things to
  do pages had open and close hours"). The stamp page was already gone at HEAD; phones were
  still on the 09:26 PDT OTA (1.0.2610031626), which predates its removal.
- Worker: /activities/one builds its card with the list's mapper (processPlaceH moved out of
  handleActivities unchanged as gaMapTieredPlace — checked identical apart from the two
  location args). Stamp taps gain Family Friendly / Accessible, what people love, heads up,
  best time. No traveler location → no distance (was "0.0 mi").
- Worker: theme parks (types amusement_park / water_park) are 🎢 Theme Park, not 🌳 Nature &
  Outdoors — Universal, Disneyland, Knott's, Six Flags, water parks; Outdoors chip → Fun.
- App: the opened card drops the gold "1" rank badge (every opened card showed 1), the photo's
  category tag moves left (the sheet's ✕ covered it), the guestbook comes last (after hours,
  AI details, website).
- Verified live: /activities/one icon:Q1337576 → Theme Park, 8.6 mi, ★4.6 (175,388), phone,
  7-day hours, Family Friendly + Accessible; without userLat → no distance. /activities LA →
  52 nearby + 37 icons + 20 regional; Disneyland, Knott's, Universal = Theme Park; Griffith
  Park = Nature; Universal Studio Tour = Tours.
- Gates: node --check, eslint, no-undef (touched + app-wide 0), build 0. NOT rendered here
  (sign-in gate) — first visual check is the founder's phone after `npm run ota`.
- Seen while verifying, not changed: review-word chips can be vague ("Heads up: avoid",
  "What people love: amazing") — the list already showed them; candidate polish.

## 2026-10-03 (late) — Things to Do review chips tidied (f2af89d)
- Founder: "Yes please tidy the chips" (after "Heads up: expensive · avoid" on Universal).
  Correction to the previous entry: list results carry no reviews (0 of 108 LA list cards
  had review chips), so these chips only reached stamp-tap cards (Place Details, 5 reviews)
  — they became visible with bae9381.
- What people love = a named part praised in the same sentence (views, rides, studio tour,
  exhibits, trails…), never a bare superlative. Heads up = crowds / pricey / long lines /
  tricky parking only; negated sentences never count. Best time = reviewers' advice (go
  early, weekdays, sunset). Each needs ≥2 of the reviews read.
- Text property chips: the name, or ≥2 reviews (list cards unchanged — 9/10 synthetic
  review-less places identical; the one change is intended: "inside" no longer = Indoor).
  Badges that repeated a property chip removed (Adults Only stays). Word fixes: date ≠
  couples, free ≠ budget, complimentary/no charge ≠ free entry; Free Entry ⇒ Budget Friendly.
- Verified live: Universal → love attention to detail · studio tour · rides; heads up crowds ·
  pricey; best time Go early; chips Family Friendly · Adventure · Accessible, no badges.
  The Broad → exhibits · art. Yosemite → views · trails, no heads up (was "loud, too hot").
- Trade-off: a fact one reviewer states (Griffith Observatory's free entry) no longer makes a
  chip; the Tickets card carries verified prices.
- Worker only — no app change. Phones still need `npm run ota` for e3f07ce (the card layout).

## 2026-10-03 (late) — Real prices + parking for JS-built official sites, kept 3 months (1c336b0, a92cd15, 5d59718)
- Founder: "pull prices and parking details and display … cache every 3 months with a link
  that says verify most updated info from website". Cause of the link-only cards: Universal's
  site is a JavaScript app — web_fetch got a 9 KB empty shell, so v3 never found anything.
- Worker: web_search runs INSIDE the official site (allowed_domains = its domain); each search
  citation's cited_text (API quote, ≤150 chars) is evidence for its URL like fetched text —
  every amount must appear in it. No official site → search anywhere but resellers
  (blocked_domains); reseller pages never count (code check). Profile pages (facebook,
  instagram, google, yelp, wikipedia) are not treated as the official domain.
- Kept 90 days when found, 30 days when nothing is found (was 3 — a no-prices place was
  re-checked and paid for every 3 days). v5: parking gets its own search (4 searches max);
  any label/note text about the lookup itself ("not stated", "not found in the sources") is
  cut or dropped; _diag lists the search queries.
- App (a92cd15, ships with the next OTA): "Verify the latest prices / parking info on the
  official website ↗" under each card — the source page when it is on the official site.
- Verified live (v4): Universal → 1-Day from $109, + Express from $199, VIP from $369, 2-Day
  from $75 a day, kids 2 and under free — all from store.universalstudioshollywood.com; no
  parking (fixed in v5). Cost: 9 logged lookups average ~$0.15 (Sonnet 5 tokens + $0.01 per
  search); results shared by everyone for the cache period, so cost tracks distinct
  attractions opened, not users. Daily caps (150 signed-in, 20 signed-out, 5 per network)
  bound the worst case at ~$25/day.
- v5 deployed; its first live run was blocked by the 5-per-network signed-out cap during
  testing — first real run: the founder opening Universal signed in.
- Cache lives in Cloudflare KV (visit:<version>:<id>); Universal's v4 entry expires Jan 1, 2027.

## 2026-10-03 (late) — New price lookups are signed-in only (6168c67)
- Founder: "Signed out users can use the app? I thought only signed in users can" — correct
  (src/App.jsx forced sign-in gate); the worker, though, is public and let any caller start
  up to 20 paid lookups a day signed-out (5 per network).
- Now: a saved result is free for anyone to read; a NEW lookup needs a signed-in traveler,
  checked before any paid call (Claude, search, Google details). Signed-out caps removed;
  signed-in caps unchanged (20 per traveler, 150 per day). The card falls back to the
  official-site link on a refusal.
- Verified live: unsigned POST /attractions/visit-info (uncached id) → 401 {"error":"sign_in"}.
  Claude can no longer test fresh lookups from the Mac — the first v5 run is the founder
  opening Universal signed in.

## 2026-10-03 (late) — Text and price scanners removed completely (eab98c0, 132e0ef)
- Founder: "Remove text scanner and remove price scanner from the app completely."
- App: SmartTextScanner + SmartPriceScanner pages deleted and unrouted; doors closed (All
  services sheet, tablet Home tiles, Home quick actions, web-app shortcut); useCameraPreview,
  gs-camera-open CSS, Layout/FloatingNav exceptions, ROUTE.analyzePrice, and the
  @capacitor-community/camera-preview plugin removed (cap sync both platforms: iOS 9 plugins).
- Worker: the scanner block (774 lines) and 21 scanner analytics queries removed; /scan-text,
  /scan-prices, /describe-item, /analyze-price answer 410. sha256Hex kept (shared).
- iOS NSCameraUsageDescription now: photos for passport stamps, postcards, dish posts and the
  profile picture — takes effect with the NEXT native build (build 11 still says "translate
  signs and menus, scan prices").
- Founder, before resubmitting 1.0.3: App Store Connect description drops "and a camera scanner
  that translates signs and converts prices" (docs/STORE_LISTING_COPY.md updated).
- Gates: eslint (touched) clean, no-undef touched + app-wide 0, build 0, cap sync clean.
- Ships: worker on push; app with the next `npm run ota`.

## 2026-10-04 — Auschwitz-Birkenau: honor message + illustrated or text-only stamp
- Founder: "for Auschwitz let's give the user the stamp but also ask them if they feel
  comfortable in keeping it or … just have a text stamp … leave a message that we honor …"
- App: src/lib/memorials.js lists memorial places (Auschwitz-Birkenau only; matches the
  three names the attractions DB uses: "Auschwitz-Birkenau Memorial", "Auschwitz I",
  "Auschwitz II-Birkenau"). Stamping one opens a sheet: "A place of remembrance", the
  message ("At least 1.1 million people were murdered here, about one million of them Jews.
  We honor their memory, and we're grateful you came to remember."), then Illustrated vs
  Text only, neither pre-selected; "Decide later" closes it. The Passport asks once more on
  open while the choice is unmade; the stamp's options gain "How this stamp appears".
  Text only = the typographic stamp in the card, booklet, enlarged view and shared passport.
- Fixed with it: none of those three names matched the art file (auschwitz-birkenau), so the
  stamp showed text only with no choice. src/lib/stampArt.js aliases them now.
- Worker: POST /passport/stamp/layout accepts art: 'art' | 'plain', saved in the stamp's
  meta.art (no migration — meta is an existing jsonb column).
- Gates: node --check, eslint (touched) clean, no-undef touched + app-wide 0, build 0.
- Ships: worker on push; app with the next `npm run ota`.
- Test: can't be run end to end from home — stamping needs GPS at the site. After the OTA,
  check that other stamps look unchanged. The first real check is the first visitor; any
  Auschwitz stamp made before the OTA gets the question the next time its owner opens the
  Passport.

## 2026-10-04 (late) — Places of respect: Mecca + Medina message; Auschwitz wording
- Founder: Auschwitz message starts "This is a place of remembrance."; Mecca and Medina keep
  their illustrations and pop up "This is not a place for sightseeing. It is a place of worship…".
- App: src/lib/memorials.js → src/lib/respectPlaces.js (kind memorial | worship);
  MemorialStampSheet → RespectPlaceSheet. Worship sites: message + their illustration + "Thank
  you" (records meta.art='art' so the Passport doesn't ask again); no Illustrated/Text-only
  choice and no "How this stamp appears" row. Matches the DB's names: "Masjid al-Haram",
  "Kaaba", "Masjid al-Haram & the Kaaba", "Prophet's Mosque (Al-Masjid an-Nabawi)".
- Ships with the next `npm run ota`.

## 2026-10-04 (late) — Stamp art matched to every place (founder: "ensure the correct art")
- Review: all 994 live illustrations × the 103,102 attractions rows (8 reviewers, then a
  Wikidata coordinate pass and a country/coordinate cross-check). Before: 575 places matched
  their art by name, Medina/Auschwitz/Opéra Garnier/Topkapi and ~400 others never did, and
  Paris art showed on Notre-Dame in Saigon/Lausanne/Luxembourg/Papeete, Rome's Pantheon on
  Paris's Panthéon, Venice's St Mark's in Heraklion, the Parthenon in Nashville.
- App (src/lib/stampArt.js): art by row id → name (+ generated aliases) → guards: rows that only
  share a name never borrow it; a name-only stamp in another country doesn't either. Data:
  src/lib/stampArtIndex.js, GENERATED by scripts/stamp-art/build-art-index.mjs from
  scripts/stamp-art/art-matches.json (it self-checks every stampable row). Grand Canyon rims
  and Niagara sides use the parent art.
- Worker: the Google-place → iconic-row link cache is now gid2d1v3 (v2 held 'none' and old pins
  for 30 days); guestbooks still read v2 so no book splits.
- Montserrat's file on R2 was truncated (bottom half black) → moved to
  archive/stamp-art/montserrat.png; shows text-only until re-exported.
- **Activate (founder, once, after the worker deploys):**
  `npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-art/d1-art-fixes.sql`
  then `npx wrangler kv bulk delete scripts/stamp-art/kv-stale-links.json --namespace-id=68ae9c62099f4834a8c6f0ff3eb57e71 --remote`
  — 155 Top-1,000 places added (Stonehenge, Lake Garda, Aqueduct of Segovia…), 27 made
  stampable (3 renamed: Chimborazo, Sequoia National Park, Pancake Rocks), 39 rows re-pinned
  (Kuwait Towers, The Alamo, Marble Caves, Mont Blanc, Cape of Good Hope…), 9 junk countries
  fixed (Palace of Westminster said Italy, Avignon's Papal Palace Japan), 352 big places'
  circles widened (never narrowed, ≤20 km; buildings ≤2 km). Tested on the live schema locally;
  a rollback file was generated (scratchpad d1-art-fixes.rollback.sql — ask Claude if needed).
- DONE 2026-10-04 22:48: founder ran the SQL (580 queries, 2,143 rows written); verified
  read-only: 155 stamp_art rows, stampable 19,803 → 19,985; Stonehenge, Kuwait Towers, Marble
  Caves, Mont Blanc, Chimborazo checked. Opéra Garnier's city fixed Vincennes → Paris.
- Result once both ship: 993 of 994 illustrations sit on a stampable place (Maldives Overwater
  Villas has no single spot); 1,318 rows show art.
- Art to redo (founder): 36 — see the Stamp Art Toolbox page, "Needs a redo".
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0, resolver tested on
  the review's cases (Notre-Dame Paris ✓ / Lausanne ✗, Parthenon Nashville ✗, Opéra Garnier ✓,
  Grand Canyon South Rim → Grand Canyon).

## 2026-10-05 — Founder's redraws uploaded (33 stamps)
- ~/Downloads/stamps-fixes-18-white 1 (and "2", byte-identical) + stamps-fixes-frames-white:
  18 wrong-landmark redraws, Notre-Dame + Perito Moreno spelling, 12 frame re-exports,
  Montserrat. All 784×1168 PNG; frames measured clean (no ink on the side edges; the old
  ones had 14–39%).
- Reviewed twice (Claude + an independent reviewer): 28 right. 5 are closer but need one
  more try — The Wave (reads as ocean surf), Blyde River Canyon (cones, not the Rondavels;
  stray dot), Ciudad Perdida (terraces look like wells), Ise (temple roof, curved torii),
  Somapura (pointed pyramid). Mount Koya prints "CATALOG NUMBER". Briefs on the Toolbox page.
- R2: the 32 replaced files archived at archive/stamp-art/replaced-2026-10-05/<slug>.png,
  then all 33 uploaded to stamp-art/<slug>.png (live server verified byte-for-byte).
  Montserrat is back (its broken file stays at archive/stamp-art/montserrat.png).
- App: art is cached on phones 30 days, so redrawn slugs get ?r=2026-10-05 (REDRAWN in
  src/lib/stampArt.js — add a dated list for the next round). Ships with the next `npm run ota`.
- Gates: no-undef app-wide 0, build 0, tagged URLs tested.

## 2026-10-05 — Guestbook doodle opens where you are + says whose guestbook it is
- Founder (screenshots, Chesebrough Park): tapping Doodle put the pad at the TOP of the
  attraction card — off screen for someone who scrolled down to the guestbook.
- Cause: the card's overlay (ThingsToDo, backdropFilter blur) makes `position: fixed`
  children pin to the card, not the screen. Fix: DoodlePad renders on document.body
  (createPortal), above the card (z 10010), anchored near the bottom on phones
  (safe-area aware), centred on tablets. Toasts raised to z 10050 so "Draw something first"
  isn't dimmed under it.
- Guestbook's pad now reads: "GUESTBOOK · <place>" / "Sign the guestbook" / "Draw your name,
  a little art, or something you loved about this place." and opens with a small handwritten
  "I was here!" (Caveat, navy ink, top-left) that posts with the drawing; its small × removes it
  (founder, 2026-10-05); undo/eraser leave it,
  and a stroke of your own is still required to post. Caveat 600 added to the Google Fonts
  link in index.html (fallback Bradley Hand / cursive). Passport-page doodles keep "Draw in
  the margin" and a blank page.
- Test on a phone after OTA: open an attraction, scroll to the guestbook, tap 🎨 Doodle —
  the pad appears on screen at the bottom; also from "Doodle with your finger instead".
- Gates: eslint (touched) clean, no-undef app-wide 0, build 0. Ships with `npm run ota`.

## 2026-10-05 — Dish photos: "Add a photo of what you ordered" + favorite dish
- Founder: "instead of add your order … add a photo of what you ordered … a check box … this
  is my favorite dish in this restaurant".
- App (TravelerDishes, restaurants + cafés): the button and sheet read "Add a photo of what you
  ordered"; the sheet has "⭐ This is my favorite dish at this restaurant" (cafés: "…favorite
  here"). "From travelers" lines add "· ⭐ favorite of N".
- Worker: /places/dishes/add takes favorite; one favorite per traveler per place (a new pick
  clears the old); /places/dishes returns favorites per dish and sorts by travelers, then
  favorites, then loved. Both read/write without the column until the migration lands.
- Migration supabase/migrations/20261005090000_place_dishes_favorite.sql (favorite boolean
  not null default false) — applies via deploy-migrations on push.
- Founder's question "why are there no photos in places to eat?": restaurant lists come from
  the owned places DB (free) and those rows carry no photos; Google photos load only when a
  restaurant is opened (paid per place). Options in the reply; nothing changed yet.
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0.

## 2026-10-05 — Passport booklet: two stamps to a page, shares stay big, move stamps between pages
- Founder: two stamps per page, not always centred (one in the top half, one in the bottom);
  the "I was here" stamp with memory photos was too big in the booklet; keep the shared image
  size; move a stamp onto another page; a note that shares print big.
- App (PassportBook): booklet stamps print compact (art 0.40 of the page, airport 0.62, photos
  one small row, captions ×0.8 and scaled with Settings → text size). Two stamps share a page
  when their heights fit together; each gets its own region sized to it, at a spot and tilt
  fixed from its id. A lone stamp takes the top or bottom half. Photo-first scene stamps and
  'own page' stamps keep a page to themselves.
- Shares: a hidden copy of the open page at the old share size is what gets captured (same
  look as before). If its two stamps can't fit one page at that size, the share opens on the
  first stamp at full size (the preview still offers the other stamp and the whole page).
  Note under the booklet: "Shared pages print big: a story fills the whole screen, a post
  fills the frame."
- Move: stamp options → "Move to another page" lists pages holding one stamp it fits beside
  ("Page N · beside …"); the pair lands on that stamp's page. Worker /passport/stamp/layout
  takes page_with (meta.page_with + page_with_at; newest move wins; own-page / back-to-flow
  clears it; a solo target becomes shared).
- Instagram's "Sharing as …" screen (Reel/Post/Story/Message) is Instagram's own sheet — we
  can't add an X; swipe down closes it.
- Reviewed by an independent agent; its 6 findings fixed (spot index sign bug, pair order,
  half-size math incl. border/text size, share-size overflow, share copy −38px, top padding,
  eager images in share copies, partial-move error).
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0, packing tested on
  sample passports. Ships: worker on push; app with `npm run ota`.

## 2026-10-05 — Private messages to owners; guestbooks + photos on convenience stores
- Founder: only kind feedback public; a private channel to the business owner (screened,
  anonymous unless signed, collected until owners claim); same guestbook/doodle/photo
  treatment for coffee shops and convenience stores ("photo of what you got").
- App: every Guestbook (attractions, restaurants, cafés, NOW stores) gets a quiet door —
  "🔒 Something for the owner's ears? Send a private message" → OwnerNoteSheet (sheet on
  document.body: message, "Sign it with my first name" checkbox, the promise line "Sent
  privately to the owner when they join GlobeSkimmers… We screen messages for threats and
  abuse before delivering them"). ConvenienceStore cards gain TravelerDishes (kind="store",
  "Add a photo of what you got here", "What did you get? e.g. Matcha Kit Kat") + a Guestbook.
- Worker: POST /places/owner-note — age gate, 10/day cap, Haiku screen (complaints ALLOWED;
  threats/slurs/extortion/personal details blocked; staff insults + crime accusations held
  for admin); name from the profile only when signed AND 18+; rows in api.owner_notes
  (status ok|held|blocked) awaiting the owner-claim build. /places/dishes/add takes
  kind='store' (food-subject check skipped — a store find can be anything).
- Migrations: 20261005100000_owner_notes.sql, 20261005100100_place_dishes_store_kind.sql
  (gs:allow-destructive: re-creates the kind check). Apply via deploy-migrations on push;
  the worker answers "opens in a few minutes" until they land.
- docs/LAWYER_BRIEF.md started (founder: collect lawyer questions on the side) — reviews/FTC,
  claiming, stamp IP, UGC, minors/privacy, insurance; update it when decisions touch it.
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0.

## 2026-10-05 — Airport stamps: Arriving or Departing; round trips; audit pull
- Founder: offer the stamp any time GPS senses an airport; the traveler picks Arriving or
  Departing and it prints on the stamp; round trips collect both; and an admin must be able
  to reconstruct the sequence later (LAX in → ATL → LAX out).
- App: AirportStamp takes direction (all six designs: the word — Panel says ENTRY/EXIT — the
  plane turned to land/take off over a runway line, arrow-meets-bar on Schengen/Panel, dotted
  inner border on departures). No direction = pre-change look, pixel-identical; country inks
  KEPT (the mockup's ink-by-direction swap is NOT in — founder hasn't decided; one-line change).
  AirportArrivalPrompt asks "which way are you flying?" with both mini stamps; re-asks at the
  same airport on a later day (guard is now IATA:date, old forever-guard retired). Booklet +
  stamp card parse the IATA from suffixed ids and pass meta.direction.
- Worker: /passport/stamp with kind=airport + direction keys the stamp per visit
  (IATA:date:arr|dep) and stores meta.direction — legacy stamps untouched; same-day same-
  direction re-tap updates instead of duplicating. NearbyStampPrompt airports still stamp
  directionless (legacy look) for now.
- Audit: POST /admin/user-activity { q: handle|user_id } (admin-gated) → airport sequence with
  directions + per-year counts (stamps, guestbook notes, dish photos, owner messages).
  ON DEMAND only — no standing profiles (see LAWYER_BRIEF §5b). AdminAnalytics gains
  "🔎 Traveler activity — audit pull".
- Privacy: PRIVACY_POLICY_DRAFT gains the legal-requests disclosure; LAWYER_BRIEF §5b adds
  the data-profile questions (minimization, profiling disclosures, subpoena process).
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0.
- Test after OTA: at any airport, the prompt shows both stamps; pick one; return days later →
  asked again. Old airport stamps unchanged in the booklet.

## 2026-10-05 — Activity overview: the investor view (aggregate, counts only)
- Founder: not only courts — investors/VCs need the whole picture: activities per day/week/
  month/year, which kinds, trends (stamping more? food more? airports? which city?).
- Worker: POST /admin/activity-overview (admin-gated) reads the four content tables over the
  last 12 months (paged, 40k-row ceiling with a truncated flag) + PostgREST exact counts for
  all-time. Returns day (30d) / week (12w) / month (12m) series per metric (stamps by kind,
  guestbook notes, doodles, dish photos by kind, owner messages), top stamped cities, places
  and countries (12-month window). Counts only — no names, no per-user rows; durable Supabase
  tables, not the 90-day D1 events.
- Admin page: "📈 Activity overview — the investor view": all-time line, this-month-vs-last
  deltas (overall, airports, food), Days/Weeks/Months toggle, metric × period table, top lists.
  Sits above the audit pull.
- Yearly view = the 12-month row of the month table; longer horizons accrue as the app ages.
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0.

## 2026-10-05 — Admin: everything exports as a spreadsheet
- Founder: all captured data exportable via spreadsheet — individual activity vs aggregate
  activity vs activity per country vs active users.
- App: src/lib/adminExport.js (CSV with UTF-8 BOM; native = Filesystem cache + share sheet
  — Save to Files/AirDrop/mail; web = plain download). Buttons: Activity overview → "⬇
  Activity CSV" (day+week+month × every metric) and "⬇ Countries & places CSV" (stamps by
  country/city/place, 12-mo, up to 300 each); Traveler pull → "⬇ CSV" (the full timeline:
  date, activity, place, detail — worker now returns it, capped 5,000 rows); Active users
  per day → "⬇ Active users CSV" (day × active × sign-ups + DAU/WAU/MAU/return/stickiness).
- Worker: /admin/user-activity adds timeline; overview top lists raised from 10 → 300 for
  export (UI still shows 6).
- Founder's location check (verified in code, nothing changed): stamping is allowed anywhere
  WITH GPS proof; iOS NSLocationWhenInUse string says it verifies stamps and shows nearby
  places; the Always string says "never tracks you in the background"; Android has
  COARSE+FINE only (no BACKGROUND permission); runtime checkPermissions/requestPermissions
  before first use; no watchPosition/background modes; sensitive places auto-start private.
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0.

## 2026-10-05 — Profile: My virtual items + travel buddies; prints from a packet
- Founder: at least 3 openable items (luggage + laptop + drink container); generic shapes
  only — NOT Apple/HP/Yeti/Stanley trade dress (LAWYER_BRIEF §3 bar); 8 colors (pink white
  black yellow blue purple green orange); stickers per item, one home per sticker (a flag
  can't ride two items); enlarge; drag to rearrange; up to 6 named virtual pets — all dog/cat
  breeds, hamsters, pet birds, iguanas/dragons — poses sitting/laying/belly-up by swipe.
- App: src/components/profile/ — gearShapes.js (laptop + tumbler + straw bottle + lid bottle,
  recolorable SVG), petShapes.js (5 species × 3 poses chibi fallback art), VirtualItems.jsx
  (shelf under the trunk, enlarge/edit sheet: colors, drink variant, sticker picker from the
  SAME earned inventory as the luggage with "on your luggage/laptop/bottle" exclusivity,
  drag/size/turn/remove; buddies strip: species → searchable breed → coat → name, swipe =
  pose, tap = manage). src/lib/petCatalog.js: 278 dog breeds, 73 cat, 5 hamster, 25 bird,
  10 reptile + coat palettes. Pet names pass gbModerate.
- Per-breed art pipeline: upload renders to R2 stamp-art/pets/<species>/<breed-key>/<pose>.webp
  and they take over from the drawn fallback automatically (same as luggage skins).
- Worker: /gear/get, /gear/set (validates colors/variants/species/poses, 6-buddy cap, one
  item per sticker, name moderation). Migration 20261005110000_profile_gear.sql.
- Photo packets: a + chip on each envelope (owner only) uploads up to 10 prints straight to
  that destination's newest stamp (same EXIF + review path as StampActions); packets.js now
  carries the newest stamp id per destination.
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0. Ships: worker +
  migration on push; app with `npm run ota`.

## 2026-10-05 — Virtual items & pets: the founder's renders take over on upload
- Founder: the drawn art isn't realistic enough — PNG renders coming.
- App: GearArt tries R2 gear/<item>/<color>.png per color (32 files) before the drawn shape;
  PetArt ladder: pets/<species>/<breed>/<coat>/<pose> → pets/<species>/<breed>/<pose> → chibi.
  The art server is already extension-forgiving (webp/png/jpg).
- Kit: docs/VIRTUAL_ITEMS_ART_KIT.md + scripts/stamp-art/virtual-items-filelist.csv
  (1,205 exact paths; starter_set=YES marks the ~160-file first batch).
- Gates: eslint clean, no-undef 0, build 0.

## 2026-10-05 — Border crossings: entry/exit stamps on the ground + visited flags
- Founder: after (never before) crossing a country border by car/train/cruise, ask Entry or
  Exit or Not now (San Diego → Tijuana); same for US STATE lines (California → Nevada) with
  each state's claim ("The Silver State") and for UK nations (England → Scotland); designs
  must differ from airport stamps; every entered country drops a flag sticker — "Visited
  <Country>" above the flag unless it's home/residence.
- App: LandStamp.jsx — two new designs: state = roadside welcome sign on posts (ENTRY/EXIT,
  name, italic claim, date, "I was here!"); country = checkpoint with a diagonal-striped
  barrier bar, LAND BORDER / RAILWAY CROSSING / PORT OF ENTRY by mode, car/train/ship glyph,
  drawn ✓. Proof-rendered and eyeballed. src/lib/stateNicknames.js: 51 state claims + UK
  nations (SUBREGIONS US+GB).
- BorderCrossingPrompt rewritten: detects a COUNTRY change (GPS already across; airports
  defer to AirportArrivalPrompt) or a US-state/UK-nation change; mode chips 🚗🚆🚢 (ship for
  countries — covers cruise stops ashore); Entry/Exit buttons preview the exact stamp;
  "Not now" and the pop-up kill-switch stay. Cruise ships = the country flow when they step
  ashore.
- Worker: kind 'state' added; direction+mode allowed for airports, states, and border country
  stamps (entity_id keyed BASE:date:arr|dep so every crossing is its own stamp); stats gains
  states count. Booklet + stamp card render LandStamp; legacy flag-badge border stamps
  unchanged.
- Stickers: arrival flags now print "VISITED <NAME>" above the flag; home/residence flags
  stay plain (an earlier plain flag never doubles).
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0, stamp proof
  sheet rendered. Ships: worker on push; app with `npm run ota`.
- Note: state detection uses the reverse geocoder's address.state, which arrives when the
  app is opened in the new state/country — the prompt fires on the next open after crossing.

## 2026-10-05 — Border stamps: no transport guessing; Stamp-a-place starts at the sensed city
- Founder: we can't know car vs train vs ship — drop RAILWAY CROSSING / PORT OF ENTRY and the
  mode chips. Country checkpoint stamps now always read "BORDER CROSSING · CC"; no glyphs.
  (Worker still tolerates a mode field; nothing sends it.)
- Toggles already existed and cover the new prompts: Settings → "Toggle airport arrival
  stamps" (pp_suggest_arrivals) and "Toggle new-city pop-ups" (pp_city_prompt — country AND
  state/nation crossings share it), plus the in-prompt "Turn off crossing pop-ups".
- Stamp a place: opened without a preset it now starts from the GPS-sensed city
  (activeLocation.address) — filled, not locked; the submit-time GPS/photo-proof check is
  unchanged, so users can only mint a city stamp where they actually are.
- Gates: eslint (touched) clean, no-undef app-wide 0, build 0.

## 2026-10-05 — Dodger Stadium: film note removed; owners can drop any movie note
- Founder: Dodger Stadium is a ballgame destination now — remove "filmed here".
- D1 (applied live): DELETE FROM film_scenes for icon:Q247420 — new Dodger stamps carry no
  film. (It was the "Star Trek" scene row.)
- App + worker: stamps already minted with a movie note get a fix — stamp options →
  "Remove the movie note" (keeps the stamp, drops the "scene from…" line and the photo-first
  layout). /passport/stamp/layout takes film:'remove'.
- Gates: node --check, eslint (touched) clean, no-undef app-wide 0, build 0. Worker ships on
  push; the option with `npm run ota`.

## 2026-10-05 — Albums: add prints and a guestbook on every photo inside
- Founder: adding photos must work inside an opened album, and each photo (at least each
  album) needs the guestbook instead of plain captions.
- App: an open packet's lightbox now carries a footer per photo — the owner's "＋ Add prints
  to <city>" button (same upload/review path) and the existing per-photo PhotoFooter: the
  Blotter guestbook (kind notes + doodles + co-signs, visitors per the passport's privacy)
  plus the owner's caption line. packets.js photos now carry their ids.
- Note: the + chip on envelopes and this album footer both reach phones with the next OTA —
  the founder's screenshot predates it.
- Gates: eslint (touched) clean, no-undef app-wide 0, build 0. Held with the next batch.

## 2026-10-05 — The founder's bell: instant alerts for first opens and stamps
- Founder: "text me every download and every stamp." Stores don't expose downloads in real
  time (daily counts only, for every app) — the live signal is a NEW PHONE'S FIRST OPEN,
  minutes after install. The worker now sends the founder an instant alert on each first
  open ("🎉 New phone opened GlobeSkimmers — iPhone") and on every newly created stamp
  ("📍 Stone Mountain Park · Stone Mountain, US — attraction stamp ✓"). 400/day cap; the
  bell can never break a request.
- Transports: ntfy push (free, instant) when NTFY_TOPIC is set; Twilio SMS too when
  TWILIO_SID/TWILIO_TOKEN/TWILIO_FROM/FOUNDER_PHONE are set.
- **Activate (founder, two steps):**
  1. `npx wrangler secret put NTFY_TOPIC` → paste <your private topic> (make one with
     `echo gs-bell-$(openssl rand -hex 16)`). The topic name is all anyone needs to read the
     alerts and this repo is public: never write it here. (Redacted 2026-10-13; the topic
     first written here must be retired.)
  2. Install the "ntfy" app (App Store), + → Subscribe to topic → <your private topic>
  (For literal SMS later: make a twilio.com account, buy a number, complete US A2P
  registration, then set the four TWILIO_* secrets the same way.)
- Daily true-download digest from App Store Connect / Play Console is possible as a
  follow-up (API keys + a cron) — not built.
- Held with the current batch; works once pushed + secrets set.

## 2026-10-05 — Profile: view first, edit on request
- Founder: "place an edit profile but don't leave the save button on display constantly."
- App: the Profile opens as a clean page — name as text, bio as text, website as a link,
  favorites/horizons as plain chips (empty sections hidden), no inputs, no Save. A quiet
  "✎ Edit profile" button switches to edit mode: name/bio/website fields, add/remove chips,
  avatar shows a PHOTO ribbon, and Save + Cancel appear only there. Save closes edit mode;
  Cancel restores what was on screen before.
- Gates: eslint (touched) clean, no-undef app-wide 0, build 0. Held with the batch.

## 2026-10-05 — Morning digest: official store downloads at 8am
- Founder: yes to the daily digest of real App Store / Play download numbers.
- Worker: morningDigest on the existing 15:00 UTC cron — Apple Sales Reports (ES256 JWT,
  gzipped TSV, first-download product types 1/1F/1T/F1; falls back a day if not ready),
  Play installs CSV from the Console's GCS bucket (service-account OAuth, UTF-16 CSV,
  daily user installs), plus stamps-in-24h from D1. Sends via the founder's bell
  ("☀️ Downloads: …"). Each source runs only when its secrets exist; nothing breaks the cron.
- Also: the first-open alert now reads "🎉 New download! First open on iPhone".
- **Activate (founder): docs/STORE_DIGEST_SETUP.md** — Apple: ASC_ISSUER_ID / ASC_KEY_ID /
  ASC_VENDOR_NUMBER / ASC_PRIVATE_KEY; Play: GPLAY_BUCKET / GPLAY_SA_EMAIL / GPLAY_SA_KEY.
- Gates: node --check clean. Ships on push.

## 2026-10-05 — Virtual items LIVE: the founder's renders + parks art + pick analytics
- Founder delivered ~430 photo renders in ~/Downloads and said: upload all, arrange by
  type, make selection easy, track picks, export spreadsheets, rename the luggage share,
  mock a profile.
- R2 (done, live now, no deploy needed): 28 national-park stamps at stamp-art/<slug>.png
  (all of the needed list EXCEPT the 4 Grand Canyon rims — still to draw); 368 virtual-item
  files at stamp-art/gear/* and stamp-art/pets/* (laptops 9 colors open+closed, tumblers 8,
  straw bottles 10 incl. silver+red, lid bottles 4; 86 pet breeds × sitting/standing;
  71 breeds with named real coats, incl. doberman cropped-ears as a coat; wave9's 18
  unnamed files identified off its contact sheet; wave10 was a byte-identical dupe of 9).
- Code (committed 475bb9b/6ca5a7f/ca69c7f/d27544a, NOT pushed): per-breed coat registry
  src/lib/petCoats.js; VirtualItems per-breed picker + render ladder (coat/pose → breed/pose
  → coat/sitting → breed/sitting → chibi); POSES = sitting/standing; SHOW_VIRTUAL_ITEMS=true;
  red+silver in gearShapes AND the worker's GEAR_COLORS_W; gear_select/buddy_add events with
  city+country; worker /admin/gear-report; audit pull includes items (never buddy names);
  Admin "Virtual items" panel with 4 CSV exports; luggage shares titled "My Virtual Luggage".
- Mockup with the real art: https://claude.ai/artifact/JbNVAfKZ2mLwbZurh9FfuX
- Gates: eslint clean, no-undef 0, node --check clean, build 0.
- **Activate: push** (worker deploys), then OTA for phones.

## 2026-10-07 — Search fix 5: famous local institutions + Things to Do popularity order
- Founder: "I want us to be able to deliver answering these questions globally"; graders kept
  naming famous places the app missed (Mary Mac's, Hofbräuhaus, Botín, Pastéis de Belém).
- Data: scripts/institutions/harvest.py → 8,243 food places with a Wikipedia article
  (Wikidata via QLever; English intros used only as match words). Re-runnable; rerun monthly.
- Worker (32789c3): D1 `institutions`; typed food/coffee searches lift matching famous places
  within 15 km when a place was named or the query is specific; each confirmed on Google
  (closed, temporarily closed, not food, or no same-name match within 600 m = never shown;
  KV 30 days). Offline check: 38/40 famous places matched an open Google listing.
- App (dbbad3f, 37e57b9): famous places simply lead the list — NO badge (founder 2026-10-07:
  travelers trust Google more than Wikipedia; every visible field comes from Google); Things to Do
  ranks a big-city or "best/top" search by review-weighted rating (Istanbul → Hagia Sophia,
  Blue Mosque, Dolmabahçe), hidden-gem asks stay nearest-first.
- Eval (6b83fe6, 98a7461, 660bdc3): reviewers see filters/hours/price, 3 votes per case
  (Round 2 fair score 36% good); Things to Do measured as the page really shows it.
- Gates: node --check, eslint, no-undef 0, build 0, boot-check ✅.
- **Activate (founder):** `npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/institutions/data/load_institutions.sql`
  then push (worker deploys) and `npm run ota`.

## 2026-10-12 — Suggest a Place to Stamp: crowd-sourced Local favorites (branch stamping-v2)
- Founder: "Next in the queue is Suggest a Place to Stamp-- let's do this"; approved the 6-screen mockup
  (https://claude.ai/artifact/7Q5HTErHgpe6eV1dgsArQu). Decisions: docs/PLANS.md (2026-10-10 + item (8)).
- Worker: D1 tables ps_places / ps_votes / ps_likes in globeskimmers-events, created on first use (no SQL).
  Routes /places/suggest/check, /places/suggest, /places/suggestions (near · liked · new · mine),
  /places/suggestion, /places/like, /admin/place-suggestions (list · decide · csv), GET /ps-photo/<key>.
  lf:<id> stamps: 150 m GPS circle at the approved pin, entity_type local_favorite, meta.local_favorite.count.
  Purge block 1f (votes, R2 photos, likes). Side fix: the anti-spoof home-country read sends Accept-Profile.
- App: Home section (phone + iPad) with a one-time "Your suggestion is now a stamp" note; Suggest form + thanks;
  Suggested places; Local favorite page; Admin → Place suggestions with Excel; Local favorite stamp in the
  booklet and its card; "See this place" on an lf stamp opens its page.
- Fix (own commit): the passport booklet threw for every kind 'country' stamp — on main since 4285ad7.
- Founder 2026-10-12: the Dream shelf row "Local favorites" is renamed "Customer favorites" (the worker's
  /dream/shelf title), so "Local favorite" only ever means the crowd-sourced stamp. Live with the worker deploy.
- Site: privacy policy + delete-account page cover suggestions (deploy with the merge to main).
- Review (71 agents) fixes: /places/report + ps_reports (3 reports hide a place: status 'held'); admin
  Reported tab with Remove ('removed') / Keep at any count; town derived server-side (psGeoAt, the
  revgeoP_ cache); D1 daily counter ps_rate; lf stamps take the approved row's name/town/pin and start
  private when sensitive; a forged entity_type local_favorite is cleared; purge removes places only that
  person suggested; toasts are announced to screen readers.
- Second review (52 agents) fixes: /ps-photo/ serves only open/approved places (1-day cache) and Remove deletes
  the R2 photos; approve/decline only from 'open' (409 'stale'); public summaries round an open place's pin to 3
  decimals and drop the locals/visitors split (admin keeps both + up to 6 photos); report insert + count in one
  batch; a report on a no-longer-approved lf: stamp is filed (409 'not_listed'); PP_SENSITIVE_NAME gains
  cathedral/basilica/shrine/masjid/gurdwara/mandir/monastery/abbey/pagoda/wat… plus CJK words.
- Third round: the desk's photo links carry a one-hour signature so a held/declined place's photos show there
  (private, no-store); "Add your home city" opens an on-page picker (the draft stays); Tab stays inside the report
  sheet and photo viewers; a vanished place's like says so; StampActions shows the disclosure; CJK brackets break
  cleanly; the share-story disclosure stays one line (~24 px of 1080).
- Final verification (24 agents) fixes: PP_SENSITIVE_NOT back to HEAD's list + PP_LANDMARK_PHRASE (phrase-only
  exceptions); PP_SENSITIVE_INTL (es/fr/de/it/pt) and more CJK/Thai words; psPubPin drives the shown pin, distance,
  the near list's 60 km cut-off, its order and the SQL pre-cut; "Pin the centre" on the pin map; latest home pick wins.
- Gates: node --check, eslint clean, no-undef (only the 5 pre-existing), build 0, boot-check ✅; worker harness
  181/181 + real router; browser harnesses 143/143 (shared), 444/444 (form), 293/293 (lists); stamp layout: all
  3,050 previously-fitting names unchanged, 72 overflows now fit, 0 kinsoku violations in 8,000 fuzzed layouts;
  screens captured with mocked routes.
- **Activate:** after Apple approves — merge stamping-v2 into main (worker + site deploy), check
  /places/suggestions answers 200 with `places`, then `npm run ota`. No SQL to run.

## 2026-10-13 — Website: new-look landing page + the business card's QR pages LIVE (main)
- Founder chose landing version 1 ("Folders") under version 2's passport cover; previews were private artifacts.
- Pushed to main (website only, no worker or migration paths): c702dcb landing page, 93c295a /get + /card
  (cherry-pick of 0e22f4f), f616eaa /get copy ("Free on iPhone, and soon on Android": the Play listing is
  still not public, HTTP 404). Deploy website run 38467081923 succeeded; no worker deploy ran.
- Verified live: globeskimmers.io and www serve the new page; /card → /card/ → /get?src=card → /get/?src=card
  (the query survives the trailing-slash 307); iPhone/iPad open the App Store, Android opens Google Play with
  referrer utm_source=card&utm_medium=print, desktop shows both buttons. app-ads.txt still 200.
- stamping-v2 carries the same three site files (d9aae38, 926a5ff), so the later merge is clean there.
- **Activate:** when Android goes public on Play, change /get's line back to "Free on iPhone and Android" and the
  landing page's "Coming soon on Android" boxes to a Google Play badge. Optional: paste the App Store Connect
  campaign provider token into APPLE_PT in site/get/index.html to count card downloads.

## 2026-10-13 — Go-live: the safety bundle, place suggestions and the admin dashboard (stamping-v2 → main)
- Ships the worker and the website; no migration, wrangler or .github paths. stamping-v2 carries the place
  suggestions and Local favorites (entries above), the buddy's standing pose (f198a12), the read-only admin
  dashboard at globeskimmers.io/admin (e198b65; the founder added its Supabase redirect URL) and golive-fixes
  (merge 8dcc347): age doors on every social door, the under-13 freeze and its clean-up, account deletion that
  finishes and is retried by the daily cron (one 900-operation KV/R2 allowance per run), block_v2 with
  Settings → Blocked travelers, capped alerts and safety records; follow and block lists that don't show which
  @handles are adults', a sealed token instead of an account id in the Blocked list, one 30-a-day allowance
  across every report door; and privacy, Terms and delete-account pages that say exactly what the code does.
  The Terms' drafting note is gone (902a327, the founder's call).
- Tests against the merged tree: the go-live suites 481/481, round 4 19/19 and the final verifier's 12 probes;
  gates: node --check, eslint, NOUNDEF=0, build 0, boot-check ✅.
- Founder checks 2026-10-13: api.user_follows.status is text with no CHECK (muted follows store);
  0 profiles left from deleted accounts and 0 possibly under 13; Supabase's own auth audit log holds 299 rows
  about deleted accounts (privacy names that log; clearing it is optional); Cloudflare is on Workers Paid
  (the cron's few hundred subrequests fit).
- **Activate:** after the push, watch deploy-workers and deploy-site and probe the API, /legal/terms (no
  note) and /admin; then `npm run ota` (iOS and Android; one Capgo bundle). Then build 14 (`npm run cap:all`,
  scripts/ios-launch-check.sh; it must carry 3a73df2's official Sign in with Apple logo). After the first cron
  (15:00 UTC): KV gbidx:done is set and the purge: queue is small. No SQL to run.
- **LIVE 2026-10-13 ~23:05 PT:** main 3f98d23 (f616eaa + stamping-v2 04ee004). Deploy Cloudflare Workers
  run 38520460499 and Deploy website run 38520460438 both succeeded. Probes: /places/suggestions 404 before →
  401 signed out / 200 signed in after; /social/follow op:list (demo account) lists features ['block_v2'];
  /activities 200; /legal/terms has no drafting note; /admin, /, app-ads.txt 200. OTA run by the founder:
  Capgo production channel = 1.0.2610140610 (iOS + Android). Still open: build 14 at the next App Store
  submission (official SIWA artwork, 3a73df2) and the first-cron KV check above.

## 2026-10-14 — Past trips: the photo's date and the place search; albums for the inner circle (stamping-v2, not pushed)
- 2904736 Stamp a place: the date fills in from the photos (the earliest day one was taken; never a future
  one; a date set by hand wins), with "From your photo. Change it if that's not the day you went."
- ad4bd95 Stamp a place: the city search no longer leans toward where you are (from Lisbon, "Paris" listed
  a farm in Portugal first, and picking it set the city to São Teotónio); a spot over 50 km from the city in
  the box brings its own city and country (a past Eiffel Tower trip stamped "Visited Lisboa, Portugal").
- f1741ef Worker /place-search: English names (accept-language=en; new cache key `place2:`, so cached local
  names like "東京都, 日本" aren't served), one row per place (Paris came back three times).
- 6596bf4 Worker: a private passport's photos reach its inner circle. An adult's upload is reviewed public or
  not (a minor's never); a visit by an allowed viewer (/social/world, /passport/public) reviews the owner's
  unchecked photos (up to 40, KV lock `ppsweep:<owner>` for 2 minutes, a 4 s wait); a review that fails
  leaves the photo unchecked instead of blocking it for good; going public uses the same review.
- 9dcbb18 a friend's visit page shows their photo packets ("their memory photos"); 2a1239a a one-month range
  reads "May 18–19".
- Tests: scratch harness test-albums 16/16 (6 fail against the old worker: the inner circle saw no photos);
  world 21, osage 15, boardbook 19 and cards 17 still pass; the place-search handler 6/6 against live
  Nominatim. Gates: node --check, eslint, no-undef, build 0. Screens captured as the demo account with every
  write simulated.
- Cost note: every adult photo upload now gets one Claude Haiku review, and older unchecked photos get one
  on the first friend visit.
- **Activate:** push to main (deploys the worker; no migration, no SQL), probe `/place-search?q=Tokyo` →
  "Tokyo, Japan"; then `npm run ota` (iOS and Android).

## 2026-10-14 — Stamp a place from a photo; original names; stamps from January 1, 2026 (stamping-v2, not pushed)
- d8c5404 worker: POST `/photo-place` {lat, lng} (signed in; KV `photoplace:v1:<lat3>_<lng3>`, 7 days): up to
  3 stamp-worthy D1 places whose reach covers the point (max(400 m, footprint); no secrets), and the city
  with the wider city around a ward, from Nominatim reverse (zoom 18, 10, and 8 only for a ward), Google's
  /reverse-geocode as the fallback. `/place-search` and `/photo-place` return `local`, the name in the
  country's own alphabet (name:ja etc.; Latin-letter names dropped), kept on a visit as meta.local_name.
  A Stamp-a-place visit and /passport/stamp/date refuse dates before 2026-01-01 or after tomorrow (UTC);
  a photo with an EXIF date before 2026 proves nothing.
- 85f60c2 app: the form opens on "Add a photo from the trip"; a located photo offers up to 3 choices and
  dates the stamp, which sits at the photo's point to ~110 m so photo_loc proves it; "Somewhere else?
  Search instead"; both names in results, choices, the stamp and its sheet; date boxes min 2026-01-01;
  "Place names © OpenStreetMap contributors" under the form.
- Tests: test-photoplace 20/20 (recorded Nominatim answers for the Eiffel Tower, Shinjuku and Universal
  Studios); test-albums 16/16; the live place search 8/8 ("Tokyo 東京都", "Sensō-ji 浅草寺"); world, osage,
  boardbook, cards, boards, city and bell suites still pass. Gates: node --check, eslint, no-undef 0,
  build 0. Screens captured as the demo account (writes simulated), including the manual path, whose
  stamp request carried local_name 浅草寺.
- Note: Nominatim asks for at most 1 request a second; each new photo spot costs 2–3 (cached a week).
  Move to a paid geocoder if photo stamping grows.
- **Activate:** with the push above (deploys the worker; no migration, no SQL): probe `/place-search?q=Tokyo`
  → local 東京都, and `/photo-place` signed out → 401; then `npm run ota`.

## 2026-10-14 — OTA went out ahead of the worker; one-photo sensing beat (stamping-v2, worker still not pushed)
- ~19:36 PT the founder ran `npm run ota`: Capgo production = 1.0.2610150236, carrying everything through
  a102beb — the photo-first form, albums on visits, the date limits — while the WORKER IS NOT DEPLOYED.
  Every new screen falls back safely (the founder's Grand Canyon photo: date filled in, /photo-place 404 →
  "We couldn't name where this photo was taken" → search). Photo sensing, second names from search, the
  album review sweep and the server date checks stay dark until the push.
- 3ec29af, from the founder's phone test: the first pick takes ONE photo (the sensing photo; the + for up
  to 4 opens after, never re-looking-up; removing the last photo resets sensing), and sensing is a visible
  beat — "Reading your photo — finding where and when it was taken…", ≥1.3 s, fields and Stamp it held.
- 1f40dc1 (founder: "let the app know … it's taking two or three seconds"): past 4 s the card reads "Still
  looking — a slow connection can take a few extra seconds…"; past 10 s the form stops waiting and offers
  the search ("Your photo still proves the visit"). Verified with a 7 s and a 20 s simulated lookup.
- Stamping… narrates (founder: "how much time do you need max to send the photo?"): "Checking your GPS…",
  "Placing your stamp…", "Sending photo 2 of 3…" under the buttons; verified mid-upload with a 7 s delay.
  (A broken first run was the rig's own demo session expiring, 267k looping auth retries — rig-only.)
  Gates: eslint, no-undef 0, build 0; sensing/choices/old-photo/slow screens recaptured.
- **Activate:** push to main (deploys the worker; no migration, no SQL), probe `/place-search?q=Tokyo` →
  local 東京都 and `/photo-place` signed out → 401; then `npm run ota` AGAIN so phones get the one-photo
  sensing flow.

## 2026-10-14 night — LIVE: the past-trip bundle (main bd391cd)
- Founder said "push": 16 commits 6ae159f → bd391cd, pre-push gates in the main checkout (node --check,
  build, boot-check ✅). Deploy Cloudflare Workers run 38676052642 succeeded (api + tts). No migration.
- Live probes: /place-search?q=Tokyo → "Tokyo 東京都, Japan" (place2 cache); ?q=Paris → France first;
  /photo-place signed out → 401; at Sensō-ji → Asakusa Jinja / Sensō-ji Temple / Hanayashiki + Taito 台東区
  (in Tokyo) + Tokyo 東京都; at the Grand Canyon South Rim → Bright Angel Trail (67 m), Grand Canyon South
  Rim, Coconino County AZ; /passport/list unchanged.
- Phones on 1.0.2610150236 sense photos as of this deploy (that bundle already calls /photo-place).
- **Activate:** the founder's `npm run ota` — ships the one-photo sensing beat, the slow-lookup messages
  and the Stamping… narration (3ec29af, 1f40dc1, 9dd4a71).

## 2026-10-14 night — Website: the landing page sells Android (main d678219, LIVE)
- The founder asked; Play has been public since 10-13 and the landing page still said "Coming soon on
  Android" (the 10-13 Activate row). d678219: hero + closing boxes are "Get it on Google Play" links
  (site-style box, referrer utm_source=site&utm_medium=landing), kicker/meta/og read "Free on iPhone and
  Android", the free promise drops "Android is on the way". /get needed nothing (already both stores).
- Deploy website run 38689510697 ✓. Live probes: zero "Coming soon", 2 play.google.com links, both meta
  descriptions updated, app-ads.txt 200 and untouched, www 200. Nothing left to activate.

## 2026-10-14 night — Sticker reactions: the founder's word art + COOL! (stamping-v2, not pushed)
- The founder uploaded six stickers; they replace the drawn reaction stamps everywhere the Blotter strip
  shows (photos, passport pages, board postcards). c142186 worker: BL_KINDS + 'cool', BL_KIND_LABEL in the
  sticker wording (Mailbox rows read "stamped COOL! · MORE PICS PLEASE! on your photo from …"). 0cb56c2
  app: src/assets/blotter/*.png (168px, transparent, trimmed from the uploads by a scratch script), strip
  shows sticker + count, pressed = cream chip ringed in its ink; YUMMY! keeps its drawn icon (no sticker
  yet — ask the founder when they want one). Multi-press per person and Mailbox notification already
  existed; tests prove them: scratch test-stickers 15/15 (counts per sticker, one per person, peel leaves
  the rest, unknown sticker 400, YUMMY food-only, Mailbox rows + dot); boardbook/albums/world/city suites
  still pass. Gates: node --check, eslint, no-undef 0, build 0. Screens: lightbox strip + Mailbox rows.
- **Activate:** push to main (worker must deploy BEFORE phones get the app, or a COOL! press 400s), probe
  /blotter/mark kind:cool on a test target → 200; then the founder's `npm run ota` (carries the stickers
  AND the earlier one-photo sensing round, which is still waiting on an OTA).

## 2026-10-14 night — YUMMY retired; the folder card's floating strip removed (stamping-v2, not pushed)
- Founder, from their phone: "Remove yummy … can we remove the ones inside red circle" (the reaction strip
  on the visit page's "Where they've been" folder card, anchored to nothing). 04b15dc: PassportFolder drops
  the strip; Blotter drops YUMMY (tray, target logic, drawn icon); worker BL_KINDS drops 'yummy' (new press
  → 400) with its label kept for old Mailbox rows; the dish gate in blotter/mark is gone. Stickers remain
  on photos, open-booklet pages and board postcards. Tests: test-stickers 15/15 (YUMMY refused), boardbook
  19/19 (flipped), albums 16/16. Gates: eslint, no-undef 0, build 0, worker node --check.
- **Activate:** rides the same push + `npm run ota` as the sticker entry above.

## 2026-10-14 night — Albums by year + captions everywhere + a bigger guestbook (stamping-v2, not pushed)
- Founder: captions per photo (upload first, caption later), guestbook "more than just a signature space",
  albums vertical and year-separated for 300–1000+ lifetime prints.
- Captions already existed (upload takes one, /passport/photo/caption edits, viewer shows it in italics);
  what was missing: the Profile's albums had no shared slug, so the footer (and the caption pen) never
  rendered. PhotoFooter now works slugless (caption always for the owner; reactions only with a slug) and
  PhotoPackets shows it for owner || slug.
- derivePackets keys by city|country|YEAR with packetsByYear() sections (newest first, per-year place and
  print counts); the grid is repeat(auto-fill, minmax(176px, 1fr)) scrolling with the page; envelope peeks
  are lazy <img>, not CSS backgrounds. Guestbook composer: textarea rows 3, 600 chars + counter (edit box
  too); worker sign/edit slice 280 → 600.
- Tests: derivePackets/packetsByYear 4/4 (per-year split, newest-first, ranges, counts); test-stickers now
  17/17 (700-char story accepted, kept to 600). Gates: eslint, no-undef 0, build 0, worker node --check.
  Screens: Profile albums 2026/2025 sections, EDIT CAPTION pill on the Profile's own album, the big
  comment box with 214/600.
- **Activate:** rides the same push + `npm run ota` as the sticker entries above.

## 2026-10-15 — LIVE: stickers, COOL!, YUMMY retired, albums by year, captions, the big guestbook (main df56496)
- Founder said "push": 9 commits d678219 → df56496, gates in the main checkout (node --check, build,
  boot-check ✅). Deploy Cloudflare Workers run 38733175591 ✓. No migration, no SQL.
- Live probes (no writes): blotter/mark kind cool on a ghost page → 404 Not found (whitelisted), yummy →
  400 Unknown stamp (retired), fire → 400; passport/list 200.
- **Activate:** the founder's `npm run ota` — ships the WHOLE evening to phones: sticker reactions +
  COOL!, YUMMY gone, the folder card's strip gone, one-photo sensing with the reading beat and slow-lookup
  messages, Stamping… narration, albums by year, captions from the Profile, the 600-character guestbook.
  Until the OTA, current phones still show the drawn icons (all still work; a YUMMY press now gets
  "Unknown stamp").

## 2026-10-15 — The privacy dials: follower approval + albums audience + comments dial (stamping-v2, not pushed)
- Founder approved the recommendations from the follow/privacy consultation. 8eebf67 worker + migration
  20261015090000_privacy_dials.sql (api.social_profiles approve_followers / albums_audience /
  comments_audience, NULL = defaults, checks; auto-applies ~20 s after push; gbSocialProfile reads
  select=* so there is NO deploy/column race): follows to adults wait as requests by default (the teen
  rails' accept/decline/cancel turned on for everyone; muted follows answer and list 'pending' so a block
  or a minor tells nothing); albums 'inner' by default (a public passport shows pages, not photos;
  enforced in /passport/public, /social/world and on ph: targets — no reacting to an unseen photo by id;
  the visit sweep skips viewers who can't see albums); comments 'inner' by default (sign + co-sign gated,
  lift free, boards keep board rules, blotter/read answers can_comment). 7e80847 app: three Settings →
  Privacy rows (EdChoices chips), the guestbook sheet holds its pen with the honest line.
- Tests: test-privacy 28/28 (request/cancel/decline/accept round trip, Mailbox request row, approval off,
  minor answers 'pending', albums dial on both views + the ph: leak, comments dial incl. co-sign and
  can_comment, junk words not stored); all 7 earlier suites still green (123 ok total). Gates: eslint,
  no-undef 0, build 0, worker node --check. Screens: the Settings rows, the held-pen sheet.
- NOTE a product change on push: new follows everywhere become requests until approved, and public
  passports stop showing photos to strangers until the owner sets albums to 'My passport'.
- **Activate:** push to main (worker + migration deploy together, no manual SQL), probe social/profile {}
  → the three dials; then the founder's `npm run ota` for the Settings rows and the held-pen sheet.

## 2026-10-15 — The stamp tiers, built (stamping-v2, not pushed)
- Founder: "Build it" (with my defaults: new stamps at Inner circle, chrono = oldest first, bulk mover
  yes; circle decided A default / adult switch to D / full-privacy members never named; 🔒 unshareable
  without a permission change). 03b0771 worker + migration 20261015120000 (visibility + pos on stamps
  with a today's-meaning backfill; default_stamp_tier / circle_public / booklet_order / shuffle_seed /
  custom_order on social_profiles; api.share_links). f5c2c38 the founder's vintage sticker set replaces
  the chibi faces (same six reactions). App commit: four chips on the stamp sheet, corner marks in the
  owner's booklet, the ask-first share sheet + Links I've shared, the mixed-page picture chooser (public
  only by default, 🔒 never), order row + Arrange drag sheet, Settings rows (default tier, bulk, circle
  switch with the founder-worded confirm), the visit page honors the owner's order.
- Tests: test-tiers 31/31 (slices per level on both views, follower access to private booklets, link
  mint/revoke/expiry/list, tier writes + legacy hidden sync, blotter tier gates incl. owner-less 🔒,
  circle A/D with member privacy, order prefs, one-write arrangement); all sibling suites green (~203
  checks); sortStamps 5/5. Gates: worker node --check, eslint, no-undef 0, build 0.
- Behavior notes on push: followers (approved) begin seeing followers-tier pages of private booklets;
  the known-faces circle row retires (counts only); new stamps default to Inner circle.
- **Activate:** push to main (worker + migration together; the backfill UPDATE runs in the migration);
  probe a slug at each level + /passport/share-link mint/revoke; then the founder's `npm run ota` — which
  ALSO still carries everything since 1.0.2610150236 (one-photo sensing, stickers now vintage, albums by
  year, captions, guestbook 600, privacy dials).

## 2026-10-15 — LIVE: the privacy dials + the stamp tiers + the vintage stickers (main 5b89ca6)
- Founder said "push": 10 commits c7e4c6c → 5b89ca6, gates in the main checkout (node --check, build,
  boot-check ✅). Apply Supabase Migrations run 38783483936 ✓ (20261015090000 privacy dials +
  20261015120000 stamp tiers with the backfill UPDATE); Deploy Cloudflare Workers run 38783483926 ✓.
- Live probes (demo account only): social/profile carries every dial at its default (approval ON, albums
  inner, comments inner, new stamps inner, circle private, order newest); passport/list stamps backfilled
  (visibility 'inner' on the private demo booklet) with booklet prefs; a share link minted (24 h expiry),
  resolved signed-out, revoked, dead, and gone from Links I've shared; blotter kinds unchanged.
- Live behavior changes from this push: new follows are requests; public passports show pages, not
  photos, to strangers; followers see followers-tier pages of private booklets; the circle is counts-only;
  comments are inner-circle by default; new stamps start at Inner circle.
- **Activate:** the founder's `npm run ota` — ships EVERYTHING since 1.0.2610150236: one-photo sensing +
  slow-lookup messages + Stamping… narration, the vintage sticker reactions + COOL! (YUMMY gone), albums
  by year + captions + the 600-character guestbook, the three privacy-dial Settings rows + held-pen sheet,
  and the full tier UI (chips, corner marks, ask-first links, picture chooser, order row, Arrange).

## 2026-10-15 — OTA SHIPPED: 1.0.2610151816 (iOS + Android)
- The founder was remote and asked Claude to run it; `npm run ota` ran clean (build → cap sync both →
  Capgo upload, CI=true, pinned CLI 8.68.1). Channel list confirms production = 1.0.2610151816, iOS and
  Android. Phones take it on next launch.
- This bundle carries everything since 1.0.2610150236: one-photo sensing + the reading beat + slow-lookup
  messages + Stamping… narration; the vintage sticker reactions + COOL! (YUMMY retired, folder strip
  gone); albums by year + captions everywhere + the 600-character guestbook; the privacy-dial Settings
  rows + the held-pen sheet; and the full tier UI (four chips, corner marks, ask-first links with Turn
  off, the picture chooser, order row, Arrange). Nothing left to activate.

## 2026-10-15 — Postcard privacy: the seal lines, the pin ask, a local / a traveler (PUSHED + LIVE)
- main 15a3cc9 (seal lines: Mailbox "Sealed — only you…", Home circle "and only you see it") and
  3380f43 (worker + app: the pin ask after direct sends, meta.anon board cards signed "a local" /
  "a traveler" decided by pcAnonLabel, identity stripped on board reads, anon kept out of feeds,
  Signed / No name chips on board compose). Deploy 38841625288 green (api + tts).
- Probes (demo JWT, browser UA): /city/board 200 well-formed (boards empty in prod — the supply
  problem itself), /social/feed 200 no leaks, /postcards/send runs the edited path (409 no_followers
  on the earliest gate). Harness: test-pins 16/16; cards/boards/boardbook/city unchanged.
- Gates: eslint ✓ no-undef ✓ build ✓ boot-check ✓. **Activate: nothing** — no migration, no SQL.
  The app side (ask sheet, chips, FROM A LOCAL bylines) reaches phones at the founder's `npm run ota`.

## 2026-10-16 — City Billboards, same-name cities, privacy switches (PUSHED)
- Commits 4fce642 → this entry (founder: "push"). What ships:
  - **City-board wording:** "city board" everywhere; signed cards show @username only; @local / @traveler.
  - **Five years back:** stamps from 2021-01-01 (photo proof unchanged).
  - **City Billboards:** painted header (kit) or typographic plate; wall = billboard + pins; photos of
    🌍 public stamps hang on their city / state / country boards with a heads-up (no ask); albums
    default flips to "same as each stamp"; Take it down / Put it back per photo; the enlarged viewer
    (swipe photo ↔ postcard, stickers with counts, public comments, `bph:` targets).
  - **Same-name US cities:** board key = city + state ("portland, oregon|united states"); stateless
    US stamps learn their state from coordinates; links without a state open the busiest board and
    offer the others.
  - **Privacy switches:** ON = private everywhere (home city, circle, Profile passport card);
    OFF says "Not private"; album choices "Same as each stamp / Inner circle only / Only me".
- Migration **20261016150000_city_billboards** auto-applies (board_hidden, postcards.region,
  board_notices). Deploy-race guards: album reads and card sends retry without the new columns.
- Tests: 14 harness suites green (test-billboard 33, test-states 12 new). Gates: worker syntax,
  source lint clean (one error is in the gitignored android/app/build artifact), build, boot-check.
- **Activate:** nothing manual. Phones get the app side with the founder's `npm run ota`.
  Art kits: upload to R2 under `kits/<kind>/<slug>/` (docs/design/city-board-kits.md) when painted.

## 2026-10-16 (later) — board guestbooks, minors on boards, Seal letters, the LA fix (PUSHED)
- Commits c8235dd → 60ca190 (founder: "push"). No migration. What ships:
  - **"Los Angeles, CA" joins Los Angeles, California** — a state inside a US city name becomes its state.
  - **A guestbook on every board** (city, state, country) — the place guestbook under
    `board:<kind>.<slug>`; **anyone 18+ writes, comments and doodles, no stamp needed**; @username,
    else @local / @traveler; prompts Tip / Best spot / Best food / Best nature / Favorite part; the door
    is in the billboard header. Every doodle in the app opens in place, with "Enlarge all".
  - **Minors**: read every board, guestbook and comment, add sticker likes; never comment, write, post,
    send or receive postcards; their photos never hang on boards; albums private; stamps capped at
    Only me / Inner circle. Explicit rules — they hold even if TEEN_SOCIAL_ENABLED ever flips.
  - **Seal letters**: Sunshine (Friends & Family) letter and a business welcome (burgundy → Business),
    founder-approved wording; gold, burgundy-person and teal unchanged.
- Tests: 17 harness suites, 320 checks green (new: test-boardgb 17, test-minors 17, test-seal-letters 9).
  Gates: worker syntax, source lint clean, build, boot-check.
- **Activate:** nothing manual. Phones get the app side with the founder's `npm run ota`.

## 2026-10-16 (evening) — sign-up codes reach the public; two admins; held-name Seals (PUSHED)
- **Supabase sign-up emails now go through Resend (founder, in the dashboards).** Until today Auth used
  Supabase's built-in mailer, which delivers only to the project's own team, 2 an hour, so a member of the
  public who signed up with email never got the 6-digit code (Apple / Google / Facebook were unaffected).
  Custom SMTP: smtp.resend.com:465, user `resend`, a sending-only key "Supabase sign-up codes" from the Resend
  team **globeskimmers** (sign in to Resend as founder@globeskimmers.io; the maizasimeon@gmail.com login is
  an empty team), sender GlobeSkimmers <founder@globeskimmers.io>. Email rate limit 30 → 100 an hour.
  Live check: POST /auth/v1/signup for maizasimeon+gs-test-1016@gmail.com → 200, confirmation_sent_at
  01:36:11Z, no session (code required). That unconfirmed test user can be deleted in Supabase → Users.
- Commits (founder: "push"; 21 harness suites, 350 checks green): 327c511 (Release asks first) · 935dab0 (hold a @handle with its Seal; migration
  20261016200000_held_handle_seals) · e7d2dc8 (Gold: no "and Respect") · 08f9228 (Burgundy person:
  "verified, given to a select few") · c38c042 (handle and Seal letters sign off "Maiza & GlobeSkimmers ✈️ /
  Collect your world.") · 37574c1 (admins = maizasimeon@gmail.com + founder@globeskimmers.io; migration
  20261016230000_two_admins narrows the refresh_access rules).
- Open: keep or remove the sign-up code (founder deciding; removing it first needs the admin and held-name
  email paths closed, and still leaves Supabase joining a later Google sign-in to an account someone made
  with that email); the letters' From address (hello@ is not a mailbox; support@ in the Terms may bounce).
- **Activate:** push → workers and both migrations apply on their own. The app side (Release confirm, Seal
  picker on held names, the admin list) reaches phones with `npm run ota`.
- **Done:** main a8f8f8d — Deploy Cloudflare Workers 38991754102 ✓ (api + tts), Apply Supabase Migrations
  38991754104 ✓ (both). Probes: held-for-me 401, Seal desk 401, /h/ landing 200, held_handles.seal and seal_kind
  exist. OTA **1.0.2610170142** by the founder (`capgo channel list` ✓) — phones now also get the 5-year date
  picker, billboards, board guestbooks and the privacy switches.

## 2026-10-16 (night) — everyone has an @username; one apology for taken names; Home without the circle zone (PUSHED)
- Commits 82f8809 → 7e945d8 (founder: "push"). No migration. What ships:
  - **Worker:** every name someone can't have — another member's, one the founder holds, a reserved word —
    answers "Sorry, @x is taken — please choose another username you like[, or pick one of these]" with 409,
    so a held name is never told apart ("do not let user know that admin saved handle"; "let's not inform
    people that it is reserved").
  - **Sign-up:** a required "Pick your @username" step right after the first name, birthday on the same
    screen (the worker needs the age gate first); under 18 → "Usernames open at 18" and on; a held name comes
    filled in ("@x is ready for you"). `onboarding/UsernameStep` + shared `social/useUsernameClaim`,
    `social/UsernameFields`.
  - **Current members without a username:** a Home sheet that stays until they save one (no Not now, no
    close), above the nav; never for under-18s, a frozen account, or a failed check (`social/UsernameNudge`).
  - **Boards rows** (Home, Mailbox): "Postcards and photos from cities & countries"; counts hidden until 50
    boards / 25 posts in your city.
  - **Home** drops the "Your circle" zone; the circle's activity lives in the Mailbox.
- Tests: 21 harness suites, 354 checks green (test-held-seals 14: held, reserved and owned names read alike).
  Gates: eslint + no-undef on every touched file, build, boot-check. Screens captured as the review account.
- **Activate:** push (worker deploys itself). The app side reaches phones with the founder's `npm run ota`.

## 2026-10-16 (late) — COOL! sticker, doodle pad vs swipe, Find a member (PUSHED)
- **DB:** migration 20261017010000_blotter_marks_cool — the check on blotter_marks.kind gains 'cool'
  (COOL! joined the app + worker 10-14 but never the database → every COOL! press answered
  "Could not press"). test-stickers now reads the migrations and fails if the last check misses a kind.
- **App:** the doodle pad and the comments sheet stop touch propagation; the board viewer ignores a touch
  that starts on a canvas or a text field (a doodle stroke used to swipe to the next photo and unmount
  the pad mid-drawing).
- **Admin:** Find a member — /admin/members { q }: exact sign-in email, else part of a first name,
  display name or @username; Find box on globeskimmers.io/admin (ships with the site deploy, no OTA)
  and in the app's Admin Portal (needs OTA). Rows still carry no email.
- Tests: 22 harness suites, 363 checks green (new: test-members 8). Gates: eslint + no-undef on the
  three app files, acorn parse of admin.js, build, boot-check.
- **Activate:** push → worker, site and the migration deploy on their own. The app side (doodle fix,
  Admin Portal search) reaches phones with the founder's `npm run ota`.
- **Done:** main f15d017 — workers 38996254297 ✓, site 38996254292 ✓, migration 38996254283 ✓ (the live
  COOL! press answered ok). OTA **1.0.2610170249** by the founder (`capgo channel list` ✓): phones get the
  doodle fix, the Admin Portal's Find box, and everything from ce4c9a4 (required @username at sign-up,
  the Home username sheet, the boards wording, Home without the circle zone).

## 2026-10-17 — Globeskimmers in the phone's share list + Upload photos sorted by place and day + Home/Passport wording (NOT COMMITTED)
- **Why:** founder 10-17: "upload photos from gallery … could not find the app on the list of apps". The app
  never told either OS it takes photos: no iOS Share Extension, no Android SEND intent filter. The in-app
  photo buttons were fine; the Photos/Gallery → Share list had no Globeskimmers.
- **Plugin:** `@capgo/capacitor-share-target` 8.0.62 (Capacitor 8, same vendor as the updater); added to
  `android.includePlugins` and `plugins.CapacitorShareTarget.appGroupId = group.com.globeskimmers.app`.
- **iOS:** new target `ShareExtension` (ios/App/ShareExtension, bundle com.globeskimmers.app.ShareExtension,
  embedded in App via "Embed Foundation Extensions"). Up to 10 images; each becomes a ≤2560 px upright JPEG in
  the app group that KEEPS the photo's EXIF GPS + capture time (a raw iPhone HEIC reads as no proof — JPEG only),
  then opens globeskimmers://share. If iOS won't let it open the app it says "Your photos are ready. Open
  Globeskimmers to stamp them." — the plugin also checks every time the app comes forward. App group on both
  targets' entitlements.
- **Android:** SEND + SEND_MULTIPLE image/* filters on MainActivity. Capacitor's BridgeActivity already hands
  the launch intent to plugins, so a share into a closed app arrives too.
- **App:** src/lib/sharedPhotos.js (listener in AuthContext; routes to /Passport once signed in). Old store
  builds: the listener fails quietly.
- **Upload photos + the photo sorter** (founder 10-17: "people get so confused"; photos taken on different
  dates in different places). Passport: a red **📷 Upload photos** button (gallery, several at once) beside a
  white **📍 Stamp where I am** (was ✍️ Stamp a place; founder 10-17 — it's the on-the-spot GPS stamp; the form it opens keeps the title Stamp a place); final wording and layout below
  Upload photos and shared photos both open `components/passport/PhotoSorter.jsx`:
  - a share asks first: **Get a stamp** ("Where this photo was taken.") or, for several, **Get stamps**
    ("Where each photo was taken, one place at a time.") / **Send as a postcard** (several photos → "Pick the photo for
    your postcard"; PostcardCompose opens with it, addressed to your circle);
  - photos group by their own location + capture day: within 300 m and 2 days of the group's first photo
    (the worker's photo proof is 400 m / 2 days, and the stamp sits at the first photo rounded to a block),
    so every group proves its own stamp. Same place 3+ days later = its own visit (visit ids carry the date);
  - a group at a stamp you already have (400 m, 2 days, album under 30) → "Add N photos to your stamp";
    no location → one row per day ("you'll search for the place"); before 2021-01-01 → greyed, not stamped;
  - "These photos are from N places — We stamp one place at a time" with ticks; Continue adds to existing
    stamps, then Stamp a place opens per new place with "Place 1 of 3 · Skip", already filled from the
    sorter's lookup (no second /photo-place call). A place with more than 4 photos: first 4 in the form
    (the print), the rest go to the stamp's album. One place and nothing else → straight to Stamp a place.
  - **Empty passport = two choices only** (founder 10-17: "Stamp Los Angeles" — what in Los Angeles? — and
    "famous places" is a claim): the card keeps "Your passport is ready" + "Stamps are earned by being there:
    stamp the place you're at right now, or upload a photo from a trip."; "🏠 Stamp <home city>" / "Set your
    home city" and "📍 Stamps near me" are gone, and so is mintHomeCity (the fallback for members whose
    onboarding page-one mint never happened — onboarding itself still mints it). Under the card, stacked:
    **📷 Upload photo to get a stamp** ("One photo or many. We find where each was taken.") and
    **📍 Stamp where I am** ("At a place right now? Your phone's location proves it."). Same two on a passport
    with stamps.
  - **Home:** Nearby services (Eat / Coffee / Things to do) moved directly under the search bar, above the
    passport hero (founder 10-17). **City Board row** reworded (founder: "i want 'City board' to be there"):
    "<City> City Board" · "Explore photo posts from travelers who were really there" (25+: "N photo posts
    from…"), link "See all City Boards"; with no board here, "Explore City Boards" · "Photo posts from
    travelers who were really there". **Passport card on Home** (founder: "shrink the size … make 'my virtual
    passport' brighter and make it pop"): padding 22/18/18 → 14/16/13, headline 28 → 22 px, tile 64 → 50 px,
    Home only, through new HomeZone props boxPadding + tabStyle (Folder gains tabStyle); Profile's passport
    folder is unchanged. **Every Home tab is gold** (founder: "for consistency let's make all tab with same
    background color as my virtual passport"; "only for tabs"): HOME_TAB in Zone.jsx — gradient #F7D37C →
    #E3AE45, bold navy mono caps, gold edge — on Nearby services, Stamps near you, Stamp shelf, Local favorites
    (and Your circle / Around you where they show); the boxes keep their own colours. The passport tab keeps the
    gold with its name in Instrument Serif italic, 17 px, navy, light emboss ("attractive to look at and pop").
    **Stamps near you** drops "famous" (founder: "famous place is a claim"): "Places to stamp around you. Be at
    one and its stamp is yours for life, dated and verified."; empty state "No places to stamp around here yet".
    All captured as the demo account (passport list mocked empty).
  - `STAMP_EARLIEST` + `photoOptions` moved to src/lib/passport.js; the too-old note said "January 1, 2026"
    while stamps reach back to 2021 — it now reads the real first day.
- Verified: eslint + no-undef (touched files), build, boot-check; `npx cap sync`; iOS Debug simulator build ✓
  (pluginkit lists com.globeskimmers.app.ShareExtension(1.0.4)); HEIC 4032×3024 orientation 6 + GPS → JPEG
  1920×2560 orientation 1, readPhotoExif → 48.8584, 2.2945, 2026-10-12T14:03:22; cold start with a staged share
  → the app's listener produced the photo, app-group data consumed; Android assembleDebug ✓, merged manifest
  has both filters. NOT verified: tapping Share → Globeskimmers on a real phone (simulator headless, no Android
  emulator image), the extension opening the app, the Stamp a place screen with shared photos (sign-in gate).
  Sorter: grouping run on 8 real JPEGs with EXIF (esbuild + stubs) → Eiffel Oct 12–13 (3), Sagrada Oct 15,
  Eiffel Oct 16 (own visit), Louvre → add to the existing stamp, no-location Oct 13, 2019 greyed. Screens
  captured in headless Chrome with a fake /photo-place (share choice, list, postcard pick; Continue → the
  add, then four Stamp a place steps in order with their hints). The Passport button and the queued
  Stamp a place header were not captured (sign-in gate).
- **Versions:** the extension has its own MARKETING_VERSION / CURRENT_PROJECT_VERSION (now 1.0.4 / 14). Bump
  all FOUR build configs together (App + ShareExtension, Debug + Release) or App Store Connect flags the mismatch.
- **Activate (founder):** native builds only — an OTA cannot add an extension or intent filters.
  (1) Xcode → App target and ShareExtension target → Signing & Capabilities: confirm the App Groups capability
  shows group.com.globeskimmers.app on both (automatic signing registers the group and the extension's App ID
  on first archive; click "+" / the refresh if it reports a missing group). (2) bump versions (all four
  configs), `npm run cap:all`, archive → TestFlight; Android Studio → aab → Play. (3) On the phone: Photos →
  a photo → Share → Globeskimmers (first time: "More" / Edit Actions may be needed to show it in the row) →
  Stamp the places → Stamp a place opens with the photo, place and date filled. (4) The sorter and the Upload
  photos button are JS: they also reach phones with `npm run ota`, but sharing INTO the app needs (2).
- **City Board wall:** the @username chip is gone from every photo tile (founder 10-17: "remove @handle from
  this feed page … from each photo") and the tile names WHERE the photo was taken instead ("put the text of
  attraction name instead … or the city"): the stamp's name (row.place, e.g. "Universal Studios Hollywood"), or
  the city when the stamp is city-wide; white 8.5 px type with a soft shadow on a light see-through chip
  (founder: "lighter background … so the photo can be seen … a tad smaller text"), two lines at most. No worker change (rows
  already carry place + city). The poster still shows when a photo is opened, and the tile's screen-reader
  label still names them. Captured on the Los Angeles board as the demo account.
- **Open (founder's call):** the demo account appreview@ has no @username, so since 10-16 App Review lands on
  Home's un-dismissable "Pick your @username" sheet. Set one (e.g. @appreview) before the next submission.
- **Photo packets two across** (founder 10-17: "a waste of space" — one envelope per row): the envelopes
  were a fixed 176 px, and inside the Passport's own padding only one fit a row (338 px wide). They now size
  to the column (grid minmax 140 px, max 190 px each; flap drawn with clip-path so it scales; label 14 px,
  the privacy mark in the top corner) — two across on a phone, more on an iPad; Profile and visit pages too.
  Captured as the demo account with a mocked passport list.
  Copy shortened (founder: "sure"): above, "Each album is as private as its stamp. 🌍 prints also hang on the
  city board." (the board disclosure stays); below, "Tap + to add prints."
- **Done:** main ae418b6 — no workflow runs (nothing deployable). OTA **1.0.2610180210** by the founder
  (`capgo channel list` ✓, production, iOS + Android): phones get Upload photos + the photo sorter, the
  two-choice empty passport, the Home changes, City Board place labels and the photo packets two across.
  Sharing INTO the app still waits for the next store builds (both platforms).
- **Home, later 10-17** (founder): "See all City Boards" is now a gold tab on the City Board row's upper left
  (Zone's HOME_TAB, exported; the right-aligned link under the row is gone); "Hello" 10.5 → 13.5 px and the
  first name 24 → 32 px (line 36 px, flag 19 px). The tab's link reaches 15 px above it, invisibly, for a
  44 px tap target (the gap above shrinks by the same, so nothing moves). Captured as the demo account.

## 2026-10-18 — Held names: the desk shows every name, and Send invitation saves and sends in one tap (PUSHED 17ef717, worker run 39164883897 ✓)
- **Why:** founder 10-18: typed a friend's email on a held name (@royals, Brand reserve), tapped Save, and the
  whole row — email, Save, Seal picker, Send invitation — vanished; no email went out.
- **Cause 1 (the vanishing row):** `/admin/held-handles` read the list in ONE PostgREST call; PostgREST caps a read
  at 1,000 rows and ~1,400 names are held (637 + 754 seeded on 10-03, each batch sharing one created_at), so the
  desk always showed 1,000 (454 + 546) and WHICH 1,000 changed from read to read. After Save the reload dropped
  @royals, so its open controls had no row. The email itself was saved. **Fix (worker):** read page by page,
  `order=created_at.asc,handle.asc`, until an empty page; a failed read now answers 502 with no rows, and the
  desk keeps its last list and shows the error (it used to come back as an empty list).
- **Cause 2 (no email):** Save only saved; only Send invitation emails. **Fix (app, AdminAnalytics):** Send
  invitation saves what's typed (email, name) first, then sends, after a confirm that names the address and the
  Seal ("…It comes with the Sunshine ★ — Friends & Family Seal, switched on when they claim the name."). Save is
  now "Save for later" and says "Saved — not sent yet". Each row shows the result ("✉️ Invitation sent to …", or
  the reason it didn't go); Invited rows show the address. A how-to line heads both sections.
- **Seals:** unchanged and already right — the Seal picked on a held row writes the invitation as that Seal's
  letter (gbHeldSealLetter), and claiming the name switches the Seal on. For someone who already has a username,
  "✪ The GlobeSkimmers Seal" desk grants it and sends the Seal letter.
- Verified: node --check, eslint + no-undef, build, boot-check. The desk driven in headless Chrome (demo session
  relabelled admin for the UI only; every admin route mocked): pick Seal → type email → Send invitation → calls
  update[seal] → update(email) → invite → list; the row reads "Invited 2026-10-18 · friend@example.com".
  Not verified live: the paged read against the real ~1,400 rows (admin-only route).
- **Username & Seal requests: Approve finishes it** (founder: "after I [pick] the handle and approve it we're
  done"). "Done" used to only close the request — no name, no Seal, no email. Now each request has a Seal choice
  and **Approve & send**: a Seal request → admin/verified grant to the member's @username (the letter goes to
  their sign-in email; teal and recolors send none); a username request → admin/held-handles add (or update when
  already held — approving gives it to this requester) + invite, the claim link to the request's email (the
  sign-in email), with the Seal riding along if picked. Then the request closes; the outcome stays at the top of
  the desk ("✪ @x has the … Seal — letter sent to …" / "✉️ @x is held for them — claim link sent to …").
  Worker: the request list now carries member_handle / member_seal. Dismiss stays.
  Driven in headless Chrome with mocks: grant @jahmai burgundy:person > resolve > hold-add @royals (409) >
  hold-update > invite > resolve; both outcomes shown.
- **Where:** all of this is in the app only (Settings → Admin Portal). The website admin (globeskimmers.io/admin)
  is read-only by design and has no held-name, Seal or request desks.
- **Activate:** push → the worker deploys itself; the app side reaches phones with `npm run ota`. Then the desk
  should read about 1,400 names and @royals should show the email you saved.

## 2026-10-18 (later) — Everyone finishes their passport: a full birthday, and a @username at 18+ (PUSHED)
- **Founder 10-18:** "allow users to change their handle five times per month as long as the one they are
  requesting is available"; "I want all users to have a full birthday disclosed … everybody who has access
  before has to choose a handle and also enter their birthdate … a hard lock … but let's be nice about it."
- **Username changes: 5 per rolling 30 days** (was 2), worker /social/handle; taken / held / reserved names are
  still refused; Settings copy "up to 5 times a month".
- **The birthday was already full for new sign-ups** (social_profiles.birth_year + birth_md); Settings showed
  only month and day by design. It now shows the locked year beside them. Most early members have month and
  day only (no year) — they are the main case below.
- **FinishPassport (src/components/auth/FinishPassport.jsx)**, over every route in place of ConfirmBirthday:
  until the account has birth_year AND birth_md and, unless teen/blocked, a @username, it covers the app.
  Step 1 the birthday — ConfirmSheet in a new `required` mode (no Not now, no closing, "Welcome back, <name>!"
  copy, "Step 1 of 2", Sign out): no year but month/day on file → asks the YEAR only ("We have your birthday as
  August 30 — add the year you were born"), keeps the month/day, then the neutral check "Is your birthday August
  30, 1990?"; nothing on file → the full date; year only → month and day. Step 2 the @username (full screen,
  the sign-up fields; a held name comes filled in). Under 18: birthday only (usernames open at 18); under 13:
  the frozen screen. A failed read never locks anyone (asked again next open); members still in onboarding
  aren't asked twice. With nothing missing it renders ConfirmBirthday for its old re-ask job.
  ConfirmSheet bug fixed on the way: it treated "month and day on file" as nothing to ask even with no year.
- **Home's UsernameNudge removed** (superseded; left open under the new screen it would have asked again).
- Verified: eslint + no-undef, build, boot-check; captured as the demo account — real reads (birthday on file, no
  username → the username step), mocked: nothing on file (Step 1 of 2, full date), year only (month and day),
  month/day only + no username driven end to end (writes mocked: age 1990-08-30 > handle margaret_t → Home).
- **Demo account:** appreview@ now has **@appreview** (founder's OK, set 10-18 through /social/handle as the demo
  session: before `handle:null`, after `"handle":"appreview"`), so App Review goes straight into the app.
- **Activate:** push → the worker (5 changes) deploys itself; the screen reaches phones with `npm run ota`.

## 2026-10-18 (evening) — The Empire State Building stamps from inside only (PUSHED)
- **Founder:** "for empire state building in new york specifically, only allow stamp if users are inside the
  building, not outside … they could be at the top"; "we only do inside of premises permission for empire
  state building only".
- **Worker:** PP_SHAPES gains a building outline — OpenStreetMap way 34633854 (350 Fifth Ave, ~129 × 60 m) —
  with `inside_only`, buffer 0, matched by icon:Q9188 and its aliases, or by name (/empire\s+state\s+building/i)
  within 400 m (Google listings, Stamp-a-place visits, older rows). `ppMetersToShape` returns 0 inside an outline
  (ray casting), else the distance to the nearest wall.
  - GPS stamp: inside the outline, no GPS slack; refusal "The Empire State Building is stamped from inside — the
    lobby or the observatory. Your GPS shows you outside the building." (`inside_only: true`).
  - "I'm here, but the app is saying I'm not" no longer grants it from outside (or with no reading).
  - Photo proof: the photo's location tag must fall inside the outline (not within 400 m), and recognition
    (photo_ai) is skipped — a facade photo is taken from outside.
  - A Stamp-a-place visit named after it: the phone's own GPS check is not trusted (the worker can't see it), so
    it needs a photo taken inside.
- **App:** the attraction page and the nearby prompt show the worker's inside message and hide the report button
  for inside-only refusals.
- Verified: node --check; geometry run on real points — the pin and near the 34th St wall INSIDE; Fifth Ave
  sidewalk 18 m, across 34th 23 m, across 33rd 30 m, Herald Square 163 m outside; photo inside → proves, from the
  sidewalk → doesn't; other places keep the 400 m rule; "Empire State Diner" nearby and Albany unaffected.
  eslint + no-undef, build, boot-check. Not verified on a phone inside the building (indoor GPS can drift outside
  the walls — such a visitor gets the inside message and can retry from the observatory or near a window).
- **@erikakristaa's stamp:** the founder first asked to remove it (photo not taken inside), then decided to leave
  it alone (10-18) — nothing was deleted; don't run the removal SQL. The rule applies to new stamps from now on.
  (No admin tool deletes another member's stamp; removal would be SQL in Supabase plus an R2 delete per photo.)
- **Activate:** push → the worker deploys itself; the app's message reaches phones with `npm run ota`.
- Height isn't checked (latitude/longitude only): the 86th-floor deck and the 102nd-floor observatory sit over the
  outline, so the top floors stamp like the lobby (founder asked, 10-18).

## 2026-10-18 (late) — Privacy, solid on every surface (PUSHED)
- **Founder:** "can we solidify our privacy please in all aspects, settings and passport stamps and albums" (after
  @erikakristaa's photos hung on the LA City Board). Decisions: a private passport takes your photos off City
  Boards ("my answer is yes"); members made 🌍 Everyone by the 10-15 backfill get a one-time, kindly worded
  check-up, never a silent change ("ok i agree").
- **Why Erika's photos were on the board:** the 2026-10-15 tiers migration set every stamp of a public passport to
  🌍 Everyone; Settings → "New stamps start at" only ever touched new stamps.
- **One rule, every surface:** a stamp's tier (accepted follows only) → its photos follow it, narrowed by the albums
  dial → a City Board shows only 🌍 Everyone photos of an adult with open albums AND a public passport, not taken down.
- **Worker:**
  - **Signed photo links.** Every stamp photo handed to someone else is `/pp-photo/p/<id>?l=&e=&s=` — HMAC for the
    level it was shown at ('0' stranger, '1' follower, '2' inner circle, 'b' board), expiring 6 h past the hour.
    Opening it re-checks the photo is still visible at that level (tier, albums dial, private switch, under-18 or
    held owner, review status, board takedown). Unsigned or expired → 404. Owners keep their own key links.
  - **Boards:** `pcBoardOwners` (adult + albums open + passport public) gates the wall, the covers, board guestbook
    shares, the board read and the "your photos hang on a board" notice. Covers skip blocked owners (were cached
    5 min with the first owner's photo for everyone); cache key `photoboards:v2`, 2 min, busted on every privacy change.
  - **Share links:** a public-level link from a private passport shows nothing (app and web /p/); an inner-circle
    link the owner sent still works; an empty slice reads private (no name over an empty book).
  - **Traveler page:** a muted follow no longer counts as an accepted one.
  - **Mailbox feed:** honours each stamp's tier (it showed every stamp of everyone you follow).
  - **Guestbook read:** photo ids pass only when the albums dial allows the viewer.
  - **Profile read `{ privacy: true }`** adds `{ is_public, counts: { me, inner, followers, public } }`;
    `privacy_checked` read/write (`social_profiles.privacy_checkup_at`).
- **Migration:** `20261018230000_privacy_checkup.sql` — adds `privacy_checkup_at timestamptz` (applies itself on push).
- **App:**
  - **Privacy check-up** (`src/components/auth/PrivacyCheckup.jsx`, mounted after FinishPassport's required steps):
    only for an adult with a public passport and ≥1 🌍 Everyone stamp who hasn't answered. "Keep it public"
    (nothing changes) or "Switch to Inner circle" (passport private first, then every stamp → Inner circle, new
    stamps start there). Equal-weight buttons; "Decide later" asks again next open.
  - **Settings → Privacy:** new "Keep my passport private" switch (ON = private, confirms before going public);
    "Set all my stamps" shows the real counts ("Right now: 12 🌍 Everyone · 3 🤝 Inner circle · 1 🔒 Only me");
    changing "New stamps start at" asks "Also move your N existing stamps there?"; the albums line names City Boards;
    the airport row no longer says "only you can see it".
  - **Passport:** the badge says who can really see it ("🔒 Private — only your circle sees the stamps you share
    with them" / "🌍 Public — anyone can see your N 🌍 Everyone stamps"); the share panel and first-visit tip match.
- Verified: node --check; a harness over the real worker functions — every tier × public/private passport × albums
  dial × takedown × unreviewed × teen owner opens exactly where it should; tampered/expired/other-level signatures
  fail; `pcBoardOwners` drops private passports; the count summary pages past 1,000 stamps. eslint + no-undef,
  build, boot-check. Captured as the demo account (profile/share replies mocked): the check-up sheet, Settings
  privacy rows, the "move existing stamps" ask, the Passport badge.
- **Not verified live:** the signed links on a phone (old app bundles keep working — the worker builds every link).
  Photo links already sitting in a phone's cache keep showing for up to 10 min.
- **Activate:** push → the worker deploys itself and the migration applies itself (~20 s); the app changes reach
  phones with `npm run ota`.

## 2026-10-18 (night) — Find people: by @username, name or email (PUSHED)
- **Founder:** "allow users in app to find other users … can they find via handle, name and email address?" → "yes
  name and email and handle, but name and email both findable by default for adults". Until now members could
  only follow an exact @handle; the name/@/email search lived in Admin alone.
- **Worker:** `POST /social/find { q }` → `{ people: [{ user_id, name, handle, avatar, cloth, relation }], mode }`.
  Adults only (pcAdultRow; no social profile = unknown age = not found), never a block in either direction,
  never the searcher. A @username always finds its owner; a name only members with `find_by_name` on, an email
  only members with `find_by_email` on (NULL = on). A name needs 3 characters (start of a word in first_name /
  display_name), a handle 2, an email the whole address (via `rpc/user_id_by_email`, service role) — nothing
  enumerates members; ≤20 answers; 30 searches/minute/member (KV); the search text is never logged
  (`social_find` logs mode + count). `/social/follow` op follow now takes `user_id` for someone without a handle
  (same muted/pending rules). `/social/profile` reads/writes `find_by_name`, `find_by_email`. Mailbox: one
  heads-up line ("Find people is new: members can now find you by your name or email…") for 7 days from the
  first Mailbox read, adults only (KV `findnote:<uid>`), rendered through the 'board' item with kind 'find'.
- **Migration:** `20261018235000_find_people.sql` — `social_profiles.find_by_name`, `find_by_email` (boolean,
  NULL = on). Applies itself on push.
- **App:** `FindPeople.jsx` replaces FollowByHandle on the Circle screen and in the Mailbox (FollowByHandle stays
  for its `workerMessage`): one field, 350 ms debounce, hints until the words are worth sending, rows with Face +
  name + '@handle' / 'no @username yet' + Follow / Follow back / Requested / Following / Friends; an unknown email
  offers Invite. Settings → Privacy "Who can find me": "Hide my name from search", "Hide my email from search"
  (ON = private). Privacy policy: one sentence in "Profile & social information".
- Verified: harness over the real route (adult by name ✓; name-off adult only via @handle ✓; teen, no-profile,
  blocked, self excluded ✓; email-off not found ✓; exact email case-insensitive ✓; partial email = name ✓;
  relations ✓; teen searcher gets nothing ✓; 429 after 30/min ✓; the email never enters a query path ✓).
  node --check, eslint + no-undef, build, boot-check; captured as the demo account with `/social/find` mocked:
  the Circle screen with results, the Settings row.
- **Activate:** push → worker + migration deploy themselves; the screens reach phones with `npm run ota`.

## 2026-10-18 (late night) — Postcards to anyone on the app (Step A) (PUSHED)
- **Founder:** "Can we send postcards to people who we are not friends with or if they don't have handle yet"
  → order agreed: Step A (anyone on the app) → Step B (an email that waits) → our own photo filters.
- **Already true:** an adult could postcard ANY @handle; only the composer never offered anyone outside the circle.
- **Worker:** `/postcards/send` takes `to_user_id` (a Find people result, incl. members with no @username) beside
  `to_handle`; the same rails (self, blocks → silent ok, minors → silent ok, held); an account with no social
  profile gets a plain 409 ("haven't finished their passport"). A card to someone who doesn't follow the sender
  counts against `PC_STRANGER_DAILY = 5` a day (D1 `day_counts` key `pcs:<uid>`, 429 on the 6th). The feed marks
  such cards `from_new: true` (to me, sender not followed by me).
- **App:** FindPeople gains `onPick` (a Choose button per row); the composer's To row gains **Someone else…**,
  which opens the picker ("Send to someone else"); the chosen person shows as the chip (@handle or name);
  `sendPostcard` passes `to_user_id`. Mailbox: a **From someone new** shelf above "From your circle" with the note
  "Postcards from people you don't follow. The ••• on a card reports or blocks the sender." (the existing report
  door → TravelerSheet → Report / Block).
- Verified: node --check, eslint + no-undef, build, boot-check; captured as the demo account with `/social/find`,
  `/social/feed` and the follow list mocked: the composer with the picker open, the Mailbox shelf with a card.
  Not verified live: a real send to a non-follower (would create real mail); the 5/day cap is the same
  `gbDayCount` the board cap uses.
- **Activate:** push → the worker deploys itself; the screens reach phones with `npm run ota`.

## 2026-10-19 (early) — A postcard that waits for an email (Step B) (PUSHED)
- **Founder (10-18):** "can we send it to their email address" for people who aren't on the app.
- **Worker:** `/postcards/send` takes `to_email`. A member's email (rpc `user_id_by_email`) delivers like any direct
  card — whatever their Find people switches say, and the sender is told nothing either way. Anyone else's:
  the card is stored in **`api.pending_postcards`** under an HMAC of the lower-cased address (`pcEmailHash`,
  keyed by the service key — the address itself is never stored), the address gets ONE plain-text email
  (`pcSendWaitingEmail` via Resend: sender's first name, the place, a `globeskimmers.io/get?src=postcard` link; no
  photo, no message), at most once per sender per address per 30 days (KV `pceonce:`), and `PC_EMAIL_DAILY = 5`
  such cards a day per sender (D1 `pce:<uid>`). The reply is `{ ok, waiting: true, emailed }`.
  **Delivery:** `pcDeliverWaiting` runs at the top of `/social/feed` (not for teens), at most once a day per
  reader (KV `pcdeliv:`): every undelivered row for the reader's sign-in email becomes a normal `postcards` row
  addressed to them; a card from a sender who left, from themselves, or from someone in a block with them is
  marked delivered-to-nobody and dropped; a failed write leaves the row for the next read. **Prune:**
  `pcPendingPrune` in the daily cron deletes rows older than 90 days and the photos of the undelivered ones.
- **Migration:** `20261019003000_pending_postcards.sql` (service-role only; partial index on undelivered hashes).
- **App:** FindPeople gains `onPickEmail`: an email nobody uses offers **"Send it anyway — it waits for them"**
  (+ the one-email explanation) instead of Invite. The composer passes `to_email`; the chip shows the address;
  the toast says "Saved for <email> — we emailed them a link to join" (or "— it opens when they join" when the
  email didn't go). Privacy policy: one sentence under "Content you share".
- Verified: harness over the real helpers — hash ignores case/spaces, 64 hex; delivery picks only live,
  unblocked senders' cards for the matching hash, marks gone/blocked senders' cards dropped, leaves others'
  hashes alone, remembers the read for a day, leaves a card pending on a failed write; prune deletes old rows
  and only the undelivered photos. node --check, eslint + no-undef, build, boot-check; captured as the demo
  account with `/social/find` returning no one for an email: the offer, then the email chip.
  Not verified live: a real send (creates a real row and sends a real email). `RESEND_API_KEY` is already set.
- **Activate:** push → the worker and the migration deploy themselves; the screens reach phones with `npm run ota`.

## 2026-10-19 — Our own photo looks (PUSHED; on phones by the founder's OTA)
- **Founder (10-18):** "allow them to have filters, cool filters that like Instagram does not have, our own type of
  filters: make the photos professional looking, clearer, crisper, brighter, darker, different grains, cooler
  warmer." Decisions 10-19: one editor for postcards AND stamp photos; keep only the edited photo (undo = add it again).
- **Engine `src/lib/photoLook.js`:** pure pixel math on ImageData (no `ctx.filter`, so WKWebView renders it the same):
  brightness, contrast, warmth (R up / B down), saturation, clarity (unsharp mask against a separable 3×3 box blur),
  grain (deterministic LCG, so preview = saved file), fade (lift blacks toward matte), vignette (radial, past 45%),
  mono. Presets `LOOKS`: Original, Airmail (cool, crisp), Golden Hour (warm, bright), Film (grain, matte, desat),
  Ink (B&W, grain, contrast), Dusk (darker, cool, vignette), Postcard (rich colour, crisp, vignette).
  `renderLook(dataUrl, look, maxDim, quality)` → JPEG data URL; `isPlain` skips the pass when nothing changed.
- **Sheet `src/components/passport/PhotoEditor.jsx`:** 560 px live preview (late renders dropped), preset chips +
  Black & white, six dials with end labels (Darker/Brighter, Softer/Punchier, Cooler/Warmer, Crisper, Grainier,
  Matte), reset, "Keep original", "Use this look" (full render at ≤1600 px, q .86). z-[10010], above the composer.
- **Hooked in:** PostcardCompose ("Edit the photo — our looks" under the front); StampActions (one photo → editor
  before upload, a batch goes as it is; Keep original / backdrop = upload as picked); Passport StampCard's "Add a
  memory photo" (both layouts); PhotoSorter (Upload photos) gets a look chip row — one look for every photo in the
  batch, applied to the album adds in `go()` and carried as `look` into StampPlaceModal's sending loop.
- Verified: 15 engine checks (plain = no-op, brightness ±, warmth ±, mono, saturation, fade, clarity sharpens an
  edge and leaves flat areas, grain deterministic and varied, vignette centre vs corner, every preset renders);
  eslint + no-undef (photoLook declares `Image`/`document` — src/lib has no browser env), build, boot-check;
  captured in the composer with a canvas-drawn test photo: Golden Hour, Ink, custom dials.
  Not verified: speed on an old Android for a 1600 px render (one pass, ~1.9 M pixels; est. well under a second).
- **Activate:** app only — reaches phones with `npm run ota` after the push (no worker, no migration).

## 2026-10-19 — The first session: the required passport waits for the first save (PUSHED)
- **Founder (10-19):** "1. yes" to moving the birthday + @username screen from the open to right after the first
  stamps appear, still required before saving or sharing. Context: 80 accounts, 6 ever stamped.
- **Gate `src/lib/passportGate.js`:** `requirePassport()` resolves true once the account is complete (at once when
  it already is), false on sign-out; with no FinishPassport mounted (mid-onboarding, signed out) it resolves true
  and the worker's own gates decide. `registerPassportGate(fn)` / `passportGateDone(ok)`.
- **Library:** `addStamp`, `uploadStampPhoto`, `sendPostcard`, `getShareLink(true)`, `mintShareLink` and
  `socialFollow('follow')` await the gate first — every stamp, photo, postcard, share and follow path in the app
  passes through these, so no call site has to remember. A refused call answers `error: 'finish_passport'`.
- **FinishPassport:** still reads what's missing at open, but renders the required screens only when armed by a
  save or a share; completing them answers every waiting call (true) and the action goes on; Sign out answers
  false. Copy no longer says "Welcome back" (new members hit it too): "One thing first…" / "One more thing…".
- **Onboarding:** the `username` step is gone (birthday + @username come at the first save instead), the
  home-city origin stamp is no longer minted at the end (it would have stored a stamp before any birthday; the
  Passport offers page one later, behind the gate), and onboarding ends on the **Passport** (Upload photo to get a
  stamp / Stamp where I am), not Home. UsernameStep.jsx is unused now (kept on disk).
- **COPPA posture:** the birthday still precedes every stored stamp, photo and post — it is asked at the moment
  of the first save, before the write. Browsing, the finders and sorting one's own photos on the phone need none.
- Verified: 7 gate checks (resolves at once with no screens; each call triggers; waits; both waiting calls
  resolve together; sign-out → false; unmount releases; after unregister resolves at once); eslint + no-undef on
  the changed files (passport.js's pre-existing `window`/`Event` lines are outside lint scope), build, boot-check;
  captured as the demo account with age unset + no handle mocked: the Passport opens unblocked (before: the
  required sheet covered the app); tapping Follow on a Find people result brings up "Step 1 of 2 · Your birthday".
- **Activate:** app only — `npm run ota` after the push.

## 2026-10-19 — Edited photos refused; crop and zoom (PUSHED)
- **Founder:** an edited postcard photo (their cat, "My Old Man") answered "This photo can't go on a postcard";
  "Can you also allow crop, zoom in and zoom out."
- **Cause, two parts.** (1) The photo review prompt refuses "content that is clearly not a travel/food/place
  photo" — right for public guestbook and dish photos, wrong for a member's own postcard or album: a cat at home
  is not a travel photo. (2) The editor rendered at 1600 px / q .86, and grain fights JPEG — a heavier file than
  the original, and one message covered both "not allowed" and "couldn't check".
- **Worker:** `gbModeratePhoto(env, b64, type, kind)` gains kind `'memory'` — a personal memory going to people the
  member chose: pets, selfies, family, homes and indoor scenes are ordinary, only the safety list refuses (nudity,
  gore, hate symbols, drugs, brandished weapons, private documents, spam/ads/text screenshots). Used by the
  postcard, the stamp's album upload, the stored-album review (`ppReviewPhotos`) and the avatar. Guestbook, dish
  and Suggest-a-place photos keep the strict `'place'` prompt. The postcard now says "We couldn't check this photo
  right now — try again in a moment" when the review itself failed, and logs `postcard_photo_refused { reason }`.
- **Engine:** `renderLook(src, look, maxDim, quality, crop)` — crop as fractions of the photo, applied before the
  look, never upscaled; output ≤1280 px at q .84, re-encoded at .74 / .64 when the file passes ~1 MB.
- **Editor:** a frame (Original · 3:2 · Square · 4:5), a Zoom slider 1–4× ("Whole photo" ↔ "Closer · drag to
  move"), drag to pan, pinch to zoom (pointer events, touch-action none); the photo covers the frame at 1×. The
  composer starts on 3:2 (its front); stamps on Original. "Use this" when anything changed.
- Verified: node --check; 15 engine checks still pass; eslint + no-undef, build, boot-check; captured: 2× Square on
  the peak, 1.6× 3:2 with Golden Hour. Not verified live: the founder's cat through the memory prompt (needs a
  real send) — the prompt text allows "pets … homes and indoor scenes" by name.
- **Activate:** push → the worker deploys itself; the editor reaches phones with `npm run ota`.

## 2026-10-19 — Counting strangers: the campaign token, "Where did you hear about us?", the funnel (PUSHED)
- **Growth plan week 1, item 2.** The founder created App Store campaign "Lobster1" (10-18): provider token
  `pt=121139771`. Apple shows a campaign only after 5 first-time installs — the empty Campaigns page is normal.
- **Install links:** `site/get` sets `APPLE_PT`, and the Play referrer's medium is now per source (print for the card,
  social for fb/ig/tiktok/yt/pinterest/threads, referral otherwise — it was print for everything). The worker's
  `/go/ios` (share pages) sends `pt=121139771&ct=share&mt=8` — Apple counts a download only with BOTH, and `ct` is a
  fixed code now, never the share's slug (per-share codes can't reach Apple's 5-download threshold).
- **The honest source:** a new optional onboarding step **"Where did you hear about us?"** (`HeardFromStep.jsx`:
  Facebook, TikTok, Instagram, YouTube, A friend or family, A group or an event, Somewhere else; Skip is a first-class
  answer) between home country and the passport explainer. Saved to `public.profiles.heard_from` (migration
  `20261019020000_profiles_heard_from.sql`) and logged as `signed_up { source }` — 'unknown' when skipped, never a guess.
- **People, not sessions:** `ANALYTICS_QUERIES.active_users` / `active_users_by_day_30d` count
  `COALESCE(user_id, anon_id, session_id)` and drop the worker's own `session_id='server'` row (it counted as one
  person); `mau_accounts` added (signed-in people, 30 days).
- **The funnel** (`/admin/activity-overview` → `funnel`; Admin → Activity overview, a card at the top): accounts
  (profiles count), ever stamped (distinct stampers in the 12-month read), stamped · 30d, sent a postcard · 30d, new
  accounts · 30d and how many stamped within 7 days of joining (the plan's 40% target shown beside it), and the
  heard-about-us answers. People counts only. Baseline 10-18: 80 / 6 / 6.
- Verified: node --check; eslint + no-undef, build, boot-check; captured Admin → Activity overview with the reply
  mocked (80 · 6 · 6 · 2; 9 new, 2 activated = 22% vs target 40%; A friend 3 · Facebook 1). The onboarding step
  couldn't be captured as the demo account (already onboarded → Home); it uses the standard step layout.
- **Activate:** push → worker + site + migration deploy themselves; the step and the card reach phones with `npm run ota`.

## 2026-10-19 — Shares that land: /p/ link previews, the stamp-earned share card (PUSHED)
- **Growth plan week 2, item 3.** Where the first audience shares — Messenger, WhatsApp, iMessage, Facebook and
  Instagram Stories — a shared passport link showed no preview, and a verified stamp ended in a toast.
- **Worker `/p/<slug>`:** `og:title` ("<First name>’s Virtual Passport · GlobeSkimmers", or "A Virtual Passport on
  GlobeSkimmers" when it reads private), `og:description` (the stamp · country · city counts, or the promise),
  `og:image` = the site's own `img/og.jpg` (1200×630 — never a member's photo), `og:url`, `og:site_name`,
  `twitter:card`, `<meta name="robots" content="noindex">`, and the Smart App Banner (`apple-itunes-app` with the
  `globeskimmers://passport/view` argument). The `/t/` page is unchanged (it shares the old title string).
- **App:** `stampCard(stamp, { presetId, artSrc, link })` in `src/lib/shareCanvas.js` — a 1080×1920 story: the stamp
  art from the worker (CORS, skipped if it won't load), a solid VERIFIED ✓ pill for a proven stamp, the place, city
  · country · date, "I was here", the brand line "My Virtual Passport · verified stamps carry proof" and
  `globeskimmers.io/p/<slug>`; everything inside Meta's story safe zone. `StampEarnedSheet.jsx` opens the moment a
  stamp lands from the Passport's stamp modal (Stamp where I am, Upload photos — once, after the last place of a
  queue): adults only, verified stamps only, never a sensitive place (the worker starts those private) or a
  place of respect; "Share this stamp" → the phone's share sheet with the card (a link share where files can't be
  shared, a copy where nothing can); logs `stamp_earned_sheet` / `stamp_share { how }`. Done closes it.
- **Wording rule kept:** the footer says "verified stamps carry proof", never "only by being there".
- Verified: node --check; eslint + no-undef, build, boot-check; the card rendered through the real library in the
  dev server (Eiffel Tower, Paris · France, Oct 19, 2026, VERIFIED, link). Not verified: a real stamp through the
  sheet on a phone; previews fetched by Messenger/WhatsApp bots (check after the push with a shared link).
- **Activate:** push → the worker deploys itself; the sheet reaches phones with `npm run ota`.

## 2026-10-19 — Mailbox: the doors on top, the activity folded (PUSHED)
- **Founder:** "quite a scroll to reach the bottom of mailbox to open postcard and postcard box".
- **App:** `PostcardBoxRow` and `CityBoardsRow` moved above the activity; `ActivityList` shows 4 rows with
  "Show N more" (cap 30); the Mailbox folds every "<board> now shows N of your photos" line into one — "Your photos
  now hang on 7 boards — Grand Canyon Village, Stone Mountain, Georgia and 4 more. Take any down from your album."
  (the Find people heads-up and a lone board line stay as they are).
- Verified: eslint + no-undef, build, boot-check; captured with the unread list and feed mocked.
- **Activate:** `npm run ota` after the push (app only).

## 2026-10-19 — Alerts outside the app (push), build 1.0.6 = iOS 1.0.5 (15) · Android 1.0.9 (12) (PUSHED — worker + migration live; store builds pending)
- **Founder (10-19):** lock-screen / banner alerts for a postcard (with a line of its words; tap → that card; ten
  → one), a follow request, a comment on a photo, a guestbook signature; opt-in "inner circle stamped a place".
  Setup done the same evening: APNs key `K792MFVWCV` (team `6C6X2RV7CC`, file in ~/Desktop/push-keys), Firebase
  project `globeskimmers` (google-services.json + service-account JSON; the org policy "disable service account
  key creation" had to be overridden at the organization). **Secrets NOT yet stored** at write time.
- **Worker:** the push module (before `handleSocialFind`). `pushNotify(env, uid, kind, make, opts)` is the one
  gate: `pcAdultRow` only; the member's `alert_*` switch (postcards / follows / pages on by default,
  friend_stamps / news off); `PUSH_WEEKLY_CAP` 40 (KV `pushwk:`); quiet hours 22:00–08:00 in
  `profiles.home_timezone` — the line waits in KV `pushq:<uid>` and the hourly cron (`0 * * * *` →
  `pushHourly(env)`) sends it once the member's morning comes; several of a kind within six hours fold ("3 new
  postcards", KV `pushn:`). `apnsSend` (HTTP/2 to api.push.apple.com, ES256 JWT cached 50 min, collapse-id per
  kind; a `BadDeviceToken` retries the sandbox host once — an Xcode build's token lives there) and `fcmSend` (v1,
  OAuth from the service account, channel `alerts`, icon `ic_stat_globeskimmers`); a token reported gone is
  deleted. Hooks: a direct postcard (`return=representation` → the card's id → `/Postcards?pc=<id>`), a follow
  request / a follow / an accepted follow, a reaction (press), a signature or doodle, a tag invite. The inner
  circle's stamps: `pushFriendStamps` at local 9, mutual friends only, tier ≥ inner, never where they are now.
  Routes `/push/register` (upsert on token; a shared phone follows the sign-in), `/push/unregister`, `/push/test`
  (admin: knocks on the caller's phones, reports which keys exist). Account deletion takes `push_tokens`.
  Migration `20261019050000_push_alerts.sql`. wrangler.toml: `[vars]` APNS_KEY_ID / APNS_TEAM_ID /
  APNS_BUNDLE_ID / FCM_PROJECT_ID, crons `["0 15 * * *", "0 * * * *"]` (the hourly one runs ONLY `pushHourly`).
- **App:** `src/lib/pushAlerts.js` — `attachPushListeners` (registration → `/push/register`; a tap → the route
  through AuthContext's `pendingRoute`; Android channel), `syncPushToken` on every adult open, `askForAlerts`
  after a postcard send (not a board) and after a follow (FindPeople, FollowByHandle), `unregisterPush` on
  sign-out. Settings → **Alerts**: the phone's state (On / Off in phone settings / Turn on) and five switches.
  Postcards `?pc=<id>` scrolls to the card, ringed. Privacy policy: the token and its deletion.
- **Native:** `@capacitor/push-notifications@8.1.3`; iOS `aps-environment` entitlement + AppDelegate token
  hand-off; Android POST_NOTIFICATIONS, Firebase meta-data (icon / colour / channel), monochrome status icons
  generated in 5 densities, `google-services.json` in android/app (gitignored). Versions bumped in all four iOS
  configs (app + ShareExtension) and Android.
- **Two bugs the gates caught before anyone saw them:** a static `callWorker` import in pushAlerts and an
  effect placed above the `socialTier` declarations produced "Cannot access 'q' before initialization" at boot
  (white screen) — lazy import + the effect moved below the state.
- Verified: 14 gate checks (adult/teen, switches, folding, quiet-hours queue + replace + forced flush, weekly
  cap, gone-token deletion, bad id, quiet-hour maths); the APNs JWT verifies against the key's own public half
  (64-byte raw signature, cached); a REAL FCM OAuth exchange issued a token; eslint + no-undef; build;
  boot-check ✅; `npx cap sync` registers the plugin on both platforms; Android `assembleDebug` BUILD SUCCESSFUL;
  iOS launch check (iOS 27 runtime), twice — the second on the fixed bundle: iPad Air ✓, iPhone 18 Pro ✓ both
  times; captured: Settings → Alerts, a postcard opened by id.
  NOT verified: a real knock on a phone — needs the secrets, the store build and a device (the admin's
  /push/test is for that moment).
- **Activate:** founder: `npx wrangler secret put APNS_KEY_P8 < ~/Desktop/push-keys/AuthKey_K792MFVWCV.p8` and
  `npx wrangler secret put FCM_SERVICE_ACCOUNT < ~/Desktop/push-keys/globeskimmers-firebase-adminsdk-fbsvc-0c83c38c35.json`;
  push (worker + migration deploy themselves); Xcode archive 1.0.5 (15) → TestFlight → Settings → Alerts → Turn
  on → /push/test; `cd android && ./gradlew bundleRelease`; submit both. The JS half reaches current phones by
  `npm run ota`, where it stays quiet until the native build with the plugin arrives.

## 2026-10-19 — Postcards: the recipient can Delete or Reply; the passport activity shows the newest 3 (PUSHED — worker + migration live; OTA pending)

Founder: "allow post card receipient to delete a post card or reply … when collapse then only the top 3
notifications are viewable."

- **Delete (the recipient's side only).** A card addressed to you carries **Reply** and **Delete** under its
  footer. Delete asks inline ("Delete this postcard? It leaves your Mailbox." Delete / Keep). The worker's
  `/postcards/delete` (`handlePostcardDelete`) sets `postcards.recipient_deleted_at` on a row whose `to_user_id`
  is the caller (404 otherwise) and drops the caller's keep of it. Soft, so the sender's own copy and the
  moderation record stay. The feed, the postcard box and the unread count filter such rows in JS, so the deploy is
  safe in either order with the migration.
- **Reply.** The reply opens the composer titled "A postcard back to *Mary*", addressed "Reply to Mary" (the
  picker and "Someone else…" are off). The app sends `reply_to: <postcard id>`; the worker resolves the sender
  only from a postcard addressed to the caller and then runs the normal addressed-postcard path (self, teen
  mutual-follow, block, moderation, push). No account id is handed to the app.
- **The newest 3.** "On your passport" shows 3 rows, then "Show N more"; open, a **Show fewer** row folds it
  back to 3. `SHOW_ROWS = 3` in `ActivityList.jsx`; the 30-row ceiling and the board fold line stay.
- Wired on both the Mailbox and the postcard box (`Postcards.jsx`).
- Migration `20261019160000_postcard_recipient_delete.sql` (one nullable column + PostgREST reload).
- Verified: `node --check`; eslint with no-undef on the five touched files; build; boot-check ✅; captured (mocked
  feed, demo account): the 3 rows + "Show 2 more", expanded + "Show fewer", the card's Reply / Delete, the inline
  confirm, the reply composer.
  Live (main 81b591b, both deploy runs green): signed in as the demo account, a delete and a reply naming a
  postcard that does not exist both answer 404 "That postcard isn’t here any more"; the column exists.
  NOT verified: a real delete and a real reply on a phone (needs the OTA).
- **Activate:** push (worker + migration deploy themselves), then the founder's `npm run ota`. No native build.

## 2026-10-19 — Postcard ••• menus (Delete / Reply), the alert trace and "Send a test" (PUSHED — main 271b712 / 7f6d159, deploys green; OTA pending)

Founder: "allow user to delete postcard from the mailbox also, by user clicking the 3 dots … delete and reply
from there also" and "no duplicate task please in one section"; then "a reply to post card was sent to me and i
did not get a notification".

- **Menus.** The TravelerSheet opened from a postcard sent to you reads "POSTCARD FROM / Mary" and leads with
  **Delete this postcard** (a "Delete this postcard? It leaves your Mailbox. Mary keeps their own copy." step,
  Keep it / Delete). From a notification row's ••• it also offers **Reply to Mary** first. The card itself keeps
  ONE Reply button (full width) and no Delete of its own: one place per action in each section. The worker's
  `/social/unread` gives a postcard-to-me row its `postcard_id`.
- **The missed alert, traced.** KV `pushn:89cc7046…:postcards` at 15:31 UTC = the gate ran (adult, switch on,
  not quiet hours); no `pushwk:` key = no phone took it. An APNs call with a dummy token and our key answers
  `BadDeviceToken` on both hosts, so the key, team and topic are accepted: the server half works. So the
  founder's phone most likely never registered (the Alerts row says "On" from the phone's permission alone).
- **Trace + self-test.** `pushDeliver(env, uid, msg, out)` reports `{ phones, reasons }` (never a token);
  `pushNotify` logs D1 `push_outcome { kind, to: <8 chars of the id>, phones, sent, reasons, n }` and `push_held`.
  `/push/test` opens to any adult (3 an hour, `pusht:` day_counts); Settings → Alerts shows **Send a test** when
  allowed: `testAlerts()` registers again, waits for the worker to have the token (≤ 6 s), then knocks once and
  says which of: sent / this phone couldn't sign up / signed up but it didn't go through.
  Read the trace: `npx wrangler d1 execute globeskimmers-events --remote --command "select datetime(ts,'unixepoch'), payload from events where event_type in ('push_outcome','push_held') order by ts desc limit 20"`.
- Verified: `node --check`; eslint + no-undef on the touched pages; build; boot-check ✅; captured (mocked):
  the card's single Reply, the card's ••• (Delete, Unfollow, Report, Block), the row's ••• (Reply first), the
  delete step.
- **Activate:** push, then `npm run ota`; then Settings → Alerts → **Send a test** on the founder's phone.

## 2026-10-19 — Telegrams: three words by wire, no photo (PUSHED — main 271b712 / 7f6d159, deploys green; OTA pending)

Founder: "another form of messaging … telegram … just messaging without photos … short message to individual
handles and recipient can reply … realistic and super cool"; "only allowing 3 words … you can send as much
telegrams as you want"; "3 words max! make it count, 4 cents per extra word design but we won't really charge
them". It also answers "allow for reply to be sent even without a photo": a postcard's Reply now asks "a
postcard back or a telegram back", so postcards keep their photo and there is one words-only form, not two.

- **Rules (worker `tgClean` / `tgWordCount`, mirrored in `src/lib/telegram.js`).** Capitals; letters, digits,
  plain punctuation; a full stop or ! → STOP (not counted); links and emoji dropped; THREE words max; a word past
  15 letters counts as two (the old telegraph rule); ≤ 120 characters. The writer refuses a fourth word as it's
  typed (`telegramFit`; a paste keeps its first three) and says "3 words max!" in red. Founder 10-19: no "price
  once covered ten words" line and no "STOP rides free" label (the fine print reads GLOBESKIMMERS TELEGRAPH).
- **Worker.** `/telegrams/send { to_handle | reply_to, body }`: adults only (sender and recipient), words through
  `gbModerate`, a block or a minor recipient answered `{ ok: true }` and stored nowhere, no finished passport =
  409; five a day to people who don't follow you (`tgs:`; a reply is exempt), twenty a minute (`tgm:`), no other
  limit. `reply_to` = a telegram or postcard addressed to the caller → its sender. `/telegrams/delete` (recipient,
  soft). Feed rows `{ type: 'telegram', id, body, reply, from_new, by }` + feature `telegrams`; unread rows
  `{ type: 'telegram', telegram_id }`; push kind `telegrams` (the Postcards switch, its own fold: "Telegram from
  Mary", body = the words, route `/Mailbox?tg=<id>`); report kind `telegram`; deletion + orphan scan.
  Migration `20261019190000_telegrams.sql`.
- **App.** `TelegramPaper` (perforated buff blank, wires + bird, bolt seal, CLASS OF SERVICE, NO./CHECK/FILED,
  words on typewriter tape in Special Elite, red RECEIVED stamp, TOLLS: "THREE WORDS MAX!", first 3 FREE, each
  extra word 4¢ — stamped ON THE HOUSE, Morse rule spelling GLOBESKIMMERS). `TelegramCompose` (the dark telegraph
  office: pick a @username or type one, type on the blank, a three-box meter, "On the wire" preview, "3 WORDS MAX!
  MAKE IT COUNT.", Wire it; a fourth word can't be typed; the meter says "punctuation is okay"; a chevron at
  the top right collapses it without sending and the words wait — reopening the same telegram brings the draft back,
  kept while the app is open). `TelegramCard`
  (one Reply = a telegram back; ••• = Delete / Report / Block). `ReplyWays` on a postcard's Reply (Mailbox and the
  postcard box). Mailbox: a Telegram button under Postcard; "Mary sent you a telegram"; tapping a postcard or
  telegram row brings its card into view; `?tg=` from an alert does too. Settings switch → "Postcards and
  telegrams". Privacy policy names telegrams (site).
- Verified: `node --check`; the word rules on six samples; eslint + no-undef; build; boot-check ✅; captured
  (mocked feed): the Mailbox head with both buttons, a received telegram, the writer empty, at 3/3, and refusing
  "Landed safe in Manila" at "LANDED SAFE IN", the reply chooser.
  NOT verified: a real send / reply / delete against production (needs the push).
- **Activate:** push (worker + migration + site deploy themselves), then `npm run ota`.

## 2026-10-19 — Telegrams follow-up: emoji, one alert each with no preview, SENT / RECEIVED (PUSHED — main 271b712 / 7f6d159, deploys green; OTA pending)

Founder: "a date and time the telegram was sent and … received"; "can users put emoji … 3️⃣ … is the equivalent
to one word … still max of three"; "notifications … for each telegram … but do not allow telegram message to be
previewed".

- **Emoji** go by wire; each emoji grapheme (keycap 3️⃣, flags, skin tones, ZWJ families) counts as ONE word,
  letters as before; `Intl.Segmenter` in the worker and the app. The writer cuts a whole emoji at a time.
- **Alerts:** "Telegram from Mary" / "Open it in your Mailbox to read it" — the words never ride in the alert;
  `pushNotify(..., { each: true })` = never folded; `msg.collapse = tg-<id>` gives each its own APNs collapse id and
  FCM tag (so one doesn't replace another); in quiet hours one line per sender waits for the morning.
- **SENT / RECEIVED:** the form row reads SENT (created_at); `received_at` (migration
  `20261019200000_telegram_received.sql`) is stamped the first time the telegram reaches the recipient's Mailbox
  (`/social/feed`), and the red RECEIVED stamp shows it.
- Verified: emoji counting on 7 samples (worker) and the fit on 5 (app); eslint + no-undef; build; boot-check ✅;
  captured: a telegram with 👋🏽 ❤️, SENT 7:42 AM vs RECEIVED 9:05 AM; the writer cutting "3️⃣ days left 🎉😘" to
  "3️⃣ DAYS LEFT".
- **Activate:** push, then — after the deploy runs finish — `npm run ota`.
- Note: the 16:13 UTC deploy runs (main 7f6d159) sat queued behind a GitHub Actions incident ("Degraded
  availability for GitHub Actions"); they run on their own once Actions recovers.

## 2026-10-19 — A telegram arrives sealed; RECEIVED = opened (PUSHED — main 271b712 / 7f6d159, deploys green; OTA pending)

Founder: "when a notification is selected by user, take user to that new postcard … telegram to open? or straight
to view?" → Claude: postcards straight to view (already built: a tapped row or alert scrolls to and rings the
card, or opens the postcard box at it); telegrams arrive SEALED and are opened with a tap. Founder: "yes".

- `TelegramEnvelope`: the back of a buff envelope, GLOBESKIMMERS TELEGRAPH on the flap, DELIVER AT ONCE (red stamp),
  a red wax seal with the bolt, TELEGRAM / FOR <name · @handle> / FROM <name · @handle> / TAP TO OPEN. Tap → the seal
  breaks, the flap lifts (rotateX), the telegram rises out (keyframe); reduced motion skips it. Reply only once open.
- Worker `/telegrams/open { telegram_id }` stamps `received_at` once (a second open answers the same time); the
  feed no longer stamps on load. The RECEIVED stamp = the moment it was opened.
- Verified: eslint + no-undef; build; boot-check ✅; captured sealed / mid-lift / opened (RECEIVED 9:40 AM vs SENT
  7:42 AM).
- **Activate:** push, then after the deploy `npm run ota`.

## 2026-10-19 — Telegrams: four words max (PUSHED — main 271b712 / 7f6d159, deploys green; OTA pending)

Founder: "change the maximum limit to four words maximum … the fifth has a charge (we're not really charging)".
`TG_MAX_WORDS` / `TELEGRAM_WORDS` = 4; the meter has four boxes; "4 WORDS MAX! MAKE IT COUNT."; the tolls read FOUR
WORDS MAX! / FIRST 4 WORDS — FREE / EACH EXTRA WORD — 4¢ (ON THE HOUSE); privacy policy "four words or fewer".
Captured: "Landed safe in Manila today" stops at "LANDED SAFE IN MANILA" (4/4). eslint + no-undef; build;
boot-check ✅. **Activate:** push, then `npm run ota`.

**Live check, 2026-10-19 (main 271b712, worker + migrations + site deployed):** as the demo account — five words →
400 "4 words max! Make it count."; an unknown @username → 404; a reply / open / delete naming no telegram → 404;
`/social/feed` advertises `telegrams`; `/push/test` as a non-admin adult → `{ sent: 0, phones: 0 }`.
Remaining: the founder's `npm run ota`, then Settings → Alerts & Notifications → Send a test on a phone.

## 2026-10-19 — Telegrams strictly private: delete erases (PUSHED — main 521aada, worker + site live; the sheet wording waits for an OTA)

Founder: "make sure that all the telegrams sent and received are strictly private to Only Me".
Audit, live: `api.telegrams` refuses direct reads and writes (signed out 401, signed in 403 — service role only);
every worker read is scoped `to_user_id = caller` (feed, unread, open, reply lookup, delete); the words are never
in an alert ("Open it in your Mailbox to read it"), a D1 event (`telegram_send` = reply + word count), or the
quiet-hours KV queue; account deletion erases telegrams both ways. Who else can ever see words: the moderation
check at send (Claude, nothing stored) and our team ONLY if the recipient reports that telegram (the report
carries its words). Fixed: `/telegrams/delete` now DELETEs the row (and any rows hidden by the earlier soft
delete); the sheet says "It's erased for good."; privacy policy updated (site). **Activate:** push; the sheet's
wording needs `npm run ota`.

## 2026-10-19 — Alerts on by default, previews off by default (PUSHED — main ffacaf5, worker + migration + site live; live check: a default account reads stamps ON, news OFF, previews OFF; OTA pending)

Founder: "can notifications be turned on by default? with the previews turned off by default? but always strictly
that telegram messages preview cannot be opened on lock screen nor on banners, it has to be in app".
- **On by default:** iOS / Android 13+ need the person's one Allow; `askAlertsOnce()` asks it on the first adult
  open (2.5 s after the app settles; flag `gs_push_asked_v1`), not after a first postcard or follow. In-app switches:
  Postcards and telegrams, Follows, Your passport, and now Inner circle stamps are on unless switched off; News stays
  opt-in (App Review 4.5.4: marketing alerts need explicit consent).
- **Previews off by default:** migration `20261019210000_alert_previews.sql` (`social_profiles.alert_previews`, NULL =
  off). `pushNotify` swaps in `msg.preview` (a postcard's words, a comment's words) only when it is true. Settings →
  Show previews: "Off — alerts never show anyone's words" / "Postcard words and comments show. Telegram words never
  do". Telegram alerts carry no preview at all, so no phone setting can show their words.
- Privacy policy: who-sent-what only; words only with Show previews; never a telegram's.
- Verified: `node --check`; eslint; build; boot-check ✅; captured Settings (before the deploy, so Inner circle
  stamps read the live server's old default).
- **Activate:** push (worker + migration + site), then `npm run ota`.

## 2026-10-19 — Telegrams to several people; periods stay periods (COMMITTED, not pushed)

Founder: "allow for telegram to be sent to different people, same message, sent separately, or same message, sent
in a group as long as both people have @handle"; "instead of using stop for period in telegram, use period instead".
- **Periods:** `tgClean` / `telegramText` keep punctuation as typed (no STOP); punctuation counts as no word.
- **Several people:** `/telegrams/send { to_handles[≤10], mode: each | group }`. Each recipient passes the rails on
  their own; blocked pairs and minors are left out silently and never named; an unfinished passport comes back as
  `not_ready` (@usernames the sender typed). Five a day to people who don't follow you counts per person. GROUP: one
  `group_id`, each copy's `cc` = the others it reached; `reply_all` answers the sender + the rest (each reply passes
  the replier's own rails). Feed rows carry `group: [@handles]` minus anyone the reader blocked. Alert: "Group
  telegram from Mary" (still no words). Migration `20261019220000_telegram_groups.sql` (group_id, cc uuid[]).
- **App:** pick circle chips and/or type + Add (≤10); with 2+: "Each their own" ("N private telegrams. Nobody sees who
  else got one…") or "As a group" ("One telegram to all N…"); TO line "@A, @B +N"; received group: "ALSO TO …" and an
  envelope reading GROUP TELEGRAM; reply: "Just Mary" / "Everyone on it (N)", title "A telegram back to everyone".
- Privacy policy: a group telegram shows each recipient who else it went to.
- Verified: worker + app give the same text and counts on 5 samples; eslint + no-undef; build; boot-check ✅;
  captured the group writer, a sealed GROUP TELEGRAM, the opened one with ALSO TO, reply-all.
- **Activate:** push (worker + migration + site), then `npm run ota`.

