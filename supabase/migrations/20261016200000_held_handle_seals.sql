-- A held name can carry its Seal (founder, 2026-10-16: "list a handle @handle and then assign
-- seal ... after i assign as seal, send them an email particular to the seal"). The invitation
-- is written for that Seal, and claiming the name switches the Seal on. Additive only.
alter table api.held_handles add column if not exists seal text;
alter table api.held_handles add column if not exists seal_kind text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'held_handles_seal_check') then
    alter table api.held_handles add constraint held_handles_seal_check
      check (seal is null or seal in ('gold', 'burgundy', 'teal', 'sunshine-heart', 'sunshine-star'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'held_handles_seal_kind_check') then
    alter table api.held_handles add constraint held_handles_seal_kind_check
      check (seal_kind is null or seal_kind in ('business', 'person'));
  end if;
end $$;

notify pgrst, 'reload schema';
