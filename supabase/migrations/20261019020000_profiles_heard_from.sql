-- Where a new member heard about GlobeSkimmers (optional, one tap at onboarding; 2026-10-19):
-- fb | tiktok | ig | yt | friend | group | other. NULL = skipped or joined before the question.
alter table public.profiles add column if not exists heard_from text;
notify pgrst, 'reload schema';
