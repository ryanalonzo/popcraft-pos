/**
 * Sales-tax configuration — single source of truth.
 *
 * Popcraft Arts operates under the 8% percentage-tax option (TRAIN law,
 * non-VAT businesses under ₱3M annual gross). Tax is treated as a
 * back-office deduction from gross revenue, NOT a line added to the
 * customer's bill — the displayed item prices are already gross /
 * tax-inclusive, so the cart UI shows subtotal/discount/total and stops
 * there.
 *
 * `tax_centavos` on each saved `Sale` is the *embedded* tax portion of
 * the gross total, computed inversely:
 *
 *   tax = round(gross * rate / (1 + rate))
 *
 * Reports use it; the cashier never sees it.
 */

export const TAX_RATE = 0.08;

export const TAX_PERCENT_LABEL = `${Math.round(TAX_RATE * 100)}%`;

/** Used in back-office reports. */
export const TAX_LABEL = `Tax (${TAX_PERCENT_LABEL})`;

/**
 * Extract the embedded tax portion of a gross amount.
 * `gross` and the return are integer centavos.
 */
export function embeddedTax(grossCentavos: number): number {
  return Math.round((grossCentavos * TAX_RATE) / (1 + TAX_RATE));
}
