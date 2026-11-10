<script setup lang="ts">
import { computed } from 'vue'
import { chairUrl, tribuneUrl } from '../../lib/assets'
import type { Side } from '../../lib/boardGeometry'

/**
 * Sillas (hasta 4) o tribuna de un estadio, colocadas FUERA de la imagen de la casilla,
 * hacia el interior del tablero (mismas posiciones que el Building.vue original).
 * Las coordenadas son px a escala 1, relativas a la esquina superior izquierda de la casilla.
 */
const props = defineProps<{ side: Side; seats: number; stand: boolean }>()

const CHAIR = 32
const TRIBUNE = 48

const px = (n: number) => `${n}px`
const chairStyle = (i: number) => {
  switch (props.side) {
    case 'bottom': return { top: px(-32), left: px(i * 24) }
    case 'top': return { top: px(132), right: px(i * 24) }
    case 'right': return { left: px(32), top: px([-8, 16, 40, 64][i]) }
    default: return { right: px(32), top: px([0, 24, 48, 72][i]) }
  }
}
const tribuneStyle = computed(() => {
  switch (props.side) {
    case 'bottom': return { top: px(-48), left: px(24) }
    case 'top': return { top: px(132), left: px(24) }
    case 'right': return { top: px(16), left: px(16) }
    default: return { top: px(16), right: px(16) }
  }
})
</script>

<template>
  <div class="pointer-events-none absolute left-0 top-0 h-0 w-0">
    <template v-if="stand">
      <img
        v-if="tribuneUrl(side)"
        :src="tribuneUrl(side)"
        alt="Tribuna"
        class="absolute object-contain"
        :style="{ ...tribuneStyle, width: px(TRIBUNE), height: px(TRIBUNE) }"
      />
      <span v-else class="absolute rounded-sm bg-red-600" :style="{ ...tribuneStyle, width: px(TRIBUNE), height: px(TRIBUNE) }" />
    </template>
    <template v-else>
      <template v-for="i in seats" :key="i">
        <img
          v-if="chairUrl(side)"
          :src="chairUrl(side)"
          alt="Asiento"
          class="absolute object-contain"
          :style="{ ...chairStyle(i - 1), width: px(CHAIR), height: px(CHAIR) }"
        />
        <span v-else class="absolute rounded-sm bg-green-600" :style="{ ...chairStyle(i - 1), width: px(CHAIR), height: px(CHAIR) }" />
      </template>
    </template>
  </div>
</template>
