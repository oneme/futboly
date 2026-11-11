import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameView from '../src/views/GameView.vue'
import { gridCell } from '../src/lib/boardGeometry'
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
    const start = w.findAll('button').find((b) => b.text().includes('Empezar'))!
    await start.trigger('click')
    expect(w.findAll('[title]').length).toBeGreaterThanOrEqual(40)

    const labels = ['Tirar dados', 'Aplicar', 'Pagar la multa', 'Comprar', 'Nadie puja', 'Saldar deuda', 'Terminar turno']
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

  it('intercambio desde la interfaz cuando la Banca ya no tiene títulos', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(GameView, { global: { plugins: [pinia] } })
    const store = useMatchStore()
    store.start(['Ana', 'Beto'])
    const s = store.state!
    Object.keys(s.properties).forEach((k, i) => (s.properties[+k].owner = i % 2)) // reparto total
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
    const swapped = Object.values(s.properties).filter((p, i) => p.owner !== i % 2).length
    expect(swapped).toBe(2)
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
})
