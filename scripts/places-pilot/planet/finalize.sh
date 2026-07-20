#!/bin/bash
# Finalize the planet: build spatial indexes on ~75M rows, then atomically swap
# places_planet -> places (zero downtime). Runs via DuckDB->Postgres so the long
# index build isn't killed by the SQL editor's HTTP timeout.
# Usage:  PGPASS='your-db-password' ./finalize.sh

set -uo pipefail
if [ -z "${PGPASS:-}" ]; then echo "Set PGPASS='your-db-password' first."; exit 1; fi

HOST="aws-1-us-west-1.pooler.supabase.com"
USER="postgres.bkaxadiyehddzkiuheea"
PGCONN="dbname=postgres host=${HOST} port=5432 user=${USER} password=${PGPASS} sslmode=require"

run() { duckdb -c "install postgres; load postgres; attach '${PGCONN}' as pg (type postgres); call postgres_execute('pg', '$1');"; }

echo "[1/5] Building geometry GiST index (the long one — several minutes)..."
run "create index if not exists places_planet_geom_gix on places_planet using gist (geom)"

echo "[2/5] Building geography GiST index (radius queries)..."
run "create index if not exists places_planet_geog_gix on places_planet using gist ((geom::geography))"

echo "[3/5] Building country index + analyze..."
run "create index if not exists places_planet_country_idx on places_planet (country)"
run "analyze places_planet"

echo "[4/5] Swapping the planet live (zero downtime)..."
run "alter table places rename to places_old"
run "alter table places_planet rename to places"

echo "[5/5] Done. The whole planet is LIVE. Old pilot table kept as places_old."
echo "Verify: curl the /places/nearby-owned endpoint, or in Supabase run:"
echo "  select * from nearby_places(40.7580,-73.9855,1000,5);"
echo "Once verified, reclaim space: drop table places_old;"
