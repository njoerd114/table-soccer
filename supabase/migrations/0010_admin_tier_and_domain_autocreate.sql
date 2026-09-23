-- Admin tier + domain auto-provisioning.
--
-- 1. company_members.role gains a third value, 'admin', sitting between
--    'owner' (the original creator, tracked via companies.created_by) and
--    'member'. Everywhere 'owner' previously unlocked a capability, 'admin'
--    now unlocks the same capability -- 'owner' is kept only for the
--    original creator and for the manual create_company() RPC (0009); it is
--    never grantable through the new promotion path below.
--
-- 2. company_auth_allowlist gains a `role` column so an allowlist row (single
--    email or whole domain) can pre-assign 'admin' instead of the default
--    'member'.
--
-- 3. handle_new_user_company_autojoin() (0008) is extended: if a brand-new
--    signup's email domain matches NO allowlist row at all (neither a single
--    email nor a domain row), they are now the first person from that domain
--    to ever sign in. Instead of falling back to the manual create-company
--    UI, a company is auto-created for them (name derived from the domain,
--    renamable afterward via the existing companies_update_owner policy),
--    they become that company's 'admin', and a new domain-wide allowlist row
--    is inserted so every subsequent signup from the same domain auto-joins
--    as a plain 'member' (until an admin promotes them).
--
-- 4. A new company_members_update_admin policy lets an existing owner/admin
--    promote a 'member' row in their own company to 'admin'. It can never
--    grant 'owner', and it can never touch the owner's own row, via a
--    SECURITY DEFINER helper (current_user_company_role) that avoids the
--    same self-referencing-policy recursion fixed in 0006.

alter table public.company_members drop constraint company_members_role_check;
alter table public.company_members add constraint company_members_role_check
  check (role in ('owner', 'admin', 'member'));

alter table public.company_auth_allowlist add column role text not null default 'member'
  check (role in ('admin', 'member'));

comment on column public.company_auth_allowlist.role is
  'Role granted on auto-join via this rule. Never ''owner'' -- ownership is reserved for the original company creator.';

create or replace function public.allowlist_add_email(
  target_company_id uuid,
  target_email text,
  target_role text default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  new_salt text := encode(gen_random_bytes(16), 'hex');
  new_id uuid;
begin
  if target_role not in ('admin', 'member') then
    raise exception 'target_role must be admin or member, got %', target_role;
  end if;

  insert into public.company_auth_allowlist (company_id, identity_hash, identity_salt, role)
  values (
    target_company_id,
    encode(digest(new_salt || lower(target_email), 'sha256'), 'hex'),
    new_salt,
    target_role
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- SECURITY DEFINER: lets an RLS policy on company_members read the caller's
-- own role in a specific company without re-entering company_members' own
-- policy (the same recursion class that 0006 fixed for current_company_ids).
create or replace function public.current_user_company_role(target_company_id uuid)
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select role
  from public.company_members
  where company_id = target_company_id
    and user_id = auth.uid()
$$;

comment on function public.current_user_company_role(uuid) is
  'Caller''s own role in target_company_id, or null; SECURITY DEFINER to avoid RLS recursion on company_members.';

revoke all on function public.current_user_company_role(uuid) from public;
revoke all on function public.current_user_company_role(uuid) from anon;
grant execute on function public.current_user_company_role(uuid) to authenticated;

-- An owner/admin can promote another member of their own company to 'admin'.
-- Cannot grant 'owner' (with check), and cannot touch the owner's own row
-- (using), so an admin can never demote or remove the original creator here.
create policy company_members_update_admin
on public.company_members
for update
to authenticated
using (
  company_id = any (public.current_company_ids())
  and role <> 'owner'
  and public.current_user_company_role(company_id) in ('owner', 'admin')
)
with check (
  role in ('member', 'admin')
  and company_id = any (public.current_company_ids())
);

-- Broaden the owner-only checks from 0007 and 0005 to also accept 'admin',
-- since the auto-provisioned first-domain-user is now 'admin', not 'owner'.
drop policy if exists seasons_insert on public.seasons;
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
      and role in ('owner', 'admin')
  )
);

drop policy if exists leagues_insert on public.leagues;
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
      and role in ('owner', 'admin')
  )
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
      and role in ('owner', 'admin')
  )
);

-- Extend the auto-join trigger: no allowlist match at all for this domain
-- means this is the first-ever signup from that domain, so auto-provision a
-- company for them instead of falling back to the manual create-company UI.
create or replace function public.handle_new_user_company_autojoin()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  matched_company_id uuid;
  matched_role text;
  new_user_domain text := split_part(lower(new.email), '@', 2);
  new_company_id uuid;
  derived_company_name text;
begin
  if new.email is null or new_user_domain = '' then
    return new;
  end if;

  select company_id, role
  into matched_company_id, matched_role
  from public.company_auth_allowlist
  where signup_domain = new_user_domain
     or (
       identity_hash is not null
       and identity_hash = encode(digest(identity_salt || lower(new.email), 'sha256'), 'hex')
     )
  limit 1;

  if matched_company_id is not null then
    insert into public.company_members (company_id, user_id, role)
    values (matched_company_id, new.id, coalesce(matched_role, 'member'))
    on conflict (company_id, user_id) do nothing;

    return new;
  end if;

  derived_company_name := initcap(split_part(new_user_domain, '.', 1));

  insert into public.companies (name, created_by)
  values (derived_company_name, new.id)
  returning id into new_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (new_company_id, new.id, 'admin');

  insert into public.company_auth_allowlist (company_id, signup_domain, role)
  values (new_company_id, new_user_domain, 'member');

  return new;
end;
$$;
