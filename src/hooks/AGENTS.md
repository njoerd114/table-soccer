# src/hooks/ — TanStack Query Data Layer

## OVERVIEW
The only bridge between UI and Supabase. Fetches rows, maps them to domain shapes, calls the frozen `transform()`, and exposes mutations. Realtime invalidation keeps the UI fresh.

## WHERE TO LOOK
| Hook | Role |
|------|------|
| `useAuth` | session, Google sign-in/out |
| `usePlayers` | PlayerProfile[] query |
| `useGames` | games + players → AppData via transform() |
| `useCreateGame` | persist finished game (only game write) |
| `useUpsertPlayerProfile` | upsert own profile (only player write) |
| `useGameSubscriptions` | postgres_changes → invalidate queries |

## CONVENTIONS
- Query keys from `src/lib/queryKeys` (typed factory)
- Row types from `src/lib/database.types.ts` (explicit, no `any` from supabase-js)
- DB rows validated to tuples before `transform()` (see `useGames` toGameRecord)
- Mutations invalidate affected query keys on success

## ANTI-PATTERNS
- **Do NOT store PII** — never write email/uid/photoURL to app tables; `useUpsertPlayerProfile` whitelists `{id, display_name, avatar_url}`
- **Do NOT reimplement stats** — always route through `transform()`
- **Do NOT import React components** into hooks
- **No direct `supabase.from()` calls in pages** — every access goes through a hook