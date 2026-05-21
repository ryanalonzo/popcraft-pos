/**
 * Offline sync queue.
 *
 * Sales that can't reach the server are persisted to the `pending_sales`
 * table (schema from Phase 4) so they survive app kills, reboots, and
 * extended outages. The Phase 8 worker (see `useSyncWorker`) drains the
 * queue when the device comes back online.
 *
 * All helpers here are local-only — they never touch the network.
 */

import { openDatabase } from '@/lib/db';
import type { Sale } from '@/types';

export interface PendingSaleRecord {
  id: string;
  payload: Sale;
  created_at: string;
  retry_count: number;
  last_error: string | null;
}

interface PendingRow {
  id: string;
  payload: string;
  created_at: string;
  retry_count: number;
  last_error: string | null;
}

function rowToRecord(row: PendingRow): PendingSaleRecord | null {
  try {
    const payload = JSON.parse(row.payload) as Sale;
    return {
      id: row.id,
      payload,
      created_at: row.created_at,
      retry_count: row.retry_count,
      last_error: row.last_error,
    };
  } catch {
    return null;
  }
}

/** Insert (or update) a sale in the offline queue. */
export async function enqueueSale(sale: Sale, error?: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    `INSERT INTO pending_sales (id, payload, created_at, retry_count, last_error)
      VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        payload = excluded.payload,
        last_error = COALESCE(excluded.last_error, pending_sales.last_error)`,
    [sale.id, JSON.stringify(sale), sale.created_at, error ?? null],
  );
}

/** Oldest-first list of every pending sale. */
export async function getPendingSales(): Promise<PendingSaleRecord[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<PendingRow>(
    `SELECT id, payload, created_at, retry_count, last_error
       FROM pending_sales
       ORDER BY created_at`,
  );
  const out: PendingSaleRecord[] = [];
  for (const row of rows) {
    const rec = rowToRecord(row);
    if (rec) out.push(rec);
  }
  return out;
}

/** Remove a successfully-synced sale from the queue. */
export async function markSaleSynced(saleId: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM pending_sales WHERE id = ?', [saleId]);
}

/** Bump `retry_count` and record the latest failure for a sale. */
export async function incrementRetry(
  saleId: string,
  error: string,
): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    `UPDATE pending_sales
       SET retry_count = retry_count + 1,
           last_error  = ?
       WHERE id = ?`,
    [error, saleId],
  );
}

/** Number of sales waiting to sync. */
export async function countPending(): Promise<number> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM pending_sales',
  );
  return row?.n ?? 0;
}
