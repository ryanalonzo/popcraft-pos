/**
 * Catalog sync.
 *
 * `GET /api/sync/catalog?since=<iso>` returns the items+renters delta
 * since the timestamp the POS last persisted. On first launch (no
 * `since`), it returns the full catalog. Successful sync writes:
 *   - upserted items + renters into local SQLite
 *   - `server_time` from the response → next `since`
 */

import {
  getLastSyncTime,
  setLastSyncTime,
  upsertItems,
  upsertRenters,
} from '@/api/catalog';
import { apiGet } from '@/api/client';
import type { Item, Renter } from '@/types';

export interface SyncResult {
  items: number;
  renters: number;
  /** ISO timestamp written to `sync_state` after a successful run. */
  lastSyncAt: string;
}

interface CatalogPayload {
  renters: Renter[];
  items: Item[];
  server_time: string;
}

export async function syncCatalog(): Promise<SyncResult> {
  const since = await getLastSyncTime();
  const payload = await apiGet<CatalogPayload>('/api/sync/catalog', since ? { since } : undefined);

  await upsertRenters(payload.renters);
  await upsertItems(payload.items);

  const lastSyncAt = payload.server_time ?? new Date().toISOString();
  await setLastSyncTime(lastSyncAt);

  return {
    items: payload.items.length,
    renters: payload.renters.length,
    lastSyncAt,
  };
}
