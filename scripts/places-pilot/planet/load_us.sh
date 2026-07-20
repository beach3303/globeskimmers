#!/bin/bash
# Load the US in 20 chunks — it's too big (~16M rows) for one insert over the network.
# Splits by hash(id) % 20 so chunks are even and non-overlapping. Resumable.
# Usage:  PGPASS='your-db-password' ./load_us.sh

set -uo pipefail

PARQUET="planet_places.parquet"
PROGRESS=".us_loaded_chunks"
HOST="aws-1-us-west-1.pooler.supabase.com"
USER="postgres.bkaxadiyehddzkiuheea"

if [ -z "${PGPASS:-}" ]; then echo "Set PGPASS='your-db-password' first."; exit 1; fi
if [ ! -f "$PARQUET" ]; then echo "Missing $PARQUET."; exit 1; fi
touch "$PROGRESS"

PGCONN="dbname=postgres host=${HOST} port=5432 user=${USER} password=${PGPASS} sslmode=require"
COLS="id,name,category,category_alt,lat,lng,address,city,region,country,postcode,phone,website"

for i in $(seq 0 19); do
  if grep -qx "$i" "$PROGRESS"; then echo "skip US chunk $i (done)"; continue; fi
  echo "loading US chunk $i/19 ..."
  if duckdb -c "install postgres; load postgres; set pg_null_byte_replacement='';
      attach '${PGCONN}' as pg (type postgres);
      insert into pg.places_planet (${COLS})
      select ${COLS} from read_parquet('${PARQUET}')
      where country='US' and lat is not null and lng is not null
        and hash(id) % 20 = ${i};"; then
    echo "$i" >> "$PROGRESS"
    echo "  ✓ US chunk $i done"
  else
    echo "  ✗ US chunk $i failed — rerun to retry"
  fi
done

echo "US load complete. Verify with: select count(*) from places_planet;  (expect ~75M)"
