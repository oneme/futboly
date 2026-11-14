import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameView from '../src/views/GameView.vue'
import { BOARD_H, BOARD_W, MAX_BOARD_SCALE, boardScale, gridCell, uiZoom } from '../src/lib/boardGeometry'
import { nextPawnStep } from '../src/lib/pawnPath'
import { PLAYER_COLORS } from '../src/lib/colors'
import BuildingStrip from '../src/components/game/BuildingStrip.vue'
import CardView from '../src/components/game/CardView.vue'
import PropertyChip from '../src/components/game/PropertyChip.vue'
import { buildBoard } from '../src/engine/data'
import { readableText } from '../src/lib/teamColors'
import { formatMoney, toEuros } from '../src/lib/currency'
import { useSettingsStore } from '../src/stores/settings'
import { readFileSync } from 'node:fs'
import estadios from '../src/json/estadios.json'
import { useMatchStore } from '../src/stores/match'

describe('GameView', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })

  it('geometría: 40 posiciones únicas y esquinas correctas', () => {
    const seen = new Set<string>()
    for (let p = 0; p < 40; p++) { const c = gridCell(p); seen.add(`${c.row},${c.col}`) }
    expect(seen.size).toBe(40)
    expect(gridCell(0)).toMatchObject({ row: 9, col: 13 })   // Salida
    expect(gridCell(12)).toMatchObject({ row: 9, col: 1 })   // Banquillo
    expect(gridCell(20)).toMatchObject({ row: 1, col: 1 })   // Parking
    expect(gridCell(32)).toMatchObject({ row: 1, col: 13 })  // Vaya al Banquillo
    expect(gridCell(18).side).toBe('left')                   // Federación (izquierda)
    expect(gridCell(35).side).toBe('right')                  // Sorpresa (derecha)
  })

  it('arranca, muestra 40 casillas y juega varios turnos sin errores', async () => {
    const w = mount(GameView, { global: { plugins: [createPinia()] } })
    for (const box of w.findAll('input[type=checkbox]')) await box.setValue(false) // los dos jugadores, humanos
    const start = w.findAll('button').find((b) => b.text().includes('Empezar'))!
    await start.trigger('click')
    expect(w.findAll('[title]').length).toBeGreaterThanOrEqual(40)

    const labels = ['Tirar dados', 'Aplicar', 'Pagar la multa', 'Comprar', 'Retirarse', 'Saldar deuda', 'Terminar turno']
    for (let i = 0; i < 60; i++) {
      const btn = w.findAll('button').find((b) => labels.some((l) => b.text().startsWith(l)) && !b.attributes('disabled'))
        ?? w.findAll('button').find((b) => b.text().includes('Subastar') || b.text().includes('quiebra'))
      if (!btn) break
      await btn.trigger('click')
    }
    expect(w.text()).toContain('saca')   // el registro muestra tiradas
  })

  it('gestor: construir asiento, hipotecar tras vender, e intercambiar', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    const store = useMatchStore()
    store.start(['Ana', 'Beto'])
    const s = store.state!
    s.properties[1].owner = 0 // Betis General
    s.properties[3].owner = 0 // Betis Tribuna
    store.openManager(0)
    await w.vm.$nextTick()

    const click = async (text: string) => {
      const b = w.findAll('button').find((x) => x.text().includes(text) && !x.attributes('disabled'))
      expect(b, `botón "${text}"`).toBeTruthy()
      await b!.trigger('click')
    }
    await click('+ Asiento')
    expect(s.properties[1].seats + s.properties[3].seats).toBe(1)
    expect(s.players[0].money).toBe(145_000)
    await click('− Asiento')
    expect(s.properties[1].seats + s.properties[3].seats).toBe(0)
    await click('Hipotecar')
    expect(Object.values(s.properties).some((p) => p.mortgaged)).toBe(true)

    // Intercambio: la Banca aún tiene títulos -> el botón está desactivado y explica el motivo
    await click('Intercambios')
    expect(w.text()).toContain('Intercambiar con')
  })

  it('intercambio desde la interfaz (incluso con títulos en la Banca)', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    const store = useMatchStore()
    store.start(['Ana', 'Beto'])
    const s = store.state!
    // Reparto parcial: la Banca conserva la mayoría de los títulos (la regla opcional no está activa)
    Object.keys(s.properties).slice(0, 8).forEach((k, i) => (s.properties[+k].owner = i % 2))
    expect(Object.values(s.properties).some((p) => p.owner === null)).toBe(true)
    const owners = () => Object.values(s.properties).map((p) => p.owner)
    const before = owners()
    const aPos = +Object.keys(s.properties).find((k) => s.properties[+k].owner === 0)!
    store.openManager(0)
    await w.vm.$nextTick()
    await w.findAll('button').find((x) => x.text().includes('Intercambios'))!.trigger('click')
    const selects = w.findAll('select')
    await selects[selects.length - 1].setValue(1)
    const boxes = w.findAll('input[type=checkbox]')
    expect(boxes.length).toBeGreaterThan(2)
    await boxes[0].setValue(true) // una de Ana
    await boxes[boxes.length - 1].setValue(true) // una de Beto
    const ok = w.findAll('button').find((x) => x.text().includes('Aceptar intercambio'))!
    expect(ok.attributes('disabled')).toBeUndefined()
    await ok.trigger('click')
    expect(s.properties[aPos].owner).toBe(1) // la primera de Ana pasa a Beto
    const after = owners()
    expect(after.filter((o, i) => o !== before[i]).length).toBe(2)
  })

  it('assets: peones, dados, sillas por lado y tribuna se pintan con sus imágenes', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    expect(w.find('img[alt="Futboly"]').exists()).toBe(true)
    const store = useMatchStore()
    store.start(['Ana', 'Beto', 'Carla'])
    await w.vm.$nextTick()
    expect(w.findAll('img[alt^="Peón"]').length).toBeGreaterThanOrEqual(6) // tablero + panel + acciones

    const s = store.state!
    s.properties[1].owner = 0 // Betis General (fila inferior)
    s.properties[1].seats = 3
    s.properties[3].owner = 0
    s.properties[3].stand = true // tribuna
    await w.vm.$nextTick()
    expect(w.findAll('img[alt="Asiento"]').length).toBe(3)
    expect(w.findAll('img[alt="Tribuna"]').length).toBe(1)

    // casilla de la columna izquierda (posición 13..19) usa la imagen "left"
    const left = s.board.find((x) => x.position === 14 && x.kind === 'stadium') as { position: number } | undefined
    if (left) {
      s.properties[left.position].owner = 1
      s.properties[left.position].seats = 2
      await w.vm.$nextTick()
      expect(w.findAll('img[alt="Asiento"][src*="chair_left"]').length).toBe(2)
    }

    // dados
    const roll = w.findAll('button').find((b) => b.text().includes('Tirar dados'))!
    await roll.trigger('click')
    expect(w.findAll('img[alt^="Dado"]').length).toBe(2)
  })

  it('hover: la tarjeta de precios aparece sobre una concesión y desaparece al salir', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    useMatchStore().start(['Ana', 'Beto'])
    await w.vm.$nextTick()
    const imgBox = (title: string) => w.findAll(`[title="${title}"]`).find((e) => e.element.tagName === 'DIV')!.find('div')

    // Estadio: título de propiedad con alquileres, precio de compra e hipoteca
    const camp = imgBox('Camp Nou')
    await camp.trigger('mouseenter')
    expect(w.text()).toContain('título de propiedad')
    expect(w.text()).toContain('265.000') // alquiler con tribuna (formato con punto)
    expect(w.text()).toContain('valor hipotecario')
    expect(w.text()).toContain('Libre')
    await camp.trigger('mouseleave')
    expect(w.text()).not.toContain('título de propiedad')

    // Servicio de estadio y de club
    await imgBox('Almohadillas').trigger('mouseenter')
    expect(w.text()).toContain('servicios estadio')
    expect(w.text()).toContain('2.500')
    await imgBox('Autocares').trigger('mouseenter')
    expect(w.text()).toContain('Valor de los dados')

    // Con propietario y mejoras
    const store = useMatchStore()
    const pos = store.state!.board.findIndex((x) => x.kind === 'stadium' && x.name === 'Camp Nou')
    store.state!.properties[pos].owner = 1
    store.state!.properties[pos].seats = 2
    await camp.trigger('mouseenter')
    expect(w.text()).toContain('Propietario: Beto')
    expect(w.text()).toContain('2 sillas')

    // Los departamentos no muestran tarjeta
    await camp.trigger('mouseleave')
    await imgBox('Parking').trigger('mouseenter')
    expect(w.text()).not.toContain('título de propiedad')
  })

  it('animación de peones: avanza de uno en uno, retrocede 3 o salta', () => {
    expect(nextPawnStep(10, 14)).toBe(11)
    expect(nextPawnStep(38, 3)).toBe(39) // da la vuelta al tablero
    expect(nextPawnStep(10, 7)).toBe(9) // "retroceda tres casillas"
    expect(nextPawnStep(33, 12)).toBe(12) // Banquillo: salto directo
    expect(nextPawnStep(5, 5)).toBe(5)
    const walk: number[] = [36]
    while (walk.at(-1) !== 4) walk.push(nextPawnStep(walk.at(-1)!, 4))
    expect(walk).toEqual([36, 37, 38, 39, 0, 1, 2, 3, 4])
  })

  it('subasta por pujas desde la interfaz', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    const store = useMatchStore()
    store.start(['Ana', 'Beto', 'Carla'])
    const s = store.state!
    s.players[0].position = 3 // Betis Tribuna, libre
    s.phase = 'buy'
    await w.vm.$nextTick()
    const click = async (text: string) => {
      const b = w.findAll('button').find((x) => x.text().includes(text) && !x.attributes('disabled'))
      expect(b, `botón "${text}"`).toBeTruthy()
      await b!.trigger('click')
    }
    await click('Subastar')
    expect(s.phase).toBe('auction')
    expect(w.text()).toContain('Subasta de')
    expect(s.auction!.turn).toBe(1) // empieza Beto
    await click('+1.000')
    expect(s.auction!.bid).toBe(1000)
    expect(s.auction!.leader).toBe(1)
    await click('+500') // Carla sube a 1.500
    expect(s.auction!.bid).toBe(1500)
    await click('Retirarse') // Ana
    await click('Retirarse') // Beto
    expect(s.auction).toBeNull()
    expect(s.properties[3].owner).toBe(2) // gana Carla
    expect(s.players[2].money).toBe(148_500)
  })

  describe('jugadores IA, animación y sonido', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('una IA juega sola su turno y los botones se bloquean mientras decide', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start([{ name: 'Humano' }, { name: 'Robot', ai: true }])
      store.roll()
      await w.vm.$nextTick()
      // El humano termina su turno (resolviendo lo que le toque) y pasa a la IA
      for (let i = 0; i < 12 && store.state!.current === 0; i++) {
        const ph = store.state!.phase
        if (ph === 'buy') store.declineBuy()
        else if (ph === 'auction') store.auctionPass()
        else if (ph === 'card') store.resolveCard()
        else if (ph === 'cardChoice') store.chooseRisk(false)
        else if (ph === 'debt') store.declareBankruptcy()
        else if (ph === 'roll') store.roll()
        else if (ph === 'endTurn') store.endTurn()
        else break
      }
      await vi.advanceTimersByTimeAsync(60_000)
      expect(store.state!.log.some((l) => l.startsWith('Robot saca'))).toBe(true)
    })

    it('partida solo de IAs a través del store: progresa sin errores y los peones llegan a su casilla', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start([
        { name: 'A', ai: true },
        { name: 'B', ai: true },
        { name: 'C', ai: true },
      ])
      await vi.advanceTimersByTimeAsync(120_000)
      const s = store.state!
      expect(s.log.length).toBeGreaterThan(100)
      for (const p of s.players) expect(store.shown[p.id]).toBe(p.position)
      expect(store.moving).toBe(false)
      expect(w.findAll('[title]').length).toBeGreaterThanOrEqual(40)
    }, 30_000)

    it('el botón de sonido alterna el silencio', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start(['Ana', 'Beto'])
      await w.vm.$nextTick()
      const before = store.muted
      await w.findAll('button').find((b) => b.text() === '🔊' || b.text() === '🔇')!.trigger('click')
      expect(store.muted).toBe(!before)
    })

    it('una IA propone un trato a un humano: aparece la ventana y al aceptar se ejecuta', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start([{ name: 'Humano' }, { name: 'Robot', ai: true }])
      const s = store.state!
      s.properties[1].owner = 1 // Robot: Betis General
      s.properties[3].owner = 0 // Humano: Betis Tribuna
      s.current = 1
      await vi.advanceTimersByTimeAsync(3_000)
      expect(s.proposal).toBeTruthy()
      expect(w.text()).toContain('Robot te propone un trato')
      expect(w.text()).toContain('Villamarín') // describe lo que se intercambia
      expect(w.find('[data-chip]').exists()).toBe(true) // con píldoras de colores
      expect(s.phase).toBe('roll') // el Robot espera, no tira

      const accept = w.findAll('button').find((b) => b.text() === 'Aceptar')!
      await accept.trigger('click')
      expect(s.proposal).toBeNull()
      expect(s.properties[3].owner).toBe(1)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(w.text()).not.toContain('te propone un trato')
      expect(s.log.some((l) => l.startsWith('Trato cerrado'))).toBe(true)
    })

    it('un humano propone un trato a una IA desde el gestor y ella responde', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start([{ name: 'Humano' }, { name: 'Robot', ai: true }])
      const s = store.state!
      const gorras = s.board.findIndex((x) => x.kind === 'stadiumService' && x.name === 'Gorras')
      s.properties[gorras].owner = 1
      store.openManager(0)
      await w.vm.$nextTick()
      await w.findAll('button').find((x) => x.text().includes('Intercambios'))!.trigger('click')
      const selects = w.findAll('select')
      await selects[selects.length - 1].setValue(1) // intercambiar con el Robot
      expect(w.text()).toContain('La IA valorará la oferta')
      await w.findAll('input[type=checkbox]').find((b) => b.element.parentElement!.textContent!.includes('Gorras'))!.setValue(true)
      const cash = w.findAll('input[type=number]')[0]
      await cash.setValue(5_000) // oferta tacaña
      const propose = () => w.findAll('button').find((b) => b.text().includes('Proponer a la IA'))!
      await propose().trigger('click')
      expect(w.text()).toContain('rechaza la propuesta')
      expect(s.properties[gorras].owner).toBe(1)

      await selects[selects.length - 1].setValue(1)
      await w.findAll('input[type=checkbox]').find((b) => b.element.parentElement!.textContent!.includes('Gorras'))!.setValue(true)
      await w.findAll('input[type=number]')[0].setValue(40_000) // oferta generosa
      await propose().trigger('click')
      expect(w.text()).toContain('acepta el trato')
      expect(s.properties[gorras].owner).toBe(0)
    })

    it('el gestor de un jugador IA es de solo lectura', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start([{ name: 'Humano' }, { name: 'Robot', ai: true }])
      store.state!.properties[1].owner = 1
      store.openManager(1)
      await w.vm.$nextTick()
      expect(w.text()).toContain('lo controla la IA')
      expect(w.find('fieldset.contents').attributes('disabled')).toBeDefined()
    })
  })

  it('sillas y tribunas: contenedor a todo el ancho de la casilla y posiciones por lado', () => {
    const style = (el: Element) => (el as HTMLElement).style
    const strip = (side: 'bottom' | 'top' | 'left' | 'right', seats: number, stand = false) =>
      mount(BuildingStrip, { props: { side, seats, stand } })

    // El contenedor mide todo el ancho de la casilla (no 0) y las imágenes no heredan max-width:100%
    const w = strip('top', 4)
    expect(w.find('[data-building]').classes()).toContain('inset-x-0')
    expect(w.find('[data-building]').classes()).not.toContain('w-0')
    expect(w.findAll('img').every((i) => i.classes().includes('max-w-none'))).toBe(true)

    // Fila superior: se miden desde el borde DERECHO de la casilla, bajo la imagen
    const top = w.findAll('img').map((i) => style(i.element))
    expect(top.map((s) => s.right)).toEqual(['0px', '24px', '48px', '72px'])
    expect(top.every((s) => s.top === '132px')).toBe(true)

    // Fila inferior: desde el borde izquierdo, justo encima de la imagen (que está a 9 px del borde de la casilla)
    const bottom = strip('bottom', 2).findAll('img').map((i) => style(i.element))
    expect(bottom.map((s) => s.left)).toEqual(['0px', '24px'])
    expect(bottom.every((s) => s.top === '-23px')).toBe(true)

    // Columna izquierda: desde el borde derecho de la casilla (200 px), a 32 px
    const left = strip('left', 3).findAll('img').map((i) => style(i.element))
    expect(left.every((s) => s.right === '32px')).toBe(true)
    expect(left.map((s) => s.top)).toEqual(['0px', '24px', '48px'])

    // Columna derecha: desde el borde izquierdo
    const right = strip('right', 4).findAll('img').map((i) => style(i.element))
    expect(right.every((s) => s.left === '32px')).toBe(true)
    expect(right.map((s) => s.top)).toEqual(['-8px', '16px', '40px', '64px'])

    // Tribuna: una sola imagen de 48 px
    const stand = strip('left', 0, true).findAll('img')
    expect(stand.length).toBe(1)
    expect(style(stand[0].element).width).toBe('48px')
  })

  it('cartas: Federación en verde y Sorpresa en morado (borde oscuro, fondo claro)', () => {
    const fed = mount(CardView, { props: { deck: 'federation', text: 'Cobre 5.000' } })
    expect(fed.classes()).toEqual(expect.arrayContaining(['border-federation-border', 'bg-federation-bg']))
    expect(fed.text()).toContain('Federación')
    const sur = mount(CardView, { props: { deck: 'surprise', text: 'Pague 2.000' } })
    expect(sur.classes()).toEqual(expect.arrayContaining(['border-surprise-border', 'bg-surprise-bg']))
    expect(sur.text()).toContain('Sorpresa')
  })

  it('pantalla de inicio: el nivel de la IA solo aparece para las IAs y llega al motor', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    // Jugador 1 humano (sin selector) y Jugador 2 IA (con selector Fácil / Normal / Difícil)
    const selects = w.findAll('select[data-level]')
    expect(selects.length).toBe(1)
    expect(selects[0].findAll('option').map((o) => o.text())).toEqual(['Fácil', 'Normal', 'Difícil'])
    await selects[0].setValue('hard')
    await w.findAll('button').find((b) => b.text().includes('Empezar'))!.trigger('click')
    const store = useMatchStore()
    expect(store.state!.players.map((p) => [p.ai, p.level])).toEqual([[false, 'normal'], [true, 'hard']])
    expect(w.text()).toContain('IA · Difícil') // insignia en el panel de jugadores
  })

  it('fin de partida: resumen con clasificación, revancha y volver a ver el tablero', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    const store = useMatchStore()
    store.start([{ name: 'Ana' }, { name: 'Robot', ai: true, level: 'easy' }, { name: 'Carla' }], { tradeOnlyWhenBankEmpty: true })
    const s = store.state!
    s.properties[1].owner = 0
    s.stats[0].rentReceived = 12_000
    // Beto... (Robot) y Carla se arruinan: gana Ana
    for (const [id, turn] of [[1, 3], [2, 6]] as const) {
      s.turnCount = turn
      s.current = id
      s.players[id].money = 0
      s.debt = { debtor: id, amount: 1, creditor: 'bank', resume: 'afterLanding' }
      s.phase = 'debt'
      store.declareBankruptcy()
    }
    await w.vm.$nextTick()
    const dialog = w.find('[data-gameover]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('Gana Ana')
    const rows = dialog.findAll('tbody tr').map((r) => r.text())
    expect(rows.length).toBe(3)
    expect(rows[0]).toContain('Ana')
    expect(rows[1]).toContain('Carla') // aguantó más que el Robot
    expect(rows[2]).toContain('Robot')
    expect(rows[2]).toContain('IA · Fácil')
    expect(rows[2]).toContain('Eliminado en el turno 3')
    expect(dialog.text()).toContain('Más alquileres cobrados')

    // Ver el tablero: se cierra, y desde el panel de acciones se puede reabrir
    await dialog.findAll('button').find((b) => b.text() === 'Ver el tablero')!.trigger('click')
    expect(w.find('[data-gameover]').exists()).toBe(false)
    await w.findAll('button').find((b) => b.text() === 'Ver resumen')!.trigger('click')
    expect(w.find('[data-gameover]').exists()).toBe(true)

    // Revancha: mismos jugadores, niveles y reglas, partida nueva
    await w.find('[data-gameover]').findAll('button').find((b) => b.text() === 'Revancha')!.trigger('click')
    const n = store.state!
    expect(n.phase).toBe('roll')
    expect(n.players.map((p) => [p.name, p.ai, p.level])).toEqual([['Ana', false, 'normal'], ['Robot', true, 'easy'], ['Carla', false, 'normal']])
    expect(n.rules.tradeOnlyWhenBankEmpty).toBe(true)
    expect(n.stats[0].rentReceived).toBe(0)
    expect(w.find('[data-gameover]').exists()).toBe(false)
  })

  it('tamaño: el tablero llena el ancho sin pasarse del alto, y la interfaz crece en pantallas grandes', () => {
    // Pantalla pequeña: manda el ancho; pantalla grande: manda el alto de la ventana
    expect(boardScale(722, 2000)).toBeCloseTo(0.5, 2)
    expect(boardScale(3000, 1289)).toBeCloseTo((1289 - 24) / BOARD_H, 3)
    expect(boardScale(3000, 5000)).toBe(MAX_BOARD_SCALE) // tope
    expect(boardScale(0, 800)).toBe(1) // sin medidas (jsdom): 1
    // El tablero ocupa más que antes en tu pantalla (2563 x 1289): antes 1232 px de ancho
    const before = Math.min(1.2, (1600 - 320 - 16 - 32) / BOARD_W) * BOARD_W
    const after = boardScale(2563 - 32 - 480 - 16, 1289) * BOARD_W
    expect(after).toBeGreaterThan(before * 1.4)
    // Interfaz: 1 hasta 1700 px y hasta 1,6
    expect(uiZoom(1280)).toBe(1)
    expect(uiZoom(2563)).toBeCloseTo(1.508, 3)
    expect(uiZoom(4000)).toBe(1.6) // tope
    expect(uiZoom(2040)).toBeCloseTo(1.2, 2)
  })

  it('legibilidad: botones y campos de los controles del centro tienen color de texto propio', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    const store = useMatchStore()
    store.start(['Ana', 'Beto', 'Carla'])
    const s = store.state!
    const readable = () => {
      const fs = w.find('fieldset')
      for (const b of fs.findAll('button')) {
        const c = b.classes()
        expect(c.includes('text-slate-900') || c.includes('text-white'), `botón "${b.text()}" sin color de texto`).toBe(true)
      }
      for (const f of fs.findAll('input, select')) {
        expect(f.classes(), 'campo sin color de texto').toContain('text-slate-900')
      }
    }
    s.players[0].position = 3
    s.phase = 'buy' // Comprar / Subastar
    await w.vm.$nextTick()
    readable()
    expect(w.findAll('fieldset button').map((b) => b.text())).toEqual(expect.arrayContaining(['Comprar', 'Subastar']))
    await w.findAll('button').find((b) => b.text() === 'Subastar')!.trigger('click') // subasta: +500, campo, Pujar, Retirarse
    expect(s.phase).toBe('auction')
    readable()
    s.auction = null
    s.debt = { debtor: 0, amount: 5_000, creditor: 'bank', resume: 'afterLanding' }
    s.phase = 'debt' // Gestionar propiedades / Saldar deuda / quiebra
    await w.vm.$nextTick()
    readable()
  })

  it('colores de jugador: los del peón, y el anillo del jugador activo lleva su color', async () => {
    // seis colores distintos, en el orden de los peones (azul, naranja, negro, rojo, amarillo, verde)
    expect(new Set(PLAYER_COLORS).size).toBe(6)
    const rgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16)
      return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`
    }
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    const store = useMatchStore()
    store.start(['Ana', 'Beto', 'Carla'])
    await w.vm.$nextTick()
    const ring = () => {
      const active = w.findAll('[data-active]')
      expect(active.length).toBe(1) // solo un jugador con anillo
      return active[0]
    }
    expect(ring().text()).toContain('Ana')
    expect((ring().element as HTMLElement).style.borderColor).toBe(rgb(PLAYER_COLORS[0]))
    expect((ring().element as HTMLElement).style.boxShadow).toContain(rgb(PLAYER_COLORS[0]))

    // el anillo pasa al siguiente jugador y cambia de color
    const s = store.state!
    s.phase = 'endTurn'
    store.endTurn()
    await w.vm.$nextTick()
    expect(ring().text()).toContain('Beto')
    expect((ring().element as HTMLElement).style.borderColor).toBe(rgb(PLAYER_COLORS[1]))

    // en una subasta el anillo sigue a quien tiene que pujar
    s.players[1].position = 3
    s.phase = 'buy'
    store.declineBuy()
    await w.vm.$nextTick()
    expect(s.auction!.turn).toBe(2)
    expect(ring().text()).toContain('Carla')
    expect((ring().element as HTMLElement).style.borderColor).toBe(rgb(PLAYER_COLORS[2]))
  })

  describe('píldoras con los colores del equipo', () => {
    const board = buildBoard()
    const byId = (id: number) => board.find((x) => 'id' in x && x.id === id) as never
    const chip = (id: number, extra: Record<string, unknown> = {}) =>
      mount(PropertyChip, { props: { sq: byId(id), ...extra } })

    it('estadio con dos franjas y parte inferior blanca (Betis)', () => {
      const w = chip(1) // Benito Villamarín (General): top "bg-green-1000,bg-white", bottom "bg-white"
      expect(w.findAll('[data-stripes] i').map((i) => i.classes())).toEqual([['block', 'min-w-0', 'flex-1', 'bg-green-1000'], ['block', 'min-w-0', 'flex-1', 'bg-white']])
      const label = w.find('[data-label]')
      expect(label.classes()).toEqual(expect.arrayContaining(['bg-white', 'text-black']))
      expect(label.text()).toBe('Benito Villamarín (G)')
      expect(chip(2).find('[data-label]').text()).toBe('Benito Villamarín (T)')
    })

    it('si la parte inferior ya trae color de texto no se le añade otro (Sporting)', () => {
      const label = chip(4).find('[data-label]') // bottom "bg-sky-1200 text-white"
      expect(label.classes()).toEqual(expect.arrayContaining(['bg-sky-1200', 'text-white']))
      expect(label.classes()).not.toContain('text-black')
    })

    it('equipos de barras (parte inferior vacía): fondo blanco y texto negro (Sevilla)', () => {
      const w = chip(12)
      expect(w.findAll('[data-stripes] i').length).toBe(1)
      expect(w.find('[data-stripes] i').classes()).toContain('bg-red-1100')
      expect(w.find('[data-label]').classes()).toEqual(expect.arrayContaining(['bg-white', 'text-black']))
    })

    it('servicios: color propio con texto legible; hipotecada se tacha y se atenúa', () => {
      const gorras = chip(11)
      expect(gorras.text()).toBe('Gorras')
      expect((gorras.find('[data-label]').element as HTMLElement).style.backgroundColor).toBe('rgb(33, 150, 209)')
      const hip = chip(11, { mortgaged: true })
      expect(hip.find('[data-label]').classes()).toContain('line-through')
      expect(hip.classes()).toContain('opacity-60')
      expect(hip.attributes('title')).toContain('hipotecada')
      expect(readableText('#ffffff')).toBe('#000000')
      expect(readableText('#111111')).toBe('#ffffff')
      expect(readableText('#2196d1')).toBe('#ffffff')
      expect(readableText('#e4bc47')).toBe('#000000')
    })

    it('Tailwind genera todas las clases de color de estadios.json (lista segura en main.css)', () => {
      const css = readFileSync('src/assets/main.css', 'utf-8')
      const safelist = css.match(/@source inline\("([^"]+)"\)/)![1].split(/\s+/)
      const used = new Set<string>()
      for (const e of estadios) for (const k of ['top', 'bottom'] as const) for (const c of e.colors[k].split(/[,\s]+/)) if (c) used.add(c)
      expect([...used].filter((c) => !safelist.includes(c))).toEqual([])
    })

    it('el panel de jugadores muestra las propiedades con los colores del equipo', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start(['Ana', 'Beto'])
      const s = store.state!
      s.properties[1].owner = 0 // Betis General
      s.properties[board.findIndex((x) => 'id' in x && x.id === 11)].owner = 0 // Gorras
      await w.vm.$nextTick()
      const card = w.findAll('[data-chip]').filter((c) => c.text().includes('Villamarín'))
      expect(card.length).toBe(1)
      expect(card[0].find('[data-stripes] i').classes()).toContain('bg-green-1000')
      expect(w.findAll('[data-chip]').some((c) => c.text() === 'Gorras')).toBe(true)
    })

    it('el gestor: banner del equipo y píldoras General/Tribuna; los intercambios también las usan', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start(['Ana', 'Beto'])
      const s = store.state!
      s.properties[1].owner = 0
      s.properties[3].owner = 0
      s.properties[board.findIndex((x) => 'id' in x && x.id === 4)].owner = 1 // Molinón General (de Beto)
      store.openManager(0)
      await w.vm.$nextTick()
      const dialog = w.find('.fixed')
      const chips = dialog.findAll('[data-chip]')
      const texts = chips.map((c) => c.text())
      expect(texts).toContain('Real Betis · Benito Villamarín') // banner del grupo
      expect(texts).toContain('General')
      expect(texts).toContain('Tribuna')
      const banner = chips.find((c) => c.text().startsWith('Real Betis'))!
      expect(banner.find('[data-stripes] i').classes()).toContain('bg-green-1000')

      await w.findAll('button').find((b) => b.text().includes('Intercambios'))!.trigger('click')
      const selects = w.findAll('select')
      await selects[selects.length - 1].setValue(1)
      expect(w.find('.fixed').findAll('[data-chip]').some((c) => c.text().includes('El Molinón'))).toBe(true)
    })
  })

  describe('importes en euros con inflación', () => {
    const euros = { euros: true, inflation: 35.79 }
    const setup = async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      const store = useMatchStore()
      store.start(['Ana', 'Beto'])
      await w.vm.$nextTick()
      const clickText = async (text: string) =>
        w.findAll('button').find((b) => b.text() === text)!.trigger('click')
      return { w, store, clickText }
    }

    it('por defecto en pesetas; el selector del panel cambia dinero, tarjetas, registro y cartas', async () => {
      const { w, store, clickText } = await setup()
      expect(w.text()).toContain('150.000')
      expect(w.find('[data-currency]').text()).toContain('Importes')

      // genera una línea de registro con un importe: Ana compra Betis Tribuna (8.000)
      const s = store.state!
      s.players[0].position = 3
      s.phase = 'buy'
      store.buy()
      await w.vm.$nextTick()
      expect(w.text()).toContain('compra Benito Villamarín por 8.000.')

      await clickText('€ con inflación')
      expect(w.text()).toContain(formatMoney(142_000, euros)) // dinero de Ana tras comprar
      expect(w.text()).not.toContain('150.000')
      expect(w.text()).toContain(`compra Benito Villamarín por ${formatMoney(8_000, euros)}.`) // el registro se convierte
      expect(w.text()).toContain('Importes') // y el aviso de las imágenes
      expect(w.text()).toContain('siguen en pesetas')

      // tarjeta de precios al pasar el ratón
      const camp = w.findAll('[title="Camp Nou"]').find((e) => e.element.tagName === 'DIV')!.find('div')
      await camp.trigger('mouseenter')
      expect(w.text()).toContain(formatMoney(265_000, euros)) // alquiler con tribuna
      expect(w.text()).not.toContain('265.000')
      await camp.trigger('mouseleave')

      // volver a pesetas
      await clickText('Ptas.')
      expect(w.text()).toContain('142.000')
    })

    it('el coeficiente de inflación es editable y se aplica al instante', async () => {
      const { w, store, clickText } = await setup()
      await clickText('€ con inflación')
      const coef = w.find('[data-currency] input[type=number]')
      await coef.setValue(0) // sin inflación: 150.000 ptas = 902 €
      expect(w.text()).toContain(formatMoney(150_000, { euros: true, inflation: 0 }))
      expect(toEuros(150_000, 0)).toBe(902)
      expect(useSettingsStore().options).toEqual({ euros: true, inflation: 0 })
      await coef.setValue('') // vacío: vuelve al coeficiente por defecto
      expect(w.text()).toContain(formatMoney(150_000, euros))
      expect(store.state!.players[0].money).toBe(150_000) // el motor sigue en pesetas
    })

    it('los textos de las cartas convierten sus importes', async () => {
      const { w, store, clickText } = await setup()
      await clickText('€ con inflación')
      const s = store.state!
      const card = s.decks.federation.find((c) => c.text.includes('20.000'))!
      s.card = { deck: 'federation', card }
      s.phase = 'card'
      await w.vm.$nextTick()
      expect(w.text()).toContain('€')
      expect(w.text()).toContain(formatMoney(20_000, euros))
    })

    it('las cantidades escritas a mano siguen en pesetas y muestran su equivalente', async () => {
      const { w, store, clickText } = await setup()
      await clickText('€ con inflación')
      const s = store.state!
      s.players[0].position = 3
      s.phase = 'buy'
      store.declineBuy() // subasta
      await w.vm.$nextTick()
      const input = w.find('input[placeholder="Otra (Ptas.)"]')
      await input.setValue(3_000)
      expect(w.text()).toContain(`≈ ${formatMoney(3_000, euros)}`)
      await w.findAll('button').find((b) => b.text() === 'Pujar')!.trigger('click')
      expect(s.auction!.bid).toBe(3_000) // la puja se hace en pesetas
    })

    it('la pantalla de inicio permite elegir euros y el coeficiente', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(GameView, { global: { plugins: [pinia] } })
      expect(w.text()).not.toContain('Coeficiente de inflación')
      const box = w.findAll('label').find((l) => l.text().includes('en euros con inflación'))!.find('input')
      await box.setValue(true)
      expect(w.text()).toContain('Coeficiente de inflación')
      expect(useSettingsStore().euros).toBe(true)
    })
  })
})
