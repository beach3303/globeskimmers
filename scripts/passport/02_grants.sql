-- Passport — MISSING TABLE GRANTS (fixes 42501 "permission denied for table
-- passport_stamps" on every stamp attempt). Run once in the Supabase SQL editor.
--
-- WHY THIS IS NEEDED
-- 01_schema.sql creates the passport tables in the `api` schema, enables RLS on
-- them, and comments "service-role bypasses RLS". That is true but incomplete:
-- service_role bypasses ROW-LEVEL SECURITY, it does NOT bypass table-level
-- GRANTs. Supabase auto-grants table privileges in the `public` schema only —
-- in a custom schema like `api` they must be granted explicitly. The guestbook
-- schema does this (scripts/guestbook/01_schema.sql:68-70) and works; the
-- passport schema granted only a function, so every PostgREST write from the
-- Worker returned 42501.
--
-- No client role is granted anything: the passport is private, and every read
-- and write goes through the Worker with the service key, scoped to the user_id
-- resolved from the caller's Supabase JWT.

grant all privileges on api.passport_stamps       to service_role;
grant all privileges on api.passport_stamp_photos to service_role;
grant all privileges on api.passport_tags         to service_role;
grant all privileges on api.passport_shares       to service_role;

-- PostgREST caches the schema + privileges; without this the grants above are
-- not visible to the running API until it restarts on its own.
notify pgrst, 'reload schema';
