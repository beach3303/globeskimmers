-- Every city board with postcards (founder, 2026-10-14: "A City Boards page. Every city whose
-- board has postcards, busiest first, each with its newest photo as the cover and a count").
-- One row per board: its newest display names, how many cards it holds (in all, and in the
-- last 30 days), the newest card's time, and the newest few photos to choose a cover from
-- (the worker skips senders the viewer blocked). It counts adults' cards only, as the board
-- shows only those. Busiest first: the last 30 days, then all time, then the newest.
-- p_q narrows by the board key ('lisbon|portugal', unaccented lowercase), so a country
-- finds its cities too. Worker-only, like every postcard.
create or replace function api.city_boards(p_q text default null, p_limit int default 60)
returns table (to_city text, city text, country text, total bigint, recent bigint, last_at timestamptz, covers jsonb)
language sql stable
set search_path = api, public
as $$
  select b.to_city, b.city, b.country, b.total, b.recent, b.last_at, b.covers
  from (
    select p.to_city,
           (array_agg(p.city order by p.created_at desc))[1] as city,
           (array_agg(p.country order by p.created_at desc))[1] as country,
           count(*) as total,
           count(*) filter (where p.created_at > now() - interval '30 days') as recent,
           max(p.created_at) as last_at,
           (select coalesce(jsonb_agg(c.cover), '[]'::jsonb) from (
              select jsonb_build_object('photo_key', q.photo_key, 'sender_id', q.sender_id) as cover
              from api.postcards q
              where q.to_city = p.to_city and q.photo_key is not null
                and exists (select 1 from api.social_profiles s where s.user_id = q.sender_id and s.social_tier = 'adult')
              order by q.created_at desc
              limit 4) c) as covers
    from api.postcards p
    where p.to_city is not null
      and exists (select 1 from api.social_profiles s where s.user_id = p.sender_id and s.social_tier = 'adult')
      and (coalesce(p_q, '') = '' or strpos(p.to_city, p_q) > 0)
    group by p.to_city
  ) b
  order by b.recent desc, b.total desc, b.last_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 100));
$$;
revoke execute on function api.city_boards(text, int) from public, anon, authenticated;
grant execute on function api.city_boards(text, int) to service_role;
notify pgrst, 'reload schema';
