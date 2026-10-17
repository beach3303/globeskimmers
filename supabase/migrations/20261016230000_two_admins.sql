-- Admins are the founder's two sign-ins only: maizasimeon@gmail.com and
-- founder@globeskimmers.io (founder, 2026-10-16). The worker and the app
-- lists changed in the same commit; this narrows the refresh_access rules,
-- which supabase/crm-schema.sql created by hand with four addresses.
-- Guarded: a database without those rules is left as it is.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'refresh_access' and policyname = 'refresh_access_select') then
    alter policy "refresh_access_select" on public.refresh_access
      using (
        lower(email) = lower(auth.jwt() ->> 'email')
        or lower(auth.jwt() ->> 'email') in ('maizasimeon@gmail.com', 'founder@globeskimmers.io')
      );
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'refresh_access' and policyname = 'refresh_access_admin_write') then
    alter policy "refresh_access_admin_write" on public.refresh_access
      using (lower(auth.jwt() ->> 'email') in ('maizasimeon@gmail.com', 'founder@globeskimmers.io'))
      with check (lower(auth.jwt() ->> 'email') in ('maizasimeon@gmail.com', 'founder@globeskimmers.io'));
  end if;
end $$;
