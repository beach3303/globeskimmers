-- Movie scene stamps (founder, 2026-09-28): the film or series behind a
-- filming-location spot. One row per attraction. The spot itself is an
-- ordinary `attractions` row — a new spot (category 'filming_location') or an
-- existing landmark that gains a film line (the founder's default: places
-- that already have a top-spot stamp keep one stamp and add the film).
-- Read by /attractions/nearby and /attractions/get (a missing table simply
-- means no film info). Apply to globeskimmers-attractions:
--   npx wrangler d1 execute globeskimmers-attractions --remote --file=cloudflare-worker/sql/13_film_scenes.sql
CREATE TABLE IF NOT EXISTS film_scenes (
  attraction_id TEXT PRIMARY KEY,
  work_qid      TEXT,
  work_title    TEXT NOT NULL,
  work_type     TEXT NOT NULL DEFAULT 'film',   -- film | tv
  year          INTEGER,
  cast1 TEXT, role1 TEXT, cast2 TEXT, role2 TEXT,
  scene         TEXT,                           -- one plain sentence: what happened here
  also_in       TEXT,                           -- other works shot here: "Title (Year); …"
  source_urls   TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);
