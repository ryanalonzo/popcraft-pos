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
import { clampToStock } from '@/lib/stock';
import { TAX_RATE } from '@/lib/tax';
import type { CartLine, Item } from '@/types';

export { TAX_RATE } from '@/lib/tax';

/** Outcome of `addItem` — lets the UI toast when a scan is blocked by stock. */
export interface AddItemResult {
  /** False when the add was blocked because the cart is already at stock. */
  added: boolean;
  /** Resulting quantity in the cart for this item. */
  quantity: number;
  /** Stock cap, or null when stock is unknown (uncapped). */
  available: number | null;
}

/** Outcome of `setQuantity` — `applied` is the value after clamping to stock. */
export interface SetQuantityResult {
  applied: number;
  /** True when the requested quantity exceeded available stock. */
  capped: boolean;
  available: number | null;
}

export interface CartState {
  lines: CartLine[];
  discount_centavos: number;

  addItem: (item: Item) => AddItemResult;
  removeLine: (itemId: string) => void;
  setQuantity: (itemId: string, qty: number) => SetQuantityResult;
  applyDiscount: (centavos: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  discount_centavos: 0,

  addItem: (item) => {
    const existing = get().lines.find((l) => l.item.id === item.id);
    const current = existing?.quantity ?? 0;
    const next = current + 1;
    // Block the add when it would push past the last-synced stock count.
    if (item.stock != null && next > item.stock) {
      return { added: false, quantity: current, available: item.stock };
    }
    set((state) => {
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.item.id === item.id ? { ...l, quantity: next } : l,
          ),
        };
      }
      return { lines: [...state.lines, { item, quantity: next }] };
    });
    return { added: true, quantity: next, available: item.stock };
  },

  removeLine: (itemId) =>
    set((state) => ({
      lines: state.lines.filter((l) => l.item.id !== itemId),
    })),

  setQuantity: (itemId, qty) => {
    const line = get().lines.find((l) => l.item.id === itemId);
    const available = line?.item.stock ?? null;
    if (qty <= 0) {
      set((state) => ({
        lines: state.lines.filter((l) => l.item.id !== itemId),
      }));
      return { applied: 0, capped: false, available };
    }
    const applied = line ? clampToStock(line.item, qty) : qty;
    set((state) => ({
      lines: state.lines.map((l) =>
        l.item.id === itemId ? { ...l, quantity: applied } : l,
      ),
    }));
    return { applied, capped: available != null && qty > available, available };
  },

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
