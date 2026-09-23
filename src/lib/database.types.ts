import type { GameAnnotation, TimelineEvent } from '../domain/types'

export type CompanyRow = {
  readonly id: string
  readonly name: string
  readonly created_by: string
  readonly created_at: string
}

export type CompanyInsertRow = {
  readonly id?: string
  readonly name: string
  readonly created_by: string
  readonly created_at?: string
}

export type CompanyUpdateRow = Partial<CompanyInsertRow>

export type CompanyMemberRole = 'owner' | 'admin' | 'member'

export type CompanyMemberRow = {
  readonly id: string
  readonly company_id: string
  readonly user_id: string
  readonly role: CompanyMemberRole
  readonly created_at: string
}

export type CompanyMemberInsertRow = {
  readonly id?: string
  readonly company_id: string
  readonly user_id: string
  readonly role?: CompanyMemberRole
  readonly created_at?: string
}

export type CompanyMemberUpdateRow = Partial<CompanyMemberInsertRow>

export type SeasonRow = {
  readonly id: string
  readonly company_id: string
  readonly name: string
  readonly starts_on: string
  readonly ends_on: string | null
  readonly created_by: string
  readonly created_at: string
}

export type SeasonInsertRow = {
  readonly id?: string
  readonly company_id: string
  readonly name: string
  readonly starts_on: string
  readonly ends_on?: string | null
  readonly created_by: string
  readonly created_at?: string
}

export type SeasonUpdateRow = Partial<SeasonInsertRow>

export type LeagueRow = {
  readonly id: string
  readonly company_id: string
  readonly name: string
  readonly game_mode: 'classic' | 'advanced'
  readonly created_by: string
  readonly created_at: string
}

export type LeagueInsertRow = {
  readonly id?: string
  readonly company_id: string
  readonly name: string
  readonly game_mode?: 'classic' | 'advanced'
  readonly created_by: string
  readonly created_at?: string
}

export type LeagueUpdateRow = Partial<LeagueInsertRow>

export type PlayerRow = {
  readonly id: string
  readonly display_name: string
  readonly avatar_url: string | null
  readonly is_public: boolean
  readonly company_id: string | null
  readonly created_at: string
}

export type PlayerInsertRow = {
  readonly id?: string
  readonly display_name: string
  readonly avatar_url?: string | null
  readonly is_public?: boolean
  readonly company_id?: string | null
  readonly created_at?: string
}

export type PlayerUpdateRow = Partial<PlayerInsertRow>

export type GameRow = {
  readonly id: string
  readonly startdate: number
  readonly duration: number
  readonly players: readonly string[]
  readonly scores: readonly number[]
  readonly timeline: readonly TimelineEvent[]
  readonly annotations: readonly GameAnnotation[]
  readonly company_id: string | null
  readonly opponent_company_id: string | null
  readonly season_id: string | null
  readonly league_id: string | null
  readonly created_at: string
  readonly created_by: string
}

export type GameInsertRow = {
  readonly id?: string
  readonly startdate: number
  readonly duration: number
  readonly players: readonly string[]
  readonly scores: readonly number[]
  readonly timeline: readonly TimelineEvent[]
  readonly annotations?: readonly GameAnnotation[]
  readonly company_id: string
  readonly opponent_company_id?: string | null
  readonly season_id?: string | null
  readonly league_id?: string | null
  readonly created_at?: string
  readonly created_by: string
}

export type GameUpdateRow = Partial<GameInsertRow>

/**
 * Supabase database contract for the public, PII-free application tables.
 */
export type Database = {
  readonly public: {
    readonly Tables: {
      readonly companies: {
        readonly Row: CompanyRow
        readonly Insert: CompanyInsertRow
        readonly Update: CompanyUpdateRow
        readonly Relationships: []
      }
      readonly company_members: {
        readonly Row: CompanyMemberRow
        readonly Insert: CompanyMemberInsertRow
        readonly Update: CompanyMemberUpdateRow
        readonly Relationships: []
      }
      readonly seasons: {
        readonly Row: SeasonRow
        readonly Insert: SeasonInsertRow
        readonly Update: SeasonUpdateRow
        readonly Relationships: []
      }
      readonly leagues: {
        readonly Row: LeagueRow
        readonly Insert: LeagueInsertRow
        readonly Update: LeagueUpdateRow
        readonly Relationships: []
      }
      readonly players: {
        readonly Row: PlayerRow
        readonly Insert: PlayerInsertRow
        readonly Update: PlayerUpdateRow
        readonly Relationships: []
      }
      readonly games: {
        readonly Row: GameRow
        readonly Insert: GameInsertRow
        readonly Update: GameUpdateRow
        readonly Relationships: []
      }
    }
    readonly Views: Record<string, never>
    readonly Functions: {
      readonly create_company: {
        readonly Args: { readonly company_name: string }
        readonly Returns: CompanyRow
      }
      readonly am_i_super_admin: {
        readonly Args: Record<string, never>
        readonly Returns: boolean
      }
    }
    readonly Enums: Record<string, never>
    readonly CompositeTypes: Record<string, never>
  }
}
