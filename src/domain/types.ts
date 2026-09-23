import type { Position } from './constants'

/**
 * Domain types — the data model contract for the whole app.
 * Derived from the legacy schema extraction (raw Supabase shape → derived stats).
 */

// ---------------------------------------------------------------------------
// Raw persisted shapes (Supabase tables)
// ---------------------------------------------------------------------------

/** Public player profile. NO PII — never store email/uid/photo from Google here. */
export interface PlayerProfile {
  id: string
  display_name: string
  avatar_url: string | null
  company_id: string | null
  created_at: string
}

/** A company (tenant): isolated player pool, leaderboards, seasons, leagues. */
export interface Company {
  id: string
  name: string
  created_by: string
  created_at: string
}

/** Membership row linking a user (auth uid) to a company. */
export interface CompanyMember {
  id: string
  company_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}

/** A time-bounded competitive period within a company. */
export interface Season {
  id: string
  company_id: string
  name: string
  starts_on: string
  ends_on: string | null
  created_by: string
}

/** A league (competition group) within a company. Game mode is fixed at creation. */
export interface League {
  id: string
  company_id: string
  name: string
  game_mode: GameMode
  created_by: string
}

/**
 * League game mode, chosen once at league creation and never changed after.
 * 'classic' = goals only (current default behavior).
 * 'advanced' = classic, plus optional non-scoring dead-ball annotations.
 */
export type GameMode = 'classic' | 'advanced'

/** A single goal/own-goal event in a game's timeline. */
export interface TimelineEvent {
  player_id: string
  /** Player index in the 4-player lineup: 0..3. */
  index: number
  position: Position
  /** Seconds elapsed since game start. */
  time: number
  own_goal: boolean
}

/**
 * A non-scoring dead-ball event, only recorded in 'advanced' game mode.
 * Never affects scores, ELO, or any derived PlayerStats field.
 */
export type GameAnnotationType = 'ball_out' | 'corner_ball'

/** Which team a non-scoring annotation happened for (1 = slots 0/1, 2 = slots 2/3). */
export interface GameAnnotation {
  team: 1 | 2
  type: GameAnnotationType
  /** Seconds elapsed since game start. */
  time: number
}

/** Persisted game record. */
export interface GameRecord {
  id: string
  /** Unix timestamp in milliseconds. */
  startdate: number
  /** Duration in seconds. */
  duration: number
  /** Player ids, [winnerAttack, winnerDefense, loserAttack, loserDefense]. */
  players: [string, string, string, string]
  /**
   * Scores per player, [p1, p2, p3, p4, p1Own, p2Own, p3Own, p4Own].
   * p1/p2 = winner team (attack/defense), p3/p4 = loser team.
   */
  scores: [number, number, number, number, number, number, number, number]
  timeline: TimelineEvent[]
  /** Non-scoring dead-ball annotations; only ever non-empty in 'advanced' league game mode. */
  annotations?: GameAnnotation[]
  /** Host company (tenant). */
  company_id: string | null
  /** Opponent company for cross-company matches; null = same company. */
  opponent_company_id: string | null
  /** Optional season filter. */
  season_id: string | null
  /** Optional league filter. */
  league_id: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Derived shapes (computed from raw records by the transformer)
// ---------------------------------------------------------------------------

/** Public per-player stats. */
export interface PlayerStats {
  id: string
  display_name: string
  avatar_url: string | null

  // Per-position goals
  goalsPosStriker: number
  goalsPosMidfield: number
  goalsPosDefense: number
  goalsPosKeeper: number
  ownGoals: number

  // Win/loss
  wins: number
  winsAttack: number
  winsDefense: number
  losses: number
  lossesAttack: number
  lossesDefense: number
  winStreak: number
  longestWinStreak: number

  // Games
  games: number
  gamesAttack: number
  gamesDefense: number

  // Goals
  goals: number
  goalsAttack: number
  goalsDefense: number
  goalsAgainst: number
  goalsAgainstDefense: number
  goalsWinnerAttack: number
  ownGoalsAttack: number
  ownGoalsDefense: number

  // ELO
  elo: number
  eloGain: number

  // Averages & ratios
  winRatio: number
  winRatioAttack: number
  winRatioDefense: number
  avgGoalsPosStriker: number
  avgGoalsPosMidfield: number
  avgGoalsPosDefense: number
  avgGoalsPosKeeper: number
  avgGoalsWinnerAttack: number
  avgGoalsAgainstDefense: number
  avgOwnGoals: number
  avgTimeBetweenGoals: number
  avgTimeBetweenGoalsAgainst: number

  // Play time (seconds)
  playTime: number
  playTimeAttack: number
  playTimeDefense: number
  avgGameDuration: number
  winsAttackDuration: number
  avgWinsAttackDuration: number
  lossDefenseDuration: number
  avgLossDefenseDuration: number

  // Metadata
  placementFinished: boolean
  selectionIndex: number
  totalAvgTimeBetweenGoals: number
  totalAvgTimeBetweenGoalsAgainst: number
}

/** Simple player reference inside a game/team context. */
export interface SimplePlayer {
  id: string
  name: string
  photoURL?: string
  score?: number
  ownGoals?: number
}

/** Team keyed by `${attackId}-${defenseId}`. */
export interface Team {
  id: string
  elo: number
  goals: number
  games: number
  wins: number
  losses: number
  winRatio: number
  attack: SimplePlayer
  defense: SimplePlayer
}

/** Enriched timeline entry (raw event + running score + player name). */
export interface TimelineEntry extends TimelineEvent {
  score: [number, number]
  name: string
}

/** Enriched game as displayed in UI. */
export interface Game {
  id: string
  startdate: Date
  duration: number
  timeline: TimelineEntry[]
  annotations: GameAnnotation[]
  winnerScore: number
  loserScore: number
  winnerAttack: SimplePlayer
  winnerDefense: SimplePlayer
  loserAttack: SimplePlayer
  loserDefense: SimplePlayer
  players: Record<string, PlayerStats & { isWinner: boolean; index: number }>
  winnerTeamKey: string
  loserTeamKey: string
  [key: `team:${string}`]: Team
}

/** Stat extremes for leaderboards. */
export interface PropertyExtremes {
  min: { value: number; id: string }
  max: { value: number; id: string }
}

export interface AppData {
  games: Game[]
  players: PlayerStats[]
  teams: Record<string, Team>
  properties: Record<string, PropertyExtremes>
}

/** Active game state during play. */
export interface ActiveGame {
  startdate: number
  activeStep:
    | typeof import('./constants').SELECT_PLAYERS_STEP
    | typeof import('./constants').ACTIVE_GAME_STEP
    | typeof import('./constants').GAME_END_STEP
  scoreTimeline: TimelineEvent[]
  isFinished: boolean
  isUpsideDown: boolean
  score: [number, number, number, number, number, number, number, number]
  players: SimplePlayer[]
  lastGame?: Game
}