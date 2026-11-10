import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import * as engine from '../engine/game'
import * as mgmt from '../engine/management'
import type { GameState } from '../engine/game'
import type { TradeOffer } from '../engine/management'

const SAVE_KEY = 'futboly-save'

/** Envuelve el motor puro en un store reactivo. El motor muta el estado; Vue detecta los cambios. */
export const useMatchStore = defineStore('match', () => {
  const state = ref<GameState | null>(null)

  const current = computed(() => (state.value ? state.value.players[state.value.current] : null))
  const hasSavedGame = ref(!!localStorage.getItem(SAVE_KEY))
  /** Jugador cuyo gestor de propiedades está abierto (null = cerrado). Solo estado de interfaz. */
  const managing = ref<number | null>(null)

  const g = (): GameState => {
    if (!state.value) throw new Error('No hay partida en curso')
    return state.value
  }

  // Guardado automático en el navegador.
  watch(
    state,
    (v) => {
      try {
        v ? localStorage.setItem(SAVE_KEY, JSON.stringify(v)) : localStorage.removeItem(SAVE_KEY)
        hasSavedGame.value = !!v
      } catch {
        /* sin espacio o modo privado: se ignora */
      }
    },
    { deep: true },
  )

  function start(names: string[]) {
    state.value = engine.createGame(names)
  }
  function continueSaved() {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) state.value = JSON.parse(raw) as GameState
  }
  function quit() {
    state.value = null
    managing.value = null
  }
  const openManager = (id: number) => (managing.value = id)
  const closeManager = () => (managing.value = null)

  return {
    state,
    current,
    hasSavedGame,
    start,
    continueSaved,
    quit,
    // Turno
    roll: () => engine.roll(g()),
    endTurn: () => engine.endTurn(g()),
    buy: () => engine.buy(g()),
    declineBuy: () => engine.declineBuy(g()),
    resolveAuction: (winner: number | null, price: number) => engine.resolveAuction(g(), winner, price),
    // Cartas y Banquillo
    resolveCard: () => engine.resolveCard(g()),
    chooseRisk: (drawSurprise: boolean) => engine.chooseRisk(g(), drawSurprise),
    payJailFine: () => engine.payJailFine(g()),
    useJailCard: () => engine.useJailCard(g()),
    // Deudas
    settleDebt: () => engine.settleDebt(g()),
    declareBankruptcy: () => engine.declareBankruptcy(g()),
    // Gestor de propiedades
    managing,
    openManager,
    closeManager,
    // Gestión: cada can... devuelve null (se puede) o el motivo en español
    canBuildSeat: (pid: number, pos: number) => mgmt.canBuildSeat(g(), pid, pos),
    canBuildStand: (pid: number, pos: number) => mgmt.canBuildStand(g(), pid, pos),
    canSellSeat: (pid: number, pos: number) => mgmt.canSellSeat(g(), pid, pos),
    canSellStands: (pid: number, pos: number) => mgmt.canSellStands(g(), pid, pos),
    canMortgage: (pid: number, pos: number) => mgmt.canMortgage(g(), pid, pos),
    canUnmortgage: (pid: number, pos: number) => mgmt.canUnmortgage(g(), pid, pos),
    canTrade: (offer: TradeOffer) => mgmt.canTrade(g(), offer),
    canSellJailCard: (from: number, to: number, index: number, price: number) =>
      mgmt.canSellJailCard(g(), from, to, index, price),
    buildSeat: (pid: number, pos: number) => mgmt.buildSeat(g(), pid, pos),
    buildStand: (pid: number, pos: number) => mgmt.buildStand(g(), pid, pos),
    sellSeat: (pid: number, pos: number) => mgmt.sellSeat(g(), pid, pos),
    sellStands: (pid: number, pos: number) => mgmt.sellStands(g(), pid, pos),
    mortgage: (pid: number, pos: number) => mgmt.mortgage(g(), pid, pos),
    unmortgage: (pid: number, pos: number) => mgmt.unmortgage(g(), pid, pos),
    trade: (offer: TradeOffer) => mgmt.trade(g(), offer),
    sellJailCard: (from: number, to: number, index: number, price: number) =>
      mgmt.sellJailCard(g(), from, to, index, price),
  }
})
