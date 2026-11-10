<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useMatchStore } from '../stores/match'
import BoardView from '../components/game/BoardView.vue'
import ActionPanel from '../components/game/ActionPanel.vue'
import PlayersPanel from '../components/game/PlayersPanel.vue'
import ManagerDialog from '../components/game/ManagerDialog.vue'
import { logoUrl, titleUrl } from '../lib/assets'

const store = useMatchStore()
const names = ref(['Jugador 1', 'Jugador 2'])
const canAdd = computed(() => names.value.length < 6)
const canStart = computed(() => names.value.length >= 2 && names.value.every((n) => n.trim()))

const addPlayer = () => names.value.push(`Jugador ${names.value.length + 1}`)
const removePlayer = (i: number) => names.value.splice(i, 1)
const start = () => store.start(names.value.map((n) => n.trim()))

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
    <p class="text-center text-slate-600">De 2 a 6 jugadores en el mismo dispositivo.</p>

    <div v-for="(_, i) in names" :key="i" class="flex gap-2">
      <input v-model="names[i]" class="flex-1 rounded-md border border-slate-300 px-3 py-1.5" maxlength="20" />
      <button
        v-if="names.length > 2"
        class="rounded-md border border-slate-300 px-3 hover:bg-slate-50"
        @click="removePlayer(i)"
      >
        ✕
      </button>
    </div>

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
  <div v-else class="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <BoardView>
      <ActionPanel />
    </BoardView>

    <aside class="flex min-h-0 flex-col gap-3">
      <PlayersPanel />
      <div
        ref="logBox"
        class="max-h-72 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700"
      >
        <p v-for="(line, i) in log" :key="i" class="py-0.5">{{ line }}</p>
      </div>
      <button class="self-start text-xs text-slate-500 underline" @click="store.quit()">Abandonar partida</button>
    </aside>

    <ManagerDialog />
  </div>
</template>
