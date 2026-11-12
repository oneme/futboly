import { isProperty, type GameState, type PlayerStats } from './game'
import type { PropertySquare } from './types'

/**
 * Patrimonio de un jugador según la "manera rápida de jugar" del manual:
 * dinero + precio de sus concesiones (la mitad si están hipotecadas) + asientos y tribunas
 * por su valor de compra (la tribuna vale cinco asientos).
 */
export function netWorth(s: GameState, pid: number): number {
  const p = s.players[pid]
  if (p.bankrupt) return 0
  let total = p.money
  for (const sq of s.board) {
    if (!isProperty(sq)) continue
    const ps = s.properties[sq.position]
    if (ps.owner !== pid) continue
    total += ps.mortgaged ? sq.price / 2 : sq.price
    if (sq.kind === 'stadium') total += (ps.stand ? 5 : ps.seats) * sq.buildCost
  }
  return total
}

export interface PlayerSummary {
  id: number
  name: string
  ai: boolean
  level: string
  rank: number
  eliminated: boolean
  netWorth: number
  cash: number
  properties: number
  mortgaged: number
  seats: number
  stands: number
  stats: PlayerStats
}

export interface Highlight {
  label: string
  playerId: number
  value: number
  /** 'money' se muestra con puntos de millar; 'count' tal cual. */
  kind: 'money' | 'count'
}

export interface GameSummary {
  turns: number
  winnerId: number | null
  players: PlayerSummary[] // ordenados: primero el ganador
  highlights: Highlight[]
}

/** Resumen de la partida: clasificación y datos curiosos. Sirve también a media partida. */
export function buildSummary(s: GameState): GameSummary {
  const players: PlayerSummary[] = s.players.map((p) => {
    const owned = s.board.filter((sq): sq is PropertySquare => isProperty(sq) && s.properties[sq.position].owner === p.id)
    let seats = 0
    let stands = 0
    for (const sq of owned) {
      seats += s.properties[sq.position].seats
      stands += s.properties[sq.position].stand ? 1 : 0
    }
    return {
      id: p.id,
      name: p.name,
      ai: p.ai,
      level: p.level ?? 'normal',
      rank: 0,
      eliminated: p.bankrupt,
      netWorth: netWorth(s, p.id),
      cash: p.bankrupt ? 0 : p.money,
      properties: p.bankrupt ? 0 : owned.length,
      mortgaged: owned.filter((sq) => s.properties[sq.position].mortgaged).length,
      seats,
      stands,
      stats: s.stats?.[p.id] ?? { rentPaid: 0, rentReceived: 0, bought: 0, spentOnProperties: 0, spentOnBuilding: 0, tradesClosed: 0, jailVisits: 0, bankruptTurn: null },
    }
  })

  // Los que siguen en juego, por patrimonio; los eliminados, del que aguantó más al que menos.
  players.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1
    if (!a.eliminated) return b.netWorth - a.netWorth || a.id - b.id
    return (b.stats.bankruptTurn ?? 0) - (a.stats.bankruptTurn ?? 0) || a.id - b.id
  })
  players.forEach((p, i) => (p.rank = i + 1))

  const best = (label: string, kind: Highlight['kind'], pick: (p: PlayerSummary) => number): Highlight[] => {
    const top = [...players].sort((a, b) => pick(b) - pick(a))[0]
    return top && pick(top) > 0 ? [{ label, playerId: top.id, value: pick(top), kind }] : []
  }
  return {
    turns: s.turnCount,
    winnerId: s.winner,
    players,
    highlights: [
      ...best('Más alquileres cobrados', 'money', (p) => p.stats.rentReceived),
      ...best('Más alquileres pagados', 'money', (p) => p.stats.rentPaid),
      ...best('Más concesiones compradas', 'count', (p) => p.stats.bought),
      ...best('Mayor inversión en construcción', 'money', (p) => p.stats.spentOnBuilding),
      ...best('Más tratos cerrados', 'count', (p) => p.stats.tradesClosed),
      ...best('Más visitas al Banquillo', 'count', (p) => p.stats.jailVisits),
    ],
  }
}
