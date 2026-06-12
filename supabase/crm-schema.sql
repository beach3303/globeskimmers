-- =====================================================================
-- GlobeSkimmers — Supabase CRM schema (Auth, Onboarding, CRM build spec)
-- =====================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Idempotent: safe to re-run (create ... if not exists / create or replace /
-- drop policy if exists then create / drop trigger if exists then create).
--
-- What this creates:
--   1. public.profiles      — onboarding answers + the onboarding_completed flag
--   2. handle_new_user()    — auto-creates a profile row on every signup
--   3. public.login_events  — append-only audit log (one row per login)
--   4. Row Level Security   — every user can only touch their OWN rows
--   5. one-time backfill     — profile rows for any users created earlier
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. public.profiles
--    id is the SAME uuid as auth.users.id (1:1). Onboarding writes the rest.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  onboarding_completed boolean      not null default false,
  first_name           text,
  home_country         text,
  preferred_currency   text,
  preferred_language   text,
  temp_unit            text check (temp_unit in ('C','F')),
  distance_unit        text check (distance_unit in ('mi','km')),
  travel_frequency     text,
  travel_purpose       text[],
  traveler_type        text,
  frequent_countries   text[],
  next_destination     text,
  travel_budget        text,
  accommodation_style  text[],
  dietary_prefs        text[],
  accessibility_needs  text[],
  referral_source      text,                       -- parity with ReferralSourceStep
  created_at           timestamptz  not null default now()
);

-- ---------------------------------------------------------------------
-- 2. handle_new_user(): auto-create a profile row on signup.
--    SECURITY DEFINER + `set search_path = ''` is the Supabase-recommended
--    hardening. Because search_path is empty, EVERY relation is fully
--    schema-qualified (public.profiles). first_name is best-effort from the
--    provider metadata; onboarding's first-name step is the fallback.
-- ---------------------------------------------------------------------
-- Let the auth-admin role (which runs the signup transaction) reach profiles.
-- Without this, the trigger can fail with "Database error saving new user".
grant usage on schema public to supabase_auth_admin;
grant insert, select on table public.profiles to supabase_auth_admin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'first_name', ''),
      nullif(new.raw_user_meta_data ->> 'given_name', ''),
      split_part(nullif(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never block signup if profile creation hiccups; log + continue.
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. public.login_events (append-only audit log; one row per login)
-- ---------------------------------------------------------------------
create table if not exists public.login_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete cascade,
  provider   text,                                 -- 'google'|'facebook'|'apple'|'email'
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Row Level Security
--    (select auth.uid()) is the officially-recommended per-statement-cached
--    form; semantically identical to bare auth.uid() for these row checks.
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.login_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ( (select auth.uid()) = id );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check ( (select auth.uid()) = id );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- login_events is append-only: insert + select for the owner, NO update/delete.
drop policy if exists "login_events_insert_own" on public.login_events;
create policy "login_events_insert_own"
  on public.login_events for insert to authenticated
  with check ( (select auth.uid()) = user_id );

drop policy if exists "login_events_select_own" on public.login_events;
create policy "login_events_select_own"
  on public.login_events for select to authenticated
  using ( (select auth.uid()) = user_id );

-- ---------------------------------------------------------------------
-- 5. One-time backfill: profile rows for users created before the trigger
--    existed (no-op on a fresh project, harmless to re-run).
-- ---------------------------------------------------------------------
insert into public.profiles (id)
select id from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;
