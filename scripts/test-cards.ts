import assert from 'node:assert/strict'
import {
  buy, chooseRisk, createGame, declareBankruptcy, declineBuy, endTurn, isProperty, resolveAuction,
  resolveCard, roll, settleDebt, useJailCard, type GameState,
} from '../src/engine/game'
import {
  buildSeat, buildStand, canBuildSeat, canBuildStand, canMortgage, canSellSeat, canSellStands,
  mortgage, sellJailCard, sellSeat, sellStands,
} from '../src/engine/management'
import type { Card } from '../src/engine/types'

const rigged = (...faces: number[]) => {
  const q = [...faces]
  return () => (q.shift()! - 1) / 6 + 0.01
}
const names = ['Ana', 'Beto', 'Carla']
let passed = 0
const test = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log('OK  ', name)
}

/** Pone al frente del mazo la primera carta que cumpla el predicado. */
function force(g: GameState, deck: 'federation' | 'surprise', pred: (c: Card) => boolean) {
  const d = g.decks[deck]
  const i = d.findIndex(pred)
  assert.ok(i >= 0, 'carta no encontrada')
  d.unshift(...d.splice(i, 1))
}
const is = (type: string, extra: Record<string, unknown> = {}) => (c: Card) =>
  c.action.type === type && Object.entries(extra).every(([k, v]) => (c.action as never)[k] === v)

/** Ana (0) cae en Federación (posición 2) con un doble. */
const landFederation = (g: GameState) => roll(g, rigged(1, 1))
const posOf = (g: GameState, id: number) => g.board.findIndex((x) => 'id' in x && x.id === id)
/** Ana cae en Sorpresa (posición 8 del tablero real) sin doble. */
const landSurprise = (g: GameState) => roll(g, rigged(3, 5))

test('Mazos: 16 + 16 cartas, barajados', () => {
  const g = createGame(names)
  assert.equal(g.decks.federation.length, 16)
  assert.equal(g.decks.surprise.length, 16)
  const h = createGame(names)
  assert.notDeepEqual(g.decks.federation.map((c) => c.text), h.decks.federation.map((c) => c.text))
})

test('Cobrar, pagar y cobrar a cada jugador', () => {
  let g = createGame(names)
  force(g, 'federation', is('receive', { amount: 5000 }))
  landFederation(g)
  assert.equal(g.phase, 'card')
  assert.equal(g.decks.federation.length, 16) // la carta vuelve al fondo
  resolveCard(g)
  assert.equal(g.players[0].money, 155_000)
  assert.equal(g.phase, 'roll') // sacó doble

  g = createGame(names)
  force(g, 'federation', is('pay', { amount: 10_000 }))
  landFederation(g)
  resolveCard(g)
  assert.equal(g.players[0].money, 140_000)

  g = createGame(names)
  force(g, 'federation', is('collectFromEach'))
  landFederation(g)
  resolveCard(g)
  assert.equal(g.players[0].money, 152_000)
  assert.equal(g.players[1].money, 149_000)
  assert.equal(g.players[2].money, 149_000)
})

test('Mover: pasa por Salida, directo al Banquillo, retroceder y casilla de destino', () => {
  let g = createGame(names)
  force(g, 'federation', is('moveTo', { position: 1 })) // visita secreta al Betis
  landFederation(g)
  resolveCard(g)
  assert.equal(g.players[0].position, 1)
  assert.equal(g.players[0].money, 170_000) // da la vuelta: cobra Salida
  assert.equal(g.phase, 'buy')

  g = createGame(names)
  force(g, 'federation', is('goToJail'))
  landFederation(g)
  resolveCard(g)
  assert.equal(g.players[0].inJail, true)
  assert.equal(g.players[0].position, 12)
  assert.equal(g.players[0].money, 150_000)
  assert.equal(g.phase, 'endTurn')

  g = createGame(names)
  force(g, 'surprise', is('moveBack', { steps: 3 }))
  landSurprise(g) // posición 8 -> 5 = Almohadillas (libre)
  resolveCard(g)
  assert.equal(g.players[0].position, 5)
  assert.equal(g.players[0].money, 150_000)
  assert.equal(g.phase, 'buy')

  g = createGame(names)
  force(g, 'surprise', is('moveTo', { position: 39 })) // Camp Nou tribuna
  landSurprise(g)
  resolveCard(g)
  assert.equal(g.players[0].position, 39)
  assert.equal(g.players[0].money, 150_000) // desde la 8 no pasa por Salida
  assert.equal(g.phase, 'buy')
})

test('Reparaciones: por asiento y por tribuna', () => {
  const g = createGame(names)
  g.properties[1].owner = 0
  g.properties[1].seats = 2
  g.properties[3].owner = 0
  g.properties[3].seats = 3
  const atocha = posOf(g, 22)
  g.properties[atocha].owner = 0
  g.properties[atocha].stand = true
  force(g, 'surprise', is('repairs', { perSeat: 4000, perStand: 11_000 }))
  landSurprise(g)
  resolveCard(g)
  assert.equal(g.players[0].money, 150_000 - (5 * 4000 + 11_000))
})

test('Carta de riesgo: pagar 1.000 o robar Sorpresa', () => {
  let g = createGame(names)
  force(g, 'federation', is('payOrDrawSurprise'))
  landFederation(g)
  resolveCard(g)
  assert.equal(g.phase, 'cardChoice')
  chooseRisk(g, false)
  assert.equal(g.players[0].money, 149_000)
  assert.equal(g.phase, 'roll')

  g = createGame(names)
  force(g, 'federation', is('payOrDrawSurprise'))
  force(g, 'surprise', is('receive', { amount: 10_000 }))
  landFederation(g)
  resolveCard(g)
  chooseRisk(g, true)
  assert.equal(g.phase, 'card')
  assert.equal(g.card!.deck, 'surprise')
  resolveCard(g) // obligatoria
  assert.equal(g.players[0].money, 160_000)
})

test('"Salga del Banquillo": se guarda, se usa, vuelve al mazo y se puede vender', () => {
  const g = createGame(names)
  force(g, 'federation', is('getOutOfJail'))
  landFederation(g)
  resolveCard(g)
  const p = g.players[0]
  assert.equal(p.jailCards.length, 1)
  assert.equal(g.decks.federation.length, 15)

  sellJailCard(g, 0, 1, 0, 3_000)
  assert.equal(p.jailCards.length, 0)
  assert.equal(g.players[1].jailCards.length, 1)
  assert.equal(p.money, 153_000)

  g.current = 1
  g.phase = 'roll'
  g.players[1].inJail = true
  useJailCard(g)
  assert.equal(g.players[1].inJail, false)
  assert.equal(g.decks.federation.length, 16)
  assert.equal(g.decks.federation.at(-1)!.action.type, 'getOutOfJail')
  assert.throws(() => useJailCard(g), /Banquillo/)
})

test('Quiebra: las cartas "Salga del Banquillo" vuelven al mazo', () => {
  const g = createGame(['Ana', 'Beto'])
  force(g, 'surprise', is('getOutOfJail'))
  landSurprise(g)
  resolveCard(g)
  assert.equal(g.decks.surprise.length, 15)
  g.players[0].money = 0
  g.debt = { debtor: 0, amount: 1_000, creditor: 'bank', resume: 'afterLanding' }
  g.phase = 'debt'
  declareBankruptcy(g)
  assert.equal(g.decks.surprise.length, 16)
})

// ---------- Simulación de partidas completas ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function raiseMoney(g: GameState) {
  const { debtor, amount } = g.debt!
  const own = g.board.filter((x) => isProperty(x) && g.properties[x.position].owner === debtor)
  for (const sq of own) {
    if (g.players[debtor].money >= amount) break
    if (!canSellStands(g, debtor, sq.position)) sellStands(g, debtor, sq.position)
    while (!canSellSeat(g, debtor, sq.position)) sellSeat(g, debtor, sq.position)
    if (!canMortgage(g, debtor, sq.position)) mortgage(g, debtor, sq.position)
  }
  g.players[debtor].money >= amount ? settleDebt(g) : declareBankruptcy(g)
}

function simulate(seed: number): GameState {
  const rng = mulberry32(seed)
  const g = createGame(['A', 'B', 'C', 'D'], undefined, rng)
  for (let i = 0; i < 30_000 && g.phase !== 'gameOver'; i++) {
    const p = g.players[g.current]
    switch (g.phase) {
      case 'roll':
        if (p.inJail && p.jailCards.length) useJailCard(g)
        for (const sq of g.board) {
          if (sq.kind !== 'stadium' || p.money < sq.buildCost + 30_000 || rng() < 0.5) continue
          if (!canBuildStand(g, p.id, sq.position)) buildStand(g, p.id, sq.position)
          else if (!canBuildSeat(g, p.id, sq.position)) buildSeat(g, p.id, sq.position)
        }
        roll(g, rng)
        break
      case 'card': resolveCard(g); break
      case 'cardChoice': chooseRisk(g, rng() < 0.5); break
      case 'buy': {
        const price = (g.board[p.position] as { price: number }).price
        p.money >= price && rng() < 0.9 ? buy(g) : declineBuy(g)
        break
      }
      case 'auction': {
        const price = (g.board[g.auction!.position] as { price: number }).price
        const bidder = g.players.find((q) => !q.bankrupt && q.money >= price && rng() < 0.5)
        bidder ? resolveAuction(g, bidder.id, price) : resolveAuction(g, null)
        break
      }
      case 'debt': raiseMoney(g); break
      case 'endTurn': endTurn(g); break
    }
    // Invariantes: existencias de la Banca y cartas (ninguna se pierde ni se duplica)
    let seats = 0
    let stands = 0
    for (const ps of Object.values(g.properties)) {
      seats += ps.seats
      stands += ps.stand ? 1 : 0
    }
    assert.equal(seats + g.bankSeats, 32)
    assert.equal(stands + g.bankStands, 12)
    for (const deck of ['federation', 'surprise'] as const) {
      const held = g.players.reduce((n, q) => n + q.jailCards.filter((c) => c.deck === deck).length, 0)
      const inFlight = g.card && g.card.deck === deck && g.card.card.action.type === 'getOutOfJail' ? 1 : 0
      // Una carta robada de otro mazo (riesgo) no cuenta aquí: solo la que sale de este mazo.
      assert.equal(g.decks[deck].length + held + inFlight, 16, `cartas de ${deck}`)
    }
    for (const q of g.players) assert.ok(q.money >= 0, `dinero negativo (${q.name})`)
  }
  return g
}

test('Simulación: 40 partidas completas (cartas, Banquillo, quiebras) sin estados inválidos', () => {
  let finished = 0
  for (let seed = 1; seed <= 40; seed++) if (simulate(seed).phase === 'gameOver') finished++
  console.log(`      ${finished}/40 partidas terminaron con un ganador`)
  assert.ok(finished > 0)
})

console.log(`\n${passed} pruebas correctas`)
