-- Extract Los Angeles metro places from Overture → local la_places.parquet
-- Run:  duckdb < extract_la.sql
-- Same pipeline as NYC; only the bounding box changed.

install httpfs; load httpfs;
set s3_region = 'us-west-2';

copy (
  select
    id,
    names."primary"                    as name,        -- "primary" is a DuckDB reserved word → quote
    categories."primary"               as category,
    categories.alternate               as category_alt,
    (bbox.ymin + bbox.ymax) / 2.0      as lat,         -- points: bbox center == the point
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
  where bbox.xmin between -118.70 and -118.10   -- LA metro lng (W→E): Santa Monica → Pasadena
    and bbox.ymin between  33.70 and  34.35     -- LA metro lat (S→N): Long Beach → foothills
) to 'la_places.parquet' (format parquet);

-- Sanity check: count + a few sample rows to eyeball before loading.
select count(*) as la_place_count from read_parquet('la_places.parquet');
select name, category, phone, city from read_parquet('la_places.parquet') limit 5;
