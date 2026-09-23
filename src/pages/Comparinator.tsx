import { Alert, Avatar, Box, CircularProgress, Grid, LinearProgress, Paper, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import type { PlayerStats } from '../domain/types'
import { useGames } from '../hooks/useGames'

const METRICS = ['elo', 'winRatio', 'goals', 'games', 'winStreak'] as const

const metricValue = (player: PlayerStats, key: (typeof METRICS)[number]): number => {
  if (key === 'winRatio') return Math.round(player[key] * 100)
  return player[key]
}

export default function Comparinator() {
  const { t } = useTranslation()
  const { p1, p2 } = useParams()
  const { data, isLoading, error } = useGames()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <CircularProgress />
      </div>
    )
  }

  if (error) {
    return <Alert severity="error">{t('error.loadFailed')}</Alert>
  }

  const a = data?.players.find((p) => p.id === p1)
  const b = data?.players.find((p) => p.id === p2)

  if (!a || !b) {
    return <Alert severity="warning" sx={{ m: 2 }}>{t('common.noData')}</Alert>
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ textAlign: 'center', mb: 3 }}>
        {t('stats.compare')}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Avatar src={a.avatar_url ?? undefined} sx={{ width: 56, height: 56, mx: 'auto', mb: 1 }}>
            {a.display_name.charAt(0)}
          </Avatar>
          <Typography variant="h6">{a.display_name}</Typography>
        </Box>
        <Typography variant="h5">vs</Typography>
        <Box sx={{ textAlign: 'center' }}>
          <Avatar src={b.avatar_url ?? undefined} sx={{ width: 56, height: 56, mx: 'auto', mb: 1 }}>
            {b.display_name.charAt(0)}
          </Avatar>
          <Typography variant="h6">{b.display_name}</Typography>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {METRICS.map((metric) => {
          const aValue = metricValue(a, metric)
          const bValue = metricValue(b, metric)
          const max = Math.max(aValue, bValue, 1)
          return (
            <Grid size={12} key={metric}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
                  {t(`stats.${metric}`)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body1" sx={{ width: 48, textAlign: 'right' }}>
                    <b>{aValue}</b>
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(aValue / max) * 100}
                    sx={{ flex: 1, '& .MuiLinearProgress-bar': { bgcolor: '#00bcd4' } }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(bValue / max) * 100}
                    sx={{ flex: 1, '& .MuiLinearProgress-bar': { bgcolor: '#ff4081' } }}
                  />
                  <Typography variant="body1" sx={{ width: 48 }}>
                    <b>{bValue}</b>
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}