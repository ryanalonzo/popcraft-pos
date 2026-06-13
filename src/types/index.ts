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
 * One quantity-break tier. Once the cart holds `min_quantity` or more of the
 * item, every unit in that line is priced at `unit_price_centavos` instead of
 * the base price. Mirrors the API's `item_price_tiers` rows (emitted in
 * centavos by the sync endpoint). The base `price_centavos` applies below the
 * lowest tier; when more than one tier qualifies the highest `min_quantity`
 * wins. See `effectiveUnitPrice` in `@/lib/cart`.
 */
export interface PriceTier {
  min_quantity: number;
  unit_price_centavos: number;
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
