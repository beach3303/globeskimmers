-- A telegram that waits (founder, 2026-10-24: "if an email is not registered at all, are we able to
-- send out an email of invitation … virtual postcards and virtual telegram"): a telegram addressed
-- to an email that isn't a member's yet, kept like a waiting postcard. Only a keyed hash of the
-- address is stored; the telegram is delivered into api.telegrams the first time an account with
-- that email reads its Mailbox, and undelivered rows are pruned after 90 days by the daily cron.
create table if not exists api.pending_telegrams (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null,
  email_hash    text not null,            -- HMAC-SHA256 of the lower-cased address, never the address
  body          text not null,            -- the words, checked at send
  ink           text,
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  delivered_to  uuid
);
create index if not exists pending_telegrams_hash   on api.pending_telegrams (email_hash) where delivered_at is null;
create index if not exists pending_telegrams_sender on api.pending_telegrams (sender_id, created_at desc);
alter table api.pending_telegrams enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'api' and tablename = 'pending_telegrams' and policyname = 'pending_telegrams_service') then
    create policy pending_telegrams_service on api.pending_telegrams for all to service_role using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on api.pending_telegrams to service_role;
notify pgrst, 'reload schema';
