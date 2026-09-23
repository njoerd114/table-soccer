import { Box, Grid, Paper, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import LoginForm from '../components/LoginForm'

const FEATURES = [
  { titleKey: 'landing.featureElo', textKey: 'landing.featureEloText' },
  { titleKey: 'landing.featureLive', textKey: 'landing.featureLiveText' },
  { titleKey: 'landing.featureTeams', textKey: 'landing.featureTeamsText' }
] as const

/** Unauthenticated marketing landing page shown at "/" instead of Games. */
export default function Landing() {
  const { t } = useTranslation()

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 4, textAlign: 'center' }}>
      <Typography variant="h3" sx={{ mb: 2, fontWeight: 700 }}>
        {t('landing.heroTitle')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t('landing.heroSubtitle')}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 5 }}>
        <LoginForm />
      </Box>

      <Grid container spacing={2}>
        {FEATURES.map((feature) => (
          <Grid size={{ xs: 12, sm: 4 }} key={feature.titleKey}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                {t(feature.titleKey)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(feature.textKey)}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
