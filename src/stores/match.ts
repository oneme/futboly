import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import * as engine from '../engine/game'
import * as mgmt from '../engine/management'
import { actor, aiStep } from '../engine/ai'
import * as trading from '../engine/trading'
import type { GameEventType, GameRules, GameState, PlayerSpec } from '../engine/game'
import { DEFAULT_RULES } from '../engine/game'
import type { TradeOffer } from '../engine/management'
import { nextPawnStep } from '../lib/pawnPath'
import { isMuted, playSound, setMuted, type SoundName } from '../lib/sound'

const SAVE_KEY = 'futboly-save'
const TEST = import.meta.env.MODE === 'test'
/** Milisegundos por casilla en la animación de los peones y entre acciones de una IA. */
const STEP_MS = TEST ? 0 : 170
const AI_DELAY_MS = TEST ? 0 : 800

/** Qué sonido corresponde a cada suceso del motor. */
const SOUND_FOR: Record<GameEventType, SoundName> = {
  dice: 'dice', buy: 'buy', rent: 'rent', pay: 'pay', receive: 'receive', card: 'card', jail: 'jail',
  build: 'build', sell: 'sell', mortgage: 'mortgage', trade: 'trade', bankrupt: 'bankrupt', win: 'win',
}

/** Envuelve el motor puro en un store reactivo. El motor muta el estado; Vue detecta los cambios. */
export const useMatchStore = defineStore('match', () => {
  const state = ref<GameState | null>(null)
  const hasSavedGame = ref(!!localStorage.getItem(SAVE_KEY))
  /** Jugador cuyo gestor de propiedades está abierto (null = cerrado). Solo estado de interfaz. */
  const managing = ref<number | null>(null)
  const muted = ref(isMuted())

  /** Casilla que se está mostrando de cada peón (va por detrás de la real mientras se anima). */
  const shown = ref<Record<number, number>>({})
  const moving = ref(false)

  const current = computed(() => (state.value ? state.value.players[state.value.current] : null))
  /** Jugador al que le toca decidir ahora (el del turno, el de la subasta o el deudor). */
  const actingPlayer = computed(() => (state.value ? state.value.players[actor(state.value)] : null))
  /** True si decide una IA (o si hay que cerrar el turno de un jugador eliminado). */
  const aiActing = computed(() => {
    const s = state.value
    if (!s || s.phase === 'gameOver') return false
    const p = s.players[actor(s)]
    if (s.proposal) return false // la IA espera la respuesta del humano
    return !!p && (p.ai || (s.phase === 'endTurn' && p.bankrupt))
  })

  const g = (): GameState => {
    if (!state.value) throw new Error('No hay partida en curso')
    return state.value
  }

  // ---------- Guardado automático ----------
  // Cada acción del motor deja una línea en el registro, así que basta vigilar eso (no todo el estado)
  // y guardar como mucho cada 400 ms.
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    saveTimer = undefined
    try {
      state.value ? localStorage.setItem(SAVE_KEY, JSON.stringify(state.value)) : localStorage.removeItem(SAVE_KEY)
      hasSavedGame.value = !!state.value
    } catch {
      /* sin espacio o modo privado: se ignora */
    }
  }
  watch(
    () => (state.value ? [state.value.log.length, state.value.phase, state.value.current].join('|') : null),
    () => {
      if (!state.value) save()
      else if (!saveTimer) saveTimer = setTimeout(save, 400)
    },
  )

  // ---------- Animación de los peones ----------
  let moveTimer: ReturnType<typeof setTimeout> | undefined
  let pendingSounds: SoundName[] = []

  function stepPawns() {
    moveTimer = undefined
    const s = state.value
    if (!s) return
    let any = false
    for (const p of s.players) {
      const cur = shown.value[p.id] ?? p.position
      if (cur === p.position) continue
      const next = STEP_MS === 0 ? p.position : nextPawnStep(cur, p.position)
      shown.value[p.id] = next
      if (next !== p.position) playSound('step')
      any = any || next !== p.position
    }
    if (any) {
      moveTimer = setTimeout(stepPawns, STEP_MS)
    } else {
      moving.value = false
      const sounds = pendingSounds
      pendingSounds = []
      sounds.forEach((name, i) => setTimeout(() => playSound(name), i * 260))
      scheduleAI()
    }
  }
  function startMoving() {
    const s = state.value
    if (!s || moveTimer) return
    if (s.players.some((p) => (shown.value[p.id] ?? p.position) !== p.position)) {
      moving.value = true
      stepPawns()
    }
  }
  const syncShown = () => {
    shown.value = Object.fromEntries(g().players.map((p) => [p.id, p.position]))
    moving.value = false
  }
  watch(() => state.value?.players.map((p) => p.position).join(','), startMoving)

  // ---------- Sonidos ----------
  let soundCursor = 0
  watch(
    () => state.value?.eventCount,
    (count) => {
      const s = state.value
      if (!s || count === undefined) return
      const fresh = s.events.slice(-Math.min(s.events.length, count - soundCursor))
      soundCursor = count
      for (const ev of fresh) {
        const name = SOUND_FOR[ev]
        // Los dados suenan al instante; el resto espera a que el peón llegue a su casilla.
        if (ev === 'dice' || !moving.value) playSound(name)
        else pendingSounds.push(name)
      }
    },
  )
  function toggleMute() {
    muted.value = !muted.value
    setMuted(muted.value)
  }

  // ---------- Jugadores controlados por la máquina ----------
  let aiTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleAI() {
    if (aiTimer || moving.value || !aiActing.value) return
    aiTimer = setTimeout(() => {
      aiTimer = undefined
      if (!state.value || moving.value) return
      aiStep(state.value)
      scheduleAI()
    }, AI_DELAY_MS)
  }
  // Cualquier cambio de fase, turno o subasta puede dejar a una IA con algo que hacer.
  watch(
    () => {
      const s = state.value
      return s && [s.phase, s.current, s.auction?.turn, s.auction?.bid, s.debt?.debtor, !!s.proposal, s.eventCount, s.log.length].join('|')
    },
    scheduleAI,
  )

  // ---------- Ciclo de la partida ----------
  function start(players: (string | PlayerSpec)[], rules: Partial<GameRules> = {}) {
    state.value = engine.createGame(players, undefined, undefined, rules)
    save()
    soundCursor = 0
    pendingSounds = []
    syncShown()
    scheduleAI()
  }
  function continueSaved() {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return
    const s = JSON.parse(raw) as GameState
    // Partidas guardadas con versiones anteriores del motor.
    s.events ??= []
    s.rules = { ...DEFAULT_RULES, ...s.rules }
    s.proposal ??= null
    s.turnCount ??= 0
    s.tradeCooldown ??= {}
    s.eventCount ??= 0
    for (const p of s.players) p.ai ??= false
    if (s.auction && !('bid' in s.auction)) s.auction = null
    state.value = s
    soundCursor = s.eventCount
    pendingSounds = []
    syncShown()
    scheduleAI()
  }
  function quit() {
    state.value = null
    save()
    managing.value = null
    moving.value = false
    clearTimeout(aiTimer)
    clearTimeout(moveTimer)
    aiTimer = moveTimer = undefined
  }
  const openManager = (id: number) => (managing.value = id)
  const closeManager = () => (managing.value = null)

  return {
    state,
    current,
    actingPlayer,
    aiActing,
    hasSavedGame,
    shown,
    moving,
    muted,
    toggleMute,
    start,
    continueSaved,
    quit,
    // Turno
    roll: () => engine.roll(g()),
    endTurn: () => engine.endTurn(g()),
    buy: () => engine.buy(g()),
    declineBuy: () => engine.declineBuy(g()),
    auctionBid: (amount: number) => engine.auctionBid(g(), amount),
    auctionPass: () => engine.auctionPass(g()),
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
    /** Un humano ofrece un trato a una IA: devuelve true si lo acepta. */
    proposeToAI: (offer: TradeOffer) => trading.proposeTrade(g(), offer),
    /** El humano responde a la propuesta de una IA. */
    answerProposal: (accept: boolean) => trading.answerProposal(g(), accept),
    sellJailCard: (from: number, to: number, index: number, price: number) =>
      mgmt.sellJailCard(g(), from, to, index, price),
  }
})
