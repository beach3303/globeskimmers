-- The phone's own age answer (teens plan Phase 0; Apple has required it for new Texas accounts
-- since 2026-06-04): Apple's Declared Age Range or Google's Play Age Signals. The worker keeps
-- only the tier the answer implies and where it came from, never the range: os_tier caps the
-- birthday's tier (the younger wins), and an under-13 answer freezes the account.
alter table api.social_profiles add column if not exists os_tier text;
alter table api.social_profiles add column if not exists os_source text;
alter table api.social_profiles add column if not exists os_checked_at timestamptz;
-- A parent withdrew consent (App Store Server Notification RESCIND_CONSENT): social stops.
alter table api.social_profiles add column if not exists consent_revoked_at timestamptz;
do $$ begin
  alter table api.social_profiles add constraint social_profiles_os_tier_known check (os_tier is null or os_tier in ('blocked', 'teen', 'adult'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table api.social_profiles add constraint social_profiles_os_source_known check (os_source is null or os_source in ('apple', 'google'));
exception when duplicate_object then null;
end $$;

-- Which App Store downloads (AppTransaction.appTransactionID) belong to which account, so a
-- RESCIND_CONSENT notification finds its traveler. One account can be used on more than one
-- Apple Account. Worker-only.
create table if not exists api.app_store_links (
  user_id uuid not null,
  app_transaction_id text not null,
  environment text,
  seen_at timestamptz not null default now(),
  primary key (user_id, app_transaction_id)
);
create index if not exists app_store_links_txn_idx on api.app_store_links (app_transaction_id);
alter table api.app_store_links enable row level security;
revoke all privileges on api.app_store_links from anon, authenticated;
grant select, insert, update, delete on api.app_store_links to service_role;
notify pgrst, 'reload schema';
