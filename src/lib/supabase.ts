import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loudly in dev — never silently degrade to anonymous access.
  throw new Error(
    'Missing Supabase env: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  )
}

/**
 * Supabase client.
 * Security note: the anon key is public by design — all access control is
 * enforced server-side by Postgres RLS (see supabase/migrations/0002_rls.sql).
 * The app NEVER reads or writes PII (email/uid) into application tables.
 */
export const supabase = createClient<Database>(url, anonKey)
