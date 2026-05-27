-- D1 schema for Globeskimmers analytics (Phase 2 / P3 scaffold)
--
-- To apply:
--   wrangler d1 execute globeskimmers-events --file=analytics-schema.sql
--
-- One catch-all events table. Every user interaction lands here as a row;
-- specific event types differentiate via the `event_type` column. JSON-blob
-- `payload` keeps the schema stable when we add new event types later
-- without needing migrations.
--
-- Indexes are scoped to the queries we know we'll run from a dashboard:
--   - "what events did user X have in the last hour" (idx on user_id + ts)
--   - "what page is most popular this week" (idx on page + ts)
--   - "what searches return no results" (idx on event_type + ts)

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,           -- Unix seconds (server-issued, not trusted-from-client)
  user_id      TEXT,                       -- Base44 user id; NULL for anon
  session_id   TEXT NOT NULL,              -- Frontend-generated per session
  event_type   TEXT NOT NULL,              -- 'page_view' | 'search' | 'card_open' | 'photo_view' | ...
  page         TEXT,                       -- 'PlacesToEat' | 'ThingsToDo' | ...
  payload      TEXT,                       -- JSON blob with event-specific fields
  ua_summary   TEXT                        -- Coarse user-agent classification ('ios-safari' | 'android-chrome' | ...)
);

CREATE INDEX IF NOT EXISTS idx_events_user_ts   ON events (user_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_page_ts   ON events (page, ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts   ON events (event_type, ts);
CREATE INDEX IF NOT EXISTS idx_events_session   ON events (session_id);

-- Future tables (next session):
--   search_results — for tier-accuracy analysis (event_id, place_id, tier, rank)
--   experiments    — for A/B variants the user is in
