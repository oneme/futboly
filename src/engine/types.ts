/**
 * Tipos del dominio de Futboly.
 * Terminología (para no confundirnos):
 *  - "Concesión General" / "Concesión Tribuna": las dos casillas de un estadio (grupo).
 *  - "asiento" (verde, máx. 4) y "tribuna" (roja, máx. 1): las mejoras que se construyen.
 */

/** Posición en el tablero: 0..39, con 0 = Salida. */
export type Position = number

export type DepartmentKind =
  | 'start'
  | 'federation'
  | 'surprise'
  | 'penalty'
  | 'jail'
  | 'parking'
  | 'goToJail'

interface SquareBase {
  position: Position
  name: string
  image: string
}

export interface DepartmentSquare extends SquareBase {
  kind: DepartmentKind
  /** Salida: cobro. Penalty/Parking: pago. Banquillo: multa para salir. */
  amount: number
}

/** [sin asientos, 1, 2, 3, 4 asientos, con tribuna] */
export type StadiumRents = [number, number, number, number, number, number]

export interface StadiumSquare extends SquareBase {
  kind: 'stadium'
  id: number
  team: string
  short: string
  part: 'general' | 'tribuna'
  price: number
  mortgage: number
  /** Precio de cada asiento (y de la tribuna, pendiente de confirmar). */
  buildCost: number
  rents: StadiumRents
  /** Textos de cada alquiler, tal como vienen en el JSON ("zona sin asientos", "con 1 silla"...). */
  rentLabels: string[]
  colors: { top: string; bottom: string; style: number }
}

/** Servicios de estadio: Almohadillas, Gorras, Bares, Publicidad. */
export interface StadiumServiceSquare extends SquareBase {
  kind: 'stadiumService'
  id: number
  price: number
  mortgage: number
  cardImage: string
  /** Alquiler según cuántos servicios de estadio posea el dueño (índice 0 = 1 servicio). */
  rentByOwned: number[]
  rentLabels: string[]
}

/** Servicios de club: Material Deportivo, Autocares. */
export interface ClubServiceSquare extends SquareBase {
  kind: 'clubService'
  id: number
  price: number
  mortgage: number
  cardImage: string
  /** Multiplicador de los dados según servicios de club poseídos (índice 0 = 1 servicio). */
  diceMultiplierByOwned: number[]
  rentLabels: string[]
}

export type PropertySquare = StadiumSquare | StadiumServiceSquare | ClubServiceSquare
export type Square = DepartmentSquare | PropertySquare

/** Clave de grupo: ambos estadios de un equipo comparten grupo. */
export function groupKey(sq: PropertySquare): string {
  return sq.kind === 'stadium' ? `team:${sq.team}` : sq.kind
}

// ---------- Intercambios ----------

/** `from` entrega `fromPositions` + `fromCash` y recibe `toPositions` + `toCash` de `to`. */
export interface TradeOffer {
  from: number
  to: number
  fromPositions: number[]
  toPositions: number[]
  fromCash: number
  toCash: number
}

// ---------- Cartas ----------

export type CardAction =
  | { type: 'receive'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'collectFromEach'; amount: number }
  /** Avanza hasta la casilla; si pasa por Salida cobra 20.000. */
  | { type: 'moveTo'; position: Position }
  | { type: 'moveBack'; steps: number }
  /** Directo al Banquillo, sin cobrar Salida. */
  | { type: 'goToJail' }
  | { type: 'getOutOfJail' }
  | { type: 'repairs'; perSeat: number; perStand: number }
  /** Paga la multa o roba una carta Sorpresa (obligatoria). */
  | { type: 'payOrDrawSurprise'; amount: number }

export interface Card {
  deck: 'federation' | 'surprise'
  text: string
  action: CardAction
}
