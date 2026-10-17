-- COOL! joined the sticker tray on 2026-10-14 (app + worker), but the database's
-- check on blotter_marks.kind still listed the original six, so every COOL! press
-- failed with "Could not press" (founder, 2026-10-16). Replace whatever check
-- guards `kind` with the full list. Guarded: a database without the table is left alone.
do $$
declare c text;
begin
  if to_regclass('api.blotter_marks') is null then return; end if;
  for c in
    select conname from pg_constraint
    where conrelid = 'api.blotter_marks'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table api.blotter_marks drop constraint %I', c);
  end loop;
  alter table api.blotter_marks add constraint blotter_marks_kind_check
    check (kind in ('wow', 'cool', 'takeme', 'been', 'wannago', 'morepics', 'yummy'));
end $$;
