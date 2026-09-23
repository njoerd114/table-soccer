import { Alert, Box, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useActiveCompany } from '../hooks/useActiveCompany'
import { useGames } from '../hooks/useGames'

export default function Teams() {
  const { t } = useTranslation()
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

  const teams = Object.values(data?.teams ?? {}).sort((a, b) => b.elo - a.elo)

  if (teams.length === 0) {
    return <Typography sx={{ p: 3 }}>{t('common.noData')}</Typography>
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {t('nav.teams')}
      </Typography>
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
    </Box>
  )
}