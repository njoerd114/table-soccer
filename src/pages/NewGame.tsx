import { Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, Grid, MenuItem, Paper, Switch, TextField, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import LoginForm from '../components/LoginForm'
import {
  ACTIVE_GAME_STEP,
  GAME_END_STEP,
  GUEST,
  POSITION_DEFENSE,
  POSITION_KEEPER,
  POSITION_MIDFIELD,
  POSITION_STRIKER,
  SELECT_PLAYERS_STEP,
  TEAM1_COLOR,
  TEAM2_COLOR,
  type Position
} from '../domain/constants'
import { getScore } from '../domain/elo'
import type { Scores8 } from '../domain/elo'
import { computeHandicaps, matchAllowance } from '../domain/handicap'
import type { GameAnnotation, GameAnnotationType, GameRecord, TimelineEvent } from '../domain/types'
import { useActiveCompany } from '../hooks/useActiveCompany'
import { useAuth } from '../hooks/useAuth'
import { useCompanies } from '../hooks/useCompanies'
import { useCreateGame } from '../hooks/useCreateGame'
import { useGames } from '../hooks/useGames'
import { useLeagues } from '../hooks/useLeagues'
import { usePlayers } from '../hooks/usePlayers'
import { useSeasons } from '../hooks/useSeasons'
import { useUpsertPlayerProfile } from '../hooks/useUpsertPlayerProfile'
import { queryKeys } from '../lib/queryKeys'
import { createEndMessage } from '../lib/slack'

type Step = typeof SELECT_PLAYERS_STEP | typeof ACTIVE_GAME_STEP | typeof GAME_END_STEP

/**
 * Slot 0 = Team 1 Attack, slot 1 = Team 1 Defense,
 * slot 2 = Team 2 Attack, slot 3 = Team 2 Defense.
 * Slot parity drives the transformer's attack/defense stats.
 */
const SLOTS = [
  { index: 0, team: 1, role: 'attack' },
  { index: 1, team: 1, role: 'defense' },
  { index: 2, team: 2, role: 'attack' },
  { index: 3, team: 2, role: 'defense' }
] as const

/** Scoring rows per role, mirroring the legacy PlayerButton two-click areas. */
const ROWS_BY_ROLE = {
  attack: [
    { position: POSITION_STRIKER, count: 3 },
    { position: POSITION_MIDFIELD, count: 5 }
  ],
  defense: [
    { position: POSITION_DEFENSE, count: 2 },
    { position: POSITION_KEEPER, count: 1 }
  ]
} as const satisfies Record<'attack' | 'defense', readonly { position: Position; count: number }[]>

const initialScores: Scores8 = [0, 0, 0, 0, 0, 0, 0, 0]

export default function NewGame() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { user } = useAuth()
  const { company } = useActiveCompany()
  const { data: companies } = useCompanies()
  const { data: profiles, isLoading: profilesLoading } = usePlayers()
  const { data: seasons } = useSeasons(company?.id ?? '')
  const { data: leagues } = useLeagues(company?.id ?? '')
  const createGame = useCreateGame()

  const [step, setStep] = useState<Step>(SELECT_PLAYERS_STEP)
  const [playerIds, setPlayerIds] = useState<readonly (string | undefined)[]>([undefined, undefined, undefined, undefined])
  const [opponentCompanyId, setOpponentCompanyId] = useState<string | null>(null)
  const [seasonId, setSeasonId] = useState<string | null>(null)
  const [leagueId, setLeagueId] = useState<string | null>(null)
  const [scores, setScores] = useState<Scores8>(initialScores)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [annotations, setAnnotations] = useState<GameAnnotation[]>([])
  const [startdate, setStartdate] = useState<number>(0)
  const [ownGoalMode, setOwnGoalMode] = useState(false)
  const [hint, setHint] = useState<{ kind: 'serve' | 'ballOut' | 'cornerBall'; team: 1 | 2 } | null>(null)

  if (!user) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', p: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t('auth.loginRequired')}
        </Typography>
        <LoginForm />
      </Box>
    )
  }

  if (!company) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', p: 4 }}>
        <Typography variant="h6">{t('company.onboarding')}</Typography>
        <LoginForm />
      </Box>
    )
  }

  const myProfile = profiles?.find((p) => p.id === user.id)

  if (!profilesLoading && !myProfile) {
    return <CreatePlayerProfile />
  }

  const assignToSlot = (slotIndex: number) => (id: string) => {
    setPlayerIds((current) => {
      if (current[slotIndex] === id) {
        const next = [...current]
        next[slotIndex] = undefined
        return next
      }
      const next = [...current]
      next[slotIndex] = id
      return next
    })
  }

  const startGame = () => {
    setStartdate(Date.now())
    setStep(ACTIVE_GAME_STEP)
  }

  const addGoal = (slotIndex: number, position: Position) => {
    const id = playerIds[slotIndex]
    if (!id) return

    // oxlint-disable-next-line react/purity -- Date.now() only in click handlers
    const time = Math.floor((Date.now() - startdate) / 1000)
    const event: TimelineEvent = { player_id: id, index: slotIndex, position, time, own_goal: ownGoalMode }

    setTimeline((current) => [...current, event])
    setScores((current) => {
      const next = [...current] as Scores8
      if (ownGoalMode) {
        next[slotIndex + 4] = (next[slotIndex + 4] ?? 0) + 1
      } else {
        next[slotIndex] = (next[slotIndex] ?? 0) + 1
      }
      return next
    })

    const scoringTeam = slotIndex < 2 ? 1 : 2
    const servingTeam = ownGoalMode ? scoringTeam : (scoringTeam === 1 ? 2 : 1)
    setHint({ kind: 'serve', team: servingTeam })
  }

  const addAnnotation = (team: 1 | 2, type: GameAnnotationType) => {
    // oxlint-disable-next-line react/purity -- Date.now() only in click handlers
    const time = Math.floor((Date.now() - startdate) / 1000)
    setAnnotations((current) => [...current, { team, type, time }])
    setHint({ kind: type === 'ball_out' ? 'ballOut' : 'cornerBall', team })
  }

  const undoLastGoal = () => {
    setTimeline((current) => {
      const last = current[current.length - 1]
      if (!last) return current

      setScores((s) => {
        const next = [...s] as Scores8
        if (last.own_goal) {
          next[last.index + 4] = Math.max(0, (next[last.index + 4] ?? 0) - 1)
        } else {
          next[last.index] = Math.max(0, (next[last.index] ?? 0) - 1)
        }
        return next
      })

      return current.slice(0, -1)
    })
  }

  const finishGame = () => {
    const lineup = playerIds as readonly string[]
    if (lineup.some((id) => !id)) return

    createGame.mutate(
      {
        players: [lineup[0], lineup[1], lineup[2], lineup[3]] as [string, string, string, string],
        scores,
        // oxlint-disable-next-line react/purity -- Date.now() only in click handlers
        duration: Math.floor((Date.now() - startdate) / 1000),
        timeline,
        annotations,
        company_id: company.id,
        opponent_company_id: opponentCompanyId,
        season_id: seasonId,
        league_id: leagueId
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.games })
          await postToSlackIfConfigured()
          navigate('/')
        }
      }
    )
  }

  const postToSlackIfConfigured = async () => {
    const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL
    if (!webhookUrl) return

    try {
      const lineup = playerIds as readonly string[]
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, { name: p.display_name, elo: 1500 }]))
      const gameRecord: GameRecord = {
        id: 'local',
        startdate,
        duration: Math.floor((Date.now() - startdate) / 1000),
        players: [lineup[0], lineup[1], lineup[2], lineup[3]] as GameRecord['players'],
        scores,
        timeline,
        company_id: company.id,
        opponent_company_id: opponentCompanyId,
        season_id: seasonId,
        league_id: leagueId,
        created_at: new Date().toISOString()
      }
      await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(createEndMessage(gameRecord, profileMap))
      })
    } catch {
      // Slack posting is best-effort; never crash the flow.
    }
  }

  const [team1Score, team2Score] = getScore(scores)

  const nameOf = (id: string | undefined): string => {
    if (!id) return ''
    if (id === GUEST) return 'Gast'
    return profiles?.find((p) => p.id === id)?.display_name ?? '?'
  }

  const allSlotsFilled = playerIds.every((id) => id !== undefined)
  const selectedLeague = leagues?.find((l) => l.id === leagueId)
  const isAdvancedMode = selectedLeague?.game_mode === 'advanced'

  if (profilesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <CircularProgress />
      </div>
    )
  }

  if (step === SELECT_PLAYERS_STEP) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          {t('game.selectPlayers')}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              select
              size="small"
              fullWidth
              label={t('game.opponentCompany')}
              value={opponentCompanyId ?? ''}
              onChange={(e) => setOpponentCompanyId(e.target.value || null)}
            >
              <MenuItem value="">{t('game.sameCompany')}</MenuItem>
              {(companies ?? [])
                .filter((c) => c.id !== company.id)
                .map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              select
              size="small"
              fullWidth
              label={t('company.seasons')}
              value={seasonId ?? ''}
              onChange={(e) => setSeasonId(e.target.value || null)}
            >
              <MenuItem value="">{t('filter.allSeasons')}</MenuItem>
              {(seasons ?? []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              select
              size="small"
              fullWidth
              label={t('company.leagues')}
              value={leagueId ?? ''}
              onChange={(e) => setLeagueId(e.target.value || null)}
            >
              <MenuItem value="">{t('filter.allLeagues')}</MenuItem>
              {(leagues ?? []).map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {SLOTS.map((slot) => {
            const color = slot.team === 1 ? TEAM1_COLOR : TEAM2_COLOR
            return (
              <Grid size={{ xs: 6 }} key={slot.index}>
                <Paper variant="outlined" sx={{ p: 2, borderColor: color, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle2" sx={{ color, mb: 1 }}>
                    {t('common.team')} {slot.team} · {t(`game.role.${slot.role}`)}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {(profiles ?? []).map((profile) => {
                      const active = playerIds[slot.index] === profile.id
                      return (
                        <Chip
                          key={profile.id}
                          label={profile.display_name}
                          onClick={() => assignToSlot(slot.index)(profile.id)}
                          color={active ? 'primary' : 'default'}
                          variant={active ? 'filled' : 'outlined'}
                        />
                      )
                    })}
                    <Chip
                      label="Gast"
                      onClick={() => assignToSlot(slot.index)(GUEST)}
                      color={playerIds[slot.index] === GUEST ? 'primary' : 'default'}
                      variant={playerIds[slot.index] === GUEST ? 'filled' : 'outlined'}
                    />
                  </Box>
                </Paper>
              </Grid>
            )
          })}
        </Grid>

        <Button variant="contained" disabled={!allSlotsFilled} onClick={startGame}>
          {t('game.startNew')}
        </Button>
      </Box>
    )
  }

  if (step === ACTIVE_GAME_STEP) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', p: 2 }}>
        <Typography variant="h3" sx={{ textAlign: 'center', mb: 1 }}>
          <span style={{ color: TEAM1_COLOR }}>{team1Score}</span> :{' '}
          <span style={{ color: TEAM2_COLOR }}>{team2Score}</span>
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
          <Typography variant="body2">{t('game.ownGoal')}</Typography>
          <Switch checked={ownGoalMode} onChange={(e) => setOwnGoalMode(e.target.checked)} />
        </Box>

        {hint && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t(`game.hint.${hint.kind}`, { team: hint.team })}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {SLOTS.map((slot) => {
            const color = slot.team === 1 ? TEAM1_COLOR : TEAM2_COLOR
            const rows = ROWS_BY_ROLE[slot.role]
            return (
              <Grid size={{ xs: 6 }} key={slot.index}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle2" sx={{ color, mb: 1 }}>
                    {nameOf(playerIds[slot.index])} · {t(`game.role.${slot.role}`)}
                  </Typography>
                  {rows.map((row) => (
                    <Button
                      key={row.position}
                      fullWidth
                      variant="outlined"
                      sx={{ mb: 1, bgcolor: color, color: 'white', '&:hover': { bgcolor: color } }}
                      onClick={() => addGoal(slot.index, row.position)}
                    >
                      {t(`position.${row.position}`)} ({row.count})
                    </Button>
                  ))}
                </Paper>
              </Grid>
            )
          })}
        </Grid>

        {isAdvancedMode && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {([1, 2] as const).map((team) => (
              <Grid size={{ xs: 6 }} key={team}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="text" fullWidth onClick={() => addAnnotation(team, 'ball_out')}>
                    {t('game.ballOut')}
                  </Button>
                  <Button size="small" variant="text" fullWidth onClick={() => addAnnotation(team, 'corner_ball')}>
                    {t('game.cornerBall')}
                  </Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button variant="outlined" onClick={undoLastGoal} disabled={timeline.length === 0}>
            {t('game.undo')}
          </Button>
          <Button variant="contained" color="secondary" onClick={() => setStep(GAME_END_STEP)}>
            {t('game.end')}
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 4, textAlign: 'center' }}>
      <Typography variant="h3" sx={{ mb: 1 }}>
        {team1Score} : {team2Score}
      </Typography>
      <Typography variant="body1" sx={{ mb: 1 }}>
        {nameOf(playerIds[0])} & {nameOf(playerIds[1])} vs {nameOf(playerIds[2])} & {nameOf(playerIds[3])}
      </Typography>

      <HandicapAllowance playerIds={playerIds} />

      {createGame.error && <Alert severity="error" sx={{ mb: 2 }}>{t('error.generic')}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button variant="outlined" onClick={() => setStep(ACTIVE_GAME_STEP)}>
          {t('common.back')}
        </Button>
        <Button variant="contained" color="primary" onClick={finishGame} disabled={createGame.isPending}>
          {createGame.isPending ? <CircularProgress size={20} /> : t('game.save')}
        </Button>
      </Box>
    </Box>
  )
}

function HandicapAllowance({ playerIds }: { playerIds: readonly (string | undefined)[] }) {
  const { t } = useTranslation()
  const { data: games } = useGames()
  const handicaps = computeHandicaps(games?.games ?? [])

  const teamA = [playerIds[0] ?? '', playerIds[1] ?? '']
  const teamB = [playerIds[2] ?? '', playerIds[3] ?? '']
  if (teamA.some((id) => !id) || teamB.some((id) => !id)) return null

  const allowance = matchAllowance(teamA as [string, string], teamB as [string, string], handicaps)

  if (allowance === 0) return null

  const teamGetsGoals = allowance > 0 ? 1 : 2
  const goals = Math.abs(allowance)

  return (
    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
      {t('game.handicapAllowance', { team: teamGetsGoals, goals })}
    </Typography>
  )
}

/** Prompts a signed-in user with no players row yet to set their public display name. */
function CreatePlayerProfile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { company } = useActiveCompany()
  const upsertProfile = useUpsertPlayerProfile()
  const [allowPublicProfile, setAllowPublicProfile] = useState(false)
  const [displayName, setDisplayName] = useState(
    typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : ''
  )

  const submit = () => {
    if (!displayName.trim()) return

    const metadataAvatar = user?.user_metadata.avatar_url
    const avatarUrl =
      allowPublicProfile && typeof metadataAvatar === 'string'
        ? metadataAvatar
        : null

    upsertProfile.mutate({
      display_name: displayName.trim(),
      avatar_url: avatarUrl,
      is_public: allowPublicProfile,
      company_id: company?.id ?? null
    })
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('profile.create')}
      </Typography>
      <TextField
        label={t('profile.displayName')}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        fullWidth
        autoFocus
        sx={{ mb: 2 }}
      />
      <FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Checkbox
            checked={allowPublicProfile}
            onChange={(event) => setAllowPublicProfile(event.target.checked)}
          />
        }
        label={t('profile.enablePublicProfileFromGoogleAvatar')}
      />
      {upsertProfile.error && <Alert severity="error" sx={{ mb: 2 }}>{t('error.generic')}</Alert>}
      <Button
        variant="contained"
        onClick={submit}
        disabled={upsertProfile.isPending || !displayName.trim()}
        fullWidth
      >
        {upsertProfile.isPending ? <CircularProgress size={20} /> : t('profile.create')}
      </Button>
    </Box>
  )
}
