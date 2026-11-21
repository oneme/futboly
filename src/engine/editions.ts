import { DEFAULT_BOARD_DATA, DEFAULT_CARD_DATA, type BoardData, type CardData, type ServiceJson, type DepartmentJson, type StadiumJson, type CardJson } from './data'
import estadiosNew from '../json/estadios_new.json'
import concesionesNew from '../json/concesiones_new.json'
import serviciosNew from '../json/servicios_new.json'
import departamentosNew from '../json/departamentos_new.json'
import federacionNew from '../json/federacion_new.json'
import sorpresaNew from '../json/sorpresa_new.json'
import layout from '../json/board-layout.json'

/**
 * Ediciones del juego:
 *  - classic: el tablero original de 1982 (imágenes, importes en pesetas).
 *  - current: casillas dibujadas desde los JSON *_new (equipos actuales, servicios renombrados),
 *    importes en euros con inflación.
 */
export type Edition = 'classic' | 'current'

export interface EditionInfo {
  label: string
  description: string
  /** Si los importes se muestran en euros con inflación. */
  euros: boolean
  board: BoardData
  cards: CardData
}

export const EDITIONS: Record<Edition, EditionInfo> = {
  classic: {
    label: 'Clásica (1982)',
    description: 'Tablero original con sus imágenes y los importes en pesetas.',
    euros: false,
    board: DEFAULT_BOARD_DATA,
    cards: DEFAULT_CARD_DATA,
  },
  current: {
    label: 'Actual (euros con inflación)',
    description: 'Equipos actuales y casillas dibujadas desde los datos; importes en euros con inflación.',
    euros: true,
    board: {
      estadios: estadiosNew as StadiumJson[],
      concesiones: concesionesNew as ServiceJson[],
      servicios: serviciosNew as ServiceJson[],
      departamentos: departamentosNew as DepartmentJson[],
      layout,
    },
    cards: { federacion: federacionNew as CardJson[], sorpresa: sorpresaNew as CardJson[] },
  },
}
export const EDITION_IDS = Object.keys(EDITIONS) as Edition[]
