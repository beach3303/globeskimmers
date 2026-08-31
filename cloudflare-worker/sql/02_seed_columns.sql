-- ─────────────────────────────────────────────────────────────────────
-- Attractions seed pipeline — new columns (run ONCE against ATTRACTIONS_DB)
--
--   npx wrangler d1 execute globeskimmers-attractions \
--       --file=cloudflare-worker/sql/02_seed_columns.sql --remote
--
-- Additive only. handleAttractionsNearby SELECTs named columns, so nothing
-- serving changes until the Worker starts reading these. SQLite has no
-- ADD COLUMN IF NOT EXISTS — running this twice errors with "duplicate
-- column name", which is the signal it already ran, not a failure.
-- ─────────────────────────────────────────────────────────────────────

-- Median monthly Wikipedia pageviews (reading interest, NOT footfall — see
-- scripts/attractions-seed/). NULL = unranked; sort with rating as fallback.
ALTER TABLE attractions ADD COLUMN popularity INTEGER;

-- The owned Overture place id (public.places in Supabase) this attraction
-- resolved to. Links attractions to photos/enrich/guestbook, which key off it.
ALTER TABLE attractions ADD COLUMN place_id TEXT;

-- GPS-verify circle for the passport ✓, in metres. Replaces the global 250m
-- constant for large-footprint places: a visitor inside Disneyland's gates is
-- ~400m from its centroid. Read by the stamp flow via the attraction payload.
ALTER TABLE attractions ADD COLUMN footprint_radius_m INTEGER;

-- Hierarchy: kingdoms and secrets. A park inside a resort, a secret inside a
-- park (Tom Sawyer Island, the Club 33 door) point at their parent's id.
ALTER TABLE attractions ADD COLUMN parent_id TEXT;

-- page   = a full passport-page stamp (default; everything seeded so far)
-- mark   = a light "visited" sub-entry inside a page-stamp place
-- secret = a hidden collectible — tight footprint, found by being there
ALTER TABLE attractions ADD COLUMN tier TEXT NOT NULL DEFAULT 'page';

CREATE INDEX IF NOT EXISTS idx_attractions_parent
  ON attractions (parent_id) WHERE parent_id IS NOT NULL;
