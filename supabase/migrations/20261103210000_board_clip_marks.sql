-- Marks a clip can wear (founder, 2026-11-03: "the marks only we can put on a clip … build both"): a house
-- frame (airmail, postmark, passport page, print) and the verified stamp outro — the city's stamp slamming
-- onto the clip's last two seconds with the date it was shot. Stored by name in one JSON object
-- ({ frame, outro }) and drawn by the app at playback from the clip's own verified city and date; the
-- file stays as shot. One nullable column so later marks (distance from home, golden hour) need no
-- migration; the worker validates the names — no check constraint (the blotter_marks lesson).
alter table api.board_contributions add column if not exists marks jsonb;
notify pgrst, 'reload schema';
