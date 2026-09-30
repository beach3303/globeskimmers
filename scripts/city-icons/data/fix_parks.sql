-- Parks & rims pass (founder directive 2026-09-30): every Disney/Universal
-- park is its OWN stampable entry anchored at the gate guests actually walk
-- through; resort umbrellas stop competing with their parks; Grand Canyon
-- rims keep separate access points with generous radii. Safe to re-run.

-- Resort umbrellas → out of suggestions (the parks carry the stamps).
UPDATE attractions SET founder_scope='local', updated_at=datetime('now')
 WHERE id IN ('wikidata:Q206521','wikidata:Q206859','wikidata:Q778011','wikidata:Q2290138');

-- Gate radii for the per-park rows that had none.
UPDATE attractions SET footprint_radius_m=600, updated_at=datetime('now')
 WHERE footprint_radius_m IS NULL AND id IN
 ('icon:Q181185','icon:Q1229098','icon:Q764186','icon:Q1345090','icon:Q1880820',
  'icon:Q2583112','icon:Q20979434','icon:Q1375103','icon:Q1186714','icon:Q2313567','icon:Q764906');
UPDATE attractions SET footprint_radius_m=coalesce(footprint_radius_m,700), updated_at=datetime('now')
 WHERE id LIKE 'icon:%' AND name IN ('Magic Kingdom','EPCOT','Universal Epic Universe');

-- Guest-arrival anchors (the gate, not the castle).
UPDATE attractions SET lat=28.4177, lng=-81.5812, updated_at=datetime('now') WHERE id LIKE 'icon:%' AND name='Magic Kingdom';
UPDATE attractions SET lat=28.3747, lng=-81.5494, updated_at=datetime('now') WHERE id LIKE 'icon:%' AND name='EPCOT';

-- The three rims stay separate; radii match how people actually spread out.
UPDATE attractions SET footprint_radius_m=1500, updated_at=datetime('now') WHERE id LIKE 'icon:%' AND name='Grand Canyon South Rim';
UPDATE attractions SET footprint_radius_m=800,  updated_at=datetime('now') WHERE id LIKE 'icon:%' AND name='Grand Canyon East (Desert View)';
UPDATE attractions SET footprint_radius_m=800,  updated_at=datetime('now') WHERE id LIKE 'icon:%' AND name='Grand Canyon West Rim (Skywalk)';

-- International parks that may be missing — guarded inserts, atlas rows win.
INSERT INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,qid,sitelinks,popularity)
SELECT 'icon:tokyo-disneyland','Tokyo Disneyland','theme_park',35.6329,139.8804,'Urayasu (Tokyo)','JP','city_icon','tokyo-disneyland',700,'page','world',NULL,150,5000000
WHERE NOT EXISTS (SELECT 1 FROM attractions WHERE name='Tokyo Disneyland');
INSERT INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,qid,sitelinks,popularity)
SELECT 'icon:tokyo-disneysea','Tokyo DisneySea','theme_park',35.6267,139.8851,'Urayasu (Tokyo)','JP','city_icon','tokyo-disneysea',700,'page','world',NULL,150,5000000
WHERE NOT EXISTS (SELECT 1 FROM attractions WHERE name='Tokyo DisneySea');
INSERT INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,qid,sitelinks,popularity)
SELECT 'icon:hong-kong-disneyland','Hong Kong Disneyland','theme_park',22.3130,114.0413,'Hong Kong','HK','city_icon','hong-kong-disneyland',700,'page','world',NULL,150,5000000
WHERE NOT EXISTS (SELECT 1 FROM attractions WHERE name='Hong Kong Disneyland');
INSERT INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,qid,sitelinks,popularity)
SELECT 'icon:shanghai-disneyland','Shanghai Disneyland','theme_park',31.1434,121.6570,'Shanghai','CN','city_icon','shanghai-disneyland',900,'page','world',NULL,150,5000000
WHERE NOT EXISTS (SELECT 1 FROM attractions WHERE name='Shanghai Disneyland');
INSERT INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,qid,sitelinks,popularity)
SELECT 'icon:universal-studios-beijing','Universal Studios Beijing','theme_park',39.8564,116.6764,'Beijing','CN','city_icon','universal-studios-beijing',700,'page','world',NULL,150,5000000
WHERE NOT EXISTS (SELECT 1 FROM attractions WHERE name='Universal Studios Beijing');
