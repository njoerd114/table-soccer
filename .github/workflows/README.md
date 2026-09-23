# GitHub Actions
- `ci.yml`: runs on pushes to `main`/`master` and every PR.
- CI uses Node 22 + `npm ci`, then lint, typecheck, unit tests, security tests, build, and PWA artifact checks.
- CI uses dummy `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`; tests must not need real Supabase credentials.
- `deploy.yml`: manual Vercel preview deploy only (`workflow_dispatch`), never automatic on PRs/pushes. Production deploys are handled by Vercel's own Git integration on push to `master`.
- `supabase-migrate.yml`: pushes pending `supabase/migrations/**` to the linked production project whenever they change on `master` (or via manual `workflow_dispatch`). Uses `--include-all`-free `supabase db push --linked` so it only applies migrations not yet on remote.

Required repo secrets:
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_TOKEN`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ACCESS_TOKEN` — personal/service access token from https://supabase.com/dashboard/account/tokens
- `SUPABASE_PROJECT_REF` — project ref (e.g. `bqspzjhlbjrjvfzeivdl`)
- `SUPABASE_DB_PASSWORD` — the project's Postgres password (Settings → Database)

To deploy a preview: GitHub → Actions → "Vercel Preview Deploy" → Run workflow.
To push migrations manually: GitHub → Actions → "Supabase Migrate" → Run workflow.
Protect the target branch/environment in GitHub before granting deploy secrets.
