<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMatchStore } from '../../stores/match'
import { isProperty } from '../../engine/game'
import { fmt } from '../../lib/colors'
import PawnIcon from './PawnIcon.vue'
import DiceView from './DiceView.vue'
import CardView from './CardView.vue'

// Clases de Tailwind como constantes (evita @apply, que cambia entre Tailwind 3 y 4).
const btn =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
const btnPrimary =
  'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40'
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm'

const store = useMatchStore()
const s = computed(() => store.state!)
const p = computed(() => store.current!)
const square = computed(() => s.value.board[p.value.position])
const price = computed(() => (isProperty(square.value) ? square.value.price : 0))
const jailFine = computed(() => {
  const jail = s.value.board.find((x) => x.kind === 'jail')
  return jail && 'amount' in jail ? jail.amount : 0
})

// Tirada con animación: las caras cambian al azar unos instantes y después se aplica la jugada real.
const ANIM_MS = import.meta.env.MODE === 'test' ? 0 : 700
const rolling = ref(false)
const faces = ref<[number, number]>([1, 1])
const rnd = () => Math.floor(Math.random() * 6) + 1
const shownDice = computed<[number, number] | null>(() => (rolling.value ? faces.value : s.value.dice))
function rollDice() {
  if (rolling.value) return
  if (ANIM_MS === 0) return store.roll()
  rolling.value = true
  const timer = setInterval(() => (faces.value = [rnd(), rnd()]), 90)
  setTimeout(() => {
    clearInterval(timer)
    rolling.value = false
    store.roll()
  }, ANIM_MS)
}

// Subasta por pujas
const auction = computed(() => s.value.auction)
const auctionSq = computed(() => (auction.value ? s.value.board[auction.value.position] : null))
const auctionPrice = computed(() => (auctionSq.value && isProperty(auctionSq.value) ? auctionSq.value.price : 0))
const bidder = computed(() => (auction.value ? s.value.players[auction.value.turn] : null))
const leader = computed(() => (auction.value?.leader != null ? s.value.players[auction.value.leader] : null))
const raises = [500, 1000, 5000]
const custom = ref(0)
watch(
  () => auction.value?.bid,
  () => (custom.value = 0),
)
const canCustom = computed(
  () => !!auction.value && !!bidder.value && custom.value > auction.value.bid && custom.value <= bidder.value.money,
)

// Quién decide ahora (puede no ser el jugador en turno: subasta o deuda) y bloqueo de botones
const actor = computed(() => store.actingPlayer ?? p.value)
const locked = computed(() => store.moving || store.aiActing || !!s.value.proposal)

// Deuda
const debtor = computed(() => (s.value.debt ? s.value.players[s.value.debt.debtor] : null))
const canSettle = computed(() => !!s.value.debt && !!debtor.value && debtor.value.money >= s.value.debt.amount)
</script>

<template>
  <fieldset class="m-0 flex w-full max-w-xl flex-col items-center gap-3 border-0 p-0 text-center text-white" :disabled="locked">
    <!-- Cabecera: jugador en turno y dados -->
    <div class="flex items-center gap-2 text-lg font-semibold">
      <PawnIcon :id="actor.id" :px="34" />
      {{ actor.name }}
      <span v-if="actor.ai" class="rounded bg-violet-100 px-1.5 text-xs font-medium text-violet-800">IA</span>
      <span class="font-normal text-green-100">· {{ fmt(actor.money) }}</span>
    </div>
    <p v-if="store.aiActing && !store.moving" class="text-sm italic text-green-100">pensando…</p>
    <p v-else-if="s.proposal" class="text-sm italic text-green-100">esperando tu respuesta a la propuesta…</p>
    <div v-if="shownDice" class="flex items-center justify-center gap-3">
      <DiceView :value="shownDice[0]" :px="56" :rolling="rolling" />
      <DiceView :value="shownDice[1]" :px="56" :rolling="rolling" />
      <span v-if="!rolling" class="text-xl font-semibold">= {{ shownDice[0] + shownDice[1] }}</span>
    </div>
    <div v-if="s.parkingPot > 0" class="text-sm text-green-100">Bote del Parking: {{ fmt(s.parkingPot) }}</div>

    <!-- Tirar -->
    <template v-if="s.phase === 'roll'">
      <p v-if="p.inJail" class="text-sm">{{ p.name }} está en el Banquillo (turno {{ p.jailTurns + 1 }} de 3).</p>
      <div class="flex flex-wrap justify-center gap-2">
        <button :class="btnPrimary" :disabled="rolling" @click="rollDice()">Tirar dados</button>
        <button v-if="p.inJail" :class="btn" :disabled="p.money < jailFine" @click="store.payJailFine()">
          Pagar {{ fmt(jailFine) }}
        </button>
        <button v-if="p.inJail && p.jailCards.length" :class="btn" @click="store.useJailCard()">
          Usar carta "Salga del Banquillo"
        </button>
      </div>
    </template>

    <!-- Carta robada -->
    <template v-else-if="s.phase === 'card' && s.card">
      <CardView :deck="s.card.deck" :text="s.card.card.text" />
      <button :class="btnPrimary" @click="store.resolveCard()">Aplicar</button>
    </template>

    <!-- Carta de riesgo -->
    <template v-else-if="s.phase === 'cardChoice' && s.card">
      <CardView :deck="s.card.deck" :text="s.card.card.text" />
      <div class="flex gap-2">
        <button :class="btn" @click="store.chooseRisk(false)">Pagar la multa</button>
        <button :class="btnPrimary" @click="store.chooseRisk(true)">Robar Sorpresa</button>
      </div>
    </template>

    <!-- Comprar -->
    <template v-else-if="s.phase === 'buy'">
      <p>
        <strong>{{ square.name }}</strong> está libre por <strong>{{ fmt(price) }}</strong>.
      </p>
      <div class="flex gap-2">
        <button :class="btnPrimary" :disabled="p.money < price" @click="store.buy()">Comprar</button>
        <button :class="btn" @click="store.declineBuy()">Subastar</button>
      </div>
    </template>

    <!-- Subasta por pujas -->
    <template v-else-if="s.phase === 'auction' && auction && auctionSq && bidder">
      <p>
        Subasta de <strong>{{ auctionSq.name }}</strong> <span class="text-green-100">(precio {{ fmt(auctionPrice) }})</span>
      </p>
      <p>
        Puja actual:
        <strong>{{ auction.bid ? fmt(auction.bid) : 'ninguna' }}</strong>
        <template v-if="leader"> · {{ leader.name }}</template>
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-for="inc in raises"
          :key="inc"
          :class="btn"
          :disabled="auction.bid + inc > bidder.money"
          @click="store.auctionBid(auction.bid + inc)"
        >
          +{{ fmt(inc) }} ({{ fmt(auction.bid + inc) }})
        </button>
      </div>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <input v-model.number="custom" type="number" min="0" step="500" placeholder="Otra cantidad" :class="[field, 'w-32']" />
        <button :class="btnPrimary" :disabled="!canCustom" @click="store.auctionBid(custom)">Pujar</button>
        <button :class="btn" @click="store.auctionPass()">Retirarse</button>
      </div>
    </template>

    <!-- Deuda -->
    <template v-else-if="s.phase === 'debt' && s.debt && debtor">
      <p>
        <strong>{{ debtor.name }}</strong> debe {{ fmt(s.debt.amount) }} y tiene {{ fmt(debtor.money) }}.
      </p>
      <p class="text-sm text-green-100">Puede vender mejoras o hipotecar antes de pagar.</p>
      <div class="flex flex-wrap justify-center gap-2">
        <button :class="btn" @click="store.openManager(s.debt.debtor)">Gestionar propiedades</button>
        <button :class="btnPrimary" :disabled="!canSettle" @click="store.settleDebt()">Saldar deuda</button>
        <button :class="btn" @click="store.declareBankruptcy()">Declararse en quiebra</button>
      </div>
    </template>

    <!-- Fin de turno -->
    <template v-else-if="s.phase === 'endTurn'">
      <button :class="btnPrimary" @click="store.endTurn()">Terminar turno</button>
    </template>

    <!-- Fin de partida -->
    <template v-else-if="s.phase === 'gameOver'">
      <p class="text-xl font-bold">🏆 Gana {{ s.winner !== null ? s.players[s.winner].name : '' }}</p>
      <div class="flex flex-wrap justify-center gap-2">
        <button :class="btn" @click="store.summaryOpen = true">Ver resumen</button>
        <button :class="btnPrimary" @click="store.rematch()">Revancha</button>
        <button :class="btn" @click="store.quit()">Nueva partida</button>
      </div>
    </template>
  </fieldset>
</template>
