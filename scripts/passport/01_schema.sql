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

-- RLS on; NO client policies → private to the Worker (service-role bypasses RLS).
alter table api.passport_stamps       enable row level security;
alter table api.passport_stamp_photos enable row level security;

notify pgrst, 'reload schema';
