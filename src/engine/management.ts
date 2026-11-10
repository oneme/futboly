import { isProperty, type GameState } from './game'
import type { PropertySquare, StadiumSquare } from './types'

/**
 * Gestión de propiedades: asientos, tribunas, hipotecas e intercambios.
 * Cada acción tiene un `can…` que devuelve null (se puede) o el motivo en español,
 * para que la interfaz pueda desactivar botones y mostrar el porqué.
 */
type Check = string | null

const MANAGE_PHASES = ['roll', 'buy', 'endTurn']
const money = (n: number) => n.toLocaleString('es-ES')

// ---------- Utilidades ----------

const stadiumAt = (s: GameState, pos: number): StadiumSquare | null => {
  const sq = s.board[pos]
  return sq?.kind === 'stadium' ? sq : null
}
const groupOf = (s: GameState, sq: StadiumSquare) =>
  s.board.filter((x): x is StadiumSquare => x.kind === 'stadium' && x.team === sq.team)
/** 0..4 asientos, 5 = tribuna. */
const level = (s: GameState, pos: number) => (s.properties[pos].stand ? 5 : s.properties[pos].seats)
const hasImprovements = (s: GameState, sq: StadiumSquare) =>
  groupOf(s, sq).some((g) => level(s, g.position) > 0)
const ownsCompleteGroup = (s: GameState, pid: number, sq: StadiumSquare) =>
  groupOf(s, sq).every((g) => s.properties[g.position].owner === pid && !s.properties[g.position].mortgaged)

function baseCheck(s: GameState, pid: number, allowDebt = false): Check {
  if (s.players[pid]?.bankrupt) return 'El jugador está en quiebra'
  if (MANAGE_PHASES.includes(s.phase) || (allowDebt && s.phase === 'debt')) return null
  return 'No se puede hacer ahora'
}

/** Convierte un comprobador + ejecutor en una acción que lanza error si no está permitida. */
function action<A extends unknown[]>(check: (...a: A) => Check, exec: (...a: A) => void) {
  return (...a: A) => {
    const err = check(...a)
    if (err) throw new Error(err)
    exec(...a)
  }
}

// ---------- Asientos ----------

export const canBuildSeat = (s: GameState, pid: number, pos: number): Check => {
  const e = baseCheck(s, pid)
  if (e) return e
  const sq = stadiumAt(s, pos)
  if (!sq) return 'Solo se construye en estadios'
  const ps = s.properties[pos]
  if (ps.owner !== pid) return 'No es el propietario'
  if (!ownsCompleteGroup(s, pid, sq)) return 'Necesita las dos concesiones del equipo, sin hipotecar'
  if (ps.stand) return 'Ya tiene tribuna'
  if (ps.seats >= 4) return 'Ya tiene 4 asientos: construya la tribuna'
  if (ps.seats > Math.min(...groupOf(s, sq).map((g) => level(s, g.position))))
    return 'Debe construir de forma uniforme'
  if (s.bankSeats < 1) return 'La Banca no tiene asientos'
  if (s.players[pid].money < sq.buildCost) return 'No tiene dinero suficiente'
  return null
}

export const buildSeat = action(canBuildSeat, (s, pid, pos) => {
  const sq = stadiumAt(s, pos)!
  s.players[pid].money -= sq.buildCost
  s.properties[pos].seats++
  s.bankSeats--
  s.log.push(`${s.players[pid].name} construye un asiento en ${sq.name} (${sq.part}) por ${money(sq.buildCost)}.`)
})

// ---------- Tribunas ----------

export const canBuildStand = (s: GameState, pid: number, pos: number): Check => {
  const e = baseCheck(s, pid)
  if (e) return e
  const sq = stadiumAt(s, pos)
  if (!sq) return 'Solo se construye en estadios'
  const ps = s.properties[pos]
  if (ps.owner !== pid) return 'No es el propietario'
  if (!ownsCompleteGroup(s, pid, sq)) return 'Necesita las dos concesiones del equipo, sin hipotecar'
  if (ps.stand) return 'Ya tiene tribuna'
  if (ps.seats < 4) return 'Necesita 4 asientos'
  if (groupOf(s, sq).some((g) => level(s, g.position) < 4))
    return 'Las dos concesiones del equipo necesitan 4 asientos'
  if (s.bankStands < 1) return 'La Banca no tiene tribunas'
  if (s.players[pid].money < sq.buildCost) return 'No tiene dinero suficiente'
  return null
}

/** Los 4 asientos vuelven a la Banca SIN reembolso y se paga el precio de la tribuna. */
export const buildStand = action(canBuildStand, (s, pid, pos) => {
  const sq = stadiumAt(s, pos)!
  s.players[pid].money -= sq.buildCost
  s.properties[pos].seats = 0
  s.properties[pos].stand = true
  s.bankSeats += 4
  s.bankStands--
  s.log.push(`${s.players[pid].name} construye una tribuna en ${sq.name} (${sq.part}) por ${money(sq.buildCost)}.`)
})

// ---------- Venta de mejoras a la Banca (a mitad de precio) ----------

export const canSellSeat = (s: GameState, pid: number, pos: number): Check => {
  const e = baseCheck(s, pid, true)
  if (e) return e
  const sq = stadiumAt(s, pos)
  if (!sq) return 'Solo se venden mejoras de estadios'
  const ps = s.properties[pos]
  if (ps.owner !== pid) return 'No es el propietario'
  if (groupOf(s, sq).some((g) => s.properties[g.position].stand)) return 'Hay tribuna: venda las tribunas del equipo'
  if (ps.seats < 1) return 'No tiene asientos'
  if (ps.seats < Math.max(...groupOf(s, sq).map((g) => s.properties[g.position].seats)))
    return 'Debe vender de forma uniforme (primero donde haya más asientos)'
  return null
}

export const sellSeat = action(canSellSeat, (s, pid, pos) => {
  const sq = stadiumAt(s, pos)!
  s.players[pid].money += sq.buildCost / 2
  s.properties[pos].seats--
  s.bankSeats++
  s.log.push(`${s.players[pid].name} vende un asiento de ${sq.name} (${sq.part}) por ${money(sq.buildCost / 2)}.`)
})

export const canSellStands = (s: GameState, pid: number, pos: number): Check => {
  const e = baseCheck(s, pid, true)
  if (e) return e
  const sq = stadiumAt(s, pos)
  if (!sq) return 'Solo se venden mejoras de estadios'
  if (s.properties[pos].owner !== pid) return 'No es el propietario'
  if (!groupOf(s, sq).some((g) => s.properties[g.position].stand)) return 'No hay tribunas'
  return null
}

/**
 * Vender una tribuna obliga a vender las dos y deshace el grupo entero:
 * cada tribuna paga la mitad de (tribuna + 4 asientos) = 2,5 x coste; los asientos sueltos, a mitad.
 */
export const sellStands = action(canSellStands, (s, pid, pos) => {
  const sq = stadiumAt(s, pos)!
  let total = 0
  for (const g of groupOf(s, sq)) {
    const ps = s.properties[g.position]
    if (ps.stand) {
      total += 2.5 * g.buildCost
      ps.stand = false
      s.bankStands++
    } else {
      total += (ps.seats * g.buildCost) / 2
      s.bankSeats += ps.seats
      ps.seats = 0
    }
  }
  s.players[pid].money += total
  s.log.push(`${s.players[pid].name} vende las mejoras de ${sq.name} por ${money(total)}.`)
})

// ---------- Hipotecas ----------

export const unmortgageCost = (sq: PropertySquare) => Math.round(sq.mortgage * 1.1)

export const canMortgage = (s: GameState, pid: number, pos: number): Check => {
  const e = baseCheck(s, pid, true)
  if (e) return e
  const sq = s.board[pos]
  if (!isProperty(sq)) return 'No es una concesión'
  const ps = s.properties[pos]
  if (ps.owner !== pid) return 'No es el propietario'
  if (ps.mortgaged) return 'Ya está hipotecada'
  if (sq.kind === 'stadium' && hasImprovements(s, sq)) return 'Venda antes las mejoras de todo el grupo'
  return null
}

export const mortgage = action(canMortgage, (s, pid, pos) => {
  const sq = s.board[pos] as PropertySquare
  s.players[pid].money += sq.mortgage
  s.properties[pos].mortgaged = true
  s.log.push(`${s.players[pid].name} hipoteca ${sq.name} y recibe ${money(sq.mortgage)}.`)
})

export const canUnmortgage = (s: GameState, pid: number, pos: number): Check => {
  const e = baseCheck(s, pid)
  if (e) return e
  const sq = s.board[pos]
  if (!isProperty(sq)) return 'No es una concesión'
  const ps = s.properties[pos]
  if (ps.owner !== pid) return 'No es el propietario'
  if (!ps.mortgaged) return 'No está hipotecada'
  if (s.players[pid].money < unmortgageCost(sq)) return 'No tiene dinero suficiente'
  return null
}

/** Se devuelve lo prestado + 10 % de interés. */
export const unmortgage = action(canUnmortgage, (s, pid, pos) => {
  const sq = s.board[pos] as PropertySquare
  s.players[pid].money -= unmortgageCost(sq)
  s.properties[pos].mortgaged = false
  s.log.push(`${s.players[pid].name} levanta la hipoteca de ${sq.name} por ${money(unmortgageCost(sq))}.`)
})

// ---------- Intercambios entre jugadores ----------

export interface TradeOffer {
  from: number
  to: number
  fromPositions: number[]
  toPositions: number[]
  fromCash: number
  toCash: number
}

export const canTrade = (s: GameState, t: TradeOffer): Check => {
  const e = baseCheck(s, t.from) ?? baseCheck(s, t.to)
  if (e) return e
  if (t.from === t.to) return 'Los jugadores deben ser distintos'
  if (Object.values(s.properties).some((p) => p.owner === null))
    return 'Solo se puede intercambiar cuando la Banca ya no tiene títulos'
  if (!t.fromPositions.length && !t.toPositions.length && !t.fromCash && !t.toCash) return 'Oferta vacía'
  for (const c of [t.fromCash, t.toCash]) if (!Number.isInteger(c) || c < 0) return 'Importe no válido'
  if (s.players[t.from].money < t.fromCash || s.players[t.to].money < t.toCash)
    return 'No tiene dinero suficiente'

  const sides: [number[], number][] = [[t.fromPositions, t.from], [t.toPositions, t.to]]
  for (const [positions, owner] of sides) {
    if (new Set(positions).size !== positions.length) return 'Concesión repetida'
    for (const pos of positions) {
      const sq = s.board[pos]
      if (!isProperty(sq)) return 'Solo se intercambian concesiones'
      const ps = s.properties[pos]
      if (ps.owner !== owner) return `${sq.name} no pertenece a quien la ofrece`
      if (ps.mortgaged) return `${sq.name} está hipotecada`
      if (sq.kind === 'stadium' && hasImprovements(s, sq)) return `${sq.name} tiene mejoras en su grupo`
    }
  }
  return null
}

export const trade = action(canTrade, (s, t) => {
  for (const pos of t.fromPositions) s.properties[pos].owner = t.to
  for (const pos of t.toPositions) s.properties[pos].owner = t.from
  s.players[t.from].money += t.toCash - t.fromCash
  s.players[t.to].money += t.fromCash - t.toCash
  s.log.push(`${s.players[t.from].name} y ${s.players[t.to].name} intercambian concesiones.`)
})

// ---------- Venta de la carta "Salga del Banquillo" ----------

export const canSellJailCard = (s: GameState, from: number, to: number, index: number, price: number): Check => {
  const e = baseCheck(s, from) ?? baseCheck(s, to)
  if (e) return e
  if (from === to) return 'Los jugadores deben ser distintos'
  if (!s.players[from].jailCards[index]) return 'No tiene esa carta'
  if (!Number.isInteger(price) || price < 0) return 'Importe no válido'
  if (s.players[to].money < price) return 'No tiene dinero suficiente'
  return null
}

/** Precio libre, pactado entre los dos jugadores. */
export const sellJailCard = action(canSellJailCard, (s, from, to, index, price) => {
  const [card] = s.players[from].jailCards.splice(index, 1)
  s.players[to].jailCards.push(card)
  s.players[from].money += price
  s.players[to].money -= price
  s.log.push(`${s.players[from].name} vende la carta "Salga del Banquillo" a ${s.players[to].name} por ${money(price)}.`)
})
