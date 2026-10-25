-- The Sent folder (founder, 2026-10-25: "users ask me where their sent messages went"): "Remove from
-- Sent" hides an entry for its sender only. The recipient's copy is untouched; the row stays for the
-- recipient and the safety desk, like recipient_deleted_at on the other side.
alter table api.postcards          add column if not exists sender_hidden_at timestamptz;
alter table api.telegrams          add column if not exists sender_hidden_at timestamptz;
alter table api.pending_postcards  add column if not exists sender_hidden_at timestamptz;
alter table api.pending_telegrams  add column if not exists sender_hidden_at timestamptz;
alter table api.message_links      add column if not exists sender_hidden_at timestamptz;
notify pgrst, 'reload schema';
