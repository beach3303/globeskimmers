-- Avatar (Social P1 remainder): one R2 key per profile, moderated at upload.
alter table api.social_profiles add column if not exists avatar_key text;
notify pgrst, 'reload schema';
