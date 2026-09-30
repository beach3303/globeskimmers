-- Social P1 (founder "build all"): profile v1, age gate, visibility groundwork,
-- moderation state on shared photos, and reports. Worker-only throughout.

-- Profile v1 — worker-managed so bio/name pass one moderated door (public
-- client-writable profiles stays for prefs; SOCIAL identity lives here).
create table if not exists api.social_profiles (
  user_id       uuid primary key,
  display_name  text,
  bio           text,
  favorites     jsonb,        -- ≤3 places picked from own stamps [{name,country}]
  dreams        jsonb,        -- ≤3 dream destinations [{name,country}]
  birth_year    int,          -- locked after first write (age-up needs support)
  birth_year_at timestamptz,  -- when it was first set
  social_tier   text,         -- 'blocked' (<13) | 'teen' (13–17) | 'adult'
  country_at_gate text,       -- CF country when the gate ran (AU under-16 rule)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table api.social_profiles enable row level security;
grant select, insert, update, delete on api.social_profiles to service_role;

-- Visibility: private | friends | public. Backfills from the old boolean; the
-- boolean stays in sync (old app versions keep working) until P2 retires it.
alter table api.passport_shares add column if not exists visibility text;
update api.passport_shares set visibility = case when is_public then 'public' else 'private' end where visibility is null;
alter table api.passport_shares alter column visibility set default 'private';

-- Moderation state for photos that leave the private journal. Journal reads
-- (the owner) never consult it; every OTHER viewer sees only status 'ok'.
alter table api.passport_stamp_photos add column if not exists mod_status text; -- null=unchecked | ok | blocked
alter table api.passport_stamps add column if not exists hidden boolean not null default false;

-- Reports (Apple 1.2): report → 24h triage for minor-safety, admin queue.
create table if not exists api.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null,
  subject_slug text,           -- the shared passport slug being reported
  kind         text not null,  -- 'passport' | 'photo' | 'tag' | 'handle'
  ref          text,           -- photo id / tag token / handle
  reason       text not null,  -- 'minor_safety' | 'nudity' | 'harassment' | 'spam' | 'other'
  note         text,
  status       text not null default 'open',  -- open | resolved | dismissed
  created_at   timestamptz default now(),
  resolved_at  timestamptz
);
create index if not exists content_reports_open_idx on api.content_reports (status, created_at desc);
alter table api.content_reports enable row level security;
grant select, insert, update, delete on api.content_reports to service_role;

notify pgrst, 'reload schema';
