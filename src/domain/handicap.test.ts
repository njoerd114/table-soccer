import { describe, expect, it } from 'vitest'

import { computeHandicaps, computePlayerHandicap, matchAllowance, teamHandicap } from './handicap'
import type { Game } from './types'

function makeGame(
  id: string,
  order: number,
  elos: Record<string, number>
): Game {
  return {
    id,
    startdate: new Date(2026, 0, order),
    duration: 300,
    timeline: [],
    annotations: [],
    winnerScore: 5,
    loserScore: 3,
    winnerAttack: { id: 'a', name: 'A' },
    winnerDefense: { id: 'b', name: 'B' },
    loserAttack: { id: 'c', name: 'C' },
    loserDefense: { id: 'd', name: 'D' },
    players: Object.fromEntries(
      Object.entries(elos).map(([playerId, elo]) => [
        playerId,
        {
          id: playerId,
          display_name: playerId,
          avatar_url: null,
          goalsPosStriker: 0,
          goalsPosMidfield: 0,
          goalsPosDefense: 0,
          goalsPosKeeper: 0,
          ownGoals: 0,
          wins: 0,
          winsAttack: 0,
          winsDefense: 0,
          losses: 0,
          lossesAttack: 0,
          lossesDefense: 0,
          winStreak: 0,
          longestWinStreak: 0,
          games: 0,
          gamesAttack: 0,
          gamesDefense: 0,
          goals: 0,
          goalsAttack: 0,
          goalsDefense: 0,
          goalsAgainst: 0,
          goalsAgainstDefense: 0,
          goalsWinnerAttack: 0,
          ownGoalsAttack: 0,
          ownGoalsDefense: 0,
          elo,
          eloGain: 0,
          winRatio: 0,
          winRatioAttack: 0,
          winRatioDefense: 0,
          avgGoalsPosStriker: 0,
          avgGoalsPosMidfield: 0,
          avgGoalsPosDefense: 0,
          avgGoalsPosKeeper: 0,
          avgGoalsWinnerAttack: 0,
          avgGoalsAgainstDefense: 0,
          avgOwnGoals: 0,
          avgTimeBetweenGoals: 0,
          avgTimeBetweenGoalsAgainst: 0,
          playTime: 0,
          playTimeAttack: 0,
          playTimeDefense: 0,
          avgGameDuration: 0,
          winsAttackDuration: 0,
          avgWinsAttackDuration: 0,
          lossDefenseDuration: 0,
          avgLossDefenseDuration: 0,
          placementFinished: true,
          selectionIndex: 0,
          totalAvgTimeBetweenGoals: 0,
          totalAvgTimeBetweenGoalsAgainst: 0,
          isWinner: true,
          index: 0
        }
      ])
    ),
    winnerTeamKey: 'a-b',
    loserTeamKey: 'c-d'
  }
}

describe('computePlayerHandicap', () => {
  it('returns 0 for a player with no games', () => {
    expect(computePlayerHandicap('x', [])).toBe(0)
  })

  it('returns a NEGATIVE handicap for a strong player (better than 1500)', () => {
    const games = [makeGame('g1', 1, { strong: 1700, other: 1500 })]
    expect(computePlayerHandicap('strong', games)).toBeLessThan(0)
  })

  it('returns a POSITIVE handicap for a weak player (worse than 1500)', () => {
    const games = [makeGame('g1', 1, { weak: 1300, other: 1500 })]
    expect(computePlayerHandicap('weak', games)).toBeGreaterThan(0)
  })

  it('averages the best half of the last 10 games (best-half weighting)', () => {
    // 12 games: the player's ELO climbs late. Best half of last 10 should
    // reflect the high late ELOs, not the early lows.
    const games = Array.from({ length: 12 }, (_, i) => {
      const elo = 1500 + i * 10
      return makeGame(`g${i}`, i + 1, { p: elo, other: 1500 })
    })

    const handicap = computePlayerHandicap('p', games)
    // Peak ELO = 1610, best half of last 10 ≈ top-5 (1580..1610) → ability ≈ 1598 → -0.98 → -1
    expect(handicap).toBe(-1)
  })
})

describe('computeHandicaps', () => {
  it('maps every player with games to a handicap', () => {
    const games = [
      makeGame('g1', 1, { a: 1600, b: 1400, c: 1500, d: 1500 }),
      makeGame('g2', 2, { a: 1620, b: 1390, c: 1510, d: 1490 })
    ]
    const handicaps = computeHandicaps(games)
    expect(handicaps.size).toBe(4)
    expect(handicaps.get('a')).toBeDefined()
    expect(handicaps.get('b')).toBeDefined()
  })
})

describe('teamHandicap / matchAllowance', () => {
  const handicaps = new Map([
    ['strong', -2],
    ['average', 0],
    ['weak', 3]
  ])

  it('averages two player handicaps for a team', () => {
    expect(teamHandicap(['strong', 'average'], handicaps)).toBe(-1)
    expect(teamHandicap(['weak', 'weak'], handicaps)).toBe(3)
  })

  it('gives the weaker team the goal head start (positive = Team A receives)', () => {
    // Team A: strong(-2) + average(0) = -1; Team B: weak(3)+weak(3) = 3
    // gap = -1 - 3 = -4 → negative → Team B (weaker) receives 4 goals
    const allowance = matchAllowance(
      ['strong', 'average'],
      ['weak', 'weak'],
      handicaps
    )
    expect(allowance).toBe(-4)
  })

  it('returns 0 for equal teams', () => {
    expect(
      matchAllowance(['average', 'average'], ['average', 'average'], handicaps)
    ).toBe(0)
  })
})