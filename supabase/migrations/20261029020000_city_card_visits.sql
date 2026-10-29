-- City Cards, repeat visits (founder, 2026-10-28: "when stamped we should have a plan for stamping
-- twice or 10 or 20 times"): a business holds ONE slot on a card; coming back on another day adds a
-- visit to that stamp — the count and the latest date grow, the slot stays. Null last_visited_on
-- means the first visit is the latest.
alter table api.city_card_stamps add column if not exists visits int not null default 1;
alter table api.city_card_stamps add column if not exists last_visited_on date;
notify pgrst, 'reload schema';
