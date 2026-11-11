<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/match'
import { describeSide } from '../../engine/trading'
import PawnIcon from './PawnIcon.vue'

/** Propuesta de trato de una IA a un jugador humano: hay que aceptarla o rechazarla. */
const store = useMatchStore()
const s = computed(() => store.state!)
const offer = computed(() => s.value.proposal)
const btn = 'rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-slate-50'
const btnPrimary = 'rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700'
</script>

<template>
  <div v-if="offer" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
      <div class="mb-3 flex items-center gap-2 text-lg font-semibold">
        <PawnIcon :id="offer.from" :px="36" />
        {{ s.players[offer.from].name }} te propone un trato
      </div>
      <p class="mb-3 text-sm text-slate-500">Para {{ s.players[offer.to].name }}:</p>
      <dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt class="font-medium text-emerald-700">Recibes</dt>
        <dd>{{ describeSide(s, offer.fromPositions, offer.fromCash) }}</dd>
        <dt class="font-medium text-red-700">Entregas</dt>
        <dd>{{ describeSide(s, offer.toPositions, offer.toCash) }}</dd>
      </dl>
      <div class="flex justify-end gap-2">
        <button :class="btn" @click="store.answerProposal(false)">Rechazar</button>
        <button :class="btnPrimary" @click="store.answerProposal(true)">Aceptar</button>
      </div>
    </div>
  </div>
</template>
