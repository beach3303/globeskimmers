-- Sealed mail (founder, 2026-11-03: "I Love Sealed Clips… also sealed postcard… birthday greetings…
-- sealed telegram for future would be good too"). A postcard or telegram may be sealed until a date
-- the sender picks, up to a year ahead: the envelope shows at once with the sender's name and the
-- date, the words and the photo stay closed until midnight of that date in the recipient's home
-- timezone (opens_at), and the hourly cron sends the knock once it has opened (opened_at). opens_on
-- is the calendar date the sender chose, kept so every screen can name the day without a timezone.
-- The sender may take a sealed one back until it opens and can't open it early (decided 2026-11-03).
alter table api.postcards add column if not exists opens_at timestamptz;
alter table api.postcards add column if not exists opens_on date;
alter table api.postcards add column if not exists opened_at timestamptz;
alter table api.telegrams add column if not exists opens_at timestamptz;
alter table api.telegrams add column if not exists opens_on date;
alter table api.telegrams add column if not exists opened_at timestamptz;
create index if not exists postcards_sealed_idx on api.postcards (opens_at) where opens_at is not null and opened_at is null;
create index if not exists telegrams_sealed_idx on api.telegrams (opens_at) where opens_at is not null and opened_at is null;
notify pgrst, 'reload schema';
