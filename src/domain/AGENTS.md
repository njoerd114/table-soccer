# src/domain/ — Frozen Core Logic

## OVERVIEW
Pure, framework-agnostic table-soccer logic ported 1:1 from the legacy 2018 codebase. No React, no I/O, no Supabase imports. Golden-tested — behavior is frozen.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| ELO/score math (750 divisor, ×50, streak bonus) | `elo.ts` |
| Raw rows → AppData (stats/teams/properties) | `transform.ts` |
| Data contracts | `types.ts` |
| Positions, steps, colors, defaults | `constants.ts` |
| Barrel export | `index.ts` |

## CONVENTIONS
- Functions are pure and exported named; inputs typed as `GameRecord`/`PlayerProfile`/tuples
- `transform()` accepts BOTH modern array shape and legacy keyed-object shape (fixture compat)
- Test fixtures live in `src/test/fixtures/` (golden `dataMock.json`)
- Startdate: raw = unix ms number, derived Game = `Date`

## ANTI-PATTERNS
- **Do NOT change ELO formulas** — multipliers (50), divisor (750), streak threshold (3), bonus cap (1.5) are frozen
- **Do NOT add stats fields** not in `PlayerStats`
- **No imports from hooks/lib/pages** — the layer must stay pure
- Legacy typos fixed at port: `MIDFILED`→`MIDFIELD`, `placemnentFinished`→`placementFinished`