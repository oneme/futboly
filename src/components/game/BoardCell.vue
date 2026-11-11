<script setup lang="ts">
import { computed } from 'vue'
import { gridCell } from '../../lib/boardGeometry'
import { imageUrl } from '../../lib/assets'
import { PLAYER_COLORS } from '../../lib/colors'
import { isProperty, type Player, type PropertyState } from '../../engine/game'
import type { Square } from '../../engine/types'
import BuildingStrip from './BuildingStrip.vue'
import PawnIcon from './PawnIcon.vue'

/** Una casilla del tablero, a escala 1 (el tablero entero se escala desde BoardView). */
const props = defineProps<{ sq: Square; state?: PropertyState; pawns: Player[]; currentId: number }>()
const emit = defineEmits<{ hover: [position: number | null] }>()

const cell = computed(() => gridCell(props.sq.position))

// Imagen de la casilla pegada al borde exterior; el hueco interior queda para sillas y tribunas.
const imgBox = computed(() => {
  if (cell.value.corner) return { inset: 0 }
  switch (cell.value.side) {
    case 'bottom': return { left: 0, right: 0, bottom: 0, height: '130px' }
    case 'top': return { left: 0, right: 0, top: 0, height: '130px' }
    case 'left': return { left: 0, top: 0, bottom: 0, width: '130px' }
    default: return { right: 0, top: 0, bottom: 0, width: '130px' }
  }
})
// Banda de color del propietario, en el borde interior de la imagen.
const band = computed(() => {
  switch (cell.value.side) {
    case 'bottom': return { left: 0, right: 0, top: 0, height: '6px' }
    case 'top': return { left: 0, right: 0, bottom: 0, height: '6px' }
    case 'left': return { top: 0, bottom: 0, right: 0, width: '6px' }
    default: return { top: 0, bottom: 0, left: 0, width: '6px' }
  }
})
// En la fila superior las imágenes van giradas 180º (como en el tablero físico).
const flipped = computed(() => cell.value.side === 'top')
</script>

<template>
  <div class="relative z-10" :title="sq.name">
    <div
      class="absolute overflow-hidden bg-white"
      :style="imgBox"
      @mouseenter="isProperty(sq) && emit('hover', sq.position)"
      @mouseleave="emit('hover', null)"
    >
      <img
        v-if="imageUrl(sq.image)"
        :src="imageUrl(sq.image)"
        :alt="sq.name"
        class="h-full w-full select-none object-fill"
        :class="flipped ? 'rotate-180' : ''"
        draggable="false"
      />
      <span v-else class="flex h-full items-center justify-center px-1 text-center text-[10px] leading-tight text-slate-600">
        {{ sq.name }}
      </span>

      <template v-if="isProperty(sq) && state">
        <div v-if="state.owner !== null" class="absolute" :style="{ ...band, backgroundColor: PLAYER_COLORS[state.owner] }" />
        <div
          v-if="state.mortgaged"
          class="absolute inset-0 flex items-center justify-center bg-slate-700/60 text-lg font-bold text-white"
        >
          H
        </div>
      </template>

      <!-- Fichas -->
      <div class="absolute bottom-1 left-1 flex -space-x-3">
        <PawnIcon
          v-for="p in pawns"
          :key="p.id"
          :id="p.id"
          :px="40"
          :title="p.name"
          :style="p.id === currentId ? { filter: 'drop-shadow(0 0 4px #000)', zIndex: 1 } : {}"
        />
      </div>
    </div>

    <BuildingStrip v-if="sq.kind === 'stadium' && state" :side="cell.side" :seats="state.seats" :stand="state.stand" />
  </div>
</template>
