-- Merge @maiza_ into @maiza (founder, 2026-11-13).
-- The founder's two admin logins — maizasimeon@gmail.com (@maiza, member #5) and
-- founder@globeskimmers.io (@maiza_, member #66, created on the Android phone 2026-10-30) — have
-- been one member since 2026-11-02: the worker aliases a founder@ session to the @maiza member
-- (gbAliasFor), and migration 20261103040000 moved her board uploads. The second account still
-- had its own handle row, so Find People and Admin → Members showed two people. This finishes the
-- merge in the database:
--   1. the @maiza_ passport_shares row is retired (user_id is its primary key, so it cannot move);
--   2. every other row in api.* / public.* that names the second id — as owner, sender, addressee,
--      follower, reporter… — now names the main id; where that would duplicate a row the main
--      account already has (a per-user table, the same follow, the same keep) the second copy goes;
--   3. a follow or block the two accounts had of each other would now point at itself, so it goes;
--   4. @maiza_ is held for the founder's gmail, unclaimed, so nobody else can take the name
--      (a held name blocks everyone but its email only while it is unclaimed).
-- Not touched: auth.users (the founder@ login stays — it is her admin login on the Android phone,
-- and the alias makes it act as @maiza) and public.profiles (one row per login, by design).
-- Guarded: nothing happens unless both handles exist and differ.
-- gs:allow-destructive (reason: retiring the founder's own second handle row, and the second account's duplicates of rows the main account already has — her two logins are one member)
do $$
declare
  main_id uuid; alt_id uuid;
  col record; r record;
  moved int := 0; dropped int := 0;
begin
  if to_regclass('api.passport_shares') is null then return; end if;
  select user_id into main_id from api.passport_shares where handle = 'maiza'  limit 1;
  select user_id into alt_id  from api.passport_shares where handle = 'maiza_' limit 1;
  if main_id is null or alt_id is null or main_id = alt_id then
    raise notice 'founder merge: nothing to do (main %, alt %)', main_id, alt_id;
    return;
  end if;

  -- 1. The second handle row goes.
  delete from api.passport_shares where user_id = alt_id;

  -- 2. Every uuid column (and, in api.*, every text column named like an id) that holds the second
  --    id. Base tables under a million rows only: a per-member table is never bigger than that.
  for col in
    select c.table_schema, c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    join pg_namespace pn on pn.nspname = c.table_schema
    join pg_class pc on pc.relnamespace = pn.oid and pc.relname = c.table_name and pc.relkind = 'r'
    where c.table_schema in ('api', 'public')
      and pc.reltuples < 1000000
      and (c.data_type = 'uuid'
           or (c.table_schema = 'api' and c.data_type = 'text' and c.column_name ~ '(_id|_by)$'))
      and not (c.table_schema = 'public' and c.table_name = 'profiles')
      and not (c.table_schema = 'api' and c.table_name = 'passport_shares')
    order by 1, 2, 3
  loop
    for r in execute format('select ctid as tid from %I.%I where %I = $1::%s',
                            col.table_schema, col.table_name, col.column_name, col.data_type) using alt_id
    loop
      begin
        execute format('update %I.%I set %I = $1::%s where ctid = $2',
                       col.table_schema, col.table_name, col.column_name, col.data_type) using main_id, r.tid;
        moved := moved + 1;
      exception
        when unique_violation or check_violation then
          -- the main account already has this row (or the row would now point at itself)
          execute format('delete from %I.%I where ctid = $1', col.table_schema, col.table_name) using r.tid;
          dropped := dropped + 1;
        when others then
          raise warning 'founder merge: % left in %.%.% (%)', r.tid, col.table_schema, col.table_name, col.column_name, sqlerrm;
      end;
    end loop;
  end loop;

  -- 3. A follow or block between her two accounts now points at itself.
  if to_regclass('api.user_follows') is not null then
    delete from api.user_follows where follower_id = main_id and followee_id = main_id;
  end if;
  if to_regclass('api.user_blocks') is not null then
    delete from api.user_blocks where user_id = main_id and blocked_user_id = main_id;
  end if;

  -- 4. Nobody else gets the retired name.
  if to_regclass('api.held_handles') is not null then
    insert into api.held_handles (handle, display_name, email)
    values ('maiza_', 'Maiza', 'maizasimeon@gmail.com')
    on conflict (handle) do nothing;
  end if;

  raise notice 'founder merge: % rows moved to the main account, % duplicates removed', moved, dropped;
end $$;
