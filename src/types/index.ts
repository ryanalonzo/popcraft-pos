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

export interface Item {
  id: string;
  code: string;
  name: string;
  description: string;
  renter_id: string;
  price_centavos: number;
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
