-- New arrivals (founder's decision sheet, 2026-10-25): a member who just joined shows on others' Arrivals
-- page for 14 days — only their @username and the city (else country) they joined from — unless they
-- turn "Show me in New arrivals" off. null = on, as with find_by_name / find_by_email.
alter table api.social_profiles add column if not exists in_arrivals boolean;
notify pgrst, 'reload schema';
