import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/** Whether the signed-in user is a platform super admin (server-checked, never client-derived). */
export function useIsSuperAdmin() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.isSuperAdmin,
    queryFn: fetchIsSuperAdmin,
    enabled: user !== null
  })
}

async function fetchIsSuperAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_i_super_admin')

  if (error) {
    throw error
  }

  return data ?? false
}
