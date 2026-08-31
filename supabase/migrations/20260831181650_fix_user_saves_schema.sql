-- Cloud sync has never worked. scripts/saves/user_saves.sql created the table in
-- `public`, but the Worker reaches Supabase through gbRest (cloudflare-worker-v7.12.js),
-- which sends no Accept-Profile header and so resolves names in the exposed `api`
-- schema — where every sibling table already lives (guestbook_*, passport_*).
-- Writes went nowhere, and cloudSync.js swallows failures (`catch {}`), so it
-- degraded invisibly to localStorage.
--
-- Confirmed against the live database before writing this: public.user_saves held
-- 0 rows after months in production. Moving the table is therefore risk-free, and
-- it preserves the table's RLS setting and its policy. No Worker change needed.

alter table if exists public.user_saves set schema api;

-- The same trap that returned 42501 on passport_stamps: service_role bypasses
-- ROW-LEVEL SECURITY but NOT table-level GRANTs, and Supabase auto-grants only
-- in `public`.
grant all privileges on api.user_saves to service_role;

-- And the same trap one level down. scripts/saves/user_saves.sql defines a
-- `user_saves_self_delete` policy for `authenticated`, but a policy without a
-- GRANT can never fire — the role is refused on table privileges before RLS is
-- ever consulted. Grant exactly the one verb that policy allows; RLS still scopes
-- it to the caller's own row (auth.uid() = user_id).
grant delete on api.user_saves to authenticated;

notify pgrst, 'reload schema';
