import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useActiveCompany } from '../hooks/useActiveCompany'
import { useCompanies, useCreateCompany } from '../hooks/useCompanies'

/**
 * Company onboarding + switcher. A user with no companies is prompted to
 * create one; otherwise the active company can be selected from the toolbar.
 */
export default function CompanySwitcher() {
  const { t } = useTranslation()
  const { company, setCompany } = useActiveCompany()
  const { data: companies, isLoading, error } = useCompanies()
  const createCompany = useCreateCompany()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  // Fixes FAB/NewGame showing the onboarding dialog for users with existing companies.
  useEffect(() => {
    const first = companies?.[0]
    if (!company && first) {
      setCompany(first)
    }
  }, [company, companies, setCompany])

  const submit = () => {
    if (!name.trim()) return
    createCompany.mutate(
      { name: name.trim() },
      {
        onSuccess: (created) => {
          setCompany(created)
          setOpen(false)
          setName('')
        }
      }
    )
  }

  if (isLoading) {
    return null
  }

  if (!companies || companies.length === 0) {
    return (
      <Box>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{t('error.loadFailed')}</Alert>}
        <Dialog open onClose={() => {}}>
          <DialogTitle>{t('company.onboarding')}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320, pb: 3 }}>
            <Typography variant="body2">{t('company.onboardingText')}</Typography>
            <TextField
              label={t('company.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              fullWidth
              autoFocus
            />
            {createCompany.error && <Alert severity="error">{t('error.generic')}</Alert>}
            <Button variant="contained" onClick={submit} disabled={createCompany.isPending || !name.trim()}>
              {t('company.create')}
            </Button>
          </DialogContent>
        </Dialog>
      </Box>
    )
  }

  const active = company ?? companies[0] ?? null

  return (
    <>
      <TextField
        select
        size="small"
        value={active?.id ?? ''}
        onChange={(e) => {
          if (e.target.value === '__create__') {
            setOpen(true)
          } else {
            setCompany(companies.find((c) => c.id === e.target.value) ?? null)
          }
        }}
        sx={{ minWidth: 160, mr: 2, '& .MuiInputBase-root': { color: 'inherit' } }}
      >
        {companies.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name}
          </MenuItem>
        ))}
        <MenuItem value="__create__">+ {t('company.create')}</MenuItem>
      </TextField>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{t('company.create')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320, pb: 3 }}>
          <TextField
            label={t('company.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            fullWidth
            autoFocus
          />
          {createCompany.error && <Alert severity="error">{t('error.generic')}</Alert>}
          <Button variant="contained" onClick={submit} disabled={createCompany.isPending || !name.trim()}>
            {t('company.create')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}