/**
 * Resuelve rutas de los JSON ("src/assets/stadiums/x.webp") a URLs que Vite entiende.
 * import.meta.glob se evalúa en compilación, así que no hace falta importar cada imagen.
 */
const modules = import.meta.glob('/src/assets/**/*.{webp,png,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export function imageUrl(path: string | undefined): string {
  if (!path) return ''
  return modules['/' + path.replace(/^\/+/, '')] ?? ''
}

/** Lado del tablero en el que está una casilla (las sillas y tribunas tienen una imagen por lado). */
export type BuildingSide = 'bottom' | 'left' | 'right' | 'top'

export const pawnUrl = (playerId: number) => imageUrl(`src/assets/player-${playerId + 1}.webp`)
export const diceUrl = (face: number) => imageUrl(`src/assets/dices/${face}.webp`)
export const chairUrl = (side: BuildingSide) => imageUrl(`src/assets/buildings/chair_${side}.webp`)
export const tribuneUrl = (side: BuildingSide) => imageUrl(`src/assets/buildings/tribune_${side}.webp`)
export const titleUrl = () => imageUrl('src/assets/futboly_title.webp')
export const logoUrl = () => imageUrl('src/assets/logo_borras.webp')
