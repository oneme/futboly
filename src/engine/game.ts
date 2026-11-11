import { buildBoard, loadCards } from './data'
import type { Card, DepartmentSquare, PropertySquare, Square } from './types'

export const START_MONEY = 150_000
const BOARD_SIZE = 40

export type Phase =
  | 'roll' // el jugador actual debe tirar los dados
  | 'card' // ha robado una carta: debe leerla y aplicarla con resolveCard()
  | 'cardChoice' // carta de riesgo: pagar la multa o robar una Sorpresa (chooseRisk)
  | 'buy' // ha caído en una concesión libre: comprar o subasta
  | 'auction' // pendiente de resolver la subasta
  | 'debt' // no puede pagar: debe vender/hipotecar (paso 4) o declararse en quiebra
  | 'endTurn' // puede cerrar el turno
  | 'gameOver'

/** Quién cobra: un jugador (id), la Banca o el bote del Parking. */
export type Creditor = number | 'bank' | 'parking'

/** Qué ocurre cuando una deuda se salda: seguir la casilla, mover desde el Banquillo o volver a tirar. */
export type DebtResume = 'afterLanding' | 'jailMove' | 'roll'

export type GameEventType =
  | 'dice' | 'buy' | 'rent' | 'pay' | 'receive' | 'card' | 'jail'
  | 'build' | 'sell' | 'mortgage' | 'trade' | 'bankrupt' | 'win'

/** Subasta por pujas: se turnan los jugadores que siguen en ella hasta que queda uno. */
export interface Auction {
  position: number
  bid: number // puja más alta (0 = nadie ha pujado)
  leader: number | null // quien la ha hecho
  passed: number[] // jugadores que se han retirado
  turn: number // a quién le toca decidir
}

/** Reglas opcionales de la partida. */
export interface GameRules {
  /**
   * Regla del manual (pág. 3): los jugadores solo pueden cambiar o vender concesiones entre ellos
   * cuando la Banca ya no tiene títulos. Desactivada por defecto: se puede intercambiar siempre.
   */
  tradeOnlyWhenBankEmpty: boolean
}
export const DEFAULT_RULES: GameRules = { tradeOnlyWhenBankEmpty: false }

export interface PlayerSpec {
  name: string
  /** Jugador controlado por la máquina (ver ai.ts). */
  ai?: boolean
}

export interface Player {
  id: number
  name: string
  ai: boolean
  money: number
  position: number
  inJail: boolean
  jailTurns: number
  bankrupt: boolean
  /** Cartas "Salga del Banquillo" guardadas (se pueden vender a otro jugador). */
  jailCards: Card[]
}

export interface PropertyState {
  owner: number | null
  seats: number // 0..4
  stand: boolean // tribuna (sustituye a los 4 asientos)
  mortgaged: boolean
}

export interface GameState {
  board: Square[]
  players: Player[]
  /** Estado de cada propiedad, indexado por posición del tablero. */
  properties: Record<number, PropertyState>
  current: number
  phase: Phase
  dice: [number, number] | null
  doublesInRow: number
  rolledDouble: boolean
  parkingPot: number
  /** Existencias de la Banca: 32 asientos y 12 tribunas. */
  bankSeats: number
  bankStands: number
  /** Mazos: se roba de la primera posición; las usadas van al fondo. */
  decks: { federation: Card[]; surprise: Card[] }
  /** Carta robada pendiente de aplicar. */
  card: { deck: 'federation' | 'surprise'; card: Card } | null
  auction: Auction | null
  debt: { debtor: number; amount: number; creditor: Creditor; resume: DebtResume } | null
  winner: number | null
  log: string[]
  /** Sucesos recientes para sonidos y animaciones; eventCount cuenta todos los emitidos. */
  events: GameEventType[]
  eventCount: number
  rules: GameRules
}

export const isProperty = (sq: Square): sq is PropertySquare =>
  sq.kind === 'stadium' || sq.kind === 'stadiumService' || sq.kind === 'clubService'

// ---------- Creación ----------

function shuffle<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

export function createGame(
  specs: (string | PlayerSpec)[],
  board: Square[] = buildBoard(),
  rng: () => number = Math.random,
  rules: Partial<GameRules> = {},
): GameState {
  if (specs.length < 2 || specs.length > 6) throw new Error('De 2 a 6 jugadores')
  const properties: Record<number, PropertyState> = {}
  for (const sq of board)
    if (isProperty(sq)) properties[sq.position] = { owner: null, seats: 0, stand: false, mortgaged: false }
  const decks = loadCards(board)
  shuffle(decks.federation, rng)
  shuffle(decks.surprise, rng)
  return {
    board,
    players: specs.map((spec, id) => ({
      id,
      name: typeof spec === 'string' ? spec : spec.name,
      ai: typeof spec === 'string' ? false : !!spec.ai,
      money: START_MONEY, position: 0, inJail: false, jailTurns: 0, bankrupt: false, jailCards: [],
    })),
    properties,
    current: 0,
    phase: 'roll',
    dice: null,
    doublesInRow: 0,
    rolledDouble: false,
    parkingPot: 0,
    bankSeats: 32,
    bankStands: 12,
    decks,
    card: null,
    auction: null,
    debt: null,
    winner: null,
    log: [],
    events: [],
    eventCount: 0,
    rules: { ...DEFAULT_RULES, ...rules },
  }
}

// ---------- Utilidades ----------

export const currentPlayer = (s: GameState) => s.players[s.current]
const log = (s: GameState, msg: string) => s.log.push(msg)

/** Anota un suceso para la interfaz (sonidos). Se guardan los últimos 60. */
export function emit(s: GameState, type: GameEventType) {
  s.events.push(type)
  if (s.events.length > 60) s.events.shift()
  s.eventCount++
}
const die = (rng: () => number) => Math.floor(rng() * 6) + 1
const money = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function assertPhase(s: GameState, ...phases: Phase[]) {
  if (!phases.includes(s.phase)) throw new Error(`Acción no permitida en la fase "${s.phase}"`)
}

const jailPosition = (s: GameState) => s.board.findIndex((x) => x.kind === 'jail')
const jailFine = (s: GameState) => (s.board[jailPosition(s)] as DepartmentSquare).amount
const startSalary = (s: GameState) => (s.board[0] as DepartmentSquare).amount

const countOwned = (s: GameState, owner: number, kind: Square['kind']) =>
  s.board.filter((x) => x.kind === kind && s.properties[x.position].owner === owner).length

/** Cobra al jugador. Si no puede pagar, pasa a fase "debt" y devuelve false. */
function charge(
  s: GameState,
  debtor: number,
  amount: number,
  creditor: Creditor,
  resume: DebtResume = 'afterLanding',
): boolean {
  const p = s.players[debtor]
  if (p.money < amount) {
    s.debt = { debtor, amount, creditor, resume }
    s.phase = 'debt'
    log(s, `${p.name} debe ${money(amount)} y no puede pagarlo.`)
    return false
  }
  p.money -= amount
  if (typeof creditor === 'number') s.players[creditor].money += amount
  else if (creditor === 'parking') s.parkingPot += amount
  return true
}

// ---------- Alquileres ----------

export function calcRent(s: GameState, position: number, diceTotal: number): number {
  const sq = s.board[position]
  const ps = s.properties[position]
  if (!isProperty(sq) || !ps || ps.owner === null || ps.mortgaged) return 0

  switch (sq.kind) {
    case 'stadium': {
      if (ps.stand) return sq.rents[5]
      if (ps.seats > 0) return sq.rents[ps.seats]
      // Sin mejoras: doble si posee el grupo completo y ninguna está hipotecada.
      const group = s.board.filter((x) => x.kind === 'stadium' && x.team === sq.team)
      const complete = group.every(
        (g) => s.properties[g.position].owner === ps.owner && !s.properties[g.position].mortgaged,
      )
      return complete ? sq.rents[0] * 2 : sq.rents[0]
    }
    case 'stadiumService':
      return sq.rentByOwned[countOwned(s, ps.owner, 'stadiumService') - 1]
    case 'clubService':
      return sq.diceMultiplierByOwned[countOwned(s, ps.owner, 'clubService') - 1] * diceTotal
  }
}

// ---------- Movimiento ----------

function goToJail(s: GameState) {
  const p = currentPlayer(s)
  p.position = jailPosition(s)
  p.inJail = true
  p.jailTurns = 0
  s.rolledDouble = false
  log(s, `${p.name} va directamente al Banquillo.`)
  emit(s, 'jail')
}

/** Coloca al jugador actual; cobra Salida si ha pasado por ella o cae en ella. */
function placeAt(s: GameState, position: number, passedStart: boolean) {
  const p = currentPlayer(s)
  p.position = position
  if (passedStart) {
    p.money += startSalary(s)
    log(s, `${p.name} pasa por la Salida y cobra ${money(startSalary(s))}.`)
    emit(s, 'receive')
  }
}

/** Mueve a una casilla por carta (avanzando): cobra Salida si da la vuelta. */
export function moveTo(s: GameState, target: number) {
  const p = currentPlayer(s)
  placeAt(s, target, target < p.position)
  land(s)
}

// ---------- Acciones del jugador ----------

export function roll(s: GameState, rng: () => number = Math.random) {
  assertPhase(s, 'roll')
  const p = currentPlayer(s)
  const d1 = die(rng)
  const d2 = die(rng)
  const isDouble = d1 === d2
  s.dice = [d1, d2]
  log(s, `${p.name} saca ${d1} y ${d2}.`)
  emit(s, 'dice')

  if (p.inJail) return rollInJail(s, isDouble)

  if (isDouble) {
    s.doublesInRow++
    if (s.doublesInRow === 3) {
      log(s, 'Tres dobles seguidos.')
      goToJail(s)
      s.phase = 'endTurn'
      return
    }
  }
  s.rolledDouble = isDouble

  // Doble seis: se lleva el bote del Parking.
  if (d1 === 6 && d2 === 6 && s.parkingPot > 0) {
    p.money += s.parkingPot
    log(s, `${p.name} se lleva el bote del Parking: ${money(s.parkingPot)}.`)
    s.parkingPot = 0
  }

  const steps = d1 + d2
  placeAt(s, (p.position + steps) % BOARD_SIZE, p.position + steps >= BOARD_SIZE)
  land(s)
}

/** Reglas del Banquillo al tirar: doble = sale y avanza (sin turno extra); 3.ª vez = paga y avanza. */
function rollInJail(s: GameState, isDouble: boolean) {
  const p = currentPlayer(s)
  const steps = s.dice![0] + s.dice![1]
  p.jailTurns++
  s.rolledDouble = false

  if (isDouble) {
    p.inJail = false
    log(s, `${p.name} saca doble y sale del Banquillo.`)
  } else if (p.jailTurns >= 3) {
    if (!charge(s, p.id, jailFine(s), 'bank', 'jailMove')) return
    p.inJail = false
    log(s, `${p.name} paga ${money(jailFine(s))} y sale del Banquillo.`)
  } else {
    log(s, `${p.name} sigue en el Banquillo.`)
    s.phase = 'endTurn'
    return
  }
  placeAt(s, (p.position + steps) % BOARD_SIZE, p.position + steps >= BOARD_SIZE)
  land(s)
}

/** Pagar la multa de 5.000 para salir del Banquillo antes de tirar. */
export function payJailFine(s: GameState) {
  assertPhase(s, 'roll')
  const p = currentPlayer(s)
  if (!p.inJail) throw new Error('El jugador no está en el Banquillo')
  if (!charge(s, p.id, jailFine(s), 'bank', 'roll')) return
  p.inJail = false
  log(s, `${p.name} paga ${money(jailFine(s))} y sale del Banquillo.`)
}

export function buy(s: GameState) {
  assertPhase(s, 'buy')
  const p = currentPlayer(s)
  const sq = s.board[p.position] as PropertySquare
  if (p.money < sq.price) throw new Error('No tiene dinero suficiente')
  p.money -= sq.price
  s.properties[p.position].owner = p.id
  log(s, `${p.name} compra ${sq.name} por ${money(sq.price)}.`)
  emit(s, 'buy')
  afterLanding(s)
}

/** Rechaza la compra: sale a subasta entre todos los jugadores, incluido quien la rechaza. */
export function declineBuy(s: GameState) {
  assertPhase(s, 'buy')
  s.auction = { position: currentPlayer(s).position, bid: 0, leader: null, passed: [], turn: s.current }
  s.phase = 'auction'
  log(s, `${s.board[s.auction.position].name} sale a subasta.`)
  auctionAdvance(s)
}

/** Siguiente jugador que puede pujar (no retirado, no en quiebra y que no sea el que va ganando). */
function nextBidder(s: GameState, a: Auction): number {
  const n = s.players.length
  for (let k = 1; k <= n; k++) {
    const i = (a.turn + k) % n
    const q = s.players[i]
    if (!q.bankrupt && !a.passed.includes(i) && i !== a.leader) return i
  }
  return a.turn
}

/** Tras cada puja o retirada: retira a quien no puede subir, cierra la subasta o pasa el turno. */
function auctionAdvance(s: GameState) {
  const a = s.auction!
  for (const q of s.players) {
    if (q.bankrupt || a.passed.includes(q.id) || q.id === a.leader) continue
    if (q.money <= a.bid) {
      a.passed.push(q.id)
      log(s, `${q.name} no puede subir de ${money(a.bid)} y se retira.`)
    }
  }
  const active = s.players.filter((q) => !q.bankrupt && !a.passed.includes(q.id))
  const onlyLeaderLeft = a.leader !== null && active.every((q) => q.id === a.leader)
  if (onlyLeaderLeft || (a.leader === null && active.length === 0)) return closeAuction(s)
  a.turn = nextBidder(s, a)
}

function closeAuction(s: GameState) {
  const a = s.auction!
  if (a.leader !== null) resolveAuction(s, a.leader, a.bid)
  else resolveAuction(s, null)
}

/** Quien tiene el turno de la subasta puja una cantidad mayor que la actual (y que pueda pagar). */
export function auctionBid(s: GameState, amount: number) {
  assertPhase(s, 'auction')
  const a = s.auction!
  const p = s.players[a.turn]
  if (!Number.isInteger(amount) || amount <= a.bid) throw new Error('La puja debe superar la actual')
  if (amount > p.money) throw new Error('No tiene dinero suficiente')
  a.bid = amount
  a.leader = p.id
  log(s, `${p.name} puja ${money(amount)}.`)
  auctionAdvance(s)
}

/** Quien tiene el turno se retira de la subasta. */
export function auctionPass(s: GameState) {
  assertPhase(s, 'auction')
  const a = s.auction!
  const p = s.players[a.turn]
  a.passed.push(p.id)
  log(s, `${p.name} se retira de la subasta.`)
  auctionAdvance(s)
}

/** Cierra la subasta directamente (ganador y precio ya decididos); null = nadie puja. */
export function resolveAuction(s: GameState, winner: number | null, price = 0) {
  assertPhase(s, 'auction')
  const position = s.auction!.position
  if (winner !== null) {
    if (s.players[winner].money < price) throw new Error('El ganador no puede pagar su puja')
    s.players[winner].money -= price
    s.properties[position].owner = winner
    log(s, `${s.players[winner].name} gana la subasta de ${s.board[position].name} por ${money(price)}.`)
    emit(s, 'buy')
  } else {
    log(s, `Nadie puja por ${s.board[position].name}.`)
  }
  s.auction = null
  afterLanding(s)
}

export function endTurn(s: GameState) {
  assertPhase(s, 'endTurn')
  let next = s.current
  do next = (next + 1) % s.players.length
  while (s.players[next].bankrupt)
  s.current = next
  s.doublesInRow = 0
  s.rolledDouble = false
  s.dice = null
  s.phase = 'roll'
}

/** Quiebra (versión básica): el acreedor recibe dinero, mejoras (a mitad de precio) y propiedades. */
export function declareBankruptcy(s: GameState) {
  assertPhase(s, 'debt')
  const { debtor, creditor } = s.debt!
  const p = s.players[debtor]
  let cash = p.money
  for (const sq of s.board) {
    if (!isProperty(sq)) continue
    const ps = s.properties[sq.position]
    if (ps.owner !== p.id) continue
    if (sq.kind === 'stadium') {
      const half = sq.buildCost / 2
      cash += ps.seats * half + (ps.stand ? 5 * half : 0) // tribuna = 5 asientos
      s.bankSeats += ps.seats
      if (ps.stand) s.bankStands++
      ps.seats = 0
      ps.stand = false
    }
    if (typeof creditor === 'number') ps.owner = creditor
    else {
      ps.owner = null
      ps.mortgaged = false
    }
  }
  if (typeof creditor === 'number') s.players[creditor].money += cash
  else if (creditor === 'parking') s.parkingPot += cash
  for (const c of p.jailCards) s.decks[c.deck].push(c)
  p.jailCards = []
  p.money = 0
  p.bankrupt = true
  s.debt = null
  log(s, `${p.name} se declara en quiebra.`)
  emit(s, 'bankrupt')

  const alive = s.players.filter((x) => !x.bankrupt)
  if (alive.length === 1) {
    s.winner = alive[0].id
    s.phase = 'gameOver'
    log(s, `${alive[0].name} gana la partida.`)
    emit(s, 'win')
  } else {
    s.rolledDouble = false
    s.phase = 'endTurn'
  }
}

/** Salda la deuda pendiente (tras vender o hipotecar lo necesario) y reanuda el turno. */
export function settleDebt(s: GameState) {
  assertPhase(s, 'debt')
  const d = s.debt!
  const p = s.players[d.debtor]
  if (p.money < d.amount) throw new Error('Todavía no puede pagar la deuda')
  p.money -= d.amount
  if (typeof d.creditor === 'number') s.players[d.creditor].money += d.amount
  else if (d.creditor === 'parking') s.parkingPot += d.amount
  s.debt = null
  log(s, `${p.name} salda su deuda de ${money(d.amount)}.`)
  emit(s, 'pay')

  if (d.resume === 'roll') {
    p.inJail = false
    s.phase = 'roll'
  } else if (d.resume === 'jailMove') {
    p.inJail = false
    const steps = s.dice![0] + s.dice![1]
    placeAt(s, (p.position + steps) % BOARD_SIZE, p.position + steps >= BOARD_SIZE)
    land(s)
  } else {
    afterLanding(s)
  }
}

// ---------- Cartas ----------

function drawCard(s: GameState, deck: 'federation' | 'surprise') {
  const card = s.decks[deck].shift()!
  // La carta "Salga del Banquillo" se la queda el jugador; las demás vuelven al fondo.
  if (card.action.type !== 'getOutOfJail') s.decks[deck].push(card)
  s.card = { deck, card }
  s.phase = 'card'
  emit(s, 'card')
  log(s, `${currentPlayer(s).name} roba una carta de ${deck === 'federation' ? 'Federación' : 'Sorpresa'}: ${card.text}`)
}

/** Aplica la carta robada (sus instrucciones son obligatorias). */
export function resolveCard(s: GameState) {
  assertPhase(s, 'card')
  const { card } = s.card!
  const a = card.action
  const p = currentPlayer(s)
  if (a.type !== 'payOrDrawSurprise') s.card = null

  switch (a.type) {
    case 'receive':
      p.money += a.amount
      emit(s, 'receive')
      return afterLanding(s)
    case 'pay':
      if (charge(s, p.id, a.amount, 'bank')) {
        emit(s, 'pay')
        afterLanding(s)
      }
      return
    case 'collectFromEach':
      // Simplificación: quien no llega paga lo que tenga.
      for (const q of s.players) {
        if (q.id === p.id || q.bankrupt) continue
        const amount = Math.min(q.money, a.amount)
        q.money -= amount
        p.money += amount
      }
      emit(s, 'receive')
      return afterLanding(s)
    case 'moveTo':
      placeAt(s, a.position, a.position < p.position) // cobra Salida si da la vuelta
      return land(s)
    case 'moveBack':
      placeAt(s, (p.position - a.steps + BOARD_SIZE) % BOARD_SIZE, false)
      return land(s)
    case 'goToJail':
      goToJail(s)
      s.phase = 'endTurn'
      return
    case 'getOutOfJail':
      p.jailCards.push(card)
      log(s, `${p.name} se guarda la carta "Salga del Banquillo".`)
      return afterLanding(s)
    case 'repairs': {
      let seats = 0
      let stands = 0
      for (const ps of Object.values(s.properties)) {
        if (ps.owner !== p.id) continue
        seats += ps.seats
        stands += ps.stand ? 1 : 0
      }
      const total = seats * a.perSeat + stands * a.perStand
      log(s, `${p.name} tiene ${seats} asientos y ${stands} tribunas: paga ${money(total)}.`)
      if (total === 0 || charge(s, p.id, total, 'bank')) {
        if (total > 0) emit(s, 'pay')
        afterLanding(s)
      }
      return
    }
    case 'payOrDrawSurprise':
      s.phase = 'cardChoice' // la carta sigue en s.card hasta que el jugador elija
      return
  }
}

/** Carta de riesgo: false = paga la multa; true = roba una Sorpresa y la sigue obligatoriamente. */
export function chooseRisk(s: GameState, drawSurprise: boolean) {
  assertPhase(s, 'cardChoice')
  const a = s.card!.card.action as { type: 'payOrDrawSurprise'; amount: number }
  const p = currentPlayer(s)
  s.card = null
  if (drawSurprise) return drawCard(s, 'surprise')
  log(s, `${p.name} paga la multa de ${money(a.amount)}.`)
  if (charge(s, p.id, a.amount, 'bank')) afterLanding(s)
}

/** Usa una carta "Salga del Banquillo": vuelve al fondo de su mazo. */
export function useJailCard(s: GameState) {
  assertPhase(s, 'roll')
  const p = currentPlayer(s)
  if (!p.inJail) throw new Error('El jugador no está en el Banquillo')
  const card = p.jailCards.shift()
  if (!card) throw new Error('No tiene ninguna carta "Salga del Banquillo"')
  s.decks[card.deck].push(card)
  p.inJail = false
  log(s, `${p.name} usa la carta "Salga del Banquillo".`)
}

// ---------- Resolución de la casilla ----------

function afterLanding(s: GameState) {
  s.phase = s.rolledDouble && !currentPlayer(s).inJail ? 'roll' : 'endTurn'
}

function land(s: GameState) {
  const p = currentPlayer(s)
  const sq = s.board[p.position]

  if (isProperty(sq)) {
    const ps = s.properties[sq.position]
    if (ps.owner === null) {
      s.phase = 'buy'
      log(s, `${p.name} cae en ${sq.name}, que está libre (${money(sq.price)}).`)
      return
    }
    if (ps.owner === p.id) return afterLanding(s)
    const rent = calcRent(s, sq.position, s.dice![0] + s.dice![1])
    if (rent === 0) {
      log(s, `${sq.name} está hipotecada: no se paga alquiler.`)
      return afterLanding(s)
    }
    log(s, `${p.name} paga ${money(rent)} de alquiler a ${s.players[ps.owner].name} por ${sq.name}.`)
    if (charge(s, p.id, rent, ps.owner)) {
      emit(s, 'rent')
      afterLanding(s)
    }
    return
  }

  switch (sq.kind) {
    case 'penalty':
      log(s, `${p.name} paga ${money(sq.amount)}: ${sq.name}.`)
      if (charge(s, p.id, sq.amount, 'bank')) {
        emit(s, 'pay')
        afterLanding(s)
      }
      return
    case 'parking':
      log(s, `${p.name} deja ${money(sq.amount)} en el Parking.`)
      if (charge(s, p.id, sq.amount, 'parking')) {
        emit(s, 'pay')
        afterLanding(s)
      }
      return
    case 'goToJail':
      goToJail(s)
      s.phase = 'endTurn'
      return
    case 'federation':
    case 'surprise':
      return drawCard(s, sq.kind)
    default: // Salida, Banquillo (simple visita)
      return afterLanding(s)
  }
}
