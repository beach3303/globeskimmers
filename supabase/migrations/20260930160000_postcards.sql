-- Postcards (founder concept, 2026-09-29): a moment SENT, not posted — the
-- photo on the front, the words and a postmark on the back. Worker-only.
create table if not exists api.postcards (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null,
  to_user_id  uuid,                -- null = to everyone who follows the sender
  photo_key   text not null,       -- R2 pc/<uuid>.<ext> (moderated AT SEND, fail-closed)
  message     text,
  place_name  text, city text, country text,
  meta        jsonb,               -- e.g. { dish, from, verdict } for food cards
  created_at  timestamptz default now()
);
create index if not exists postcards_to_idx     on api.postcards (to_user_id, created_at desc);
create index if not exists postcards_sender_idx on api.postcards (sender_id, created_at desc);
alter table api.postcards enable row level security;
grant select, insert, update, delete on api.postcards to service_role;
notify pgrst, 'reload schema';
