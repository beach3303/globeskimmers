-- user_saves — cloud copy of each user's Wishlist + Saved-places lists (one JSON
-- blob per kind). The Worker reads/writes this with the SERVICE key (bypasses
-- RLS); clients never touch it directly. Run ONCE in the Supabase SQL editor.
--
-- Enables: survive reinstall, cross-device sync, and a durable demand signal.

create table if not exists public.user_saves (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null check (kind in ('wishlist','places')),
  data       jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

-- Lock it down: only the service role (the Worker) may read/write. No anon/auth
-- policies are defined, so with RLS ON, direct client access is denied — all sync
-- is worker-mediated (consistent with guestbook/passport). Service key bypasses RLS.
alter table public.user_saves enable row level security;

-- Optional: let a signed-in user delete their OWN row (belt-and-suspenders for
-- account-deletion flows that run client-side). Safe because it's self-scoped.
drop policy if exists user_saves_self_delete on public.user_saves;
create policy user_saves_self_delete on public.user_saves
  for delete to authenticated using (auth.uid() = user_id);
