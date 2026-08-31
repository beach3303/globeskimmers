-- Follow-up to 20260831181650. Moving user_saves out of `public` carried its
-- grants with it: ALTER TABLE ... SET SCHEMA preserves privileges, and Supabase
-- auto-grants ALL to anon and authenticated on tables created in `public`. So the
-- table arrived in `api` with anon and authenticated holding all seven privileges.
--
-- Not exploitable as it stands — RLS is enabled and the only policy is a DELETE
-- scoped to auth.uid() = user_id, so selects, inserts and updates are refused. But
-- it is privilege the table should never have had, and it leaves RLS as the single
-- thing standing between anonymous callers and every user's saved places. Its
-- siblings are tighter: api.passport_stamps grants nothing to these roles, and
-- api.guestbook_entries grants only SELECT.
--
-- Revoke everything from the client roles, then re-grant exactly the one verb the
-- user_saves_self_delete policy needs. The Worker is unaffected: it authenticates
-- as service_role.

revoke all privileges on api.user_saves from anon;
revoke all privileges on api.user_saves from authenticated;

grant delete on api.user_saves to authenticated;

notify pgrst, 'reload schema';
