<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/match'
import { isProperty } from '../../engine/game'
import { unmortgageCost } from '../../engine/management'
import { fmt } from '../../lib/colors'
import { chairUrl, tribuneUrl } from '../../lib/assets'
import type { PropertySquare, StadiumSquare } from '../../engine/types'

const props = defineProps<{ pid: number }>()
const store = useMatchStore()
const g = computed(() => store.state!)

const btn =
  'rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

/** Propiedades del jugador agrupadas: un grupo por equipo, más servicios de estadio y de club. */
const groups = computed(() => {
  const mine = g.value.board.filter(
    (sq): sq is PropertySquare => isProperty(sq) && g.value.properties[sq.position].owner === props.pid,
  )
  const result: { title: string; squares: PropertySquare[] }[] = []
  const add = (title: string, sq: PropertySquare) => {
    const grp = result.find((r) => r.title === title)
    grp ? grp.squares.push(sq) : result.push({ title, squares: [sq] })
  }
  for (const sq of mine) {
    if (sq.kind === 'stadium') add(`${sq.team} · ${sq.name}`, sq)
    else add(sq.kind === 'stadiumService' ? 'Servicios de estadio' : 'Servicios de club', sq)
  }
  return result
})

const status = (sq: PropertySquare) => {
  const ps = g.value.properties[sq.position]
  const parts: string[] = []
  if (sq.kind === 'stadium') parts.push(ps.stand ? 'Tribuna' : `${ps.seats} asiento${ps.seats === 1 ? '' : 's'}`)
  if (ps.mortgaged) parts.push('hipotecada')
  return parts.join(' · ')
}

/** Lo que cobraría al vender todas las tribunas (y asientos sueltos) del equipo. */
const standsSale = (sq: StadiumSquare) =>
  g.value.board
    .filter((x): x is StadiumSquare => x.kind === 'stadium' && x.team === sq.team)
    .reduce((sum, x) => {
      const ps = g.value.properties[x.position]
      return sum + (ps.stand ? 2.5 * x.buildCost : (ps.seats * x.buildCost) / 2)
    }, 0)

const reason = (r: string | null) => r ?? ''
</script>

<template>
  <p v-if="!groups.length" class="py-6 text-center text-sm text-slate-500">Este jugador no tiene concesiones.</p>

  <div v-else class="flex flex-col gap-2">
    <section v-for="grp in groups" :key="grp.title" class="rounded-lg border border-slate-200 p-2">
      <h3 class="mb-1 text-sm font-semibold">{{ grp.title }}</h3>

      <div
        v-for="sq in grp.squares"
        :key="sq.position"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 py-1 first:border-t-0"
      >
        <div class="min-w-36">
          <div class="text-sm">
            {{ sq.name }}
            <span v-if="sq.kind === 'stadium'" class="text-slate-500">({{ sq.part === 'general' ? 'General' : 'Tribuna' }})</span>
          </div>
          <div class="text-xs text-slate-500">{{ status(sq) || 'sin mejoras' }}</div>
        </div>

        <div class="ml-auto flex flex-wrap justify-end gap-1">
          <template v-if="sq.kind === 'stadium'">
            <button
              :class="btn"
              :disabled="!!store.canBuildSeat(pid, sq.position)"
              :title="reason(store.canBuildSeat(pid, sq.position))"
              @click="store.buildSeat(pid, sq.position)"
            >
              <img v-if="chairUrl('bottom')" :src="chairUrl('bottom')" class="mr-1 inline h-4 w-auto" alt="" />+ Asiento ({{ fmt(sq.buildCost) }})
            </button>
            <button
              :class="btn"
              :disabled="!!store.canBuildStand(pid, sq.position)"
              :title="reason(store.canBuildStand(pid, sq.position))"
              @click="store.buildStand(pid, sq.position)"
            >
              <img v-if="tribuneUrl('bottom')" :src="tribuneUrl('bottom')" class="mr-1 inline h-4 w-auto" alt="" />+ Tribuna ({{ fmt(sq.buildCost) }})
            </button>
            <button
              :class="btn"
              :disabled="!!store.canSellSeat(pid, sq.position)"
              :title="reason(store.canSellSeat(pid, sq.position))"
              @click="store.sellSeat(pid, sq.position)"
            >
              − Asiento (+{{ fmt(sq.buildCost / 2) }})
            </button>
            <button
              :class="btn"
              :disabled="!!store.canSellStands(pid, sq.position)"
              :title="reason(store.canSellStands(pid, sq.position))"
              @click="store.sellStands(pid, sq.position)"
            >
              Vender tribunas (+{{ fmt(standsSale(sq)) }})
            </button>
          </template>

          <button
            v-if="!g.properties[sq.position].mortgaged"
            :class="btn"
            :disabled="!!store.canMortgage(pid, sq.position)"
            :title="reason(store.canMortgage(pid, sq.position))"
            @click="store.mortgage(pid, sq.position)"
          >
            Hipotecar (+{{ fmt(sq.mortgage) }})
          </button>
          <button
            v-else
            :class="btn"
            :disabled="!!store.canUnmortgage(pid, sq.position)"
            :title="reason(store.canUnmortgage(pid, sq.position))"
            @click="store.unmortgage(pid, sq.position)"
          >
            Levantar hipoteca (−{{ fmt(unmortgageCost(sq)) }})
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
