-- Super admin: a single, non-self-service, platform-wide role for the
-- original operator. Reserved deliberately -- there is no RPC to add
-- another super admin; that is a manual SQL-editor-only operation, mirroring
-- the allowlist_add_email pattern from 0008. Grants full cross-company read
-- visibility and the ability to attach/change any user's role in any
-- company, without touching the deny-by-default posture for everyone else.

create table public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.super_admins is
  'Platform-wide super admins. Server-only: zero client grants, forced RLS. Add rows manually via SQL editor only.';

revoke all on table public.super_admins from public;
revoke all on table public.super_admins from anon;
revoke all on table public.super_admins from authenticated;

alter table public.super_admins enable row level security;
alter table public.super_admins force row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.super_admins where user_id = auth.uid()
  )
$$;

comment on function public.is_super_admin() is
  'SECURITY DEFINER check against the server-only super_admins table.';

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_super_admin() from anon;
grant execute on function public.is_super_admin() to authenticated;

-- Client-safe boolean the UI can call to decide whether to render the
-- cross-company admin view. Wraps is_super_admin(); no data exposure.
create or replace function public.am_i_super_admin()
returns boolean
language sql
security invoker
set search_path = public, pg_temp
stable
as $$
  select public.is_super_admin()
$$;

revoke all on function public.am_i_super_admin() from public;
revoke all on function public.am_i_super_admin() from anon;
grant execute on function public.am_i_super_admin() to authenticated;

-- The known platform operator (niklas.beinghaus@fiskaly.com's Supabase Auth
-- user id, captured once at rollout time -- never re-derived from email).
insert into public.super_admins (user_id)
values ('8e97739a-8608-4318-968d-497f248d9d12')
on conflict (user_id) do nothing;

-- Cross-company read visibility ----------------------------------------------
drop policy if exists companies_select_member on public.companies;
create policy companies_select_member
on public.companies
for select
to authenticated
using (id = any (public.current_company_ids()) or public.is_super_admin());

drop policy if exists company_members_select on public.company_members;
create policy company_members_select
on public.company_members
for select
to authenticated
using (
  user_id = auth.uid()
  or company_id = any (public.current_company_ids())
  or public.is_super_admin()
);

drop policy if exists seasons_select on public.seasons;
create policy seasons_select
on public.seasons
for select
to authenticated
using (company_id = any (public.current_company_ids()) or public.is_super_admin());

drop policy if exists leagues_select on public.leagues;
create policy leagues_select
on public.leagues
for select
to authenticated
using (company_id = any (public.current_company_ids()) or public.is_super_admin());

drop policy if exists players_select_member on public.players;
create policy players_select_member
on public.players
for select
to authenticated
using (
  company_id is null
  or company_id = any (public.current_company_ids())
  or public.is_super_admin()
);

drop policy if exists games_select_company on public.games;
create policy games_select_company
on public.games
for select
to authenticated
using (
  company_id is null
  or company_id = any (public.current_company_ids())
  or opponent_company_id = any (public.current_company_ids())
  or public.is_super_admin()
);

-- Cross-company role management ----------------------------------------------
drop policy if exists company_members_update_admin on public.company_members;
create policy company_members_update_admin
on public.company_members
for update
to authenticated
using (
  public.is_super_admin()
  or (
    company_id = any (public.current_company_ids())
    and role <> 'owner'
    and public.current_user_company_role(company_id) in ('owner', 'admin')
  )
)
with check (
  public.is_super_admin()
  or (
    role in ('member', 'admin')
    and company_id = any (public.current_company_ids())
  )
);

drop policy if exists company_members_insert on public.company_members;
create policy company_members_insert
on public.company_members
for insert
to authenticated
with check (user_id = auth.uid() or public.is_super_admin());

drop policy if exists company_members_delete on public.company_members;
create policy company_members_delete
on public.company_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
  or company_id in (
    select company_id
    from public.company_members
    where user_id = auth.uid()
      and role in ('owner', 'admin')
  )
);

drop policy if exists companies_update_owner on public.companies;
create policy companies_update_owner
on public.companies
for update
to authenticated
using (created_by = auth.uid() or public.is_super_admin())
with check (created_by = auth.uid() or public.is_super_admin());
