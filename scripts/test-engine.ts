import assert from 'node:assert/strict'
import {
  buy, calcRent, chooseRisk, createGame, declareBankruptcy, declineBuy, endTurn, payJailFine,
  resolveAuction, resolveCard, roll, START_MONEY, type GameState,
} from '../src/engine/game'

/** RNG trucado: cada número es una cara de dado (1..6), en orden. */
const rigged = (...faces: number[]) => {
  const q = [...faces]
  return () => (q.shift()! - 1) / 6 + 0.01
}
const names3 = ['Ana', 'Beto', 'Carla']
let passed = 0
const test = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log('OK  ', name)
}

test('Creación: 150.000 por jugador, 28 propiedades libres', () => {
  const g = createGame(names3)
  assert.equal(g.players[0].money, START_MONEY)
  assert.equal(Object.keys(g.properties).length, 28)
})

test('Comprar, pagar alquiler y cambiar de turno', () => {
  const g = createGame(names3)
  roll(g, rigged(1, 2)) // posición 3: Betis Tribuna (id 2, 8.000)
  assert.equal(g.phase, 'buy')
  buy(g)
  assert.equal(g.players[0].money, 142_000)
  assert.equal(g.phase, 'endTurn')
  endTurn(g)
  assert.equal(g.current, 1)
  roll(g, rigged(1, 2)) // Beto cae en la casilla de Ana: alquiler base 500
  assert.equal(g.players[1].money, 149_500)
  assert.equal(g.players[0].money, 142_500)
})

test('Alquiler: doble con grupo completo, asientos, tribuna, hipoteca', () => {
  const g = createGame(names3)
  g.properties[1].owner = 0
  assert.equal(calcRent(g, 3, 0), 0) // libre
  g.properties[3].owner = 0
  assert.equal(calcRent(g, 3, 0), 1_000) // 500 x2
  g.properties[1].mortgaged = true
  assert.equal(calcRent(g, 3, 0), 500) // grupo incompleto
  g.properties[1].mortgaged = false
  g.properties[3].seats = 2
  assert.equal(calcRent(g, 3, 0), 6_600)
  g.properties[3].stand = true
  assert.equal(calcRent(g, 3, 0), 37_000)
  g.properties[3].mortgaged = true
  assert.equal(calcRent(g, 3, 0), 0)
})

test('Servicios de estadio y de club', () => {
  const g = createGame(names3)
  for (const pos of [5, 15]) g.properties[pos].owner = 0 // Almohadillas, Gorras
  assert.equal(calcRent(g, 5, 0), 5_000)
  g.properties[11].owner = 0 // Material Deportivo
  assert.equal(calcRent(g, 11, 7), 400 * 7)
  g.properties[28].owner = 0 // Autocares
  assert.equal(calcRent(g, 11, 7), 1_000 * 7)
})

test('Pasar por Salida cobra 20.000', () => {
  const g = createGame(names3)
  g.players[0].position = 38
  roll(g, rigged(1, 2)) // 41 % 40 = 1
  assert.equal(g.players[0].position, 1)
  assert.equal(g.players[0].money, START_MONEY + 20_000)
})

test('Tres dobles seguidos: directo al Banquillo', () => {
  const g = createGame(names3)
  roll(g, rigged(2, 2)) // posición 4: Multa y Cierre (-20.000)
  assert.equal(g.phase, 'roll') // doble: vuelve a tirar
  g.players[0].position = 0
  roll(g, rigged(2, 2)) // otra vez Multa y Cierre
  assert.equal(g.players[0].money, START_MONEY - 40_000)
  g.players[0].position = 0
  roll(g, rigged(1, 1))
  assert.equal(g.players[0].inJail, true)
  assert.equal(g.players[0].position, 12)
  assert.equal(g.phase, 'endTurn')
})

test('Banquillo: sale con doble, paga multa o a la 3.ª tirada', () => {
  const g = createGame(names3)
  const p = g.players[0]
  p.inJail = true
  p.position = 12
  roll(g, rigged(1, 2))
  assert.equal(p.inJail, true)
  assert.equal(g.phase, 'endTurn')
  g.phase = 'roll'
  roll(g, rigged(1, 2))
  g.phase = 'roll'
  roll(g, rigged(1, 2)) // 3.ª vez: paga 5.000 y avanza 3 (Gorras, posición 15)
  assert.equal(p.inJail, false)
  assert.equal(p.money, START_MONEY - 5_000)
  assert.equal(p.position, 15)

  const h = createGame(names3)
  h.players[0].inJail = true
  h.players[0].position = 12
  payJailFine(h)
  assert.equal(h.players[0].inJail, false)
  assert.equal(h.players[0].money, START_MONEY - 5_000)
})

test('Doble seis: se lleva el bote del Parking', () => {
  const g = createGame(names3)
  g.parkingPot = 4_000
  roll(g, rigged(6, 6)) // posición 12 (Banquillo, simple visita)
  assert.equal(g.players[0].money, START_MONEY + 4_000)
  assert.equal(g.parkingPot, 0)
})

test('Subasta y quiebra', () => {
  const g = createGame(names3)
  roll(g, rigged(1, 2))
  declineBuy(g)
  resolveAuction(g, 1, 6_000)
  assert.equal(g.properties[3].owner, 1)
  assert.equal(g.players[1].money, START_MONEY - 6_000)

  const h = createGame(['Ana', 'Beto'])
  h.players[0].money = 1_000
  roll(h, rigged(2, 2)) // Multa y Cierre: 20.000
  assert.equal(h.phase, 'debt')
  declareBankruptcy(h)
  assert.equal(h.phase, 'gameOver')
  assert.equal(h.winner, 1)
})

// ---------- Simulación con bots aleatorios ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function simulate(seed: number): GameState {
  const rng = mulberry32(seed)
  const g = createGame(['A', 'B', 'C', 'D'])
  for (let i = 0; i < 20_000 && g.phase !== 'gameOver'; i++) {
    const p = g.players[g.current]
    switch (g.phase) {
      case 'roll': roll(g, rng); break
      case 'buy': {
        const price = (g.board[p.position] as { price: number }).price
        p.money >= price && rng() < 0.85 ? buy(g) : declineBuy(g)
        break
      }
      case 'auction': resolveAuction(g, null); break
      case 'card': resolveCard(g); break
      case 'cardChoice': chooseRisk(g, false); break
      case 'debt': declareBankruptcy(g); break
      case 'endTurn': endTurn(g); break
    }
    for (const q of g.players) {
      assert.ok(q.money >= 0, `dinero negativo (${q.name})`)
      assert.ok(q.position >= 0 && q.position < 40, 'posición fuera de rango')
    }
  }
  return g
}

test('Simulación: 30 partidas con bots sin errores ni estados inválidos', () => {
  let finished = 0
  for (let seed = 1; seed <= 30; seed++) if (simulate(seed).phase === 'gameOver') finished++
  console.log(`      ${finished}/30 partidas terminaron con un ganador`)
})

console.log(`\n${passed} pruebas correctas`)
