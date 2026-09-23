import type { ReactNode } from 'react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Season } from '../domain/types'
import { useSeasons } from './useSeasons'

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

describe('useSeasons', () => {
  beforeEach(() => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'auth-user-1' } } }
    })
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
    supabaseMock.from.mockReset()
  })

  it('returns seasons filtered by company and ordered by start date descending', async () => {
    const rows: Season[] = [
      {
        id: 'season-1',
        company_id: 'company-1',
        name: 'Winter 2026',
        starts_on: '2026-01-01',
        ends_on: null,
        created_by: 'auth-user-1'
      }
    ]
    const order = vi.fn(async () => ({ data: rows, error: null }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))

    supabaseMock.from.mockReturnValue({ select })

    const { result } = renderHook(() => useSeasons('company-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabaseMock.from).toHaveBeenCalledWith('seasons')
    expect(select).toHaveBeenCalledWith('*')
    expect(eq).toHaveBeenCalledWith('company_id', 'company-1')
    expect(order).toHaveBeenCalledWith('starts_on', { ascending: false })
    expect(result.current.data).toEqual(rows)
  })
})
