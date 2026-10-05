-- Convenience stores take traveler photos too (founder, 2026-10-05): "a photo of
-- what you got here". Widens the kind check to 'store'. Replaces a check
-- constraint only; no data is touched.
-- gs:allow-destructive (reason: re-creates the kind check constraint to add 'store')
alter table api.place_dishes drop constraint if exists place_dishes_kind_check;
alter table api.place_dishes add constraint place_dishes_kind_check check (kind in ('restaurant', 'coffee', 'store'));
