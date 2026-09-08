-- 12_deal_radar_v2.sql — Deal Engine Phase 1: promo KIND (flight / cruise / car)
-- plus the Phase 2 destination columns, in ONE migration so the table is
-- altered once, not twice.
-- Run once against the EVENTS database (globeskimmers-events, binding `DB`):
--   npx wrangler d1 execute globeskimmers-events --file=cloudflare-worker/sql/12_deal_radar_v2.sql --remote
-- "duplicate column name" on re-run = already applied.
--
-- Run this BEFORE pushing the v2 worker. The worker carries a pre-migration
-- fallback (v1 insert / v1 select) so a wrong deploy order degrades to the old
-- flight-only behaviour instead of blanking the radar — but the fallback
-- writes NO kind, so rows written in that gap read as 'flight' via the default.

-- Which kind of brand the promo came from. Written by sweepDealSource from
-- DEAL_SOURCES[].kind; every pre-migration row is a flight promo, hence the
-- default. Read by /deals/list (emitted as `kind`) so the client can chip by it.
ALTER TABLE airline_promos ADD COLUMN kind TEXT DEFAULT 'flight';

-- Phase 2 (unused this phase — the sweep leaves them NULL and /deals/list
-- emits dest = null until they are filled): the ONE destination a promo
-- centers on, geocoded, so the radar can be sorted / filtered by distance
-- from the user and pinned on the map. dest_name (v1, free text) stays the
-- display hint; these four are the machine-readable version of it.
ALTER TABLE airline_promos ADD COLUMN dest_lat     REAL;
ALTER TABLE airline_promos ADD COLUMN dest_lng     REAL;
ALTER TABLE airline_promos ADD COLUMN dest_city    TEXT;
ALTER TABLE airline_promos ADD COLUMN dest_country TEXT;
