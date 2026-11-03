-- A clip earns a stamp, and lives in its album (founder, 2026-11-03: "i like a clip to earn a stamp"; the
-- 10-30 plan's "memories" step). A memory may be a clip: photo_key/photo_url hold the POSTER frame (so
-- every album, board and lightbox path keeps working), video_key the clip itself (vid/<user>/pp-<uuid>.mp4,
-- inside the account purge's clip sweep), duration its seconds, filter its look, marks its frame, stamp,
-- flight, miles-from-home and light (drawn at playback), and video_ready marks a clip that has landed;
-- one still waiting is never listed. No check constraint on kind (the worker validates).
alter table api.passport_stamp_photos add column if not exists kind text not null default 'photo';
alter table api.passport_stamp_photos add column if not exists video_key text;
alter table api.passport_stamp_photos add column if not exists duration real;
alter table api.passport_stamp_photos add column if not exists filter text;
alter table api.passport_stamp_photos add column if not exists marks jsonb;
alter table api.passport_stamp_photos add column if not exists video_ready boolean not null default true;
notify pgrst, 'reload schema';
