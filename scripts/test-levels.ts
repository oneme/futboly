import assert from 'node:assert/strict'
import { aiStep } from '../src/engine/ai'
import { AI_PROFILES, type AILevel } from '../src/engine/aiProfiles'
import {
  buy, createGame, declareBankruptcy, endTurn, roll, type GameState,
} from '../src/engine/game'
import { buildSeat } from '../src/engine/management'
import { buildSummary, netWorth } from '../src/engine/summary'

const rigged = (...faces: number[]) => {
  const q = [...faces]
  return () => (q.shift()! - 1) / 6 + 0.01
}
function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let passed = 0
const test = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log('OK  ', name)
}
const posOf = (g: GameState, id: number) => g.board.findIndex((x) => 'id' in x && x.id === id)

// ---------- Niveles ----------
test('El nivel por defecto es normal y se conserva por jugador', () => {
  const g = createGame([
    'Ana',
    { name: 'R1', ai: true },
    { name: 'R2', ai: true, level: 'easy' },
    { name: 'R3', ai: true, level: 'hard' },
  ])
  assert.deepEqual(g.players.map((p) => p.level), ['normal', 'normal', 'easy', 'hard'])
})

/** Gana el último en pie; si la partida no termina, el de mayor patrimonio. */
function winner(levels: AILevel[], seed: number): number {
  const rng = mulberry(seed)
  const g = createGame(levels.map((level, i) => ({ name: `${level}${i}`, ai: true, level })), undefined, rng)
  for (let i = 0; i < 40_000 && g.phase !== 'gameOver'; i++) assert.ok(aiStep(g, rng), 'la IA se quedó sin acción')
  if (g.winner !== null) return g.winner
  return g.players.filter((p) => !p.bankrupt).sort((a, b) => netWorth(g, b.id) - netWorth(g, a.id))[0].id
}
/** % de partidas ganadas por `a` contra `b`, alternando asiento. */
function duel(a: AILevel, b: AILevel, n: number): number {
  let wins = 0
  for (let k = 0; k < n; k++) {
    const swap = k % 2 === 1
    const w = winner(swap ? [b, a] : [a, b], 9000 + k)
    if ((w === 0) === !swap) wins++
  }
  return (100 * wins) / n
}

test('Los niveles se notan: normal gana a fácil y difícil gana a normal y a fácil', () => {
  const N = 120
  const normalVsEasy = duel('normal', 'easy', N)
  const hardVsNormal = duel('hard', 'normal', N)
  const hardVsEasy = duel('hard', 'easy', N)
  console.log(`      normal-fácil ${normalVsEasy.toFixed(0)}% · difícil-normal ${hardVsNormal.toFixed(0)}% · difícil-fácil ${hardVsEasy.toFixed(0)}%`)
  assert.ok(normalVsEasy >= 68, `normal vs fácil: ${normalVsEasy}`)
  assert.ok(hardVsNormal >= 54, `difícil vs normal: ${hardVsNormal}`)
  assert.ok(hardVsEasy >= 68, `difícil vs fácil: ${hardVsEasy}`)
})

test('Partidas mezcladas de 4 niveles terminan sin bloqueos', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = mulberry(seed)
    const levels: AILevel[] = ['easy', 'normal', 'hard', 'normal']
    const g = createGame(levels.map((level, i) => ({ name: `IA${i}`, ai: true, level })), undefined, rng)
    for (let i = 0; i < 40_000 && g.phase !== 'gameOver'; i++) assert.ok(aiStep(g, rng))
    assert.equal(g.phase, 'gameOver')
  }
})

test('Todos los perfiles tienen valores coherentes', () => {
  for (const level of Object.keys(AI_PROFILES) as AILevel[]) {
    const p = AI_PROFILES[level]
    assert.ok(p.reserve >= 0 && p.buildReserve >= 0 && p.proposeChance >= 0 && p.proposeChance <= 1, level)
    assert.ok(p.skipBuyChance >= 0 && p.skipBuyChance < 1 && p.skipBuildChance >= 0 && p.skipBuildChance < 1, level)
  }
  assert.ok(AI_PROFILES.easy.reserve > AI_PROFILES.normal.reserve && AI_PROFILES.normal.reserve >= AI_PROFILES.hard.reserve)
  assert.ok(AI_PROFILES.hard.dangerAware && !AI_PROFILES.easy.dangerAware)
})

// ---------- Resumen de la partida ----------
test('Patrimonio según el manual: dinero + concesiones (hipotecadas a la mitad) + mejoras', () => {
  const g = createGame(['Ana', 'Beto'])
  const a = posOf(g, 1) // Betis General: precio 6.000, mejora 5.000
  const b = posOf(g, 2) // Betis Tribuna: precio 8.000
  g.properties[a].owner = 0
  g.properties[b].owner = 0
  assert.equal(netWorth(g, 0), 150_000 + 6_000 + 8_000)
  buildSeat(g, 0, a)
  buildSeat(g, 0, a === b ? a : b)
  // 2 asientos comprados: el dinero baja 10.000 pero valen 10.000 (a precio de compra)
  assert.equal(netWorth(g, 0), 150_000 + 14_000)
  g.properties[a].seats = 0
  g.properties[b].seats = 0
  g.properties[b].mortgaged = true
  assert.equal(netWorth(g, 0), 140_000 + 6_000 + 4_000) // Tribuna hipotecada: mitad de su precio
  g.properties[a].stand = true
  assert.equal(netWorth(g, 0), 140_000 + 6_000 + 4_000 + 5 * 5_000) // tribuna = 5 asientos
  g.players[1].bankrupt = true
  assert.equal(netWorth(g, 1), 0)
})

test('Estadísticas: compras, alquileres, Banquillo y tratos', () => {
  const g = createGame(['Ana', 'Beto'])
  roll(g, rigged(1, 2)) // Ana cae en Betis Tribuna (8.000)
  buy(g)
  endTurn(g)
  roll(g, rigged(1, 2)) // Beto paga 500 de alquiler
  assert.equal(g.stats[0].bought, 1)
  assert.equal(g.stats[0].spentOnProperties, 8_000)
  assert.equal(g.stats[0].rentReceived, 500)
  assert.equal(g.stats[1].rentPaid, 500)
})

test('Clasificación: el ganador primero y los eliminados del que más aguantó al que menos', () => {
  const g = createGame(['Ana', 'Beto', 'Carla', 'Dani'])
  const kill = (id: number, turn: number) => {
    g.turnCount = turn
    g.current = id
    g.debt = { debtor: id, amount: 1, creditor: 'bank', resume: 'afterLanding' }
    g.players[id].money = 0
    g.phase = 'debt'
    declareBankruptcy(g)
  }
  kill(2, 5) // Carla cae la primera
  kill(1, 9) // Beto aguanta más
  kill(3, 7)
  assert.equal(g.phase, 'gameOver')
  g.turnCount = 9
  const sum = buildSummary(g)
  assert.deepEqual(sum.players.map((p) => p.name), ['Ana', 'Beto', 'Dani', 'Carla'])
  assert.deepEqual(sum.players.map((p) => p.rank), [1, 2, 3, 4])
  assert.equal(sum.winnerId, 0)
  assert.equal(sum.turns, 9)
  assert.ok(sum.players[0].netWorth > 0 && sum.players[1].netWorth === 0)
})

test('Datos curiosos: solo aparecen si alguien tiene algo que contar', () => {
  const g = createGame(['Ana', 'Beto'])
  assert.deepEqual(buildSummary(g).highlights, [])
  g.stats[1].rentReceived = 12_000
  g.stats[0].bought = 3
  const h = buildSummary(g).highlights
  assert.deepEqual(h.map((x) => [x.label, x.playerId, x.value]), [
    ['Más alquileres cobrados', 1, 12_000],
    ['Más concesiones compradas', 0, 3],
  ])
})

test('Partidas guardadas antiguas sin estadísticas ni nivel no rompen el resumen', () => {
  const g = createGame(['Ana', 'Beto']) as GameState & { stats?: unknown }
  delete g.stats
  for (const p of g.players) delete (p as { level?: unknown }).level
  const sum = buildSummary(g)
  assert.equal(sum.players.length, 2)
  assert.equal(sum.players[0].level, 'normal')
})

console.log(`\n${passed} pruebas correctas`)
