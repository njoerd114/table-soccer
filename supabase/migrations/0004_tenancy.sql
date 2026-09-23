-- Multi-company tenancy tables intentionally contain no email, provider UID,
-- phone, or raw Google profile URL. Company names are business data.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.companies is
  'Business tenant for isolated player pools, leaderboards, seasons, and leagues. No PII.';
comment on column public.companies.id is
  'Company id used as the tenant boundary across app tables.';
comment on column public.companies.name is
  'Company display name; business data, not user PII.';
comment on column public.companies.created_by is
  'Authenticated creator used by RLS; email/provider UID stays in auth.users.';
comment on column public.companies.created_at is
  'Timestamp when the company row was created.';

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

comment on table public.company_members is
  'Membership rows linking auth users to companies for tenant isolation. No PII.';
comment on column public.company_members.id is
  'Membership row id.';
comment on column public.company_members.company_id is
  'Company whose data the member may access.';
comment on column public.company_members.user_id is
  'Auth user id for the member; email/provider UID stays in auth.users.';
comment on column public.company_members.role is
  'Tenant role for owner/member authorization.';
comment on column public.company_members.created_at is
  'Timestamp when the membership row was created.';

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint seasons_date_range check (ends_on is null or ends_on >= starts_on)
);

comment on table public.seasons is
  'Company-scoped competitive periods for filtering games and leaderboards. No PII.';
comment on column public.seasons.id is
  'Season id aligned with GameRecord.season_id.';
comment on column public.seasons.company_id is
  'Company that owns the season.';
comment on column public.seasons.name is
  'Season display name; business data, not user PII.';
comment on column public.seasons.starts_on is
  'Inclusive season start date.';
comment on column public.seasons.ends_on is
  'Optional inclusive season end date; null means ongoing.';
comment on column public.seasons.created_by is
  'Authenticated creator used by RLS; email/provider UID stays in auth.users.';
comment on column public.seasons.created_at is
  'Timestamp when the season row was created.';

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.leagues is
  'Company-scoped competition groups for filtering games and leaderboards. No PII.';
comment on column public.leagues.id is
  'League id aligned with GameRecord.league_id.';
comment on column public.leagues.company_id is
  'Company that owns the league.';
comment on column public.leagues.name is
  'League display name; business data, not user PII.';
comment on column public.leagues.created_by is
  'Authenticated creator used by RLS; email/provider UID stays in auth.users.';
comment on column public.leagues.created_at is
  'Timestamp when the league row was created.';

alter table public.players
add column company_id uuid references public.companies(id) on delete set null;

comment on column public.players.company_id is
  'Optional company tenant for player visibility; null keeps legacy seeded profiles visible.';

alter table public.games
add column company_id uuid references public.companies(id) on delete restrict;

alter table public.games
add column opponent_company_id uuid references public.companies(id) on delete set null;

alter table public.games
add column season_id uuid references public.seasons(id) on delete set null;

alter table public.games
add column league_id uuid references public.leagues(id) on delete set null;

comment on column public.games.company_id is
  'Host company tenant for game visibility; null keeps legacy seeded games visible until RLS migration.';
comment on column public.games.opponent_company_id is
  'Optional opponent company for cross-company games; null means same company.';
comment on column public.games.season_id is
  'Optional season filter aligned with GameRecord.season_id.';
comment on column public.games.league_id is
  'Optional league filter aligned with GameRecord.league_id.';

create index company_members_user_id_idx on public.company_members (user_id);
create index seasons_company_id_starts_on_desc_idx on public.seasons (company_id, starts_on desc);
create index leagues_company_id_idx on public.leagues (company_id);
create index games_company_id_startdate_desc_idx on public.games (company_id, startdate desc);
