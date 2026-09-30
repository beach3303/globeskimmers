-- The Blotter (founder concept 2026-09-30, mockup v3): reactions live AROUND a
-- shared passport page, never inside the booklet. Marks are stamp presses
-- (wow/takeme/been/wannago/morepics + contextual yummy) keyed to a stamp
-- ('st:<stamp uuid>'); the Guestbook holds signatures and finger DOODLES
-- (moderated images, R2 bl/); co-signs are our comment-like — public
-- authorship, tap to sign under someone's words, tap again to lift your pen.
-- Worker-only (service_role); RLS on with zero client policies, like the rest.

create table if not exists api.blotter_marks (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,      -- whose blotter (the booklet owner)
  target        text not null,      -- 'st:<stamp uuid>'
  user_id       uuid not null,      -- who pressed
  kind          text not null check (kind in ('wow','takeme','been','wannago','morepics','yummy')),
  created_at    timestamptz not null default now(),
  unique (target, user_id, kind)
);
create index if not exists blotter_marks_owner_idx on api.blotter_marks (owner_user_id, target);

create table if not exists api.blotter_entries (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null,
  target         text not null,
  author_user_id uuid not null,
  body           text,              -- the signature line (moderated text)
  doodle_key     text,              -- R2 bl/<...>.png — moderated BEFORE store, fail-closed
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create index if not exists blotter_entries_owner_idx  on api.blotter_entries (owner_user_id, target, created_at);
create index if not exists blotter_entries_author_idx on api.blotter_entries (author_user_id, created_at desc);

create table if not exists api.blotter_cosigns (
  entry_id   uuid not null references api.blotter_entries(id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

-- YUMMY's second signal: the existing vision-moderation call now also answers
-- "is food the MAIN subject?" — stored here at the public-flip sweep.
-- null = never asked (pre-Blotter photos) → no YUMMY tray, conservative.
alter table api.passport_stamp_photos add column if not exists food_subject int;

alter table api.blotter_marks   enable row level security;
alter table api.blotter_entries enable row level security;
alter table api.blotter_cosigns enable row level security;
grant select, insert, update, delete on api.blotter_marks   to service_role;
grant select, insert, update, delete on api.blotter_entries to service_role;
grant select, insert, update, delete on api.blotter_cosigns to service_role;
notify pgrst, 'reload schema';
