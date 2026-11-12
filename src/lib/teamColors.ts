/**
 * Colores de los servicios para sus píldoras (los estadios traen los suyos en estadios.json).
 * Muestreados de las imágenes de cada servicio en src/assets.
 */
export const SERVICE_COLORS: Record<string, string> = {
  Almohadillas: '#ce403c',
  Gorras: '#2196d1',
  Bares: '#e4bc47',
  Publicidad: '#d4a017',
  'Material Deportivo': '#1c8cad',
  Autocares: '#92b05b',
}
export const DEFAULT_SERVICE_COLOR = '#94a3b8'

/** Negro o blanco, el que mejor se lee sobre ese color de fondo. */
export function readableText(hex: string): '#000000' | '#ffffff' {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000000' : '#ffffff'
}
