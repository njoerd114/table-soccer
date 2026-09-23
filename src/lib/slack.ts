import type { GameRecord } from '../domain/types'

/**
 * PII SAFETY CONTRACT:
 * Slack payloads carry ONLY public display names and ELO ratings — the same
 * data already visible in the public game history UI. NEVER add emails, auth
 * uids, or raw profile photo URLs here.
 */

interface SlackPlayerTitle {
  name: string
  elo: number
}

/** Builds one player line for the Slack attachment. */
function playerLine(position: string, player: SlackPlayerTitle): string {
  return `_${position}_ \n *${player.name}* \n _${player.elo}_`
}

const POSITION_LABELS: Record<number, string> = {
  0: 'Sturm',
  1: 'Mittelfeld',
  2: 'Abwehr',
  3: 'Torwart'
}

function labelForIndex(index: number): string {
  return POSITION_LABELS[index] ?? 'Unbekannt'
}

/**
 * Creates the Slack message for a finished game.
 * Input: a GameRecord plus the player profile map (id -> {name, elo}).
 * Output shape is the Slack incoming-webhook payload.
 */
export function createEndMessage(
  game: GameRecord,
  playersById: Map<string, SlackPlayerTitle>
): Record<string, unknown> {
  const [p1, p2, p3, p4] = game.players
  const score1 = game.scores[0]! + game.scores[1]! + game.scores[6]! + game.scores[7]!
  const score2 = game.scores[2]! + game.scores[3]! + game.scores[4]! + game.scores[5]!

  const team1 = [p1, p2]
  const team2 = [p3, p4]

  const team1Title = team1
    .map((id, i) => {
      const profile = playersById.get(id)
      const label = labelForIndex(i)
      return profile ? playerLine(label, profile) : `${label}: unbekannt`
    })
    .join('\n')

  const team2Title = team2
    .map((id, i) => {
      const profile = playersById.get(id)
      const label = labelForIndex(i + 2)
      return profile ? playerLine(label, profile) : `${label}: unbekannt`
    })
    .join('\n')

  return {
    username: 'Tischkicker Bot',
    attachments: [
      {
        color: score1 >= score2 ? '#00bcd4' : '#ff4081',
        title: `Spiel beendet: ${score1} : ${score2}`,
        fields: [
          { title: 'Team 1', value: team1Title, short: true },
          { title: 'Team 2', value: team2Title, short: true }
        ]
      }
    ]
  }
}