-- Social P2: the follow graph. Asymmetric (Instagram model); mutual accepted
-- follows = "friends" (the friends visibility tier). Worker-only, RLS on.
create table if not exists api.user_follows (
  follower_id uuid not null,
  followee_id uuid not null,
  status      text not null default 'accepted',  -- accepted | pending (teen targets)
  created_at  timestamptz default now(),
  responded_at timestamptz,
  primary key (follower_id, followee_id)
);
create index if not exists user_follows_followee_idx on api.user_follows (followee_id, status);
create index if not exists user_follows_follower_idx on api.user_follows (follower_id, status);
alter table api.user_follows enable row level security;
grant select, insert, update, delete on api.user_follows to service_role;

notify pgrst, 'reload schema';
