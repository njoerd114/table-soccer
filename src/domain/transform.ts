import {
  ATTACK_PLAYER,
  DEFAULT_ELO,
  DEFENSE_PLAYER,
  GUEST,
  PLACEMENT_MIN_GAMES,
  POSITION_DEFENSE,
  POSITION_KEEPER,
  POSITION_MIDFIELD,
  POSITION_STRIKER,
  type Position
} from './constants'
import { avgOrFallback, avgOrFirstParameter, calcScore, calcTeamElo } from './elo'
import type {
  AppData,
  Game,
  GameRecord,
  PlayerProfile,
  PlayerStats,
  PropertyExtremes,
  Team,
  TimelineEntry,
  TimelineEvent
} from './types'

type LegacyTimelineEvent = {
  readonly id: string
  readonly index: number
  readonly position: string
  readonly time: number
  readonly ownGoal?: boolean
}

type LegacyGameTuple = readonly unknown[]

type LegacyPlayer = {
  readonly id: string
  readonly name?: string
  readonly display_name?: string
  readonly photoURL?: string | null
  readonly avatar_url?: string | null
  readonly created_at?: string
}

type LegacyInput = {
  readonly games?: Record<string, LegacyGameTuple>
  readonly players: Record<string, LegacyPlayer>
}

export type TransformInput =
  | { readonly games: readonly GameRecord[]; readonly players: readonly PlayerProfile[] }
  | LegacyInput

type MutablePlayerStats = PlayerStats & {
  name: string
  photoURL?: string
}

type GamePlayer = MutablePlayerStats & {
  [POSITION_STRIKER]: number
  [POSITION_MIDFIELD]: number
  [POSITION_DEFENSE]: number
  [POSITION_KEEPER]: number
  score: number
  goalAgainstTimings: number[]
  goalTimings: number[]
  ownGoalTimings: number[]
  index: number
  isWinner: boolean
  position: typeof ATTACK_PLAYER | typeof DEFENSE_PLAYER
}

const checkedProperties = [
  'avgGoalsPosStriker',
  'avgGoalsPosMidfield',
  'avgGoalsPosDefense',
  'avgGoalsPosKeeper',
  'avgTimeBetweenGoals',
  'avgTimeBetweenGoalsAgainst'
] as const

/**
 * Port of legacy `services/transformer.js::transform`.
 *
 * Preserves legacy aggregation behavior for players, games, teams and
 * leaderboard properties, including timeline enrichment and in-loop mutation
 * order that affects ELO progression.
 *
 * Documented fixes only:
 * - `placemnentFinished` -> `placementFinished`
 * - `MIDFILED` -> `MIDFIELD`
 */
export function transform(raw: TransformInput): AppData {
  const normalized = normalizeInput(raw)
  const players = normalized.players.map((player) => createPlayerStats(player))
  const playerMap = createPlayerMap(players)
  const games: Game[] = []
  const teams: Record<string, Team> = {}
  const properties: Record<string, PropertyExtremes> = {}

  const sortedGames = [...normalized.games].sort(
    (a, b) => new Date(a.startdate).getTime() - new Date(b.startdate).getTime()
  )

  sortedGames.forEach((gameRecord) => {
    const [winnerAttackId, winnerDefenseId, loserAttackId, loserDefenseId] =
      gameRecord.players

    const [
      winnerAttackScore,
      winnerDefenseScore,
      loserAttackScore,
      loserDefenseScore,
      winnerAttackOwnGoals,
      winnerDefenseOwnGoals,
      loserAttackOwnGoals,
      loserDefenseOwnGoals
    ] = gameRecord.scores

    const winnerAttack = createInGameSimplePlayer(
      getPlayer(playerMap, winnerAttackId),
      winnerAttackScore,
      winnerAttackOwnGoals
    )
    const winnerDefense = createInGameSimplePlayer(
      getPlayer(playerMap, winnerDefenseId),
      winnerDefenseScore,
      winnerDefenseOwnGoals
    )
    const loserAttack = createInGameSimplePlayer(
      getPlayer(playerMap, loserAttackId),
      loserAttackScore,
      loserAttackOwnGoals
    )
    const loserDefense = createInGameSimplePlayer(
      getPlayer(playerMap, loserDefenseId),
      loserDefenseScore,
      loserDefenseOwnGoals
    )

    const currentPlayers: Record<string, GamePlayer> = {
      [winnerAttackId]: createCurrentPlayer(
        getPlayer(playerMap, winnerAttackId),
        winnerAttackScore,
        winnerAttackOwnGoals
      ),
      [winnerDefenseId]: createCurrentPlayer(
        getPlayer(playerMap, winnerDefenseId),
        winnerDefenseScore,
        winnerDefenseOwnGoals
      ),
      [loserAttackId]: createCurrentPlayer(
        getPlayer(playerMap, loserAttackId),
        loserAttackScore,
        loserAttackOwnGoals
      ),
      [loserDefenseId]: createCurrentPlayer(
        getPlayer(playerMap, loserDefenseId),
        loserDefenseScore,
        loserDefenseOwnGoals
      )
    }

    const timeline: TimelineEntry[] = gameRecord.timeline.map((event) => ({
      ...event,
      score: [0, 0],
      name: ''
    }))

    timeline.forEach((item, index) => {
      const scorerId = item.player_id
      const isWinner = scorerId === winnerAttackId || scorerId === winnerDefenseId
      const previousScore =
        index === 0 ? ([0, 0] as const) : timeline[index - 1]?.score ?? [0, 0]
      const score: [number, number] = [previousScore[0], previousScore[1]]

      if ((isWinner && !item.own_goal) || (!isWinner && item.own_goal)) {
        score[0] += 1
      } else {
        score[1] += 1
      }

      item.score = score
      item.name = getPlayer(playerMap, scorerId).name

      const currentKeeper = getCurrentKeeper(
        item.index,
        item.own_goal,
        winnerDefenseId,
        loserDefenseId,
        currentPlayers
      )

      if (!item.own_goal) {
        const scorer = getPlayer(currentPlayers, scorerId)
        scorer[item.position] += 1

        if (item.index % 2 === 0) {
          scorer.goalTimings.push(item.time)
        }
      }

      currentKeeper.goalAgainstTimings.push(item.time)
      getPlayer(currentPlayers, scorerId).index = item.index
    })

    const [winnerTeam, loserTeam] = createOrGetTeams(
      [winnerAttack, winnerDefense, loserAttack, loserDefense],
      teams
    )

    gameRecord.players.forEach((playerId, playerIndex) => {
      const player = getPlayer(playerMap, playerId)
      const currentPlayer = getPlayer(currentPlayers, playerId)
      const goalsPosStriker = player.goalsPosStriker + currentPlayer[POSITION_STRIKER]
      const goalsPosMidfield =
        player.goalsPosMidfield + currentPlayer[POSITION_MIDFIELD]
      const goalsPosDefense = player.goalsPosDefense + currentPlayer[POSITION_DEFENSE]
      const goalsPosKeeper = player.goalsPosKeeper + currentPlayer[POSITION_KEEPER]
      const ownGoals = player.ownGoals + currentPlayer.ownGoals
      const position =
        playerIndex % 2 === 0 ? ATTACK_PLAYER : DEFENSE_PLAYER
      const isAttack = position === ATTACK_PLAYER
      const isWinner = playerIndex <= 1
      const winStreak = isWinner ? player.winStreak + 1 : 0
      const longestWinStreak =
        winStreak > player.longestWinStreak ? winStreak : player.longestWinStreak
      const wins = isWinner ? player.wins + 1 : player.wins
      const winsAttack =
        isWinner && isAttack ? player.winsAttack + 1 : player.winsAttack
      const winsDefense =
        isWinner && !isAttack ? player.winsDefense + 1 : player.winsDefense
      const losses = !isWinner ? player.losses + 1 : player.losses
      const lossesAttack =
        !isWinner && isAttack ? player.lossesAttack + 1 : player.lossesAttack
      const lossesDefense =
        !isWinner && !isAttack ? player.lossesDefense + 1 : player.lossesDefense
      const ownGoalsAttack =
        isAttack ? player.ownGoalsAttack + currentPlayer.ownGoals : player.ownGoalsAttack
      const ownGoalsDefense =
        !isAttack
          ? player.ownGoalsDefense + currentPlayer.ownGoals
          : player.ownGoalsDefense
      const gamesCount = wins + losses
      const gamesAttack = winsAttack + lossesAttack
      const gamesDefense = winsDefense + lossesDefense
      const avgGoalsPosStriker = avgOrFallback(goalsPosStriker, gamesAttack)
      const avgGoalsPosMidfield = avgOrFallback(goalsPosMidfield, gamesAttack)
      const avgGoalsPosDefense = avgOrFallback(goalsPosDefense, gamesDefense)
      const avgGoalsPosKeeper = avgOrFallback(goalsPosKeeper, gamesDefense)
      const currentGoals = currentPlayer.score
      const goalsAgainst =
        isWinner
          ? loserAttackScore + loserDefenseScore
          : winnerAttackScore + winnerDefenseScore
      const goalsAgainstDefense =
        !isAttack
          ? player.goalsAgainstDefense + goalsAgainst
          : player.goalsAgainstDefense
      const avgGoalsAgainstDefense = avgOrFallback(
        goalsAgainstDefense,
        winsDefense
      )
      const goals = player.goals + currentGoals
      const goalsAttack = isAttack ? player.goalsAttack + currentGoals : player.goalsAttack
      const goalsWinnerAttack =
        isWinner && isAttack
          ? player.goalsWinnerAttack + currentGoals
          : player.goalsWinnerAttack
      const avgGoalsWinnerAttack = avgOrFallback(goalsWinnerAttack, winsAttack)
      const goalsDefense =
        !isAttack ? player.goalsDefense + currentGoals : player.goalsDefense
      const playTime = player.playTime + gameRecord.duration
      const avgGameDuration = playTime / gamesCount
      const playTimeAttack =
        isAttack ? player.playTimeAttack + gameRecord.duration : player.playTimeAttack
      const playTimeDefense =
        !isAttack
          ? player.playTimeDefense + gameRecord.duration
          : player.playTimeDefense
      const winsAttackDuration =
        isWinner && isAttack
          ? player.winsAttackDuration + gameRecord.duration
          : player.winsAttackDuration
      const avgWinsAttackDuration = avgOrFallback(winsAttackDuration, winsAttack)
      const lossDefenseDuration =
        !isWinner && !isAttack
          ? player.lossDefenseDuration + gameRecord.duration
          : player.lossDefenseDuration
      const avgLossDefenseDuration = avgOrFallback(
        lossDefenseDuration,
        lossesDefense
      )
      const winRatio = avgOrFallback(wins, gamesCount)
      const winRatioAttack = avgOrFallback(winsAttack, gamesAttack)
      const winRatioDefense = avgOrFallback(winsDefense, gamesDefense)
      const avgOwnGoals = avgOrFallback(ownGoals, gamesCount)
      const currentAvgTimeBetweenGoals = isAttack
        ? avgOrFirstParameter(gameRecord.duration, currentGoals)
        : 0
      const totalAvgTimeBetweenGoals = isAttack
        ? player.totalAvgTimeBetweenGoals + currentAvgTimeBetweenGoals
        : player.totalAvgTimeBetweenGoals
      const avgTimeBetweenGoals = avgOrFirstParameter(playTimeAttack, goalsAttack)
      const currentAvgTimeBetweenGoalsAgainst = !isAttack
        ? avgOrFirstParameter(gameRecord.duration, goalsAgainst)
        : 0
      const totalAvgTimeBetweenGoalsAgainst = !isAttack
        ? player.totalAvgTimeBetweenGoalsAgainst + currentAvgTimeBetweenGoalsAgainst
        : player.totalAvgTimeBetweenGoalsAgainst
      const avgTimeBetweenGoalsAgainst = avgOrFirstParameter(
        playTimeDefense,
        goalsAgainstDefense
      )
      const placementFinished = gamesCount >= PLACEMENT_MIN_GAMES

      let enemy1Id: string
      let enemy2Id: string

      if (isWinner) {
        enemy1Id = loserAttackId
        enemy2Id = loserDefenseId
      } else {
        enemy1Id = winnerAttackId
        enemy2Id = winnerDefenseId
      }

      const eloGain = calcScore(
        player,
        getPlayer(playerMap, enemy1Id),
        getPlayer(playerMap, enemy2Id),
        currentGoals,
        goalsAgainst,
        isWinner
      )
      const newElo = player.elo + eloGain

      currentPlayer.winStreak = winStreak
      currentPlayer.isWinner = isWinner
      currentPlayer.position = position
      currentPlayer.winStreak = winStreak
      currentPlayer.wins = wins
      currentPlayer.losses = losses
      currentPlayer.games = gamesCount
      currentPlayer.goals = goals
      currentPlayer.elo = newElo
      currentPlayer.eloGain = eloGain
      currentPlayer.avgTimeBetweenGoals = avgTimeBetweenGoals
      currentPlayer.avgTimeBetweenGoalsAgainst = avgTimeBetweenGoalsAgainst
      currentPlayer.photoURL = player.photoURL

      player.ownGoals = ownGoals
      player.goalsPosStriker = goalsPosStriker
      player.goalsPosMidfield = goalsPosMidfield
      player.goalsPosDefense = goalsPosDefense
      player.goalsPosKeeper = goalsPosKeeper
      player.winStreak = winStreak
      player.winStreak = winStreak
      player.wins = wins
      player.winsAttack = winsAttack
      player.winsDefense = winsDefense
      player.losses = losses
      player.lossesAttack = lossesAttack
      player.lossesDefense = lossesDefense
      player.ownGoalsAttack = ownGoalsAttack
      player.ownGoalsDefense = ownGoalsDefense
      player.games = gamesCount
      player.gamesAttack = gamesAttack
      player.gamesDefense = gamesDefense
      player.goals = goals
      player.goalsAttack = goalsAttack
      player.goalsDefense = goalsDefense
      player.elo = newElo
      player.goalsAgainst = goalsAgainst
      player.playTime = playTime
      player.playTimeAttack = playTimeAttack
      player.playTimeDefense = playTimeDefense
      player.winsAttackDuration = winsAttackDuration
      player.avgWinsAttackDuration = avgWinsAttackDuration
      player.lossDefenseDuration = lossDefenseDuration
      player.avgLossDefenseDuration = avgLossDefenseDuration
      player.winRatio = winRatio
      player.winRatioAttack = winRatioAttack
      player.winRatioDefense = winRatioDefense
      player.goalsWinnerAttack = goalsWinnerAttack
      player.avgGoalsWinnerAttack = avgGoalsWinnerAttack
      player.goalsAgainstDefense = goalsAgainstDefense
      player.avgGoalsAgainstDefense = avgGoalsAgainstDefense
      player.avgGoalsPosStriker = avgGoalsPosStriker
      player.avgGoalsPosMidfield = avgGoalsPosMidfield
      player.avgGoalsPosDefense = avgGoalsPosDefense
      player.avgGoalsPosKeeper = avgGoalsPosKeeper
      player.avgOwnGoals = avgOwnGoals
      player.longestWinStreak = longestWinStreak
      player.totalAvgTimeBetweenGoals = totalAvgTimeBetweenGoals
      player.avgTimeBetweenGoals = avgTimeBetweenGoals
      player.totalAvgTimeBetweenGoalsAgainst = totalAvgTimeBetweenGoalsAgainst
      player.avgTimeBetweenGoalsAgainst = avgTimeBetweenGoalsAgainst
      player.placementFinished = placementFinished
      player.avgGameDuration = avgGameDuration
    })

    games.push({
      id: gameRecord.id,
      startdate: new Date(gameRecord.startdate),
      duration: gameRecord.duration,
      timeline,
      annotations: gameRecord.annotations ?? [],
      winnerScore:
        winnerAttackScore +
        winnerDefenseScore +
        loserAttackOwnGoals +
        loserDefenseOwnGoals,
      loserScore:
        loserAttackScore +
        loserDefenseScore +
        winnerAttackOwnGoals +
        winnerDefenseOwnGoals,
      winnerAttack,
      winnerDefense,
      loserAttack,
      loserDefense,
      players: currentPlayers,
      winnerTeamKey: winnerTeam.id,
      loserTeamKey: loserTeam.id,
      [winnerTeam.id]: {
        ...winnerTeam,
        attack: winnerAttack,
        defense: winnerDefense
      },
      [loserTeam.id]: {
        ...loserTeam,
        attack: loserAttack,
        defense: loserDefense
      }
    } as Game)
  })

  players.forEach((player) => {
    if (player.id === GUEST || !player.placementFinished) {
      return
    }

    checkedProperties.forEach((prop) => {
      if (!properties[prop]) {
        properties[prop] = {
          min: {
            value: Number.POSITIVE_INFINITY,
            id: player.id
          },
          max: {
            value: 0,
            id: player.id
          }
        }
      }

      if (player[prop] <= properties[prop].min.value) {
        properties[prop].min = {
          value: player[prop],
          id: player.id
        }
      }

      if (player[prop] >= properties[prop].max.value) {
        properties[prop].max = {
          value: player[prop],
          id: player.id
        }
      }
    })
  })

  for (let index = 0; index < players.length; index += 1) {
    const player = players[index]

    if (!player) {
      continue
    }

    player.selectionIndex = index
  }

  return {
    players,
    games,
    teams,
    properties
  }
}

function createPlayerStats(player: PlayerProfile): MutablePlayerStats {
  return {
    id: player.id,
    display_name: player.display_name,
    avatar_url: player.avatar_url,
    name: player.display_name,
    photoURL: player.avatar_url ?? undefined,
    goalsPosStriker: 0,
    goalsPosMidfield: 0,
    goalsPosDefense: 0,
    goalsPosKeeper: 0,
    ownGoals: 0,
    winStreak: 0,
    longestWinStreak: 0,
    wins: 0,
    winsAttack: 0,
    winsDefense: 0,
    losses: 0,
    lossesAttack: 0,
    lossesDefense: 0,
    ownGoalsAttack: 0,
    ownGoalsDefense: 0,
    games: 0,
    gamesAttack: 0,
    gamesDefense: 0,
    goals: 0,
    goalsAttack: 0,
    goalsDefense: 0,
    elo: DEFAULT_ELO,
    eloGain: 0,
    goalsAgainst: 0,
    playTime: 0,
    playTimeAttack: 0,
    playTimeDefense: 0,
    winsAttackDuration: 0,
    avgWinsAttackDuration: 0,
    lossDefenseDuration: 0,
    avgLossDefenseDuration: 0,
    goalsWinnerAttack: 0,
    avgGoalsWinnerAttack: 0,
    goalsAgainstDefense: 0,
    avgGoalsAgainstDefense: 0,
    winRatio: 0,
    winRatioAttack: 0,
    winRatioDefense: 0,
    avgGoalsPosStriker: 0,
    avgGoalsPosMidfield: 0,
    avgGoalsPosDefense: 0,
    avgGoalsPosKeeper: 0,
    avgOwnGoals: 0,
    totalAvgTimeBetweenGoals: 0,
    totalAvgTimeBetweenGoalsAgainst: 0,
    avgTimeBetweenGoals: 0,
    avgTimeBetweenGoalsAgainst: 0,
    placementFinished: false,
    selectionIndex: -1,
    avgGameDuration: 0
  }
}

function createPlayerMap(players: MutablePlayerStats[]): Record<string, MutablePlayerStats> {
  const map: Record<string, MutablePlayerStats> = {}

  players.forEach((player) => {
    map[player.id] = player
  })

  return map
}

function createInGameSimplePlayer(
  player: MutablePlayerStats,
  score: number,
  ownGoals: number
) {
  return {
    id: player.id,
    name: player.name,
    score,
    ownGoals,
    [POSITION_STRIKER]: 0,
    [POSITION_MIDFIELD]: 0,
    [POSITION_DEFENSE]: 0,
    [POSITION_KEEPER]: 0,
    goalAgainstTimings: [] as number[],
    goalTimings: [] as number[],
    ownGoalTimings: [] as number[]
  }
}

function createCurrentPlayer(
  player: MutablePlayerStats,
  score: number,
  ownGoals: number
): GamePlayer {
  return {
    ...player,
    name: player.name,
    score,
    ownGoals,
    [POSITION_STRIKER]: 0,
    [POSITION_MIDFIELD]: 0,
    [POSITION_DEFENSE]: 0,
    [POSITION_KEEPER]: 0,
    goalAgainstTimings: [],
    goalTimings: [],
    ownGoalTimings: [],
    index: 0,
    isWinner: false,
    position: ATTACK_PLAYER
  }
}

function getCurrentKeeper(
  index: number,
  ownGoal: boolean,
  winnerDefenseId: string,
  loserDefenseId: string,
  currentPlayers: Record<string, GamePlayer>
): GamePlayer {
  if (index <= 1) {
    return ownGoal
      ? getPlayer(currentPlayers, winnerDefenseId)
      : getPlayer(currentPlayers, loserDefenseId)
  }

  return ownGoal
    ? getPlayer(currentPlayers, loserDefenseId)
    : getPlayer(currentPlayers, winnerDefenseId)
}

function createOrGetTeams(
  players: readonly [
    ReturnType<typeof createInGameSimplePlayer>,
    ReturnType<typeof createInGameSimplePlayer>,
    ReturnType<typeof createInGameSimplePlayer>,
    ReturnType<typeof createInGameSimplePlayer>
  ],
  teams: Record<string, Team>
): [Team, Team] {
  const [winnerAttack, winnerDefense, loserAttack, loserDefense] = players
  const winnerTeamKey = `${winnerAttack.id}-${winnerDefense.id}`
  const loserTeamKey = `${loserAttack.id}-${loserDefense.id}`

  if (!teams[winnerTeamKey]) {
    teams[winnerTeamKey] = {
      elo: DEFAULT_ELO,
      id: winnerTeamKey,
      goals: 0,
      games: 0,
      wins: 0,
      losses: 0,
      winRatio: 0,
      attack: winnerAttack,
      defense: winnerDefense
    }
  }

  if (!teams[loserTeamKey]) {
    teams[loserTeamKey] = {
      elo: DEFAULT_ELO,
      id: loserTeamKey,
      goals: 0,
      games: 0,
      wins: 0,
      losses: 0,
      winRatio: 0,
      attack: loserAttack,
      defense: loserDefense
    }
  }

  const winnerTeam = teams[winnerTeamKey]
  const loserTeam = teams[loserTeamKey]
  const [winnerTeamEloGain, loserTeamEloGain] = calcTeamElo(
    winnerTeam.elo,
    loserTeam.elo
  )

  winnerTeam.elo += winnerTeamEloGain
  loserTeam.elo += loserTeamEloGain
  winnerTeam.games += 1
  winnerTeam.wins += 1
  winnerTeam.winRatio = avgOrFallback(winnerTeam.wins, winnerTeam.games)
  loserTeam.games += 1
  loserTeam.losses += 1
  loserTeam.winRatio = avgOrFallback(loserTeam.wins, loserTeam.games)

  return [winnerTeam, loserTeam]
}

function getPlayer<T>(map: Record<string, T>, id: string): T {
  const value = map[id]

  if (!value) {
    throw new Error(`Unknown player id: ${id}`)
  }

  return value
}

function normalizeInput(raw: TransformInput): {
  games: GameRecord[]
  players: PlayerProfile[]
} {
  if (isLegacyInput(raw)) {
    const players = Object.keys(raw.players).map((id) =>
      normalizeLegacyPlayer(getLegacyPlayer(raw.players, id), id)
    )
    const legacyGames = raw.games ?? {}
    const games = Object.keys(legacyGames).map((id) =>
      normalizeLegacyGameTuple(legacyGames[id], id)
    )

    return { games, players }
  }

  let players: PlayerProfile[]
  players = raw.players.map((player) => ({ ...player }))

  let games: GameRecord[]
  games = raw.games.map((game) => normalizeGameRecord(game))

  return { games, players }
}

function isLegacyInput(raw: TransformInput): raw is LegacyInput {
  return !Array.isArray(raw.players)
}

function getLegacyPlayer(
  players: Record<string, LegacyPlayer>,
  id: string
): LegacyPlayer {
  const player = players[id]

  if (!player) {
    throw new Error(`Missing player profile for id: ${id}`)
  }

  return player
}

function normalizeLegacyPlayer(player: LegacyPlayer, id: string): PlayerProfile {
  return {
    id: player.id || id,
    display_name: player.display_name ?? player.name ?? player.id ?? id,
    avatar_url: player.avatar_url ?? player.photoURL ?? null,
    is_public: false,
    company_id: null,
    created_at: player.created_at ?? ''
  }
}

function normalizeLegacyGameTuple(
  tuple: LegacyGameTuple | undefined,
  fallbackId: string
): GameRecord {
  if (!tuple) {
    throw new Error(`Missing game tuple for id: ${fallbackId}`)
  }

  const id = getString(tuple[0], fallbackId)
  const startdate = tuple[1]
  const duration = getNumber(tuple[2], 0)
  const players: [string, string, string, string] = [
    getStringFromArray(tuple[3], 0),
    getStringFromArray(tuple[3], 1),
    getStringFromArray(tuple[3], 2),
    getStringFromArray(tuple[3], 3)
  ]
  const scores: [number, number, number, number, number, number, number, number] = [
    getNumberFromArray(tuple[4], 0),
    getNumberFromArray(tuple[4], 1),
    getNumberFromArray(tuple[4], 2),
    getNumberFromArray(tuple[4], 3),
    getNumberFromArray(tuple[4], 4),
    getNumberFromArray(tuple[4], 5),
    getNumberFromArray(tuple[4], 6),
    getNumberFromArray(tuple[4], 7)
  ]
  const timeline = Array.isArray(tuple[5])
    ? (tuple[5] as LegacyTimelineEvent[])
    : []

  return {
    id,
    startdate: Number(new Date(getDateInput(startdate)).getTime()),
    duration,
    players: [...players],
    scores: [...scores],
    timeline: timeline.map((event) => normalizeLegacyTimelineEvent(event)),
    company_id: null,
    opponent_company_id: null,
    season_id: null,
    league_id: null,
    created_at: ''
  }
}

function normalizeGameRecord(game: GameRecord): GameRecord {
  return {
    ...game,
    timeline: game.timeline.map((event) => normalizeTimelineEvent(event))
  }
}

function normalizeLegacyTimelineEvent(event: LegacyTimelineEvent): TimelineEvent {
  return {
    player_id: event.id,
    index: event.index,
    position: normalizePosition(event.position),
    time: event.time,
    own_goal: event.ownGoal ?? false
  }
}

function normalizeTimelineEvent(event: TimelineEvent): TimelineEvent {
  return {
    ...event,
    position: normalizePosition(event.position),
    own_goal: event.own_goal ?? false
  }
}

function normalizePosition(position: string): Position {
  if (position === 'MIDFILED') {
    return POSITION_MIDFIELD
  }

  if (position === POSITION_KEEPER) {
    return POSITION_KEEPER
  }

  if (position === POSITION_DEFENSE) {
    return POSITION_DEFENSE
  }

  if (position === POSITION_MIDFIELD) {
    return POSITION_MIDFIELD
  }

  return POSITION_STRIKER
}

function getDateInput(value: unknown): number | string {
  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }

  return 0
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback
}

function getStringFromArray(value: unknown, index: number): string {
  if (!Array.isArray(value)) {
    return ''
  }

  const candidate = value[index]
  return typeof candidate === 'string' ? candidate : ''
}

function getNumberFromArray(value: unknown, index: number): number {
  if (!Array.isArray(value)) {
    return 0
  }

  const candidate = value[index]
  return typeof candidate === 'number' ? candidate : 0
}
