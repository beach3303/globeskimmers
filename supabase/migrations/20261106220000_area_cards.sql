-- Area cards (founder, 2026-11-06: "yes to all" — docs/plans/cards-and-passport.md): a card per metro area
-- ("Greater Phoenix") instead of per city per year, twenty stamps, numbered and never expiring; Stay and Do
-- join the categories; a stay hides its name by default; a private note on any stamp.
-- gs:allow-destructive  (reason: the per-city-per-year unique and the 10-slot / five-category checks are
-- replaced by the area card's; no rows are dropped)

alter table api.city_cards
  add column if not exists area_key text,     -- 'csa:348' · 'cbsa:38060' · 'metro:greater-london' · else the old city key
  add column if not exists area_name text;    -- 'Greater Los Angeles'
alter table api.city_cards alter column year drop not null;
alter table api.city_cards drop constraint if exists city_cards_user_id_board_key_year_no_key;
-- Old cards keep their city as their area until the remap folds them into their metro.
update api.city_cards set area_key = board_key, area_name = city where area_key is null;
create unique index if not exists city_cards_user_area_no on api.city_cards (user_id, area_key, no);
create index if not exists city_cards_user_area on api.city_cards (user_id, area_key);

alter table api.city_card_stamps drop constraint if exists city_card_stamps_slot_check;
alter table api.city_card_stamps add constraint city_card_stamps_slot_check check (slot between 1 and 20);
alter table api.city_card_stamps drop constraint if exists city_card_stamps_category_check;
alter table api.city_card_stamps add constraint city_card_stamps_category_check
  check (category in ('restaurant', 'coffee', 'shopping', 'convenience', 'market', 'stay', 'do'));
alter table api.city_card_stamps
  add column if not exists city text,                                   -- the stamp's own city, small on the card ("Mesa")
  add column if not exists name_hidden boolean not null default false,  -- a stay: "Accommodation · Scottsdale" to everyone but its owner
  add column if not exists note text;                                   -- private, owner-only in every read
