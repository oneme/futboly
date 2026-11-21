<script setup lang="ts">
import { computed } from 'vue'
import { useMoney } from '../../lib/useMoney'
import { readableText } from '../../lib/teamColors'
import type { ClubServiceSquare, StadiumServiceSquare } from '../../engine/types'
import SquareIcon from './SquareIcon.vue'

/** Casilla de un servicio (de estadio o de club) dibujada desde los datos: cabecera, icono sobre su color y precio. */
const props = defineProps<{ sq: StadiumServiceSquare | ClubServiceSquare }>()
const { money } = useMoney()
const bg = computed(() => props.sq.color ?? '#94a3b8')
const fg = computed(() => readableText(bg.value))
const header = computed(() => (props.sq.kind === 'stadiumService' ? 'Servicio de estadio' : 'Servicio del club'))
</script>

<template>
  <div
    class="flex h-full w-full select-none flex-col overflow-hidden bg-orange-200 text-center"
    data-service-square
    :data-name="sq.name"
    :data-price="money(sq.price)"
  >
    <p class="px-1 pt-1.5 text-[9px] font-medium uppercase leading-tight">{{ header }}</p>
    <div class="mx-2 my-1.5 flex flex-1 items-center justify-center rounded-md border border-black/60" :style="{ backgroundColor: bg, color: fg }">
      <SquareIcon :name="sq.icon" class="h-14 w-14" />
    </div>
    <p class="text-[11px] font-bold uppercase leading-tight">{{ sq.name }}</p>
    <p class="pb-1.5 pt-0.5 text-[10px] font-bold">{{ money(sq.price) }}</p>
  </div>
</template>
