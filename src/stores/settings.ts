import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { DEFAULT_INFLATION, type CurrencyOptions } from '../lib/currency'

const KEY = 'futboly-settings'

/** Preferencias de visualización (no afectan a las reglas): moneda e inflación. Se guardan en el navegador. */
export const useSettingsStore = defineStore('settings', () => {
  let saved: Partial<CurrencyOptions> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<CurrencyOptions>
  } catch {
    /* sin preferencias guardadas */
  }
  const euros = ref(saved.euros === true)
  const inflation = ref<number | string>(typeof saved.inflation === 'number' ? saved.inflation : DEFAULT_INFLATION)

  /** Opciones saneadas: un coeficiente vacío o negativo vuelve al valor por defecto. */
  const options = computed<CurrencyOptions>(() => {
    const coef = Number(inflation.value)
    return { euros: euros.value, inflation: inflation.value !== '' && Number.isFinite(coef) && coef >= 0 ? coef : DEFAULT_INFLATION }
  })

  watch(options, (o) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(o))
    } catch {
      /* se ignora */
    }
  })

  return { euros, inflation, options }
})
