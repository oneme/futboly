<script setup lang="ts">
import { computed } from 'vue'
import { useMoney } from '../../lib/useMoney'
import type { DepartmentSquare } from '../../engine/types'
import SquareIcon from './SquareIcon.vue'

/** Salida, Multa, Parking y Día del Club dibujados desde los datos. `wide` = casilla de esquina (apaisada). */
const props = defineProps<{ sq: DepartmentSquare; wide?: boolean }>()
const { money } = useMoney()

const tone = computed(() => {
  switch (props.sq.icon) {
    case 'start': return 'bg-emerald-600 text-white'
    case 'fine': return 'bg-red-600 text-white'
    case 'parking': return 'bg-sky-700 text-white'
    default: return 'bg-amber-400 text-black'
  }
})
const caption = computed(() => {
  if (props.sq.kind === 'start') return `Cobre ${money(props.sq.amount)}`
  if (props.sq.kind === 'parking') return 'Bote acumulado'
  return props.sq.amount ? `Pague ${money(props.sq.amount)}` : ''
})
</script>

<template>
  <div
    class="flex h-full w-full select-none items-center justify-center overflow-hidden border border-black/40 text-center"
    :class="[tone, wide ? 'flex-row gap-3 px-3' : 'flex-col px-1 py-2']"
    data-department
    :data-name="sq.name"
    :data-amount="sq.amount"
  >
    <SquareIcon :name="sq.icon" :class="wide ? 'h-20 w-20' : 'h-12 w-12'" />
    <div>
      <p class="font-extrabold uppercase leading-tight" :class="wide ? 'text-lg' : 'text-[11px]'">{{ sq.name }}</p>
      <p v-if="caption" class="font-semibold" :class="wide ? 'text-sm' : 'text-[10px]'">{{ caption }}</p>
    </div>
  </div>
</template>
