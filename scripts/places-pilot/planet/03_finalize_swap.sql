-- Build indexes on the freshly-loaded planet table, then atomically swap it in.
-- Run in the Supabase SQL editor AFTER load_planet.sh finishes.
-- (Needs the compute bump — building GiST on ~75M rows is RAM-hungry.)

-- 1) Spatial indexes (built once, after the bulk load = fast).
create index if not exists places_planet_geom_gix on places_planet using gist (geom);
create index if not exists places_planet_geog_gix on places_planet using gist ((geom::geography));
create index if not exists places_planet_country_idx on places_planet (country);
analyze places_planet;

-- 2) Atomic swap — the planet becomes the live `places` the read-path already queries.
--    The nearby_places() RPC references `places` by name, so it picks up the new table
--    instantly with zero downtime.
alter table places        rename to places_old;
alter table places_planet rename to places;

-- 3) Sanity check the new live table (expect tens of millions).
select count(*) as total_places from places;
select * from nearby_places(40.7580, -73.9855, 1000, 5);   -- Times Square still works?

-- 4) Once verified, reclaim the pilot table:
-- drop table places_old;
