import assert from 'node:assert/strict'
import {
  buy, chooseRisk, createGame, declareBankruptcy, declineBuy, endTurn, isProperty, payJailFine,
  resolveAuction, resolveCard, roll, settleDebt, type GameState,
} from '../src/engine/game'
import {
  buildSeat, buildStand, canBuildSeat, canBuildStand, canMortgage, canSellSeat, canSellStands,
  canTrade, mortgage, sellSeat, sellStands, trade, unmortgage,
} from '../src/engine/management'

const rigged = (...faces: number[]) => {
  const q = [...faces]
  return () => (q.shift()! - 1) / 6 + 0.01
}
const posOf = (g: GameState, id: number) => g.board.findIndex((x) => 'id' in x && x.id === id)
const names = ['Ana', 'Beto', 'Carla']
let passed = 0
const test = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log('OK  ', name)
}

/** Partida donde Ana (0) posee los dos estadios del Betis (ids 1 y 2). */
function betisGame() {
  const g = createGame(names)
  const a = posOf(g, 1)
  const b = posOf(g, 2)
  g.properties[a].owner = 0
  g.properties[b].owner = 0
  return { g, a, b }
}

test('Construir asientos de forma uniforme y luego la tribuna', () => {
  const { g, a, b } = betisGame()
  assert.equal(canBuildSeat(g, 1, a), 'No es el propietario')
  buildSeat(g, 0, a)
  assert.equal(g.players[0].money, 145_000)
  assert.match(canBuildSeat(g, 0, a)!, /uniforme/)
  buildSeat(g, 0, b)
  for (let i = 0; i < 3; i++) {
    buildSeat(g, 0, a)
    buildSeat(g, 0, b)
  }
  assert.equal(g.bankSeats, 24)
  assert.match(canBuildSeat(g, 0, a)!, /4 asientos/)
  buildStand(g, 0, a)
  assert.equal(g.properties[a].stand, true)
  assert.equal(g.properties[a].seats, 0)
  assert.equal(g.bankSeats, 28) // los 4 asientos vuelven a la Banca
  assert.equal(g.bankStands, 11)
  assert.equal(g.players[0].money, 150_000 - 8 * 5_000 - 5_000)
  buildStand(g, 0, b)
  assert.equal(canBuildStand(g, 0, b), 'Ya tiene tribuna')
})

test('Tribuna: exige 4 asientos en las dos concesiones', () => {
  const { g, a, b } = betisGame()
  for (let i = 0; i < 4; i++) buildSeat(g, 0, a), buildSeat(g, 0, b)
  g.properties[b].seats = 3
  assert.match(canBuildStand(g, 0, a)!, /4 asientos/)
})

test('Vender asientos (uniforme, a mitad de precio) y tribunas (grupo entero)', () => {
  const { g, a, b } = betisGame()
  for (let i = 0; i < 3; i++) buildSeat(g, 0, a), buildSeat(g, 0, b)
  const before = g.players[0].money
  sellSeat(g, 0, a)
  assert.equal(g.players[0].money, before + 2_500)
  assert.match(canSellSeat(g, 0, a)!, /uniforme/)
  sellSeat(g, 0, b)

  const h = betisGame()
  for (let i = 0; i < 4; i++) buildSeat(h.g, 0, h.a), buildSeat(h.g, 0, h.b)
  buildStand(h.g, 0, h.a)
  buildStand(h.g, 0, h.b)
  assert.match(canSellSeat(h.g, 0, h.a)!, /tribuna/)
  const money = h.g.players[0].money
  sellStands(h.g, 0, h.a)
  assert.equal(h.g.players[0].money, money + 25_000) // 2 x 12.500
  assert.equal(h.g.bankSeats, 32)
  assert.equal(h.g.bankStands, 12)
  assert.equal(canSellStands(h.g, 0, h.a), 'No hay tribunas')
})

test('Hipotecas: exigen vender mejoras; levantar cuesta +10 %; grupo hipotecado no construye', () => {
  const { g, a, b } = betisGame()
  buildSeat(g, 0, a)
  assert.match(canMortgage(g, 0, b)!, /mejoras/)
  sellSeat(g, 0, a)
  mortgage(g, 0, a)
  assert.equal(g.players[0].money, 150_500) // -5.000 asiento +2.500 venta +3.000 hipoteca
  assert.match(canBuildSeat(g, 0, b)!, /sin hipotecar/)
  unmortgage(g, 0, a)
  assert.equal(g.players[0].money, 150_500 - 3_300)
})

test('Intercambios: solo sin títulos en la Banca, sin hipotecas ni mejoras', () => {
  const { g, a, b } = betisGame()
  const atocha = posOf(g, 22)
  g.properties[atocha].owner = 1
  const offer = { from: 0, to: 1, fromPositions: [a], toPositions: [atocha], fromCash: 0, toCash: 1_000 }
  assert.match(canTrade(g, offer)!, /Banca/)
  for (const p of Object.values(g.properties)) if (p.owner === null) p.owner = 2
  trade(g, offer)
  assert.equal(g.properties[a].owner, 1)
  assert.equal(g.properties[atocha].owner, 0)
  assert.equal(g.players[0].money, 151_000) // Ana recibe los 1.000 que paga Beto
  g.properties[b].mortgaged = true
  assert.match(canTrade(g, { ...offer, fromPositions: [b], toPositions: [], toCash: 0 })!, /hipotecada/)
})

test('Deuda: hipotecar para pagar y reanudar el turno', () => {
  const g = createGame(names)
  const t1 = posOf(g, 22)
  const t2 = posOf(g, 23)
  g.properties[t1].owner = 0
  g.properties[t2].owner = 0
  g.players[0].money = 1_000
  roll(g, rigged(2, 2)) // Multa y Cierre (20.000)
  assert.equal(g.phase, 'debt')
  assert.throws(() => settleDebt(g), /Todavía/)
  mortgage(g, 0, t1)
  mortgage(g, 0, t2)
  settleDebt(g)
  assert.equal(g.players[0].money, 1_000 + 39_000 - 20_000)
  assert.equal(g.phase, 'roll') // había sacado doble
})

test('Deuda en el Banquillo: la tercera tirada y la multa voluntaria se reanudan bien', () => {
  const g = createGame(names)
  const t1 = posOf(g, 22)
  g.properties[t1].owner = 0
  const p = g.players[0]
  p.inJail = true
  p.position = 12
  p.jailTurns = 2
  p.money = 1_000
  roll(g, rigged(1, 2))
  assert.equal(g.phase, 'debt')
  mortgage(g, 0, t1)
  settleDebt(g)
  assert.equal(p.inJail, false)
  assert.equal(p.position, 15)
  assert.equal(g.phase, 'buy')

  const h = createGame(names)
  h.properties[t1].owner = 0
  h.players[0].inJail = true
  h.players[0].position = 12
  h.players[0].money = 1_000
  payJailFine(h)
  assert.equal(h.phase, 'debt')
  mortgage(h, 0, t1)
  settleDebt(h)
  assert.equal(h.phase, 'roll')
  assert.equal(h.players[0].inJail, false)
})

test('Quiebra con mejoras: existencias de la Banca restauradas, acreedor cobra a mitad de precio', () => {
  const { g, a, b } = betisGame()
  for (let i = 0; i < 4; i++) buildSeat(g, 0, a), buildSeat(g, 0, b)
  g.players[0].money = 0
  g.debt = { debtor: 0, amount: 50_000, creditor: 1, resume: 'afterLanding' }
  g.phase = 'debt'
  declareBankruptcy(g)
  assert.equal(g.bankSeats, 32)
  assert.equal(g.players[1].money, 150_000 + 8 * 2_500)
  assert.equal(g.properties[a].owner, 1)
  assert.equal(g.properties[a].seats, 0)
})

// ---------- Simulación con bots que construyen e hipotecan ----------
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
  const g = createGame(['A', 'B', 'C', 'D'])
  for (let i = 0; i < 30_000 && g.phase !== 'gameOver'; i++) {
    const p = g.players[g.current]
    switch (g.phase) {
      case 'roll':
        for (const sq of g.board) {
          if (sq.kind !== 'stadium' || p.money < sq.buildCost + 30_000 || rng() < 0.5) continue
          if (!canBuildStand(g, p.id, sq.position)) buildStand(g, p.id, sq.position)
          else if (!canBuildSeat(g, p.id, sq.position)) buildSeat(g, p.id, sq.position)
        }
        roll(g, rng)
        break
      case 'buy': {
        const price = (g.board[p.position] as { price: number }).price
        p.money >= price && rng() < 0.9 ? buy(g) : declineBuy(g)
        break
      }
      case 'auction': {
        const pos = g.auction!.position
        const price = (g.board[pos] as { price: number }).price
        const bidder = g.players.find((q) => !q.bankrupt && q.money >= price && rng() < 0.5)
        bidder ? resolveAuction(g, bidder.id, price) : resolveAuction(g, null)
        break
      }
      case 'card': resolveCard(g); break
      case 'cardChoice': chooseRisk(g, false); break
      case 'debt': raiseMoney(g); break
      case 'endTurn': endTurn(g); break
    }
    // Invariantes
    let seats = 0
    let stands = 0
    for (const ps of Object.values(g.properties)) {
      seats += ps.seats
      stands += ps.stand ? 1 : 0
    }
    assert.equal(seats + g.bankSeats, 32, 'existencias de asientos')
    assert.equal(stands + g.bankStands, 12, 'existencias de tribunas')
    for (const q of g.players) assert.ok(q.money >= 0, `dinero negativo (${q.name})`)
  }
  return g
}

test('Simulación: 40 partidas con bots que construyen, hipotecan y quiebran', () => {
  let finished = 0
  for (let seed = 1; seed <= 40; seed++) if (simulate(seed).phase === 'gameOver') finished++
  console.log(`      ${finished}/40 partidas terminaron con un ganador`)
  assert.ok(finished > 0)
})

console.log(`\n${passed} pruebas correctas`)
