-- "Add your order": the traveler tells us whether they loved it (founder,
-- 2026-10-03). true = loved it, false = it was OK, null = didn't say. Only the
-- loved count is ever shown ("Ordered by 3 travelers · 2 loved it").
alter table api.place_dishes add column if not exists liked boolean;
