-- Read, then filed (founder, 2026-10-19: "after reading, then remove post card and telegrams from
-- mailbox and keep message in postcard box unless they're deleted"). read_at is stamped by the
-- worker the first time the recipient's Mailbox shows a postcard addressed to them; half an hour
-- later it lives only in the postcard box. (A telegram's read time is its received_at, set when
-- its seal is broken.)
alter table api.postcards add column if not exists read_at timestamptz;
notify pgrst, 'reload schema';
