<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/match'
import { buildSummary } from '../../engine/summary'
import { AI_PROFILES, type AILevel } from '../../engine/aiProfiles'
import { useMoney } from '../../lib/useMoney'
import PawnIcon from './PawnIcon.vue'

const { money } = useMoney()

/** Fin de partida: ganador, clasificación con el patrimonio de cada jugador y datos curiosos. */
const store = useMatchStore()
const s = computed(() => store.state!)
const summary = computed(() => buildSummary(s.value))
const winner = computed(() => (summary.value.winnerId === null ? null : s.value.players[summary.value.winnerId]))
const levelLabel = (level: string) => AI_PROFILES[level as AILevel]?.label ?? level
const improvements = (p: { seats: number; stands: number }) =>
  [p.seats ? `${p.seats} silla${p.seats === 1 ? '' : 's'}` : '', p.stands ? `${p.stands} tribuna${p.stands === 1 ? '' : 's'}` : '']
    .filter(Boolean)
    .join(' · ') || '—'

const btn = 'rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-slate-50'
const btnPrimary = 'rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700'
</script>

<template>
  <div
    v-if="store.summaryOpen && s.phase === 'gameOver'"
    class="fixed inset-0 z-70 flex items-center justify-center bg-black/55 p-4"
    data-gameover
  >
    <div class="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
      <header class="border-b border-slate-200 p-4 text-center">
        <div class="text-3xl">🏆</div>
        <h2 class="text-xl font-bold">{{ winner ? `Gana ${winner.name}` : 'Fin de la partida' }}</h2>
        <p class="text-sm text-slate-500">
          {{ summary.turns }} turnos · {{ s.players.length }} jugadores
        </p>
      </header>

      <div class="overflow-y-auto p-4">
        <!-- Clasificación -->
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th class="py-1 pr-2">#</th>
              <th class="py-1 pr-2">Jugador</th>
              <th class="py-1 pr-2 text-right">Patrimonio</th>
              <th class="hidden py-1 pr-2 text-right sm:table-cell">Dinero</th>
              <th class="py-1 pr-2 text-right">Concesiones</th>
              <th class="hidden py-1 pr-2 sm:table-cell">Mejoras</th>
              <th class="hidden py-1 text-right md:table-cell">Alquileres (cobrados / pagados)</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in summary.players"
              :key="p.id"
              class="border-b border-slate-100"
              :class="p.eliminated ? 'text-slate-400' : ''"
              :data-rank="p.rank"
            >
              <td class="py-1.5 pr-2 font-semibold">{{ p.rank }}</td>
              <td class="py-1.5 pr-2">
                <span class="flex items-center gap-1.5">
                  <PawnIcon :id="p.id" :px="26" />
                  <span class="font-medium">{{ p.name }}</span>
                  <span v-if="p.ai" class="rounded bg-violet-100 px-1.5 text-[11px] text-violet-800">
                    IA · {{ levelLabel(p.level) }}
                  </span>
                </span>
                <span v-if="p.eliminated" class="text-xs">Eliminado en el turno {{ p.stats.bankruptTurn }}</span>
              </td>
              <td class="py-1.5 pr-2 text-right tabular-nums font-semibold">{{ money(Math.round(p.netWorth)) }}</td>
              <td class="hidden py-1.5 pr-2 text-right tabular-nums sm:table-cell">{{ money(p.cash) }}</td>
              <td class="py-1.5 pr-2 text-right tabular-nums">
                {{ p.properties }}<span v-if="p.mortgaged" class="text-xs text-slate-400"> ({{ p.mortgaged }} hip.)</span>
              </td>
              <td class="hidden py-1.5 pr-2 sm:table-cell">{{ improvements(p) }}</td>
              <td class="hidden py-1.5 text-right tabular-nums md:table-cell">
                {{ money(p.stats.rentReceived) }} / {{ money(p.stats.rentPaid) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="mt-1 text-xs text-slate-400">
          Patrimonio = dinero + concesiones (las hipotecadas, a la mitad) + sillas y tribunas a precio de compra (la tribuna vale cinco sillas).
        </p>

        <!-- Datos curiosos -->
        <section v-if="summary.highlights.length" class="mt-4">
          <h3 class="mb-1 text-sm font-semibold">Datos de la partida</h3>
          <ul class="grid gap-1 text-sm sm:grid-cols-2">
            <li v-for="h in summary.highlights" :key="h.label" class="flex items-center gap-2 rounded bg-slate-50 px-2 py-1">
              <PawnIcon :id="h.playerId" :px="22" />
              <span class="flex-1">
                <span class="text-slate-500">{{ h.label }}: </span>
                <strong> {{ s.players[h.playerId].name }}</strong>
              </span>
              <span class="tabular-nums">{{ h.kind === 'money' ? money(h.value) : h.value }}</span>
            </li>
          </ul>
        </section>
      </div>

      <footer class="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-3">
        <button :class="btn" @click="store.summaryOpen = false">Ver el tablero</button>
        <button :class="btn" @click="store.quit()">Nueva partida</button>
        <button :class="btnPrimary" @click="store.rematch()">Revancha</button>
      </footer>
    </div>
  </div>
</template>
