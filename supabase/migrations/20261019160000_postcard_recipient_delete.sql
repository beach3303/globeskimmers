-- A postcard's recipient can delete it (founder, 2026-10-19: "allow post card recipient to delete a
-- post card or reply"). Soft for the recipient: the card leaves their Mailbox, postcard box and
-- activity; the row stays for the sender's own records and the safety desk.
alter table api.postcards add column if not exists recipient_deleted_at timestamptz;
notify pgrst, 'reload schema';
