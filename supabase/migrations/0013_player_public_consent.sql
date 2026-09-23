alter table public.players add column is_public boolean not null default false;

drop policy if exists players_select_member on public.players;
create policy players_select_member
on public.players
for select
to authenticated
using (
  company_id is null
  or company_id = any (public.current_company_ids())
  or is_public
  or public.is_super_admin()
);
