-- Profile v2 (founder, 2026-09-30): About me + website; favorites become
-- free-form and unlimited (the old ≤3-from-stamps rule retires); dreams
-- rename to "On the Horizon" app-side. Website is a plain https link.
alter table api.social_profiles add column if not exists website text;
notify pgrst, 'reload schema';
