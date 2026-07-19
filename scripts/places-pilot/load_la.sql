-- Load la_places.parquet → Supabase Postgres `places` table.
-- Run:  duckdb < load_la.sql   (fill in YOUR-PASSWORD below first)
-- Host + user are pre-filled (session pooler). Run extract_la.sql first.

install postgres; load postgres;

attach 'dbname=postgres host=aws-1-us-west-1.pooler.supabase.com port=5432 user=postgres.bkaxadiyehddzkiuheea password=YOUR-PASSWORD sslmode=require' as pg (type postgres);

-- LA doesn't overlap NYC, so no id collisions. Run ONCE. (Re-running would hit a
-- primary-key error, which just means "already loaded" — harmless.)
insert into pg.places
  (id, name, category, category_alt, lat, lng, address, city, region, country, postcode, phone, website, confidence, sources)
select
  id, name, category, category_alt, lat, lng, address, city, region, country, postcode, phone, website, confidence, sources
from read_parquet('la_places.parquet')
where lat is not null and lng is not null;

select count(*) as total_places from pg.places;
select pg_size_pretty(pg_total_relation_size('places')) as places_size;
