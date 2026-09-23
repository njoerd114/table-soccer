import { Alert, Box, Button } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../hooks/useAuth'

/** Google-only sign-in form. Used in the AppBar dialog and NewGame. */
export default function LoginForm() {
  const { t } = useTranslation()
  const { signInWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const google = async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 280 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Button variant="contained" onClick={() => void google()} fullWidth>
        {t('auth.loginGoogle')}
      </Button>
    </Box>
  )
}