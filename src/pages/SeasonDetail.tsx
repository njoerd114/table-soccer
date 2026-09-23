import { Alert, Avatar, Box, CircularProgress, List, ListItem, ListItemAvatar, ListItemButton, ListItemText, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import HandicapBadge from '../components/HandicapBadge'
import { computeHandicaps } from '../domain/handicap'
import { useActiveCompany } from '../hooks/useActiveCompany'
import { useGames } from '../hooks/useGames'
import { useSeasons } from '../hooks/useSeasons'

export default function SeasonDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const { company } = useActiveCompany()
  const { data: seasons, isLoading: seasonsLoading, error: seasonsError } = useSeasons(company?.id ?? '')
  const { data, isLoading: gamesLoading, error: gamesError } = useGames(
    company && id ? { companyId: company.id, seasonId: id } : undefined
  )

  if (!company) {
    return <Alert severity="info" sx={{ m: 2 }}>{t('company.onboarding')}</Alert>
  }

  if (seasonsLoading || gamesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <CircularProgress />
      </div>
    )
  }

  if (seasonsError || gamesError) {
    return <Alert severity="error">{t('error.loadFailed')}</Alert>
  }

  const season = seasons?.find((entry) => entry.id === id)

  if (!season) {
    return <Alert severity="warning">{t('common.noData')}</Alert>
  }

  const players = data?.players ?? []
  const ranked = players.filter((player) => player.placementFinished).sort((a, b) => b.elo - a.elo)
  const unranked = players.filter((player) => !player.placementFinished)
  const handicaps = computeHandicaps(data?.games ?? [])
  const teams = Object.values(data?.teams ?? {}).sort((a, b) => b.elo - a.elo)

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>{season.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {season.starts_on}{season.ends_on ? ` → ${season.ends_on}` : ' → …'}
      </Typography>

      {players.length === 0 ? (
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
                {ranked.map((player, index) => (
                  <TableRow key={player.id} hover onClick={() => navigate(`/player/${player.id}`)} sx={{ cursor: 'pointer' }}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Avatar src={player.avatar_url ?? undefined} sx={{ display: 'inline-flex', mr: 1, width: 28, height: 28 }}>
                        {player.display_name.charAt(0)}
                      </Avatar>
                      {player.display_name}
                    </TableCell>
                    <TableCell align="right"><HandicapBadge handicap={handicaps.get(player.id) ?? 0} /></TableCell>
                    <TableCell align="right"><b>{player.elo}</b></TableCell>
                    <TableCell align="right">{player.games}</TableCell>
                    <TableCell align="right">{Math.round(player.winRatio * 100)}%</TableCell>
                    <TableCell align="right">{player.winStreak}</TableCell>
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
                {unranked.map((player) => (
                  <ListItem key={player.id} disableGutters>
                    <ListItemButton onClick={() => navigate(`/player/${player.id}`)}>
                      <ListItemAvatar>
                        <Avatar src={player.avatar_url ?? undefined}>{player.display_name.charAt(0)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={player.display_name} secondary={`${player.games} ${t('stats.games')}`} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}

          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            {t('nav.teams')}
          </Typography>
          {teams.length === 0 ? (
            <Typography sx={{ p: 2 }}>{t('common.noData')}</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.team')}</TableCell>
                    <TableCell align="right">{t('stats.elo')}</TableCell>
                    <TableCell align="right">{t('stats.games')}</TableCell>
                    <TableCell align="right">{t('stats.wins')}</TableCell>
                    <TableCell align="right">{t('stats.losses')}</TableCell>
                    <TableCell align="right">{t('stats.winRatio')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell>
                        {team.attack.name} / {team.defense.name}
                      </TableCell>
                      <TableCell align="right"><b>{team.elo}</b></TableCell>
                      <TableCell align="right">{team.games}</TableCell>
                      <TableCell align="right">{team.wins}</TableCell>
                      <TableCell align="right">{team.losses}</TableCell>
                      <TableCell align="right">{Math.round(team.winRatio * 100)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  )
}
