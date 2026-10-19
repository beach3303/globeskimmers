-- Telegrams (founder, 2026-10-19): words by wire, no photo. Three words at most ("spike
-- curiosity"; a real telegram's base rate covered ten); STOP rides free. Sent only to one person
-- by @username (or as a reply), adults only, words checked at send. Worker-only, like postcards.
create table if not exists api.telegrams (
  id                    uuid primary key default gen_random_uuid(),
  sender_id             uuid not null,
  to_user_id            uuid not null,
  body                  text not null check (char_length(body) <= 160),  -- the worker keeps it ≤ 120
  reply_to              uuid,                 -- the telegram or postcard it answers, if any
  created_at            timestamptz not null default now(),
  recipient_deleted_at  timestamptz           -- the recipient took it out of their Mailbox
);
create index if not exists telegrams_to_idx     on api.telegrams (to_user_id, created_at desc);
create index if not exists telegrams_sender_idx on api.telegrams (sender_id, created_at desc);
alter table api.telegrams enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'api' and tablename = 'telegrams' and policyname = 'telegrams_service') then
    create policy telegrams_service on api.telegrams for all to service_role using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on api.telegrams to service_role;
notify pgrst, 'reload schema';
