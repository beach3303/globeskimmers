-- Twin merge (2026-09-30): where a hand-seeded icon (no qid) shares its EXACT
-- name with an encyclopedia row, keep the encyclopedia row — it carries the
-- qid, photo and links — but give it the icon's scope, radius and ranking.
-- Then the hand-seeded twin retires. Safe to re-run.
UPDATE attractions SET
  founder_scope = (SELECT i.founder_scope FROM attractions i WHERE i.id LIKE 'icon:%' AND i.qid IS NULL AND i.name = attractions.name LIMIT 1),
  footprint_radius_m = coalesce(footprint_radius_m, (SELECT i.footprint_radius_m FROM attractions i WHERE i.id LIKE 'icon:%' AND i.qid IS NULL AND i.name = attractions.name LIMIT 1)),
  updated_at = datetime('now')
WHERE id LIKE 'wikidata:%'
  AND EXISTS (SELECT 1 FROM attractions i WHERE i.id LIKE 'icon:%' AND i.qid IS NULL AND i.name = attractions.name);
DELETE FROM attractions WHERE id LIKE 'icon:%' AND qid IS NULL
  AND EXISTS (SELECT 1 FROM attractions w WHERE w.id LIKE 'wikidata:%' AND w.name = attractions.name);
-- Ranking floors follow the promotion (same floors as before).
UPDATE attractions SET popularity=max(coalesce(popularity,0),5000000), updated_at=datetime('now') WHERE coalesce(founder_scope,'')='world';
UPDATE attractions SET popularity=max(coalesce(popularity,0),2000000), updated_at=datetime('now') WHERE coalesce(founder_scope,'')='national';
