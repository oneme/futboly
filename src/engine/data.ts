import estadiosRaw from '../json/estadios.json'
import concesionesRaw from '../json/concesiones.json'
import serviciosRaw from '../json/servicios.json'
import departamentosRaw from '../json/departamentos.json'
import federacionRaw from '../json/federacion.json'
import sorpresaRaw from '../json/sorpresa.json'
import layout from '../json/board-layout.json'
import type {
  Card,
  CardAction,
  DepartmentKind,
  Square,
  StadiumRents,
} from './types'

/** Un alquiler tal como viene en los JSON. */
export interface RentJson { title: string; rent: number }
export interface StadiumJson {
  id: number
  name: string
  team: string
  short?: string
  rents: RentJson[]
  mortgage: number
  build: number
  price: number
  type: number
  path?: string // opcional: sin imagen, la casilla se construye desde el JSON
  colors: { top: string; bottom: string; style: number }
}
export interface ServiceJson {
  id: number; name: string; rents: RentJson[]; mortgage: number; price: number; type: number
  path?: string; card?: string // opcionales: sin imagen, la casilla se dibuja con `icon` y `color`
  icon?: string; color?: string
}
export interface DepartmentJson { name: string; quantity: number; type: number; path?: string; icon?: string }
export interface CardJson { text: string; action: { method: string; args: unknown[] } }

/** Todo lo que define una edición del tablero (equipos, servicios, departamentos y su orden). */
export interface BoardData {
  estadios: StadiumJson[]
  concesiones: ServiceJson[]
  servicios: ServiceJson[]
  departamentos: DepartmentJson[]
  layout: string[]
}
export interface CardData { federacion: CardJson[]; sorpresa: CardJson[] }

export const DEFAULT_BOARD_DATA: BoardData = {
  estadios: estadiosRaw as StadiumJson[],
  concesiones: concesionesRaw as ServiceJson[],
  servicios: serviciosRaw as ServiceJson[],
  departamentos: departamentosRaw as DepartmentJson[],
  layout,
}
export const DEFAULT_CARD_DATA: CardData = { federacion: federacionRaw as CardJson[], sorpresa: sorpresaRaw as CardJson[] }

/**
 * departamentos.json no distingue el tipo real de cada casilla (type 0 mezcla
 * Salida, multas, Banquillo...), así que lo fijamos aquí por índice del JSON.
 */
const DEPARTMENT_KINDS: DepartmentKind[] = [
  'start', // 0 Salida
  'federation', // 1
  'penalty', // 2 Multa y Cierre del Estadio
  'surprise', // 3
  'jail', // 4 Banquillo
  'federation', // 5 (izquierda)
  'parking', // 6
  'surprise', // 7
  'federation', // 8
  'goToJail', // 9 Vaya al Banquillo
  'surprise', // 10 (derecha)
  'penalty', // 11 Día del Club
]

/**
 * Construye el tablero de 40 casillas siguiendo board-layout.json.
 * "P<n>" = propiedad con id n (numeración del manual), "D<n>" = departamento n del JSON.
 */
export function buildBoard(data: BoardData = DEFAULT_BOARD_DATA): Square[] {
  const properties = new Map<number, (position: number) => Square>()

  for (const s of data.estadios) {
    properties.set(s.id, (position) => ({
      kind: 'stadium',
      position,
      id: s.id,
      name: s.name,
      team: s.team,
      short: s.short || s.team.toUpperCase(), // `short` va en estadios.json; si falta, el nombre del equipo
      part: s.type === 0 ? 'general' : 'tribuna',
      price: s.price,
      mortgage: s.mortgage,
      buildCost: s.build,
      rents: s.rents.map((r) => r.rent) as StadiumRents,
      rentLabels: s.rents.map((r) => r.title),
      // La imagen es opcional: sin `path` (estadios_new.json) la casilla se construye desde el JSON
      image: s.path ?? '',
      colors: s.colors,
    }))
  }
  for (const s of data.concesiones) {
    properties.set(s.id, (position) => ({
      kind: 'stadiumService',
      position,
      id: s.id,
      name: s.name,
      price: s.price,
      mortgage: s.mortgage,
      rentByOwned: s.rents.map((r) => r.rent),
      rentLabels: s.rents.map((r) => r.title),
      image: s.path ?? '',
      cardImage: s.card ?? '',
      icon: s.icon,
      color: s.color,
    }))
  }
  for (const s of data.servicios) {
    properties.set(s.id, (position) => ({
      kind: 'clubService',
      position,
      id: s.id,
      name: s.name,
      price: s.price,
      mortgage: s.mortgage,
      diceMultiplierByOwned: s.rents.map((r) => r.rent),
      rentLabels: s.rents.map((r) => r.title),
      image: s.path ?? '',
      cardImage: s.card ?? '',
      icon: s.icon,
      color: s.color,
    }))
  }

  return data.layout.map((token, position) => {
    const n = Number(token.slice(1))
    if (token[0] === 'P') {
      const make = properties.get(n)
      if (!make) throw new Error(`Layout: no existe la propiedad con id ${n}`)
      return make(position)
    }
    const d = data.departamentos[n]
    if (!d) throw new Error(`Layout: no existe el departamento ${n}`)
    return {
      kind: DEPARTMENT_KINDS[n],
      position,
      name: d.name,
      image: d.path ?? '',
      amount: d.quantity,
      icon: d.icon,
    }
  })
}

/**
 * Los JSON de cartas usan posiciones 1..40 (Betis = 2, Camp Nou tribuna = 40),
 * salvo "0" que significa Salida. Aquí se convierten a 0..39.
 */
function normalizeAction(
  raw: { method: string; args: unknown[] },
  jailPosition: number,
): CardAction {
  const a = raw.args as number[]
  switch (raw.method) {
    case 'receive':
      return { type: 'receive', amount: a[0] }
    case 'pay':
      return { type: 'pay', amount: a[0] }
    case 'collectForEachPlayer':
      return { type: 'collectFromEach', amount: a[0] }
    case 'move':
      if (a[0] === 0) return { type: 'moveTo', position: 0 }
      if (a[0] < 0) return { type: 'moveBack', steps: -a[0] }
      if (a[0] - 1 === jailPosition) return { type: 'goToJail' }
      return { type: 'moveTo', position: a[0] - 1 }
    case 'chooseRisk':
      return { type: 'payOrDrawSurprise', amount: 1000 } // el importe solo está en el texto
    case 'handleAppeal':
      return { type: 'getOutOfJail' }
    case 'buildRepairs':
      return { type: 'repairs', perSeat: a[0], perStand: a[1] }
    default:
      throw new Error(`Acción de carta desconocida: ${raw.method}`)
  }
}

export function loadCards(board: Square[], cards: CardData = DEFAULT_CARD_DATA): { federation: Card[]; surprise: Card[] } {
  const jail = board.find((s) => s.kind === 'jail')!.position
  const map = (deck: Card['deck'], raw: CardJson[]): Card[] =>
    raw.map((c) => ({ deck, text: c.text, action: normalizeAction(c.action, jail) }))
  return {
    federation: map('federation', cards.federacion),
    surprise: map('surprise', cards.sorpresa),
  }
}
