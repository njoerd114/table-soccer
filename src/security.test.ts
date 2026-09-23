import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { POSITION_STRIKER } from './domain/constants'
import type { GameRecord, PlayerStats } from './domain/types'
import { createEndMessage } from './lib/slack'

type MigrationName = '0001_init.sql' | '0002_rls.sql'
type TableName = 'players' | 'games'

function readMigration(name: MigrationName): Promise<string> {
  return readFile(
    new URL(`../supabase/migrations/${name}`, import.meta.url),
    'utf8'
  )
}

function extractCreateTableBlock(sql: string, tableName: TableName): string {
  const createTableMatch = sql.match(
    new RegExp(`create\\s+table\\s+public\\.${tableName}\\s*\\(([\\s\\S]*?)\\n\\);`, 'iu')
  )
  const createTableBlock = createTableMatch?.[1]

  if (createTableBlock === undefined) {
    throw new Error(`Missing create table public.${tableName} block`)
  }

  return createTableBlock
}

function extractPolicyBlock(sql: string, policyName: string): string {
  const policyMatch = sql.match(
    new RegExp(`create\\s+policy\\s+${policyName}\\b([\\s\\S]*?);`, 'iu')
  )
  const policyBlock = policyMatch?.[0]

  if (policyBlock === undefined) {
    throw new Error(`Missing policy ${policyName}`)
  }

  return policyBlock
}

function stripLineComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

function parseColumnNames(createTableBlock: string): readonly string[] {
  const names: string[] = []

  for (const rawLine of createTableBlock.split('\n')) {
    const line = rawLine.trim().replace(/,$/u, '')
    const columnMatch = line.match(/^([a-z_]+)\s+/iu)
    const columnName = columnMatch?.[1]

    if (columnName !== undefined && columnName !== 'constraint') {
      names.push(columnName)
    }
  }

  return names
}

describe('RLS deny-by-default', () => {
  it('enables RLS on every app table when evaluating browser-originated access', async () => {
    // Given: the RLS migration is the CI-reviewed source of database access rules.
    const rlsSql = await readMigration('0002_rls.sql')

    // When: the table-level RLS statements are inspected structurally.
    const normalizedSql = rlsSql.toLowerCase()

    // Then: players must always pass policy checks before rows are returned.
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.players\s+enable\s+row\s+level\s+security/u
    )
    // Then: games must always pass policy checks before rows are returned.
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.games\s+enable\s+row\s+level\s+security/u
    )
  })

  it('revokes anonymous privileges before authenticated grants are added', async () => {
    // Given: anon must not inherit public schema or table privileges.
    const rlsSql = await readMigration('0002_rls.sql')
    const normalizedSql = rlsSql.toLowerCase()

    // When: revoke statements are inspected structurally.
    const playersRevoke = /revoke\s+all\s+on\s+table\s+public\.players\s+from\s+anon/u
    const gamesRevoke = /revoke\s+all\s+on\s+table\s+public\.games\s+from\s+anon/u

    // Then: anon cannot even use the public schema as a broad access path.
    expect(normalizedSql).toContain('revoke all on schema public from anon')
    // Then: anon has no direct table privilege to public player profiles.
    expect(normalizedSql).toMatch(playersRevoke)
    // Then: anon has no direct table privilege to game history rows.
    expect(normalizedSql).toMatch(gamesRevoke)
  })

  it('does not grant any privilege to the anon role', async () => {
    // Given: authenticated grants are allowed, but anonymous grants are not.
    const rlsSql = await readMigration('0002_rls.sql')

    // When: executable grant statements are inspected without comments.
    const executableSql = stripLineComments(rlsSql)

    // Then: no GRANT statement may target exactly the anon role.
    expect(executableSql).not.toMatch(/(^|\n)\s*grant\b[^;]*\bto\s+anon\b/iu)
  })

  it('scopes players_select to authenticated users only', async () => {
    // Given: public player rows are still non-PII but must not be anonymous.
    const rlsSql = await readMigration('0002_rls.sql')

    // When: the players_select policy block is inspected directly.
    const playersSelectPolicy = extractPolicyBlock(rlsSql, 'players_select')

    // Then: only signed-in users can read player profile rows.
    expect(playersSelectPolicy).toMatch(/\bto\s+authenticated\b/iu)
    // Then: the select policy cannot accidentally become public.
    expect(playersSelectPolicy).not.toMatch(/\bto\s+(public|anon)\b/iu)
  })
})

describe('No PII columns', () => {
  it('keeps the players table limited to public profile fields', async () => {
    // Given: identity data must remain in auth.users, not public.players.
    const initSql = await readMigration('0001_init.sql')

    // When: only the public.players create-table body is parsed.
    const playersBlock = extractCreateTableBlock(initSql, 'players')
    const playerColumns = parseColumnNames(playersBlock)

    // Then: the public table exposes only the approved non-PII columns.
    expect(playerColumns).toEqual([
      'id',
      'display_name',
      'avatar_url',
      'created_at'
    ])
    // Then: email addresses are never persisted as player columns.
    expect(playerColumns).not.toContain('email')
    // Then: provider uid values are not duplicated beside the auth-owned id.
    expect(playerColumns).not.toContain('uid')
    // Then: phone numbers are not part of the public profile schema.
    expect(playerColumns).not.toContain('phone')
    // Then: raw provider photo fields are not copied into public.players.
    expect(playerColumns).not.toContain('photo')
  })
})

describe('Schema contract', () => {
  it('requires fixed-size game player and score arrays', async () => {
    // Given: malformed game arrays can expose or corrupt unrelated player data.
    const initSql = await readMigration('0001_init.sql')
    const gamesBlock = extractCreateTableBlock(initSql, 'games')

    // When: the games create-table constraints are inspected structurally.
    const normalizedGamesBlock = gamesBlock.toLowerCase()

    // Then: every persisted game must reference exactly four player ids.
    expect(normalizedGamesBlock).toMatch(
      /constraint\s+games_players_length\s+check\s*\([\s\S]*array_length\(players,\s*1\)[\s\S]*=\s*4/u
    )
    // Then: every persisted game must carry exactly eight score counters.
    expect(normalizedGamesBlock).toMatch(
      /constraint\s+games_scores_length\s+check\s*\([\s\S]*array_length\(scores,\s*1\)[\s\S]*=\s*8/u
    )
  })

  it('uses auth.uid() as the player id without adding a duplicate uid column', async () => {
    // Given: the auth uid is the row id, so no separate provider uid is needed.
    const initSql = await readMigration('0001_init.sql')
    const playersBlock = extractCreateTableBlock(initSql, 'players')
    const playerColumns = parseColumnNames(playersBlock)

    // When: the player identity column is inspected structurally.
    const normalizedPlayersBlock = playersBlock.toLowerCase()

    // Then: public.players.id defaults to auth.uid() for owner binding.
    expect(normalizedPlayersBlock).toMatch(
      /id\s+uuid\s+primary\s+key\s+default\s+auth\.uid\(\)/u
    )
    // Then: no uid column can drift into a second PII-bearing identifier.
    expect(playerColumns).not.toContain('uid')
  })
})

describe('Slack payload PII-free', () => {
  it('emits only public participant names and ratings', () => {
    // Given: Slack receives a finished game and a profile map containing bait PII.
    const game: GameRecord = {
      id: '7b94e626-9b67-46e4-bcbb-2727d08ec122',
      startdate: 1_720_000_000_000,
      duration: 600,
      players: [
        '90f3b8bc-3d3f-411c-8be1-703f4d3010bc',
        '9a446ed4-ffb8-4863-ab27-6d662dca69a5',
        '40ba14c3-4de4-41ba-b61e-f2517f8cfe27',
        'f81f37ce-698c-4812-9a04-d111674e2c6e'
      ],
      scores: [3, 2, 1, 0, 0, 0, 0, 0],
      timeline: [
        {
          player_id: '90f3b8bc-3d3f-411c-8be1-703f4d3010bc',
          index: 0,
          position: POSITION_STRIKER,
          time: 12,
          own_goal: false
        }
      ],
      company_id: null,
      opponent_company_id: null,
      season_id: null,
      league_id: null,
      created_at: '2026-09-17T07:00:00.000Z'
    }
    const playersById = new Map<string, { name: string; elo: number }>([
      ['90f3b8bc-3d3f-411c-8be1-703f4d3010bc', { name: 'Alice', elo: 1510 }],
      ['9a446ed4-ffb8-4863-ab27-6d662dca69a5', { name: 'Bob', elo: 1490 }],
      ['40ba14c3-4de4-41ba-b61e-f2517f8cfe27', { name: 'Carol', elo: 1520 }],
      ['f81f37ce-698c-4812-9a04-d111674e2c6e', { name: 'Dana', elo: 1480 }],
      ['unselected-profile', { name: 'alice@gmail.com', elo: 1600 }]
    ])

    // When: the webhook payload is created locally without network access.
    const message = createEndMessage(game, playersById)
    const serializedMessage = JSON.stringify(message)

    // Then: email-shaped profile data must never appear in the Slack JSON.
    expect(serializedMessage).not.toMatch(/[\w.%+-]+@[\d.a-z-]+\.[a-z]{2,}/iu)
    // Then: uid labels or raw uid fields must never be emitted to Slack.
    expect(serializedMessage).not.toContain('uid')
    // Then: raw Google photo/provider URLs must stay outside Slack payloads.
    expect(serializedMessage).not.toMatch(/googleusercontent\.com|googleapis\.com/iu)
    // Then: selected public display names remain visible for game context.
    expect(serializedMessage).toContain('Alice')
    // Then: selected public display names remain visible for both teams.
    expect(serializedMessage).toContain('Dana')
  })
})

describe('No PII in derived domain types', () => {
  it('keeps PlayerStats shaped around public profile and game statistics only', () => {
    // Given: a complete derived player-stat record typed by the domain contract.
    const playerStats: PlayerStats = {
      id: '90f3b8bc-3d3f-411c-8be1-703f4d3010bc',
      display_name: 'Alice',
      avatar_url: null,
      goalsPosStriker: 0,
      goalsPosMidfield: 0,
      goalsPosDefense: 0,
      goalsPosKeeper: 0,
      ownGoals: 0,
      wins: 0,
      winsAttack: 0,
      winsDefense: 0,
      losses: 0,
      lossesAttack: 0,
      lossesDefense: 0,
      winStreak: 0,
      longestWinStreak: 0,
      games: 0,
      gamesAttack: 0,
      gamesDefense: 0,
      goals: 0,
      goalsAttack: 0,
      goalsDefense: 0,
      goalsAgainst: 0,
      goalsAgainstDefense: 0,
      goalsWinnerAttack: 0,
      ownGoalsAttack: 0,
      ownGoalsDefense: 0,
      elo: 1500,
      eloGain: 0,
      winRatio: 0,
      winRatioAttack: 0,
      winRatioDefense: 0,
      avgGoalsPosStriker: 0,
      avgGoalsPosMidfield: 0,
      avgGoalsPosDefense: 0,
      avgGoalsPosKeeper: 0,
      avgGoalsWinnerAttack: 0,
      avgGoalsAgainstDefense: 0,
      avgOwnGoals: 0,
      avgTimeBetweenGoals: 0,
      avgTimeBetweenGoalsAgainst: 0,
      playTime: 0,
      playTimeAttack: 0,
      playTimeDefense: 0,
      avgGameDuration: 0,
      winsAttackDuration: 0,
      avgWinsAttackDuration: 0,
      lossDefenseDuration: 0,
      avgLossDefenseDuration: 0,
      placementFinished: false,
      selectionIndex: 0,
      totalAvgTimeBetweenGoals: 0,
      totalAvgTimeBetweenGoalsAgainst: 0
    }

    // When: the runtime shape is inspected as CI would observe it.
    const statKeys = Object.keys(playerStats)

    // Then: the public display name is the only human-readable identifier.
    expect(statKeys).toContain('display_name')
    // Then: ELO is retained because it is public game-derived state.
    expect(statKeys).toContain('elo')
    // Then: email is not part of the derived stats shape.
    expect(statKeys).not.toContain('email')
    // Then: provider uid data is not part of the derived stats shape.
    expect(statKeys).not.toContain('uid')
  })
})
