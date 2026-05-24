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

import { apiPostRaw } from '@/api/client';
import { enqueueSale } from '@/api/syncQueue';
import type { Sale } from '@/types';

export type SubmitStatus = 'synced' | 'queued';

export interface SubmitResult {
  sale_id: string;
  status: SubmitStatus;
  /** Set when `status === 'queued'`. */
  error?: string;
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
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[sales] submit ${sale.id} queued: ${message}`);
    }
    await safeEnqueue(sale, message);
    return { sale_id: sale.id, status: 'queued', error: message };
  }
}

async function safeEnqueue(sale: Sale, error: string): Promise<void> {
  try {
    await enqueueSale(sale, error);
  } catch {
    // If even the local queue fails, swallow — we've done all we can.
  }
}
