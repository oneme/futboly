import { DEFAULT_BOARD_DATA, DEFAULT_CARD_DATA, type BoardData, type CardData } from '../src/engine/data'
import { validateEdition } from '../src/engine/validation'
import estadiosNew from '../src/json/estadios_new.json'
import federacionNew from '../src/json/federacion_new.json'
import sorpresaNew from '../src/json/sorpresa_new.json'

/**
 * Valida las dos ediciones de datos:
 *  - clásica: estadios.json + federacion.json + sorpresa.json (la que usa el juego)
 *  - actual:  estadios_new.json + federacion_new.json + sorpresa_new.json
 * Las dos comparten concesiones, servicios, departamentos y el orden del tablero.
 */
const editions: [string, BoardData, CardData][] = [
  ['Edición clásica', DEFAULT_BOARD_DATA, DEFAULT_CARD_DATA],
  [
    'Edición actual (*_new.json)',
    { ...DEFAULT_BOARD_DATA, estadios: estadiosNew as BoardData['estadios'] },
    { federacion: federacionNew as CardData['federacion'], sorpresa: sorpresaNew as CardData['sorpresa'] },
  ],
]

let total = 0
for (const [name, data, cards] of editions) {
  const { ok, problems } = validateEdition(data, cards)
  console.log(`\n=== ${name}`)
  ok.forEach((m) => console.log('OK   ', m))
  problems.forEach((m) => console.log('AVISO', m))
  total += problems.length
}
console.log(total ? `\n${total} aviso(s)` : '\nTodo correcto en las dos ediciones')
process.exitCode = total ? 1 : 0
