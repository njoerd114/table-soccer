import type { ReactNode } from 'react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlayerProfile } from '../domain/types'
import { usePlayers } from './usePlayers'

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

describe('usePlayers', () => {
  beforeEach(() => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'auth-user-1' } } }
    })
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
    supabaseMock.from.mockReset()
  })

  it('returns PlayerProfile rows when Supabase returns ordered players', async () => {
    const rows: PlayerProfile[] = [
      {
        id: 'player-a',
        display_name: 'Ada',
        avatar_url: null,
        company_id: null,
        created_at: '2026-01-01T00:00:00Z'
      }
    ]
    const order = vi.fn(async () => ({ data: rows, error: null }))
    const select = vi.fn(() => ({ order }))

    supabaseMock.from.mockReturnValue({ select })

    const { result } = renderHook(() => usePlayers(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabaseMock.from).toHaveBeenCalledWith('players')
    expect(select).toHaveBeenCalledWith('*')
    expect(order).toHaveBeenCalledWith('display_name')
    expect(result.current.data).toEqual(rows)
  })
})
