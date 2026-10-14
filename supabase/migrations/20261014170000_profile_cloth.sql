-- The cloth your world is bound in (the new look, approved 2026-10-13; backend item B1):
-- the owner's own pick of eight, read with their profile (AuthContext's select('*')) and
-- written through profiles_update_own like the rest of their prefs. Personal, not social,
-- so a teen can choose one too. Null reads as Harbour, the default. Others see it on the
-- owner's face through the worker, which reads it with the service role.
alter table public.profiles add column if not exists cloth text;
do $$ begin
  alter table public.profiles add constraint profiles_cloth_known
    check (cloth is null or cloth in ('harbour', 'forest', 'saddle', 'plum', 'slate', 'ochre', 'lapis', 'graphite'));
exception when duplicate_object then null;
end $$;
notify pgrst, 'reload schema';
