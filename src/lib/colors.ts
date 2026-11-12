/**
 * Un color por jugador, tomado de su peón (src/assets/player-N.webp):
 * 1 azul · 2 naranja rojizo · 3 negro · 4 rojo · 5 amarillo · 6 verde.
 * Se usa en el anillo del jugador activo, las bandas de propietario del tablero y los nombres.
 */
export const PLAYER_COLORS = ['#0f54c9', '#b33206', '#111111', '#b01402', '#e7b80d', '#066d02']
export const PLAYER_COLOR_NAMES = ['azul', 'naranja', 'negro', 'rojo', 'amarillo', 'verde']

/** Versión algo más oscura del color, para texto sobre fondo blanco (el amarillo, si no, apenas se lee). */
export const playerTextColor = (id: number) => `color-mix(in srgb, ${PLAYER_COLORS[id]} 78%, black)`

/** Fondo muy suave con el color del jugador (para resaltar su tarjeta). */
export const playerTint = (id: number) => `color-mix(in srgb, ${PLAYER_COLORS[id]} 9%, white)`

/** Importes con punto de millar siempre (2.500, 20.000), como el formatCurrency original. */
export const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
