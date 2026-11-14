/**
 * Importe para el registro de la partida. El motor trabaja siempre en pesetas y escribe `[[6000]]`;
 * la interfaz lo muestra en pesetas o en euros con inflación (src/lib/currency.ts).
 */
export const money = (n: number): string => `[[${Math.round(n)}]]`
