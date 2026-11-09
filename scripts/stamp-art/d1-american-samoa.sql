-- National Park of American Samoa (audit of all 63 US national parks, 2026-11-08): the one park with
-- stamp art on R2 (stamp-art/national-park-of-american-samoa.png) and no attractions row. Modeled on
-- the stamp_art rows of 2026-10-05 (Kenai Fjords, Haleakalā): a page-tier, world-scope park with a
-- 20 km footprint, so a photo or a live fix anywhere in the Tutuila unit earns it. Safe to re-run.
-- Run once (the founder):
--   npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-art/d1-american-samoa.sql
INSERT OR IGNORE INTO attractions
  (id, name, category, lat, lng, city, country, description, why_visit, typical_minutes, is_marquee, free_to_visit,
   source, source_id, created_at, updated_at, popularity, footprint_radius_m, tier, scope, founder_scope, qid)
VALUES
  ('icon:Q843075', 'National Park of American Samoa', 'national_park', -14.2583, -170.6833, 'Pago Pago', 'United States',
   '', '', 60, 0, 1, 'stamp_art', 'national-park-of-american-samoa', datetime('now'), datetime('now'), 500000, 20000,
   'page', 'world', 'world', 'Q843075');
