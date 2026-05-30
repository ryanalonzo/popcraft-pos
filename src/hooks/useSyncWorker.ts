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

  // Snapshot the queue once and walk it oldest-first. Walking a snapshot
  // (rather than always re-fetching the head) means a sale the server
  // permanently rejects gets SKIPPED — the healthy sales behind it still
  // sync. A single poison sale used to wedge the entire queue forever.
  let consecutiveTransientFailures = 0;
  try {
    const pending = await getPendingSales();
    for (const sale of pending) {
      // eslint-disable-next-line no-console
      console.log(`[sync] attempting ${sale.id} (retry ${sale.retry_count})`);
      const result = await submitSale(sale.payload);

      if (result.status === 'synced') {
        await markSaleSynced(sale.id);
        useSaleStore.getState().markSynced(sale.id, new Date().toISOString());
        consecutiveTransientFailures = 0;
        // eslint-disable-next-line no-console
        console.log(`[sync] OK ${sale.id}`);
        continue;
      }

      await incrementRetry(sale.id, result.error ?? 'unknown');

      if (result.permanent) {
        // Server-side rejection (e.g. 422 — item no longer exists). Retrying
        // won't help; skip it and keep draining the rest. It stays in the
        // queue (counted as pending) so the sale isn't silently lost.
        // eslint-disable-next-line no-console
        console.log(`[sync] SKIP ${sale.id} (permanent: ${result.error ?? 'rejected'})`);
        continue;
      }

      // Transient failure (offline, timeout, 5xx). If we hit a run of these
      // the device is almost certainly offline — stop and wait for the next
      // trigger rather than hammering the radio through the whole queue.
      consecutiveTransientFailures += 1;
      // eslint-disable-next-line no-console
      console.log(
        `[sync] FAIL ${sale.id} (${result.error ?? 'unknown'}) — ${consecutiveTransientFailures}/${MAX_CONSECUTIVE_FAILURES}`,
      );
      if (consecutiveTransientFailures >= MAX_CONSECUTIVE_FAILURES) break;
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

  // Surface the probe result for the UI badge but DO NOT gate the
  // drain on it. Real-world reports from Samsung tablets had the OS
  // returning isConnected=false despite the API being fully reachable.
  // The per-sale fetch attempt is the canonical "are we online?" check
  // — if it fails, submitSale queues and we retry on the next trigger.
  probeOnline().then((online) => useSyncStore.getState().setOnline(online));
  processQueue();

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
