-- Telegrams to several people (founder, 2026-10-19): the same words sent EACH their own (no
-- columns needed) or as a GROUP — one telegram naming everyone it reached. group_id ties a
-- group's copies together; cc lists the OTHER recipients of this copy (the worker shows them by
-- @username, minus anyone the reader blocked) so each can reply to the sender or to all.
alter table api.telegrams add column if not exists group_id uuid;
alter table api.telegrams add column if not exists cc uuid[];
notify pgrst, 'reload schema';
