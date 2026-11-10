<script setup lang="ts">
import { pawnUrl } from '../../lib/assets'
import { PLAYER_COLORS } from '../../lib/colors'

/** Peón del jugador (player-N.webp); si falta la imagen, un círculo del color del jugador. */
withDefaults(defineProps<{ id: number; px?: number }>(), { px: 24 })
</script>

<template>
  <img
    v-if="pawnUrl(id)"
    :src="pawnUrl(id)"
    :alt="`Peón ${id + 1}`"
    :style="{ height: px + 'px' }"
    class="inline-block w-auto select-none"
    draggable="false"
  />
  <span
    v-else
    class="inline-block rounded-full border-2 border-white shadow"
    :style="{ height: px * 0.7 + 'px', width: px * 0.7 + 'px', backgroundColor: PLAYER_COLORS[id] }"
  />
</template>
