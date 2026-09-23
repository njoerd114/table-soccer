import { Alert, Avatar, Box, CircularProgress, Divider, List, ListItemAvatar, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import GameFilters, { type GameFilterState } from '../components/GameFilters'
import { TEAM1_COLOR, TEAM2_COLOR } from '../domain/constants'
import { useActiveCompany } from '../hooks/useActiveCompany'
import { useGames } from '../hooks/useGames'

export default function Games() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { company } = useActiveCompany()
  const [filters, setFilters] = useState<GameFilterState>({ seasonId: null, leagueId: null })

  const { data, isLoading, error } = useGames(
    company ? { companyId: company.id, seasonId: filters.seasonId, leagueId: filters.leagueId } : undefined
  )

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

  const games = data?.games ?? []

  if (games.length === 0) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
        {company && <GameFilters companyId={company.id} value={filters} onChange={setFilters} />}
        <Typography sx={{ p: 2 }}>{t('common.noData')}</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      {company && <GameFilters companyId={company.id} value={filters} onChange={setFilters} />}
      <List sx={{ width: '100%' }}>
        {games.map((game) => (
          <div key={game.id}>
            <ListItemButton onClick={() => navigate(`/game/${game.id}`)}>
              <ListItemAvatar>
                <Avatar src={game.winnerAttack.photoURL} sx={{ bgcolor: TEAM1_COLOR }}>
                  {game.winnerAttack.name.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <span>
                    <b style={{ color: TEAM1_COLOR }}>
                      {game.winnerAttack.name} & {game.winnerDefense.name}
                    </b>
                    {' vs '}
                    <span style={{ color: TEAM2_COLOR }}>
                      {game.loserAttack.name} & {game.loserDefense.name}
                    </span>
                  </span>
                }
                secondary={
                  <>
                    {game.duration}s · {game.startdate.toLocaleDateString('de-DE')}
                  </>
                }
              />
              <Typography variant="h6" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {game.winnerScore} : {game.loserScore}
              </Typography>
            </ListItemButton>
            <Divider component="li" />
          </div>
        ))}
      </List>
    </Box>
  )
}