-- 09_stripe_payments.sql — Stripe Wave 1 (GlobeSkimmers-as-merchant package checkout).
-- Run once against the EVENTS database (globeskimmers-events, binding `DB`):
--   npx wrangler d1 execute globeskimmers-events --file=cloudflare-worker/sql/09_stripe_payments.sql --remote
-- "table already exists" on re-run = already applied.

-- One Stripe Customer per Supabase user, minted lazily at first checkout so
-- Stripe Link / saved cards recognize returning users. user_id comes ONLY from
-- a GoTrue-verified JWT (gbUser) — never from the request body.
CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id     TEXT PRIMARY KEY,          -- Supabase auth user id (GoTrue-verified)
  customer_id TEXT NOT NULL,             -- Stripe cus_… id
  created     TEXT DEFAULT (datetime('now'))
);

-- One row per PaymentIntent we mint. pid is our random-hex session id (the only
-- thing URLs and the phone ever carry — same design as nuitee_sessions sids).
-- client_secret lives ONLY here and interpolated server-side into the payment
-- page HTML — never in a URL, never in a JSON response.
CREATE TABLE IF NOT EXISTS stripe_payments (
  pid           TEXT PRIMARY KEY,        -- random 24-hex, minted at checkout time
  intent_id     TEXT,                    -- Stripe pi_… id
  client_secret TEXT,                    -- Stripe client secret (page-render only)
  order_id      TEXT,                    -- package_orders.sid this pays for
  user_id       TEXT,                    -- GoTrue-verified Supabase user id, or NULL
  amount        INTEGER,                 -- smallest currency unit (2-decimal currencies only)
  currency      TEXT,                    -- upper-case ISO 4217
  status        TEXT,                    -- created | Stripe intent status (succeeded, processing, requires_payment_method, canceled, …)
  created       TEXT DEFAULT (datetime('now')),
  updated       TEXT
);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_order ON stripe_payments (order_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_user  ON stripe_payments (user_id);
