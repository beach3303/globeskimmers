# GlobeSkimmers

A travel companion app — finders for places to eat, coffee, ATMs, restrooms, shopping,
convenience stores, money exchange and things to do, plus culture info, a passport/stamps
collection and a guestbook.

React 18 + Vite 6 + Tailwind, shipped to iOS and Android via Capacitor, backed by a
Cloudflare Worker over an owned Supabase/PostGIS places database with Google Places as a
paid fallback.

> **Working on this repo with Claude Code?** Read [`CLAUDE.md`](CLAUDE.md) — it is the
> current, verified reference for architecture, deployment, and the invariants that matter.

## Local development

**Prerequisites:** Node (unpinned — no `engines`/`.nvmrc`; developed on Node 24), npm.

```bash
git clone https://github.com/beach3303/globeskimmers.git
cd globeskimmers
npm install
```

Then create a `.env.local`. **Six variables are read**; there is no `.env.example`, and
`.env*` is gitignored, so the values come from the Supabase and Base44 dashboards:

```
VITE_SUPABASE_URL=https://bkaxadiyehddzkiuheea.supabase.co
VITE_SUPABASE_ANON_KEY=<public anon key from the Supabase dashboard>
VITE_BASE44_APP_ID=<app id>
VITE_BASE44_APP_BASE_URL=<backend url>
VITE_BASE44_FUNCTIONS_VERSION=<functions version>
VITE_ADMOB_PRODUCTION=          # optional; '1' serves production ads instead of test ads
```

The two Supabase values are **not optional** — they are passed straight into `createClient`
at module load, so a missing value throws `supabaseUrl is required` at import time and the
app renders a white screen. The app is also behind a sign-in gate, so you need a real
Supabase account to get past the login screen.

```bash
npm run dev
```

> ⚠️ **`npm run dev` talks to production.** The Worker URL is hardcoded and there is no
> staging environment, so browsing finders locally spends real Google Places API budget and
> writes analytics events to the live database.

See [`CLAUDE.md`](CLAUDE.md) for the full command list (`cap:sync`, `cap:ios`, `cap:android`,
`assets`) and for why `npm run typecheck` is not a clean gate.

## Deployment

| Target | How |
|---|---|
| Cloudflare Workers | **Automatic** on push to `main` — `.github/workflows/deploy-workers.yml`. No CI quality gate runs first. |
| iOS / Android | `npm run cap:ios` / `npm run cap:android`, then Xcode / Android Studio. Capgo for OTA updates. |
| Supabase SQL | Manual — paste `scripts/**/*.sql` into the Supabase dashboard SQL editor. |

Because a push to `main` deploys the Worker with nothing gating it, run the manual checks in
[`CLAUDE.md`](CLAUDE.md#before-you-push) before committing worker changes.

## Docs

- [`CLAUDE.md`](CLAUDE.md) — current architecture, deployment, conventions, invariants
- [`docs/PRODUCT_AUDIT_2026-08.md`](docs/PRODUCT_AUDIT_2026-08.md) — the live work queue
- [`docs/BUILD_TEST_CHECKLIST.md`](docs/BUILD_TEST_CHECKLIST.md) — append-only; what shipped vs what still needs activating
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — longer-horizon priorities

Older files in `docs/` are point-in-time work orders, not live references —
`docs/CLAUDE_CONTEXT.md` in particular is a March 2026 snapshot and is labelled as such.
