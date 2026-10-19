-- Find people (founder, 2026-10-18): members can be found by @username, by name and by the
-- email they signed up with. Name and email are on by default for adults and can be turned
-- off in Settings → Privacy; NULL = on. Minors are never found (the worker checks the tier).
alter table api.social_profiles add column if not exists find_by_name boolean;
alter table api.social_profiles add column if not exists find_by_email boolean;
notify pgrst, 'reload schema';
