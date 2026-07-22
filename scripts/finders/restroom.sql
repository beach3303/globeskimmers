-- Public restrooms / toilets from the owned planet DB. Run once in the Supabase
-- SQL editor. Same pattern as nearby_coffee: the st_dwithin (geography index)
-- narrows to the local radius first, then the category filter runs on that
-- small set. NOTE: Overture has relatively FEW public-restroom POIs, so this
-- may return little in some areas — evaluate coverage before relying on it.

create or replace function api.nearby_restroom(
  in_lat      double precision,
  in_lng      double precision,
  in_radius_m double precision default 8000,
  in_limit    int              default 40
)
returns table (
  id text, name text, category text, lat double precision, lng double precision,
  address text, city text, region text, country text, phone text, website text, meters double precision
)
language sql
stable
set search_path = public
as $$
  select
    p.id, p.name, p.category, p.lat, p.lng, p.address, p.city, p.region, p.country, p.phone, p.website,
    round(st_distance(p.geom::geography, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography)) as meters
  from places p
  where st_dwithin(p.geom::geography, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, in_radius_m)
    and p.name is not null
    and (
      p.category ilike '%toilet%'
      or p.category ilike '%restroom%'
    )
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)
  limit in_limit;
$$;

grant execute on function api.nearby_restroom to anon, authenticated, service_role;
notify pgrst, 'reload schema';
