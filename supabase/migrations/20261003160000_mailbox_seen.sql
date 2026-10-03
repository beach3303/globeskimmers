-- The Mailbox unread signal (2026-10-03 audit P1): the moment this traveler
-- last opened their Mailbox. Everything that happened TO them after it
-- (follows, postcards, reactions and signatures on their pages, tags) lights
-- the dot on the Mailbox tab. Worker-only, like the rest of social_profiles.
alter table api.social_profiles add column if not exists mailbox_seen_at timestamptz;
notify pgrst, 'reload schema';
