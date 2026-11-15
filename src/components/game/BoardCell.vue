<script setup lang="ts">
import { computed } from 'vue'
import { gridCell } from '../../lib/boardGeometry'
import { imageUrl } from '../../lib/assets'
import {fmt, PLAYER_COLORS} from '../../lib/colors'
import { isProperty, type Player, type PropertyState } from '../../engine/game'
import type { Square } from '../../engine/types'
import BuildingStrip from './BuildingStrip.vue'
import PawnIcon from './PawnIcon.vue'

/** Una casilla del tablero, a escala 1 (el tablero entero se escala desde BoardView). */
const props = defineProps<{ sq: Square; state?: PropertyState; pawns: Player[]; currentId: number }>()
const emit = defineEmits<{ hover: [position: number | null] }>()

const cell = computed(() => gridCell(props.sq.position))
const stadiumFaceClass = computed(() => `stadium-face--${cell.value.side}`)

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
const flipped = computed(() => cell.value.side === 'top' ? 'rotate-180' : '')
</script>

<template>
  <div class="relative z-10" :title="sq.name">
    <div
      class="absolute overflow-hidden"
      :style="imgBox"
      @mouseenter="isProperty(sq) && emit('hover', sq.position)"
      @mouseleave="emit('hover', null)"
    >
      <div v-if="sq.kind === 'stadium'" class="stadium-face select-none bg-orange-200" :class="stadiumFaceClass"
           draggable="false">
        <div class="flex">
          <template v-if="sq.colors.style > 3">
            <div
                v-for="index in sq.colors.style"
                :key="index"
                :class="[index % 2 === 1 ? sq.colors.top.split(',')[0] : sq.colors.top.split(',')[1], sq.colors.style === 5 ? 'h-8 w-20' : 'h-8 w-16']"
            />
          </template>
          <div v-else-if="sq.colors.style > 1" class="flex w-full bg-white">
            <div class="mx-1 h-8 w-1" :class="sq.colors.top" />
            <div class="me-1 h-8 w-1" :class="sq.colors.top" />
            <div class="h-8 w-1" :class="sq.colors.top" />
          </div>
          <div v-else class="h-8 w-full" :class="sq.colors.top" />
        </div>
        <div class="h-22">
          <p class="text-[10px] font-bold uppercase text-center pt-1.5 pb-5">{{sq.short}}</p>
          <p class="text-[10px] font-normal capitalize text-center">{{sq.part}}</p>
          <p class="text-[10px] font-normal capitalize text-center">{{sq.name}}</p>
          <p class="text-[10px] font-bold text-center">{{fmt(sq.price)}}</p>
        </div>
        <div v-if="sq.colors.style !== 3" class="h-2.5" :class="sq.colors.bottom">
        </div>
        <div v-else class="flex items-center gap-12 bg-white">
          <div class="flex h-2.5">
            <div class="mx-1 w-1" :class="sq.colors.top" />
            <div class="me-1 w-1" :class="sq.colors.top" />
            <div class="w-1" :class="sq.colors.top" />
          </div>
        </div>
      </div>
      <img
          v-if="imageUrl(sq.image)"
          :src="imageUrl(sq.image)"
          :alt="sq.name"
          class="h-full w-full select-none object-fill"
          :class="flipped ? 'rotate-180' : ''"
          draggable="false"
      />

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

<style scoped>
.stadium-face {
  width: 100%;
  height: 100%;
}

.stadium-face--top {
  transform: rotate(180deg);
}

.stadium-face--left,
.stadium-face--right {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 95px;
  height: 130px;
}

.stadium-face--left {
  transform: translate(-50%, -50%) rotate(90deg);
}

.stadium-face--right {
  transform: translate(-50%, -50%) rotate(-90deg);
}
</style>
