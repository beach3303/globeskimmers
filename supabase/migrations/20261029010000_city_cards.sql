-- City Cards (founder, 2026-10-28): a restaurant, café, shop or convenience store never stamps
-- the Virtual Passport again; it stamps a CITY CARD — one card per city per year, numbered,
-- ten slots. Each slot is a stamp: the founder's category artwork with the business's name and
-- the date of the visit. Ten stamps complete a card (the passport is NOT stamped), and the next
-- find in that city starts the next number. A business is stamped once per card. Only the worker
-- reads and writes these tables (service role).
create table if not exists api.city_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  board_key text not null,          -- the city board's key (pcCityKey): 'los angeles, california|united states'
  city text not null,
  region text,                      -- the state, for US cities
  country text not null,
  year int not null,                -- the card's year: a new design each year
  no int not null default 1,        -- the card's number within the city and year
  stamps int not null default 0,    -- how many of the ten slots are stamped
  completed_at timestamptz,
  visibility text check (visibility is null or visibility in ('me', 'inner', 'followers', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, board_key, year, no)
);
create index if not exists city_cards_user_idx on api.city_cards (user_id, updated_at desc);
alter table api.city_cards enable row level security;
revoke all privileges on api.city_cards from anon, authenticated;
grant select, insert, update, delete on api.city_cards to service_role;

create table if not exists api.city_card_stamps (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references api.city_cards (id) on delete cascade,
  user_id uuid not null,
  slot smallint not null check (slot between 1 and 10),
  place_id text not null,           -- places:<google id> or owned:<uuid>
  name text not null,
  category text not null check (category in ('restaurant', 'coffee', 'shopping', 'convenience', 'market')),
  design smallint not null default 1 check (design between 1 and 4),   -- which of the category's artworks
  visited_on date not null,
  created_at timestamptz not null default now(),
  unique (card_id, slot),
  unique (card_id, place_id)
);
create index if not exists city_card_stamps_card_idx on api.city_card_stamps (card_id, slot);
alter table api.city_card_stamps enable row level security;
revoke all privileges on api.city_card_stamps from anon, authenticated;
grant select, insert, update, delete on api.city_card_stamps to service_role;

notify pgrst, 'reload schema';
