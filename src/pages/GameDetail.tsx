import { Alert, Box, Chip, CircularProgress, Link, List, ListItem, ListItemText, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useParams } from 'react-router-dom'

import { TEAM1_COLOR, TEAM2_COLOR } from '../domain/constants'
import { useGames } from '../hooks/useGames'

export default function GameDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
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

  const game = data?.games.find((g) => g.id === id)

  if (!game) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">{t('common.noData')}</Alert>
        <Link component={RouterLink} to="/games" sx={{ mt: 2, display: 'inline-block' }}>
          ← {t('nav.games')}
        </Link>
      </Box>
    )
  }

  const team1Color = TEAM1_COLOR
  const team2Color = TEAM2_COLOR

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ textAlign: 'center', mb: 1 }}>
        <b style={{ color: team1Color }}>
          {game.winnerAttack.name} & {game.winnerDefense.name}
        </b>{' '}
        <span style={{ fontSize: '1.4em' }}>
          {game.winnerScore} : {game.loserScore}
        </span>{' '}
        <span style={{ color: team2Color }}>
          {game.loserAttack.name} & {game.loserDefense.name}
        </span>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
        {game.duration}s · {game.startdate.toLocaleString('de-DE')}
      </Typography>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.player')}</TableCell>
              <TableCell align="right">{t('stats.goals')}</TableCell>
              <TableCell align="right">{t('stats.ownGoals')}</TableCell>
              <TableCell align="right">{t('stats.elo')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[game.winnerAttack, game.winnerDefense, game.loserAttack, game.loserDefense].map(
              (player) => {
                const rich = game.players[player.id]
                const elo = rich?.elo
                const eloGain = rich?.eloGain
                return (
                  <TableRow key={player.id}>
                    <TableCell>
                      <span style={{ color: player.id === game.winnerAttack.id || player.id === game.winnerDefense.id ? team1Color : team2Color }}>
                        {player.name}
                      </span>
                    </TableCell>
                    <TableCell align="right">{player.score ?? 0}</TableCell>
                    <TableCell align="right">{player.ownGoals ?? 0}</TableCell>
                    <TableCell align="right">
                      {elo !== undefined ? `${elo} (${eloGain !== undefined && eloGain >= 0 ? '+' : ''}${eloGain ?? ''})` : '—'}
                    </TableCell>
                  </TableRow>
                )
              }
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('game.timeline')}
      </Typography>
      <List dense>
        {game.timeline.map((entry, i) => (
          <ListItem key={`goal-${entry.time}-${i}`} disableGutters>
            <ListItemText
              primary={
                <>
                  <b>{entry.name}</b> · {t(`position.${entry.position}`)}
                  {entry.own_goal ? (
                    <Chip label={t('stats.ownGoals')} color="secondary" size="small" sx={{ ml: 1 }} />
                  ) : null}
                </>
              }
              secondary={`${entry.time}s · ${t('game.score')} ${entry.score[0]} : ${entry.score[1]}`}
            />
          </ListItem>
        ))}
        {game.annotations.map((annotation, i) => (
          <ListItem key={`annotation-${annotation.time}-${i}`} disableGutters>
            <ListItemText
              primary={
                <Chip
                  size="small"
                  variant="outlined"
                  color={annotation.team === 1 ? 'primary' : 'secondary'}
                  label={`${t('common.team')} ${annotation.team} · ${t(`game.${annotation.type === 'ball_out' ? 'ballOut' : 'cornerBall'}`)}`}
                />
              }
              secondary={`${annotation.time}s`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  )
}