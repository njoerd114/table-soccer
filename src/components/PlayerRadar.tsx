import { Box, Paper, Typography } from '@mui/material'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useTranslation } from 'react-i18next'

import type { AppData, PlayerStats } from '../domain/types'

/**
 * Radar profile of one player across the tracked per-position metrics,
 * normalized to 0..100 against the league extremes (legacy PropertyChart).
 */

const AXES = [
  'avgGoalsPosStriker',
  'avgGoalsPosMidfield',
  'avgGoalsPosDefense',
  'avgGoalsPosKeeper',
  'avgTimeBetweenGoals',
  'avgTimeBetweenGoalsAgainst'
] as const

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50
  return Math.round(((value - min) / (max - min)) * 100)
}

export default function PlayerRadar({
  player,
  data
}: {
  player: PlayerStats
  data: AppData
}) {
  const { t } = useTranslation()

  const series = AXES.map((key) => {
    const extremes = data.properties[key]
    if (!extremes) return { axis: t(`stats.${key}`), value: 50 }
    const value = normalize(player[key], extremes.min.value, extremes.max.value)
    return { axis: t(`stats.${key}`), value }
  })

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('stats.profile')}
      </Typography>
      <Box sx={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={series} outerRadius="70%">
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" />
            <Tooltip />
            <Radar name={player.display_name} dataKey="value" stroke="#00bcd4" fill="#00bcd4" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  )
}