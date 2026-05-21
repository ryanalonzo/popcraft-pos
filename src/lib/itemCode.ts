/**
 * Item code and renter ID validation.
 *
 * Item codes are issued by Karl's Laravel API and embed the renter ID
 * (first segment) so receipts can be grouped per renter without an extra
 * lookup.
 */

/**
 * Legacy mock-catalog item code, e.g. "R042-00000001". Real items from
 * Karl's API use arbitrary SKUs (`BDJ-STK-056`) or numeric barcodes
 * (`0878047318412`). Kept for `parseItemCode` / `extractRenterFromCode`,
 * which gracefully return `null` for non-legacy codes.
 */
export const ITEM_CODE_REGEX = /^R\d{3}-\d{8}$/;

/** Renter ID, e.g. "R042". Legacy mock convention, see above. */
export const RENTER_ID_REGEX = /^R\d{3}$/;

/** Permissive scanner-input check: alnum + a few separators, 1–64 chars. */
const SCANNER_INPUT_REGEX = /^[A-Za-z0-9._\-/]{1,64}$/;

/**
 * Check whether a string is plausibly an item code that the catalog
 * lookup should attempt. The actual "exists" check is the SQLite
 * `getItemByCode` query; this is just a cheap UX gate against garbage
 * (empty strings, spaces, control characters from a flaky scanner).
 *
 * @example
 *   isValidItemCode("BDJ-STK-056")   // true (Karl's API SKU)
 *   isValidItemCode("R042-00000001") // true (legacy)
 *   isValidItemCode("0878047318412") // true (numeric barcode)
 *   isValidItemCode("")              // false
 *   isValidItemCode("  ")            // false
 */
export function isValidItemCode(code: string): boolean {
  return SCANNER_INPUT_REGEX.test(code.trim());
}

/**
 * Normalize a scanned/typed code before catalog lookup. The local catalog
 * stores SKUs in the casing the API emits (uppercase for Karl's data);
 * normalizing here prevents `bdj-stk-056` typed in lowercase from missing
 * the row.
 */
export function normalizeItemCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Parse an item code into its renter ID and sequence parts.
 *
 * @param code - the item code to parse
 * @returns an object with `renter_id`, `sequence`, and `full_code`, or
 *          `null` if `code` is not a valid item code
 * @example
 *   parseItemCode("R042-00000001")
 *   // { renter_id: "R042", sequence: "00000001", full_code: "R042-00000001" }
 *   parseItemCode("bogus") // null
 */
export function parseItemCode(
  code: string,
): { renter_id: string; sequence: string; full_code: string } | null {
  const match = code.match(/^(R\d{3})-(\d{8})$/);
  if (!match) return null;
  const renter_id = match[1];
  const sequence = match[2];
  if (renter_id === undefined || sequence === undefined) return null;
  return { renter_id, sequence, full_code: code };
}

/**
 * Extract just the renter ID from an item code.
 *
 * @param code - the item code
 * @returns the renter ID, or `null` if `code` is not a valid item code
 * @example
 *   extractRenterFromCode("R042-00000001") // "R042"
 *   extractRenterFromCode("nope")          // null
 */
export function extractRenterFromCode(code: string): string | null {
  return parseItemCode(code)?.renter_id ?? null;
}
