import type { BoardData, CardData, CardJson } from './data'
import { buildBoard } from './data'
import type { StadiumSquare } from './types'

/**
 * Revisa una edición completa de los datos (estadios, servicios, departamentos, orden del tablero y cartas) y
 * devuelve lo que está bien y lo que parece un error. Sirve para el validador (`npm run validate-data`) y para las
 * pruebas: así se puede editar o cambiar de edición los JSON con red.
 */
export interface ValidationResult {
  ok: string[]
  problems: string[]
}

const METHODS = new Set(['receive', 'pay', 'move', 'collectForEachPlayer', 'chooseRisk', 'handleAppeal', 'buildRepairs'])
/** Sin acentos, en minúsculas y solo letras y números: "Cam Nou" -> "camnou". */
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function validateEdition(data: BoardData, cards: CardData): ValidationResult {
  const ok: string[] = []
  const problems: string[] = []
  const check = (cond: boolean, good: string, bad: string) => (cond ? ok.push(good) : problems.push(bad))

  // ----- Tablero -----
  const props = [...data.estadios, ...data.concesiones, ...data.servicios]
  const expected = new Set([...props.map((p) => `P${p.id}`), ...data.departamentos.map((_, i) => `D${i}`)])
  check(
    data.layout.length === 40 && new Set(data.layout).size === 40 && data.layout.every((t) => expected.has(t)),
    'Tablero: 40 casillas, sin repetidas ni inexistentes',
    'Tablero (board-layout.json): no son 40 casillas distintas o hay referencias a casillas que no existen',
  )
  const ids = props.map((p) => p.id)
  check(new Set(ids).size === ids.length, 'ids de concesiones únicos', 'Hay ids de concesión repetidos')
  const badMortgage = props.filter((p) => p.mortgage * 2 !== p.price)
  check(!badMortgage.length, 'Hipoteca = mitad del precio', `Hipoteca distinta de precio/2 en ids: ${badMortgage.map((p) => p.id).join(', ')}`)

  // ----- Estadios -----
  const byTeam = new Map<string, typeof data.estadios>()
  for (const e of data.estadios) byTeam.set(e.team, [...(byTeam.get(e.team) ?? []), e])
  for (const [team, list] of byTeam) {
    const g = list.find((e) => e.type === 0)
    const t = list.find((e) => e.type === 1)
    if (list.length !== 2 || !g || !t) {
      problems.push(`${team}: debe tener exactamente una concesión General (type 0) y una Tribuna (type 1)`)
      continue
    }
    for (const e of [g, t]) {
      const r = e.rents.map((x) => x.rent)
      if (r.length !== 6) problems.push(`${team} (id ${e.id}): debe tener 6 alquileres (sin asientos, 1-4 sillas, tribuna)`)
      if (r.some((v, i) => i > 0 && v <= r[i - 1])) problems.push(`${team} (id ${e.id}): alquileres no crecientes`)
      if (!e.short?.trim()) problems.push(`${team} (id ${e.id}): falta "short" (nombre corto de la casilla)`)
      if (!e.colors?.top?.trim()) problems.push(`${team} (id ${e.id}): faltan los colores (colors.top)`)
      if (!(e.colors?.style >= 1)) problems.push(`${team} (id ${e.id}): colors.style debe ser un número desde 1`)
    }
    g.rents.forEach((r, i) => {
      if (t.rents[i] && t.rents[i].rent <= r.rent)
        problems.push(`${team}: id ${t.id} "${t.rents[i].title}" (${t.rents[i].rent}) no supera a id ${g.id} (${r.rent})`)
    })
    if (g.build !== t.build) problems.push(`${team}: el coste de mejora difiere entre General y Tribuna`)
    if (g.short !== t.short) problems.push(`${team}: "short" distinto entre General y Tribuna`)
    if (g.colors?.top !== t.colors?.top || g.colors?.bottom !== t.colors?.bottom) problems.push(`${team}: los colores difieren entre General y Tribuna`)
  }
  check(![...byTeam.values()].some((l) => l.length !== 2), `${byTeam.size} equipos con General y Tribuna`, 'Hay equipos sin pareja General/Tribuna')

  // ----- Cartas -----
  for (const [name, list] of [['Federación', cards.federacion], ['Sorpresa', cards.sorpresa]] as const) {
    check(list.length === 16, `${name}: 16 cartas`, `${name}: ${list.length} cartas (deberían ser 16)`)
    list.forEach((c, i) => {
      if (!METHODS.has(c.action.method)) problems.push(`${name} #${i + 1}: acción desconocida "${c.action.method}"`)
      if (c.action.method === 'receive' && /\b(pague|abone)\b/i.test(c.text)) problems.push(`${name} #${i + 1}: dice "pague" pero la acción es receive`)
      if (c.action.method === 'pay' && /\b(cobre|reciba|ingresa)\b/i.test(c.text)) problems.push(`${name} #${i + 1}: dice "cobre" pero la acción es pay`)
    })
  }

  // Cartas de movimiento: la casilla de destino debe ser la que nombra el texto (posiciones 1..40; 0 = Salida)
  const board = buildBoard(data)
  const moves: [string, CardJson][] = [
    ...cards.federacion.map((c) => ['Federación', c] as [string, CardJson]),
    ...cards.sorpresa.map((c) => ['Sorpresa', c] as [string, CardJson]),
  ]
  for (const [deck, c] of moves) {
    if (c.action.method !== 'move') continue
    const arg = c.action.args[0] as number
    if (!(arg > 0)) continue
    const target = board[arg - 1]
    if (!target || !('id' in target)) continue // Salida, Banquillo...
    const text = norm(c.text)
    const label = `${deck}: "${c.text.slice(0, 48)}..." -> posición ${arg} (${target.name})`
    const quoted = c.text.match(/'([^']+)'/)?.[1]
    if (quoted) {
      const q = norm(quoted)
      if (q !== norm(target.name) && q !== norm((target as StadiumSquare).team ?? '')) problems.push(`${label}: el texto dice '${quoted}' y la casilla es "${target.name}"`)
    } else {
      const stadium = target as StadiumSquare
      const tokens = [target.name, stadium.team ?? '', stadium.short ?? ''].flatMap((s) => s.split(/\s+/)).map(norm).filter((s) => s.length >= 4)
      if (!tokens.some((tk) => text.includes(tk))) problems.push(`${label}: el texto no menciona esa casilla`)
    }
    if (target.kind === 'stadium' && /tribuna/.test(text) && target.part !== 'tribuna') problems.push(`${label}: el texto dice tribuna y es la casilla General`)
    if (target.kind === 'stadium' && /vaya a/.test(text) && !/tribuna|general/.test(text) && target.part === 'tribuna') problems.push(`${label}: no dice General ni Tribuna`)
  }
  if (!problems.some((p) => p.includes('posición'))) ok.push('Cartas de movimiento: cada destino coincide con la casilla que nombra su texto')

  return { ok, problems }
}
