-- Collectible stamps for City Board contributors (founder, 2026-10-28): every 10 photos a member
-- contributes to City Boards earns one collectible stamp, picked at random from the six
-- (Official Traveler No. 1-2, Certified Explorer No. 3-4, Adventure Pro No. 5-6). Deleting a
-- photo later never takes a stamp back, so the count that earns them only goes up: it lives
-- here, not in board_contributions (whose rows go when a photo is deleted). A stamp is earned
-- the moment the 10th photo posts; the member then places it in their passport (placed_at) at
-- Only me, Friends, Friends & followers or Everyone, or leaves it for later. Only the worker
-- reads and writes these tables (service role).

-- Photos ever posted to City Boards, per member.
create table if not exists api.board_contrib_tally (
  user_id uuid primary key,
  posted int not null default 0,
  updated_at timestamptz not null default now()
);
alter table api.board_contrib_tally enable row level security;
revoke all privileges on api.board_contrib_tally from anon, authenticated;
grant select, insert, update, delete on api.board_contrib_tally to service_role;

-- The stamps earned. badge: the art's number (1-80 leaves room for the series the art is
-- numbered for); milestone: the count that earned it (10, 20, 30...), once per member.
create table if not exists api.collectibles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null default 'city_boards',
  badge smallint not null check (badge between 1 and 80),
  milestone int not null,
  visibility text check (visibility is null or visibility in ('me', 'inner', 'followers', 'public')),
  placed_at timestamptz,
  earned_at timestamptz not null default now(),
  unique (user_id, source, milestone)
);
create index if not exists collectibles_user_idx on api.collectibles (user_id, earned_at desc);
create index if not exists collectibles_earned_idx on api.collectibles (earned_at);
alter table api.collectibles enable row level security;
revoke all privileges on api.collectibles from anon, authenticated;
grant select, insert, update, delete on api.collectibles to service_role;

-- One more photo posted: the new running count, in one statement (no lost updates).
create or replace function api.bc_tally_bump(p_user uuid)
returns int language sql security definer set search_path = api as $$
  insert into api.board_contrib_tally as t (user_id, posted) values (p_user, 1)
  on conflict (user_id) do update set posted = t.posted + 1, updated_at = now()
  returning posted;
$$;
revoke execute on function api.bc_tally_bump(uuid) from public, anon, authenticated;
grant execute on function api.bc_tally_bump(uuid) to service_role;

-- Photos already posted count toward the first stamp.
insert into api.board_contrib_tally (user_id, posted)
  select user_id, count(*)::int from api.board_contributions where mod_status = 'ok' group by user_id
  on conflict (user_id) do nothing;

notify pgrst, 'reload schema';
