<script setup lang="ts">
import { diceUrl } from '../../lib/assets'

/** Una cara de dado (dices/N.webp); si falta la imagen, un recuadro con el número. */
withDefaults(defineProps<{ value: number; px?: number; rolling?: boolean }>(), { px: 56, rolling: false })
</script>

<template>
  <img
    v-if="diceUrl(value)"
    :src="diceUrl(value)"
    :alt="`Dado: ${value}`"
    :style="{ height: px + 'px', width: px + 'px' }"
    class="select-none object-contain"
    :class="rolling ? 'animate-bounce' : ''"
    draggable="false"
  />
  <span
    v-else
    class="inline-flex items-center justify-center rounded-lg border-2 border-slate-700 bg-white text-xl font-bold"
    :class="rolling ? 'animate-bounce' : ''"
    :style="{ height: px + 'px', width: px + 'px' }"
  >
    {{ value }}
  </span>
</template>
