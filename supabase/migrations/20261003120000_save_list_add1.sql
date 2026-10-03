-- Founder additions to the save list (2026-10-03, batch 2).
insert into api.held_handles (handle, kind) values
  ('juan', 'family'),
  ('juanlinares', 'family'),
  ('leo', 'family'),
  ('leonard', 'family'),
  ('leonardporcano', 'family'),
  ('lporcano', 'family'),
  ('mporcano', 'family')
on conflict (handle) do nothing;
