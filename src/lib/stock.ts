/**
 * Stock-cap helpers. Stock on an `Item` is the on-hand count from the last
 * catalog sync — a snapshot, not live server stock. `null` means unknown
 * (synced before the stock column existed, or from a server that didn't
 * send it), in which case we do NOT cap: blocking everything until a
 * re-sync would be worse than trusting the cashier. The server still
 * enforces real stock on submit, so this is a UX guard, not the authority.
 */

import type { Item } from '@/types';

/** True when `desiredQty` units of `item` are allowed (stock unknown ⇒ allowed). */
export function isWithinStock(item: Item, desiredQty: number): boolean {
  return item.stock == null || desiredQty <= item.stock;
}

/** Clamp a desired quantity to available stock. No-op when stock is unknown. */
export function clampToStock(item: Item, desiredQty: number): number {
  return item.stock == null ? desiredQty : Math.min(desiredQty, item.stock);
}
