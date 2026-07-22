-- Nearby attractions from the owned planet DB. Run once in the Supabase SQL editor.
-- Filters the 75M places to attraction/landmark categories near a point.

create or replace function api.nearby_attractions(
  in_lat      double precision,
  in_lng      double precision,
  in_radius_m double precision default 20000,
  in_limit    int              default 30
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
      p.category ilike any (array[
        '%tourist_attraction%','%museum%','%monument%','%landmark%','%art_gallery%','%historic%',
        '%national_park%','%castle%','%palace%','%temple%','%cathedral%','%basilica%','%shrine%',
        '%viewpoint%','%scenic%','%observation%','%zoo%','%aquarium%','%botanical%','%amusement_park%',
        '%theme_park%','%waterfall%','%lighthouse%','%memorial%'])
      or p.category in ('park','garden','beach','mountain','lake')
    )
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)
  limit in_limit;
$$;

grant execute on function api.nearby_attractions to anon, authenticated, service_role;
notify pgrst, 'reload schema';
