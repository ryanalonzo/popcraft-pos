/**
 * Pure factory that turns the cart state into a wire-format `Sale`.
 *
 * Every monetary value is computed through `@/lib/cart` so the integer-
 * centavos invariant from Phase 2 carries all the way to the receipt.
 * Item codes/names are *snapshotted* into each line so reprinting an
 * older sale is correct even if catalog data changes later.
 */

import {
  calculateChange,
  calculateLineTotal,
  calculateSubtotal,
  calculateTotal,
} from '@/lib/cart';
import { embeddedTax, TAX_RATE } from '@/lib/tax';
import { uuid } from '@/lib/uuid';
import type { CartLine, PaymentMethod, Sale, SaleLine } from '@/types';

export { TAX_RATE } from '@/lib/tax';

export interface BuildSaleInput {
  cartLines: CartLine[];
  paymentMethod: PaymentMethod;
  cashierId: string;
  /** Cash tendered, in centavos. Required for `payment_method === 'cash'`. */
  amountTendered?: number | null;
  /** Discount applied to the subtotal, in centavos. Defaults to 0. */
  discount?: number;
}

/** Build a fully populated, server-ready `Sale` from cart state. */
export function buildSaleFromCart(input: BuildSaleInput): Sale {
  const discount = Math.max(0, Math.floor(input.discount ?? 0));
  const subtotal = calculateSubtotal(input.cartLines);
  // Gross total: customer pays subtotal minus any discount. Displayed
  // item prices are already tax-inclusive, so no tax is added here.
  const total = calculateTotal(subtotal, 0, discount);
  // Back-office embedded-tax portion of the gross, for reports.
  const tax = embeddedTax(total);

  const isCash = input.paymentMethod === 'cash';
  const amountTendered = isCash ? (input.amountTendered ?? null) : null;
  const change =
    isCash && amountTendered !== null ? calculateChange(total, amountTendered) : null;

  const lines: SaleLine[] = input.cartLines.map((line) => ({
    item_id: line.item.id,
    item_code: line.item.code,
    item_name: line.item.name,
    renter_id: line.item.renter_id,
    quantity: line.quantity,
    unit_price_centavos: line.item.price_centavos,
    line_total_centavos: calculateLineTotal(line),
  }));

  return {
    id: uuid(),
    cashier_id: input.cashierId,
    lines,
    subtotal_centavos: subtotal,
    tax_centavos: tax,
    total_centavos: total,
    payment_method: input.paymentMethod,
    amount_tendered_centavos: amountTendered,
    change_centavos: change,
    created_at: new Date().toISOString(),
    synced_at: null,
  };
}
