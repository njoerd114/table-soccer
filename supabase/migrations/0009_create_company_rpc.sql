-- Fixes a chicken-and-egg RLS bug in company creation. The client flow was
-- `insert into companies ... returning *`, but companies_select_member
-- requires an existing company_members row for that company — which cannot
-- exist yet at the moment the company itself is first created. Postgres
-- applies the SELECT policy to RETURNING too, so every real signup's first
-- "create company" call failed with a generic RLS violation.
--
-- Fix: one SECURITY DEFINER RPC that inserts the company AND the owner
-- membership row atomically in a single transaction, then returns the
-- company directly (bypassing RLS on its own inserts, same trust boundary
-- as public.current_company_ids() in 0006). This also closes a pre-existing
-- non-atomicity gap: the previous two-step client flow could leave an
-- orphaned, unowned company if the second insert failed or the connection
-- dropped in between.

create or replace function public.create_company(company_name text)
returns public.companies
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_company public.companies;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'create_company requires an authenticated user';
  end if;

  insert into public.companies (name, created_by)
  values (company_name, current_user_id)
  returning * into new_company;

  insert into public.company_members (company_id, user_id, role)
  values (new_company.id, current_user_id, 'owner');

  return new_company;
end;
$$;

comment on function public.create_company(text) is
  'Atomically creates a company and its owner membership row; bypasses the RETURNING/RLS chicken-egg via SECURITY DEFINER.';

revoke all on function public.create_company(text) from public;
revoke all on function public.create_company(text) from anon;
grant execute on function public.create_company(text) to authenticated;
