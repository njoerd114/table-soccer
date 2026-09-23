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
  playerDetail: (id: string) => ['players', 'detail', id]
} as const
