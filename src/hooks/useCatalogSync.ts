import { useQuery } from '@tanstack/react-query';

import { syncCatalog, type SyncResult } from '@/api/sync';

const SYNC_QUERY_KEY = ['catalog', 'sync'] as const;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export interface UseCatalogSyncResult {
  isLoading: boolean;
  isFetching: boolean;
  lastSyncAt: string | null;
  syncedCounts: { items: number; renters: number } | null;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Drives the local catalog cache. Mounted by the cashier layout so it
 * runs once at login and then every five minutes while the cashier flow
 * is in the foreground. Manual refetch is exposed for the "Sync now"
 * button on the catalog debug screen.
 *
 * Hits `GET /api/sync/catalog?since=<iso>` and upserts the response into
 * the local SQLite. First sync is a full pull; subsequent syncs send the
 * last server_time as `since` and only receive deltas.
 */
export function useCatalogSync(): UseCatalogSyncResult {
  const query = useQuery<SyncResult, Error>({
    queryKey: SYNC_QUERY_KEY,
    queryFn: syncCatalog,
    refetchInterval: FIVE_MINUTES_MS,
    refetchOnWindowFocus: true,
    staleTime: FIVE_MINUTES_MS,
  });

  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    lastSyncAt: query.data?.lastSyncAt ?? null,
    syncedCounts: query.data
      ? { items: query.data.items, renters: query.data.renters }
      : null,
    error: query.error,
    refetch: query.refetch,
  };
}
