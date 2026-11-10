/**
 * Geometría real del tablero (medida de las imágenes de src/assets):
 *   - casillas de las filas superior e inferior: 95 x 130 (retrato)
 *   - casillas de las columnas izquierda y derecha: 130 x 95 (apaisadas)
 *   - esquinas: 200 x 139
 * El tablero es una cuadrícula de 13 columnas x 9 filas con 40 casillas en el perímetro.
 * Las cuatro esquinas son los departamentos grandes:
 *   0 Salida (abajo-derecha) -> 12 Banquillo (abajo-izquierda)
 *   -> 20 Parking (arriba-izquierda) -> 32 Vaya al Banquillo (arriba-derecha) -> 0
 * Las posiciones avanzan en sentido horario, empezando por la fila inferior de derecha a izquierda.
 */
export const COLS = 13
export const ROWS = 9

/** Tamaño de cada columna y fila en px, a escala 1. */
export const COL_PX = [200, ...Array<number>(11).fill(95), 200]
export const ROW_PX = [139, ...Array<number>(7).fill(95), 139]
export const BOARD_W = COL_PX.reduce((a, b) => a + b, 0) // 1445
export const BOARD_H = ROW_PX.reduce((a, b) => a + b, 0) // 943

export type Side = 'bottom' | 'left' | 'top' | 'right'

export interface Cell {
  row: number // 1..ROWS (CSS grid, 1 = arriba)
  col: number // 1..COLS (1 = izquierda)
  side: Side
  corner: boolean
}

export function gridCell(position: number): Cell {
  const p = ((position % 40) + 40) % 40
  const corner = p === 0 || p === 12 || p === 20 || p === 32
  if (p <= 12) return { row: ROWS, col: COLS - p, side: 'bottom', corner }
  if (p < 20) return { row: ROWS - (p - 12), col: 1, side: 'left', corner }
  if (p <= 32) return { row: 1, col: 1 + (p - 20), side: 'top', corner }
  return { row: 1 + (p - 32), col: COLS, side: 'right', corner }
}
