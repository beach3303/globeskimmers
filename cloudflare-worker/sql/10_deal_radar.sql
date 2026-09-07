-- 10_deal_radar.sql — Deal Radar v1 (airline promo sweep, evidence-gated AI extraction).
-- Run once against the EVENTS database (globeskimmers-events, binding `DB`):
--   npx wrangler d1 execute globeskimmers-events --file=cloudflare-worker/sql/10_deal_radar.sql --remote
-- "table already exists" on re-run = already applied.

-- One row per promo the airline's OWN deals page currently states. Written only
-- by dealRadarSweep in cloudflare-worker-v7.12.js (daily cron + POST /deals/sweep);
-- read by GET /deals/list. HONESTY IS THE PRODUCT: headline/detail/ends are only
-- accepted when they are backed by `evidence` — a verbatim quote from the fetched
-- page — so every claim in this table traces to the airline's own words.
-- `evidence` is server-side audit material and is NEVER returned by /deals/list.
CREATE TABLE IF NOT EXISTS airline_promos (
  id          TEXT PRIMARY KEY,              -- sha-256 hash of airline + headline (stable across sweeps of the same promo)
  airline     TEXT,                          -- display name ("Southwest") — matches DEAL_SOURCES in the worker
  airline_url TEXT,                          -- the official deals page the promo was read from (what the card opens)
  headline    TEXT,                          -- <= 80 chars; every number in it must appear in `evidence`
  detail      TEXT,                          -- <= 140 chars, or NULL; same evidence rule
  dest_name   TEXT,                          -- single city/region the sale clearly centers on, or NULL
  ends        TEXT,                          -- verbatim end-date string FROM the page text, or NULL — never a parsed/guessed date
  evidence    TEXT,                          -- the exact source snippet (20-200 chars) the claims came from — audit trail, server-side only
  first_seen  TEXT DEFAULT (datetime('now')),-- when this promo id first appeared (preserved across upserts)
  last_seen   TEXT,                          -- refreshed on every sweep that still sees the promo
  active      INTEGER DEFAULT 1             -- 1 = on the page as of the latest changed sweep; 0 = superseded
);

-- /deals/list filters: active = 1 AND last_seen within 7 days, newest first.
CREATE INDEX IF NOT EXISTS idx_airline_promos_active ON airline_promos (active, last_seen);
-- Sweep supersede pass: "UPDATE ... SET active = 0 WHERE airline = ?".
CREATE INDEX IF NOT EXISTS idx_airline_promos_airline ON airline_promos (airline);
