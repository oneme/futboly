import { computed } from 'vue'
import { useMatchStore } from '../stores/match'
import { useSettingsStore } from '../stores/settings'
import { EDITIONS } from '../engine/editions'
import { DEFAULT_INFLATION, convertText, formatMoney, renderLog, type CurrencyOptions } from './currency'

/**
 * Formateadores de importes. Con una partida en marcha mandan sus reglas (edición e inflación),
 * así una partida guardada se ve siempre igual; fuera de partida, las preferencias de inicio.
 */
export function useMoney() {
  const settings = useSettingsStore()
  const match = useMatchStore()
  const opts = computed<CurrencyOptions>(() => {
    const r = match.state?.rules
    if (!r) return settings.options
    return { euros: (EDITIONS[r.edition] ?? EDITIONS.classic).euros, inflation: r.inflation ?? DEFAULT_INFLATION }
  })
  return {
    euros: computed(() => opts.value.euros),
    /** Un importe en pesetas del motor, en la moneda de la edición. */
    money: (pesetas: number) => formatMoney(pesetas, opts.value),
    /** Un texto fijo con importes (cartas). */
    convertText: (text: string) => convertText(text, opts.value),
    /** Una línea del registro de la partida. */
    logLine: (line: string) => renderLog(line, opts.value),
  }
}
