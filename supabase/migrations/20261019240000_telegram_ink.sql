-- A telegram's ink (founder, 2026-10-19: "allow user to change color of telegram text from black,
-- red, green but text should be visible"). NULL = black; red and green are dark enough to read on
-- the tape and the buff blank (the app holds the exact shades).
alter table api.telegrams add column if not exists ink text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'telegrams_ink_check') then
    alter table api.telegrams add constraint telegrams_ink_check check (ink is null or ink in ('black', 'red', 'green'));
  end if;
end $$;
notify pgrst, 'reload schema';
