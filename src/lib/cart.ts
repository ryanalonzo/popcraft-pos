/**
 * Cart calculations.
 *
 * All inputs and outputs are integer centavos. Never feed floats in here —
 * convert at the input boundary with `pesosToCentavos`.
 */

import type { CartLine, Item } from '@/types';

/**
 * A run of units within a line that share one unit price — the output of
 * decomposing a quantity against an item's bulk tiers. A plain item yields a
 * single group at the base price; a bundled quantity yields one group per
 * applied bundle plus a base-price group for any leftover units.
 */
export interface PriceGroup {
  quantity: number;
  unit_price_centavos: number;
}

/**
 * Decompose buying `quantity` of an item into priced groups, applying bulk /
 * multi-buy tiers the Philippine-retail way: a "2 for 120" deal prices units
 * in *complete pairs* at the bundle rate and leaves the odd one out at the
 * regular price. Buying 3 of a "2-for-120" (base 65) item → 2 @ 60 + 1 @ 65.
 *
 * With several tiers, the biggest bundle wins first: greedily pack the
 * largest `min_quantity` that still fits, then the next, then the remainder
 * at the base price. Groups come back discounted-first, base-price last, with
 * equal unit prices merged so each distinct price is a single group (and so a
 * single receipt line).
 *
 * @param item     - the catalog item (its `price_tiers` may be undefined)
 * @param quantity - units being purchased
 * @returns priced groups whose quantities sum to `quantity` (empty for qty 0)
 * @example
 *   // base 6500, tier (min 2 → 6000): "65 each, 2 for 120"
 *   priceLine(item, 1) // [{ quantity: 1, unit_price_centavos: 6500 }]
 *   priceLine(item, 2) // [{ quantity: 2, unit_price_centavos: 6000 }]
 *   priceLine(item, 3) // [{ quantity: 2, unit: 6000 }, { quantity: 1, unit: 6500 }]
 */
export function priceLine(item: Item, quantity: number): PriceGroup[] {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty === 0) return [];

  // Biggest bundle first so the largest deal is consumed before smaller ones.
  const tiers = (item.price_tiers ?? [])
    .filter((t) => t.min_quantity >= 1)
    .slice()
    .sort((a, b) => b.min_quantity - a.min_quantity);

  const groups: PriceGroup[] = [];
  let remaining = qty;
  for (const tier of tiers) {
    if (remaining < tier.min_quantity) continue;
    const units = Math.floor(remaining / tier.min_quantity) * tier.min_quantity;
    groups.push({ quantity: units, unit_price_centavos: tier.unit_price_centavos });
    remaining -= units;
  }
  if (remaining > 0) {
    groups.push({ quantity: remaining, unit_price_centavos: item.price_centavos });
  }

  // Collapse groups that landed on the same unit price (e.g. a leftover unit
  // priced identically to the base, or two tiers sharing a rate) so each
  // price shows as one line. First-seen order is preserved.
  const merged: PriceGroup[] = [];
  for (const g of groups) {
    const hit = merged.find((m) => m.unit_price_centavos === g.unit_price_centavos);
    if (hit) hit.quantity += g.quantity;
    else merged.push({ ...g });
  }
  return merged;
}

/**
 * Total for a single cart line, after applying any bulk tiers for its
 * quantity. Sums the priced groups from `priceLine`.
 *
 * @param line - cart line with item and quantity
 * @returns line total in centavos
 * @example
 *   calculateLineTotal({ item: { price_centavos: 24950, ... }, quantity: 2 })
 *   // 49900
 */
export function calculateLineTotal(line: CartLine): number {
  return priceLine(line.item, line.quantity).reduce(
    (sum, g) => sum + g.unit_price_centavos * g.quantity,
    0,
  );
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
