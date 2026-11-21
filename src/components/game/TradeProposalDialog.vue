<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMatchStore } from '../../stores/match'
import { useMoney } from '../../lib/useMoney'
import type { PropertySquare, TradeOffer } from '../../engine/types'
import PawnIcon from './PawnIcon.vue'
import PropertyChip from './PropertyChip.vue'
import TradeEditor from './TradeEditor.vue'

const { money } = useMoney()

/**
 * Propuesta (o contraoferta) de una IA a un jugador humano: se acepta, se rechaza o se contraofertea
 * cambiando concesiones y dinero. La IA responde a la contraoferta y puede volver a contraofertar.
 */
const store = useMatchStore()
const s = computed(() => store.state!)
const offer = computed(() => s.value.proposal)
const sq = (pos: number) => s.value.board[pos] as PropertySquare
const isCounter = computed(() => (offer.value?.round ?? 0) > 0)
const canCounter = computed(() => !!offer.value && store.canCounter())

// ----- Editor de la contraoferta: prellenado con la propuesta, desde el punto de vista del humano -----
const countering = ref(false)
const mine = ref<number[]>([]) // concesiones que entrega el humano
const theirs = ref<number[]>([]) // las que pide a la IA
const myCash = ref(0)
const theirCash = ref(0)
watch(offer, (o) => {
  countering.value = false
  if (!o) return
  mine.value = [...o.toPositions]
  theirs.value = [...o.fromPositions]
  myCash.value = o.toCash
  theirCash.value = o.fromCash
})
const counter = computed<TradeOffer | null>(() =>
  offer.value
    ? { from: offer.value.to, to: offer.value.from, fromPositions: mine.value, toPositions: theirs.value, fromCash: myCash.value || 0, toCash: theirCash.value || 0 }
    : null,
)
const error = computed(() => (counter.value ? store.canTrade(counter.value) : null))

function sendCounter() {
  if (!counter.value || error.value) return
  store.counterProposal(counter.value) // la respuesta de la IA queda en el registro de la partida
}

const btn = 'rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-slate-50'
const btnPrimary = 'rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40'
</script>

<template>
  <div v-if="offer" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" data-proposal>
    <div class="max-h-full w-full overflow-y-auto rounded-xl bg-white p-5 shadow-xl" :class="countering ? 'max-w-2xl' : 'max-w-md'">
      <div class="mb-3 flex items-center gap-2 text-lg font-semibold">
        <PawnIcon :id="offer.from" :px="36" />
        {{ s.players[offer.from].name }} {{ isCounter ? 'te hace una contraoferta' : 'te propone un trato' }}
      </div>
      <p class="mb-3 text-sm text-slate-500">
        Para {{ s.players[offer.to].name }}:
        <span v-if="!canCounter" class="text-amber-700">(última oferta: solo se puede aceptar o rechazar)</span>
      </p>
      <dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt class="font-medium text-emerald-700">Recibes</dt>
        <dd class="flex flex-wrap items-center gap-1">
          <PropertyChip v-for="pos in offer.fromPositions" :key="pos" :sq="sq(pos)" />
          <span v-if="offer.fromCash">{{ money(offer.fromCash) }}</span>
          <span v-if="!offer.fromPositions.length && !offer.fromCash">nada</span>
        </dd>
        <dt class="font-medium text-red-700">Entregas</dt>
        <dd class="flex flex-wrap items-center gap-1">
          <PropertyChip v-for="pos in offer.toPositions" :key="pos" :sq="sq(pos)" />
          <span v-if="offer.toCash">{{ money(offer.toCash) }}</span>
          <span v-if="!offer.toPositions.length && !offer.toCash">nada</span>
        </dd>
      </dl>

      <div v-if="countering" class="mb-4 flex flex-col gap-2" data-counter-editor>
        <p class="text-sm font-medium">Tu contraoferta</p>
        <TradeEditor v-model:mine="mine" v-model:theirs="theirs" v-model:my-cash="myCash" v-model:their-cash="theirCash" :from="offer.to" :to="offer.from" />
        <p v-if="error" class="text-xs text-amber-700">{{ error }}</p>
      </div>

      <div class="flex flex-wrap justify-end gap-2">
        <template v-if="!countering">
          <button :class="btn" data-reject @click="store.answerProposal(false)">Rechazar</button>
          <button v-if="canCounter" :class="btn" data-counter @click="countering = true">Contraofertar</button>
          <button :class="btnPrimary" data-accept @click="store.answerProposal(true)">Aceptar</button>
        </template>
        <template v-else>
          <button :class="btn" @click="countering = false">Volver</button>
          <button :class="btnPrimary" :disabled="!!error" data-send-counter @click="sendCounter">Enviar contraoferta</button>
        </template>
      </div>
    </div>
  </div>
</template>
