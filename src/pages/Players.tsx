import { Alert, Avatar, Box, CircularProgress, List, ListItem, ListItemAvatar, ListItemButton, ListItemText, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import BestPlayers from '../components/BestPlayers'
import HandicapBadge from '../components/HandicapBadge'
import { computeHandicaps } from '../domain/handicap'
import { useActiveCompany } from '../hooks/useActiveCompany'
import { useGames } from '../hooks/useGames'

export default function Players() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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

  const players = data?.players ?? []
  const ranked = players.filter((p) => p.placementFinished).sort((a, b) => b.elo - a.elo)
  const unranked = players.filter((p) => !p.placementFinished)
  const handicaps = computeHandicaps(data?.games ?? [])

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {t('nav.players')}
      </Typography>

      {ranked.length === 0 && players.length === 0 ? (
        <Typography sx={{ p: 2 }}>{t('common.noData')}</Typography>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>{t('common.player')}</TableCell>
                  <TableCell align="right">{t('stats.handicap')}</TableCell>
                  <TableCell align="right">{t('stats.elo')}</TableCell>
                  <TableCell align="right">{t('stats.games')}</TableCell>
                  <TableCell align="right">{t('stats.winRatio')}</TableCell>
                  <TableCell align="right">{t('stats.winStreak')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ranked.map((p, i) => (
                  <TableRow key={p.id} hover onClick={() => navigate(`/player/${p.id}`)} sx={{ cursor: 'pointer' }}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Avatar src={p.avatar_url ?? undefined} sx={{ display: 'inline-flex', mr: 1, width: 28, height: 28 }}>
                        {p.display_name.charAt(0)}
                      </Avatar>
                      {p.display_name}
                    </TableCell>
                    <TableCell align="right"><HandicapBadge handicap={handicaps.get(p.id) ?? 0} /></TableCell>
                    <TableCell align="right"><b>{p.elo}</b></TableCell>
                    <TableCell align="right">{p.games}</TableCell>
                    <TableCell align="right">{Math.round(p.winRatio * 100)}%</TableCell>
                    <TableCell align="right">{p.winStreak}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {unranked.length > 0 && (
            <>
              <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                {t('players.unranked')}
              </Typography>
              <List dense>
                {unranked.map((p) => (
                  <ListItem key={p.id} disableGutters>
                    <ListItemButton onClick={() => navigate(`/player/${p.id}`)}>
                      <ListItemAvatar>
                        <Avatar src={p.avatar_url ?? undefined}>{p.display_name.charAt(0)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={p.display_name} secondary={`${p.games} ${t('stats.games')}`} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}

          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            {t('stats.best')}
          </Typography>
          {data && <BestPlayers data={data} />}
        </>
      )}
    </Box>
  )
}