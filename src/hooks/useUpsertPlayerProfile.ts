import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'

export type UpsertPlayerProfileInput = {
  readonly display_name: string
  readonly avatar_url: string | null
  readonly company_id?: string | null
}

type UpsertPlayerProfileRow = UpsertPlayerProfileInput & {
  readonly id: string
}

class ForbiddenPlayerProfileKeyError extends Error {
  readonly keys: readonly string[]

  constructor(keys: readonly string[]) {
    super(`Player profile writes cannot include keys: ${keys.join(', ')}`)
    this.name = 'ForbiddenPlayerProfileKeyError'
    this.keys = keys
  }
}

class MissingProfileUserError extends Error {
  constructor() {
    super('Cannot upsert a player profile without an authenticated Supabase user')
    this.name = 'MissingProfileUserError'
  }
}

/**
 * Upserts the current user's public profile and rejects auth metadata leakage.
 * SECURITY: this is the only player-row write path; never copy email, uid,
 * photoURL, or other auth metadata into public application tables.
 */
export function useUpsertPlayerProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: upsertPlayerProfile,
    onSuccess: async (playerId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.games }),
        queryClient.invalidateQueries({ queryKey: queryKeys.players }),
        queryClient.invalidateQueries({ queryKey: queryKeys.playerDetail(playerId) })
      ])
    }
  })
}

async function upsertPlayerProfile(
  input: UpsertPlayerProfileInput
): Promise<string> {
  rejectForbiddenProfileInputKeys(input)

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError) {
    throw authError
  }

  if (!user) {
    throw new MissingProfileUserError()
  }

  const baseRow: UpsertPlayerProfileRow = {
    id: user.id,
    display_name: input.display_name,
    avatar_url: input.avatar_url
  }
  const row: UpsertPlayerProfileRow =
    input.company_id === undefined
      ? baseRow
      : { ...baseRow, company_id: input.company_id }

  rejectForbiddenProfileRowKeys(row)

  const { error } = await supabase.from('players').upsert(row)

  if (error) {
    throw error
  }

  return row.id
}

function rejectForbiddenProfileInputKeys(
  input: UpsertPlayerProfileInput
): void {
  const forbiddenKeys = Object.keys(input).filter(
    (key) =>
      key !== 'display_name' && key !== 'avatar_url' && key !== 'company_id'
  )

  if (forbiddenKeys.length > 0) {
    throw new ForbiddenPlayerProfileKeyError(forbiddenKeys)
  }
}

function rejectForbiddenProfileRowKeys(row: UpsertPlayerProfileRow): void {
  const forbiddenKeys = Object.keys(row).filter(
    (key) =>
      key !== 'id' &&
      key !== 'display_name' &&
      key !== 'avatar_url' &&
      key !== 'company_id'
  )

  if (forbiddenKeys.length > 0) {
    throw new ForbiddenPlayerProfileKeyError(forbiddenKeys)
  }
}
