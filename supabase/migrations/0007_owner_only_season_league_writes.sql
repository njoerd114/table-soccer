-- Restrict season/league creation to company owners. Members could previously
-- insert seasons/leagues for any company they belonged to; only owners should
-- curate competitive structure. Matches the existing owner-check pattern used
-- by company_members_delete.

drop policy if exists seasons_insert on public.seasons;

-- Only a company owner can create seasons for that company.
create policy seasons_insert
on public.seasons
for insert
to authenticated
with check (
  created_by = auth.uid()
  and company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
      and role = 'owner'
  )
);

drop policy if exists leagues_insert on public.leagues;

-- Only a company owner can create leagues for that company.
create policy leagues_insert
on public.leagues
for insert
to authenticated
with check (
  created_by = auth.uid()
  and company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
      and role = 'owner'
  )
);
