-- Alert previews (founder, 2026-10-19): "previews turned off by default". NULL/false = an alert
-- says who and what, never someone's words; true = postcard words and comments show in the
-- alert. Telegram words never ride in an alert, whatever this says.
alter table api.social_profiles add column if not exists alert_previews boolean;
notify pgrst, 'reload schema';
