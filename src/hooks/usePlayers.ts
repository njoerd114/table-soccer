import { useQuery } from '@tanstack/react-query'

import type { PlayerProfile } from '../domain/types'
import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Reads public player profiles from Supabase for UI lists and transforms.
 * Only runs when a session exists — anonymous requests are denied by RLS.
 */
export function usePlayers() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.players,
    queryFn: fetchPlayers,
    enabled: user !== null
  })
}

export async function fetchPlayers(): Promise<PlayerProfile[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('display_name')

  if (error) {
    throw error
  }

  return data ?? []
}
