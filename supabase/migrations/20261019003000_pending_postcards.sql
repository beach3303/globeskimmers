-- A postcard that waits (Step B, founder 2026-10-18): a card addressed to an email that isn't a
-- member's yet. Only a keyed hash of the address is kept; the card is delivered into
-- api.postcards the first time an account with that email reads its Mailbox, and undelivered
-- rows (and their photos) are pruned after 90 days by the daily cron.
create table if not exists api.pending_postcards (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null,
  email_hash    text not null,            -- HMAC-SHA256 of the lower-cased address, never the address
  photo_key     text not null,            -- R2 pc/<uuid>.<ext>, moderated at send
  message       text,
  place_name    text, city text, country text, region text,
  meta          jsonb,
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  delivered_to  uuid
);
create index if not exists pending_postcards_hash   on api.pending_postcards (email_hash) where delivered_at is null;
create index if not exists pending_postcards_sender on api.pending_postcards (sender_id, created_at desc);
alter table api.pending_postcards enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'api' and tablename = 'pending_postcards' and policyname = 'pending_postcards_service') then
    create policy pending_postcards_service on api.pending_postcards for all to service_role using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on api.pending_postcards to service_role;
notify pgrst, 'reload schema';
