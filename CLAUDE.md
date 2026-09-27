# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start of Session

Read these, in order — they describe what is actually true today:

0. **`docs/PLANS.md`** — the founder's agreed plans: the build queue in order, open decisions, dated reminders. Update it the same day a plan changes.
1. **`docs/PRODUCT_AUDIT_2026-08.md`** — the current work queue (Tier 1 delivery → Tier 2 trust → Tier 3 engagement). The "Progress" block at the top lists what has already shipped.
2. **The bottom of `docs/BUILD_TEST_CHECKLIST.md`** — append-only, newest last. The only place that distinguishes *committed* from *actually deployed/activated*; per-item **Activate:** lines list SQL that still needs running.
3. **`docs/ROADMAP.md`** — longer-horizon priorities.

`docs/CLAUDE_CONTEXT.md` is a **March 2026 snapshot. Historical only — do not trust it.** It names the dead `cloudflare-worker-v7.6.js`, lists D1/R2 as "[PENDING]" when both are live, describes an architecture the code no longer uses, and gives tier labels that don't match the worker. Everything else in `docs/` is a point-in-time work order, not a live reference.

**For anything mechanical, the source of truth is the code, not the docs:** `wrangler.toml`, `package.json`, `.github/workflows/deploy-workers.yml`, and the worker file itself.

## Before You Push

**A push to `main` is a production deploy, and nothing gates it.** Pushing a change to `cloudflare-worker-*.js`, `globeskimmers-tts-worker.js`, or either `wrangler*.toml` triggers `.github/workflows/deploy-workers.yml`, which runs `wrangler deploy` immediately. There is no lint, typecheck, build, or test job in CI — the repo has no automated tests at all.

Neither CI job is conditioned on which file changed, so **a TTS-only edit also redeploys the API worker** from whatever is at HEAD. Never push with the worker in a half-finished state.

The de-facto pre-commit gate is manual (from `docs/MOBILE_HANDOFF.md`):

```bash
node --check cloudflare-worker-v7.12.js   # syntax-check the worker before every commit
npx eslint --quiet <changed page>          # lint passes clean today — keep it that way
npm run build                              # must succeed
npm run boot-check                         # boots dist/ in headless Chrome; fails on any uncaught error or empty #root.
                                           #   The ONLY gate that catches a free identifier (e.g. `const x = openPartner`
                                           #   with no import) — lint has no no-undef rule and Rollup doesn't check.
                                           #   That exact bug shipped a white screen on 2026-09-01.
```

Repo conventions: **one logical change per commit; show the diff before committing; ask before pushing.** Commit subjects are `Area: what changed`.

## Deployment

| Target | Trigger | Notes |
|---|---|---|
| **Cloudflare Workers** | **Automatic** — push to `main` touching `wrangler.toml`, `wrangler-tts.toml`, `cloudflare-worker-*.js`, or `globeskimmers-tts-worker.js` | `.github/workflows/deploy-workers.yml`, jobs `deploy-api` + `deploy-tts`. `workflow_dispatch` also available. Only credential is the repo secret `CLOUDFLARE_API_TOKEN` — **no local Cloudflare login needed to ship a worker.** |
| **Website** (`site/` → `globeskimmers-site` Worker, static assets) | **Automatic** — push to `main` touching `site/**` or `wrangler-site.toml` | `.github/workflows/deploy-site.yml`. Same `CLOUDFLARE_API_TOKEN`. The custom domains `globeskimmers.io` / `www.` are attached in the Cloudflare dashboard (Workers & Pages → globeskimmers-site → Domains & Routes), not in config. `site/app-ads.txt` must stay byte-identical to what AdMob verified. The contact form posts to the API worker's `/contact`; messages show under Admin Portal → Website messages. |
| **Native app** | Manual | `npm run cap:ios` / `npm run cap:android`, then Xcode/Android Studio. Capgo OTA for live updates. No frontend CI exists in this repo. |
| **Supabase migrations** | **Automatic** — push to `main` touching `supabase/migrations/**` | `.github/workflows/deploy-migrations.yml`, gated on the `production` environment so it can require approval. Locally: `npm run db:new` → `db:plan` → `db:push`. See `supabase/README.md`. The ~30 older `scripts/**/*.sql` were applied by hand and are historical — do not replay them. |
| **D1 SQL** | Manual | `npx wrangler d1 execute <db> --file=… --remote`. |

`wrangler` is **not** a project dependency — every local wrangler command goes through `npx wrangler`.

**Provision Cloudflare bindings before pushing a `wrangler.toml` that references them.** Every CI deploy failure to date had this cause: a D1/R2 binding declared in config but not yet created, which fails the whole worker deploy.

Docs that still say "the Mac must run `wrangler deploy`" (`docs/MOBILE_HANDOFF.md`, the **Activate:** rows in `docs/BUILD_TEST_CHECKLIST.md`) predate the Action and are obsolete **for the worker step only** — the SQL steps in those same rows are still required and still manual.

The website is a plain directory: no build step, no lint scope, no Vite involvement (Vite's root `index.html` is the app, `site/index.html` is the site). Edit the HTML directly and let the Action ship it.

Two things cannot be deployed from this repo at all: the `globeskimmers-airport-cache` worker (called from `src/pages/Transportation.jsx`, but no source and no wrangler config exist here), and Capgo bundles.

## Local Setup

Setting up a second machine: follow `docs/LAPTOP_SETUP.md` (tools, clone, the three local-only credentials, gates, OTA, restoring Claude's memory from `docs/claude-memory/`).

There is no `.env.example` and `.env*` is gitignored. `.env.local` needs six vars — the README documents only the first two:

```
VITE_SUPABASE_URL           # https://bkaxadiyehddzkiuheea.supabase.co
VITE_SUPABASE_ANON_KEY      # public client key; RLS guards the data, not secrecy
VITE_BASE44_APP_ID
VITE_BASE44_APP_BASE_URL
VITE_BASE44_FUNCTIONS_VERSION
VITE_ADMOB_PRODUCTION       # optional; '1' switches AdMob off test ads
```

The two Supabase vars have **no fallback**: `src/lib/supabaseClient.js` passes them straight into `createClient` at module load, so missing values throw `supabaseUrl is required` at import time — a white screen, not a degraded mode. The three Base44 vars resolve URL param → env → localStorage → `null`, and now feed only the admin/test pages.

The app is behind a hard sign-in gate (`src/App.jsx`): correct env vars alone aren't enough, you need a real Supabase account.

**`npm run dev` talks to production.** `WORKER_BASE` is hardcoded in `src/lib/callWorker.js` (and ~12 other `src/` files); there is no `VITE_WORKER_URL` and no staging worker. So local browsing spends real Google Places money, and `src/lib/analytics.js` posts every dev event to the live `/log-event` → D1 with no dev guard.

Node is unpinned — no `engines`, `.nvmrc`, or `packageManager`.

## Commands

```bash
npm run dev          # Vite dev server (plain @vitejs/plugin-react — the Base44 plugin is gone)
npm run build        # Production build to /dist/
npm run lint         # eslint . --quiet  — passes clean; treat as a real gate
npm run lint:fix     # ESLint auto-fix
npm run typecheck    # tsc -p jsconfig.json — ~571 PRE-EXISTING errors; NOT a clean gate.
                     #   Compare before/after counts; never expect zero.
npm run preview      # Preview production build
npm run cap:sync     # build + npx cap sync (BOTH platforms — founder rule 2026-09-27: iOS and Android always updated together)
npm run cap:ios      # build + sync both + open Xcode
npm run cap:android  # build + sync both + open Android Studio
npm run cap:all      # build + sync both + open Xcode AND Android Studio (a store release for both)
npm run ota          # build + sync both + Capgo upload to the production channel, version 1.0.<UTC yymmddHHMM>
                     #   CI=true + a pinned @capgo/cli: the CLI's interactive "Cloud Build · Onboarding" (an Appflow-migration wizard) hijacked the founder's upload on 2026-09-27
                     #   one Capgo bundle serves iOS and Android; Claude's upload is denied by the permission gate — the founder runs it
npm run assets       # @capacitor/assets icon/splash generation
```

## Architecture

```
iOS / Android (Capacitor) / Web
    ↓
React 18 Frontend (src/pages/*.jsx)        — Vite 6, Tailwind, Radix UI
    ↓  src/lib/callWorker.js  (attaches Supabase JWT; CapacitorHttp on native,
    ↓                          fetch + AbortController on web; 25s timeout)
Cloudflare Worker — globeskimmers-api (cloudflare-worker-v7.12.js)
    ├── KV  GLOBESKIMMERS_KV   — response cache
    ├── D1  DB                 — globeskimmers-events (analytics, affiliate_clicks)
    ├── D1  ATTRACTIONS_DB     — globeskimmers-attractions (curated seed data)
    ├── R2  MEDIA              — globeskimmers-media (guestbook photos)
    ↓
    ├── Supabase Postgres + PostGIS  — the OWNED planet places DB (~75M Overture
    │                                   rows) via PostgREST RPCs. Free. Tried FIRST.
    └── Google Places API (New) v1   — PAID fallback + on-tap enrichment (~$0.032/call)
```

Also deployed from this repo: **globeskimmers-tts** (`globeskimmers-tts-worker.js`, KV `TTS_CACHE`).

**The frontend calls the Worker directly.** `base44/functions/` is a **legacy tier, off the hot path** (last touched June 2026) — ~90 `callWorker()` call sites in `src/` versus 3 surviving `base44.functions.invoke()` calls, all in admin/debug pages. The Base44 SDK is still used for `auth.me()` and a few entity writes. Don't add new work to `base44/functions/`.

Worker secrets (set out of band via `npx wrangler secret put`, never supplied by CI): `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VIATOR_API_KEY`, `STAY22_API_TOKEN`, `EXCHANGERATE_API_KEY`, `TICKETMASTER_API_KEY`. Note both Supabase service-key names are read and only one call site has a fallback — set both.

## Working in the Worker

`cloudflare-worker-v7.12.js` is **13,515 lines / 766KB in one file with zero imports.** Never read it whole — `grep -n` for a symbol, then `sed -n 'START,ENDp'`. The router is a flat if-chain of ~92 `pathname ===` lines near the end (`grep -n "pathname ===" cloudflare-worker-v7.12.js`); that chain, not `src/lib/workerRoutes.js`, is the authoritative route inventory. Several live routes have no `ROUTE` constant and are called by string literal.

`cloudflare-worker-v7.6.js` is **dead legacy** — nothing references it. `cloudflare-worker/handlers/*.js` are reference copies and are **not** bundled; the real handlers are inline in v7.12.

## Key Directories

- `src/pages/` — 31 page components. 29 are registered in `src/pages.config.js` and routed by `src/App.jsx` as `/<PageKey>`; `GenerateIcon.jsx` and `TestAPI.jsx` are unrouted.
  **`src/pages.config.js` says "AUTO-GENERATED — do not edit". That header is a lie**: the Base44 Vite plugin that generated it is gone, so a new page must be added to `PAGES` **by hand** or it 404s. Build links with `createPageUrl` from `src/utils/`.
- `src/components/` — 14 domain subdirs (`a11y/ ads/ auth/ coffee/ home/ location/ maps/ onboarding/ passport/ redesign/ restaurants/ search/ shopping/ ui/`) plus ~23 loose top-level components.
- `src/components/ui/` — shadcn/Radix primitives. Do NOT edit or lint.
- `src/lib/` — `callWorker.js`, `supabaseClient.js`, `AuthContext.jsx`, `analytics.js`, query client, utils.
- `base44/functions/` — 23 legacy Deno functions (`<name>/entry.ts`). Off the hot path.
- `scripts/` — SQL (Supabase + D1) and data-pipeline tooling.

## Path Alias

`@/*` → `./src/*` — declared in **both** `jsconfig.json` and `vite.config.js`. Keep them in sync; the Vite side used to come from the Base44 plugin and is now explicit.

## State Management

- **Server state:** @tanstack/react-query (`refetchOnWindowFocus: false`, `retry: 1`)
- **Auth:** `src/lib/AuthContext.jsx` — **Supabase** auth (replaced Base44 auth; `AuthProvider` / `useAuth` unchanged). Sessions persist via `@capacitor/preferences` on native.
- **Location:** `src/components/location/LocationContext.jsx`, mounted in `src/Layout.jsx`. `locationMode` is `"current"` (GPS, default) or `"navigate"` (manual). A separate localStorage cold-open preference is `'ask'` (default) | `'current'` | `'continue'`.
- **Font scale:** `src/components/a11y/FontScaleContext.jsx`, mounted outermost in `src/App.jsx`.
- There is **no theme system** — the theme picker was dropped. Ignore any doc that mentions `ThemeContext` or "4 themes".

## Linting Scope

ESLint applies rules ONLY to `src/components/**` (minus `ui/`), `src/pages/**`, and `src/Layout.jsx`. Everything else resolves to **zero** rules — including `src/lib/`, `src/components/ui/`, the worker files, `scripts/`, root configs, and — easy to miss — `src/App.jsx`, `src/main.jsx`, `src/hooks/`, and `src/utils/`. Only 9 rules are active; the explicit `rules` block in `eslint.config.js` overrides the spread-in recommended sets.

## Grep Hygiene

Scope repo-wide searches to `src/`, or use `git grep`. After the first `npm run cap:sync`, two ~2.4MB built bundles land in `ios/App/App/public/assets/` and `android/app/src/main/assets/public/assets/` — untracked, but **not** covered by `.claudeignore`, so a naive `grep -r` returns duplicate hits from compiled output.

## Critical Patterns

- **Owned-first, Google-as-fallback.** Default browse is served free from the Supabase `nearby_*` RPCs; the worker falls through to paid Google only when the owned result has fewer than `OWNED_MIN_BROWSE` (5) places, or when a query/cuisine filter is active. Preserve this — it is the core cost design. A Google call is ~$0.032.
- **Restaurant intent tiers** (`TIER_LABELS` in `cloudflare-worker-v7.12.js`): 1 = **Dish Specialist**, 2 = **Authentic Match**, 3 = **Related**, 4 = **Serves It**. Tier 5 is noise and is dropped before the response. Frontend badge labels in `src/pages/PlacesToEat.jsx` must be kept in sync. (Older docs give a different 1–4 wording — the code above wins.)
- **Nearby type fan-out** is skipped when advanced filters are on, or a **non-dish** text query is present (`skipNearby`). Dish queries still fan out. When skipped, the list collapses to the active venue-chip types (bakery / bars / sports_bar), which is empty unless one of those chips is on — so a plain text search does yield an empty fan-out.
- **Umbrella cuisines:** "Asian" = chinese / japanese / korean / thai / vietnamese / filipino + `ramen_restaurant` + `sushi_restaurant`. Indian and Middle Eastern are deliberately excluded — `indian` is its own umbrella, `middle_eastern_restaurant` belongs to `mediterranean`.
- **Cache keys:** `generateCacheKey` hashes prefix + lat/lng (1 decimal) + radius + query + types + includedType. **Filters are appended separately as a `filterSuffix` by each handler** from openNow / minRating / priceLevels. Adding a new filter means updating the suffix, or you get stale cross-filter hits.
- **Cache TTLs** (`CONFIG.CACHE_TTL`): text search 12h fresh + 12h stale-while-revalidate (24h total); nearby 3d fresh + 4d SWR (7d total); details & photos 90d; dietary 12h.
- **No radius slider.** Every finder defaults to a 25-mile wide net, nearest-first. 25 is a ceiling, not a constant — empty/error states still render an "Expand Radius" button that steps up by 5 capped at 25, and RestroomFinder's urgent-GPS path starts at 5mi and auto-widens.

## Google Places API — Field Masks

- `places.serviceOptions` is **not** a Google field — build service tags locally from `dineIn` / `outdoorSeating` / `takeout` / `delivery`.
- `contextualContents.*` must be requested **without** the `places.` prefix. `places.contextualContents` returns 400 INVALID_ARGUMENT because it is a top-level sibling of `places[]`, not a member.
- `places.shortFormattedAddress` and `places.accessibilityOptions` **are valid** and are in the live `SEARCH_FIELD_MASK`. Older docs calling them 400-causing are wrong — don't strip them.

## Design Preferences

- Clean, sophisticated, space-efficient — no playful or cluttered UI
- Honest UX — show fallback disclaimers when results aren't great (`FallbackDisclaimer`, gated on the worker's `fallbackInfo.needed`)
- Quality over quantity — a stated preference, not a numeric contract (finders render 20 and page +20)
- No freshness color dots — just "Updated Mar 15" style text
- Always label review sources (Google vs GlobeSkimmers)
- AI-written place copy is guarded by FORBIDDEN-word lists on `/ai-details`, `/attraction-ai-details`, and `/atm-ai-details`. `/restroom-ai-details` instead uses `"not_confirmed"` / `"unknown"` for anything unsupported — never guess.
