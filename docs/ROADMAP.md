# Globeskimmers — Pending Builds Roadmap

Everything pending, in rough priority order. Check off as done. See `BUILD_TEST_CHECKLIST.md` for per-build test steps.
Legend: ⬜ to do · ✅ done · ⏳ external/time-gated

## Tier 0 — Activate what's already built (quick ops)
1. ⬜ **Redeploy the worker** (`wrangler deploy`) — ships the demand admin queries (#9) + Unsplash code (#10), currently committed but not live.
2. ⬜ **Set the Unsplash key** (`wrangler secret put UNSPLASH_ACCESS_KEY`) — turns on global "Where to next" rows.
3. ⬜ **Push frontend to `main`** (Base44 auto-deploys web) so web users get rows / auto-follow / card-detail — or stay device-only for now.

## Tier 1 — Finish the engagement feature (test + polish)
4. ⬜ **Device-test pass** — home-clock, auto-follow (move cities), rows render, card→detail, Settings auto-follow toggle.
5. ⬜ **Search-location modal overflow fix** — pin the input below the notch, scroll only results (`LocationModePicker.jsx`).
6. ⬜ **Photos on cards** — `ATTRACTIONS_DB` has zero `photo_url`. Backfill Wikimedia (owned, no key) OR Unsplash-fallback per attraction (reuses `fetchUnsplashPhoto`).
7. ⬜ **More feed-forward layout** — more rows, photo-forward cards, lead with the feed above the tiles.

## Tier 2 — Near-term fixes / features
8. ⬜ **Analytics growth pack** — DAU/WAU/MAU, retention (D1/D7/D30), stickiness, monthly signups, rows-per-session, onboarding funnel.
9. ⬜ **AdMob iOS Marketing URL** — add `https://globeskimmers.io` on the next iOS version (finishes app-ads.txt iOS verification).
10. ⬜ **Onboarding cut** — 14 steps → essential, framed as "passport creation"; infer locale prefs, defer the rest.
11. ⬜ **Schema check** — verify `show_home_flag` / `show_home_country_info` actually persist in Supabase `profiles`.
12. ⬜ **"Drive X mi" → real routed time** — ferry/transit-aware time instead of raw distance (immediate reachability honesty fix).
13. ⬜ **Wave 2 engagement** — saves→Supabase → "Because you saved" row + Wishlist Pulse.

## Tier 3 — Big roadmap (each its own project)
14. ⬜ **Push notifications** — weather-contrast push (greenfield: plugin + APNs/FCM + cron + tokens table).
15. ⬜ **Passport + stamps + shareable "My Passport" map** — personal collection + viral growth loop.
16. ⬜ **Public Guestbook** — UGC + Apple 1.2 moderation (report/block/filter); photos as a fast-follow.
17. ⬜ **Wishlist → affiliate engine** — apply to Viator/GetYourGuide NOW; SubID→D1 clicks + conversion import.
18. ⬜ **Global places DB** — Overture/OSM pilot → regional → global; own reverse-geocode; MapLibre map (Postgres+PostGIS).
19. ⬜ **Reachability / feasibility (premium)** — ferry/cable-car-aware, day-trippable vs overnight, last-return schedules.
20. ⬜ **AI itinerary planner (flagship subscription)** — multi-day, group/split/collaborative, food+route, personalized.
21. ⬜ **Merchant monetization** — claim + menu + events, $19.99/large-attraction tiers, hotel front-page; web portal + Stripe.
22. ⬜ **B2B travel-demand data product** — read-side built; package + sell aggregate insights later.

## Tier 4 — Other captured / post-launch
23. ⬜ **Culture Info upgrade** — two-layer country/city/region rebuild.
24. ⬜ **Basic Phrases audio** — for the remaining ~45 languages.
25. ⬜ **Product-search real shopping API** — live listings + find-cheaper (DataForSEO / SearchApi).
26. ⬜ **Transportation affiliate / car service** — bookable rides/transfers.
27. ⬜ **Google OAuth publish** (Testing→Production) + **web OAuth redirect URLs** in Supabase.
28. ⬜ **Passkeys** — deferred post-launch (native origin blocker).

## Time-gated (external clocks)
29. ⏳ **Google Play production** — apply ~**July 19** once the 14-day / 12-tester gate clears.
