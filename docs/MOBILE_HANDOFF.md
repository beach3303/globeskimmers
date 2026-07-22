# 📱 Mobile handoff — remaining finder migrations

Pick this up from a **cloud Claude Code session** (claude.ai/code or the Claude app → Code tab).
It clones this GitHub repo fresh, so it has everything through commit `005232d` (coffee).

## ✅ What a cloud/mobile session CAN do here
Pure code, following the recipe below. Edit → `npm run build` → `git commit` → push. That's it — the code lands on GitHub for the Mac to deploy later.

## 🚫 What a cloud/mobile session CANNOT do (needs the Mac — leave for when back at the desk)
- Run the Supabase **SQL** files (no DB credentials in the cloud sandbox)
- `wrangler r2 bucket create globeskimmers-media` and `wrangler deploy` (no local creds)
- Publish `legal/terms.html` to globeskimmers.io
- **Xcode / `npx cap copy ios` / device test** (no macOS in the cloud)

So: mobile writes the code; the Mac runs SQL + `wrangler deploy` + iOS build afterward.

---

## THE RECIPE (per finder) — mirror coffee exactly
Reference commit **`005232d`** ("Coffee: finder → owned planet DB") and **`65afedb`** (restaurants). Coffee is the clean template. For a finder `X`:

1. **SQL** — `scripts/finders/<x>.sql`: copy `scripts/finders/coffee.sql`, rename the function to `api.nearby_<x>`, and change only the category filter (see table below). Keep the same signature `(in_lat, in_lng, in_radius_m default 8000, in_limit default 40)`, the `st_dwithin` geography prefilter, and the grants + `notify pgrst`.

2. **Worker** — in `cloudflare-worker-v7.12.js`, copy `handleCoffeeOwned` → `handle<X>Owned`, change the RPC name to `nearby_<x>` and the `generateCacheKey` tag to `<x>_owned`. Register the route next to the coffee one:
   `if (pathname === '/<x>-owned' && request.method === 'POST') return await handle<X>Owned(request, env, ctx);`

3. **Route** — in `src/lib/workerRoutes.js`, add `getXOwned: '<x>-owned',` next to `getCoffeeOwned`.

4. **Frontend** — in the finder's page, swap the list fetch from the old route to `ROUTE.getXOwned` (keep the same `{latitude,longitude,radius,maxResults}` args). **Only if the card shows photos/hours on tap** (ATM, Shopping, Restroom do; see notes), add the coffee card's enrich-on-expand block: the `enriched` state + `useEffect` that calls `places/enrich-owned` on first expand, then layer `photos / openNow / weekdays / todayHrs` over the owned fields. (None of these five use `AIDetailsSection`, so no owned→gid wiring needed — simpler than coffee.)

5. **Verify + commit** (one finder per commit): `node --check cloudflare-worker-v7.12.js` → `npx eslint --quiet <page>` → `npm run build`. Show the diff, then commit with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Add a row to `docs/BUILD_TEST_CHECKLIST.md` with `**Activate:** run scripts/finders/<x>.sql + wrangler deploy`.

---

## Per-finder table
| Finder | Page file | Current fetch (line) | New route | Overture category filter (starting point — refine as needed) | Photos/hours on tap? |
|---|---|---|---|---|---|
| ATM | `src/pages/ATMFinder.jsx` | `ROUTE.getATMLocations` (~586) | `atm-owned` | `category ilike '%atm%' or category in ('bank','credit_union')` | Has PhotoCarousel, but ATMs rarely have useful photos — **enrich optional/skip**. AI details are FORKED (card networks/fees/DCC/skimmer) — leave that logic alone, just swap the list source. |
| Shopping | `src/pages/Shopping.jsx` | `ROUTE.getShoppingPlaces` (~275) | `shopping-owned` | `category ilike any (array['%shopping%','%department_store%','%mall%','%market%','%boutique%']) or category in ('shopping_center','shopping_mall','clothing_store','shoe_store')` | Yes → add enrich-on-expand. Note fetch passes a `category` arg — keep filtering client-side or pass through. |
| Restroom | `src/pages/RestroomFinder.jsx` | `ROUTE.getRestroomLocations` (~604/618) | `restroom-owned` | `category ilike '%toilet%' or category ilike '%restroom%'` | ⚠️ Overture has FEW public-restroom POIs — this finder may return little. Consider keeping Google for restroom, OR treat owned as a supplement. Has its own `restroom-ai-details` — leave it. **Evaluate coverage before fully swapping.** |
| Convenience | `src/pages/ConvenienceStore.jsx` | `ROUTE.getConvenienceStores` (~806) | `convenience-owned` | `category ilike '%convenience%' or category in ('convenience_store','grocery_store','minimart','corner_store')` | Check page for PhotoCarousel; add enrich only if used. |
| Money exchange | `src/pages/MoneyExchange.jsx` | `ROUTE.getMoneyExchangeLocations` (~424) | `moneyexchange-owned` | `category ilike '%currency%' or category ilike '%money_exchange%' or category in ('currency_exchange','bureau_de_change')` | ⚠️ This page ALSO fetches exchange RATES via `getExchangeRate` (~385) — **do NOT touch that.** Only migrate the LOCATIONS fetch (~424). |

## Guardrails (from project memory)
- **No Unsplash in restaurants / places-to-eat** (already done). Hybrid photos OK elsewhere.
- **One logical change per commit; show diff before committing; ask before pushing.**
- Owned rows have **no rating/reviews** — chain/specialty/name-based logic still works; rating-gated logic just won't fire (same tradeoff accepted for restaurants + coffee).
- After coding on mobile, the **Mac** still must: run each new `scripts/finders/<x>.sql` in Supabase + `wrangler deploy` + iOS build to see it live.

## Also queued (separate, Mac-side)
Activation still pending for already-built work: run `attractions.sql`, `coffee.sql`, `guestbook/02_photos.sql`; `wrangler r2 bucket create globeskimmers-media`; `wrangler deploy`; publish `legal/terms.html`. See `docs/BUILD_TEST_CHECKLIST.md`.
