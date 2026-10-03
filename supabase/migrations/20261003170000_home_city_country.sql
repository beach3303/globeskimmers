-- The country you LIVE in, kept apart from the home flag (founder, 2026-10-03:
-- the trunk starts with two flag stickers — your home country and the country
-- you live in). Picking a home city sets both today; the separate home-flag
-- picker in Settings later overwrites home_country only, so the city's own
-- country needs its own column. Backfill assumes they match until told
-- otherwise.
alter table public.profiles add column if not exists home_city_country text;
update public.profiles set home_city_country = home_country
  where home_city_country is null and home_city is not null and home_country is not null;
notify pgrst, 'reload schema';
