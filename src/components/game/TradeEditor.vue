<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/match'
import { isProperty } from '../../engine/game'
import type { PropertySquare } from '../../engine/types'
import PropertyChip from './PropertyChip.vue'
import { useMoney } from '../../lib/useMoney'

/**
 * Editor de una oferta entre dos jugadores: qué concesiones y cuánto dinero entrega cada uno.
 * Lo usan la pestaña de tratos y la contraoferta a la propuesta de una IA.
 */
const props = defineProps<{ from: number; to: number }>()
const mine = defineModel<number[]>('mine', { required: true })
const theirs = defineModel<number[]>('theirs', { required: true })
const myCash = defineModel<number>('myCash', { required: true })
const theirCash = defineModel<number>('theirCash', { required: true })

const { money, euros } = useMoney()
const store = useMatchStore()
const g = computed(() => store.state!)
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm'
const ownedBy = (id: number) =>
  g.value.board.filter((sq): sq is PropertySquare => isProperty(sq) && g.value.properties[sq.position].owner === id)
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2" data-trade-editor>
    <div class="rounded-lg border border-slate-200 p-2">
      <h3 class="mb-1 text-sm font-semibold">{{ g.players[props.from].name }} ofrece</h3>
      <label v-for="sq in ownedBy(props.from)" :key="sq.position" class="flex items-center gap-2 py-0.5 text-sm">
        <input v-model="mine" type="checkbox" :value="sq.position" />
        <PropertyChip :sq="sq" :mortgaged="g.properties[sq.position].mortgaged" />
      </label>
      <p v-if="!ownedBy(props.from).length" class="text-xs text-slate-500">Sin concesiones.</p>
      <label class="mt-2 flex items-center gap-2 text-sm">
        Dinero (Ptas.) <input v-model.number="myCash" type="number" min="0" step="500" :class="[field, 'w-28']" data-my-cash />
        <span v-if="euros && myCash > 0" class="text-xs text-slate-500">≈ {{ money(myCash) }}</span>
      </label>
    </div>

    <div class="rounded-lg border border-slate-200 p-2">
      <h3 class="mb-1 text-sm font-semibold">{{ g.players[props.to].name }} ofrece</h3>
      <label v-for="sq in ownedBy(props.to)" :key="sq.position" class="flex items-center gap-2 py-0.5 text-sm">
        <input v-model="theirs" type="checkbox" :value="sq.position" />
        <PropertyChip :sq="sq" :mortgaged="g.properties[sq.position].mortgaged" />
      </label>
      <p v-if="!ownedBy(props.to).length" class="text-xs text-slate-500">Sin concesiones.</p>
      <label class="mt-2 flex items-center gap-2 text-sm">
        Dinero (Ptas.) <input v-model.number="theirCash" type="number" min="0" step="500" :class="[field, 'w-28']" data-their-cash />
        <span v-if="euros && theirCash > 0" class="text-xs text-slate-500">≈ {{ money(theirCash) }}</span>
      </label>
    </div>
  </div>
</template>
