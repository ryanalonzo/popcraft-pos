import type { PaymentMethod } from '@/types';

/**
 * Whether a payment method should pop the physical cash drawer.
 *
 * ONLY physical cash opens the drawer. GCash, Maya, and card are digital —
 * there's no cash to deposit, so the drawer must stay shut. This is the
 * single source of truth for both the receipt's drawer-kick byte and the
 * print job's openDrawer flag.
 */
export function opensCashDrawer(method: PaymentMethod): boolean {
  return method === 'cash';
}
