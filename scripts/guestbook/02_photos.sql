-- Guestbook photo columns — run once in the Supabase SQL editor (after 01_schema.sql).
-- One crowdsourced photo per note (food / drink / place). The image bytes live in
-- Cloudflare R2; here we only store the key (for deletion) + a servable URL.
alter table api.guestbook_entries
  add column if not exists photo_key text,   -- R2 object key, e.g. gb/<entity>/<user>/<uuid>.jpg (for purge on delete)
  add column if not exists photo_url text,   -- Worker URL to display the photo
  add column if not exists photo_w   integer,
  add column if not exists photo_h   integer;

notify pgrst, 'reload schema';
