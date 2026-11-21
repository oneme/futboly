<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMatchStore } from '../../stores/match'
import type { TradeOffer } from '../../engine/management'
import TradeEditor from './TradeEditor.vue'
import { useMoney } from '../../lib/useMoney'

const { money } = useMoney()

const props = defineProps<{ pid: number }>()
const store = useMatchStore()
const g = computed(() => store.state!)

const btnPrimary =
  'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40'
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm'

const others = computed(() => g.value.players.filter((p) => !p.bankrupt && p.id !== props.pid))

// ----- Intercambio de concesiones y dinero -----
const to = ref<number | null>(null)
const mine = ref<number[]>([])
const theirs = ref<number[]>([])
const myCash = ref(0)
const theirCash = ref(0)

function reset() {
  to.value = null
  mine.value = []
  theirs.value = []
  myCash.value = 0
  theirCash.value = 0
  cardBuyer.value = null
  cardPrice.value = 0
}
watch(
  () => props.pid,
  () => {
    reset()
    result.value = ''
  },
)
watch(to, (value) => {
  theirs.value = []
  if (value !== null) result.value = '' // al elegir otro jugador se borra el último resultado
})

const offer = computed<TradeOffer | null>(() =>
  to.value === null
    ? null
    : {
        from: props.pid,
        to: to.value,
        fromPositions: mine.value,
        toPositions: theirs.value,
        fromCash: myCash.value || 0,
        toCash: theirCash.value || 0,
      },
)
const error = computed(() => (offer.value ? store.canTrade(offer.value) : 'Elija con quién intercambiar'))

const partnerAI = computed(() => to.value !== null && g.value.players[to.value].ai)
const result = ref('')
function submit() {
  if (!offer.value || error.value) return
  if (partnerAI.value) {
    const name = g.value.players[offer.value.to].name
    const answer = store.negotiate(offer.value)
    reset()
    result.value =
      answer === 'accepted' ? `${name} (IA) acepta el trato.`
      : answer === 'countered' ? `${name} (IA) rechaza tu oferta y te hace una contraoferta.`
      : `${name} (IA) rechaza la propuesta.`
    return
  }
  store.trade(offer.value)
  reset()
  result.value = ''
}

// ----- Venta de la carta "Salga del Banquillo" -----
const cardBuyer = ref<number | null>(null)
const cardPrice = ref(0)
const cardError = computed(() =>
  cardBuyer.value === null ? 'Elija comprador' : store.canSellJailCard(props.pid, cardBuyer.value, 0, cardPrice.value || 0),
)
function sellCard() {
  if (cardBuyer.value === null || cardError.value) return
  store.sellJailCard(props.pid, cardBuyer.value, 0, cardPrice.value || 0)
  cardBuyer.value = null
  cardPrice.value = 0
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium">Intercambiar con</label>
        <select v-model="to" :class="field">
          <option :value="null" disabled>Jugador…</option>
          <option v-for="q in others" :key="q.id" :value="q.id">{{ q.name }} ({{ money(q.money) }})</option>
        </select>
      </div>

      <TradeEditor v-if="to !== null" v-model:mine="mine" v-model:theirs="theirs" v-model:my-cash="myCash" v-model:their-cash="theirCash" :from="pid" :to="to" />

      <div class="flex flex-wrap items-center gap-3">
        <button :class="btnPrimary" :disabled="!!error" @click="submit">
          {{ partnerAI ? 'Proponer a la IA' : 'Aceptar intercambio' }}
        </button>
        <span v-if="partnerAI" class="text-xs text-violet-700">La IA valorará la oferta y responderá al momento: puede aceptar, rechazar o contraofertar.</span>
        <span v-if="error && to !== null" class="text-xs text-amber-700">{{ error }}</span>
        <span v-if="result" class="text-sm font-medium text-slate-700">{{ result }}</span>
      </div>
    </section>

    <section v-if="g.players[pid].jailCards.length" class="rounded-lg border border-slate-200 p-2">
      <h3 class="mb-1 text-sm font-semibold">Vender carta "Salga del Banquillo"</h3>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="cardBuyer" :class="field">
          <option :value="null" disabled>Comprador…</option>
          <option v-for="q in others" :key="q.id" :value="q.id">{{ q.name }} ({{ money(q.money) }})</option>
        </select>
        <input v-model.number="cardPrice" type="number" min="0" step="500" :class="[field, 'w-28']" />
        <button :class="btnPrimary" :disabled="!!cardError" @click="sellCard">Vender</button>
        <span v-if="cardError && cardBuyer !== null" class="text-xs text-amber-700">{{ cardError }}</span>
      </div>
    </section>
  </div>
</template>
