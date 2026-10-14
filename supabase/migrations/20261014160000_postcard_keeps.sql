-- Kept postcards (founder, 2026-10-14: yes to a Keep button): a card someone sent to
-- everyone who follows them, saved into the reader's postcard box. Cards addressed to the
-- reader are always in the box and never need a row here. A card's deletion (its sender
-- deleting their account) takes the keeps with it. Worker-only.
create table if not exists api.postcard_keeps (
  user_id     uuid not null,
  postcard_id uuid not null references api.postcards (id) on delete cascade,
  kept_at     timestamptz not null default now(),
  primary key (user_id, postcard_id)
);
create index if not exists postcard_keeps_postcard_idx on api.postcard_keeps (postcard_id);
alter table api.postcard_keeps enable row level security;
revoke all privileges on api.postcard_keeps from anon, authenticated;
grant select, insert, update, delete on api.postcard_keeps to service_role;

-- The postcard box in one ordered read: the cards addressed to p_user and the broadcast
-- cards they kept, newest first by when each was sent, p_limit at a time (1-100), before
-- p_before (exclusive; null reads from the newest). The worker applies the reader's
-- rails (blocks, minors, a teen's mutual friends) to what this returns.
create or replace function api.postcard_box(p_user uuid, p_before timestamptz default null, p_limit int default 25)
returns setof api.postcards
language sql stable
as $$
  select p.* from api.postcards p
   where p.to_user_id = p_user
     and (p_before is null or p.created_at < p_before)
  union all
  select p.* from api.postcards p
    join api.postcard_keeps k on k.postcard_id = p.id
   where k.user_id = p_user
     and p.to_user_id is null
     and (p_before is null or p.created_at < p_before)
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
$$;
revoke execute on function api.postcard_box(uuid, timestamptz, int) from public, anon, authenticated;
grant execute on function api.postcard_box(uuid, timestamptz, int) to service_role;
notify pgrst, 'reload schema';
