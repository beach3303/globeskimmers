-- Where you live, for visitors (founder, 2026-10-14: "A plus a switch to turn on city"): a
-- visit shows your home country to everyone who can open your page, and your home city only
-- once you turn this on in Settings → Privacy. Off by default. The owner writes it through
-- profiles_update_own like their other prefs; the worker reads it for visits.
alter table public.profiles add column if not exists show_home_city boolean not null default false;
notify pgrst, 'reload schema';
