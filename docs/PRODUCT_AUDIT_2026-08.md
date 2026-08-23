# Product Audit — "Phenomenal + Delivers Flawlessly" (2026-08-23)

Four parallel audits (search quality · reliability/speed · trust/honesty · engagement) against the bar:
**a traveler always GETS what they asked for — accurate, fast, trustworthy — and it feels alive.**
Weighted toward **rock-solid delivery** (founder priority). Ranked into build tiers. Tick as done.

Big picture: the app is far more built than the old redesign plan says (home has ~10 living sections
already). The gaps are concentrated in: (a) **owned-DB browse falling back to nothing**, (b) reliability
plumbing (timeouts/races/tz), (c) a few **unlabeled AI surfaces**, (d) a dormant personalization engine.

---

## ✅ Progress (2026-08-23)
**Shipped + LIVE:** T1.1 (Google fallback on browse — worker deployed v adb15c4b, smoke-tested) · T1.9 (coffee boba/tea search — deployed) · T1.2 (callWorker timeout — pushed) · T1.3 (cancel guards — pushed) · T1.12 (Things-to-Do radius refetch — pushed) · T1.4 partial (no-location stops spinner; still need the "Choose a location" CTA).
**Committed, awaiting push:** T1.7 (Things-to-Do nearest-first) · T1.13 (Shopping stale count) — commit 496a749.
**Next batch (worker, one deploy):** T1.6 category chips · T1.7b Shopping ranking · T1.10 shop-dish fallback · T1.14 non-blocking LLM · T1.5 timezone (frontend) · T1.11 double-fetch · T1.8 coffee open-now · T1.15 enrich batching.

## TIER 1 — DELIVERS (the app must reliably return the right thing). DO FIRST.

- [ ] **T1.1 — Google fallback on default browse (Eat + Coffee).** Owned-DB browse returns `{places:[],count:0}` with NO Google fallback → **blank "nothing found" in any city the owned DB doesn't cover** (the most common first action). Fall through to the existing Google path when owned rows < N. Worker `handleRestaurantsDispatch:11316`, `handleCoffeeOwned:11472-11519`. **[worker] M — TOP PRIORITY**
- [ ] **T1.2 — Request timeout in `callWorker`.** No AbortController/timeout anywhere → slow/down worker = **infinite spinner app-wide**, error UI never shows. Add ~12–15s timeout (web AbortController + native connect/readTimeout) → `{data:null,error:'timeout'}`. `src/lib/callWorker.js:35,39`. **[frontend] S**
- [ ] **T1.3 — Race guards on Coffee/Shopping/ATM/ThingsToDo.** No `ignore` flag → fast radius/filter/location changes let a stale fetch overwrite fresh results. Copy PlacesToEat's pattern (`ignore=false … if(ignore)return … return ()=>{ignore=true}`). `CoffeeFinder:503`, `Shopping:279`, `ATMFinder:578`, `ThingsToDo:883`. **[frontend] S**
- [ ] **T1.4 — No-location cold start = permanent spinner.** Finders init `loading=true`, fetch early-returns on missing lat/lng without clearing loading → endless spinner + no CTA. Add `setLoading(false)` + "Choose a location" empty state → opens LocationModePicker. All finders. **[frontend] S/M**
- [ ] **T1.5 — Open/Closed uses DEVICE clock, not place timezone.** Browsing Tokyo from the US shows wrong Open/Closed + "· N open" counts. Trust Google `openNow` for non-local cities, or apply `utcOffsetMinutes`. `PlacesToEat:188`, `CoffeeFinder:78`, `Shopping:70`. **[frontend] M**
- [ ] **T1.6 — ThingsToDo category chips hide most fetched results.** Client re-filter `activityCategory===category` drops arcades/bowling/rafting/mini-golf that the worker DID fetch. Drop the client re-filter (trust worker) or widen `gaActivityType`. `ThingsToDo:979`; worker `7801-7816`. **[frontend or worker] M**
- [ ] **T1.7 — Nearest-first everywhere.** (a) ThingsToDo browse is quality-sorted not distance-sorted (`ThingsToDo:969-981`). (b) Shopping caps distance score at 6mi + ignores chosen subtype in ranking (worker `7083-7092,7178`). Sort browse by distance; scale distance continuously + add subtype-match bonus. **[frontend + worker] S/M**
- [ ] **T1.8 — Coffee "Open Now" / rating sort always return zero on browse.** Owned coffee rows have `isOpen:null, rating:null` → Open-Now toggle empties the list, rating sort is a no-op. Gray the toggle until hours load, or enrich the visible set, or route to Google. `CoffeeFinder:547-567`; worker `11508-11510`. **[frontend/worker] M**
- [ ] **T1.9 — Coffee keyword search excludes boba/tea/matcha.** Hard `includedType:'cafe'` drops `bubble_tea_shop`/`tea_house`/`dessert_shop` — exactly what matches "boba"/"matcha". Drop/widen per query. Worker `7966`. **[worker] S**
- [ ] **T1.10 — Strict shop-type dish misses = bare "No exact match".** bagels/donuts/frozen-yogurt/cheesecake return empty (fallback map is cuisine-keyed only). Map shop-type tier-1s to bakery/dessert umbrellas or relax strict when strict=0. Worker `10629-10645`. **[worker] S**
- [ ] **T1.11 — Wasted double-fetch on city entry.** `suggestedRadius` effect updates radius after the first fetch → a second full Google fan-out per entry (~$0.03/call). Seed radius via lazy init/ref. All finders (`PlacesToEat:966`, etc.). **[frontend] S**
- [ ] **T1.12 — ThingsToDo radius change may not refetch.** `radius` missing from the fetch effect deps → stale results after a radius change. Add `radius` to deps. `ThingsToDo:936`. **[frontend] S**
- [ ] **T1.13 — Stale result count while loading/error (Shopping, ATM).** Count badge shows previous category's number during a new fetch. Gate on `loading` / clear on fetch start. `Shopping:383`. **[frontend] S**
- [ ] **T1.14 — LLM parse-intent blocks even when a DISH matched.** "spicy ramen"/"vegan burger" pay a blocking Claude round-trip before any Google fetch. Only call LLM when `intent.kind==='GENERAL'`, or fire non-blocking. Worker `10110-10139`. **[worker] S**
- [ ] **T1.15 — Unbatched enrich-owned: ~20 calls/screen on mount (Eat, Shopping).** Batch to one call for the visible set, or enrich on expand (like Coffee). `PlacesToEat:648`, `Shopping:116`. **[frontend/worker] M**

## TIER 2 — TRUST (honesty = the foundation of daily-use + the long game).

- [ ] **T2.1 — GS VERDICT can't warn you off a bad place.** AI Details forbids negative words, "OMIT negatives entirely", floors stars at ≥1 ("benefit of the doubt") — yet is shown as "💯 GS VERDICT". A genuinely bad/unsafe place still reads 100% positive. Allow honest low tiers + factual caveats, or add "AI take, not a quality guarantee — check Google reviews". Worker `2565,2589,2644-2650`; `AIDetailsSection:275-303`. **[worker + UI] M**
- [ ] **T2.2 — Star ratings shown with NO "Google" source label.** Violates "always label review sources". Add a small "Google" label by the star cluster in the shared card/popup renderers. ~7 finders. **[frontend] S**
- [ ] **T2.3 — AI-estimate label sweep.** RightNowStrip "🔥 Trending" (ungrounded Haiku as live trends, no label), Cultural Info Safety/scams card (no AI label), ATM AI Details tags AI copy as "from reviews". Add the "(AI estimate)" line these siblings already use; reframe "Trending" → "most-hyped (AI picks)". `RightNowStrip:31,97`; `CultureInformation:263`; `AtmAIDetails:60`. **[frontend] S**
- [ ] **T2.4 — "🚗 Drive / ✈️ Flights" from straight-line distance.** Island/ferry spots 20mi crow-flies labeled "Short Drive". Drop the mode verb or gate behind routing; caveat "≈X mi (straight-line)". Worker `7888,7924…`; `ThingsToDo:375`. **[worker/frontend] M (S for caveat only)**
- [ ] **T2.5 — Cold start restores "navigate" mode for live-GPS users.** Opens showing the *previous* city as a deliberate pick until the (one-shot, GPS-dependent) nudge fires. Persist + restore the last *mode*, or verify GPS first. `LocationContext:150-154`. **[frontend] M**

## TIER 3 — PHENOMENAL (engagement/delight). After the base is solid.

- [ ] **T3.1 — Wire the dormant `homeContext` engine.** `scoreCategories`/`getRowPlan`/`buildHomeContext` (time/weather/journey-aware ranker) is wired to NOTHING. Context-sort the finder tiles + build the "arrival essentials / right-now" synthetic chip strip. Biggest under-used asset. **M**
- [ ] **T3.2 — Alive hero.** Add daypart greeting ("Good morning") + a destination photo (reuse worker `whereToNext` Openverse photos). `Home.jsx:620-774`. **M**
- [ ] **T3.3 — Cap/prioritize sections (~3-4/load).** Up to ~8 carousels stack → clutter (violates "calm, not chaotic"). `.slice` the non-essential by journeyMode. `Home.jsx:818-859`. **S-M**
- [ ] **T3.4 — Show wanderlust (RightNowStrip) in planning mode.** Viral-foods card is hidden exactly when someone's dreaming about a trip. One condition. `Home.jsx:818`. **S**
- [ ] **T3.5 — Reward returning.** Store `gs_last_home_open`; badge Events "N new this week" + Stamp progress "4 near here · 8 to go" (Passport already tracks earned). **M**
- [ ] **T3.6 — Persona re-rank on Home.** Persona `props` used only in VibeBundles; re-rank HomeRows/Stamps client-side + promote a lightweight persona chooser. **M**
- [ ] **T3.7 — Skeletons on the always-populated sections** (RightNowStrip, HomeRows) to kill janky pop-in. **S-M**

---

## Recommended sprints
- **Sprint 1 = TIER 1** (rock-solid delivery). Most are S-effort and cluster in shared files. Split: frontend reliability commit (T1.2/1.3/1.4/1.11/1.12/1.13) + worker delivery commit (T1.1/1.9/1.10/1.14 + shopping/coffee) + the tz + category fixes. One `wrangler deploy` for the worker parts.
- **Sprint 2 = TIER 2** (trust/honesty labels + GS verdict).
- **Sprint 3 = TIER 3** (engagement/phenomenal) — folds in the redesign direction.
- Then **Thread B**: city prides → stamps ([[project_city_prides_stamps]]).

Note: the redesign plan `enumerated-finding-pancake.md` is STALE (home already built out) — treat THIS doc as the source of truth for the rebuild.
