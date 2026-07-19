#!/bin/bash
# Load planet_places.parquet → Supabase places_planet, COUNTRY BY COUNTRY, resumable.
#
# Prereqs: 01_extract_planet.sql done (planet_places.parquet exists),
#          02_staging_schema.sql run in Supabase, and compute bumped (see README).
#
# Usage:   PGPASS='your-db-password' ./load_planet.sh
#          (safe to re-run — finished countries are skipped)

set -uo pipefail

PARQUET="planet_places.parquet"
PROGRESS=".planet_loaded_countries"
HOST="aws-1-us-west-1.pooler.supabase.com"
USER="postgres.bkaxadiyehddzkiuheea"

if [ -z "${PGPASS:-}" ]; then echo "Set PGPASS='your-db-password' first."; exit 1; fi
if [ ! -f "$PARQUET" ]; then echo "Missing $PARQUET — run 01_extract_planet.sql first."; exit 1; fi
touch "$PROGRESS"

PGCONN="dbname=postgres host=${HOST} port=5432 user=${USER} password=${PGPASS} sslmode=require"
COLS="id,name,category,category_alt,lat,lng,address,city,region,country,postcode,phone,website"

# Distinct countries in the parquet, largest last isn't important; just iterate.
COUNTRIES=$(duckdb -noheader -list -c \
  "select distinct country from read_parquet('${PARQUET}') where country is not null order by 1")

for C in $COUNTRIES; do
  if grep -qx "$C" "$PROGRESS"; then echo "skip $C (done)"; continue; fi
  echo "loading $C ..."
  if duckdb -c "install postgres; load postgres;
      attach '${PGCONN}' as pg (type postgres);
      insert into pg.places_planet (${COLS})
      select ${COLS} from read_parquet('${PARQUET}')
      where country='${C}' and lat is not null and lng is not null;"; then
    echo "$C" >> "$PROGRESS"
    echo "  ✓ $C done"
  else
    echo "  ✗ $C failed — will retry on next run"
  fi
done

echo "All countries processed. Next: run 03_finalize_swap.sql in Supabase."
