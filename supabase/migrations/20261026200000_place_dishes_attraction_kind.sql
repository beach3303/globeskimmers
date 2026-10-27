-- Things to Do places take traveler photos too (founder, 2026-10-26): "Add a photo from
-- your visit" on the attraction cards, shown in the place's photos with everyone else's.
-- Widens the kind check to 'attraction'. Replaces a check constraint only; no data is touched.
-- gs:allow-destructive (reason: re-creates the kind check constraint to add 'attraction')
alter table api.place_dishes drop constraint if exists place_dishes_kind_check;
alter table api.place_dishes add constraint place_dishes_kind_check check (kind in ('restaurant', 'coffee', 'store', 'attraction'));
