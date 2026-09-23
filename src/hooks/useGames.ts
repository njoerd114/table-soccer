import { useQuery } from '@tanstack/react-query'

import { transform } from '../domain/transform'
import type { AppData, GameRecord } from '../domain/types'
import type { GameRow } from '../lib/database.types'
import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { fetchPlayers } from './usePlayers'

export type GameFilters = {
  readonly seasonId?: string | null
  readonly leagueId?: string | null
  readonly companyId?: string
}

type RowLengthIssue = {
  readonly rowId: string
  readonly field: 'players' | 'scores'
  readonly expectedLength: number
  readonly actualLength: number
}

class InvalidGameRowShapeError extends Error {
  readonly issue: RowLengthIssue

  constructor(issue: RowLengthIssue) {
    super(
      `Game ${issue.rowId} has ${issue.actualLength} ${issue.field}; expected ${issue.expectedLength}`
    )
    this.name = 'InvalidGameRowShapeError'
    this.issue = issue
  }
}

/**
 * Reads recent games and derives AppData through the frozen domain transform.
 * Only runs when a session exists — anonymous requests are denied by RLS.
 */
export function useGames(filters?: GameFilters) {
  const { user } = useAuth()

  return useQuery({
    queryKey: filters ? [...queryKeys.games, filters] : queryKeys.games,
    queryFn: () => fetchGames(filters),
    enabled: user !== null
  })
}

export async function fetchGames(filters?: GameFilters): Promise<AppData> {
  const [players, games] = await Promise.all([
    fetchPlayers(),
    fetchGameRows(filters)
  ])

  return transform({
    players,
    games: games.map(toGameRecord)
  })
}

async function fetchGameRows(filters?: GameFilters): Promise<GameRow[]> {
  let query = supabase
    .from('games')
    .select('*')

  if (filters?.companyId !== undefined) {
    query = query.eq('company_id', filters.companyId)
  }

  if (filters?.seasonId !== undefined && filters.seasonId !== null) {
    query = query.eq('season_id', filters.seasonId)
  } else if (filters?.seasonId === null) {
    query = query.is('season_id', null)
  }

  if (filters?.leagueId !== undefined && filters.leagueId !== null) {
    query = query.eq('league_id', filters.leagueId)
  } else if (filters?.leagueId === null) {
    query = query.is('league_id', null)
  }

  const { data, error } = await query
    .order('startdate', { ascending: false })
    .limit(200)

  if (error) {
    throw error
  }

  return data ?? []
}

function toGameRecord(row: GameRow): GameRecord {
  return {
    id: row.id,
    startdate: row.startdate,
    duration: row.duration,
    players: toPlayerTuple(row),
    scores: toScoreTuple(row),
    timeline: row.timeline.map((event) => ({ ...event })),
    company_id: row.company_id,
    opponent_company_id: row.opponent_company_id,
    season_id: row.season_id,
    league_id: row.league_id,
    created_at: row.created_at
  }
}

function toPlayerTuple(row: GameRow): GameRecord['players'] {
  const [first, second, third, fourth] = row.players

  if (
    row.players.length !== 4 ||
    first === undefined ||
    second === undefined ||
    third === undefined ||
    fourth === undefined
  ) {
    throw new InvalidGameRowShapeError({
      rowId: row.id,
      field: 'players',
      expectedLength: 4,
      actualLength: row.players.length
    })
  }

  return [first, second, third, fourth]
}

function toScoreTuple(row: GameRow): GameRecord['scores'] {
  const [first, second, third, fourth, fifth, sixth, seventh, eighth] =
    row.scores

  if (
    row.scores.length !== 8 ||
    first === undefined ||
    second === undefined ||
    third === undefined ||
    fourth === undefined ||
    fifth === undefined ||
    sixth === undefined ||
    seventh === undefined ||
    eighth === undefined
  ) {
    throw new InvalidGameRowShapeError({
      rowId: row.id,
      field: 'scores',
      expectedLength: 8,
      actualLength: row.scores.length
    })
  }

  return [first, second, third, fourth, fifth, sixth, seventh, eighth]
}
