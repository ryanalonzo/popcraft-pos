/**
 * Sync state shared between the worker hook, the cart screen, and the
 * status badge. The hook owns the writes; UI components only read.
 */

import { create } from 'zustand';

export interface SyncStoreState {
  /** Sales currently waiting in `pending_sales`. */
  pendingCount: number;
  /** A queue-drain pass is in flight. */
  isProcessing: boolean;
  /** ISO timestamp of the last completed pass (success or partial). */
  lastSyncAt: string | null;
  /** Last known network state; `null` until first probe. */
  isOnline: boolean | null;

  setPendingCount: (n: number) => void;
  setProcessing: (b: boolean) => void;
  setLastSyncAt: (iso: string) => void;
  setOnline: (b: boolean | null) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  pendingCount: 0,
  isProcessing: false,
  lastSyncAt: null,
  isOnline: null,
  setPendingCount: (n) => set({ pendingCount: n }),
  setProcessing: (b) => set({ isProcessing: b }),
  setLastSyncAt: (iso) => set({ lastSyncAt: iso }),
  setOnline: (b) => set({ isOnline: b }),
}));
