-- Cleanup after the first city-icons load (2026-09-30). Safe to re-run.
-- 1) Duplicates: the atlas already held these under 'City, ST' spellings.
DELETE FROM attractions WHERE id IN ('icon:Q639090','icon:Q214424','icon:9-11-memorial-museum','icon:six-flags-magic-mountain');
-- 2) City spellings on the new rows match the atlas convention.
UPDATE attractions SET city='New York, NY'    WHERE id LIKE 'icon:%' AND city='New York';
UPDATE attractions SET city='Los Angeles, CA' WHERE id LIKE 'icon:%' AND city='Los Angeles';
UPDATE attractions SET city='Venice, CA'      WHERE id LIKE 'icon:%' AND city='Venice';
UPDATE attractions SET city='Beverly Hills, CA' WHERE id LIKE 'icon:%' AND city='Beverly Hills';
UPDATE attractions SET city='Santa Clarita, CA' WHERE id LIKE 'icon:%' AND city='Santa Clarita';
-- 3) The popularity floor follows the PROMOTION, not the id — so Brooklyn
--    Bridge, the High Line & co (promoted in place) rank like the icons they are.
UPDATE attractions SET popularity=max(coalesce(popularity,0),5000000), updated_at=datetime('now') WHERE coalesce(founder_scope,'')='world';
UPDATE attractions SET popularity=max(coalesce(popularity,0),2000000), updated_at=datetime('now') WHERE coalesce(founder_scope,'')='national';
-- 4) One country spelling for the icon set (matches how stamps print it).
UPDATE attractions SET country='US' WHERE id LIKE 'icon:%' AND country='United States';
