/**
 * Importes en pesetas (el motor siempre trabaja en pesetas) o en euros "con inflación".
 * La conversión es la de tu utils.ts original:
 *   euros = ceil( pesetas / 166,386 · (1 + coeficiente) )   con coeficiente 35,79 por defecto
 */
export const PESETAS_PER_EURO = 166.386
export const DEFAULT_INFLATION = 35.79

export interface CurrencyOptions {
  euros: boolean
  /** Coeficiente de inflación: el importe en euros se multiplica por (1 + coeficiente). */
  inflation: number
}
export const PESETAS: CurrencyOptions = { euros: false, inflation: DEFAULT_INFLATION }

/** Puntos de millar siempre (2.500, 20.000), como el formatCurrency original. */
export const formatNumber = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const toEuros = (pesetas: number, coefficient = DEFAULT_INFLATION): number =>
  Math.ceil((pesetas / PESETAS_PER_EURO) * (1 + coefficient))

/** Un importe tal como se muestra: "20.000" en pesetas, "4.423 €" en euros. */
export function formatMoney(pesetas: number, opts: CurrencyOptions = PESETAS): string {
  return opts.euros ? `${formatNumber(toEuros(pesetas, opts.inflation))} €` : formatNumber(pesetas)
}

/** Importes con punto de millar dentro de un texto fijo (las cartas dicen "cobre 20.000"). */
const DOTTED = /\b\d{1,3}(?:\.\d{3})+\b/g
export function convertText(text: string, opts: CurrencyOptions = PESETAS): string {
  if (!opts.euros) return text
  return text.replace(DOTTED, (m) => formatMoney(Number(m.replace(/\./g, '')), opts))
}

/** El motor escribe los importes del registro como [[6000]]; aquí se muestran en la moneda elegida. */
const TOKEN = /\[\[(\d+)\]\]/g
export function renderLog(line: string, opts: CurrencyOptions = PESETAS): string {
  // Primero el texto fijo (cartas) y después los marcadores, para no convertir dos veces.
  return convertText(line, opts).replace(TOKEN, (_, n: string) => formatMoney(Number(n), opts))
}
