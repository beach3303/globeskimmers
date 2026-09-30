-- Icons lead the suggestions (founder bar 2026-09-30): a world icon must never
-- rank below local noise. Pageview-based popularity on wikidata rows runs into
-- the millions, so icon rows get floors that put them on top. Safe to re-run.
UPDATE attractions SET popularity = max(coalesce(popularity,0), 5000000), updated_at = datetime('now')
 WHERE id LIKE 'icon:%' AND coalesce(founder_scope, scope) = 'world';
UPDATE attractions SET popularity = max(coalesce(popularity,0), 2000000), updated_at = datetime('now')
 WHERE id LIKE 'icon:%' AND coalesce(founder_scope, scope) = 'national';
