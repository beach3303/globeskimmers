-- 07_package_orders.sql — Smart Packages groundwork (brief Part Three / Phase 2-3).
-- Run once against the EVENTS database (globeskimmers-events, binding `DB`):
--   npx wrangler d1 execute globeskimmers-events --file=cloudflare-worker/sql/07_package_orders.sql --remote
-- "duplicate column name" / "table already exists" on re-run = already applied.

-- A package is three bookings that must succeed together. Same design as
-- nuitee_sessions (chosen over KV for strong consistency — KV's 60s edge cache
-- served a stale 'pending' after a live booking, measured 2026-09-01):
-- sid is the only thing the phone holds; data carries the full draft/booking JSON.
CREATE TABLE IF NOT EXISTS package_orders (
  sid        TEXT PRIMARY KEY,          -- random 32-hex, minted at draft time
  user_id    TEXT,
  status     TEXT NOT NULL,             -- drafting | priced | booking | booked | partial | failed | expired
  env        TEXT NOT NULL DEFAULT 'sandbox',
  corridor   TEXT,                      -- e.g. 'LAX-AKN' (origin-dest IATA-ish key)
  created    INTEGER NOT NULL,          -- ms epoch
  updated    INTEGER NOT NULL,
  data       TEXT                       -- full JSON: intent, party, dates, components, totals, terms
);
CREATE INDEX IF NOT EXISTS idx_package_orders_user    ON package_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_package_orders_status  ON package_orders (status, updated);

-- Per-corridor component price observations, captured from day one so the
-- best-time vs cheapest-time verdicts are EARNED from our own history, never
-- invented (brief Part Three, S3). Append-only; written via ctx.waitUntil from
-- the handlers that already fetch live prices (Nuitée rates, Viator schedules,
-- Ticketmaster events).
CREATE TABLE IF NOT EXISTS price_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,          -- unix seconds, server-issued
  corridor   TEXT,                      -- destination key: 'city|country' lowercased (origin unknown for ambient captures)
  component  TEXT NOT NULL,             -- hotel | tour | event | flight | lastmile
  product_id TEXT,                      -- hotelId / productCode / event id
  price      REAL NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'USD',
  meta       TEXT                       -- small JSON: {checkin, nights, pax} etc.
);
CREATE INDEX IF NOT EXISTS idx_price_history_corridor ON price_history (corridor, component, ts);
