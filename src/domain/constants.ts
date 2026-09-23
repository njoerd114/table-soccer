/**
 * Domain constants — ported from legacy src/constants/index.js.
 * NOTE: legacy had the typo POSITION_MIDFILED; fixed to MIDFIELD here.
 * MIDFIELD is used everywhere consistently in the new codebase.
 */
export const ATTACK_PLAYER = 'attack' as const
export const DEFENSE_PLAYER = 'defense' as const

export const SELECT_PLAYERS_STEP = 'SELECT_PLAYERS_STEP' as const
export const ACTIVE_GAME_STEP = 'ACTIVE_GAME_STEP' as const
export const GAME_END_STEP = 'GAME_END_STEP' as const

export const GUEST = 'guest' as const

export const POSITION_KEEPER = 'KEEPER' as const
export const POSITION_DEFENSE = 'DEFENSE' as const
export const POSITION_MIDFIELD = 'MIDFIELD' as const
export const POSITION_STRIKER = 'STRIKER' as const

export const POSITIONS = [
  POSITION_KEEPER,
  POSITION_DEFENSE,
  POSITION_MIDFIELD,
  POSITION_STRIKER
] as const

export type Position = (typeof POSITIONS)[number]

export const POSITION_COUNT: Record<Position, number> = {
  [POSITION_KEEPER]: 1,
  [POSITION_DEFENSE]: 2,
  [POSITION_MIDFIELD]: 5,
  [POSITION_STRIKER]: 3
}

export const GOAL_TIMEOUT = 5000
export const TEAM1_COLOR = '#00bcd4'
export const TEAM2_COLOR = '#ff4081'

/** Games needed before a player qualifies for the leaderboard. */
export const PLACEMENT_MIN_GAMES = 10

/** Starting ELO for players and teams. */
export const DEFAULT_ELO = 1500