-- ═══════════════════════════════════════════════════════════════
-- RUN ALL — paste this whole file into the Supabase SQL editor and Run.
-- Activates every owned-DB finder + the guestbook photo columns.
-- Idempotent (create-or-replace / add-column-if-not-exists) — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ─────────── attractions ───────────
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
    -- Exclude RESIDENTIAL buildings Overture mis-tags as landmarks (condos /
    -- staffhouses / townhomes — rampant in PH/SE-Asia). Safe: real attractions
    -- are never named these tokens. See scripts/finders/attractions.sql.
    and p.name !~* '(\m(condo|condominium|condominiums|residence|residences|townhome|townhomes|townhouse|townhouses|apartment|apartments|apartelle|staff\s*house|staffhouse|subdivision|dormitory|dorm)\M)'
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)
  limit in_limit;
$$;

grant execute on function api.nearby_attractions to anon, authenticated, service_role;
notify pgrst, 'reload schema';


-- ─────────── coffee ───────────
-- Coffee shops from the owned planet DB. Run once in the Supabase SQL editor.
-- Same pattern as nearby_restaurants: the st_dwithin (geography index) narrows to
-- the local radius first, then the category filter runs on that small set.

create or replace function api.nearby_coffee(
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
      p.category ilike '%coffee%' or p.category ilike '%cafe%'
      or p.category in ('cafe','tea_house','tea_room','bubble_tea_shop','patisserie')
    )
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)
  limit in_limit;
$$;

grant execute on function api.nearby_coffee to anon, authenticated, service_role;
notify pgrst, 'reload schema';


-- ─────────── atm ───────────
-- ATMs & bank machines from the owned planet DB. Run once in the Supabase SQL editor.
-- Same pattern as nearby_coffee: the st_dwithin (geography index) narrows to
-- the local radius first, then the category filter runs on that small set.

create or replace function api.nearby_atm(
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
      p.category ilike '%atm%'
      or p.category in ('bank','credit_union')
    )
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)
  limit in_limit;
$$;

grant execute on function api.nearby_atm to anon, authenticated, service_role;
notify pgrst, 'reload schema';


-- ─────────── shopping ───────────
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
      -- Broadened for the food-shopping chips — see scripts/finders/shopping.sql.
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


-- ─────────── restroom ───────────
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


-- ─────────── convenience ───────────
-- Convenience stores / minimarts from the owned planet DB. Run once in the
-- Supabase SQL editor. Same pattern as nearby_coffee: the st_dwithin (geography
-- index) narrows to the local radius first, then the category filter runs on
-- that small set.

create or replace function api.nearby_convenience(
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
      p.category ilike '%convenience%'
      or p.category in ('convenience_store','grocery_store','minimart','corner_store')
    )
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)
  limit in_limit;
$$;

grant execute on function api.nearby_convenience to anon, authenticated, service_role;
notify pgrst, 'reload schema';


-- ─────────── moneyexchange ───────────
-- Money exchange / currency exchange / bureau de change from the owned planet DB.
-- Run once in the Supabase SQL editor. Same pattern as nearby_coffee: the
-- st_dwithin (geography index) narrows to the local radius first, then the
-- category filter runs on that small set. NOTE: this only covers the LOCATIONS
-- side of the Money Exchange page — the exchange-RATE fetch is separate and
-- untouched.

create or replace function api.nearby_moneyexchange(
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
      p.category ilike '%currency%'
      or p.category ilike '%money_exchange%'
      or p.category in ('currency_exchange','bureau_de_change')
    )
  order by p.geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)
  limit in_limit;
$$;

grant execute on function api.nearby_moneyexchange to anon, authenticated, service_role;
notify pgrst, 'reload schema';


-- ─────────── guestbook photo columns ───────────
-- Guestbook photo columns — run once in the Supabase SQL editor (after 01_schema.sql).
-- One crowdsourced photo per note (food / drink / place). The image bytes live in
-- Cloudflare R2; here we only store the key (for deletion) + a servable URL.
alter table api.guestbook_entries
  add column if not exists photo_key text,   -- R2 object key, e.g. gb/<entity>/<user>/<uuid>.jpg (for purge on delete)
  add column if not exists photo_url text,   -- Worker URL to display the photo
  add column if not exists photo_w   integer,
  add column if not exists photo_h   integer;

notify pgrst, 'reload schema';

