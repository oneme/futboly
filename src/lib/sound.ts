/**
 * Sonidos sintetizados con Web Audio (no hacen falta archivos de audio).
 * El contexto de audio se crea al primer sonido, que siempre sigue a una acción del usuario.
 */
export type SoundName =
  | 'dice' | 'step' | 'buy' | 'rent' | 'pay' | 'receive' | 'card' | 'jail'
  | 'build' | 'sell' | 'mortgage' | 'trade' | 'bankrupt' | 'win'

const MUTE_KEY = 'futboly-muted'
let muted = false
try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
} catch {
  /* sin localStorage */
}
let ctx: AudioContext | null = null

export const isMuted = () => muted
export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    /* se ignora */
  }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Una nota con envolvente de volumen; `to` hace que la frecuencia se deslice hasta ese valor. */
function tone(c: AudioContext, freq: number, at: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number } = {}) {
  const { type = 'sine', vol = 0.15, to } = opts
  const osc = c.createOscillator()
  const gain = c.createGain()
  const t0 = c.currentTime + at
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** Ráfaga de ruido filtrado (dados, cartas, golpes). */
function noise(c: AudioContext, at: number, dur: number, opts: { vol?: number; freq?: number } = {}) {
  const { vol = 0.12, freq = 1800 } = opts
  const frames = Math.max(1, Math.floor(c.sampleRate * dur))
  const buffer = c.createBuffer(1, frames, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  const t0 = c.currentTime + at
  src.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = freq
  gain.gain.setValueAtTime(vol, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(gain).connect(c.destination)
  src.start(t0)
}

const recipes: Record<SoundName, (c: AudioContext) => void> = {
  dice: (c) => {
    for (let i = 0; i < 7; i++) noise(c, i * 0.08, 0.05, { vol: 0.1, freq: 1400 + (i % 3) * 500 })
    tone(c, 300, 0.58, 0.06, { type: 'triangle', vol: 0.1 })
  },
  step: (c) => tone(c, 620, 0, 0.05, { type: 'triangle', vol: 0.07 }),
  buy: (c) => {
    tone(c, 1175, 0, 0.1, { type: 'triangle' })
    tone(c, 1568, 0.09, 0.3, { type: 'triangle' })
  },
  rent: (c) => tone(c, 520, 0, 0.35, { type: 'sawtooth', vol: 0.1, to: 220 }),
  pay: (c) => tone(c, 420, 0, 0.25, { type: 'square', vol: 0.07, to: 260 }),
  receive: (c) => [523, 659, 784].forEach((f, i) => tone(c, f, i * 0.07, 0.18, { type: 'triangle', vol: 0.13 })),
  card: (c) => {
    noise(c, 0, 0.12, { vol: 0.12, freq: 3200 })
    tone(c, 740, 0.1, 0.12, { type: 'triangle', vol: 0.1 })
  },
  jail: (c) => {
    tone(c, 130, 0, 0.55, { type: 'square', vol: 0.1 })
    tone(c, 98, 0.05, 0.55, { type: 'square', vol: 0.08 })
  },
  build: (c) => {
    tone(c, 150, 0, 0.15, { vol: 0.25, to: 55 })
    noise(c, 0, 0.06, { vol: 0.15, freq: 900 })
  },
  sell: (c) => tone(c, 330, 0, 0.2, { type: 'triangle', vol: 0.12, to: 200 }),
  mortgage: (c) => {
    tone(c, 262, 0, 0.18, { type: 'triangle', vol: 0.12 })
    tone(c, 196, 0.16, 0.25, { type: 'triangle', vol: 0.12 })
  },
  trade: (c) => {
    tone(c, 660, 0, 0.12, { type: 'triangle', vol: 0.12 })
    tone(c, 880, 0.12, 0.18, { type: 'triangle', vol: 0.12 })
  },
  bankrupt: (c) => [392, 349, 311, 262].forEach((f, i) => tone(c, f, i * 0.2, 0.3, { type: 'sawtooth', vol: 0.09 })),
  win: (c) => {
    ;[523, 659, 784].forEach((f, i) => tone(c, f, i * 0.14, 0.2, { type: 'triangle', vol: 0.16 }))
    tone(c, 1047, 0.45, 0.7, { type: 'triangle', vol: 0.18 })
  },
}

export function playSound(name: SoundName) {
  if (muted) return
  try {
    const c = audio()
    if (c) recipes[name](c)
  } catch {
    /* el audio nunca debe romper la partida */
  }
}
