-- Kind guestbooks (founder, 2026-10-03): a note that reads as negative — a
-- complaint, criticism, "skip it" — is HELD for an admin to read before it
-- posts; kind tips, favorite parts, shout-outs and memories post right away.
--
-- review_status: 'ok' (public) | 'held' (waiting for an admin; only the author
-- sees it) | 'rejected' (an admin kept it private). `hidden` stays the report
-- auto-hide (3 distinct reporters), so the two states never mix.
alter table api.guestbook_entries add column if not exists review_status text not null default 'ok';
alter table api.guestbook_entries drop constraint if exists guestbook_entries_review_status_check;
alter table api.guestbook_entries add constraint guestbook_entries_review_status_check
  check (review_status in ('ok', 'held', 'rejected'));
alter table api.guestbook_entries add column if not exists review_reason text;
alter table api.guestbook_entries add column if not exists reviewed_at timestamptz;
alter table api.guestbook_entries add column if not exists reviewed_by text;

-- Doodle-only notes carry no text (the Worker inserts body = null).
alter table api.guestbook_entries alter column body drop not null;

create index if not exists gb_entries_review_idx on api.guestbook_entries (review_status, created_at)
  where review_status <> 'ok';
create index if not exists gb_entries_hidden_idx on api.guestbook_entries (created_at)
  where hidden;

-- Every read goes through the Worker (service role). Close the anon/auth side
-- door: it exposed every column and would have shown held notes.
drop policy if exists gb_public_read on api.guestbook_entries;
create policy gb_public_read on api.guestbook_entries
  for select using (hidden = false and deleted_at is null and review_status = 'ok');
revoke select on api.guestbook_entries from anon, authenticated;
revoke execute on function api.gb_report(uuid) from public, anon, authenticated;
grant execute on function api.gb_report(uuid) to service_role;

-- One report per traveler per note (the 3-report auto-hide now needs three
-- different signed-in people, not three taps).
create table if not exists api.guestbook_reports (
  entry_id uuid not null references api.guestbook_entries (id) on delete cascade,
  reporter_id uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (entry_id, reporter_id)
);
alter table api.guestbook_reports enable row level security;
grant select, insert, update, delete on api.guestbook_reports to service_role;

notify pgrst, 'reload schema';
