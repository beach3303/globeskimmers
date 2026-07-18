-- Load nyc_places.parquet → Supabase Postgres `places` table.
-- Run:  duckdb < 03_load.sql
--
-- 1) Run 01_schema.sql in Supabase first (creates the table + PostGIS).
-- 2) Paste your Supabase DIRECT connection string below (Dashboard → Project Settings →
--    Database → Connection string → URI; use the direct 5432 connection, not the pooler).

install postgres; load postgres;

attach 'dbname=postgres host=YOUR_HOST.supabase.co port=5432 user=postgres password=YOUR_PASSWORD sslmode=require' as pg (type postgres);

-- Pilot load: insert the scalar columns (geom auto-generates from lat/lng in Postgres).
-- Re-running? Uncomment the next line to reload cleanly (first run: table is already empty).
-- delete from pg.places;
insert into pg.places
  (id, name, category, category_alt, lat, lng, address, city, region, country, postcode, phone, website, confidence, sources)
select
  id, name, category, category_alt, lat, lng, address, city, region, country, postcode, phone, website, confidence, sources
from read_parquet('nyc_places.parquet')
where lat is not null and lng is not null;

select count(*) as loaded_rows from pg.places;
