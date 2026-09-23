# src/pages/ — Route Components

## OVERVIEW
Lazy-loaded German UI pages consuming the hooks layer. MUI v9 + dark theme, no custom CSS.

## WHERE TO LOOK
| Page | Route | Purpose |
|------|-------|---------|
| `Games` | `/games` | game history list |
| `GameDetail` | `/game/:id` | score, player table, timeline feed |
| `Players` | `/players` | ELO leaderboard (+ unranked) |
| `Player` | `/player/:id` | stats grid + ELO trend chart (recharts) |
| `Teams` | `/teams` | team table by ELO |
| `NewGame` | `/new` | 3-step game flow (select → play → save) |
| `Comparinator` | `/compare/:p1/:p2` | side-by-side player comparison |

## CONVENTIONS
- Functional components; every data page handles loading (`CircularProgress`), error (`Alert`), empty (`common.noData`)
- All strings via `useTranslation`; German keys in `src/i18n/de.json`
- MUI `sx` styling only; team colors from constants (`TEAM1_COLOR`/`TEAM2_COLOR`)
- Registered in `src/App.tsx` with `React.lazy` + `Suspense` fallback

## ANTI-PATTERNS
- **No direct Supabase calls** — use hooks
- **No stat derivation in components** — consume `AppData` from `useGames`
- **Never render email/uid** — only `display_name`/`avatar_url`
- **No custom CSS files** — MUI `sx`/`styled` only