/**
 * Shared domain types.
 *
 * Conventions (match Karl's Laravel API):
 * - Money is BIGINT centavos. ₱249.50 is 24950.
 * - Item codes: ^R\d{3}-\d{8}$  (e.g. R042-00000001)
 * - Renter IDs: ^R\d{3}$         (e.g. R042)
 * - Timestamps are ISO 8601 strings.
 */

export interface Renter {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

/**
 * One quantity-break tier — a "buy N or more, pay ₱X each" price break.
 *
 * `min_quantity` is a **threshold**, not a bundle size, and
 * `unit_price_centavos` is the **per-piece price charged once the line
 * reaches that threshold**. The store admin renders this as "2+ pcs →
 * ₱75.00 each", i.e. `{ min_quantity: 2, unit_price_centavos: 7500 }`, and
 * charges 2 × ₱75 = ₱150 for a pair. The POS must read the field the same
 * way the web POS does or the two registers disagree on the total.
 *
 * The base `price_centavos` applies only below the lowest tier ("base price
 * of ₱80.00 applies below the lowest tier"); at or above a threshold every
 * unit on the line gets the tier rate, with no odd unit left at base. When
 * more than one tier qualifies the highest threshold wins. See `priceLine`
 * in `@/lib/cart`.
 */
export interface PriceTier {
  /** Lowest line quantity at which this tier's price applies (the "2" in "2+"). */
  min_quantity: number;
  /** Per-piece price (centavos) charged for every unit once `min_quantity` is met. */
  unit_price_centavos: number;
}

/**
 * An active, approved "on sale" markdown, carried from the server as a
 * percentage off the regular `price_centavos` plus an optional date window.
 * The POS applies it itself at sale time (see `effectiveUnitPrice` in
 * `@/lib/cart`) so the discount honours the window even while offline — a
 * cached catalog stops discounting once `date_to` passes. `null` bounds mean
 * an open-ended window on that side. Dates are inclusive local calendar dates
 * (`YYYY-MM-DD`), compared against the register's local date.
 */
export interface ItemMarkdown {
  /** Percent off the regular price, 0–100. */
  percentage: number;
  /** Inclusive first day the markdown applies, or null for "already active". */
  date_from: string | null;
  /** Inclusive last day the markdown applies, or null for "no end". */
  date_to: string | null;
}

export interface Item {
  id: string;
  /** Human-friendly identifier — SKU for Karl's API, R\d{3}-\d{8} for legacy. */
  code: string;
  /** Raw scanner-readable barcode (numeric, typically EAN-13). May be null. */
  barcode_value: string | null;
  name: string;
  description: string;
  renter_id: string;
  price_centavos: number;
  /**
   * Bulk / quantity-break tiers, ascending by `min_quantity`. Optional and
   * defaults to "none": items synced before this field existed, or from a
   * server that doesn't send it, simply price at `price_centavos`.
   */
  price_tiers?: PriceTier[];
  /**
   * Active "on sale" markdown, or undefined when the item isn't on sale.
   * Reduces the effective unit price of non-tier units; quantity-break tiers
   * keep their own explicit prices (a store-wide markdown does not stack on
   * top of a multi-buy deal). See `effectiveUnitPrice` in `@/lib/cart`.
   */
  markdown?: ItemMarkdown;
  /**
   * On-hand stock at last catalog sync. `null` when unknown (row predates
   * the stock column, or synced from a server that didn't send it) — the
   * cart treats null as "no cap". Otherwise the cart blocks adding beyond
   * this count. It's a last-synced snapshot, not live server stock.
   */
  stock: number | null;
  is_active: boolean;
  updated_at: string;
}

/** Local-only — built in the cart, never sent to the server. */
export interface CartLine {
  item: Item;
  quantity: number;
}

export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'card';

export interface SaleLine {
  item_id: string;
  item_code: string;
  item_name: string;
  renter_id: string;
  quantity: number;
  unit_price_centavos: number;
  line_total_centavos: number;
}

export interface Sale {
  id: string;
  cashier_id: string;
  lines: SaleLine[];
  subtotal_centavos: number;
  tax_centavos: number;
  total_centavos: number;
  payment_method: PaymentMethod;
  amount_tendered_centavos: number | null;
  change_centavos: number | null;
  created_at: string;
  /** Null while the sale is still queued offline. */
  synced_at: string | null;
}

export interface Cashier {
  id: string;
  name: string;
  username: string;
}
