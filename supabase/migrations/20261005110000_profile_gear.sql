-- "My virtual items" + travel buddies (founder, 2026-10-05): the profile's
-- laptop and drink container (color, variant, placed stickers) and up to six
-- named virtual pets. One row per traveler; shapes are validated by the worker.
create table if not exists api.profile_gear (
  user_id uuid primary key,
  gear jsonb not null default '{}'::jsonb,     -- { laptop: {...}, drink: {...} }
  buddies jsonb not null default '[]'::jsonb,  -- [{ id, species, breed, coat, name, pose }]
  layout jsonb not null default '{}'::jsonb,   -- { order: ["luggage","laptop","drink"] }
  updated_at timestamptz not null default now()
);
alter table api.profile_gear enable row level security;
grant select, insert, update, delete on api.profile_gear to service_role;
