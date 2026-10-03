-- Held handles (founder's family reservations) + the verified mark.
-- Founder doctrine 2026-10-02/03:
--   * A held name reads as plain "taken" to everyone except the email it is
--     held for; the founder manages the list, emails, and invitations from
--     the Admin portal. Claiming is a small ceremony in the app.
--   * verified is OFF for everyone. It is reserved for monetization /
--     official figures / official businesses — and the founder may gift it.
--     Only the admin endpoints ever write it.

create table if not exists api.held_handles (
  handle        text primary key,     -- ^[a-z0-9_]{3,20}$, stored lowercase
  display_name  text,                 -- "Hello {display_name}" in the invite
  email         text,                 -- claimant's sign-in email (lowercase; may be added later)
  invited_at    timestamptz,          -- last invitation sent
  claimed_at    timestamptz,
  claimed_by    uuid,
  created_at    timestamptz default now()
);
alter table api.held_handles enable row level security;
grant select, insert, update, delete on api.held_handles to service_role;

alter table api.passport_shares add column if not exists verified boolean not null default false;

-- Seed the founder's own held name (replaces the retired in-worker map).
insert into api.held_handles (handle, display_name, email)
values ('maiza', 'Maiza', 'maizasimeon@gmail.com')
on conflict (handle) do nothing;

notify pgrst, 'reload schema';
