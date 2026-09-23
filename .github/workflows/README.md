# GitHub Actions
- `ci.yml`: runs on pushes to `main`/`master` and every PR.
- CI uses Node 22 + `npm ci`, then lint, typecheck, unit tests, security tests, build, and PWA artifact checks.
- CI uses dummy `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`; tests must not need real Supabase credentials.
- `deploy.yml`: manual Vercel preview deploy only (`workflow_dispatch`), never automatic on PRs/pushes.

Required repo secrets:
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_TOKEN`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

To deploy: GitHub → Actions → "Vercel Preview Deploy" → Run workflow.
Protect the target branch/environment in GitHub before granting deploy secrets.
