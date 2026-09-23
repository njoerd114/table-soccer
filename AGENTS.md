# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-17 20:59 UTC
**Commit:** ac20621 (base) / feat/modernize-2026 (rebuild branch)
**Branch:** feat/modernize-2026

## OVERVIEW
React 19 + Vite + TypeScript PWA for tracking table soccer (foosball) games: 2v2 scoring, chess-style ELO, per-position stats, game timeline, Slack posting. Backend is Supabase (Postgres + Row Level Security). German UI (i18next). 2026 rebuild of a 2018 React-16/Firebase app that was taken down for leaking PII via public DB rules — the rebuild is deny-by-default and PII-free by construction.

## STRUCTURE
```
table-soccer/
├── src/
│   ├── domain/      # PURE core logic (frozen): types, constants, ELO math, transformer, handicap
│   ├── hooks/       # TanStack Query data layer (auth, companies, seasons, leagues, games, realtime)
│   ├── context/     # ActiveCompanyProvider (tenant context)
│   ├── lib/         # supabase client (typed), query keys, Slack payload builder
│   ├── pages/       # route components (lazy-loaded)
│   ├── components/  # shared UI (LoginForm, CompanySwitcher, GameFilters, HandicapBadge, charts)
│   ├── i18n/        # i18next setup + de.json
│   ├── styles/      # MUI theme + global css
│   ├── test/        # test setup + fixtures
│   ├── security.test.ts + tenancy/security.test.ts  # PII + RLS regression (structural, no DB)
│   ├── App.tsx      # shell: nav, auth menu, routes, FAB
│   └── main.tsx     # entry: providers (QueryClient, MUI, Router, i18n)
├── supabase/
│   └── migrations/  # 0001_init, 0002_rls, 0003_seed, 0004_tenancy, 0005_rls_tenancy, 0006_fix_rls_recursion
├── .github/workflows/  # ci.yml (quality gate), deploy.yml (manual Vercel preview)
└── vitest*.config.ts   # unit tests + separate security-test config
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Routes / shell | `src/App.tsx` | lazy pages, nav, FAB, auth menu |
| Pure game math (ELO) | `src/domain/elo.ts` | ported 1:1 from legacy Helper.js |
| Golf-style handicap | `src/domain/handicap.ts` | rolling window, best-half weighted, 100 ELO/goal |
| Raw→derived stats | `src/domain/transform.ts` | ported from legacy transformer.js, frozen |
| Data contracts | `src/domain/types.ts` | PlayerStats/Game/Team/Company/Season/League/Scores8 |
| Supabase schema + RLS | `supabase/migrations/` | deny-by-default, tenant-scoped via current_company_ids() |
| Tenant context | `src/context/ActiveCompanyContext.tsx` + `src/hooks/useActiveCompany.ts` | active company for filtering |
| Data hooks | `src/hooks/` | companies/seasons/leagues/games/players + mutations |
| Auth | `src/hooks/useAuth.ts`, `src/lib/supabase.ts` | Google OAuth, email/password, session |
| Slack posting | `src/lib/slack.ts` | display names only (PII boundary) |
| PII regression tests | `src/security.test.ts`, `src/tenancy/security.test.ts` | via `npm run test:security` |
| i18n strings | `src/i18n/de.json` | German only |
| CI/deploy | `.github/workflows/` | ci.yml on push/PR, deploy.yml manual |

## CODE MAP
| Symbol | Type | Location | Role |
|--------|------|----------|------|
| transform | fn | `src/domain/transform.ts` | raw rows → AppData (players/teams/stats/properties) |
| getScore / calcFactor / calc2v2 / calcTeamElo / calcScore | fns | `src/domain/elo.ts` | ELO + score math (750 divisor, ×50, streak bonus) |
| computePlayerHandicap / computeHandicaps / matchAllowance | fns | `src/domain/handicap.ts` | golf-style handicap + goal head start |
| App | comp | `src/App.tsx` | nav shell, routes, subscriptions |
| ActiveCompanyProvider / useActiveCompany | ctx/hook | `src/context/` + `src/hooks/` | active tenant for filtering |
| useGames / usePlayers | hooks | `src/hooks/` | query + transform composition, company-scoped |
| useCreateGame / useUpsertPlayerProfile | hooks | `src/hooks/` | the only write paths (PII whitelisted) |
| useCompanies / useSeasons / useLeagues | hooks | `src/hooks/` | tenancy + season/league queries + mutations |
| useGameSubscriptions | hook | `src/hooks/` | realtime postgres_changes → invalidation |
| createEndMessage | fn | `src/lib/slack.ts` | Slack payload, names/ELO only |
| security.test.ts / tenancy/security.test.ts | tests | `src/` | structural PII + RLS invariants |

## CONVENTIONS
- **Functional components + hooks only** (React 19; the legacy class components are gone)
- **strict TS**: no `any`/`unknown`/non-null assertions/`@ts-ignore` (CI-enforced)
- **Frozen domain layer**: `src/domain/*` is pure logic — no I/O, no React, no Supabase imports
- **PII discipline**: app tables store ONLY `display_name` + `avatar_url`; email/uid live in Supabase Auth only; Slack carries names/ELO only
- **Tenancy**: every query is scoped by the active company (RLS enforces server-side; `current_company_ids()` SECURITY DEFINER avoids policy recursion)
- **Data flow**: hooks fetch → map rows to GameRecord/PlayerProfile → `transform()` → AppData → pages consume
- **i18n**: all UI strings via `useTranslation`, German in `de.json`
- **UI**: MUI v9 components + `sx`, dark theme, no custom CSS files
- **Tests**: vitest; unit tests (`*.test.ts`) + separate security config (`*.security.test.ts`)
- **Lazy routes**: pages split via React.lazy + Suspense
- **Branch naming**: feat/... branches; deploy is manual only

## ANTI-PATTERNS (THIS PROJECT)
- **Do NOT add PII columns to app tables** — no email, uid, phone, or raw Google photo URLs. Identity stays in Supabase Auth.
- **Do NOT grant anything to the `anon` role** in migrations — RLS + grants are the two-layer defense.
- **Do NOT query `company_members` directly inside RLS policies** — causes infinite recursion; always use `public.current_company_ids()`.
- **Do NOT modify `src/domain/*` casually** — ELO/transform behavior is frozen and golden-tested; changes require updating fixtures.
- **Do NOT bypass `transform()`** to derive stats in components/hooks; handicap is the exception (separate pure module).
- **Do NOT weaken `src/security.test.ts` / `src/tenancy/security.test.ts`** — regression guards for the PII leak the old app died from.
- **No `as any`/`@ts-ignore`** — strict mode is a hard gate in CI.

## UNIQUE STYLES
- ELO-based MMR (chess-style, divisor 750, ×50 multiplier, win-streak 1.2× at ≥3)
- Golf-style handicap: rolling 10-game window, best-half ELO average, 100 ELO = 1 goal head start
- 4 positions: KEEPER / DEFENSE / MIDFIELD / STRIKER (legacy `MIDFILED` typo fixed)
- Teams keyed `${attackId}-${defenseId}`, guest player id `guest`
- `players` id = `auth.uid()`; games immutable after insert (no UPDATE/DELETE policies)
- Placement qualification: `placementFinished` at ≥10 games
- Cross-company matches: `games.opponent_company_id` visible to both tenants

## COMMANDS
```bash
npm install        # single lockfile (package-lock.json)
npm run dev        # vite dev server
npm run build      # tsc -b && vite build → dist/ (+ PWA sw.js/manifest)
npm run lint       # oxlint
npm run typecheck  # tsc --noEmit
npm test           # vitest run (domain + hooks)
npm run test:security  # vitest.security.config.ts — PII regression
npm run preview    # serve dist/
```

## NOTES
- **Legacy reference** lives at `master` branch + `src/services/__mocks__/dataMock.json` fixture (golden test input in `src/test/fixtures/`)
- Supabase migrations applied via `supabase link && supabase db push`; verify with `psql -f supabase/verify_security.sql`
- Requires `.env.local` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`)
- CI uses dummy VITE_* values; real values only in deploy secrets
- Optional Slack posting needs `VITE_SLACK_WEBHOOK_URL` (best-effort, never crashes)
- No server code; Vercel hosting via manual workflow_dispatch