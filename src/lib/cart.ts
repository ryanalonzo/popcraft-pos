/**
 * Cart calculations.
 *
 * All inputs and outputs are integer centavos. Never feed floats in here —
 * convert at the input boundary with `pesosToCentavos`.
 */

import type { CartLine } from '@/types';

/**
 * Total for a single cart line.
 *
 * @param line - cart line with item and quantity
 * @returns line total in centavos
 * @example
 *   calculateLineTotal({ item: { price_centavos: 24950, ... }, quantity: 2 })
 *   // 49900
 */
export function calculateLineTotal(line: CartLine): number {
  return line.item.price_centavos * line.quantity;
}

/**
 * Sum of all line totals in the cart.
 *
 * @param lines - cart lines
 * @returns subtotal in centavos (0 for an empty cart)
 * @example
 *   calculateSubtotal([
 *     { item: { price_centavos: 10000, ... }, quantity: 2 }, // 20000
 *     { item: { price_centavos: 4950,  ... }, quantity: 1 }, //  4950
 *   ]) // 24950
 */
export function calculateSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
}

/**
 * VAT / tax on a subtotal, rounded to the nearest centavo.
 *
 * PH VAT is 12% — pass `0.12` for `taxRate`.
 *
 * @param subtotal - subtotal in centavos
 * @param taxRate  - decimal rate (0.12 for 12%)
 * @returns tax in centavos (rounded)
 * @example
 *   calculateTax(24950, 0.12) // 2994
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate);
}

/**
 * Grand total = subtotal + tax - discount.
 *
 * @param subtotal - subtotal in centavos
 * @param tax      - tax in centavos
 * @param discount - optional discount in centavos (default 0)
 * @returns total in centavos
 * @example
 *   calculateTotal(24950, 2994)        // 27944
 *   calculateTotal(24950, 2994, 1000)  // 26944
 */
export function calculateTotal(
  subtotal: number,
  tax: number,
  discount: number = 0,
): number {
  return subtotal + tax - discount;
}

/**
 * Change owed to the customer for a cash payment. Returns 0 (never negative)
 * if the tendered amount is short — callers must validate sufficiency
 * separately before completing the sale.
 *
 * @param total    - sale total in centavos
 * @param tendered - cash handed over in centavos
 * @returns change in centavos, or 0 if `tendered < total`
 * @example
 *   calculateChange(27944, 30000) // 2056
 *   calculateChange(27944, 20000) // 0
 */
export function calculateChange(total: number, tendered: number): number {
  if (tendered < total) return 0;
  return tendered - total;
}
