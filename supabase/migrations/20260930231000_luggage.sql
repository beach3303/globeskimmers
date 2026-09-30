-- Virtual Luggage (founder + ChatGPT reference boards, 2026-09-30): six trunk
-- styles (classic/cognac/midnight/expedition/voyager/explorer), five swipeable
-- faces, and a separate STICKER LAYER — earned destination stickers placed by
-- hand, normalized coords so they survive every screen size. One row per user;
-- placements is {luggage: {face: [{sid,x,y,scale,rot,z}]}}. Worker-only.
create table if not exists api.luggage_state (
  user_id    uuid primary key,
  active     text not null default 'classic',
  placements jsonb,
  updated_at timestamptz not null default now()
);
alter table api.luggage_state enable row level security;
grant select, insert, update, delete on api.luggage_state to service_role;
notify pgrst, 'reload schema';
