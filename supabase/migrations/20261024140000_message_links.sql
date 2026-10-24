-- Text or share it (founder, 2026-10-24: "can we do send invitation via text message"): a postcard
-- or telegram that travels as a link the sender texts or shares from their own phone. Stored once
-- under a short code; up to max_claims people open it in the app, each getting their own copy
-- (message_link_claims, one row per person). No phone number is ever stored. Expired links (and a
-- postcard link's photo) are pruned by the daily cron.
create table if not exists api.message_links (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- 8 characters, A-Z and 2-9 without look-alikes
  sender_id   uuid not null,
  kind        text not null check (kind in ('postcard', 'telegram')),
  photo_key   text,                          -- postcard: R2 pc/<uuid>.<ext>, moderated at send
  message     text,
  place_name  text, city text, country text, region text,
  meta        jsonb,
  body        text,                          -- telegram: the words, checked at send
  ink         text,
  max_claims  int not null default 10,
  claims      int not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '90 days'
);
create index if not exists message_links_sender  on api.message_links (sender_id, created_at desc);
create index if not exists message_links_expires on api.message_links (expires_at);
create table if not exists api.message_link_claims (
  link_id     uuid not null references api.message_links (id) on delete cascade,
  user_id     uuid not null,
  claimed_at  timestamptz not null default now(),
  primary key (link_id, user_id)
);
alter table api.message_links enable row level security;
alter table api.message_link_claims enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'api' and tablename = 'message_links' and policyname = 'message_links_service') then
    create policy message_links_service on api.message_links for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'api' and tablename = 'message_link_claims' and policyname = 'message_link_claims_service') then
    create policy message_link_claims_service on api.message_link_claims for all to service_role using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on api.message_links, api.message_link_claims to service_role;
notify pgrst, 'reload schema';
