# Globeskimmers — Pending Builds Roadmap

Everything pending, in rough priority order. Check off as done. See `BUILD_TEST_CHECKLIST.md` for per-build test steps.
Legend: ⬜ to do · ✅ done · ⏳ external/time-gated

## Tier 0 — Activate what's already built (quick ops)
1. ✅ **Redeploy the worker** — done 2026-07-17 (527.88 KiB; demand queries + Unsplash code live).
2. ✅ **Set the Unsplash key** — done 2026-07-17; VERIFIED: Boise (non-seeded) returns a "Where to next" row with real photos + attribution.
3. ✅ **Push frontend to `main`** — done 2026-07-17 (`c12e982..6ca9f98`, 18 commits); Base44 auto-deploying web.

## Tier 1 — Finish the engagement feature (test + polish)
4. ⬜ **Device-test pass** — home-clock, auto-follow (move cities), rows render, card→detail, Settings auto-follow toggle.
5. ✅ **Search-location modal overflow fix** — already done (LocationModePicker has `items-start` + safe-area paddingTop + maxHeight + `flex-1 overflow-y-auto`); verified 2026-07-19.
6. ✅ **Photos on cards** — Unsplash-fallback per owned card LIVE + verified 2026-07-17 (LA 10/10 cards have photos). Later precision upgrade: backfill Wikimedia landmark photos into `ATTRACTIONS_DB` (owned, exact building).
7. ✅ **Fuller feed** — rows draw independently; LIVE + verified 2026-07-17 (LA now 4 distinct photo-forward rows, up from 2). A bigger "lead-with-feed above the tiles" restructure is still available if wanted.

## Tier 2 — Near-term fixes / features
8. ✅ **Analytics growth pack** — DAU/WAU/MAU + return-rate + stickiness + taps/session + active-users chart LIVE (`bdce98c`, deployed `5265dcd0`); view in Admin→Analytics (test later). (Future refinements: full cohort D1/D7/D30 retention, monthly-signups rollup, onboarding funnel.)
9. ⬜ **AdMob iOS Marketing URL** — add `https://globeskimmers.io` on the next iOS version (finishes app-ads.txt iOS verification).
10. ⬜ **Onboarding cut** — 14 steps → essential, framed as "passport creation"; infer locale prefs, defer the rest.
11. ✅ **Schema check** — DONE 2026-07-19: `show_home_flag`/`show_home_country_info` columns added to `profiles` via ALTER (Supabase). Settings home-country time/flag toggles now persist.
12. ⬜ **"Drive X mi" → real routed time** — NOTE 2026-07-19: not a quick fix; there's no "Drive X mi" text in the app yet. This is a real reachability build (needs a routing source), part of #19.
13. ⬜ **Wave 2 engagement** — saves→Supabase → "Because you saved" row + Wishlist Pulse.

## Tier 3 — Big roadmap (each its own project)
14. ⬜ **Push notifications** — weather-contrast push (greenfield: plugin + APNs/FCM + cron + tokens table).
15. ⬜ **Passport + stamps + shareable "My Passport" map** — personal collection + viral growth loop.
16. 🟡 **Public Guestbook** — BUILT 2026-07-20 (`452e77b`,`f04d9b6`): generic guestbook (schema `scripts/guestbook/01_schema.sql` in `api` schema; 6 Worker endpoints; `src/components/Guestbook.jsx` on the attraction page). Public read, JWT-gated sign, guided prompts, edit/delete own, report+auto-hide (Apple 1.2), hate-slur guard (keeps honest negativity), admin events. **Needs: run the SQL + wrangler deploy.** Fast-follows: extend to restaurant/coffee cards (component is generic), photos, GPS-verified visit gate, anonymize-on-delete in the delete-account flow.
17. ⬜ **Wishlist → affiliate engine** — apply to Viator/GetYourGuide NOW; SubID→D1 clicks + conversion import.
18. 🟢 **Global places DB — PLANET LIVE 2026-07-19**: ALL **~75.6M** Overture places worldwide loaded to Supabase PostGIS + serving via `/places/nearby-owned` (verified Paris/Tokyo/Sydney). Owned Wikimedia photos + owned address on attraction pages. ~$90/mo, owned forever. Pipeline in `scripts/places-pilot/planet/`. **⏰ Post-load: scale compute Large→Medium; drop table places_old.** Next moat layers: own reverse-geocode → MapLibre map → monthly refresh cron.
    - Also done this session: attraction "Explore more" → full page, fullscreen swipe galleries everywhere, photo quality filter (iconic/real only), Reviews tab → **Guestbook placeholder** (real guestbook = #16).
19. ⬜ **Reachability / feasibility (premium)** — ferry/cable-car-aware, day-trippable vs overnight, last-return schedules.
20. ⬜ **AI itinerary planner (flagship subscription)** — multi-day, group/split/collaborative, food+route, personalized.
21. ⬜ **Merchant monetization** — claim + menu + events, $19.99/large-attraction tiers, hotel front-page; web portal + Stripe.
22. ⬜ **B2B travel-demand data product** — read-side built; package + sell aggregate insights later.

## Tier 4 — Other captured / post-launch
23. ⬜ **Culture Info upgrade** — two-layer country/city/region rebuild.
24. ⬜ **Basic Phrases audio** — for the remaining ~45 languages.
24b. ⬜ **Stadium game-day stamps** (founder, 2026-08-31) — stamp attending a GAME, not just the venue: GPS at a stadium + date, cross-referenced against that venue's events (Ticketmaster key already in the worker) → stamp carries matchup + date ("Watched a game at Crypto.com Arena · Lakers vs Celtics · 24 AUG 2026"). Ledger stamp layout already fits. Needs: venue↔Ticketmaster id mapping, event lookup at stamp time, meaning-model note (an event mark, not a new kind).
25. ⬜ **Product-search real shopping API** — live listings + find-cheaper (DataForSEO / SearchApi).
26. ⬜ **Transportation affiliate / car service** — bookable rides/transfers.
27. ⬜ **Google OAuth publish** (Testing→Production) + **web OAuth redirect URLs** in Supabase.
28. ⬜ **Passkeys** — deferred post-launch (native origin blocker).

## Time-gated (external clocks)
29. ⏳ **Google Play production** — apply ~**July 19** once the 14-day / 12-tester gate clears.
