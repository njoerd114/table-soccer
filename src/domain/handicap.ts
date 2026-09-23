import { DEFAULT_ELO } from './constants'
import type { Game } from './types'

/**
 * Golf-style handicap for foosball players.
 *
 * Model: a player's handicap reflects their recent POTENTIAL ability —
 * like golf's "best 8 of last 20 rounds". We take the player's post-game
 * ELO history from the last N games, keep the best half of those ELO
 * values, average them, and convert the gap to 1500 into a goal head start
 * at 100 ELO per goal.
 *
 * Lower handicap = better player (same convention as golf). The weaker
 * side of a match receives the handicap gap as a goal head start.
 */

export const HANDICAP_WINDOW = 10
/** ELO points that correspond to one goal of handicap. */
export const ELO_PER_GOAL = 100

function average(values: readonly number[]): number {
  if (values.length === 0) return DEFAULT_ELO
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** ELO history of a player, per game, chronological (post-game ELO). */
function eloHistory(playerId: string, games: readonly Game[]): number[] {
  const elos: number[] = []
  for (const game of games) {
    const entry = game.players[playerId]
    if (entry) {
      elos.push(entry.elo)
    }
  }
  return elos
}

/**
 * Handicap for a single player.
 * Rolling window of the last HANDICAP_WINDOW games; average of the best half
 * of those post-game ELOs; converted to goals at ELO_PER_GOAL per goal.
 */
export function computePlayerHandicap(
  playerId: string,
  games: readonly Game[]
): number {
  const history = eloHistory(playerId, games)
  const recent = history.slice(-HANDICAP_WINDOW)

  if (recent.length === 0) {
    return Math.round((DEFAULT_ELO - DEFAULT_ELO) / ELO_PER_GOAL)
  }

  const bestHalfSize = Math.max(1, Math.ceil(recent.length / 2))
  const bestHalf = [...recent].sort((a, b) => b - a).slice(0, bestHalfSize)
  const ability = average(bestHalf)

  return Math.round((DEFAULT_ELO - ability) / ELO_PER_GOAL)
}

/**
 * Handicap for every player in the derived games, keyed by player id.
 */
export function computeHandicaps(
  games: readonly Game[]
): Map<string, number> {
  const playerIds = new Set<string>()
  for (const game of games) {
    for (const id of Object.keys(game.players)) {
      playerIds.add(id)
    }
  }

  const handicaps = new Map<string, number>()
  for (const id of playerIds) {
    handicaps.set(id, computePlayerHandicap(id, games))
  }
  return handicaps
}

/** Average handicap of a 2-player team. */
export function teamHandicap(
  playerIds: readonly [string, string],
  handicaps: ReadonlyMap<string, number>
): number {
  const first = handicaps.get(playerIds[0]) ?? 0
  const second = handicaps.get(playerIds[1]) ?? 0
  return (first + second) / 2
}

/**
 * Goal head start for a match between two teams.
 * Returns the signed handicap gap: positive = Team A receives the goals,
 * negative = Team B receives them. The weaker side (higher handicap)
 * always receives the gap.
 */
export function matchAllowance(
  teamA: readonly [string, string],
  teamB: readonly [string, string],
  handicaps: ReadonlyMap<string, number>
): number {
  const gap = teamHandicap(teamA, handicaps) - teamHandicap(teamB, handicaps)
  return Math.round(gap)
}