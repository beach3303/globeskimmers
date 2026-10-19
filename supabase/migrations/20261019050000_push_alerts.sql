-- Alerts outside the app (push), build 1.0.6 (founder, 2026-10-19): the phones a member has
-- the app on, and which kinds of alert they want. A token Apple or Google reports gone is
-- deleted by the worker; an account's deletion takes its tokens with it (gbPurge tables).
create table if not exists api.push_tokens (
  token        text primary key,       -- APNs device token (hex) or an FCM registration token
  user_id      uuid not null,
  platform     text not null,          -- ios | android
  app_version  text,
  created_at   timestamptz not null default now(),
  seen_at      timestamptz not null default now()
);
create index if not exists push_tokens_user on api.push_tokens (user_id);
alter table api.push_tokens enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'api' and tablename = 'push_tokens' and policyname = 'push_tokens_service') then
    create policy push_tokens_service on api.push_tokens for all to service_role using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on api.push_tokens to service_role;

-- The switches (Settings → Alerts). NULL = the default: postcards, follows and the member's
-- own pages ON; the inner circle's daily stamps and news OFF until chosen.
alter table api.social_profiles add column if not exists alert_postcards boolean;
alter table api.social_profiles add column if not exists alert_follows boolean;
alter table api.social_profiles add column if not exists alert_pages boolean;
alter table api.social_profiles add column if not exists alert_friend_stamps boolean;
alter table api.social_profiles add column if not exists alert_news boolean;
notify pgrst, 'reload schema';
