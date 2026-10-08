-- Dream shelf, Greater Los Angeles (founder, 2026-10-08). Run once:
--   npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/attractions-fixes/2026-10-08-la-dream-shelf.sql
-- Founder's picks (local favorites and icons), data errors, and places that
-- are not visitable. founder_scope always wins over the scorer's scope.

-- Founder's picks
UPDATE attractions SET founder_scope = 'national', updated_at = datetime('now') WHERE id = 'wikidata:Q1207585';  -- Knott's Berry Farm
UPDATE attractions SET founder_scope = 'national', updated_at = datetime('now') WHERE id = 'wikidata:Q976218';   -- Hollywood Bowl
UPDATE attractions SET founder_scope = 'national', updated_at = datetime('now') WHERE id = 'wikidata:Q1641836';  -- LACMA
UPDATE attractions SET founder_scope = 'regional', qid = 'Q6682068', popularity = 1000000, updated_at = datetime('now')
  WHERE id = 'wv:arcadia-california-los-angeles-county-arboretum';                                              -- LA County Arboretum
UPDATE attractions SET founder_scope = 'regional', class_ban = NULL, popularity = 1000000, category = 'landmark', updated_at = datetime('now')
  WHERE id = 'wikidata:Q1126370';                                                                                -- Santa Anita Park
UPDATE attractions SET founder_scope = 'regional', class_ban = NULL, popularity = 1000000, updated_at = datetime('now')
  WHERE id = 'curated:united-states-los-angeles-olvera-street';                                                  -- Olvera Street
INSERT OR IGNORE INTO attractions (id, name, category, lat, lng, city, country, source, qid, scope, founder_scope, popularity, sitelinks, is_marquee, tier, created_at, updated_at)
  VALUES ('curated:united-states-los-angeles-the-grove', 'The Grove', 'market', 34.072, -118.358, 'Los Angeles, CA', 'US', 'founder', 'Q7738393',
          'regional', 'regional', 1000000, 3, 0, 'page', datetime('now'), datetime('now'));                       -- The Grove
-- The weak Huntington twin (no qid, local) — the real one is icon:Q1400558.
UPDATE attractions SET class_ban = 'duplicate', updated_at = datetime('now')
  WHERE id = 'wv:san-marino-california-huntington-library-art-collection-and-botanical-gardens';

-- Data errors
UPDATE attractions SET name = 'Griffith Park', category = 'park', updated_at = datetime('now') WHERE id = 'wikidata:Q1340614';  -- was mislabeled "River Road Tunnel"
UPDATE attractions SET founder_scope = 'regional', updated_at = datetime('now') WHERE id = 'wikidata:Q108053';   -- San Bernardino County Museum (was 'world')

-- Not visitable as a stamp
UPDATE attractions SET class_ban = 'not-public', updated_at = datetime('now') WHERE id = 'wikidata:Q953021';     -- Neverland Ranch (private)
UPDATE attractions SET class_ban = 'demolished', updated_at = datetime('now') WHERE id = 'icon:Q956072';         -- San Diego Stadium (demolished 2020)
UPDATE attractions SET class_ban = 'not-an-attraction', updated_at = datetime('now') WHERE id = 'icon:Q2631595';  -- border wall
UPDATE attractions SET class_ban = 'chain', updated_at = datetime('now') WHERE id = 'wikidata:Q707530';           -- Cinemark (a cinema chain)
UPDATE attractions SET class_ban = 'neighborhood', updated_at = datetime('now') WHERE id = 'wikidata:Q991627';    -- Floral Park (a Santa Ana neighborhood)
