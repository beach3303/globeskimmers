-- Shopping (malls, department stores, boutiques, markets) from the owned planet DB.
-- Run once in the Supabase SQL editor. Same pattern as nearby_coffee: the
-- st_dwithin (geography index) narrows to the local radius first, then the
-- category filter runs on that small set.

create or replace function api.nearby_shopping(
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
      -- Broadened so the food-shopping chips (Groceries / Warehouse / Butcher…)
      -- have raw material: %market% alone missed grocery_store / greengrocer /
      -- butcher / wholesale / outlet / duty_free / souvenir / craft.
      p.category ilike any (array[
        '%shopping%','%department_store%','%mall%','%market%','%boutique%',
        '%grocery%','%supermarket%','%greengrocer%','%butcher%','%warehouse%',
        '%wholesale%','%outlet%','%duty_free%','%souvenir%','%gift%','%craft%','%bazaar%'])
      or p.category in ('shopping_center','shopping_mall','clothing_store','shoe_store')
    )
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)
  limit in_limit;
$$;

grant execute on function api.nearby_shopping to anon, authenticated, service_role;
notify pgrst, 'reload schema';
