-- ─────────────────────────────────────────────────────────────────────
-- Globeskimmers — attractions seed database (D1)
-- ─────────────────────────────────────────────────────────────────────
-- Stores the static "things to do" reference layer that defines what
-- exists in the world: National icons (Eiffel Tower, Pyramids of Giza,
-- Great Wall), regional must-sees (Chocolate Hills, Kawasan Falls),
-- museums, parks, viewpoints, beaches, monuments.
--
-- Why D1: the existing flow for ThingsToDo makes ~70 sequential HTTP
-- round-trips to Google Places per page open. On mobile cellular
-- (200ms+ RTT) that adds up to 30s cold loads — a launch killer for
-- first-time users. This table collapses the marquee + regional layer
-- into a SINGLE D1 query (~50ms) that returns hundreds of attractions
-- with rich metadata, on the Worker's edge, for free under Cloudflare's
-- D1 free tier (5M reads/day).
--
-- WHAT GOES HERE (volatility test: never / rarely changes):
-- - Marquee landmarks (Eiffel Tower, Colosseum, Statue of Liberty)
-- - Natural wonders (Grand Canyon, Niagara, Iguazu, Fjords)
-- - Major museums (Louvre, MoMA, British Museum)
-- - Religious sites (Vatican, Mecca, Western Wall)
-- - National parks, beaches, viewpoints
-- - Theme parks, zoos, aquariums (existence/location is stable; hours
--   change but those come from live Places lookup on detail tap)
--
-- WHAT DOES NOT GO HERE (let Places handle):
-- - Restaurants (open/close monthly)
-- - Coffee shops, bars, nightclubs
-- - Small commercial galleries (open/close yearly)
-- - Anything tagged with "hours" or "menu"
--
-- DEPLOY:
--   wrangler d1 create globeskimmers-attractions
--   wrangler d1 execute globeskimmers-attractions \
--       --file=cloudflare-worker/sql/schema.sql --remote
--   wrangler d1 execute globeskimmers-attractions \
--       --file=cloudflare-worker/sql/seed_attractions.sql --remote
--   # then update wrangler.toml with the new database_id and deploy

CREATE TABLE IF NOT EXISTS attractions (
  -- Stable identifier. Format:
  --   "curated:<slug>"     hand-curated launch seed (this file)
  --   "osm:node/<id>"      bulk import from OpenStreetMap
  --   "wikidata:<qid>"     bulk import from Wikidata
  --   "places:<placeId>"   bulk import from Google Places (last resort)
  id              TEXT PRIMARY KEY,

  -- Human name as it appears on Google Maps. Lets us cross-reference
  -- with Places when the user taps for live hours/price.
  name            TEXT NOT NULL,

  -- Single category column. Filtering by category in the browse query
  -- is one of the most common operations, so it's indexed below.
  -- Values match the enum used by the curation pipeline:
  --   museum, landmark, viewpoint, beach, park, national_park,
  --   theme_park, zoo, aquarium, art_gallery, historic, religious,
  --   market, monument, nature_reserve, waterfall, garden,
  --   observation_deck, district, square, palace, tower, cathedral,
  --   temple, shrine, mosque, fortress, wildlife, experience,
  --   river, lake
  category        TEXT NOT NULL,

  -- Geographic point. REAL is sufficient — we don't need cm precision.
  -- Indexed below for the bounding-box query that drives "nearby" browse.
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,

  -- Hierarchical location. city may be empty (country-level icons like
  -- "cherry blossoms in Japan" or "Northern Lights"). country MUST be
  -- non-empty. Both are indexed for fast city/country-scoped lookups
  -- without doing the geographic bounding-box scan.
  city            TEXT DEFAULT '',
  country         TEXT NOT NULL,

  -- Rich content. Loaded into the page render directly, no further
  -- AI calls needed for the static "About" section of these.
  description     TEXT DEFAULT '',
  why_visit       TEXT DEFAULT '',
  typical_minutes INTEGER DEFAULT 60,

  -- Photo URL. Will be backfilled from Wikimedia Commons during a
  -- future seed phase; nullable for now. When null, the frontend
  -- falls back to fetching a Places photo on first render.
  photo_url       TEXT,

  -- Stable, seeded-once rating (1.0 - 5.0). Used for default sort
  -- order on browse. Not promised to be "live current" — for that
  -- we hit Places on detail tap.
  rating          REAL,

  -- Marquee flag. 1 = "you cannot visit this city/country without
  -- seeing this" tier (Eiffel Tower, Pyramids, Great Wall, Colosseum,
  -- Statue of Liberty). Sorted to the top of any browse result.
  is_marquee      INTEGER NOT NULL DEFAULT 0,

  -- Free-to-visit flag. 1 = no ticket / no hours / nothing to look up
  -- on detail tap (parks, viewpoints, plazas, free religious sites).
  -- 0 = ticketed (museums, observation decks) — detail view should
  -- hit Places for live hours/price.
  free_to_visit   INTEGER NOT NULL DEFAULT 0,

  -- Provenance + curation traceability.
  source          TEXT DEFAULT 'curated',
  source_id       TEXT,
  last_reviewed   TEXT,     -- ISO date of last manual / cron verification
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes ─────────────────────────────────────────────────────────
-- The bounding-box query is the hot path: every ThingsToDo page open
-- runs `WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND
-- category IN (...) ORDER BY is_marquee DESC, rating DESC`.
--
-- SQLite picks ONE index per query plan, so we provide:
--   - (category, lat, lng) compound index for category-filtered browse
--   - (lat, lng) for unfiltered "anything near here"
--   - (city) for city-scoped lookups (admin / quick lists)
--   - (country) same idea
--   - (is_marquee) cheap secondary for "list all marquees globally"

CREATE INDEX IF NOT EXISTS idx_attractions_cat_geo
  ON attractions (category, lat, lng);

CREATE INDEX IF NOT EXISTS idx_attractions_geo
  ON attractions (lat, lng);

CREATE INDEX IF NOT EXISTS idx_attractions_city
  ON attractions (city);

CREATE INDEX IF NOT EXISTS idx_attractions_country
  ON attractions (country);

CREATE INDEX IF NOT EXISTS idx_attractions_marquee
  ON attractions (is_marquee, country)
  WHERE is_marquee = 1;

-- ─── Phase B: auto-seed throttling ────────────────────────────────────
-- Tracks every (city, country) pair we've attempted to auto-seed from
-- Google Places. The Worker checks this table before kicking off a
-- background discovery so we don't re-seed the same city on every
-- visit. Stores the count of attractions found so we can spot cities
-- where the auto-discovery returned nothing useful (a sign we should
-- relax the quality filter or hand-curate those).
--
-- Why a separate table from `attractions`:
--   - A city with 0 staple attractions in Places still counts as "attempted"
--   - A city we EXPLICITLY decided not to seed (e.g. shopping mall zone)
--     can be tracked with attempted_at + found_count=0
--   - Cleanly separates "we tried" from "we have data"
CREATE TABLE IF NOT EXISTS seed_attempts (
  -- City + country normalized to lowercase, joined by '::' to form the
  -- key. (e.g. "boise::united states", "tagbilaran::philippines")
  -- Lowercasing means "Boise" / "boise" / "BOISE" all dedupe correctly.
  region_key      TEXT PRIMARY KEY,

  city            TEXT NOT NULL,
  country         TEXT NOT NULL,
  -- Approximate coords of the seed request (for debugging which lat/lng
  -- triggered which seed). Not used as an index; the region_key is the
  -- only thing we look up by.
  trigger_lat     REAL,
  trigger_lng     REAL,
  -- ISO datetime of last attempt. Throttle window is 24h — if a new
  -- visitor arrives at the same city within that window, no re-attempt.
  attempted_at    TEXT NOT NULL,
  -- How many staple attractions were FOUND by the discovery (before
  -- quality filtering). Helps spot regions where Places coverage is
  -- thin.
  found_count     INTEGER NOT NULL DEFAULT 0,
  -- How many actually INSERTed into attractions after dedup against
  -- existing rows. Equal to found_count for brand-new regions.
  inserted_count  INTEGER NOT NULL DEFAULT 0,
  -- Status: ok | rate_limited | error. "error" rows can be retried
  -- manually by deleting the row.
  status          TEXT NOT NULL DEFAULT 'ok',
  -- Free-form message for debugging (last error, "skipped: no city",
  -- etc.). Truncated to 500 chars by the Worker before insert.
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_seed_attempts_recent
  ON seed_attempts (attempted_at DESC);

-- ─── Phase C: AI details permanent cache ──────────────────────────────
-- Stores the full Haiku-generated "attraction AI details" payload
-- (vibe, about prose, crowd patterns, best time, value assessment,
-- traveler notes, smart tip, etc.) permanently keyed by the
-- attraction's id/placeId. Replaces the prior KV cache which had a
-- 30-day TTL — so every popular attraction was paying Haiku again
-- every month. With D1 we pay Haiku ONCE per attraction, ever, then
-- serve free forever.
--
-- Volatility test: this content describes the place's character
-- (history, vibe, what makes it special) which doesn't meaningfully
-- change. Live-changing data (current hours, ticket prices, today's
-- crowd level) is NOT stored here — that comes from Places at detail-
-- tap time. AI details cache is content that should be written once
-- and held forever.
--
-- prompt_version: when we change the prompt or the schema of the AI
-- response (e.g. add a new field), bump the version constant in the
-- Worker. D1 lookups with the new version miss → regenerate with the
-- new prompt → cache the new version. Old version rows stay in the
-- table but become unreachable; can be GC'd periodically with a
-- DELETE WHERE prompt_version != 'aN'.
CREATE TABLE IF NOT EXISTS attraction_ai_details (
  -- The attraction's id — Google placeId for Places-discovered
  -- attractions (e.g. ChIJ...), or our "curated:..." / "auto:..." id
  -- for D1-resident entries.
  place_id        TEXT PRIMARY KEY,

  -- Denormalized for audit visibility. Tells you what the cache row
  -- is for without joining attractions every time.
  place_name      TEXT,

  -- Prompt + schema version the cached JSON was generated for. If we
  -- change either, bump the Worker constant and old rows become
  -- effectively invalid (lookup miss → regenerate).
  prompt_version  TEXT NOT NULL,

  -- Full ai_details JSON, as the Worker would normally return to the
  -- frontend. Stored as TEXT (JSON-serialized) since D1 doesn't have a
  -- native JSON type.
  ai_json         TEXT NOT NULL,

  generated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_details_generated
  ON attraction_ai_details (generated_at DESC);
