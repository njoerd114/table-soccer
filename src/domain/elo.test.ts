import { describe, expect, it } from 'vitest'

import {
  avgOrFallback,
  avgOrFirstParameter,
  calc2v2,
  calcFactor,
  calcScore,
  calcTeamElo,
  getScore,
  type Scores8
} from './elo'

describe('elo', () => {
  it('getScore computes team scores from 8-slot tuple', () => {
    const score: Scores8 = [5, 1, 1, 2, 0, 0, 1, 0]

    expect(getScore(score)).toEqual([7, 3])
  })

  it('calcFactor uses 750 divisor and 2-decimal rounding', () => {
    expect(calcFactor(1500, 1500)).toBe(0.5)
    expect(calcFactor(1600, 1500)).toBe(0.42)
    expect(calcFactor(1500, 1600)).toBe(0.58)
  })

  it('calc2v2 uses rounded enemy average rating', () => {
    expect(calc2v2(1500, 1499, 1500)).toBe(calcFactor(1500, 1500))
    expect(calc2v2(1500, 1499, 1502)).toBe(calcFactor(1500, 1501))
  })

  it('calcTeamElo returns symmetric gains with multiplier 50', () => {
    expect(calcTeamElo(1500, 1500)).toEqual([25, -25])
    expect(calcTeamElo(1600, 1500)).toEqual([21, -29])
  })

  it('calcScore matches winner and loser legacy branches', () => {
    const player = { elo: 1500, winStreak: 3 }
    const enemy1 = { elo: 1500 }
    const enemy2 = { elo: 1500 }

    expect(calcScore(player, enemy1, enemy2, 4, 5, true)).toBe(35)
    expect(calcScore(player, enemy1, enemy2, 4, 5, false)).toBe(-21)
  })

  it('avgOrFallback and avgOrFirstParameter preserve legacy denominator behavior', () => {
    expect(avgOrFallback(10, 2)).toBe(5)
    expect(avgOrFallback(10, 0)).toBe(0)
    expect(avgOrFallback(10, 0, 42)).toBe(42)

    expect(avgOrFirstParameter(600, 0)).toBe(600)
    expect(avgOrFirstParameter(600, 3)).toBe(200)
  })
})
