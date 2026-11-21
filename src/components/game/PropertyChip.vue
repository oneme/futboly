<script setup lang="ts">
import { computed } from 'vue'
import type { PropertySquare } from '../../engine/types'
import { DEFAULT_SERVICE_COLOR, SERVICE_COLORS, readableText } from '../../lib/teamColors'

/**
 * Píldora de una concesión con los colores de su equipo: a la izquierda las franjas de la parte superior
 * del título de propiedad y después el nombre sobre el color de la parte inferior (como en la tarjeta de precios).
 * Los servicios usan un color propio. Las clases de color vienen de estadios.json (están en la lista segura de Tailwind).
 */
const props = withDefaults(
  defineProps<{ sq: PropertySquare; label?: string; size?: 'sm' | 'md'; mortgaged?: boolean }>(),
  { size: 'sm', mortgaged: false },
)

const stadium = computed(() => (props.sq.kind === 'stadium' ? props.sq : null))
const stripes = computed(() => (stadium.value ? stadium.value.colors.top.split(',').map((c) => c.trim()).filter(Boolean) : []))
// Parte inferior: si no trae color de texto se pone negro; si viene vacía (equipos de barras), fondo blanco.
const bottomClass = computed(() => {
  const bottom = stadium.value?.colors.bottom.trim() ?? ''
  if (!bottom) return 'bg-white text-black'
  return /(^|\s)text-/.test(bottom) ? bottom : `${bottom} text-black`
})
const serviceBg = computed(() => (props.sq.kind !== 'stadium' && props.sq.color) || SERVICE_COLORS[props.sq.name] || DEFAULT_SERVICE_COLOR)
const text = computed(() => {
  if (props.label !== undefined) return props.label
  return stadium.value ? `${stadium.value.name} (${stadium.value.part === 'general' ? 'G' : 'T'})` : props.sq.name
})
</script>

<template>
  <span
    class="inline-flex max-w-full items-stretch overflow-hidden rounded border border-black/70 align-middle leading-none"
    :class="[size === 'md' ? 'text-sm font-semibold' : 'text-[11px]', mortgaged ? 'opacity-60' : '']"
    :title="mortgaged ? `${text} (hipotecada)` : text"
    data-chip
  >
    <template v-if="stadium">
      <span class="flex shrink-0" :class="size === 'md' ? 'w-6' : 'w-4'" data-stripes>
        <i v-for="(stripe, i) in stripes" :key="i" class="block min-w-0 flex-1" :class="stripe" />
      </span>
      <span class="truncate whitespace-nowrap px-1.5 py-1" :class="[bottomClass, mortgaged ? 'line-through' : '']" data-label>
        {{ text }}
      </span>
    </template>
    <span
      v-else
      class="truncate whitespace-nowrap px-1.5 py-1"
      :class="mortgaged ? 'line-through' : ''"
      :style="{ backgroundColor: serviceBg, color: readableText(serviceBg) }"
      data-label
    >
      {{ text }}
    </span>
  </span>
</template>
