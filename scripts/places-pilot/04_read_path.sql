-- Owned-places read-path RPC. Run once in the Supabase SQL Editor.
-- The Worker's /places/nearby-owned endpoint calls this via PostgREST.
-- City-agnostic: answers "what's near this point?" for ANY loaded coordinates.

create or replace function nearby_places(
  in_lat      double precision,
  in_lng      double precision,
  in_radius_m double precision default 2000,
  in_limit    int              default 20,
  in_category text             default null
)
returns table (
  id       text,
  name     text,
  category text,
  lat      double precision,
  lng      double precision,
  address  text,
  city     text,
  phone    text,
  website  text,
  meters   double precision
)
language sql
stable
as $$
  select
    p.id, p.name, p.category, p.lat, p.lng, p.address, p.city, p.phone, p.website,
    round(st_distance(
      p.geom::geography,
      st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
    )) as meters
  from places p
  where st_dwithin(
          p.geom::geography,
          st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography,
          in_radius_m
        )
    and (in_category is null or p.category = in_category)
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)  -- uses the GiST index
  limit in_limit;
$$;

-- The Worker calls with the service key, but grant broadly so it's usable either way.
grant execute on function nearby_places to anon, authenticated, service_role;

-- Quick test (should return Times Square places ranked by meters):
-- select * from nearby_places(40.7580, -73.9855, 2000, 20);
