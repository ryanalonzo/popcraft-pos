/**
 * Cart calculations.
 *
 * All inputs and outputs are integer centavos. Never feed floats in here —
 * convert at the input boundary with `pesosToCentavos`.
 */

import type { CartLine, Item, ItemMarkdown } from '@/types';

/**
 * A run of units within a line that share one unit price — the output of
 * pricing a quantity against an item's bulk tiers. Every unit on a line is
 * charged the same rate today (the tier that its quantity qualifies for, or
 * the base price), so a line yields exactly one group; the list shape is kept
 * so receipts stay correct if mixed-price lines ever return.
 */
export interface PriceGroup {
  quantity: number;
  unit_price_centavos: number;
}

/** Local calendar date (`YYYY-MM-DD`) for `now` — markdown windows are gated
 * against the register's local date, not UTC, so a sale rung near midnight
 * uses the day the cashier sees. */
function localDateString(now: Date): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Whether an "on sale" markdown is in effect on `now`'s local date. Bounds are
 * inclusive and a null bound is open-ended on that side; ISO `YYYY-MM-DD`
 * strings order correctly under `<`/`>`. A zero/absent percentage is inactive.
 *
 * @param markdown - the item's markdown, or undefined
 * @param now      - clock to evaluate against (defaults to real time)
 */
export function isMarkdownActive(
  markdown: ItemMarkdown | undefined,
  now: Date = new Date(),
): boolean {
  if (!markdown || !(markdown.percentage > 0)) return false;
  const today = localDateString(now);
  if (markdown.date_from && today < markdown.date_from) return false;
  if (markdown.date_to && today > markdown.date_to) return false;
  return true;
}

/**
 * The regular unit price after any *currently active* markdown — the price a
 * single unit rings up at. Rounds to the nearest centavo and clamps to ≥ 0.
 * When no markdown applies (none set, or today is outside its window) this is
 * simply `item.price_centavos`. Quantity-break tiers are priced separately in
 * `priceLine` and are not reduced further by a markdown.
 *
 * @param item - the catalog item
 * @param now  - clock to evaluate the markdown window against
 * @returns the effective per-unit price in centavos
 */
export function effectiveUnitPrice(item: Item, now: Date = new Date()): number {
  const markdown = item.markdown;
  if (!isMarkdownActive(markdown, now)) return item.price_centavos;
  const factor = Math.max(0, Math.min(1, 1 - markdown!.percentage / 100));
  return Math.round(item.price_centavos * factor);
}

/**
 * Decompose buying `quantity` of an item into priced groups, applying any
 * quantity-break tier the store has configured.
 *
 * A tier is a **threshold**, not a bundle: `min_quantity` is the point at
 * which the tier's per-piece price kicks in, and `unit_price_centavos` is
 * that per-piece price — exactly what the store admin shows ("2+ pcs →
 * ₱75.00 each") and what the web POS charges. Buying 2 of an item with a
 * `{ min_quantity: 2, unit_price_centavos: 7500 }` tier is 2 × ₱75 = ₱150,
 * and buying 3 is 3 × ₱75 = ₱225 — the tier applies to *every* unit once
 * the threshold is met, with no odd unit left at the base price.
 *
 * With several tiers, the highest one the quantity qualifies for wins and
 * prices the whole line (5+ beats 2+ at qty 6). Below the lowest tier every
 * unit is priced at `effectiveUnitPrice` — i.e. after any active "on sale"
 * markdown. Tier prices are explicit multi-buy deals and are used as-is; a
 * markdown does not stack on top of them.
 *
 * The return type stays a list of groups so receipts and the cart line can
 * render mixed pricing if tiers ever grow bundle semantics again; today a
 * non-zero quantity always yields exactly one group.
 *
 * @param item     - the catalog item (its `price_tiers`/`markdown` may be undefined)
 * @param quantity - units being purchased
 * @param now      - clock for evaluating the markdown window (defaults to now)
 * @returns priced groups whose quantities sum to `quantity` (empty for qty 0)
 * @example
 *   // base 8000, tier { min_quantity: 2, unit_price_centavos: 7500 }: "80 each, 75 each at 2+"
 *   priceLine(item, 1) // [{ quantity: 1, unit_price_centavos: 8000 }]
 *   priceLine(item, 2) // [{ quantity: 2, unit_price_centavos: 7500 }]  // ₱150
 *   priceLine(item, 3) // [{ quantity: 3, unit_price_centavos: 7500 }]  // ₱225
 */
export function priceLine(
  item: Item,
  quantity: number,
  now: Date = new Date(),
): PriceGroup[] {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty === 0) return [];

  const basePrice = effectiveUnitPrice(item, now);

  // Highest threshold first, cheapest first among equal thresholds, so the
  // first tier the quantity reaches is the best one on offer.
  const tiers = (item.price_tiers ?? [])
    .filter((t) => t.min_quantity >= 1)
    .slice()
    .sort(
      (a, b) =>
        b.min_quantity - a.min_quantity ||
        a.unit_price_centavos - b.unit_price_centavos,
    );

  const tier = tiers.find((t) => qty >= t.min_quantity);
  const unitPrice = tier ? tier.unit_price_centavos : basePrice;

  return [{ quantity: qty, unit_price_centavos: unitPrice }];
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
