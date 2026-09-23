import { Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, List, ListItem, ListItemText, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { CompanyMember } from '../domain/types'
import { useActiveCompany } from '../hooks/useActiveCompany'
import { useAuth } from '../hooks/useAuth'
import { useCompanyMembers, useRenameCompany, useUpdateMemberRole } from '../hooks/useCompanies'
import { useCreateLeague, useLeagues } from '../hooks/useLeagues'
import { usePlayers } from '../hooks/usePlayers'
import { useCreateSeason, useSeasons } from '../hooks/useSeasons'

export default function Seasons() {
  const { t } = useTranslation()
  const { company } = useActiveCompany()

  const { data: seasons, isLoading: seasonsLoading, error: seasonsError } = useSeasons(company?.id ?? '')
  const { data: leagues, isLoading: leaguesLoading, error: leaguesError } = useLeagues(company?.id ?? '')

  if (!company) {
    return <Alert severity="info" sx={{ m: 2 }}>{t('company.onboarding')}</Alert>
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      <CompanyHeader companyId={company.id} companyName={company.name} />

      <SeasonForm companyId={company.id} />
      <Box sx={{ mb: 3 }}>
        {seasonsLoading ? null : seasonsError ? <Alert severity="error">{t('error.loadFailed')}</Alert> : null}
        <List dense>
          {(seasons ?? []).map((season) => (
            <ListItem key={season.id} disableGutters>
              <ListItemText
                primary={season.name}
                secondary={`${season.starts_on}${season.ends_on ? ` → ${season.ends_on}` : ' → …'}`}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      <LeagueForm companyId={company.id} />
      <List dense>
        {(leagues ?? []).map((league) => (
          <ListItem key={league.id} disableGutters>
            <ListItemText primary={league.name} />
          </ListItem>
        ))}
      </List>
      {(leaguesLoading || seasonsLoading) && <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>}
      {leaguesError && <Alert severity="error">{t('error.loadFailed')}</Alert>}

      <MembersList companyId={company.id} />
    </Box>
  )
}

function CompanyHeader({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { t } = useTranslation()
  const renameCompany = useRenameCompany()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(companyName)

  if (!editing) {
    return (
      <Typography variant="h5" sx={{ mb: 2 }}>
        {companyName} — {t('company.seasons')} & {t('company.leagues')}{' '}
        <Button size="small" onClick={() => { setName(companyName); setEditing(true) }}>
          {t('company.rename')}
        </Button>
      </Typography>
    )
  }

  const submit = () => {
    if (!name.trim()) return
    renameCompany.mutate({ companyId, name: name.trim() }, { onSuccess: () => setEditing(false) })
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
      <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
      <Button size="small" variant="contained" onClick={submit} disabled={renameCompany.isPending || !name.trim()}>
        {t('common.save')}
      </Button>
      <Button size="small" onClick={() => setEditing(false)}>{t('common.back')}</Button>
    </Box>
  )
}

const ROLE_ORDER: Record<CompanyMember['role'], number> = { owner: 0, admin: 1, member: 2 }

function MembersList({ companyId }: { companyId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: members, isLoading, error } = useCompanyMembers(companyId)
  const { data: profiles } = usePlayers()
  const updateRole = useUpdateMemberRole()

  const myRole = members?.find((m) => m.user_id === user?.id)?.role
  const canPromote = myRole === 'owner' || myRole === 'admin'

  if (isLoading) return null
  if (error) return <Alert severity="error">{t('error.loadFailed')}</Alert>

  const sorted = [...(members ?? [])].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>{t('company.members')}</Typography>
      <List dense>
        {sorted.map((member) => {
          const displayName = profiles?.find((p) => p.id === member.user_id)?.display_name ?? member.user_id
          return (
            <ListItem key={member.id} disableGutters>
              <ListItemText primary={displayName} />
              <Chip size="small" label={t(`company.role.${member.role}`)} sx={{ mr: 1 }} />
              {canPromote && member.role === 'member' && (
                <Button
                  size="small"
                  onClick={() => updateRole.mutate({ memberId: member.id, role: 'admin' })}
                  disabled={updateRole.isPending}
                >
                  {t('company.promoteToAdmin')}
                </Button>
              )}
            </ListItem>
          )
        })}
      </List>
    </Box>
  )
}

function SeasonForm({ companyId }: { companyId: string }) {
  const { t } = useTranslation()
  const createSeason = useCreateSeason()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState('')

  const submit = () => {
    if (!name.trim() || !startsOn) return
    createSeason.mutate(
      { companyId, name: name.trim(), startsOn },
      { onSuccess: () => { setOpen(false); setName(''); setStartsOn('') } }
    )
  }

  return (
    <Box>
      <Button variant="outlined" size="small" onClick={() => setOpen(true)} sx={{ mb: 1 }}>
        {t('company.addSeason')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{t('company.addSeason')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320, pb: 3 }}>
          <TextField label={t('company.seasonName')} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label={t('company.startsOn')} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          {createSeason.error && <Alert severity="error">{t('error.generic')}</Alert>}
          <Button variant="contained" onClick={submit} disabled={createSeason.isPending || !name.trim() || !startsOn}>
            {t('company.addSeason')}
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  )
}

function LeagueForm({ companyId }: { companyId: string }) {
  const { t } = useTranslation()
  const createLeague = useCreateLeague()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const submit = () => {
    if (!name.trim()) return
    createLeague.mutate(
      { companyId, name: name.trim() },
      { onSuccess: () => { setOpen(false); setName('') } }
    )
  }

  return (
    <Box>
      <Button variant="outlined" size="small" onClick={() => setOpen(true)} sx={{ mb: 1 }}>
        {t('company.addLeague')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{t('company.addLeague')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320, pb: 3 }}>
          <TextField label={t('company.leagueName')} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          {createLeague.error && <Alert severity="error">{t('error.generic')}</Alert>}
          <Button variant="contained" onClick={submit} disabled={createLeague.isPending || !name.trim()}>
            {t('company.addLeague')}
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  )
}