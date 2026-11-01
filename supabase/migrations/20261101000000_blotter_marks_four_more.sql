-- AWESOME!, STUNNING!, VIBES! and LOVE THIS! joined every sticker tray on 2026-10-30 (app +
-- worker, main 697bac0), but the database's check on blotter_marks.kind still listed the seven
-- older kinds, so every press of a new sticker failed with an error (founder, 2026-11-01) — the
-- same slip as COOL! on 2026-10-16 (20261017010000_blotter_marks_cool.sql). Replace whatever
-- check guards `kind` with the full list. Guarded: a database without the table is left alone.
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
    check (kind in ('wow', 'cool', 'takeme', 'been', 'wannago', 'morepics', 'yummy',
                    'awesome', 'stunning', 'vibes', 'lovethis'));
end $$;
