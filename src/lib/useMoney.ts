import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { convertText, formatMoney, renderLog } from './currency'

/** Formateadores de importes según la moneda elegida (reactivos: al cambiarla se actualiza toda la interfaz). */
export function useMoney() {
  const settings = useSettingsStore()
  return {
    euros: computed(() => settings.euros),
    /** Un importe en pesetas del motor, en la moneda elegida. */
    money: (pesetas: number) => formatMoney(pesetas, settings.options),
    /** Un texto fijo con importes (cartas). */
    convertText: (text: string) => convertText(text, settings.options),
    /** Una línea del registro de la partida. */
    logLine: (line: string) => renderLog(line, settings.options),
  }
}
