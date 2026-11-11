import {
  auctionBid, auctionPass, buy, chooseRisk, declareBankruptcy, declineBuy, endTurn, isProperty,
  payJailFine, resolveCard, roll, settleDebt, useJailCard, type GameState, type Player,
} from './game'
import {
  buildSeat, buildStand, canBuildSeat, canBuildStand, canMortgage, canSellSeat, canSellStands,
  canUnmortgage, mortgage, sellSeat, sellStands, unmortgage, unmortgageCost,
} from './management'
import type { PropertySquare, StadiumSquare } from './types'

/**
 * Jugador controlado por la máquina. `aiStep` hace UNA acción del jugador al que le toca
 * decidir (si es una IA), para que la interfaz pueda espaciarlas y mostrarlas.
 * Estrategia sencilla: compra casi todo, completa grupos, construye con colchón de dinero,
 * puja hasta el valor que le da a la concesión y vende/hipoteca solo lo necesario para pagar.
 * No propone ni acepta intercambios.
 */
const RESERVE = 15_000 // dinero que prefiere conservar tras comprar
const BUILD_RESERVE = 30_000 // idem tras construir
const UNMORTGAGE_RESERVE = 50_000

/** Quién debe decidir ahora: el de la subasta, el deudor o el jugador en turno. */
export function actor(s: GameState): number {
  if (s.phase === 'auction' && s.auction) return s.auction.turn
  if (s.phase === 'debt' && s.debt) return s.debt.debtor
  return s.current
}

const owner = (s: GameState, pos: number) => s.properties[pos].owner
const ownedBy = (s: GameState, id: number) =>
  s.board.filter((x): x is PropertySquare => isProperty(x) && owner(s, x.position) === id)
const otherPart = (s: GameState, sq: StadiumSquare) =>
  s.board.find((x): x is StadiumSquare => x.kind === 'stadium' && x.team === sq.team && x.position !== sq.position)

/** Cuánto vale una concesión para este jugador (más si completa un grupo, algo más si bloquea a otro). */
function valuation(s: GameState, p: Player, sq: PropertySquare): number {
  if (sq.kind === 'stadium') {
    const other = otherPart(s, sq)
    const o = other ? owner(s, other.position) : null
    if (o === p.id) return sq.price * 1.6
    if (o !== null) return sq.price * 1.15
    return sq.price * 0.9
  }
  return sq.price * (sq.kind === 'clubService' ? 0.8 : 0.9)
}

/** Hace una acción de la IA. Devuelve false si no le tocaba a una IA (o la partida terminó). */
export function aiStep(s: GameState, rng: () => number = Math.random): boolean {
  if (s.phase === 'gameOver') return false
  const p = s.players[actor(s)]
  if (!p) return false
  // Tras una quiebra el turno del jugador eliminado se cierra solo, sea humano o IA.
  if (s.phase === 'endTurn' && p.bankrupt) return endTurn(s), true
  if (!p.ai || p.bankrupt) return false

  switch (s.phase) {
    case 'roll': return stepRoll(s, p, rng)
    case 'buy': return stepBuy(s, p)
    case 'auction': return stepAuction(s, p, rng)
    case 'card': resolveCard(s); return true
    case 'cardChoice': chooseRisk(s, p.money < 5_000); return true
    case 'debt': return stepDebt(s, p)
    case 'endTurn': endTurn(s); return true
  }
  return false
}

function stepRoll(s: GameState, p: Player, rng: () => number): boolean {
  if (p.inJail) {
    if (p.jailCards.length) return useJailCard(s), true
    if (p.money >= 5_000 + 60_000) return payJailFine(s), true
    return roll(s, rng), true // intenta sacar doble
  }
  // Construir (las concesiones que más rentan primero), siempre con colchón.
  const stadiums = ownedBy(s, p.id)
    .filter((x): x is StadiumSquare => x.kind === 'stadium')
    .sort((a, b) => b.rents[1] - a.rents[1])
  for (const sq of stadiums) {
    if (p.money - sq.buildCost < BUILD_RESERVE) continue
    if (!canBuildStand(s, p.id, sq.position)) return buildStand(s, p.id, sq.position), true
    if (!canBuildSeat(s, p.id, sq.position)) return buildSeat(s, p.id, sq.position), true
  }
  for (const sq of ownedBy(s, p.id)) {
    if (s.properties[sq.position].mortgaged && p.money >= unmortgageCost(sq) + UNMORTGAGE_RESERVE && !canUnmortgage(s, p.id, sq.position))
      return unmortgage(s, p.id, sq.position), true
  }
  roll(s, rng)
  return true
}

function stepBuy(s: GameState, p: Player): boolean {
  const sq = s.board[p.position] as PropertySquare
  const completes = sq.kind === 'stadium' && !!otherPart(s, sq) && owner(s, otherPart(s, sq)!.position) === p.id
  const left = p.money - sq.price
  if (left >= RESERVE || (completes && left >= 2_000)) buy(s)
  else declineBuy(s)
  return true
}

function stepAuction(s: GameState, p: Player, rng: () => number): boolean {
  const a = s.auction!
  const sq = s.board[a.position] as PropertySquare
  const maxBid = Math.min(valuation(s, p, sq) * (0.9 + rng() * 0.2), p.money - 2_000)
  const raise = Math.max(500, Math.round((sq.price * 0.1) / 500) * 500)
  const opening = Math.max(500, Math.round((sq.price * 0.3) / 500) * 500)
  const next = a.bid === 0 ? opening : a.bid + raise
  if (next <= maxBid) auctionBid(s, next)
  else auctionPass(s)
  return true
}

/** Para pagar una deuda: primero vende mejoras, después hipoteca; solo lo necesario. */
function stepDebt(s: GameState, p: Player): boolean {
  const need = s.debt!.amount
  const own = ownedBy(s, p.id)
  for (const sq of own) {
    if (p.money >= need) break
    if (!canSellStands(s, p.id, sq.position)) sellStands(s, p.id, sq.position)
    while (p.money < need && !canSellSeat(s, p.id, sq.position)) sellSeat(s, p.id, sq.position)
  }
  for (const sq of [...own].sort((a, b) => b.mortgage - a.mortgage)) {
    if (p.money >= need) break
    if (!canMortgage(s, p.id, sq.position)) mortgage(s, p.id, sq.position)
  }
  if (p.money >= need) settleDebt(s)
  else declareBankruptcy(s)
  return true
}
