/**
 * Sync worker.
 *
 * Drains the `pending_sales` SQLite queue when the device is online:
 *
 * - Initialised once per app lifetime (module-level guard).
 * - On startup: probe network, refresh count, drain queue if not offline.
 * - On network "online" transitions: drain queue.
 * - `processNow()` is available for manual sync from the badge.
 *
 * To avoid burning battery during long outages, a single drain pass
 * stops after 5 consecutive failures and waits for the next trigger
 * (network event or manual sync) before retrying.
 *
 * Network detection goes through `@/lib/network` which degrades to
 * "unknown" when the native `expo-network` module isn't in the running
 * dev client. In that mode the worker still drains on startup and on
 * manual sync; only the automatic online-edge trigger goes dark.
 */

import { useEffect } from 'react';

import { submitSale } from '@/api/sales';
import {
  countPending,
  getPendingSales,
  incrementRetry,
  markSaleSynced,
} from '@/api/syncQueue';
import { probeOnline, subscribeOnline } from '@/lib/network';
import { useSaleStore } from '@/state/saleStore';
import { useSyncStore } from '@/state/syncStore';

const MAX_CONSECUTIVE_FAILURES = 5;

let initialized = false;
let processing = false;
let listenerAttached = false;

/** Refresh the badge count without doing any networking. */
export async function refreshPendingCount(): Promise<void> {
  try {
    const n = await countPending();
    useSyncStore.getState().setPendingCount(n);
  } catch {
    // Ignore — count is best-effort UI state.
  }
}

/**
 * Drain the pending-sales queue, oldest first. Safe to call repeatedly;
 * concurrent invocations no-op until the in-flight pass completes.
 */
export async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  useSyncStore.getState().setProcessing(true);

  let consecutiveFailures = 0;
  try {
    while (consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      const pending = await getPendingSales();
      if (pending.length === 0) break;
      const head = pending[0];
      if (!head) break;

      // eslint-disable-next-line no-console
      console.log(
        `[sync] attempting ${head.id} (retry ${head.retry_count})`,
      );
      const result = await submitSale(head.payload);

      if (result.status === 'synced') {
        await markSaleSynced(head.id);
        useSaleStore
          .getState()
          .markSynced(head.id, new Date().toISOString());
        consecutiveFailures = 0;
        // eslint-disable-next-line no-console
        console.log(`[sync] OK ${head.id}`);
      } else {
        await incrementRetry(head.id, result.error ?? 'unknown');
        consecutiveFailures += 1;
        // eslint-disable-next-line no-console
        console.log(
          `[sync] FAIL ${head.id} (${result.error ?? 'unknown'}) — ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`,
        );
      }
    }
  } finally {
    processing = false;
    useSyncStore.getState().setProcessing(false);
    await refreshPendingCount();
    useSyncStore.getState().setLastSyncAt(new Date().toISOString());
  }
}

async function initWorker(): Promise<void> {
  if (initialized) return;
  initialized = true;

  await refreshPendingCount();

  const online = await probeOnline();
  useSyncStore.getState().setOnline(online);

  // Drain unless we've confirmed offline. `null` (unknown) attempts and
  // lets the request itself fail honestly.
  if (online !== false) {
    processQueue();
  }

  if (!listenerAttached) {
    subscribeOnline((isOnlineNow) => {
      const wasOnline = useSyncStore.getState().isOnline;
      useSyncStore.getState().setOnline(isOnlineNow);
      if (isOnlineNow === true && wasOnline !== true) {
        processQueue();
      }
    });
    listenerAttached = true;
  }
}

export interface UseSyncWorkerResult {
  pendingCount: number;
  isProcessing: boolean;
  lastSyncAt: string | null;
  isOnline: boolean | null;
  processNow: () => Promise<void>;
}

/**
 * Mount the worker (idempotent) and expose its observable state.
 * Call from a long-lived layout (the cashier layout) — calling it from
 * multiple screens is fine, the initialisation only happens once.
 */
export function useSyncWorker(): UseSyncWorkerResult {
  useEffect(() => {
    initWorker();
  }, []);

  const pendingCount = useSyncStore((s) => s.pendingCount);
  const isProcessing = useSyncStore((s) => s.isProcessing);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const isOnline = useSyncStore((s) => s.isOnline);

  return {
    pendingCount,
    isProcessing,
    lastSyncAt,
    isOnline,
    processNow: processQueue,
  };
}
