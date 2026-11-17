import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  DEFAULT_INFLATION, PESETAS, PESETAS_PER_EURO, convertText, formatMoney, formatNumber, renderLog, toEuros,
} from '../src/lib/currency'
import { useSettingsStore } from '../src/stores/settings'
import { buy, createGame, roll } from '../src/engine/game'
import { stadium } from './data'

// La fórmula de tu utils.ts original: Math.ceil((price / 166.386) * (1 + coefficient)), coeficiente 35,79
const original = (price: number, coefficient = 35.79) => Math.ceil((price / 166.386) * (1 + coefficient))

describe('conversión a euros con inflación', () => {
  it('coincide con la fórmula original del utils.ts', () => {
    expect(PESETAS_PER_EURO).toBe(166.386)
    expect(DEFAULT_INFLATION).toBe(35.79)
    for (const price of [100, 500, 1_000, 6_000, 20_000, 150_000, 277_000]) {
      expect(toEuros(price)).toBe(original(price))
      expect(toEuros(price, 0.5)).toBe(original(price, 0.5))
    }
    expect(toEuros(20_000)).toBe(4_423) // la Salida
    expect(toEuros(150_000)).toBe(33_167) // el dinero inicial
    expect(toEuros(166_386, 0)).toBe(1_000) // sin inflación: 166.386 ptas = 1.000 €
  })

  it('da formato con punto de millar y símbolo solo en euros', () => {
    expect(formatNumber(2500)).toBe('2.500')
    expect(formatMoney(20_000)).toBe('20.000')
    expect(formatMoney(20_000, PESETAS)).toBe('20.000')
    expect(formatMoney(20_000, { euros: true, inflation: 35.79 })).toBe('4.423 €')
    expect(formatMoney(20_000, { euros: true, inflation: 0 })).toBe('121 €')
    expect(formatMoney(0, { euros: true, inflation: 35.79 })).toBe('0 €')
  })

  it('convierte los importes de los textos de las cartas', () => {
    const euros = { euros: true, inflation: 35.79 }
    expect(convertText('Sitúese en la salida, cobre 20.000. Esperamos', euros)).toBe('Sitúese en la salida, cobre 4.423 €. Esperamos')
    expect(convertText('Pague 4.000 por cada silla y 11.000 por cada tribuna', euros)).toBe(
      `Pague ${formatMoney(4_000, euros)} por cada silla y ${formatMoney(11_000, euros)} por cada tribuna`,
    )
    expect(convertText('visita al Betis (casilla nº 1)', euros)).toBe('visita al Betis (casilla nº 1)') // sin importes
    expect(convertText('cobre 20.000', PESETAS)).toBe('cobre 20.000') // en pesetas no se toca
  })

  it('el registro muestra los marcadores del motor en la moneda elegida, sin convertir dos veces', () => {
    const euros = { euros: true, inflation: 35.79 }
    expect(renderLog('Ana compra Camp Nou por [[48000]].', PESETAS)).toBe('Ana compra Camp Nou por 48.000.')
    expect(renderLog('Ana compra Camp Nou por [[48000]].', euros)).toBe(`Ana compra Camp Nou por ${formatMoney(48_000, euros)}.`)
    // una carta (texto fijo con 20.000) y un marcador en la misma línea
    const line = 'Ana roba una carta: cobre 20.000. Ana cobra [[20000]].'
    expect(renderLog(line, euros)).toBe(`Ana roba una carta: cobre 4.423 €. Ana cobra 4.423 €.`)
  })

  it('el motor escribe los importes del registro como marcadores (siempre en pesetas)', () => {
    const g = createGame(['Ana', 'Beto'])
    roll(g, () => 0.01) // 1 y 1 -> Federación
    g.phase = 'roll'
    g.players[0].position = 3
    g.phase = 'buy'
    buy(g)
    expect(g.log.at(-1)).toBe(`Ana compra ${stadium(2).name} por [[${stadium(2).price}]].`)
    expect(g.log.some((l) => /\d\.\d{3}/.test(l.replace(/\[\[\d+\]\]/g, '')) && !l.includes('carta'))).toBe(false)
  })
})

describe('preferencias de moneda', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('por defecto pesetas y el coeficiente original; se guardan en el navegador', async () => {
    const s = useSettingsStore()
    expect(s.options).toEqual({ euros: false, inflation: 35.79 })
    s.euros = true
    s.inflation = 12.5
    await Promise.resolve()
    expect(JSON.parse(localStorage.getItem('futboly-settings')!)).toEqual({ euros: true, inflation: 12.5 })

    // una sesión nueva las recupera
    setActivePinia(createPinia())
    expect(useSettingsStore().options).toEqual({ euros: true, inflation: 12.5 })
  })

  it('un coeficiente vacío, negativo o no numérico vuelve al valor por defecto', () => {
    const s = useSettingsStore()
    for (const bad of ['', -3, 'abc', NaN]) {
      s.inflation = bad as never
      expect(s.options.inflation).toBe(35.79)
    }
    s.inflation = 0
    expect(s.options.inflation).toBe(0) // 0 es válido: sin inflación
  })
})
