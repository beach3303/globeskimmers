-- Santa Monica was never seeded (founder caught it 2026-10-06: "always a top
-- destination in Los Angeles" — Griffith, Venice and the Walk of Fame were in,
-- the Pier wasn't). Guarded inserts, same shape as fix_parks.sql.
-- Run: npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/city-icons/data/fix_la_santa_monica.sql
INSERT INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,qid,sitelinks,popularity)
SELECT 'icon:santa-monica-pier','Santa Monica Pier','landmark',34.0094,-118.4973,'Santa Monica (Los Angeles)','US','city_icon','santa-monica-pier',400,'page','world',NULL,80,4500000
WHERE NOT EXISTS (SELECT 1 FROM attractions WHERE name='Santa Monica Pier');
INSERT INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,qid,sitelinks,popularity)
SELECT 'icon:santa-monica-beach','Santa Monica Beach','beach',34.0170,-118.4950,'Santa Monica (Los Angeles)','US','city_icon','santa-monica-beach',1200,'page','national',NULL,25,2000000
WHERE NOT EXISTS (SELECT 1 FROM attractions WHERE name='Santa Monica Beach');
