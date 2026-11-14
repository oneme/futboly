<script setup lang="ts">
import { computed } from 'vue'
import { useMoney } from '../../lib/useMoney'
import { imageUrl } from '../../lib/assets'
import type { PropertyState } from '../../engine/game'
import type { PropertySquare } from '../../engine/types'
import TeamColorsTop from './TeamColorsTop.vue'
import TeamColorsBottom from './TeamColorsBottom.vue'

const { money } = useMoney()

/**
 * Tarjeta con los precios de una concesión (título de propiedad), que aparece al pasar el ratón
 * por encima de la casilla. Mantiene el diseño de StadiumCard, DealershipCard y ClubServiceCard.
 */
const props = defineProps<{ sq: PropertySquare; state?: PropertyState; ownerName?: string }>()

const cardBg = computed(() =>
  props.sq.kind === 'stadium' ? '' : `background-image: url('${imageUrl(props.sq.cardImage)}')`,
)
const detail = computed(() => {
  const s = props.state
  if (!s) return ''
  const parts: string[] = []
  if (props.sq.kind === 'stadium') parts.push(s.stand ? 'con tribuna' : s.seats ? `${s.seats} silla${s.seats === 1 ? '' : 's'}` : 'sin sillas')
  if (s.mortgaged) parts.push('hipotecada')
  return parts.join(' · ')
})
</script>

<template>
  <div class="w-75 text-sm shadow-2xl">
    <!-- Estadio (General / Tribuna) -->
    <div v-if="sq.kind === 'stadium'" class="rounded-sm bg-orange-200 p-2">
      <div class="flex flex-col border border-black p-1">
        <p class="mb-1 text-center uppercase">título de propiedad</p>
        <TeamColorsTop :sq="sq" />
        <p class="mt-6 text-center capitalize">{{ sq.part === 'general' ? 'general' : 'tribuna' }}</p>
        <p class="text-center uppercase">{{ sq.name }}</p>
        <div class="my-4">
          <p class="uppercase">alquileres:</p>
          <div v-for="(label, i) in sq.rentLabels" :key="i" class="flex items-center justify-between">
            <p class="capitalize">{{ label }}</p>
            <p>{{ money(sq.rents[i]) }}</p>
          </div>
          <p class="uppercase">precio de compra:</p>
          <div class="flex items-center justify-between">
            <p>De cada silla</p>
            <p>{{ money(sq.buildCost) }}</p>
          </div>
          <div class="flex items-center justify-between">
            <p>De la Tribuna</p>
            <p>{{ money(sq.buildCost) }}</p>
          </div>
          <div class="flex items-center justify-between">
            <p class="uppercase">valor hipotecario de la concesion</p>
            <p>{{ money(sq.mortgage) }}</p>
          </div>
        </div>
        <TeamColorsBottom :sq="sq" />
      </div>
    </div>

    <!-- Servicios de estadio (Almohadillas, Gorras, Bares, Publicidad) -->
    <div
      v-else-if="sq.kind === 'stadiumService'"
      class="rounded-sm bg-white bg-contain bg-center bg-no-repeat p-2"
      :style="cardBg"
    >
      <div class="flex flex-col rounded-sm border border-black p-1">
        <h1 class="text-center uppercase">servicios estadio</h1>
        <h1 class="text-center font-semibold uppercase">{{ sq.name }}</h1>
        <hr class="mx-2 my-4 bg-black" />
        <p class="my-4 px-2 uppercase">alquileres:</p>
        <div v-for="(label, i) in sq.rentLabels" :key="i" class="flex items-center justify-between px-2">
          <p class="capitalize">{{ label }}</p>
          <p>{{ money(sq.rentByOwned[i]) }}</p>
        </div>
        <h1 class="my-6 text-center font-semibold uppercase">{{ sq.name }}</h1>
        <div class="mb-8 mt-2 flex items-end justify-between px-2">
          <p class="uppercase">valor hipotecario de la concesion:</p>
          <p>{{ money(sq.mortgage) }}</p>
        </div>
        <h1 class="text-center uppercase">servicios estadio</h1>
      </div>
    </div>

    <!-- Servicios de club (Material Deportivo, Autocares) -->
    <div v-else class="rounded-sm bg-white bg-contain bg-center bg-no-repeat p-2" :style="cardBg">
      <div class="flex flex-col rounded-sm border border-black p-1">
        <h1 class="mt-4 text-center font-semibold uppercase">{{ sq.name }}</h1>
        <hr class="mx-2 my-4 bg-black" />
        <p class="my-4 px-2 uppercase">alquileres:</p>
        <div v-for="(label, i) in sq.rentLabels" :key="i" class="w-10/12 px-2">
          <p class="whitespace-pre-line">{{ `${label} ${money(sq.diceMultiplierByOwned[i])}` }}</p>
        </div>
        <h1 class="mb-2 mt-8 text-center font-semibold uppercase">{{ sq.name }}</h1>
        <div class="mb-20 flex items-end justify-between px-2">
          <p class="uppercase">valor hipotecario de la concesion:</p>
          <p>{{ money(sq.mortgage) }}</p>
        </div>
      </div>
    </div>

    <!-- Estado actual de la concesión en la partida -->
    <div v-if="ownerName" class="rounded-b bg-slate-800 px-2 py-1 text-xs text-white">
      Propietario: <strong>{{ ownerName }}</strong><template v-if="detail"> · {{ detail }}</template>
    </div>
    <div v-else class="rounded-b bg-slate-800 px-2 py-1 text-xs text-white">Libre · {{ money(sq.price) }}</div>
  </div>
</template>
