# Planet ingest — every city, every country

Loads **all ~75M Overture places worldwide** into your Supabase `places` table, lean
schema, zero-downtime. The planet already *includes* NYC/LA, so this replaces the
pilot data with the whole world.

## Cost / architecture (researched 2026-07-19)
- Lean table (~75M rows + GiST index) ≈ **~30–40 GB**, ~**$80–130/mo** all-in on Supabase.
- Single table + one GiST index (NOT partitioned — partitioning hurts radius queries).
- Ingest runs on your Mac (~1–2 hr); no cloud VM needed for places-only.

## ⚠️ PREREQ before the load phase
**Bump Supabase compute first.** Micro (1 GB RAM) can't build a GiST index on 75M rows.
Supabase Dashboard → Project Settings → Compute and Disk → set **Large (8 GB)** for the
load + index build (you can scale back to Small/Medium after). Disk auto-grows as it loads
(~$0.125/GB beyond 8 GB → ~$4–5/mo at 40 GB).

## Steps (in order)
```bash
cd scripts/places-pilot/planet

# 1) Extract the whole planet → local parquet (~7GB read from S3, ~minutes)
duckdb < 01_extract_planet.sql          # → planet_places.parquet + a row count (~75M)

# 2) Create the empty staging table (run 02_staging_schema.sql in Supabase SQL editor)

# 3) Load it, country by country (RESUMABLE — safe to re-run if it drops)
PGPASS='your-db-password' ./load_planet.sh

# 4) Build indexes + atomic swap (run 03_finalize_swap.sql in Supabase SQL editor)
```

## Notes
- **Resumable:** `load_planet.sh` records finished countries in `.planet_loaded_countries`
  and skips them on re-run. If your connection drops, just run it again.
- **Zero downtime:** the app keeps serving the old `places` until step 4's instant rename.
- **Lean:** we drop Overture's heavy `sources` JSON (attribution is a single global
  "© Overture Maps Foundation" credit shown in-app, not per row).
- **After swap:** verify, then `drop table places_old;` (left in place by step 4 for safety).
- To refresh monthly: bump the release date in `01_extract_planet.sql`, re-run all steps.
