/**
 * Sales submission.
 *
 * `submitSale` is the single entry point used by the cashier flow and
 * the sync worker. It NEVER throws:
 *
 *   1. Probe `expo-network`. If we're sure we're offline, queue immediately.
 *   2. POST /api/sales with the full POS Sale. On 201, status='synced'.
 *   3. On 409 (duplicate client_sale_id), the sale is already on the
 *      server from a prior retry — treat as success.
 *   4. On any other failure, queue the payload locally and return queued.
 */

import { apiPostRaw } from '@/api/client';
import { enqueueSale } from '@/api/syncQueue';
import { probeOnline } from '@/lib/network';
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
  const online = await probeOnline();
  if (online === false) {
    await safeEnqueue(sale, 'offline');
    return { sale_id: sale.id, status: 'queued', error: 'offline' };
  }

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
