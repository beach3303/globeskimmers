-- Nuitée Connect checkout sessions (globeskimmers-events D1).
-- Why D1 and not KV: KV caches reads at the edge for up to 60s, so a status
-- check that ran before the booking kept answering "pending" after it
-- (measured, sandbox 2026-09-01). D1 is strongly consistent.
-- Pending sessions expire after 30 min (enforced in the worker); booked/failed
-- rows are kept for support lookups.
--   npx wrangler d1 execute globeskimmers-events --file=cloudflare-worker/sql/05_nuitee_sessions.sql --remote
create table if not exists nuitee_sessions (
  sid      text primary key,           -- random 32-hex session id (the only thing the phone holds)
  user_id  text,                       -- Supabase user id (null for sandbox/curl)
  status   text not null,              -- 'pending' | 'booked' | 'failed'
  env      text,                       -- 'sandbox' | 'production'
  created  integer not null,           -- ms epoch
  updated  integer not null,           -- ms epoch (pending TTL is measured from here)
  data     text not null               -- full session JSON (prebookId, transactionId, secretKey, holder, booking…)
);
create index if not exists nuitee_sessions_user_idx on nuitee_sessions(user_id);
create index if not exists nuitee_sessions_status_idx on nuitee_sessions(status, updated);
