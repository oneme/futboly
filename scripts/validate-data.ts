import { buildBoard, loadCards } from '../src/engine/data'
import estadios from '../src/json/estadios.json'
import concesiones from '../src/json/concesiones.json'
import servicios from '../src/json/servicios.json'
import federacion from '../src/json/federacion.json'
import sorpresa from '../src/json/sorpresa.json'
import layout from '../src/json/board-layout.json'

let problems = 0
const ok = (m: string) => console.log('OK   ', m)
const warn = (m: string) => {
  problems++
  console.log('AVISO', m)
}

// 1. Layout: 40 casillas, sin repetidos, todas las propiedades y departamentos
const props = [...estadios, ...concesiones, ...servicios]
const expected = new Set([
  ...props.map((p) => `P${p.id}`),
  ...Array.from({ length: 12 }, (_, i) => `D${i}`),
])
if (layout.length === 40 && new Set(layout).size === 40 && layout.every((t) => expected.has(t)))
  ok('Layout: 40 casillas (28 propiedades + 12 departamentos), sin repetidas')
else warn('Layout: faltan, sobran o se repiten casillas')

// 2. Hipoteca = mitad del precio
const badMortgage = props.filter((p) => p.mortgage * 2 !== p.price)
badMortgage.length
  ? warn(`Hipoteca != precio/2 en ids: ${badMortgage.map((p) => p.id).join(', ')}`)
  : ok('Hipoteca = mitad del precio en las 28 propiedades')

// 3. Estadios: alquileres crecientes y tribuna > general en cada nivel
const teams = [...new Set(estadios.map((e) => e.team))]
for (const team of teams) {
  const g = estadios.find((e) => e.team === team && e.type === 0)!
  const t = estadios.find((e) => e.team === team && e.type === 1)!
  for (const e of [g, t]) {
    const r = e.rents.map((x) => x.rent)
    if (r.some((v, i) => i > 0 && v <= r[i - 1]))
      warn(`${team} (id ${e.id}): alquileres no crecientes`)
  }
  g.rents.forEach((r, i) => {
    if (t.rents[i].rent <= r.rent)
      warn(
        `${team}: id ${t.id} "${t.rents[i].title}" = ${t.rents[i].rent} <= id ${g.id} = ${r.rent}`,
      )
  })
  const diff = t.rents[5].rent - g.rents[5].rent
  if (diff !== 12000)
    warn(`${team}: diferencia tribuna-general con tribuna = ${diff} (en el resto es 12.000)`)
  if (g.build !== t.build) warn(`${team}: coste de mejora distinto entre general y tribuna`)
}
ok(`Revisados ${teams.length} estadios`)

// 4. Cartas: 16 + 16 y coherencia texto / acción
federacion.length === 16 && sorpresa.length === 16
  ? ok('16 cartas de Federación y 16 de Sorpresa')
  : warn(`Cartas: ${federacion.length} Federación, ${sorpresa.length} Sorpresa`)
;[...federacion.map((c) => ['Federación', c] as const), ...sorpresa.map((c) => ['Sorpresa', c] as const)].forEach(
  ([deck, c], i) => {
    if (c.action.method === 'receive' && /pague|abone/i.test(c.text))
      warn(`${deck} #${i + 1} dice "pague" pero la acción es receive: "${c.text.slice(0, 50)}..."`)
  },
)

// 5. Cartas de movimiento: ¿la casilla de destino coincide con lo que dice el texto?
//    (los JSON de cartas usan posiciones 1..40; 0 = Salida)
const board = buildBoard()
const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
;[...federacion.map((c) => ['Federación', c] as const), ...sorpresa.map((c) => ['Sorpresa', c] as const)].forEach(
  ([deck, c]) => {
    if (c.action.method !== 'move') return
    const arg = c.action.args[0] as number
    if (arg <= 0) return
    const target = board[arg - 1]
    const where = 'id' in target ? `${target.name}${'part' in target ? ` (${target.part})` : ''}` : target.name
    const text = strip(c.text)
    if (target.kind === 'stadium' && /tribuna/.test(text) && target.part !== 'tribuna')
      warn(`${deck}: "${c.text.slice(0, 45)}..." va a la posición ${arg}, que es ${where}; el texto dice tribuna`)
    else if (target.kind === 'stadium' && !/tribuna/.test(text) && target.part === 'tribuna' && /vaya a/.test(text))
      warn(`${deck}: "${c.text.slice(0, 45)}..." va a la posición ${arg}, que es ${where}`)
    else ok(`${deck}: mover a ${arg} -> ${where}`)
  },
)
board[12].kind === 'jail'
  ? ok('Banquillo en la posición 13 (la usan las cartas)')
  : warn('El Banquillo no está en la posición 13 que indican las cartas')

const cards = loadCards(board)
console.log(`\nTablero: ${board.length} casillas · Cartas: ${cards.federation.length + cards.surprise.length}`)
console.log(problems ? `${problems} aviso(s)` : 'Todo correcto')
