-- Public app tables intentionally contain no email, provider UID, phone, or
-- raw Google profile URL. Supabase Auth owns identity data in auth.users.

create extension if not exists pgcrypto;

create table public.players (
  id uuid primary key default auth.uid(),
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.players is
  'Public player profiles only: id, display_name, avatar_url, created_at. No PII.';
comment on column public.players.id is
  'Profile id; defaults to auth.uid() and is the only auth user reference in players.';
comment on column public.players.display_name is
  'User-chosen public display name; never copy email or provider profile name here.';
comment on column public.players.avatar_url is
  'Optional public CDN avatar URL; never store raw Google profile photo URLs.';

create table public.games (
  id uuid primary key default gen_random_uuid(),
  startdate bigint not null,
  duration integer not null,
  players text[] not null,
  scores integer[] not null,
  timeline jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  constraint games_players_length check (
    coalesce(array_length(players, 1), 0) = 4
  ),
  constraint games_scores_length check (
    coalesce(array_length(scores, 1), 0) = 8
  ),
  constraint games_timeline_is_array check (jsonb_typeof(timeline) = 'array')
);

comment on table public.games is
  'Authenticated-only game history. Records are immutable after insert by policy.';
comment on column public.games.startdate is
  'Unix timestamp in milliseconds, aligned with GameRecord.startdate.';
comment on column public.games.duration is
  'Game duration in seconds, aligned with GameRecord.duration.';
comment on column public.games.players is
  'Four public player ids as text, aligned with GameRecord.players.';
comment on column public.games.scores is
  'Eight scores: p1,p2,p3,p4,p1Own,p2Own,p3Own,p4Own.';
comment on column public.games.timeline is
  'TimelineEvent[] JSON array: player_id,index,position,time,own_goal.';
comment on column public.games.created_by is
  'Authenticated author used only by RLS; email/provider UID stays in auth.users.';

create index games_startdate_desc_idx on public.games (startdate desc);
create index players_display_name_idx on public.players (display_name);

create or replace function public.ensure_game_players_exist()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  existing_player_count integer;
  invalid_timeline_player_count integer;
begin
  select count(*)
  into existing_player_count
  from public.players
  where id::text = any (new.players);

  if existing_player_count <> 4 then
    raise exception 'games.players must reference four existing players';
  end if;

  select count(*)
  into invalid_timeline_player_count
  from jsonb_array_elements(new.timeline) as timeline_event(value)
  where not coalesce(
    (timeline_event.value ->> 'player_id') = any (new.players),
    false
  );

  if invalid_timeline_player_count > 0 then
    raise exception 'games.timeline player_id values must reference game players';
  end if;

  return new;
end;
$$;

comment on function public.ensure_game_players_exist() is
  'Rejects games whose denormalized players/timeline ids do not exist in public.players.';

create trigger ensure_game_players_exist
before insert or update on public.games
for each row
execute function public.ensure_game_players_exist();
