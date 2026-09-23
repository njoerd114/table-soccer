import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

type MigrationName = '0002_rls.sql' | '0004_tenancy.sql' | '0005_rls_tenancy.sql'
type TableName =
  | 'players'
  | 'games'
  | 'companies'
  | 'company_members'
  | 'seasons'
  | 'leagues'

const SQL_TABLE_CONSTRAINT_KEYWORDS = new Set([
  'constraint',
  'unique',
  'primary',
  'foreign',
  'check'
])
const PII_COLUMN_NAME = /(^|_)(email|uid|phone|photo)($|_)/iu

async function readMigration(name: MigrationName): Promise<string> {
  try {
    return await readFile(
      new URL(`../../supabase/migrations/${name}`, import.meta.url),
      'utf8'
    )
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        throw new Error(
          `Missing migration ${name}; expected supabase/migrations/${name} for structural tenancy security tests: ${error.message}`
        )
      }

      throw error
    }

    throw new Error(`Failed to read migration ${name}`)
  }
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

    if (
      columnName !== undefined &&
      !SQL_TABLE_CONSTRAINT_KEYWORDS.has(columnName.toLowerCase())
    ) {
      names.push(columnName)
    }
  }

  return names
}

function extractAlterAddColumns(sql: string, tableName: TableName): readonly string[] {
  const alterColumnMatches = sql.matchAll(
    new RegExp(
      `alter\\s+table\\s+public\\.${tableName}\\s+add\\s+column\\s+([a-z_]+)\\b`,
      'giu'
    )
  )

  return Array.from(alterColumnMatches, (match) => match[1]).filter(
    (columnName): columnName is string => columnName !== undefined
  )
}

function extractSelectPolicyBlocks(sql: string): readonly string[] {
  const selectPolicyMatches = sql.matchAll(
    /create\s+policy\s+\S+\s+on\s+public\.\S+\s+for\s+select\s+to\s+\S+[\s\S]*?;/giu
  )

  return Array.from(selectPolicyMatches, (match) => match[0])
}

function matchesTableAnonRevoke(sql: string, tableName: TableName): boolean {
  const explicitTableRevoke = new RegExp(
    `revoke\\s+all\\s+on\\s+table\\s+public\\.${tableName}\\s+from\\s+anon`,
    'iu'
  )
  const groupedTableRevoke = new RegExp(
    `revoke\\s+all\\s+on\\s+table[\\s\\S]{0,160}public\\.${tableName}[\\s\\S]{0,160}from\\s+anon`,
    'iu'
  )

  return explicitTableRevoke.test(sql) || groupedTableRevoke.test(sql)
}

describe('Tenancy: no PII in new tables', () => {
  it('keeps company tenancy tables limited to approved non-PII columns', async () => {
    // Given: tenancy metadata must not reintroduce the PII columns removed in the rebuild.
    const tenancySql = await readMigration('0004_tenancy.sql')

    // When: the new tenancy create-table bodies are parsed structurally.
    const companiesColumns = parseColumnNames(
      extractCreateTableBlock(tenancySql, 'companies')
    )
    const companyMembersColumns = parseColumnNames(
      extractCreateTableBlock(tenancySql, 'company_members')
    )
    const seasonsColumns = parseColumnNames(
      extractCreateTableBlock(tenancySql, 'seasons')
    )
    const leaguesColumns = parseColumnNames(
      extractCreateTableBlock(tenancySql, 'leagues')
    )

    // Then: companies expose only tenant identity and creator metadata.
    expect(companiesColumns).toEqual(['id', 'name', 'created_by', 'created_at'])
    // Then: companies cannot persist email, uid, phone, or photo columns.
    expect(companiesColumns.join(',')).not.toMatch(PII_COLUMN_NAME)
    // Then: memberships expose only tenant/user ids, role, and creation metadata.
    expect(companyMembersColumns).toEqual([
      'id',
      'company_id',
      'user_id',
      'role',
      'created_at'
    ])
    // Then: memberships cannot persist email, uid, phone, or photo columns.
    expect(companyMembersColumns.join(',')).not.toMatch(PII_COLUMN_NAME)
    // Then: seasons expose only company scope, public labels, dates, and creator metadata.
    expect(seasonsColumns).toEqual([
      'id',
      'company_id',
      'name',
      'starts_on',
      'ends_on',
      'created_by',
      'created_at'
    ])
    // Then: seasons cannot persist email, uid, phone, or photo columns.
    expect(seasonsColumns.join(',')).not.toMatch(PII_COLUMN_NAME)
    // Then: leagues expose only company scope, public labels, and creator metadata.
    expect(leaguesColumns).toEqual([
      'id',
      'company_id',
      'name',
      'created_by',
      'created_at'
    ])
    // Then: leagues cannot persist email, uid, phone, or photo columns.
    expect(leaguesColumns.join(',')).not.toMatch(PII_COLUMN_NAME)
  })

  it('adds only approved tenancy references to existing tables', async () => {
    // Given: ALTER statements are the only approved path for extending legacy app tables.
    const tenancySql = await readMigration('0004_tenancy.sql')

    // When: add-column statements are extracted from the tenancy migration.
    const playerAddedColumns = extractAlterAddColumns(tenancySql, 'players')
    const gameAddedColumns = extractAlterAddColumns(tenancySql, 'games')

    // Then: players gain only the company tenant boundary column.
    expect(playerAddedColumns).toEqual(['company_id'])
    // Then: player ALTER statements cannot add email, uid, phone, or photo columns.
    expect(playerAddedColumns.join(',')).not.toMatch(PII_COLUMN_NAME)
    // Then: games gain only host/opponent company, season, and league scope columns.
    expect(gameAddedColumns).toEqual([
      'company_id',
      'opponent_company_id',
      'season_id',
      'league_id'
    ])
    // Then: game ALTER statements cannot add email, uid, phone, or photo columns.
    expect(gameAddedColumns.join(',')).not.toMatch(PII_COLUMN_NAME)
  })
})

describe('Tenancy: RLS deny-by-default', () => {
  it('enables and forces RLS on every tenancy table', async () => {
    // Given: tenancy tables must never rely on grants alone for browser access control.
    const rlsSql = await readMigration('0005_rls_tenancy.sql')
    const normalizedSql = rlsSql.toLowerCase()

    // When: table-level RLS statements are inspected structurally.
    const rlsEnabledTables = Array.from(
      normalizedSql.matchAll(
        /alter\s+table\s+public\.(companies|company_members|seasons|leagues)\s+enable\s+row\s+level\s+security/gu
      ),
      (match) => match[1]
    )

    // Then: RLS is enabled exactly once for each new tenancy table.
    expect(rlsEnabledTables).toEqual([
      'companies',
      'company_members',
      'seasons',
      'leagues'
    ])
    // Then: company rows force owner access through policies too.
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.companies\s+force\s+row\s+level\s+security/u
    )
    // Then: membership rows force owner access through policies too.
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.company_members\s+force\s+row\s+level\s+security/u
    )
    // Then: season rows force owner access through policies too.
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.seasons\s+force\s+row\s+level\s+security/u
    )
    // Then: league rows force owner access through policies too.
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.leagues\s+force\s+row\s+level\s+security/u
    )
  })

  it('keeps anonymous grants absent while preserving the schema revoke invariant', async () => {
    // Given: tenancy grants may expand authenticated access but never anonymous access.
    const baseRlsSql = await readMigration('0002_rls.sql')
    const tenancyRlsSql = await readMigration('0005_rls_tenancy.sql')

    // When: executable RLS SQL is inspected without comments.
    const executableTenancyRlsSql = stripLineComments(tenancyRlsSql)
    const cumulativeRlsSql = `${baseRlsSql}\n${tenancyRlsSql}`.toLowerCase()

    // Then: anon cannot use the public schema across the cumulative app RLS migrations.
    expect(cumulativeRlsSql).toContain('revoke all on schema public from anon')
    // Then: no tenancy GRANT statement may target exactly the anon role.
    expect(executableTenancyRlsSql).not.toMatch(
      /(^|\n)\s*grant\b[^;]*\bto\s+anon\b/iu
    )
  })

  it('limits every tenancy select policy to authenticated users', async () => {
    // Given: select policies are the read boundary for browser-originated tenancy access.
    const rlsSql = await readMigration('0005_rls_tenancy.sql')

    // When: every CREATE POLICY block for SELECT is inspected directly.
    const selectPolicies = extractSelectPolicyBlocks(rlsSql)

    for (const policyBlock of selectPolicies) {
      // Then: every SELECT policy must require a signed-in user.
      expect(policyBlock).toMatch(/\bto\s+authenticated\b/iu)
      // Then: no SELECT policy can accidentally become public or anonymous.
      expect(policyBlock).not.toMatch(/\bto\s+(public|anon)\b/iu)
    }
    // Then: companies expose at least one member-scoped SELECT policy.
    expect(rlsSql).toContain('companies_select_member')
    // Then: memberships expose at least one authenticated SELECT policy.
    expect(rlsSql).toContain('company_members_select')
    // Then: seasons expose at least one company-scoped SELECT policy.
    expect(rlsSql).toContain('seasons_select')
    // Then: leagues expose at least one company-scoped SELECT policy.
    expect(rlsSql).toContain('leagues_select')
  })
})

describe('Tenancy: company scoping is enforced', () => {
  it('scopes game visibility to member companies on either side of a match', async () => {
    // Given: cross-company games must be visible to members of either participant company.
    const rlsSql = await readMigration('0005_rls_tenancy.sql')

    // When: the company-scoped game select policy is inspected directly.
    const gamesSelectPolicy = extractPolicyBlock(rlsSql, 'games_select_company')

    // Then: host company visibility must be derived from the viewer's memberships.
    expect(gamesSelectPolicy).toMatch(
      /select\s+company_id\s+from\s+public\.company_members/iu
    )
    // Then: opponent company visibility must also be available for cross-company games.
    expect(gamesSelectPolicy).toMatch(/\bopponent_company_id\b/iu)
  })

  it('replaces global player reads with company-scoped member reads', async () => {
    // Given: the pre-tenancy all-authenticated players_select policy must be retired.
    const rlsSql = await readMigration('0005_rls_tenancy.sql')

    // When: the player policy migration is inspected structurally.
    const playersSelectPolicy = extractPolicyBlock(rlsSql, 'players_select_member')

    // Then: the old global players_select policy is explicitly dropped before replacement.
    expect(rlsSql).toMatch(/drop\s+policy\s+if\s+exists\s+players_select\s+on\s+public\.players/iu)
    // Then: the old global players_select policy is not recreated in the tenancy migration.
    expect(rlsSql).not.toMatch(/create\s+policy\s+players_select\b/iu)
    // Then: player visibility must be derived from the viewer's company memberships.
    expect(playersSelectPolicy).toMatch(/from\s+public\.company_members/iu)
  })
})

describe('Tenancy: anon gets nothing', () => {
  it('revokes anonymous table privileges for every new tenancy table', async () => {
    // Given: anonymous visitors must receive neither policies nor table grants for tenant data.
    const rlsSql = await readMigration('0005_rls_tenancy.sql')

    // When: final anonymous revokes are inspected structurally.
    const normalizedSql = rlsSql.toLowerCase()

    // Then: anon has no direct privilege to company tenant rows.
    expect(matchesTableAnonRevoke(normalizedSql, 'companies')).toBe(true)
    // Then: anon has no direct privilege to membership rows.
    expect(matchesTableAnonRevoke(normalizedSql, 'company_members')).toBe(true)
    // Then: anon has no direct privilege to season rows.
    expect(matchesTableAnonRevoke(normalizedSql, 'seasons')).toBe(true)
    // Then: anon has no direct privilege to league rows.
    expect(matchesTableAnonRevoke(normalizedSql, 'leagues')).toBe(true)
  })
})
