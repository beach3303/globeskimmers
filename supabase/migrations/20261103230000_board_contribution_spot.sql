-- The same-spot strip (founder, 2026-11-03: "i love same spot strip"): under an upload, everything on
-- the boards shot within fifty metres of it, oldest to newest. Boards never kept where an upload was
-- shot — only its city — so from this day each new upload keeps its spot here (the EXIF location the
-- worker already reads to pick the board, to about a metre), and the strip grows from here. A spot
-- never leaves the worker: it only finds neighbours; the app gets items.
alter table api.board_contributions add column if not exists lat double precision;
alter table api.board_contributions add column if not exists lng double precision;
create index if not exists board_contributions_spot_idx on api.board_contributions (board_key, lat, lng) where lat is not null;
notify pgrst, 'reload schema';
