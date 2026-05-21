/**
 * Money helpers.
 *
 * All amounts in the app are stored as integer centavos (BIGINT on the server).
 * Floats are only used at display boundaries, never for arithmetic.
 */

const PESO_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/**
 * Format centavos as a Philippine peso string with thousands separator.
 *
 * @param centavos - integer centavos (1 peso = 100 centavos)
 * @returns formatted string like "₱249.50" or "₱24,900.00"
 * @example
 *   formatPeso(0)       // "₱0.00"
 *   formatPeso(24950)   // "₱249.50"
 *   formatPeso(2490000) // "₱24,900.00"
 */
export function formatPeso(centavos: number): string {
  return `₱${formatPesoNoSymbol(centavos)}`;
}

/**
 * Format centavos as a peso string WITHOUT the "₱" symbol.
 * Useful for right-aligned numeric table columns.
 *
 * @param centavos - integer centavos
 * @returns formatted string like "249.50" or "24,900.00"
 * @example
 *   formatPesoNoSymbol(24950) // "249.50"
 */
export function formatPesoNoSymbol(centavos: number): string {
  const pesos = centavos / 100;
  return pesos.toLocaleString('en-PH', PESO_FORMAT);
}

/**
 * Convert a peso amount (float) to integer centavos. Use this at input
 * boundaries (e.g. parsing user-entered prices) and never in arithmetic.
 *
 * @param pesos - peso amount as a float (e.g. 249.50)
 * @returns integer centavos, rounded to the nearest centavo
 * @example
 *   pesosToCentavos(249.50) // 24950
 *   pesosToCentavos(0.1 + 0.2) // 30  (Math.round corrects float drift)
 */
export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

/**
 * Convert integer centavos to a peso float. Display-only — do not chain
 * arithmetic on the result.
 *
 * @param centavos - integer centavos
 * @returns peso amount as a float
 * @example
 *   centavosToPesos(24950) // 249.5
 */
export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}
