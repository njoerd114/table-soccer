import type { ReactNode } from 'react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Company } from '../domain/types'
import { useCompanies, useCreateCompany } from './useCompanies'

type CreateCompanyRpcArgs = {
  readonly company_name: string
}

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    getUser: vi.fn()
  },
  from: vi.fn(),
  rpc: vi.fn()
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
    supabaseMock.rpc.mockReset()
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

  it('calls the create_company RPC atomically instead of two separate inserts', async () => {
    const insertedCompany: Company = {
      id: 'company-1',
      name: 'Acme',
      created_by: 'auth-user-1',
      created_at: '2026-01-01T00:00:00Z'
    }
    const rpcSingle = vi.fn(async () => ({ data: insertedCompany, error: null }))
    const rpcCall = vi.fn((_fn: string, _args: CreateCompanyRpcArgs) => ({
      single: rpcSingle
    }))

    supabaseMock.rpc.mockImplementation(rpcCall)

    const { result } = renderHook(() => useCreateCompany(), {
      wrapper: createWrapper()
    })

    result.current.mutate({ name: 'Acme' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_company', {
      company_name: 'Acme'
    })
    expect(rpcSingle).toHaveBeenCalled()
    expect(result.current.data).toEqual(insertedCompany)
  })
})
