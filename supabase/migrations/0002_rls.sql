-- Two-layer defense: table grants deny access first, and RLS policies must also
-- approve every row. If a future grant is misconfigured, RLS still blocks anon.

-- Default public schema privileges must not make app tables reachable.
revoke all on schema public from public;
revoke all on schema public from anon;
revoke all on schema public from authenticated;

-- Authenticated clients need schema lookup to reach explicitly granted tables.
grant usage on schema public to authenticated;

-- App tables start from zero privileges for both browser-facing roles.
revoke all on table public.players from public;
revoke all on table public.players from anon;
revoke all on table public.players from authenticated;
revoke all on table public.games from public;
revoke all on table public.games from anon;
revoke all on table public.games from authenticated;

-- Trigger helpers are internal table-integrity code, not browser RPC endpoints.
revoke execute on function public.ensure_game_players_exist() from public;
revoke execute on function public.ensure_game_players_exist() from anon;
revoke execute on function public.ensure_game_players_exist() from authenticated;

-- Grants read access to non-PII player profiles; RLS still decides rows.
grant select on table public.players to authenticated;

-- Grants profile creation; RLS restricts inserts to id = auth.uid().
grant insert on table public.players to authenticated;

-- Grants profile edits; RLS restricts updates to the user's own row.
grant update on table public.players to authenticated;

-- Grants profile deletion; RLS restricts deletes to the user's own row.
grant delete on table public.players to authenticated;

-- Grants leaderboard history reads to signed-in users only; RLS still applies.
grant select on table public.games to authenticated;

-- Grants game creation only; immutable records have no UPDATE/DELETE grant.
grant insert on table public.games to authenticated;

-- Every app table must evaluate RLS for browser-originated access.
alter table public.players enable row level security;
alter table public.games enable row level security;

-- Force table owners through RLS where possible; service_role still bypasses RLS.
alter table public.players force row level security;
alter table public.games force row level security;

-- Everyone signed in can view non-PII public player profiles.
create policy players_select
on public.players
for select
to authenticated
using (true);

-- A signed-in user can create only the profile row whose id is auth.uid().
create policy players_insert
on public.players
for insert
to authenticated
with check (id = auth.uid());

-- A signed-in user can edit only their own profile and cannot move ownership.
create policy players_update
on public.players
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- A signed-in user can delete only their own player profile row.
create policy players_delete
on public.players
for delete
to authenticated
using (id = auth.uid());

-- Everyone signed in can view game history for leaderboard/stat calculations.
create policy games_select
on public.games
for select
to authenticated
using (true);

-- A signed-in user can create only game rows attributed to their own auth id.
create policy games_insert
on public.games
for insert
to authenticated
with check (created_by = auth.uid());

-- Anonymous clients intentionally receive no grants and no policies.
revoke all on table public.players from anon;
revoke all on table public.games from anon;
