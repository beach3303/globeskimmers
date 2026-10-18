-- The one-time privacy check-up (founder, 2026-10-18): members whose stamps became 🌍 Everyone in
-- the 2026-10-15 backfill (a public passport → every stamp public) are asked once, kindly, whether
-- to keep it public or switch to the inner circle. This records when they answered; NULL = not yet.
alter table api.social_profiles add column if not exists privacy_checkup_at timestamptz;
notify pgrst, 'reload schema';
