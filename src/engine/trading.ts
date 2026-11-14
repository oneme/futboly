import { emit, isProperty, type GameState, type Player } from './game'
import { AI_PROFILES, type AIProfile } from './aiProfiles'
import { canTrade, trade } from './management'
import type { PropertySquare, StadiumSquare, TradeOffer } from './types'
import { money } from './money'

/**
 * Intercambios con la máquina.
 *  - Una IA valora cualquier oferta (`evaluateOffer`) y la acepta o la rechaza.
 *  - Una IA puede proponer tratos (`aiProposeTrade`): compra la concesión que le completa un grupo.
 *    Si el otro jugador es una IA se resuelve al instante; si es humano queda como `state.proposal`
 *    y el humano responde con `answerProposal`.
 *  - `proposeTrade` es la vía para un humano que ofrece un trato a una IA.
 */

// ---------- Valoración ----------

const COOLDOWN_TURNS = 8
/** Parámetros de negociación según el nivel del jugador (aiProfiles.ts). */
const profile = (s: GameState, pid: number): AIProfile => AI_PROFILES[s.players[pid].level ?? 'normal']

const ownedSet = (s: GameState, pid: number) =>
  new Set(
    s.board.filter((x) => isProperty(x) && s.properties[x.position].owner === pid).map((x) => x.position),
  )

/** Valor de un conjunto de concesiones: precio + bonus por grupos completos y parejas de servicios. */
function portfolioValue(s: GameState, set: Set<number>, groupBonus: number): number {
  let v = 0
  const teams = new Map<string, StadiumSquare[]>()
  let svc = 0, svcSum = 0, club = 0, clubSum = 0
  for (const pos of set) {
    const sq = s.board[pos] as PropertySquare
    v += sq.price * 0.9
    if (sq.kind === 'stadium') teams.set(sq.team, [...(teams.get(sq.team) ?? []), sq])
    else if (sq.kind === 'stadiumService') (svc++, (svcSum += sq.price))
    else (club++, (clubSum += sq.price))
  }
  for (const parts of teams.values())
    if (parts.length === 2) v += groupBonus * (parts[0].price + parts[1].price) // grupo completo: se puede construir
  if (svc >= 2) v += 0.2 * svcSum * (svc - 1)
  if (club === 2) v += 0.4 * clubSum
  return v
}

/** Concesiones que ganaría y perdería `pid` con la oferta, y dinero que entra y sale. */
function sides(offer: TradeOffer, pid: number) {
  const isTo = pid === offer.to
  return {
    gain: isTo ? offer.fromPositions : offer.toPositions,
    lose: isTo ? offer.toPositions : offer.fromPositions,
    cashIn: isTo ? offer.fromCash : offer.toCash,
    cashOut: isTo ? offer.toCash : offer.fromCash,
  }
}
function propsAfter(s: GameState, pid: number, offer: TradeOffer) {
  const { gain, lose } = sides(offer, pid)
  const set = ownedSet(s, pid)
  lose.forEach((p) => set.delete(p))
  gain.forEach((p) => set.add(p))
  return set
}

/** Ganancia de valor para `pid` (dinero incluido) y la que obtiene el rival en concesiones. */
export function tradeDeltas(s: GameState, pid: number, offer: TradeOffer) {
  const rival = pid === offer.from ? offer.to : offer.from
  const { cashIn, cashOut } = sides(offer, pid)
  const bonus = profile(s, pid).groupBonus // cada IA valora los grupos a su manera, también los del rival
  const self = portfolioValue(s, propsAfter(s, pid, offer), bonus) - portfolioValue(s, ownedSet(s, pid), bonus) + cashIn - cashOut
  const rivalProps = portfolioValue(s, propsAfter(s, rival, offer), bonus) - portfolioValue(s, ownedSet(s, rival), bonus)
  return { self, rivalProps }
}

/** ¿Le interesa el trato a este jugador? */
export function evaluateOffer(s: GameState, pid: number, offer: TradeOffer): boolean {
  const { self, rivalProps } = tradeDeltas(s, pid, offer)
  const traded = [...offer.fromPositions, ...offer.toPositions].reduce(
    (n, pos) => n + (s.board[pos] as PropertySquare).price,
    0,
  )
  const prof = profile(s, pid)
  const needed = Math.max(prof.minGain, prof.minGainPct * traded)
  return self - prof.rivalPenalty * Math.max(0, rivalProps) >= needed
}

const nameOf = (s: GameState, pid: number) => s.players[pid].name
const sqName = (s: GameState, pos: number) => {
  const sq = s.board[pos] as PropertySquare
  return sq.kind === 'stadium' ? `${sq.name} (${sq.part === 'general' ? 'General' : 'Tribuna'})` : sq.name
}

/** Texto legible de lo que entrega cada lado (para el registro y la ventana de propuesta). */
export function describeSide(s: GameState, positions: number[], cash: number): string {
  const parts = positions.map((p) => sqName(s, p))
  if (cash) parts.push(money(cash))
  return parts.length ? parts.join(', ') : 'nada'
}

const cooldownKey = (from: number, pos: number) => `${from}>${pos}`

// ---------- Propuestas ----------

function execute(s: GameState, offer: TradeOffer) {
  trade(s, offer)
  s.log.push(
    `Trato cerrado: ${nameOf(s, offer.from)} da ${describeSide(s, offer.fromPositions, offer.fromCash)} y recibe ${describeSide(s, offer.toPositions, offer.toCash)} de ${nameOf(s, offer.to)}.`,
  )
}

/**
 * Un jugador ofrece un trato a una IA (o una IA a otra): la IA que responde decide al instante.
 * Devuelve true si se cerró el trato. Si quien responde es humano no se usa esta vía.
 */
export function proposeTrade(s: GameState, offer: TradeOffer): boolean {
  const err = canTrade(s, offer)
  if (err) throw new Error(err)
  const responder = s.players[offer.to]
  if (!responder.ai) throw new Error('Los tratos entre humanos se cierran directamente con trade()')
  if (!evaluateOffer(s, offer.to, offer)) {
    s.log.push(`${responder.name} rechaza la propuesta de ${nameOf(s, offer.from)}.`)
    return false
  }
  s.log.push(`${responder.name} acepta la propuesta de ${nameOf(s, offer.from)}.`)
  execute(s, offer)
  return true
}

/** El humano al que una IA ha hecho una propuesta la acepta o la rechaza. */
export function answerProposal(s: GameState, accept: boolean) {
  const offer = s.proposal
  if (!offer) throw new Error('No hay ninguna propuesta pendiente')
  s.proposal = null
  const from = nameOf(s, offer.from)
  const to = nameOf(s, offer.to)
  if (!accept) {
    s.log.push(`${to} rechaza la propuesta de ${from}.`)
    for (const pos of offer.toPositions) s.tradeCooldown[cooldownKey(offer.from, pos)] = s.turnCount + COOLDOWN_TURNS
    return
  }
  const err = canTrade(s, offer)
  if (err) {
    s.log.push(`La propuesta de ${from} ya no es posible: ${err}`)
    return
  }
  s.log.push(`${to} acepta la propuesta de ${from}.`)
  execute(s, offer)
}

/**
 * La IA busca una concesión ajena que le complete un grupo (o una pareja de servicios) y ofrece dinero por ella.
 * Con otra IA negocia subiendo la oferta hasta que acepte; con un humano propone un precio generoso.
 * Devuelve true si ha hecho algo (cerrar un trato o dejar una propuesta pendiente).
 */
export function aiProposeTrade(s: GameState, p: Player, rng: () => number = Math.random): boolean {
  if (s.proposal || p.money < 30_000) return false
  const prof = profile(s, p.id)
  // Una vez por turno decide si se anima a negociar (las IAs fáciles lo hacen pocas veces).
  const thinkKey = `think:${p.id}`
  if (s.tradeCooldown[thinkKey] === s.turnCount) return false
  s.tradeCooldown[thinkKey] = s.turnCount
  if (rng() >= prof.proposeChance) return false
  const mine = ownedSet(s, p.id)
  const before = portfolioValue(s, mine, prof.groupBonus)

  const wanted = s.board
    .filter((x): x is PropertySquare => isProperty(x))
    .filter((sq) => {
      const owner = s.properties[sq.position].owner
      return owner !== null && owner !== p.id && !s.players[owner].bankrupt && !s.properties[sq.position].mortgaged
    })
    .map((sq) => {
      const gain = portfolioValue(s, new Set([...mine, sq.position]), prof.groupBonus) - before
      return { sq, gain, owner: s.properties[sq.position].owner! }
    })
    .filter((c) => c.gain >= c.sq.price * 1.3 && (s.tradeCooldown[cooldownKey(p.id, c.sq.position)] ?? -1) < s.turnCount)
    .sort((a, b) => b.gain - a.gain)

  for (const { sq, owner } of wanted) {
    const target = s.players[owner]
    const cooldown = () => (s.tradeCooldown[cooldownKey(p.id, sq.position)] = s.turnCount + COOLDOWN_TURNS)
    const offerFor = (mult: number): TradeOffer => ({
      from: p.id, to: owner, fromPositions: [], toPositions: [sq.position],
      fromCash: Math.ceil((sq.price * mult) / 500) * 500, toCash: 0,
    })
    const viable = (o: TradeOffer) => p.money - o.fromCash >= 20_000 && !canTrade(s, o) && evaluateOffer(s, p.id, o)

    if (!target.ai) {
      const offer = offerFor(prof.humanOfferMult)
      if (!viable(offer)) continue
      s.proposal = offer
      s.log.push(`${p.name} propone a ${target.name}: ${describeSide(s, offer.fromPositions, offer.fromCash)} por ${sqName(s, sq.position)}.`)
      emit(s, 'trade')
      return true
    }
    for (const mult of [1.2, 1.6, 2, 2.5, 3]) {
      const offer = offerFor(mult)
      if (!viable(offer)) break // ya le sale demasiado caro
      if (evaluateOffer(s, owner, offer)) {
        s.log.push(`${p.name} ofrece ${money(offer.fromCash)} a ${target.name} por ${sqName(s, sq.position)}.`)
        s.log.push(`${target.name} acepta la propuesta de ${p.name}.`)
        execute(s, offer)
        return true
      }
    }
    cooldown()
  }
  return false
}
