-- Contribute to City Boards (founder, 2026-10-27): an album on the profile, open until
-- June 30, 2027, that sends a member's photos to the boards of the cities they were taken in.
-- Public by design (the album says so), from "a traveler" (no username on the board), and the
-- member can delete any photo any time: the row and its file go. A photo needs its own
-- location (the city is read from it; the point itself is never kept), passes the AI photo
-- check, and is never one where a child is clearly recognizable. Only the worker reads and
-- writes this table (service role).
create table if not exists api.board_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  board_key text not null,          -- the city board's key (pcCityKey): 'lisbon|portugal'
  city text not null,
  region text,                      -- the state, for US boards
  country text not null,
  taken_at timestamptz,             -- when the photo was taken, from the photo
  caption text,
  photo_key text not null,          -- R2: bc/<user id>/<uuid>.jpg
  mod_status text not null default 'ok' check (mod_status in ('ok', 'blocked')),
  hidden boolean not null default false,   -- taken down after reports or by the founder
  created_at timestamptz not null default now()
);
create index if not exists board_contributions_board_idx on api.board_contributions (board_key, created_at desc);
create index if not exists board_contributions_country_idx on api.board_contributions (country, created_at desc);
create index if not exists board_contributions_user_idx on api.board_contributions (user_id, created_at desc);
alter table api.board_contributions enable row level security;
grant select, insert, update, delete on api.board_contributions to service_role;
notify pgrst, 'reload schema';
