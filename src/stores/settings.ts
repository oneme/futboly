import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { DEFAULT_INFLATION, type CurrencyOptions } from '../lib/currency'
import { EDITIONS, type Edition } from '../engine/editions'

const KEY = 'futboly-settings'

/**
 * Preferencias de la pantalla de inicio: edición del tablero e inflación. Se guardan en el navegador.
 * Durante la partida la edición y la inflación viajan en `state.rules` (ver useMoney).
 */
export const useSettingsStore = defineStore('settings', () => {
  let saved: { edition?: Edition; inflation?: number; euros?: boolean } = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    /* sin preferencias guardadas */
  }
  // Compatibilidad: la versión anterior guardaba { euros: true }.
  const initial: Edition = saved.edition && saved.edition in EDITIONS ? saved.edition : saved.euros ? 'current' : 'classic'
  const edition = ref<Edition>(initial)
  const inflation = ref<number | string>(typeof saved.inflation === 'number' ? saved.inflation : DEFAULT_INFLATION)

  /** Coeficiente saneado: vacío o negativo vuelve al valor por defecto. */
  const coefficient = computed(() => {
    const c = Number(inflation.value)
    return inflation.value !== '' && Number.isFinite(c) && c >= 0 ? c : DEFAULT_INFLATION
  })
  const options = computed<CurrencyOptions>(() => ({ euros: EDITIONS[edition.value].euros, inflation: coefficient.value }))

  watch([edition, coefficient], () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ edition: edition.value, inflation: coefficient.value }))
    } catch {
      /* se ignora */
    }
  })

  return { edition, inflation, coefficient, options }
})
