-- Org owners/admins can read the profiles (name/email) of users who belong to
-- their org — needed to render the member roster. Consistent with the
-- org-admin-reads-member-results decision. Uses the existing security-definer
-- helper so it doesn't recurse.
drop policy if exists profiles_org_admin_read on public.profiles;
create policy profiles_org_admin_read on public.profiles
  for select using (public.shares_admin_org(id));
