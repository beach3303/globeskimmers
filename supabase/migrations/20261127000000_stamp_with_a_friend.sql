-- Stamp with a friend (the first-thousand plan, 2026-11-26). A member shares an invite link
-- (kind 'invite' on message_links, the same /m/<code> page a texted postcard uses, so the app
-- knows who opened it). Whoever signs up through it and makes a FIRST stamp earns the
-- "Stamp with a friend" collectible (design 7, source 'friend'), and so does the inviter.
-- One per member, ever: collectibles' unique (user_id, source) does that for source 'friend'.
-- Only the worker reads and writes referrals (service role). People, never names, in reports.

alter table api.message_links drop constraint if exists message_links_kind_check;
alter table api.message_links add constraint message_links_kind_check check (kind in ('postcard', 'telegram', 'invite'));

create table if not exists api.referrals (
  referred_id uuid primary key,              -- the friend who came in (one referrer, ever)
  referrer_id uuid not null,                 -- who invited them
  via         text not null default 'invite',
  code        text,                          -- the link's code
  created_at  timestamptz not null default now(),
  awarded_at  timestamptz                    -- when the friend's first stamp paid both
);
create index if not exists referrals_referrer_idx on api.referrals (referrer_id);
alter table api.referrals enable row level security;
revoke all privileges on api.referrals from anon, authenticated;
grant select, insert, update, delete on api.referrals to service_role;

notify pgrst, 'reload schema';
