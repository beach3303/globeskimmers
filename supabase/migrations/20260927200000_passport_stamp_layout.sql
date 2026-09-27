-- Passport — per-stamp page layout. Founder ask 2026-09-26: a stamp can be moved
-- to "a solo page" and back to "share a page with other stamps". 'auto' = the
-- booklet packs it with others (today's behaviour); 'solo' = a page of its own.
-- Read by the Worker's ppLoad (select=*), written by POST /passport/stamp/layout.
-- Applied automatically by .github/workflows/deploy-migrations.yml on the push
-- (no approval step in that workflow), or locally by `npm run db:push`.
alter table api.passport_stamps
  add column if not exists layout text not null default 'auto';
-- No DROP here on purpose: deploy-migrations.yml refuses a plan that drops
-- anything, and the constraint is new.
alter table api.passport_stamps
  add constraint passport_stamps_layout_check check (layout in ('auto', 'solo'));

-- PostgREST caches the schema; without this the new column is rejected as
-- unknown until the API restarts on its own.
notify pgrst, 'reload schema';
