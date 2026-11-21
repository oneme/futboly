import assert from 'node:assert/strict'
import { aiStep } from '../src/engine/ai'
import { createGame, endTurn, roll, type GameState } from '../src/engine/game'
import { MAX_COUNTER_ROUNDS, answerProposal, canCounter, counterProposal, evaluateOffer, negotiate, proposeTrade } from '../src/engine/trading'
import type { TradeOffer } from '../src/engine/types'

let passed = 0
const test = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log('OK  ', name)
}
const posOf = (g: GameState, id: number) => g.board.findIndex((x) => 'id' in x && x.id === id)
const offer = (o: Partial<TradeOffer>): TradeOffer => ({
  from: 0, to: 1, fromPositions: [], toPositions: [], fromCash: 0, toCash: 0, ...o,
})
const mirror = (o: TradeOffer): TradeOffer => ({ from: o.to, to: o.from, fromPositions: o.toPositions, toPositions: o.fromPositions, fromCash: o.toCash, toCash: o.fromCash })
/** Humano (0) y robot (1). */
const duel = () => createGame([{ name: 'Humano' }, { name: 'Robot', ai: true }])

test('La IA acepta una oferta generosa y rechaza una tacaña', () => {
  const g = duel()
  const gorras = posOf(g, 11) // 20.000
  g.properties[gorras].owner = 1
  // Humano compra Gorras: 5.000 es poco, 40.000 es mucho
  assert.equal(evaluateOffer(g, 1, offer({ toPositions: [], fromPositions: [], fromCash: 0 })), false) // oferta vacía
  assert.equal(proposeTrade(g, offer({ fromCash: 5_000, toPositions: [gorras] })), false)
  assert.equal(g.properties[gorras].owner, 1)
  assert.equal(proposeTrade(g, offer({ fromCash: 40_000, toPositions: [gorras] })), true)
  assert.equal(g.properties[gorras].owner, 0)
  assert.equal(g.players[0].money, 110_000)
  assert.equal(g.players[1].money, 190_000)
})

test('La IA no regala una concesión que le completaría el grupo al rival por un precio normal', () => {
  const g = duel()
  const a = posOf(g, 1)
  const b = posOf(g, 2) // Betis General y Tribuna
  g.properties[a].owner = 0
  g.properties[b].owner = 1
  // Precio de mercado (8.000): no vende; con una cifra muy alta sí
  assert.equal(proposeTrade(g, offer({ fromCash: 8_000, toPositions: [b] })), false)
  assert.equal(proposeTrade(g, offer({ fromCash: 60_000, toPositions: [b] })), true)
  assert.equal(g.properties[b].owner, 0)
})

test('La IA acepta un intercambio de concesiones que le conviene', () => {
  const g = duel()
  const a = posOf(g, 1)
  const b = posOf(g, 2)
  const c = posOf(g, 4) // Molinón General (otro grupo, sin relación)
  g.properties[a].owner = 1 // la IA tiene Betis General...
  g.properties[b].owner = 0 // ...y el humano la Tribuna, y además tiene el Molinón
  g.properties[c].owner = 1
  // El humano ofrece la Tribuna del Betis (completa el grupo de la IA) a cambio del Molinón General
  assert.equal(proposeTrade(g, offer({ fromPositions: [b], toPositions: [c] })), true)
  assert.equal(g.properties[b].owner, 1)
  assert.equal(g.properties[c].owner, 0)
})

test('Los tratos con una IA exigen una IA al otro lado', () => {
  const g = createGame(['Ana', 'Beto'])
  assert.throws(() => proposeTrade(g, offer({ fromCash: 1_000 })), /humanos/)
})

test('La IA propone comprar la concesión que le completa un grupo y espera la respuesta', () => {
  const g = duel()
  g.current = 1 // turno del robot
  const a = posOf(g, 1)
  const b = posOf(g, 2)
  g.properties[a].owner = 1
  g.properties[b].owner = 0
  assert.equal(aiStep(g), true)
  assert.ok(g.proposal, 'debería haber una propuesta pendiente')
  assert.equal(g.proposal!.from, 1)
  assert.deepEqual(g.proposal!.toPositions, [b])
  assert.ok(g.proposal!.fromCash >= 8_000)
  assert.equal(aiStep(g), false) // la IA espera al humano

  const cash = g.proposal!.fromCash
  answerProposal(g, true)
  assert.equal(g.proposal, null)
  assert.equal(g.properties[b].owner, 1)
  assert.equal(g.players[0].money, 150_000 + cash)
  assert.equal(g.players[1].money, 150_000 - cash)
})

test('Si el humano rechaza, la IA no insiste en los siguientes turnos', () => {
  const g = duel()
  g.current = 1
  const a = posOf(g, 1)
  const b = posOf(g, 2)
  g.properties[a].owner = 1
  g.properties[b].owner = 0
  aiStep(g)
  answerProposal(g, false)
  assert.equal(g.properties[b].owner, 0)
  for (let i = 0; i < 6; i++) {
    g.phase = 'roll'
    g.current = 1
    aiStep(g) // cualquier acción menos proponer lo mismo
    assert.equal(g.proposal, null)
    g.phase = 'endTurn'
    endTurn(g)
  }
  assert.equal(g.proposal, null)
})

test('Una propuesta que ya no es válida no se ejecuta', () => {
  const g = duel()
  g.current = 1
  const a = posOf(g, 1)
  const b = posOf(g, 2)
  g.properties[a].owner = 1
  g.properties[b].owner = 0
  aiStep(g)
  g.properties[b].mortgaged = true // cambia la situación antes de responder
  answerProposal(g, true)
  assert.equal(g.properties[b].owner, 0)
  assert.ok(g.log.at(-1)!.includes('ya no es posible'))
})

test('IA con IA: negocian y cierran tratos sin intervención', () => {
  const g = createGame([{ name: 'R1', ai: true }, { name: 'R2', ai: true }])
  const a = posOf(g, 1)
  const b = posOf(g, 2)
  g.properties[a].owner = 0
  g.properties[b].owner = 1
  g.current = 0
  const before = g.log.length
  const done = aiStep(g)
  assert.ok(done)
  // El trato puede cerrarse o no según lo que valore R2, pero nunca queda una propuesta pendiente
  assert.equal(g.proposal, null)
  const closed = g.log.slice(before).some((l) => l.startsWith('Trato cerrado'))
  if (closed) assert.equal(g.properties[b].owner, 0)
  else assert.equal(g.properties[b].owner, 1)
})

test('Partidas de IAs: hacen tratos entre ellas y siguen terminando', () => {
  let deals = 0
  let finished = 0
  const total = 30
  for (let seed = 1; seed <= total; seed++) {
    let x = seed * 7919
    const rng = () => {
      x |= 0
      x = (x + 0x6d2b79f5) | 0
      let t = Math.imul(x ^ (x >>> 15), 1 | x)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const n = 2 + (seed % 5)
    const g = createGame(Array.from({ length: n }, (_, i) => ({ name: `IA ${i + 1}`, ai: true })), undefined, rng)
    for (let i = 0; i < 40_000 && g.phase !== 'gameOver'; i++) {
      assert.ok(aiStep(g, rng), `la IA se quedó sin acción en la fase ${g.phase}`)
      for (const q of g.players) assert.ok(q.money >= 0, 'dinero negativo')
    }
    deals += g.log.filter((l) => l.startsWith('Trato cerrado')).length
    if (g.phase === 'gameOver') finished++
  }
  console.log(`      ${deals} tratos cerrados en ${total} partidas; ${finished}/${total} terminaron`)
  assert.ok(deals > 0, 'las IAs deberían cerrar algún trato')
  assert.ok(finished / total > 0.6)
})

// ---------- Contraofertas ----------

test('Contraoferta de la IA: pide más dinero, el humano acepta y el trato se cierra con ese importe', () => {
  const g = duel()
  const gorras = posOf(g, 11) // 20.000
  g.properties[gorras].owner = 1
  assert.equal(negotiate(g, offer({ fromCash: 5_000, toPositions: [gorras] })), 'countered')
  const p = g.proposal!
  assert.equal(p.from, 1) // ahora propone la IA
  assert.equal(p.to, 0)
  assert.deepEqual(p.fromPositions, [gorras])
  assert.equal(p.toCash > 5_000, true)
  assert.equal(p.round, 1)
  assert.equal(g.properties[gorras].owner, 1) // aún no se ha cerrado nada
  // lo que pide la IA es lo mínimo que le sale a cuenta: aceptable para ella y no tacaño
  assert.equal(evaluateOffer(g, 1, { ...mirror(p) }), true)
  assert.equal(evaluateOffer(g, 1, { ...mirror(p), fromCash: mirror(p).fromCash - 500 }), false)
  const pay = p.toCash
  answerProposal(g, true)
  assert.equal(g.properties[gorras].owner, 0)
  assert.equal(g.players[0].money, 150_000 - pay)
  assert.equal(g.players[1].money, 150_000 + pay)
})

test('Sin contraoferta posible (el humano no tiene dinero) la IA simplemente rechaza', () => {
  const g = duel()
  const gorras = posOf(g, 11)
  g.properties[gorras].owner = 1
  g.players[0].money = 5_000
  assert.equal(negotiate(g, offer({ fromCash: 3_000, toPositions: [gorras] })), 'rejected')
  assert.equal(g.proposal, null)
})

test('El humano contraofertea a la propuesta de una IA y la IA acepta si le conviene', () => {
  const g = duel()
  const a = posOf(g, 1)
  const b = posOf(g, 2)
  g.properties[a].owner = 1
  g.properties[b].owner = 0
  // la IA propone comprar b con 20.000 (propuesta suya)
  g.proposal = offer({ from: 1, to: 0, toPositions: [b], fromCash: 20_000 })
  assert.equal(canCounter(g), true)
  // contraoferta absurda: pide la concesión de la IA gratis -> la IA no acepta
  assert.throws(() => counterProposal(g, offer({ from: 1, to: 0 })), /contraoferta debe ir/)
  assert.equal(g.proposal !== null, true) // el error no consume la propuesta
  const res = counterProposal(g, offer({ from: 0, to: 1, fromPositions: [b], toCash: 90_000 }))
  assert.notEqual(res, 'accepted') // 90.000 por una concesión que le completa grupo: no
  // la IA o rechaza o devuelve una contraoferta de ronda 2
  if (res === 'countered') assert.equal(g.proposal!.round, 2)
  else assert.equal(g.proposal, null)
})

test('Una contraoferta razonable del humano se acepta al momento', () => {
  const g = duel()
  const gorras = posOf(g, 11)
  g.properties[gorras].owner = 0
  // la IA propone comprar Gorras (20.000) por 10.000; el humano pide 16.000 (dentro de su límite) y la IA acepta
  g.proposal = offer({ from: 1, to: 0, toPositions: [gorras], fromCash: 10_000 })
  const res = counterProposal(g, offer({ from: 0, to: 1, fromPositions: [gorras], toCash: 16_000 }))
  assert.equal(res, 'accepted')
  assert.equal(g.players[0].money, 150_000 + 16_000)
  assert.equal(g.properties[gorras].owner, 1)
  assert.equal(g.proposal, null)
  assert.ok(g.log.some((l) => l.includes('contraofrece')))
})

test('Si el humano pide demasiado, la IA le devuelve una contraoferta más baja', () => {
  const g = duel()
  const gorras = posOf(g, 11)
  g.properties[gorras].owner = 0
  g.proposal = offer({ from: 1, to: 0, toPositions: [gorras], fromCash: 10_000 })
  const res = counterProposal(g, offer({ from: 0, to: 1, fromPositions: [gorras], toCash: 60_000 }))
  assert.equal(res, 'countered')
  const p = g.proposal!
  assert.equal(p.from, 1)
  assert.equal(p.fromCash < 60_000 && p.fromCash > 0, true) // la IA ofrece menos de lo pedido, pero algo
  assert.equal(p.round, 2)
  assert.equal(g.properties[gorras].owner, 0)
})

test('Las contraofertas tienen un límite: la última oferta solo se acepta o se rechaza', () => {
  const g = duel()
  const gorras = posOf(g, 11)
  g.properties[gorras].owner = 1
  g.proposal = offer({ from: 1, to: 0, fromPositions: [gorras], toCash: 21_000, round: MAX_COUNTER_ROUNDS })
  assert.equal(canCounter(g), false)
  assert.throws(() => counterProposal(g, offer({ from: 0, to: 1 })), /Ya no se admiten/)
  // y una oferta inicial con rondas agotadas no vuelve a generar contraoferta
  const h = duel()
  const g2 = posOf(h, 11)
  h.properties[g2].owner = 1
  assert.equal(negotiate(h, offer({ fromCash: 2_000, toPositions: [g2], round: MAX_COUNTER_ROUNDS })), 'rejected')
})

test('negotiate valida: IA al otro lado y sin propuesta pendiente', () => {
  const g = createGame([{ name: 'A' }, { name: 'B' }])
  assert.throws(() => negotiate(g, offer({ fromCash: 1_000 })), /humanos/)
  const h = duel()
  h.proposal = offer({ from: 1, to: 0, fromCash: 1_000 })
  assert.throws(() => negotiate(h, offer({ fromCash: 1_000 })), /pendiente/)
})

console.log(`\n${passed} pruebas correctas`)
