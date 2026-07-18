# Owned Places DB — Pilot (New York City)

The first slice of the **owned global places DB** (the moat). Goal: prove the pipeline
end-to-end on ONE city — ingest Overture → our own Postgres+PostGIS table → later serve
that city's finder list from our data, calling Google only on tap for live hours.

Why Overture: permissive license (CDLA/Apache/CC0 — **store forever, commercial, resell
derived data OK**, attribution only), already conflates Foursquare + Meta + Microsoft +
6 others, monthly refresh, free on S3. It has name/address/phone/website — **not hours**
(hours stay a rented Google-on-tap field). See memory `project-global-places-db`.

## What's here
- `01_schema.sql` — run once in Supabase (enables PostGIS + creates the `places` table).
- `02_extract.sql` — DuckDB: pull NYC places from Overture S3 → local `nyc_places.parquet`.
- `03_load.sql`  — DuckDB: load the parquet into Supabase Postgres.

## Prereqs
- **DuckDB** (`brew install duckdb`) — the only tool needed for ingest. Runs on your Mac now;
  the exact same scripts lift to a cloud VM later.
- Your **Supabase Postgres connection string** (Dashboard → Project Settings → Database →
  Connection string → URI). Use the **Session/Direct** connection, not the pooler, for bulk load.

## Run order
```bash
cd scripts/places-pilot

# 1) Create the table (paste 01_schema.sql into the Supabase SQL editor, or:)
psql "$SUPABASE_DB_URL" -f 01_schema.sql

# 2) Extract NYC from Overture (~1-3 min; downloads only the NYC bounding box)
duckdb < 02_extract.sql
#   → writes nyc_places.parquet and prints a row count + 5 sample rows to eyeball.

# 3) Load into Supabase (edit the connection string at the top of 03_load.sql first)
duckdb < 03_load.sql
```

## Validate it worked
```sql
-- in Supabase SQL editor
select count(*) from places;                          -- expect tens of thousands for NYC
select name, category, phone, website from places
  where phone is not null limit 10;                    -- eyeball phone coverage
-- radius query (the whole point of PostGIS): places within 500m of Times Square
select name, category, round(st_distance(geom::geography,
  st_setsrid(st_makepoint(-73.9855, 40.7580),4326)::geography)) as meters
from places
order by geom <-> st_setsrid(st_makepoint(-73.9855, 40.7580),4326)
limit 20;
```

## Notes / next steps
- **Overture release date** is pinned in `02_extract.sql` (`2026-06-17.0`). Check
  https://docs.overturemaps.org/release-calendar/ for a newer tag and bump it.
- **Bounding box** = the 5 NYC boroughs. Change the 4 numbers in `02_extract.sql` to pilot
  a different city.
- Once loaded + validated: next build is a Worker read-path that queries `places` first and
  falls back to Google where coverage is thin. That's a separate step — don't wire the app
  to this table until the data quality check above passes.
- **Attribution:** when this data is displayed, we owe Overture/source attribution (retain
  the `sources` provenance; Foursquare-sourced rows require the Foursquare copyright notice).
