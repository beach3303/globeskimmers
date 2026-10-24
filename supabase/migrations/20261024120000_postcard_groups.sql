-- Postcards to several people (founder, 2026-10-24: "allow post card to be sent to group or
-- individually to multiple people"): the same card sent EACH their own (no columns needed) or as
-- a GROUP — one card naming everyone it reached, as a group telegram does. group_id ties a group's
-- copies together; cc lists the OTHER recipients of this copy (the worker shows them by @username,
-- minus anyone the reader blocked). A reply still goes to the sender only (founder, 2026-10-24).
alter table api.postcards add column if not exists group_id uuid;
alter table api.postcards add column if not exists cc uuid[];
notify pgrst, 'reload schema';
