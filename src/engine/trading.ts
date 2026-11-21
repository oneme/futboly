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
 *  - `proposeTrade` es la vía para un humano que ofrece un trato a una IA (la IA solo acepta o rechaza).
 *  - `negotiate` es lo mismo con CONTRAOFERTA: si la IA rechaza, puede devolver una contraoferta (`state.proposal`)
 *    pidiendo más dinero; el humano la acepta, la rechaza o contraofertea con `counterProposal`.
 *    Tras `MAX_COUNTER_ROUNDS` contraofertas la última oferta ya solo se acepta o se rechaza.
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

// ---------- Contraofertas ----------

export const MAX_COUNTER_ROUNDS = 3
export type NegotiationResult = 'accepted' | 'rejected' | 'countered'

/** La misma oferta vista desde el otro lado (quien recibe pasa a ser quien propone). */
export const mirrorOffer = (o: TradeOffer, round = o.round ?? 0): TradeOffer => ({
  from: o.to, to: o.from, fromPositions: o.toPositions, toPositions: o.fromPositions,
  fromCash: o.toCash, toCash: o.fromCash, round,
})

/**
 * Contraoferta de la IA (`offer.to`) a una oferta que no le convence: mismas concesiones, pero pide al otro jugador
 * el mínimo de dinero extra (en pasos de 500) que la hace aceptable. null si no hay forma razonable.
 */
export function counterOffer(s: GameState, offer: TradeOffer): TradeOffer | null {
  const traded = [...offer.fromPositions, ...offer.toPositions].reduce(
    (n, pos) => n + (s.board[pos] as PropertySquare).price, 0)
  const net = offer.fromCash - offer.toCash // dinero que va hacia la IA
  const cap = Math.max(0, -net) + Math.max(10_000, 2 * traded) // si pagaba ella, hasta bajar a 0 y un tope más
  for (let extra = 500; extra <= cap; extra += 500) {
    const n = net + extra
    const c: TradeOffer = { ...offer, fromCash: Math.max(n, 0), toCash: Math.max(-n, 0) }
    if (s.players[c.from].money < c.fromCash) return null // al otro jugador ya no le llega el dinero
    if (canTrade(s, c)) continue
    if (evaluateOffer(s, offer.to, c)) return c
  }
  return null
}

/** Una IA responde a una oferta: acepta, contraofrece (deja `state.proposal`) o rechaza. */
function respond(s: GameState, offer: TradeOffer): NegotiationResult {
  const ai = s.players[offer.to]
  const human = nameOf(s, offer.from)
  if (evaluateOffer(s, offer.to, offer)) {
    s.log.push(`${ai.name} acepta la propuesta de ${human}.`)
    execute(s, offer)
    return 'accepted'
  }
  const round = offer.round ?? 0
  const counter = round < MAX_COUNTER_ROUNDS ? counterOffer(s, offer) : null
  if (counter) {
    s.proposal = mirrorOffer(counter, round + 1)
    s.log.push(`${ai.name} rechaza la oferta de ${human} y contraofrece: da ${describeSide(s, counter.toPositions, counter.toCash)} y pide ${describeSide(s, counter.fromPositions, counter.fromCash)}.`)
    emit(s, 'trade')
    return 'countered'
  }
  s.log.push(`${ai.name} rechaza la propuesta de ${human}.`)
  for (const pos of offer.fromPositions) s.tradeCooldown[cooldownKey(offer.to, pos)] = s.turnCount + COOLDOWN_TURNS
  return 'rejected'
}

/** Un humano ofrece un trato a una IA, que puede aceptar, rechazar o contraofertar. */
export function negotiate(s: GameState, offer: TradeOffer): NegotiationResult {
  const err = canTrade(s, offer)
  if (err) throw new Error(err)
  if (!s.players[offer.to].ai) throw new Error('Los tratos entre humanos se cierran directamente con trade()')
  if (s.proposal) throw new Error('Hay una propuesta pendiente')
  return respond(s, offer)
}

/** ¿Puede el humano contraofertar a la propuesta pendiente? */
export const canCounter = (s: GameState): boolean => !!s.proposal && (s.proposal.round ?? 0) < MAX_COUNTER_ROUNDS

/**
 * El humano contraofertea a la propuesta pendiente de una IA con otra oferta (`counter.from` = el humano,
 * `counter.to` = la IA). La IA la acepta, la rechaza o vuelve a contraofertar.
 */
export function counterProposal(s: GameState, counter: TradeOffer): NegotiationResult {
  const pending = s.proposal
  if (!pending) throw new Error('No hay ninguna propuesta pendiente')
  if (!canCounter(s)) throw new Error('Ya no se admiten más contraofertas')
  if (counter.from !== pending.to || counter.to !== pending.from) throw new Error('La contraoferta debe ir al jugador que propuso')
  const err = canTrade(s, counter)
  if (err) throw new Error(err)
  s.proposal = null
  const next: TradeOffer = { ...counter, round: (pending.round ?? 0) + 1 }
  s.log.push(`${nameOf(s, next.from)} contraofrece a ${nameOf(s, next.to)}: da ${describeSide(s, next.fromPositions, next.fromCash)} y pide ${describeSide(s, next.toPositions, next.toCash)}.`)
  return respond(s, next)
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
