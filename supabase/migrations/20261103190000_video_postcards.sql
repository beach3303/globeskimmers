-- Video postcards (planned 2026-10-30, built 2026-11-03): a private postcard whose front is a
-- 20-second clip. photo_key holds the POSTER frame (so every photo path keeps working), video_key
-- the clip itself — one object under vid/<sender>/pc-<uuid>.mp4 shared by every row of the send
-- (the account purge's clip sweep catches it), duration its seconds, filter the look its sender
-- picked (drawn by CSS, as on boards), and video_ready marks a card whose clip has landed; one
-- still waiting is never shown and is swept after an hour. No check constraint on kind: the
-- worker validates it, and a database list would need a migration for every new kind.
alter table api.postcards add column if not exists kind text not null default 'photo';
alter table api.postcards add column if not exists video_key text;
alter table api.postcards add column if not exists duration real;
alter table api.postcards add column if not exists video_ready boolean not null default true;
alter table api.postcards add column if not exists filter text;
create index if not exists postcards_video_key_idx on api.postcards (video_key) where video_key is not null;
notify pgrst, 'reload schema';
