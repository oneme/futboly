/**
 * Siguiente casilla que debe mostrar un peón que va de `current` a `target`:
 *  - hasta 12 casillas hacia delante (tirada de dados): avanza de una en una;
 *  - hasta 3 hacia atrás ("retroceda tres casillas"): retrocede de una en una;
 *  - cualquier otro salto (Banquillo, cartas que mandan lejos): se coloca directamente.
 */
export function nextPawnStep(current: number, target: number, size = 40): number {
  if (current === target) return target
  const forward = (target - current + size) % size
  const backward = (current - target + size) % size
  if (forward <= 12) return (current + 1) % size
  if (backward <= 3) return (current - 1 + size) % size
  return target
}
