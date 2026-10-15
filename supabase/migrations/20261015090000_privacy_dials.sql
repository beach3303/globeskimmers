-- The privacy dials (founder, 2026-10-15): new followers wait for a yes, photo albums get
-- their own audience apart from the passport, and the guestbook gets a comments dial.
-- NULL means the default everywhere: approval ON, albums 'inner', comments 'inner' —
-- privacy-first for every existing account without rewriting rows.
alter table api.social_profiles add column if not exists approve_followers boolean;
alter table api.social_profiles add column if not exists albums_audience text;
alter table api.social_profiles add column if not exists comments_audience text;
do $$ begin
  alter table api.social_profiles add constraint social_profiles_albums_audience_known check (albums_audience is null or albums_audience in ('passport', 'inner', 'me'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table api.social_profiles add constraint social_profiles_comments_audience_known check (comments_audience is null or comments_audience in ('inner', 'audience', 'off'));
exception when duplicate_object then null;
end $$;
notify pgrst, 'reload schema';
