-- Privacy made simple (founder, 2026-10-26): four words everywhere — Only me · Friends ·
-- Followers · Everyone ('me' | 'inner' | 'followers' | 'public') — and the passport is the
-- ceiling over every stamp and album.

-- The passport's own audience lives in passport_shares.visibility; is_public stays true exactly
-- when it is 'public'. Today's private passports ('friends' / 'private' / null) become Friends.
update api.passport_shares
   set visibility = case when is_public then 'public' else 'inner' end
 where is_public or visibility is null or visibility not in ('me', 'inner', 'followers');
alter table api.passport_shares alter column visibility set default 'inner';

-- An album (a place's photos) can be kept narrower than its stamps: null = the same as each
-- stamp, 'inner' = friends only, 'me' = only me. Never wider. Off the City Boards unless null.
alter table api.passport_stamps add column if not exists photos_tier text;
do $$ begin
  alter table api.passport_stamps add constraint passport_stamps_photos_tier_known check (photos_tier is null or photos_tier in ('me', 'inner'));
exception when duplicate_object then null;
end $$;
notify pgrst, 'reload schema';
