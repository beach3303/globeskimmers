-- Add the durable per-device anon_id to the events table (D1: globeskimmers-events).
-- Enables D1/D7/D30 retention cohorts + returning-user metrics for signed-out travelers.
-- Run ONCE, BEFORE deploying the worker change (the worker falls back gracefully if
-- this hasn't run, so ordering is safe either way):
--
--   cd "<repo>" && npx wrangler d1 execute globeskimmers-events --remote \
--     --file scripts/analytics/alter_anon_id.sql
--
-- If it says "duplicate column name: anon_id", it's already applied — skip it.
ALTER TABLE events ADD COLUMN anon_id text;
CREATE INDEX IF NOT EXISTS events_anon_idx ON events (anon_id);
