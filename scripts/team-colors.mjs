/**
 * Genera src/assets/team-colors.css con la lista segura de Tailwind para los colores de los equipos.
 *
 * estadios.json guarda los colores como clases ("bg-sky-1100,bg-white"). Tailwind 4 detecta las clases sueltas
 * dentro de los JSON, pero NO las que van unidas por comas, así que las generamos aquí. Se leen todos los
 * estadios*.json (la edición clásica y la actual) para poder cambiar de edición sin regenerar nada.
 *
 *   node scripts/team-colors.mjs        (se ejecuta solo antes de `npm run dev` y `npm run build-only`)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Todas las clases de color (top y bottom) de todos los estadios*.json, ordenadas y sin repetir. */
export function collectTeamColorClasses(jsonDir = join(root, 'src/json')) {
  const classes = new Set()
  for (const file of readdirSync(jsonDir).filter((f) => /^estadios.*\.json$/.test(f))) {
    for (const stadium of JSON.parse(readFileSync(join(jsonDir, file), 'utf-8'))) {
      for (const key of ['top', 'bottom']) {
        for (const c of String(stadium.colors?.[key] ?? '').split(/[,\s]+/)) if (c) classes.add(c)
      }
    }
  }
  return [...classes].sort()
}

export const renderTeamColorsCss = (classes) =>
  `/* GENERADO por scripts/team-colors.mjs a partir de src/json/estadios*.json. No editar a mano.\n` +
  `   Los colores de equipo vienen como clases unidas por comas ("bg-sky-1100,bg-white"), que Tailwind no detecta solo. */\n` +
  `@source inline("${classes.join(' ')}");\n`

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const classes = collectTeamColorClasses()
  writeFileSync(join(root, 'src/assets/team-colors.css'), renderTeamColorsCss(classes))
  console.log(`team-colors.css: ${classes.length} clases (${classes.join(' ')})`)
}
