import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { League } from '../domain/types'
import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type CreateLeagueInput = {
  readonly companyId: string
  readonly name: string
}

class MissingAuthenticatedUserError extends Error {
  constructor() {
    super('Cannot create a league without an authenticated Supabase user')
    this.name = 'MissingAuthenticatedUserError'
  }
}

/**
 * Reads leagues for one company in display-name order.
 */
export function useLeagues(companyId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...queryKeys.leagues, companyId],
    queryFn: () => fetchLeagues(companyId),
    enabled: user !== null
  })
}

export async function fetchLeagues(companyId: string): Promise<League[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

/**
 * Creates a company-scoped league for grouping games.
 */
export function useCreateLeague() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createLeague,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leagues })
    }
  })
}

async function createLeague(input: CreateLeagueInput): Promise<void> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError) {
    throw authError
  }

  if (!user) {
    throw new MissingAuthenticatedUserError()
  }

  const { error } = await supabase.from('leagues').insert({
    company_id: input.companyId,
    name: input.name,
    created_by: user.id
  })

  if (error) {
    throw error
  }
}
