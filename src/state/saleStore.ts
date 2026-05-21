/**
 * In-session sales history.
 *
 * `recentSales` is a memory-only cap-50 ring of sales recorded since the
 * app was launched. The authoritative log lives on Karl's server — this
 * store just powers the cashier home (today's stats, last-N list) and
 * the receipt-preview screen for sales completed in the current session.
 */

import { useMemo } from 'react';
import { create } from 'zustand';

import type { Sale } from '@/types';

const HISTORY_LIMIT = 50;

export interface SaleStoreState {
  recentSales: Sale[];
  recordSale: (sale: Sale) => void;
  /** Update a sale in place — used when offline queue marks it synced. */
  markSynced: (saleId: string, syncedAt: string) => void;
  getSaleById: (saleId: string) => Sale | undefined;
  reset: () => void;
}

export const useSaleStore = create<SaleStoreState>((set, get) => ({
  recentSales: [],

  recordSale: (sale) =>
    set((state) => {
      const next = [sale, ...state.recentSales];
      if (next.length > HISTORY_LIMIT) next.length = HISTORY_LIMIT;
      return { recentSales: next };
    }),

  markSynced: (saleId, syncedAt) =>
    set((state) => ({
      recentSales: state.recentSales.map((s) =>
        s.id === saleId ? { ...s, synced_at: syncedAt } : s,
      ),
    })),

  getSaleById: (saleId) =>
    get().recentSales.find((s) => s.id === saleId),

  reset: () => set({ recentSales: [] }),
}));

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export function isSameLocalDate(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export const selectRecentSales = (state: SaleStoreState) => state.recentSales;

/**
 * Today-only derivations: these can't go through `useSaleStore(selector)`
 * directly because filtering returns a fresh array each call and React's
 * `useSyncExternalStore` would treat every render as a new snapshot
 * (infinite loop, "result of getSnapshot should be cached" warning).
 * Instead we subscribe to the underlying `recentSales` and memoise.
 */
export function filterTodaysSales(sales: Sale[]): Sale[] {
  const today = new Date();
  return sales.filter((s) => isSameLocalDate(s.created_at, today));
}

/* ------------------------------------------------------------------ */
/* Reactive hooks                                                      */
/* ------------------------------------------------------------------ */

export const useRecentSales = () => useSaleStore(selectRecentSales);

export const useTodaysSales = (): Sale[] => {
  const recent = useSaleStore(selectRecentSales);
  return useMemo(() => filterTodaysSales(recent), [recent]);
};

export const useTodaysRevenue = (): number => {
  const todays = useTodaysSales();
  return useMemo(
    () => todays.reduce((sum, s) => sum + s.total_centavos, 0),
    [todays],
  );
};

export const useTodaysSaleCount = (): number => {
  const todays = useTodaysSales();
  return todays.length;
};
