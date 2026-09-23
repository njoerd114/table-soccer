import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { AppData, PlayerStats } from '../domain/types'

/**
 * Leaderboard rows per tracked metric: for each property the app tracks
 * (min/max per stat), show the player at the extreme. Some metrics are
 * "inverted" — lower is better (e.g. goals conceded, time between goals).
 */

const METRICS = [
  { key: 'avgGoalsPosStriker', invert: false },
  { key: 'avgGoalsPosMidfield', invert: false },
  { key: 'avgGoalsPosDefense', invert: false },
  { key: 'avgGoalsPosKeeper', invert: false },
  { key: 'avgTimeBetweenGoals', invert: false },
  { key: 'avgTimeBetweenGoalsAgainst', invert: true }
] as const

function bestPlayer(
  metric: (typeof METRICS)[number],
  data: AppData
): { player: PlayerStats | undefined; value: number } | undefined {
  const extremes = data.properties[metric.key]
  if (!extremes) return undefined

  const extreme = metric.invert ? extremes.min : extremes.max
  const player = data.players.find((p) => p.id === extreme.id)
  return player ? { player, value: extreme.value } : undefined
}

export default function BestPlayers({ data }: { data: AppData }) {
  const { t } = useTranslation()

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('stats.metric')}</TableCell>
            <TableCell align="right">{t('stats.best')}</TableCell>
            <TableCell align="right">{t('stats.value')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {METRICS.map((metric) => {
            const best = bestPlayer(metric, data)
            return (
              <TableRow key={metric.key}>
                <TableCell>{t(`stats.${metric.key}`)}</TableCell>
                <TableCell align="right">{best?.player?.display_name ?? '—'}</TableCell>
                <TableCell align="right">
                  {best ? Number(best.value.toFixed(1)) : '—'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}