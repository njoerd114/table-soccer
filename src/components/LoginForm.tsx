import { Alert, Box, Button, CircularProgress, Divider, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../hooks/useAuth'

/** Email/password + Google sign-in form. Used in the AppBar dialog and NewGame. */
export default function LoginForm() {
  const { t } = useTranslation()
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmail(email, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const google = async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 280 }}>
      <TextField
        label="E-Mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        fullWidth
        autoFocus
      />
      <TextField
        label={t('auth.password')}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        fullWidth
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" variant="contained" disabled={submitting} fullWidth>
        {submitting ? <CircularProgress size={20} /> : t('auth.signIn')}
      </Button>
      <Divider>{t('auth.or')}</Divider>
      <Button variant="outlined" onClick={() => void google()} fullWidth>
        {t('auth.loginGoogle')}
      </Button>
      <Typography variant="caption" color="text.secondary">
        {t('auth.hint')}
      </Typography>
    </Box>
  )
}