-- Social P0 (founder "build all", 2026-09-29): presence on tags, tag
-- revocation, usernames, blocks. All worker-only — RLS on, zero client
-- policies, service_role reaches them like every passport table.

-- The two-question claim: "Were you there together?" is presence (feeds the
-- future combined albums and "with @x" chips); the stamp yes/no stays in
-- status. Revoking a confirmed presence later kills the edge, not the stamp.
alter table api.passport_tags add column if not exists presence boolean;
alter table api.passport_tags add column if not exists revoked_at timestamptz;

-- Usernames live on passport_shares (worker-managed, moderated at write):
-- ^[a-z0-9_]{3,20}$, unique case-insensitively, 2 changes per 30 days.
alter table api.passport_shares add column if not exists handle text;
alter table api.passport_shares add column if not exists handle_changed_at timestamptz;
alter table api.passport_shares add column if not exists handle_changes int not null default 0;
create unique index if not exists passport_shares_handle_idx
  on api.passport_shares (lower(handle)) where handle is not null;

-- Blocks: one row per direction. Enforced in the worker at tag create, claim,
-- and (P2) follow/feed. Silent by design — the other side sees "expired".
create table if not exists api.user_blocks (
  user_id         uuid not null,
  blocked_user_id uuid not null,
  created_at      timestamptz default now(),
  primary key (user_id, blocked_user_id)
);
alter table api.user_blocks enable row level security;
grant select, insert, update, delete on api.user_blocks to service_role;

notify pgrst, 'reload schema';
