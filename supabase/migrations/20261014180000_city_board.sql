-- City Board (founder, 2026-10-03: "i love the city board"; built 2026-10-14): a postcard
-- can be addressed to a city and lands on that city's public board, from travelers who
-- were really there (the worker requires a verified stamp of theirs in that city).
-- to_city is the board's key, 'lisbon|portugal'. A board card has no to_user_id and never
-- reaches followers' feeds. Worker-only, like every postcard.
alter table api.postcards add column if not exists to_city text;
create index if not exists postcards_city_idx on api.postcards (to_city, created_at desc) where to_city is not null;
do $$ begin
  alter table api.postcards add constraint postcards_one_address check (to_city is null or to_user_id is null);
exception when duplicate_object then null;
end $$;
notify pgrst, 'reload schema';
