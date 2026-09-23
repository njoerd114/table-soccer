-- Two-layer defense: table grants deny access first, and RLS policies must also
-- approve every row. If a future grant is misconfigured, RLS still blocks anon.

-- App tables start from zero privileges for both browser-facing roles.
revoke all on table public.companies from public;
revoke all on table public.companies from anon;
revoke all on table public.companies from authenticated;
revoke all on table public.company_members from public;
revoke all on table public.company_members from anon;
revoke all on table public.company_members from authenticated;
revoke all on table public.seasons from public;
revoke all on table public.seasons from anon;
revoke all on table public.seasons from authenticated;
revoke all on table public.leagues from public;
revoke all on table public.leagues from anon;
revoke all on table public.leagues from authenticated;

-- Grants company reads to signed-in members only; RLS still decides rows.
grant select on table public.companies to authenticated;

-- Grants company creation; RLS restricts inserts to created_by = auth.uid().
grant insert on table public.companies to authenticated;

-- Grants company edits; RLS restricts updates to the company creator.
grant update on table public.companies to authenticated;

-- Grants membership reads to signed-in users only; RLS still decides rows.
grant select on table public.company_members to authenticated;

-- Grants self-service membership creation; RLS restricts inserts to user_id = auth.uid().
grant insert on table public.company_members to authenticated;

-- Grants membership removal; RLS restricts deletes to self or company owners.
grant delete on table public.company_members to authenticated;

-- Grants season reads to signed-in company members only; RLS still decides rows.
grant select on table public.seasons to authenticated;

-- Grants season creation; RLS restricts inserts to member-created company rows.
grant insert on table public.seasons to authenticated;

-- Grants league reads to signed-in company members only; RLS still decides rows.
grant select on table public.leagues to authenticated;

-- Grants league creation; RLS restricts inserts to member-created company rows.
grant insert on table public.leagues to authenticated;

-- Every app table must evaluate RLS for browser-originated access.
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.seasons enable row level security;
alter table public.leagues enable row level security;

-- Force table owners through RLS where possible; service_role still bypasses RLS.
alter table public.companies force row level security;
alter table public.company_members force row level security;
alter table public.seasons force row level security;
alter table public.leagues force row level security;

-- A signed-in user can view only companies they belong to.
create policy companies_select_member
on public.companies
for select
to authenticated
using (
  id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
);

-- A signed-in user can create only companies attributed to their own auth id.
create policy companies_insert_owner
on public.companies
for insert
to authenticated
with check (created_by = auth.uid());

-- A signed-in user can edit only companies they created and cannot move ownership.
create policy companies_update_owner
on public.companies
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- A signed-in user can view their memberships and memberships in their companies.
create policy company_members_select
on public.company_members
for select
to authenticated
using (
  user_id = auth.uid()
  or company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
);

-- A signed-in user can add only themselves as a member; invite/approval flows are future work.
create policy company_members_insert
on public.company_members
for insert
to authenticated
with check (user_id = auth.uid());

-- A signed-in user can delete their own memberships, and owners can remove company members.
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

-- A signed-in user can view seasons only for companies they belong to.
create policy seasons_select
on public.seasons
for select
to authenticated
using (
  company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
);

-- A signed-in user can create seasons only for their companies under their auth id.
create policy seasons_insert
on public.seasons
for insert
to authenticated
with check (
  company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
  and created_by = auth.uid()
);

-- A signed-in user can view leagues only for companies they belong to.
create policy leagues_select
on public.leagues
for select
to authenticated
using (
  company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
);

-- A signed-in user can create leagues only for their companies under their auth id.
create policy leagues_insert
on public.leagues
for insert
to authenticated
with check (
  company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
  and created_by = auth.uid()
);

drop policy if exists players_select on public.players;
drop policy if exists players_insert on public.players;
drop policy if exists players_update on public.players;

-- A signed-in user can view legacy profiles and profiles in their companies.
create policy players_select_member
on public.players
for select
to authenticated
using (
  company_id is null
  or company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
);

-- A signed-in user can create only their own profile in no company or their companies.
create policy players_insert_member
on public.players
for insert
to authenticated
with check (
  id = auth.uid()
  and (
    company_id is null
    or company_id in (
      select company_id
      from public.company_members
      where user_id = auth.uid()
    )
  )
);

-- A signed-in user can edit only their own profile and cannot move it outside their companies.
create policy players_update_member
on public.players
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and (
    company_id is null
    or company_id in (
      select company_id
      from public.company_members
      where user_id = auth.uid()
    )
  )
);

drop policy if exists games_select on public.games;
drop policy if exists games_insert on public.games;

-- A signed-in user can view legacy games and games where their company is on either side.
create policy games_select_company
on public.games
for select
to authenticated
using (
  company_id is null
  or company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
  or opponent_company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
);

-- A signed-in user can create games only for a company they belong to.
-- Cross-company matches: opponent_company_id may be ANY company (the host
-- organizes the match); visibility to the opponent is granted by
-- games_select_company above. Record is attributed to created_by = auth.uid().
create policy games_insert_company
on public.games
for insert
to authenticated
with check (
  created_by = auth.uid()
  and company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
  )
  and (
    opponent_company_id is null
    or opponent_company_id <> company_id
  )
);

-- Anonymous clients intentionally receive no grants and no policies.
revoke all on table public.companies from anon;
revoke all on table public.company_members from anon;
revoke all on table public.seasons from anon;
revoke all on table public.leagues from anon;
revoke all on table public.players from anon;
revoke all on table public.games from anon;
