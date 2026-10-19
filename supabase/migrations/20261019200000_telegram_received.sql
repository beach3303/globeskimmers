-- A telegram's RECEIVED time (founder, 2026-10-19: "a date and time the telegram was sent and … the
-- telegram was received"): created_at is when it was sent; received_at is stamped by the worker
-- the first time the telegram reaches the recipient's Mailbox.
alter table api.telegrams add column if not exists received_at timestamptz;
notify pgrst, 'reload schema';
