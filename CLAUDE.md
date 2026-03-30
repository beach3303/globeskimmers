# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start of Session

Read `docs/CLAUDE_CONTEXT.md` first — it is the authoritative reference for component versions, known bugs, implementation priorities, and design preferences.

## Commands

```bash
npm run dev          # Start Vite dev server (HMR via Base44 plugin)
npm run build        # Production build to /dist/
npm run lint         # ESLint check (--quiet)
npm run lint:fix     # ESLint auto-fix
npm run typecheck    # TypeScript check via jsconfig.json
npm run preview      # Preview production build
```

## Architecture

```
iOS/Web Browser
    ↓
React 18 Frontend (src/pages/*.jsx)           — Vite 6, Tailwind CSS, Radix UI
    ↓
Base44 Deno Functions (base44/functions/*.ts)  — auto-deploy via Base44/git push
    ↓
Cloudflare Worker (cloudflare-worker-v7.12.js) — MANUAL deploy to Cloudflare dashboard
    ├── KV Cache (GLOBESKIMMERS_KV)
    │   ├── Text search: 12hr TTL
    │   ├── Nearby search: 3-day TTL
    │   └── Details/Photos: 90-day TTL
    └── Secret: GOOGLE_API_KEY
    ↓
Google Places API (New) v1
```

**Three deployment targets:**
- **Frontend:** Push to GitHub → Base44 auto-syncs → CDN
- **Backend functions** (`base44/functions/*/entry.ts`): Auto-deploy via Base44 CLI or git push
- **Cloudflare Workers** (`cloudflare-worker-v7.12.js`, `globeskimmers-tts-worker.js`): Manual deploy via `wrangler deploy`

## Key Directories

- `src/pages/` — 24 page components (PlacesToEat, Coffee, ATMFinder, etc.)
- `src/components/` — Feature components organized by domain (restaurants/, coffee/, theme/, location/, maps/, etc.)
- `src/components/ui/` — shadcn/Radix primitives (do NOT lint or edit these)
- `src/lib/` — AuthContext, query-client, utils (excluded from jsconfig paths)
- `src/api/` — Base44 SDK client init
- `base44/functions/` — Backend Deno/TypeScript functions (17 functions)

## Path Alias

`@/*` → `./src/*` (configured in jsconfig.json)

## State Management

- **Server state:** @tanstack/react-query (refetchOnWindowFocus: false, retry: 1)
- **Auth:** AuthContext (`src/lib/AuthContext.jsx`) — Base44 SDK auth
- **Theme:** ThemeContext (`src/components/theme/ThemeContext.jsx`) — 4 themes with per-page color overrides
- **Location:** LocationContext (`src/components/location/LocationContext.jsx`) — dual mode: GPS ("current") or manual ("navigate")

## Linting Scope

ESLint targets only: `src/components/`, `src/pages/`, `src/Layout.jsx`. It ignores `src/lib/` and `src/components/ui/`.

## Environment Variables

Required in `.env.local`:
```
VITE_BASE44_APP_ID=<app_id>
VITE_BASE44_APP_BASE_URL=<backend_url>
```

## Critical Patterns

- **Intent-aware restaurant search**: `getRestaurants` (v5.1) uses tier system (1=Authentic, 2=Specialist, 3=Has It, 4=Not Specialist). When text search is provided, `nearbyTypeList = []` to avoid query spam.
- **Umbrella cuisines**: "Asian food" = Chinese/Japanese/Korean/Thai/Vietnamese/Filipino ONLY (not Indian/Middle Eastern).
- **Cost optimization**: Every Google API call costs ~$0.032. Cache aggressively, minimize calls. Default page load reduced to 6 calls.
- **Worker cache keys include filter params** to prevent stale cross-filter cache hits.

## Design Preferences

- Clean, sophisticated, space-efficient — no playful or cluttered UI
- Honest UX — show fallback disclaimers when results aren't great
- Quality over quantity — 6 great matches > 20 mediocre ones
- No freshness color dots — just "Updated Mar 15" style text
- Always label review sources (Google vs GlobeSkimmers)

## Google Places API — Invalid Fields (cause 400)

Do NOT use: `places.shortFormattedAddress`, `places.serviceOptions`, `places.accessibilityOptions`
