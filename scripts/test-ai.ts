import assert from 'node:assert/strict'
import {
  auctionBid, auctionPass, buy, createGame, declineBuy, endTurn, roll, type GameState,
} from '../src/engine/game'
import { actor, aiStep } from '../src/engine/ai'

const rigged = (...faces: number[]) => {
  const q = [...faces]
  return () => (q.shift()! - 1) / 6 + 0.01
}
let passed = 0
const test = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log('OK  ', name)
}
const names = ['Ana', 'Beto', 'Carla']
/** Ana cae en Betis Tribuna (posición 3) y rechaza comprar: empieza la subasta. */
function startAuction() {
  const g = createGame(names)
  roll(g, rigged(1, 2))
  declineBuy(g)
  return g
}

test('Subasta por pujas: turnos, retiradas y adjudicación', () => {
  const g = startAuction()
  assert.equal(g.phase, 'auction')
  assert.equal(g.auction!.turn, 1) // empieza quien está a la izquierda de Ana
  auctionBid(g, 1_000) // Beto
  assert.equal(g.auction!.turn, 2)
  auctionBid(g, 2_000) // Carla
  assert.equal(g.auction!.turn, 0) // Ana
  auctionPass(g)
  assert.equal(g.auction!.turn, 1) // Beto (Ana ya no entra)
  auctionPass(g) // solo queda Carla, que iba ganando
  assert.equal(g.auction, null)
  assert.equal(g.properties[3].owner, 2)
  assert.equal(g.players[2].money, 148_000)
  assert.equal(g.phase, 'endTurn')
})

test('Subasta: pujas no válidas, retirada de quien no puede subir y subasta desierta', () => {
  const g = startAuction()
  auctionBid(g, 1_000)
  assert.throws(() => auctionBid(g, 1_000), /superar/)
  assert.throws(() => auctionBid(g, 999_999), /dinero/)
  g.players[0].money = 500 // Ana no puede subir de 1.000: se retira sola
  auctionBid(g, 1_500) // Carla
  assert.ok(g.auction!.passed.includes(0))

  const h = startAuction()
  auctionPass(h)
  auctionPass(h)
  auctionPass(h)
  assert.equal(h.auction, null)
  assert.equal(h.properties[3].owner, null)
  assert.equal(h.phase, 'endTurn')
})

test('Eventos para sonidos', () => {
  const g = createGame(names)
  roll(g, rigged(1, 2))
  assert.equal(g.events.at(-1), 'dice')
  const before = g.eventCount
  buy(g)
  assert.equal(g.eventCount, before + 1)
  assert.equal(g.events.at(-1), 'buy')
})

test('IA: no actúa si le toca a un humano; en subasta actúa quien tiene el turno', () => {
  const g = createGame([{ name: 'Humano' }, { name: 'Robot', ai: true }])
  assert.equal(aiStep(g), false)
  roll(g, rigged(1, 2))
  declineBuy(g) // la subasta empieza por el Robot
  assert.equal(actor(g), 1)
  assert.equal(aiStep(g), true)
})

function aiGame(seed: number, players = 4): GameState {
  let x = seed
  const rng = () => {
    x |= 0
    x = (x + 0x6d2b79f5) | 0
    let t = Math.imul(x ^ (x >>> 15), 1 | x)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const g = createGame(Array.from({ length: players }, (_, i) => ({ name: `IA ${i + 1}`, ai: true })), undefined, rng)
  for (let i = 0; i < 40_000 && g.phase !== 'gameOver'; i++) {
    assert.ok(aiStep(g, rng), `la IA se quedó sin acción en la fase ${g.phase}`)
    for (const q of g.players) assert.ok(q.money >= 0, 'dinero negativo')
  }
  return g
}

test('Partidas solo de IAs (2, 4 y 6 jugadores): terminan, sin bloqueos ni errores', () => {
  let finished = 0
  let total = 0
  for (const n of [2, 4, 6]) {
    for (let seed = 1; seed <= 15; seed++) {
      total++
      if (aiGame(seed * n, n).phase === 'gameOver') finished++
    }
  }
  console.log(`      ${finished}/${total} partidas terminaron con un ganador`)
  assert.ok(finished / total > 0.6)
})

console.log(`\n${passed} pruebas correctas`)
