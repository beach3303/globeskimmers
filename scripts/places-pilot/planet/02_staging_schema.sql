-- Empty staging table for the planet load. Run once in the Supabase SQL editor.
-- Lean schema (no heavy JSON) + NO indexes yet — indexes are built AFTER the bulk
-- load (step 4) so the load is fast.

create extension if not exists postgis;

create table if not exists places_planet (
  id            text primary key,        -- Overture GERS id
  name          text,
  category      text,
  category_alt  text[],
  lat           double precision not null,
  lng           double precision not null,
  geom          geometry(Point, 4326)
                  generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  address       text,
  city          text,
  region        text,
  country       text,                    -- ISO-2
  postcode      text,
  phone         text,
  website       text,
  updated_at    timestamptz default now()
);

-- (No GiST/btree indexes here on purpose — see 03_finalize_swap.sql, built after load.)
