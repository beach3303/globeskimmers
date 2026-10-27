-- Clear privacy words everywhere (founder, 2026-10-26: "Same as stamp" is confusing — say Only me, Friends, Friends &
-- followers or Everyone, in settings and in albums, everywhere). Photos now take any of the four levels, never more
-- than their stamp or the passport shows; and the albums setting gains Friends & followers.
-- Replaces two check constraints only; no data is touched.
-- gs:allow-destructive (reason: re-creates the photos_tier and albums_audience check constraints with the new levels)
alter table api.passport_stamps drop constraint if exists passport_stamps_photos_tier_known;
alter table api.passport_stamps add constraint passport_stamps_photos_tier_known
  check (photos_tier is null or photos_tier in ('me', 'inner', 'followers', 'public'));
alter table api.social_profiles drop constraint if exists social_profiles_albums_audience_known;
alter table api.social_profiles add constraint social_profiles_albums_audience_known
  check (albums_audience is null or albums_audience in ('passport', 'followers', 'inner', 'me'));
notify pgrst, 'reload schema';
