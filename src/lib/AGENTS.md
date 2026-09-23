# src/lib/ — Infrastructure & PII Boundary

## OVERVIEW
Client infrastructure: typed Supabase client, query-key factory, Slack payload builder. Small, security-relevant surface.

## WHERE TO LOOK
| File | Role |
|------|------|
| `supabase.ts` | `createClient<Database>` — throws if env missing |
| `database.types.ts` | explicit Row/Insert types matching migrations |
| `queryKeys.ts` | typed TanStack query keys |
| `slack.ts` | `createEndMessage` — display names + ELO ONLY |

## CONVENTIONS
- Supabase client typed with the local `Database` schema (no generated types dependency)
- Env guarded at module load: missing `VITE_SUPABASE_URL`/`ANON_KEY` → throw

## ANTI-PATTERNS
- **`slack.ts` must NEVER emit emails, uids, or profile photo URLs** — this is the third-party PII boundary (covered by `src/security.test.ts`)
- **Do NOT import React** here
- **Do NOT add generic HTTP helpers** — use hooks + supabase client