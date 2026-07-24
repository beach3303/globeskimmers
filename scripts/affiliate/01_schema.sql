-- Affiliate click-ownership table (D1: globeskimmers-events / env.DB).
-- Run once:  wrangler d1 execute globeskimmers-events --file=scripts/affiliate/01_schema.sql --remote
-- One row per outbound affiliate tap. Conversion columns are backfilled later by
-- importing each network's report and joining on subid.
create table if not exists affiliate_clicks (
  subid         text primary key,          -- the SubID we mint + append to the partner URL
  ts            integer not null,          -- click time (unix seconds)
  user_id       text,                      -- Supabase user id if signed in (else null)
  partner       text not null,             -- 'viator' | 'booking' | 'discovercars' | ...
  product_id    text,
  product_name  text,
  category      text,                      -- 'tour' | 'hotel' | 'transfer' | 'car' | ...
  dest_country  text,
  dest_city     text,
  target_url    text,                      -- the tracked partner URL we redirected to
  -- conversion (filled on report import) --
  converted     integer default 0,
  commission    real,
  currency      text,
  status        text,                      -- 'pending' | 'confirmed' | 'cancelled'
  converted_ts  integer
);
create index if not exists aff_clicks_ts_idx      on affiliate_clicks(ts);
create index if not exists aff_clicks_partner_idx on affiliate_clicks(partner);
create index if not exists aff_clicks_user_idx    on affiliate_clicks(user_id);
create index if not exists aff_clicks_conv_idx    on affiliate_clicks(converted);
