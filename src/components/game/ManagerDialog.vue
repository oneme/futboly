<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMatchStore } from '../../stores/match'
import { useMoney } from '../../lib/useMoney'
import PropertiesTab from './PropertiesTab.vue'
import TradeTab from './TradeTab.vue'
import PawnIcon from './PawnIcon.vue'

const { money } = useMoney()

const store = useMatchStore()
const tab = ref<'props' | 'trade'>('props')
const pid = computed(() => store.managing)
const player = computed(() => (pid.value === null ? null : store.state!.players[pid.value]))
const alive = computed(() => store.state!.players.filter((p) => !p.bankrupt))

const tabClass = (t: string) =>
  tab.value === t
    ? 'border-b-2 border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700'
    : 'px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900'
</script>

<template>
  <div
    v-if="pid !== null && player"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="store.closeManager()"
  >
    <div class="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
      <header class="flex items-center gap-3 border-b border-slate-200 p-3">
        <PawnIcon :id="pid" :px="30" />
        <select v-model="store.managing" class="rounded-md border border-slate-300 px-2 py-1 font-semibold">
          <option v-for="p in alive" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <span class="tabular-nums text-slate-700">{{ money(player.money) }}</span>
        <span v-if="store.state!.debt" class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
          Deuda pendiente: {{ money(store.state!.debt.amount) }}
        </span>
        <button class="ml-auto rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" @click="store.closeManager()">
          ✕
        </button>
      </header>

      <nav class="flex gap-1 border-b border-slate-200 px-3">
        <button :class="tabClass('props')" @click="tab = 'props'">Propiedades</button>
        <button :class="tabClass('trade')" @click="tab = 'trade'">Intercambios</button>
      </nav>

      <div class="overflow-y-auto p-3">
        <p v-if="player.ai" class="mb-2 rounded bg-violet-50 px-2 py-1 text-sm text-violet-800">
          Este jugador lo controla la IA: solo puedes consultar sus propiedades.
        </p>
        <fieldset class="contents" :disabled="player.ai">
          <PropertiesTab v-if="tab === 'props'" :pid="pid" />
          <TradeTab v-else :pid="pid" />
        </fieldset>
      </div>
    </div>
  </div>
</template>
