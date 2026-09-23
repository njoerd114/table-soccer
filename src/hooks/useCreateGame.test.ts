import type { ReactNode } from 'react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POSITION_STRIKER } from '../domain/constants'
import type { TimelineEvent } from '../domain/types'
import { useCreateGame } from './useCreateGame'

type InsertGameTestRow = {
  readonly startdate: number
  readonly duration: number
  readonly players: [string, string, string, string]
  readonly scores: [number, number, number, number, number, number, number, number]
  readonly timeline: TimelineEvent[]
  readonly company_id: string
  readonly opponent_company_id?: string | null
  readonly season_id?: string | null
  readonly league_id?: string | null
  readonly created_by: string
}

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn()
}))

vi.mock('../lib/supabase', () => ({
  supabase: supabaseMock
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  })

  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    )
  }
}

describe('useCreateGame', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset()
    supabaseMock.from.mockReset()
  })

  it('inserts a GameRecord-shaped row without PII keys', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const insert = vi.fn(async (_row: InsertGameTestRow) => ({
      data: null,
      error: null
    }))

    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null
    })
    supabaseMock.from.mockReturnValue({ insert })

    const { result } = renderHook(() => useCreateGame(), {
      wrapper: createWrapper()
    })

    result.current.mutate({
      players: ['p1', 'p2', 'p3', 'p4'],
      scores: [6, 0, 0, 0, 0, 0, 0, 0],
      duration: 90,
      company_id: 'company-1',
      opponent_company_id: 'company-2',
      season_id: 'season-1',
      league_id: 'league-1',
      timeline: [
        {
          player_id: 'p1',
          index: 0,
          position: POSITION_STRIKER,
          time: 12,
          own_goal: false
        }
      ]
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(insert).toHaveBeenCalledTimes(1)
    const row = insert.mock.calls[0]?.[0]

    if (!row) {
      throw new Error('Expected useCreateGame to insert one row')
    }

    expect(row).toEqual({
      startdate: 1_767_225_600_000,
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
      opponent_company_id: 'company-2',
      season_id: 'season-1',
      league_id: 'league-1',
      created_by: 'auth-user-1'
    })
    expect(row).not.toHaveProperty('id')
    expect(row).not.toHaveProperty('email')
    expect(row).not.toHaveProperty('uid')
    expect(row).not.toHaveProperty('photoURL')
  })
})
