-- Passport — stamps + stamp photos. Run once in the Supabase SQL editor.
-- Tables live in the `api` schema (the exposed Data API schema, same as the
-- guestbook + finders), so the Worker reaches them via PostgREST with the
-- service key. Passport is PERSONAL + PRIVATE: no public read policy — every
-- read/write goes through the Worker, scoped to the user_id resolved from their
-- Supabase JWT (never a client-supplied id). See docs/PASSPORT_MEANING_MODEL.md.

-- A stamp = a place the user has been. Tiered: 'page' (country/city/airport/
-- icon/wonder — the prestigious passport pages) vs 'mark' (individual attractions).
create table if not exists api.passport_stamps (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  kind         text not null,                  -- country | city | airport | icon | wonder | attraction
  tier         text not null default 'page',   -- page | mark
  entity_type  text,                           -- place | city | country | airport
  entity_id    text,                           -- owned place id / IATA code / city slug / ISO-2
  name         text not null,
  city         text,
  region       text,
  country      text,                           -- ISO-2 or country name
  lat          double precision,
  lng          double precision,
  visited_on   date,                           -- the REAL visit date (editable; user-set for photo-proof/self)
  verified     text not null default 'self',   -- gps | photo | self  (gps + photo earn the ✓)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists passport_stamps_user_idx on api.passport_stamps (user_id, created_at desc);
-- One stamp per (user, kind, entity_id) so re-visiting doesn't duplicate a page.
create unique index if not exists passport_stamps_uniq
  on api.passport_stamps (user_id, kind, entity_id) where entity_id is not null;

-- 2–4 of the user's own photos per stamp = the memory layer (bytes on R2).
-- A photo attached to a 'self' stamp is also the PROOF that upgrades it to ✓.
create table if not exists api.passport_stamp_photos (
  id          uuid primary key default gen_random_uuid(),
  stamp_id    uuid not null references api.passport_stamps(id) on delete cascade,
  user_id     uuid not null,
  photo_key   text not null,                   -- R2 object key: pp/<user>/<stamp>/<uuid>.jpg
  photo_url   text,                            -- Worker serve URL (/pp-photo/<key>)
  caption     text,
  created_at  timestamptz default now()
);
create index if not exists passport_photos_stamp_idx on api.passport_stamp_photos (stamp_id);
create index if not exists passport_photos_user_idx  on api.passport_stamp_photos (user_id);

-- Buddy tagging — "you were here with me". A tag is a PENDING stamp the recipient
-- must ACCEPT (consent required — never auto-stamp anyone). Keyed by EMAIL so we
-- can tag someone who isn't a user yet; they claim it when they join (Phase B =
-- invite email w/ app-download links). Provenance: an accepted stamp records who
-- tagged you (passport_stamps.tagged_by).
create table if not exists api.passport_tags (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null,
  from_name    text,                           -- tagger's display name (snapshot, for the prompt)
  to_user_id   uuid,                           -- resolved recipient (null until they're a user)
  to_email     text not null,                  -- lowercased tagged email (claim key for non-users)
  kind text, tier text, entity_type text, entity_id text,
  name text not null, city text, region text, country text,
  lat double precision, lng double precision, visited_on date,
  status       text not null default 'pending', -- pending | accepted | declined
  created_at   timestamptz default now(),
  responded_at timestamptz
);
create index if not exists passport_tags_to_user_idx  on api.passport_tags (to_user_id, status);
create index if not exists passport_tags_to_email_idx on api.passport_tags (lower(to_email), status);
create index if not exists passport_tags_from_idx     on api.passport_tags (from_user_id, created_at desc);
alter table api.passport_tags enable row level security; -- Worker-only

alter table api.passport_stamps add column if not exists tagged_by uuid;

-- Share-link tagging: the invite is a link carrying an unguessable token, shared
-- via the native share sheet (WhatsApp / iMessage / whatever the user picks) —
-- the app never sends email/SMS itself. Email is now OPTIONAL (kept for the
-- inbox path when known). Token is the claim key.
alter table api.passport_tags alter column to_email drop not null;
alter table api.passport_tags add column if not exists token text;
create unique index if not exists passport_tags_token_idx on api.passport_tags (token) where token is not null;

-- Resolve an email → user id. SECURITY DEFINER so it can read auth.users, but
-- granted ONLY to service_role (the Worker) → clients can never enumerate users.
create or replace function api.user_id_by_email(p_email text)
returns uuid language sql security definer set search_path = auth, public as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function api.user_id_by_email(text) from anon, authenticated, public;
grant execute on function api.user_id_by_email(text) to service_role;

-- RLS on; NO client policies → private to the Worker (service-role bypasses RLS).
alter table api.passport_stamps       enable row level security;
alter table api.passport_stamp_photos enable row level security;

notify pgrst, 'reload schema';
