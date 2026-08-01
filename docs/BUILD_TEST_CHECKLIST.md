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
- [ ] ⚠️ **VERIFY pid + mcid** — generate one link in Viator dashboard (Tools → Create links) and confirm mcid=42383 matches this account; fix `src/lib/viator.js` if different (payout depends on it)
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
- [ ] **Buddy tagging (in-app):** on a stamp → "Tag who you were with" → enter another test account's email → "We'll let them know". Sign in as that account → Passport shows "🙌 Tagged you" → **Allow** mints the stamp on their passport; **Decline** = nothing. (Same worker deploy + the updated `01_schema.sql` covers this — re-run it, it's idempotent.)
- [ ] Tag privacy/anti-spam: response is identical whether the email is a user or not; 30 tags/day cap; can't tag yourself
- [ ] ⚠️ Not yet built: **Phase B email** (notify existing users + invite non-users w/ download links — needs an email provider); onboarding page-one reframe; city/airport/icon/wonder auto-stamps; share card (P2)

## Template for a new build
```
### N · <feature name>
State: Committed <hash> · Deployed <where> · Tested ⬜
- [ ] <test step 1 — what to do, what you should see>
- [ ] <test step 2>
- [ ] <edge case / failure case>
```
