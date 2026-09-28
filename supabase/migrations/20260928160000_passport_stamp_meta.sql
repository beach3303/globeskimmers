-- Passport — per-stamp extras. First use (founder, 2026-09-28): movie scene
-- stamps remember their film at the moment they're earned —
-- meta.film = { title, year, type, cast: [{actor, role}], scene } — so the
-- stamp, the photo page and the shared image render without a lookup. Later:
-- meta.stamp_pos ('top' | 'bottom') for where the stamp sits on a photo page.
-- Nullable, no default: every existing stamp is unchanged.
alter table api.passport_stamps
  add column if not exists meta jsonb;

notify pgrst, 'reload schema';
