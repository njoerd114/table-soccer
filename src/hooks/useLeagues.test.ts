import type { ReactNode } from 'react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { League } from '../domain/types'
import { useLeagues } from './useLeagues'

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

describe('useLeagues', () => {
  beforeEach(() => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'auth-user-1' } } }
    })
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
    supabaseMock.from.mockReset()
  })

  it('returns leagues filtered by company and ordered by name', async () => {
    const rows: League[] = [
      {
        id: 'league-1',
        company_id: 'company-1',
        name: 'Bundesliga',
        game_mode: 'classic',
        created_by: 'auth-user-1'
      }
    ]
    const order = vi.fn(async () => ({ data: rows, error: null }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))

    supabaseMock.from.mockReturnValue({ select })

    const { result } = renderHook(() => useLeagues('company-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabaseMock.from).toHaveBeenCalledWith('leagues')
    expect(select).toHaveBeenCalledWith('*')
    expect(eq).toHaveBeenCalledWith('company_id', 'company-1')
    expect(order).toHaveBeenCalledWith('name')
    expect(result.current.data).toEqual(rows)
  })
})
