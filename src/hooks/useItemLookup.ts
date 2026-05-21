import { useQuery } from '@tanstack/react-query';

import { getItemByCode } from '@/api/catalog';
import { isValidItemCode, normalizeItemCode } from '@/lib/itemCode';
import type { Item } from '@/types';

export type ItemLookupError = 'invalid_format' | 'not_found' | null;

export interface UseItemLookupResult {
  item: Item | null;
  error: ItemLookupError;
  isLoading: boolean;
}

/**
 * Resolve a scanned/typed barcode against the local catalog.
 *
 * Behaviour:
 * - Empty/null code  → no lookup, no error.
 * - Bad format       → `error: 'invalid_format'` (no DB hit).
 * - Format ok        → SQLite lookup. If the row is missing or inactive,
 *                      `error: 'not_found'`.
 *
 * The hook never reaches the network — the catalog cache is the source
 * of truth on the tablet.
 */
export function useItemLookup(code: string | null): UseItemLookupResult {
  const normalized = code ? normalizeItemCode(code) : '';
  const hasCode = normalized.length > 0;
  const validFormat = hasCode && isValidItemCode(normalized);

  const query = useQuery<Item | null>({
    queryKey: ['catalog', 'item', normalized],
    queryFn: () => getItemByCode(normalized),
    enabled: validFormat,
    staleTime: 60_000,
  });

  if (!hasCode) {
    return { item: null, error: null, isLoading: false };
  }
  if (!validFormat) {
    return { item: null, error: 'invalid_format', isLoading: false };
  }
  if (query.isLoading) {
    return { item: null, error: null, isLoading: true };
  }
  if (!query.data) {
    return { item: null, error: 'not_found', isLoading: false };
  }
  return { item: query.data, error: null, isLoading: false };
}
