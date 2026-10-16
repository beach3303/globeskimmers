-- City Billboards (founder decisions, 2026-10-16): photos follow their public stamp onto its
-- city board with a heads-up instead of an ask. Two additions, both additive:
--   1. a photo can be taken down from boards without leaving its album (board_hidden);
--   2. the one-time heads-up per board (board_notices), read by the Mailbox.
-- Postcards gain the state/region of their city so US state boards can roll them up.

alter table api.passport_stamp_photos
  add column if not exists board_hidden boolean not null default false;

alter table api.postcards
  add column if not exists region text;

create table if not exists api.board_notices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  board_key   text not null,          -- 'lisbon|portugal', 'state:texas|united states', 'country:ghana'
  board_name  text not null,          -- 'Lisbon', 'Texas', 'Ghana' (as the note prints it)
  kind        text not null default 'city',   -- city | state | country
  photos      int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, board_key)
);

create index if not exists board_notices_user_created on api.board_notices (user_id, created_at desc);

alter table api.board_notices enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'api' and tablename = 'board_notices' and policyname = 'board_notices_service') then
    create policy board_notices_service on api.board_notices for all to service_role using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on api.board_notices to service_role;
