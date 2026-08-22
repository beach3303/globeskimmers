-- Add ranking columns to the existing D1 `attractions` table (non-destructive).
-- Run ONCE against the globeskimmers-attractions D1 database before loading ranked seed.
-- If a column already exists, D1 errors on that line — safe to ignore/skip it.
--
--   cd "<repo>" && npx wrangler d1 execute globeskimmers-attractions --remote \
--     --file scripts/attractions-rank/01_alter_pop_score.sql
--
ALTER TABLE attractions ADD COLUMN pop_score REAL;
ALTER TABLE attractions ADD COLUMN pageviews INTEGER;
ALTER TABLE attractions ADD COLUMN sitelinks INTEGER;

-- Fast "most popular in this city" read path: ORDER BY pop_score DESC.
CREATE INDEX IF NOT EXISTS attractions_city_pop_idx ON attractions (city, pop_score DESC);
