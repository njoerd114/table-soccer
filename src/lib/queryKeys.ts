/**
 * Typed TanStack Query key factory for Supabase-backed app data.
 */
export const queryKeys = {
  players: ['players'],
  games: ['games'],
  companies: ['companies'],
  companyMembers: ['company-members'],
  seasons: ['seasons'],
  leagues: ['leagues'],
  isSuperAdmin: ['is-super-admin'],
  playerDetail: (id: string) => ['players', 'detail', id]
} as const
