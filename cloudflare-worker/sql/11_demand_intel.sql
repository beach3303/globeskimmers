-- 11_demand_intel.sql — demand-intel rollup + post-stay trip feedback.
-- Run once against the EVENTS database (globeskimmers-events, binding `DB`):
--   npx wrangler d1 execute globeskimmers-events --file=cloudflare-worker/sql/11_demand_intel.sql --remote
-- "table already exists" on re-run = already applied.

-- Daily compaction of the raw `events` table, written ONLY by analyticsRollup()
-- in cloudflare-worker-v7.12.js (nightly cron, right after dealRadarSweep).
-- One row per UTC day x event_type x payload city/country, so aggregate demand
-- signal survives after the raw rows age out (the same cron deletes raw events
-- older than 180 days). INSERT OR REPLACE on the PK makes rollup re-runs of the
-- same day idempotent.
CREATE TABLE IF NOT EXISTS events_daily (
  day        TEXT    NOT NULL,            -- UTC day 'YYYY-MM-DD' (from ts, unixepoch)
  event_type TEXT    NOT NULL,            -- raw events.event_type, unmodified
  city       TEXT    NOT NULL DEFAULT '', -- json payload $.city; NULL/missing rolls up as ''
  country    TEXT    NOT NULL DEFAULT '', -- json payload $.country; NULL/missing rolls up as ''
  n          INTEGER NOT NULL DEFAULT 0,  -- COUNT(*) of raw events in the group
  PRIMARY KEY (day, event_type, city, country)
);

-- Post-stay feedback left from the Trips page (POST /trip/feedback — public,
-- auth optional; duplicate submissions are KV-throttled per user/IP + booking
-- for 30 days). Read via the admin-gated /analytics-query?type=trip_feedback_recent.
CREATE TABLE IF NOT EXISTS trip_feedback (
  id          TEXT PRIMARY KEY,           -- crypto.randomUUID(), minted server-side
  booking_ref TEXT,                       -- affiliate_clicks.product_id (Nuitee bookingId) or partner ref; <= 80 chars
  user_id     TEXT,                       -- Supabase user id when signed in, else NULL
  rating      INTEGER,                    -- 1..5, required at the endpoint
  problems    TEXT,                       -- free text "what went wrong", <= 1000 chars, optional
  hotel_name  TEXT,                       -- denormalized so feedback outlives the click row
  city        TEXT,
  country     TEXT,
  checkout    TEXT,                       -- 'YYYY-MM-DD' stay checkout, when the caller knows it
  created     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trip_feedback_created ON trip_feedback (created);
