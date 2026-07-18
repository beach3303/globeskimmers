-- Extract New York City places from Overture Maps → local nyc_places.parquet
-- Run:  duckdb < 02_extract.sql
--
-- Downloads ONLY the NYC bounding box (not the planet) by pushing the bbox filter
-- down to the remote parquet. Overture Places geometries are POINTS, so bbox.xmin==xmax
-- (=longitude) and bbox.ymin==ymax (=latitude) — we read the point straight from bbox
-- and avoid any WKB/geometry decoding.

install httpfs; load httpfs;
set s3_region = 'us-west-2';

-- NYC 5-borough bounding box. Change these 4 numbers to pilot a different city.
-- (Check https://docs.overturemaps.org/release-calendar/ and bump the release date below.)
copy (
  select
    id,
    names.primary                      as name,
    categories.primary                 as category,
    categories.alternate               as category_alt,
    (bbox.ymin + bbox.ymax) / 2.0      as lat,
    (bbox.xmin + bbox.xmax) / 2.0      as lng,
    addresses[1].freeform              as address,
    addresses[1].locality              as city,
    addresses[1].region                as region,
    addresses[1].country               as country,
    addresses[1].postcode              as postcode,
    phones[1]                          as phone,
    websites[1]                        as website,
    confidence,
    to_json(sources)                   as sources
  from read_parquet(
    's3://overturemaps-us-west-2/release/2026-06-17.0/theme=places/type=place/*',
    hive_partitioning = 1
  )
  where bbox.xmin between -74.30 and -73.68   -- lng (W→E)
    and bbox.ymin between  40.47 and  40.93   -- lat (S→N)
) to 'nyc_places.parquet' (format parquet);

-- Sanity check: count + a few sample rows to eyeball before loading.
select count(*) as nyc_place_count from read_parquet('nyc_places.parquet');
select name, category, phone, website, city
from read_parquet('nyc_places.parquet')
limit 5;
