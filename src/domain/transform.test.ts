import { describe, expect, it } from 'vitest'

import fixture from '../test/fixtures/dataMock.json'
import {
  POSITION_DEFENSE,
  POSITION_KEEPER,
  POSITION_MIDFIELD,
  POSITION_STRIKER,
  type Position
} from './constants'
import type { GameRecord, PlayerProfile } from './types'
import { transform } from './transform'

type LegacyFixtureGameTuple = [
  string,
  number,
  number,
  [string, string, string, string],
  [number, number, number, number, number, number, number, number],
  Array<{
    id: string
    index: number
    position: string
    time: number
    ownGoal?: boolean
  }>
]

type LegacyFixture = {
  games: Record<string, LegacyFixtureGameTuple>
  players: Record<string, { id: string; name: string }>
}

type TimelineBag = {
  goalTimings: number[]
  goalAgainstTimings: number[]
}

describe('transform', () => {
  const legacyFixture = fixture as unknown as LegacyFixture
  const transformedData = transform(legacyFixture)

  it('ports legacy game transform expectations', () => {
    expect(transformedData.games.length).toBe(4)
    const game1 = transformedData.games[0]
    expect(game1).toBeDefined()
    if (!game1) {
      return
    }

    expect(game1.id).toBe('BJZf3fuQb')
    expect(game1.startdate).toEqual(new Date(1498061833063))
    expect(game1.duration).toBe(451)
    expect(Object.keys(game1.players).length).toBe(4)

    const p1 = game1.players.msb as TimelineBag | undefined
    const p2 = game1.players.mpn as TimelineBag | undefined
    const p3 = game1.players.jth as TimelineBag | undefined
    const p4 = game1.players.chr as TimelineBag | undefined

    expect(game1.players.mpn?.goals).toBe(1)
    expect(game1.players.msb?.goals).toBe(5)
    expect(game1.players.jth?.goals).toBe(1)
    expect(game1.players.chr?.goals).toBe(2)

    expect(p1?.goalTimings.length).toBe(5)
    expect(p2?.goalTimings.length).toBe(0)
    expect(p3?.goalTimings.length).toBe(1)
    expect(p4?.goalTimings.length).toBe(0)

    expect(p1?.goalTimings[0]).toBe(206)
    expect(p3?.goalTimings[0]).toBe(416)

    expect(p1?.goalAgainstTimings.length).toBe(0)
    expect(p2?.goalAgainstTimings.length).toBe(6)
    expect(p3?.goalAgainstTimings.length).toBe(0)
    expect(p4?.goalAgainstTimings.length).toBe(3)

    expect(p2?.goalAgainstTimings[0]).toBe(206)
    expect(p4?.goalAgainstTimings[0]).toBe(91)
  })

  it('accepts modern array input while preserving output parity', () => {
    const games: GameRecord[] = Object.values(legacyFixture.games).map(
      ([id, startdate, duration, players, scores, timeline]) => ({
        id,
        startdate,
        duration,
        players,
        scores,
        timeline: timeline.map((event) => ({
          player_id: event.id,
          index: event.index,
          position: normalizeFixturePosition(event.position),
          time: event.time,
          own_goal: event.ownGoal ?? false
        })),
        company_id: null,
        opponent_company_id: null,
        season_id: null,
        league_id: null,
        created_at: ''
      })
    )

    const players: PlayerProfile[] = Object.values(legacyFixture.players).map(
      (player) => ({
        id: player.id,
        display_name: player.name,
        avatar_url: null,
        company_id: null,
        created_at: ''
      })
    )

    const transformedFromArray = transform({ games, players })

    expect(transformedFromArray).toEqual(transformedData)
  })

  it('sets placementFinished once minimum games is reached', () => {
    const games: GameRecord[] = new Array(10).fill(0).map((_, index) => ({
      id: `g-${index}`,
      startdate: 1_700_000_000_000 + index,
      duration: 60,
      players: ['a', 'b', 'c', 'd'],
      scores: [6, 0, 0, 0, 0, 0, 0, 0],
      timeline: [
        {
          player_id: 'a',
          index: 0,
          position: 'STRIKER',
          time: 10,
          own_goal: false
        }
      ],
      company_id: null,
      opponent_company_id: null,
      season_id: null,
      league_id: null,
      created_at: ''
    }))

    const players: PlayerProfile[] = ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      display_name: id,
      avatar_url: null,
      company_id: null,
      created_at: ''
    }))

    const transformed = transform({ games, players })
    const playerA = transformed.players.find((player) => player.id === 'a')

    expect(playerA?.placementFinished).toBe(true)
  })
})

function normalizeFixturePosition(position: string): Position {
  if (position === 'MIDFILED') {
    return POSITION_MIDFIELD
  }

  if (position === POSITION_KEEPER) {
    return POSITION_KEEPER
  }

  if (position === POSITION_DEFENSE) {
    return POSITION_DEFENSE
  }

  if (position === POSITION_MIDFIELD) {
    return POSITION_MIDFIELD
  }

  return POSITION_STRIKER
}
