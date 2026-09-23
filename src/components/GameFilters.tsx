import { Box, MenuItem, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useLeagues } from '../hooks/useLeagues'
import { useSeasons } from '../hooks/useSeasons'

export type GameFilterState = {
  seasonId: string | null
  leagueId: string | null
}

export default function GameFilters({
  companyId,
  value,
  onChange
}: {
  companyId: string
  value: GameFilterState
  onChange: (next: GameFilterState) => void
}) {
  const { t } = useTranslation()
  const { data: seasons } = useSeasons(companyId)
  const { data: leagues } = useLeagues(companyId)

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
      <TextField
        select
        size="small"
        label={t('company.seasons')}
        value={value.seasonId ?? ''}
        onChange={(e) => onChange({ ...value, seasonId: e.target.value || null })}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">{t('filter.allSeasons')}</MenuItem>
        {(seasons ?? []).map((season) => (
          <MenuItem key={season.id} value={season.id}>
            {season.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label={t('company.leagues')}
        value={value.leagueId ?? ''}
        onChange={(e) => onChange({ ...value, leagueId: e.target.value || null })}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">{t('filter.allLeagues')}</MenuItem>
        {(leagues ?? []).map((league) => (
          <MenuItem key={league.id} value={league.id}>
            {league.name}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )
}