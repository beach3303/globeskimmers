-- Extract ALL Overture places worldwide → local planet_places.parquet (lean columns).
-- Run:  duckdb < 01_extract_planet.sql
-- Reads ~7GB from S3, writes a lean local parquet. Takes a few minutes.

install httpfs; load httpfs;
set s3_region = 'us-west-2';

copy (
  select
    id,
    names."primary"                    as name,       -- "primary" is a DuckDB reserved word → quote
    categories."primary"               as category,
    categories.alternate               as category_alt,
    (bbox.ymin + bbox.ymax) / 2.0      as lat,        -- points: bbox center == the point
    (bbox.xmin + bbox.xmax) / 2.0      as lng,
    addresses[1].freeform              as address,
    addresses[1].locality              as city,
    addresses[1].region                as region,
    addresses[1].country               as country,
    addresses[1].postcode              as postcode,
    phones[1]                          as phone,
    websites[1]                        as website
  from read_parquet(
    's3://overturemaps-us-west-2/release/2026-06-17.0/theme=places/type=place/*',
    hive_partitioning = 1
  )
  where names."primary" is not null                   -- skip nameless entries
) to 'planet_places.parquet' (format parquet);

select count(*) as planet_count from read_parquet('planet_places.parquet');
select country, count(*) as n from read_parquet('planet_places.parquet')
group by country order by n desc limit 15;
