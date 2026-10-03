-- "Add your dish" (founder, 2026-10-03): a traveler's photo of what they ordered
-- at a restaurant or café, posted only with proof they were there (GPS at the
-- place, or the photo's own location tag) and shown only after photo review.
-- One post per traveler per dish per place; "ordered by N travelers" counts them.
create table if not exists api.place_dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  place_id text not null,           -- Google place id when known, else the owned place uuid
  place_name text,
  kind text not null default 'restaurant' check (kind in ('restaurant', 'coffee')),
  dish text not null,
  dish_key text not null,           -- lowercased, accent-folded, for counting
  photo_key text not null,
  photo_url text not null,
  proof text not null check (proof in ('gps', 'photo_loc')),
  mod_status text not null default 'ok' check (mod_status in ('ok', 'blocked')),
  created_at timestamptz not null default now()
);
create index if not exists place_dishes_place_idx on api.place_dishes (place_id, created_at desc);
create unique index if not exists place_dishes_one_per_dish on api.place_dishes (user_id, place_id, dish_key);
create index if not exists place_dishes_user_idx on api.place_dishes (user_id, created_at desc);
alter table api.place_dishes enable row level security;
grant select, insert, update, delete on api.place_dishes to service_role;
