import { EDITIONS } from '../src/engine/editions'
import { validateEdition } from '../src/engine/validation'

/** Valida todas las ediciones registradas en src/engine/editions.ts. */
let total = 0
for (const [id, edition] of Object.entries(EDITIONS)) {
  const { ok, problems } = validateEdition(edition.board, edition.cards)
  console.log(`\n=== Edición ${edition.label} (${id})`)
  ok.forEach((m) => console.log('OK   ', m))
  problems.forEach((m) => console.log('AVISO', m))
  total += problems.length
}
console.log(total ? `\n${total} aviso(s)` : '\nTodo correcto en todas las ediciones')
process.exitCode = total ? 1 : 0
