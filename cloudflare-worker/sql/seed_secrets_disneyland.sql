-- ─────────────────────────────────────────────────────────────────────
-- Secret stamps pilot — Disneyland Park (founder-curated, 2026-08-31)
--
--   npx wrangler d1 execute globeskimmers-attractions \
--       --file=cloudflare-worker/sql/seed_secrets_disneyland.sql --remote
--
-- tier='secret': hidden collectibles for kids — places you find by BEING
-- there, with tight GPS footprints (~80m: you earn the island by going to
-- the island). Parented under Disneyland Park (wikidata:Q181185) so a day
-- at the park fills its page with marks instead of inflating the passport.
--
-- Secrets are hand-picked by design — smallness is the point; this is not
-- pipeline output. Names are used as facts (nominative); stamp art stays
-- typographic — never characters or logos.
--
-- ⚠ Coordinates are close-but-desk-derived. The founder is AT the park —
-- verify each on-site and adjust before promoting beyond the pilot.
-- ─────────────────────────────────────────────────────────────────────

INSERT OR REPLACE INTO attractions (id, name, category, lat, lng, city, country,
  typical_minutes, is_marquee, free_to_visit, source, source_id, last_reviewed,
  popularity, place_id, footprint_radius_m, parent_id, tier) VALUES
  ('secret:disneyland-tom-sawyer-island', 'Tom Sawyer Island', 'experience',
   33.8117, -117.9225, 'Anaheim', 'US', 45, 0, 1, 'founder', 'disneyland-pilot',
   '2026-08-31', NULL, NULL, 80, 'wikidata:Q181185', 'secret');

INSERT OR REPLACE INTO attractions (id, name, category, lat, lng, city, country,
  typical_minutes, is_marquee, free_to_visit, source, source_id, last_reviewed,
  popularity, place_id, footprint_radius_m, parent_id, tier) VALUES
  ('secret:disneyland-club-33-door', 'The Door of Club 33', 'experience',
   33.8113, -117.9210, 'Anaheim', 'US', 5, 0, 1, 'founder', 'disneyland-pilot',
   '2026-08-31', NULL, NULL, 60, 'wikidata:Q181185', 'secret');

INSERT OR REPLACE INTO attractions (id, name, category, lat, lng, city, country,
  typical_minutes, is_marquee, free_to_visit, source, source_id, last_reviewed,
  popularity, place_id, footprint_radius_m, parent_id, tier) VALUES
  ('secret:disneyland-blue-bayou', 'Blue Bayou', 'experience',
   33.8111, -117.9212, 'Anaheim', 'US', 60, 0, 0, 'founder', 'disneyland-pilot',
   '2026-08-31', NULL, NULL, 60, 'wikidata:Q181185', 'secret');
