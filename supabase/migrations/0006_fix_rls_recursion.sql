-- Fix RLS infinite recursion: policies must NOT query company_members directly
-- (its own policy re-enters the query). A SECURITY DEFINER helper reads
-- membership as the table owner (bypasses RLS) and returns the company ids
-- the current auth user belongs to. All tenancy policies now use it.

-- SECURITY DEFINER: runs as the migration owner (superuser) so it can read
-- company_members without triggering that table's own RLS policy.
-- search_path is pinned to public to prevent search-path hijacking.
create or replace function public.current_company_ids()
returns uuid[]
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(array_agg(company_id), '{}')
  from public.company_members
  where user_id = auth.uid()
$$;

comment on function public.current_company_ids() is
  'Company ids of the current auth user; SECURITY DEFINER to avoid RLS recursion.';

revoke all on function public.current_company_ids() from public;
revoke all on function public.current_company_ids() from anon;
grant execute on function public.current_company_ids() to authenticated;

-- companies -----------------------------------------------------------------
drop policy if exists companies_select_member on public.companies;
create policy companies_select_member
on public.companies
for select
to authenticated
using (id = any (public.current_company_ids()));

-- company_members ------------------------------------------------------------
drop policy if exists company_members_select on public.company_members;
create policy company_members_select
on public.company_members
for select
to authenticated
using (
  user_id = auth.uid()
  or company_id = any (public.current_company_ids())
);

drop policy if exists company_members_delete on public.company_members;
create policy company_members_delete
on public.company_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
      and role = 'owner'
  )
);

-- seasons --------------------------------------------------------------------
drop policy if exists seasons_select on public.seasons;
create policy seasons_select
on public.seasons
for select
to authenticated
using (company_id = any (public.current_company_ids()));

drop policy if exists seasons_insert on public.seasons;
create policy seasons_insert
on public.seasons
for insert
to authenticated
with check (
  company_id = any (public.current_company_ids())
  and created_by = auth.uid()
);

-- leagues --------------------------------------------------------------------
drop policy if exists leagues_select on public.leagues;
create policy leagues_select
on public.leagues
for select
to authenticated
using (company_id = any (public.current_company_ids()));

drop policy if exists leagues_insert on public.leagues;
create policy leagues_insert
on public.leagues
for insert
to authenticated
with check (
  company_id = any (public.current_company_ids())
  and created_by = auth.uid()
);

-- players --------------------------------------------------------------------
drop policy if exists players_select_member on public.players;
create policy players_select_member
on public.players
for select
to authenticated
using (
  company_id is null
  or company_id = any (public.current_company_ids())
);

drop policy if exists players_insert_member on public.players;
create policy players_insert_member
on public.players
for insert
to authenticated
with check (
  id = auth.uid()
  and (
    company_id is null
    or company_id = any (public.current_company_ids())
  )
);

drop policy if exists players_update_member on public.players;
create policy players_update_member
on public.players
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and (
    company_id is null
    or company_id = any (public.current_company_ids())
  )
);

-- games ----------------------------------------------------------------------
drop policy if exists games_select_company on public.games;
create policy games_select_company
on public.games
for select
to authenticated
using (
  company_id is null
  or company_id = any (public.current_company_ids())
  or opponent_company_id = any (public.current_company_ids())
);

drop policy if exists games_insert_company on public.games;
create policy games_insert_company
on public.games
for insert
to authenticated
with check (
  created_by = auth.uid()
  and company_id = any (public.current_company_ids())
  and (
    opponent_company_id is null
    or opponent_company_id <> company_id
  )
);