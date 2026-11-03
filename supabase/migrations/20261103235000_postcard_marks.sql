-- Marks on video postcards (founder, 2026-11-03: "finish building everything"): the same { frame, outro,
-- flight, home_mi, light, local } a board clip wears, stored by name and drawn at playback; the file
-- stays as shot. One nullable JSON column, no check constraint (the worker validates the names).
alter table api.postcards add column if not exists marks jsonb;
notify pgrst, 'reload schema';
