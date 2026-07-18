-- Owned Places DB — pilot schema (run once in Supabase SQL editor or via psql).
-- One spatial table seeded from Overture; our enrichment columns win over source data.

create extension if not exists postgis;

create table if not exists places (
  id            text primary key,        -- Overture GERS id (stable; storable forever)
  name          text,
  category      text,                    -- Overture categories.primary
  category_alt  text[],                  -- alternate categories
  lat           double precision not null,
  lng           double precision not null,
  -- PostGIS point auto-derived from lat/lng; this is what radius/nearest queries use.
  geom          geometry(Point, 4326)
                  generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  address       text,
  city          text,
  region        text,
  country       text,                    -- ISO-2
  postcode      text,
  phone         text,
  website       text,
  confidence    double precision,        -- Overture source confidence 0..1
  sources       jsonb,                   -- provenance: which datasets/licenses this came from

  -- Our enrichment layer (precedence: merchant-verified > our-crowdsource > source base).
  our_verified        boolean default false,
  merchant_claimed_by text,
  updated_at          timestamptz default now()
);

-- Spatial indexes = the reason we use PostGIS (fast "within radius" / "nearest N").
create index if not exists places_geom_gix     on places using gist (geom);
-- Geography index: REQUIRED so st_dwithin(geom::geography, ...) (accurate metre
-- radius) uses an index instead of scanning all rows (otherwise it times out).
create index if not exists places_geog_gix     on places using gist ((geom::geography));
create index if not exists places_city_idx      on places (city);
create index if not exists places_category_idx  on places (category);
