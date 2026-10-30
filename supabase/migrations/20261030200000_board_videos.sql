-- Video on City Boards (founder, 2026-10-30: 20-second clips, hosted on R2). A contribution may be a
-- clip: photo_key then holds the POSTER frame (so every photo path keeps working — the wall tile,
-- /board-photo/<id>, the share card), video_key holds the clip itself (R2 vid/<user id>/<uuid>.mp4)
-- and duration its seconds. The clip's bytes arrive in a second call after the poster and four frames
-- pass the same AI check photos get, so video_ready marks a row whose clip has landed; a row still
-- waiting is never shown and is swept after an hour.
alter table api.board_contributions add column if not exists kind text not null default 'photo' check (kind in ('photo', 'video'));
alter table api.board_contributions add column if not exists video_key text;
alter table api.board_contributions add column if not exists duration real;
alter table api.board_contributions add column if not exists video_ready boolean not null default true;
notify pgrst, 'reload schema';
