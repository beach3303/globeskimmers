-- "This is my favorite dish here" (founder, 2026-10-05): a checkbox when a
-- traveler adds a photo of what they ordered. One favorite per traveler per
-- place — choosing a new one clears the old. Shown as "⭐ favorite of N".
alter table api.place_dishes add column if not exists favorite boolean not null default false;
