import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_BOARD_DATA, DEFAULT_CARD_DATA, buildBoard, type BoardData, type CardData } from '../src/engine/data'
import { validateEdition } from '../src/engine/validation'
import estadiosNew from '../src/json/estadios_new.json'
import federacionNew from '../src/json/federacion_new.json'
import sorpresaNew from '../src/json/sorpresa_new.json'
// @ts-expect-error módulo .mjs sin tipos
import { collectTeamColorClasses, renderTeamColorsCss } from '../scripts/team-colors.mjs'

const classic: [BoardData, CardData] = [DEFAULT_BOARD_DATA, DEFAULT_CARD_DATA]
const current: [BoardData, CardData] = [
  { ...DEFAULT_BOARD_DATA, estadios: estadiosNew as BoardData['estadios'] },
  { federacion: federacionNew as CardData['federacion'], sorpresa: sorpresaNew as CardData['sorpresa'] },
]
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

describe('validación de las ediciones de datos', () => {
  it.each([['clásica', classic], ['actual (*_new.json)', current]] as const)('la edición %s no tiene errores', (_, [data, cards]) => {
    const { ok, problems } = validateEdition(data, cards)
    expect(problems).toEqual([])
    expect(ok.length).toBeGreaterThanOrEqual(7)
  })

  it('las dos ediciones se pueden construir: 40 casillas, 22 estadios con nombre corto', () => {
    for (const [data] of [classic, current]) {
      const board = buildBoard(data)
      expect(board.length).toBe(40)
      const stadiums = board.filter((s) => s.kind === 'stadium')
      expect(stadiums.length).toBe(22)
      expect(stadiums.every((s) => s.kind === 'stadium' && s.short.length > 0)).toBe(true)
    }
    // Sin `path` en estadios_new.json la casilla no tiene imagen y se construye desde el JSON
    const sq = buildBoard(current[0]).find((s) => s.kind === 'stadium')!
    expect(sq.image).toBe('')
  })

  it('misma economía en las dos ediciones: solo cambian equipos, estadios y colores', () => {
    const [a, b] = [classic[0].estadios, current[0].estadios]
    expect(b.map((e) => e.id)).toEqual(a.map((e) => e.id))
    for (const [x, y] of a.map((e, i) => [e, b[i]] as const)) {
      expect([y.price, y.mortgage, y.build, y.type]).toEqual([x.price, x.mortgage, x.build, x.type])
      expect(y.rents.map((r) => r.rent)).toEqual(x.rents.map((r) => r.rent))
    }
  })

  describe('el validador detecta errores de verdad', () => {
    it('hipoteca, alquileres, short, colores y parejas de equipo', () => {
      const d = clone(DEFAULT_BOARD_DATA)
      d.estadios[0].mortgage += 1
      d.estadios[2].rents[3].rent = d.estadios[2].rents[1].rent // deja de crecer
      d.estadios[4].short = ''
      d.estadios[6].colors.top = ''
      d.estadios[9].type = 0 // dos Generales y ninguna Tribuna
      const text = validateEdition(d, DEFAULT_CARD_DATA).problems.join('\n')
      expect(text).toContain('Hipoteca distinta de precio/2')
      expect(text).toContain('alquileres no crecientes')
      expect(text).toContain('falta "short"')
      expect(text).toContain('faltan los colores')
      expect(text).toContain('debe tener exactamente una concesión General')
    })

    it('cartas: pague/cobre al revés, acción desconocida y destino que no coincide con el texto', () => {
      const c = clone(DEFAULT_CARD_DATA)
      c.federacion[8].action.method = 'receive' // "pague una multa" que cobra
      c.federacion[0].action.method = 'inventada'
      const i = c.sorpresa.findIndex((x) => x.action.method === 'move' && (x.action.args[0] as number) === 40)
      c.sorpresa[i].action.args = [38] // Camp Nou Tribuna -> General (la 39 es el Día del Club)
      c.sorpresa.pop() // 15 cartas
      const text = validateEdition(DEFAULT_BOARD_DATA, c).problems.join('\n')
      expect(text).toContain('dice "pague" pero la acción es receive')
      expect(text).toContain('acción desconocida')
      expect(text).toContain('el texto dice tribuna y es la casilla General')
      expect(text).toContain('15 cartas')
    })

    it('una errata en el nombre del destino', () => {
      const c = clone(DEFAULT_CARD_DATA)
      const card = c.sorpresa.find((x) => /Camp Nou/.test(x.text))!
      card.text = card.text.replace('Camp Nou', 'Cam Nou')
      expect(validateEdition(DEFAULT_BOARD_DATA, c).problems.join('\n')).toContain("el texto dice 'Cam Nou'")
    })
  })
})

describe('colores de equipo para Tailwind (team-colors.css)', () => {
  it('el archivo generado está al día con todos los estadios*.json', () => {
    const file = readFileSync('src/assets/team-colors.css', 'utf-8')
    expect(file).toBe(renderTeamColorsCss(collectTeamColorClasses()))
  })

  it('incluye cada clase de color de las dos ediciones (también las unidas por comas)', () => {
    const safelist = readFileSync('src/assets/team-colors.css', 'utf-8').match(/@source inline\("([^"]+)"\)/)![1].split(/\s+/)
    for (const e of [...classic[0].estadios, ...current[0].estadios]) {
      for (const k of ['top', 'bottom'] as const) {
        for (const c of e.colors[k].split(/[,\s]+/)) if (c) expect(safelist, `${e.team}: ${c}`).toContain(c)
      }
    }
  })

  it('main.css importa el archivo generado', () => {
    expect(readFileSync('src/assets/main.css', 'utf-8')).toContain('@import "./team-colors.css";')
  })
})
