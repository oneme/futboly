<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useMatchStore } from '../../stores/match'
import { BOARD_H, BOARD_W, COL_PX, ROW_PX, gridCell } from '../../lib/boardGeometry'
import { imageUrl } from '../../lib/assets'
import { isProperty } from '../../engine/game'
import BoardCell from './BoardCell.vue'
import PropertyCard from './PropertyCard.vue'

const store = useMatchStore()
const g = computed(() => store.state!)

// El tablero se dibuja a su tamaño real (1445 x 943) y se escala para ocupar el ancho disponible.
const MAX_SCALE = 1.2
const wrap = ref<HTMLElement | null>(null)
const scale = ref(1)
let observer: ResizeObserver | undefined
const measure = () => {
  if (wrap.value) scale.value = Math.min(MAX_SCALE, wrap.value.clientWidth / BOARD_W) || 1
}
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && wrap.value) {
    observer = new ResizeObserver(measure)
    observer.observe(wrap.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

const gridStyle = computed(() => ({
  width: `${BOARD_W}px`,
  height: `${BOARD_H}px`,
  transform: `scale(${scale.value})`,
  gridTemplateColumns: COL_PX.map((n) => `${n}px`).join(' '),
  gridTemplateRows: ROW_PX.map((n) => `${n}px`).join(' '),
}))
const cellPlace = (position: number) => {
  const { row, col } = gridCell(position)
  return { gridRow: row, gridColumn: col }
}
// Casilla bajo el ratón: se muestra su tarjeta de precios.
const hovered = ref<number | null>(null)
const hoveredSq = computed(() => {
  const sq = hovered.value === null ? null : g.value.board[hovered.value]
  return sq && isProperty(sq) ? sq : null
})
const hoveredOwner = computed(() => {
  const owner = hoveredSq.value ? g.value.properties[hoveredSq.value.position].owner : null
  return owner === null ? undefined : g.value.players[owner].name
})
const playersAt = (position: number) => g.value.players.filter((p) => !p.bankrupt && p.position === position)

// Zona central (columnas 2..12, filas 2..8) en px reales, para superponer los controles sin escalar su texto.
const centerStyle = computed(() => {
  const s = scale.value
  const left = COL_PX[0] * s
  const top = ROW_PX[0] * s
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${(BOARD_W - COL_PX[0] - COL_PX[12]) * s}px`,
    height: `${(BOARD_H - ROW_PX[0] - ROW_PX[8]) * s}px`,
    paddingInline: `${150 * s}px`,
  }
})
</script>

<template>
  <div ref="wrap" class="relative w-full" :style="{ height: `${BOARD_H * scale}px` }">
    <div class="absolute left-0 top-0 grid origin-top-left bg-slate-800" :style="gridStyle">
      <BoardCell
        v-for="sq in g.board"
        :key="sq.position"
        :sq="sq"
        :state="isProperty(sq) ? g.properties[sq.position] : undefined"
        :pawns="playersAt(sq.position)"
        :current-id="g.current"
        :style="cellPlace(sq.position)"
        @hover="hovered = $event"
      />

      <!-- Centro del tablero: mazos de cartas -->
      <div class="relative z-0 bg-emerald-50" style="grid-column: 2 / 13; grid-row: 2 / 9">
        <div class="absolute left-8 top-1/2 h-[200px] w-[122px] -translate-y-1/2">
          <img
            v-if="imageUrl('src/assets/departments/card_surprise.webp')"
            :src="imageUrl('src/assets/departments/card_surprise.webp')"
            alt="Mazo Sorpresa"
            class="absolute left-1/2 top-1/2 w-[200px] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 border-4 border-dotted border-white"
          />
        </div>
        <div class="absolute right-8 top-1/2 h-[200px] w-[122px] -translate-y-1/2">
          <img
            v-if="imageUrl('src/assets/departments/card_federation.webp')"
            :src="imageUrl('src/assets/departments/card_federation.webp')"
            alt="Mazo Federación"
            class="absolute left-1/2 top-1/2 w-[200px] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 border-4 border-dotted border-white"
          />
        </div>
      </div>
    </div>

    <!-- Tarjeta de precios al pasar el ratón por una concesión (sin escalar, como en el diseño original) -->
    <div
      v-if="hoveredSq"
      class="pointer-events-none absolute z-30"
      :style="{ left: '30%', top: `${144 * scale}px` }"
    >
      <PropertyCard :sq="hoveredSq" :state="g.properties[hoveredSq.position]" :owner-name="hoveredOwner" />
    </div>

    <!-- Controles de la partida (sin escalar, para que el texto sea legible) -->
    <div class="absolute z-20 flex items-center justify-center overflow-auto" :style="centerStyle">
      <slot />
    </div>
  </div>
</template>
