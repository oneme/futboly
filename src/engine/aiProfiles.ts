/**
 * Niveles de la IA. Cada nivel es un conjunto de parámetros que usan `ai.ts` y `trading.ts`:
 *  - fácil: conservadora y despistada; puja poco, construye tarde, falla a menudo y acepta tratos que le perjudican.
 *  - normal: juega bien pero con algo de colchón de más y despistes ocasionales.
 *  - difícil: no se despista, construye pronto y ajusta su colchón de dinero al peligro que tiene delante.
 */
export type AILevel = 'easy' | 'normal' | 'hard'

export interface AIProfile {
  label: string
  /** Dinero que intenta conservar tras comprar / completando un grupo / construyendo / levantando hipotecas. */
  reserve: number
  completeReserve: number
  buildReserve: number
  unmortgageReserve: number
  /** Dinero a partir del cual paga la multa del Banquillo en vez de intentar sacar doble. */
  jailFinePayAt: number
  /** Probabilidad de equivocarse: rechazar una compra posible o no construir cuando podría. */
  skipBuyChance: number
  skipBuildChance: number
  /** Subastas: multiplicador de su valoración, ruido aleatorio (±) y valor de completar grupo (x precio). */
  bidFactor: number
  bidNoise: number
  completeBonus: number
  /** Tratos: valor de un grupo completo, beneficio mínimo (fijo y % del valor), castigo por ayudar al rival. */
  groupBonus: number
  minGain: number
  minGainPct: number
  rivalPenalty: number
  /** Si es true, el colchón de dinero crece con el mayor alquiler que puede pagar en las próximas 12 casillas. */
  dangerAware: boolean
  /** Probabilidad de intentar proponer un trato en un turno, y cuánto ofrece a un humano (x precio). */
  proposeChance: number
  humanOfferMult: number
}

/**
 * Valores ajustados jugando miles de partidas IA contra IA (ver scripts/test-levels.ts):
 * la normal gana a la fácil ~84 % de las veces y la difícil a la normal ~64 %.
 */
export const AI_PROFILES: Record<AILevel, AIProfile> = {
  easy: {
    label: 'Fácil',
    reserve: 60_000, completeReserve: 15_000, buildReserve: 100_000, unmortgageReserve: 150_000,
    jailFinePayAt: 200_000,
    skipBuyChance: 0.3, skipBuildChance: 0.5,
    bidFactor: 0.6, bidNoise: 0.35, completeBonus: 1.2,
    groupBonus: 1.0, minGain: 0, minGainPct: 0, rivalPenalty: 0,
    dangerAware: false, proposeChance: 0.15, humanOfferMult: 3.0,
  },
  normal: {
    label: 'Normal',
    reserve: 25_000, completeReserve: 5_000, buildReserve: 45_000, unmortgageReserve: 50_000,
    jailFinePayAt: 80_000,
    skipBuyChance: 0.08, skipBuildChance: 0.15,
    bidFactor: 1, bidNoise: 0.25, completeBonus: 1.5,
    groupBonus: 1.5, minGain: 1_000, minGainPct: 0.04, rivalPenalty: 0.3,
    dangerAware: false, proposeChance: 1, humanOfferMult: 1.8,
  },
  hard: {
    label: 'Difícil',
    reserve: 15_000, completeReserve: 2_000, buildReserve: 12_000, unmortgageReserve: 50_000,
    jailFinePayAt: 65_000,
    skipBuyChance: 0, skipBuildChance: 0,
    bidFactor: 1, bidNoise: 0.1, completeBonus: 1.6,
    groupBonus: 1.5, minGain: 1_000, minGainPct: 0.04, rivalPenalty: 0.35,
    dangerAware: true, proposeChance: 1, humanOfferMult: 1.5,
  },
}

export const AI_LEVELS: AILevel[] = ['easy', 'normal', 'hard']
