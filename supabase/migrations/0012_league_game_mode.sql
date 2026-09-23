-- Per-league game mode, chosen once at league creation and immutable
-- afterward, plus a non-scoring "advanced mode" annotation channel on games.
--
-- Immutability: leagues has no UPDATE grant/policy at all (only 0007's
-- leagues_insert exists), so game_mode can never be changed once a league
-- is created -- no extra trigger needed.
--
-- annotations never affects scores or ELO: it lives in a separate jsonb
-- column from `timeline`, which the frozen domain/transform.ts and
-- domain/elo.ts never read. It is purely a display-only, non-scoring
-- dead-ball event log (ball_out / corner_ball), only ever populated when
-- the game's league has game_mode = 'advanced'.

alter table public.leagues add column game_mode text not null default 'classic'
  check (game_mode in ('classic', 'advanced'));

comment on column public.leagues.game_mode is
  'Chosen once at league creation; immutable (leagues has no UPDATE policy). classic = goals only, advanced = classic + non-scoring annotations.';

alter table public.games add column annotations jsonb not null default '[]'::jsonb
  check (jsonb_typeof(annotations) = 'array');

comment on column public.games.annotations is
  'Non-scoring dead-ball events (ball_out/corner_ball). Never read by scoring/ELO logic. Only populated for advanced-mode leagues.';
