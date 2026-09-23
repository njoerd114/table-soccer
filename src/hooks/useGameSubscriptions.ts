import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'

/**
 * Connects Supabase realtime table changes to TanStack Query invalidation.
 */
export function useGameSubscriptions(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const invalidateAppData = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.games })
      void queryClient.invalidateQueries({ queryKey: queryKeys.players })
    }
    const channel = supabase
      .channel('games-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        invalidateAppData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        invalidateAppData
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])
}
