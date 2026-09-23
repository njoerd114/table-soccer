# Tischkicker Tracker

> Tischfußball / Table Soccer Tracker — React 19 + Vite + Supabase PWA.
> 2026 rebuild of the classic 2018 app, preserving the core ELO/game logic.

## Stack

- **React 19 + Vite 8 + TypeScript** (strict)
- **Supabase** (Postgres + Row Level Security) — deny-by-default, no public read
- **TanStack Query v5** — server state + realtime invalidation
- **MUI v9** — dark-themed component library
- **Recharts** — statistics charts
- **vite-plugin-pwa** — installable, offline-capable
- **i18next** — German UI
- **GitHub Actions** — CI (lint, typecheck, tests, security tests, build) + manual Vercel preview deploy

## Security model (why this rebuild is leak-proof)

The 2018 app was taken down because its Firebase rules allowed **public read** of
all data, leaking player emails, names, and profile photos.

The rebuild enforces **deny-by-default at the database level**:

- Public tables contain **only** `display_name` and `avatar_url` — never email,
  provider uid, or raw Google photo URLs. Identity lives exclusively in Supabase Auth.
- Every table has **Row Level Security enabled** with minimal grants; anonymous
  visitors can read nothing.
- Security tests in CI (`npm run test:security`) assert these invariants
  structurally — a future misconfiguration fails the build.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

Supabase migrations:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Security verification (must all fail / return nothing for `anon`):

```bash
psql "$SUPABASE_DB_URL" -f supabase/verify_security.sql
```

## Commands

```bash
npm run dev            # dev server (hot reload)
npm run build          # production build → dist/
npm run lint           # oxlint
npm run typecheck      # tsc --noEmit
npm test               # vitest run (domain + hooks)
npm run test:security  # PII-leak regression tests
npm run preview        # serve production build
```

## Features

- 2v2 games with live scoring, own goals, undo
- Chess-style ELO rating (per player + per team)
- Per-position statistics (Sturm / Mittelfeld / Abwehr / Torwart)
- Game timeline, win streaks, leaderboards
- Player comparison
- Slack webhook posting (optional, display names only)
- PWA: installable, works offline

## Deployment

CI runs on every push/PR. Deploy is **manual only**:

1. Add repo secrets: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`,
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
2. GitHub → Actions → **Vercel Preview Deploy** → Run workflow

## Feedback

Report bugs or request features via GitHub issues.