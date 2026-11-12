import {
  auctionBid, auctionPass, buy, calcRent, chooseRisk, declareBankruptcy, declineBuy, endTurn, isProperty,
  payJailFine, resolveCard, roll, settleDebt, useJailCard, type GameState, type Player,
} from './game'
import {
  buildSeat, buildStand, canBuildSeat, canBuildStand, canMortgage, canSellSeat, canSellStands,
  canUnmortgage, mortgage, sellSeat, sellStands, unmortgage, unmortgageCost,
} from './management'
import { AI_PROFILES, type AIProfile } from './aiProfiles'
import { aiProposeTrade } from './trading'
import type { PropertySquare, StadiumSquare } from './types'

/**
 * Jugador controlado por la máquina. `aiStep` hace UNA acción del jugador al que le toca
 * decidir (si es una IA), para que la interfaz pueda espaciarlas y mostrarlas.
 * Compra, puja, construye, negocia y se financia según el perfil de su nivel (aiProfiles.ts).
 */

/** Perfil de una IA (las partidas guardadas antiguas no tienen nivel: normal). */
export const profileOf = (p: Player): AIProfile => AI_PROFILES[p.level ?? 'normal']

/** Quién debe decidir ahora: el de la subasta, el deudor o el jugador en turno. */
export function actor(s: GameState): number {
  if (s.phase === 'auction' && s.auction) return s.auction.turn
  if (s.phase === 'debt' && s.debt) return s.debt.debtor
  return s.current
}

const owner = (s: GameState, pos: number) => s.properties[pos].owner

/** Mayor alquiler que podría tener que pagar en las próximas 12 casillas (lo que alcanza una tirada). */
function exposure(s: GameState, p: Player): number {
  let worst = 0
  for (let k = 1; k <= 12; k++) {
    const pos = (p.position + k) % 40
    const o = s.properties[pos]?.owner
    if (o === undefined || o === null || o === p.id) continue
    worst = Math.max(worst, calcRent(s, pos, 7))
  }
  return worst
}
/** Colchón de dinero que quiere conservar: fijo, o (nivel difícil) ajustado al peligro que tiene delante. */
const cushion = (s: GameState, p: Player, base: number) =>
  profileOf(p).dangerAware ? Math.max(base, exposure(s, p) + 3_000) : base
const ownedBy = (s: GameState, id: number) =>
  s.board.filter((x): x is PropertySquare => isProperty(x) && owner(s, x.position) === id)
const otherPart = (s: GameState, sq: StadiumSquare) =>
  s.board.find((x): x is StadiumSquare => x.kind === 'stadium' && x.team === sq.team && x.position !== sq.position)

/** Cuánto vale una concesión para este jugador (más si completa un grupo, algo más si bloquea a otro). */
function valuation(s: GameState, p: Player, sq: PropertySquare): number {
  if (sq.kind === 'stadium') {
    const other = otherPart(s, sq)
    const o = other ? owner(s, other.position) : null
    if (o === p.id) return sq.price * profileOf(p).completeBonus
    if (o !== null) return sq.price * 1.15
    return sq.price * 0.9
  }
  return sq.price * (sq.kind === 'clubService' ? 0.8 : 0.9)
}

/** Hace una acción de la IA. Devuelve false si no le tocaba a una IA (o la partida terminó). */
export function aiStep(s: GameState, rng: () => number = Math.random): boolean {
  if (s.phase === 'gameOver' || s.proposal) return false // con una propuesta pendiente la IA espera al humano
  const p = s.players[actor(s)]
  if (!p) return false
  // Tras una quiebra el turno del jugador eliminado se cierra solo, sea humano o IA.
  if (s.phase === 'endTurn' && p.bankrupt) return endTurn(s), true
  if (!p.ai || p.bankrupt) return false

  switch (s.phase) {
    case 'roll': return stepRoll(s, p, rng)
    case 'buy': return stepBuy(s, p, rng)
    case 'auction': return stepAuction(s, p, rng)
    case 'card': resolveCard(s); return true
    case 'cardChoice': chooseRisk(s, p.money < 5_000); return true
    case 'debt': return stepDebt(s, p)
    case 'endTurn': endTurn(s); return true
  }
  return false
}

function stepRoll(s: GameState, p: Player, rng: () => number): boolean {
  const prof = profileOf(p)
  if (p.inJail) {
    if (p.jailCards.length) return useJailCard(s), true
    if (p.money >= prof.jailFinePayAt) return payJailFine(s), true
    return roll(s, rng), true // intenta sacar doble
  }
  // Completar un grupo comprándole la concesión que le falta a otro jugador.
  if (aiProposeTrade(s, p, rng)) return true
  // Construir (las concesiones que más rentan primero), siempre con colchón.
  const stadiums = ownedBy(s, p.id)
    .filter((x): x is StadiumSquare => x.kind === 'stadium')
    .sort((a, b) => b.rents[1] - a.rents[1])
  for (const sq of stadiums) {
    if (p.money - sq.buildCost < cushion(s, p, prof.buildReserve)) continue
    const canStand = !canBuildStand(s, p.id, sq.position)
    const canSeat = !canBuildSeat(s, p.id, sq.position)
    if (!canStand && !canSeat) continue
    if (rng() < prof.skipBuildChance) break // se despista y no construye este turno
    return canStand ? (buildStand(s, p.id, sq.position), true) : (buildSeat(s, p.id, sq.position), true)
  }
  for (const sq of ownedBy(s, p.id)) {
    if (s.properties[sq.position].mortgaged && p.money >= unmortgageCost(sq) + prof.unmortgageReserve && !canUnmortgage(s, p.id, sq.position))
      return unmortgage(s, p.id, sq.position), true
  }
  roll(s, rng)
  return true
}

function stepBuy(s: GameState, p: Player, rng: () => number): boolean {
  const prof = profileOf(p)
  const sq = s.board[p.position] as PropertySquare
  const completes = sq.kind === 'stadium' && !!otherPart(s, sq) && owner(s, otherPart(s, sq)!.position) === p.id
  const left = p.money - sq.price
  const wants = left >= cushion(s, p, prof.reserve) || (completes && left >= prof.completeReserve)
  if (wants && p.money >= sq.price && (completes || rng() >= prof.skipBuyChance)) buy(s)
  else declineBuy(s)
  return true
}

function stepAuction(s: GameState, p: Player, rng: () => number): boolean {
  const prof = profileOf(p)
  const a = s.auction!
  const sq = s.board[a.position] as PropertySquare
  const noise = 1 - prof.bidNoise + rng() * 2 * prof.bidNoise
  const maxBid = Math.min(valuation(s, p, sq) * prof.bidFactor * noise, p.money - 2_000)
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
