-- Guestbook doodles (founder, 2026-10-02): finger drawings as entries —
-- stored through the moderated photo pipeline, flagged so the app renders
-- them as expandable doodle cards instead of photos.
alter table api.guestbook_entries add column if not exists is_doodle boolean not null default false;
notify pgrst, 'reload schema';
