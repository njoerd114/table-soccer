import type { GameRecord, PlayerStats } from './types'

/**
 * Legacy-ported score tuple type from `GameRecord["scores"]`.
 * Preserves the original 8-slot ordering from 2018 Helper.js.
 */
export type Scores8 = GameRecord['scores']

type EloPlayer = Pick<PlayerStats, 'elo' | 'winStreak'>
type EloEnemy = Pick<PlayerStats, 'elo'>

/**
 * Port of legacy `Helper.getScore`.
 *
 * Computes team score pair from per-player score tuple:
 * [p1, p2, p3, p4, p1Own, p2Own, p3Own, p4Own] ->
 * [team1Score, team2Score].
 */
export function getScore(score: Scores8): [number, number] {
  const [p1, p2, p3, p4, p1Own, p2Own, p3Own, p4Own] = score

  return [p1 + p2 + p3Own + p4Own, p3 + p4 + p1Own + p2Own]
}

/**
 * Port of legacy `Helper.calcFactor`.
 *
 * Uses exponent `(ratingA - ratingB) / 750`, logistic expectation,
 * then rounds to exactly 2 decimals via `toFixed(2)` semantics.
 */
export function calcFactor(ratingA: number, ratingB: number): number {
  const exponent = (ratingA - ratingB) / 750

  return Number.parseFloat((1 / (1 + 10 ** exponent)).toFixed(2))
}

/**
 * Port of legacy `Helper.calc2v2`.
 *
 * A's expected score versus average of two opponents (rounded average).
 */
export function calc2v2(
  ratingA: number,
  ratingB1: number,
  ratingB2: number
): number {
  const ratingB = Math.round((ratingB1 + ratingB2) / 2)

  return calcFactor(ratingA, ratingB)
}

/**
 * Port of legacy `Helper.calcTeamElo`.
 *
 * Uses multiplier 50 and returns `[winnerGain, loserGain]` where
 * loser gain is negative.
 */
export function calcTeamElo(
  ratingA: number,
  ratingB: number
): [number, number] {
  const chance = calcFactor(ratingA, ratingB)
  const multiplier = 50

  return [
    Math.round(chance * multiplier),
    Math.round(-1 * (1 - chance) * multiplier)
  ]
}

/**
 * Port of legacy `Helper.calcScore`.
 *
 * Keeps legacy behavior exactly:
 * - base chance from `calc2v2`
 * - multiplier = 50
 * - bonus = (1 + goals/30) * (1 + (6 - goalsAgainst)/30)
 * - winner streak bonus = 1.2x when `winStreak >= 3`
 * - loser branch flips chance and mirrors bonus around 1
 * - cap final bonus to 1.5
 * - final result uses `Math.round`
 */
export function calcScore(
  player: EloPlayer,
  enemy1: EloEnemy,
  enemy2: EloEnemy,
  goals: number,
  goalsAgainst: number,
  isWinner: boolean
): number {
  let chance = calc2v2(player.elo, enemy1.elo, enemy2.elo)
  const multiplier = 50
  let bonus = 1 + goals / 30

  bonus *= 1 + (6 - goalsAgainst) / 30

  if (!isWinner) {
    chance = -1 * (1 - chance)
    bonus = 1 - (bonus - 1)
  } else {
    const winStreakBonus = player.winStreak >= 3 ? 1.2 : 1
    bonus *= winStreakBonus
  }

  return Math.round(chance * Math.min(bonus, 1.5) * multiplier)
}

/**
 * Port of legacy `Helper.avgOrFallback`.
 *
 * Returns fallback when denominator is 0 or falsy.
 */
export function avgOrFallback(a: number, b: number, fallback = 0): number {
  if (b === 0 || !b) {
    return fallback
  }

  return a / b
}

/**
 * Port of legacy `Helper.avgOrFirstParameter`.
 *
 * Returns `a` when denominator is exactly 0, else `a / b`.
 */
export function avgOrFirstParameter(a: number, b: number): number {
  return b === 0 ? a : a / b
}
