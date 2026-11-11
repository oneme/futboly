<script setup lang="ts">
import type { StadiumSquare } from '../../engine/types'

/** Franja inferior con el nombre del equipo. Portado de TeamColorsBottom original. */
withDefaults(defineProps<{ sq: Pick<StadiumSquare, 'colors' | 'team'>; showTeamName?: boolean }>(), {
  showTeamName: true,
})
</script>

<template>
  <div v-if="sq.colors.style !== 3" class="h-8 border border-black" :class="sq.colors.bottom">
    <p v-show="showTeamName" class="pt-1 text-center uppercase">{{ sq.team }}</p>
  </div>
  <div v-else class="flex items-center gap-12 border border-black bg-white">
    <div class="flex h-8">
      <div class="mx-2 w-2" :class="sq.colors.top" />
      <div class="me-2 w-2" :class="sq.colors.top" />
      <div class="w-2" :class="sq.colors.top" />
    </div>
    <p v-show="showTeamName" class="text-center uppercase text-black">{{ sq.team }}</p>
  </div>
</template>
