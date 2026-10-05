-- Private messages to a place's owner (founder, 2026-10-05): a traveler's note
-- for the owner of a restaurant, café, store or attraction — never posted.
-- Screened before it is kept for delivery: 'ok' waits for the owner, 'held'
-- waits for our team to read it first (insults at staff, accusations), and
-- 'blocked' (threats, slurs, sexual content, personal details) is never
-- delivered. The traveler's name is kept only when they chose to sign it.
-- Owners read these once they claim and verify the place (not built yet).
create table if not exists api.owner_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type text not null check (entity_type in ('attraction', 'restaurant', 'coffee', 'store', 'place')),
  entity_id text not null,          -- Google place id when known, else the owned place id
  entity_name text,
  body text not null check (char_length(body) between 2 and 1000),
  sender_name text,                 -- null = anonymous
  status text not null default 'held' check (status in ('ok', 'held', 'blocked')),
  screen_reason text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists owner_notes_entity_idx on api.owner_notes (entity_id, created_at desc);
create index if not exists owner_notes_user_idx on api.owner_notes (user_id, created_at desc);
alter table api.owner_notes enable row level security;
grant select, insert, update, delete on api.owner_notes to service_role;
