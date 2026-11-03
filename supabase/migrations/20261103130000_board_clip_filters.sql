-- Clip looks (founder, 2026-11-03: "allow user to place filter on their clip/videos"). The look a member
-- picked for a clip — warm, cool, vivid, faded, mono, noir, vintage — is stored by name and drawn by the
-- app with CSS wherever the clip or its poster shows; the file itself stays as shot. No check constraint
-- on the names: the worker validates them against its own list, and a database list would need a
-- migration for every new look (the blotter_marks kind list broke new stickers twice, 10-16 and 11-01).
alter table api.board_contributions add column if not exists filter text;
notify pgrst, 'reload schema';
