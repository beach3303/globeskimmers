-- ─────────────────────────────────────────────────────────────────────
-- Secret stamp rotation (founder model, 2026-08-31): secrets are ASSIGNED
-- for a half-year window and retire after it. The earned stamp persists
-- forever (meaning model: memories are never taken back); what expires is
-- the PLACE's secret status — it stops being revealed or earnable as a
-- secret, and the founder assigns the next batch.
--
--   npx wrangler d1 execute globeskimmers-attractions \
--       --file=cloudflare-worker/sql/03_secret_windows.sql --remote
--
-- Serving rule for the Worker (pending change): a secret is live iff
--   tier='secret' AND date('now') BETWEEN secret_from AND secret_until
-- and secrets NEVER appear in general browse — only proximity reveal.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE attractions ADD COLUMN secret_from TEXT;
ALTER TABLE attractions ADD COLUMN secret_until TEXT;

-- Current window for the pilot three (Aug '26 – Dec '26).
UPDATE attractions SET secret_from='2026-08-01', secret_until='2026-12-31'
 WHERE tier='secret' AND parent_id='wikidata:Q181185';

-- Club 33 exists at three castles. Tokyo Disneyland has no park row yet
-- (only six cities are seeded) — insert it so its secret has a parent.
INSERT OR REPLACE INTO attractions (id, name, category, lat, lng, city, country,
  typical_minutes, is_marquee, free_to_visit, source, source_id, last_reviewed,
  popularity, place_id, footprint_radius_m, parent_id, tier) VALUES
  ('wikidata:Q843997', 'Tokyo Disneyland', 'theme_park',
   35.632778, 139.880556, 'Urayasu', 'JP', 60, 1, 0, 'founder', 'secret-pilot',
   '2026-08-31', NULL, NULL, 900, NULL, 'page');

-- ⚠ Door coordinates are desk-derived (World Bazaar / near the castle) —
-- verify on-site before promoting beyond the pilot, same as Anaheim's.
INSERT OR REPLACE INTO attractions (id, name, category, lat, lng, city, country,
  typical_minutes, is_marquee, free_to_visit, source, source_id, last_reviewed,
  popularity, place_id, footprint_radius_m, parent_id, tier, secret_from, secret_until) VALUES
  ('secret:tokyo-disneyland-club-33-door', 'The Door of Club 33', 'experience',
   35.632900, 139.880400, 'Urayasu', 'JP', 5, 0, 1, 'founder', 'secret-pilot',
   '2026-08-31', NULL, NULL, 60, 'wikidata:Q843997', 'secret', '2026-08-01', '2026-12-31');

INSERT OR REPLACE INTO attractions (id, name, category, lat, lng, city, country,
  typical_minutes, is_marquee, free_to_visit, source, source_id, last_reviewed,
  popularity, place_id, footprint_radius_m, parent_id, tier, secret_from, secret_until) VALUES
  ('secret:shanghai-disneyland-club-33-door', 'The Door of Club 33', 'experience',
   31.146500, 121.656500, 'Shanghai', 'CN', 5, 0, 1, 'founder', 'secret-pilot',
   '2026-08-31', NULL, NULL, 60, 'wikidata:Q865312', 'secret', '2026-08-01', '2026-12-31');

-- Shanghai Disneyland already exists as curated:china-shanghai-shanghai-disneyland;
-- give the secret's parent the canonical wikidata id as well (both may coexist —
-- the reveal flow keys on the secret row, not the parent).
INSERT OR REPLACE INTO attractions (id, name, category, lat, lng, city, country,
  typical_minutes, is_marquee, free_to_visit, source, source_id, last_reviewed,
  popularity, place_id, footprint_radius_m, parent_id, tier) VALUES
  ('wikidata:Q865312', 'Shanghai Disneyland', 'theme_park',
   31.144000, 121.657000, 'Shanghai', 'CN', 60, 1, 0, 'founder', 'secret-pilot',
   '2026-08-31', NULL, NULL, 900, NULL, 'page');
