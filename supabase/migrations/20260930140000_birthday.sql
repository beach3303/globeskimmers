-- The birthday stamp (delight-first data, founder queue #7): month-day only,
-- editable anytime — the YEAR lives separately and is locked by the age gate.
alter table api.social_profiles add column if not exists birth_md text; -- 'MM-DD'
notify pgrst, 'reload schema';
