-- Load nyc_places.parquet → Supabase Postgres `places` table.
-- Run:  duckdb < 03_load.sql
--
-- 1) Run 01_schema.sql in Supabase first (creates the table + PostGIS).
-- 2) Get your connection string: Supabase Dashboard → Connect (top bar) → "Session pooler".
--    It looks like:
--      postgresql://postgres. abcdxyz : YOUR-PASSWORD @ aws-0-us-east-1.pooler.supabase.com : 5432 / postgres
--    Use the SESSION POOLER (port 5432), NOT the direct db.<ref>.supabase.co host (that one is
--    IPv6-only and usually won't resolve from a home Mac — that's the error you saw).
-- 3) Fill the 4 values below (user, password, host, — keep port 5432 / dbname postgres):

install postgres; load postgres;

attach 'dbname=postgres host=aws-0-YOUR-REGION.pooler.supabase.com port=5432 user=postgres.YOUR-PROJECT-REF password=YOUR-PASSWORD sslmode=require' as pg (type postgres);

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
