-- Guestbook schema — run once in the Supabase SQL editor.
-- Tables live in the `api` schema (the exposed Data API schema, same place as
-- nearby_places), so the Worker can reach them via PostgREST with the service key.
-- Generic by (entity_type, entity_id) so ONE guestbook serves attractions,
-- restaurants, coffee, shops, etc.

-- Public notes/tips (warm tips-for-the-next-traveler, NOT star reviews).
create table if not exists api.guestbook_entries (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null,               -- 'attraction' | 'restaurant' | 'coffee' | ...
  entity_id      text not null,               -- our owned place id, or a google place_id
  entity_name    text,
  user_id        uuid,                         -- set null on account deletion (anonymize, keep the tip)
  display_name   text,                         -- first name / chosen handle (snapshot)
  home_city      text,                         -- optional, user's choice
  prompt_type    text,                         -- 'tip' | 'shoutout' | 'story' | 'musttry'
  body           text not null,
  verified_visit boolean default false,        -- was the underlying visit GPS-verified
  created_at     timestamptz default now(),
  edited_at      timestamptz,
  deleted_at     timestamptz,                  -- soft delete (author) — hides from public, keeps aggregate
  flag_count     integer default 0,
  hidden         boolean default false          -- admin-hidden (moderation)
);
create index if not exists gb_entries_entity_idx on api.guestbook_entries (entity_id, created_at desc);
create index if not exists gb_entries_user_idx   on api.guestbook_entries (user_id);

-- Visit records = the eligibility token to sign a place's guestbook AND the
-- "please sign later" reminder queue. One row per (user, place).
create table if not exists api.guestbook_visits (
  user_id     uuid not null,
  entity_type text not null,
  entity_id   text not null,
  entity_name text,
  visited_at  timestamptz default now(),
  verified    boolean default false,           -- gps-verified vs self-declared
  signed      boolean default false,           -- have they left a note yet
  primary key (user_id, entity_id)
);
create index if not exists gb_visits_user_idx on api.guestbook_visits (user_id);

-- RLS: anyone may READ visible entries; ALL writes go through the Worker
-- (service-role key bypasses RLS). No client write policies = no direct writes.
alter table api.guestbook_entries enable row level security;
alter table api.guestbook_visits  enable row level security;

drop policy if exists gb_public_read on api.guestbook_entries;
create policy gb_public_read on api.guestbook_entries
  for select using (hidden = false and deleted_at is null);

-- Atomic report: bump the flag count, auto-hide at 3 reports (pending admin review).
create or replace function api.gb_report(p_id uuid)
returns void
language sql
security definer
set search_path = api
as $$
  update api.guestbook_entries
  set flag_count = flag_count + 1,
      hidden = (hidden or (flag_count + 1 >= 3))
  where id = p_id;
$$;
grant execute on function api.gb_report to anon, authenticated, service_role;

-- Grants. The Worker uses the SERVICE key (service_role), which needs explicit
-- table privileges on custom-schema tables. anon/authenticated get read on entries
-- (RLS still gates to visible rows); visits are Worker-only.
grant all privileges on api.guestbook_entries to service_role;
grant all privileges on api.guestbook_visits  to service_role;
grant select on api.guestbook_entries to anon, authenticated;
notify pgrst, 'reload schema';
