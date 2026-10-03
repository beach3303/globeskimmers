-- Trip notes (founder 2026-10-03): on an airport (or border) stamp, "what was
-- this trip for?" — PRIVATE by default (the trip is personal); the traveler
-- can later show it on their shared passport. The worker strips `note` from
-- every shared view unless note_public is true, and moderates it on going public.
alter table api.passport_stamps add column if not exists note text;
alter table api.passport_stamps add column if not exists note_public boolean not null default false;
notify pgrst, 'reload schema';
