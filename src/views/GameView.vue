<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMatchStore } from '../stores/match'
import BoardView from '../components/game/BoardView.vue'
import ActionPanel from '../components/game/ActionPanel.vue'
import PlayersPanel from '../components/game/PlayersPanel.vue'
import ManagerDialog from '../components/game/ManagerDialog.vue'
import PawnIcon from '../components/game/PawnIcon.vue'
import TradeProposalDialog from '../components/game/TradeProposalDialog.vue'
import GameOverDialog from '../components/game/GameOverDialog.vue'
import { AI_LEVELS, AI_PROFILES, type AILevel } from '../engine/aiProfiles'
import { SIDEBAR_BASE_WIDTH, uiZoom } from '../lib/boardGeometry'
import { DEFAULT_INFLATION } from '../lib/currency'
import { useMoney } from '../lib/useMoney'
import { useSettingsStore } from '../stores/settings'
import { logoUrl, titleUrl } from '../lib/assets'

const store = useMatchStore()
const settings = useSettingsStore()
const { logLine } = useMoney()

const chip = 'rounded border px-2 py-0.5'
const chipOn = 'border-emerald-600 bg-emerald-600 text-white'
const chipOff = 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'

// En pantallas grandes el panel lateral crece (zoom) y el ancho de la página ya no se limita.
const zoom = ref(uiZoom(window.innerWidth))
const onResize = () => (zoom.value = uiZoom(window.innerWidth))
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
const gridStyle = computed(() => ({ '--side-w': `${SIDEBAR_BASE_WIDTH * zoom.value}px` }))
const players = ref<{ name: string; ai: boolean; level: AILevel }[]>([
  { name: 'Jugador 1', ai: false, level: 'normal' },
  { name: 'Jugador 2', ai: true, level: 'normal' },
])
const tradeOnlyWhenBankEmpty = ref(false)
const canAdd = computed(() => players.value.length < 6)
const canStart = computed(() => players.value.length >= 2 && players.value.every((p) => p.name.trim()))

const addPlayer = () => players.value.push({ name: `Jugador ${players.value.length + 1}`, ai: true, level: 'normal' })
const removePlayer = (i: number) => players.value.splice(i, 1)
const start = () =>
  store.start(
    players.value.map((p) => ({ name: p.name.trim(), ai: p.ai, level: p.level })),
    { tradeOnlyWhenBankEmpty: tradeOnlyWhenBankEmpty.value },
  )

// Registro de eventos con scroll automático al final.
const logBox = ref<HTMLElement | null>(null)
const log = computed(() => (store.state ? store.state.log.slice(-60) : []))
watch(
  () => store.state?.log.length,
  async () => {
    await nextTick()
    if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight
  },
)
</script>

<template>
  <!-- Pantalla de inicio -->
  <div v-if="!store.state" class="mx-auto flex max-w-md flex-col gap-4 p-6">
    <img v-if="titleUrl()" :src="titleUrl()" alt="Futboly" class="mx-auto w-full max-w-xs" />
    <h1 v-else class="text-3xl font-extrabold tracking-tight">FUTBOLY</h1>
    <p class="text-center text-white">De 2 a 6 jugadores en el mismo dispositivo; marca "IA" para los que juegue la máquina.</p>

    <div v-for="(player, i) in players" :key="i" class="flex items-center gap-2">
      <PawnIcon :id="i" :px="32" />
      <input v-model="player.name" class="flex-1 rounded-md border border-slate-300 px-3 py-1.5" maxlength="20" />
      <label class="flex items-center gap-1 text-sm text-white" title="Jugador controlado por la máquina">
        <input v-model="player.ai" type="checkbox" /> IA
      </label>
      <select
        v-if="player.ai"
        v-model="player.level"
        class="rounded-md border border-slate-300 bg-white px-1 py-1 text-sm"
        title="Nivel de la IA"
        data-level
      >
        <option v-for="level in AI_LEVELS" :key="level" :value="level">{{ AI_PROFILES[level].label }}</option>
      </select>
      <button
        v-if="players.length > 2"
        class="rounded-md border border-slate-300 px-3 hover:bg-slate-50"
        @click="removePlayer(i)"
      >
        ✕
      </button>
    </div>

    <label class="flex items-start gap-2 text-sm text-white">
      <input v-model="tradeOnlyWhenBankEmpty" type="checkbox" class="mt-0.5" />
      <span>
        Regla del manual: solo se puede intercambiar cuando la Banca ya no tiene concesiones
        <span class="text-green-100">(sin marcar, se puede intercambiar siempre)</span>
      </span>
    </label>

    <label class="flex items-start gap-2 text-sm text-white">
      <input v-model="settings.euros" type="checkbox" class="mt-0.5" />
      <span>
        Mostrar los importes en euros con inflación
        <span class="text-green-100">(sin marcar, en pesetas)</span>
      </span>
    </label>
    <label v-if="settings.euros" class="flex items-center gap-2 pl-6 text-sm text-white">
      Coeficiente de inflación
      <input
        v-model.number="settings.inflation"
        type="number"
        min="0"
        step="0.01"
        class="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900"
      />
      <span class="text-green-100">(por defecto {{ DEFAULT_INFLATION }})</span>
    </label>

    <div class="flex flex-wrap gap-2">
      <button
        class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
        :disabled="!canAdd"
        @click="addPlayer"
      >
        + Añadir jugador
      </button>
      <button
        class="rounded-md bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        :disabled="!canStart"
        @click="start"
      >
        Empezar partida
      </button>
      <button
        v-if="store.hasSavedGame"
        class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        @click="store.continueSaved()"
      >
        Continuar partida guardada
      </button>
    </div>
    <img v-if="logoUrl()" :src="logoUrl()" alt="Borrás" class="mx-auto mt-4 h-10 w-auto opacity-80" />
  </div>

  <!-- Partida -->
  <div v-else class="grid w-full gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_var(--side-w)]" :style="gridStyle">
    <BoardView>
      <ActionPanel />
    </BoardView>

    <aside class="flex min-h-0 w-full flex-col gap-3 lg:w-[320px]" :style="{ zoom }">
      <PlayersPanel />
      <div
        ref="logBox"
        class="max-h-72 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700"
      >
        <p v-for="(line, i) in log" :key="i" class="py-0.5">{{ logLine(line) }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white p-2 text-xs text-slate-900" data-currency>
        <span class="font-medium">Importes:</span>
        <button type="button" :class="[chip, !settings.euros ? chipOn : chipOff]" @click="settings.euros = false">Ptas.</button>
        <button type="button" :class="[chip, settings.euros ? chipOn : chipOff]" @click="settings.euros = true">€ con inflación</button>
        <label v-if="settings.euros" class="flex items-center gap-1">
          Coef.
          <input
            v-model.number="settings.inflation"
            type="number"
            min="0"
            step="0.01"
            class="w-16 rounded border border-slate-300 px-1 py-0.5 text-slate-900"
            title="Coeficiente de inflación: el importe se multiplica por (1 + coeficiente)"
          />
        </label>
        <p v-if="settings.euros" class="w-full text-[11px] text-slate-500">
          € = ptas ÷ 166,386 × (1 + coef.). Las cifras impresas en las imágenes de las casillas siguen en pesetas.
        </p>
      </div>
      <div class="flex items-center gap-4">
        <button class="text-xs text-white underline" @click="store.quit()">Abandonar partida</button>
        <button
          class="rounded border border-slate-300 px-2 py-0.5 text-sm hover:bg-slate-50"
          :title="store.muted ? 'Activar sonido' : 'Silenciar'"
          @click="store.toggleMute()"
        >
          {{ store.muted ? '🔇' : '🔊' }}
        </button>
      </div>
    </aside>

    <ManagerDialog />
    <TradeProposalDialog />
    <GameOverDialog />
  </div>
</template>
