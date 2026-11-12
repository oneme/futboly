<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/match'
import { PLAYER_COLORS, fmt } from '../../lib/colors'
import { isProperty } from '../../engine/game'
import { AI_PROFILES } from '../../engine/aiProfiles'
import PawnIcon from './PawnIcon.vue'

const store = useMatchStore()
const g = computed(() => store.state!)

/** Propiedades de un jugador, ordenadas por posición en el tablero. */
const propertiesOf = (id: number) =>
  g.value.board.filter((sq) => isProperty(sq) && g.value.properties[sq.position].owner === id)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="p in g.players"
      :key="p.id"
      class="rounded-lg border bg-white p-2 shadow-sm"
      :class="[p.id === g.current && !p.bankrupt ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200', p.bankrupt ? 'opacity-40' : '']"
    >
      <div class="flex items-center gap-2">
        <PawnIcon :id="p.id" :px="28" />
        <span class="font-semibold" :style="{ color: PLAYER_COLORS[p.id] }">{{ p.name }}</span>
        <span v-if="p.ai" class="rounded bg-violet-100 px-1.5 text-xs text-violet-800" title="Jugador controlado por la máquina">
          IA · {{ AI_PROFILES[p.level ?? 'normal'].label }}
        </span>
        <span v-if="p.inJail" class="rounded bg-amber-100 px-1.5 text-xs text-amber-800">Banquillo</span>
        <span v-if="p.jailCards.length" class="rounded bg-sky-100 px-1.5 text-xs text-sky-800">
          🔓 ×{{ p.jailCards.length }}
        </span>
        <span v-if="p.bankrupt" class="rounded bg-red-100 px-1.5 text-xs text-red-800">Quiebra</span>
        <span class="ml-auto tabular-nums">{{ fmt(p.money) }}</span>
        <button
          v-if="!p.bankrupt"
          class="rounded border border-slate-300 px-1.5 text-xs hover:bg-slate-50"
          title="Construir, hipotecar, intercambiar"
          @click="store.openManager(p.id)"
        >
          Gestionar
        </button>
      </div>
      <ul v-if="!p.bankrupt && propertiesOf(p.id).length" class="mt-1 flex flex-wrap gap-1">
        <li
          v-for="sq in propertiesOf(p.id)"
          :key="sq.position"
          class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]"
          :class="g.properties[sq.position].mortgaged ? 'line-through opacity-60' : ''"
        >
          {{ sq.name }}<template v-if="sq.kind === 'stadium'"> ({{ sq.part === 'general' ? 'G' : 'T' }})</template>
        </li>
      </ul>
    </div>
  </div>
</template>
