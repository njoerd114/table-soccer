import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Season } from '../domain/types'
import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type CreateSeasonInput = {
  readonly companyId: string
  readonly name: string
  readonly startsOn: string
  readonly endsOn?: string | null
}

class MissingAuthenticatedUserError extends Error {
  constructor() {
    super('Cannot create a season without an authenticated Supabase user')
    this.name = 'MissingAuthenticatedUserError'
  }
}

/**
 * Reads seasons for one company, newest competitive period first.
 */
export function useSeasons(companyId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...queryKeys.seasons, companyId],
    queryFn: () => fetchSeasons(companyId),
    enabled: user !== null
  })
}

export async function fetchSeasons(companyId: string): Promise<Season[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('company_id', companyId)
    .order('starts_on', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

/**
 * Creates a company-scoped season for filtering games and leaderboards.
 */
export function useCreateSeason() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSeason,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.seasons })
    }
  })
}

async function createSeason(input: CreateSeasonInput): Promise<void> {
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

  const { error } = await supabase.from('seasons').insert({
    company_id: input.companyId,
    name: input.name,
    starts_on: input.startsOn,
    ends_on: input.endsOn ?? null,
    created_by: user.id
  })

  if (error) {
    throw error
  }
}
