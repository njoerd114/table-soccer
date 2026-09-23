# Supabase database

Migrations live in `supabase/migrations/`.

Migrations 0004/0005 add multi-company tenancy, seasons, and leagues.

Apply to linked project:
`supabase link --project-ref <project-ref> && supabase db push`

Apply locally:
`supabase start && supabase db push`

Run security checks:
`psql "$SUPABASE_DB_URL" -f supabase/verify_security.sql`

The `anon` key cannot read `players` or `games`.
