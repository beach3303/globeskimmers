-- A collectible stamp for City Board contributors (founder, 2026-10-28): a member who has posted
-- at least 10 photos to City Boards, from at least 3 different cities, earns ONE collectible
-- stamp, picked at random from six (Official Traveler, Certified Explorer, Adventure Pro, two
-- designs each). One per member, ever, and it can't be exchanged for another. Deleting photos
-- never takes it back, and never lowers the counts that earn it: they live here, not in
-- board_contributions (whose rows go when a photo is deleted). The member places the stamp on
-- their passport's first page at Only me, Friends, Friends & followers or Everyone, or later.
-- Only the worker reads and writes these tables (service role).

-- Photos ever posted to City Boards per member, and the cities they came from (board keys).
create table if not exists api.board_contrib_tally (
  user_id uuid primary key,
  posted int not null default 0,
  cities text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table api.board_contrib_tally enable row level security;
revoke all privileges on api.board_contrib_tally from anon, authenticated;
grant select, insert, update, delete on api.board_contrib_tally to service_role;

-- The stamp earned, one per member. badge: the design (1-6; up to 80 leaves room for the series
-- the art is numbered for); milestone: the photo count when it was earned.
create table if not exists api.collectibles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null default 'city_boards',
  badge smallint not null check (badge between 1 and 80),
  milestone int not null,
  visibility text check (visibility is null or visibility in ('me', 'inner', 'followers', 'public')),
  placed_at timestamptz,
  earned_at timestamptz not null default now(),
  unique (user_id, source)
);
create index if not exists collectibles_earned_idx on api.collectibles (earned_at);
alter table api.collectibles enable row level security;
revoke all privileges on api.collectibles from anon, authenticated;
grant select, insert, update, delete on api.collectibles to service_role;

-- One more photo posted, from this city: the new counts, in one statement (no lost updates).
create or replace function api.bc_tally_bump(p_user uuid, p_city text)
returns table (n_posted int, n_cities int) language sql security definer set search_path = api as $$
  insert into api.board_contrib_tally as t (user_id, posted, cities) values (p_user, 1, array[p_city])
  on conflict (user_id) do update set
    posted = t.posted + 1,
    cities = case when p_city = any(t.cities) then t.cities else t.cities || p_city end,
    updated_at = now()
  returning t.posted, cardinality(t.cities);
$$;
revoke execute on function api.bc_tally_bump(uuid, text) from public, anon, authenticated;
grant execute on function api.bc_tally_bump(uuid, text) to service_role;

-- Photos already posted count.
insert into api.board_contrib_tally (user_id, posted, cities)
  select user_id, count(*)::int, array_agg(distinct board_key) from api.board_contributions where mod_status = 'ok' group by user_id
  on conflict (user_id) do nothing;

notify pgrst, 'reload schema';
