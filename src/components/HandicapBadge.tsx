import { Chip } from '@mui/material'
import { useTranslation } from 'react-i18next'

/**
 * Golf-style handicap chip. Lower is better; a negative value means the
 * player gives goals, a positive value means they receive goals.
 */
export default function HandicapBadge({ handicap }: { handicap: number }) {
  const { t } = useTranslation()

  const label = handicap === 0 ? '0' : handicap > 0 ? `+${handicap}` : `${handicap}`
  const color = handicap < 0 ? 'primary' : handicap > 0 ? 'secondary' : 'default'

  return <Chip size="small" color={color} variant="outlined" label={`${t('stats.handicap')} ${label}`} />
}