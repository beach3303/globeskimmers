-- The founder's two logins are one person (2026-11-02). The worker now aliases the founder@ session
-- to the member who holds @maiza; the board photos and clips she uploaded while signed in as the
-- other account (handle @maiza_) move to the main account so they show on her own album. Guarded:
-- nothing happens unless both handles exist and differ.
do $$
declare main_id uuid; alt_id uuid;
begin
  if to_regclass('api.passport_shares') is null or to_regclass('api.board_contributions') is null then return; end if;
  select user_id into main_id from api.passport_shares where handle = 'maiza' limit 1;
  select user_id into alt_id from api.passport_shares where handle = 'maiza_' limit 1;
  if main_id is null or alt_id is null or main_id = alt_id then return; end if;
  update api.board_contributions set user_id = main_id where user_id = alt_id;
end $$;
-- re-run 2026-11-03: the first apply failed in CI before any SQL ran (CLI targeted a local stack).
-- re-run 2026-11-03 (2): the CLI also wants --yes in CI.
