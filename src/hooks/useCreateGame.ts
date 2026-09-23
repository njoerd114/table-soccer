import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { TimelineEvent } from '../domain/types'
import type { GameInsertRow } from '../lib/database.types'
import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'

export type CreateGameInput = {
  readonly players: [string, string, string, string]
  readonly scores: [number, number, number, number, number, number, number, number]
  readonly duration: number
  readonly timeline: TimelineEvent[]
  readonly company_id: string
  readonly opponent_company_id?: string | null
  readonly season_id?: string | null
  readonly league_id?: string | null
}

type InsertGameRow = GameInsertRow

class MissingAuthenticatedUserError extends Error {
  constructor() {
    super('Cannot create a game without an authenticated Supabase user')
    this.name = 'MissingAuthenticatedUserError'
  }
}

/**
 * Persists finished games while keeping auth PII out of public game rows.
 */
export function useCreateGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createGame,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.games })
    }
  })
}

async function createGame(input: CreateGameInput): Promise<void> {
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

  const row: InsertGameRow = {
    startdate: Date.now(),
    duration: input.duration,
    players: input.players,
    scores: input.scores,
    timeline: input.timeline,
    company_id: input.company_id,
    opponent_company_id: input.opponent_company_id ?? null,
    season_id: input.season_id ?? null,
    league_id: input.league_id ?? null,
    created_by: user.id
  }

  const { error } = await supabase.from('games').insert(row)

  if (error) {
    throw error
  }
}
