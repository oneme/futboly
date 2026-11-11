<script setup lang="ts">
import { computed } from 'vue'
import type { StadiumSquare } from '../../engine/types'

/** Franja de colores del equipo (parte superior del título de propiedad). Portado de TeamColorsTop original. */
const props = defineProps<{ sq: Pick<StadiumSquare, 'colors'> }>()
const squares = computed(() => props.sq.colors.top.split(','))
const style = computed(() => props.sq.colors.style)
</script>

<template>
  <div class="flex border border-black">
    <template v-if="style > 3">
      <div
        v-for="index in style"
        :key="index"
        :class="[index % 2 === 1 ? squares[0] : squares[1], style === 5 ? 'h-10 w-20' : 'h-10 w-16']"
      />
    </template>
    <div v-else-if="style > 1" class="flex w-full bg-white">
      <div class="mx-2 h-12 w-2" :class="sq.colors.top" />
      <div class="me-2 h-12 w-2" :class="sq.colors.top" />
      <div class="h-12 w-2" :class="sq.colors.top" />
    </div>
    <div v-else class="h-10 w-full" :class="sq.colors.top" />
  </div>
</template>
