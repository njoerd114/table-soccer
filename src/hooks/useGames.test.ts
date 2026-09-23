import type { ReactNode } from 'react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POSITION_STRIKER } from '../domain/constants'
import type { PlayerProfile } from '../domain/types'
import { useGames } from './useGames'

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn()
  },
  from: vi.fn()
}))

vi.mock('../lib/supabase', () => ({
  supabase: supabaseMock
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    )
  }
}

describe('useGames', () => {
  beforeEach(() => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'auth-user-1' } } }
    })
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
    supabaseMock.from.mockReset()
  })

  it('returns transformed AppData when Supabase returns games and players', async () => {
    const players: PlayerProfile[] = ['p1', 'p2', 'p3', 'p4'].map((id) => ({
      id,
      display_name: id.toUpperCase(),
      avatar_url: null,
      company_id: null,
      created_at: '2026-01-01T00:00:00Z'
    }))
    const games = [
      {
        id: 'game-1',
        startdate: 1_700_000_000_000,
        duration: 90,
        players: ['p1', 'p2', 'p3', 'p4'],
        scores: [6, 0, 0, 0, 0, 0, 0, 0],
        timeline: [
          {
            player_id: 'p1',
            index: 0,
            position: POSITION_STRIKER,
            time: 12,
            own_goal: false
          }
        ],
        company_id: 'company-1',
        opponent_company_id: null,
        season_id: 'season-1',
        league_id: 'league-1',
        created_at: '2026-01-01T00:02:00Z',
        created_by: 'auth-user-1'
      }
    ]
    const playersOrder = vi.fn(async () => ({ data: players, error: null }))
    const gamesLimit = vi.fn(async () => ({ data: games, error: null }))
    const gamesOrder = vi.fn(() => ({ limit: gamesLimit }))

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'players') {
        return { select: vi.fn(() => ({ order: playersOrder })) }
      }

      return { select: vi.fn(() => ({ order: gamesOrder })) }
    })

    const { result } = renderHook(() => useGames(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(gamesOrder).toHaveBeenCalledWith('startdate', { ascending: false })
    expect(gamesLimit).toHaveBeenCalledWith(200)
    expect(result.current.data?.games[0]?.id).toBe('game-1')
    expect(result.current.data?.games[0]?.winnerScore).toBe(6)
    expect(result.current.data?.players).toHaveLength(4)
  })

  it('applies season, league, and company filters before ordering games', async () => {
    const players: PlayerProfile[] = ['p1', 'p2', 'p3', 'p4'].map((id) => ({
      id,
      display_name: id.toUpperCase(),
      avatar_url: null,
      company_id: 'company-1',
      created_at: '2026-01-01T00:00:00Z'
    }))
    const playersOrder = vi.fn(async () => ({ data: players, error: null }))
    const gamesLimit = vi.fn(async () => ({ data: [], error: null }))
    const gamesOrder = vi.fn(() => ({ limit: gamesLimit }))
    const gameQuery = { eq: vi.fn(), order: gamesOrder }
    gameQuery.eq.mockReturnValue(gameQuery)

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'players') {
        return { select: vi.fn(() => ({ order: playersOrder })) }
      }

      return { select: vi.fn(() => gameQuery) }
    })

    const { result } = renderHook(
      () =>
        useGames({
          companyId: 'company-1',
          seasonId: 'season-1',
          leagueId: 'league-1'
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(gameQuery.eq).toHaveBeenNthCalledWith(1, 'company_id', 'company-1')
    expect(gameQuery.eq).toHaveBeenNthCalledWith(2, 'season_id', 'season-1')
    expect(gameQuery.eq).toHaveBeenNthCalledWith(3, 'league_id', 'league-1')
    expect(gamesOrder).toHaveBeenCalledWith('startdate', { ascending: false })
  })
})
