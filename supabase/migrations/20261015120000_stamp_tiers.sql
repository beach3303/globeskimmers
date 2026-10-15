-- The stamp tiers (founder, 2026-10-15: "Build it"): every stamp carries its own audience —
-- me ⊂ inner ⊂ followers ⊂ public — and the booklet serves each viewer their slice.
alter table api.passport_stamps add column if not exists visibility text;
alter table api.passport_stamps add column if not exists pos numeric;
do $$ begin
  alter table api.passport_stamps add constraint passport_stamps_visibility_known check (visibility is null or visibility in ('me', 'inner', 'followers', 'public'));
exception when duplicate_object then null;
end $$;
-- Backfill = today's reality, nothing more or less visible: a hidden stamp was Only me; the
-- rest showed to whoever could open the booklet (public link, or the inner circle).
update api.passport_stamps ps set visibility = case
  when ps.hidden then 'me'
  when exists (select 1 from api.passport_shares s where s.user_id = ps.user_id and s.is_public) then 'public'
  else 'inner' end
where ps.visibility is null;

-- The owner's booklet preferences (defaults live as NULL: new stamps 'inner', circle private,
-- order 'newest').
alter table api.social_profiles add column if not exists default_stamp_tier text;
alter table api.social_profiles add column if not exists circle_public boolean;
alter table api.social_profiles add column if not exists booklet_order text;
alter table api.social_profiles add column if not exists shuffle_seed integer;
alter table api.social_profiles add column if not exists custom_order jsonb;
do $$ begin
  alter table api.social_profiles add constraint social_profiles_default_stamp_tier_known check (default_stamp_tier is null or default_stamp_tier in ('me', 'inner', 'followers', 'public'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table api.social_profiles add constraint social_profiles_booklet_order_known check (booklet_order is null or booklet_order in ('newest', 'chrono', 'shuffle', 'custom'));
exception when duplicate_object then null;
end $$;

-- Ask-first share links (founder, 2026-10-15): each link is its own key — what it may show
-- and when it stops working — and can be turned off. Worker-only.
create table if not exists api.share_links (
  token text primary key,
  user_id uuid not null,
  level text not null check (level in ('public', 'inner')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_links_user_idx on api.share_links (user_id);
alter table api.share_links enable row level security;
revoke all privileges on api.share_links from anon, authenticated;
grant select, insert, update, delete on api.share_links to service_role;
notify pgrst, 'reload schema';
