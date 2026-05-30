/**
 * Sales submission.
 *
 * `submitSale` is the single entry point used by the cashier flow and
 * the sync worker. It NEVER throws:
 *
 *   1. POST /api/sales with the full POS Sale. On 201, status='synced'.
 *   2. On 409 (duplicate client_sale_id), the sale is already on the
 *      server from a prior retry — treat as success.
 *   3. On any other failure (network down, timeout, 4xx, 5xx), queue
 *      the payload locally and return queued.
 *
 * The fetch attempt itself is the canonical "are we online?" signal —
 * no pre-flight `probeOnline()`. A previous version short-circuited
 * to "queued" when `expo-network` reported offline, which
 * false-positived on Samsung tablets whose `isConnected` flag flips
 * to false despite the device being able to reach the API. Trusting
 * the fetch is robust against every flavor of "the OS thinks we're
 * offline but the network actually works."
 */

import { ApiError, apiPostRaw } from '@/api/client';
import { enqueueSale } from '@/api/syncQueue';
import type { Sale } from '@/types';

export type SubmitStatus = 'synced' | 'queued';

export interface SubmitResult {
  sale_id: string;
  status: SubmitStatus;
  /** Set when `status === 'queued'`. */
  error?: string;
  /**
   * Set when `status === 'queued'`. `true` means the server rejected the
   * sale with a 4xx (e.g. 422 — its item no longer exists): retrying the
   * SAME payload will never succeed, so the worker should skip past it
   * rather than let it block the queue. `false`/undefined means a
   * transient failure (network down, timeout, 5xx) worth retrying.
   */
  permanent?: boolean;
}

interface SaleAck {
  sale_id: string;
  created_at: string;
}

export async function submitSale(sale: Sale): Promise<SubmitResult> {
  try {
    const { status } = await apiPostRaw<SaleAck>('/api/sales', sale, {
      acceptStatuses: [409],
    });
    // 201 = newly created, 409 = idempotent dup (already on server).
    if (status === 201 || status === 409) {
      return { sale_id: sale.id, status: 'synced' };
    }
    throw new Error(`Unexpected status ${status} from POST /api/sales`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A 4xx (except 408 timeout / 429 rate-limit) means the server
    // understood the request and rejected it on its merits — most often a
    // 422 because the sale's item UUID no longer exists after a server DB
    // rebuild. Re-POSTing the identical payload can't fix that, so flag it
    // permanent and let the worker move on instead of wedging the queue.
    const permanent =
      err instanceof ApiError &&
      err.status >= 400 &&
      err.status < 500 &&
      err.status !== 408 &&
      err.status !== 429;
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        `[sales] submit ${sale.id} queued${permanent ? ' (permanent)' : ''}: ${message}`,
      );
    }
    await safeEnqueue(sale, message);
    return { sale_id: sale.id, status: 'queued', error: message, permanent };
  }
}

async function safeEnqueue(sale: Sale, error: string): Promise<void> {
  try {
    await enqueueSale(sale, error);
  } catch {
    // If even the local queue fails, swallow — we've done all we can.
  }
}
