import type { ReactNode } from 'react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Company } from '../domain/types'
import { useCompanies, useCreateCompany } from './useCompanies'

type InsertCompanyTestRow = {
  readonly name: string
  readonly created_by: string
}

type InsertCompanyMemberTestRow = {
  readonly company_id: string
  readonly user_id: string
  readonly role: 'owner'
}

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
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

describe('useCompanies', () => {
  beforeEach(() => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'auth-user-1' } } }
    })
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
    supabaseMock.auth.getUser.mockReset()
    supabaseMock.from.mockReset()
  })

  it('returns Company rows when Supabase returns ordered companies', async () => {
    const rows: Company[] = [
      {
        id: 'company-1',
        name: 'Acme',
        created_by: 'auth-user-1',
        created_at: '2026-01-01T00:00:00Z'
      }
    ]
    const order = vi.fn(async () => ({ data: rows, error: null }))
    const select = vi.fn(() => ({ order }))

    supabaseMock.from.mockReturnValue({ select })

    const { result } = renderHook(() => useCompanies(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabaseMock.from).toHaveBeenCalledWith('companies')
    expect(select).toHaveBeenCalledWith('*')
    expect(order).toHaveBeenCalledWith('name')
    expect(result.current.data).toEqual(rows)
  })

  it('inserts companies then owner company_members row when creating a company', async () => {
    const insertedCompany: Company = {
      id: 'company-1',
      name: 'Acme',
      created_by: 'auth-user-1',
      created_at: '2026-01-01T00:00:00Z'
    }
    const insertOrder: string[] = []
    const companiesSingle = vi.fn(async () => ({
      data: insertedCompany,
      error: null
    }))
    const companiesSelect = vi.fn(() => ({ single: companiesSingle }))
    const companiesInsert = vi.fn((_row: InsertCompanyTestRow) => {
      insertOrder.push('companies')
      return { select: companiesSelect }
    })
    const membersInsert = vi.fn(async (_row: InsertCompanyMemberTestRow) => {
      insertOrder.push('company_members')
      return { data: null, error: null }
    })

    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null
    })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'companies') {
        return { insert: companiesInsert }
      }

      return { insert: membersInsert }
    })

    const { result } = renderHook(() => useCreateCompany(), {
      wrapper: createWrapper()
    })

    result.current.mutate({ name: 'Acme' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(companiesInsert).toHaveBeenCalledWith({
      name: 'Acme',
      created_by: 'auth-user-1'
    })
    expect(membersInsert).toHaveBeenCalledWith({
      company_id: 'company-1',
      user_id: 'auth-user-1',
      role: 'owner'
    })
    expect(insertOrder).toEqual(['companies', 'company_members'])
  })
})
