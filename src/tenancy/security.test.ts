import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

type MigrationName =
  | '0002_rls.sql'
  | '0004_tenancy.sql'
  | '0005_rls_tenancy.sql'
  | '0007_owner_only_season_league_writes.sql'
  | '0008_google_account_auto_join.sql'
  | '0009_create_company_rpc.sql'
  | '0010_admin_tier_and_domain_autocreate.sql'
  | '0011_super_admin.sql'
type TableName =
  | 'players'
  | 'games'
  | 'companies'
  | 'company_members'
  | 'seasons'
  | 'leagues'
  | 'company_auth_allowlist'
  | 'super_admins'

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

describe('Owner-only season/league writes', () => {
  it('restricts season creation to company owners', async () => {
    // Given: only owners should curate a company's competitive structure.
    const sql = await readMigration('0007_owner_only_season_league_writes.sql')

    // When: the seasons_insert policy is inspected directly.
    const seasonsInsertPolicy = extractPolicyBlock(sql, 'seasons_insert')

    // Then: the policy requires an owner-role membership row.
    expect(seasonsInsertPolicy).toMatch(/role\s*=\s*'owner'/iu)
    // Then: the prior member-level policy is dropped before replacement.
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+seasons_insert\s+on\s+public\.seasons/iu)
  })

  it('restricts league creation to company owners', async () => {
    // Given: only owners should curate a company's competitive structure.
    const sql = await readMigration('0007_owner_only_season_league_writes.sql')

    // When: the leagues_insert policy is inspected directly.
    const leaguesInsertPolicy = extractPolicyBlock(sql, 'leagues_insert')

    // Then: the policy requires an owner-role membership row.
    expect(leaguesInsertPolicy).toMatch(/role\s*=\s*'owner'/iu)
    // Then: the prior member-level policy is dropped before replacement.
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+leagues_insert\s+on\s+public\.leagues/iu)
  })
})

describe('Google account auto-join: no PII, no client access', () => {
  it('keeps the allowlist table limited to non-PII columns', async () => {
    // Given: even a server-only table must not persist plaintext email.
    const sql = await readMigration('0008_google_account_auto_join.sql')

    // When: the allowlist create-table body is parsed structurally.
    const columns = parseColumnNames(
      extractCreateTableBlock(sql, 'company_auth_allowlist')
    )

    // Then: only hashed identity, salt, domain, and tenant/timestamp metadata exist.
    expect(columns).toEqual([
      'id',
      'company_id',
      'identity_hash',
      'identity_salt',
      'signup_domain',
      'created_at'
    ])
    // Then: no column name reintroduces a plaintext email/uid/phone/photo field.
    expect(columns.join(',')).not.toMatch(PII_COLUMN_NAME)
  })

  it('never persists a plaintext email literal in the migration body', async () => {
    // Given: the trigger/helper functions must hash email before storing it.
    const sql = await readMigration('0008_google_account_auto_join.sql')

    // When: insert/values statements targeting the allowlist table are inspected.
    const allowlistInsertMatch = sql.match(
      /insert\s+into\s+public\.company_auth_allowlist[\s\S]*?;/iu
    )

    // Then: the insert statement exists and stores digest()/encode() output, not raw email.
    const valuesClause = allowlistInsertMatch?.[0].match(/values\s*\(([\s\S]*?)\)\s*returning/iu)?.[1]
    expect(valuesClause).toMatch(/digest\(/iu)
    // Then: target_email is only ever passed through digest(), never bound directly as a column value.
    expect(valuesClause).not.toMatch(/(^|,)\s*target_email\s*(,|$)/mu)
  })

  it('denies all client grants on the allowlist table', async () => {
    // Given: this table must never be reachable from the browser, even for owners.
    const sql = await readMigration('0008_google_account_auto_join.sql')
    const normalizedSql = sql.toLowerCase()

    // Then: anon and authenticated are both explicitly revoked.
    expect(matchesTableAnonRevoke(normalizedSql, 'company_auth_allowlist')).toBe(true)
    expect(normalizedSql).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.company_auth_allowlist\s+from\s+authenticated/u
    )
    // Then: no GRANT statement targets this table for any client-facing role.
    expect(stripLineComments(sql)).not.toMatch(
      /grant\b[^;]*\bon\s+table\s+public\.company_auth_allowlist/iu
    )
    // Then: RLS is enabled and forced as defense-in-depth beyond the revokes.
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.company_auth_allowlist\s+enable\s+row\s+level\s+security/u
    )
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.company_auth_allowlist\s+force\s+row\s+level\s+security/u
    )
  })

  it('auto-joins only on a matched allowlist row via SECURITY DEFINER', async () => {
    // Given: the trigger must run with elevated privilege to bypass RLS safely.
    const sql = await readMigration('0008_google_account_auto_join.sql')

    // Then: the trigger function is SECURITY DEFINER with a pinned search_path.
    expect(sql).toMatch(/security\s+definer[\s\S]*?set\s+search_path\s*=\s*public/iu)
    // Then: the trigger is wired to auth.users insert, not exposed as client RPC.
    expect(sql).toMatch(
      /create\s+trigger\s+on_auth_user_created_company_autojoin[\s\S]*?after\s+insert\s+on\s+auth\.users/iu
    )
  })
})

describe('Company creation RPC: atomic, definer-scoped, authenticated-only', () => {
  it('creates both rows atomically via SECURITY DEFINER with a pinned search_path', async () => {
    // Given: the RPC replaces a two-step client insert that could leave an orphaned company.
    const sql = await readMigration('0009_create_company_rpc.sql')

    // Then: the function is SECURITY DEFINER with search_path pinned to prevent hijacking.
    expect(sql).toMatch(/security\s+definer[\s\S]*?set\s+search_path\s*=\s*public/iu)
    // Then: both the company row and its owner membership are inserted in one function body.
    expect(sql).toMatch(/insert\s+into\s+public\.companies/iu)
    expect(sql).toMatch(/insert\s+into\s+public\.company_members[\s\S]*?'owner'/iu)
    // Then: an unauthenticated caller (auth.uid() null) is rejected explicitly.
    expect(sql).toMatch(/current_user_id\s+is\s+null[\s\S]*?raise\s+exception/iu)
  })

  it('grants execute only to authenticated, never anon or public', async () => {
    // Given: this function must not become an anonymous write path into companies.
    const sql = await readMigration('0009_create_company_rpc.sql')
    const normalizedSql = sql.toLowerCase()

    // Then: anon and public are explicitly revoked before the authenticated grant.
    expect(normalizedSql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.create_company\(text\)\s+from\s+public/u
    )
    expect(normalizedSql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.create_company\(text\)\s+from\s+anon/u
    )
    // Then: only authenticated receives execute privilege.
    expect(normalizedSql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.create_company\(text\)\s+to\s+authenticated/u
    )
  })
})

describe('Admin tier: promotion cannot grant owner or touch the owner row', () => {
  it('scopes company_members_update_admin to member/admin targets, never owner', async () => {
    // Given: promotion must never be a path to hijacking or removing the original creator.
    const sql = await readMigration('0010_admin_tier_and_domain_autocreate.sql')
    const updatePolicy = extractPolicyBlock(sql, 'company_members_update_admin')

    // Then: the acting user's own role is read via the recursion-safe SECURITY DEFINER helper.
    expect(updatePolicy).toMatch(/public\.current_user_company_role\(company_id\)\s+in\s+\('owner',\s*'admin'\)/iu)
    // Then: the target row's existing role must not already be 'owner'.
    expect(updatePolicy).toMatch(/role\s*<>\s*'owner'/iu)
    // Then: the with-check clause can only ever land on member or admin, never owner.
    expect(updatePolicy).toMatch(/with\s+check\s*\(\s*role\s+in\s+\('member',\s*'admin'\)/iu)
  })

  it('broadens season/league/member-delete owner checks to include admin', async () => {
    // Given: the auto-provisioned first-domain-user is 'admin', not 'owner'.
    const sql = await readMigration('0010_admin_tier_and_domain_autocreate.sql')

    // Then: seasons/leagues creation accepts either role.
    expect(extractPolicyBlock(sql, 'seasons_insert')).toMatch(/role\s+in\s+\('owner',\s*'admin'\)/iu)
    expect(extractPolicyBlock(sql, 'leagues_insert')).toMatch(/role\s+in\s+\('owner',\s*'admin'\)/iu)
    // Then: member removal accepts either role too.
    expect(extractPolicyBlock(sql, 'company_members_delete')).toMatch(/role\s+in\s+\('owner',\s*'admin'\)/iu)
  })

  it('auto-creates a company only when no allowlist row matches the signup domain at all', async () => {
    // Given: this must never fire for a domain that already has any allowlist row.
    const sql = await readMigration('0010_admin_tier_and_domain_autocreate.sql')

    // Then: the fallback branch inserts a company, an 'admin' membership, and a new domain allowlist row.
    expect(sql).toMatch(/insert\s+into\s+public\.companies[\s\S]*?new_company_id/iu)
    expect(sql).toMatch(/insert\s+into\s+public\.company_members[\s\S]*?'admin'/iu)
    expect(sql).toMatch(/insert\s+into\s+public\.company_auth_allowlist[\s\S]*?new_user_domain/iu)
  })
})

describe('Super admin: reserved, non-self-service, zero client access to the table itself', () => {
  it('keeps super_admins as a non-PII, zero-grant, forced-RLS table', async () => {
    // Given: this table gates a platform-wide bypass and must never be client-reachable.
    const sql = await readMigration('0011_super_admin.sql')
    const normalizedSql = sql.toLowerCase()

    // Then: the only columns are the user reference and creation metadata.
    const columns = parseColumnNames(extractCreateTableBlock(sql, 'super_admins'))
    expect(columns).toEqual(['user_id', 'created_at'])
    // Then: anon and authenticated are both explicitly revoked.
    expect(normalizedSql).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.super_admins\s+from\s+anon/u
    )
    expect(normalizedSql).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.super_admins\s+from\s+authenticated/u
    )
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.super_admins\s+enable\s+row\s+level\s+security/u
    )
    expect(normalizedSql).toMatch(
      /alter\s+table\s+public\.super_admins\s+force\s+row\s+level\s+security/u
    )
    // Then: no GRANT statement targets this table for any client-facing role.
    expect(stripLineComments(sql)).not.toMatch(
      /grant\b[^;]*\bon\s+table\s+public\.super_admins/iu
    )
  })

  it('exposes only a boolean check function to clients, never the table', async () => {
    // Given: am_i_super_admin() is the only client-safe surface.
    const sql = await readMigration('0011_super_admin.sql')
    const normalizedSql = sql.toLowerCase()

    // Then: is_super_admin() is SECURITY DEFINER so it can read the locked-down table.
    expect(sql).toMatch(/is_super_admin[\s\S]*?security\s+definer/iu)
    // Then: am_i_super_admin() is granted to authenticated as the client-facing wrapper.
    expect(normalizedSql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.am_i_super_admin\(\)\s+to\s+authenticated/u
    )
  })

  it('bypasses every cross-company select policy only via is_super_admin()', async () => {
    // Given: cross-company read access must route through the single checked helper.
    const sql = await readMigration('0011_super_admin.sql')

    for (const policyName of [
      'companies_select_member',
      'company_members_select',
      'seasons_select',
      'leagues_select',
      'players_select_member',
      'games_select_company'
    ]) {
      const policyBlock = extractPolicyBlock(sql, policyName)
      // Then: every broadened SELECT policy references is_super_admin() explicitly.
      expect(policyBlock).toMatch(/public\.is_super_admin\(\)/iu)
    }
  })
})
