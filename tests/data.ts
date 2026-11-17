import { buildBoard } from '../src/engine/data'
import type { PropertySquare, StadiumSquare } from '../src/engine/types'

/**
 * Los tests no deben depender de qué equipos hay en estadios.json (se podrán cambiar de edición):
 * toman nombres, colores y precios del propio JSON a través de los ids de las concesiones.
 *   id 1 / 2   = General / Tribuna del primer equipo      id 27 / 28 = del último equipo
 *   id 4 / 5   = General / Tribuna del segundo equipo     id 3 / 11 / 18 / 26 = servicios de estadio
 *   id 8 / 21  = servicios de club
 */
export const board = buildBoard()
export const byId = (id: number) => board.find((x) => 'id' in x && x.id === id) as PropertySquare
export const stadium = (id: number) => byId(id) as StadiumSquare
export const posOf = (id: number) => board.findIndex((x) => 'id' in x && x.id === id)
export const stripeClasses = (id: number) => stadium(id).colors.top.split(',').map((c) => c.trim())
/** Primer estadio cuya parte inferior cumple la condición (para probar variantes de color sin fijar equipos). */
export const stadiumWhere = (pred: (colors: StadiumSquare['colors']) => boolean) =>
  board.find((x): x is StadiumSquare => x.kind === 'stadium' && pred(x.colors))
