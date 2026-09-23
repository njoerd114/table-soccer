import { Alert, Avatar, Box, CircularProgress, Grid, Paper, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import HandicapBadge from '../components/HandicapBadge'
import PlayerRadar from '../components/PlayerRadar'
import { DEFAULT_ELO } from '../domain/constants'
import { computePlayerHandicap } from '../domain/handicap'
import { useActiveCompany } from '../hooks/useActiveCompany'
import { useGames } from '../hooks/useGames'

export default function Player() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { company } = useActiveCompany()
  const { data, isLoading, error } = useGames(company ? { companyId: company.id } : undefined)

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

  const player = data?.players.find((p) => p.id === id)

  if (!player) {
    return <Alert severity="warning" sx={{ m: 2 }}>{t('common.noData')}</Alert>
  }

  const statKeys = [
    'wins',
    'losses',
    'games',
    'winStreak',
    'longestWinStreak',
    'winRatio',
    'goals',
    'ownGoals',
    'avgGoalsPosStriker',
    'avgGoalsPosMidfield',
    'avgGoalsPosDefense',
    'avgGoalsPosKeeper',
    'avgTimeBetweenGoals',
    'avgTimeBetweenGoalsAgainst'
  ] as const

  const statValue = (key: (typeof statKeys)[number]): string => {
    const value = player[key]
    if (key === 'winRatio') return `${Math.round(value * 100)}%`
    if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(1)
    return String(value)
  }

  // Build ELO progression: chronological games, track cumulative ELO.
  const chronological = (data?.games ?? [])
    .slice()
    .sort((a, b) => a.startdate.getTime() - b.startdate.getTime())

  let elo = DEFAULT_ELO
  const series: Array<{ i: number; elo: number }> = []
  for (const game of chronological) {
    const entry = game.players[player.id]
    if (entry) {
      elo = entry.elo
      series.push({ i: series.length, elo })
    }
  }

  const handicap = computePlayerHandicap(player.id, data?.games ?? [])

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar src={player.avatar_url ?? undefined} sx={{ width: 64, height: 64 }}>
          {player.display_name.charAt(0)}
        </Avatar>
        <div>
          <Typography variant="h4">{player.display_name}</Typography>
          <Typography variant="body1" color="text.secondary">
            {t('stats.elo')}: <b>{player.elo}</b>
            {player.eloGain !== 0 ? ` (${player.eloGain > 0 ? '+' : ''}${player.eloGain})` : ''}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <HandicapBadge handicap={handicap} />
          </Box>
        </div>
      </Box>

      <Grid container spacing={1} sx={{ mb: 3 }}>
        {statKeys.map((key) => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={key}>
            <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" component="div">
                {t(`stats.${key}`)}
              </Typography>
              <Typography variant="h6">{statValue(key)}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {series.length >= 3 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t('stats.elo')}
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={series}>
              <XAxis dataKey="i" hide />
              <YAxis domain={['dataMin - 20', 'dataMax + 20']} width={50} />
              <Tooltip />
              <Line type="monotone" dataKey="elo" stroke="#00bcd4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {data && <PlayerRadar player={player} data={data} />}
    </Box>
  )
}