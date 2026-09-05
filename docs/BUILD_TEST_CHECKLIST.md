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
