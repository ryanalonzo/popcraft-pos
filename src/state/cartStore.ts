/**
 * In-memory cart. Lines and discount are the only persisted state — all
 * money totals are derived through pure functions from `@/lib/cart` so a
 * single source of truth (`cart.ts`) governs every calculation.
 *
 * Selectors are exported alongside the store so call sites can subscribe
 * to just the slice they need (`useCartSubtotal`, `useCartTotal`, etc.)
 * without re-rendering on unrelated state changes.
 */

import { create } from 'zustand';

import {
  calculateLineTotal,
  calculateSubtotal,
  calculateTax,
  calculateTotal,
} from '@/lib/cart';
import { TAX_RATE } from '@/lib/tax';
import type { CartLine, Item } from '@/types';

export { TAX_RATE } from '@/lib/tax';

export interface CartState {
  lines: CartLine[];
  discount_centavos: number;

  addItem: (item: Item) => void;
  removeLine: (itemId: string) => void;
  setQuantity: (itemId: string, qty: number) => void;
  applyDiscount: (centavos: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  discount_centavos: 0,

  addItem: (item) =>
    set((state) => {
      const existing = state.lines.find((l) => l.item.id === item.id);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      return { lines: [...state.lines, { item, quantity: 1 }] };
    }),

  removeLine: (itemId) =>
    set((state) => ({
      lines: state.lines.filter((l) => l.item.id !== itemId),
    })),

  setQuantity: (itemId, qty) =>
    set((state) => {
      if (qty <= 0) {
        return { lines: state.lines.filter((l) => l.item.id !== itemId) };
      }
      return {
        lines: state.lines.map((l) =>
          l.item.id === itemId ? { ...l, quantity: qty } : l,
        ),
      };
    }),

  applyDiscount: (centavos) =>
    set({ discount_centavos: Math.max(0, Math.floor(centavos)) }),

  clearCart: () => set({ lines: [], discount_centavos: 0 }),
}));

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export const selectLines = (state: CartState) => state.lines;
export const selectDiscount = (state: CartState) => state.discount_centavos;

export const selectSubtotal = (state: CartState) =>
  calculateSubtotal(state.lines);

/**
 * Embedded back-office tax portion of the gross subtotal. NOT used in
 * the cart total — kept here so reports can read a single source.
 */
export const selectTax = (state: CartState) =>
  calculateTax(calculateSubtotal(state.lines), TAX_RATE);

export const selectTotal = (state: CartState) => {
  // Customer pays gross subtotal minus any discount. Tax is deducted
  // from revenue in reports, not added at the register.
  const subtotal = calculateSubtotal(state.lines);
  return calculateTotal(subtotal, 0, state.discount_centavos);
};

export const selectItemCount = (state: CartState) =>
  state.lines.reduce((n, l) => n + l.quantity, 0);

export const selectIsEmpty = (state: CartState) => state.lines.length === 0;

/* ------------------------------------------------------------------ */
/* Reactive selector hooks                                             */
/* ------------------------------------------------------------------ */

export const useCartLines = () => useCartStore(selectLines);
export const useCartDiscount = () => useCartStore(selectDiscount);
export const useCartSubtotal = () => useCartStore(selectSubtotal);
export const useCartTax = () => useCartStore(selectTax);
export const useCartTotal = () => useCartStore(selectTotal);
export const useCartItemCount = () => useCartStore(selectItemCount);
export const useCartIsEmpty = () => useCartStore(selectIsEmpty);

/** Snapshot of a single line — useful for derived row-level views. */
export function getCartLineTotal(line: CartLine): number {
  return calculateLineTotal(line);
}
