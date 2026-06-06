# D1 attractions database — setup guide

This is what you run on your Mac to provision the database, seed it, and deploy the Worker code. All commands are copy-pasteable.

## What this is

A Cloudflare D1 database (`globeskimmers-attractions`) that stores a hand-curated list of marquee + regional attractions for Globeskimmers' top 25 launch cities and 25 launch countries. The ThingsToDo page queries it instead of running ~70 Google Places searches per page open. **Result: 30s mobile load → ~500ms.**

## Costs

**$0.** Cloudflare's D1 free tier is 5,000,000 reads/day and 100,000 writes/day. Globeskimmers won't sniff that anywhere near launch scale. Storage of ~300 attraction rows is ~50 KB — also free.

## Step 1 — provision the database

From the repo root:

```bash
cd "/Users/globeskimmers/Desktop/CODES PROTECT/globeskimmers-cacf36e4-10"
wrangler d1 create globeskimmers-attractions
```

Wrangler will print something like:

```
✅ Successfully created DB 'globeskimmers-attractions'
✨ Database created successfully!

[[d1_databases]]
binding = "DB"
database_name = "globeskimmers-attractions"
database_id = "abc12345-67de-89f0-ab12-3456789abcde"
```

Copy that **database_id** — you'll paste it into wrangler.toml in the next step.

## Step 2 — add the binding to wrangler.toml

Open `wrangler.toml`. You'll find one existing D1 binding (the analytics database, binding name `DB`). Add a SECOND one for attractions:

```toml
[[d1_databases]]
binding = "ATTRACTIONS_DB"
database_name = "globeskimmers-attractions"
database_id = "<paste the id from step 1>"
```

The binding name **must be `ATTRACTIONS_DB`** — the Worker code looks for that exact name.

## Step 3 — create the schema

```bash
wrangler d1 execute globeskimmers-attractions \
  --file=cloudflare-worker/sql/schema.sql \
  --remote
```

The `--remote` flag is critical — without it, wrangler creates the table in your LOCAL D1 (only useful for local Worker dev), not in the production D1 your deployed Worker will read.

You should see:

```
🌀 Executing on remote database globeskimmers-attractions
🌀 Executing the SQL...
✅ Executed 6 commands
```

(6 commands = the CREATE TABLE + the 5 CREATE INDEX statements.)

## Step 4 — seed the data

```bash
wrangler d1 execute globeskimmers-attractions \
  --file=cloudflare-worker/sql/seed_attractions.sql \
  --remote
```

This inserts the ~250-300 hand-curated attractions across the launch cities and countries. Takes ~10 seconds. You should see:

```
🌀 Executing on remote database globeskimmers-attractions
🌀 Executing the SQL...
✅ Executed 1 commands
🚣 Executed 287 queries...
```

(Exact count varies after dedup.)

## Step 5 — deploy the Worker

```bash
wrangler deploy
```

The Worker now has a new endpoint: `POST /attractions/nearby`. Within ~30 seconds of deploy, Cloudflare's edge servers worldwide are serving the new endpoint.

## Step 6 — verify

Run the smoke test:

```bash
curl -X POST https://globeskimmers-api.maizasimeon.workers.dev/attractions/nearby \
  -H "Content-Type: application/json" \
  -d '{"latitude":48.8566,"longitude":2.3522,"radiusKm":20}' | jq '.tookMs, .attractions | length, .attractions[0].name'
```

Expect:
- `tookMs`: under 100 (usually 20-60)
- `attractions length`: ~10-15 (Paris-area entries)
- First attraction name: probably **Eiffel Tower** or **Louvre Museum** (sorted by marquee + rating)

If you see `tookMs: 0` and an empty array, the binding isn't attached or the seed didn't insert — re-run Steps 2-4.

## Step 7 — confirm ThingsToDo is now fast

Open the app, switch to a location near one of your seeded cities (Paris, Tokyo, NYC, Bangkok, etc.), tap **Things to Do**. The page should fill within 1 second. Compare to the old behavior in a non-seeded city (e.g. Boise) — you'll see the existing slower flow as a fallback.

## Phase B: auto-seeding for non-launch cities

Phase A ships with 360 hand-curated attractions across the top 25 cities + 25 countries. Phase B extends this with **automatic self-seeding** — when the first user visits a city not in the launch set (Boise, Tagbilaran, anywhere), the Worker silently runs a discovery + seed pass in the background. Every subsequent visitor to that city gets the fast D1 path.

### How it works (no user-facing UX change)

1. User in **Boise** opens ThingsToDo.
2. `getActivities` calls `/attractions/nearby` with `cityName=Boise`, `countryName=United States`.
3. D1 returns 0 results (Boise not in launch seed).
4. Worker still returns instantly (~50ms) so the existing Places fallback handles this user's view.
5. **In the background**, `ctx.waitUntil` runs a seed task: 8 Places searches for staple categories → quality filter (rating ≥ 4.0, reviews ≥ 100, category in the allowed list) → INSERT INTO attractions with `source = 'auto-seeded'`.
6. The next user in Boise → D1 returns the seeded attractions → fast path.

### Apply the Phase B schema migration

```bash
cd "/Users/globeskimmers/Desktop/CODES PROTECT/globeskimmers-cacf36e4-10" && wrangler d1 execute globeskimmers-attractions --file=cloudflare-worker/sql/schema.sql --remote
```

The schema file uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, so re-running it is **safe and idempotent** — existing rows untouched, new `seed_attempts` table added.

### Redeploy the Worker

```bash
cd "/Users/globeskimmers/Desktop/CODES PROTECT/globeskimmers-cacf36e4-10" && wrangler deploy
```

### Smoke test — manually trigger a seed for a city

```bash
# Boise, ID — a city NOT in the Phase A launch seed
curl -X POST https://globeskimmers-api.maizasimeon.workers.dev/attractions/seed-city \
  -H "Content-Type: application/json" \
  -d '{"latitude":43.6150,"longitude":-116.2023,"cityName":"Boise","countryName":"United States"}'
```

Returns `{"ok":true}` within ~5-10 seconds. Then verify it landed:

```bash
curl -X POST https://globeskimmers-api.maizasimeon.workers.dev/attractions/nearby \
  -H "Content-Type: application/json" \
  -d '{"latitude":43.6150,"longitude":-116.2023,"radiusKm":20}' \
  | python3 -m json.tool | head -30
```

You should see ~5-15 Boise attractions with `id` prefixed `auto:united-states-boise-...`.

### Audit auto-seeded entries

Auto-seeded rows are tagged with `source = 'auto-seeded'` so you can spot-check or curate them later:

```bash
# List the 20 most recently auto-seeded entries
wrangler d1 execute globeskimmers-attractions --remote --command "
SELECT name, city, country, category, rating, is_marquee
FROM attractions
WHERE source = 'auto-seeded'
ORDER BY created_at DESC
LIMIT 20;
"

# See which cities the Worker has attempted to seed
wrangler d1 execute globeskimmers-attractions --remote --command "
SELECT city, country, found_count, inserted_count, status, attempted_at
FROM seed_attempts
ORDER BY attempted_at DESC
LIMIT 20;
"

# Promote a good auto-seeded entry to fully curated
wrangler d1 execute globeskimmers-attractions --remote --command "
UPDATE attractions SET source = 'curated' WHERE id = 'auto:...';
"

# Delete a bad auto-seeded entry
wrangler d1 execute globeskimmers-attractions --remote --command "
DELETE FROM attractions WHERE id = 'auto:...';
"
```

### Cost

Each new city that gets auto-seeded costs **~$0.05-0.25** in one-time Places API calls (8 text searches at $0.032 each, often cache-hit-ed by users who searched there recently). Once seeded, that city serves from D1 forever at $0. Throttle prevents re-seed storms (max 1 attempt per region per 24h).

For context: 100 new cities auto-seeded per month = ~$10-25 in seed costs vs ~$1000+ in continuous Places fallback costs without it.

## How to add more cities / attractions later

Three options, easiest first:

### Option A — hand-add via SQL

```bash
wrangler d1 execute globeskimmers-attractions --remote --command "
INSERT INTO attractions (id, name, category, lat, lng, city, country,
  description, why_visit, typical_minutes, is_marquee, free_to_visit, source)
VALUES (
  'curated:hagia-sophia',
  'Hagia Sophia Grand Mosque',
  'religious',
  41.0086, 28.9802,
  'Istanbul', 'Turkey',
  'Sixth-century Byzantine basilica turned mosque, museum, and mosque again.',
  'No other building in the world has played such a central role in two world religions across 1500 years.',
  90,
  1,  -- is_marquee
  1,  -- free_to_visit
  'curated'
);
"
```

### Option B — bulk import from OpenStreetMap

OSM tags `tourism=attraction`, `tourism=museum`, `tourism=theme_park`, `historic=monument`, `natural=peak`, `natural=beach`, etc. give you tens of thousands of attractions worldwide, openly licensed. Phase B (next sprint) will add an importer script. For now, hand-curation gives you the best quality at launch.

### Option C — re-run the curation workflow

The Claude workflow that produced the launch seed is re-runnable. Edit `scripts/curate_attractions.workflow.js` (preserved from this sprint), add cities to the `CITIES` array, re-run, and the workflow produces a fresh `seed_attractions.sql` you can run against the existing database (uses `INSERT OR REPLACE` so re-running is idempotent).

## Operational notes

- **Editing a row in production**: use `wrangler d1 execute --remote --command "UPDATE attractions SET ..."`. The Worker picks up the change within seconds — no redeploy needed.
- **Backups**: D1 takes daily automatic snapshots, retained 30 days. Restore via `wrangler d1 restore`.
- **Cost monitoring**: dashboard.cloudflare.com → Workers & Pages → D1 → globeskimmers-attractions → Analytics. You'll see read/write counts. Free tier limits should be exceeded only at scale we'd happily pay for.

## What's NOT in this database

Live data — anything that changes — comes from Google Places at detail-tap time, not from D1. That includes:

- Current opening hours / is-open-now
- Current ticket prices
- Latest user reviews
- Latest photos (D1 photo_url is a stable Wikimedia Commons URL; live Places photos are richer)
- Temporary closures

The Worker's existing `/places/details/<placeId>` endpoint handles all of that and is already cached with a 90-day TTL on the immutable fields.

## Quarterly refresh

Static doesn't mean "never check." Set a calendar reminder for **2026-09-06** (quarterly) to:

1. Spot-check 5-10 random attractions for accuracy
2. Add any new entries users have requested via the in-app Contact Us
3. Mark `last_reviewed = date('now')` on every row you've checked

```bash
wrangler d1 execute globeskimmers-attractions --remote --command "
UPDATE attractions SET last_reviewed = date('now') WHERE id IN (...);
"
```

This keeps the data trustworthy without ever paying Google Places to re-confirm that the Eiffel Tower is still at 48.8584, 2.2945.
