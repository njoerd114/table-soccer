import { Alert, Box, Button, Chip, CircularProgress, List, ListItem, ListItemText, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { Company, CompanyMember } from '../domain/types'
import { useCompanies, useCompanyMembers, useUpdateMemberRole } from '../hooks/useCompanies'
import { usePlayers } from '../hooks/usePlayers'
import { useIsSuperAdmin } from '../hooks/useSuperAdmin'

const ROLE_ORDER: Record<CompanyMember['role'], number> = { owner: 0, admin: 1, member: 2 }
const ALL_ROLES: readonly CompanyMember['role'][] = ['owner', 'admin', 'member']

/** Cross-company view for the platform super admin only. Every render is server-gated by am_i_super_admin(). */
export default function SuperAdmin() {
  const { t } = useTranslation()
  const { data: isSuperAdmin, isLoading: checkingAccess } = useIsSuperAdmin()
  const { data: companies, isLoading: companiesLoading, error } = useCompanies()

  if (checkingAccess) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <CircularProgress />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return <Alert severity="error" sx={{ m: 2 }}>{t('superAdmin.forbidden')}</Alert>
  }

  if (companiesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <CircularProgress />
      </div>
    )
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{t('error.loadFailed')}</Alert>
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>{t('superAdmin.title')}</Typography>
      {(companies ?? []).map((company) => (
        <CompanyRow key={company.id} company={company} />
      ))}
    </Box>
  )
}

function CompanyRow({ company }: { company: Company }) {
  const { t } = useTranslation()
  const { data: members } = useCompanyMembers(company.id)
  const { data: profiles } = usePlayers()
  const updateRole = useUpdateMemberRole()

  const sorted = [...(members ?? [])].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1">{company.name}</Typography>
      <List dense>
        {sorted.map((member) => {
          const displayName = profiles?.find((p) => p.id === member.user_id)?.display_name ?? member.user_id
          return (
            <ListItem key={member.id} disableGutters>
              <ListItemText primary={displayName} />
              <Chip size="small" label={t(`company.role.${member.role}`)} sx={{ mr: 1 }} />
              {ALL_ROLES.filter((role) => role !== member.role).map((role) => (
                <Button
                  key={role}
                  size="small"
                  onClick={() => updateRole.mutate({ memberId: member.id, role })}
                  disabled={updateRole.isPending}
                >
                  {t(`company.role.${role}`)}
                </Button>
              ))}
            </ListItem>
          )
        })}
      </List>
    </Box>
  )
}
